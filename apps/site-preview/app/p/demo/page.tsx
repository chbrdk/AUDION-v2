import { PageSpecRenderer } from "@/components/page-spec-renderer";
import { DEMO_PAGE_SPEC } from "@/lib/demo-spec";

export default function DemoPreviewPage() {
  return (
    <div data-capture-ready="true">
      <PageSpecRenderer spec={DEMO_PAGE_SPEC} />
    </div>
  );
}
