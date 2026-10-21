import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { posix } from 'node:path';
import { z } from 'astro/zod';
import { variablePaths } from '../contracts.ts';
import type { Repository, VariableFile, VariablePath, VariableResult } from '../contracts.ts';
import { isInfrastructureRepository, parseCloudWorkspace, parseVariables } from './terraform.ts';

const executeFile = promisify(execFile);
type ErrorCode = 'NOT_FOUND' | 'FORBIDDEN' | 'BAD_GATEWAY' | 'BAD_REQUEST' | 'TIMEOUT';
export class GithubError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export type GithubRunner = (args: string[]) => Promise<unknown>;

export function githubRunner(token: string): GithubRunner {
  return async (args) => {
    let stdout: string;
    try {
      ({ stdout } = await executeFile('gh', ['api', '--hostname', 'github.com', ...args], {
        env: { ...process.env, GH_TOKEN: token, GH_HOST: 'github.com', GH_PROMPT_DISABLED: '1', GH_DEBUG: '' },
        timeout: 60_000,
        maxBuffer: 16 * 1024 * 1024,
        windowsHide: true,
        encoding: 'utf8',
      }));
    } catch (error) {
      const failure = error as NodeJS.ErrnoException & { stderr?: string; killed?: boolean };
      if (failure.code === 'ENOENT') {
        throw new GithubError('BAD_GATEWAY', 'GitHub CLI (gh) no esta instalado o no esta en PATH.');
      }
      if (failure.killed) throw new GithubError('TIMEOUT', 'GitHub no respondio a tiempo. Reintenta la consulta.');
      if (/HTTP 404/i.test(failure.stderr ?? '')) throw new GithubError('NOT_FOUND', 'El recurso no existe o el token no tiene acceso.');
      if (/HTTP 401|HTTP 403|read:enterprise|SAML|SSO/i.test(failure.stderr ?? '')) {
        throw new GithubError('FORBIDDEN', 'Revisa los permisos del token, su autorizacion SSO y el acceso al enterprise.');
      }
      throw new GithubError('BAD_GATEWAY', 'No se pudo consultar GitHub. Revisa conectividad, permisos y limites de API.');
    }
    try {
      return JSON.parse(stdout) as unknown;
    } catch {
      throw new GithubError('BAD_GATEWAY', 'GitHub devolvio una respuesta no valida.');
    }
  };
}

const organizationSchema = z.object({ login: z.string(), name: z.string().nullable() });
const repositorySchema = z.object({
  name: z.string(), private: z.boolean(), default_branch: z.string().nullable(),
});
const branchSchema = z.object({ name: z.string(), commit: z.object({ sha: z.string().regex(/^[a-f0-9]{40,64}$/i) }) });
const fileSchema = z.object({ type: z.literal('file'), size: z.number().nonnegative() });
const contentSchema = fileSchema.extend({ encoding: z.literal('base64'), content: z.string() });

