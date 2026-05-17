"use client";

import { Box } from "@mui/material";
import { MsqdxCornerBox } from "@msqdx/react";
import {
  CORNER_TAB_CARD_DEFAULTS,
  getCornerTabCardLayout,
  type CornerTabPlacement,
} from "./corner-tab-card-layout";
import {
  renderChipEditorCornerTab,
  resolveChipEditorCornerTabStyle,
} from "./chip-editor-corner-tab";
import type { MsqdxGlassChipVariant } from "../components/generic/msqdx-glass-chip";

export type ChipEditorCornerTabBadgeProps = {
  variant: MsqdxGlassChipVariant;
  label: string;
  placement?: CornerTabPlacement;
};

/** Inline corner tab for the slider controls row (top-right cutdown geometry). */
export function ChipEditorCornerTabBadge({
  variant,
  label,
  placement = "top-right",
}: ChipEditorCornerTabBadgeProps) {
  const style = resolveChipEditorCornerTabStyle(variant);
  if (!style || (variant !== "pain" && variant !== "goal")) {
    return null;
  }

  const layout = getCornerTabCardLayout({ placement });
  const { topLeft, topRight, bottomLeft, bottomRight } = layout.cornerStyles;
  const isTopRight = placement === "top-right";
  const widthExtra = CORNER_TAB_CARD_DEFAULTS.cornerBoxWidthExtraPx;

  return (
    <Box
      className="msqdx-glass-chip-editor__corner-tab-badge"
      aria-label={label}
      sx={{
        width: layout.tabWidthPx,
        height: layout.tabHeightPx,
        flexShrink: 0,
        borderRadius: layout.tabContainerBorderRadius,
        bgcolor: "var(--color-primary-white, #ffffff)",
        overflow: "visible",
        position: "relative",
      }}
    >
      <MsqdxCornerBox
        topLeft={topLeft}
        topRight={topRight}
        bottomLeft={bottomLeft}
        bottomRight={bottomRight}
        borderRadius={CORNER_TAB_CARD_DEFAULTS.cornerBoxBorderRadiusPx}
        sx={{
          position: "absolute",
          top: 0,
          ...(isTopRight ? { right: 0 } : { left: 0 }),
          width: `calc(100% + ${widthExtra}px)`,
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: `${CORNER_TAB_CARD_DEFAULTS.cornerBoxBorderRadiusPx}px`,
          bgcolor: style.tabColor,
        }}
      >
        {renderChipEditorCornerTab(variant, label) as Parameters<typeof MsqdxCornerBox>[0]["children"]}
      </MsqdxCornerBox>
    </Box>
  );
}
