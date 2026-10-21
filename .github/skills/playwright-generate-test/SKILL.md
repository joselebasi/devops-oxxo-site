---
name: playwright-generate-test
description: 'Use when generating TypeScript Playwright E2E tests from a user scenario after exploring the actual Astro or React application in a browser.'
---

# Playwright Test Generation

Local adaptation of [playwright-generate-test](https://github.com/github/awesome-copilot/tree/main/skills/playwright-generate-test).

## Procedure

1. Obtain a concrete scenario and expected outcome. Read existing test configuration, package scripts and neighboring tests before adding files.
2. Confirm the application URL. Use available browser automation, such as Playwright MCP, to perform the scenario step by step and inspect the actual accessible names, navigation and state changes.
3. Do not generate a purportedly browser-verified test before exploring the flow. If browser tools or a running app are unavailable, explain the blocker and distinguish any explicitly requested draft from a verified test.
4. Write a focused TypeScript test using the existing `@playwright/test` setup and configured test directory. Prefer `getByRole`, `getByLabel` and established test IDs, auto-waiting assertions and isolated test data.
5. Assert user-visible results rather than internal state. Cover relevant validation failures; ensure Astro islands are usable after hydration and client-side navigation when enabled.
6. Run only the new or changed test first using the project's runner. Diagnose failures and rerun after scoped fixes. Never add fixed sleeps or weaken assertions just to obtain a pass.
7. Report the scenario covered, test location, executed command and result. State missing dependencies or runtime checks explicitly. Ask before introducing an entirely new testing stack.

Use local or designated test environments for state-changing scenarios; never submit real transactions or expose credentials in tests, screenshots or logs.
