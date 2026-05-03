/**
 * brevo-api.ts — Client Brevo (Sendinblue) sem dependências externas
 *
 * Funções server-side para integração com a API Brevo v3.
 * Usa fetch nativo — não requer instalação de SDK.
 */

const BREVO_BASE = 'https://api.brevo.com/v3';

/** Adiciona contato à lista do Brevo */
export async function addContact(
    apiKey: string,
    email: string,
    listId: number,
    name?: string
): Promise<{ success: boolean; message: string }> {
    const body: any = {
        email,
        listIds: [listId],
        updateEnabled: true,
    };
    if (name) {
        body.attributes = { FIRSTNAME: name };
    }

    const res = await fetch(`${BREVO_BASE}/contacts`, {
        method: 'POST',
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (res.ok || res.status === 204) {
        return { success: true, message: 'Contato adicionado com sucesso.' };
    }

    // 400 com code DUPLICATE_PARAMETER = contato já existe, tudo ok
    const data = await res.json().catch(() => ({}));
    if (res.status === 400 && data?.code === 'DUPLICATE_PARAMETER') {
        return { success: true, message: 'Contato já existia na lista.' };
    }

    return { success: false, message: data?.message || `Brevo error ${res.status}` };
}

/** Envia email transacional via Brevo */
export async function sendTransactionalEmail(
    apiKey: string,
    to: string,
    subject: string,
    htmlContent: string,
    senderEmail: string,
    senderName: string
): Promise<{ success: boolean; message: string }> {
    const body = {
        sender: { email: senderEmail, name: senderName },
        to: [{ email: to }],
        subject,
        htmlContent,
    };

    const res = await fetch(`${BREVO_BASE}/smtp/email`, {
        method: 'POST',
        headers: {
            'api-key': apiKey,
            'Content-Type': 'application/json',
            Accept: 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (res.ok) return { success: true, message: 'Email enviado com sucesso.' };

    const data = await res.json().catch(() => ({}));
    return { success: false, message: data?.message || `Brevo error ${res.status}` };
}

/** Testa conexão com Brevo — GET /v3/account */
export async function testConnection(
    apiKey: string
): Promise<{ success: boolean; message: string; accountName?: string }> {
    const res = await fetch(`${BREVO_BASE}/account`, {
        headers: {
            'api-key': apiKey,
            Accept: 'application/json',
        },
    });

    if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const name = data?.companyName || data?.firstName || 'conta';
        return { success: true, message: `Conectado: ${name}`, accountName: name };
    }

    if (res.status === 401) {
        return { success: false, message: 'API Key inválida ou sem permissão.' };
    }

    return { success: false, message: `Brevo error ${res.status}` };
}
