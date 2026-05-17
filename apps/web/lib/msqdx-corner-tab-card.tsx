"use client";

/**
 * Local CornerTabCard (uses `MsqdxCornerBox` from @msqdx/react).
 * Mirrors msqdx-design-system MsqdxCornerTabCard until the package export is on main.
 */
import { Box, type BoxProps } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import type { SystemStyleObject } from "@mui/system";
import type { ReactNode } from "react";
import { MsqdxCornerBox } from "@msqdx/react";
import {
  CORNER_TAB_CARD_DEFAULTS,
  getCornerTabCardLayout,
  type CornerTabPlacement,
} from "./corner-tab-card-layout";

export type { CornerTabPlacement } from "./corner-tab-card-layout";

function mergeSx(
  ...parts: Array<SystemStyleObject<Theme> | undefined>
): SystemStyleObject<Theme> {
  return Object.assign({}, ...parts.filter(Boolean));
}

export interface MsqdxCornerTabCardProps extends Omit<BoxProps, "children"> {
  children: ReactNode;
  tab?: ReactNode;
  placement?: CornerTabPlacement;
  bodyColor?: string;
  tabChromeColor?: string;
  tabColor?: string;
  bodyBorderRadiusPx?: number;
  tabWidthPx?: number;
  tabHeightPx?: number;
  cornerBoxBorderRadiusPx?: number;
  cornerBoxWidthExtraPx?: number;
  containerBorderRadiusPx?: number;
  tabAriaLabel?: string;
  bodySx?: SxProps<Theme>;
}

export function MsqdxCornerTabCard({
  children,
  tab,
  placement = "top-left",
  bodyColor,
  tabChromeColor = "#ffffff",
  tabColor,
  bodyBorderRadiusPx,
  tabWidthPx,
  tabHeightPx,
  cornerBoxBorderRadiusPx,
  cornerBoxWidthExtraPx,
  containerBorderRadiusPx,
  tabAriaLabel,
  bodySx,
  sx,
  ...rootProps
}: MsqdxCornerTabCardProps) {
  const layout = getCornerTabCardLayout({
    placement,
    tabWidthPx,
    tabHeightPx,
    bodyBorderRadiusPx,
    cornerBoxBorderRadiusPx,
    cornerBoxWidthExtraPx,
    containerBorderRadiusPx,
  });

  const effectiveTabColor = tabColor ?? bodyColor;
  const { topLeft, topRight, bottomLeft, bottomRight } = layout.cornerStyles;
  const cornerBoxSxMerged = mergeSx(
    layout.cornerBoxSx,
    effectiveTabColor ? { bgcolor: effectiveTabColor } : undefined
  );

  return (
    <Box
      {...rootProps}
      sx={{
        position: "relative",
        overflow: "visible",
        ...sx,
      }}
    >
      <Box sx={{ ...layout.tabContainerSx, bgcolor: tabChromeColor }}>
        <MsqdxCornerBox
          topLeft={topLeft}
          topRight={topRight}
          bottomLeft={bottomLeft}
          bottomRight={bottomRight}
          borderRadius={cornerBoxBorderRadiusPx ?? CORNER_TAB_CARD_DEFAULTS.cornerBoxBorderRadiusPx}
          // Boundary cast: @msqdx/react resolves MUI/React types from the design-system tree.
          sx={cornerBoxSxMerged as Parameters<typeof MsqdxCornerBox>[0]["sx"]}
          aria-label={tab ? tabAriaLabel : undefined}
        >
          {tab as Parameters<typeof MsqdxCornerBox>[0]["children"]}
        </MsqdxCornerBox>
      </Box>

      <Box
        className="msqdx-corner-tab-card__body"
        sx={{
          borderRadius: layout.bodyBorderRadius,
          ...(bodyColor ? { bgcolor: bodyColor } : {}),
          ...bodySx,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}
