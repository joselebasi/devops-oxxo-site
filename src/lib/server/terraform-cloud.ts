import { createHash } from 'node:crypto';
import { z } from 'astro/zod';
import type { ExistingVariable, TerraformWorkspace, VariableCreationResult, WorkspaceSnapshot } from '../contracts.ts';
import { variablePayload } from '../variable-format.ts';

const nameSchema = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/);
export const terraformOrganizationSchema = nameSchema;
const workspaceIdSchema = z.string().regex(/^ws-[a-zA-Z0-9]+$/);
const variableSchema = z.object({
  key: z.string().min(1).max(128).regex(/^[a-zA-Z_][a-zA-Z0-9_-]*$/),
  value: z.string().min(1).max(262144),
  category: z.enum(['terraform', 'env']),
  hcl: z.boolean(),
  sensitive: z.boolean(),
  description: z.string().max(2048),
}).strict().refine((variable) => variable.category !== 'env' || !variable.hcl, { message: 'HCL solo aplica a variables Terraform.' });

export const createVariablesSchema = z.object({
  organization: nameSchema,
  workspaceId: workspaceIdSchema,
  requestId: z.uuid(),
  confirmed: z.literal(true),
  variables: z.array(variableSchema).min(1).max(100),
}).strict().superRefine(({ variables }, context) => {
  const keys = variables.map((variable) => `${variable.category}:${variable.key}`);
  if (new Set(keys).size !== keys.length) context.addIssue({ code: 'custom', message: 'Hay claves duplicadas en la misma categoria.' });
  if (Buffer.byteLength(JSON.stringify(variables), 'utf8') > 1024 * 1024) context.addIssue({ code: 'custom', message: 'El lote supera 1 MiB.' });
});

export const workspaceVariablesSchema = z.object({ organization: nameSchema, workspaceId: workspaceIdSchema });
export const resolveWorkspaceSchema = z.object({ organization: nameSchema, workspaceName: nameSchema });
const existingTarget = { id: z.string().regex(/^var-[a-zA-Z0-9]+$/), expectedVersion: z.string().min(1).nullable() };
export const manageVariablesSchema = z.object({
  organization: nameSchema,
  workspaceId: workspaceIdSchema,
  requestId: z.uuid(),
  confirmed: z.literal(true),
  operations: z.array(z.discriminatedUnion('action', [
    z.object({ action: z.literal('create'), variable: variableSchema }).strict(),
    z.object({ action: z.literal('update'), ...existingTarget, variable: variableSchema }).strict(),
    z.object({ action: z.literal('delete'), ...existingTarget, variable: z.object({ key: z.string().min(1).max(128), category: z.enum(['terraform', 'env']) }).strict() }).strict(),
  ])).min(1).max(100),
}).strict().superRefine(({ operations }, context) => {
  const keys = operations.map((operation) => `${operation.variable.category}:${operation.variable.key}`);
  const ids = operations.flatMap((operation) => operation.action === 'create' ? [] : [operation.id]);
  if (new Set(keys).size !== keys.length || new Set(ids).size !== ids.length) context.addIssue({ code: 'custom', message: 'Hay operaciones duplicadas para la misma variable.' });
  if (Buffer.byteLength(JSON.stringify(operations), 'utf8') > 1024 * 1024) context.addIssue({ code: 'custom', message: 'El lote supera 1 MiB.' });
});

export class TerraformCloudError extends Error {
  readonly code: 'BAD_REQUEST' | 'FORBIDDEN' | 'NOT_FOUND' | 'CONFLICT' | 'TOO_MANY_REQUESTS' | 'BAD_GATEWAY';
  readonly uncertain: boolean;

  constructor(code: TerraformCloudError['code'], message: string, uncertain = false) {
    super(message);
    this.code = code;
    this.uncertain = uncertain;
  }
}

const workspaceSchema = z.object({
  id: workspaceIdSchema,
  attributes: z.object({ name: z.string(), permissions: z.object({
    'can-read-variable': z.boolean(), 'can-update-variable': z.boolean(),
  }) }),
  relationships: z.object({ organization: z.object({ data: z.object({ id: z.string() }) }) }),
});

