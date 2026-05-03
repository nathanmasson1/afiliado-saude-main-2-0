import React, { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, Plus, Trash2, Zap, Star, BarChart3, Users, ChevronDown, ChevronUp } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

type Stat = { number: string; suffix?: string; label: string; detail?: string };
type HeroStat = { number: string; label: string };
type CTA = { text: string; href: string };
type Feature = { number: string; title: string; description: string };

type HomeConfig = {
    hero: {
        badge: string;
        title: string;
        subtitle: string;
        ctaPrimary: CTA;
        ctaSecondary: CTA;
        image: string;
        stats: HeroStat[];
    };
    socialProof: {
        stats: Stat[];
        brands: string[];
    };
    postsGrid: {
        label: string;
        title: string;
        subtitle: string;
        limit: number;
        ctaText: string;
        ctaHref: string;
    };
    about: {
        label: string;
        title: string;
        titleAccent: string;
        text1: string;
        text2: string;
        ctaPrimary: CTA;
        ctaSecondary: CTA;
        features: Feature[];
    };
};

const inputClass = "w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none text-sm";
const labelClass = "block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5";

function SectionCard({ title, icon, children, defaultOpen = false }: { title: string; icon: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean }) {
    const [open, setOpen] = useState(defaultOpen);
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors">
                <div className="flex items-center gap-3">
                    {icon}
                    <h3 className="text-base font-bold text-slate-800">{title}</h3>
                </div>
                {open ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
            </button>
            {open && <div className="px-6 pb-6 border-t border-slate-100 pt-4">{children}</div>}
        </div>
    );
}

