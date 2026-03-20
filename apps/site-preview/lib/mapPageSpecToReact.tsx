"use client";

import type { PageSpec } from "@audion/page-spec";
import { PageSpecRenderer } from "@/components/page-spec-renderer";

/**
 * Maps validated Page IR → React tree (shadcn-only implementation lives in {@link PageSpecRenderer}).
 */
export function mapPageSpecToReact(spec: PageSpec) {
  return <PageSpecRenderer spec={spec} />;
}
