import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parse } from 'yaml';
import { isInfrastructureRepository, parseCloudWorkspace, parseVariables } from '../src/lib/server/terraform.ts';
import { formatVariables } from '../src/lib/variable-format.ts';
import type { VariableInput } from '../src/lib/contracts.ts';

test('extracts metadata without exposing defaults or changing sensitivity', () => {
  const variables = parseVariables(`
    variable "location" {
      type = string
      description = "Localizacion del recurso"
      default = "eastus"
    }
    variable "credentials" {
      type = object({ token = string })
      sensitive = true
      default = { token = "synthetic-test-secret" }
    }
  `);
  assert.equal(variables.length, 2);
  assert.deepEqual(variables.find((variable) => variable.key === 'location'), {
    key: 'location', value: null, category: 'terraform', hcl: false,
    sensitive: false, description: 'Localizacion del recurso',
  });
  assert.equal(variables[0]?.sensitive, true);
  assert.ok(!JSON.stringify(variables).includes('synthetic-test-secret'));
});

test('parses multiline descriptions and nested HCL types', () => {
  const variables = parseVariables(`
    variable "settings" {
      type = map(object({ names = list(string) }))
      description = <<-TEXT
        Primera linea
        Segunda linea
      TEXT
      validation {
        condition = length(var.settings) > 0
        error_message = "Debe contener elementos"
      }
    }
  `);
  assert.match(variables[0]?.description ?? '', /Primera linea/);
  assert.equal(variables[0]?.value, null);
});

test('rejects invalid HCL and duplicate definitions', () => {
  assert.throws(() => parseVariables('variable {'));
  assert.throws(() => parseVariables('variable "region" {}\nvariable "region" {}'));
  assert.throws(() => parseVariables('variable "token" { sensitive = "true" }'));
  assert.deepEqual(parseVariables('locals { region = "westus" }'), []);
});

test('matches IaC, Infra and Tf case-insensitively', () => {
  for (const name of ['project-IaC', 'INFRA-network', 'platform-Tf', 'iac', 'infra', 'tf']) {
    assert.equal(isInfrastructureRepository(name), true);
  }
  assert.equal(isInfrastructureRepository('frontend-app'), false);
});

test('formats YAML placeholders and separate JSON API payloads', () => {
  const variables = parseVariables('variable "location" { description = "Region" }');
  assert.deepEqual(parse(formatVariables(variables, 'yaml')), variables);
  const payloads: unknown = JSON.parse(formatVariables(variables, 'json'));
  assert.deepEqual(payloads, [{ data: { type: 'vars', attributes: {
    key: 'location', value: '', category: 'terraform', hcl: false,
    sensitive: false, description: 'Region',
  } } }]);
});

test('preserves all captured fields in downloads and API payloads', () => {
  const variable: VariableInput = {
    key: 'settings', value: '{ region = "eastus" }', category: 'terraform',
    hcl: true, sensitive: true, description: 'Configuracion capturada',
  };
  assert.deepEqual(parse(formatVariables([variable], 'yaml')), [variable]);
  assert.deepEqual(JSON.parse(formatVariables([variable], 'json')), [
    { data: { type: 'vars', attributes: variable } },
  ]);
});

test('detects the exact cloud workspace from providers.tf without using provider settings', () => {
  const source = `terraform {
    required_version = "1.9.5"
    cloud {
      organization = "oxxo"
      workspaces { name = "QRPayment-QA" }
    }
    required_providers {
      azurerm = { source = "hashicorp/azurerm", version = "~> 4.50" }
    }
  }`;
  assert.deepEqual(parseCloudWorkspace(source), { organization: 'oxxo', workspaceName: 'QRPayment-QA' });
  assert.deepEqual(parseCloudWorkspace(source.replace('QRPayment-QA', 'QRPayment-DEV')), { organization: 'oxxo', workspaceName: 'QRPayment-DEV' });
  assert.equal(parseCloudWorkspace('terraform { required_version = "1.9.5" }'), null);
});

test('rejects ambiguous, dynamic or invalid providers.tf destinations', () => {
  assert.throws(() => parseCloudWorkspace('terraform {'));
  assert.throws(() => parseCloudWorkspace('terraform { cloud { organization = var.org\n workspaces { name = "test" } } }'));
  assert.throws(() => parseCloudWorkspace('terraform { cloud { organization = "oxxo"\n workspaces { tags = ["qa"] } } }'));
  assert.throws(() => parseCloudWorkspace('terraform { cloud { organization = "oxxo"\n workspaces { name = "one" } }\n cloud { organization = "oxxo"\n workspaces { name = "two" } } }'));
});
