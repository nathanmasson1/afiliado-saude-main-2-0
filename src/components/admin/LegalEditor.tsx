import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, Loader2, Plus, Trash2, FileText, X, ChevronDown, ChevronUp } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

interface LegalSection { title: string; text: string; }
interface LegalData { title: string; lastUpdated: string; content: LegalSection[]; }

export default function LegalEditor() {
    const [activeTab, setActiveTab] = useState<'privacy' | 'terms'>('privacy');
    const [privacyData, setPrivacyData] = useState<LegalData | null>(null);
    const [termsData, setTermsData] = useState<LegalData | null>(null);
    const [privacySha, setPrivacySha] = useState('');
    const [termsSha, setTermsSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetch = async () => {
            try {
                const [privRes, termsRes] = await Promise.allSettled([
                    githubApi('read', 'src/data/privacy.json'),
                    githubApi('read', 'src/data/terms.json'),
                ]);
                if (privRes.status === 'fulfilled') { setPrivacyData(JSON.parse(privRes.value?.content || "{}")); setPrivacySha(privRes.value.sha); }
                if (termsRes.status === 'fulfilled') { setTermsData(JSON.parse(termsRes.value?.content || "{}")); setTermsSha(termsRes.value.sha); }
            } catch (err: any) {
                setError('Erro ao carregar dados. Verifique se os arquivos existem no repositório.');
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, []);

    const handleSave = async (type: 'privacy' | 'terms') => {
        setSaving(true);
        const data = type === 'privacy' ? privacyData : termsData;
        const sha = type === 'privacy' ? privacySha : termsSha;
        const path = type === 'privacy' ? 'src/data/privacy.json' : 'src/data/terms.json';
        if (!data) return;

        const updatedData = { ...data, lastUpdated: new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) };
        triggerToast(`Salvando ${type === 'privacy' ? 'Privacidade' : 'Termos'}...`, 'progress', 30);

        try {
            const res = await githubApi('write', path, { content: JSON.stringify(updatedData, null, 2), sha: sha || undefined, message: `CMS: Update ${path}` });
            if (type === 'privacy') { setPrivacySha(res.sha); setPrivacyData(updatedData); }
            else { setTermsSha(res.sha); setTermsData(updatedData); }
            triggerToast('Alterações salvas com sucesso!', 'success', 100);
        } catch (err: any) {
            triggerToast(err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const updateSection = (type: 'privacy' | 'terms', index: number, field: keyof LegalSection, value: string) => {
        const setData = type === 'privacy' ? setPrivacyData : setTermsData;
        const currentData = type === 'privacy' ? privacyData : termsData;
        if (!currentData) return;
        const newContent = [...currentData.content];
        newContent[index] = { ...newContent[index], [field]: value };
        setData({ ...currentData, content: newContent });
    };

    const addSection = (type: 'privacy' | 'terms') => {
        const setData = type === 'privacy' ? setPrivacyData : setTermsData;
        const currentData = type === 'privacy' ? privacyData : termsData;
        if (!currentData) return;
        setData({ ...currentData, content: [...currentData.content, { title: 'Nova Seção', text: 'Conteúdo aqui...' }] });
    };

    const removeSection = (type: 'privacy' | 'terms', index: number) => {
        if (!confirm('Excluir esta seção?')) return;
        const setData = type === 'privacy' ? setPrivacyData : setTermsData;
        const currentData = type === 'privacy' ? privacyData : termsData;
        if (!currentData) return;
        setData({ ...currentData, content: currentData.content.filter((_: any, i: number) => i !== index) });
    };

    const moveSection = (type: 'privacy' | 'terms', index: number, direction: 'up' | 'down') => {
        const setData = type === 'privacy' ? setPrivacyData : setTermsData;
        const currentData = type === 'privacy' ? privacyData : termsData;
        if (!currentData) return;
        const newContent = [...currentData.content];
        const newIndex = direction === 'up' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= newContent.length) return;
        [newContent[index], newContent[newIndex]] = [newContent[newIndex], newContent[index]];
        setData({ ...currentData, content: newContent });
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-32 text-slate-400 bg-white rounded-md border border-slate-200">
            <FileText className="w-10 h-10 animate-pulse mb-6 text-slate-300" />
            <p className="font-semibold text-sm animate-pulse text-slate-500">Buscando dados do repositório Git...</p>
        </div>
    );

    const currentData = activeTab === 'privacy' ? privacyData : termsData;

    return (
        <div className="space-y-6 pb-32">
            {/* Tabs */}
            <div className="flex items-center justify-between bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex p-1 bg-slate-100 rounded-xl w-fit border border-slate-200">
                    <button onClick={() => setActiveTab('privacy')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'privacy' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                        Política de Privacidade
                    </button>
                    <button onClick={() => setActiveTab('terms')} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'terms' ? 'bg-white text-slate-800 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-700'}`}>
                        Termos de Uso
                    </button>
                </div>
                <button onClick={() => handleSave(activeTab)} disabled={saving}
                    className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    {saving ? 'Salvando...' : 'Salvar'}
                </button>
            </div>

            {error && <div className="p-5 bg-red-100/50 text-red-700 rounded-2xl font-bold border border-red-200"><AlertCircle className="w-5 h-5 inline mr-2 -mt-1" /> {error}</div>}

            {currentData ? (
                <div className="space-y-4">
                    {currentData.content.map((section, idx) => (
                        <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm group">
                            <div className="flex items-center justify-between mb-4 border-b border-slate-50 pb-4">
                                <div className="flex items-center gap-2">
                                    <span className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 font-bold text-xs">#{idx + 1}</span>
                                    <input type="text" value={section.title} onChange={(e) => updateSection(activeTab, idx, 'title', e.target.value)}
                                        className="text-sm font-bold text-slate-800 bg-transparent border-none focus:ring-0 w-full md:w-96 focus:outline-none" placeholder="Título da Seção" />
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => moveSection(activeTab, idx, 'up')} disabled={idx === 0} className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors disabled:opacity-30"><ChevronUp className="w-4 h-4" /></button>
                                    <button onClick={() => moveSection(activeTab, idx, 'down')} disabled={idx === currentData.content.length - 1} className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded transition-colors disabled:opacity-30"><ChevronDown className="w-4 h-4" /></button>
                                    <button onClick={() => removeSection(activeTab, idx)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded ml-2 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>
                            <textarea value={section.text} onChange={(e) => updateSection(activeTab, idx, 'text', e.target.value)} rows={6}
                                className="w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-slate-800 text-base leading-relaxed focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500 transition-colors resize-none shadow-sm"
                                placeholder="Escreva o texto jurídico aqui..." />
                        </div>
                    ))}
                    <button onClick={() => addSection(activeTab)} className="w-full py-8 border-2 border-dashed border-slate-200 rounded-xl text-slate-500 hover:text-violet-600 hover:border-violet-600 hover:bg-violet-50 transition-all font-bold flex flex-col items-center justify-center gap-2 text-xs uppercase">
                        <Plus className="w-6 h-6" /> Adicionar Nova Seção
                    </button>
                </div>
            ) : (
                <div className="p-10 bg-red-50 border border-red-100 rounded-2xl text-red-700 flex items-center gap-4">
                    <AlertCircle className="w-8 h-8" />
                    <div>
                        <p className="font-bold text-lg">Arquivo não encontrado</p>
                        <p className="text-sm opacity-80">Não foi possível localizar o arquivo JSON no repositório.</p>
                    </div>
                </div>
            )}
        </div>
    );
}