export function createGithubClient(enterprise: string, run: GithubRunner) {
  async function organizations() {
    const result = await run([
      'graphql', '--paginate', '--slurp',
      '-f', 'query=query($enterprise: String!, $endCursor: String) { enterprise(slug: $enterprise) { organizations(first: 100, after: $endCursor) { nodes { login name } pageInfo { hasNextPage endCursor } } } }',
      '-f', `enterprise=${enterprise}`,
    ]);
    const pages = z.array(z.object({
      data: z.object({ enterprise: z.object({ organizations: z.object({ nodes: z.array(organizationSchema) }) }).nullable() }),
      errors: z.array(z.unknown()).optional(),
    })).parse(result);
    if (pages.some((page) => page.errors?.length || !page.data.enterprise)) {
      throw new GithubError('FORBIDDEN', 'No se pueden listar las organizaciones de este enterprise. Revisa acceso y read:enterprise.');
    }
    return pages.flatMap((page) => page.data.enterprise?.organizations.nodes ?? [])
      .sort((first, second) => first.login.localeCompare(second.login));
  }

  async function authorizeOrganization(organization: string) {
    const allowed = await organizations();
    if (!allowed.some((item) => item.login.toLowerCase() === organization.toLowerCase())) {
      throw new GithubError('FORBIDDEN', 'La organizacion no pertenece al enterprise configurado o no es accesible.');
    }
  }

  async function authorizeRepository(organization: string, repository: string) {
    if (!isInfrastructureRepository(repository)) {
      throw new GithubError('BAD_REQUEST', 'El nombre del repositorio debe contener IaC, Infra o Tf.');
    }
    await authorizeOrganization(organization);
  }

  function repoPath(organization: string, repository: string) {
    return `repos/${encodeURIComponent(organization)}/${encodeURIComponent(repository)}`;
  }

  async function resolveBranch(organization: string, repository: string, branch: string) {
    const response = await run([`${repoPath(organization, repository)}/branches/${encodeURIComponent(branch)}`]);
    return branchSchema.parse(response).commit.sha;
  }

  async function content(organization: string, repository: string, commit: string, path: string) {
    const encodedPath = path.split('/').map(encodeURIComponent).join('/');
    return run([`${repoPath(organization, repository)}/contents/${encodedPath}`, '--method', 'GET', '-f', `ref=${commit}`]);
  }

  async function sourceFile(organization: string, repository: string, commit: string, path: string) {
    const response = contentSchema.parse(await content(organization, repository, commit, path));
    if (response.size > 1024 * 1024) throw new GithubError('BAD_REQUEST', 'El archivo supera el limite de 1 MiB.');
    return Buffer.from(response.content, 'base64').toString('utf8');
  }

  return {
    organizations,
    async repositories(organization: string): Promise<Repository[]> {
      await authorizeOrganization(organization);
      const response = await run([`orgs/${encodeURIComponent(organization)}/repos?per_page=100&type=all`, '--paginate', '--slurp']);
      return z.array(z.array(repositorySchema)).parse(response).flat()
        .filter((repository) => isInfrastructureRepository(repository.name))
        .map((repository) => ({ name: repository.name, private: repository.private, defaultBranch: repository.default_branch ?? '' }))
        .sort((first, second) => first.name.localeCompare(second.name));
    },
    async branches(organization: string, repository: string) {
      await authorizeRepository(organization, repository);
      const response = await run([`${repoPath(organization, repository)}/branches?per_page=100`, '--paginate', '--slurp']);
      return z.array(z.array(branchSchema)).parse(response).flat().map((branch) => branch.name)
        .sort((first, second) => first.localeCompare(second));
    },
    async files(organization: string, repository: string, branch: string): Promise<VariableFile[]> {
      await authorizeRepository(organization, repository);
      const commit = await resolveBranch(organization, repository, branch);
      const files = await Promise.all(variablePaths.map(async (path): Promise<VariableFile | null> => {
        try {
          const response = await content(organization, repository, commit, path);
          if (!fileSchema.safeParse(response).success) return null;
          return { path, environment: path.split('/')[2] ?? path };
        } catch (error) {
          if (error instanceof GithubError && error.code === 'NOT_FOUND') return null;
          throw error;
        }
      }));
      return files.filter((file): file is VariableFile => file !== null);
    },
    async variables(organization: string, repository: string, branch: string, path: VariablePath): Promise<VariableResult> {
      if (!variablePaths.includes(path)) throw new GithubError('BAD_REQUEST', 'Ruta de variables no permitida.');
      await authorizeRepository(organization, repository);
      const commit = await resolveBranch(organization, repository, branch);
      const source = await sourceFile(organization, repository, commit, path);
      let variables;
      try {
        variables = parseVariables(source);
      } catch {
        throw new GithubError('BAD_REQUEST', 'No se pudo interpretar el archivo: revisa HCL, variables duplicadas y metadatos literales.');
      }
      const providerPath = posix.join(posix.dirname(path), 'providers.tf');
      let providerSource: string | null = null;
      let destination: VariableResult['destination'] = null;
      let destinationError: string | null = null;
      try {
        providerSource = await sourceFile(organization, repository, commit, providerPath);
      } catch (error) {
        if (!(error instanceof GithubError) || error.code !== 'NOT_FOUND') throw error;
        destinationError = 'No se encontro providers.tf en el directorio seleccionado.';
      }
      if (providerSource !== null) {
        try {
          const cloud = parseCloudWorkspace(providerSource);
          if (cloud) destination = { ...cloud, providerPath };
          else destinationError = 'providers.tf no declara terraform.cloud.workspaces.name.';
        } catch {
          destinationError = 'No se pudo determinar un destino literal y unico en providers.tf.';
        }
      }
      return { variables, commit, path, destination, destinationError };
    },
  };
}
