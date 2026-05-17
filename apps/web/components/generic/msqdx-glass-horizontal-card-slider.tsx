"use client";

import {
  Children,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Box } from "@mui/material";
import { MsqdxButton, MsqdxIcon } from "@msqdx/react";
import { useI18n } from "../i18n/i18n-provider";

export type MsqdxGlassHorizontalCardSliderProps = {
  children: ReactNode;
  /** How many slides are visible at once (e.g. 3.5 shows a peek of the next). */
  slidesVisible?: number;
  gap?: string;
  ariaLabel: string;
  className?: string;
};

export function MsqdxGlassHorizontalCardSlider({
  children,
  slidesVisible = 3.5,
  gap = "1rem",
  ariaLabel,
  className,
}: MsqdxGlassHorizontalCardSliderProps) {
  const { t } = useI18n();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);

  const slideCount = Children.count(children);

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

  useEffect(() => {
    updateScrollState();
    const container = viewportRef.current;
    if (!container) return undefined;

    const observer = new ResizeObserver(() => updateScrollState());
    observer.observe(container);
    return () => observer.disconnect();
  }, [slideCount, updateScrollState]);

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

  const showControls = slideCount > Math.floor(slidesVisible);

  return (
    <div
      className={className ? `msqdx-glass-horizontal-card-slider ${className}` : "msqdx-glass-horizontal-card-slider"}
      style={
        {
          "--slider-gap": gap,
          "--slides-visible": String(slidesVisible),
        } as CSSProperties
      }
    >
      {showControls ? (
        <Box
          className="msqdx-glass-horizontal-card-slider__controls"
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
