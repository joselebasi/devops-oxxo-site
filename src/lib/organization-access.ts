export const infrastructureOrganizations = [
  { id: 'org_3L0R9GRds6XhVR0QAqA1ZKUpwe0', name: 'Lider de Infraestructura' },
  { id: 'org_3L0R6mpVV74h9TZD9pwJylTi4f4', name: 'DevOps' },
] as const;

interface OrganizationAuth {
  userId: string | null;
  orgId?: string | null;
}

export function hasInfrastructureAccess(auth: OrganizationAuth): boolean {
  return Boolean(auth.userId && infrastructureOrganizations.some((organization) => organization.id === auth.orgId));
}
