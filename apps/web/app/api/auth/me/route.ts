import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { getPersonaBackendBase } from "../../_lib/backend";
import { buildAuthHeaders, getAuthTokenFromRequest } from "../../_lib/auth";
import { isPlexonAuthConfigured, getPlexonProfile, patchPlexonProfile } from "../../../../lib/plexon-auth";

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
    return NextResponse.json(
      { error: "Persona backend unreachable", detail: message, target },
      { status: 503 }
    );
  }

  const dataText = await response.text();
  if (response.status !== 200) {
    return new NextResponse(dataText, {
      status: response.status,
      headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
    });
  }

  // PLEXON: Profil (Name, Unternehmen, Avatar, Sprache) aus PLEXON holen und mergen
  let data: { user?: { plexon_user_id?: string; name?: string; company?: string; avatar_url?: string; locale?: string; [k: string]: unknown }; default_project_id?: string } = {};
  try {
    data = JSON.parse(dataText);
  } catch {
    return new NextResponse(dataText, {
      status: response.status,
      headers: { "Content-Type": "application/json" },
    });
  }
  const plexonUserId = data?.user?.plexon_user_id;
  if (plexonUserId && isPlexonAuthConfigured() && data.user) {
    const plexonProfile = await getPlexonProfile(plexonUserId);
    if (plexonProfile) {
      data.user.name = plexonProfile.name ?? data.user.name;
      data.user.company = plexonProfile.company ?? data.user.company;
      data.user.avatar_url = plexonProfile.avatar_url ?? data.user.avatar_url;
      data.user.locale = plexonProfile.locale ?? data.user.locale;
    }
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
    return NextResponse.json(
      { error: "Persona backend unreachable", detail: message, target },
      { status: 503 }
    );
  }

  const dataText = await response.text();
  if (response.ok) {
    let data: { user?: { plexon_user_id?: string; [k: string]: unknown }; default_project_id?: string } = {};
    try {
      data = JSON.parse(dataText);
    } catch {
      return new NextResponse(dataText, {
        status: response.status,
        headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" },
      });
    }
    const plexonUserId = data?.user?.plexon_user_id;
    if (plexonUserId && isPlexonAuthConfigured()) {
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
