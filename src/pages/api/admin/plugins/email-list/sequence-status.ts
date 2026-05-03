/**
 * api/admin/plugins/email-list/sequence-status.ts
 *
 * GET — Retorna stats agregados dos envios de sequência por sequenceIndex.
 * Requer sessão admin válida.
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
            return json({ success: false, message: 'Não autorizado.' }, 401);
        }

        const raw = await readFileFromRepo('src/data/emailsSent.json');
        const emailsSent: Array<{
            email: string;
            sequenceIndex: number;
            sentAt: string;
            success: boolean;
        }> = raw ? JSON.parse(raw) : [];

        // Agrega por sequenceIndex
        const statsMap = new Map<number, { sent: number; failed: number; lastSentAt: string }>();

        for (const record of emailsSent) {
            const idx = record.sequenceIndex;
            const existing = statsMap.get(idx) ?? { sent: 0, failed: 0, lastSentAt: '' };

            if (record.success) {
                existing.sent++;
            } else {
                existing.failed++;
            }

            if (!existing.lastSentAt || record.sentAt > existing.lastSentAt) {
                existing.lastSentAt = record.sentAt;
            }

            statsMap.set(idx, existing);
        }

        const stats = Array.from(statsMap.entries())
            .sort(([a], [b]) => a - b)
            .map(([sequenceIndex, data]) => ({ sequenceIndex, ...data }));

        // lastRunAt = data mais recente de qualquer envio
        const lastRunAt = emailsSent.length > 0
            ? emailsSent.reduce((max, r) => r.sentAt > max ? r.sentAt : max, '')
            : null;

        return json({ stats, lastRunAt });
    } catch (err: any) {
        return json({ success: false, message: err.message }, 500);
    }
};
