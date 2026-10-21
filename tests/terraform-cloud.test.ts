import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { createTerraformCloudClient, createVariablesSchema, manageVariablesSchema } from '../src/lib/server/terraform-cloud.ts';

const variable = { key: 'location', value: 'eastus', category: 'terraform', hcl: false, sensitive: false, description: 'Region' };
const input = () => ({ organization: 'example', workspaceId: 'ws-example', confirmed: true, requestId: randomUUID(), variables: [{ ...variable }] });
const workspace = (organization = 'example', writable = true) => ({
  id: 'ws-example', attributes: { name: 'development', permissions: { 'can-read-variable': true, 'can-update-variable': writable } },
  relationships: { organization: { data: { id: organization } } },
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

test('lists paginated organizations and workspace permissions without exposing attributes', async () => {
  const fetcher: typeof fetch = async (url) => {
    const parsed = new URL(String(url));
    assert.equal(parsed.origin, 'https://app.terraform.io');
    if (parsed.pathname.endsWith('/organizations')) {
      const first = parsed.searchParams.get('page[number]') === '1';
      return json({ data: [{ attributes: { name: first ? 'first' : 'second', email: 'not-returned@example.test' } }], meta: { pagination: { 'next-page': first ? 2 : null } } });
    }
    return json({ data: [workspace('example', false)] });
  };
  const client = createTerraformCloudClient(randomUUID(), fetcher);
  assert.deepEqual(await client.organizations(), ['first', 'second']);
  assert.deepEqual(await client.workspaces('example'), [{ id: 'ws-example', name: 'development', canWrite: false }]);
});

test('requires confirmation, values and unique category/key pairs', () => {
  assert.equal(createVariablesSchema.safeParse({ ...input(), confirmed: false }).success, false);
  assert.equal(createVariablesSchema.safeParse({ ...input(), variables: [{ ...variable, value: '' }] }).success, false);
  assert.equal(createVariablesSchema.safeParse({ ...input(), variables: [variable, variable] }).success, false);
  assert.equal(createVariablesSchema.safeParse({ ...input(), variables: [{ ...variable, category: 'env', hcl: true }] }).success, false);
  assert.equal(createVariablesSchema.safeParse({ ...input(), variables: Array.from({ length: 6 }, (_unused, index) => ({ ...variable, key: `value_${index}`, value: '\u00e9'.repeat(100000) })) }).success, false);
});

test('creates exact payloads once, skips existing keys and deduplicates concurrent retries', async () => {
  const payloads: unknown[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    assert.equal(init?.redirect, 'error');
    if (init?.method === 'POST') {
      payloads.push(JSON.parse(String(init.body)));
      return json({ data: { id: 'var-new', type: 'vars', attributes: { value: 'never-returned' } } }, 201);
    }
    if (String(url).includes('/vars?')) return json({ data: [{ attributes: { key: 'existing', category: 'terraform' } }] });
    return json({ data: workspace() });
  };
  const client = createTerraformCloudClient(randomUUID(), fetcher);
  const request = { ...input(), variables: [variable, { ...variable, key: 'existing' }] };
  const [first, second] = await Promise.all([client.createVariables(request), client.createVariables(request)]);
  assert.deepEqual(first, second);
  assert.deepEqual(payloads, [{ data: { type: 'vars', attributes: variable } }]);
  assert.deepEqual(first.map((item) => item.status), ['created', 'existing']);
  assert.ok(!JSON.stringify(first).includes('never-returned'));
  assert.throws(() => client.createVariables({ ...request, variables: [{ ...variable, value: 'changed' }] }), /identificador/);
});

test('checks organization and write permissions before any mutation', async () => {
  for (const data of [workspace('different'), workspace('example', false)]) {
    let writes = 0;
    const client = createTerraformCloudClient(randomUUID(), async (_url, init) => {
      if (init?.method === 'POST') writes++;
      return json({ data });
    });
    await assert.rejects(client.createVariables(input()));
    assert.equal(writes, 0);
  }
});

test('reports partial success and stops after a rejected variable without exposing API errors', async () => {
  let writes = 0;
  const client = createTerraformCloudClient(randomUUID(), async (url, init) => {
    if (init?.method === 'POST') {
      writes++;
      return writes === 1 ? json({ data: { id: 'var-created', type: 'vars' } }, 201)
        : json({ errors: [{ detail: 'synthetic-secret-do-not-expose' }] }, 422);
    }
    return String(url).includes('/vars?') ? json({ data: [] }) : json({ data: workspace() });
  });
  const results = await client.createVariables({ ...input(), variables: [variable, { ...variable, key: 'second' }, { ...variable, key: 'third' }] });
  assert.deepEqual(results.map((item) => item.status), ['created', 'failed', 'not_attempted']);
  assert.equal(writes, 2);
  assert.ok(!JSON.stringify(results).includes('synthetic-secret-do-not-expose'));
});

test('marks ambiguous network failures and checks existing keys on a fresh retry', async () => {
  let accepted = false;
  let writes = 0;
  const client = createTerraformCloudClient(randomUUID(), async (url, init) => {
    if (init?.method === 'POST') {
      writes++; accepted = true; throw new Error('Network failed after write');
    }
    return String(url).includes('/vars?') ? json({ data: accepted ? [{ attributes: { key: 'location', category: 'terraform' } }] : [] }) : json({ data: workspace() });
  });
  assert.equal((await client.createVariables(input()))[0]?.status, 'uncertain');
  assert.equal((await client.createVariables(input()))[0]?.status, 'existing');
  assert.equal(writes, 1);
});

test('rejects different concurrent submissions to the same workspace', async () => {
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const client = createTerraformCloudClient(randomUUID(), async (url, init) => {
    if (init?.method === 'POST') return json({ data: { id: 'var-created', type: 'vars' } }, 201);
    if (String(url).includes('/vars?')) return json({ data: [] });
    await gate;
    return json({ data: workspace() });
  });
  const first = client.createVariables(input());
  await assert.rejects(client.createVariables(input()), /en curso/);
  release?.();
  assert.equal((await first)[0]?.status, 'created');
});

const remoteVariable = (key = 'location', id = 'var-location', version = 'version-1') => ({
  id, type: 'vars', attributes: { key, category: 'terraform', hcl: false, sensitive: true, description: 'Remote metadata',
    'version-id': version, value: 'never-return-this-value' },
});
const changeInput = (operations: unknown[]) => ({ organization: 'example', workspaceId: 'ws-example', requestId: randomUUID(), confirmed: true, operations });

test('resolves the workspace and returns only non-sensitive values, including read-only workspaces', async () => {
  const urls: string[] = [];
  const client = createTerraformCloudClient(randomUUID(), async (url) => {
    urls.push(String(url));
    const publicVariable = remoteVariable('region', 'var-region');
    publicVariable.attributes.sensitive = false;
    publicVariable.attributes.value = 'westus';
    return String(url).includes('/vars?') ? json({ data: [remoteVariable(), publicVariable] }) : json({ data: workspace('example', false) });
  });
  const result = await client.resolveWorkspace({ organization: 'example', workspaceName: 'development' });
  assert.ok(urls[0]?.endsWith('/organizations/example/workspaces/development'));
  assert.equal(result.workspace.canWrite, false);
  assert.equal(result.variables[0]?.id, 'var-location');
  assert.equal(result.variables[0]?.versionId, 'version-1');
  assert.ok(!JSON.stringify(result).includes('never-return-this-value'));
  assert.equal('value' in (result.variables[0] ?? {}), false);
  assert.equal(result.variables[1]?.value, 'westus');
});

test('creates, updates and deletes only the explicit operations, with replay protection', async () => {
  const writes: { method: string; body?: unknown; url: string }[] = [];
  const client = createTerraformCloudClient(randomUUID(), async (url, init) => {
    const address = String(url);
    if (init?.method !== 'GET') {
      writes.push({ method: init?.method ?? '', url: address, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (init?.method === 'DELETE') return new Response(null, { status: 204 });
      return json({ data: { id: init?.method === 'POST' ? 'var-new' : 'var-location', type: 'vars' } });
    }
    if (address.includes('/vars?')) return json({ data: [remoteVariable(), remoteVariable('old', 'var-old')] });
    if (address.endsWith('/vars/var-location')) return json({ data: remoteVariable() });
    if (address.endsWith('/vars/var-old')) return json({ data: remoteVariable('old', 'var-old') });
    return json({ data: workspace() });
  });
  const input = changeInput([
    { action: 'create', variable: { ...variable, key: 'new' } },
    { action: 'update', id: 'var-location', expectedVersion: 'version-1', variable: { ...variable, value: 'westus', sensitive: true } },
    { action: 'delete', id: 'var-old', expectedVersion: 'version-1', variable: { key: 'old', category: 'terraform' } },
  ]);
  const result = await client.manageVariables(input);
  assert.deepEqual(result.map((item) => item.status), ['created', 'updated', 'deleted']);
  assert.deepEqual(writes.map((item) => item.method), ['POST', 'PATCH', 'DELETE']);
  assert.deepEqual(writes[1]?.body, { data: { id: 'var-location', type: 'vars', attributes: { ...variable, value: 'westus', sensitive: true } } });
  assert.equal(writes[2]?.body, undefined);
  await client.manageVariables(input);
  assert.equal(writes.length, 3);
  assert.ok(!JSON.stringify(result).includes('westus'));
});

test('rejects foreign IDs, changed versions and mismatched identities without PATCH or DELETE', async () => {
  for (const patch of [{ id: 'var-foreign' }, { expectedVersion: 'version-old' }, { variable: { ...variable, key: 'other' } }]) {
    let writes = 0;
    const client = createTerraformCloudClient(randomUUID(), async (url, init) => {
      if (init?.method !== 'GET') writes++;
      if (String(url).includes('/vars?')) return json({ data: [remoteVariable()] });
      if (String(url).includes('/vars/')) return json({ data: remoteVariable() });
      return json({ data: workspace() });
    });
    const result = await client.manageVariables(changeInput([{ action: 'update', id: 'var-location', expectedVersion: 'version-1', variable, ...patch }]));
    assert.equal(result[0]?.status, 'failed');
    assert.equal(writes, 0);
  }
});

test('requires confirmation, rejects duplicate operations and permits deletion without a value', () => {
  const deletion = { action: 'delete', id: 'var-location', expectedVersion: 'version-1', variable: { key: 'location', category: 'terraform' } };
  assert.equal(manageVariablesSchema.safeParse(changeInput([deletion])).success, true);
  assert.equal(manageVariablesSchema.safeParse({ ...changeInput([deletion]), confirmed: false }).success, false);
  assert.equal(manageVariablesSchema.safeParse(changeInput([deletion, deletion])).success, false);
});

test('does not write to a foreign or read-only workspace in manage mode', async () => {
  for (const data of [workspace('other'), workspace('example', false)]) {
    let writes = 0;
    const client = createTerraformCloudClient(randomUUID(), async (_url, init) => {
      if (init?.method !== 'GET') writes++;
      return json({ data });
    });
    await assert.rejects(client.manageVariables(changeInput([{ action: 'create', variable }])));
    assert.equal(writes, 0);
  }
});

test('treats a missing deletion as complete but never deletes a replacement with the same key', async () => {
  for (const replacement of [false, true]) {
    let writes = 0;
    const client = createTerraformCloudClient(randomUUID(), async (url, init) => {
      if (init?.method !== 'GET') writes++;
      return String(url).includes('/vars?') ? json({ data: replacement ? [remoteVariable('location', 'var-replacement')] : [] }) : json({ data: workspace() });
    });
    const result = await client.manageVariables(changeInput([{ action: 'delete', id: 'var-location', expectedVersion: 'version-1', variable: { key: 'location', category: 'terraform' } }]));
    assert.equal(result[0]?.status, replacement ? 'failed' : 'deleted');
    assert.equal(writes, 0);
  }
});

test('reports ambiguous PATCH failures and stops before any subsequent deletion', async () => {
  const writes: string[] = [];
  const client = createTerraformCloudClient(randomUUID(), async (url, init) => {
    if (init?.method !== 'GET') { writes.push(init?.method ?? ''); throw new Error('Synthetic network failure'); }
    if (String(url).includes('/vars?')) return json({ data: [remoteVariable(), remoteVariable('old', 'var-old')] });
    if (String(url).endsWith('/vars/var-location')) return json({ data: remoteVariable() });
    return json({ data: workspace() });
  });
  const result = await client.manageVariables(changeInput([
    { action: 'update', id: 'var-location', expectedVersion: 'version-1', variable },
    { action: 'delete', id: 'var-old', expectedVersion: 'version-1', variable: { key: 'old', category: 'terraform' } },
  ]));
  assert.deepEqual(result.map((item) => item.status), ['uncertain', 'not_attempted']);
  assert.deepEqual(writes, ['PATCH']);
});
