#!/bin/bash

# Cleanup-Skript für Cursor Remote-Verbindungsreste
# Dieses Skript entfernt alte SSH-Verbindungen und temporäre Cursor-Dateien

set -e

echo "🧹 Cursor Remote Cleanup Script"
echo "================================"
echo ""

# 1. Finde und beende alte SSH-Session-Prozesse von Cursor
echo "1️⃣ Prüfe auf aktive SSH-Session-Prozesse..."
SSH_PIDS=$(ps aux | grep -E "sshd-session.*m4-dev" | grep -v grep | awk '{print $2}' || true)

if [ -n "$SSH_PIDS" ]; then
    echo "   Gefundene SSH-Prozesse: $SSH_PIDS"
    read -p "   Möchtest du diese SSH-Prozesse beenden? (j/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[JjYy]$ ]]; then
        for pid in $SSH_PIDS; do
            echo "   Beende Prozess $pid..."
            kill -TERM "$pid" 2>/dev/null || true
        done
        sleep 2
        # Prüfe ob noch Prozesse laufen und beende sie hart falls nötig
        REMAINING=$(ps aux | grep -E "sshd-session.*m4-dev" | grep -v grep | awk '{print $2}' || true)
        if [ -n "$REMAINING" ]; then
            echo "   Einige Prozesse laufen noch, beende sie hart..."
            for pid in $REMAINING; do
                kill -9 "$pid" 2>/dev/null || true
            done
        fi
        echo "   ✅ SSH-Prozesse beendet"
    else
        echo "   ⏭️  SSH-Prozesse übersprungen"
    fi
else
    echo "   ✅ Keine aktiven SSH-Session-Prozesse gefunden"
fi

echo ""

# 2. Entferne temporäre Cursor Remote Token-Dateien
echo "2️⃣ Prüfe auf temporäre Cursor Token-Dateien..."
TOKEN_FILES=$(ls -1 /tmp/cursor-remote-code.token.* 2>/dev/null || true)

if [ -n "$TOKEN_FILES" ]; then
    TOKEN_COUNT=$(echo "$TOKEN_FILES" | wc -l | tr -d ' ')
    echo "   Gefundene Token-Dateien: $TOKEN_COUNT"
    echo "$TOKEN_FILES" | while read -r file; do
        echo "   - $file"
    done
    read -p "   Möchtest du diese Token-Dateien löschen? (j/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[JjYy]$ ]]; then
        echo "$TOKEN_FILES" | while read -r file; do
            rm -f "$file" && echo "   ✅ Gelöscht: $file"
        done
        echo "   ✅ Token-Dateien entfernt"
    else
        echo "   ⏭️  Token-Dateien übersprungen"
    fi
else
    echo "   ✅ Keine temporären Token-Dateien gefunden"
fi

echo ""

# 3. Prüfe auf Cursor Remote-Server-Prozesse
echo "3️⃣ Prüfe auf Cursor Remote-Server-Prozesse..."
CURSOR_SERVER_PIDS=$(ps aux | grep -E "cursor-server.*--start-server" | grep -v grep | awk '{print $2}' || true)

if [ -n "$CURSOR_SERVER_PIDS" ]; then
    echo "   Gefundene Cursor-Server-Prozesse: $CURSOR_SERVER_PIDS"
    echo "   ⚠️  Diese Prozesse sollten normalerweise laufen bleiben"
    echo "   ⚠️  Nur beenden wenn du sicher bist, dass sie nicht mehr benötigt werden"
    read -p "   Möchtest du diese Server-Prozesse beenden? (j/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[JjYy]$ ]]; then
        for pid in $CURSOR_SERVER_PIDS; do
            echo "   Beende Prozess $pid..."
            kill -TERM "$pid" 2>/dev/null || true
        done
        echo "   ✅ Cursor-Server-Prozesse beendet"
    else
        echo "   ⏭️  Cursor-Server-Prozesse übersprungen"
    fi
else
    echo "   ✅ Keine Cursor-Server-Prozesse gefunden"
fi

echo ""

# 4. Prüfe auf offene Netzwerkverbindungen
echo "4️⃣ Prüfe auf offene SSH-Netzwerkverbindungen..."
SSH_CONNECTIONS=$(lsof -i -P 2>/dev/null | grep -i "ssh\|cursor" | grep ESTABLISHED || true)

if [ -n "$SSH_CONNECTIONS" ]; then
    echo "   Gefundene SSH-Verbindungen:"
    echo "$SSH_CONNECTIONS" | head -5
    echo "   ⚠️  Diese Verbindungen sollten automatisch geschlossen werden"
else
    echo "   ✅ Keine offenen SSH-Verbindungen gefunden"
fi

echo ""
echo "✅ Cleanup abgeschlossen!"
echo ""
echo "💡 Tipp: Wenn du weiterhin Verbindungsprobleme hast, versuche:"
echo "   1. Cursor komplett zu schließen und neu zu starten"
echo "   2. SSH-Verbindungen manuell zu prüfen: ssh -v user@192.168.50.101"
echo "   3. Cursor Remote-SSH Extension zu deaktivieren und neu zu aktivieren"


