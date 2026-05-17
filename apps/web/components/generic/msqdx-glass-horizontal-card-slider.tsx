"use client";

import {
  Children,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Box } from "@mui/material";
import { MsqdxButton, MsqdxIcon } from "@msqdx/react";
import {
  gapCountForSlidesVisible,
  resolveSlidesVisibleForContainerWidth,
} from "../../lib/horizontal-card-slider-layout";
import { useI18n } from "../i18n/i18n-provider";

export type MsqdxGlassHorizontalCardSliderProps = {
  children: ReactNode;
  /** How many slides are visible at once (e.g. 3.5 shows a peek of the next). */
  slidesVisible?: number;
  gap?: string;
  ariaLabel: string;
  className?: string;
  /** Actions rendered beside prev/next controls (e.g. AI + edit). */
  toolbarStart?: ReactNode;
  /** Title or meta on the left of the controls row (e.g. section heading). */
  leading?: ReactNode;
  /**
   * When true, toolbar + nav are not rendered in the controls row; passed to
   * `onCornerTabControls` for placement inside `MsqdxCornerTabCard` tab.
   */
  cornerTabControls?: boolean;
  onCornerTabControls?: (actions: ReactNode) => void;
};

export function MsqdxGlassHorizontalCardSlider({
  children,
  slidesVisible = 3.5,
  gap = "1rem",
  ariaLabel,
  className,
  toolbarStart,
  leading,
  cornerTabControls = false,
  onCornerTabControls,
}: MsqdxGlassHorizontalCardSliderProps) {
  const { t } = useI18n();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  const slideCount = Children.count(children);
  const effectiveSlidesVisible = resolveSlidesVisibleForContainerWidth(
    slidesVisible,
    containerWidth
  );
  const sliderGapCount = gapCountForSlidesVisible(effectiveSlidesVisible);

  const updateScrollState = useCallback(() => {
    const container = viewportRef.current;
    if (!container) return;

    const maxScroll = container.scrollWidth - container.clientWidth;
    setCanScrollBack(container.scrollLeft > 4);
    setCanScrollForward(container.scrollLeft < maxScroll - 4);

    const slides = Array.from(container.querySelectorAll<HTMLElement>("[data-slide-index]"));
    if (!slides.length) {
      setActiveIndex(0);
      return;
    }

    const containerRect = container.getBoundingClientRect();
    const containerCenter = containerRect.left + containerRect.width * 0.35;
    let closestIndex = 0;
    let minDistance = Number.POSITIVE_INFINITY;

    slides.forEach((slide) => {
      const rect = slide.getBoundingClientRect();
      const slideCenter = rect.left + rect.width / 2;
      const distance = Math.abs(slideCenter - containerCenter);
      if (distance < minDistance) {
        minDistance = distance;
        closestIndex = Number(slide.dataset.slideIndex ?? 0);
      }
    });

    setActiveIndex(closestIndex);
  }, []);

  const syncContainerWidth = useCallback(() => {
    const container = viewportRef.current;
    if (!container) return;
    setContainerWidth(container.clientWidth);
  }, []);

  useLayoutEffect(() => {
    syncContainerWidth();
  }, [syncContainerWidth, slideCount]);

  useEffect(() => {
    updateScrollState();
    const container = viewportRef.current;
    if (!container) return undefined;

    const observer = new ResizeObserver(() => {
      syncContainerWidth();
      updateScrollState();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [slideCount, syncContainerWidth, updateScrollState]);

  const scrollToIndex = useCallback(
    (index: number) => {
      const container = viewportRef.current;
      if (!container) return;
      const clamped = Math.max(0, Math.min(index, slideCount - 1));
      const target = container.querySelector<HTMLElement>(`[data-slide-index="${clamped}"]`);
      if (!target) return;
      container.scrollTo({
        left: target.offsetLeft - container.offsetLeft,
        behavior: "smooth",
      });
      setActiveIndex(clamped);
    },
    [slideCount]
  );

  const scrollRelative = useCallback(
    (direction: -1 | 1) => {
      scrollToIndex(activeIndex + direction);
    },
    [activeIndex, scrollToIndex]
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      scrollRelative(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      scrollRelative(-1);
    }
  };

  const showNavControls = slideCount > Math.floor(effectiveSlidesVisible);

  const navControls = showNavControls ? (
    <Box
      className="msqdx-glass-horizontal-card-slider__nav"
      role="group"
      aria-label={t("horizontalSlider.navigation")}
    >
      <MsqdxButton
        variant="outlined"
        size="small"
        onClick={() => scrollRelative(-1)}
        disabled={!canScrollBack}
        aria-label={t("horizontalSlider.previous")}
      >
        <MsqdxIcon name="chevron_left" customSize={18} />
      </MsqdxButton>
      <MsqdxButton
        variant="outlined"
        size="small"
        onClick={() => scrollRelative(1)}
        disabled={!canScrollForward}
        aria-label={t("horizontalSlider.next")}
      >
        <MsqdxIcon name="chevron_right" customSize={18} />
      </MsqdxButton>
    </Box>
  ) : null;

  const toolbarControls = toolbarStart ? (
    <Box
      className="msqdx-glass-horizontal-card-slider__toolbar"
      role="group"
      aria-label={t("chipEditor.sectionActions")}
    >
      {toolbarStart}
    </Box>
  ) : null;

  const hasToolbar = Boolean(toolbarStart);

  useLayoutEffect(() => {
    if (!cornerTabControls || !onCornerTabControls) return;

    const toolbar = hasToolbar ? (
      <Box
        className="msqdx-glass-horizontal-card-slider__toolbar"
        role="group"
        aria-label={t("chipEditor.sectionActions")}
      >
        {toolbarStart}
      </Box>
    ) : null;

    const nav = showNavControls ? (
      <Box
        className="msqdx-glass-horizontal-card-slider__nav"
        role="group"
        aria-label={t("horizontalSlider.navigation")}
      >
        <MsqdxButton
          variant="outlined"
          size="small"
          onClick={() => scrollRelative(-1)}
          disabled={!canScrollBack}
          aria-label={t("horizontalSlider.previous")}
        >
          <MsqdxIcon name="chevron_left" customSize={18} />
        </MsqdxButton>
        <MsqdxButton
          variant="outlined"
          size="small"
          onClick={() => scrollRelative(1)}
          disabled={!canScrollForward}
          aria-label={t("horizontalSlider.next")}
        >
          <MsqdxIcon name="chevron_right" customSize={18} />
        </MsqdxButton>
      </Box>
    ) : null;

    onCornerTabControls(
      toolbar || nav ? (
        <>
          {toolbar}
          {nav}
        </>
      ) : null
    );

    return () => {
      onCornerTabControls(null);
    };
  }, [
    cornerTabControls,
    onCornerTabControls,
    hasToolbar,
    toolbarStart,
    showNavControls,
    canScrollBack,
    canScrollForward,
  ]);

  const showInlineControlsEnd =
    !cornerTabControls && (Boolean(toolbarControls) || Boolean(navControls));
  const showControlsBar = Boolean(leading) || showInlineControlsEnd;

  return (
    <div
      className={className ? `msqdx-glass-horizontal-card-slider ${className}` : "msqdx-glass-horizontal-card-slider"}
      style={
        {
          "--slider-gap": gap,
          "--slides-visible": String(effectiveSlidesVisible),
          "--slider-gap-count": String(sliderGapCount),
        } as CSSProperties
      }
    >
      {showControlsBar ? (
        <Box className="msqdx-glass-horizontal-card-slider__controls">
          {leading ? (
            <Box className="msqdx-glass-horizontal-card-slider__leading">{leading}</Box>
          ) : null}
          {showInlineControlsEnd ? (
            <Box className="msqdx-glass-horizontal-card-slider__controls-end">
              {toolbarControls}
              {navControls}
            </Box>
          ) : null}
        </Box>
      ) : null}

      <div
        ref={viewportRef}
        className="msqdx-glass-horizontal-card-slider__viewport"
        tabIndex={0}
        aria-label={ariaLabel}
        onScroll={updateScrollState}
        onKeyDown={handleKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
