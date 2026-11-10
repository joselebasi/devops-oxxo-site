export const technologies = [
  { id: 'github-actions', name: 'GitHub Actions', category: 'Integracion y despliegue', accent: '#087f6d' },
  { id: 'terraform', name: 'Terraform', category: 'Infraestructura como codigo', accent: '#7047b8' },
  { id: 'openshift', name: 'OpenShift', category: 'Plataforma de aplicaciones', accent: '#c22133' },
] as const;

export const environments = [
  { id: 'dev', name: 'DEV', label: 'Desarrollo' },
  { id: 'qa', name: 'QA', label: 'Calidad' },
  { id: 'prd', name: 'PRD', label: 'Produccion' },
] as const;

export type TechnologyId = typeof technologies[number]['id'];
export type EnvironmentId = typeof environments[number]['id'];

export interface ChecklistTask {
  task: string;
  owner: string;
  requestedFrom: string;
  minutes: number;
}

const technologyTasks: Record<TechnologyId, readonly ChecklistTask[]> = {
  'github-actions': [
    { task: 'Validar repositorio, rama y permisos del workflow', owner: 'DevOps', requestedFrom: 'Administrador de GitHub', minutes: 20 },
    { task: 'Configurar environment, variables y referencias a secretos', owner: 'DevOps', requestedFrom: 'Responsable de la aplicacion / Seguridad', minutes: 30 },
    { task: 'Validar runner, conectividad y permisos minimos del token', owner: 'DevOps', requestedFrom: 'Equipo de plataforma', minutes: 20 },
    { task: 'Revisar workflow, pruebas y controles de seguridad', owner: 'Desarrollo / DevOps', requestedFrom: 'Lider tecnico / Seguridad', minutes: 30 },
    { task: 'Ejecutar pipeline y verificar artefactos del despliegue', owner: 'DevOps', requestedFrom: 'Responsable de la aplicacion', minutes: 30 },
    { task: 'Registrar evidencias y validar procedimiento de rollback', owner: 'DevOps', requestedFrom: 'Lider tecnico', minutes: 20 },
  ],
  terraform: [
    { task: 'Validar workspace, backend y acceso al estado remoto', owner: 'Infraestructura', requestedFrom: 'Administrador de Terraform', minutes: 20 },
    { task: 'Solicitar variables y referencias a credenciales del ambiente', owner: 'Infraestructura', requestedFrom: 'Responsable cloud / Seguridad', minutes: 30 },
    { task: 'Ejecutar fmt, validate y revision de modulos y versiones', owner: 'Infraestructura', requestedFrom: 'Lider de Infraestructura', minutes: 20 },
    { task: 'Generar plan y revisar altas, cambios y destrucciones', owner: 'Infraestructura', requestedFrom: 'Arquitectura / Responsable cloud', minutes: 40 },
    { task: 'Aplicar el plan aprobado y comprobar los recursos', owner: 'Infraestructura', requestedFrom: 'Responsable cloud', minutes: 40 },
    { task: 'Registrar evidencias del estado y plan de recuperacion', owner: 'Infraestructura', requestedFrom: 'Operacion cloud', minutes: 20 },
  ],
  openshift: [
    { task: 'Solicitar proyecto, cuotas y permisos del namespace', owner: 'Equipo de plataforma', requestedFrom: 'Administrador de OpenShift', minutes: 30 },
    { task: 'Validar imagen, registry y permisos de extraccion', owner: 'DevOps', requestedFrom: 'Desarrollo / Administrador del registry', minutes: 20 },
    { task: 'Configurar referencias a secretos, ConfigMaps y cuentas de servicio', owner: 'DevOps', requestedFrom: 'Seguridad / Equipo de plataforma', minutes: 30 },
    { task: 'Validar rutas, TLS, red y dependencias externas', owner: 'Equipo de plataforma', requestedFrom: 'Redes / Seguridad', minutes: 30 },
    { task: 'Desplegar y revisar probes, recursos y estado de los pods', owner: 'DevOps', requestedFrom: 'Desarrollo / Equipo de plataforma', minutes: 30 },
    { task: 'Verificar logs, alertas y procedimiento de rollback', owner: 'Operacion', requestedFrom: 'Observabilidad / DevOps', minutes: 20 },
  ],
};

const environmentApproval: Record<EnvironmentId, ChecklistTask> = {
  dev: { task: 'Confirmar alcance y disponibilidad del ambiente DEV', owner: 'Lider tecnico', requestedFrom: 'Equipo de desarrollo', minutes: 15 },
  qa: { task: 'Confirmar version candidata y criterios de aceptacion QA', owner: 'Lider de QA', requestedFrom: 'Desarrollo / Responsable funcional', minutes: 30 },
  prd: { task: 'Obtener aprobacion de cambio, ventana y plan de reversa PRD', owner: 'Gestor de cambios', requestedFrom: 'Comite de cambios / Responsable del servicio', minutes: 60 },
};

const environmentValidation: Record<EnvironmentId, ChecklistTask> = {
  dev: { task: 'Validar prueba funcional basica y entregar a desarrollo', owner: 'Desarrollo', requestedFrom: 'Lider tecnico', minutes: 20 },
  qa: { task: 'Ejecutar regresion y registrar aprobacion de calidad', owner: 'QA', requestedFrom: 'Responsable funcional', minutes: 60 },
  prd: { task: 'Ejecutar smoke test y confirmar monitoreo posterior al cambio', owner: 'Operacion / QA', requestedFrom: 'Responsable del servicio', minutes: 45 },
};

export function getTechnology(value: string | null) {
  return technologies.find((technology) => technology.id === value);
}

export function getEnvironment(value: string | null) {
  return environments.find((environment) => environment.id === value) ?? environments[0];
}

export function getChecklist(technology: TechnologyId, environment: EnvironmentId): ChecklistTask[] {
  return [environmentApproval[environment], ...technologyTasks[technology], environmentValidation[environment]];
}

export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return hours ? `${hours} h${remainder ? ` ${remainder} min` : ''}` : `${remainder} min`;
}
