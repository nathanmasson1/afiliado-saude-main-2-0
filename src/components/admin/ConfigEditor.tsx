import React, { useState, useEffect } from 'react';
import { Save, AlertCircle, Loader2, Image as ImageIcon, Sparkles, Eye, EyeOff } from 'lucide-react';
import { triggerToast } from './CmsToaster';
import { githubApi } from '../../lib/adminApi';

export default function ConfigEditor() {
    const [config, setConfig] = useState<any>(null);
    const [fileSha, setFileSha] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [pendingLogo, setPendingLogo] = useState<File | null>(null);
    const [pendingFavicon, setPendingFavicon] = useState<File | null>(null);
    const [showApiKey, setShowApiKey] = useState(false);

    const fileToBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve((reader.result?.toString() || '').split(',')[1]);
        reader.onerror = error => reject(error);
    });

    useEffect(() => {
        githubApi('read', 'src/data/siteConfig.json')
            .then(data => { setConfig(JSON.parse(data?.content || "{}")); setFileSha(data.sha); })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true); setError('');
        triggerToast('Sincronizando configurações...', 'progress', 20);
        try {
            let configCopy = { ...config };
            if (pendingLogo) {
                triggerToast('Enviando novo logo...', 'progress', 30);
                const base64Content = await fileToBase64(pendingLogo);
                const fileExt = pendingLogo.name.split('.').pop() || 'png';
                const ghPath = `public/uploads/${Date.now()}-logo.${fileExt}`;
                await githubApi('write', ghPath, { content: base64Content, isBase64: true, message: 'CMS: Upload Logo' });
                configCopy.logo = ghPath.replace('public', '');
            }
            if (pendingFavicon) {
                triggerToast('Enviando favicon...', 'progress', 50);
                const base64Content = await fileToBase64(pendingFavicon);
                const fileExt = pendingFavicon.name.split('.').pop() || 'png';
                const ghPath = `public/favicon.${fileExt}`;
                let faviconSha: string | undefined;
                try {
                    const existing = await githubApi('read', ghPath);
                    if (existing?.sha) faviconSha = existing.sha;
                } catch {}
                await githubApi('write', ghPath, { content: base64Content, isBase64: true, sha: faviconSha, message: 'CMS: Upload Favicon' });
                configCopy.favicon = `/favicon.${fileExt}`;
            }
            const res = await githubApi('write', 'src/data/siteConfig.json', { content: JSON.stringify(configCopy, null, 2), sha: fileSha, message: 'CMS: Update siteConfig.json' });
            setFileSha(res.sha); setPendingLogo(null); setPendingFavicon(null);
            triggerToast('Configurações salvas com sucesso!', 'success', 100);
        } catch (err: any) {
            setError(err.message); triggerToast(`Erro: ${err.message}`, 'error');
        } finally { setSaving(false); }
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white rounded-3xl border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-violet-500" />
            <p className="font-medium animate-pulse">Conectando ao Repositório...</p>
        </div>
    );

    if (error && !config) return (
        <div className="bg-red-50 text-red-700 p-8 rounded-3xl border border-red-200 flex gap-4 items-start">
            <AlertCircle className="w-8 h-8 shrink-0" />
            <div><h3 className="text-xl font-bold mb-2">Erro de Leitura</h3><p>{error}</p></div>
        </div>
    );

    const inputClass = "w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all shadow-sm text-slate-800 font-medium";
    const labelClass = "block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1";

    const presetThemes = [
        { name: 'Rosa Original', primary: '#FE4F70', accent: '#FFA387', dark: '#203656' },
        { name: 'Oceano',        primary: '#2196F3', accent: '#64B5F6', dark: '#0D2137' },
        { name: 'Floresta',      primary: '#4CAF50', accent: '#81C784', dark: '#1B3A2A' },
        { name: 'Sunset',        primary: '#FF5722', accent: '#FFAB91', dark: '#4A1A0A' },
        { name: 'Roxo Elegante', primary: '#7C3AED', accent: '#A78BFA', dark: '#2D1060' },
        { name: 'Dourado',       primary: '#D4A017', accent: '#F0D060', dark: '#3D2A00' },
    ];

    return (
        <form onSubmit={handleSave} className="space-y-8 pb-32 max-w-3xl">
            {/* Action Bar */}
            <div className="flex items-center justify-between bg-white p-4 px-6 rounded-2xl border border-slate-200 shadow-sm">
                <div>
                    <h2 className="text-lg font-bold text-slate-800">Configurações Gerais</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Edita o arquivo <code className="bg-slate-100 px-1 rounded">src/data/siteConfig.json</code></p>
                </div>
                <button type="submit" disabled={saving} className="bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg font-bold flex items-center gap-2 shadow-sm shadow-violet-600/20 transition-all">
                    {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>
            </div>

            {error && <div className="p-5 bg-red-100/50 text-red-700 rounded-2xl font-bold border border-red-200 flex gap-3"><AlertCircle className="w-5 h-5 shrink-0" /> {error}</div>}

            {/* Identidade */}
            <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-8 border-b border-slate-100 pb-4">Identidade Base</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="md:col-span-2 flex flex-col sm:flex-row gap-8 items-start">
                        <div className="w-full sm:w-1/3">
                            <label className={labelClass}>Logo Principal</label>
                            <label className="group relative border-2 border-dashed border-slate-300 hover:border-violet-500 bg-slate-50 hover:bg-violet-50/50 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all text-center h-48">
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) { setPendingLogo(file); setConfig({ ...config, logo: URL.createObjectURL(file) }); }
                                }} />
                                {config?.logo ? (
                                    <img src={config.logo} alt="Logo" className="max-h-24 w-auto object-contain mb-4 group-hover:scale-105 transition-transform" />
                                ) : (
                                    <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-slate-300 shadow-sm mb-3 group-hover:text-violet-500 transition-colors">
                                        <ImageIcon className="w-8 h-8" />
                                    </div>
                                )}
                                <span className="text-sm font-semibold text-slate-700 group-hover:text-violet-700 transition-colors">
                                    {config?.logo ? 'Trocar Logo' : 'Enviar Logo (PNG/SVG)'}
                                </span>
                            </label>
                        </div>
                        <div className="w-full sm:w-1/3">
                            <label className={labelClass}>Favicon</label>
                            <label className="group relative border-2 border-dashed border-slate-300 hover:border-violet-500 bg-slate-50 hover:bg-violet-50/50 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all text-center h-48">
                                <input type="file" accept="image/png,image/svg+xml,image/x-icon,image/ico" className="hidden" onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) { setPendingFavicon(file); setConfig({ ...config, favicon: URL.createObjectURL(file) }); }
                                }} />
                                {config?.favicon ? (
                                    <img src={config.favicon} alt="Favicon" className="max-h-16 w-auto object-contain mb-4 group-hover:scale-105 transition-transform" />
                                ) : (
                                    <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center text-slate-300 shadow-sm mb-3 group-hover:text-violet-500 transition-colors text-2xl">⭐</div>
                                )}
                                <span className="text-sm font-semibold text-slate-700 group-hover:text-violet-700 transition-colors">
                                    {config?.favicon ? 'Trocar Favicon' : 'Enviar Favicon'}
                                </span>
                                <span className="text-[10px] text-slate-400 mt-1">PNG, SVG ou ICO</span>
                            </label>
                        </div>
                    </div>
                    <div className="md:col-span-2 space-y-6">
                        <div>
                            <label className={labelClass}>Nome do Site / Empresa</label>
                            <input type="text" value={config?.name || ''} onChange={e => setConfig({ ...config, name: e.target.value })} className={inputClass} />
                        </div>
                        <div>
                            <label className={labelClass}>Descrição do Site</label>
                            <textarea rows={2} placeholder="Breve descrição que aparece no widget 'Sobre' da sidebar do blog" value={config?.description || ''} onChange={e => setConfig({ ...config, description: e.target.value })} className={`${inputClass} resize-y`} />
                        </div>
                        {/* Preset Themes */}
                        <div>
                            <label className={labelClass}>Temas Prontos</label>
                            <div className="flex flex-wrap gap-2">
                                {presetThemes.map(preset => (
                                    <button
                                        key={preset.name}
                                        type="button"
                                        onClick={() => setConfig({ ...config, theme: { ...config.theme, primary: preset.primary, accent: preset.accent, dark: preset.dark } })}
                                        className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl hover:border-violet-400 hover:bg-violet-50 transition-all text-sm font-semibold text-slate-700"
                                    >
                                        <span className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ background: preset.primary }} />
                                        <span className="w-4 h-4 rounded-full border border-white shadow-sm" style={{ background: preset.accent }} />
                                        {preset.name}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                            {[
                                { key: 'primary', label: 'Cor Primária' },
                                { key: 'accent', label: 'Cor de Destaque' },
                            ].map(f => (
                                <div key={f.key}>
                                    <label className={labelClass}>{f.label}</label>
                                    <div className="flex gap-4 p-2 bg-slate-50 border border-slate-200 rounded-xl">
                                        <input type="color" value={config?.theme?.[f.key] || '#000000'} onChange={e => setConfig({ ...config, theme: { ...config.theme, [f.key]: e.target.value } })} className="h-10 w-16 p-0 border-0 rounded-lg cursor-pointer bg-transparent" />
                                        <input type="text" value={config?.theme?.[f.key] || ''} onChange={e => setConfig({ ...config, theme: { ...config.theme, [f.key]: e.target.value } })} className="flex-1 bg-transparent border-none focus:outline-none font-mono text-slate-700 font-bold" />
                                    </div>
                                </div>
                            ))}
                        </div>
                        {/* Live Preview */}
                        {(config?.theme?.primary || config?.theme?.accent) && (
                            <div>
                                <label className={labelClass}>Preview</label>
                                <div
                                    className="h-14 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                                    style={{ background: `linear-gradient(to right, ${config?.theme?.primary || '#FE4F70'} 0%, ${config?.theme?.accent || '#FFA387'} 100%)` }}
                                >
                                    Botões · Destaques · Categorias
                                </div>
                            </div>
                        )}
                        <div>
                            <label className={labelClass}>Combinação de Fontes</label>
                            <select value={config?.theme?.font || 'outfit'} onChange={e => setConfig({ ...config, theme: { ...config.theme, font: e.target.value } })} className={inputClass}>
                                <option value="inter">Inter & Roboto Mono (Moderno / Tech)</option>
                                <option value="outfit">Outfit & Inter (Clean / SaaS)</option>
                                <option value="roboto">Roboto & Open Sans (Corporativo / Neutro)</option>
                                <option value="poppins">Poppins & Lora (Criativo / Boutique)</option>
                                <option value="montserrat">Montserrat & Merriweather (Profissional / Textual)</option>
                                <option value="playfair">Playfair Display & Source Sans (Elegante / Editorial)</option>
                                <option value="lora">Lora & Merriweather (Revista / Narrativa)</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Prefixo da URL dos Posts */}
            <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-8 border-b border-slate-100 pb-4">Prefixo da URL dos Posts</h3>
                <div className="flex gap-2">
                    {[
                        { value: 'blog', label: '/blog/titulo-do-post', desc: 'Padrao' },
                        { value: '', label: '/titulo-do-post', desc: 'URL limpa (sem /blog)' },
                    ].map(opt => (
                        <label key={opt.value} className={`flex-1 p-3 border rounded-xl cursor-pointer transition-all text-center ${(config?.postUrlPrefix ?? 'blog') === opt.value ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:border-slate-300'}`}>
                            <input type="radio" name="postUrlPrefix" value={opt.value} checked={(config?.postUrlPrefix ?? 'blog') === opt.value} onChange={e => setConfig({ ...config, postUrlPrefix: e.target.value })} className="hidden" />
                            <p className="text-sm font-bold text-slate-800">{opt.label}</p>
                            <p className="text-xs text-slate-500">{opt.desc}</p>
                        </label>
                    ))}
                </div>
            </div>

            {/* Informações de Contato */}
            <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-8 border-b border-slate-100 pb-4">Informações de Contato</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* URL do site — nível raiz do siteConfig */}
                    <div>
                        <label className={labelClass}>URL do Site</label>
                        <input type="text" placeholder="https://seusite.com.br" value={config?.url || ''} onChange={e => setConfig({ ...config, url: e.target.value })} className={inputClass} />
                    </div>
                    {/* email, phone, address — dentro de contact{} */}
                    {[
                        { key: 'email',   label: 'E-mail',              placeholder: 'contato@seusite.com' },
                        { key: 'phone',   label: 'Telefone / WhatsApp', placeholder: '(11) 99999-9999' },
                        { key: 'address', label: 'Endereço',            placeholder: 'Rua X, 123 — Cidade/UF' },
                    ].map(f => (
                        <div key={f.key}>
                            <label className={labelClass}>{f.label}</label>
                            <input
                                type="text"
                                placeholder={f.placeholder}
                                value={config?.contact?.[f.key] || ''}
                                onChange={e => setConfig({ ...config, contact: { ...config.contact, [f.key]: e.target.value } })}
                                className={inputClass}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Redes Sociais */}
            <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-8 border-b border-slate-100 pb-4">Redes Sociais (Rodapé)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {['instagram', 'twitter', 'linkedin', 'github', 'youtube', 'facebook'].map(social => (
                        <div key={social}>
                            <label className={labelClass}>{social}</label>
                            <input type="url" placeholder={`https://${social}.com/seuperfil`} value={config?.social?.[social] || ''} onChange={e => setConfig({ ...config, social: { ...config.social, [social]: e.target.value } })} className={`${inputClass} font-mono`} />
                        </div>
                    ))}
                </div>
            </div>

            {/* Rodape (Footer) */}
            <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-8 border-b border-slate-100 pb-4">Rodape (Footer)</h3>
                <div className="space-y-4">
                    <div><label className={labelClass}>Descricao do Footer</label><textarea rows={3} placeholder="Texto que aparece no rodape do site" value={config?.footer?.description || ''} onChange={e => setConfig({ ...config, footer: { ...config.footer, description: e.target.value } })} className={`${inputClass} resize-y`} /></div>
                    <div><label className={labelClass}>Texto de Copyright</label><input type="text" placeholder="Nome da empresa ou site" value={config?.footer?.copyright || ''} onChange={e => setConfig({ ...config, footer: { ...config.footer, copyright: e.target.value } })} className={inputClass} /></div>
                </div>
            </div>

            {/* SEO Global */}
            <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-8 border-b border-slate-100 pb-4">SEO Global</h3>
                <div className="space-y-4">
                    <div><label className={labelClass}>Título Padrão (SEO)</label><input type="text" value={config?.seo?.title || ''} onChange={e => setConfig({ ...config, seo: { ...config.seo, title: e.target.value } })} className={inputClass} /></div>
                    <div><label className={labelClass}>Descrição Padrão</label><textarea rows={3} value={config?.seo?.description || ''} onChange={e => setConfig({ ...config, seo: { ...config.seo, description: e.target.value } })} className={`${inputClass} resize-y`} /></div>
                </div>
            </div>

            {/* IA / OpenAI */}
            <div id="ai" className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm scroll-mt-8">
                <h3 className="text-xl font-bold text-slate-900 mb-2 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-violet-600" /> Inteligência Artificial
                </h3>
                <p className="text-sm text-slate-500 mb-6 border-b border-slate-100 pb-4">Configure o OpenAI para gerar reviews automaticamente no editor.</p>
                <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
                        <strong>⚠️ Atenção:</strong> A chave fica salva em <code className="bg-amber-100 px-1 rounded">siteConfig.json</code> (commitada no GitHub). Para mais segurança, defina <code className="bg-amber-100 px-1 rounded">OPENAI_API_KEY</code> como variável de ambiente no Vercel — ela tem precedência sobre este campo.
                    </div>
                    <div>
                        <label className={labelClass}>OpenAI API Key</label>
                        <div className="relative">
                            <input
                                type={showApiKey ? 'text' : 'password'}
                                placeholder="sk-..."
                                value={config?.ai?.openaiKey || ''}
                                onChange={e => setConfig({ ...config, ai: { ...config.ai, openaiKey: e.target.value } })}
                                className={`${inputClass} pr-12 font-mono`}
                                autoComplete="off"
                            />
                            <button type="button" onClick={() => setShowApiKey(!showApiKey)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700">
                                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-1">Obtenha em <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener" className="text-violet-600 underline">platform.openai.com/api-keys</a></p>
                    </div>
                    <div>
                        <label className={labelClass}>Modelo</label>
                        <select
                            value={config?.ai?.model || 'gpt-4o-mini'}
                            onChange={e => setConfig({ ...config, ai: { ...config.ai, model: e.target.value } })}
                            className={inputClass}
                        >
                            <option value="gpt-4o-mini">gpt-4o-mini (rápido e barato — recomendado)</option>
                            <option value="gpt-4o">gpt-4o (melhor qualidade)</option>
                            <option value="gpt-4-turbo">gpt-4-turbo</option>
                            <option value="gpt-3.5-turbo">gpt-3.5-turbo (mais barato)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Sitemap */}
            <div className="p-8 bg-white border border-slate-200 rounded-2xl shadow-sm">
                <h3 className="text-xl font-bold text-slate-900 mb-8 border-b border-slate-100 pb-4">Sitemap</h3>
                <div className="space-y-4">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                        <p className="text-sm font-bold text-emerald-700 mb-1">Sitemap XML gerado automaticamente</p>
                        <p className="text-xs text-emerald-600 mb-3">O sitemap é atualizado a cada build/deploy com todas as páginas e posts do site.</p>
                        {config?.url ? (
                            <div className="space-y-2">
                                <a href={`${config.url.replace(/\/$/, '')}/sitemap-index.xml`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700 bg-white px-4 py-2 rounded-lg border border-emerald-200 hover:bg-emerald-100 transition-colors">
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    {config.url.replace(/\/$/, '')}/sitemap-index.xml
                                </a>
                                <p className="text-xs text-slate-500">Use esta URL no Google Search Console para enviar seu sitemap.</p>
                            </div>
                        ) : (
                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                <p className="text-xs text-amber-700 font-medium">Configure a URL do Site acima para ver o link do sitemap.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </form>
    );
}
