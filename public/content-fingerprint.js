/* A stable, compact identity for the source text a generated version used. */
export function contentFingerprint(value) {
  const text = String(value ?? '').trim();
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const ch of text) {
    hash ^= BigInt(ch.codePointAt(0));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return `${text.length}:${hash.toString(16).padStart(16, '0')}`;
}

export function variantIsStale(variant, source) {
  if (!variant) return false;
  if (variant.fromFingerprint) return variant.fromFingerprint !== contentFingerprint(source);

  /* Older generated versions only recorded the trimmed source length. */
  return variant.fromChars !== undefined
    && variant.fromChars !== String(source ?? '').trim().length;
}
