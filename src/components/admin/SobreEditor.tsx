import React, { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, Plus, Trash2, Sparkles, BookOpen, Star, Clock, Megaphone, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

type CTA = { text: string; href: string };
type StoryStat = { number: string; label: string };
type ValueItem = { number: string; title: string; text: string };
type TimelineItem = { year: string; title: string; text: string };

type SobreConfig = {
    seo: { title: string; description: string; image: string };
    hero: { label: string; title: string; titleAccent: string; subtitle: string };
    story: {
        label: string; title: string; titleAccent: string;
        paragraphs: string[];
        stats: StoryStat[];
    };
    values: { label: string; title: string; subtitle: string; items: ValueItem[] };
    timeline: { label: string; title: string; items: TimelineItem[] };
    cta: { title: string; titleAccent: string; text: string; ctaPrimary: CTA; ctaSecondary: CTA };
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

export default function SobreEditor() {
    const [config, setConfig] = useState<SobreConfig | null>(null);
    const [fileSha, setFileSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        githubApi('read', 'src/data/sobre.json')
            .then(data => { setConfig(JSON.parse(data?.content || '{}')); setFileSha(data.sha); })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const save = async () => {
        if (!config) return;
        setSaving(true); setError('');
        triggerToast('Salvando página Sobre...', 'progress', 20);
        try {
            const data = await githubApi('write', 'src/data/sobre.json', {
                content: JSON.stringify(config, null, 2), sha: fileSha || undefined, message: 'CMS: Update sobre.json'
            });
            setFileSha(data.sha);
            triggerToast('Página Sobre atualizada!', 'success', 100);
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

    const addItem = (path: string, item: any) => {
        setConfig(prev => {
            if (!prev) return prev;
            const clone = JSON.parse(JSON.stringify(prev));
            const keys = path.split('.');
            let obj: any = clone;
            for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
            obj[keys[keys.length - 1]] = [...(obj[keys[keys.length - 1]] || []), item];
            return clone;
        });
    };

    const removeItem = (path: string, index: number) => {
        setConfig(prev => {
            if (!prev) return prev;
            const clone = JSON.parse(JSON.stringify(prev));
            const keys = path.split('.');
            let obj: any = clone;
            for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
            obj[keys[keys.length - 1]] = (obj[keys[keys.length - 1]] || []).filter((_: any, i: number) => i !== index);
            return clone;
        });
    };

    if (loading) return <div className="flex items-center justify-center p-20"><Loader2 className="w-8 h-8 animate-spin text-indigo-500" /></div>;
    if (!config) return <div className="p-8 text-red-600">Erro ao carregar sobre.json</div>;

    return (
        <div className="space-y-6 pb-32">
            {/* Header */}
            <div className="flex items-center justify-between bg-white/80 backdrop-blur-xl p-5 px-8 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 sticky top-0 z-40">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Editor da Página Sobre</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Edite todas as seções da página /sobre</p>
                </div>
                <button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/25">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                </button>
            </div>

            {error && <div className="p-4 bg-red-100 text-red-700 rounded-xl font-bold"><AlertCircle className="w-4 h-4 inline mr-2" />{error}</div>}

            {/* HERO */}
            <SectionCard title="Hero (Topo da Página)" icon={<Sparkles className="w-5 h-5 text-amber-500" />} defaultOpen={true}>
                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>Etiqueta (label)</label>
                        <input className={inputClass} value={config.hero.label || ''} onChange={e => set('hero.label', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Título</label>
                            <input className={inputClass} value={config.hero.title || ''} onChange={e => set('hero.title', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Título Acento (itálico)</label>
                            <input className={inputClass} value={config.hero.titleAccent || ''} onChange={e => set('hero.titleAccent', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Subtítulo</label>
                        <textarea className={inputClass} rows={3} value={config.hero.subtitle || ''} onChange={e => set('hero.subtitle', e.target.value)} />
                    </div>
                </div>
            </SectionCard>

            {/* STORY */}
            <SectionCard title="Nossa História" icon={<BookOpen className="w-5 h-5 text-blue-500" />}>
                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>Etiqueta</label>
                        <input className={inputClass} value={config.story.label || ''} onChange={e => set('story.label', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Título</label>
                            <input className={inputClass} value={config.story.title || ''} onChange={e => set('story.title', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Título Acento (itálico)</label>
                            <input className={inputClass} value={config.story.titleAccent || ''} onChange={e => set('story.titleAccent', e.target.value)} />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className={labelClass}>Parágrafos</label>
                            <button onClick={() => addItem('story.paragraphs', '')} className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold">
                                <Plus className="w-3 h-3" /> Adicionar
                            </button>
                        </div>
                        <div className="space-y-2">
                            {(config.story.paragraphs || []).map((p, i) => (
                                <div key={i} className="flex gap-2">
                                    <textarea className={inputClass} rows={3} value={p} onChange={e => {
                                        const arr = [...config.story.paragraphs]; arr[i] = e.target.value; set('story.paragraphs', arr);
                                    }} />
                                    <button onClick={() => removeItem('story.paragraphs', i)} className="text-red-500 hover:bg-red-50 rounded-lg px-2"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className={labelClass}>Stats (4 cards à direita)</label>
                            <button onClick={() => addItem('story.stats', { number: '', label: '' })} className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold">
                                <Plus className="w-3 h-3" /> Adicionar
                            </button>
                        </div>
                        <div className="space-y-2">
                            {(config.story.stats || []).map((s, i) => (
                                <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-center">
                                    <input className={inputClass} placeholder="Número" value={s.number} onChange={e => {
                                        const arr = [...config.story.stats]; arr[i] = { ...arr[i], number: e.target.value }; set('story.stats', arr);
                                    }} />
                                    <input className={inputClass} placeholder="Label" value={s.label} onChange={e => {
                                        const arr = [...config.story.stats]; arr[i] = { ...arr[i], label: e.target.value }; set('story.stats', arr);
                                    }} />
                                    <button onClick={() => removeItem('story.stats', i)} className="text-red-500 hover:bg-red-50 rounded-lg px-2 py-3"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </SectionCard>

            {/* VALUES */}
            <SectionCard title="Nossos Valores" icon={<Star className="w-5 h-5 text-purple-500" />}>
                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>Etiqueta</label>
                        <input className={inputClass} value={config.values.label || ''} onChange={e => set('values.label', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>Título</label>
                        <input className={inputClass} value={config.values.title || ''} onChange={e => set('values.title', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>Subtítulo</label>
                        <textarea className={inputClass} rows={2} value={config.values.subtitle || ''} onChange={e => set('values.subtitle', e.target.value)} />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className={labelClass}>Cards de Valores</label>
                            <button onClick={() => addItem('values.items', { number: '', title: '', text: '' })} className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold">
                                <Plus className="w-3 h-3" /> Adicionar
                            </button>
                        </div>
                        <div className="space-y-3">
                            {(config.values.items || []).map((v, i) => (
                                <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-500">Card #{i + 1}</span>
                                        <button onClick={() => removeItem('values.items', i)} className="text-red-500 hover:bg-red-50 rounded p-1"><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                    <div className="grid grid-cols-[80px_1fr] gap-2">
                                        <input className={inputClass} placeholder="01" value={v.number} onChange={e => {
                                            const arr = [...config.values.items]; arr[i] = { ...arr[i], number: e.target.value }; set('values.items', arr);
                                        }} />
                                        <input className={inputClass} placeholder="Título" value={v.title} onChange={e => {
                                            const arr = [...config.values.items]; arr[i] = { ...arr[i], title: e.target.value }; set('values.items', arr);
                                        }} />
                                    </div>
                                    <textarea className={inputClass} rows={2} placeholder="Descrição" value={v.text} onChange={e => {
                                        const arr = [...config.values.items]; arr[i] = { ...arr[i], text: e.target.value }; set('values.items', arr);
                                    }} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </SectionCard>

            {/* TIMELINE */}
            <SectionCard title="Linha do Tempo" icon={<Clock className="w-5 h-5 text-emerald-500" />}>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Etiqueta</label>
                            <input className={inputClass} value={config.timeline.label || ''} onChange={e => set('timeline.label', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Título</label>
                            <input className={inputClass} value={config.timeline.title || ''} onChange={e => set('timeline.title', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className={labelClass}>Itens da Linha do Tempo</label>
                            <button onClick={() => addItem('timeline.items', { year: '', title: '', text: '' })} className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold">
                                <Plus className="w-3 h-3" /> Adicionar
                            </button>
                        </div>
                        <div className="space-y-3">
                            {(config.timeline.items || []).map((t, i) => (
                                <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-500">Item #{i + 1}</span>
                                        <button onClick={() => removeItem('timeline.items', i)} className="text-red-500 hover:bg-red-50 rounded p-1"><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                    <div className="grid grid-cols-[100px_1fr] gap-2">
                                        <input className={inputClass} placeholder="2024" value={t.year} onChange={e => {
                                            const arr = [...config.timeline.items]; arr[i] = { ...arr[i], year: e.target.value }; set('timeline.items', arr);
                                        }} />
                                        <input className={inputClass} placeholder="Título" value={t.title} onChange={e => {
                                            const arr = [...config.timeline.items]; arr[i] = { ...arr[i], title: e.target.value }; set('timeline.items', arr);
                                        }} />
                                    </div>
                                    <textarea className={inputClass} rows={2} placeholder="Texto" value={t.text} onChange={e => {
                                        const arr = [...config.timeline.items]; arr[i] = { ...arr[i], text: e.target.value }; set('timeline.items', arr);
                                    }} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </SectionCard>

            {/* CTA */}
            <SectionCard title="CTA Final" icon={<Megaphone className="w-5 h-5 text-rose-500" />}>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Título</label>
                            <input className={inputClass} value={config.cta.title || ''} onChange={e => set('cta.title', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Título Acento (itálico)</label>
                            <input className={inputClass} value={config.cta.titleAccent || ''} onChange={e => set('cta.titleAccent', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Texto</label>
                        <textarea className={inputClass} rows={2} value={config.cta.text || ''} onChange={e => set('cta.text', e.target.value)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Botão Primário - Texto</label>
                            <input className={inputClass} value={config.cta.ctaPrimary?.text || ''} onChange={e => set('cta.ctaPrimary.text', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Botão Primário - Link</label>
                            <input className={inputClass} value={config.cta.ctaPrimary?.href || ''} onChange={e => set('cta.ctaPrimary.href', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Botão Secundário - Texto</label>
                            <input className={inputClass} value={config.cta.ctaSecondary?.text || ''} onChange={e => set('cta.ctaSecondary.text', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Botão Secundário - Link</label>
                            <input className={inputClass} value={config.cta.ctaSecondary?.href || ''} onChange={e => set('cta.ctaSecondary.href', e.target.value)} />
                        </div>
                    </div>
                </div>
            </SectionCard>

            {/* SEO */}
            <SectionCard title="SEO" icon={<Search className="w-5 h-5 text-slate-500" />}>
                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>Título SEO</label>
                        <input className={inputClass} value={config.seo?.title || ''} onChange={e => set('seo.title', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>Meta Descrição</label>
                        <textarea className={inputClass} rows={3} value={config.seo?.description || ''} onChange={e => set('seo.description', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>Imagem Open Graph (URL)</label>
                        <input className={inputClass} value={config.seo?.image || ''} onChange={e => set('seo.image', e.target.value)} placeholder="/images/og-sobre.jpg" />
                    </div>
                </div>
            </SectionCard>
        </div>
    );
}