export default function HomeEditor() {
    const [config, setConfig] = useState<HomeConfig | null>(null);
    const [fileSha, setFileSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        githubApi('read', 'src/data/home.json')
            .then(data => { setConfig(JSON.parse(data?.content || '{}')); setFileSha(data.sha); })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const save = async () => {
        if (!config) return;
        setSaving(true); setError('');
        triggerToast('Salvando configurações da home...', 'progress', 20);
        try {
            const data = await githubApi('write', 'src/data/home.json', {
                content: JSON.stringify(config, null, 2), sha: fileSha || undefined, message: 'CMS: Update home.json'
            });
            setFileSha(data.sha);
            triggerToast('Home atualizada com sucesso!', 'success', 100);
        } catch (err: any) { setError(err.message); triggerToast(`Erro: ${err.message}`, 'error'); }
        finally { setSaving(false); }
    };

    const set = (path: string, value: any) => {
        setConfig(prev => {
            if (!prev) return prev;
            const clone = JSON.parse(JSON.stringify(prev));
            const keys = path.split('.');
            let obj: any = clone;
            for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
            obj[keys[keys.length - 1]] = value;
            return clone;
        });
    };

    if (loading) return <div className="flex items-center justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
    if (!config) return <div className="p-8 text-red-600">Erro ao carregar home.json</div>;

    return (
        <div className="space-y-6 pb-32">
            {/* Header */}
            <div className="flex items-center justify-between bg-white/80 backdrop-blur-xl p-5 px-8 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 sticky top-0 z-40">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Editor da Home</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Edite todas as seções da página inicial</p>
                </div>
                <button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/25">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                </button>
            </div>

            {error && <div className="p-4 bg-red-100 text-red-700 rounded-xl font-bold"><AlertCircle className="w-4 h-4 inline mr-2" />{error}</div>}

            {/* HERO */}
            <SectionCard title="Hero Section" icon={<Zap className="w-5 h-5 text-amber-500" />} defaultOpen={true}>
                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>Badge (etiqueta)</label>
                        <input className={inputClass} value={config.hero.badge} onChange={e => set('hero.badge', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>Título Principal</label>
                        <input className={inputClass} value={config.hero.title} onChange={e => set('hero.title', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>Subtítulo</label>
                        <textarea className={inputClass} rows={2} value={config.hero.subtitle} onChange={e => set('hero.subtitle', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>Imagem do Hero</label>
                        <input className={inputClass} value={config.hero.image} onChange={e => set('hero.image', e.target.value)} placeholder="/images/hero.jpg" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Botão Primário - Texto</label>
                            <input className={inputClass} value={config.hero.ctaPrimary.text} onChange={e => set('hero.ctaPrimary.text', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Botão Primário - Link</label>
                            <input className={inputClass} value={config.hero.ctaPrimary.href} onChange={e => set('hero.ctaPrimary.href', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Botão Secundário - Texto</label>
                            <input className={inputClass} value={config.hero.ctaSecondary.text} onChange={e => set('hero.ctaSecondary.text', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Botão Secundário - Link</label>
                            <input className={inputClass} value={config.hero.ctaSecondary.href} onChange={e => set('hero.ctaSecondary.href', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Estatísticas do Hero</label>
                        {config.hero.stats.map((stat, i) => (
                            <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2 mb-2">
                                <input className={inputClass} value={stat.number} onChange={e => { const s = [...config.hero.stats]; s[i] = { ...s[i], number: e.target.value }; set('hero.stats', s); }} placeholder="500+" />
                                <input className={inputClass} value={stat.label} onChange={e => { const s = [...config.hero.stats]; s[i] = { ...s[i], label: e.target.value }; set('hero.stats', s); }} placeholder="Produtos Avaliados" />
                                <button onClick={() => { const s = config.hero.stats.filter((_, j) => j !== i); set('hero.stats', s); }} className="p-2 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        ))}
                        <button onClick={() => set('hero.stats', [...config.hero.stats, { number: '', label: '' }])} className="text-xs text-indigo-600 font-bold flex items-center gap-1 mt-1"><Plus className="w-3 h-3" /> Adicionar</button>
                    </div>
                </div>
            </SectionCard>

            {/* SOCIAL PROOF */}
            <SectionCard title="Social Proof" icon={<Star className="w-5 h-5 text-yellow-500" />}>
                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>Estatísticas</label>
                        {config.socialProof.stats.map((stat, i) => (
                            <div key={i} className="grid grid-cols-[1fr_0.5fr_1fr_1fr_auto] gap-2 mb-2">
                                <input className={inputClass} value={stat.number} onChange={e => { const s = [...config.socialProof.stats]; s[i] = { ...s[i], number: e.target.value }; set('socialProof.stats', s); }} placeholder="4.9" />
                                <input className={inputClass} value={stat.suffix || ''} onChange={e => { const s = [...config.socialProof.stats]; s[i] = { ...s[i], suffix: e.target.value }; set('socialProof.stats', s); }} placeholder="/5" />
                                <input className={inputClass} value={stat.label} onChange={e => { const s = [...config.socialProof.stats]; s[i] = { ...s[i], label: e.target.value }; set('socialProof.stats', s); }} placeholder="Avaliação Média" />
                                <input className={inputClass} value={stat.detail || ''} onChange={e => { const s = [...config.socialProof.stats]; s[i] = { ...s[i], detail: e.target.value }; set('socialProof.stats', s); }} placeholder="+200 reviews" />
                                <button onClick={() => { const s = config.socialProof.stats.filter((_, j) => j !== i); set('socialProof.stats', s); }} className="p-2 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        ))}
                        <button onClick={() => set('socialProof.stats', [...config.socialProof.stats, { number: '', suffix: '', label: '', detail: '' }])} className="text-xs text-indigo-600 font-bold flex items-center gap-1 mt-1"><Plus className="w-3 h-3" /> Adicionar Estatística</button>
                    </div>
                    <div>
                        <label className={labelClass}>Marcas / Plataformas</label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {config.socialProof.brands.map((brand, i) => (
                                <div key={i} className="flex items-center gap-1 bg-slate-100 rounded-lg px-3 py-1.5">
                                    <input className="bg-transparent outline-none text-sm font-bold text-slate-700 w-28" value={brand} onChange={e => { const b = [...config.socialProof.brands]; b[i] = e.target.value; set('socialProof.brands', b); }} />
                                    <button onClick={() => set('socialProof.brands', config.socialProof.brands.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600"><Trash2 className="w-3 h-3" /></button>
                                </div>
                            ))}
                        </div>
                        <button onClick={() => set('socialProof.brands', [...config.socialProof.brands, ''])} className="text-xs text-indigo-600 font-bold flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar Marca</button>
                    </div>
                </div>
            </SectionCard>

            {/* POSTS GRID */}
            <SectionCard title="Grid de Posts" icon={<BarChart3 className="w-5 h-5 text-blue-500" />}>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Label</label>
                            <input className={inputClass} value={config.postsGrid.label} onChange={e => set('postsGrid.label', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Título</label>
                            <input className={inputClass} value={config.postsGrid.title} onChange={e => set('postsGrid.title', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Subtítulo</label>
                        <textarea className={inputClass} rows={2} value={config.postsGrid.subtitle} onChange={e => set('postsGrid.subtitle', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className={labelClass}>Limite de Posts</label>
                            <input type="number" className={inputClass} value={config.postsGrid.limit} onChange={e => set('postsGrid.limit', parseInt(e.target.value) || 6)} min={1} max={12} />
                        </div>
                        <div>
                            <label className={labelClass}>Texto do Botão</label>
                            <input className={inputClass} value={config.postsGrid.ctaText} onChange={e => set('postsGrid.ctaText', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Link do Botão</label>
                            <input className={inputClass} value={config.postsGrid.ctaHref} onChange={e => set('postsGrid.ctaHref', e.target.value)} />
                        </div>
                    </div>
                </div>
            </SectionCard>

            {/* ABOUT */}
            <SectionCard title="Seção Sobre" icon={<Users className="w-5 h-5 text-green-500" />}>
                <div className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className={labelClass}>Label</label>
                            <input className={inputClass} value={config.about.label} onChange={e => set('about.label', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Título</label>
                            <input className={inputClass} value={config.about.title} onChange={e => set('about.title', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Título Destaque (itálico)</label>
                            <input className={inputClass} value={config.about.titleAccent} onChange={e => set('about.titleAccent', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Parágrafo 1</label>
                        <textarea className={inputClass} rows={3} value={config.about.text1} onChange={e => set('about.text1', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>Parágrafo 2</label>
                        <textarea className={inputClass} rows={3} value={config.about.text2} onChange={e => set('about.text2', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Botão Primário</label>
                            <div className="grid grid-cols-2 gap-2">
                                <input className={inputClass} value={config.about.ctaPrimary.text} onChange={e => set('about.ctaPrimary.text', e.target.value)} placeholder="Texto" />
                                <input className={inputClass} value={config.about.ctaPrimary.href} onChange={e => set('about.ctaPrimary.href', e.target.value)} placeholder="Link" />
                            </div>
                        </div>
                        <div>
                            <label className={labelClass}>Botão Secundário</label>
                            <div className="grid grid-cols-2 gap-2">
                                <input className={inputClass} value={config.about.ctaSecondary.text} onChange={e => set('about.ctaSecondary.text', e.target.value)} placeholder="Texto" />
                                <input className={inputClass} value={config.about.ctaSecondary.href} onChange={e => set('about.ctaSecondary.href', e.target.value)} placeholder="Link" />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Features / Diferenciais</label>
                        {config.about.features.map((feat, i) => (
                            <div key={i} className="grid grid-cols-[0.3fr_1fr_2fr_auto] gap-2 mb-2">
                                <input className={inputClass} value={feat.number} onChange={e => { const f = [...config.about.features]; f[i] = { ...f[i], number: e.target.value }; set('about.features', f); }} placeholder="01" />
                                <input className={inputClass} value={feat.title} onChange={e => { const f = [...config.about.features]; f[i] = { ...f[i], title: e.target.value }; set('about.features', f); }} placeholder="Título" />
                                <input className={inputClass} value={feat.description} onChange={e => { const f = [...config.about.features]; f[i] = { ...f[i], description: e.target.value }; set('about.features', f); }} placeholder="Descrição" />
                                <button onClick={() => set('about.features', config.about.features.filter((_, j) => j !== i))} className="p-2 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        ))}
                        <button onClick={() => set('about.features', [...config.about.features, { number: `0${config.about.features.length + 1}`, title: '', description: '' }])} className="text-xs text-indigo-600 font-bold flex items-center gap-1 mt-1"><Plus className="w-3 h-3" /> Adicionar Feature</button>
                    </div>
                </div>
            </SectionCard>
        </div>
    );
}
