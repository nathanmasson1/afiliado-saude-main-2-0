/**
 * generate.ts — Plugin AI Generator (Walker)
 *
 * Lógica pura de geração de posts com IA em 4 etapas:
 *   1. Visão geral
 *   2. Introdução
 *   3. Seções (com contexto acumulado)
 *   4. Conclusão
 *
 * Não contém lógica HTTP — é chamado pelo API route.
 * Adaptado do CNX: remove dependências de post-utils CNX.
 */

import { searchPexelsPhotos, getPhotoUrl, getThumbnailUrl } from './pexels';

export interface Outline {
    level: 'h1' | 'h2' | 'h3' | 'h4';
    text: string;
    imageUrl?: string;
    minWords?: number;
}

export interface Product {
    name: string;
    imageUrl: string;
}

export type PostType = 'informational' | 'commercial';
export type CommercialSubType = 'guia-melhores' | 'spr';

const DELAY_MS = 500;
const MAX_TOKENS_SECTION = 2048;

const PARAGRAPH_RULE = 'Parágrafos com no máximo 3 linhas. Quebre no primeiro ponto final (.) da segunda linha, inserindo linha em branco para novo parágrafo.';

function formatOutlines(outlines: Outline[]): string {
    return outlines.map((o, i) => `${i + 1}. ${o.level.toUpperCase()}: ${o.text}`).join('\n');
}

function getHeadingTag(level: string): string {
    const n = level === 'h1' ? 1 : level === 'h2' ? 2 : level === 'h3' ? 3 : 4;
    return '#'.repeat(n);
}

function formatParagraphsForReadability(content: string): string {
    const blocks = content.split(/\n\n+/);
    return blocks.map(block => {
        if (block.startsWith('#') && !block.includes('\n')) return block;
        if (block.startsWith('![')) return block;
        return processParagraph(block);
    }).join('\n\n');
}

function processParagraph(para: string): string {
    const lines = para.split('\n');
    if (lines.length < 2) return para;
    const line2 = lines[1];
    const dotIdx = line2.indexOf('.');
    if (dotIdx >= 0) {
        const p1 = lines[0] + '\n' + line2.substring(0, dotIdx + 1);
        const rest = line2.substring(dotIdx + 1).trim() + (lines.length > 2 ? '\n' + lines.slice(2).join('\n') : '');
        if (rest.trim()) return p1 + '\n\n' + processParagraph(rest);
        return p1;
    }
    if (lines.length > 3) {
        const p1 = lines.slice(0, 2).join('\n');
        const rest = lines.slice(2).join('\n');
        return p1 + '\n\n' + processParagraph(rest);
    }
    return para;
}

function countWords(text: string): number {
    return (text.trim().match(/\S+/g) || []).length;
}

