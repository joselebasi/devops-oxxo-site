import type { APIRoute } from 'astro';
import { getTechnology } from '../../lib/checklists';
import { hasInfrastructureAccess } from '../../lib/organization-access';
import { createChecklistWorkbook } from '../../lib/server/checklist-excel';

export const GET: APIRoute = async ({ locals, url }) => {
  const auth = locals.auth();
  if (!auth.userId) return new Response('Inicia sesion para descargar el checklist.', { status: 401 });
  if (!hasInfrastructureAccess(auth)) return new Response('No tienes acceso a este checklist.', { status: 403 });

  const technology = getTechnology(url.searchParams.get('tecnologia'));
  if (!technology) return new Response('Selecciona una tecnologia valida.', { status: 400 });

  try {
    const buffer = await createChecklistWorkbook(technology.id);
    return new Response(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="checklist-${technology.id}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new Response('No se pudo generar el Excel. Intenta de nuevo.', { status: 500 });
  }
};
