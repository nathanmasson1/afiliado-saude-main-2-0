/**
 * api/admin/plugins/email-list/send-email.ts
 *
 * POST — Envia email individual via Brevo
 * Body: { to, subject, htmlContent }
 */

import type { APIRoute } from 'astro';
import { validateSession } from '../../../../../lib/auth';
import { readPluginsConfig, readDataFile } from '../../../../../plugins/_server';
import { sendTransactionalEmail } from '../../../../../plugins/email-list/brevo-api';

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

        const { to, subject, htmlContent } = await request.json();
        if (!to || !subject || !htmlContent) {
            return json({ success: false, message: 'Campos obrigatórios: to, subject, htmlContent.' }, 400);
        }

        const config = readPluginsConfig();
        const apiKey = config?.emailList?.brevoApiKey;
        if (!apiKey) {
            return json({ success: false, message: 'API Key do Brevo não configurada.' }, 400);
        }

        const siteConfig = readDataFile<any>('siteConfig.json', {});
        const senderName = siteConfig?.name || 'Newsletter';
        const senderEmail = siteConfig?.contact?.email;
        if (!senderEmail) {
            return json({ success: false, message: 'Email do remetente não configurado em siteConfig.contact.email.' }, 400);
        }

        const result = await sendTransactionalEmail(
            apiKey,
            to,
            subject,
            htmlContent,
            senderEmail,
            senderName
        );

        return json(result, result.success ? 200 : 400);
    } catch (err: any) {
        return json({ success: false, message: err.message }, 500);
    }
};
