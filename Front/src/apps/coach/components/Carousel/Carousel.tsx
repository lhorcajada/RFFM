import React, { useEffect, useRef, useState } from "react";
import { IconButton } from "@mui/material";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import styles from "./Carousel.module.css";

/**
 * Minimum horizontal swipe distance (px) before a touch gesture is treated
 * as "advance/go back" rather than an incidental tap/drag.
 */
const SWIPE_THRESHOLD_PX = 40;

/** How long (ms) auto-advance stays paused after the last manual interaction. */
const RESUME_AFTER_INACTIVITY_MS = 6000;

interface CarouselProps {
  children: React.ReactNode[];
  ariaLabel: string;
  /** When set, the carousel advances automatically every N ms. Omit for manual-only. */
  autoAdvanceMs?: number;
  className?: string;
}

function usePrefersReducedMotion(): boolean {
  const [prefersReduced] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    try {
      return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      return false;
    }
  });
  return prefersReduced;
}

export default function Carousel({ children, ariaLabel, autoAdvanceMs, className }: CarouselProps) {
  const slides = React.Children.toArray(children);
  const count = slides.length;
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const resumeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartXRef = useRef<number | null>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const goTo = (index: number) => {
    if (count === 0) return;
    const wrapped = ((index % count) + count) % count;
    setActiveIndex(wrapped);
  };

  const next = () => goTo(activeIndex + 1);
  const prev = () => goTo(activeIndex - 1);

  /** Marks a manual interaction: pauses auto-advance and (re)schedules its resume. */
  const registerInteraction = () => {
    if (!autoAdvanceMs) return;
    setPaused(true);
    if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    resumeTimeoutRef.current = setTimeout(() => {
      setPaused(false);
    }, RESUME_AFTER_INACTIVITY_MS);
  };

  useEffect(() => {
    return () => {
      if (resumeTimeoutRef.current) clearTimeout(resumeTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!autoAdvanceMs || paused || prefersReducedMotion || count <= 1) return;
    const id = setInterval(() => {
      setActiveIndex((current) => ((current + 1) % count + count) % count);
    }, autoAdvanceMs);
    return () => clearInterval(id);
  }, [autoAdvanceMs, paused, prefersReducedMotion, count]);

  const handlePrevClick = () => {
    registerInteraction();
    prev();
  };

  const handleNextClick = () => {
    registerInteraction();
    next();
  };

  const handleDotClick = (index: number) => {
    registerInteraction();
    goTo(index);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0]?.clientX ?? null;
  };

  const handleTouchMove = () => {
    // Prevent scroll-jank surprises; actual navigation decided on touchend.
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX == null) return;
    const endX = e.changedTouches[0]?.clientX ?? startX;
    const delta = endX - startX;
    if (Math.abs(delta) < SWIPE_THRESHOLD_PX) return;
    registerInteraction();
    if (delta < 0) next();
    else prev();
  };

  return (
    <div className={`${styles.root} ${className ?? ""}`.trim()} role="group" aria-label={ariaLabel}>
      <div className={styles.viewport}>
        <div
          className={styles.track}
          data-testid="carousel-track"
          style={{
            transform: `translateX(-${activeIndex * 100}%)`,
            transition: prefersReducedMotion ? "none" : undefined,
          }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          {slides.map((slide, index) => (
            <div className={styles.slide} key={index} aria-hidden={index !== activeIndex}>
              {slide}
            </div>
          ))}
        </div>
      </div>

      {count > 1 && (
        <>
          <IconButton
            className={`${styles.arrow} ${styles.arrowPrev}`}
            size="small"
            aria-label="Anterior"
            onClick={handlePrevClick}
          >
            <ChevronLeftIcon />
          </IconButton>
          <IconButton
            className={`${styles.arrow} ${styles.arrowNext}`}
            size="small"
            aria-label="Siguiente"
            onClick={handleNextClick}
          >
            <ChevronRightIcon />
          </IconButton>

          <div className={styles.dots}>
            {slides.map((_, index) => (
              <button
                key={index}
                type="button"
                className={`${styles.dot} ${index === activeIndex ? styles.dotActive : ""}`}
                aria-label={`Ir a la diapositiva ${index + 1}`}
                aria-current={index === activeIndex ? "true" : undefined}
                onClick={() => handleDotClick(index)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
