import { useState } from 'react';
import { actions } from 'astro:actions';
import { Building2, FileCode2, GitBranch, LoaderCircle, RefreshCw } from 'lucide-react';
import type { Repository, VariableFile, VariablePath, VariableResult } from '../lib/contracts';
import VariableEditor from './VariableEditor';

interface Props {
  enterprise: string;
}

interface Organization {
  login: string;
  name: string | null;
}

const selectClass = 'mt-2 block h-11 w-full min-w-0 truncate rounded-md border border-neutral-300 bg-white px-3 text-sm disabled:cursor-not-allowed disabled:bg-neutral-100 disabled:text-neutral-500';

export default function InfrastructureExplorer({ enterprise }: Props) {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [files, setFiles] = useState<VariableFile[]>([]);
  const [organization, setOrganization] = useState('');
  const [repository, setRepository] = useState('');
  const [branch, setBranch] = useState('');
  const [path, setPath] = useState<VariablePath | ''>('');
  const [result, setResult] = useState<VariableResult | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('Sin consulta');

  function clearResult() {
    setResult(null);
  }

  async function query<Result>(
    label: string,
    request: () => Promise<{ data?: Result; error?: { message: string } }>,
    receive: (data: Result) => void,
  ) {
    setPending(label);
    setError('');
    try {
      const response = await request();
      if (response.error) {
        setError(response.error.message);
        setNotice('Consulta no completada');
      } else if (response.data !== undefined) {
        receive(response.data);
      } else {
        setError('El servidor no devolvio un resultado.');
      }
    } catch {
      setError('No se pudo contactar con el servidor. Reintenta la consulta.');
      setNotice('Sin conexion');
    } finally {
      setPending(null);
    }
  }

  async function loadOrganizations() {
    setOrganization(''); setRepository(''); setBranch(''); setPath('');
    setOrganizations([]); setRepositories([]); setBranches([]); setFiles([]); clearResult();
    await query('Consultando organizaciones', () => actions.organizations(), (data) => {
      setOrganizations(data);
      setNotice(data.length ? `${data.length} organizaciones disponibles` : 'No hay organizaciones accesibles en este enterprise.');
    });
  }

  async function selectOrganization(value: string) {
    setOrganization(value); setRepository(''); setBranch(''); setPath('');
    setRepositories([]); setBranches([]); setFiles([]); clearResult(); setError('');
    if (!value) { setNotice('Selecciona una organizacion'); return; }
    await query('Consultando repositorios', () => actions.repositories({ organization: value }), (data) => {
      setRepositories(data);
      setNotice(data.length ? `${data.length} repositorios IaC disponibles` : 'No hay repositorios accesibles con IaC, Infra o Tf en el nombre.');
    });
  }

  async function selectRepository(value: string) {
    setRepository(value); setBranch(''); setPath('');
    setBranches([]); setFiles([]); clearResult(); setError('');
    if (!value) { setNotice('Selecciona un repositorio'); return; }
    await query('Consultando ramas', () => actions.branches({ organization, repository: value }), (data) => {
      setBranches(data);
      setNotice(data.length ? `${data.length} ramas disponibles` : 'El repositorio no tiene ramas disponibles.');
    });
  }

  async function selectBranch(value: string) {
    setBranch(value); setPath(''); setFiles([]); clearResult(); setError('');
    if (!value) { setNotice('Selecciona una rama'); return; }
    await query('Buscando archivos de variables', () => actions.variableFiles({ organization, repository, branch: value }), (data) => {
      setFiles(data);
      setNotice(data.length ? `${data.length} archivos de variables disponibles` : 'No se encontraron variables.tf en las rutas Develop, Staging o Production.');
    });
  }

  async function selectFile(value: string) {
    const file = files.find((item) => item.path === value);
    setPath(file?.path ?? ''); clearResult(); setError('');
    if (!file) { setNotice('Selecciona un archivo'); return; }
    await query('Leyendo variables', () => actions.variables({ organization, repository, branch, path: file.path }), (data) => {
      setResult(data);
      setNotice(data.variables.length ? `${data.variables.length} variables encontradas` : 'El archivo no declara bloques variable.');
    });
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-start justify-between gap-5 border-b border-neutral-200 pb-7">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm text-neutral-600"><Building2 size={16} aria-hidden="true" />{enterprise}</div>
          <h1 className="text-2xl font-bold sm:text-3xl">Variables de infraestructura</h1>
        </div>
        <button type="button" onClick={() => void loadOrganizations()} disabled={pending !== null}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:brightness-90 disabled:cursor-wait disabled:opacity-60">
          {pending ? <LoaderCircle size={17} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <RefreshCw size={17} aria-hidden="true" />}
          Consultar organizaciones
        </button>
      </div>

      <div className="grid min-w-0 gap-x-5 gap-y-6 border-b border-neutral-200 py-7 sm:grid-cols-2 xl:grid-cols-4" aria-busy={pending !== null}>
        <label className="min-w-0 text-sm font-semibold" htmlFor="organization">Organizacion
          <select id="organization" className={selectClass} value={organization} disabled={pending !== null || !organizations.length} onChange={(event) => void selectOrganization(event.target.value)}>
            <option value="">Seleccionar organizacion</option>
            {organizations.map((item) => <option key={item.login} value={item.login}>{item.login}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-sm font-semibold" htmlFor="repository">Repositorio IaC
          <select id="repository" className={selectClass} value={repository} disabled={pending !== null || !repositories.length} onChange={(event) => void selectRepository(event.target.value)}>
            <option value="">Seleccionar repositorio</option>
            {repositories.map((item) => <option key={item.name} value={item.name}>{item.name}{item.private ? ' (privado)' : ''}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-sm font-semibold" htmlFor="branch">Rama
          <select id="branch" className={selectClass} value={branch} disabled={pending !== null || !branches.length} onChange={(event) => void selectBranch(event.target.value)}>
            <option value="">Seleccionar rama</option>
            {branches.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        </label>
        <label className="min-w-0 text-sm font-semibold" htmlFor="variable-file">Archivo de variables
          <select id="variable-file" className={selectClass} value={path} disabled={pending !== null || !files.length} onChange={(event) => void selectFile(event.target.value)}>
            <option value="">Seleccionar archivo</option>
            {files.map((file) => <option key={file.path} value={file.path}>{file.environment} / variables.tf</option>)}
          </select>
        </label>
      </div>

      <div className="min-h-14 py-4 text-sm text-neutral-600" role="status" aria-live="polite">
        <span className="inline-flex items-center gap-2">
          {pending && <LoaderCircle size={16} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          {pending ?? notice}
        </span>
      </div>
      {error && <div role="alert" className="mb-5 border-l-4 border-brand bg-red-50 px-4 py-3 text-sm text-red-900">{error}</div>}

      {result && <section className="min-w-0 py-3" aria-labelledby="preview-title">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <h2 id="preview-title" className="inline-flex items-center gap-2 text-lg font-semibold"><FileCode2 size={20} aria-hidden="true" />Variables</h2>
          {result && <span className="inline-flex max-w-full items-center gap-2 text-xs text-neutral-500"><GitBranch size={14} aria-hidden="true" /><span className="truncate" title={result.commit}>{result.commit.slice(0, 12)}</span></span>}
        </div>
        {result && <p className="mb-5 break-all font-mono text-xs text-neutral-600">{result.path}</p>}

        {result?.variables.length ? <VariableEditor
          key={`${organization}/${repository}/${result.commit}/${result.path}`}
          variables={result.variables}
          destination={result.destination}
          destinationError={result.destinationError}
          filename={`${repository}-${files.find((file) => file.path === path)?.environment ?? 'variables'}`}
          onSubmitting={(submitting) => setPending(submitting ? 'Creando variables en Terraform Cloud' : null)}
        /> : <div className="border-t border-neutral-200 px-5 py-8 text-center text-sm text-neutral-500">Sin variables declaradas</div>}
      </section>}
    </div>
  );
}
