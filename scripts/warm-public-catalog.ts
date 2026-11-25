/**
 * Post-deploy / manual warmer for public visa listing pages + hero images.
 *
 * Usage:
 *   npm run warm:public
 *   npm run warm:public -- --country=AE
 *   npm run warm:public -- --origin=https://www.viserv.in
 */
import 'dotenv/config';
import { warmPublicVisaCatalog } from '../lib/warm-public-catalog';

function readArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((arg) => arg.startsWith(prefix));
  return hit ? hit.slice(prefix.length).trim() || undefined : undefined;
}

async function main() {
  const countryCode = readArg('country');
  const origin = readArg('origin');

  console.log('Warming public visa catalog…', {
    countryCode: countryCode || 'all',
    origin:
      origin ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXTAUTH_URL ||
      '(auto)',
  });

  const result = await warmPublicVisaCatalog({ countryCode, origin });
  if (!result) {
    console.error(
      'Warm failed: set NEXT_PUBLIC_APP_URL or NEXTAUTH_URL (or pass --origin=).'
    );
    process.exit(1);
  }

  console.log(
    `Done. pages ${result.pages.ok}/${result.pages.total}, media ${result.media.ok}/${result.media.total}, images ${result.images.ok}/${result.images.total}`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
