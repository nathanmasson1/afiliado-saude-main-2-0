/**
 * logout.ts — Admin logout com Set-Cookie + redirect atômico
 *
 * Aceita GET e POST. Retorna 302 Location: /admin/login junto com
 * Set-Cookie para apagar `admin_session`. Browser processa tudo em
 * uma única resposta, evitando race condition onde o cookie antigo
 * viajava junto com o navigation request seguinte.
 */

import type { APIRoute } from 'astro';

export const prerender = false;

const COOKIE_NAME = 'admin_session';

function buildClearCookieHeaders() {
    const expired = 'Thu, 01 Jan 1970 00:00:00 GMT';
    // Apaga em todos os paths relevantes
    return [
        `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=${expired}`,
    ];
}

function redirectResponse() {
    const headers = new Headers();
    headers.set('Location', '/admin/login');
    for (const cookie of buildClearCookieHeaders()) {
        headers.append('Set-Cookie', cookie);
    }
    // Cache-Control impede o browser de reutilizar a resposta
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    headers.set('Clear-Site-Data', '"cookies", "storage"');
    return new Response(null, { status: 302, headers });
}

export const GET: APIRoute = async () => redirectResponse();
export const POST: APIRoute = async () => redirectResponse();
