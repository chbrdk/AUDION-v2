# Persona Admin API Fixes

## Overview

This document describes the fixes applied to the Persona Admin API routes to resolve build failures and improve code organization.

## Problem Statement

The Next.js production build was failing with module resolution errors:

```
Module not found: Can't resolve '../../../api/_lib/backend'
```

This affected three routes:
- `/api/persona-admin/[personaId]/avatar/route.ts`
- `/api/persona-admin/[personaId]/documents/route.ts`
- `/api/persona-admin/[personaId]/knowledge/route.ts`

Additionally, there was significant code duplication across these routes.

## Root Cause

1. **Incorrect import paths**: Routes were using relative paths that didn't resolve correctly during build
2. **Code duplication**: Each route duplicated the same forwarding logic and parameter resolution
3. **Missing helper utilities**: No centralized helper for Persona Admin API operations

## Solution

### 1. Created Persona Admin Helper (`apps/web/app/api/_lib/persona.ts`)

A new helper module centralizes Persona Admin API utilities:

```typescript
import type { NextRequest, NextResponse } from "next/server";
import { getPersonaBackendBase } from "./backend";

type PersonaContext = 
  | { params: { personaId?: string } }
  | { params: Promise<{ personaId?: string }> };

export async function resolvePersonaParams(
  context: PersonaContext
): Promise<{ personaId: string } | { error: NextResponse }> {
  const ctxParams = "then" in context.params 
    ? await context.params 
    : context.params;
  
  if (!ctxParams?.personaId) {
    return {
      error: NextResponse.json(
        { error: "Persona ID missing" },
        { status: 400 }
      ),
    };
  }
  
  return { personaId: ctxParams.personaId };
}

export async function forwardPersonaBackend(
  path: string,
  init?: RequestInit
): Promise<NextResponse> {
  const base = getPersonaBackendBase();
  const target = `${base}${path}`;
  
  const upstream = await fetch(target, {
    cache: "no-store",
    ...init,
  });
  
  const contentType = upstream.headers.get("content-type") ?? "application/json";
  const body = await upstream.text();
  
  return new NextResponse(body, {
    status: upstream.status,
    headers: {
      "Content-Type": contentType,
    },
  });
}
```

**Benefits:**
- Centralized parameter resolution
- Consistent error handling
- Reusable forwarding logic
- Type-safe context handling

### 2. Refactored All Routes

All Persona Admin routes now use the helper:

**Before (`avatar/route.ts`):**
```typescript
import { getPersonaBackendBase } from "../../../api/_lib/backend";

const forward = async (target: string, init?: RequestInit) => {
  // 20 lines of duplicated code
};

const resolvePersonaId = async (context: PersonaContext) => {
  // 5 lines of duplicated code
};

const buildTarget = (personaId: string) => {
  const base = getPersonaBackendBase();
  return `${base}/personas/${personaId}/avatar`;
};

export async function POST(request: NextRequest, context: PersonaContext) {
  const personaId = await resolvePersonaId(context);
  if (!personaId) {
    return NextResponse.json({ error: "Persona ID missing" }, { status: 400 });
  }
  const formData = await request.formData();
  return forward(buildTarget(personaId), {
    method: "POST",
    body: formData,
  });
}
```

**After:**
```typescript
import { forwardPersonaBackend, resolvePersonaParams } from "../../_lib/persona";

export async function POST(
  request: NextRequest,
  context: PersonaContext
) {
  const resolved = await resolvePersonaParams(context);
  if ("error" in resolved) {
    return resolved.error;
  }
  
  const formData = await request.formData();
  return forwardPersonaBackend(`/personas/${resolved.personaId}/avatar`, {
    method: "POST",
    body: formData,
  });
}
```

**Benefits:**
- Reduced from ~45 lines to ~15 lines per route
- Consistent error handling
- Easier to maintain
- Type-safe parameter resolution

### 3. Fixed Import Paths

All routes now use consistent import paths:
- `../../_lib/persona` (for routes in `[personaId]/*`)
- `../../../_lib/persona` (for routes in `[personaId]/documents/[documentId]/*`)

### 4. Additional Fixes

#### Console.log Removal

Removed all `console.log` statements from `msqdx-glass-persona-admin-panel.tsx` to satisfy ESLint `--max-warnings=0`:

- Replaced with proper error handling
- Kept `console.error` for actual errors (allowed by ESLint config)

#### Type Import Fixes

Changed to type-only imports where appropriate:

```typescript
// Before
import { ChangeEvent, FormEvent } from "react";

// After
import type { ChangeEvent, FormEvent } from "react";
```

## Affected Files

### New Files
- `apps/web/app/api/_lib/persona.ts`: Persona Admin helper utilities

### Modified Files
- `apps/web/app/api/persona-admin/[personaId]/avatar/route.ts`
- `apps/web/app/api/persona-admin/[personaId]/documents/route.ts`
- `apps/web/app/api/persona-admin/[personaId]/knowledge/route.ts`
- `apps/web/app/api/persona-admin/[personaId]/documents/[documentId]/route.ts`
- `apps/web/app/api/persona-admin/[personaId]/documents/[documentId]/retry/route.ts`
- `apps/web/components/msqdx-glass-persona-admin-panel.tsx`
- `apps/web/app/chat/[conversationId]/page.tsx` (handleSend onClick fix)

## Testing

All changes validated with:

```bash
npm run lint --workspace apps/web      # ✅ Passes
npm run typecheck --workspace apps/web # ✅ Passes
npm run build:web                      # ✅ Passes
```

## Benefits

1. **Build Success**: Next.js production build now completes successfully
2. **Code Quality**: Reduced duplication, improved maintainability
3. **Type Safety**: Better TypeScript support with proper types
4. **Consistency**: All routes follow the same pattern
5. **Error Handling**: Centralized, consistent error responses

## Future Improvements

1. **Server Actions**: Consider migrating to Next.js Server Actions for better type safety
2. **API Client**: Create a typed API client for Persona Admin operations
3. **Error Types**: Define specific error types for different failure modes
4. **Retry Logic**: Add retry logic for transient backend failures

## Related Documentation

- `knowledge/ui.md`: UI component documentation
- `apps/web/app/api/_lib/backend.ts`: Backend URL helper utilities

