# Persona Review Queue

Automatisch generierte Aufgabenliste für das UX-Research-Team. Die eigentlichen Queue-Daten liegen in `knowledge/persona_review_queue.jsonl` (eine Zeile pro Persona).

## Statusfluss

1. `queued` – Pipeline hat externe/blended Persona abgelegt.
2. `in_review` – UX-Team arbeitet daran (Status im Audit-File ergänzen).
3. `trusted` – Persona freigegeben; Trust-Score ggf. erhöhen.
4. `rejected` – Persona wird im nächsten Pipeline-Lauf ausgeschlossen.

> Änderungen am Queue-File nur über dedizierte Tools/Skripte vornehmen, nicht manuell im Editor.

