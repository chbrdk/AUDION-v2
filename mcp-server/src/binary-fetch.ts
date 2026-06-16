import { type AudionFetchError } from './audion-client.js';

const DEFAULT_MAX_BYTES = 512_000;

export type BinaryFetchResult = {
  content_type: string;
  size_bytes: number;
  base64: string;
  truncated: boolean;
};

export async function audionFetchBinary(
  baseUrl: string,
  token: string,
  path: string,
  maxBytes = DEFAULT_MAX_BYTES
): Promise<BinaryFetchResult | AudionFetchError> {
  if (!baseUrl || !token) {
    return { error: true, message: 'AUDION_API_URL or AUDION_API_TOKEN not configured' };
  }
  const url = `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Accept: '*/*' },
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return {
        error: true,
        message: `HTTP ${res.status}: ${text.slice(0, 200)}`,
        status: res.status,
      };
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const truncated = buf.length > maxBytes;
    const slice = truncated ? buf.subarray(0, maxBytes) : buf;
    return {
      content_type: res.headers.get('content-type') || 'application/octet-stream',
      size_bytes: buf.length,
      base64: slice.toString('base64'),
      truncated,
    };
  } catch (e) {
    return {
      error: true,
      message: e instanceof Error ? e.message : String(e),
    };
  }
}