async function translateTitleToEnglish(
    title: string,
    callAIFn: (prompt: string) => Promise<string>
): Promise<string> {
    if (!title?.trim()) return title;
    try {
        const translated = await callAIFn(
            `Traduza para inglês APENAS o texto abaixo. Responda somente com a tradução, sem aspas nem explicações.\n\n${title}`
        );
        const cleaned = translated?.trim().replace(/^["']|["']$/g, '');
        return cleaned && cleaned.length > 2 ? cleaned : title;
    } catch {
        return title;
    }
}

export async function insertImagesByWordCount(
    content: string,
    title: string,
    pexelsApiKey: string,
    searchQuery: string
): Promise<{ content: string; thumbnailUrl?: string }> {
    if (!pexelsApiKey?.trim() || !searchQuery?.trim()) return { content };

    const photos = await searchPexelsPhotos(pexelsApiKey, searchQuery, 5);
    if (!photos.length) return { content };

    const totalWords = countWords(content);
    const numImages = Math.min(5, Math.floor(totalWords / 400));
    const thumbnailUrl = photos[0] ? getThumbnailUrl(photos[0]) : undefined;

    if (numImages <= 0) return { content, thumbnailUrl };

    const blocks = content.split(/\n\n+/);
    const result: string[] = [];
    let wordCount = 0;
    let nextImageAt = 400;
    let photoIndex = 0;

    for (const block of blocks) {
        result.push(block);
        wordCount += countWords(block);

        while (wordCount >= nextImageAt && photoIndex < photos.length && photoIndex < numImages) {
            const photo = photos[photoIndex];
            const url = getPhotoUrl(photo);
            const alt = `${title} - imagem ${photoIndex + 1}`;
            result.push(`![${alt}](${url})`);
            photoIndex++;
            nextImageAt += 400;
        }
    }

    return { content: result.join('\n\n'), thumbnailUrl };
}

// ── Prompts ───────────────────────────────────────────────────────────────────

function buildVisionPrompt(title: string, outlines: Outline[], postType: PostType, commercialSubType?: CommercialSubType): string {
    const outlineText = formatOutlines(outlines);
    if (postType === 'informational') {
        return `Título do artigo: ${title}\n\nEstrutura do artigo:\n${outlineText}\n\nCrie uma VISÃO GERAL (plano) deste artigo informacional em 2-4 parágrafos. Defina:\n- O ângulo/abordagem principal\n- O público-alvo\n- Os principais pontos que serão cobertos\n- O tom (educativo, acessível, baseado em evidências)\n\nResponda APENAS com a visão geral, sem escrever o conteúdo do artigo.`;
    }
    if (commercialSubType === 'guia-melhores') {
        return `Título do artigo: ${title}\n\nEstrutura do artigo:\n${outlineText}\n\nEste é um GUIA DOS MELHORES (lista ranqueada). Crie uma VISÃO GERAL em 2-4 parágrafos definindo:\n- Os critérios de ranqueamento que serão usados\n- A metodologia de comparação\n- O público-alvo e suas necessidades\n- O tom (persuasivo mas informativo, foco em ajudar na decisão de compra)\n\nResponda APENAS com a visão geral, sem escrever o conteúdo do artigo.`;
    }
    return `Título do artigo: ${title}\n\nEstrutura do artigo:\n${outlineText}\n\nEste é um SPR (Single Product Review). Crie uma VISÃO GERAL em 2-4 parágrafos definindo:\n- O produto/serviço em foco\n- Os principais aspectos que serão avaliados\n- O público-alvo\n- O tom (analítico, honesto, com prós e contras, CTA natural)\n\nResponda APENAS com a visão geral, sem escrever o conteúdo do artigo.`;
}

function buildIntroPrompt(title: string, outlines: Outline[], vision: string, postType: PostType, commercialSubType?: CommercialSubType): string {
    const outlineText = formatOutlines(outlines);
    let instructions = '';
    if (postType === 'informational') {
        instructions = 'Escreva uma introdução que contextualize o tema, antecipe o que será abordado e engaje o leitor. Use # Introdução como título. Formato Markdown.';
    } else if (commercialSubType === 'guia-melhores') {
        instructions = 'Escreva uma introdução que apresente o guia, explique como a lista foi montada e prometa valor ao leitor. Use # Introdução como título. Formato Markdown.';
    } else {
        instructions = 'Escreva uma introdução que apresente o produto/serviço e o contexto do review. Use # Introdução como título. Formato Markdown.';
    }
    return `Título: ${title}\n\nEstrutura:\n${outlineText}\n\nVisão geral do artigo:\n${vision}\n\n${instructions}\n\nEntre 50 e 100 palavras. NÃO inclua outras seções além da introdução.\n\n${PARAGRAPH_RULE}`;
}

function buildSectionPrompt(title: string, outline: Outline, outlines: Outline[], vision: string, intro: string, previousSections: string, postType: PostType, commercialSubType?: CommercialSubType): string {
    const outlineText = formatOutlines(outlines);
    const minWords = outline.minWords && outline.minWords >= 50 ? outline.minWords : 125;
    const wordInstruction = `RESPEITE RIGOROSAMENTE: escreva com aproximadamente ${minWords} palavras (entre ${Math.max(50, minWords - 25)} e ${minWords + 25}).`;

    let requirements = '';
    if (postType === 'informational') {
        requirements = `- ${wordInstruction}\n- ${PARAGRAPH_RULE}\n- Conteúdo baseado em evidências\n- Linguagem clara e acessível\n- Formato Markdown\n- Não inclua o título da seção (já será adicionado)\n- Seja objetivo e educativo`;
    } else if (commercialSubType === 'guia-melhores') {
        requirements = `- ${wordInstruction}\n- ${PARAGRAPH_RULE}\n- Análise detalhada do item\n- Prós e contras quando fizer sentido\n- Comparação com alternativas se aplicável\n- Formato Markdown\n- Não inclua o título da seção\n- Foco em ajudar na decisão de compra`;
    } else {
        requirements = `- ${wordInstruction}\n- ${PARAGRAPH_RULE}\n- Análise detalhada do aspecto\n- Prós e contras quando aplicável\n- Formato Markdown\n- Não inclua o título da seção\n- Tom analítico e honesto`;
    }

    return `Título do artigo: ${title}\n\nEstrutura completa:\n${outlineText}\n\nVisão geral:\n${vision}\n\nIntrodução já escrita:\n${intro.slice(0, 800)}${intro.length > 800 ? '...' : ''}\n\nConteúdo já escrito (seções anteriores):\n${previousSections ? previousSections.slice(-2000) : '(nenhuma)'}\n\n---\n\nAgora escreva APENAS o conteúdo da seção "${outline.text}" (${outline.level.toUpperCase()}).\n\nRequisitos:\n${requirements}\n\n${PARAGRAPH_RULE}\n\nConteúdo da seção (sem o título):`;
}

function buildConclusionPrompt(title: string, vision: string, fullContent: string, postType: PostType, commercialSubType?: CommercialSubType): string {
    const contentPreview = fullContent.slice(-3000);
    let instructions = '';
    if (postType === 'informational') {
        instructions = 'Escreva uma conclusão que resuma os principais pontos, reforce o valor do conteúdo e sugira próximos passos. Use ## Conclusão como título.';
    } else if (commercialSubType === 'guia-melhores') {
        instructions = 'Escreva uma conclusão que destaque a melhor opção ou resuma as recomendações, com CTA natural. Use ## Conclusão como título.';
    } else {
        instructions = 'Escreva uma conclusão com veredicto final sobre o produto, prós e contras resumidos, e CTA. Use ## Conclusão como título.';
    }
    return `Título: ${title}\n\nVisão geral:\n${vision}\n\nConteúdo do artigo (últimas partes):\n${contentPreview}\n\n${instructions}\n\nFormato Markdown. Entre 50 e 100 palavras. Apenas a seção de conclusão.\n\n${PARAGRAPH_RULE}`;
}

// ── Placeholders ──────────────────────────────────────────────────────────────

function generatePlaceholderSection(outline: Outline, postType: PostType): string {
    const heading = `${getHeadingTag(outline.level)} ${outline.text}\n\n`;
    const img = outline.imageUrl ? `![${outline.text}](${outline.imageUrl})\n\n` : '';
    const body = postType === 'informational'
        ? `Conteúdo informacional sobre "${outline.text}". Configure a API Key em /admin/ai para gerar com IA.\n\n`
        : `Conteúdo comercial sobre "${outline.text}". Configure a API Key em /admin/ai para gerar com IA.\n\n`;
    return heading + img + body;
}

function generatePlaceholderIntro(title: string, postType: PostType): string {
    return postType === 'informational'
        ? `# Introdução\n\nNeste artigo, vamos explorar: ${title}. Configure a API Key em /admin/ai para gerar conteúdo com inteligência artificial.\n\n`
        : `# Introdução\n\nBem-vindo ao nosso guia sobre: ${title}. Configure a API Key em /admin/ai para gerar conteúdo com inteligência artificial.\n\n`;
}

function generatePlaceholderConclusion(title: string): string {
    return `\n## Conclusão\n\nEsperamos que este artigo sobre ${title} tenha sido útil. Configure a API Key em /admin/ai para gerar conclusões personalizadas.\n\n`;
}

// ── Geração principal ─────────────────────────────────────────────────────────

export async function generatePostContent(
    title: string,
    outlines: Outline[],
    postType: PostType,
    commercialSubType: CommercialSubType | undefined,
    callAIFn: (prompt: string) => Promise<string>,
    onProgress: (msg: string) => void
): Promise<string> {
    let content = '';
    let vision = '';
    let intro = '';
    let previousSections = '';

    // Etapa 1: Visão geral
    onProgress('📋 Criando visão geral do artigo...');
    try {
        vision = await callAIFn(buildVisionPrompt(title, outlines, postType, commercialSubType));
        if (!vision?.trim()) vision = `Artigo sobre ${title} seguindo a estrutura definida.`;
    } catch (e) {
        vision = `Artigo sobre ${title} seguindo a estrutura definida.`;
    }

    await new Promise(r => setTimeout(r, DELAY_MS));

    // Etapa 2: Introdução
    onProgress('✍️ Gerando introdução...');
    try {
        intro = await callAIFn(buildIntroPrompt(title, outlines, vision, postType, commercialSubType));
        if (!intro?.trim()) intro = generatePlaceholderIntro(title, postType);
        else if (!intro.includes('#')) intro = `# Introdução\n\n${intro}`;
        content += intro.trim() + '\n\n';
    } catch {
        content += generatePlaceholderIntro(title, postType);
    }

    await new Promise(r => setTimeout(r, DELAY_MS));

    // Etapa 3: Seções
    for (let i = 0; i < outlines.length; i++) {
        const outline = outlines[i];
        onProgress(`📝 Gerando seção ${i + 1}/${outlines.length}: ${outline.text}`);
        try {
            const sectionContent = await callAIFn(
                buildSectionPrompt(title, outline, outlines, vision, intro, previousSections, postType, commercialSubType)
            );
            const heading = `${getHeadingTag(outline.level)} ${outline.text}\n\n`;
            const img = outline.imageUrl ? `![${outline.text}](${outline.imageUrl})\n\n` : '';
            const section = heading + img + (sectionContent?.trim() || '') + '\n\n';
            content += section;
            previousSections += section;
        } catch {
            content += generatePlaceholderSection(outline, postType);
        }
        if (i < outlines.length - 1) await new Promise(r => setTimeout(r, DELAY_MS));
    }

    // Etapa 4: Conclusão
    onProgress('🏁 Gerando conclusão...');
    try {
        const conclusion = await callAIFn(
            buildConclusionPrompt(title, vision, content, postType, commercialSubType)
        );
        if (conclusion?.trim()) {
            content += '\n' + conclusion.trim() + '\n\n';
        } else {
            content += generatePlaceholderConclusion(title);
        }
    } catch {
        content += generatePlaceholderConclusion(title);
    }

    return formatParagraphsForReadability(content.trim());
}

/** Resolve outlines efetivas a partir do body da requisição */
export function resolveOutlines(body: any): Outline[] | null {
    const { postType, outlines, products, commercialItems } = body;

    if (postType === 'commercial' && Array.isArray(commercialItems) && commercialItems.length > 0) {
        return commercialItems
            .filter((item: any) => item?.type === 'outline' || item?.type === 'product')
            .map((item: any) => {
                if (item.type === 'outline' && item.text?.trim()) {
                    const n = item.minWords != null ? Number(item.minWords) : undefined;
                    return { level: (item.level || 'h2') as Outline['level'], text: item.text.trim(), minWords: n && n >= 50 ? n : undefined };
                }
                if (item.type === 'product' && item.name?.trim()) {
                    return { level: 'h2' as const, text: item.name.trim(), imageUrl: item.imageUrl?.trim() || undefined };
                }
                return null;
            })
            .filter((o: Outline | null): o is Outline => o !== null);
    }

    if (postType === 'commercial' && (products?.length || outlines?.length)) {
        const outlineItems: Outline[] = (outlines || [])
            .filter((o: Outline) => o?.text?.trim())
            .map((o: Outline) => {
                const n = o.minWords != null ? Number(o.minWords) : undefined;
                return { level: o.level, text: o.text.trim(), minWords: n && n >= 50 ? n : undefined };
            });
        const productItems: Outline[] = (products || [])
            .filter((p: Product) => p?.name?.trim())
            .map((p: Product) => ({ level: 'h2' as const, text: p.name.trim(), imageUrl: p.imageUrl?.trim() || undefined }));
        return [...outlineItems, ...productItems];
    }

    return (outlines || [])
        .filter((o: Outline) => o?.text?.trim())
        .map((o: Outline) => {
            const n = o.minWords != null ? Number(o.minWords) : undefined;
            return { level: o.level, text: o.text.trim(), minWords: n && n >= 50 ? n : undefined };
        });
}
