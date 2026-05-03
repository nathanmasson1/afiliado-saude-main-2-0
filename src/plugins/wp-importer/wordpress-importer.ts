/**
 * wordpress-importer.ts — Plugin WP Importer (Walker)
 *
 * Importa posts, categorias e autores do WordPress via XML (WXR format).
 * Adaptado do CNX para o formato de dados do Walker:
 *   - Categorias: src/data/categories.json (string[])
 *   - Autores: src/data/authors.json ({id, name, role, avatar, bio}[])
 *   - Posts: src/content/blog/{slug}.md
 *
 * Usa _adapter.ts para serialização e _server.ts para escrita no repo.
 */

import { XMLParser } from 'fast-xml-parser';
import { serializePost, postPath } from '../_adapter';
import { writeFileToRepo, writeBinaryToRepo, readFileFromRepo } from '../_server';

interface ImportResult {
    success: boolean;
    posts: { imported: number; skipped: number; errors: string[]; imagesImported: number };
    authors: { imported: number; skipped: number };
    categories: { imported: number; skipped: number };
    errors: string[];
}

// ── XML Parse helpers ─────────────────────────────────────────────────────────

function getValue(obj: any): string {
    if (!obj) return '';
    if (typeof obj === 'string') return obj.trim();
    if (Array.isArray(obj)) {
        if (obj.length === 0) return '';
        const first = obj[0];
        if (typeof first === 'string') return first.trim();
        if (first?.['#text']) return String(first['#text']).trim();
        return String(first).trim();
    }
    if (obj['#text']) return String(obj['#text']).trim();
    return String(obj).trim();
}

function generateSlug(str: string): string {
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

// ── Conversão HTML → texto simples para description ──────────────────────────

function htmlToText(html: string): string {
    return html
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&[a-z]+;/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

// ── Download de imagens ───────────────────────────────────────────────────────

async function downloadImage(imageUrl: string): Promise<{ base64: string; ext: string } | null> {
    try {
        if (!imageUrl || imageUrl.startsWith('data:') || imageUrl.startsWith('/')) return null;
        const response = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) });
        if (!response.ok) return null;
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.startsWith('image/')) return null;
        const extMap: Record<string, string> = { 'jpeg': 'jpg', 'jpg': 'jpg', 'png': 'png', 'gif': 'gif', 'webp': 'webp', 'svg+xml': 'svg' };
        const rawExt = contentType.split('/')[1]?.split(';')[0]?.trim() || 'jpg';
        const ext = extMap[rawExt] || 'jpg';
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        return { base64, ext };
    } catch {
        return null;
    }
}

async function saveImage(imageUrl: string, postSlug: string): Promise<string | null> {
    const downloaded = await downloadImage(imageUrl);
    if (!downloaded) return null;
    try {
        const urlPath = new URL(imageUrl).pathname;
        const urlFilename = urlPath.split('/').pop() || 'image';
        const cleanFilename = urlFilename.replace(/[^a-zA-Z0-9.-]/g, '-').replace(/\.[^.]+$/, '');
        const filename = `${Date.now()}-${postSlug}-${cleanFilename}.${downloaded.ext}`;
        const filePath = `public/uploads/${filename}`;
        const ok = await writeBinaryToRepo(filePath, downloaded.base64, { message: `CMS: Import imagem ${filename}` });
        if (!ok) return null;
        return `/uploads/${filename}`;
    } catch {
        return null;
    }
}

function extractImageUrls(html: string): string[] {
    const urls: string[] = [];
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = imgRegex.exec(html)) !== null) {
        if (m[1] && !m[1].startsWith('data:')) urls.push(m[1]);
    }
    return [...new Set(urls)];
}

function replaceImageUrls(content: string, urlMap: Map<string, string>): string {
    let result = content;
    urlMap.forEach((local, original) => {
        result = result.split(original).join(local);
    });
    return result;
}

// ── Leitura do estado atual (categorias e autores) ────────────────────────────

async function loadCurrentCategories(): Promise<string[]> {
    const raw = await readFileFromRepo('src/data/categories.json');
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
}

async function loadCurrentAuthors(): Promise<any[]> {
    const raw = await readFileFromRepo('src/data/authors.json');
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
}

