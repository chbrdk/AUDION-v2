"use client";

import { Children, type CSSProperties, type ReactNode } from "react";
import { Box } from "@mui/material";
import { MsqdxButton, MsqdxIcon } from "@msqdx/react";
import { useHorizontalCardSlider } from "../../lib/use-horizontal-card-slider";
import { useI18n } from "../i18n/i18n-provider";

export type MsqdxGlassHorizontalCardSliderLayoutArgs = {
  leading: ReactNode;
  controlsEnd: ReactNode;
  viewport: ReactNode;
  showLeadingRow: boolean;
};

export type MsqdxGlassHorizontalCardSliderProps = {
  children: ReactNode;
  slidesVisible?: number;
  gap?: string;
  ariaLabel: string;
  className?: string;
  toolbarStart?: ReactNode;
  leading?: ReactNode;
  /** Custom layout (e.g. corner-tab shell wraps controls in tab chrome). */
  renderLayout?: (args: MsqdxGlassHorizontalCardSliderLayoutArgs) => ReactNode;
};

export function MsqdxGlassHorizontalCardSlider({
  children,
  slidesVisible = 3.5,
  gap = "1rem",
  ariaLabel,
  className,
  toolbarStart,
  leading,
  renderLayout,
}: MsqdxGlassHorizontalCardSliderProps) {
  const { t } = useI18n();
  const slideCount = Children.count(children);
  const slider = useHorizontalCardSlider(slidesVisible, slideCount);

  const sliderStyle = {
    "--slider-gap": gap,
    "--slides-visible": String(slider.effectiveSlidesVisible),
    "--slider-gap-count": String(slider.sliderGapCount),
  } as CSSProperties;

  const sliderClassName = className
    ? `msqdx-glass-horizontal-card-slider ${className}`
    : "msqdx-glass-horizontal-card-slider";

  const toolbarControls = toolbarStart ? (
    <Box
      className="msqdx-glass-horizontal-card-slider__toolbar"
      role="group"
      aria-label={t("chipEditor.sectionActions")}
    >
      {toolbarStart}
    </Box>
  ) : null;

  const navControls = slider.showNavControls ? (
    <Box
      className="msqdx-glass-horizontal-card-slider__nav"
      role="group"
      aria-label={t("horizontalSlider.navigation")}
    >
      <MsqdxButton
        variant="outlined"
        size="small"
        onClick={() => slider.scrollRelative(-1)}
        disabled={!slider.canScrollBack}
        aria-label={t("horizontalSlider.previous")}
      >
        <MsqdxIcon name="chevron_left" customSize={18} />
      </MsqdxButton>
      <MsqdxButton
        variant="outlined"
        size="small"
        onClick={() => slider.scrollRelative(1)}
        disabled={!slider.canScrollForward}
        aria-label={t("horizontalSlider.next")}
      >
        <MsqdxIcon name="chevron_right" customSize={18} />
      </MsqdxButton>
    </Box>
  ) : null;

  const controlsEnd =
    toolbarControls || navControls ? (
      <>
        {toolbarControls}
        {navControls}
      </>
    ) : null;

  const viewport = (
    <div
      ref={slider.viewportRef}
      className="msqdx-glass-horizontal-card-slider__viewport"
      tabIndex={0}
      aria-label={ariaLabel}
      onScroll={slider.updateScrollState}
      onKeyDown={slider.handleKeyDown}
    >
      {children}
    </div>
  );

  const showLeadingRow = Boolean(leading);
  const showDefaultControlsBar = showLeadingRow || Boolean(controlsEnd);

  if (renderLayout) {
    return (
      <div className={sliderClassName} style={sliderStyle}>
        {renderLayout({
          leading: leading ?? null,
          controlsEnd,
          viewport,
          showLeadingRow,
        })}
      </div>
    );
  }

  return (
    <div className={sliderClassName} style={sliderStyle}>
      {showDefaultControlsBar ? (
        <Box className="msqdx-glass-horizontal-card-slider__controls">
          {leading ? (
            <Box className="msqdx-glass-horizontal-card-slider__leading">{leading}</Box>
          ) : null}
          {controlsEnd ? (
            <Box className="msqdx-glass-horizontal-card-slider__controls-end">{controlsEnd}</Box>
          ) : null}
        </Box>
      ) : null}
      {viewport}
    </div>
  );
}
