/**
 * api/cron/process-sequences.ts
 *
 * GET — Processado pelo Vercel Cron diariamente às 08:00 UTC.
 * Itera subscribers x sequences e envia emails conforme delayDays.
 *
 * Autenticação: Authorization: Bearer CRON_SECRET (env var do Vercel)
 */

import type { APIRoute } from 'astro';
import { readPluginsConfig, readDataFile, readFileFromRepo, writeFileToRepo } from '../../../plugins/_server';
import { sendTransactionalEmail } from '../../../plugins/email-list/brevo-api';

export const prerender = false;

const MAX_SENDS_PER_RUN = 250; // Brevo free tier: 300/dia — margem de segurança

export const GET: APIRoute = async ({ request }) => {
    const json = (data: any, status = 200) =>
        new Response(JSON.stringify(data), {
            status,
            headers: { 'Content-Type': 'application/json' },
        });

    // Autenticação via CRON_SECRET
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = request.headers.get('authorization') || '';
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return json({ success: false, message: 'Não autorizado.' }, 401);
    }

    try {
        const config = readPluginsConfig();
        const sequences: Array<{ subject: string; body: string; delayDays: number }> =
            config?.emailList?.sequences ?? [];
        const apiKey: string = config?.emailList?.brevoApiKey ?? '';

        if (sequences.length === 0) return json({ processed: 0, sent: 0, failed: 0, reason: 'no_sequences' });
        if (!apiKey) return json({ processed: 0, sent: 0, failed: 0, reason: 'no_api_key' });

        const siteConfig = readDataFile<any>('siteConfig.json', {});
        const senderEmail: string = siteConfig?.contact?.email ?? '';
        const senderName: string = siteConfig?.name ?? 'Newsletter';

        if (!senderEmail) return json({ processed: 0, sent: 0, failed: 0, reason: 'no_sender_email' });

        // Lê subscribers
        const subsRaw = await readFileFromRepo('src/data/subscribers.json');
        const subscribers: Array<{ email: string; subscribedAt: string }> = subsRaw
            ? JSON.parse(subsRaw)
            : [];

        if (subscribers.length === 0) return json({ processed: 0, sent: 0, failed: 0, reason: 'no_subscribers' });

        // Lê histórico de envios
        const sentRaw = await readFileFromRepo('src/data/emailsSent.json');
        const emailsSent: Array<{
            email: string;
            sequenceIndex: number;
            sentAt: string;
            success: boolean;
        }> = sentRaw ? JSON.parse(sentRaw) : [];

        // Monta Set de chaves já enviadas com sucesso
        const sentSet = new Set<string>(
            emailsSent
                .filter(r => r.success)
                .map(r => `${r.email}::${r.sequenceIndex}`)
        );

        const now = Date.now();
        const MS_PER_DAY = 24 * 60 * 60 * 1000;

        const newRecords: typeof emailsSent = [];
        let sent = 0;
        let failed = 0;
        let processed = 0;

        outer: for (const sub of subscribers) {
            const subscribedAt = new Date(sub.subscribedAt).getTime();
            if (isNaN(subscribedAt)) continue;
            const daysSince = (now - subscribedAt) / MS_PER_DAY;

            for (let idx = 0; idx < sequences.length; idx++) {
                // Proteção contra reordenamento de sequences
                if (idx >= sequences.length) continue;

                const seq = sequences[idx];
                const key = `${sub.email}::${idx}`;

                if (daysSince < seq.delayDays) continue;
                if (sentSet.has(key)) continue;

                processed++;
                if (sent >= MAX_SENDS_PER_RUN) break outer;

                const htmlContent = seq.body
                    .split('\n')
                    .map(line => `<p>${line}</p>`)
                    .join('');

                const result = await sendTransactionalEmail(
                    apiKey,
                    sub.email,
                    seq.subject,
                    htmlContent,
                    senderEmail,
                    senderName
                );

                const record = {
                    email: sub.email,
                    sequenceIndex: idx,
                    sentAt: new Date().toISOString(),
                    success: result.success,
                };
                newRecords.push(record);
                sentSet.add(key); // evita reenvio na mesma run

                if (result.success) {
                    sent++;
                } else {
                    failed++;
                }
            }
        }

        // Persiste novos registros
        if (newRecords.length > 0) {
            const updated = [...emailsSent, ...newRecords];
            await writeFileToRepo(
                'src/data/emailsSent.json',
                JSON.stringify(updated, null, 2),
                { message: `Cron: email sequences — ${sent} sent, ${failed} failed` }
            );
        }

        return json({ processed, sent, failed });
    } catch (err: any) {
        return json({ success: false, message: err.message }, 500);
    }
};
