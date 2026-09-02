import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";

// Under heavy parallel test load this environment's async state updates can take
// longer than Testing Library's 1000ms default, causing flaky `waitFor` timeouts
// unrelated to actual component behavior. Raise the default to match the raised
// vitest `testTimeout` (see vitest.config.ts).
configure({ asyncUtilTimeout: 10000 });
