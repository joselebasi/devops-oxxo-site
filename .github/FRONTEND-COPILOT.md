# Copilot para Astro, React, Tailwind y TypeScript

Seleccion local basada en [github/awesome-copilot](https://github.com/github/awesome-copilot). Los archivos nuevos son adaptaciones, no copias exactas ni un ranking oficial. Se conserva sin cambios la [instruccion de Astro](instructions/astro.instructions.md) que ya existia.

## Agentes

Selecciona el agente en el selector de Copilot Chat:

| Agente | Uso recomendado | Fuente |
| --- | --- | --- |
| [Astro React Frontend](agents/astro-react-frontend.agent.md) | Desarrollo diario con Astro e islas React tipadas | [Expert React Frontend Engineer](https://github.com/github/awesome-copilot/blob/main/agents/expert-react-frontend-engineer.agent.md) |
| [Frontend Accessibility](agents/frontend-accessibility.agent.md) | Teclado, foco, formularios y WCAG 2.2 AA | [Accessibility Expert](https://github.com/github/awesome-copilot/blob/main/agents/accessibility.agent.md) |
| [Frontend Playwright](agents/frontend-playwright.agent.md) | Flujos reales y pruebas E2E en TypeScript | [Playwright Tester](https://github.com/github/awesome-copilot/blob/main/agents/playwright-tester.agent.md) |

## Skills

Se descubren por su descripcion y pueden invocarse escribiendo `/` en el chat:

| Skill | Uso |
| --- | --- |
| [astro-react-islands](skills/astro-react-islands/SKILL.md) | Workflow local para limites servidor/cliente, directivas `client:*` e hidratacion |
| [web-design-reviewer](skills/web-design-reviewer/SKILL.md) | Revision visual y responsive; [fuente](https://github.com/github/awesome-copilot/tree/main/skills/web-design-reviewer) |
| [playwright-generate-test](skills/playwright-generate-test/SKILL.md) | Generacion de pruebas despues de explorar la aplicacion; [fuente](https://github.com/github/awesome-copilot/tree/main/skills/playwright-generate-test) |

## Instrucciones Automaticas

- [Astro](instructions/astro.instructions.md): arquitectura de islas y contenido. El original apunta a Astro 7; comprobar la version real antes de usar sus APIs.
- [Tailwind para Astro](instructions/tailwind-astro.instructions.md): distingue v3/v4 y registra el plugin v4 dentro de la configuracion de Astro.
- [TypeScript y React](instructions/typescript-react.instructions.md): tipos, hooks, validacion y limites servidor/cliente.

## Ejemplos

- Con `Astro React Frontend`: "Implementa un buscador como isla React con TypeScript y Tailwind; conserva el contenido estatico en Astro."
- `/astro-react-islands Revisa por que este componente no responde despues de navegar.`
- `/web-design-reviewer Revisa esta URL en movil y escritorio; informa problemas sin modificar archivos.`
- `/playwright-generate-test Comprueba que el buscador filtra resultados y muestra el estado vacio.`
- Con `Frontend Accessibility`: "Revisa el dialogo con teclado y verifica el retorno del foco."

## Alcance y Requisitos

Esta configuracion no instala Astro, React, Tailwind, Playwright ni servidores MCP. Las verificaciones visuales requieren una aplicacion en ejecucion y herramientas de navegador; ejecutar E2E requiere ademas las dependencias y navegadores de Playwright. No se fija un modelo ni se anuncian herramientas no disponibles.

No se incorporan instrucciones de Next.js para Tailwind: su routing y sus Server Components no corresponden a las islas normales de Astro. Los recursos generales de React se han limitado por la misma razon. Las skills Playwright pueden estar tambien disponibles mediante plugins personales; la variante local documenta las reglas especificas de este proyecto.
