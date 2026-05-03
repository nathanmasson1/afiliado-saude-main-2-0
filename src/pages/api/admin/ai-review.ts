import type { APIRoute } from 'astro';
import fs from 'node:fs/promises';
import nodePath from 'node:path';
import { fileURLToPath } from 'node:url';

export const prerender = false;

const PROJECT_ROOT = nodePath.resolve(fileURLToPath(import.meta.url), '../../../../../');

async function getOpenAIConfig(): Promise<{ apiKey: string; model: string }> {
    const envKey = import.meta.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY;
    let apiKey = envKey || '';
    let model = 'gpt-4o-mini';

    try {
        const raw = await fs.readFile(nodePath.join(PROJECT_ROOT, 'src/data/siteConfig.json'), 'utf-8');
        const cfg = JSON.parse(raw);
        if (!apiKey && cfg.ai?.openaiKey) apiKey = cfg.ai.openaiKey;
        if (cfg.ai?.model) model = cfg.ai.model;
    } catch { }

    return { apiKey, model };
}

export const POST: APIRoute = async ({ request }) => {
    try {
        const { title, products, language = 'pt-BR', angle, autoTitle } = await request.json();
        if (!Array.isArray(products) || products.length === 0) {
            return new Response(JSON.stringify({ error: 'Ao menos 1 produto é obrigatório.' }), { status: 400 });
        }
        if (!title && !autoTitle) {
            return new Response(JSON.stringify({ error: 'Título obrigatório (ou use autoTitle).' }), { status: 400 });
        }

        const { apiKey, model } = await getOpenAIConfig();
        if (!apiKey) {
            return new Response(JSON.stringify({ error: 'OpenAI API Key não configurada. Configure em /admin/config.' }), { status: 500 });
        }

        const productsList = products.map((p: any, i: number) =>
            `${i + 1}. ${p.name}${p.affiliateLink ? ` — ${p.affiliateLink}` : ''}${p.notes ? `\n   Notas do redator: ${p.notes}` : ''}`
        ).join('\n');

        const systemPrompt = `Você é um redator profissional especializado em reviews de produtos para blogs de afiliados em ${language}.

REGRAS OBRIGATÓRIAS:
- Tom honesto, útil e direto. Sem exageros tipo "incrível" ou "revolucionário".
- NUNCA use primeira pessoa (eu, nós, meu, nosso). Use forma impessoal ou segunda pessoa (você).
- Máximo 3 linhas por parágrafo.
- Separe parágrafos com \\n\\n.
- Cada review individual de produto deve ter 150-200 palavras.
- Pros/cons devem ser específicos, não genéricos.
- Foque em benefícios concretos, especificações úteis e para quem o produto é indicado.
- Conteúdo otimizado para SEO mas natural.

Retorne SOMENTE JSON válido seguindo EXATAMENTE este schema:
{
  "title": "Título SEO-friendly do review (60-70 chars). Ex: 'Os 5 Melhores Fones Bluetooth de 2025: Análise Completa'",
  "description": "Meta-descrição (150-160 chars) que dê vontade de clicar",
  "badge": "top-pick | best-value | editor-choice (escolha o mais adequado ao tipo de review)",
  "intro": "2 parágrafos contextualizando o review (separados por \\n\\n)",
  "products": [
    {
      "review": "Review individual ~180 palavras com 2-3 parágrafos separados por \\n\\n",
      "pros": ["pro 1", "pro 2", "pro 3", "pro 4"],
      "cons": ["contra 1", "contra 2"]
    }
  ],
  "conclusion": "Veredito final, 1-2 parágrafos com recomendação clara separados por \\n\\n",
  "faqs": [
    {"q": "Pergunta?", "a": "Resposta direta"}
  ]
}

A array "products" deve ter EXATAMENTE ${products.length} itens, na mesma ordem que os produtos foram listados.
Gere 4 FAQs úteis e específicas para o nicho.`;

        const titleLine = title ? `Tópico do review: ${title}` : `Tópico: gere um título a partir dos produtos abaixo.`;
        const angleLine = angle ? `\nFoco editorial: ${angle}` : '';

        const userPrompt = `${titleLine}${angleLine}

Produtos a serem analisados (na ordem):
${productsList}

Gere o review completo seguindo o schema JSON. ${title ? '' : 'Crie um título SEO-friendly forte para este conjunto de produtos.'}`;

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model,
                response_format: { type: 'json_object' },
                temperature: 0.7,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt },
                ],
            }),
        });

        if (!res.ok) {
            const errText = await res.text();
            return new Response(JSON.stringify({ error: `OpenAI API: ${res.status} - ${errText.slice(0, 300)}` }), { status: 500 });
        }

        const json: any = await res.json();
        const content = json.choices?.[0]?.message?.content;
        if (!content) {
            return new Response(JSON.stringify({ error: 'Resposta vazia do OpenAI.' }), { status: 500 });
        }

        let parsed;
        try { parsed = JSON.parse(content); }
        catch { return new Response(JSON.stringify({ error: 'Resposta da IA não é JSON válido.' }), { status: 500 }); }

        return new Response(JSON.stringify({
            ok: true,
            data: parsed,
            usage: json.usage,
            model,
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message || 'Erro desconhecido' }), { status: 500 });
    }
};
