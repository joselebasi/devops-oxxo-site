# DevOps OXXO

Portal de repositorios IaC y variables Terraform con Astro Actions, React, Tailwind CSS y TypeScript estricto.

## Requisitos

- Node.js >= 22.22.0; se recomienda Node.js 24 LTS.
- pnpm 11.9.0, declarado en `packageManager`.
- Una sesion de usuario en Clerk para acceder al explorador y sus Actions.

## Despliegue en Netlify

El archivo [netlify.toml](netlify.toml) configura `pnpm build`, publica `dist/` y usa Node.js 22.22.0. Conecta el repositorio en Netlify y configura estas variables en Site configuration > Environment variables:

- `GH_TOKEN`
- `GITHUB_ENTERPRISE`
- `TERRAFORM_CLOUD_TOKEN`
- `PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

Usa claves de produccion de Clerk y agrega el dominio publicado a los dominios permitidos de esa instancia. Los tokens GitHub y Terraform Cloud son solo del servidor; no uses el prefijo `PUBLIC_` para ellos.

El middleware conserva la autenticacion Clerk y el acceso limitado a las organizaciones configuradas. Los usuarios autorizados comparten los permisos de los tokens GitHub y Terraform Cloud; revisa que ese modelo de acceso sea el esperado antes de publicar.

## Comandos

| Comando | Uso |
| --- | --- |
| `pnpm install --frozen-lockfile` | Instalar las dependencias del lockfile |
| `pnpm dev` | Iniciar el servidor de desarrollo |
| `pnpm check` | Comprobar Astro y TypeScript |
| `pnpm test` | Probar conversion HCL, formatos, paginacion y autorizacion con datos sinteticos |
| `pnpm build` | Ejecutar los chequeos y generar el sitio en `dist/` |
| `pnpm preview` | Previsualizar la compilacion local |

## Estructura

- [src/pages/index.astro](src/pages/index.astro): pagina inicial renderizada por Astro.
- [src/layouts/Layout.astro](src/layouts/Layout.astro): documento HTML y carga de estilos globales.
- [src/components/InfrastructureExplorer.tsx](src/components/InfrastructureExplorer.tsx): combos encadenados para elegir el origen como isla `client:load`.
- [src/components/VariableEditor.tsx](src/components/VariableEditor.tsx): formulario de variables, descargas, destino y confirmacion de creacion.
- [src/actions/index.ts](src/actions/index.ts): Actions validadas para consultar GitHub y crear variables en Terraform Cloud.
- [src/lib/server/github.ts](src/lib/server/github.ts): consultas REST y GraphQL paginadas por HTTPS, con timeout y errores sanitizados.
- [src/lib/server/terraform.ts](src/lib/server/terraform.ts): extraccion estructurada con `hcl2-parser`.
- [src/lib/server/terraform-cloud.ts](src/lib/server/terraform-cloud.ts): consultas paginadas de destinos, permisos y creacion individual de variables.
- [src/styles/global.css](src/styles/global.css): Tailwind v4 y estilos base.
- [.github/FRONTEND-COPILOT.md](.github/FRONTEND-COPILOT.md): agentes, skills e instrucciones existentes, conservados sin cambios.

## Configuracion Privada

Completa `.env` directamente en tu editor, sin compartir los tokens en el chat:

```dotenv
GH_TOKEN=
GITHUB_ENTERPRISE=oxxogh
TERRAFORM_CLOUD_TOKEN=
```

`.env` esta ignorado por Git. [.env.example](.env.example) solo contiene nombres y valores vacios. Reinicia Astro despues de completar los tokens. No uses prefijos `PUBLIC_` para secretos.

El token de GitHub debe permitir consultar las organizaciones del enterprise y leer sus repositorios y contenidos. En un PAT clasico esto normalmente requiere `read:enterprise`, `read:org` y `repo` para repositorios privados, sujeto a las politicas de la empresa y autorizacion SAML SSO. La consulta GraphQL del enterprise puede no estar disponible para tokens de grano fino o cuentas sin los permisos necesarios. Solo se muestran recursos accesibles para el token; no se puede enumerar contenido al que no tiene acceso. `oxxogh` se interpreta como slug de GitHub Enterprise Cloud en github.com, no como una instancia GitHub Enterprise Server.

El servidor consulta GitHub por HTTPS con el token; no requiere GitHub CLI y nunca envia el token al navegador. `TERRAFORM_CLOUD_TOKEN` se utiliza solo en el servidor para consultar https://app.terraform.io y crear variables. El token debe permitir listar los destinos y leer/escribir variables en el workspace seleccionado. La organizacion de GitHub y la de Terraform Cloud son independientes.

## Autenticacion Clerk

Se integra `@clerk/astro` 4 con la aplicacion existente **OXXO DevHub** (`app_3L0NyubeIZcAsOGltSvW60Zmcd1`). No se crea una aplicacion accountless ni se reemplazan las claves que ya funcionan.

- [src/middleware.ts](src/middleware.ts) conserva el bloqueo local y ejecuta `clerkMiddleware()`. Las Actions reciben HTTP 401 sin sesion o HTTP 403 sin una organizacion activa autorizada, antes de consultar GitHub o Terraform Cloud. Se comprueban las invocaciones RPC y las de formularios HTML.
- [src/pages/index.astro](src/pages/index.astro) requiere sesion y redirige a `/sign-in` cuando no la hay. Sin organizacion activa autorizada no renderiza ni hidrata el explorador: muestra el contacto del administrador, `jose.toledano@axity.com`.
- [src/pages/sign-in.astro](src/pages/sign-in.astro) y [src/pages/sign-up.astro](src/pages/sign-up.astro) son publicas para iniciar sesion y registrarse. Las sesiones existentes vuelven a `/`.
- [src/layouts/Layout.astro](src/layouts/Layout.astro) muestra los controles de acceso/registro o el menu de usuario y `OrganizationSwitcher`. Seleccionar, crear o abandonar una organizacion vuelve a `/` para reevaluar los permisos en el servidor.
- [src/lib/organization-access.ts](src/lib/organization-access.ts) permite los IDs de las organizaciones existentes Lider de Infraestructura y DevOps. Crear otra organizacion no concede acceso al explorador. Los IDs son propios de la instancia actual; deben revisarse al configurar produccion.
- Las rutas y redirecciones locales estan configuradas en [astro.config.mjs](astro.config.mjs), sin depender de agregar manualmente mas variables al archivo privado.

Las claves de desarrollo requeridas son `PUBLIC_CLERK_PUBLISHABLE_KEY` y `CLERK_SECRET_KEY`. Solo la primera es publica. No compartas ni agregues la segunda al codigo cliente. Las claves se administran con Clerk CLI; no vuelvas a ejecutar `init` en este proyecto ya integrado. Usa `npx -y clerk@latest doctor` para diagnosticarlo. Para restaurar claves faltantes de esta misma aplicacion se utiliza `npx -y clerk@latest env pull`, sin reemplazar claves validas.

Se instalaron globalmente para GitHub Copilot las skills oficiales `clerk`, `clerk-setup`, `clerk-cli`, `clerk-astro-patterns` y `clerk-testing`.

La instancia de desarrollo mantiene Organizations habilitado y `force_organization_selection: false` (membresia opcional durante el inicio de sesion). Asi Clerk no obliga a crear una organizacion en el paso "Setup your organization". Esto permite completar el acceso, pero no autoriza el explorador. Las sesiones que estaban pendientes pueden necesitar cerrar sesion e iniciar de nuevo.

Un administrador debe asignar membresia en Lider de Infraestructura o DevOps y el usuario debe seleccionar esa organizacion en el encabezado. Antes de ello solo aparece el mensaje de asignacion pendiente. El selector conserva las operaciones de gestion e invitacion que Clerk autorice segun el rol. No se crean organizaciones ni se asignan membresias automaticamente.

Ambas organizaciones habilitan el mismo explorador; sus IDs no son organizaciones GitHub ni workspaces Terraform. Los permisos de los tokens compartidos de GitHub y Terraform Cloud no se separan por miembro. Se mantiene la restriccion de acceso local. Antes de publicar deben definirse roles y permisos por operacion, politica de registro y configuracion de produccion. No se habilita SSO automaticamente.

## Flujo

1. Consultar las organizaciones del enterprise.
2. Elegir una organizacion para listar todos sus repositorios accesibles y filtrar nombres que contengan `iac`, `infra` o `tf`, sin distinguir mayusculas.
3. Elegir repositorio y rama. Se consulta cada pagina de resultados de GitHub.
4. Elegir uno de los archivos existentes en estas rutas exactas, respetando el nombre `Infraestructure` y las mayusculas:

```text
Infraestructure/Provisioning/Develop/variables.tf
Infraestructure/Provisioning/Staging/variables.tf
Infraestructure/Provisioning/Production/variables.tf
```

5. Capturar los valores en el formulario. Cada variable permite editar clave, valor, descripcion, categoria, HCL y sensibilidad, o excluirla del envio. No se muestra el codigo del archivo. Se muestra el SHA de la lectura para identificar su origen.
6. Consultar el destino literal del `providers.tf` que esta junto al archivo de variables, en el mismo commit. Se permite cambiar el destino manualmente, con una advertencia si difiere del archivo. No se infiere un workspace a partir del nombre de la rama. Al seleccionar el workspace se muestra un enlace a sus variables en HCP Terraform (`https://app.terraform.io/app/<organizacion>/workspaces/<workspace>/variables`).
7. En Solo en archivo y En workspace, las variables comienzan desmarcadas y muestran solo el nombre y la casilla. Marcar una despliega sus datos; desmarcarla oculta el formulario sin borrar lo capturado. Cambiar el destino vuelve a desmarcarlas. Las variables existentes comienzan en Conservar; marcarlas selecciona Actualizar y muestra tambien la accion Eliminar. Elegir Conservar vuelve a desmarcar y cerrar la fila. La casilla Seleccionar todas las variables incluye las filas disponibles de la pestana activa, incluso las ocultas por la busqueda; las existentes en Conservar pasan a Actualizar. No se vuelven a seleccionar filas ya procesadas.
8. Revisar el resumen y confirmar explicitamente el destino y los cambios. Eliminar requiere una confirmacion adicional. Las respuestas de escritura muestran el resultado individual y nunca devuelven los valores enviados.

