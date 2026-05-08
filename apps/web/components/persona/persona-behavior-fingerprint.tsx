"use client";

/**
 * Persona behavior fingerprint — radar chart + heuristic chips for UX Journey runs.
 *
 * Renders the six derived dimensions from checkion-agent's PersonaPolicy (0–1 scale)
 * with a neutral baseline overlay, optional persona label, and readable heuristics.
 */

import { useId, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  alpha,
  Box,
  Button,
  Chip,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
  type Theme,
} from "@mui/material";
import { keyframes } from "@emotion/react";
import { MsqdxIcon } from "@msqdx/react";

/** Canonical dimension keys — order matches PersonaDimensions in checkion-agent. */
export const PERSONA_DIMENSION_KEYS = [
  "risk_aversion",
  "time_pressure",
  "exploration",
  "detail_orientation",
  "trust_skepticism",
  "accessibility_need",
] as const;

export type PersonaDimensionKey = (typeof PERSONA_DIMENSION_KEYS)[number];

export type PersonaBehaviorPolicyLike = {
  dimensions?: Partial<Record<string, number>> | null;
  heuristics?: string[] | null;
};

export type PersonaBehaviorFingerprintProps = {
  policy: PersonaBehaviorPolicyLike | null | undefined;
  /** Optional persona display name (chat message context). */
  personaLabel?: string | null;
  /** i18n: (key, params?) => string — expects keys under `chat.uxJourney.personaFingerprint.*`. */
  t: (key: string, params?: Record<string, string | number>) => string;
  /** Smaller padding / typography for inline chat cards. */
  compact?: boolean;
};

const VIEW_SIZE = 320;
const CX = VIEW_SIZE / 2;
const CY = VIEW_SIZE / 2;
const R_MIN = 38;
const R_MAX = 132;

const radarEnter = keyframes`
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
`;

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0.5;
  return Math.min(1, Math.max(0, n));
}

function polarPoint(index: number, nAxes: number, value01: number): [number, number] {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / nAxes;
  const r = R_MIN + clamp01(value01) * (R_MAX - R_MIN);
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
}

/** Label anchor slightly outside the outer grid ring. */
function axisLabelPoint(index: number, nAxes: number): [number, number] {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / nAxes;
  const r = R_MAX + 26;
  return [CX + r * Math.cos(angle), CY + r * Math.sin(angle)];
}

function polygonPath(points: [number, number][]): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p[0].toFixed(2)} ${p[1].toFixed(2)}`).join(" ") + " Z";
}

function ringPolygon(nAxes: number, value01: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i < nAxes; i++) {
    pts.push(polarPoint(i, nAxes, value01));
  }
  return pts;
}

function dimLabelKey(key: PersonaDimensionKey): string {
  return `chat.uxJourney.personaFingerprint.dim.${key}`;
}

function radarColors(theme: Theme) {
  const primary = theme.palette.primary.main;
  const secondary = theme.palette.secondary?.main ?? primary;
  return {
    grid: alpha(theme.palette.divider, 0.55),
    baseline: alpha(theme.palette.text.secondary, 0.35),
    fill: alpha(primary, 0.22),
    stroke: primary,
    accent: secondary,
    label: theme.palette.text.secondary,
    labelStrong: theme.palette.text.primary,
  };
}

function BarStrip({
  keys,
  values,
  t,
}: {
  keys: readonly PersonaDimensionKey[];
  values: Record<string, number>;
  t: PersonaBehaviorFingerprintProps["t"];
}) {
  const theme = useTheme();
  const c = radarColors(theme);

  return (
    <Stack spacing={1} sx={{ width: "100%", mt: 1 }}>
      {keys.map((key) => {
        const v = clamp01(values[key] ?? 0.5);
        return (
          <Box key={key}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.35 }}>
              <Typography variant="caption" sx={{ fontWeight: 600, color: c.labelStrong, fontSize: "0.7rem" }}>
                {t(dimLabelKey(key))}
              </Typography>
              <Typography variant="caption" sx={{ color: c.label, fontVariantNumeric: "tabular-nums", fontSize: "0.68rem" }}>
                {(v * 100).toFixed(0)}
              </Typography>
            </Box>
            <Box
              sx={{
                height: 6,
                borderRadius: 999,
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                overflow: "hidden",
                border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
              }}
            >
              <Box
                sx={{
                  height: "100%",
                  width: `${v * 100}%`,
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${alpha(theme.palette.primary.main, 0.55)} 0%, ${theme.palette.primary.main} 100%)`,
                  boxShadow: `0 0 12px ${alpha(theme.palette.primary.main, 0.35)}`,
                  transition: "width 0.45s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}

