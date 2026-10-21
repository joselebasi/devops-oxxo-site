import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGithubClient, GithubError } from '../src/lib/server/github.ts';
import type { GithubRunner } from '../src/lib/server/github.ts';
import { variablePaths } from '../src/lib/contracts.ts';

const enterprisePage = (login: string) => ({ data: { enterprise: { organizations: { nodes: [{ login, name: login }] } } } });
const commit = 'a'.repeat(40);

test('combines enterprise and repository pages before applying the name filter', async () => {
  const run: GithubRunner = async (args) => {
    if (args[0] === 'graphql') {
      assert.ok(args.includes('--paginate'));
      return [enterprisePage('org-one'), enterprisePage('org-two')];
    }
    assert.ok(args.includes('--paginate'));
    return [[{ name: 'Network-INFRA', private: true, default_branch: 'main' }], [
      { name: 'app', private: false, default_branch: 'main' },
      { name: 'Azure-tF', private: true, default_branch: 'develop' },
    ]];
  };
  const github = createGithubClient('oxxogh', run);
  assert.equal((await github.organizations()).length, 2);
  assert.deepEqual((await github.repositories('org-one')).map((repo) => repo.name), ['Azure-tF', 'Network-INFRA']);
});

test('rejects organizations outside the enterprise before reading a repository', async () => {
  const calls: string[][] = [];
  const github = createGithubClient('oxxogh', async (args) => {
    calls.push(args);
    return [enterprisePage('allowed')];
  });
  await assert.rejects(github.branches('external', 'azure-iac'), /no pertenece/);
  assert.equal(calls.length, 1);
  await assert.rejects(github.branches('allowed', 'frontend'), /debe contener/);
});

test('lists only existing allowed files and pins content reads to a commit', async () => {
  const github = createGithubClient('oxxogh', async (args) => {
    if (args[0] === 'graphql') return [enterprisePage('allowed')];
    if (args[0]?.includes('/branches/')) {
      assert.ok(args[0].endsWith('feature%2Fnetwork'));
      return { name: 'feature/network', commit: { sha: commit } };
    }
    assert.ok(args.includes(`ref=${commit}`));
    if (args[0]?.includes('/Develop/')) return { type: 'file', size: 100 };
    throw new GithubError('NOT_FOUND', 'Absent');
  });
  assert.deepEqual(await github.files('allowed', 'azure-IAC', 'feature/network'), [
    { path: variablePaths[0], environment: 'Develop' },
  ]);
});

test('reads base64 HCL without returning raw content or default values', async () => {
  const source = 'variable "location" { default = "private-default" }';
  const github = createGithubClient('oxxogh', async (args) => {
    if (args[0] === 'graphql') return [enterprisePage('allowed')];
    if (args[0]?.includes('/branches/')) return { name: 'main', commit: { sha: commit } };
    return { type: 'file', size: source.length, encoding: 'base64', content: Buffer.from(source).toString('base64') };
  });
  const result = await github.variables('allowed', 'azure-IAC', 'main', variablePaths[0]);
  assert.equal(result.commit, commit);
  assert.equal(result.variables[0]?.key, 'location');
  assert.ok(!JSON.stringify(result).includes('private-default'));
});

test('does not conceal permission failures as absent environments', async () => {
  const github = createGithubClient('oxxogh', async (args) => {
    if (args[0] === 'graphql') return [enterprisePage('allowed')];
    if (args[0]?.includes('/branches/')) return { name: 'main', commit: { sha: commit } };
    throw new GithubError('FORBIDDEN', 'Denied');
  });
  await assert.rejects(github.files('allowed', 'azure-IAC', 'main'), /Denied/);
});

test('reads providers.tf beside variables.tf from the same branch commit', async () => {
  const reads: string[] = [];
  const github = createGithubClient('oxxogh', async (args) => {
    if (args[0] === 'graphql') return [enterprisePage('allowed')];
    if (args[0]?.includes('/branches/')) return { name: 'staging', commit: { sha: commit } };
    assert.ok(args.includes(`ref=${commit}`));
    reads.push(args[0] ?? '');
    const source = args[0]?.endsWith('providers.tf')
      ? 'terraform {\n cloud {\n organization = "oxxo"\n workspaces { name = "QRPayment-QA" }\n }\n }'
      : 'variable "location" {}';
    return { type: 'file', size: source.length, encoding: 'base64', content: Buffer.from(source).toString('base64') };
  });
  const result = await github.variables('allowed', 'Oxxo.Cloud.Tf.QRPayment', 'staging', variablePaths[1]);
  assert.equal(reads.length, 2);
  assert.ok(reads.every((path) => path.includes('/Staging/')));
  assert.deepEqual(result.destination, { organization: 'oxxo', workspaceName: 'QRPayment-QA', providerPath: 'Infraestructure/Provisioning/Staging/providers.tf' });
  assert.equal(result.destinationError, null);
});

test('keeps variable metadata but reports a missing providers.tf without guessing a workspace', async () => {
  const github = createGithubClient('oxxogh', async (args) => {
    if (args[0] === 'graphql') return [enterprisePage('allowed')];
    if (args[0]?.includes('/branches/')) return { name: 'staging', commit: { sha: commit } };
    if (args[0]?.endsWith('providers.tf')) throw new GithubError('NOT_FOUND', 'Absent');
    return { type: 'file', size: 22, encoding: 'base64', content: Buffer.from('variable "location" {}').toString('base64') };
  });
  const result = await github.variables('allowed', 'test-IAC', 'staging', variablePaths[1]);
  assert.equal(result.variables.length, 1);
  assert.equal(result.destination, null);
  assert.match(result.destinationError ?? '', /No se encontro/);
});
