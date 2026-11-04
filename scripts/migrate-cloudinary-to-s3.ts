/**
 * One-off: copy Cloudinary-referenced assets to S3 and rewrite DB keys/URLs.
 *
 * Defaults to dry-run. Pass --execute to upload + update rows.
 *
 *   npx tsx scripts/migrate-cloudinary-to-s3.ts
 *   npx tsx scripts/migrate-cloudinary-to-s3.ts --execute
 *   npx tsx scripts/migrate-cloudinary-to-s3.ts --execute --limit=20
 *
 * Requires Cloudinary + AWS env vars (ignores UPLOAD_PROVIDER).
 * Does NOT delete Cloudinary originals.
 */

import 'dotenv/config';
import { promises as fs } from 'fs';
import path from 'path';
import { eq } from 'drizzle-orm';
import {
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { v2 as cloudinary } from 'cloudinary';
import { db } from '../lib/db';
import {
  applicationDrafts,
  documents,
  passportServices,
  visaApplications,
} from '../lib/db/schema';
import {
  blogPosts,
  countries,
  documentTypes,
} from '../lib/db/schema-extended';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const EXECUTE = args.includes('--execute');
const limitArg = args.find((a) => a.startsWith('--limit='));
const LIMIT = limitArg
  ? Math.max(0, parseInt(limitArg.split('=')[1] || '0', 10) || 0)
  : 0;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ResourceType = 'image' | 'raw';

interface AssetOrigin {
  table: string;
  id: string;
  field: string;
}

interface CollectedAsset {
  /** Cloudinary public_id (no extension). */
  publicId: string;
  /** Preferred S3 object key (may include extension). */
  preferredKey?: string;
  sourceUrl?: string;
  resourceTypeHint?: ResourceType;
  origins: AssetOrigin[];
}

interface TransferResult {
  publicId: string;
  oldKey?: string;
  newKey: string;
  newUrl: string;
  bytes: number;
  mimeType: string;
  skipped?: boolean;
  reason?: string;
  error?: string;
}

interface RewriteMap {
  /** Exact string replacements for URLs and keys. */
  replacements: Map<string, string>;
  /** public_id (no ext) → new S3 key */
  publicIdToKey: Map<string, string>;
  /** public_id → new S3 URL */
  publicIdToUrl: Map<string, string>;
}

// ---------------------------------------------------------------------------
// Env / clients
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function initCloudinary() {
  const cloudName = requireEnv('CLOUDINARY_CLOUD_NAME');
  const apiKey = requireEnv('CLOUDINARY_API_KEY');
  const apiSecret = requireEnv('CLOUDINARY_API_SECRET');
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });
  return cloudName;
}

function initS3() {
  const region = process.env.AWS_REGION || 'ap-south-1';
  const bucket = requireEnv('AWS_S3_BUCKET_NAME');
  const accessKeyId = requireEnv('AWS_ACCESS_KEY_ID');
  const secretAccessKey = requireEnv('AWS_SECRET_ACCESS_KEY');
  const client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
  return { client, bucket, region };
}

