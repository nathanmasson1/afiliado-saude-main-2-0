import React, { useState, useEffect } from 'react';
import { AlertCircle, Loader2, Plus, Trash2, Tag, X, Edit2 } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

interface Category {
    name: string;
    slug: string;
    description: string;
}

const toSlug = (str: string) => str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function CategoriesEditor() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [fileSha, setFileSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const [tempName, setTempName] = useState('');
    const [tempSlug, setTempSlug] = useState('');
    const [tempDesc, setTempDesc] = useState('');

    useEffect(() => {
        githubApi('read', 'src/data/categories.json')
            .then(data => {
                const parsed = JSON.parse(data?.content || "[]");
                if (Array.isArray(parsed)) {
                    const normalized = parsed.map((cat: any) =>
                        typeof cat === 'string'
                            ? { name: cat, slug: toSlug(cat), description: '' }
                            : { name: cat.name || '', slug: cat.slug || toSlug(cat.name || ''), description: cat.description || '' }
                    );
                    setCategories(normalized);
                }
                setFileSha(data.sha);
            })
            .catch(err => {
                if (err.message.includes('404')) setCategories([]);
                else setError(err.message);
            })
            .finally(() => setLoading(false));
    }, []);

    const saveToGithub = async (newList: Category[]) => {
        setSaving(true); setError('');
        triggerToast('Sincronizando categorias...', 'progress', 20);
        try {
            const data = await githubApi('write', 'src/data/categories.json', {
                content: JSON.stringify(newList, null, 2),
                sha: fileSha || undefined,
                message: 'CMS: Update categories.json'
            });
            setFileSha(data.sha);
            triggerToast('Categorias atualizadas!', 'success', 100);
        } catch (err: any) {
            setError(err.message);
            triggerToast(`Erro: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const openModal = (idx: number | null) => {
        if (idx !== null) {
            const cat = categories[idx];
            setTempName(cat.name);
            setTempSlug(cat.slug);
            setTempDesc(cat.description);
        } else {
            setTempName('');
            setTempSlug('');
            setTempDesc('');
        }
        setEditingIndex(idx);
        setIsModalOpen(true);
    };

    const saveModalCategory = async () => {
        if (!tempName.trim()) { alert('O nome da categoria é obrigatório!'); return; }
        const slug = tempSlug.trim() || toSlug(tempName);
        const newCat: Category = { name: tempName.trim(), slug, description: tempDesc.trim() };
        const arr = [...categories];
        if (editingIndex === null) {
            if (arr.some(c => c.slug === slug)) { alert('Uma categoria com este slug já existe!'); return; }
            arr.push(newCat);
        } else {
            arr[editingIndex] = newCat;
        }
        setCategories(arr);
        setIsModalOpen(false);
        await saveToGithub(arr);
    };

    const removeCategory = async (index: number) => {
        if (!confirm('Excluir esta categoria?')) return;
        const arr = [...categories];
        arr.splice(index, 1);
        setCategories(arr);
        await saveToGithub(arr);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white rounded-3xl border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-indigo-500" />
            <p className="font-medium animate-pulse">Lendo categorias...</p>
        </div>
    );

    return (
        <div className="space-y-8 pb-32">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/80 backdrop-blur-xl p-5 px-8 rounded-2xl border border-slate-200 shadow-xl shadow-slate-200/50 sticky top-0 z-40">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Gerenciador de Categorias</h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full border-2 border-indigo-500"></span>
                        {categories.length} Categorias Definidas
                    </p>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-auto">
                    {saving && <div className="flex items-center gap-2 text-slate-600 bg-slate-50 px-4 py-2 rounded-lg text-sm font-bold mr-2"><Loader2 className="w-4 h-4 animate-spin" /> Sincronizando...</div>}
                    <button onClick={() => openModal(null)} disabled={saving}
                        className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/25 hover:-translate-y-0.5 transition-all">
                        <Plus className="w-5 h-5" /> Nova Categoria
                    </button>
                </div>
            </div>

            {error && <div className="p-5 bg-red-100/50 text-red-700 rounded-2xl font-bold border border-red-200"><AlertCircle className="w-5 h-5 inline mr-2 -mt-1" /> {error}</div>}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {categories.length === 0 ? (
                    <div className="col-span-full bg-slate-50 border-2 border-dashed border-slate-300 rounded-3xl p-16 flex flex-col items-center justify-center text-center">
                        <Tag className="w-12 h-12 text-slate-300 mb-4" />
                        <h3 className="text-xl font-bold text-slate-700 mb-2">Nenhuma categoria!</h3>
                        <p className="text-slate-500 mb-6">Crie categorias para organizar seus artigos do blog.</p>
                        <button onClick={() => openModal(null)} className="bg-indigo-600 text-white font-bold px-8 py-3 rounded-xl shadow-md hover:bg-indigo-700 transition-colors">
                            Criar minha primeira categoria
                        </button>
                    </div>
                ) : categories.map((cat, idx) => (
                    <div key={cat.slug} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center font-bold"><Tag className="w-5 h-5" /></div>
                                <div>
                                    <span className="font-bold text-slate-700 block">{cat.name}</span>
                                    <span className="text-xs text-slate-400">{cat.slug}</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => openModal(idx)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors"><Edit2 className="w-4 h-4" /></button>
                                <button onClick={() => removeCategory(idx)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                            </div>
                        </div>
                        {cat.description && <p className="text-xs text-slate-500 mt-2 pl-14">{cat.description}</p>}
                    </div>
                ))}
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800">{editingIndex !== null ? 'Editar Categoria' : 'Nova Categoria'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Nome</label>
                                <input type="text" value={tempName} onChange={e => { setTempName(e.target.value); if (editingIndex === null) setTempSlug(toSlug(e.target.value)); }}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Ex: Produtos Físicos" autoFocus />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Slug</label>
                                <input type="text" value={tempSlug} onChange={e => setTempSlug(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="produtos-fisicos" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Descrição (opcional)</label>
                                <input type="text" value={tempDesc} onChange={e => setTempDesc(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="Reviews e comparativos de produtos físicos" />
                            </div>
                        </div>
                        <div className="p-6 border-t border-slate-100 flex gap-3 justify-end">
                            <button onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 font-bold text-slate-500 hover:bg-slate-100 rounded-xl">Cancelar</button>
                            <button onClick={saveModalCategory} className="px-6 py-2.5 font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-md transition-all">Salvar Categoria</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