async function loadExistingPostSlugs(): Promise<string[]> {
    // Lê o índice de slugs de src/data/post-slugs.json (mantido pelo CMS)
    // Fallback: retorna lista vazia (pior caso: duplicatas com sufixo numérico)
    try {
        const raw = await readFileFromRepo('src/data/post-slugs.json');
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

// ── Exportação principal ──────────────────────────────────────────────────────

export async function importWordPressXML(xmlContent: string): Promise<ImportResult> {
    const result: ImportResult = {
        success: true,
        posts: { imported: 0, skipped: 0, errors: [], imagesImported: 0 },
        authors: { imported: 0, skipped: 0 },
        categories: { imported: 0, skipped: 0 },
        errors: [],
    };

    try {
        if (!xmlContent?.trim()) throw new Error('XML vazio ou inválido');

        // Verificar credenciais GitHub em ambiente serverless (produção)
        const hasGitHubCreds = !!(
            process.env.GITHUB_TOKEN?.trim() &&
            process.env.GITHUB_OWNER?.trim() &&
            process.env.GITHUB_REPO?.trim()
        );
        const isServerless = !!(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);

        if (isServerless && !hasGitHubCreds) {
            result.success = false;
            result.errors.push(
                'Configuração necessária: as variáveis de ambiente GITHUB_TOKEN, GITHUB_OWNER e GITHUB_REPO ' +
                'não estão configuradas. Acesse o painel do Vercel → Settings → Environment Variables e ' +
                'adicione as três variáveis para habilitar o importador em produção.'
            );
            return result;
        }

        const parser = new XMLParser({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            textNodeName: '#text',
            parseAttributeValue: true,
            trimValues: true,
            cdataPropName: '#text',
            isArray: (name) => ['item', 'wp:author', 'wp:category', 'category'].includes(name),
        });

        const xmlData = parser.parse(xmlContent);
        const channel = xmlData?.rss?.channel || xmlData?.channel;
        if (!channel) throw new Error('Formato XML inválido: elemento channel não encontrado');

        // ── Carregar estado atual ───────────────────────────────────────────

        let currentCategories = await loadCurrentCategories();
        let currentAuthors = await loadCurrentAuthors();
        const authorLoginToId = new Map<string, string>(); // login → id

        // ── Processar categorias ────────────────────────────────────────────

        const wpCategories = Array.isArray(channel['wp:category']) ? channel['wp:category'] : (channel['wp:category'] ? [channel['wp:category']] : []);

        for (const cat of wpCategories) {
            if (!cat) continue;
            const catName = getValue(cat['wp:cat_name']);
            if (!catName) continue;

            if (currentCategories.includes(catName)) {
                result.categories.skipped++;
                continue;
            }

            currentCategories.push(catName);
            result.categories.imported++;
        }

        // Salvar categories.json atualizado
        if (result.categories.imported > 0) {
            await writeFileToRepo('src/data/categories.json', JSON.stringify(currentCategories, null, 2), {
                message: 'CMS: Import WordPress — categorias',
            });
        }

        // ── Processar autores ───────────────────────────────────────────────

        const wpAuthors = Array.isArray(channel['wp:author']) ? channel['wp:author'] : (channel['wp:author'] ? [channel['wp:author']] : []);

        for (const author of wpAuthors) {
            if (!author) continue;
            const login = getValue(author['wp:author_login']);
            const displayName = getValue(author['wp:author_display_name']) || login;
            if (!login || !displayName) continue;

            const authorId = generateSlug(login);
            authorLoginToId.set(login, authorId);

            const exists = currentAuthors.some((a: any) => a.id === authorId);
            if (exists) {
                result.authors.skipped++;
                continue;
            }

            const newAuthor = {
                id: authorId,
                name: displayName,
                role: 'Autor',
                avatar: '',
                bio: `${getValue(author['wp:author_first_name'])} ${getValue(author['wp:author_last_name'])}`.trim() || displayName,
            };
            currentAuthors.push(newAuthor);
            result.authors.imported++;
        }

        // Salvar authors.json atualizado
        if (result.authors.imported > 0) {
            await writeFileToRepo('src/data/authors.json', JSON.stringify(currentAuthors, null, 2), {
                message: 'CMS: Import WordPress — autores',
            });
        }

        // ── Processar posts ─────────────────────────────────────────────────

        const items = Array.isArray(channel.item) ? channel.item : (channel.item ? [channel.item] : []);
        const existingSlugs = await loadExistingPostSlugs();
        const usedSlugs = new Set<string>(existingSlugs);

        for (const item of items) {
            try {
                const postType = getValue(item['wp:post_type']);
                if (postType !== 'post') continue;

                const postStatus = getValue(item['wp:status']);
                if (postStatus !== 'publish' && postStatus !== 'draft') continue;

                const title = getValue(item.title) || 'Sem título';
                let slug = getValue(item['wp:post_name']) || generateSlug(title);
                if (!slug) { result.posts.skipped++; continue; }

                // Resolver conflito de slug
                let slugBase = slug;
                let counter = 1;
                while (usedSlugs.has(slug)) {
                    slug = `${slugBase}-${counter++}`;
                }
                usedSlugs.add(slug);

                const creator = getValue(item['dc:creator']);
                const content = getValue(item['content:encoded']);
                const excerpt = getValue(item['excerpt:encoded']);
                const postDate = getValue(item['wp:post_date']);

                // Autor
                const authorId = creator ? (authorLoginToId.get(creator) || generateSlug(creator)) : undefined;

                // Categoria (primeira categoria válida)
                let categoryName: string | undefined;
                const rawCats = Array.isArray(item.category) ? item.category : (item.category ? [item.category] : []);
                for (const cat of rawCats) {
                    const domain = cat?.['@_domain'] || '';
                    if (domain !== 'category') continue;
                    const name = typeof cat === 'string' ? cat : getValue(cat);
                    if (name) { categoryName = name; break; }
                }

                // Data de publicação
                let pubDate: string | undefined;
                if (postDate && postStatus === 'publish') {
                    try {
                        const date = new Date(postDate.replace(' ', 'T'));
                        if (!isNaN(date.getTime())) pubDate = date.toISOString().split('T')[0];
                    } catch { /* ignore */ }
                }

                // Thumbnail via wp:postmeta
                let image: string | undefined;
                const postmeta = Array.isArray(item['wp:postmeta']) ? item['wp:postmeta'] : (item['wp:postmeta'] ? [item['wp:postmeta']] : []);
                for (const meta of postmeta) {
                    if (getValue(meta['wp:meta_key']) === '_thumbnail_id') {
                        const thumbId = getValue(meta['wp:meta_value']);
                        if (thumbId) {
                            // Procurar attachment com esse ID
                            for (const attachItem of items) {
                                if (getValue(attachItem['wp:post_id']) === thumbId && getValue(attachItem['wp:post_type']) === 'attachment') {
                                    const attachUrl = getValue(attachItem['wp:attachment_url']) || getValue(attachItem['guid']);
                                    if (attachUrl) {
                                        const localUrl = await saveImage(attachUrl, slug);
                                        if (localUrl) {
                                            image = localUrl;
                                            result.posts.imagesImported++;
                                        }
                                    }
                                    break;
                                }
                            }
                        }
                        break;
                    }
                }

                // Imagens no conteúdo
                const imageUrls = extractImageUrls(content);
                const imageUrlMap = new Map<string, string>();
                for (const imgUrl of imageUrls) {
                    const local = await saveImage(imgUrl, slug);
                    if (local) {
                        imageUrlMap.set(imgUrl, local);
                        result.posts.imagesImported++;
                    }
                }
                const finalContent = imageUrlMap.size > 0 ? replaceImageUrls(content, imageUrlMap) : content;

                // Description
                let description = '';
                if (excerpt) {
                    description = htmlToText(excerpt).substring(0, 160);
                }
                if (!description && content) {
                    description = htmlToText(content).substring(0, 160);
                }

                // Serializar e salvar post
                const postFileContent = serializePost({
                    title,
                    slug,
                    description,
                    content: finalContent,
                    image: image || '',
                    category: categoryName || '',
                    author: authorId || '',
                    pubDate: pubDate || new Date().toISOString().split('T')[0],
                    draft: postStatus === 'draft',
                });

                const ok = await writeFileToRepo(postPath(slug), postFileContent, {
                    message: `CMS: Import WordPress — post "${title.substring(0, 50)}"`,
                });

                if (ok) {
                    result.posts.imported++;
                } else {
                    result.posts.errors.push(`Erro ao salvar post "${title}"`);
                    result.posts.skipped++;
                }
            } catch (err: any) {
                const title = typeof item.title === 'string' ? item.title : getValue(item.title);
                result.posts.errors.push(`Erro ao processar post "${title}": ${err.message}`);
                result.posts.skipped++;
            }
        }

        return result;
    } catch (err: any) {
        result.success = false;
        result.errors.push(`Erro fatal: ${err.message || String(err)}`);
        return result;
    }
}

// ── Import from pre-parsed data (client-side parsing) ────────────────────────

interface ParsedPost {
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    status: string;
    creator: string;
    postDate: string;
    category: string;
    thumbnailUrl: string;
    imageUrls: string[];
}

interface ParsedData {
    posts: ParsedPost[];
    authors: { login: string; displayName: string; firstName: string; lastName: string }[];
    categories: string[];
}

export async function importParsedData(data: ParsedData): Promise<ImportResult> {
    const result: ImportResult = {
        success: true,
        posts: { imported: 0, skipped: 0, errors: [], imagesImported: 0 },
        authors: { imported: 0, skipped: 0 },
        categories: { imported: 0, skipped: 0 },
        errors: [],
    };

    try {
        const hasGitHubCreds = !!(
            process.env.GITHUB_TOKEN?.trim() &&
            process.env.GITHUB_OWNER?.trim() &&
            process.env.GITHUB_REPO?.trim()
        );
        const isServerless = !!(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);

        if (isServerless && !hasGitHubCreds) {
            result.success = false;
            result.errors.push(
                'Configuração necessária: GITHUB_TOKEN, GITHUB_OWNER e GITHUB_REPO não estão configuradas.'
            );
            return result;
        }

        // ── Categorias ─────────────────────────────────────────────────
        let currentCategories = await loadCurrentCategories();
        for (const catName of data.categories) {
            if (!catName || currentCategories.includes(catName)) {
                result.categories.skipped++;
                continue;
            }
            currentCategories.push(catName);
            result.categories.imported++;
        }
        if (result.categories.imported > 0) {
            await writeFileToRepo('src/data/categories.json', JSON.stringify(currentCategories, null, 2), {
                message: 'CMS: Import WordPress — categorias',
            });
        }

        // ── Autores ────────────────────────────────────────────────────
        let currentAuthors = await loadCurrentAuthors();
        const authorLoginToId = new Map<string, string>();
        for (const author of data.authors) {
            if (!author.login) continue;
            const authorId = generateSlug(author.login);
            authorLoginToId.set(author.login, authorId);
            if (currentAuthors.some((a: any) => a.id === authorId)) {
                result.authors.skipped++;
                continue;
            }
            currentAuthors.push({
                id: authorId,
                name: author.displayName,
                role: 'Autor',
                avatar: '',
                bio: `${author.firstName} ${author.lastName}`.trim() || author.displayName,
            });
            result.authors.imported++;
        }
        if (result.authors.imported > 0) {
            await writeFileToRepo('src/data/authors.json', JSON.stringify(currentAuthors, null, 2), {
                message: 'CMS: Import WordPress — autores',
            });
        }

        // ── Posts ──────────────────────────────────────────────────────
        const existingSlugs = await loadExistingPostSlugs();
        const usedSlugs = new Set<string>(existingSlugs);

        for (const post of data.posts) {
            try {
                let slug = post.slug || generateSlug(post.title);
                if (!slug) { result.posts.skipped++; continue; }

                let slugBase = slug;
                let counter = 1;
                while (usedSlugs.has(slug)) { slug = `${slugBase}-${counter++}`; }
                usedSlugs.add(slug);

                const authorId = post.creator ? (authorLoginToId.get(post.creator) || generateSlug(post.creator)) : undefined;

                let pubDate: string | undefined;
                if (post.postDate && post.status === 'publish') {
                    try {
                        const date = new Date(post.postDate.replace(' ', 'T'));
                        if (!isNaN(date.getTime())) pubDate = date.toISOString().split('T')[0];
                    } catch {}
                }

                // Thumbnail
                let image: string | undefined;
                if (post.thumbnailUrl) {
                    const localUrl = await saveImage(post.thumbnailUrl, slug);
                    if (localUrl) { image = localUrl; result.posts.imagesImported++; }
                }

                // Content images
                let finalContent = post.content;
                if (post.imageUrls.length > 0) {
                    const imageUrlMap = new Map<string, string>();
                    for (const imgUrl of post.imageUrls) {
                        const local = await saveImage(imgUrl, slug);
                        if (local) { imageUrlMap.set(imgUrl, local); result.posts.imagesImported++; }
                    }
                    if (imageUrlMap.size > 0) finalContent = replaceImageUrls(finalContent, imageUrlMap);
                }

                let description = '';
                if (post.excerpt) description = htmlToText(post.excerpt).substring(0, 160);
                if (!description && post.content) description = htmlToText(post.content).substring(0, 160);

                const postFileContent = serializePost({
                    title: post.title,
                    slug,
                    description,
                    content: finalContent,
                    image: image || '',
                    category: post.category || '',
                    author: authorId || '',
                    pubDate: pubDate || new Date().toISOString().split('T')[0],
                    draft: post.status === 'draft',
                });

                const ok = await writeFileToRepo(postPath(slug), postFileContent, {
                    message: `CMS: Import WordPress — post "${post.title.substring(0, 50)}"`,
                });

                if (ok) { result.posts.imported++; }
                else { result.posts.errors.push(`Erro ao salvar "${post.title}"`); result.posts.skipped++; }
            } catch (err: any) {
                result.posts.errors.push(`Erro ao processar "${post.title}": ${err.message}`);
                result.posts.skipped++;
            }
        }

        return result;
    } catch (err: any) {
        result.success = false;
        result.errors.push(`Erro fatal: ${err.message || String(err)}`);
        return result;
    }
}