function s3PublicUrl(bucket: string, region: string, key: string): string {
  return `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
}

// ---------------------------------------------------------------------------
// Cloudinary URL / key helpers
// ---------------------------------------------------------------------------

function isCloudinaryUrl(value: string): boolean {
  return value.includes('res.cloudinary.com');
}

function isS3Url(value: string): boolean {
  return value.includes('.s3.') && value.includes('.amazonaws.com');
}

function stripExtension(key: string): string {
  return key.replace(/\.[^/.]+$/, '');
}

function hasFileExtension(key: string): boolean {
  return /\.[a-z0-9]{1,8}$/i.test(key);
}

/** Parse Cloudinary delivery URL → public_id (no version, keep path, strip ext). */
function parseCloudinaryPublicId(url: string): {
  publicId: string;
  resourceType: ResourceType;
  format?: string;
  secureUrl: string;
} | null {
  try {
    if (!isCloudinaryUrl(url)) return null;
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    // /{cloud}/image|raw|video/upload/[v123/]{public_id}.{ext?}
    const uploadIndex = pathParts.indexOf('upload');
    if (uploadIndex < 1 || uploadIndex + 1 >= pathParts.length) return null;

    const resourceTypeRaw = pathParts[uploadIndex - 1] || 'image';
    const resourceType: ResourceType =
      resourceTypeRaw === 'raw' ? 'raw' : 'image';

    let after = pathParts.slice(uploadIndex + 1);
    if (after[0] && /^v\d+$/i.test(after[0])) {
      after = after.slice(1);
    }
    if (after.length === 0) return null;

    const last = after[after.length - 1]!;
    const formatMatch = last.match(/\.([a-z0-9]+)$/i);
    const format = formatMatch?.[1]?.toLowerCase();
    const withoutExt = after
      .map((part, i) =>
        i === after.length - 1 ? part.replace(/\.[^/.]+$/, '') : part
      )
      .join('/');

    return {
      publicId: withoutExt,
      resourceType,
      format,
      secureUrl: url,
    };
  } catch {
    return null;
  }
}

function guessResourceType(keyOrPublicId: string, mime?: string | null): ResourceType {
  if (mime?.startsWith('image/')) return 'image';
  if (mime === 'application/pdf') return 'raw';
  if (/\.(pdf|doc|docx|zip)$/i.test(keyOrPublicId)) return 'raw';
  return 'image';
}

/** PDFs/non-images are uploaded as Cloudinary `raw` in this app. */
function prefersRawResource(
  asset: CollectedAsset,
  format?: string | null
): boolean {
  if (asset.resourceTypeHint === 'raw') return true;
  if (format && /^(pdf|doc|docx|zip)$/i.test(format)) return true;
  if (asset.preferredKey && /\.(pdf|doc|docx|zip)$/i.test(asset.preferredKey)) {
    return true;
  }
  if (asset.sourceUrl && /\.pdf(\?|#|$)/i.test(asset.sourceUrl)) return true;
  return false;
}

function mimeFromFormat(format: string): string {
  const f = format.toLowerCase();
  if (f === 'jpg' || f === 'jpeg') return 'image/jpeg';
  if (f === 'png') return 'image/png';
  if (f === 'webp') return 'image/webp';
  if (f === 'gif') return 'image/gif';
  if (f === 'pdf') return 'application/pdf';
  if (f === 'svg') return 'image/svg+xml';
  return 'application/octet-stream';
}

function extFromMime(mime: string): string {
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'image/svg+xml') return 'svg';
  return 'bin';
}

function resolveS3Key(
  publicId: string,
  preferredKey: string | undefined,
  format: string | undefined,
  mimeType: string
): string {
  if (preferredKey && hasFileExtension(preferredKey)) {
    return preferredKey.replace(/^\/+/, '');
  }
  if (preferredKey && !hasFileExtension(preferredKey) && format) {
    return `${preferredKey.replace(/^\/+/, '')}.${format}`;
  }
  const ext = format || extFromMime(mimeType);
  if (hasFileExtension(publicId)) return publicId.replace(/^\/+/, '');
  return `${publicId.replace(/^\/+/, '')}.${ext}`;
}

// ---------------------------------------------------------------------------
// Collect assets from arbitrary JSON / strings
// ---------------------------------------------------------------------------

const assetMap = new Map<string, CollectedAsset>();

function addAsset(partial: {
  publicId: string;
  preferredKey?: string;
  sourceUrl?: string;
  resourceTypeHint?: ResourceType;
  origin: AssetOrigin;
}) {
  const publicId = stripExtension(partial.publicId.replace(/^\/+/, ''));
  if (!publicId || publicId.startsWith('http')) return;

  const existing = assetMap.get(publicId);
  if (existing) {
    existing.origins.push(partial.origin);
    if (!existing.preferredKey && partial.preferredKey) {
      existing.preferredKey = partial.preferredKey;
    }
    if (!existing.sourceUrl && partial.sourceUrl) {
      existing.sourceUrl = partial.sourceUrl;
    }
    if (!existing.resourceTypeHint && partial.resourceTypeHint) {
      existing.resourceTypeHint = partial.resourceTypeHint;
    }
    return;
  }

  assetMap.set(publicId, {
    publicId,
    preferredKey: partial.preferredKey,
    sourceUrl: partial.sourceUrl,
    resourceTypeHint: partial.resourceTypeHint,
    origins: [partial.origin],
  });
}

function considerString(
  value: string,
  origin: AssetOrigin,
  opts?: { treatAsKey?: boolean; mime?: string | null }
) {
  const trimmed = value.trim();
  if (!trimmed) return;

  if (isS3Url(trimmed) || trimmed.startsWith('/uploads/')) return;

  if (isCloudinaryUrl(trimmed)) {
    const parsed = parseCloudinaryPublicId(trimmed);
    if (!parsed) return;
    addAsset({
      publicId: parsed.publicId,
      preferredKey: hasFileExtension(parsed.publicId)
        ? parsed.publicId
        : parsed.format
          ? `${parsed.publicId}.${parsed.format}`
          : undefined,
      sourceUrl: parsed.secureUrl,
      resourceTypeHint: parsed.resourceType,
      origin,
    });
    return;
  }

  // Bare storage keys (applications/..., country-flags/..., document-samples/...)
  if (
    opts?.treatAsKey &&
    !trimmed.startsWith('http') &&
    !trimmed.startsWith('blob:') &&
    !trimmed.startsWith('data:')
  ) {
    const looksLikeObjectKey =
      trimmed.startsWith('applications/') ||
      trimmed.startsWith('country-') ||
      trimmed.startsWith('visa-') ||
      trimmed.startsWith('blog-') ||
      trimmed.startsWith('document-samples/') ||
      trimmed.startsWith('documents/') ||
      trimmed.startsWith('passports/') ||
      trimmed.startsWith('photos/');

    if (!looksLikeObjectKey) return;

    addAsset({
      publicId: stripExtension(trimmed),
      preferredKey: trimmed,
      resourceTypeHint: guessResourceType(trimmed, opts.mime),
      origin,
    });
  }
}

function walkJson(
  value: unknown,
  originBase: Omit<AssetOrigin, 'field'> & { fieldPrefix?: string },
  keyHints: Set<string> = new Set([
    'key',
    's3Key',
    'storageKey',
    'sampleDocumentKey',
    'coverImageKey',
    'url',
    'storageUrl',
    'sampleDocumentUrl',
    'coverImageUrl',
    'ogImageUrl',
  ])
) {
  if (value == null) return;

  if (typeof value === 'string') {
    considerString(value, {
      table: originBase.table,
      id: originBase.id,
      field: originBase.fieldPrefix || 'value',
    });
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => {
      walkJson(item, {
        ...originBase,
        fieldPrefix: `${originBase.fieldPrefix || ''}[${index}]`,
      }, keyHints);
    });
    return;
  }

  if (typeof value === 'object') {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const field = originBase.fieldPrefix
        ? `${originBase.fieldPrefix}.${k}`
        : k;
      if (typeof v === 'string') {
        const treatAsKey =
          keyHints.has(k) &&
          !v.includes('://') &&
          (k.toLowerCase().includes('key') ||
            k === 'key' ||
            k === 'storageKey');
        const treatAsUrl =
          keyHints.has(k) ||
          k.toLowerCase().includes('url') ||
          isCloudinaryUrl(v);

        if (treatAsKey) {
          considerString(v, { table: originBase.table, id: originBase.id, field }, {
            treatAsKey: true,
          });
        } else if (treatAsUrl || isCloudinaryUrl(v)) {
          considerString(v, { table: originBase.table, id: originBase.id, field });
        }
      } else {
        walkJson(v, { ...originBase, fieldPrefix: field }, keyHints);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Scan tables
// ---------------------------------------------------------------------------

async function collectFromDatabase() {
  console.log('Scanning database for Cloudinary references…');

  const docRows = await db
    .select({
      id: documents.id,
      s3Key: documents.s3Key,
      mimeType: documents.mimeType,
    })
    .from(documents);
  for (const row of docRows) {
    considerString(
      row.s3Key,
      { table: 'documents', id: row.id, field: 's3_key' },
      { treatAsKey: true, mime: row.mimeType }
    );
  }
  console.log(`  documents: ${docRows.length} rows`);

  const visaRows = await db
    .select({
      id: visaApplications.id,
      documents: visaApplications.documents,
      travellers: visaApplications.travellers,
      personalInfo: visaApplications.personalInfo,
    })
    .from(visaApplications);
  for (const row of visaRows) {
    walkJson(row.documents, {
      table: 'visa_applications',
      id: row.id,
      fieldPrefix: 'documents',
    });
    walkJson(row.travellers, {
      table: 'visa_applications',
      id: row.id,
      fieldPrefix: 'travellers',
    });
    walkJson(row.personalInfo, {
      table: 'visa_applications',
      id: row.id,
      fieldPrefix: 'personal_info',
    });
  }
  console.log(`  visa_applications: ${visaRows.length} rows`);

  const draftRows = await db
    .select({
      id: applicationDrafts.id,
      payload: applicationDrafts.payload,
    })
    .from(applicationDrafts);
  for (const row of draftRows) {
    walkJson(row.payload, {
      table: 'application_drafts',
      id: row.id,
      fieldPrefix: 'payload',
    });
  }
  console.log(`  application_drafts: ${draftRows.length} rows`);

  const passportRows = await db
    .select({
      id: passportServices.id,
      documents: passportServices.documents,
    })
    .from(passportServices);
  for (const row of passportRows) {
    walkJson(row.documents, {
      table: 'passport_services',
      id: row.id,
      fieldPrefix: 'documents',
    });
  }
  console.log(`  passport_services: ${passportRows.length} rows`);

  const countryRows = await db
    .select({
      id: countries.id,
      iso2Code: countries.iso2Code,
      images: countries.images,
    })
    .from(countries);
  for (const row of countryRows) {
    walkJson(row.images, {
      table: 'countries',
      id: row.iso2Code || row.id,
      fieldPrefix: 'images',
    });
  }
  console.log(`  countries: ${countryRows.length} rows`);

  const typeRows = await db
    .select({
      id: documentTypes.id,
      sampleDocumentKey: documentTypes.sampleDocumentKey,
      sampleDocumentUrl: documentTypes.sampleDocumentUrl,
      sampleDocumentMimeType: documentTypes.sampleDocumentMimeType,
    })
    .from(documentTypes);
  for (const row of typeRows) {
    if (row.sampleDocumentKey) {
      considerString(
        row.sampleDocumentKey,
        { table: 'document_types', id: row.id, field: 'sample_document_key' },
        { treatAsKey: true, mime: row.sampleDocumentMimeType }
      );
    }
    if (row.sampleDocumentUrl) {
      considerString(row.sampleDocumentUrl, {
        table: 'document_types',
        id: row.id,
        field: 'sample_document_url',
      });
    }
  }
  console.log(`  document_types: ${typeRows.length} rows`);

  const blogRows = await db
    .select({
      id: blogPosts.id,
      coverImageUrl: blogPosts.coverImageUrl,
      coverImageKey: blogPosts.coverImageKey,
      seo: blogPosts.seo,
      body: blogPosts.body,
    })
    .from(blogPosts);
  for (const row of blogRows) {
    if (row.coverImageKey) {
      considerString(
        row.coverImageKey,
        { table: 'blog_posts', id: row.id, field: 'cover_image_key' },
        { treatAsKey: true }
      );
    }
    if (row.coverImageUrl) {
      considerString(row.coverImageUrl, {
        table: 'blog_posts',
        id: row.id,
        field: 'cover_image_url',
      });
    }
    walkJson(row.seo, {
      table: 'blog_posts',
      id: row.id,
      fieldPrefix: 'seo',
    });
    if (row.body) {
      const urls = row.body.match(/https?:\/\/res\.cloudinary\.com[^"'\\\s>]*/g);
      if (urls) {
        for (const url of urls) {
          considerString(url, {
            table: 'blog_posts',
            id: row.id,
            field: 'body',
          });
        }
      }
    }
  }
  console.log(`  blog_posts: ${blogRows.length} rows`);

  console.log(`Collected ${assetMap.size} unique Cloudinary public_id(s)`);
}

// ---------------------------------------------------------------------------
// Transfer
// ---------------------------------------------------------------------------

async function s3Exists(
  client: S3Client,
  bucket: string,
  key: string
): Promise<boolean> {
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

async function fetchCloudinaryResource(
  publicId: string,
  hint?: ResourceType
): Promise<{
  secureUrl: string;
  format?: string;
  resourceType: ResourceType;
  bytes?: number;
} | null> {
  const order: ResourceType[] =
    hint === 'raw' ? ['raw', 'image'] : ['image', 'raw'];

  for (const resourceType of order) {
    try {
      const result = await cloudinary.api.resource(publicId, {
        resource_type: resourceType,
      });
      return {
        secureUrl: result.secure_url as string,
        format: (result.format as string | undefined)?.toLowerCase(),
        resourceType,
        bytes: result.bytes as number | undefined,
      };
    } catch {
      // try next type
    }
  }
  return null;
}

async function downloadBuffer(url: string): Promise<{
  buffer: Buffer;
  mimeType: string;
}> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed ${response.status}: ${url}`);
  }
  const mimeType =
    response.headers.get('content-type')?.split(';')[0]?.trim() ||
    'application/octet-stream';
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, mimeType };
}