export function PersonaBehaviorFingerprint({
  policy,
  personaLabel,
  t,
  compact = false,
}: PersonaBehaviorFingerprintProps) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const fillGradId = `personaRadarFill-${uid}`;
  const strokeGradId = `personaRadarStroke-${uid}`;
  const theme = useTheme();
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const isNarrow = useMediaQuery(theme.breakpoints.down("sm"));
  const [heuristicsExpanded, setHeuristicsExpanded] = useState(false);

  const dims = policy?.dimensions ?? {};
  const heuristics = Array.isArray(policy?.heuristics) ? policy!.heuristics!.filter((h) => typeof h === "string" && h.trim()) : [];

  const values = useMemo(() => {
    const out: Record<string, number> = {};
    for (const key of PERSONA_DIMENSION_KEYS) {
      const raw = dims[key as string];
      out[key] = typeof raw === "number" ? clamp01(raw) : 0.5;
    }
    return out;
  }, [dims]);

  const nAx = PERSONA_DIMENSION_KEYS.length;

  const radarPoints = useMemo(
    () => PERSONA_DIMENSION_KEYS.map((k, i) => polarPoint(i, nAx, values[k])),
    [values, nAx],
  );
  const baselinePoints = useMemo(() => ringPolygon(nAx, 0.5), [nAx]);

  const gridRings = [0.33, 0.66, 1];
  const c = radarColors(theme);

  const ariaSummary = useMemo(() => {
    const parts = PERSONA_DIMENSION_KEYS.map((k) => `${t(dimLabelKey(k))} ${(values[k] * 100).toFixed(0)}`);
    return t("chat.uxJourney.personaFingerprint.ariaSummary", { summary: parts.join(", ") });
  }, [t, values]);

  /** Mobile compact chat: bars-only reads cleaner than a tiny radar. */
  const showRadar = !(isNarrow && compact);

  const previewCap = compact ? 4 : 8;
  const heuristicPreview = heuristicsExpanded ? heuristics : heuristics.slice(0, previewCap);
  const hasMoreHeuristics = heuristics.length > heuristicPreview.length;

  if (!policy?.dimensions || typeof policy.dimensions !== "object") {
    return null;
  }

  const heuristicsBlock = (
    <>
      <Stack direction="row" flexWrap="wrap" gap={0.75}>
        {heuristicPreview.map((h, idx) => (
          <Chip
            key={`${idx}-${h.slice(0, 24)}`}
            label={h.length > 120 ? `${h.slice(0, 117)}…` : h}
            size="small"
            variant="outlined"
            sx={{
              borderColor: alpha(theme.palette.primary.main, 0.35),
              bgcolor: alpha(theme.palette.primary.main, 0.06),
              height: "auto",
              py: 0.5,
              "& .MuiChip-label": { whiteSpace: "normal", textAlign: "left", lineHeight: 1.35 },
            }}
          />
        ))}
      </Stack>
      {hasMoreHeuristics ? (
        <Button size="small" onClick={() => setHeuristicsExpanded(!heuristicsExpanded)} sx={{ mt: 1, textTransform: "none" }}>
          {heuristicsExpanded ? t("chat.uxJourney.personaFingerprint.showLess") : t("chat.uxJourney.personaFingerprint.showAll")}
        </Button>
      ) : null}
    </>
  );

  return (
    <Box
      sx={{
        mt: compact ? 0.5 : 1,
        p: compact ? 1 : 1.25,
        borderRadius: 2,
        border: `1px solid ${alpha(theme.palette.divider, 0.55)}`,
        background: `linear-gradient(145deg, ${alpha(theme.palette.background.paper, 0.55)} 0%, ${alpha(
          theme.palette.primary.main,
          0.04,
        )} 100%)`,
        backdropFilter: "blur(10px)",
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mb: showRadar ? 0.75 : 0 }}>
        <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: "0.06em", color: "text.secondary", textTransform: "uppercase" }}>
          {t("chat.uxJourney.personaFingerprint.title")}
        </Typography>
        {personaLabel?.trim() ? (
          <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary", lineHeight: 1.35 }}>
            {personaLabel.trim()}
          </Typography>
        ) : null}
        <Typography variant="caption" sx={{ color: "text.secondary", lineHeight: 1.45 }}>
          {t("chat.uxJourney.personaFingerprint.subtitle")}
        </Typography>
      </Box>

      {showRadar ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: compact ? 0.5 : 1 }}>
          <Box
            component="svg"
            viewBox={`0 0 ${VIEW_SIZE} ${VIEW_SIZE}`}
            role="img"
            aria-label={ariaSummary}
            sx={{
              width: "100%",
              maxWidth: compact ? 260 : 300,
              height: "auto",
              overflow: "visible",
              filter: prefersReducedMotion ? undefined : `drop-shadow(0 6px 24px ${alpha(theme.palette.primary.main, 0.18)})`,
              ...(prefersReducedMotion
                ? {}
                : {
                    animation: `${radarEnter} 0.75s cubic-bezier(0.22, 1, 0.36, 1) forwards`,
                    transformOrigin: `${CX}px ${CY}px`,
                  }),
            }}
          >
            <defs>
              <linearGradient id={fillGradId} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={alpha(theme.palette.primary.main, 0.35)} />
                <stop offset="100%" stopColor={alpha(c.accent, 0.28)} />
              </linearGradient>
              <linearGradient id={strokeGradId} x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor={theme.palette.primary.light} />
                <stop offset="100%" stopColor={theme.palette.primary.main} />
              </linearGradient>
            </defs>

            {gridRings.map((gv, idx) => (
              <path
                key={`grid-${gv}`}
                d={polygonPath(ringPolygon(nAx, gv))}
                fill="none"
                stroke={c.grid}
                strokeWidth={idx === 2 ? 1.2 : 0.9}
                opacity={idx === 2 ? 0.95 : 0.65}
              />
            ))}

            <path
              d={polygonPath(baselinePoints)}
              fill="none"
              stroke={c.baseline}
              strokeWidth={1.5}
              strokeDasharray="6 5"
              opacity={0.9}
            />

            <path
              d={polygonPath(radarPoints)}
              fill={`url(#${fillGradId})`}
              stroke={`url(#${strokeGradId})`}
              strokeWidth={2.2}
              strokeLinejoin="round"
            />

            {PERSONA_DIMENSION_KEYS.map((key, i) => {
              const [lx, ly] = axisLabelPoint(i, nAx);
              const short = t(dimLabelKey(key));
              return (
                <text
                  key={key}
                  x={lx}
                  y={ly}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={c.label}
                  fontSize={11}
                  fontWeight={600}
                  style={{ fontFamily: theme.typography.fontFamily }}
                >
                  {short.length > 18 ? `${short.slice(0, 16)}…` : short}
                </text>
              );
            })}
          </Box>
        </Box>
      ) : (
        <BarStrip keys={PERSONA_DIMENSION_KEYS} values={values} t={t} />
      )}

      {showRadar && isNarrow ? (
        <Box sx={{ mt: 0.5 }}>
          <BarStrip keys={PERSONA_DIMENSION_KEYS} values={values} t={t} />
        </Box>
      ) : null}

      {heuristics.length > 0 ? (
        compact ? (
          <Accordion
            disableGutters
            elevation={0}
            sx={{
              mt: 1,
              bgcolor: "transparent",
              "&:before": { display: "none" },
              borderRadius: 1,
              border: `1px solid ${alpha(theme.palette.divider, 0.35)}`,
            }}
          >
            <AccordionSummary expandIcon={<MsqdxIcon name="expand_more" customSize={20} />} sx={{ minHeight: 42, "& .MuiAccordionSummary-content": { my: 0.75 } }}>
              <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
                {t("chat.uxJourney.personaFingerprint.heuristicsHeading")}
              </Typography>
              <Chip size="small" label={heuristics.length} sx={{ ml: 1, height: 22, fontWeight: 700 }} />
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, pb: 1.25 }}>{heuristicsBlock}</AccordionDetails>
          </Accordion>
        ) : (
          <Box sx={{ mt: 1.25 }}>
            <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", display: "block", mb: 0.75 }}>
              {t("chat.uxJourney.personaFingerprint.heuristicsHeading")}
            </Typography>
            {heuristicsBlock}
          </Box>
        )
      ) : null}
    </Box>
  );
}
