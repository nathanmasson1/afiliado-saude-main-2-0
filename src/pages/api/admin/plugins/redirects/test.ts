/**
 * API Route: /api/admin/plugins/redirects/test
 *
 * GET ?path=/old-url — testa se o redirect funciona
 * Faz HEAD request pro path e retorna o status + location
 */
import type { APIRoute } from 'astro';
import { readDataFile } from '../../../../../plugins/_server';

export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
    try {
        const path = url.searchParams.get('path');
        if (!path) {
            return new Response(JSON.stringify({ error: 'path obrigatório' }), { status: 400 });
        }

        // Read siteConfig for site URL
        const siteConfig = readDataFile('siteConfig.json', { url: '' });
        const siteUrl = siteConfig.url?.replace(/\/$/, '') || url.origin;

        const testUrl = path.startsWith('http') ? path : `${siteUrl}${path.startsWith('/') ? '' : '/'}${path}`;

        const res = await fetch(testUrl, {
            method: 'HEAD',
            redirect: 'manual',
            headers: { 'User-Agent': 'RedirectTester/1.0' },
        });

        const location = res.headers.get('location') || '';
        const isRedirect = res.status >= 300 && res.status < 400;

        return new Response(JSON.stringify({
            ok: isRedirect,
            status: res.status,
            location,
            tested: testUrl,
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (err: any) {
        return new Response(JSON.stringify({ ok: false, status: 0, error: err.message }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });
    }
};
