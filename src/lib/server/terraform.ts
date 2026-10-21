import hcl from 'hcl2-parser';
import type { TerraformVariable } from '../contracts.ts';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseVariables(source: string): TerraformVariable[] {
  let parsed: unknown;
  try {
    parsed = hcl.parseToObject(source);
  } catch {
    throw new Error('No se pudo analizar el archivo HCL.');
  }

  if (!Array.isArray(parsed) || parsed[1] != null || !isRecord(parsed[0])) {
    throw new Error('El archivo no contiene HCL valido.');
  }

  const blocks: unknown = parsed[0].variable;
  if (blocks === undefined) return [];
  if (!isRecord(blocks)) throw new Error('Los bloques variable no son validos.');

  return Object.entries(blocks).map<TerraformVariable>(([key, definitions]) => {
    if (!Array.isArray(definitions) || definitions.length !== 1 || !isRecord(definitions[0])) {
      throw new Error('Hay variables duplicadas o bloques no validos.');
    }
    const definition = definitions[0];
    if (definition.description !== undefined && typeof definition.description !== 'string') {
      throw new Error('Las descripciones deben ser cadenas de texto.');
    }
    if (definition.sensitive !== undefined && typeof definition.sensitive !== 'boolean') {
      throw new Error('La propiedad sensitive debe ser un booleano literal.');
    }
    return {
      key,
      value: null,
      category: 'terraform',
      hcl: false,
      sensitive: definition.sensitive ?? false,
      description: definition.description ?? '',
    };
  }).sort((first, second) => first.key.localeCompare(second.key));
}

export function isInfrastructureRepository(name: string): boolean {
  return /iac|infra|tf/i.test(name);
}

export function parseCloudWorkspace(source: string): { organization: string; workspaceName: string } | null {
  const parsed: unknown = hcl.parseToObject(source);
  if (!Array.isArray(parsed) || parsed[1] != null || !isRecord(parsed[0])) throw new Error('providers.tf no contiene HCL valido.');
  const blocks: unknown = parsed[0].terraform;
  if (blocks === undefined) return null;
  if (!Array.isArray(blocks) || !blocks.every(isRecord)) throw new Error('El bloque terraform no es valido.');
  const clouds = blocks.flatMap((block) => block.cloud === undefined ? [] : Array.isArray(block.cloud) ? block.cloud : [null]);
  if (!clouds.length) return null;
  const cloud: unknown = clouds[0];
  if (clouds.length !== 1 || !isRecord(cloud) || !Array.isArray(cloud.workspaces) || cloud.workspaces.length !== 1) {
    throw new Error('providers.tf debe declarar un solo destino cloud con workspaces.name.');
  }
  const workspace: unknown = cloud.workspaces[0];
  if (!isRecord(workspace) || typeof cloud.organization !== 'string' || typeof workspace.name !== 'string'
    || !/^[a-zA-Z0-9_-]+$/.test(cloud.organization) || !/^[a-zA-Z0-9_-]+$/.test(workspace.name)) {
    throw new Error('El destino de providers.tf requiere organization y workspaces.name literales.');
  }
  return { organization: cloud.organization, workspaceName: workspace.name };
}
