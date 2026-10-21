export const variablePaths = [
  'Infraestructure/Provisioning/Develop/variables.tf',
  'Infraestructure/Provisioning/Staging/variables.tf',
  'Infraestructure/Provisioning/Production/variables.tf',
] as const;

export type VariablePath = (typeof variablePaths)[number];

export interface TerraformVariable {
  key: string;
  value: null;
  category: 'terraform';
  hcl: false;
  sensitive: boolean;
  description: string;
}

export interface VariableInput {
  key: string;
  value: string;
  category: 'terraform' | 'env';
  hcl: boolean;
  sensitive: boolean;
  description: string;
}

export interface TerraformWorkspace {
  id: string;
  name: string;
  canWrite: boolean;
}

export interface VariableCreationResult {
  key: string;
  category: 'terraform' | 'env';
  status: 'created' | 'updated' | 'deleted' | 'existing' | 'failed' | 'uncertain' | 'not_attempted';
  message: string;
}

export interface ExistingVariable {
  id: string;
  value?: string;
  key: string;
  category: 'terraform' | 'env';
  hcl: boolean;
  sensitive: boolean;
  description: string;
  versionId: string | null;
}

export interface WorkspaceSnapshot {
  workspace: TerraformWorkspace;
  variables: ExistingVariable[];
}

export type VariableOperation =
  | { action: 'create'; variable: VariableInput }
  | { action: 'update'; id: string; expectedVersion: string | null; variable: VariableInput }
  | { action: 'delete'; id: string; expectedVersion: string | null; variable: Pick<VariableInput, 'key' | 'category'> };

export interface Repository {
  name: string;
  private: boolean;
  defaultBranch: string;
}

export interface VariableFile {
  path: VariablePath;
  environment: string;
}

export interface VariableResult {
  variables: TerraformVariable[];
  commit: string;
  path: VariablePath;
  destination?: { organization: string; workspaceName: string; providerPath: string } | null;
  destinationError?: string | null;
}
