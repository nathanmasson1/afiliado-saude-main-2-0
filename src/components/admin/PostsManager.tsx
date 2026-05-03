import React, { useState, useEffect } from 'react';
import { FileText, Plus, Search, Loader2, Trash2, Edit3, AlertCircle, Save, ChevronUp, ChevronDown, Check, X } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

export default function PostsManager() {
    const [posts, setPosts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [authors, setAuthors] = useState<any[]>([]);
    const [dynamicCategories, setDynamicCategories] = useState<any[]>([]);
    const [editingSha, setEditingSha] = useState<string | null>(null);
    const [quickEditData, setQuickEditData] = useState<any>(null);
    const [saving, setSaving] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>('all');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [sortField, setSortField] = useState<'title' | 'pubDate'>('pubDate');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
    const itemsPerPage = 20;

    useEffect(() => { fetchInitialData(); }, []);
    useEffect(() => { setCurrentPage(1); }, [search, statusFilter, categoryFilter, sortField, sortOrder]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            let allCategories = new Set<string>();

            const [authRes, catRes, postsRes] = await Promise.allSettled([
                githubApi('read', 'src/data/authors.json'),
                githubApi('read', 'src/data/categories.json'),
                githubApi('list', 'src/content/blog'),
            ]);

            if (authRes.status === 'fulfilled' && authRes.value?.content) {
                try {
                    const parsed = JSON.parse(authRes.value?.content || "{}");
                    if (Array.isArray(parsed)) setAuthors(parsed);
                } catch {}
            }

            if (catRes.status === 'fulfilled' && catRes.value?.content) {
                try {
                    const parsedCats = JSON.parse(catRes.value?.content || "{}");
                    if (Array.isArray(parsedCats)) parsedCats.forEach((c: string) => allCategories.add(c));
                } catch {}
            }

            if (postsRes.status === 'fulfilled') {
                const data = postsRes.value;
                const mdFiles = Array.isArray(data.data) ? data.data.filter((f: any) => f.name.endsWith('.md')) : [];

                const enriched: any[] = [];
                await Promise.all(mdFiles.map(async (f: any) => {
                    const fileData = await githubApi('read', f.path).catch(() => null);
                    if (!fileData) return;
                    const text = fileData.content || '';
                    const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
                    let title = f.name, category = 'Geral', author = '', pubDate = '', draft = false, description = '', image = '';
                    const slug = f.name.replace('.md', '');
                    if (match) {
                        const fm = match[1];
                        const extract = (key: string) => { const m = fm.match(new RegExp(`${key}:\\s*(?:"([^"]*)"|'([^']*)'|([^\\n\\r]+))`)); return m ? (m[1] || m[2] || m[3] || '').trim() : ''; };
                        title = extract('title') || f.name; category = extract('category') || 'Geral'; author = extract('author'); pubDate = extract('pubDate'); draft = extract('draft') === 'true'; description = extract('description'); image = extract('image');
                        if (category) allCategories.add(category);
                    }
                    enriched.push({ ...f, sha: fileData.sha || f.sha, title, category, author, pubDate, draft, description, image, slug, rawBody: match ? match[2] : text });
                }));

                setPosts(enriched);
                if (allCategories.size > 0) setDynamicCategories(Array.from(allCategories));
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (path: string, sha: string, name: string) => {
        if (!confirm(`Excluir o post "${name}"?`)) return;
        try {
            await githubApi('delete', path, { sha, message: `CMS: Excluindo post ${name}` });
            setPosts(posts.filter(f => f.sha !== sha));
            triggerToast(`Artigo "${name}" excluído!`, 'success');
        } catch (err: any) {
            triggerToast(`Erro: ${err.message}`, 'error');
        }
    };

    const handleQuickAction = (post: any) => {
        setEditingSha(post.sha);
        setQuickEditData({ title: post.title, slug: post.slug, pubDate: post.pubDate ? new Date(post.pubDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0], author: post.author, category: post.category, draft: post.draft, _oldSlug: post.slug, _oldPath: post.path, _sha: post.sha, description: post.description, image: post.image, rawBody: post.rawBody });
    };

    const saveQuickEdit = async () => {
        if (!quickEditData.title || !quickEditData.slug) return alert('Título e Slug não podem ser vazios.');
        setSaving(true);
        try {
            const targetPath = `src/content/blog/${quickEditData.slug}.md`;
            const markdown = `---\ntitle: "${quickEditData.title.replace(/"/g, '\\"')}"\ndescription: "${(quickEditData.description || '').replace(/"/g, '\\"')}"\npubDate: "${quickEditData.pubDate}"\nimage: "${quickEditData.image || ''}"\ncategory: "${quickEditData.category}"\nauthor: "${quickEditData.author}"\ndraft: ${quickEditData.draft}\n---\n${quickEditData.rawBody}`;

            if (quickEditData.slug !== quickEditData._oldSlug) {
                await githubApi('write', targetPath, { content: markdown, message: `CMS: Renomeando ${quickEditData.slug}` });
                await githubApi('delete', quickEditData._oldPath, { sha: quickEditData._sha, message: 'CMS: Apagando slug antigo' });
            } else {
                await githubApi('write', targetPath, { content: markdown, sha: quickEditData._sha, message: `CMS: Edição Rápida ${quickEditData.slug}` });
            }
            triggerToast('Artigo atualizado com sucesso!', 'success');
            setEditingSha(null);
            fetchInitialData();
        } catch (e: any) {
            triggerToast(`Erro: ${e.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    // Filtering & sorting
    let filtered = posts.filter(p => {
        if (search && !p.title.toLowerCase().includes(search.toLowerCase()) && !p.slug.toLowerCase().includes(search.toLowerCase())) return false;
        if (statusFilter === 'published' && p.draft) return false;
        if (statusFilter === 'draft' && !p.draft) return false;
        if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
        return true;
    });
    filtered = [...filtered].sort((a, b) => {
        const aVal = sortField === 'pubDate' ? new Date(a.pubDate || 0).getTime() : (a.title || '').toLowerCase();
        const bVal = sortField === 'pubDate' ? new Date(b.pubDate || 0).getTime() : (b.title || '').toLowerCase();
        if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
        return 0;
    });
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const paginated = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    const toggleSort = (field: 'title' | 'pubDate') => {
        if (sortField === field) setSortOrder(o => o === 'asc' ? 'desc' : 'asc');
        else { setSortField(field); setSortOrder('asc'); }
    };

    const SortIcon = ({ field }: { field: 'title' | 'pubDate' }) => {
        if (sortField !== field) return null;
        return sortOrder === 'asc' ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />;
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white rounded-3xl border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-violet-500" />
            <p className="font-medium animate-pulse">Carregando artigos...</p>
        </div>
    );

    return (
        <div className="space-y-6 pb-32">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 px-6 rounded-2xl border border-slate-200 shadow-sm sticky top-0 z-40">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Artigos do Blog</h2>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1">{posts.length} artigos no total</p>
                </div>
                <a href="/admin/posts/new" className="bg-violet-600 hover:bg-violet-700 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-violet-600/25 hover:-translate-y-0.5 transition-all">
                    <Plus className="w-5 h-5" /> Novo Artigo
                </a>
            </div>

            {error && <div className="p-5 bg-red-100/50 text-red-700 rounded-2xl font-bold border border-red-200"><AlertCircle className="w-5 h-5 inline mr-2 -mt-1" /> {error}</div>}

            {/* Filters */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap gap-3 items-center">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input type="text" placeholder="Buscar artigos..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-violet-500 focus:ring-1 focus:ring-violet-500" />
                </div>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-violet-500">
                    <option value="all">Todos</option>
                    <option value="published">Publicados</option>
                    <option value="draft">Rascunhos</option>
                </select>
                {dynamicCategories.length > 0 && (
                    <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:border-violet-500">
                        <option value="all">Todas as categorias</option>
                        {dynamicCategories.map(cat => {
                            const slug = typeof cat === 'string' ? cat : cat.slug || cat.name;
                            const label = typeof cat === 'string' ? cat : cat.name || cat.slug;
                            return <option key={slug} value={slug}>{label}</option>;
                        })}
                    </select>
                )}
            </div>

            {/* Table */}
            {paginated.length === 0 ? (
                <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-3xl p-16 flex flex-col items-center justify-center text-center">
                    <FileText className="w-12 h-12 text-slate-300 mb-4" />
                    <h3 className="text-xl font-bold text-slate-700 mb-2">Nenhum artigo encontrado</h3>
                    <a href="/admin/posts/new" className="mt-4 bg-violet-600 text-white font-bold px-8 py-3 rounded-xl shadow-md hover:bg-violet-700 transition-colors">Criar primeiro artigo</a>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="border-b border-slate-200 bg-slate-50">
                                <tr>
                                    <th className="py-4 px-4 w-8"><input type="checkbox" className="rounded" onChange={e => setSelectedPosts(e.target.checked ? paginated.map(p => p.sha) : [])} checked={selectedPosts.length === paginated.length && paginated.length > 0} /></th>
                                    <th className="py-4 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700" onClick={() => toggleSort('title')}>Título <SortIcon field="title" /></th>
                                    <th className="py-4 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">Categoria</th>
                                    <th className="py-4 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden md:table-cell">Autor</th>
                                    <th className="py-4 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider cursor-pointer hover:text-slate-700 hidden md:table-cell" onClick={() => toggleSort('pubDate')}>Data <SortIcon field="pubDate" /></th>
                                    <th className="py-4 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                                    <th className="py-4 px-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Ações</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {paginated.map(post => (
                                    <React.Fragment key={post.sha}>
                                        <tr className="hover:bg-slate-50 transition-colors">
                                            <td className="py-4 px-4"><input type="checkbox" className="rounded" checked={selectedPosts.includes(post.sha)} onChange={e => setSelectedPosts(e.target.checked ? [...selectedPosts, post.sha] : selectedPosts.filter(s => s !== post.sha))} /></td>
                                            <td className="py-4 px-4">
                                                <p className="font-bold text-slate-800 text-sm line-clamp-1">{post.title}</p>
                                                <p className="text-xs text-slate-400 font-mono mt-0.5">/{post.slug}</p>
                                            </td>
                                            <td className="py-4 px-4 hidden sm:table-cell"><span className="text-xs font-bold bg-slate-100 text-slate-600 px-2 py-1 rounded-full">{post.category}</span></td>
                                            <td className="py-4 px-4 hidden md:table-cell text-sm text-slate-500">{post.author || '—'}</td>
                                            <td className="py-4 px-4 hidden md:table-cell text-xs text-slate-400 font-mono">{post.pubDate || '—'}</td>
                                            <td className="py-4 px-4">
                                                {post.draft ? (
                                                    <span className="inline-flex items-center gap-1 text-xs font-bold bg-amber-50 text-amber-600 border border-amber-200 px-2 py-1 rounded-full">Rascunho</span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 text-xs font-bold bg-green-50 text-green-600 border border-green-200 px-2 py-1 rounded-full"><Check className="w-3 h-3" />Publicado</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button onClick={() => handleQuickAction(post)} title="Edição Rápida" className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"><Edit3 className="w-4 h-4" /></button>
                                                    <a href={`/admin/posts/edit?file=${encodeURIComponent(post.path)}`} title="Editar Completo" className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"><FileText className="w-4 h-4" /></a>
                                                    <button onClick={() => handleDelete(post.path, post.sha, post.title)} title="Excluir" className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 className="w-4 h-4" /></button>
                                                </div>
                                            </td>
                                        </tr>

                                        {/* Quick Edit Row */}
                                        {editingSha === post.sha && quickEditData && (
                                            <tr className="bg-violet-50">
                                                <td colSpan={7} className="px-4 py-4">
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Título</label>
                                                            <input type="text" value={quickEditData.title} onChange={e => setQuickEditData({ ...quickEditData, title: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Slug (URL)</label>
                                                            <input type="text" value={quickEditData.slug} onChange={e => setQuickEditData({ ...quickEditData, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-violet-500" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Data</label>
                                                            <input type="date" value={quickEditData.pubDate} onChange={e => setQuickEditData({ ...quickEditData, pubDate: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Categoria</label>
                                                            <input type="text" list="cats-list" value={quickEditData.category} onChange={e => setQuickEditData({ ...quickEditData, category: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" />
                                                            <datalist id="cats-list">{dynamicCategories.map(c => { const v = typeof c === 'string' ? c : c.slug || c.name; return <option key={v} value={v} />; })}</datalist>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Autor</label>
                                                            <input type="text" list="authors-list" value={quickEditData.author} onChange={e => setQuickEditData({ ...quickEditData, author: e.target.value })} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-violet-500" />
                                                            <datalist id="authors-list">{authors.map(a => <option key={a.id} value={a.name} />)}</datalist>
                                                        </div>
                                                        <div className="flex items-end gap-3">
                                                            <label className="flex items-center gap-2 text-sm font-bold text-slate-600 cursor-pointer">
                                                                <input type="checkbox" checked={quickEditData.draft} onChange={e => setQuickEditData({ ...quickEditData, draft: e.target.checked })} className="rounded" />
                                                                Rascunho
                                                            </label>
                                                        </div>
                                                    </div>
                                                    <div className="flex gap-3 mt-4 justify-end">
                                                        <button onClick={() => setEditingSha(null)} className="flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-slate-500 hover:bg-slate-200 rounded-lg transition-colors"><X className="w-4 h-4" />Cancelar</button>
                                                        <button onClick={saveQuickEdit} disabled={saving} className="flex items-center gap-1.5 px-5 py-2 text-sm font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-lg shadow-sm transition-all disabled:opacity-60">
                                                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                                            {saving ? 'Salvando...' : 'Salvar'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                        <button key={p} onClick={() => setCurrentPage(p)} className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${currentPage === p ? 'bg-violet-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-violet-300'}`}>{p}</button>
                    ))}
                </div>
            )}
        </div>
    );
}
