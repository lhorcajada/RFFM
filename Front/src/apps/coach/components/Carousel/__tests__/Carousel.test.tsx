import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import Carousel from "../Carousel";

function renderCarousel(props: Partial<React.ComponentProps<typeof Carousel>> = {}) {
  return render(
    <Carousel ariaLabel="Test carousel" {...props}>
      <div>Slide 1</div>
      <div>Slide 2</div>
      <div>Slide 3</div>
    </Carousel>
  );
}

describe("Carousel", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders all slides with the first one active", () => {
    renderCarousel();
    expect(screen.getByText("Slide 1")).toBeInTheDocument();
    expect(screen.getByText("Slide 2")).toBeInTheDocument();
    expect(screen.getByText("Slide 3")).toBeInTheDocument();
    const dots = screen.getAllByRole("button", { name: /ir a la diapositiva/i });
    expect(dots[0]).toHaveAttribute("aria-current", "true");
  });

  it("clicking the next arrow advances to the next slide", () => {
    renderCarousel();
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    const dots = screen.getAllByRole("button", { name: /ir a la diapositiva/i });
    expect(dots[1]).toHaveAttribute("aria-current", "true");
  });

  it("clicking the previous arrow from the first slide wraps to the last", () => {
    renderCarousel();
    fireEvent.click(screen.getByRole("button", { name: /anterior/i }));
    const dots = screen.getAllByRole("button", { name: /ir a la diapositiva/i });
    expect(dots[2]).toHaveAttribute("aria-current", "true");
  });

  it("clicking a dot navigates directly to that slide", () => {
    renderCarousel();
    const dots = screen.getAllByRole("button", { name: /ir a la diapositiva/i });
    fireEvent.click(dots[2]);
    expect(dots[2]).toHaveAttribute("aria-current", "true");
  });

  it("swiping left (touch) advances to the next slide", () => {
    renderCarousel();
    const track = screen.getByTestId("carousel-track");
    fireEvent.touchStart(track, { touches: [{ clientX: 200 }] });
    fireEvent.touchMove(track, { touches: [{ clientX: 100 }] });
    fireEvent.touchEnd(track, { changedTouches: [{ clientX: 100 }] });
    const dots = screen.getAllByRole("button", { name: /ir a la diapositiva/i });
    expect(dots[1]).toHaveAttribute("aria-current", "true");
  });

  it("swiping right (touch) goes to the previous slide", () => {
    renderCarousel();
    const track = screen.getByTestId("carousel-track");
    fireEvent.touchStart(track, { touches: [{ clientX: 100 }] });
    fireEvent.touchMove(track, { touches: [{ clientX: 200 }] });
    fireEvent.touchEnd(track, { changedTouches: [{ clientX: 200 }] });
    const dots = screen.getAllByRole("button", { name: /ir a la diapositiva/i });
    expect(dots[2]).toHaveAttribute("aria-current", "true");
  });

  it("a short touch that doesn't cross the swipe threshold does not change slide", () => {
    renderCarousel();
    const track = screen.getByTestId("carousel-track");
    fireEvent.touchStart(track, { touches: [{ clientX: 200 }] });
    fireEvent.touchMove(track, { touches: [{ clientX: 190 }] });
    fireEvent.touchEnd(track, { changedTouches: [{ clientX: 190 }] });
    const dots = screen.getAllByRole("button", { name: /ir a la diapositiva/i });
    expect(dots[0]).toHaveAttribute("aria-current", "true");
  });

  it("without autoAdvanceMs, never advances automatically", () => {
    vi.useFakeTimers();
    renderCarousel();
    act(() => {
      vi.advanceTimersByTime(30000);
    });
    const dots = screen.getAllByRole("button", { name: /ir a la diapositiva/i });
    expect(dots[0]).toHaveAttribute("aria-current", "true");
  });

  it("with autoAdvanceMs, advances automatically after the interval", () => {
    vi.useFakeTimers();
    renderCarousel({ autoAdvanceMs: 5000 });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    const dots = screen.getAllByRole("button", { name: /ir a la diapositiva/i });
    expect(dots[1]).toHaveAttribute("aria-current", "true");
  });

  it("manual interaction pauses auto-advance, then it resumes after a period of inactivity", () => {
    vi.useFakeTimers();
    renderCarousel({ autoAdvanceMs: 5000 });

    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    let dots = screen.getAllByRole("button", { name: /ir a la diapositiva/i });
    expect(dots[1]).toHaveAttribute("aria-current", "true");

    // Auto-advance interval elapses once, but interaction should have paused it.
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    dots = screen.getAllByRole("button", { name: /ir a la diapositiva/i });
    expect(dots[1]).toHaveAttribute("aria-current", "true");

    // After the inactivity window passes, auto-advance resumes — advanced in two
    // steps so React has a chance to flush the effect that reinstalls the
    // interval once `paused` flips back to false (a fake-timers/React-effects
    // interaction quirk, not app behavior).
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    dots = screen.getAllByRole("button", { name: /ir a la diapositiva/i });
    expect(dots[1]).not.toHaveAttribute("aria-current", "true");
  });

  it("clears the auto-advance timer on unmount", () => {
    vi.useFakeTimers();
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const { unmount } = renderCarousel({ autoAdvanceMs: 5000 });
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
