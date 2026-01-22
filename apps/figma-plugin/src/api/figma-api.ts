/**
 * Wrapper for Figma API operations
 */

export function getFigmaFileId(): string {
  return figma.fileKey || 'local';
}

export function getFigmaFileUrl(nodeId?: string): string {
  const fileKey = figma.fileKey;
  if (!fileKey) {
    return 'https://figma.com/file/local';
  }
  const nodeParam = nodeId ? `?node-id=${encodeURIComponent(nodeId)}` : '';
  return `https://figma.com/file/${fileKey}${nodeParam}`;
}

export async function getCurrentUser(): Promise<{ name: string; id: string } | null> {
  try {
    const user = await figma.currentUser;
    if (!user) return null;
    return {
      name: user.name,
      id: user.id || '',
    };
  } catch {
    return null;
  }
}

