# DevOps OXXO

Base de desarrollo con Astro, islas React, Tailwind CSS y TypeScript estricto.

## Requisitos

- Node.js >= 22.22.0; se recomienda Node.js 24 LTS.
- pnpm 11.9.0, declarado en `packageManager`.

## Comandos

| Comando | Uso |
| --- | --- |
| `pnpm install --frozen-lockfile` | Instalar las dependencias del lockfile |
| `pnpm dev` | Iniciar el servidor de desarrollo |
| `pnpm check` | Comprobar Astro y TypeScript |
| `pnpm build` | Ejecutar los chequeos y generar el sitio en `dist/` |
| `pnpm preview` | Previsualizar la compilacion local |

## Estructura

- [src/pages/index.astro](src/pages/index.astro): pagina inicial renderizada por Astro.
- [src/layouts/Layout.astro](src/layouts/Layout.astro): documento HTML y carga de estilos globales.
- [src/components/Counter.tsx](src/components/Counter.tsx): isla React con `client:load` desde la pagina; los botones permiten comprobar su hidratacion.
- [src/styles/global.css](src/styles/global.css): Tailwind v4 y estilos base.
- [.github/FRONTEND-COPILOT.md](.github/FRONTEND-COPILOT.md): agentes, skills e instrucciones existentes, conservados sin cambios.

Astro mantiene el contenido estatico; solo el contador se hidrata en el navegador. No se utiliza un adaptador SSR ni una API porque esta base genera un sitio estatico.

## Compatibilidad

Se fijan versiones estables y se incluye `pnpm-lock.yaml` para instalaciones reproducibles. TypeScript 6 es compatible con el rango publicado por `@astrojs/check`; TypeScript 7 no lo es todavia. Se utiliza `@astrojs/react` 6.0.6 para evitar el conflicto entre los peers de `oxc-transform-react` publicados por la integracion 7.1.0 y su plugin React transitivo. La instalacion se verifica con `pnpm install --strict-peer-dependencies`.
