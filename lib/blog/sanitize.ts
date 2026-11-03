import DOMPurify from 'isomorphic-dompurify';

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  's',
  'a',
  'ul',
  'ol',
  'li',
  'h1',
  'h2',
  'h3',
  'h4',
  'blockquote',
  'pre',
  'code',
  'img',
  'figure',
  'figcaption',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
  'hr',
  'span',
  'div',
  'small',
];

const ALLOWED_ATTR = [
  'href',
  'target',
  'rel',
  'src',
  'alt',
  'title',
  'width',
  'height',
  'class',
  'loading',
];

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

/** Sanitize TinyMCE HTML before persist or public render. */
export function sanitizeBlogHtml(html: string): string {
  const decoded = decodeEscapedHtml(html);
  return DOMPurify.sanitize(decoded, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
