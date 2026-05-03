import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

export const prerender = false;

// Raiz do projeto (sobe de src/pages/api/admin/ → projeto)
const PROJECT_ROOT = nodePath.resolve(fileURLToPath(import.meta.url), '../../../../../');

// ── Cache de leituras (evita rate limit do GitHub API: 5000/hora) ────────
const readCache = new Map<string, { data: any; ts: number }>();
const CACHE_TTL = 30_000; // 30 segundos

function getCached(key: string): any | null {
    const entry = readCache.get(key);
    if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
    return null;
}

function setCache(key: string, data: any) {
    readCache.set(key, { data, ts: Date.now() });
    // Limpa entradas antigas (max 200 entradas)
    if (readCache.size > 200) {
        const oldest = [...readCache.entries()].sort((a, b) => a[1].ts - b[1].ts);
        for (let i = 0; i < 50; i++) readCache.delete(oldest[i][0]);
    }
}

function invalidateCache(path: string) {
    // Invalida o arquivo e o diretório pai
    readCache.delete(path);
    const dir = path.split('/').slice(0, -1).join('/');
    readCache.delete(dir);
}

/** Modo dev: lê/escreve arquivos locais sem precisar do GitHub */
async function handleDev(action: string, path: string, content?: string, isBase64?: boolean): Promise<Response> {
    const absPath = nodePath.join(PROJECT_ROOT, path);

    switch (action) {
        case 'list': {
            let entries: any[];
            try {
                const files = await fs.readdir(absPath);
                entries = files.map(name => ({
                    name,
                    path: `${path}/${name}`,
                    sha: `dev-${name}`, // sha fictício para o dev
                    type: 'file',
                }));
            } catch {
                return new Response(JSON.stringify({ error: 'Pasta não encontrada', code: 404 }), { status: 404 });
            }
            return new Response(JSON.stringify({ data: entries }), { status: 200 });
        }

        case 'read': {
            try {
                const raw = await fs.readFile(absPath, 'utf-8');
                // sha fictício mas estável (usamos mtime como proxy)
                const stat = await fs.stat(absPath);
                const sha = `dev-${stat.mtimeMs}`;
                return new Response(JSON.stringify({ content: raw, sha }), { status: 200 });
            } catch {
                return new Response(JSON.stringify({ error: 'Arquivo não encontrado', code: 404 }), { status: 404 });
            }
        }

        case 'write': {
            if (content === undefined) throw new Error("Ação 'write' exige o campo 'content'.");
            await fs.mkdir(nodePath.dirname(absPath), { recursive: true });
            const data = isBase64 ? Buffer.from(content, 'base64') : content;
            await fs.writeFile(absPath, data);
            const stat = await fs.stat(absPath);
            return new Response(JSON.stringify({ success: true, sha: `dev-${stat.mtimeMs}` }), { status: 200 });
        }

        case 'delete': {
            try { await fs.unlink(absPath); } catch { /* ignora se já não existe */ }
            return new Response(JSON.stringify({ success: true }), { status: 200 });
        }

        default:
            throw new Error("Ação inválida.");
    }
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { action, path, content, message, sha, isBase64 } = body;

        const GITHUB_TOKEN = import.meta.env.GITHUB_TOKEN;
        const GITHUB_OWNER = import.meta.env.GITHUB_OWNER;
        const GITHUB_REPO = import.meta.env.GITHUB_REPO;

        // Modo dev: sem credenciais GitHub → usa filesystem local
        if (!GITHUB_TOKEN || !GITHUB_OWNER || !GITHUB_REPO) {
            if (!action || !path) return new Response(JSON.stringify({ error: 'Faltam parâmetros (action, path)' }), { status: 400 });
            return handleDev(action, path, content, isBase64);
        }

        if (!action || !path) {
            return new Response(JSON.stringify({ error: 'Faltam parâmetros obrigatórios (action, path)' }), { status: 400 });
        }

        const repo = `${GITHUB_OWNER}/${GITHUB_REPO}`;
        const githubUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
        const headers: Record<string, string> = {
            Authorization: `Bearer ${GITHUB_TOKEN}`,
            Accept: 'application/vnd.github+json',
        };

        let res: Response;

        switch (action) {
            case 'read':
            case 'list': {
                // Check cache first
                const cacheKey = `${action}:${path}`;
                const cached = getCached(cacheKey);
                if (cached) return new Response(JSON.stringify(cached), { status: 200 });

                res = await fetch(githubUrl, { headers });
                if (!res.ok) {
                    if (res.status === 404) return new Response(JSON.stringify({ error: 'Arquivo ou pasta não encontrado', code: 404 }), { status: 404 });
                    const e = await res.json();
                    // Mensagem amigável para rate limit
                    if (res.status === 403 && e.message?.includes('rate limit')) {
                        return new Response(JSON.stringify({
                            error: 'Limite de requisições do GitHub atingido. Aguarde alguns minutos e tente novamente. Isso acontece quando muitas operações são feitas em pouco tempo.',
                        }), { status: 429 });
                    }
                    throw new Error(`Erro ao ler ${path}: ${e.message}`);
                }
                const data = await res.json();
                if (Array.isArray(data)) {
                    const result = { data };
                    setCache(cacheKey, result);
                    return new Response(JSON.stringify(result), { status: 200 });
                }
                if (data.type === 'file' && data.content) {
                    const decoded = Buffer.from(data.content, 'base64').toString('utf-8');
                    const result = { content: decoded, sha: data.sha };
                    setCache(cacheKey, result);
                    return new Response(JSON.stringify(result), { status: 200 });
                }
                const result = { data };
                setCache(cacheKey, result);
                return new Response(JSON.stringify(result), { status: 200 });
            }

            case 'write': {
                if (content === undefined) throw new Error("Ação 'write' exige o campo 'content'.");
                const writeBody: Record<string, any> = {
                    message: message || `Update ${path} via CMS`,
                    content: isBase64 ? content : Buffer.from(content).toString('base64'),
                };
                // Auto-fetch sha if not provided (needed when file already exists)
                let writeSha = sha;
                if (!writeSha) {
                    try {
                        const existing = await fetch(githubUrl, { headers });
                        if (existing.ok) {
                            const existingData = await existing.json();
                            if (existingData.sha) writeSha = existingData.sha;
                        }
                    } catch {}
                }
                if (writeSha) writeBody.sha = writeSha;
                res = await fetch(githubUrl, {
                    method: 'PUT',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify(writeBody),
                });
                if (!res.ok) {
                    const e = await res.json();
                    throw new Error(`Erro ao salvar ${path}: ${e.message}`);
                }
                const responseData = await res.json();
                invalidateCache(path); // Invalida cache após escrita
                return new Response(JSON.stringify({ success: true, sha: responseData.content?.sha }), { status: 200 });
            }

            case 'delete': {
                if (!sha) throw new Error("Ação 'delete' exige o campo 'sha'.");
                res = await fetch(githubUrl, {
                    method: 'DELETE',
                    headers: { ...headers, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: message || `Delete ${path} via CMS`, sha }),
                });
                if (!res.ok) {
                    const e = await res.json();
                    throw new Error(`Erro ao excluir ${path}: ${e.message}`);
                }
                invalidateCache(path); // Invalida cache após delete
                return new Response(JSON.stringify({ success: true }), { status: 200 });
            }

            default:
                throw new Error("Ação inválida. Use: 'read', 'list', 'write' ou 'delete'.");
        }
    } catch (err: any) {
        return new Response(
            JSON.stringify({ error: err.message }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
};
