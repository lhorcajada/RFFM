import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

export type RatingView = "capacity" | "traits" | "order";

export const RATING_VIEW_PARAM = "view";

export function parseRatingView(value: string | null): RatingView {
  return value === "traits" || value === "order" ? value : "capacity";
}

/** Vista activa de /coach/squad/rating-sheet, guardada en la query string junto a teamId y seasonId. */
export function useRatingView(): [RatingView, (next: RatingView) => void] {
  const [searchParams, setSearchParams] = useSearchParams();
  const view = parseRatingView(searchParams.get(RATING_VIEW_PARAM));

  const setView = useCallback(
    (next: RatingView) => {
      const params = new URLSearchParams(searchParams);
      if (next === "capacity") params.delete(RATING_VIEW_PARAM);
      else params.set(RATING_VIEW_PARAM, next);
      setSearchParams(params);
    },
    [searchParams, setSearchParams],
  );

  return [view, setView];
}

/** Query string para volver a la plantilla (pestaña de valoraciones) sin arrastrar la vista. */
export function squadSearchFrom(searchParams: URLSearchParams): string {
  const params = new URLSearchParams(searchParams);
  params.delete(RATING_VIEW_PARAM);
  params.set("tab", "1");
  return `?${params.toString()}`;
}
