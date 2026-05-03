import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, Loader2, ArrowLeft, Image as ImageIcon, Eye, Edit3 } from 'lucide-react';
import { marked } from 'marked';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';
import SEOScoreWidget from '../../plugins/seo/SEOScoreWidget';

interface PostEditorProps {
    filePath: string | null; // null = novo post
}

export default function PostEditor({ filePath }: PostEditorProps) {
    const isEditing = !!filePath;
    const [loading, setLoading] = useState(isEditing);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [authors, setAuthors] = useState<any[]>([]);
    const [dynamicCategories, setDynamicCategories] = useState<any[]>([]);
    const [fileSha, setFileSha] = useState('');
    const [isPreview, setIsPreview] = useState(false);
    const [pendingUploads, setPendingUploads] = useState<Record<string, File>>({});
    const [QuillEditor, setQuillEditor] = useState<any>(null);

    const formatDateForInput = (dateStr: string) => {
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return new Date().toISOString().split('T')[0];
            return d.toISOString().split('T')[0];
        } catch { return new Date().toISOString().split('T')[0]; }
    };

    const [post, setPost] = useState({
        title: '', slug: '', description: '', pubDate: new Date().toISOString().split('T')[0],
        image: '', category: '', author: '', draft: false, content: ''
    });

    // Load Quill dynamically
    useEffect(() => {
        import('react-quill-new').then(mod => setQuillEditor(() => mod.default));
        import('react-quill-new/dist/quill.snow.css' as any);
    }, []);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [authRes, catRes] = await Promise.allSettled([
                    githubApi('read', 'src/data/authors.json'),
                    githubApi('read', 'src/data/categories.json'),
                ]);
                if (authRes.status === 'fulfilled') { const p = JSON.parse(authRes.value?.content || "{}"); if (Array.isArray(p)) setAuthors(p); }
                if (catRes.status === 'fulfilled') { const p = JSON.parse(catRes.value?.content || "{}"); if (Array.isArray(p)) setDynamicCategories(p); }

                if (isEditing && filePath) {
                    const fileData = await githubApi('read', filePath);
                    setFileSha(fileData.sha);
                    const text = fileData.content;
                    const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
                    if (match) {
                        const fm = match[1];
                        const body = match[2].trim();
                        const extract = (key: string) => { const m = fm.match(new RegExp(`${key}:\\s*(?:"([^"]*)"|'([^']*)'|(.*))`)); return m ? (m[1] || m[2] || m[3] || '').trim() : ''; };
                        const parsedHtml = await marked.parse(body);
                        setPost({
                            title: extract('title'), slug: filePath.split('/').pop()?.replace('.md', '') || '',
                            description: extract('description'), pubDate: extract('pubDate') ? formatDateForInput(extract('pubDate')) : new Date().toISOString().split('T')[0],
                            image: extract('image'), category: extract('category') || 'reviews', author: extract('author'),
                            draft: extract('draft') === 'true', content: parsedHtml
                        });
                    } else {
                        setPost(p => ({ ...p, content: String(marked.parse(text)), slug: filePath.split('/').pop()?.replace('.md', '') || '' }));
                    }
                }
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, [filePath, isEditing]);

    const handleTitleChange = (val: string) => {
        setPost(p => ({ ...p, title: val, slug: isEditing ? p.slug : val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') }));
    };

    const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = error => reject(error);
        reader.readAsDataURL(file);
    });

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, uiKey: string) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setPendingUploads(prev => ({ ...prev, [uiKey]: file }));
        if (uiKey === 'image') setPost(p => ({ ...p, image: URL.createObjectURL(file) }));
        e.target.value = '';
    };

    const extractAndUploadInlineImages = async (html: string) => {
        const imgRegex = /<img[^>]+src="data:image\/([^;]+);base64,([^"]+)"[^>]*>/g;
        let modifiedHtml = html;
        const matches = [...html.matchAll(imgRegex)];
        for (const m of matches) {
            const ext = m[1]; const base64Content = m[2];
            const ghPath = `public/uploads/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
            await githubApi('write', ghPath, { content: base64Content, isBase64: true, message: `Upload imagem inline ${ghPath}` });
            modifiedHtml = modifiedHtml.replace(`data:image/${ext};base64,${base64Content}`, ghPath.replace('public', ''));
        }
        return modifiedHtml;
    };

    const handleSave = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!post.title || !post.slug) { setError('Título e Slug (URL) são obrigatórios.'); return; }
        setSaving(true); setError('');
        triggerToast('Processando e salvando artigo...', 'progress', 20);
        try {
            let finalHeroImage = post.image;
            if (pendingUploads['image']) {
                const fileObj = pendingUploads['image'];
                const base64Content = await fileToBase64(fileObj);
                const fileExt = fileObj.name.split('.').pop() || 'jpg';
                const ghPath = `public/uploads/${Date.now()}-blog-cover.${fileExt}`;
                await githubApi('write', ghPath, { content: base64Content, isBase64: true, message: `Upload capa blog ${ghPath}` });
                finalHeroImage = ghPath.replace('public', '');
            }
            const cleanedContent = post.content.replace(/&nbsp;/g, ' ').replace(/\u00A0/g, ' ');
            const finalHtmlContent = await extractAndUploadInlineImages(cleanedContent);
            const markdown = `---\ntitle: "${post.title.replace(/"/g, '\\"')}"\ndescription: "${post.description.replace(/"/g, '\\"')}"\npubDate: "${post.pubDate}"\nimage: "${finalHeroImage}"\ncategory: "${post.category}"\nauthor: "${post.author}"\ndraft: ${post.draft}\n---\n${finalHtmlContent}`;
            const targetPath = `src/content/blog/${post.slug}.md`;
            const res = await githubApi('write', targetPath, { content: markdown, sha: fileSha || undefined, message: `CMS: ${isEditing ? 'Edição' : 'Criação'} do artigo ${post.slug}` });
            if (res.sha) setFileSha(res.sha);
            setPendingUploads({});
            triggerToast('Artigo salvo com sucesso!', 'success', 100);
            if (!isEditing) setTimeout(() => { window.location.href = '/admin/posts'; }, 1500);
        } catch (err: any) {
            setError(err.message); triggerToast(`Erro: ${err.message}`, 'error');
        } finally { setSaving(false); }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white rounded-3xl border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-violet-500" />
            <p className="font-medium animate-pulse">Carregando editor...</p>
        </div>
    );

    const inputClass = "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all shadow-sm";
    const labelClass = "block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1";

    return (
        <div className="max-w-5xl pb-32">
            {/* Fixed header bar */}
            <div className="flex items-center justify-between bg-white p-4 px-6 rounded-2xl border border-slate-200 shadow-sm mb-6">
                <div className="flex items-center gap-3">
                    <a href="/admin/posts" className="text-slate-400 hover:text-violet-600 transition-colors p-1.5 rounded-lg hover:bg-violet-50"><ArrowLeft className="w-5 h-5" /></a>
                    <div>
                        <h2 className="text-lg font-bold text-slate-800">{isEditing ? 'Editar Artigo' : 'Novo Artigo'}</h2>
                        {post.slug && <p className="text-xs font-mono text-slate-400">/blog/{post.slug}</p>}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <button type="button" onClick={() => setIsPreview(!isPreview)} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors">
                        {isPreview ? <Edit3 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        {isPreview ? 'Editor' : 'Preview'}
                    </button>
                    <button onClick={handleSave} disabled={saving} className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-5 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-sm shadow-violet-600/20">
                        {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                        {saving ? 'Salvando...' : <><Save className="w-4 h-4" /> {isEditing ? 'Salvar' : 'Publicar'}</>}
                    </button>
                </div>
            </div>

            {error && <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium mb-6 rounded-r-xl flex gap-2"><AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}</div>}

            <div className="flex gap-6 items-start">
                {/* Main Editor Area */}
                <div className="flex-1 min-w-0 space-y-6">
                    {/* Title */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <label className={labelClass}>Título do Artigo *</label>
                        <input type="text" value={post.title} onChange={e => handleTitleChange(e.target.value)} className={inputClass} placeholder="Título do artigo..." />
                        <div className="mt-3">
                            <label className={labelClass}>Slug (URL) *</label>
                            <input type="text" value={post.slug} onChange={e => setPost(p => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))} className={`${inputClass} font-mono text-xs`} placeholder="url-do-artigo" />
                        </div>
                        <div className="mt-3">
                            <label className={labelClass}>Descrição / Meta Description</label>
                            <textarea rows={2} value={post.description} onChange={e => setPost(p => ({ ...p, description: e.target.value }))} className={`${inputClass} resize-none`} placeholder="Breve descrição do artigo..." />
                        </div>
                    </div>

                    {/* Content Editor */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <label className={labelClass}>Conteúdo do Artigo</label>
                        {isPreview ? (
                            <div className="prose prose-slate max-w-none border border-slate-200 rounded-xl p-6 min-h-[300px]" dangerouslySetInnerHTML={{ __html: post.content }} />
                        ) : QuillEditor ? (
                            <QuillEditor
                                theme="snow"
                                value={post.content}
                                onChange={(val: string) => setPost(p => ({ ...p, content: val }))}
                                style={{ minHeight: '300px' }}
                            />
                        ) : (
                            <div className="flex items-center justify-center p-12 text-slate-400"><Loader2 className="w-6 h-6 animate-spin mr-2" />Carregando editor...</div>
                        )}
                    </div>
                </div>

                {/* Sidebar */}
                <div className="w-72 shrink-0 space-y-4 sticky top-4">
                    {/* Publish Settings */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-700 text-sm border-b border-slate-100 pb-3 mb-4">Publicação</h3>
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>Status</label>
                                <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl hover:bg-violet-50 transition-colors">
                                    <input type="checkbox" checked={post.draft} onChange={e => setPost(p => ({ ...p, draft: e.target.checked }))} className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                                    <span className="text-sm font-medium text-slate-700">Salvar como rascunho</span>
                                </label>
                            </div>
                            <div>
                                <label className={labelClass}>Data de Publicação</label>
                                <input type="date" value={post.pubDate} onChange={e => setPost(p => ({ ...p, pubDate: e.target.value }))} className={inputClass} />
                            </div>
                        </div>
                    </div>

                    {/* Category & Author */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-700 text-sm border-b border-slate-100 pb-3 mb-4">Metadados</h3>
                        <div className="space-y-4">
                            <div>
                                <label className={labelClass}>Categoria</label>
                                {dynamicCategories.length > 0 ? (
                                    <select value={post.category} onChange={e => setPost(p => ({ ...p, category: e.target.value }))} className={inputClass}>
                                        <option value="">Selecionar categoria...</option>
                                        {dynamicCategories.map(cat => {
                                            const slug = typeof cat === 'string' ? cat : cat.slug || cat.name;
                                            const label = typeof cat === 'string' ? cat : cat.name || cat.slug;
                                            return <option key={slug} value={slug}>{label}</option>;
                                        })}
                                    </select>
                                ) : (
                                    <input type="text" value={post.category} onChange={e => setPost(p => ({ ...p, category: e.target.value }))} className={inputClass} placeholder="Ex: Tecnologia" />
                                )}
                            </div>
                            <div>
                                <label className={labelClass}>Autor</label>
                                {authors.length > 0 ? (
                                    <select value={post.author} onChange={e => setPost(p => ({ ...p, author: e.target.value }))} className={inputClass}>
                                        <option value="">Selecionar autor...</option>
                                        {authors.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                                    </select>
                                ) : (
                                    <input type="text" value={post.author} onChange={e => setPost(p => ({ ...p, author: e.target.value }))} className={inputClass} placeholder="Nome do autor" />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Hero Image */}
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="font-bold text-slate-700 text-sm border-b border-slate-100 pb-3 mb-4">Imagem de Capa</h3>
                        <label className="group relative border-2 border-dashed border-slate-200 hover:border-violet-400 bg-slate-50 hover:bg-violet-50 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all text-center overflow-hidden" style={{ minHeight: '120px' }}>
                            <input type="file" accept="image/*" className="hidden" onChange={e => handleFileSelect(e, 'image')} />
                            {post.image ? (
                                <>
                                    <img src={post.image} alt="Capa" className="absolute inset-0 w-full h-full object-cover group-hover:opacity-60 transition-opacity" />
                                    <div className="absolute inset-0 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-white/20">
                                        <ImageIcon className="w-8 h-8 text-slate-800" />
                                        <span className="text-xs font-bold text-slate-900 mt-1">Trocar imagem</span>
                                    </div>
                                </>
                            ) : (
                                <div className="py-6 flex flex-col items-center text-slate-400 group-hover:text-violet-500 transition-colors">
                                    <ImageIcon className="w-8 h-8 mb-2" />
                                    <span className="text-xs font-bold">Enviar imagem de capa</span>
                                </div>
                            )}
                        </label>
                        {pendingUploads['image'] && <span className="text-[10px] text-amber-600 font-bold block mt-2">Upload pendente — será enviado ao salvar</span>}
                    </div>

                    {/* SEO Score Widget */}
                    <SEOScoreWidget
                        title={post.title}
                        description={post.description}
                        image={post.image}
                        content={post.content}
                    />
                </div>
            </div>
        </div>
    );
}
