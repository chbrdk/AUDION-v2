/**
 * Service for capturing screenshots of Figma selections
 */

const MAX_SIZE = 2048;
const QUALITY = 0.9;

export interface ScreenshotOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

export async function captureSelection(
  node: SceneNode,
  options: ScreenshotOptions = {}
): Promise<Uint8Array> {
  const maxWidth = options.maxWidth || MAX_SIZE;
  const maxHeight = options.maxHeight || MAX_SIZE;
  const quality = options.quality || QUALITY;

  // Calculate scale to fit within max dimensions
  let width = 'width' in node ? node.width : 0;
  let height = 'height' in node ? node.height : 0;

  let scale = 1;
  if (width > maxWidth || height > maxHeight) {
    const scaleX = maxWidth / width;
    const scaleY = maxHeight / height;
    scale = Math.min(scaleX, scaleY, 1); // Don't upscale
  }

  // Export as PNG
  try {
    const imageBytes = await (node as ExportMixin).exportAsync({
      format: 'PNG',
      constraint: {
        type: 'SCALE',
        value: scale,
      },
    });

    return imageBytes;
  } catch (error) {
    throw new Error(`Failed to capture screenshot: ${error}`);
  }
}

export function convertToBase64(imageBytes: Uint8Array): string {
  // Manual base64 encoding that works in both main thread and UI
  // Avoiding btoa() as it's not available in Figma's main thread
  const base64 = manualBase64Encode(imageBytes);
  return `data:image/png;base64,${base64}`;
}

function manualBase64Encode(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i;
  const l = bytes.length;
  for (i = 2; i < l; i += 3) {
    result += chars[bytes[i - 2] >> 2];
    result += chars[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
    result += chars[((bytes[i - 1] & 0x0f) << 2) | (bytes[i] >> 6)];
    result += chars[bytes[i] & 0x3f];
  }
  if (i === l + 1) {
    // 1 octet remains
    result += chars[bytes[i - 2] >> 2];
    result += chars[(bytes[i - 2] & 0x03) << 4];
    result += '==';
  } else if (i === l) {
    // 2 octets remain
    result += chars[bytes[i - 2] >> 2];
    result += chars[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
    result += chars[(bytes[i - 1] & 0x0f) << 2];
    result += '=';
  }
  return result;
}

export async function optimizeImage(
  imageBytes: Uint8Array,
  maxSizeBytes: number = 5 * 1024 * 1024 // 5MB default
): Promise<Uint8Array> {
  // If image is already small enough, return as-is
  if (imageBytes.length <= maxSizeBytes) {
    return imageBytes;
  }

  // For now, we'll just return the original
  // In a production environment, you might want to use a library
  // to compress the image (e.g., using canvas API in browser context)
  // Since Figma plugins run in a sandbox, we're limited in image processing options
  
  // Return original - the API should handle large images
  return imageBytes;
}

export async function captureSelectionAsBase64(
  node: SceneNode,
  options: ScreenshotOptions = {}
): Promise<string> {
  const imageBytes = await captureSelection(node, options);
  const optimized = await optimizeImage(imageBytes);
  return convertToBase64(optimized);
}



