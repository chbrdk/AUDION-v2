"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  gapCountForSlidesVisible,
  resolveSlidesVisibleForContainerWidth,
} from "./horizontal-card-slider-layout";

export function useHorizontalCardSlider(slidesVisible: number, slideCount: number) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);

  const effectiveSlidesVisible = resolveSlidesVisibleForContainerWidth(
    slidesVisible,
    containerWidth
  );

  const updateScrollState = useCallback(() => {
    const container = viewportRef.current;
    if (!container) return;

    setCanScrollBack(container.scrollLeft > 4);
    setCanScrollForward(container.scrollLeft < container.scrollWidth - container.clientWidth - 4);

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

  return {
    viewportRef,
    updateScrollState,
    handleKeyDown,
    scrollRelative,
    canScrollBack,
    canScrollForward,
    showNavControls,
    effectiveSlidesVisible,
    sliderGapCount: gapCountForSlidesVisible(effectiveSlidesVisible),
  };
}
