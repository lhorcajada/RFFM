import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";
import { afterEach } from "vitest";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { __unsafe_useEmotionCache, type EmotionCache } from "@emotion/react";

// Under heavy parallel test load this environment's async state updates can take
// longer than Testing Library's 1000ms default, causing flaky `waitFor` timeouts
// unrelated to actual component behavior. Raise the default to match the raised
// vitest `testTimeout` (see vitest.config.ts).
configure({ asyncUtilTimeout: 10000 });

// Emotion never removes the <style> tags MUI injects, so they pile up across the tests
// of a file. jsdom's getComputedStyle (used by getByRole and user-event on every query
// and interaction) walks every CSS rule, so each test got slower than the previous one.
// Flushing the default cache after each test keeps only the current test's styles.
let emotionCache: EmotionCache | null = null;
renderToString(
  createElement(() => {
    emotionCache = __unsafe_useEmotionCache();
    return null;
  }),
);

afterEach(() => {
  if (!emotionCache) return;
  emotionCache.sheet.flush();
  emotionCache.inserted = {};
});
