---
description: 'Tailwind CSS practices for Astro and React, with version-aware v4 Vite integration and responsive accessible styling.'
applyTo: '**/*.astro, **/*.css, **/*.tsx, **/*.jsx, astro.config.*, tailwind.config.*'
---

# Tailwind in Astro

Adapted from [tailwind-v4-vite.instructions.md](https://github.com/github/awesome-copilot/blob/main/instructions/tailwind-v4-vite.instructions.md) for Astro's Vite configuration.

- Detect the installed Tailwind major version first. Preserve working v3 configuration; a styling task does not authorize a v4 migration.
- For Tailwind v4, prefer `tailwindcss` and `@tailwindcss/vite`. Register `tailwindcss()` under `vite.plugins` in the existing Astro configuration, preserving integrations and other options. Do not create a separate Vite app or replace `@astrojs/react` with `@vitejs/plugin-react`.
- Import `@import "tailwindcss";` in the project's global stylesheet and load it from the shared Astro layout. Do not add v3 `@tailwind` directives or the legacy `@astrojs/tailwind` integration to a new v4 setup.
- Use CSS-first `@theme` tokens for v4 when customization is needed. Reuse existing tokens and do not create JavaScript configuration or duplicate PostCSS processing without a specific compatibility requirement.
- Keep class names statically discoverable: map variants to complete class strings instead of constructing fragments such as `bg-${color}-500`. For runtime values, use validated CSS custom properties. Use v4 `@source` only where automatic detection needs help.
- Use `class` or `class:list` in Astro and `className` in React. Prefer existing component variant utilities over adding dependencies for trivial conditionals.
- Build mobile-first layouts; verify long content, 320px reflow, focus-visible states, sufficient contrast and reduced-motion behavior. Do not remove outlines without an accessible replacement.
- Use scoped Astro CSS for styles that are clearer outside utilities. Keep global selectors intentional and avoid competing styling systems.
- Verify an affected page in the browser and run available build/check scripts. Configuration changes must not silently remove existing plugins or integrations.