function pushUnique(list: string[], url: string | null | undefined) {
  if (!url) return;
  if (!list.includes(url)) list.push(url);
}

/**
 * Download bytes from Cloudinary, trying public raw/image URLs then signed
 * private download URLs (PDFs often 401 on public image/upload links).
 */
async function downloadCloudinaryBuffer(
  publicId: string,
  resource: {
    secureUrl: string;
    format?: string;
    resourceType: ResourceType;
  },
  preferredSourceUrl?: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  const format = resource.format || 'bin';
  const urls: string[] = [];

  // Correct delivery URL for the known resource type
  try {
    pushUnique(
      urls,
      cloudinary.url(publicId, {
        resource_type: resource.resourceType,
        type: 'upload',
        secure: true,
        ...(resource.resourceType === 'raw' ? { format } : {}),
      })
    );
  } catch {
    // ignore
  }

  pushUnique(urls, resource.secureUrl);
  pushUnique(urls, preferredSourceUrl);

  // Explicit raw URL (app stores PDFs as raw)
  try {
    pushUnique(
      urls,
      cloudinary.url(publicId, {
        resource_type: 'raw',
        type: 'upload',
        secure: true,
        format: format === 'bin' ? 'pdf' : format,
      })
    );
  } catch {
    // ignore
  }

  // Signed downloads for authenticated / restricted assets
  for (const resourceType of [resource.resourceType, 'raw', 'image'] as const) {
    try {
      pushUnique(
        urls,
        cloudinary.utils.private_download_url(publicId, format, {
          resource_type: resourceType,
          type: 'upload',
        })
      );
    } catch {
      // ignore
    }
    if (format !== 'pdf') {
      try {
        pushUnique(
          urls,
          cloudinary.utils.private_download_url(publicId, 'pdf', {
            resource_type: resourceType,
            type: 'upload',
          })
        );
      } catch {
        // ignore
      }
    }
  }

  let lastError: Error | null = null;
  for (const url of urls) {
    try {
      return await downloadBuffer(url);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }
  }

  throw lastError || new Error(`Download failed for ${publicId}`);
}

