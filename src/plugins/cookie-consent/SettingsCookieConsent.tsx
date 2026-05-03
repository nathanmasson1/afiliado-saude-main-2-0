/**
 * SettingsCookieConsent.tsx — Plugin Cookie Consent / LGPD
 *
 * Configura o banner de consentimento de cookies.
 * Salva em src/data/pluginsConfig.json via githubApi().
 */

import { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, CheckCircle, Shield } from 'lucide-react';
import { githubApi } from '../../lib/adminApi';
import { triggerToast } from '../../components/admin/CmsToaster';

const CONFIG_PATH = 'src/data/pluginsConfig.json';

export default function SettingsCookieConsent() {
  const [enabled, setEnabled] = useState(true);
  const [headline, setHeadline] = useState('Privacidade e Cookies');
  const [description, setDescription] = useState('Utilizamos cookies para melhorar sua experiência. Ao clicar em "Aceitar", você concorda com nossa política de privacidade.');
  const [buttonAccept, setButtonAccept] = useState('Aceitar');
  const [buttonReject, setButtonReject] = useState('Ler Política');
  const [rejectUrl, setRejectUrl] = useState('/privacidade');
  const [position, setPosition] = useState<'bottom' | 'top'>('bottom');
  const [fileSha, setFileSha] = useState('');
  const [fullConfig, setFullConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    githubApi('read', CONFIG_PATH)
      .then(data => {
        const config = JSON.parse(data.content);
        setFullConfig(config);
        setFileSha(data.sha);
        const cc = config?.cookieConsent;
        if (cc) {
          setEnabled(cc.enabled !== false);
          setHeadline(cc.headline || 'Privacidade e Cookies');
          setDescription(cc.description || 'Utilizamos cookies para melhorar sua experiência. Ao clicar em "Aceitar", você concorda com nossa política de privacidade.');
          setButtonAccept(cc.buttonAccept || 'Aceitar');
          setButtonReject(cc.buttonReject || 'Ler Política');
          setRejectUrl(cc.rejectUrl || '/privacidade');
          setPosition(cc.position || 'bottom');
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    triggerToast('Salvando configuração de cookies...', 'progress', 30);
    try {
      const updated = {
        ...fullConfig,
        cookieConsent: { enabled, headline, description, buttonAccept, buttonReject, rejectUrl, position },
      };
      const res = await githubApi('write', CONFIG_PATH, {
        content: JSON.stringify(updated, null, 4),
        sha: fileSha,
        message: 'CMS: Update Cookie Consent settings',
      });
      setFileSha(res.sha || fileSha);
      setFullConfig(updated);
      triggerToast('Cookie Consent configurado!', 'success', 100);
    } catch (err: any) {
      setError(err.message);
      triggerToast(`Erro: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all shadow-sm';
  const labelClass = 'block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1';

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white rounded-3xl border border-slate-200">
      <Loader2 className="w-8 h-8 animate-spin mb-4 text-violet-500" />
      <p className="font-medium animate-pulse">Carregando configuração...</p>
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
      {/* Enable toggle */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <h3 className="font-bold text-slate-800">Ativar Banner de Cookies</h3>
            <p className="text-sm text-slate-500 mt-0.5">Exibe o aviso de cookies para novos visitantes (LGPD)</p>
          </div>
          <div
            onClick={() => setEnabled(!enabled)}
            className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${enabled ? 'bg-violet-600' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${enabled ? 'left-7' : 'left-1'}`} />
          </div>
        </label>
      </div>

      {/* Texts */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-slate-800">Textos do Banner</h3>

        <div>
          <label className={labelClass}>Título</label>
          <input type="text" value={headline} onChange={e => setHeadline(e.target.value)} className={inputClass} placeholder="Privacidade e Cookies" />
        </div>

        <div>
          <label className={labelClass}>Descrição</label>
          <textarea rows={3} value={description} onChange={e => setDescription(e.target.value)} className={`${inputClass} resize-none`} placeholder="Utilizamos cookies..." />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Botão Aceitar</label>
            <input type="text" value={buttonAccept} onChange={e => setButtonAccept(e.target.value)} className={inputClass} placeholder="Aceitar" />
          </div>
          <div>
            <label className={labelClass}>Botão Recusar/Política</label>
            <input type="text" value={buttonReject} onChange={e => setButtonReject(e.target.value)} className={inputClass} placeholder="Ler Política" />
          </div>
        </div>

        <div>
          <label className={labelClass}>URL do Botão Recusar</label>
          <input type="text" value={rejectUrl} onChange={e => setRejectUrl(e.target.value)} className={inputClass} placeholder="/privacidade" />
        </div>
      </div>

      {/* Position */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-800 mb-4">Posição do Banner</h3>
        <div className="flex gap-3">
          {(['bottom', 'top'] as const).map(pos => (
            <label key={pos} className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-xl border cursor-pointer transition-all ${position === pos ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              <input type="radio" name="position" value={pos} checked={position === pos} onChange={() => setPosition(pos)} className="sr-only" />
              <span className="text-sm font-semibold capitalize">{pos === 'bottom' ? 'Rodapé' : 'Topo'}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5">
        <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-2">Integração automática</p>
        <p className="text-sm text-blue-800">
          Quando ativado, o Google Analytics e Meta Pixel são bloqueados até o visitante aceitar os cookies.
          Isso garante conformidade com a LGPD.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium rounded-r-xl flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      <button
        onClick={handleSave}
        disabled={saving}
        className="bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-sm shadow-violet-600/20"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {saving ? 'Salvando...' : 'Salvar Configuração'}
      </button>
    </div>
  );
}
