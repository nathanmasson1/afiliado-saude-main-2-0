import React, { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, Plus, Trash2, Sparkles, Phone, FileText, HelpCircle, Search, ChevronDown, ChevronUp } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

type Method = { icon: string; title: string; detail: string; description: string };
type Subject = { value: string; label: string };
type Faq = { q: string; a: string };

type ContatoConfig = {
    seo: { title: string; description: string; image: string };
    hero: { label: string; title: string; titleAccent: string; subtitle: string };
    methods: Method[];
    form: {
        title: string; subtitle: string;
        nameLabel: string; namePlaceholder: string;
        emailLabel: string; emailPlaceholder: string;
        subjectLabel: string; subjectPlaceholder: string;
        subjects: Subject[];
        messageLabel: string; messagePlaceholder: string;
        submitText: string; successText: string;
    };
    faq: { title: string; items: Faq[] };
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

export default function ContatoEditor() {
    const [config, setConfig] = useState<ContatoConfig | null>(null);
    const [fileSha, setFileSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        githubApi('read', 'src/data/contato.json')
            .then(data => { setConfig(JSON.parse(data?.content || '{}')); setFileSha(data.sha); })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const save = async () => {
        if (!config) return;
        setSaving(true); setError('');
        triggerToast('Salvando página Contato...', 'progress', 20);
        try {
            const data = await githubApi('write', 'src/data/contato.json', {
                content: JSON.stringify(config, null, 2), sha: fileSha || undefined, message: 'CMS: Update contato.json'
            });
            setFileSha(data.sha);
            triggerToast('Página Contato atualizada!', 'success', 100);
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
    if (!config) return <div className="p-8 text-red-600">Erro ao carregar contato.json</div>;

    return (
        <div className="space-y-6 pb-32">
            {/* Header */}
            <div className="flex items-center justify-between bg-white/80 backdrop-blur-xl p-5 px-8 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 sticky top-0 z-40">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Editor da Página Contato</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Edite todas as seções da página /contato</p>
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
                        <label className={labelClass}>Etiqueta</label>
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

            {/* METHODS */}
            <SectionCard title="Cards de Contato" icon={<Phone className="w-5 h-5 text-blue-500" />}>
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <p className="text-xs text-slate-500">Cards exibidos abaixo do hero (3 colunas no desktop).</p>
                        <button onClick={() => addItem('methods', { icon: '', title: '', detail: '', description: '' })} className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold">
                            <Plus className="w-3 h-3" /> Adicionar
                        </button>
                    </div>
                    {(config.methods || []).map((m, i) => (
                        <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-500">Card #{i + 1}</span>
                                <button onClick={() => removeItem('methods', i)} className="text-red-500 hover:bg-red-50 rounded p-1"><Trash2 className="w-3 h-3" /></button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input className={inputClass} placeholder="Título (E-mail)" value={m.title} onChange={e => {
                                    const arr = [...config.methods]; arr[i] = { ...arr[i], title: e.target.value }; set('methods', arr);
                                }} />
                                <input className={inputClass} placeholder="Detalhe (contato@..)" value={m.detail} onChange={e => {
                                    const arr = [...config.methods]; arr[i] = { ...arr[i], detail: e.target.value }; set('methods', arr);
                                }} />
                            </div>
                            <input className={inputClass} placeholder="Descrição" value={m.description} onChange={e => {
                                const arr = [...config.methods]; arr[i] = { ...arr[i], description: e.target.value }; set('methods', arr);
                            }} />
                            <div>
                                <label className={labelClass}>Ícone (SVG inline)</label>
                                <textarea className={`${inputClass} font-mono text-xs`} rows={3} placeholder='<svg ...>...</svg>' value={m.icon} onChange={e => {
                                    const arr = [...config.methods]; arr[i] = { ...arr[i], icon: e.target.value }; set('methods', arr);
                                }} />
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* FORM */}
            <SectionCard title="Formulário" icon={<FileText className="w-5 h-5 text-emerald-500" />}>
                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Título do Formulário</label>
                            <input className={inputClass} value={config.form.title || ''} onChange={e => set('form.title', e.target.value)} />
                        </div>
                        <div>
                            <label className={labelClass}>Texto do Botão</label>
                            <input className={inputClass} value={config.form.submitText || ''} onChange={e => set('form.submitText', e.target.value)} />
                        </div>
                    </div>
                    <div>
                        <label className={labelClass}>Subtítulo</label>
                        <textarea className={inputClass} rows={2} value={config.form.subtitle || ''} onChange={e => set('form.subtitle', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>Mensagem de Sucesso</label>
                        <input className={inputClass} value={config.form.successText || ''} onChange={e => set('form.successText', e.target.value)} />
                    </div>

                    <div className="border-t border-slate-100 pt-4 space-y-3">
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Labels e Placeholders</p>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelClass}>Label Nome</label>
                                <input className={inputClass} value={config.form.nameLabel || ''} onChange={e => set('form.nameLabel', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>Placeholder Nome</label>
                                <input className={inputClass} value={config.form.namePlaceholder || ''} onChange={e => set('form.namePlaceholder', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>Label E-mail</label>
                                <input className={inputClass} value={config.form.emailLabel || ''} onChange={e => set('form.emailLabel', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>Placeholder E-mail</label>
                                <input className={inputClass} value={config.form.emailPlaceholder || ''} onChange={e => set('form.emailPlaceholder', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>Label Assunto</label>
                                <input className={inputClass} value={config.form.subjectLabel || ''} onChange={e => set('form.subjectLabel', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>Placeholder Assunto</label>
                                <input className={inputClass} value={config.form.subjectPlaceholder || ''} onChange={e => set('form.subjectPlaceholder', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>Label Mensagem</label>
                                <input className={inputClass} value={config.form.messageLabel || ''} onChange={e => set('form.messageLabel', e.target.value)} />
                            </div>
                            <div>
                                <label className={labelClass}>Placeholder Mensagem</label>
                                <input className={inputClass} value={config.form.messagePlaceholder || ''} onChange={e => set('form.messagePlaceholder', e.target.value)} />
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                        <div className="flex items-center justify-between mb-2">
                            <label className={labelClass}>Opções de Assunto</label>
                            <button onClick={() => addItem('form.subjects', { value: '', label: '' })} className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold">
                                <Plus className="w-3 h-3" /> Adicionar
                            </button>
                        </div>
                        <div className="space-y-2">
                            {(config.form.subjects || []).map((s, i) => (
                                <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2 items-center">
                                    <input className={inputClass} placeholder="value" value={s.value} onChange={e => {
                                        const arr = [...config.form.subjects]; arr[i] = { ...arr[i], value: e.target.value }; set('form.subjects', arr);
                                    }} />
                                    <input className={inputClass} placeholder="Label" value={s.label} onChange={e => {
                                        const arr = [...config.form.subjects]; arr[i] = { ...arr[i], label: e.target.value }; set('form.subjects', arr);
                                    }} />
                                    <button onClick={() => removeItem('form.subjects', i)} className="text-red-500 hover:bg-red-50 rounded-lg px-2 py-3"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </SectionCard>

            {/* FAQ */}
            <SectionCard title="FAQ (Perguntas Frequentes)" icon={<HelpCircle className="w-5 h-5 text-purple-500" />}>
                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>Título da Seção</label>
                        <input className={inputClass} value={config.faq.title || ''} onChange={e => set('faq.title', e.target.value)} />
                    </div>
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className={labelClass}>Itens</label>
                            <button onClick={() => addItem('faq.items', { q: '', a: '' })} className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold">
                                <Plus className="w-3 h-3" /> Adicionar
                            </button>
                        </div>
                        <div className="space-y-3">
                            {(config.faq.items || []).map((f, i) => (
                                <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-500">Item #{i + 1}</span>
                                        <button onClick={() => removeItem('faq.items', i)} className="text-red-500 hover:bg-red-50 rounded p-1"><Trash2 className="w-3 h-3" /></button>
                                    </div>
                                    <input className={inputClass} placeholder="Pergunta" value={f.q} onChange={e => {
                                        const arr = [...config.faq.items]; arr[i] = { ...arr[i], q: e.target.value }; set('faq.items', arr);
                                    }} />
                                    <textarea className={inputClass} rows={3} placeholder="Resposta" value={f.a} onChange={e => {
                                        const arr = [...config.faq.items]; arr[i] = { ...arr[i], a: e.target.value }; set('faq.items', arr);
                                    }} />
                                </div>
                            ))}
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
                        <input className={inputClass} value={config.seo?.image || ''} onChange={e => set('seo.image', e.target.value)} placeholder="/images/og-contato.jpg" />
                    </div>
                </div>
            </SectionCard>
        </div>
    );
}