const existingVariableSchema = z.object({
  id: z.string().regex(/^var-[a-zA-Z0-9]+$/),
  attributes: z.object({
    key: z.string(), category: z.enum(['terraform', 'env']), hcl: z.boolean(), sensitive: z.boolean(),
    value: z.string().nullable().optional(),
    description: z.string().nullable().optional(), 'version-id': z.string().nullable().optional(),
  }),
});

function variableMetadata(variable: z.infer<typeof existingVariableSchema>): ExistingVariable {
  return { id: variable.id, key: variable.attributes.key, category: variable.attributes.category,
    hcl: variable.attributes.hcl, sensitive: variable.attributes.sensitive,
    description: variable.attributes.description ?? '', versionId: variable.attributes['version-id'] ?? null,
    ...(!variable.attributes.sensitive ? { value: variable.attributes.value ?? '' } : {}) };
}

const submissions = new Map<string, { fingerprint: string; promise: Promise<VariableCreationResult[]>; expires: number }>();
const workspaceLocks = new Set<string>();
type Fetcher = typeof fetch;

export function createTerraformCloudClient(token: string, fetcher: Fetcher = fetch) {
  const scope = createHash('sha256').update(token).digest('hex');

  async function request(path: string, body?: unknown, method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = body === undefined ? 'GET' : 'POST'): Promise<unknown> {
    const mutation = method !== 'GET';
    let response: Response;
    try {
      response = await fetcher(`https://app.terraform.io/api/v2/${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.api+json', 'Content-Type': 'application/vnd.api+json' },
        body: mutation ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20_000),
        redirect: 'error',
        cache: 'no-store',
      });
    } catch {
      throw new TerraformCloudError('BAD_GATEWAY', mutation
        ? 'Conexion interrumpida. El resultado de la operacion no esta confirmado; verifica el workspace antes de reintentar.'
        : 'No se pudo consultar Terraform Cloud. Revisa la conexion y vuelve a intentar.', mutation);
    }
    if (!response.ok) {
      await response.body?.cancel();
      if (response.status === 401 || response.status === 403) throw new TerraformCloudError('FORBIDDEN', 'El token de Terraform Cloud no tiene permisos para esta operacion.');
      if (response.status === 404) throw new TerraformCloudError('NOT_FOUND', 'El recurso de Terraform Cloud no existe o no es accesible.');
      if (response.status === 429) throw new TerraformCloudError('TOO_MANY_REQUESTS', 'Terraform Cloud alcanzo su limite de API. Espera antes de reintentar.');
      if (response.status === 422 || response.status === 409) throw new TerraformCloudError('BAD_REQUEST', 'Terraform Cloud rechazo la variable. Revisa clave, categoria, valor y HCL, o si ya existe.');
      throw new TerraformCloudError('BAD_GATEWAY', 'Terraform Cloud no pudo completar la operacion.', mutation);
    }
    if (response.status === 204) return null;
    try {
      return await response.json() as unknown;
    } catch {
      throw new TerraformCloudError('BAD_GATEWAY', 'Terraform Cloud devolvio una respuesta no valida.', mutation);
    }
  }

  async function list(path: string): Promise<unknown[]> {
    const items: unknown[] = [];
    let page = 1;
    while (true) {
      const parameters = new URLSearchParams({ 'page[number]': String(page), 'page[size]': '100' });
      const response = z.object({
        data: z.array(z.unknown()),
        meta: z.object({ pagination: z.object({ 'next-page': z.number().int().positive().nullable() }) }).optional(),
      }).safeParse(await request(`${path}?${parameters}`));
      if (!response.success) throw new TerraformCloudError('BAD_GATEWAY', 'La lista de Terraform Cloud tiene un formato no valido.');
      items.push(...response.data.data);
      const next = response.data.meta?.pagination['next-page'];
      if (!next) return items;
      if (next <= page || next > 1000) throw new TerraformCloudError('BAD_GATEWAY', 'No se pudo completar la paginacion de Terraform Cloud.');
      page = next;
    }
  }

  function checkedWorkspace(response: unknown, organization: string, write = false) {
    const parsed = z.object({ data: workspaceSchema }).safeParse(response);
    if (!parsed.success) throw new TerraformCloudError('BAD_GATEWAY', 'No se pudieron validar los permisos del workspace.');
    const workspace = parsed.data.data;
    if (workspace.relationships.organization.data.id !== organization) throw new TerraformCloudError('FORBIDDEN', 'El workspace no pertenece a la organizacion seleccionada.');
    if (!workspace.attributes.permissions['can-read-variable'] || (write && !workspace.attributes.permissions['can-update-variable'])) {
      throw new TerraformCloudError('FORBIDDEN', 'No hay permisos suficientes para consultar o modificar las variables del workspace.');
    }
    return workspace;
  }

  async function existingVariables(workspaceId: string): Promise<ExistingVariable[]> {
    const parsed = z.array(existingVariableSchema).safeParse(await list(`workspaces/${workspaceId}/vars`));
    if (!parsed.success) throw new TerraformCloudError('BAD_GATEWAY', 'No se pudo validar la lista de variables existentes.');
    return parsed.data.map(variableMetadata);
  }

  async function snapshot(response: unknown, organization: string): Promise<WorkspaceSnapshot> {
    const workspace = checkedWorkspace(response, organization);
    return { workspace: { id: workspace.id, name: workspace.attributes.name, canWrite: workspace.attributes.permissions['can-update-variable'] },
      variables: await existingVariables(workspace.id) };
  }

  async function applyChange(operation: z.infer<typeof manageVariablesSchema>['operations'][number], workspaceId: string, existing: ExistingVariable[]): Promise<VariableCreationResult> {
    const identity = { key: operation.variable.key, category: operation.variable.category };
    const matchingKey = existing.find((variable) => variable.key === identity.key && variable.category === identity.category);
    if (operation.action === 'create') {
      if (matchingKey) return { ...identity, status: 'existing', message: 'Ya existe; elige Actualizar o Eliminar despues de consultar de nuevo.' };
      const response = await request(`workspaces/${workspaceId}/vars`, variablePayload(operation.variable));
      if (!z.object({ data: z.object({ type: z.literal('vars'), id: z.string() }) }).safeParse(response).success) {
        throw new TerraformCloudError('BAD_GATEWAY', 'No se pudo confirmar la creacion. Revisa el workspace.', true);
      }
      return { ...identity, status: 'created', message: 'Variable creada.' };
    }
    const listed = existing.find((variable) => variable.id === operation.id);
    if (!listed) {
      if (operation.action === 'delete' && !matchingKey) return { ...identity, status: 'deleted', message: 'La variable ya no existe; no se envio otra eliminacion.' };
      throw new TerraformCloudError('CONFLICT', 'La variable fue eliminada o reemplazada. Consulta de nuevo antes de modificarla.');
    }
    const current = existingVariableSchema.safeParse(z.object({ data: z.unknown() }).parse(await request(`workspaces/${workspaceId}/vars/${operation.id}`)).data);
    if (!current.success) throw new TerraformCloudError('BAD_GATEWAY', 'No se pudo validar la variable antes de modificarla.');
    const metadata = variableMetadata(current.data);
    if (metadata.id !== operation.id || metadata.key !== identity.key || metadata.category !== identity.category || metadata.versionId !== operation.expectedVersion) {
      throw new TerraformCloudError('CONFLICT', 'La variable cambio desde la ultima consulta. Actualiza la lista antes de continuar.');
    }
    const response = operation.action === 'delete'
      ? await request(`workspaces/${workspaceId}/vars/${operation.id}`, undefined, 'DELETE')
      : await request(`workspaces/${workspaceId}/vars/${operation.id}`, { data: { ...variablePayload(operation.variable).data, id: operation.id } }, 'PATCH');
    if (operation.action === 'delete') {
      if (response !== null) throw new TerraformCloudError('BAD_GATEWAY', 'No se pudo confirmar la eliminacion.', true);
      return { ...identity, status: 'deleted', message: 'Variable eliminada.' };
    }
    const updated = z.object({ data: z.object({ id: z.literal(operation.id), type: z.literal('vars') }) }).safeParse(response);
    if (!updated.success) throw new TerraformCloudError('BAD_GATEWAY', 'No se pudo confirmar la actualizacion.', true);
    return { ...identity, status: 'updated', message: 'Variable actualizada.' };
  }

  async function manageBatch(input: z.infer<typeof manageVariablesSchema>): Promise<VariableCreationResult[]> {
    const lockKey = `${scope}:${input.workspaceId}`;
    if (workspaceLocks.has(lockKey)) throw new TerraformCloudError('CONFLICT', 'Ya hay una operacion en curso para este workspace.');
    workspaceLocks.add(lockKey);
    try {
      checkedWorkspace(await request(`workspaces/${input.workspaceId}`), input.organization, true);
      const existing = await existingVariables(input.workspaceId);
      const results: VariableCreationResult[] = [];
      let stopped = false;
      for (const operation of input.operations) {
        const identity = { key: operation.variable.key, category: operation.variable.category };
        if (stopped) { results.push({ ...identity, status: 'not_attempted', message: 'No enviada por un error anterior.' }); continue; }
        try {
          results.push(await applyChange(operation, input.workspaceId, existing));
        } catch (error) {
          const failure = error instanceof TerraformCloudError ? error : new TerraformCloudError('BAD_GATEWAY', 'No se pudo confirmar la operacion.', true);
          results.push({ ...identity, status: failure.uncertain ? 'uncertain' : 'failed', message: failure.message });
          stopped = true;
        }
      }
      return results;
    } finally {
      workspaceLocks.delete(lockKey);
    }
  }

  function submit(input: { requestId: string }, task: () => Promise<VariableCreationResult[]>) {
    const cacheKey = `${scope}:${input.requestId}`;
    const fingerprint = createHash('sha256').update(JSON.stringify(input)).digest('hex');
    for (const [key, submission] of submissions) if (submission.expires < Date.now()) submissions.delete(key);
    const previous = submissions.get(cacheKey);
    if (previous) {
      if (previous.fingerprint !== fingerprint) throw new TerraformCloudError('CONFLICT', 'El identificador de solicitud ya se utilizo con otros campos.');
      return previous.promise;
    }
    if (submissions.size >= 200) throw new TerraformCloudError('TOO_MANY_REQUESTS', 'Hay demasiadas solicitudes recientes. Espera antes de volver a enviar.');
    const promise = task().catch((error: unknown) => { submissions.delete(cacheKey); throw error; });
    submissions.set(cacheKey, { fingerprint, promise, expires: Date.now() + 30 * 60_000 });
    return promise;
  }

  async function createBatch(input: z.infer<typeof createVariablesSchema>): Promise<VariableCreationResult[]> {
    const lockKey = `${scope}:${input.workspaceId}`;
    if (workspaceLocks.has(lockKey)) throw new TerraformCloudError('CONFLICT', 'Ya hay una creacion en curso para este workspace.');
    workspaceLocks.add(lockKey);
    try {
      const workspace = workspaceSchema.safeParse(z.object({ data: z.unknown() }).parse(await request(`workspaces/${input.workspaceId}`)).data);
      if (!workspace.success) throw new TerraformCloudError('BAD_GATEWAY', 'No se pudieron validar los permisos del workspace.');
      if (workspace.data.relationships.organization.data.id !== input.organization) throw new TerraformCloudError('FORBIDDEN', 'El workspace no pertenece a la organizacion seleccionada.');
      if (!workspace.data.attributes.permissions['can-read-variable'] || !workspace.data.attributes.permissions['can-update-variable']) {
        throw new TerraformCloudError('FORBIDDEN', 'Se requieren permisos de lectura y escritura de variables en el workspace.');
      }
      const existing = z.array(z.object({ attributes: z.object({ key: z.string(), category: z.enum(['terraform', 'env']) }) }))
        .safeParse(await list(`workspaces/${input.workspaceId}/vars`));
      if (!existing.success) throw new TerraformCloudError('BAD_GATEWAY', 'No se pudo verificar la lista de variables existentes.');
      const keys = new Set(existing.data.map((variable) => `${variable.attributes.category}:${variable.attributes.key}`));
      const results: VariableCreationResult[] = [];
      let stopped = false;
      for (const variable of input.variables) {
        const identity = { key: variable.key, category: variable.category };
        if (stopped) {
          results.push({ ...identity, status: 'not_attempted', message: 'No enviada por un error anterior.' });
          continue;
        }
        if (keys.has(`${variable.category}:${variable.key}`)) {
          results.push({ ...identity, status: 'existing', message: 'Ya existe; no se modifico su valor ni sus atributos.' });
          continue;
        }
        try {
          const response = await request(`workspaces/${input.workspaceId}/vars`, variablePayload(variable));
          const created = z.object({ data: z.object({ id: z.string(), type: z.literal('vars') }) }).safeParse(response);
          if (!created.success) throw new TerraformCloudError('BAD_GATEWAY', 'No se pudo confirmar la creacion. Verifica el workspace.', true);
          keys.add(`${variable.category}:${variable.key}`);
          results.push({ ...identity, status: 'created', message: 'Variable creada.' });
        } catch (error) {
          const failure = error instanceof TerraformCloudError ? error : new TerraformCloudError('BAD_GATEWAY', 'No se pudo confirmar la operacion.', true);
          results.push({ ...identity, status: failure.uncertain ? 'uncertain' : 'failed', message: failure.message });
          stopped = true;
        }
      }
      return results;
    } finally {
      workspaceLocks.delete(lockKey);
    }
  }

  return {
    async resolveWorkspace(rawInput: unknown): Promise<WorkspaceSnapshot> {
      const input = resolveWorkspaceSchema.parse(rawInput);
      return snapshot(await request(`organizations/${encodeURIComponent(input.organization)}/workspaces/${encodeURIComponent(input.workspaceName)}`), input.organization);
    },
    async workspaceVariables(rawInput: unknown): Promise<WorkspaceSnapshot> {
      const input = workspaceVariablesSchema.parse(rawInput);
      return snapshot(await request(`workspaces/${input.workspaceId}`), input.organization);
    },
    manageVariables(rawInput: unknown): Promise<VariableCreationResult[]> {
      const parsed = manageVariablesSchema.safeParse(rawInput);
      if (!parsed.success) throw new TerraformCloudError('BAD_REQUEST', 'Revisa las operaciones, sus campos y la confirmacion.');
      return submit(parsed.data, () => manageBatch(parsed.data));
    },
    async organizations(): Promise<string[]> {
      return z.array(z.object({ attributes: z.object({ name: z.string() }) })).parse(await list('organizations'))
        .map((organization) => organization.attributes.name).sort();
    },
    async workspaces(organization: string): Promise<TerraformWorkspace[]> {
      const name = nameSchema.parse(organization);
      return z.array(workspaceSchema).parse(await list(`organizations/${encodeURIComponent(name)}/workspaces`))
        .map((workspace) => ({ id: workspace.id, name: workspace.attributes.name,
          canWrite: workspace.attributes.permissions['can-read-variable'] && workspace.attributes.permissions['can-update-variable'],
        })).sort((first, second) => first.name.localeCompare(second.name));
    },
    createVariables(rawInput: unknown): Promise<VariableCreationResult[]> {
      const validated = createVariablesSchema.safeParse(rawInput);
      if (!validated.success) throw new TerraformCloudError('BAD_REQUEST', 'Revisa los campos obligatorios, claves duplicadas, categoria y confirmacion.');
      const input = validated.data;
      return submit(input, () => createBatch(input));
    },
  };
}
