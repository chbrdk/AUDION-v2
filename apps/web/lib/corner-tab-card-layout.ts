import type { Theme } from "@mui/material";
import type { SystemStyleObject } from "@mui/system";

export type CornerTabPlacement = "top-left" | "top-right";

type CornerStyle = "rounded" | "square" | "cutdown-a" | "cutdown-b";

/** Defaults aligned with BVik workflow nodes. */
export const CORNER_TAB_CARD_DEFAULTS = {
  tabWidthPx: 48,
  tabHeightPx: 32,
  /** Taller tab when icon + toolbar actions sit inside the corner box. */
  tabHeightAutoPx: 40,
  /** Vertical offset for auto-width tab shell (sits above the card body). */
  tabContainerTopOffsetAutoPx: 48,
  containerBorderRadiusPx: 16,
  bodyBorderRadiusPx: 14,
  cornerBoxBorderRadiusPx: 16,
  cornerBoxWidthExtraPx: 14,
} as const;

export type CornerTabCardLayoutOptions = {
  placement: CornerTabPlacement;
  tabWidthPx?: number;
  tabHeightPx?: number;
  /** Tab grows with icon + toolbar content (pain/goals controls). */
  tabWidthAuto?: boolean;
  containerBorderRadiusPx?: number;
  bodyBorderRadiusPx?: number;
  cornerBoxBorderRadiusPx?: number;
  cornerBoxWidthExtraPx?: number;
};

type CornerTabCardCornerStyles = {
  topLeft: CornerStyle;
  topRight: CornerStyle;
  bottomLeft: CornerStyle;
  bottomRight: CornerStyle;
};

export function getCornerTabCardLayout(options: CornerTabCardLayoutOptions) {
  const placement = options.placement;
  const tabWidthPx = options.tabWidthPx ?? CORNER_TAB_CARD_DEFAULTS.tabWidthPx;
  const tabHeightPx = options.tabHeightPx ?? CORNER_TAB_CARD_DEFAULTS.tabHeightPx;
  const containerRadius = options.containerBorderRadiusPx ?? CORNER_TAB_CARD_DEFAULTS.containerBorderRadiusPx;
  const bodyRadius = options.bodyBorderRadiusPx ?? CORNER_TAB_CARD_DEFAULTS.bodyBorderRadiusPx;
  const cornerBoxRadius = options.cornerBoxBorderRadiusPx ?? CORNER_TAB_CARD_DEFAULTS.cornerBoxBorderRadiusPx;
  const widthExtra = options.cornerBoxWidthExtraPx ?? CORNER_TAB_CARD_DEFAULTS.cornerBoxWidthExtraPx;
  const tabWidthAuto = options.tabWidthAuto ?? false;

  const isTopLeft = placement === "top-left";

  const bodyBorderRadius = isTopLeft
    ? `0 ${bodyRadius}px ${bodyRadius}px ${bodyRadius}px`
    : `${bodyRadius}px 0 ${bodyRadius}px ${bodyRadius}px`;

  const tabContainerBorderRadius = isTopLeft
    ? `${containerRadius}px 0 0 0`
    : `0 ${containerRadius}px 0 0`;

  const cornerStyles: CornerTabCardCornerStyles = isTopLeft
    ? {
        topLeft: "rounded",
        topRight: "rounded",
        bottomLeft: "square",
        bottomRight: "cutdown-a",
      }
    : {
        topLeft: "rounded",
        topRight: "rounded",
        bottomLeft: "cutdown-a",
        bottomRight: "square",
      };

  const tabHeightAutoPx = CORNER_TAB_CARD_DEFAULTS.tabHeightAutoPx;
  const tabContainerTopOffsetAutoPx = CORNER_TAB_CARD_DEFAULTS.tabContainerTopOffsetAutoPx;
  const effectiveTabHeightPx = tabWidthAuto ? tabHeightAutoPx : tabHeightPx;

  const tabContainerSx: SystemStyleObject<Theme> = {
    position: "absolute",
    top: tabWidthAuto ? `-${tabContainerTopOffsetAutoPx}px` : -tabHeightPx,
    ...(isTopLeft ? { left: 0 } : { right: 0 }),
    width: tabWidthAuto ? "max-content" : tabWidthPx,
    minWidth: tabWidthPx,
    height: tabWidthAuto ? "auto" : tabHeightPx,
    minHeight: effectiveTabHeightPx,
    borderRadius: tabContainerBorderRadius,
    pointerEvents: tabWidthAuto ? "auto" : "none",
    zIndex: 2,
    overflow: "visible",
  };

  const cornerBoxSx: SystemStyleObject<Theme> = tabWidthAuto
    ? {
        position: "relative",
        width: "fit-content",
        minWidth: tabWidthPx,
        minHeight: tabHeightAutoPx,
        height: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: isTopLeft ? "flex-start" : "flex-end",
        py: 0.5,
        px: 1,
        boxSizing: "border-box",
        // Cutdown still extends toward the card body (top-right tab).
        ...(isTopLeft ? {} : { marginLeft: `-${widthExtra}px` }),
      }
    : {
        position: "absolute",
        top: 0,
        ...(isTopLeft ? { left: 0 } : { right: 0 }),
        width: `calc(100% + ${widthExtra}px)`,
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: isTopLeft ? "flex-start" : "flex-end",
      };

  return {
    placement,
    tabWidthPx,
    tabHeightPx,
    bodyBorderRadius,
    tabContainerBorderRadius,
    cornerStyles,
    tabContainerSx,
    cornerBoxSx,
  };
}
