/**
 * Widen a text box until total text height fits maxLayerHeight (Figma TEXT + textAutoResize HEIGHT).
 * Replaces the old "+1px width, max 5 tries" loop which constantly failed on real paragraphs.
 *
 * @param setWidthAndReadHeight - resize to `width` (second dim is best-effort for Figma) and return `text.height`
 */
export function fitTextWidthForMaxHeight(
    setWidthAndReadHeight: (width: number) => number,
    startWidth: number,
    maxLayerHeight: number,
    options?: {
        maxWidth?: number;
        /** px tolerance for sub-pixel line rounding */
        heightTolerance?: number;
        maxOuterIterations?: number;
    }
): void {
    const maxWidth = options?.maxWidth ?? 8192;
    const tol = options?.heightTolerance ?? 1;
    const maxOuter = options?.maxOuterIterations ?? 64;
    const start = Math.max(1, Math.floor(startWidth));

    const fits = (h: number) => h <= maxLayerHeight + tol;

    let h0 = setWidthAndReadHeight(start);
    if (fits(h0)) return;

    // Find an upper width bound where text fits (exponential grow)
    let hi = start;
    let h = h0;
    let outer = 0;
    while (!fits(h) && hi < maxWidth && outer < maxOuter) {
        outer++;
        const nextHi = Math.min(maxWidth, Math.max(hi * 2, hi + 8, start * 2 ** outer));
        if (nextHi <= hi) break;
        hi = nextHi;
        h = setWidthAndReadHeight(hi);
    }

    if (!fits(h)) {
        setWidthAndReadHeight(start);
        return;
    }

    // Minimum width in [start, hi] that still fits (binary search)
    let lo = start;
    while (hi - lo > 1 && outer < maxOuter) {
        outer++;
        const mid = Math.floor((lo + hi) / 2);
        const hm = setWidthAndReadHeight(mid);
        if (fits(hm)) hi = mid;
        else lo = mid;
    }
    setWidthAndReadHeight(hi);
}
