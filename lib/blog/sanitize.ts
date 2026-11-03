import sanitizeHtml from 'sanitize-html';

/**
 * TinyMCE treats pasted HTML source as text and stores &lt;p&gt;…&lt;/p&gt;.
 * Decode entity-escaped tags so the public page can render real HTML.
 */
export function decodeEscapedHtml(html: string): string {
  let current = html;
  let previous = '';
  let guard = 0;

  while (
    current !== previous &&
    /&(?:amp|lt|gt|quot|#0*39|#x27);/i.test(current) &&
    guard < 5
  ) {
    previous = current;
    current = current
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .replace(/&quot;/gi, '"')
      .replace(/&#0*39;/gi, "'")
      .replace(/&#x27;/gi, "'")
      .replace(/&nbsp;/gi, '\u00a0');
    guard += 1;
  }

  return current;
}

/**
 * Sanitize TinyMCE HTML before persist or public render.
 * Uses sanitize-html (no jsdom) so Vercel serverless does not OOM/crash.
 */
export function sanitizeBlogHtml(html: string): string {
  const decoded = decodeEscapedHtml(html);

  return sanitizeHtml(decoded, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      'img',
      'h1',
      'h2',
      'figure',
      'figcaption',
      'small',
    ],
    allowedAttributes: {
      ...sanitizeHtml.defaults.allowedAttributes,
      a: ['href', 'name', 'target', 'rel', 'class'],
      img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading', 'class'],
      '*': ['class'],
    },
    allowedSchemes: ['http', 'https', 'mailto'],
    allowProtocolRelative: false,
  });
}
