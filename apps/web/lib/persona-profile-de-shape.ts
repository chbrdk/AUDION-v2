/**
 * Align German profile mirror JSON to English `profile` shape for PATCH validation
 * (`json_shape_compatible` requires same keys and matching nested structure).
 */

function alignRecursive(enVal: unknown, deVal: unknown): unknown {
  if (enVal === null) {
    return deVal === undefined ? null : deVal;
  }
  if (Array.isArray(enVal)) {
    const enArr = enVal as unknown[];
    if (!Array.isArray(deVal) || deVal.length !== enArr.length) {
      return JSON.parse(JSON.stringify(enArr)) as unknown[];
    }
    const deArr = deVal as unknown[];
    return enArr.map((e, i) => alignRecursive(e, deArr[i]));
  }
  if (typeof enVal === "object") {
    const enDict = enVal as Record<string, unknown>;
    const deDict =
      deVal && typeof deVal === "object" && !Array.isArray(deVal) ? (deVal as Record<string, unknown>) : {};
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(enDict)) {
      out[k] = alignRecursive(enDict[k], deDict[k]);
    }
    return out;
  }
  return deVal !== undefined ? deVal : enVal;
}

/**
 * Returns a `profile_de`-shaped object: same top-level keys as `en`, recursively
 * filled from `de` where compatible; otherwise copied from `en` to satisfy the API.
 */
export function alignProfileDeToEnProfile(
  en: Record<string, unknown>,
  de: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(en)) {
    out[k] = alignRecursive(en[k], de[k]);
  }
  return out;
}
