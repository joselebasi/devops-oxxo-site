---
description: 'Type-safe React components and shared TypeScript for Astro islands, respecting installed versions and server-client boundaries.'
applyTo: '**/*.ts, **/*.tsx, **/*.mts, **/*.cts'
---

# TypeScript and React

Local guidance adapted from [Expert React Frontend Engineer](https://github.com/github/awesome-copilot/blob/main/agents/expert-react-frontend-engineer.agent.md), complementing the Astro instructions.

- Follow the project's TypeScript configuration and installed React version. Prefer Astro's strict presets when setting up a new project; do not rewrite existing configuration for unrelated tasks.
- Type public component props, events and shared data contracts. Prefer `unknown` with narrowing over `any`; use discriminated unions for mutually exclusive states and `import type` for type-only imports.
- Treat external JSON, form fields, URL parameters and storage as untrusted. Type assertions do not validate runtime data; reuse existing schema validation at trust boundaries.
- Use functional React components and hooks with valid dependencies. Clean up subscriptions, timers and relevant asynchronous effects. Do not use effects to compute values that can be derived during rendering.
- Model loading, error, empty and success states when applicable. Preserve user input on failed submissions and prevent unintended duplicate submissions.
- Keep server-only modules and private environment variables out of browser imports and serialized props. Perform authoritative validation and authorization on the server.
- Astro owns routing and server rendering. Ordinary React islands do not need Next.js directives, Next.js APIs or React Server Components.
- Access browser APIs in effects or handlers when server rendering is possible. Keep initial markup deterministic to prevent hydration mismatches.
- Use stable keys and accessible native controls. Keep state local; introduce shared state only for a demonstrated cross-component requirement.
- Use newer APIs only when supported by installed dependencies. Do not assume React Compiler is configured or add `useMemo` and `useCallback` without a concrete need.
- Run existing type, Astro and focused behavioral checks. Never suppress errors with `@ts-ignore`, broad assertions or weakened configuration to make a check pass.
