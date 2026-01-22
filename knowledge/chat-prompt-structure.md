# Chat Prompt Struktur

## Übersicht

Der Chat-Prompt besteht aus mehreren Teilen, die an das Backend gesendet werden:

1. **System-Prompt** (erste System-Message)
2. **Journey-Kontext** (weitere System-Messages, optional)
3. **Konversations-Historie** (User- und Assistant-Messages)
4. **Aktuelle User-Message** (mit optionalen Bildern)

## System-Prompt Struktur

Der System-Prompt wird durch `buildAdaptiveSystemPrompt()` erstellt und kann zwei Formate haben:

### Format 1: Base System Prompt aus Datenbank

Wenn die Persona einen `systemPrompt` in der Datenbank hat, wird dieser verwendet:

```
You are [Persona Name]. You must fully embody and act as this persona. Think, speak, and respond exactly as this persona would - not as an AI assistant describing the persona, but AS the persona themselves. Immerse yourself completely in this role and maintain this identity throughout the entire conversation.

[Base System Prompt aus Datenbank]
```

**Wichtig:** Am Anfang wird immer eine explizite Anweisung hinzugefügt, sich in die Persona hineinzuversetzen.

Variablen werden automatisch ersetzt:
- `${persona_name}` → Name der Persona
- `${persona_headline}` → Headline
- `${persona_bio}` → Bio
- etc.

### Format 2: Dynamisch generierter Prompt

Wenn kein Base-Prompt vorhanden ist, wird ein Prompt dynamisch erstellt:

```
You are [Persona Name].

About you: [Bio]

Headline: [Headline]

Demographics: Age: [age], Location: [location], Gender: [gender]

Communication style:
- Vocabulary: [vocabulary]
- Sentence structure: [sentenceStructure]
- Skepticism level: [skepticismLevel]/10

Personality traits:
- [trait1]: [value]/10
- [trait2]: [value]/10
...

Pain points and frustrations:
- [painPoint1] ([evidenceCount] evidence)
- [painPoint2]
...

Goals and aspirations:
- [goal1] (Priority: [priority])
- [goal2]
...

Interests: [interests]

Values: [values]

Media affinity: [media_affinity]/10
Attention span: [attentionSpan]

Social media usage: [socialMediaUsage]

Preferred color palette: [colorPalette]

[Optional: Journey Phase Info]

[Optional: Conversation Insights]

Instructions:
- Always stay in character as this persona - never break character or refer to yourself as an AI
- Respond from the persona's perspective, using their voice, knowledge, and experiences
- Think and react as this persona would, not as an external observer
- [Weitere adaptive Anweisungen basierend auf Gesprächsphase]
```

**Wichtig:** Alle verfügbaren Persona-Informationen werden jetzt in den Prompt aufgenommen, einschließlich:
- Demografische Daten (Age, Location, Gender)
- Personality Traits
- Pain Points (mit Evidence Count)
- Goals (mit Priority)
- Media Affinity & Attention Span
- Social Media Usage
- Color Palette

## Message-Struktur mit Bildern

### Ohne Bilder

```json
{
  "persona_id": "persona-123",
  "messages": [
    {
      "role": "system",
      "content": "[System Prompt]"
    },
    {
      "role": "user",
      "content": "Hallo, wie geht es dir?"
    },
    {
      "role": "assistant",
      "content": "Hallo! Mir geht es gut, danke der Nachfrage."
    },
    {
      "role": "user",
      "content": "Was denkst du über dieses Produkt?"
    }
  ]
}
```

### Mit Bildern

Wenn Bilder angefügt werden, werden sie als `image_ids` in der User-Message mitgesendet:

```json
{
  "persona_id": "persona-123",
  "messages": [
    {
      "role": "system",
      "content": "[System Prompt]"
    },
    {
      "role": "user",
      "content": "Was denkst du über dieses Produkt?",
      "image_ids": ["img-abc123", "img-def456"]
    }
  ]
}
```

**Wichtig:**
- Die `image_ids` werden **nur** in User-Messages mitgesendet
- Der System-Prompt enthält **keine** Informationen über Bilder
- Die Bilder werden separat hochgeladen und erhalten eine ID
- Das Backend muss die `image_ids` auflösen und die Bilder verarbeiten

## Beispiel: Kompletter Request mit Bildern

```json
{
  "persona_id": "persona-123",
  "messages": [
    {
      "role": "system",
      "content": "You are Clara, a marketing professional...\n\nAbout you: You are a data-driven marketer...\n\nCommunication style:\n- Vocabulary: ROI, conversion, engagement\n- Sentence structure: concise\n- Skepticism level: 7/10\n\nInterests: Marketing analytics, Growth hacking\n\nValues: Data-driven decisions, Customer-centricity"
    },
    {
      "role": "system",
      "content": "Journey context added: \"Product Discovery\"\n\nPhase 1: Awareness\nDescription: User becomes aware of the product\nMoments:\n  1. touchpoint: Social media ad\n  2. touchpoint: Blog post"
    },
    {
      "role": "user",
      "content": "Was denkst du über dieses Design?"
    },
    {
      "role": "assistant",
      "content": "Das Design sieht modern aus, aber ich würde gerne mehr über die Zielgruppe wissen..."
    },
    {
      "role": "user",
      "content": "Hier ist ein Screenshot vom neuen Dashboard",
      "image_ids": ["img-abc123", "img-def456"]
    }
  ]
}
```

## Bild-Upload Prozess

1. **Frontend**: Bilder werden komprimiert und zu Base64 konvertiert
2. **Upload**: Bilder werden an `/chat/images/upload` gesendet
3. **Backend**: Gibt `image_id` zurück (z.B. `"img-abc123"`)
4. **Message**: `image_id` wird in der User-Message als `image_ids` Array mitgesendet
5. **Backend**: Muss die `image_ids` auflösen und Bilder für die LLM-Verarbeitung bereitstellen

## Code-Stellen

- **System-Prompt Erstellung**: `apps/web/lib/adaptive-prompt.ts` → `buildAdaptiveSystemPrompt()`
- **Message-Bau**: `apps/web/app/admin/chat/page.tsx` → `handleSend()` (Zeile ~571-707)
- **Bild-Upload**: `apps/web/app/admin/chat/page.tsx` → `handleAddAttachmentsToChat()` (Zeile ~1242-1295)

## Hinweise

- Der System-Prompt ändert sich **nicht**, wenn Bilder angefügt werden
- Bilder werden nur in den **User-Messages** referenziert
- Das Backend muss die `image_ids` interpretieren und die Bilder in das LLM-Format konvertieren (z.B. Base64 für Vision-Models)
