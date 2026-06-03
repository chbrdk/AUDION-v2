import type { PersonaDocument } from "@msqdx-glass/types";

export type DocumentIngestionChip = {
  label: string;
  brandColor: "green" | "orange" | "pink";
};

export function documentIngestionChip(
  doc: Pick<PersonaDocument, "ingestionStatus" | "ingestionProgress">,
  labels: {
    indexed: string;
    processing: (progress: number) => string;
    error: string;
    pending: string;
  }
): DocumentIngestionChip {
  if (doc.ingestionStatus === "completed") {
    return { label: labels.indexed, brandColor: "green" };
  }
  if (doc.ingestionStatus === "processing") {
    const progress = doc.ingestionProgress ? Math.round(doc.ingestionProgress) : 0;
    return { label: labels.processing(progress), brandColor: "orange" };
  }
  if (doc.ingestionStatus === "failed") {
    return { label: labels.error, brandColor: "pink" };
  }
  return { label: labels.pending, brandColor: "orange" };
}

export function formatDocumentSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
