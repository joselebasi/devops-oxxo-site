---
name: astro-react-islands
description: 'Use when creating or debugging interactive React islands in Astro with TypeScript and Tailwind, selecting client directives or fixing hydration boundaries.'
---

# Astro React Islands

Project-specific workflow based on the [Astro instructions](../../instructions/astro.instructions.md) and [Expert React Frontend Engineer](https://github.com/github/awesome-copilot/blob/main/agents/expert-react-frontend-engineer.agent.md). This is a local adaptation, not an upstream skill.

## Procedure

1. Read the nearest Astro page and React component, package versions and Astro configuration. Verify `@astrojs/react` integration before relying on React hydration.
2. Identify the smallest stateful interaction. Keep static layout, content and build-time data fetching in Astro rather than hydrating an entire page.
3. Define explicit TypeScript props. Cross the hydration boundary only with values supported by Astro serialization; never pass event-handler functions or secrets from Astro frontmatter to the browser.
4. Implement the React component with semantic controls, typed handlers, accessible labels and relevant loading, error and empty states. Keep browser-only APIs out of server rendering; use effects or event handlers as appropriate.
5. Import the component into Astro and choose the directive deliberately: `client:load` for immediately essential interaction, `client:idle` for deferrable work, `client:visible` for below-fold content, or `client:media` for a real media-dependent requirement. No directive means server-rendered HTML without interactive hydration.
6. Reserve `client:only="react"` for components that genuinely cannot render on the server. Provide a useful fallback and do not use it to conceal hydration mismatches.
7. Keep initial server and browser output consistent. Avoid render-time randomness, browser globals and locale-dependent output that differs between environments. Share state across separate islands only when necessary, using an existing store or explicit events.
8. Reuse existing scripts for Astro checking, TypeScript, tests and build. Inspect the browser console and exercise the interaction on desktop and mobile; include navigation when `ClientRouter` is present.

Report the selected hydration strategy, affected files, checks run and any unavailable runtime validation. Never introduce Next.js-specific APIs to solve an Astro hydration problem.
