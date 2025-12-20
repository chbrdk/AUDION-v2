# React 19 Actions API - 05. Dezember 2025

## Status: ✅ Beispiel-Implementierung erstellt

## Übersicht

React 19 Actions API vereinfacht Form-Submissions und API Calls mit automatischem Pending-State-Management und besserem Error-Handling.

## Beispiel-Implementierung

### Server Action erstellt
**Datei:** `apps/web/app/api/personas/create/actions.ts`

**Features:**
- Server Action mit `"use server"` Directive
- Automatisches Pending-State-Management
- Error-Handling
- Revalidation nach erfolgreicher Aktion

### Verwendung in Components

**Alt (manuelles State-Management):**
```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const handleSubmit = async (e: FormEvent) => {
  e.preventDefault();
  setLoading(true);
  setError(null);
  try {
    await fetch('/api/personas', { method: 'POST', body: formData });
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};
```

**Neu (React 19 Actions API):**
```typescript
import { useActionState } from "react";
import { createPersonaAction } from "@/app/api/personas/create/actions";

const [state, formAction, isPending] = useActionState(createPersonaAction, null);

<form action={formAction}>
  <input name="segment" />
  <button disabled={isPending}>
    {isPending ? "Creating..." : "Create"}
  </button>
  {state?.errors && <div>{state.errors.segment}</div>}
</form>
```

## Vorteile

1. **Automatisches Pending-State:** `isPending` wird automatisch verwaltet
2. **Besseres Error-Handling:** Errors werden automatisch im State zurückgegeben
3. **Weniger Boilerplate:** Kein manuelles Loading/Error-State-Management
4. **Optimistic Updates:** Kann mit `useOptimistic` kombiniert werden

## Migration-Plan

### Kandidaten für Migration
1. **Persona Creation Form** (`msqdx-glass-persona-create-dialog.tsx`)
2. **Target Group Creation**
3. **Settings Forms**
4. **Document Upload Forms**

### Schritte
1. ✅ Server Action erstellt (Beispiel)
2. ⏭️ Component migrieren zu `useActionState`
3. ⏭️ Form-Submission anpassen
4. ⏭️ Error-Handling testen
5. ⏭️ Pending-State testen

## Integration mit useOptimistic

```typescript
import { useActionState, useOptimistic } from "react";

const [optimisticPersonas, addOptimisticPersona] = useOptimistic(
  personas,
  (state, newPersona) => [...state, newPersona]
);

const [state, formAction, isPending] = useActionState(
  async (prevState, formData) => {
    const result = await createPersonaAction(prevState, formData);
    if (result.success) {
      addOptimisticPersona(result.persona);
    }
    return result;
  },
  null
);
```

## Testing

- [ ] Form-Submission funktioniert
- [ ] Pending-State wird korrekt angezeigt
- [ ] Errors werden korrekt angezeigt
- [ ] Success-State funktioniert
- [ ] Revalidation funktioniert

## Referenzen

- [React 19 Actions API](https://react.dev/reference/react/useActionState)
- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations)

---

**Erstellt:** 05. Dezember 2025  
**Status:** Beispiel-Implementierung erstellt, Migration ausstehend
