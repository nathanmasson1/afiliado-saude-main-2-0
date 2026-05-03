/**
 * _server.ts — Utilitários server-side para API routes dos plugins
 *
 * Funções para ler/escrever arquivos no repo do usuário,
 * com suporte a dev (filesystem local) e prod (GitHub API).
 *
 * Importar apenas em arquivos de API route (server-only).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

/** Lê o pluginsConfig.json do filesystem local */
export function readPluginsConfig(): any {
    try {
        const raw = readFileSync(resolve(process.cwd(), 'src/data/pluginsConfig.json'), 'utf-8');
        return JSON.parse(raw);
    } catch {
        return {};
    }
}

/** Lê qualquer arquivo JSON de src/data/ */
export function readDataFile<T = any>(filename: string, fallback: T = {} as T): T {
    try {
        const raw = readFileSync(resolve(process.cwd(), 'src/data', filename), 'utf-8');
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

/** Escreve arquivo de texto no repo (dev: filesystem / prod: GitHub API) */
export async function writeFileToRepo(
    filePath: string,
    content: string,
    options: { message?: string; token?: string; owner?: string; repo?: string } = {}
): Promise<boolean> {
    const token = options.token || process.env.GITHUB_TOKEN || '';
    const owner = options.owner || process.env.GITHUB_OWNER || '';
    const repo = options.repo || process.env.GITHUB_REPO || '';
    const isDevMode = !token || !owner || !repo;

    if (isDevMode) {
        const absPath = resolve(process.cwd(), filePath);
        mkdirSync(dirname(absPath), { recursive: true });
        writeFileSync(absPath, content, 'utf-8');
        return true;
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
    };

    let sha: string | undefined;
    const existing = await fetch(apiUrl, { headers });
    if (existing.ok) {
        const data = await existing.json();
        sha = data.sha;
    }

    const body: any = {
        message: options.message || `CMS: ${filePath}`,
        content: Buffer.from(content).toString('base64'),
    };
    if (sha) body.sha = sha;

    const res = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(body) });
    return res.ok;
}

/** Escreve arquivo binário (base64) no repo */
export async function writeBinaryToRepo(
    filePath: string,
    base64Content: string,
    options: { message?: string; token?: string; owner?: string; repo?: string } = {}
): Promise<boolean> {
    const token = options.token || process.env.GITHUB_TOKEN || '';
    const owner = options.owner || process.env.GITHUB_OWNER || '';
    const repo = options.repo || process.env.GITHUB_REPO || '';
    const isDevMode = !token || !owner || !repo;

    if (isDevMode) {
        const absPath = resolve(process.cwd(), filePath);
        mkdirSync(dirname(absPath), { recursive: true });
        writeFileSync(absPath, Buffer.from(base64Content, 'base64'));
        return true;
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
    };

    let sha: string | undefined;
    const existing = await fetch(apiUrl, { headers });
    if (existing.ok) {
        const data = await existing.json();
        sha = data.sha;
    }

    const body: any = {
        message: options.message || `CMS: upload ${filePath}`,
        content: base64Content,
    };
    if (sha) body.sha = sha;

    const res = await fetch(apiUrl, { method: 'PUT', headers, body: JSON.stringify(body) });
    return res.ok;
}

/** Lê arquivo de texto do repo (dev: filesystem / prod: GitHub API) */
export async function readFileFromRepo(
    filePath: string,
    options: { token?: string; owner?: string; repo?: string } = {}
): Promise<string | null> {
    const token = options.token || process.env.GITHUB_TOKEN || '';
    const owner = options.owner || process.env.GITHUB_OWNER || '';
    const repo = options.repo || process.env.GITHUB_REPO || '';
    const isDevMode = !token || !owner || !repo;

    if (isDevMode) {
        try {
            return readFileSync(resolve(process.cwd(), filePath), 'utf-8');
        } catch {
            return null;
        }
    }

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;
    const headers: Record<string, string> = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
    };

    const res = await fetch(apiUrl, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.content) return Buffer.from(data.content, 'base64').toString('utf-8');
    return null;
}

/** Verifica se um arquivo existe no repo */
export async function fileExistsInRepo(
    filePath: string,
    options: { token?: string; owner?: string; repo?: string } = {}
): Promise<boolean> {
    const content = await readFileFromRepo(filePath, options);
    return content !== null;
}
