/**
 * wordpress-api.ts — API endpoint for WP Importer
 *
 * Aceita JSON (dados parseados no browser, sem limite de tamanho)
 * ou FormData (legado, limitado a 4.5MB pelo Vercel).
 */

import type { APIRoute } from 'astro';
import { validateSession } from '../../../../../lib/auth';
import { importWordPressXML, importParsedData } from '../../../../../plugins/wp-importer/wordpress-importer';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        // Auth
        const cookieHeader = request.headers.get('cookie') || '';
        const cookies = Object.fromEntries(
            cookieHeader.split(';').map(c => { const [k, ...v] = c.trim().split('='); return [k, decodeURIComponent(v.join('='))]; })
        );
        if (!await validateSession(cookies['admin_session'])) {
            return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401 });
        }

        const contentType = request.headers.get('content-type') || '';

        // ── JSON mode (client-side parsing, no size limit) ──────────
        if (contentType.includes('application/json')) {
            const data = await request.json();

            if (!data.posts || !Array.isArray(data.posts)) {
                return new Response(JSON.stringify({ error: 'Dados inválidos.' }), {
                    status: 400, headers: { 'Content-Type': 'application/json' },
                });
            }

            console.log(`[WP Import] JSON mode: ${data.posts.length} posts, ${data.categories?.length || 0} categorias, ${data.authors?.length || 0} autores`);

            const result = await importParsedData(data);

            console.log(`[WP Import] Concluído: ${result.posts.imported} posts, ${result.authors.imported} autores, ${result.categories.imported} categorias`);

            return new Response(JSON.stringify(result), {
                status: result.success ? 200 : 422,
                headers: { 'Content-Type': 'application/json' },
            });
        }

        // ── FormData mode (legacy, file upload) ─────────────────────
        const formData = await request.formData();
        const file = formData.get('file') as File | null;

        if (!file) {
            return new Response(JSON.stringify({ error: 'Arquivo não enviado.' }), {
                status: 400, headers: { 'Content-Type': 'application/json' },
            });
        }

        const filename = file.name || '';
        if (!filename.endsWith('.xml') && !file.type.includes('xml')) {
            return new Response(JSON.stringify({ error: 'O arquivo deve ser um XML exportado do WordPress.' }), {
                status: 400, headers: { 'Content-Type': 'application/json' },
            });
        }

        const xmlContent = await file.text();
        if (!xmlContent?.trim()) {
            return new Response(JSON.stringify({ error: 'Arquivo XML vazio.' }), {
                status: 400, headers: { 'Content-Type': 'application/json' },
            });
        }

        console.log(`[WP Import] FormData mode: ${filename} (${xmlContent.length} chars)`);

        const result = await importWordPressXML(xmlContent);

        return new Response(JSON.stringify(result), {
            status: result.success ? 200 : 422,
            headers: { 'Content-Type': 'application/json' },
        });
    } catch (error: any) {
        console.error('[WP Import] Erro fatal:', error);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Erro interno ao processar importação',
            posts: { imported: 0, skipped: 0, errors: [], imagesImported: 0 },
            authors: { imported: 0, skipped: 0 },
            categories: { imported: 0, skipped: 0 },
            errors: [error.message || 'Erro desconhecido'],
        }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
        });
    }
};
