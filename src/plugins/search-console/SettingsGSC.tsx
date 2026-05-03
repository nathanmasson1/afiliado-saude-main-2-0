/**
 * SettingsGSC.tsx — Plugin Google Search Console (Walker)
 *
 * UI para configurar verificação de propriedade e service account.
 * Salva em src/data/pluginsConfig.json via githubApi().
 */

import { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, CheckCircle, Eye, EyeOff, ExternalLink } from 'lucide-react';
import { githubApi } from '../../lib/adminApi';
import { triggerToast } from '../../components/admin/CmsToaster';

const CONFIG_PATH = 'src/data/pluginsConfig.json';

export default function SettingsGSC() {
    const [verificationTag, setVerificationTag] = useState('');
    const [siteUrl, setSiteUrl] = useState('');
    const [serviceAccountJson, setServiceAccountJson] = useState('');
    const [showJson, setShowJson] = useState(false);
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
                const gsc = config?.searchConsole ?? {};
                setVerificationTag(gsc.verificationTag ?? '');
                setSiteUrl(gsc.siteUrl ?? '');
                setServiceAccountJson(gsc.serviceAccountJson ?? '');
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const handleSave = async () => {
        setSaving(true); setSaved(false); setError('');
        triggerToast('Salvando configurações do Search Console...', 'progress', 30);
        try {
            const updated = {
                ...fullConfig,
                searchConsole: {
                    verificationTag: verificationTag.trim(),
                    siteUrl: siteUrl.trim(),
                    serviceAccountJson: serviceAccountJson.trim(),
                },
            };
            const res = await githubApi('write', CONFIG_PATH, {
                content: JSON.stringify(updated, null, 4),
                sha: fileSha,
                message: 'CMS: Update Search Console settings',
            });
            setFileSha(res.sha ?? fileSha);
            setFullConfig(updated);
            setSaved(true);
            triggerToast('Search Console configurado!', 'success', 100);
            setTimeout(() => setSaved(false), 3000);
        } catch (err: any) {
            setError(err.message);
            triggerToast(`Erro: ${err.message}`, 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        if (!serviceAccountJson.trim()) {
            setTestResult({ ok: false, message: 'Cole o JSON do service account antes de testar.' });
            return;
        }
        if (!siteUrl.trim()) {
            setTestResult({ ok: false, message: 'Informe a URL do site.' });
            return;
        }
        setTesting(true); setTestResult(null);
        try {
            const res = await fetch('/api/admin/plugins/search-console/test-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ serviceAccountJson: serviceAccountJson.trim(), siteUrl: siteUrl.trim() }),
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

    const isConfigured = !!(siteUrl && serviceAccountJson);

    return (
        <div className="max-w-2xl space-y-6">

            {/* Aviso */}
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
                <span className="text-xl shrink-0">⚠️</span>
                <div>
                    <p className="font-bold text-amber-800 text-sm">Repositório Privado Obrigatório</p>
                    <p className="text-amber-700 text-xs mt-0.5 leading-relaxed">
                        O arquivo JSON do service account será salvo em <code className="bg-amber-100 px-1 rounded font-mono">pluginsConfig.json</code>.
                        Certifique-se de que o repositório é <strong>privado</strong> no GitHub.
                    </p>
                </div>
            </div>

            {/* Passo 1: Verificação */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                    <span className="w-6 h-6 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">1</span>
                    <h3 className="font-bold text-slate-800">Verificação de Propriedade</h3>
                </div>
                <p className="text-sm text-slate-500 mb-4 leading-relaxed">
                    No Search Console, vá em <strong>Configurações → Verificação de propriedade → Tag HTML</strong> e copie a tag <code className="bg-slate-100 px-1 rounded font-mono text-xs">&lt;meta name="google-site-verification" ...&gt;</code>.
                </p>
                <label className={labelClass}>Meta Tag de Verificação</label>
                <input
                    type="text"
                    value={verificationTag}
                    onChange={e => setVerificationTag(e.target.value)}
                    placeholder='<meta name="google-site-verification" content="XXXXX" />'
                    className={`${inputClass} font-mono text-xs`}
                />
                <p className="text-xs text-slate-400 mt-1 ml-1">Cole a tag inteira ou apenas o valor do atributo content.</p>
            </div>

            {/* Passo 2: URL do site */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center gap-2 mb-4">
                    <span className="w-6 h-6 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">2</span>
                    <h3 className="font-bold text-slate-800">URL da Propriedade</h3>
                </div>
                <label className={labelClass}>URL do Site no Search Console</label>
                <input
                    type="url"
                    value={siteUrl}
                    onChange={e => { setSiteUrl(e.target.value); setTestResult(null); }}
                    placeholder="https://seusite.com.br"
                    className={inputClass}
                />
                <p className="text-xs text-slate-400 mt-1 ml-1">
                    Deve ser exatamente como aparece no Search Console (com ou sem www, com ou sem barra final).
                </p>
            </div>

            {/* Passo 3: Service Account */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <span className="w-6 h-6 bg-violet-100 text-violet-700 rounded-full flex items-center justify-center text-xs font-bold shrink-0">3</span>
                        <h3 className="font-bold text-slate-800">Service Account (Google Cloud)</h3>
                    </div>
                    <a
                        href="https://console.cloud.google.com/iam-admin/serviceaccounts"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-violet-600 hover:underline"
                    >
                        Google Cloud Console <ExternalLink className="w-3 h-3" />
                    </a>
                </div>

                {/* Mini guia */}
                <div className="bg-slate-50 rounded-xl p-4 mb-4 text-xs text-slate-600 space-y-1.5 leading-relaxed">
                    <p className="font-semibold text-slate-700 mb-2">Como obter o JSON:</p>
                    <p>① No Google Cloud, crie um projeto (ou use um existente)</p>
                    <p>② Ative a API <strong>Google Search Console API</strong></p>
                    <p>③ Crie um Service Account → gere uma chave JSON → baixe o arquivo</p>
                    <p>④ No Search Console, adicione o e-mail do service account como usuário com permissão de <strong>leitura</strong></p>
                    <p>⑤ Cole o conteúdo do arquivo JSON no campo abaixo</p>
                </div>

                <div className="flex items-center justify-between mb-2">
                    <label className={labelClass}>JSON do Service Account</label>
                    <button
                        type="button"
                        onClick={() => setShowJson(v => !v)}
                        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
                    >
                        {showJson ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        {showJson ? 'Ocultar' : 'Mostrar'}
                    </button>
                </div>
                <textarea
                    rows={showJson ? 8 : 3}
                    value={serviceAccountJson}
                    onChange={e => { setServiceAccountJson(e.target.value); setTestResult(null); }}
                    placeholder={'{\n  "type": "service_account",\n  "project_id": "...",\n  "private_key": "...",\n  "client_email": "..."\n}'}
                    className={`${inputClass} font-mono text-xs resize-none`}
                    style={{ filter: showJson ? 'none' : 'blur(3px)' }}
                />
                {serviceAccountJson && (
                    <p className="text-xs text-slate-400 mt-1 ml-1">{serviceAccountJson.length} caracteres</p>
                )}
            </div>

            {/* Resultado do teste */}
            {testResult && (
                <div className={`p-4 rounded-xl border flex items-start gap-3 text-sm ${testResult.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {testResult.ok
                        ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                    {testResult.message}
                </div>
            )}

            {error && (
                <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium rounded-r-xl flex gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                </div>
            )}

            {/* Status */}
            <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Status atual</p>
                <div className="space-y-2 text-sm">
                    {[
                        { label: 'Verificação', value: verificationTag ? '● Configurada' : '○ Não configurada', ok: !!verificationTag },
                        { label: 'URL do site', value: siteUrl || '○ Não informada', ok: !!siteUrl },
                        { label: 'Service Account', value: serviceAccountJson ? '● JSON carregado' : '○ Não configurado', ok: !!serviceAccountJson },
                    ].map(row => (
                        <div key={row.label} className="flex justify-between">
                            <span className="text-slate-500">{row.label}</span>
                            <span className={row.ok ? 'text-green-600 font-semibold' : 'text-red-500 font-semibold'}>{row.value}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3">
                <button
                    type="button"
                    onClick={handleTest}
                    disabled={testing || !serviceAccountJson.trim() || !siteUrl.trim()}
                    className="px-5 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : '🔌'}
                    {testing ? 'Testando...' : 'Testar Conexão'}
                </button>
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
        </div>
    );
}
