/**
 * ImportPage.tsx — Plugin WP Importer
 *
 * Parseia XML do WordPress NO BROWSER (sem limite de upload do Vercel 4.5MB)
 * e envia os dados processados como JSON ao servidor.
 */

import { useState, useRef } from 'react';
import { Upload, Loader2, AlertCircle, CheckCircle, FileText } from 'lucide-react';
import { triggerToast } from '../../components/admin/CmsToaster';

interface ImportResult {
    success: boolean;
    posts: { imported: number; skipped: number; errors: string[]; imagesImported: number };
    authors: { imported: number; skipped: number };
    categories: { imported: number; skipped: number };
    errors: string[];
}

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

// ── XML parsing helpers (browser-side) ──────────────────────────────────────

function getWpText(item: Element, tag: string): string {
    // Try namespaced tags (wp:post_type, dc:creator, content:encoded, etc.)
    const nsMap: Record<string, string> = {
        'wp:': 'http://wordpress.org/export/',
        'dc:': 'http://purl.org/dc/elements/1.1/',
        'content:': 'http://purl.org/rss/1.0/modules/content/',
        'excerpt:': 'http://wordpress.org/export/',
    };

    // Try direct tag name first
    let el = item.getElementsByTagName(tag)[0];
    if (el) return el.textContent?.trim() || '';

    // Try with namespace
    for (const [prefix, ns] of Object.entries(nsMap)) {
        if (tag.startsWith(prefix)) {
            el = item.getElementsByTagNameNS(ns, tag.replace(prefix, ''))[0];
            if (el) return el.textContent?.trim() || '';
        }
    }
    return '';
}

function extractImageUrls(html: string): string[] {
    const urls: string[] = [];
    const regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let m;
    while ((m = regex.exec(html)) !== null) {
        if (m[1] && !m[1].startsWith('data:')) urls.push(m[1]);
    }
    return [...new Set(urls)];
}

function generateSlug(str: string): string {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function parseWordPressXML(xmlText: string): ParsedData {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlText, 'text/xml');

    const errors = doc.getElementsByTagName('parsererror');
    if (errors.length > 0) throw new Error('XML inválido. Verifique se o arquivo foi exportado corretamente do WordPress.');

    const channel = doc.getElementsByTagName('channel')[0];
    if (!channel) throw new Error('Formato XML inválido: elemento channel não encontrado');

    // Categories
    const categories: string[] = [];
    const wpCats = channel.getElementsByTagName('wp:category');
    for (let i = 0; i < wpCats.length; i++) {
        const name = getWpText(wpCats[i], 'wp:cat_name');
        if (name) categories.push(name);
    }

    // Authors
    const authors: ParsedData['authors'] = [];
    const wpAuthors = channel.getElementsByTagName('wp:author');
    for (let i = 0; i < wpAuthors.length; i++) {
        const login = getWpText(wpAuthors[i], 'wp:author_login');
        const displayName = getWpText(wpAuthors[i], 'wp:author_display_name') || login;
        const firstName = getWpText(wpAuthors[i], 'wp:author_first_name');
        const lastName = getWpText(wpAuthors[i], 'wp:author_last_name');
        if (login) authors.push({ login, displayName, firstName, lastName });
    }

    // Posts
    const posts: ParsedPost[] = [];
    const items = channel.getElementsByTagName('item');
    const allItems = Array.from(items); // keep for thumbnail lookup

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const postType = getWpText(item, 'wp:post_type');
        if (postType !== 'post') continue;

        const status = getWpText(item, 'wp:status');
        if (status !== 'publish' && status !== 'draft') continue;

        const title = getWpText(item, 'title') || 'Sem título';
        const slug = getWpText(item, 'wp:post_name') || generateSlug(title);
        const content = getWpText(item, 'content:encoded');
        const excerpt = getWpText(item, 'excerpt:encoded');
        const creator = getWpText(item, 'dc:creator');
        const postDate = getWpText(item, 'wp:post_date');

        // Category (first one)
        let category = '';
        const catEls = item.getElementsByTagName('category');
        for (let c = 0; c < catEls.length; c++) {
            if (catEls[c].getAttribute('domain') === 'category') {
                category = catEls[c].textContent?.trim() || '';
                if (category) break;
            }
        }

        // Thumbnail URL via postmeta
        let thumbnailUrl = '';
        const postmetas = item.getElementsByTagName('wp:postmeta');
        for (let m = 0; m < postmetas.length; m++) {
            if (getWpText(postmetas[m], 'wp:meta_key') === '_thumbnail_id') {
                const thumbId = getWpText(postmetas[m], 'wp:meta_value');
                if (thumbId) {
                    for (const att of allItems) {
                        if (getWpText(att, 'wp:post_id') === thumbId && getWpText(att, 'wp:post_type') === 'attachment') {
                            thumbnailUrl = getWpText(att, 'wp:attachment_url') ||
                                att.getElementsByTagName('guid')[0]?.textContent?.trim() || '';
                            break;
                        }
                    }
                }
                break;
            }
        }

        posts.push({
            title, slug, content, excerpt, status, creator, postDate,
            category, thumbnailUrl, imageUrls: extractImageUrls(content),
        });
    }

    return { posts, authors, categories };
}

