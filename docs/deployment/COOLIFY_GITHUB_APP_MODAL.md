# Coolify GitHub App Modal - Schritt für Schritt

Wenn du das Modal "New GitHub App" siehst, folge diesen Schritten:

## Modal ausfüllen

### 1. Name
- **Vorgeschlagener Name**: `audion-github-app` oder `coolify-github-app`
- Du kannst den automatisch generierten Namen (`mushy-monkey-qggw00oo88gcgsgow`) behalten oder einen eigenen wählen
- **Wichtig**: Der Name muss eindeutig sein

### 2. Organization (on GitHub)
- **Leer lassen** (wenn du als persönlicher Account arbeitest)
- Oder: Deine GitHub Organization auswählen (falls du eine verwendest)
- **Für `chbrdk`**: Leer lassen, dann wird dein persönlicher Account verwendet

### 3. System Wide
- **Empfehlung**: ✅ **Ankreuzen** (checked)
  - Die GitHub App ist dann für alle in deiner Coolify-Instanz verfügbar
  - Du musst sie nicht für jede Application neu einrichten
- **Nicht ankreuzen**: Nur für dich verfügbar

## Nach dem Klick auf "Create" oder "Save"

Du siehst jetzt eine Seite mit **GitHub App Konfiguration**. Hier sind die nächsten Schritte:

### Option: Automated Installation (Empfohlen)

1. **Suche nach "Automated Installation"** auf der Seite
2. **Klicke auf "Register Now"** Button
   - Dies sollte dich zu GitHub weiterleiten
   - Oder öffnet ein neues Fenster/Tab mit GitHub
3. **Auf GitHub**:
   - Du wirst nach Berechtigungen gefragt
   - Klicke auf **"Authorize"** oder **"Install"**
   - Wähle `AUDION-v2` Repository aus (oder "All repositories")
4. **Nach der Autorisierung**:
   - Du wirst zurück zu Coolify geleitet
   - Die GitHub App sollte jetzt konfiguriert sein

### Alternative: Manual Installation (Nur wenn Automated nicht funktioniert)

1. **Klicke auf "Continue"** unter "Manual Installation"
2. **Folge den Anweisungen** für die manuelle Konfiguration
3. **Hinweis**: Dies ist komplizierter und nur für fortgeschrittene Benutzer

## Was ist der Webhook Endpoint?

Der **Webhook Endpoint** (`http://89.58.35.209:8000`) ist die URL, die GitHub verwendet, um Coolify über Repository-Events zu benachrichtigen (z.B. neue Commits, Pull Requests).

- **Du musst nichts manuell tun** - Coolify hat dies bereits konfiguriert
- Der "Register Now" Button sollte automatisch alles einrichten

## Troubleshooting

### "Register Now" leitet nicht zu GitHub weiter

**Lösung 1**: Prüfe Pop-up-Blocker
- Dein Browser blockiert möglicherweise das Pop-up
- Erlaube Pop-ups für deine Coolify-Domain
- Versuche es erneut

**Lösung 2**: Manuell zu GitHub gehen
1. Gehe zu: https://github.com/settings/apps
2. Klicke auf **"New GitHub App"** (rechts oben)
3. Fülle das Formular aus:
   - **GitHub App name**: `audion-coolify-app` (oder ähnlich)
   - **Homepage URL**: `http://89.58.35.209:8000` (deine Coolify URL)
   - **Webhook URL**: `http://89.58.35.209:8000` (der Webhook Endpoint von oben)
   - **Webhook secret**: (lassen wir erstmal leer oder generiere einen)
   - **Permissions**: 
     - Repository permissions → Contents: Read-only
     - Repository permissions → Metadata: Read-only
     - Repository permissions → Pull requests: Read & write (für Preview Deployments)
   - **Where can this GitHub App be installed?**: "Only on this account" oder "Any account"
4. Klicke **"Create GitHub App"**
5. **Installiere die App**:
   - Gehe zu: https://github.com/settings/installations
   - Klicke auf deine neu erstellte App
   - Klicke **"Configure"**
   - Wähle `AUDION-v2` Repository aus
   - Klicke **"Install"**
6. **Zurück zu Coolify**:
   - Kopiere die **App ID** und **Private Key** von GitHub
   - Füge sie in Coolify ein (falls dort Felder dafür vorhanden sind)

**Lösung 3**: Kontaktiere Coolify Support
- Falls nichts funktioniert, könnte es ein Problem mit der Coolify-Installation sein

### Nach "Register Now" sehe ich einen Fehler

**Häufige Fehler**:
- "Invalid redirect URI": Prüfe, ob die Coolify URL korrekt ist
- "App already exists": Eine App mit diesem Namen existiert bereits
- "Permission denied": Du hast keine Berechtigung, GitHub Apps zu erstellen

**Lösung**: Versuche die Manual Installation oder kontaktiere deinen GitHub-Administrator

### Preview Deployments Option

Die Option **"Preview Deployments"** ermöglicht es, automatisch Deployments für Pull Requests zu erstellen.

- ✅ **Empfohlen**: Aktivieren (wenn du Preview Deployments möchtest)
- ❌ **Optional**: Kann auch später aktiviert werden

## Nach erfolgreicher Installation

1. **Gehe zurück zu**: Applications → New Application
2. **Wähle**: Docker Compose
3. **Bei Repository**: 
   - Jetzt solltest du "Private Repository (with GitHub App)" sehen
   - Klicke auf "Select Repository"
   - `AUDION-v2` sollte jetzt in der Liste erscheinen

## Nächste Schritte

Nach erfolgreicher GitHub App Einrichtung:
1. Siehe [QUICKSTART.md](QUICKSTART.md) für die vollständige Deployment-Anleitung
2. Erstelle die Database Resources
3. Setze die Environment Variables
4. Deploy!
