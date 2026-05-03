/**
 * ai-provider.ts — Plugin AI Generator (Walker)
 *
 * Carrega configurações de IA do pluginsConfig.json e chama OpenAI ou Gemini.
 * Adaptado do CNX: remove dependências de settings.yaml e github-api,
 * lê diretamente de src/data/pluginsConfig.json.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type AIProvider = 'openai' | 'gemini';

export interface AISettings {
    provider: AIProvider;
    apiKey: string;
    pexelsApiKey?: string;
}

/**
 * Carrega configurações de IA do pluginsConfig.json.
 */
export function loadAISettings(): AISettings {
    try {
        const raw = readFileSync(resolve(process.cwd(), 'src/data/pluginsConfig.json'), 'utf-8');
        const config = JSON.parse(raw);
        const ai = config?.ai || {};
        return {
            provider: (ai.provider as AIProvider) || 'gemini',
            apiKey: ai.apiKey || '',
            pexelsApiKey: ai.pexelsApiKey || '',
        };
    } catch {
        return { provider: 'gemini', apiKey: '' };
    }
}

/**
 * Resolve a API Key efetiva: pluginsConfig primeiro, depois env vars.
 */
export function resolveApiKey(settings: AISettings): string {
    if (settings.apiKey?.trim()) return settings.apiKey.trim();
    if (settings.provider === 'openai') return (process.env.OPENAI_API_KEY || '').trim();
    return (process.env.GEMINI_API_KEY || '').trim();
}

/**
 * Chama a API OpenAI (gpt-4o-mini).
 */
export async function callOpenAI(
    prompt: string,
    apiKey: string,
    options?: { systemPrompt?: string; maxTokens?: number }
): Promise<string> {
    const systemPrompt = options?.systemPrompt ?? 'Você é um redator profissional especializado em criar conteúdo de alta qualidade para blogs.';
    const maxTokens = options?.maxTokens ?? 4096;

    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
    };
    const orgId = (process.env.OPENAI_ORGANIZATION_ID || '').trim();
    const projId = (process.env.OPENAI_PROJECT_ID || '').trim();
    if (orgId) headers['OpenAI-Organization'] = orgId;
    if (projId) headers['OpenAI-Project'] = projId;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers,
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.7,
            max_tokens: maxTokens,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: prompt },
            ],
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`OpenAI ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.choices[0]?.message?.content?.trim() || '';
}

/**
 * Chama a API Google Gemini (gemini-1.5-flash).
 */
export async function callGemini(
    prompt: string,
    apiKey: string,
    options?: { systemPrompt?: string; maxTokens?: number }
): Promise<string> {
    const systemPrompt = options?.systemPrompt ?? 'Você é um redator profissional especializado em criar conteúdo de alta qualidade para blogs.';
    const maxTokens = options?.maxTokens ?? 4096;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: `${systemPrompt}\n\n${prompt}` }],
            }],
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: maxTokens,
            },
        }),
    });

    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Gemini ${res.status}: ${err.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
}

/**
 * Chama o provedor de IA configurado (OpenAI ou Gemini).
 */
export async function callAI(
    prompt: string,
    settings: AISettings,
    apiKey: string,
    options?: { systemPrompt?: string; maxTokens?: number }
): Promise<string> {
    if (settings.provider === 'gemini') {
        return callGemini(prompt, apiKey, options);
    }
    return callOpenAI(prompt, apiKey, options);
}
