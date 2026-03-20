import { fitTextWidthForMaxHeight } from "./fit-text-width";

describe("fitTextWidthForMaxHeight", () => {
    it("does nothing when height already fits at start width", () => {
        let lastW = 0;
        fitTextWidthForMaxHeight(
            (w) => {
                lastW = w;
                return 50;
            },
            100,
            80
        );
        expect(lastW).toBe(100);
    });

    it("widens until mock height drops under maxLayerHeight, then picks minimal width", () => {
        // Simulate: taller box => fewer lines => lower total height (monotone non-increasing in width)
        const lineH = 16;
        const content = 800;
        const heightAt = (w: number) => Math.ceil(content / w) * lineH;

        let applied = 0;
        fitTextWidthForMaxHeight(
            (w) => {
                applied = w;
                return heightAt(w);
            },
            40,
            100,
            { maxWidth: 2000, heightTolerance: 0 }
        );

        expect(heightAt(applied)).toBeLessThanOrEqual(100);
        expect(applied).toBeGreaterThan(40);
        // minimal width that still fits (binary search)
        const oneNarrower = applied - 1;
        if (oneNarrower >= 40) {
            expect(heightAt(oneNarrower)).toBeGreaterThan(100);
        }
    });

    it("restores start width when even maxWidth cannot fit", () => {
        let lastW = 0;
        fitTextWidthForMaxHeight(
            (w) => {
                lastW = w;
                return 500;
            },
            50,
            80,
            { maxWidth: 200 }
        );
        expect(lastW).toBe(50);
    });
});
