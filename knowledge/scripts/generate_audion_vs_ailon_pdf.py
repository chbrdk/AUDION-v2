#!/usr/bin/env python3
"""Generate AUDION vs AIlon comparison PDF (sales-oriented, AUDION-weighted)."""

from datetime import date
from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import (
    HRFlowable,
    PageBreak,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

OUT = Path(__file__).resolve().parent.parent / "AUDION-vs-AIlon-Audience-Explorer.pdf"

# Brand-ish accent (AUDION green tone)
ACCENT = colors.HexColor("#1a7f4e")
ACCENT_LIGHT = colors.HexColor("#e8f5ee")
MUTED = colors.HexColor("#555555")
TABLE_HEADER = colors.HexColor("#0d3d28")


def build_styles():
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "Title",
            parent=base["Title"],
            fontSize=22,
            leading=26,
            textColor=TABLE_HEADER,
            spaceAfter=6,
            alignment=TA_LEFT,
        ),
        "subtitle": ParagraphStyle(
            "Subtitle",
            parent=base["Normal"],
            fontSize=11,
            leading=14,
            textColor=MUTED,
            spaceAfter=14,
        ),
        "h1": ParagraphStyle(
            "H1",
            parent=base["Heading1"],
            fontSize=14,
            leading=18,
            textColor=ACCENT,
            spaceBefore=14,
            spaceAfter=8,
        ),
        "h2": ParagraphStyle(
            "H2",
            parent=base["Heading2"],
            fontSize=11,
            leading=14,
            textColor=TABLE_HEADER,
            spaceBefore=10,
            spaceAfter=6,
        ),
        "body": ParagraphStyle(
            "Body",
            parent=base["Normal"],
            fontSize=10,
            leading=14,
            alignment=TA_JUSTIFY,
            spaceAfter=6,
        ),
        "bullet": ParagraphStyle(
            "Bullet",
            parent=base["Normal"],
            fontSize=10,
            leading=13,
            leftIndent=14,
            bulletIndent=0,
            spaceAfter=4,
        ),
        "callout": ParagraphStyle(
            "Callout",
            parent=base["Normal"],
            fontSize=10,
            leading=14,
            textColor=TABLE_HEADER,
            backColor=ACCENT_LIGHT,
            borderPadding=8,
            spaceAfter=10,
        ),
        "footer": ParagraphStyle(
            "Footer",
            parent=base["Normal"],
            fontSize=8,
            textColor=MUTED,
            alignment=TA_CENTER,
        ),
        "cover_sub": ParagraphStyle(
            "CoverSub",
            parent=base["Normal"],
            fontSize=12,
            leading=16,
            textColor=MUTED,
            alignment=TA_LEFT,
            spaceAfter=20,
        ),
    }


def bullet_list(items, style):
    return [Paragraph(f"• {item}", style) for item in items]


