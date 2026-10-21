import { defineMiddleware, sequence } from 'astro:middleware';
import { clerkMiddleware } from '@clerk/astro/server';
import { getActionContext } from 'astro:actions';
import { hasInfrastructureAccess } from './lib/organization-access';

const securityHeaders = defineMiddleware(async (_context, next) => {
  const response = await next();
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
});

const protectActions = defineMiddleware((context, next) => {
  const { action } = getActionContext(context);
  const isAction = context.url.pathname === '/_actions' || context.url.pathname.startsWith('/_actions/');
  if (!action && !isAction) return next();
  const auth = context.locals.auth();
  if (!auth.userId) {
    return Response.json({
      type: 'AstroActionError', code: 'UNAUTHORIZED', status: 401,
      message: 'Inicia sesion para consultar o modificar la infraestructura.',
    }, { status: 401 });
  }
  if (!hasInfrastructureAccess(auth)) {
    return Response.json({
      type: 'AstroActionError', code: 'FORBIDDEN', status: 403,
      message: 'Contacta al administrador para la asignacion de organizacion: jose.toledano@axity.com',
    }, { status: 403 });
  }
  return next();
});

export const onRequest = sequence(securityHeaders, clerkMiddleware(), protectActions);
