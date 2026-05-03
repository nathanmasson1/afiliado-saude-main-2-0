/**
 * AIPostGenerator.tsx — Plugin AI Generator (Walker)
 *
 * UI React para geração de posts com IA.
 * Adaptado do CNX para o estilo visual do Walker (white/slate/violet).
 */

import { useState, useEffect } from 'react';
import { Sparkles, Loader2, AlertCircle, ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown } from 'lucide-react';
import { triggerToast } from '../../components/admin/CmsToaster';

interface Author {
    slug: string;
    name: string;
}

interface Category {
    slug: string;
    name: string;
}

interface Outline {
    level: 'h1' | 'h2' | 'h3' | 'h4';
    text: string;
    minWords?: number;
}

interface Product {
    name: string;
    imageUrl: string;
}

type CommercialItem =
    | { type: 'outline'; level: 'h1' | 'h2' | 'h3' | 'h4'; text: string; minWords?: number }
    | { type: 'product'; name: string; imageUrl: string };

type CommercialSubType = 'guia-melhores' | 'spr';

interface Props {
    authors: Author[];
    categories: Category[];
}

export default function AIPostGenerator({ authors, categories }: Props) {
    const [isMounted, setIsMounted] = useState(false);
    const [postType, setPostType] = useState<'informational' | 'commercial'>('informational');
    const [commercialSubType, setCommercialSubType] = useState<CommercialSubType>('guia-melhores');
    const [title, setTitle] = useState('');
    const [slug, setSlug] = useState('');
    const [author, setAuthor] = useState('');
    const [category, setCategory] = useState('');
    const [outlines, setOutlines] = useState<Outline[]>([]);
    const [commercialItems, setCommercialItems] = useState<CommercialItem[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [progress, setProgress] = useState('');
    const [error, setError] = useState('');

    useEffect(() => { setIsMounted(true); }, []);

    useEffect(() => {
        if (title && !slug) {
            setSlug(title.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''));
        }
    }, [title, slug]);

    if (!isMounted) return (
        <div className="flex items-center justify-center p-20 text-slate-400">
            <Loader2 className="w-6 h-6 animate-spin mr-3" />
            Carregando gerador...
        </div>
    );

    const inputClass = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all shadow-sm';
    const labelClass = 'block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1';

    // Outline management
    const addOutline = (level: Outline['level']) => setOutlines([...outlines, { level, text: '' }]);
    const updateOutline = (i: number, updates: Partial<Outline>) => {
        const next = [...outlines];
        Object.assign(next[i], updates);
        setOutlines(next);
    };
    const removeOutline = (i: number) => setOutlines(outlines.filter((_, idx) => idx !== i));
    const moveOutline = (i: number, dir: 'up' | 'down') => {
        if (dir === 'up' && i === 0) return;
        if (dir === 'down' && i === outlines.length - 1) return;
        const next = [...outlines];
        const t = dir === 'up' ? i - 1 : i + 1;
        [next[i], next[t]] = [next[t], next[i]];
        setOutlines(next);
    };

    // Commercial items management
    const addCommercialItem = (type: 'outline' | 'product', level?: Outline['level']) => {
        if (type === 'outline' && level) setCommercialItems([...commercialItems, { type: 'outline', level, text: '' }]);
        else setCommercialItems([...commercialItems, { type: 'product', name: '', imageUrl: '' }]);
    };
    const updateCommercialItem = (i: number, updates: any) => {
        const next = [...commercialItems];
        Object.assign(next[i], updates);
        setCommercialItems(next);
    };
    const removeCommercialItem = (i: number) => setCommercialItems(commercialItems.filter((_, idx) => idx !== i));
    const moveCommercialItem = (i: number, dir: 'up' | 'down') => {
        if (dir === 'up' && i === 0) return;
        if (dir === 'down' && i === commercialItems.length - 1) return;
        const next = [...commercialItems];
        const t = dir === 'up' ? i - 1 : i + 1;
        [next[i], next[t]] = [next[t], next[i]];
        setCommercialItems(next);
    };

    const handleGenerate = async () => {
        if (!title || !slug) { setError('Título e slug são obrigatórios.'); return; }
        if (!author) { setError('Selecione um autor.'); return; }
        if (!category) { setError('Selecione uma categoria.'); return; }
        if (postType === 'commercial') {
            const hasValid = commercialItems.some(i => i.type === 'outline' ? i.text?.trim() : i.name?.trim());
            if (!hasValid) { setError('Adicione pelo menos um produto ou outline.'); return; }
        } else {
            if (!outlines.length || outlines.some(o => !o.text.trim())) {
                setError('Adicione pelo menos uma outline preenchida.'); return;
            }
        }

        setError('');
        setIsGenerating(true);
        setProgress('Conectando ao servidor...');

        try {
            const response = await fetch('/api/admin/plugins/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    postType,
                    commercialSubType: postType === 'commercial' ? commercialSubType : undefined,
                    title, slug, author, category,
                    outlines: postType === 'informational' ? outlines : undefined,
                    commercialItems: postType === 'commercial' ? commercialItems : undefined,
                }),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(err.error || `Erro ${response.status}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            if (reader) {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    buffer += decoder.decode(value, { stream: true });
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                if (data.step === 'progress') setProgress(data.message);
                                if (data.step === 'done') {
                                    setProgress('Post publicado com sucesso!');
                                    triggerToast(`Post "${data.title}" publicado!`, 'success');
                                    setTimeout(() => { window.location.href = '/admin/posts'; }, 2000);
                                    return;
                                }
                                if (data.step === 'error') throw new Error(data.error);
                            } catch (e) {
                                if (e instanceof Error && e.message !== 'Unexpected end of JSON input') throw e;
                            }
                        }
                    }
                }
            }
        } catch (err: any) {
            setError(err.message || 'Erro ao gerar post');
            setProgress('');
        } finally {
            setIsGenerating(false);
        }
    };

    const levelColors: Record<string, string> = {
        h1: 'bg-violet-100 text-violet-700',
        h2: 'bg-blue-100 text-blue-700',
        h3: 'bg-green-100 text-green-700',
        h4: 'bg-amber-100 text-amber-700',
    };

    const canGenerate = title && slug && author && category && (
        postType === 'informational'
            ? outlines.length > 0 && outlines.every(o => o.text.trim())
            : commercialItems.some(i => i.type === 'outline' ? i.text?.trim() : i.name?.trim())
    );

    return (
        <div className="max-w-3xl pb-16 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between bg-white p-4 px-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <a href="/admin/posts" className="text-slate-400 hover:text-violet-600 transition-colors p-1.5 rounded-lg hover:bg-violet-50">
                        <ArrowLeft className="w-5 h-5" />
                    </a>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">Gerar Post com IA</h2>
                        <p className="text-xs text-slate-400">Conteúdo criado automaticamente por inteligência artificial</p>
                    </div>
                </div>
                <Sparkles className="w-6 h-6 text-violet-500" />
            </div>

            {/* Tipo de Post */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <p className={labelClass}>Tipo de Post</p>
                <div className="grid grid-cols-2 gap-3">
                    {[
                        { id: 'informational', label: 'Post Informacional', desc: 'Artigos educativos e informativos', icon: '📚' },
                        { id: 'commercial', label: 'Post Comercial', desc: 'Guias e reviews focados em conversão', icon: '💼' },
                    ].map(t => (
                        <button
                            key={t.id}
                            type="button"
                            onClick={() => setPostType(t.id as any)}
                            className={`p-4 rounded-xl border-2 text-left transition-all ${postType === t.id ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}
                        >
                            <div className="text-2xl mb-1">{t.icon}</div>
                            <div className="font-bold text-slate-800 text-sm">{t.label}</div>
                            <div className="text-xs text-slate-500">{t.desc}</div>
                        </button>
                    ))}
                </div>

                {postType === 'commercial' && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                        <p className={labelClass}>Sub-tipo Comercial</p>
                        <div className="grid grid-cols-2 gap-3">
                            {[
                                { id: 'guia-melhores', label: 'Guia dos melhores', desc: 'Listas ranqueadas (ex: Os 10 melhores X)', icon: '📋' },
                                { id: 'spr', label: 'SPR — Single Product Review', desc: 'Review de um único produto/serviço', icon: '⭐' },
                            ].map(s => (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => setCommercialSubType(s.id as CommercialSubType)}
                                    className={`p-3 rounded-xl border-2 text-left transition-all ${commercialSubType === s.id ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}
                                >
                                    <div className="text-xl mb-1">{s.icon}</div>
                                    <div className="font-bold text-slate-800 text-xs">{s.label}</div>
                                    <div className="text-xs text-slate-500">{s.desc}</div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Informações básicas */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
                <p className={labelClass}>Informações Básicas</p>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Título *</label>
                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} className={inputClass} placeholder="Ex: Como Cuidar da Sua Saúde Mental" />
                </div>
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">Slug *</label>
                    <input type="text" value={slug} onChange={e => setSlug(e.target.value)} className={`${inputClass} font-mono`} placeholder="como-cuidar-da-sua-saude-mental" />
                    <p className="text-xs text-slate-400 mt-1 ml-1">Gerado automaticamente do título — pode editar.</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Autor *</label>
                        <select value={author} onChange={e => setAuthor(e.target.value)} className={inputClass}>
                            <option value="">Selecione um autor</option>
                            {authors.map(a => <option key={a.slug} value={a.slug}>{a.name}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">Categoria *</label>
                        <select value={category} onChange={e => setCategory(e.target.value)} className={inputClass}>
                            <option value="">Selecione uma categoria</option>
                            {categories.map(c => <option key={c.slug} value={c.slug}>{c.name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            {/* Estrutura — Informacional */}
            {postType === 'informational' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className={labelClass}>Estrutura do Post (Outlines)</p>
                            <p className="text-xs text-slate-400 ml-1">Introdução e conclusão são geradas automaticamente.</p>
                        </div>
                        <div className="flex gap-1.5">
                            {(['h1','h2','h3','h4'] as Outline['level'][]).map(l => (
                                <button key={l} type="button" onClick={() => addOutline(l)} className={`px-2.5 py-1 rounded-lg text-xs font-bold ${levelColors[l]} hover:opacity-80 transition-opacity`}>
                                    +{l.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                    {outlines.length > 0 ? (
                        <div className="space-y-2">
                            {outlines.map((o, i) => (
                                <div key={i} className="flex items-center gap-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <span className={`px-2 py-1 rounded text-xs font-bold shrink-0 ${levelColors[o.level]}`}>{o.level.toUpperCase()}</span>
                                    <input type="text" value={o.text} onChange={e => updateOutline(i, { text: e.target.value })} className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-violet-500" placeholder={`Título do ${o.level.toUpperCase()}...`} />
                                    <input type="number" min={50} max={2000} value={o.minWords ?? ''} onChange={e => { const v = parseInt(e.target.value); updateOutline(i, { minWords: isNaN(v) ? undefined : Math.max(50, Math.min(2000, v)) }); }} className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:border-violet-500" placeholder="100-150" title="Palavras alvo" />
                                    <div className="flex flex-col gap-0.5">
                                        <button type="button" onClick={() => moveOutline(i, 'up')} disabled={i === 0} className="text-slate-300 hover:text-slate-600 disabled:opacity-20"><ChevronUp className="w-3.5 h-3.5" /></button>
                                        <button type="button" onClick={() => moveOutline(i, 'down')} disabled={i === outlines.length - 1} className="text-slate-300 hover:text-slate-600 disabled:opacity-20"><ChevronDown className="w-3.5 h-3.5" /></button>
                                    </div>
                                    <button type="button" onClick={() => removeOutline(i)} className="text-red-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                            <p className="text-slate-400 text-sm mb-1">Nenhuma outline adicionada</p>
                            <p className="text-slate-300 text-xs">Clique nos botões acima para adicionar títulos</p>
                        </div>
                    )}
                </div>
            )}

            {/* Estrutura — Comercial */}
            {postType === 'commercial' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <p className={labelClass}>Estrutura do Post</p>
                            <p className="text-xs text-slate-400 ml-1">Adicione outlines e produtos na ordem desejada.</p>
                        </div>
                        <div className="flex gap-1.5 flex-wrap justify-end">
                            {(['h1','h2','h3','h4'] as Outline['level'][]).map(l => (
                                <button key={l} type="button" onClick={() => addCommercialItem('outline', l)} className={`px-2.5 py-1 rounded-lg text-xs font-bold ${levelColors[l]} hover:opacity-80 transition-opacity`}>
                                    +{l.toUpperCase()}
                                </button>
                            ))}
                            <button type="button" onClick={() => addCommercialItem('product')} className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-700 hover:opacity-80 transition-opacity flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Produto
                            </button>
                        </div>
                    </div>
                    {commercialItems.length > 0 ? (
                        <div className="space-y-2">
                            {commercialItems.map((item, i) => (
                                <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                                    <div className="flex items-center gap-2">
                                        {item.type === 'outline' ? (
                                            <>
                                                <select value={item.level} onChange={e => updateCommercialItem(i, { level: e.target.value })} className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-violet-500 shrink-0">
                                                    {['h1','h2','h3','h4'].map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                                                </select>
                                                <input type="text" value={item.text} onChange={e => updateCommercialItem(i, { text: e.target.value })} className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-violet-500" placeholder="Título da seção..." />
                                                <input type="number" min={50} max={2000} value={item.minWords ?? ''} onChange={e => { const v = parseInt(e.target.value); updateCommercialItem(i, { minWords: isNaN(v) ? undefined : Math.max(50, Math.min(2000, v)) }); }} className="w-20 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-xs text-center focus:outline-none focus:border-violet-500" placeholder="100-150" />
                                            </>
                                        ) : (
                                            <span className="px-2 py-1 rounded text-xs font-bold shrink-0 bg-amber-100 text-amber-700">Produto</span>
                                        )}
                                        <div className="flex flex-col gap-0.5 shrink-0">
                                            <button type="button" onClick={() => moveCommercialItem(i, 'up')} disabled={i === 0} className="text-slate-300 hover:text-slate-600 disabled:opacity-20"><ChevronUp className="w-3.5 h-3.5" /></button>
                                            <button type="button" onClick={() => moveCommercialItem(i, 'down')} disabled={i === commercialItems.length - 1} className="text-slate-300 hover:text-slate-600 disabled:opacity-20"><ChevronDown className="w-3.5 h-3.5" /></button>
                                        </div>
                                        <button type="button" onClick={() => removeCommercialItem(i)} className="text-red-400 hover:text-red-600 transition-colors shrink-0"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                    {item.type === 'product' && (
                                        <div className="grid grid-cols-2 gap-3 mt-3">
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">Nome do produto *</label>
                                                <input type="text" value={item.name} onChange={e => updateCommercialItem(i, { name: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-violet-500" placeholder="Ex: Produto X Pro" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-slate-500 mb-1">URL da imagem</label>
                                                <input type="url" value={item.imageUrl} onChange={e => updateCommercialItem(i, { imageUrl: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-violet-500" placeholder="https://exemplo.com/img.jpg" />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 border-2 border-dashed border-slate-200 rounded-xl">
                            <p className="text-slate-400 text-sm">Nenhum item adicionado</p>
                            <p className="text-slate-300 text-xs mt-1">Use os botões acima para adicionar outlines ou produtos</p>
                        </div>
                    )}
                </div>
            )}

            {/* Erro */}
            {error && (
                <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium rounded-r-xl flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
            )}

            {/* Progresso */}
            {progress && (
                <div className="bg-white rounded-2xl border-2 border-violet-200 shadow-sm p-6">
                    <div className="flex items-start gap-4">
                        <div className="w-11 h-11 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                            {isGenerating ? <Sparkles className="w-5 h-5 text-violet-600 animate-pulse" /> : <span>✅</span>}
                        </div>
                        <div>
                            <p className="font-bold text-slate-800">{isGenerating ? 'Criando seu post...' : 'Concluído!'}</p>
                            <p className="text-sm text-slate-500 mt-1">{progress}</p>
                            <p className="text-xs text-slate-400 mt-1.5">
                                {isGenerating ? 'Aguarde enquanto a IA escreve cada seção. Isso pode levar alguns minutos.' : 'Redirecionando para a lista de posts...'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Botão Gerar */}
            <div className="flex items-center justify-end gap-3">
                <a href="/admin/posts" className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                    Cancelar
                </a>
                <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isGenerating || !canGenerate}
                    className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm shadow-violet-600/20"
                >
                    {isGenerating ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Gerando...</>
                    ) : (
                        <><Sparkles className="w-4 h-4" /> Gerar e Publicar Post</>
                    )}
                </button>
            </div>
        </div>
    );
}