def comparison_table(styles):
    data = [
        [
            Paragraph("<b>Kriterium</b>", styles["body"]),
            Paragraph("<b>AIlon Audience Explorer</b>", styles["body"]),
            Paragraph("<b>AUDION + MSQDX-Suite</b>", styles["body"]),
        ],
        [
            "Kernversprechen",
            "Chat auf zentrale, lizenzierte Zielgruppen-DB",
            "Persona Intelligence: Research → lebendige Gesprächspartner",
        ],
        [
            "Datenbasis",
            "Proprietärer AIlon-Datenraum (+ SYNQ)",
            "Eigene Research-Daten + strukturierte Trainingsdaten; optional CHECKION-Web-Kontext",
        ],
        [
            "Persona-Erstellung",
            "Text → quantifizierbare Zielgruppen-Definition",
            "KI-Personas in Minuten: Upload, Easy-Setup, segmentierte Zielgruppen",
        ],
        [
            "Art des Dialogs",
            "Abfrage von Kennzahlen & Merkmalen",
            "Dialog aus Nutzerperspektive – validieren, einüben, verstehen",
        ],
        [
            "Customer Journeys",
            "Nicht im Explorer-Fokus",
            "Journey Maps, KI-Generierung, Validierung mit Fit Scores",
        ],
        [
            "Integrationen",
            "AIlon-Ökosystem (Dashboard, SYNQ)",
            "Figma, PowerPoint/Office 365, Browser-Journey-Agent, MCP, PLEXON Board",
        ],
        [
            "Erlebnis",
            "Text/Tabellen (Charts geplant)",
            "Text + Voice + Video (Tavus Persona-Replica)",
        ],
        [
            "Plattform",
            "Monolithischer Datenanbieter",
            "PLEXON: ein Login, Tokens, Board mit AUDION + CHECKION Tools",
        ],
        [
            "Ideal für",
            "Media-Planning, Touchpoint-KPIs, Bevölkerungsvergleiche",
            "Produkt, UX, Design, Marketing, Enablement – im echten Workflow",
        ],
    ]
    col_widths = [4.2 * cm, 5.8 * cm, 7.5 * cm]
    t = Table(data, colWidths=col_widths, repeatRows=1)
    t.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cccccc")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ACCENT_LIGHT]),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    return t


