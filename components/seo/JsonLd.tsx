type JsonLdObject = Record<string, unknown>;
type JsonLdValue = JsonLdObject | Array<JsonLdObject | null | undefined>;

/**
 * Renders one or more JSON-LD documents for search engines.
 * Pass a single object, an array of objects, or pre-built graph payloads.
 */
export function JsonLd({ data }: { data: JsonLdValue | null | undefined }) {
  if (!data) return null;

  const payloads = Array.isArray(data) ? data : [data];
  const valid = payloads.filter((item): item is JsonLdObject => {
    if (item == null || typeof item !== 'object') return false;
    return Object.keys(item).length > 0;
  });
  if (valid.length === 0) return null;

  return (
    <>
      {valid.map((item, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
        />
      ))}
    </>
  );
}
