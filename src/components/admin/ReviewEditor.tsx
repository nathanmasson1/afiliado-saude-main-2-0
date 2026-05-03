import React, { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, Plus, Trash2, Star, Package, MessageSquare, FileText, Search, ChevronDown, ChevronUp, Sparkles, Award, ExternalLink, Wand2, X, Download } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

type Product = {
    name: string;
    price: string;
    originalPrice: string;
    rating: number;
    store: string;
    image: string;
    affiliateLink: string;
    badge: string;
    review: string;
    pros: string[];
    cons: string[];
    featured: boolean;
};

type Faq = { q: string; a: string };

type ReviewData = {
    title: string;
    slug: string;
    description: string;
    image: string;
    imageAlt: string;
    category: string;
    badge: string;
    priceRange: string;
    rating: number;
    intro: string;
    conclusion: string;
    products: Product[];
    faqs: Faq[];
    seoTitle: string;
    seoDescription: string;
    draft: boolean;
};

const STORES = [
    { value: 'amazon', label: 'Amazon' },
    { value: 'mercado-livre', label: 'Mercado Livre' },
    { value: 'shopee', label: 'Shopee' },
    { value: 'hotmart', label: 'Hotmart' },
    { value: 'eduzz', label: 'Eduzz' },
    { value: 'monetizze', label: 'Monetizze' },
    { value: 'outro', label: 'Outro' },
];

const BADGES = [
    { value: '', label: 'Nenhum' },
    { value: 'top-pick', label: '🏆 Top Pick' },
    { value: 'best-value', label: '💰 Melhor Custo-Benefício' },
    { value: 'editor-choice', label: '⭐ Escolha do Editor' },
];

const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm";
const labelClass = "block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5";

