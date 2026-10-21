import { useEffect, useRef, useState } from 'react';
import { actions } from 'astro:actions';
import { ArrowUpRight, Check, Download, LoaderCircle, LockKeyhole, RefreshCw, Search, X } from 'lucide-react';
import type { ExistingVariable, TerraformVariable, TerraformWorkspace, VariableCreationResult, VariableInput, VariableOperation, VariableResult, WorkspaceSnapshot } from '../lib/contracts';
import { formatVariables } from '../lib/variable-format';

interface Props {
  readonly variables: TerraformVariable[];
  readonly filename: string;
  readonly onSubmitting: (submitting: boolean) => void;
  readonly destination?: VariableResult['destination'];
  readonly destinationError?: string | null;
}

interface Draft extends VariableInput {
  originalKey: string;
  included: boolean;
  locked: boolean;
  operation: 'create' | 'keep' | 'update' | 'delete';
  existing?: ExistingVariable;
}

const control = 'mt-2 block min-h-11 w-full min-w-0 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm disabled:bg-neutral-100 disabled:text-neutral-500';
const primary = 'inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:brightness-90 disabled:cursor-not-allowed disabled:opacity-50';
const statuses: Record<VariableCreationResult['status'], string> = {
  created: 'Creada', updated: 'Actualizada', deleted: 'Eliminada', existing: 'Existente, sin cambios', failed: 'Error', uncertain: 'Sin confirmar', not_attempted: 'No enviada',
};

function attributes(draft: Draft): VariableInput {
  return { key: draft.key, value: draft.value, category: draft.category, hcl: draft.hcl, sensitive: draft.sensitive, description: draft.description };
}

function identity(variable: Pick<VariableInput, 'key' | 'category'>) {
  return `${variable.category}:${variable.key}`;
}

function reconcileDrafts(drafts: Draft[], remote: ExistingVariable[]): Draft[] {
  return drafts.map((draft) => {
    const existing = remote.find((variable) => identity(variable) === identity(draft));
    return { ...draft, existing, locked: false, operation: existing ? 'keep' : 'create',
      value: existing ? existing.sensitive ? '' : existing.value ?? '' : draft.value,
      included: existing ? false : draft.operation === 'keep' || draft.locked ? true : draft.included,
      sensitive: draft.sensitive || Boolean(existing?.sensitive), hcl: existing?.hcl ?? draft.hcl };
  });
}

function operationFor(draft: Draft): VariableOperation {
  if (draft.operation === 'create') return { action: 'create', variable: attributes(draft) };
  if (!draft.existing || draft.operation === 'keep') throw new Error('Consulta el estado actual de la variable antes de modificarla.');
  const target = { id: draft.existing.id, expectedVersion: draft.existing.versionId };
  return draft.operation === 'delete'
    ? { action: 'delete', ...target, variable: { key: draft.key, category: draft.category } }
    : { action: 'update', ...target, variable: attributes(draft) };
}

