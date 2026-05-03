import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, Loader2, Plus, Trash2, UserPlus, Image as ImageIcon, Users, X, Edit2 } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

export default function AuthorsEditor() {
    const [authors, setAuthors] = useState<any[]>([]);
    const [fileSha, setFileSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [tempAuthor, setTempAuthor] = useState<any>(null);

    useEffect(() => {
        githubApi('read', 'src/data/authors.json')
            .then(data => {
                const parsed = JSON.parse(data?.content || "{}");
                setAuthors(Array.isArray(parsed) ? parsed : []);
                setFileSha(data.sha);
            })
            .catch(err => {
                if (err.message.includes('404')) setAuthors([]);
                else setError(err.message);
            })
            .finally(() => setLoading(false));
    }, []);

    const saveToGithub = async (list: any[]) => {
        setSaving(true); setError('');
        triggerToast('Sincronizando arquivo de autores...', 'progress', 20);
        try {
            const data = await githubApi('write', 'src/data/authors.json', {
                content: JSON.stringify(list, null, 2),
                sha: fileSha || undefined,
                message: 'CMS: Update authors.json'
            });
            setFileSha(data.sha);
            triggerToast('Equipe sincronizada com sucesso!', 'success', 100);
        } catch (err: any) {
            setError(err.message);
            triggerToast(`Erro: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onloadend = () => setTempAuthor({ ...tempAuthor, avatar: reader.result as string });
        reader.readAsDataURL(file);
    };

    const saveModalAuthor = async () => {
        if (!tempAuthor?.name?.trim()) { alert('O nome do autor é obrigatório!'); return; }
        const arr = [...authors];
        if (editingIndex === null) arr.unshift(tempAuthor);
        else arr[editingIndex] = tempAuthor;
        setAuthors(arr);
        setIsModalOpen(false);
        setTempAuthor(null);
        setEditingIndex(null);
        await saveToGithub(arr);
    };

    const removeAuthor = async (index: number) => {
        if (!confirm('Excluir este autor?')) return;
        const arr = [...authors];
        arr.splice(index, 1);
        setAuthors(arr);
        await saveToGithub(arr);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white rounded-3xl border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-amber-500" />
            <p className="font-medium animate-pulse">Lendo registros de autores...</p>
        </div>
    );

    return (
        <div className="space-y-8 pb-32">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl p-5 px-8 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 sticky top-0 z-40">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Sincronização de Equipe</h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full border-2 border-amber-500"></span>
                        {authors.length} Perfis Cadastrados
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {saving && <div className="flex items-center gap-2 text-amber-600 bg-slate-50 px-4 py-2 rounded-lg text-sm font-bold mr-2"><Loader2 className="w-4 h-4 animate-spin" /> Sincronizando...</div>}
                    <button onClick={() => { setTempAuthor({ id: `author-${Date.now()}`, name: '', role: '', avatar: '', bio: '' }); setEditingIndex(null); setIsModalOpen(true); }} disabled={saving}
                        className="w-full sm:w-auto bg-slate-500 hover:bg-amber-600 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25 hover:-translate-y-0.5 transition-all">
                        <UserPlus className="w-5 h-5" /> Adicionar Perfil
                    </button>
                </div>
            </div>

            {error && <div className="p-5 bg-red-100/50 text-red-700 rounded-2xl font-bold border border-red-200"><AlertCircle className="w-5 h-5 inline mr-2 -mt-1" /> {error}</div>}

            {authors.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-3xl p-16 flex flex-col items-center justify-center text-center w-full mt-6">
                    <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-slate-300 mb-4 shadow-sm"><Users className="w-10 h-10" /></div>
                    <h3 className="text-xl font-bold text-slate-700 mb-2">Sua equipe está vazia!</h3>
                    <p className="text-slate-500 max-w-sm mx-auto mb-6">Adicione membros da equipe para que eles possam assinar os artigos do blog.</p>
                    <button onClick={() => { setTempAuthor({ id: `author-${Date.now()}`, name: '', role: '', avatar: '', bio: '' }); setEditingIndex(null); setIsModalOpen(true); }}
                        className="bg-slate-500 text-white font-bold px-8 py-3 rounded-xl shadow-md hover:bg-amber-600 transition-colors inline-flex items-center gap-2">
                        <Plus className="w-5 h-5" /> Adicionar Primeiro Autor
                    </button>
                </div>
            ) : (
                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm mt-6">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="py-4 px-6 text-sm font-bold text-slate-500 uppercase tracking-wider w-24">Foto</th>
                                    <th className="py-4 px-6 text-sm font-bold text-slate-500 uppercase tracking-wider min-w-[250px]">Dados Pessoais</th>
                                    <th className="py-4 px-6 text-sm font-bold text-slate-500 uppercase tracking-wider min-w-[300px]">Biografia</th>
                                    <th className="py-4 px-6 text-sm font-bold text-slate-500 uppercase tracking-wider text-right w-20">Ação</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {authors.map((author, idx) => (
                                    <tr key={author.id || idx} className="hover:bg-slate-50 transition-colors group">
                                        <td className="py-4 px-6 align-middle">
                                            <div className="w-12 h-12 rounded-full overflow-hidden shadow-sm flex items-center justify-center shrink-0 bg-white border-2 border-slate-100">
                                                {author.avatar ? <img src={author.avatar} alt="Avatar" className="w-full h-full object-cover" /> : <ImageIcon className="w-5 h-5 text-slate-300" />}
                                            </div>
                                        </td>
                                        <td className="py-4 px-6 align-middle">
                                            <p className="font-bold text-slate-800 text-sm mb-1">{author.name || 'Sem nome'}</p>
                                            <p className="text-xs font-bold text-amber-600">{author.role || 'Sem cargo'}</p>
                                        </td>
                                        <td className="py-4 px-6 align-middle">
                                            <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">{author.bio || 'Sem biografia cadastrada...'}</p>
                                        </td>
                                        <td className="py-4 px-6 align-middle text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button onClick={() => { setTempAuthor({ ...author }); setEditingIndex(idx); setIsModalOpen(true); }}
                                                    className="w-8 h-8 bg-slate-100 text-slate-500 rounded-lg inline-flex items-center justify-center hover:bg-slate-200 hover:text-slate-800 transition-colors">
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button onClick={() => removeAuthor(idx)}
                                                    className="w-8 h-8 bg-red-50 text-red-500 rounded-lg inline-flex items-center justify-center hover:bg-red-500 hover:text-white transition-colors">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {isModalOpen && tempAuthor && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
                            <h3 className="text-lg font-bold text-slate-800">{editingIndex !== null ? 'Editar Autor' : 'Novo Autor'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-full flex items-center justify-center"><X className="w-4 h-4" /></button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[70vh] flex flex-col gap-6">
                            <label className="w-28 h-28 rounded-full overflow-hidden border-4 border-slate-50 shadow-inner bg-slate-100 flex flex-col items-center justify-center mx-auto relative group cursor-pointer">
                                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                                {tempAuthor.avatar ? (
                                    <>
                                        <img src={tempAuthor.avatar} alt="Avatar" className="absolute inset-0 w-full h-full object-cover group-hover:opacity-40 transition-opacity" />
                                        <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ImageIcon className="w-8 h-8 text-slate-800 drop-shadow-md" />
                                        </div>
                                    </>
                                ) : (
                                    <div className="flex flex-col items-center text-slate-400 group-hover:text-amber-500 transition-colors">
                                        <ImageIcon className="w-8 h-8 mb-1" />
                                        <span className="text-[9px] font-black uppercase tracking-wider">Upload PNG</span>
                                    </div>
                                )}
                            </label>
                            <div className="space-y-4 w-full">
                                {[
                                    { key: 'name', label: 'Nome Completo', placeholder: 'Ex: João da Silva', type: 'text' },
                                    { key: 'role', label: 'Cargo / Profissão', placeholder: 'Ex: Editor Chefe', type: 'text' },
                                ].map(f => (
                                    <div key={f.key}>
                                        <label className="block text-xs font-black text-slate-400 mb-1 uppercase tracking-widest text-center">{f.label}</label>
                                        <input type={f.type} placeholder={f.placeholder} value={tempAuthor[f.key] || ''} onChange={e => setTempAuthor({ ...tempAuthor, [f.key]: e.target.value })}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 font-bold text-center" />
                                    </div>
                                ))}
                                <div>
                                    <label className="block text-xs font-black text-slate-400 mb-1 uppercase tracking-widest text-center">Resumo Biográfico</label>
                                    <textarea rows={4} placeholder="Escreva sobre as especialidades do autor..." value={tempAuthor.bio || ''} onChange={e => setTempAuthor({ ...tempAuthor, bio: e.target.value })}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none text-center leading-relaxed" />
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 bg-slate-50 flex gap-3 justify-end rounded-b-3xl">
                            <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancelar</button>
                            <button onClick={saveModalAuthor} className="px-6 py-2.5 text-sm font-bold bg-slate-500 hover:bg-amber-600 text-white rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-2">
                                <Save className="w-4 h-4" /> Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
