import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../_lib/auth";
import { isPlexonAuthConfigured, getPlexonProfile, getPlexonProfileByEmail, patchPlexonProfile } from "../../../../lib/plexon-auth";

function personaBackend503(message: string, target: string): NextResponse {
  const body: { error: string; detail: string; hint?: string; target?: string } = {
    error: "Persona backend unreachable",
    detail: message,
    hint: "Set NEXT_PERSONA_BACKEND_INTERNAL_URL (or NEXT_PUBLIC_PERSONA_BACKEND_URL) in the web app so it can reach the API. See knowledge/troubleshooting-503-auth-me.md",
  };
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PUBLIC_EXPOSE_BACKEND_TARGET === "true") {
    body.target = target;
  }
  return NextResponse.json(body, { status: 503 });
}

export async function GET(request: NextRequest) {
  const token = getAuthTokenFromRequest(request);
  if (!token) {
    return new NextResponse(JSON.stringify({ detail: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const target = `${getPersonaBackendBase({ preferPublic: false })}/auth/me`;
  let response: Response;
  try {
    response = await fetch(target, {
      headers: {
        ...buildAuthHeaders(token),
      },
      cache: "no-store",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch failed";
    return personaBackend503(message, target);
  }

  const dataText = await response.text();
  if (response.status !== 200) {
    return new NextResponse(dataText, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
    });
  }

  // PLEXON: Profil (Name, Unternehmen, Avatar, Sprache) aus PLEXON holen und mergen
  let data: { user?: { plexon_user_id?: string; email?: string; name?: string; company?: string; avatar_url?: string; locale?: string; [k: string]: unknown }; default_project_id?: string } = {};
  try {
    data = JSON.parse(dataText);
  } catch {
    return new NextResponse(dataText, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (!isPlexonAuthConfigured() || !data.user) {
    return NextResponse.json(data, { headers: { "Content-Type": "application/json" } });
  }
  let plexonProfile: { id: string; name?: string; company?: string; avatar_url?: string; locale?: string } | null = null;
  const plexonUserId = data.user.plexon_user_id;
  if (plexonUserId) {
    plexonProfile = await getPlexonProfile(plexonUserId);
  } else if (data.user.email) {
    plexonProfile = await getPlexonProfileByEmail(String(data.user.email));
  }
  if (plexonProfile) {
    data.user.name = plexonProfile.name ?? data.user.name;
    data.user.company = plexonProfile.company ?? data.user.company;
    data.user.avatar_url = plexonProfile.avatar_url ?? data.user.avatar_url;
    data.user.locale = plexonProfile.locale ?? data.user.locale;
    if (plexonProfile.id) data.user.plexon_user_id = plexonProfile.id;
  }
  return NextResponse.json(data, {
    headers: { "Content-Type": "application/json" },
  });
}

export async function PATCH(request: NextRequest) {
  const token = getAuthTokenFromRequest(request);
  if (!token) {
    return new NextResponse(JSON.stringify({ detail: "Not authenticated" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const payload = await request.text();
  const target = `${getPersonaBackendBase({ preferPublic: false })}/auth/me`;
  let response: Response;
  try {
    response = await fetch(target, {
      method: "PATCH",
      headers: {
        "Content-Type": request.headers.get("content-type") ?? "application/json",
        ...buildAuthHeaders(token),
      },
      body: payload,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "fetch failed";
    return personaBackend503(message, target);
  }

  const dataText = await response.text();
  if (response.ok && isPlexonAuthConfigured()) {
    let data: { user?: { plexon_user_id?: string; email?: string; [k: string]: unknown }; default_project_id?: string } = {};
    try {
      data = JSON.parse(dataText);
    } catch {
      return new NextResponse(dataText, {
        status: response.status,
        headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
      });
    }
    let plexonUserId = data?.user?.plexon_user_id;
    if (!plexonUserId && data?.user?.email) {
      const byEmail = await getPlexonProfileByEmail(String(data.user.email));
      plexonUserId = byEmail?.id ?? undefined;
    }
    if (plexonUserId) {
      let patchBody: Record<string, unknown> = {};
      try {
        patchBody = JSON.parse(payload);
      } catch {
        /* ignore */
      }
      await patchPlexonProfile(plexonUserId, {
        name: patchBody.name as string | null | undefined,
        email: patchBody.email as string | undefined,
        company: patchBody.company as string | null | undefined,
        avatar_url: patchBody.avatar_url as string | null | undefined,
        locale: patchBody.locale as string | null | undefined,
      });
    }
  }
  return new NextResponse(dataText, {
    status: response.status,
    headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
  });
}