export default function VariableEditor({ variables, filename, onSubmitting, destination, destinationError }: Props) {
  const [drafts, setDrafts] = useState<Draft[]>(() => variables.map((variable) => ({
    ...variable, value: '', originalKey: variable.key, included: true, locked: false, operation: 'create',
  })));
  const [organizations, setOrganizations] = useState<string[]>([]);
  const [workspaces, setWorkspaces] = useState<TerraformWorkspace[]>([]);
  const [organization, setOrganization] = useState('');
  const [workspaceId, setWorkspaceId] = useState('');
  const [remoteVariables, setRemoteVariables] = useState<ExistingVariable[]>([]);
  const [snapshotReady, setSnapshotReady] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [outcomes, setOutcomes] = useState<VariableCreationResult[]>([]);
  const [search, setSearch] = useState('');
  const [format, setFormat] = useState<'yaml' | 'json'>('yaml');
  const [exportSecrets, setExportSecrets] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [deleteConfirmed, setDeleteConfirmed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const requestId = useRef<string | null>(null);
  const submitting = useRef(false);
  const selectAll = useRef<HTMLInputElement>(null);
  const selected = drafts.filter((draft) => draft.included && !draft.locked && draft.operation !== 'keep');
  const selectable = drafts.filter((draft) => !draft.locked);
  const allSelected = selectable.length > 0 && selectable.every((draft) => draft.included && draft.operation !== 'keep');
  const deletions = selected.filter((draft) => draft.operation === 'delete').length;
  const workspace = workspaces.find((item) => item.id === workspaceId);

  useEffect(() => {
    if (selectAll.current) selectAll.current.indeterminate = selected.length > 0 && !allSelected;
  }, [selected.length, allSelected]);

  function toggleAll(checked: boolean) {
    requestId.current = null;
    setError('');
    setDrafts((current) => current.map((draft) => draft.locked ? draft : {
      ...draft,
      included: checked,
      operation: checked ? draft.operation === 'keep' ? 'update' : draft.operation : draft.existing ? 'keep' : 'create',
    }));
  }

  useEffect(() => {
    if (!destination) return;
    let active = true;
    setBusy('Consultando destino de providers.tf');
    setOrganization(destination.organization);
    setOrganizations([destination.organization]);
    setSnapshotReady(false);
    void (async () => {
      try {
        const response = await actions.terraformDestination({ organization: destination.organization, workspaceName: destination.workspaceName });
        if (!active) return;
        if (response.error) { setError(response.error.message); return; }
        const data = response.data;
        setWorkspaces([data.workspace]); setWorkspaceId(data.workspace.id);
        setRemoteVariables(data.variables); setDrafts((current) => reconcileDrafts(current, data.variables));
        setSnapshotReady(true); setNotice(`${data.variables.length} variables existentes en el workspace.`);
      } catch {
        if (active) setError('No se pudo consultar el destino declarado en providers.tf.');
      } finally {
        if (active) setBusy(null);
      }
    })();
    return () => { active = false; };
  }, [destination]);

  function edit(index: number, patch: Partial<Draft>) {
    requestId.current = null;
    setError('');
    setDrafts((current) => current.map((draft, position) => {
      if (position !== index) return draft;
      const next = { ...draft, ...patch };
      if (patch.key !== undefined || patch.category !== undefined) {
        const existing = remoteVariables.find((variable) => identity(variable) === identity(next));
        return { ...next, existing, operation: existing ? 'keep' : 'create', included: !existing,
          value: existing ? existing.sensitive ? '' : existing.value ?? '' : next.value,
          sensitive: next.sensitive || Boolean(existing?.sensitive) };
      }
      return next;
    }));
  }

  function resetDestination() {
    requestId.current = null;
    setOutcomes([]);
    setNotice('');
    setSnapshotReady(false); setRemoteVariables([]);
    setDrafts((current) => current.map((draft) => ({ ...draft, value: draft.sensitive ? '' : draft.value,
      existing: undefined, locked: false, operation: 'create', included: true })));
  }

  async function query<Result>(label: string, operation: () => Promise<{ data?: Result; error?: { message: string } }>, receive: (data: Result) => void) {
    setBusy(label); setError('');
    try {
      const response = await operation();
      if (response.error) setError(response.error.message);
      else if (response.data !== undefined) receive(response.data);
      else setError('El servidor no devolvio un resultado.');
    } catch {
      setError('Conexion interrumpida. Si estabas creando variables, revisa el workspace antes de reintentar.');
    } finally {
      setBusy(null);
    }
  }

  async function loadOrganizations() {
    setOrganization(''); setWorkspaceId(''); setWorkspaces([]); setOrganizations([]); resetDestination();
    await query('Consultando Terraform Cloud', () => actions.terraformOrganizations(), (data) => {
      setOrganizations(data);
      setNotice(data.length ? `${data.length} organizaciones de Terraform Cloud` : 'No hay organizaciones accesibles con este token.');
    });
  }

  async function chooseOrganization(value: string) {
    setOrganization(value); setWorkspaceId(''); setWorkspaces([]); resetDestination(); setError('');
    if (!value) return;
    await query('Consultando workspaces', () => actions.terraformWorkspaces({ organization: value }), (data) => {
      setWorkspaces(data);
      setNotice(data.length ? `${data.length} workspaces disponibles` : 'No hay workspaces accesibles en esta organizacion.');
    });
  }

  function receiveSnapshot(data: WorkspaceSnapshot) {
    requestId.current = null;
    setOutcomes([]); setRemoteVariables(data.variables); setSnapshotReady(true);
    setWorkspaces((current) => [...current.filter((item) => item.id !== data.workspace.id), data.workspace]);
    setDrafts((current) => reconcileDrafts(current, data.variables));
    setNotice(`${data.variables.length} variables existentes en el workspace.`);
  }

  async function chooseWorkspace(value: string) {
    setWorkspaceId(value); resetDestination(); setError('');
    if (!value) return;
    await query('Consultando variables del workspace', () => actions.terraformWorkspaceVariables({ organization, workspaceId: value }), receiveSnapshot);
  }

  async function refreshVariables() {
    setSnapshotReady(false);
    await query('Actualizando estado del workspace', () => actions.terraformWorkspaceVariables({ organization, workspaceId }), receiveSnapshot);
  }

  function review() {
    setError('');
    if (!workspace?.canWrite || !organization || !snapshotReady) { setError('Consulta un workspace con permisos de escritura antes de continuar.'); return; }
    if (!selected.length || selected.length > 100) { setError('Selecciona entre 1 y 100 variables por envio.'); return; }
    if (selected.some((draft) => !draft.key || (draft.operation !== 'delete' && !draft.value) || !/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(draft.key))) {
      setSearch(''); setError('Completa la clave y el valor de todas las variables seleccionadas.'); return;
    }
    const keys = selected.map((draft) => `${draft.category}:${draft.key}`);
    if (new Set(keys).size !== keys.length) { setError('Hay claves duplicadas en la misma categoria.'); return; }
    setConfirmed(false);
    setDeleteConfirmed(false);
    dialog.current?.showModal();
  }

  async function createVariables() {
    if (submitting.current || !confirmed || (deletions > 0 && !deleteConfirmed) || !workspace?.canWrite || !snapshotReady || !selected.length) return;
    submitting.current = true;
    onSubmitting(true);
    const submissionId = requestId.current ?? crypto.randomUUID();
    requestId.current = submissionId;
    try {
      await query('Aplicando cambios', () => actions.manageTerraformVariables({
        organization, workspaceId, requestId: submissionId, confirmed: true, operations: selected.map(operationFor),
      }), (data) => {
        const received = new Set(data.map(identity));
        const completed = new Set(data.filter((item) => ['created', 'updated', 'deleted', 'existing'].includes(item.status)).map(identity));
        setOutcomes((previous) => [...previous.filter((item) => !received.has(identity(item))), ...data]);
        setDrafts((current) => current.map((draft) => completed.has(identity(draft))
          ? { ...draft, value: draft.sensitive ? '' : draft.value, locked: true, included: false } : draft));
        setNotice(`${data.filter((item) => item.status === 'created').length} creadas; ${data.filter((item) => item.status === 'updated').length} actualizadas; ${data.filter((item) => item.status === 'deleted').length} eliminadas.`);
        if (data.some((item) => !completed.has(identity(item)))) setError('El envio no se completo para todas las variables. Revisa el resultado individual antes de reintentar.');
        requestId.current = null;
      });
    } finally {
      submitting.current = false;
      onSubmitting(false);
      dialog.current?.close();
    }
  }

  function download() {
    const entries = drafts.filter((draft) => draft.operation !== 'delete' && (draft.included || draft.locked)).map((draft) => ({
      ...attributes(draft), value: draft.sensitive && !exportSecrets ? '' : draft.value,
    }));
    const url = URL.createObjectURL(new Blob([formatVariables(entries, format)], { type: format === 'yaml' ? 'application/yaml' : 'application/json' }));
    const link = document.createElement('a');
    link.href = url; link.download = `${filename}.${format}`; link.click(); URL.revokeObjectURL(url);
  }

  return (
    <>
      <form onSubmit={(event) => { event.preventDefault(); review(); }} autoComplete="off">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 border-b border-neutral-200 pb-5">
          <label className="relative block min-w-0 flex-1 basis-64" htmlFor="variable-search">
            <span className="sr-only">Buscar variable</span><Search size={17} className="absolute top-3.5 left-3 text-neutral-500" aria-hidden="true" />
            <input id="variable-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar variable" className={`${control} mt-0 pl-10`} />
          </label>
          <label className="sr-only" htmlFor="download-format">Formato de descarga</label>
          <select id="download-format" value={format} onChange={(event) => setFormat(event.target.value === 'json' ? 'json' : 'yaml')} className="h-11 rounded-md border border-neutral-300 bg-white px-3 text-sm"><option value="yaml">YAML</option><option value="json">JSON API</option></select>
          <button type="button" disabled={busy !== null} onClick={download} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 text-sm font-semibold hover:bg-neutral-100 disabled:opacity-50"><Download size={17} aria-hidden="true" />Descargar</button>
          {drafts.some((draft) => draft.sensitive) && <label className="flex basis-full items-center gap-2 text-xs text-neutral-600"><input type="checkbox" checked={exportSecrets} onChange={(event) => setExportSecrets(event.target.checked)} className="size-4 accent-brand" />Incluir valores sensibles en la descarga</label>}
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200 pb-4">
          <label htmlFor="select-all-variables" className="inline-flex items-center gap-3 text-sm font-semibold">
            <input ref={selectAll} id="select-all-variables" type="checkbox" checked={allSelected}
              disabled={busy !== null || !selectable.length || (snapshotReady && !workspace?.canWrite)}
              onChange={(event) => toggleAll(event.target.checked)} className="size-4 accent-brand" />
            Seleccionar todas las variables
          </label>
          <span className="text-xs text-neutral-500">{selected.length} de {drafts.length} seleccionadas</span>
        </div>

        <div className="grid min-w-0 gap-9 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0">
            {drafts.map((draft, index) => {
              if (search && !draft.key.toLowerCase().includes(search.toLowerCase())) return null;
              const outcome = outcomes.find((item) => item.key === draft.key && item.category === draft.category);
              return <section key={draft.originalKey} className="min-w-0 border-b border-neutral-200 py-6 first:pt-0" data-variable={draft.originalKey}>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <label htmlFor={`include-${index}`} className="inline-flex min-w-0 items-center gap-3 font-semibold"><input id={`include-${index}`} type="checkbox" checked={draft.included} disabled={busy !== null || draft.locked || (snapshotReady && !workspace?.canWrite)} onChange={(event) => edit(index, { included: event.target.checked, operation: event.target.checked ? draft.existing ? 'update' : 'create' : draft.existing ? 'keep' : 'create' })} className="size-4 shrink-0 accent-brand" /><span className="break-all font-mono text-sm">{draft.originalKey}</span></label>
                  {outcome ? <span className={`inline-flex items-center gap-1 text-xs font-semibold ${draft.locked ? 'text-emerald-800' : 'text-red-800'}`}>{draft.locked && <Check size={14} aria-hidden="true" />}{statuses[outcome.status]}</span> : draft.sensitive && <span className="inline-flex items-center gap-1 text-xs text-neutral-500"><LockKeyhole size={14} aria-hidden="true" />Sensible</span>}
                </div>
                {snapshotReady && <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <span title={draft.existing ? 'Ya existe en el workspace seleccionado' : 'Declarada en el archivo, pero no existe en el workspace seleccionado'} className={`text-xs font-semibold ${draft.existing ? 'text-emerald-800' : 'text-amber-800'}`}>{draft.existing ? 'En workspace' : 'Solo en archivo'}</span>
                  {draft.existing && <label className="flex items-center gap-2 text-sm" htmlFor={`operation-${index}`}><span>Accion</span><select id={`operation-${index}`} aria-label={`Accion para ${draft.originalKey}`} value={draft.operation} disabled={busy !== null || draft.locked || !workspace?.canWrite} onChange={(event) => { const operation = event.target.value === 'delete' ? 'delete' : event.target.value === 'update' ? 'update' : 'keep'; edit(index, { operation, included: operation !== 'keep' }); }} className="h-10 rounded-md border border-neutral-300 bg-white px-3 disabled:opacity-50"><option value="keep">Conservar</option><option value="update">Actualizar</option><option value="delete">Eliminar</option></select></label>}
                </div>}
                {draft.operation === 'delete' && <p className="mb-4 border-l-4 border-red-700 bg-red-50 px-3 py-2 text-sm text-red-900">Se eliminara esta variable del workspace al confirmar los cambios.</p>}
                <fieldset disabled={busy !== null || !draft.included || draft.locked || draft.operation === 'delete' || (snapshotReady && !workspace?.canWrite)} className="grid min-w-0 gap-5 sm:grid-cols-2">
                  <legend className="sr-only">Campos de {draft.originalKey}</legend>
                  <label className="min-w-0 text-sm font-medium" htmlFor={`key-${index}`}><span>Clave (key)</span><input id={`key-${index}`} className={control} value={draft.key} readOnly={Boolean(draft.existing)} maxLength={128} required pattern={'[a-zA-Z_][a-zA-Z0-9_\\-]*'} onChange={(event) => edit(index, { key: event.target.value })} /></label>
                  <label className="min-w-0 text-sm font-medium" htmlFor={`category-${index}`}><span>Categoria</span><select id={`category-${index}`} className={control} value={draft.category} disabled={Boolean(draft.existing)} onChange={(event) => edit(index, { category: event.target.value === 'env' ? 'env' : 'terraform', hcl: event.target.value === 'env' ? false : draft.hcl })}><option value="terraform">Terraform</option><option value="env">Entorno</option></select></label>
                  <label className="min-w-0 text-sm font-medium sm:col-span-2" htmlFor={`value-${index}`}><span>Valor (value)</span>
                    {draft.sensitive ? <input id={`value-${index}`} aria-label={`Valor de ${draft.originalKey}`} type="password" autoComplete="new-password" className={control} value={draft.value} maxLength={262144} required={!draft.locked} onChange={(event) => edit(index, { value: event.target.value })} />
                      : <textarea id={`value-${index}`} aria-label={`Valor de ${draft.originalKey}`} className={`${control} resize-y font-mono`} rows={draft.hcl ? 4 : 2} value={draft.value} maxLength={262144} required onChange={(event) => edit(index, { value: event.target.value })} />}
                  </label>
                  <label className="min-w-0 text-sm font-medium sm:col-span-2" htmlFor={`description-${index}`}><span>Descripcion</span><textarea id={`description-${index}`} className={`${control} resize-y`} rows={2} value={draft.description} maxLength={2048} onChange={(event) => edit(index, { description: event.target.value })} /></label>
                  <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.hcl} disabled={draft.category === 'env'} onChange={(event) => edit(index, { hcl: event.target.checked })} className="size-4 accent-brand" />Evaluar como HCL</label>
                  <label className="inline-flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.sensitive} onChange={(event) => edit(index, { sensitive: event.target.checked })} className="size-4 accent-brand" />Sensible</label>
                </fieldset>
                {outcome && <p className="mt-4 text-sm text-neutral-600">{outcome.message}</p>}
              </section>;
            })}
            {search && !drafts.some((draft) => draft.key.toLowerCase().includes(search.toLowerCase())) && <p className="py-12 text-center text-sm text-neutral-500">Sin coincidencias</p>}
          </div>

          <aside className="min-w-0 self-start border-t border-neutral-200 pt-6 xl:sticky xl:top-6 xl:border-t-0 xl:border-l xl:pt-0 xl:pl-6" aria-labelledby="destination-title">
            <div className="mb-5 flex items-center justify-between gap-3"><h3 id="destination-title" className="text-lg font-semibold">Terraform Cloud</h3><button type="button" onClick={() => void (workspaceId ? refreshVariables() : loadOrganizations())} disabled={busy !== null} aria-label={workspaceId ? 'Consultar variables del workspace' : 'Consultar organizaciones Terraform Cloud'} title={workspaceId ? 'Consultar variables del workspace' : 'Consultar organizaciones Terraform Cloud'} className="inline-flex size-10 shrink-0 items-center justify-center rounded-md border border-neutral-300 bg-white hover:bg-neutral-100 disabled:opacity-50"><RefreshCw size={17} aria-hidden="true" /></button></div>
            <div className="space-y-5">
              {destination && <p className="break-all text-xs leading-5 text-neutral-600">providers.tf: <strong>{destination.organization} / {destination.workspaceName}</strong></p>}
              {destinationError && <p role="alert" className="border-l-4 border-amber-600 bg-amber-50 p-3 text-sm text-amber-950">{destinationError}</p>}
              <label className="block text-sm font-medium" htmlFor="terraform-organization"><span>Organizacion destino</span><select id="terraform-organization" className={control} value={organization} disabled={busy !== null || !organizations.length} onChange={(event) => void chooseOrganization(event.target.value)}><option value="">Seleccionar organizacion</option>{organizations.map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
              <label className="block text-sm font-medium" htmlFor="terraform-workspace"><span>Workspace</span><select id="terraform-workspace" className={control} value={workspaceId} disabled={busy !== null || !workspaces.length} onChange={(event) => void chooseWorkspace(event.target.value)}><option value="">Seleccionar workspace</option>{workspaces.map((item) => <option key={item.id} value={item.id}>{item.name}{item.canWrite ? '' : ' (solo lectura)'}</option>)}</select></label>
              {destination && organization && workspace && (organization !== destination.organization || workspace.name !== destination.workspaceName) && <p className="border-l-4 border-amber-600 bg-amber-50 p-3 text-sm text-amber-950">El destino manual difiere de providers.tf.</p>}
              <button type="button" onClick={() => void loadOrganizations()} disabled={busy !== null} className="text-sm font-semibold text-brand underline underline-offset-4 disabled:opacity-50">Cambiar destino</button>
              {workspace && <p className="break-all font-mono text-xs text-neutral-500">{workspace.id}</p>}
              <div className="flex items-center justify-between border-y border-neutral-200 py-4 text-sm"><span>Variables seleccionadas</span><strong>{selected.length} / {drafts.length}</strong></div>
              <button type="submit" className={`${primary} w-full`} disabled={busy !== null || !selected.length || !workspace?.canWrite || !snapshotReady}><ArrowUpRight size={17} aria-hidden="true" />Revisar cambios</button>
              {(busy || notice) && <p role="status" className="flex items-center gap-2 text-sm text-neutral-600">{busy && <LoaderCircle size={16} className="shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />}{busy ?? notice}</p>}
              {error && <p role="alert" className="border-l-4 border-brand bg-red-50 p-3 text-sm text-red-900">{error}</p>}
            </div>
          </aside>
        </div>
      </form>

      <dialog ref={dialog} aria-labelledby="confirm-title" aria-describedby="confirm-description" onCancel={(event) => { if (submitting.current) event.preventDefault(); }} className="fixed inset-0 m-auto max-h-[90svh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-lg border border-neutral-300 bg-white p-6 text-ink shadow-xl backdrop:bg-black/40">
        <div className="mb-5 flex items-center justify-between gap-3"><h2 id="confirm-title" className="text-xl font-semibold">Confirmar cambios</h2><button type="button" disabled={busy !== null} aria-label="Cerrar confirmacion" title="Cerrar confirmacion" onClick={() => dialog.current?.close()} className="inline-flex size-9 items-center justify-center rounded hover:bg-neutral-100 disabled:opacity-50"><X size={18} aria-hidden="true" /></button></div>
        <p id="confirm-description" className="text-sm leading-6 text-neutral-600">Destino: <strong className="break-all text-ink">{organization} / {workspace?.name}</strong>. Se crearan {selected.filter((draft) => draft.operation === 'create').length}, actualizaran {selected.filter((draft) => draft.operation === 'update').length} y eliminaran {deletions} variables.</p>
        <ul className="my-5 max-h-48 space-y-2 overflow-auto border-y border-neutral-200 py-4 text-sm">{selected.map((draft) => <li key={`${draft.category}:${draft.key}`} className="flex items-center justify-between gap-3"><span className="break-all font-mono">{draft.key}</span><span className={`shrink-0 text-xs font-semibold ${draft.operation === 'delete' ? 'text-red-800' : 'text-neutral-600'}`}>{draft.operation === 'delete' ? 'Eliminar' : draft.operation === 'update' ? 'Actualizar' : 'Crear'}</span></li>)}</ul>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={confirmed} disabled={busy !== null} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-brand" />Confirmo el workspace y los cambios seleccionados.</label>
        {deletions > 0 && <label className="mt-4 flex items-start gap-3 text-sm text-red-900"><input type="checkbox" checked={deleteConfirmed} disabled={busy !== null} onChange={(event) => setDeleteConfirmed(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-brand" />Confirmo la eliminacion de {deletions} variables.</label>}
        <div className="mt-6 flex flex-wrap justify-end gap-3"><button type="button" disabled={busy !== null} onClick={() => dialog.current?.close()} className="min-h-11 rounded-md border border-neutral-300 px-4 text-sm disabled:opacity-50">Cancelar</button><button type="button" disabled={!confirmed || (deletions > 0 && !deleteConfirmed) || busy !== null} onClick={() => void createVariables()} className={primary}>{busy ? <LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ArrowUpRight size={17} aria-hidden="true" />}Aplicar cambios</button></div>
      </dialog>
    </>
  );
}
