/**
 * api/admin/plugins/search-console/test-connection.ts
 *
 * POST — Testa as credenciais do Service Account e acesso ao site no GSC.
 */

import type { APIRoute } from 'astro';
import { validateSession } from '../../../../../lib/auth';
import { parseServiceAccountJson, getAccessToken, verifySiteAccess } from '../../../../../plugins/search-console/gsc-api';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const cookieHeader = request.headers.get('cookie') || '';
        const cookies = Object.fromEntries(
            cookieHeader.split(';').map(c => {
                const [k, ...v] = c.trim().split('=');
                return [k, decodeURIComponent(v.join('='))];
            })
        );
        if (!await validateSession(cookies['admin_session'])) {
            return new Response(JSON.stringify({ success: false, message: 'Não autorizado.' }), {
                status: 401, headers: { 'Content-Type': 'application/json' },
            });
        }

        const { serviceAccountJson, siteUrl } = await request.json();

        if (!serviceAccountJson?.trim()) {
            return new Response(JSON.stringify({ success: false, message: 'Cole o JSON do service account antes de testar.' }), {
                status: 400, headers: { 'Content-Type': 'application/json' },
            });
        }
        if (!siteUrl?.trim()) {
            return new Response(JSON.stringify({ success: false, message: 'Informe a URL do site.' }), {
                status: 400, headers: { 'Content-Type': 'application/json' },
            });
        }

        const credentials = parseServiceAccountJson(serviceAccountJson);
        const token = await getAccessToken(credentials);
        const permissionLevel = await verifySiteAccess(siteUrl.trim(), token);

        return new Response(JSON.stringify({
            success: true,
            message: `Conectado com sucesso! Nível de acesso: ${permissionLevel}.`,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (err: any) {
        return new Response(JSON.stringify({ success: false, message: err.message }), {
            status: 400, headers: { 'Content-Type': 'application/json' },
        });
    }
};