Los valores predeterminados del repositorio no se devuelven ni se muestran, incluso en variables sensibles. Se conservan las descripciones y `sensitive = true`; sin esa marca se utiliza `false`. Los valores existentes de Terraform Cloud se muestran y precargan solo cuando no son sensibles. El servidor excluye el campo value de las variables sensibles; para actualizarlas hay que capturar un valor nuevo. Las variables nuevas empiezan vacias. HCL invalido, definiciones duplicadas y metadatos no literales producen un error. El limite de lectura es 1 MiB.

La [API de variables de Terraform Cloud](https://developer.hashicorp.com/terraform/cloud-docs/api-docs/workspace-variables) recibe un `POST /workspaces/:workspace_id/vars` por variable, con `data.type: "vars"` y los seis campos en `data.attributes`. `value` es el texto capturado, no `null`. Para listas u objetos se debe capturar una expresion HCL y marcar HCL; esta opcion no aplica a la categoria de entorno. Los valores vacios se rechazan para evitar creaciones accidentales. El lote permite hasta 100 variables y 1 MiB en UTF-8.

Las descargas YAML/JSON se conservan sin previsualizacion de codigo. Incluyen las variables seleccionadas y las procesadas, con los valores del formulario. Los valores sensibles se omiten por defecto; incluirlos requiere activar una casilla explicita. No se guardan valores en localStorage. Tras un resultado creado/existente se limpia el valor sensible en memoria y se bloquea esa fila para evitar reenviarla.

Antes de escribir se valida que el workspace pertenece a la organizacion seleccionada y que el token tiene lectura y escritura de variables. Crear no sobrescribe una clave existente: hay que elegir Actualizar para enviar PATCH, o Eliminar para enviar DELETE. Se comprueban el ID, identidad y version conocida de la variable antes de modificarla. Conservar no genera escrituras. No se crean workspaces ni se ejecutan planes o applies.

La API no es transaccional para lotes: ante un error se conservan los resultados previos y no se envian las variables restantes. Un fallo de red tras un POST se marca como resultado no confirmado. Antes de reintentar debe revisarse el workspace; cada nuevo intento consulta otra vez las claves existentes. La misma solicitud se deduplica durante 30 minutos en memoria y solo se permite una creacion simultanea por token/workspace en este proceso. Estos controles no son un registro distribuido persistente.

## Validacion Manual

Se uso `xpos-evolucion/Oxxo.Cloud.Tf.QRPayment`, rama `hotfix-PTI26012-QR-payment`, archivo `Infraestructure/Provisioning/Staging/variables.tf`: se leyeron 22 variables reales y el destino `QRPayment-QA` de su providers.tf. Se verificaron la precarga de los valores no sensibles y la seleccion global con y sin busqueda. Las pruebas de escritura usan respuestas simuladas; no modifican destinos reales.

## Ejecucion y Seguridad

Astro utiliza renderizado de servidor y el adaptador Netlify para ejecutar las Actions en funciones serverless. En desarrollo local usa `pnpm dev`. Netlify carga los secretos desde las variables de entorno configuradas en el sitio; no publiques `.env`.

El explorador y sus Actions requieren sesion Clerk y una organizacion permitida. Las respuestas usan `Cache-Control: no-store`. El control de concurrencia e idempotencia de escrituras se mantiene en memoria del proceso; las funciones serverless no comparten esa memoria, por lo que los cambios a Terraform deben seguir revisandose en el workspace antes de reintentar una solicitud cuyo resultado sea incierto. Las pruebas automatizadas usan datos sinteticos y no consultan GitHub ni Terraform Cloud.

## Compatibilidad

Se fijan versiones estables y se incluye `pnpm-lock.yaml` para instalaciones reproducibles. TypeScript 6 es compatible con el rango publicado por `@astrojs/check`; TypeScript 7 no lo es todavia. Se utiliza `@astrojs/react` 6.0.6 para evitar el conflicto entre los peers de `oxc-transform-react` publicados por la integracion 7.1.0 y su plugin React transitivo. La instalacion se verifica con `pnpm install --strict-peer-dependencies`.
