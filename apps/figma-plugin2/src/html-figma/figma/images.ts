import { getImagePaintsFromLayer, stripInvalidImageTransportKeys } from "./sanitize-paints";
import { base64ToUint8Array } from "./base64-to-bytes";
import { isSupportedFigmaImageBytes } from "./image-format";

function toImageBytes(intArr: unknown): Uint8Array | null {
    if (intArr instanceof Uint8Array) return intArr;
    if (Array.isArray(intArr) && intArr.every((n) => typeof n === "number")) {
        return new Uint8Array(intArr);
    }
    return null;
}

/**
 * Turns IMAGE fills with `base64` / `intArr` into Figma `imageHash`.
 * Must run before `assign(node, layer)` for any node type that receives `fills` / `backgrounds` (FRAME, …).
 */
export async function processImages(layer: unknown) {
    const images = getImagePaintsFromLayer(layer);
    await Promise.all(
        images.map(async (image: any) => {
            try {
                if (image?.base64) {
                    const bytes = base64ToUint8Array(image.base64);
                    if (!isSupportedFigmaImageBytes(bytes)) {
                        // Skip unsupported payloads (e.g. webp/avif/svg/html error bodies).
                        delete image.base64;
                        return;
                    }
                    image.imageHash = (await figma.createImage(bytes)).hash;
                    delete image.base64;
                } else if (image?.intArr) {
                    const bytes = toImageBytes(image.intArr);
                    if (bytes) {
                        if (!isSupportedFigmaImageBytes(bytes)) {
                            delete image.intArr;
                            return;
                        }
                        image.imageHash = (await figma.createImage(bytes)).hash;
                        delete image.intArr;
                    }
                }
            } catch (err) {
                console.warn("[html-figma] Failed to create image fill", err);
                // Figma rejects unknown keys like `base64` on assign(); drop plugin-only payloads.
                delete image.base64;
                delete image.intArr;
            }
        })
    );
    stripInvalidImageTransportKeys(layer);
}
