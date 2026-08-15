export const JSON_OBJECT = { type: 'object', additionalProperties: false };

export function textResult(value) {
  const structuredContent = typeof value === 'object' && value !== null ? value : { value };
  return {
    content: [{ type: 'text', text: JSON.stringify(structuredContent, null, 2) }],
    structuredContent,
  };
}

export function errorResult(error) {
  return {
    isError: true,
    content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
  };
}

export function clip(value, max = 250_000) {
  if (typeof value !== 'string') return value;
  return value.length <= max ? value : `${value.slice(0, max)}\n…[truncated ${value.length - max} chars]`;
}
