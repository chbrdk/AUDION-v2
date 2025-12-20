import type { UploadJobStatus } from "@msqdx-glass/types";

const API_PREFIX = "/api/documents";

export const uploadResearch = async (file: File, signal?: AbortSignal) => {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${API_PREFIX}/upload`, {
    method: "POST",
    body: formData,
    signal
  });

  if (!response.ok) {
    let errorMessage = "Upload failed";
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorMessage;
    } catch {
      // If response is not JSON, use status text
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return response.json() as Promise<{ job_id: string }>;
};

export const pollUploadStatus = async (jobId: string, signal?: AbortSignal) => {
  if (!jobId || jobId === "undefined" || jobId.trim() === "") {
    throw new Error("Invalid job ID");
  }

  const response = await fetch(
    `${API_PREFIX}/${jobId}/status`,
    {
      signal
    }
  );

  if (!response.ok) {
    let errorMessage = "Status polling failed";
    try {
      const errorData = await response.json();
      errorMessage = errorData.error || errorData.reason || errorMessage;
    } catch {
      // If response is not JSON, use status text
      errorMessage = response.statusText || errorMessage;
    }
    throw new Error(errorMessage);
  }

  return (await response.json()) as UploadJobStatus;
};

