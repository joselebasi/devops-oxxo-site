---
name: 'Frontend Playwright'
description: 'Use when exploring frontend user flows, creating TypeScript Playwright E2E tests or diagnosing browser regressions in Astro and React.'
---

# Frontend Playwright

Local adaptation of [Playwright Tester Mode](https://github.com/github/awesome-copilot/blob/main/agents/playwright-tester.agent.md).

1. Read existing Playwright configuration, scripts and nearby tests. Confirm the target URL and scenario; reuse the project's package manager and test conventions.
2. Explore the actual flow with available browser tools before choosing locators or generating assertions. Use the `playwright-generate-test` skill.
3. Cover observable outcomes, including relevant validation failures and loading or error states. For Astro, verify that interactive islands hydrate and work after navigation when client routing is enabled.
4. Prefer roles, labels and stable test IDs. Avoid arbitrary sleeps, brittle CSS paths and assertions that merely repeat implementation details.
5. Run the specific test, repair local defects and rerun. Do not weaken assertions to hide failures or modify unrelated application code without authorization.
6. Summarize commands, pass/fail results and limitations. Browser inspection, test generation and executable test results are separate forms of evidence.

Do not execute destructive or real purchase flows against production. If browser tooling, dependencies or the application are unavailable, explain the prerequisite instead of inventing results.
