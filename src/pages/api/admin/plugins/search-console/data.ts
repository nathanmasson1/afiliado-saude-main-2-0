/**
 * api/admin/plugins/search-console/data.ts
 *
 * GET — Retorna dados da Search Analytics API do GSC.
 *
 * Query params:
 *   days=28      (7 | 28 | 90)
 */

import type { APIRoute } from 'astro';
import { validateSession } from '../../../../../lib/auth';
import { readPluginsConfig } from '../../../../../plugins/_server';
import { parseServiceAccountJson, querySearchAnalytics } from '../../../../../plugins/search-console/gsc-api';

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
    try {
        const cookieHeader = request.headers.get('cookie') || '';
        const cookies = Object.fromEntries(
            cookieHeader.split(';').map(c => {
                const [k, ...v] = c.trim().split('=');
                return [k, decodeURIComponent(v.join('='))];
            })
        );
        if (!await validateSession(cookies['admin_session'])) {
            return new Response(JSON.stringify({ error: 'Não autorizado.' }), {
                status: 401, headers: { 'Content-Type': 'application/json' },
            });
        }

        const url = new URL(request.url);
        const days = Math.min(90, Math.max(1, parseInt(url.searchParams.get('days') || '28')));

        const config = readPluginsConfig();
        const gsc = config?.searchConsole;

        if (!gsc?.serviceAccountJson?.trim() || !gsc?.siteUrl?.trim()) {
            return new Response(JSON.stringify({ error: 'Search Console não configurado. Adicione o service account e a URL do site.' }), {
                status: 400, headers: { 'Content-Type': 'application/json' },
            });
        }

        const credentials = parseServiceAccountJson(gsc.serviceAccountJson);
        const siteUrl = gsc.siteUrl.trim();

        // GSC tem ~3 dias de lag — ajusta endDate
        const endDate = new Date(Date.now() - 3 * 86400000).toISOString().split('T')[0];
        const startDate = new Date(Date.now() - (days + 3) * 86400000).toISOString().split('T')[0];

        const [queryRows, pageRows] = await Promise.all([
            querySearchAnalytics(siteUrl, credentials, { dimensions: ['query'], startDate, endDate, rowLimit: 10 }),
            querySearchAnalytics(siteUrl, credentials, { dimensions: ['page'], startDate, endDate, rowLimit: 10 }),
        ]);

        // Totais para os cards de resumo
        const totals = await querySearchAnalytics(siteUrl, credentials, {
            dimensions: ['query'], startDate, endDate, rowLimit: 25000,
        });
        const totalClicks = totals.reduce((s, r) => s + r.clicks, 0);
        const totalImpressions = totals.reduce((s, r) => s + r.impressions, 0);
        const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0;
        const avgPosition = totals.length > 0
            ? totals.reduce((s, r) => s + r.position * r.impressions, 0) / Math.max(totalImpressions, 1)
            : 0;

        return new Response(JSON.stringify({
            summary: { totalClicks, totalImpressions, avgCtr, avgPosition },
            queries: queryRows,
            pages: pageRows,
            period: { startDate, endDate, days },
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500, headers: { 'Content-Type': 'application/json' },
        });
    }
};
