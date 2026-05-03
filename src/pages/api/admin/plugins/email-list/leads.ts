/**
 * api/admin/plugins/email-list/leads.ts
 *
 * GET — Retorna todos os subscribers de subscribers.json
 */

import type { APIRoute } from 'astro';
import { validateSession } from '../../../../../lib/auth';
import { readFileFromRepo } from '../../../../../plugins/_server';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
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
            return json({ error: 'Não autorizado.' }, 401);
        }

        const raw = await readFileFromRepo('src/data/subscribers.json');
        const subscribers = raw ? JSON.parse(raw) : [];

        return json({ subscribers });
    } catch (err: any) {
        return json({ error: err.message }, 500);
    }
};
