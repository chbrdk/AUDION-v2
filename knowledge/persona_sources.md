# Persona-Datenquellen

Zentrale Übersicht aller externen UX-Persona-Datasets. Jede Quelle bekommt eine eindeutige ID (`persona_src_<slug>`) und wird ausschließlich hier dokumentiert – keine URLs oder Lizenzen direkt im Code hardcoden.

| Source ID | Plattform | URL | Lizenz | Schema-Felder (Auszug) | Aktualität | Trust-Score (0–1) | Notizen |
|-----------|-----------|-----|--------|------------------------|------------|-------------------|---------|
| persona_src_synthlabsai | Hugging Face | https://huggingface.co/datasets/SynthLabsAI/PERSONA | CC BY 4.0 | persona_id, preferences, demographic, traits | 2025‑11‑07 | 0.75 | 200k Präferenzpaare, 1k Personas; enthält synthetische Antworten |
| persona_src_tianyilab | Hugging Face | https://huggingface.co/datasets/Tianyi-Lab/Personas | MIT | persona_profile, goals, behaviors, pain_points | 2025‑10‑15 | 0.70 | Detaillierte Beschreibungen, teils manuell kuratiert |
| persona_src_neu_hai_uxagent | Hugging Face | https://huggingface.co/datasets/NEU-HAI/UXAgent | Apache 2.0 | feedback, context, sentiment, metadata | 2025‑09‑30 | 0.65 | Synthetische UX-Feedbacks aus Industrieforen |
| persona_src_hf_personas_repo | GitHub | https://github.com/huggingface/personas | Apache 2.0 | dialogs, persona_descriptions | 2025‑08‑12 | 0.60 | Sammel-Repo, mehrere Sub-Korpora |

## Dokumentationsrichtlinien

1. **Metadaten**: Jede neue Quelle muss mit URL, Lizenz, Feldliste, letztem Refresh-Datum und initialem Vertrauensscore eingetragen werden.  
2. **Versionierung**: Refreshes immer im Audit-Log (`knowledge/persona_source_audits/`) dokumentieren, inkl. Checksums und QA-Ergebnis.  
3. **Vertrauensscore**: Startwert basierend auf Herkunft, Kurationsgrad und Lizenz. Regelmäßige Anpassung nach QA.  
4. **Verwendung im Code**: Pipelines referenzieren ausschließlich die `Source ID` und lesen URL/Lizenzinformationen aus dieser Datei oder einer strukturierten Ableitung (z.B. JSON-Export).  
5. **Eigene Daten**: Interne Uploads erhalten IDs im Format `persona_src_internal_<dataset>` und Trust-Score ≥ 0.95, um sie in der Gewichtung zu priorisieren.