function slugify(text: string): string {
    return text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

function SectionCard({ title, icon, children, defaultOpen = false, badge }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean; badge?: string }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                    {icon}
                    <h3 className="text-base font-bold text-slate-800">{title}</h3>
                    {badge && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">{badge}</span>}
                </div>
                {open ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>
            {open && <div className="px-6 pb-6 border-t border-slate-100 pt-4">{children}</div>}
        </div>
    );
}

const emptyProduct: Product = {
    name: '', price: '', originalPrice: '', rating: 4.5, store: 'amazon', image: '',
    affiliateLink: '', badge: '', review: '', pros: [''], cons: [''], featured: false,
};

const emptyData: ReviewData = {
    title: '', slug: '', description: '', image: '', imageAlt: '', category: 'reviews',
    badge: '', priceRange: '', rating: 0, intro: '', conclusion: '',
    products: [{ ...emptyProduct, featured: true }], faqs: [{ q: '', a: '' }],
    seoTitle: '', seoDescription: '', draft: false,
};

function buildMarkdown(d: ReviewData): string {
    const escape = (s: string) => s.replace(/"/g, '\\"');
    const today = new Date().toISOString().split('T')[0];

    const productsYaml = d.products.map(p => {
        const lines = [
            `  - name: "${escape(p.name)}"`,
            p.price && `    price: "${escape(p.price)}"`,
            p.originalPrice && `    originalPrice: "${escape(p.originalPrice)}"`,
            p.rating > 0 && `    rating: ${p.rating}`,
            `    store: "${p.store || 'outro'}"`,
            p.image && `    image: "${escape(p.image)}"`,
            `    affiliateLink: "${escape(p.affiliateLink)}"`,
            p.badge && `    badge: "${escape(p.badge)}"`,
            p.review && `    review: |\n${p.review.split('\n').map(l => `      ${l}`).join('\n')}`,
            p.pros.filter(Boolean).length > 0 && `    pros:\n${p.pros.filter(Boolean).map(x => `      - "${escape(x)}"`).join('\n')}`,
            p.cons.filter(Boolean).length > 0 && `    cons:\n${p.cons.filter(Boolean).map(x => `      - "${escape(x)}"`).join('\n')}`,
            `    featured: ${p.featured}`,
        ].filter(Boolean).join('\n');
        return lines;
    }).join('\n');

    const validFaqs = d.faqs.filter(f => f.q);
    const faqsYaml = validFaqs.length > 0
        ? 'faqs:\n' + validFaqs.map(f => `  - q: "${escape(f.q)}"\n    a: "${escape(f.a)}"`).join('\n')
        : '';

    const conclusionYaml = d.conclusion
        ? `conclusion: |\n${d.conclusion.split('\n').map(l => `  ${l}`).join('\n')}`
        : '';

    const fm: string[] = [
        '---',
        `title: "${escape(d.title)}"`,
        `description: "${escape(d.description || d.intro.slice(0, 160))}"`,
        `pubDate: "${today}"`,
        d.image && `image: "${escape(d.image)}"`,
        d.imageAlt && `imageAlt: "${escape(d.imageAlt)}"`,
        `category: "${d.category || 'reviews'}"`,
        d.badge && `badge: "${d.badge}"`,
        d.priceRange && `priceRange: "${escape(d.priceRange)}"`,
        d.rating > 0 && `rating: ${d.rating}`,
        d.products.length > 0 && `products:\n${productsYaml}`,
        conclusionYaml,
        faqsYaml,
        `draft: ${d.draft}`,
        '---',
    ].filter(Boolean) as string[];

    const body = d.intro ? d.intro : '';

    return fm.join('\n') + '\n\n' + body + '\n';
}

export default function ReviewEditor() {
    const [data, setData] = useState<ReviewData>(emptyData);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [preview, setPreview] = useState(false);
    const [categories, setCategories] = useState<any[]>([]);
    const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);
    const [aiModalOpen, setAiModalOpen] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState('');
    const [aiUrls, setAiUrls] = useState('');
    const [aiAngle, setAiAngle] = useState('');
    const [aiProgress, setAiProgress] = useState<{ stage: string; current: number; total: number } | null>(null);

    useEffect(() => {
        githubApi('read', 'src/data/categories.json')
            .then(res => { const p = JSON.parse(res?.content || '[]'); if (Array.isArray(p)) setCategories(p); })
            .catch(() => { });
        githubApi('read', 'src/data/siteConfig.json')
            .then(res => {
                try {
                    const cfg = JSON.parse(res?.content || '{}');
                    setAiConfigured(!!(cfg.ai && cfg.ai.openaiKey && cfg.ai.openaiKey.length > 10));
                } catch { setAiConfigured(false); }
            })
            .catch(() => setAiConfigured(false));
    }, []);

    const set = (field: keyof ReviewData, value: any) => {
        setData(prev => {
            const next = { ...prev, [field]: value };
            if (field === 'title' && !prev.slug) next.slug = slugify(value);
            return next;
        });
    };

    const setProduct = (idx: number, field: keyof Product, value: any) => {
        setData(prev => {
            const products = [...prev.products];
            products[idx] = { ...products[idx], [field]: value };
            if (field === 'featured' && value) {
                products.forEach((p, i) => { if (i !== idx) p.featured = false; });
            }
            return { ...prev, products };
        });
    };

    const setProductArr = (idx: number, field: 'pros' | 'cons', arr: string[]) => {
        setData(prev => {
            const products = [...prev.products];
            products[idx] = { ...products[idx], [field]: arr };
            return { ...prev, products };
        });
    };

    const addProduct = () => set('products', [...data.products, { ...emptyProduct }]);
    const removeProduct = (i: number) => set('products', data.products.filter((_, x) => x !== i));

    const [importingIdx, setImportingIdx] = useState<number | null>(null);
    const importFromUrl = async (idx: number) => {
        const url = data.products[idx].affiliateLink;
        if (!url || !url.match(/^https?:\/\//)) {
            triggerToast('Cole o link de afiliado primeiro', 'error');
            return;
        }
        setImportingIdx(idx);
        try {
            const res = await fetch('/api/admin/scrape-product', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
            });
            const json = await res.json();
            if (!res.ok || !json.ok) {
                triggerToast(json.error || 'Erro ao importar', 'error');
                setImportingIdx(null);
                return;
            }
            const d = json.data;
            setData(prev => {
                const products = [...prev.products];
                products[idx] = {
                    ...products[idx],
                    name: d.name || products[idx].name,
                    price: d.price || products[idx].price,
                    originalPrice: d.originalPrice || products[idx].originalPrice,
                    image: d.image || products[idx].image,
                    rating: d.rating || products[idx].rating,
                    store: d.store || products[idx].store,
                };
                return { ...prev, products };
            });
            triggerToast('Produto importado!', 'success', 100);
        } catch (err: any) {
            triggerToast(err.message || 'Erro de rede', 'error');
        } finally {
            setImportingIdx(null);
        }
    };

    const addFaq = () => set('faqs', [...data.faqs, { q: '', a: '' }]);
    const removeFaq = (i: number) => set('faqs', data.faqs.filter((_, x) => x !== i));
    const setFaq = (i: number, field: 'q' | 'a', value: string) => {
        const arr = [...data.faqs]; arr[i] = { ...arr[i], [field]: value }; set('faqs', arr);
    };

    const save = async () => {
        if (!data.title || !data.slug) { setError('Título e slug são obrigatórios'); return; }
        if (data.products.filter(p => p.name && p.affiliateLink).length === 0) {
            setError('Adicione pelo menos 1 produto com nome e link de afiliado'); return;
        }
        for (const p of data.products) {
            if (p.affiliateLink && !p.affiliateLink.match(/^https?:\/\//)) {
                setError(`Link de afiliado inválido em "${p.name}". Deve começar com http:// ou https://`); return;
            }
        }
        setSaving(true); setError('');
        triggerToast('Criando review...', 'progress', 30);
        try {
            const md = buildMarkdown(data);
            const path = `src/content/blog/${data.slug}.md`;
            await githubApi('write', path, { content: md, message: `CMS: Novo review - ${data.title}` });
            triggerToast('Review criado com sucesso!', 'success', 100);
            setTimeout(() => { window.location.href = '/admin/posts'; }, 800);
        } catch (err: any) {
            setError(err.message); triggerToast(`Erro: ${err.message}`, 'error');
            setSaving(false);
        }
    };

    const validProducts = data.products.filter(p => p.name).length;
    const validFaqs = data.faqs.filter(f => f.q).length;

    const openAiModal = () => {
        const existing = data.products.filter(p => p.affiliateLink).map(p => p.affiliateLink).join('\n');
        setAiUrls(existing);
        setAiAngle('');
        setAiError('');
        setAiProgress(null);
        setAiModalOpen(true);
    };

    const generateWithAI = async () => {
        const urls = aiUrls.split(/[\n,;\s]+/).map(u => u.trim()).filter(u => u.match(/^https?:\/\//));
        if (urls.length === 0) { setAiError('Cole pelo menos 1 URL válida'); return; }
        setAiLoading(true); setAiError('');

        const scraped: any[] = [];
        const failed: string[] = [];

        for (let i = 0; i < urls.length; i++) {
            setAiProgress({ stage: 'scraping', current: i + 1, total: urls.length });
            try {
                const res = await fetch('/api/admin/scrape-product', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: urls[i] }),
                });
                const json = await res.json();
                if (res.ok && json.ok) scraped.push(json.data);
                else failed.push(`${urls[i].slice(0, 60)}... — ${json.error || 'erro'}`);
            } catch (err: any) {
                failed.push(`${urls[i].slice(0, 60)}... — ${err.message}`);
            }
        }

        if (scraped.length === 0) {
            setAiError(`Nenhum produto pôde ser importado:\n${failed.join('\n')}`);
            setAiLoading(false);
            setAiProgress(null);
            return;
        }

        setAiProgress({ stage: 'writing', current: 0, total: scraped.length });

        try {
            const res = await fetch('/api/admin/ai-review', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    products: scraped.map(s => ({
                        name: s.name,
                        affiliateLink: s.affiliateLink,
                        notes: [s.price && `Preço: ${s.price}`, s.rating && `Nota: ${s.rating}/5`, aiAngle && `Foco editorial: ${aiAngle}`].filter(Boolean).join(' | '),
                    })),
                    angle: aiAngle,
                    autoTitle: true,
                }),
            });
            const json = await res.json();
            if (!res.ok || !json.ok) {
                setAiError(json.error || 'Erro ao gerar review');
                setAiLoading(false);
                setAiProgress(null);
                return;
            }
            const ai = json.data;

            setData(prev => {
                const products = scraped.map((s, i) => {
                    const aiProd = ai.products?.[i] || {};
                    return {
                        ...emptyProduct,
                        name: s.name || '',
                        affiliateLink: s.affiliateLink || '',
                        price: s.price || '',
                        originalPrice: s.originalPrice || '',
                        image: s.image || '',
                        rating: s.rating || 0,
                        store: s.store || 'outro',
                        review: aiProd.review || '',
                        pros: aiProd.pros && aiProd.pros.length > 0 ? aiProd.pros : [''],
                        cons: aiProd.cons && aiProd.cons.length > 0 ? aiProd.cons : [''],
                        featured: i === 0,
                    };
                });
                const title = ai.title || prev.title || scraped.map(s => s.name).slice(0, 3).join(' vs ');
                return {
                    ...prev,
                    title,
                    slug: prev.slug || slugify(title),
                    description: ai.description || prev.description,
                    intro: ai.intro || prev.intro,
                    conclusion: ai.conclusion || prev.conclusion,
                    products,
                    faqs: ai.faqs && ai.faqs.length > 0 ? ai.faqs : prev.faqs,
                    badge: ai.badge || prev.badge,
                };
            });

            const msg = failed.length > 0
                ? `Review gerado! ${failed.length} URL(s) falharam.`
                : 'Review gerado pela IA!';
            triggerToast(msg, 'success', 100);
            setAiModalOpen(false);
            setAiLoading(false);
            setAiProgress(null);
        } catch (err: any) {
            setAiError(err.message || 'Erro de rede ao gerar review');
            setAiLoading(false);
            setAiProgress(null);
        }
    };

    return (
        <div className="space-y-6 pb-32 max-w-5xl">
            {/* Header */}
            <div className="flex items-center justify-between bg-white/80 backdrop-blur-xl p-5 px-8 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 sticky top-0 z-40">
                <div>
                    <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Star className="w-5 h-5 text-amber-500" /> Novo Review
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">Wizard otimizado para reviews de afiliado</p>
                </div>
                <div className="flex items-center gap-3">
                    <button onClick={openAiModal} className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white px-5 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-violet-600/30">
                        <Wand2 className="w-4 h-4" /> Escrever com IA
                    </button>
                    <button onClick={() => setPreview(!preview)} className="text-sm font-bold text-slate-600 hover:text-indigo-600 px-4 py-2 rounded-xl">
                        {preview ? 'Voltar ao editor' : 'Ver markdown'}
                    </button>
                    <button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/25">
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Publicar Review
                    </button>
                </div>
            </div>

            {error && <div className="p-4 bg-red-100 text-red-700 rounded-xl font-bold"><AlertCircle className="w-4 h-4 inline mr-2" />{error}</div>}

            {preview ? (
                <pre className="bg-slate-900 text-slate-100 p-6 rounded-2xl text-xs font-mono whitespace-pre-wrap overflow-x-auto">{buildMarkdown(data)}</pre>
            ) : (
                <>
                    {/* INFO BÁSICA */}
                    <SectionCard title="Informações Básicas" icon={<Sparkles className="w-5 h-5 text-amber-500" />} defaultOpen={true}>
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>Título do Review</label>
                                <input className={inputClass} placeholder="Os 5 Melhores Fones Bluetooth de 2025" value={data.title} onChange={e => set('title', e.target.value)} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Slug (URL)</label>
                                    <input className={inputClass} value={data.slug} onChange={e => set('slug', slugify(e.target.value))} />
                                </div>
                                <div>
                                    <label className={labelClass}>Categoria</label>
                                    {categories.length > 0 ? (
                                        <select className={inputClass} value={data.category} onChange={e => set('category', e.target.value)}>
                                            <option value="">Selecionar...</option>
                                            {categories.map(cat => {
                                                const slug = typeof cat === 'string' ? cat : cat.slug || cat.name;
                                                const label = typeof cat === 'string' ? cat : cat.name || cat.slug;
                                                return <option key={slug} value={slug}>{label}</option>;
                                            })}
                                        </select>
                                    ) : (
                                        <input className={inputClass} value={data.category} onChange={e => set('category', e.target.value)} placeholder="reviews" />
                                    )}
                                </div>
                            </div>
                            <div>
                                <label className={labelClass}>Descrição Curta (resumo do review, 150-160 chars)</label>
                                <textarea className={inputClass} rows={2} value={data.description} onChange={e => set('description', e.target.value)} maxLength={200} />
                                <p className="text-[10px] text-slate-400 mt-1">{data.description.length}/160</p>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className={labelClass}>Badge do Post</label>
                                    <select className={inputClass} value={data.badge} onChange={e => set('badge', e.target.value)}>
                                        {BADGES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelClass}>Faixa de Preço</label>
                                    <input className={inputClass} placeholder="R$ 200 - R$ 2.000" value={data.priceRange} onChange={e => set('priceRange', e.target.value)} />
                                </div>
                                <div>
                                    <label className={labelClass}>Nota Geral (0-10)</label>
                                    <input type="number" min={0} max={10} step={0.1} className={inputClass} value={data.rating || ''} onChange={e => set('rating', parseFloat(e.target.value) || 0)} />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelClass}>Imagem de Capa (URL)</label>
                                    <input className={inputClass} placeholder="/images/posts/meu-review.jpg" value={data.image} onChange={e => set('image', e.target.value)} />
                                </div>
                                <div>
                                    <label className={labelClass}>Alt da Imagem</label>
                                    <input className={inputClass} value={data.imageAlt} onChange={e => set('imageAlt', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    </SectionCard>

                    {/* INTRO */}
                    <SectionCard title="Introdução" icon={<FileText className="w-5 h-5 text-blue-500" />}>
                        <div>
                            <label className={labelClass}>Texto de Abertura (1-2 parágrafos)</label>
                            <textarea className={inputClass} rows={6} placeholder="Escolher um produto pode ser uma tarefa difícil... Neste review, testamos os melhores X do mercado para te ajudar a decidir." value={data.intro} onChange={e => set('intro', e.target.value)} />
                            <p className="text-[10px] text-slate-400 mt-1">Use linha em branco entre parágrafos.</p>
                        </div>
                    </SectionCard>

                    {/* PRODUTOS */}
                    <SectionCard title="Produtos" icon={<Package className="w-5 h-5 text-emerald-500" />} defaultOpen={true} badge={`${validProducts} ${validProducts === 1 ? 'produto' : 'produtos'}`}>
                        <div className="space-y-4">
                            {data.products.map((p, i) => (
                                <div key={i} className="border-2 border-slate-200 rounded-xl p-4 space-y-3 bg-slate-50/50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-slate-700">Produto #{i + 1}</span>
                                            {p.featured && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-bold flex items-center gap-1"><Award className="w-3 h-3" /> DESTAQUE</span>}
                                        </div>
                                        <button onClick={() => removeProduct(i)} className="text-red-500 hover:bg-red-50 rounded-lg px-2 py-1"><Trash2 className="w-4 h-4" /></button>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className={labelClass}>Nome do Produto</label>
                                            <input className={inputClass} placeholder="Sony WH-1000XM5" value={p.name} onChange={e => setProduct(i, 'name', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Loja</label>
                                            <select className={inputClass} value={p.store} onChange={e => setProduct(i, 'store', e.target.value)}>
                                                {STORES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelClass}>Link de Afiliado <ExternalLink className="w-3 h-3 inline" /></label>
                                        <div className="flex gap-2">
                                            <input className={inputClass} placeholder="https://www.amazon.com.br/..." value={p.affiliateLink} onChange={e => setProduct(i, 'affiliateLink', e.target.value)} />
                                            <button
                                                onClick={() => importFromUrl(i)}
                                                disabled={importingIdx === i}
                                                className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-4 rounded-xl font-bold flex items-center gap-2 shadow-sm whitespace-nowrap"
                                                title="Importa nome, preço, imagem e nota da página do produto"
                                            >
                                                {importingIdx === i ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                                                Importar
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-slate-400 mt-1">Suporta Amazon, Mercado Livre e Shopee. Preenche nome, preço, imagem e nota automaticamente.</p>
                                    </div>

                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className={labelClass}>Preço</label>
                                            <input className={inputClass} placeholder="R$ 1.999" value={p.price} onChange={e => setProduct(i, 'price', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Preço Original (riscado)</label>
                                            <input className={inputClass} placeholder="R$ 2.499" value={p.originalPrice} onChange={e => setProduct(i, 'originalPrice', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Nota (0-5)</label>
                                            <input type="number" min={0} max={5} step={0.1} className={inputClass} value={p.rating} onChange={e => setProduct(i, 'rating', parseFloat(e.target.value) || 0)} />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className={labelClass}>Imagem do Produto</label>
                                            <input className={inputClass} placeholder="/images/products/produto.jpg" value={p.image} onChange={e => setProduct(i, 'image', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className={labelClass}>Badge (opcional)</label>
                                            <input className={inputClass} placeholder="Top 1 / Mais Vendido" value={p.badge} onChange={e => setProduct(i, 'badge', e.target.value)} />
                                        </div>
                                    </div>

                                    <div>
                                        <label className={labelClass}>Review Individual (~150-200 palavras)</label>
                                        <textarea className={inputClass} rows={5} placeholder="Descreva o produto, experiência de uso, pontos fortes e para quem é indicado." value={p.review} onChange={e => setProduct(i, 'review', e.target.value)} />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className={labelClass + ' mb-0'}>✅ Prós</label>
                                                <button onClick={() => setProductArr(i, 'pros', [...p.pros, ''])} className="text-xs text-indigo-600 font-bold flex items-center gap-1"><Plus className="w-3 h-3" /></button>
                                            </div>
                                            <div className="space-y-1.5">
                                                {p.pros.map((pro, pi) => (
                                                    <div key={pi} className="flex gap-1">
                                                        <input className={inputClass} value={pro} onChange={e => {
                                                            const arr = [...p.pros]; arr[pi] = e.target.value; setProductArr(i, 'pros', arr);
                                                        }} />
                                                        <button onClick={() => setProductArr(i, 'pros', p.pros.filter((_, x) => x !== pi))} className="text-red-500 px-2"><Trash2 className="w-3 h-3" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex items-center justify-between mb-1.5">
                                                <label className={labelClass + ' mb-0'}>❌ Contras</label>
                                                <button onClick={() => setProductArr(i, 'cons', [...p.cons, ''])} className="text-xs text-indigo-600 font-bold flex items-center gap-1"><Plus className="w-3 h-3" /></button>
                                            </div>
                                            <div className="space-y-1.5">
                                                {p.cons.map((con, ci) => (
                                                    <div key={ci} className="flex gap-1">
                                                        <input className={inputClass} value={con} onChange={e => {
                                                            const arr = [...p.cons]; arr[ci] = e.target.value; setProductArr(i, 'cons', arr);
                                                        }} />
                                                        <button onClick={() => setProductArr(i, 'cons', p.cons.filter((_, x) => x !== ci))} className="text-red-500 px-2"><Trash2 className="w-3 h-3" /></button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                                        <input type="checkbox" checked={p.featured} onChange={e => setProduct(i, 'featured', e.target.checked)} className="w-4 h-4 rounded" />
                                        <span className="font-semibold">Marcar como destaque</span>
                                        <span className="text-xs text-slate-400">(aparece no topo e na sidebar)</span>
                                    </label>
                                </div>
                            ))}
                            <button onClick={addProduct} className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 rounded-xl p-4 text-sm font-bold text-slate-600 hover:text-indigo-700 flex items-center justify-center gap-2 transition-all">
                                <Plus className="w-4 h-4" /> Adicionar Produto
                            </button>
                        </div>
                    </SectionCard>

                    {/* CONCLUSÃO */}
                    <SectionCard title="Conclusão / Veredito" icon={<Award className="w-5 h-5 text-purple-500" />}>
                        <div>
                            <label className={labelClass}>Texto da Conclusão</label>
                            <textarea className={inputClass} rows={5} placeholder="Em geral, o {Produto X} é a melhor escolha para a maioria das pessoas. Se você busca economia, o {Produto Y}..." value={data.conclusion} onChange={e => set('conclusion', e.target.value)} />
                        </div>
                    </SectionCard>

                    {/* FAQ */}
                    <SectionCard title="FAQ" icon={<MessageSquare className="w-5 h-5 text-rose-500" />} badge={`${validFaqs} ${validFaqs === 1 ? 'pergunta' : 'perguntas'}`}>
                        <div className="space-y-3">
                            {data.faqs.map((f, i) => (
                                <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-500">Pergunta #{i + 1}</span>
                                        <button onClick={() => removeFaq(i)} className="text-red-500 hover:bg-red-50 rounded p-1"><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                    <input className={inputClass} placeholder="Pergunta" value={f.q} onChange={e => setFaq(i, 'q', e.target.value)} />
                                    <textarea className={inputClass} rows={3} placeholder="Resposta" value={f.a} onChange={e => setFaq(i, 'a', e.target.value)} />
                                </div>
                            ))}
                            <button onClick={addFaq} className="w-full border-2 border-dashed border-slate-300 hover:border-indigo-400 rounded-xl p-3 text-sm font-bold text-slate-600 hover:text-indigo-700 flex items-center justify-center gap-2">
                                <Plus className="w-4 h-4" /> Adicionar Pergunta
                            </button>
                        </div>
                    </SectionCard>

                    {/* PUBLISH */}
                    <SectionCard title="Publicação" icon={<Search className="w-5 h-5 text-slate-500" />}>
                        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                            <input type="checkbox" checked={data.draft} onChange={e => set('draft', e.target.checked)} className="w-4 h-4 rounded" />
                            <span className="font-semibold">Salvar como rascunho (não aparece no site)</span>
                        </label>
                    </SectionCard>
                </>
            )}

            {aiModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !aiLoading && setAiModalOpen(false)}>
                    <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="sticky top-0 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white p-6 rounded-t-3xl flex items-center justify-between z-10">
                            <div className="flex items-center gap-3">
                                <Wand2 className="w-6 h-6" />
                                <div>
                                    <h3 className="text-lg font-bold">Escrever Review com IA</h3>
                                    <p className="text-xs text-white/80">Cole os links dos produtos — a IA cuida do resto</p>
                                </div>
                            </div>
                            <button onClick={() => !aiLoading && setAiModalOpen(false)} className="hover:bg-white/20 rounded-lg p-2"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="p-6 space-y-4">
                            {aiError && <div className="p-3 bg-red-100 text-red-700 rounded-xl text-sm font-bold flex gap-2 whitespace-pre-wrap"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{aiError}</div>}

                            <div>
                                <label className={labelClass}>URLs dos Produtos (uma por linha)</label>
                                <textarea
                                    className={`${inputClass} font-mono text-xs`}
                                    rows={8}
                                    placeholder={`https://www.amazon.com.br/produto-1/dp/B0XXXXXXX/\nhttps://www.amazon.com.br/produto-2/dp/B0YYYYYYY/\nhttps://produto.mercadolivre.com.br/MLB-XXXXX...`}
                                    value={aiUrls}
                                    onChange={e => setAiUrls(e.target.value)}
                                    disabled={aiLoading}
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Suporta Amazon, Mercado Livre e Shopee. Cole quantos links quiser.</p>
                            </div>

                            <div>
                                <label className={labelClass}>Foco/Ângulo Editorial (opcional)</label>
                                <input
                                    className={inputClass}
                                    placeholder="ex: melhor custo-benefício, foco em uso doméstico, gamers, profissional..."
                                    value={aiAngle}
                                    onChange={e => setAiAngle(e.target.value)}
                                    disabled={aiLoading}
                                />
                                <p className="text-[10px] text-slate-400 mt-1">Direciona o tom do review. Deixe vazio se não tiver preferência.</p>
                            </div>

                            <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 text-xs text-violet-800">
                                <strong>O que a IA vai fazer:</strong>
                                <ol className="list-decimal list-inside mt-1.5 space-y-0.5">
                                    <li>Buscar nome, preço, imagem e nota de cada URL</li>
                                    <li>Gerar título, descrição, intro, review individual de cada produto, prós/contras, conclusão e FAQs</li>
                                    <li>Preencher tudo no editor — só revisar e publicar</li>
                                </ol>
                            </div>

                            {aiProgress && (
                                <div className="bg-slate-100 rounded-xl p-3">
                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-700 mb-2">
                                        <Loader2 className="w-4 h-4 animate-spin text-violet-600" />
                                        {aiProgress.stage === 'scraping'
                                            ? `Importando produto ${aiProgress.current} de ${aiProgress.total}...`
                                            : 'Escrevendo review com IA... (pode levar 20-60s)'}
                                    </div>
                                    {aiProgress.stage === 'scraping' && (
                                        <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                            <div className="bg-violet-600 h-full transition-all" style={{ width: `${(aiProgress.current / aiProgress.total) * 100}%` }} />
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setAiModalOpen(false)} disabled={aiLoading} className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-3 rounded-xl font-bold disabled:opacity-50">Cancelar</button>
                                <button onClick={generateWithAI} disabled={aiLoading} className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-60 text-white px-5 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg">
                                    {aiLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Trabalhando...</> : <><Wand2 className="w-4 h-4" /> Gerar Review Completo</>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