// ── Component ───────────────────────────────────────────────────────────────

export default function ImportPage() {
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState('');
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (!f) return;
        if (!f.name.endsWith('.xml') && f.type !== 'text/xml' && f.type !== 'application/xml') {
            setError('Por favor, selecione um arquivo XML exportado do WordPress.');
            return;
        }
        setFile(f);
        setError('');
        setResult(null);
    };

    const BATCH_SIZE = 10;

    const sendBatch = async (data: ParsedData): Promise<ImportResult> => {
        const res = await fetch('/api/admin/plugins/import/wordpress', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(data),
        });
        const text = await res.text();
        try {
            const parsed = JSON.parse(text);
            if (!res.ok) throw new Error(parsed.error || `Erro ${res.status}`);
            return parsed;
        } catch {
            throw new Error(
                res.status === 401
                    ? 'Sessão expirada. Faça login novamente.'
                    : `Resposta inesperada do servidor (${res.status}). Tente recarregar a página.`
            );
        }
    };

    const handleImport = async () => {
        if (!file) { setError('Selecione um arquivo XML.'); return; }
        setImporting(true);
        setError('');
        setResult(null);

        try {
            // Step 1: Read & parse XML in browser
            setProgress('Lendo arquivo XML...');
            triggerToast('Lendo arquivo XML...', 'progress', 10);
            const xmlText = await file.text();

            setProgress('Processando posts, categorias e autores...');
            triggerToast('Processando XML...', 'progress', 30);
            const parsed = parseWordPressXML(xmlText);

            const totalPosts = parsed.posts.length;
            setProgress(`Encontrados ${totalPosts} posts, ${parsed.categories.length} categorias, ${parsed.authors.length} autores.`);

            // Step 2: Send in batches (categories + authors in first batch, posts split in chunks)
            const totalResult: ImportResult = {
                success: true,
                posts: { imported: 0, skipped: 0, errors: [], imagesImported: 0 },
                authors: { imported: 0, skipped: 0 },
                categories: { imported: 0, skipped: 0 },
                errors: [],
            };

            const batches: ParsedData[] = [];
            for (let i = 0; i < totalPosts; i += BATCH_SIZE) {
                batches.push({
                    posts: parsed.posts.slice(i, i + BATCH_SIZE),
                    // Only send authors + categories in the first batch
                    authors: i === 0 ? parsed.authors : [],
                    categories: i === 0 ? parsed.categories : [],
                });
            }
            // Edge case: no posts but has categories/authors
            if (batches.length === 0) {
                batches.push({ posts: [], authors: parsed.authors, categories: parsed.categories });
            }

            for (let b = 0; b < batches.length; b++) {
                const pct = Math.round(40 + (b / batches.length) * 55);
                const from = b * BATCH_SIZE + 1;
                const to = Math.min((b + 1) * BATCH_SIZE, totalPosts);
                setProgress(`Importando posts ${from}-${to} de ${totalPosts}...`);
                triggerToast(`Lote ${b + 1}/${batches.length} (posts ${from}-${to})`, 'progress', pct);

                const batchResult = await sendBatch(batches[b]);

                totalResult.posts.imported += batchResult.posts.imported;
                totalResult.posts.skipped += batchResult.posts.skipped;
                totalResult.posts.imagesImported += batchResult.posts.imagesImported;
                totalResult.posts.errors.push(...batchResult.posts.errors);
                totalResult.authors.imported += batchResult.authors.imported;
                totalResult.authors.skipped += batchResult.authors.skipped;
                totalResult.categories.imported += batchResult.categories.imported;
                totalResult.categories.skipped += batchResult.categories.skipped;
                totalResult.errors.push(...batchResult.errors);
                if (!batchResult.success) totalResult.success = false;
            }

            setResult(totalResult);
            if (totalResult.success) {
                triggerToast(`Importação concluída! ${totalResult.posts.imported} posts importados.`, 'success');
            } else {
                triggerToast('Importação concluída com erros. Verifique os detalhes.', 'info');
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao importar');
            triggerToast(`Erro: ${err.message}`, 'error');
        } finally {
            setImporting(false);
            setProgress('');
        }
    };

    return (
        <div className="max-w-2xl space-y-6">
            {/* Instruções */}
            <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5">
                <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-3">Como exportar do WordPress</p>
                <ol className="space-y-1.5">
                    {[
                        'No painel WordPress, vá em Ferramentas → Exportar',
                        'Selecione "Todos os posts" ou "Todo o conteúdo"',
                        'Clique em "Baixar arquivo de exportação"',
                        'Faça upload do arquivo .xml aqui',
                    ].map((step, i) => (
                        <li key={i} className="flex items-start gap-2.5 text-sm text-blue-800">
                            <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                            {step}
                        </li>
                    ))}
                </ol>
            </div>

            {/* O que será importado */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-3">O que será importado</p>
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { icon: '📝', label: 'Posts publicados e rascunhos' },
                        { icon: '👥', label: 'Autores' },
                        { icon: '🏷️', label: 'Categorias' },
                        { icon: '🖼️', label: 'Imagens (quando disponíveis)' },
                    ].map(item => (
                        <div key={item.label} className="flex items-center gap-2 text-sm text-slate-600">
                            <span>{item.icon}</span>
                            {item.label}
                        </div>
                    ))}
                </div>
                <p className="text-xs text-slate-400 mt-3">
                    Posts com o mesmo slug já existentes serão ignorados. Autores e categorias duplicados também.
                </p>
            </div>

            {/* Upload */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Arquivo de Exportação (.xml)</p>

                <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${file ? 'border-violet-300 bg-violet-50' : 'border-slate-200 hover:border-violet-300 hover:bg-violet-50/50'}`}
                    onClick={() => fileInputRef.current?.click()}
                >
                    {file ? (
                        <>
                            <FileText className="w-8 h-8 text-violet-500 mx-auto mb-2" />
                            <p className="font-medium text-slate-800 text-sm">{file.name}</p>
                            <p className="text-xs text-slate-400 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB · Clique para trocar</p>
                        </>
                    ) : (
                        <>
                            <Upload className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="font-medium text-slate-500 text-sm">Clique para selecionar o arquivo XML</p>
                            <p className="text-xs text-slate-400 mt-1">Arquivo exportado do WordPress (.xml) — sem limite de tamanho</p>
                        </>
                    )}
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xml,text/xml,application/xml"
                    onChange={handleFileChange}
                    className="hidden"
                />
            </div>

            {/* Erro */}
            {error && (
                <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium rounded-r-xl flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
            )}

            {/* Resultado */}
            {result && (
                <div className={`bg-white rounded-2xl border shadow-sm p-6 ${result.success ? 'border-green-200' : 'border-amber-200'}`}>
                    <div className="flex items-center gap-2 mb-4">
                        <CheckCircle className={`w-5 h-5 ${result.success ? 'text-green-500' : 'text-amber-500'}`} />
                        <p className="font-bold text-slate-800">
                            {result.success ? 'Importação concluída!' : 'Importação concluída com erros'}
                        </p>
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                        {[
                            { label: 'Posts', imported: result.posts.imported, skipped: result.posts.skipped },
                            { label: 'Autores', imported: result.authors.imported, skipped: result.authors.skipped },
                            { label: 'Categorias', imported: result.categories.imported, skipped: result.categories.skipped },
                        ].map(s => (
                            <div key={s.label} className="bg-slate-50 rounded-xl p-3 text-center">
                                <p className="text-2xl font-bold text-violet-600">{s.imported}</p>
                                <p className="text-xs text-slate-500">{s.label} importados</p>
                                {s.skipped > 0 && <p className="text-xs text-slate-400">{s.skipped} ignorados</p>}
                            </div>
                        ))}
                    </div>

                    {result.posts.imagesImported > 0 && (
                        <p className="text-sm text-slate-600 mb-3">
                            🖼️ {result.posts.imagesImported} imagem(ns) importada(s) com sucesso.
                        </p>
                    )}

                    {result.posts.errors.length > 0 && (
                        <div>
                            <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">Erros nos posts</p>
                            <div className="max-h-32 overflow-y-auto space-y-1">
                                {result.posts.errors.map((e, i) => (
                                    <p key={i} className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{e}</p>
                                ))}
                            </div>
                        </div>
                    )}

                    {result.errors.length > 0 && (
                        <div className="mt-3">
                            <p className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">Erros gerais</p>
                            {result.errors.map((e, i) => (
                                <p key={i} className="text-xs text-red-600">{e}</p>
                            ))}
                        </div>
                    )}

                    <a href="/admin/posts" className="mt-4 inline-block text-sm text-violet-600 hover:underline font-medium">
                        → Ver posts importados
                    </a>
                </div>
            )}

            {/* Botão importar */}
            <button
                type="button"
                onClick={handleImport}
                disabled={importing || !file}
                className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm shadow-violet-600/20"
            >
                {importing ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Importando...</>
                ) : (
                    <><Upload className="w-4 h-4" /> Importar do WordPress</>
                )}
            </button>

            {importing && (
                <div className="bg-violet-50 border border-violet-200 rounded-xl p-4">
                    <p className="text-sm text-violet-700 font-medium">
                        {progress || 'Importando posts e baixando imagens... Isso pode levar alguns minutos.'}
                    </p>
                </div>
            )}
        </div>
    );
}
