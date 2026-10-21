import { stringify } from 'yaml';
import type { TerraformVariable, VariableInput } from './contracts.ts';

export function variablePayload(variable: TerraformVariable | VariableInput) {
  return {
    data: {
      type: 'vars' as const,
      attributes: { ...variable, value: variable.value ?? '' },
    },
  };
}

export function formatVariables(variables: (TerraformVariable | VariableInput)[], format: 'yaml' | 'json'): string {
  if (format === 'yaml') return stringify(variables, { nullStr: 'null' });

  return JSON.stringify(variables.map(variablePayload), null, 2);
}
