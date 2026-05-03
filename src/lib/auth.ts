/**
 * Auth por senha HMAC-SHA256 sem deps externas.
 * Cookie: admin_session (httpOnly, Secure, SameSite=Lax, 7 dias)
 */

const COOKIE_NAME = 'admin_session';
const EXPIRES_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

async function hmac(secret: string, data: string): Promise<string> {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
    return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Cria a string de cookie assinada. Retorna null se ADMIN_SECRET não definido. */
export async function createSession(password: string): Promise<string | null> {
    const secret = import.meta.env.ADMIN_SECRET;
    if (!secret) return null;
    if (password !== secret) return null;

    const expires = Date.now() + EXPIRES_MS;
    const payload = `${expires}`;
    const sig = await hmac(secret, payload);
    return `${payload}.${sig}`;
}

/** Valida cookie. Retorna true se válido. */
export async function validateSession(cookieValue: string | undefined): Promise<boolean> {
    if (!cookieValue) return false;
    const secret = import.meta.env.ADMIN_SECRET;
    if (!secret) return false;

    const parts = cookieValue.split('.');
    if (parts.length !== 2) return false;

    const [expStr, sig] = parts;
    const expires = parseInt(expStr, 10);
    if (isNaN(expires) || Date.now() > expires) return false;

    const expected = await hmac(secret, expStr);
    return expected === sig;
}

export const COOKIE_NAME_EXPORT = COOKIE_NAME;
