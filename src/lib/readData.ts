/**
 * Lê arquivos JSON da pasta data/ de forma dinâmica (sem cache do Vite).
 * Garante que alterações feitas via CMS sejam refletidas imediatamente no dev,
 * e lidas corretamente em tempo de build no Vercel.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DATA_DIR = resolve(process.cwd(), 'src/data');

export function readData<T = any>(filename: string, fallback: T = {} as T): T {
    try {
        return JSON.parse(readFileSync(resolve(DATA_DIR, filename), 'utf-8')) as T;
    } catch {
        return fallback;
    }
}
