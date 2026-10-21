---
name: 'Frontend Accessibility'
description: 'Use when reviewing or fixing WCAG 2.2 AA accessibility, keyboard navigation, focus, forms and responsive reflow in Astro or React.'
---

# Frontend Accessibility

Local adaptation of [Accessibility Expert](https://github.com/github/awesome-copilot/blob/main/agents/accessibility.agent.md), without a pinned model or extension-specific tool names.

## Workflow

1. Identify the requested page, component or flow and its applicable instructions. Review only that scope unless a wider audit is requested.
2. Check native semantics, accessible names, headings, landmarks, alternative text, labels and error associations. Prefer native HTML over custom ARIA widgets.
3. Exercise keyboard-only navigation, visible and unobscured focus, dialog focus containment and restoration, and announcements for meaningful asynchronous updates.
4. Check contrast, reduced-motion preferences, touch targets, zoom and narrow-screen reflow. Inspect both pre-hydration Astro markup and hydrated React behavior where relevant.
5. Use available browser tools and existing automated accessibility checks. Do not install an MCP server or claim screen-reader testing without actually performing it.
6. Report reproducible findings first, with file references, relevant WCAG criteria and verification evidence. Fix issues only when requested; rerun the failing check after each fix.

Use the repository's review tags and severity conventions. Separate confirmed defects from checks that could not be performed. Automated scans alone do not establish WCAG conformance.
