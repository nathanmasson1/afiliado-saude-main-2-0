/**
 * api/admin/plugins/email-list/test-brevo.ts
 *
 * POST — Testa conexão com Brevo usando a API Key fornecida
 */

import type { APIRoute } from 'astro';
import { validateSession } from '../../../../../lib/auth';
import { testConnection } from '../../../../../plugins/email-list/brevo-api';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    const json = (data: any, status = 200) =>
        new Response(JSON.stringify(data), {
            status,
            headers: { 'Content-Type': 'application/json' },
        });

    try {
        const cookieHeader = request.headers.get('cookie') || '';
        const cookies = Object.fromEntries(
            cookieHeader.split(';').map(c => {
                const [k, ...v] = c.trim().split('=');
                return [k, decodeURIComponent(v.join('='))];
            })
        );
        if (!await validateSession(cookies['admin_session'])) {
            return json({ success: false, message: 'Não autorizado.' }, 401);
        }

        const { apiKey } = await request.json();
        if (!apiKey?.trim()) {
            return json({ success: false, message: 'Informe a API Key do Brevo.' }, 400);
        }

        const result = await testConnection(apiKey.trim());
        return json(result, result.success ? 200 : 400);
    } catch (err: any) {
        return json({ success: false, message: err.message }, 500);
    }
};
