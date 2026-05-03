/**
 * SettingsEmailList.tsx — Configurações do plugin Email List
 *
 * Segue o padrão do SettingsGSC.tsx:
 * - Lê/escreve pluginsConfig.json via githubApi
 * - SHA tracking para evitar conflitos
 * - Toast notifications
 */

import { useState, useEffect } from 'react';
import {
    Save, Loader2, AlertCircle, CheckCircle, Eye, EyeOff,
    Mail, Clock, ArrowDown, ToggleLeft, ToggleRight, PanelRight, FileText
} from 'lucide-react';
import { githubApi } from '../../lib/adminApi';
import { triggerToast } from '../../components/admin/CmsToaster';

const CONFIG_PATH = 'src/data/pluginsConfig.json';

export default function SettingsEmailList() {
    const [brevoApiKey, setBrevoApiKey] = useState('');
    const [brevoListId, setBrevoListId] = useState('');
    const [popupEnabled, setPopupEnabled] = useState(false);
    const [headline, setHeadline] = useState('Não perca nenhum artigo!');
    const [subheadline, setSubheadline] = useState('Receba os melhores conteúdos direto no seu e-mail.');
    const [triggerType, setTriggerType] = useState<'delay' | 'scroll'>('delay');
    const [triggerValue, setTriggerValue] = useState(5);
    const [showOnce, setShowOnce] = useState(true);

    const [sidebarEnabled, setSidebarEnabled] = useState(true);
    const [sidebarHeadline, setSidebarHeadline] = useState('Newsletter');
    const [sidebarSubheadline, setSidebarSubheadline] = useState('Junte-se a nossos leitores!');
    const [inlineEnabled, setInlineEnabled] = useState(false);
    const [inlineHeadline, setInlineHeadline] = useState('Gostando do conteúdo?');
    const [inlineSubheadline, setInlineSubheadline] = useState('Receba artigos como este direto no seu e-mail.');
    const [inlinePosition, setInlinePosition] = useState(3);

    const [showApiKey, setShowApiKey] = useState(false);
    const [fileSha, setFileSha] = useState('');
    const [fullConfig, setFullConfig] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        githubApi('read', CONFIG_PATH)
            .then(data => {
                const config = JSON.parse(data.content);
                setFullConfig(config);
                setFileSha(data.sha);
                const el = config?.emailList ?? {};
                setBrevoApiKey(el.brevoApiKey ?? '');
                setBrevoListId(el.brevoListId ?? '');
                const popup = el.popup ?? {};
                setPopupEnabled(popup.enabled ?? false);
                setHeadline(popup.headline ?? 'Não perca nenhum artigo!');
                setSubheadline(popup.subheadline ?? 'Receba os melhores conteúdos direto no seu e-mail.');
                setTriggerType(popup.triggerType ?? 'delay');
                setTriggerValue(popup.triggerValue ?? 5);
                setShowOnce(popup.showOnce !== false);
                const sidebar = el.sidebar ?? {};
                setSidebarEnabled(sidebar.enabled !== false);
                setSidebarHeadline(sidebar.headline ?? 'Newsletter');
                setSidebarSubheadline(sidebar.subheadline ?? 'Junte-se a nossos leitores!');
                const inline = el.inline ?? {};
                setInlineEnabled(inline.enabled ?? false);
                setInlineHeadline(inline.headline ?? 'Gostando do conteúdo?');
                setInlineSubheadline(inline.subheadline ?? 'Receba artigos como este direto no seu e-mail.');
                setInlinePosition(inline.position ?? 3);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true); setSaved(false); setError('');
        triggerToast('Salvando configurações...', 'progress', 30);
        try {
            const updated = {
                ...fullConfig,
                emailList: {
                    brevoApiKey: brevoApiKey.trim(),
                    brevoListId: brevoListId.trim(),
                    popup: {
                        enabled: popupEnabled,
                        headline: headline.trim(),
                        subheadline: subheadline.trim(),
                        triggerType,
                        triggerValue: Number(triggerValue),
                        showOnce,
                    },
                    sidebar: {
                        enabled: sidebarEnabled,
                        headline: sidebarHeadline.trim(),
                        subheadline: sidebarSubheadline.trim(),
                    },
                    inline: {
                        enabled: inlineEnabled,
                        headline: inlineHeadline.trim(),
                        subheadline: inlineSubheadline.trim(),
                        position: Number(inlinePosition),
                    },
                    sequences: fullConfig?.emailList?.sequences ?? [],
                },
            };
            const res = await githubApi('write', CONFIG_PATH, {
                content: JSON.stringify(updated, null, 4),
                sha: fileSha,
                message: 'CMS: Update Email List settings',
            });
            setFileSha(res.sha ?? fileSha);
            setFullConfig(updated);
            setSaved(true);
            triggerToast('Configurações salvas!', 'success', 100);
            setTimeout(() => setSaved(false), 3000);
        } catch (err: any) {
            setError(err.message);
            triggerToast(`Erro: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleTestBrevo = async () => {
        if (!brevoApiKey.trim()) {
            setTestResult({ ok: false, message: 'Informe a API Key do Brevo antes de testar.' });
            return;
        }
        setTesting(true); setTestResult(null);
        try {
            const res = await fetch('/api/admin/plugins/email-list/test-brevo', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ apiKey: brevoApiKey.trim() }),
            });
            const data = await res.json();
            setTestResult({ ok: data.success, message: data.message });
        } catch {
            setTestResult({ ok: false, message: 'Erro de rede — verifique se o servidor está rodando.' });
        } finally {
            setTesting(false);
        }
    };

    const inputClass = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all shadow-sm';
    const labelClass = 'block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1';

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white rounded-3xl border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-violet-500" />
            <p className="font-medium animate-pulse">Carregando configurações...</p>
        </div>
    );

    if (error && !fullConfig) return (
        <div className="bg-red-50 text-red-700 p-8 rounded-3xl border border-red-200 flex gap-4 items-start">
            <AlertCircle className="w-8 h-8 shrink-0" />
            <div><h3 className="text-xl font-bold mb-2">Erro de Leitura</h3><p>{error}</p></div>
        </div>
    );

    return (
        <div className="max-w-2xl space-y-6">

            {/* Brevo */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-5">
                    <Mail className="w-5 h-5 text-violet-600" />
                    <h3 className="font-bold text-slate-800">Integração Brevo</h3>
                </div>

                <div className="space-y-4">
                    {/* API Key */}
                    <div>
                        <label className={labelClass}>API Key</label>
                        <div className="relative">
                            <input
                                type={showApiKey ? 'text' : 'password'}
                                value={brevoApiKey}
                                onChange={e => { setBrevoApiKey(e.target.value); setTestResult(null); }}
                                placeholder="xkeysib-..."
                                className={`${inputClass} pr-10 font-mono text-xs`}
                            />
                            <button
                                type="button"
                                onClick={() => setShowApiKey(v => !v)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 ml-1">
                            Encontre em Brevo → Configurações → API Keys.
                        </p>
                    </div>

                    {/* List ID */}
                    <div>
                        <label className={labelClass}>ID da Lista</label>
                        <input
                            type="text"
                            value={brevoListId}
                            onChange={e => setBrevoListId(e.target.value)}
                            placeholder="Ex: 3"
                            className={inputClass}
                        />
                        <p className="text-xs text-slate-400 mt-1 ml-1">
                            Encontre em Brevo → Contatos → Listas → ID da lista.
                        </p>
                    </div>
                </div>

                {/* Resultado do teste */}
                {testResult && (
                    <div className={`mt-4 p-3 rounded-xl border flex items-start gap-3 text-sm ${testResult.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                        {testResult.ok
                            ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                        {testResult.message}
                    </div>
                )}

                <button
                    type="button"
                    onClick={handleTestBrevo}
                    disabled={testing || !brevoApiKey.trim()}
                    className="mt-4 flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : '🔌'}
                    {testing ? 'Testando...' : 'Testar Conexão'}
                </button>
            </div>

            {/* Popup config */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="font-bold text-slate-800">Popup de Captura</h3>
                    <button
                        type="button"
                        onClick={() => setPopupEnabled(v => !v)}
                        className="flex items-center gap-2 text-sm font-semibold transition-colors"
                    >
                        {popupEnabled
                            ? <><ToggleRight className="w-8 h-8 text-violet-600" /><span className="text-violet-700">Ativo</span></>
                            : <><ToggleLeft className="w-8 h-8 text-slate-400" /><span className="text-slate-500">Inativo</span></>
                        }
                    </button>
                </div>

                <div className={`space-y-4 transition-opacity ${popupEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <div>
                        <label className={labelClass}>Título</label>
                        <input
                            type="text"
                            value={headline}
                            onChange={e => setHeadline(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Subtítulo</label>
                        <input
                            type="text"
                            value={subheadline}
                            onChange={e => setSubheadline(e.target.value)}
                            className={inputClass}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelClass}>Tipo de Trigger</label>
                            <select
                                value={triggerType}
                                onChange={e => setTriggerType(e.target.value as 'delay' | 'scroll')}
                                className={inputClass}
                            >
                                <option value="delay">Após X segundos</option>
                                <option value="scroll">Ao rolar X%</option>
                            </select>
                        </div>
                        <div>
                            <label className={labelClass}>
                                {triggerType === 'delay' ? 'Segundos' : 'Porcentagem'}
                            </label>
                            <div className="relative">
                                {triggerType === 'delay'
                                    ? <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    : <ArrowDown className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                }
                                <input
                                    type="number"
                                    min={1}
                                    max={triggerType === 'scroll' ? 100 : 300}
                                    value={triggerValue}
                                    onChange={e => setTriggerValue(Number(e.target.value))}
                                    className={`${inputClass} pl-9`}
                                />
                            </div>
                        </div>
                    </div>

                    <label className="flex items-center gap-3 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={showOnce}
                            onChange={e => setShowOnce(e.target.checked)}
                            className="w-4 h-4 accent-violet-600 rounded"
                        />
                        <span className="text-sm font-medium text-slate-700">
                            Mostrar apenas uma vez por visitante
                        </span>
                    </label>
                </div>

                {/* Preview do popup */}
                {popupEnabled && (
                    <div className="mt-5 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Preview</p>
                        <div className="bg-white rounded-xl p-5 shadow-sm max-w-xs mx-auto text-center border border-slate-100">
                            <div style={{ width: 40, height: 40, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                                <Mail className="w-5 h-5 text-white" />
                            </div>
                            <p className="font-bold text-slate-800 text-sm mb-1">{headline || '...'}</p>
                            <p className="text-slate-500 text-xs leading-relaxed mb-3">{subheadline || '...'}</p>
                            <div className="space-y-2">
                                <div className="w-full h-9 bg-slate-100 rounded-lg" />
                                <div className="w-full h-9 rounded-lg" style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }} />
                            </div>
                            <p className="text-xs text-slate-400 mt-2">
                                {triggerType === 'delay' ? `Aparece após ${triggerValue}s` : `Aparece ao rolar ${triggerValue}%`}
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Sidebar widget config */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <PanelRight className="w-5 h-5 text-violet-600" />
                        <h3 className="font-bold text-slate-800">Widget da Sidebar</h3>
                    </div>
                    <button
                        type="button"
                        onClick={() => setSidebarEnabled(v => !v)}
                        className="flex items-center gap-2 text-sm font-semibold transition-colors"
                    >
                        {sidebarEnabled
                            ? <><ToggleRight className="w-8 h-8 text-violet-600" /><span className="text-violet-700">Ativo</span></>
                            : <><ToggleLeft className="w-8 h-8 text-slate-400" /><span className="text-slate-500">Inativo</span></>
                        }
                    </button>
                </div>

                <div className={`space-y-4 transition-opacity ${sidebarEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <div>
                        <label className={labelClass}>Título</label>
                        <input
                            type="text"
                            value={sidebarHeadline}
                            onChange={e => setSidebarHeadline(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Subtítulo</label>
                        <input
                            type="text"
                            value={sidebarSubheadline}
                            onChange={e => setSidebarSubheadline(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                </div>

                {sidebarEnabled && (
                    <div className="mt-5 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Preview</p>
                        <div className="bg-white rounded-xl p-4 shadow-sm max-w-xs mx-auto text-center border border-slate-100">
                            <p className="font-bold text-slate-800 text-sm mb-1">{sidebarHeadline || '...'}</p>
                            <p className="text-slate-500 text-xs mb-3">{sidebarSubheadline || '...'}</p>
                            <div className="space-y-2">
                                <div className="w-full h-8 bg-slate-100 rounded-lg" />
                                <div className="w-full h-8 rounded-lg" style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Inline banner config */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-5">
                    <div className="flex items-center gap-2">
                        <FileText className="w-5 h-5 text-violet-600" />
                        <h3 className="font-bold text-slate-800">Banner Inline nos Posts</h3>
                    </div>
                    <button
                        type="button"
                        onClick={() => setInlineEnabled(v => !v)}
                        className="flex items-center gap-2 text-sm font-semibold transition-colors"
                    >
                        {inlineEnabled
                            ? <><ToggleRight className="w-8 h-8 text-violet-600" /><span className="text-violet-700">Ativo</span></>
                            : <><ToggleLeft className="w-8 h-8 text-slate-400" /><span className="text-slate-500">Inativo</span></>
                        }
                    </button>
                </div>

                <div className={`space-y-4 transition-opacity ${inlineEnabled ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
                    <div>
                        <label className={labelClass}>Título</label>
                        <input
                            type="text"
                            value={inlineHeadline}
                            onChange={e => setInlineHeadline(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Subtítulo</label>
                        <input
                            type="text"
                            value={inlineSubheadline}
                            onChange={e => setInlineSubheadline(e.target.value)}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className={labelClass}>Inserir após o parágrafo nº</label>
                        <input
                            type="number"
                            min={1}
                            max={20}
                            value={inlinePosition}
                            onChange={e => setInlinePosition(Number(e.target.value))}
                            className={inputClass}
                        />
                        <p className="text-xs text-slate-400 mt-1 ml-1">
                            O banner aparecerá após o {inlinePosition}º parágrafo do post.
                        </p>
                    </div>
                </div>

                {inlineEnabled && (
                    <div className="mt-5 p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Preview</p>
                        <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 flex items-center gap-3">
                            <div style={{ flexShrink: 0, width: 36, height: 36, background: 'linear-gradient(135deg,#7c3aed,#a855f7)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Mail className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-bold text-slate-800 text-sm truncate">{inlineHeadline || '...'}</p>
                                <p className="text-violet-700 text-xs truncate">{inlineSubheadline || '...'}</p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <div className="h-8 w-28 bg-white border border-violet-200 rounded-lg" />
                                <div className="h-8 w-20 rounded-lg" style={{ background: 'linear-gradient(135deg,#7c3aed,#a855f7)' }} />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {error && (
                <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium rounded-r-xl flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
            )}

            {/* Salvar */}
            <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm shadow-violet-600/20"
            >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Configurações'}
            </button>
        </div>
    );
}
