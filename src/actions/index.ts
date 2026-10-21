import { ActionError, defineAction } from 'astro:actions';
import { getSecret } from 'astro:env/server';
import { z } from 'astro/zod';
import { variablePaths } from '../lib/contracts';
import { createGithubClient, GithubError, githubRunner } from '../lib/server/github';
import { createTerraformCloudClient, createVariablesSchema, manageVariablesSchema, resolveWorkspaceSchema, workspaceVariablesSchema, terraformOrganizationSchema, TerraformCloudError } from '../lib/server/terraform-cloud';

const organization = z.string().min(1).max(100).regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*$/);
const repository = z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/).refine((name) => name !== '.' && name !== '..');
const branch = z.string().min(1).max(255).refine((name) => !/[\x00-\x1f\x7f]/.test(name));
const repoInput = z.object({ organization, repository });
const branchInput = repoInput.extend({ branch });

function client() {
  const token = getSecret('GH_TOKEN')?.trim();
  const enterprise = getSecret('GITHUB_ENTERPRISE')?.trim() || 'oxxogh';
  if (!token) throw new ActionError({ code: 'PRECONDITION_FAILED', message: 'Falta GH_TOKEN en las variables de entorno del servidor.' });
  if (!/^[a-zA-Z0-9-]+$/.test(enterprise)) throw new ActionError({ code: 'PRECONDITION_FAILED', message: 'GITHUB_ENTERPRISE debe contener el slug del enterprise.' });
  return createGithubClient(enterprise, githubRunner(token));
}

async function query<Result>(operation: (github: ReturnType<typeof client>) => Promise<Result>): Promise<Result> {
  try {
    return await operation(client());
  } catch (error) {
    if (error instanceof ActionError) throw error;
    if (error instanceof GithubError) throw new ActionError({ code: error.code === 'TIMEOUT' ? 'GATEWAY_TIMEOUT' : error.code, message: error.message });
    throw new ActionError({ code: 'BAD_GATEWAY', message: 'La respuesta de GitHub no tiene el formato esperado. Revisa acceso al enterprise y permisos del token.' });
  }
}

async function terraformQuery<Result>(operation: (terraform: ReturnType<typeof createTerraformCloudClient>) => Promise<Result>): Promise<Result> {
  const token = getSecret('TERRAFORM_CLOUD_TOKEN')?.trim();
  if (!token) throw new ActionError({ code: 'PRECONDITION_FAILED', message: 'Falta TERRAFORM_CLOUD_TOKEN en las variables de entorno del servidor.' });
  try {
    return await operation(createTerraformCloudClient(token));
  } catch (error) {
    if (error instanceof TerraformCloudError) throw new ActionError({ code: error.code, message: error.message });
    throw new ActionError({ code: 'BAD_GATEWAY', message: 'No se pudo validar la respuesta de Terraform Cloud. No reenvies sin revisar el resultado del workspace.' });
  }
}

export const server = {
  terraformDestination: defineAction({
    input: resolveWorkspaceSchema,
    handler: (input) => terraformQuery((terraform) => terraform.resolveWorkspace(input)),
  }),
  terraformWorkspaceVariables: defineAction({
    input: workspaceVariablesSchema,
    handler: (input) => terraformQuery((terraform) => terraform.workspaceVariables(input)),
  }),
  manageTerraformVariables: defineAction({
    input: manageVariablesSchema,
    handler: (input) => terraformQuery((terraform) => terraform.manageVariables(input)),
  }),
  terraformOrganizations: defineAction({ handler: () => terraformQuery((terraform) => terraform.organizations()) }),
  terraformWorkspaces: defineAction({
    input: z.object({ organization: terraformOrganizationSchema }),
    handler: ({ organization }) => terraformQuery((terraform) => terraform.workspaces(organization)),
  }),
  createTerraformVariables: defineAction({
    input: createVariablesSchema,
    handler: (input) => terraformQuery((terraform) => terraform.createVariables(input)),
  }),
  organizations: defineAction({ handler: () => query((github) => github.organizations()) }),
  repositories: defineAction({
    input: z.object({ organization }),
    handler: ({ organization }) => query((github) => github.repositories(organization)),
  }),
  branches: defineAction({
    input: repoInput,
    handler: ({ organization, repository }) => query((github) => github.branches(organization, repository)),
  }),
  variableFiles: defineAction({
    input: branchInput,
    handler: ({ organization, repository, branch }) => query((github) => github.files(organization, repository, branch)),
  }),
  variables: defineAction({
    input: branchInput.extend({ path: z.enum(variablePaths) }),
    handler: ({ organization, repository, branch, path }) => query((github) => github.variables(organization, repository, branch, path)),
  }),
};
