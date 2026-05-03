/**
 * api/subscribe.ts — Endpoint público de inscrição na newsletter
 *
 * POST /api/subscribe
 * Body: { email, name?, source? }
 *
 * - Valida email
 * - Checa duplicata
 * - Salva em subscribers.json
 * - Sincroniza com Brevo se configurado
 * - Rate limit: 10 por IP/hora (in-memory)
 */

import type { APIRoute } from 'astro';
import { readPluginsConfig, readFileFromRepo, writeFileToRepo } from '../../plugins/_server';
import { addContact } from '../../plugins/email-list/brevo-api';

export const prerender = false;

// Rate limit simples in-memory: ip -> { count, resetAt }
// ATENÇÃO: este Map é resetado em cada cold start do Vercel (serverless).
// Em produção com alto tráfego, substitua por Redis/KV para persistência real.
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hora

function checkRateLimit(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetAt) {
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
        return true;
    }
    if (entry.count >= RATE_LIMIT) return false;
    entry.count++;
    return true;
}

function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export const POST: APIRoute = async ({ request }) => {
    const json = (data: any, status = 200) =>
        new Response(JSON.stringify(data), {
            status,
            headers: { 'Content-Type': 'application/json' },
        });

    try {
        // Rate limit por IP
        const ip =
            request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
            request.headers.get('x-real-ip') ||
            'unknown';

        if (!checkRateLimit(ip)) {
            return json({ error: 'Muitas tentativas. Tente novamente mais tarde.' }, 429);
        }

        const body = await request.json().catch(() => null);
        if (!body) return json({ error: 'Body inválido.' }, 400);

        const email = (body.email || '').trim().toLowerCase();
        const name = (body.name || '').trim();
        const source = (body.source || 'widget') as string;

        if (!email) return json({ error: 'Email é obrigatório.' }, 400);
        if (!isValidEmail(email)) return json({ error: 'Email inválido.' }, 400);

        // Lê subscribers existentes
        const raw = await readFileFromRepo('src/data/subscribers.json');
        let subscribers: any[] = [];
        try {
            subscribers = raw ? JSON.parse(raw) : [];
        } catch {
            subscribers = [];
        }

        // Checa duplicata
        const exists = subscribers.some((s: any) => s.email === email);
        if (exists) {
            return json({ success: true, message: 'Você já está inscrito!' });
        }

        // Adiciona novo subscriber
        const newSub = {
            email,
            name,
            subscribedAt: new Date().toISOString(),
            source,
            tags: [],
        };
        subscribers.push(newSub);

        // Salva
        await writeFileToRepo(
            'src/data/subscribers.json',
            JSON.stringify(subscribers, null, 2),
            { message: `Newsletter: new subscriber ${email}` }
        );

        // Sincroniza com Brevo se configurado
        const config = readPluginsConfig();
        const emailListConfig = config?.emailList;
        if (emailListConfig?.brevoApiKey && emailListConfig?.brevoListId) {
            await addContact(
                emailListConfig.brevoApiKey,
                email,
                Number(emailListConfig.brevoListId),
                name || undefined
            ).catch(() => null); // falha silenciosa — não bloqueia inscrição local
        }

        return json({ success: true, message: 'Inscrito com sucesso!' });
    } catch (err: any) {
        return json({ error: err.message || 'Erro interno.' }, 500);
    }
};
