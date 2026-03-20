import { notFound } from "next/navigation";
import { PageSpecRenderer } from "@/components/page-spec-renderer";
import { jobStore } from "@/lib/job-store";

export default async function JobPreviewPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const spec = jobStore.get(jobId);
  if (!spec) {
    notFound();
  }
  return (
    <div data-capture-ready="true">
      <PageSpecRenderer spec={spec} />
    </div>
  );
}
