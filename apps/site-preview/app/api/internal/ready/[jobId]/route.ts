import { NextResponse } from "next/server";
import { jobStore } from "@/lib/job-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> }
): Promise<Response> {
  const { jobId } = await context.params;
  const ready = jobStore.has(jobId);
  return NextResponse.json({ ready });
}
