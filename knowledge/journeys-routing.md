# Journeys — Overview/Detail Routing

## Routes
- **Overview**: `/admin/journeys`
- **Create**: `/admin/journeys/new`
- **Detail**: `/admin/journeys/[journeyId]`

## Central route constants
Use `apps/web/lib/routes.ts`:
- `ADMIN_ROUTES.journeys`
- `ADMIN_ROUTES.journeyNew`
- `ADMIN_ROUTES.journeyDetail(journeyId)`

## UI implementation
- Overview cards grid:
  - `apps/web/components/journeys/msqdx-glass-journeys-overview.tsx`
- Overview page server fetch + render:
  - `apps/web/app/admin/journeys/page.tsx`
- Detail page remains:
  - `apps/web/app/admin/journeys/[journeyId]/page.tsx`

