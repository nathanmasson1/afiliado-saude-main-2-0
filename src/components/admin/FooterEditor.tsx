import React, { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, Plus, Trash2, Megaphone, Info, Share2, Columns, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

type Social = { label: string; href: string; icon: string };
type FooterLink = { href: string; label: string };
type Column = { heading: string; links: FooterLink[] };

type FooterConfig = {
    cta: { title: string; titleAccent: string; text: string };
    about: string;
    social: Social[];
    columns: Column[];
    copyright: string;
    disclaimer: string;
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

export default function FooterEditor() {
    const [config, setConfig] = useState<FooterConfig | null>(null);
    const [fileSha, setFileSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        githubApi('read', 'src/data/footer.json')
            .then(data => { setConfig(JSON.parse(data?.content || '{}')); setFileSha(data.sha); })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const save = async () => {
        if (!config) return;
        setSaving(true); setError('');
        triggerToast('Salvando rodapé...', 'progress', 20);
        try {
            const data = await githubApi('write', 'src/data/footer.json', {
                content: JSON.stringify(config, null, 2), sha: fileSha || undefined, message: 'CMS: Update footer.json'
            });
            setFileSha(data.sha);
            triggerToast('Rodapé atualizado!', 'success', 100);
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
    if (!config) return <div className="p-8 text-red-600">Erro ao carregar footer.json</div>;

    return (
        <div className="space-y-6 pb-32">
            <div className="flex items-center justify-between bg-white/80 backdrop-blur-xl p-5 px-8 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 sticky top-0 z-40">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Editor do Rodapé</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Edite todas as seções do footer do site</p>
                </div>
                <button onClick={save} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-600/25">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Salvar
                </button>
            </div>

            {error && <div className="p-4 bg-red-100 text-red-700 rounded-xl font-bold"><AlertCircle className="w-4 h-4 inline mr-2" />{error}</div>}

            {/* CTA */}
            <SectionCard title="CTA Superior do Footer" icon={<Megaphone className="w-5 h-5 text-rose-500" />} defaultOpen={true}>
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
                </div>
            </SectionCard>

            {/* About */}
            <SectionCard title="Sobre (coluna esquerda)" icon={<Info className="w-5 h-5 text-blue-500" />}>
                <div>
                    <label className={labelClass}>Texto sobre o site</label>
                    <textarea className={inputClass} rows={4} value={config.about || ''} onChange={e => set('about', e.target.value)} />
                    <p className="text-xs text-slate-400 mt-2">O nome e logo do site são editados em Configurações.</p>
                </div>
            </SectionCard>

            {/* Social */}
            <SectionCard title="Redes Sociais" icon={<Share2 className="w-5 h-5 text-pink-500" />}>
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <p className="text-xs text-slate-500">Ícones que aparecem abaixo do texto sobre.</p>
                        <button onClick={() => addItem('social', { label: '', href: '', icon: '' })} className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold">
                            <Plus className="w-3 h-3" /> Adicionar
                        </button>
                    </div>
                    {(config.social || []).map((s, i) => (
                        <div key={i} className="border border-slate-200 rounded-xl p-3 space-y-2">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-500">Item #{i + 1}</span>
                                <button onClick={() => removeItem('social', i)} className="text-red-500 hover:bg-red-50 rounded p-1"><Trash2 className="w-3 h-3" /></button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <input className={inputClass} placeholder="Nome (Instagram)" value={s.label} onChange={e => {
                                    const arr = [...config.social]; arr[i] = { ...arr[i], label: e.target.value }; set('social', arr);
                                }} />
                                <input className={inputClass} placeholder="URL" value={s.href} onChange={e => {
                                    const arr = [...config.social]; arr[i] = { ...arr[i], href: e.target.value }; set('social', arr);
                                }} />
                            </div>
                            <textarea className={`${inputClass} font-mono text-xs`} rows={3} placeholder="<svg ...>...</svg>" value={s.icon} onChange={e => {
                                const arr = [...config.social]; arr[i] = { ...arr[i], icon: e.target.value }; set('social', arr);
                            }} />
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* Columns */}
            <SectionCard title="Colunas de Links" icon={<Columns className="w-5 h-5 text-emerald-500" />}>
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <p className="text-xs text-slate-500">Cada coluna vira um bloco no rodapé.</p>
                        <button onClick={() => addItem('columns', { heading: '', links: [] })} className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold">
                            <Plus className="w-3 h-3" /> Nova Coluna
                        </button>
                    </div>
                    {(config.columns || []).map((col, ci) => (
                        <div key={ci} className="border border-slate-200 rounded-xl p-4 space-y-3">
                            <div className="flex justify-between items-center">
                                <input className={inputClass} placeholder="Título da coluna (ex: Navegação)" value={col.heading} onChange={e => {
                                    const arr = [...config.columns]; arr[ci] = { ...arr[ci], heading: e.target.value }; set('columns', arr);
                                }} />
                                <button onClick={() => removeItem('columns', ci)} className="text-red-500 hover:bg-red-50 rounded p-2 ml-2"><Trash2 className="w-4 h-4" /></button>
                            </div>
                            <div className="space-y-2 pl-4 border-l-2 border-slate-100">
                                {(col.links || []).map((link, li) => (
                                    <div key={li} className="grid grid-cols-[2fr_2fr_auto] gap-2">
                                        <input className={inputClass} placeholder="Label" value={link.label} onChange={e => {
                                            const arr = [...config.columns];
                                            arr[ci] = { ...arr[ci], links: [...arr[ci].links] };
                                            arr[ci].links[li] = { ...arr[ci].links[li], label: e.target.value };
                                            set('columns', arr);
                                        }} />
                                        <input className={inputClass} placeholder="/url" value={link.href} onChange={e => {
                                            const arr = [...config.columns];
                                            arr[ci] = { ...arr[ci], links: [...arr[ci].links] };
                                            arr[ci].links[li] = { ...arr[ci].links[li], href: e.target.value };
                                            set('columns', arr);
                                        }} />
                                        <button onClick={() => {
                                            const arr = [...config.columns];
                                            arr[ci] = { ...arr[ci], links: arr[ci].links.filter((_, x) => x !== li) };
                                            set('columns', arr);
                                        }} className="text-red-500 hover:bg-red-50 rounded-lg px-2"><Trash2 className="w-4 h-4" /></button>
                                    </div>
                                ))}
                                <button onClick={() => {
                                    const arr = [...config.columns];
                                    arr[ci] = { ...arr[ci], links: [...(arr[ci].links || []), { href: '', label: '' }] };
                                    set('columns', arr);
                                }} className="text-xs flex items-center gap-1 text-indigo-600 hover:text-indigo-700 font-bold mt-2">
                                    <Plus className="w-3 h-3" /> Adicionar Link
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </SectionCard>

            {/* Bottom */}
            <SectionCard title="Rodapé Inferior (Copyright + Disclaimer)" icon={<FileText className="w-5 h-5 text-slate-500" />}>
                <div className="space-y-4">
                    <div>
                        <label className={labelClass}>Copyright (use {'{year}'} para o ano atual)</label>
                        <input className={inputClass} value={config.copyright || ''} onChange={e => set('copyright', e.target.value)} />
                    </div>
                    <div>
                        <label className={labelClass}>Disclaimer / Aviso de Afiliado</label>
                        <textarea className={inputClass} rows={3} value={config.disclaimer || ''} onChange={e => set('disclaimer', e.target.value)} />
                    </div>
                </div>
            </SectionCard>
        </div>
    );
}