async function transferAssets(
  s3: { client: S3Client; bucket: string; region: string }
): Promise<{ results: TransferResult[]; map: RewriteMap }> {
  const results: TransferResult[] = [];
  const map: RewriteMap = {
    replacements: new Map(),
    publicIdToKey: new Map(),
    publicIdToUrl: new Map(),
  };

  let assets = Array.from(assetMap.values());
  if (LIMIT > 0) {
    assets = assets.slice(0, LIMIT);
    console.log(`--limit=${LIMIT}: processing ${assets.length} asset(s)`);
  }

  for (const asset of assets) {
    const label = asset.publicId;
    try {
      const lookupHint: ResourceType | undefined = prefersRawResource(asset)
        ? 'raw'
        : asset.resourceTypeHint;

      let resource = await fetchCloudinaryResource(asset.publicId, lookupHint);
      if (!resource) {
        results.push({
          publicId: asset.publicId,
          newKey: '',
          newUrl: '',
          bytes: 0,
          mimeType: '',
          skipped: true,
          reason: 'not_found_on_cloudinary',
        });
        console.warn(`  skip (not on Cloudinary): ${label}`);
        continue;
      }

      // PDFs sometimes appear under image in Admin API but only download as raw.
      if (
        (resource.format === 'pdf' || prefersRawResource(asset, resource.format)) &&
        resource.resourceType === 'image'
      ) {
        const raw = await fetchCloudinaryResource(asset.publicId, 'raw');
        if (raw) resource = raw;
      }

      const { buffer, mimeType: fetchedMime } = await downloadCloudinaryBuffer(
        asset.publicId,
        resource,
        asset.sourceUrl
      );
      const format = resource.format || extFromMime(fetchedMime);
      const mimeType =
        fetchedMime !== 'application/octet-stream'
          ? fetchedMime
          : mimeFromFormat(format);

      const newKey = resolveS3Key(
        asset.publicId,
        asset.preferredKey,
        format,
        mimeType
      );
      const newUrl = s3PublicUrl(s3.bucket, s3.region, newKey);

      const already = await s3Exists(s3.client, s3.bucket, newKey);
      if (!already) {
        if (EXECUTE) {
          await s3.client.send(
            new PutObjectCommand({
              Bucket: s3.bucket,
              Key: newKey,
              Body: buffer,
              ContentType: mimeType,
              Metadata: {
                migratedFrom: 'cloudinary',
                cloudinaryPublicId: asset.publicId,
                migratedAt: new Date().toISOString(),
              },
            })
          );
        }
      }

      // Build rewrite entries
      map.publicIdToKey.set(asset.publicId, newKey);
      map.publicIdToUrl.set(asset.publicId, newUrl);
      map.replacements.set(asset.publicId, newKey);
      if (asset.preferredKey && asset.preferredKey !== newKey) {
        map.replacements.set(asset.preferredKey, newKey);
      }
      if (asset.sourceUrl) {
        map.replacements.set(asset.sourceUrl, newUrl);
      }
      map.replacements.set(resource.secureUrl, newUrl);
      // Also map public_id + format variants commonly stored
      if (format) {
        map.replacements.set(`${asset.publicId}.${format}`, newKey);
      }

      results.push({
        publicId: asset.publicId,
        oldKey: asset.preferredKey,
        newKey,
        newUrl,
        bytes: buffer.length,
        mimeType,
        skipped: already,
        reason: already ? 'already_on_s3' : EXECUTE ? 'uploaded' : 'dry_run',
      });

      console.log(
        `  ${already ? 'exists' : EXECUTE ? 'upload' : 'would-upload'} ${label} → ${newKey} (${buffer.length} bytes)`
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        publicId: asset.publicId,
        newKey: '',
        newUrl: '',
        bytes: 0,
        mimeType: '',
        error: message,
      });
      console.error(`  ERROR ${label}: ${message}`);
    }
  }

  return { results, map };
}

