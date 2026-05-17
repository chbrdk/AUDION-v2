import type { Theme } from "@mui/material";
import type { SystemStyleObject } from "@mui/system";

export type CornerTabPlacement = "top-left" | "top-right";

type CornerStyle = "rounded" | "square" | "cutdown-a" | "cutdown-b";

/** Defaults aligned with BVik workflow nodes. */
export const CORNER_TAB_CARD_DEFAULTS = {
  tabWidthPx: 48,
  tabHeightPx: 32,
  containerBorderRadiusPx: 16,
  bodyBorderRadiusPx: 14,
  cornerBoxBorderRadiusPx: 16,
  cornerBoxWidthExtraPx: 14,
} as const;

export type CornerTabCardLayoutOptions = {
  placement: CornerTabPlacement;
  tabWidthPx?: number;
  tabHeightPx?: number;
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

  const tabContainerSx: SystemStyleObject<Theme> = {
    position: "absolute",
    top: -tabHeightPx,
    ...(isTopLeft ? { left: 0 } : { right: 0 }),
    width: tabWidthPx,
    height: tabHeightPx,
    borderRadius: tabContainerBorderRadius,
    pointerEvents: "none",
    zIndex: 2,
    overflow: "visible",
  };

  const cornerBoxSx: SystemStyleObject<Theme> = {
    position: "absolute",
    top: 0,
    ...(isTopLeft ? { left: 0 } : { right: 0 }),
    width: `calc(100% + ${widthExtra}px)`,
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: `${cornerBoxRadius}px`,
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
