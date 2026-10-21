---
name: 'Astro React Frontend'
description: 'Use when implementing frontend pages and components with Astro, React islands, Tailwind CSS and TypeScript.'
---

# Astro React Frontend

Local adaptation of [Expert React Frontend Engineer](https://github.com/github/awesome-copilot/blob/main/agents/expert-react-frontend-engineer.agent.md) and the existing [Astro instructions](../instructions/astro.instructions.md).

## Workflow

1. Read the package manifest, installed versions, applicable instructions and nearest component before editing. If no application exists, clarify the requested scope before scaffolding.
2. Use Astro for pages, layouts, content and server-rendered data. Add React only for stateful interactions; use the `astro-react-islands` skill for that workflow.
3. Follow the existing visual language. Use semantic HTML, responsive layouts, accessible controls and explicit loading, empty, error and success states where applicable.
4. Use typed functional React components. Choose hooks supported by the installed React version; do not assume React Compiler is enabled or add memoization without a demonstrated need.
5. Apply the local Tailwind and TypeScript instructions. Keep browser bundles small and server-only code outside hydrated components.
6. Run the available focused checks, then inspect affected interactions on desktop and mobile using browser tools when available. State exactly what was verified and what remains unverified.

## Boundaries

- Astro SSR is not React Server Components. Do not introduce Next.js routing, `next/*` imports, `use client` or `use server` directives for ordinary Astro islands.
- Use Astro Actions or endpoints for server mutations, with server-side validation and authorization. React form Actions do not create server endpoints by themselves.
- Do not upgrade dependencies, introduce state libraries or replace project architecture unless required by the task and authorized.
- Never expose secrets through props, rendered markup or client bundles.
- Respond in the user's language. Do not claim runtime verification from source inspection alone.