// ---------------------------------------------------------------------------
// DB rewrite
// ---------------------------------------------------------------------------

function rewriteString(value: string, map: RewriteMap): string {
  if (!value) return value;
  if (map.replacements.has(value)) {
    return map.replacements.get(value)!;
  }

  // Exact public_id key without extension → S3 key with extension
  const stripped = stripExtension(value);
  if (
    !value.includes('://') &&
    map.publicIdToKey.has(stripped) &&
    (value === stripped || hasFileExtension(value))
  ) {
    // If value is public_id or public_id.ext matching preferred, use new key
    if (value === stripped || stripExtension(value) === stripped) {
      return map.publicIdToKey.get(stripped)!;
    }
  }

  if (isCloudinaryUrl(value)) {
    const parsed = parseCloudinaryPublicId(value);
    if (parsed && map.publicIdToUrl.has(parsed.publicId)) {
      return map.publicIdToUrl.get(parsed.publicId)!;
    }
  }

  // Substring replace for longer HTML / concatenated strings
  let next = value;
  for (const [from, to] of map.replacements) {
    if (from.length >= 12 && next.includes(from)) {
      next = next.split(from).join(to);
    }
  }
  return next;
}

function rewriteJson(value: unknown, map: RewriteMap): unknown {
  if (typeof value === 'string') return rewriteString(value, map);
  if (Array.isArray(value)) return value.map((item) => rewriteJson(item, map));
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = rewriteJson(v, map);
    }
    return out;
  }
  return value;
}

