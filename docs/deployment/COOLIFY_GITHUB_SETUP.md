# Coolify GitHub App Setup

Coolify benötigt eine GitHub App, um auf Repositories zuzugreifen. Hier ist die Anleitung zur Einrichtung.

## Schritt 1: GitHub App in Coolify einrichten

### Option A: GitHub App bereits vorhanden

Wenn du bereits eine GitHub App in Coolify eingerichtet hast, kannst du direkt zu Schritt 2 springen.

### Option B: Neue GitHub App erstellen

1. **In Coolify**: Gehe zu **Settings** → **Source Providers** (oder **Git Providers**)
2. Klicke auf **GitHub** oder **Add GitHub App**
3. **Modal "New GitHub App" ausfüllen**:
   - **Name**: `audion-github-app` (oder automatisch generierten Namen behalten)
   - **Organization**: Leer lassen (für persönlichen Account) oder deine Organization auswählen
   - **System Wide**: ✅ Ankreuzen (empfohlen, macht die App für alle verfügbar)
   - Klicke **Create** oder **Save**
4. **Folge den Anweisungen**:
   - Du wirst zu GitHub weitergeleitet
   - Autorisiere die Coolify GitHub App
   - Wähle die Repositories aus, auf die Coolify zugreifen soll
   - **Wichtig**: Wähle `AUDION-v2` aus (oder "All repositories" für vollständigen Zugriff)

**Detaillierte Anleitung**: Siehe [COOLIFY_GITHUB_APP_MODAL.md](COOLIFY_GITHUB_APP_MODAL.md) für eine Schritt-für-Schritt-Anleitung zum Modal.

## Schritt 2: Repository in Coolify verbinden

1. **In Coolify**: Gehe zu **Applications** → **New Application**
2. Wähle **Docker Compose**
3. Bei **Repository**:
   - Wähle **Private Repository (with GitHub App)**
   - Klicke auf **Select Repository** oder **Connect Repository**
   - Suche nach `AUDION-v2` oder `chbrdk/AUDION-v2`
   - Wähle das Repository aus
4. **Branch**: `main`
5. **Build Pack**: Sollte automatisch als "Docker Compose" erkannt werden
6. Klicke **Create**

## Alternative: Repository öffentlich machen (falls gewünscht)

Falls du das Repository öffentlich machen möchtest (optional):

```bash
gh repo edit chbrdk/AUDION-v2 --visibility public
```

**Hinweis**: Das Repository ist bereits öffentlich, aber Coolify zeigt möglicherweise trotzdem nur die GitHub App Option an. Das ist normal - verwende einfach die GitHub App Option.

## Troubleshooting

### Repository erscheint nicht in der Liste

**Problem**: Das Repository wird nicht in der Auswahlliste angezeigt.

**Lösungen**:
1. **GitHub App Berechtigungen prüfen**:
   - In Coolify: Settings → Source Providers → GitHub
   - Prüfe, ob das Repository in der Liste der autorisierten Repositories ist
   - Falls nicht: GitHub App Einstellungen öffnen und Repository hinzufügen

2. **GitHub App neu autorisieren**:
   - In Coolify: Settings → Source Providers → GitHub
   - Klicke auf "Re-authorize" oder "Update Permissions"
   - Stelle sicher, dass `AUDION-v2` ausgewählt ist

3. **Repository-Name prüfen**:
   - Stelle sicher, dass das Repository `AUDION-v2` heißt (nicht `audion-v2` oder ähnlich)
   - Prüfe den exakten Namen: `chbrdk/AUDION-v2`

### "Access Denied" Fehler

**Problem**: Coolify kann nicht auf das Repository zugreifen.

**Lösungen**:
1. **GitHub App Berechtigungen erweitern**:
   - Gehe zu GitHub → Settings → Applications → Authorized OAuth Apps
   - Finde die Coolify App
   - Erweitere die Berechtigungen auf das Repository

2. **Repository-Zugriff prüfen**:
   - Stelle sicher, dass dein GitHub-Account (`chbrdk`) Zugriff auf das Repository hat
   - Prüfe, ob das Repository nicht gelöscht oder umbenannt wurde

### Build schlägt fehl nach Verbindung

**Problem**: Repository wird verbunden, aber der Build schlägt fehl.

**Lösungen**:
1. **Branch prüfen**: Stelle sicher, dass der Branch `main` existiert
2. **docker-compose.yml prüfen**: Stelle sicher, dass `docker-compose.yml` im Root-Verzeichnis existiert
3. **Logs prüfen**: Schaue in die Build-Logs für spezifische Fehlermeldungen

## Nächste Schritte

Nach erfolgreicher Verbindung:

1. Setze die [Environment Variables](../environment-variables.md)
2. Erstelle die [Database Resources](QUICKSTART.md#schritt-1-database-resources-erstellen)
3. Führe das [Deployment](QUICKSTART.md#schritt-5-deploy) durch

## Weitere Hilfe

- [Coolify GitHub App Dokumentation](https://coolify.io/docs/configuration/github-app)
- [Coolify Docker Compose Guide](https://coolify.io/docs/docker-compose)
