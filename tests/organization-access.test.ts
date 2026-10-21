import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hasInfrastructureAccess, infrastructureOrganizations } from '../src/lib/organization-access.ts';

test('denies infrastructure access without a signed-in user', () => {
  assert.equal(hasInfrastructureAccess({ userId: null, orgId: infrastructureOrganizations[0].id }), false);
});

test('denies registered users without an active organization', () => {
  assert.equal(hasInfrastructureAccess({ userId: 'user-example', orgId: null }), false);
  assert.equal(hasInfrastructureAccess({ userId: 'user-example' }), false);
});

test('denies organizations outside the infrastructure allowlist', () => {
  assert.equal(hasInfrastructureAccess({ userId: 'user-example', orgId: 'org-self-created' }), false);
});

test('allows signed-in members with either authorized organization active', () => {
  for (const organization of infrastructureOrganizations) {
    assert.equal(hasInfrastructureAccess({ userId: 'user-example', orgId: organization.id }), true);
  }
});