function jsonChanged(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

async function updateDatabase(map: RewriteMap): Promise<{
  updated: Array<{ table: string; id: string; fields: string[] }>;
}> {
  const updated: Array<{ table: string; id: string; fields: string[] }> = [];

  if (map.replacements.size === 0 && map.publicIdToKey.size === 0) {
    console.log('No rewrite map entries — skipping DB updates');
    return { updated };
  }

  console.log(
    EXECUTE
      ? 'Updating database rows…'
      : 'Dry-run: computing DB updates (not writing)…'
  );

  // documents.s3_key
  const docRows = await db
    .select({ id: documents.id, s3Key: documents.s3Key })
    .from(documents);
  for (const row of docRows) {
    const next = rewriteString(row.s3Key, map);
    if (next !== row.s3Key) {
      if (EXECUTE) {
        await db
          .update(documents)
          .set({ s3Key: next })
          .where(eq(documents.id, row.id));
      }
      updated.push({ table: 'documents', id: row.id, fields: ['s3_key'] });
    }
  }

  // visa_applications JSON
  const visaRows = await db
    .select({
      id: visaApplications.id,
      documentsJson: visaApplications.documents,
      travellers: visaApplications.travellers,
      personalInfo: visaApplications.personalInfo,
    })
    .from(visaApplications);
  for (const row of visaRows) {
    const fields: string[] = [];
    const patch: Record<string, unknown> = {};
    const nextDocs = rewriteJson(row.documentsJson, map);
    const nextTravellers = rewriteJson(row.travellers, map);
    const nextPersonal = rewriteJson(row.personalInfo, map);
    if (jsonChanged(row.documentsJson, nextDocs)) {
      patch.documents = nextDocs;
      fields.push('documents');
    }
    if (jsonChanged(row.travellers, nextTravellers)) {
      patch.travellers = nextTravellers;
      fields.push('travellers');
    }
    if (jsonChanged(row.personalInfo, nextPersonal)) {
      patch.personalInfo = nextPersonal;
      fields.push('personal_info');
    }
    if (fields.length) {
      if (EXECUTE) {
        await db
          .update(visaApplications)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(visaApplications.id, row.id));
      }
      updated.push({ table: 'visa_applications', id: row.id, fields });
    }
  }

  // application_drafts.payload
  const draftRows = await db
    .select({
      id: applicationDrafts.id,
      payload: applicationDrafts.payload,
    })
    .from(applicationDrafts);
  for (const row of draftRows) {
    const next = rewriteJson(row.payload, map);
    if (jsonChanged(row.payload, next)) {
      if (EXECUTE) {
        await db
          .update(applicationDrafts)
          .set({ payload: next as typeof row.payload, updatedAt: new Date() })
          .where(eq(applicationDrafts.id, row.id));
      }
      updated.push({
        table: 'application_drafts',
        id: row.id,
        fields: ['payload'],
      });
    }
  }

  // passport_services.documents
  const passportRows = await db
    .select({
      id: passportServices.id,
      documentsJson: passportServices.documents,
    })
    .from(passportServices);
  for (const row of passportRows) {
    const next = rewriteJson(row.documentsJson, map);
    if (jsonChanged(row.documentsJson, next)) {
      if (EXECUTE) {
        await db
          .update(passportServices)
          .set({ documents: next as typeof row.documentsJson, updatedAt: new Date() })
          .where(eq(passportServices.id, row.id));
      }
      updated.push({
        table: 'passport_services',
        id: row.id,
        fields: ['documents'],
      });
    }
  }

  // countries.images
  const countryRows = await db
    .select({
      id: countries.id,
      iso2Code: countries.iso2Code,
      images: countries.images,
    })
    .from(countries);
  for (const row of countryRows) {
    const next = rewriteJson(row.images, map) as typeof row.images;
    if (jsonChanged(row.images, next)) {
      if (EXECUTE) {
        await db
          .update(countries)
          .set({ images: next, updatedAt: new Date() })
          .where(eq(countries.id, row.id));
      }
      updated.push({
        table: 'countries',
        id: row.iso2Code || row.id,
        fields: ['images'],
      });
    }
  }

  // document_types samples
  const typeRows = await db
    .select({
      id: documentTypes.id,
      sampleDocumentKey: documentTypes.sampleDocumentKey,
      sampleDocumentUrl: documentTypes.sampleDocumentUrl,
    })
    .from(documentTypes);
  for (const row of typeRows) {
    const fields: string[] = [];
    const patch: {
      sampleDocumentKey?: string | null;
      sampleDocumentUrl?: string | null;
    } = {};
    if (row.sampleDocumentKey) {
      const next = rewriteString(row.sampleDocumentKey, map);
      if (next !== row.sampleDocumentKey) {
        patch.sampleDocumentKey = next;
        fields.push('sample_document_key');
      }
    }
    if (row.sampleDocumentUrl) {
      const next = rewriteString(row.sampleDocumentUrl, map);
      if (next !== row.sampleDocumentUrl) {
        patch.sampleDocumentUrl = next;
        fields.push('sample_document_url');
      }
    }
    if (fields.length) {
      if (EXECUTE) {
        await db
          .update(documentTypes)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(documentTypes.id, row.id));
      }
      updated.push({ table: 'document_types', id: row.id, fields });
    }
  }

  // blog_posts
  const blogRows = await db
    .select({
      id: blogPosts.id,
      coverImageUrl: blogPosts.coverImageUrl,
      coverImageKey: blogPosts.coverImageKey,
      seo: blogPosts.seo,
      body: blogPosts.body,
    })
    .from(blogPosts);
  for (const row of blogRows) {
    const fields: string[] = [];
    const patch: Record<string, unknown> = {};
    if (row.coverImageKey) {
      const next = rewriteString(row.coverImageKey, map);
      if (next !== row.coverImageKey) {
        patch.coverImageKey = next;
        fields.push('cover_image_key');
      }
    }
    if (row.coverImageUrl) {
      const next = rewriteString(row.coverImageUrl, map);
      if (next !== row.coverImageUrl) {
        patch.coverImageUrl = next;
        fields.push('cover_image_url');
      }
    }
    const nextSeo = rewriteJson(row.seo, map);
    if (jsonChanged(row.seo, nextSeo)) {
      patch.seo = nextSeo;
      fields.push('seo');
    }
    if (row.body) {
      const nextBody = rewriteString(row.body, map);
      if (nextBody !== row.body) {
        patch.body = nextBody;
        fields.push('body');
      }
    }
    if (fields.length) {
      if (EXECUTE) {
        await db
          .update(blogPosts)
          .set({ ...patch, updatedAt: new Date() })
          .where(eq(blogPosts.id, row.id));
      }
      updated.push({ table: 'blog_posts', id: row.id, fields });
    }
  }

  console.log(
    `${EXECUTE ? 'Updated' : 'Would update'} ${updated.length} row(s)`
  );
  return { updated };
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