def main():
    styles = build_styles()
    doc = SimpleDocTemplate(
        str(OUT),
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title="AUDION vs AIlon Audience Explorer",
        author="MSQDX / AUDION",
    )
    story = []

    # Cover
    story.append(Spacer(1, 1.5 * cm))
    story.append(Paragraph("AUDION × PLEXON × CHECKION", styles["subtitle"]))
    story.append(
        Paragraph(
            "Positionierung gegenüber<br/>AIlon Audience Explorer",
            styles["title"],
        )
    )
    story.append(Spacer(1, 0.3 * cm))
    story.append(
        Paragraph(
            "Warum die MSQDX Persona Intelligence Platform mehr liefert als ein reiner Daten-Chat — "
            "und wo beide Welten sich ergänzen.",
            styles["cover_sub"],
        )
    )
    story.append(
        Paragraph(
            f"<i>Stand: {date.today().strftime('%d.%m.%Y')} · MSQDX Enablement</i>",
            styles["subtitle"],
        )
    )
    story.append(HRFlowable(width="100%", thickness=2, color=ACCENT))
    story.append(Spacer(1, 0.5 * cm))
    story.append(
        Paragraph(
            "<b>Kernaussage:</b> AIlon beantwortet „Was sagt die Datenbank über diese Zielgruppe?“ — "
            "AUDION beantwortet „Was würde diese Persona zu <i>meiner</i> Idee sagen?“ — "
            "und bringt das Gespräch dorthin, wo Teams ohnehin arbeiten.",
            styles["callout"],
        )
    )
    story.append(PageBreak())

    # 1 Executive
    story.append(Paragraph("1. Executive Summary", styles["h1"]))
    story.append(
        Paragraph(
            "Der AIlon Audience Explorer ist ein starkes Werkzeug für <b>schnelle, faktenbasierte Abfragen</b> "
            "auf einer zentralen, validierten Zielgruppen-Datenbank. Für Teams, die jedoch "
            "<b>eigenes Research aktiv nutzen</b>, Ideen <b>im Arbeitskontext validieren</b> und "
            "Zielgruppen <b>erlebbar</b> machen wollen, bietet die MSQDX-Suite mit <b>AUDION</b> als Kern "
            "und <b>PLEXON</b> als Plattform-Schicht einen deutlich breiteren, workflow-nativen Ansatz.",
            styles["body"],
        )
    )
    story.extend(
        bullet_list(
            [
                "<b>Daten + Modell:</b> Auch bei AUDION steht eine fundierte Datenbasis im Mittelpunkt — "
                "Research-Uploads, strukturierte Zielgruppen- und Persona-Trainingsdaten, "
                "Vektor- und Wissensgraph (Qdrant/Neo4j). Personas werden daraus in Minuten generiert, "
                "nicht manuell nachgebaut.",
                "<b>Gespräch statt Abfrage:</b> Statt Kennzahlen aus einer Fremd-DB zu lesen, "
                "sprechen Teams mit konsistenten KI-Personas — segmentiert, quellenbasiert, wiederholbar.",
                "<b>Überall im Workflow:</b> Figma, PowerPoint (Office 365), Browser-Journey-Agent, "
                "AUDION MCP und PLEXON Board — ein Datenmodell, viele Einstiegspunkte.",
                "<b>Erlebbarkeit:</b> Text-, Voice- und Video-Chat (Tavus) machen Zielgruppen für "
                "Stakeholder greifbar — weit über Tabellen und Dashboards hinaus.",
            ],
            styles["bullet"],
        )
    )
    story.append(Spacer(1, 0.3 * cm))

    # 2 Daten
    story.append(Paragraph("2. Datenbasis: vergleichbar stark — anderer Fokus", styles["h1"]))
    story.append(
        Paragraph(
            "AIlon betont zu Recht einen <b>gesicherten, zentralen Datenraum</b> mit tausenden Merkmalen. "
            "AUDION startet nicht bei Null: Teams bringen <b>ihr Research</b> (Studien, Interviews, Reports, "
            "interne Dokumente) ein — und optional <b>Web-Realität</b> über CHECKION (Site-Topics aus Scans). "
            "Daraus entstehen <b>Zielgruppen und KI-Personas</b>, die auf dieser Wissensbasis trainiert "
            "und jederzeit nachjustiert werden.",
            styles["body"],
        )
    )
    story.append(Paragraph("AUDION im Detail:", styles["h2"]))
    story.extend(
        bullet_list(
            [
                "<b>Research-Ingestion:</b> Upload → Extraktion, Chunking, Embeddings, optional Knowledge Graph.",
                "<b>KI-Persona-Generierung:</b> Aus Dokumenten und Segmenten in wenigen Minuten — "
                "inkl. Profil, Ziele, Pain Points, Kommunikationsstil, Confidence.",
                "<b>Mehrere Zielgruppen parallel:</b> Buyer vs. Nutzer, Region, Kanal — ohne Profil-Mixing.",
                "<b>Quellen & Transparenz:</b> Antworten mit Research-Anker; kein anonymes „Oracle“.",
                "<b>CHECKION-Anreicherung:</b> Öffentliche Site-Schwerpunkte fließen in Vorschläge ein — "
                "Alignment zwischen Markenauftritt und Persona-Modell.",
            ],
            styles["bullet"],
        )
    )
    story.append(
        Paragraph(
            "<b>Fazit:</b> Wer repräsentative Bevölkerungs-KPIs für Media-Planning braucht, "
            "ist bei AIlon gut aufgehoben. Wer <b>eigenes Wissen operationalisieren</b> und "
            "<b>im Team dialogisch validieren</b> will, ist mit AUDION im Vorteil — "
            "inklusive der Möglichkeit, Personas jederzeit neu zu generieren und zu verfeinern.",
            styles["body"],
        )
    )

    # 3 Personas
    story.append(Paragraph("3. Personas in Minuten — nicht nur definieren", styles["h1"]))
    story.append(
        Paragraph(
            "Der AIlon Explorer übersetzt eine textuelle Persona in eine <b>quantifizierbare Zielgruppen-Definition</b> "
            "für die Datenbank. AUDION geht einen Schritt weiter: Aus Research entstehen "
            "<b>befragbare KI-Personas</b> mit eigenem Charakter, Stimme und optional Video-Replica — "
            "bereit für Workshops, Reviews und Stakeholder-Demos.",
            styles["body"],
        )
    )
    story.extend(
        bullet_list(
            [
                "Easy-Setup und Admin-UI für schnellen Projektstart.",
                "Avatare, Moodboards, Anreicherung und zweisprachige Felder (DE/EN).",
                "Chat-Historie und Learnings für iterative Teamarbeit.",
                "Customer Journey Maps mit KI-Generierung und <b>Validierung gegen Personas</b> (Fit Scores).",
            ],
            styles["bullet"],
        )
    )

    story.append(PageBreak())

    # 4 Integrationen
    story.append(Paragraph("4. Integrationen: AUDION sitzt im echten Workflow", styles["h1"]))
    story.append(
        Paragraph(
            "Ein Chat-Fenster allein reicht selten. AUDION ist <b>API-first</b> und bringt dieselbe "
            "Persona-Logik in die Tools, in denen Teams täglich arbeiten — ohne Kontextbruch.",
            styles["body"],
        )
    )

    integrations = [
        (
            "Figma Plugin",
            "Auswahl im Design → Screenshot → sofortiges Persona-Feedback. "
            "Design Reviews ohne Export-Ping-Pong.",
        ),
        (
            "PowerPoint / Office 365 Add-in",
            "Story und Slides direkt mit der Zielgruppe besprechen — "
            "ideal für Pitches, Executive Briefs und Enablement.",
        ),
        (
            "UX Journey Agent (Browser)",
            "Persona navigiert autonom durch URLs; aufgezeichnetes Journey-Video "
            "mit Persona-Kontext — reale Web-Erlebnisse aus Nutzersicht.",
        ),
        (
            "AUDION MCP",
            "Über 50 Tools für Agenten, Cursor und Automatisierung: "
            "Personas, Journeys, AI Assist, Projekte.",
        ),
        (
            "PLEXON Board",
            "Eine KI-Session mit AUDION- und CHECKION-MCP gemeinsam — "
            "Workshops ohne Tool-Wechsel.",
        ),
        (
            "REST API & Web-App",
            "Volle Administration, Upload, Settings — oder Einbindung in eigene Systeme.",
        ),
    ]
    for title, desc in integrations:
        story.append(Paragraph(f"<b>{title}</b>", styles["h2"]))
        story.append(Paragraph(desc, styles["body"]))

    story.append(
        Paragraph(
            "<b>AIlon</b> integriert vor allem in sein eigenes Ökosystem (Dashboard, SYNQ, geplante Skills). "
            "<b>AUDION</b> integriert in <b>Ihre</b> Design-, Office- und Agent-Workflows — "
            "das ist der Unterschied zwischen Daten-Tool und Produktivitäts-Plattform.",
            styles["callout"],
        )
    )

    # 5 Erlebbarkeit
    story.append(Paragraph("5. Erlebbarkeit: Text, Voice, Video", styles["h1"]))
    story.append(
        Paragraph(
            "AIlon liefert strukturierten Text und Tabellen — Diagramme aus dem Chat sind angekündigt. "
            "AUDION bietet <b>heute</b> drei Dialog-Ebenen, die unterschiedliche Arbeitstypen bedienen:",
            styles["body"],
        )
    )
    story.extend(
        bullet_list(
            [
                "<b>Text-Chat:</b> Streaming, Quellenbezug, mehrere Personas und Zielgruppen vergleichen.",
                "<b>Voice-Chat:</b> Hands-free in Workshops; näher am Interview — schnelle Exploration.",
                "<b>Video-Chat (Tavus CVI):</b> Gespräch mit Persona-Replica — Stakeholder-Einbindung, "
                "Pitch-Übung, Enablement mit emotionaler Präsenz.",
            ],
            styles["bullet"],
        )
    )
    story.append(
        Paragraph(
            "Für Leadership, Sales Enablement und Design bedeutet das: "
            "Die Zielgruppe wird <b>hör- und sichtbar</b> — nicht nur als Kennzahl in einer Tabelle.",
            styles["body"],
        )
    )

    # 6 PLEXON
    story.append(Paragraph("6. PLEXON: die Plattform-Schicht", styles["h1"]))
    story.append(
        Paragraph(
            "PLEXON ist kein Konkurrent zu AIlon, sondern die <b>MSQDX Control Plane</b>:",
            styles["body"],
        )
    )
    story.extend(
        bullet_list(
            [
                "<b>Ein Account</b> für AUDION, CHECKION und weitere Produkte.",
                "<b>Token-Transparenz:</b> Nutzung wird gemeldet und nachvollziehbar abgerechnet.",
                "<b>Plattform-Projekte:</b> Zielgruppen und Scans über Produkte hinweg gebunden.",
                "<b>Board + MCP:</b> KI orchestriert AUDION- und CHECKION-Tools in einer Session.",
            ],
            styles["bullet"],
        )
    )

    story.append(PageBreak())

    # 7 Vergleichstabelle
    story.append(Paragraph("7. Vergleich auf einen Blick", styles["h1"]))
    story.append(comparison_table(styles))
    story.append(Spacer(1, 0.4 * cm))

    # 8 Wann was
    story.append(Paragraph("8. Wann welches Tool — und warum oft AUDION", styles["h1"]))
    wann_data = [
        ["Situation", "Empfehlung"],
        ["Repräsentative Medien-/Marken-KPIs vs. Bevölkerung", "AIlon (Datenbank)"],
        ["Eigenes Research schnell nutzbar machen", "AUDION"],
        ["Ideen aus Nutzerperspektive testen", "AUDION"],
        ["Customer Journeys bauen & validieren", "AUDION"],
        ["Design-Feedback im Figma-Kontext", "AUDION"],
        ["Stakeholder mit Video-Persona überzeugen", "AUDION"],
        ["Website-Realität + Persona-Modell verbinden", "AUDION + CHECKION"],
        ["Ein Login, Usage, Workshop-Board", "PLEXON-Suite"],
    ]
    t2 = Table(wann_data, colWidths=[8.5 * cm, 8.5 * cm])
    t2.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), TABLE_HEADER),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#cccccc")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, ACCENT_LIGHT]),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 8),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.append(t2)
    story.append(Spacer(1, 0.5 * cm))

    # 9 Abschluss
    story.append(Paragraph("9. Zusammenfassung für Sales & Enablement", styles["h1"]))
    story.append(
        Paragraph(
            "<b>AUDION + PLEXON + CHECKION</b> ist keine „ChatGPT für Zielgruppen“, sondern eine "
            "<b>Persona Intelligence Platform</b>: Research und Trainingsdaten werden zu "
            "<b>lebenden Gesprächspartnern</b>, die im Figma-File, in PowerPoint, im Browser und "
            "auf dem Strategy-Board verfügbar sind — mit Voice und Video, wo es zählt.",
            styles["body"],
        )
    )
    story.append(
        Paragraph(
            "Gegenüber dem AIlon Audience Explorer punkten wir mit: "
            "<b>(1)</b> eigener, steuerbarer Daten- und Persona-Basis, "
            "<b>(2)</b> dialogischer Validierung statt reiner DB-Abfrage, "
            "<b>(3)</b> Journey-Arbeit mit Fit Scores, "
            "<b>(4)</b> tiefer Workflow-Integration und "
            "<b>(5)</b> multimodaler Erlebbarkeit. "
            "AIlon bleibt stark für standardisierte Markt-KPIs — "
            "AUDION gewinnt dort, wo Teams <b>bauen, testen und entscheiden</b>.",
            styles["callout"],
        )
    )
    story.append(Spacer(1, 1 * cm))
    story.append(
        Paragraph(
            "MSQDX · AUDION Persona Intelligence Platform · audion.projects-a.plygrnd.tech",
            styles["footer"],
        )
    )

    doc.build(story)
    print(f"PDF written to: {OUT}")


if __name__ == "__main__":
    main()
