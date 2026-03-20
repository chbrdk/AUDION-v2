import { NextResponse } from "next/server";
import { parsePageSpec } from "@audion/page-spec";
import { jobStore } from "@/lib/job-store";
import { verifyHmacSha256Hex } from "@/lib/verify-signature";

const SIG_HEADER = "x-site-preview-signature";

export async function POST(request: Request): Promise<Response> {
  const secret = process.env.SITE_PREVIEW_HMAC_SECRET ?? "";
  if (!secret) {
    return NextResponse.json({ error: "SITE_PREVIEW_HMAC_SECRET not configured" }, { status: 503 });
  }

  const raw = await request.text();
  const sig = request.headers.get(SIG_HEADER);
  if (!verifyHmacSha256Hex(raw, sig, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!json || typeof json !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const body = json as { jobId?: string; pageSpec?: unknown };
  if (typeof body.jobId !== "string" || !body.jobId.trim()) {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  let spec;
  try {
    spec = parsePageSpec(body.pageSpec);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid pageSpec";
    return NextResponse.json({ error: "pageSpec validation failed", detail: msg }, { status: 400 });
  }

  jobStore.set(body.jobId.trim(), spec);
  return NextResponse.json({ ok: true });
}