async function writeReport(payload: unknown) {
  const dir = path.join(process.cwd(), 'scripts', 'reports');
  await fs.mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const file = path.join(dir, `cloudinary-to-s3-${stamp}.json`);
  await fs.writeFile(file, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Report written: ${file}`);
  return file;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(
    `\nCloudinary → S3 migration (${EXECUTE ? 'EXECUTE' : 'DRY-RUN'})\n`
  );

  requireEnv('DATABASE_URL');
  initCloudinary();
  const s3 = initS3();

  await collectFromDatabase();

  const { results, map } = await transferAssets(s3);
  const { updated } = await updateDatabase(map);

  const failed = results.filter((r) => r.error);
  const skipped = results.filter((r) => r.skipped && !r.error);
  const transferred = results.filter(
    (r) => !r.error && !r.skipped && r.newKey
  );

  const report = {
    mode: EXECUTE ? 'execute' : 'dry-run',
    at: new Date().toISOString(),
    limit: LIMIT || null,
    bucket: s3.bucket,
    region: s3.region,
    collected: assetMap.size,
    processed: results.length,
    transferred: transferred.length,
    skipped: skipped.length,
    failed: failed.length,
    dbRowsTouched: updated.length,
    transfers: results,
    dbUpdates: updated,
  };

  await writeReport(report);

  console.log('\nSummary');
  console.log(`  collected:   ${assetMap.size}`);
  console.log(`  processed:   ${results.length}`);
  console.log(`  transferred: ${transferred.length}`);
  console.log(`  skipped:     ${skipped.length}`);
  console.log(`  failed:      ${failed.length}`);
  console.log(`  db rows:     ${updated.length}`);

  if (!EXECUTE) {
    console.log(
      '\nDry-run only. Re-run with --execute to upload and update the database.'
    );
    console.log(
      'After a successful execute, set UPLOAD_PROVIDER=s3 and restart the app.'
    );
  } else if (failed.length === 0) {
    console.log(
      '\nDone. Set UPLOAD_PROVIDER=s3 and restart the app. Cloudinary originals were kept.'
    );
  }

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    // Allow postgres pool to close
    setTimeout(() => process.exit(process.exitCode ?? 0), 250);
  });
