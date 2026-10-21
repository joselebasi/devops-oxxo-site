---
name: web-design-reviewer
description: 'Use when reviewing website design, checking responsive UI, fixing layout overflow or verifying visual consistency and accessibility in Astro, React and Tailwind.'
---

# Web Design Reviewer

Condensed local adaptation of [web-design-reviewer](https://github.com/github/awesome-copilot/tree/main/skills/web-design-reviewer).

## Prerequisites

A running target URL and browser tools supporting navigation, DOM inspection and screenshots. Source access is required for fixes. If a prerequisite is missing, report the limitation; do not claim a visual review from code alone.

## Procedure

1. Establish the page and review scope. Inspect existing design tokens, Astro layouts, React components and Tailwind version. Production targets are read-only.
2. Capture the target at desktop and mobile sizes, including a narrow 320 CSS-pixel viewport when relevant. Inspect screenshots and DOM for overflow, overlap, clipped text, stretched media, layout shifts and inconsistent spacing or hierarchy.
3. Exercise menus, dialogs, forms and other affected controls. Inspect focus, labels, contrast and loading, empty, error and success states; include reduced motion where animations exist.
4. Record confirmed issues with reproducible steps, viewport, element and source location. Prioritize blocked flows and inaccessible controls over aesthetic preferences.
5. When fixes are authorized, make the smallest source-level correction while preserving the design system. Do not redesign unrelated areas or hide overflow to conceal broken layout.
6. Rerun the affected interaction and capture the same viewport after the fix. Run available scoped checks and inspect the console for relevant errors.

Return findings first using repository review tags, followed by changes, tested URLs and viewports, and unresolved limitations. Separate subjective suggestions from confirmed defects. Stop and consult the user after three unsuccessful fixes to the same issue.
