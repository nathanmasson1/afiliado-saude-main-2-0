/**
 * SettingsAdSense.tsx — Plugin Google AdSense
 *
 * Configura o Publisher ID do AdSense.
 * Salva em src/data/pluginsConfig.json via githubApi().
 */

import { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, CheckCircle, DollarSign } from 'lucide-react';
import { githubApi } from '../../lib/adminApi';
import { triggerToast } from '../../components/admin/CmsToaster';

const CONFIG_PATH = 'src/data/pluginsConfig.json';

export default function SettingsAdSense() {
  const [publisherId, setPublisherId] = useState('');
  const [fileSha, setFileSha] = useState('');
  const [fullConfig, setFullConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    githubApi('read', CONFIG_PATH)
      .then(data => {
        const config = JSON.parse(data.content);
        setFullConfig(config);
        setFileSha(data.sha);
        setPublisherId(config?.adsense?.publisherId || '');
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    setError('');
    triggerToast('Salvando configuração do AdSense...', 'progress', 30);
    try {
      const updated = {
        ...fullConfig,
        adsense: { publisherId: publisherId.trim() },
      };
      const res = await githubApi('write', CONFIG_PATH, {
        content: JSON.stringify(updated, null, 4),
        sha: fileSha,
        message: 'CMS: Update AdSense publisher ID',
      });
      setFileSha(res.sha || fileSha);
      setFullConfig(updated);
      setSaved(true);
      triggerToast('AdSense configurado!', 'success', 100);
      setTimeout(() => setSaved(false), 3000);
    } catch (err: any) {
      setError(err.message);
      triggerToast(`Erro: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const inputClass = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all shadow-sm font-mono';
  const labelClass = 'block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1';

  const isValid = publisherId.startsWith('ca-pub-');

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
      {/* Publisher ID */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-800 mb-1">Publisher ID</h3>
        <p className="text-sm text-slate-500 mb-4">
          Encontre seu Publisher ID no painel do AdSense em{' '}
          <span className="font-mono text-violet-600">Conta → Informações da conta</span>.
          O formato é <span className="font-mono font-bold">ca-pub-XXXXXXXXXXXXXXXX</span>.
        </p>
        <label className={labelClass}>Google AdSense Publisher ID</label>
        <input
          type="text"
          value={publisherId}
          onChange={e => setPublisherId(e.target.value)}
          placeholder="ca-pub-XXXXXXXXXXXXXXXX"
          className={inputClass}
        />
        {publisherId && !isValid && (
          <p className="text-xs text-amber-600 mt-2 ml-1">
            O Publisher ID deve começar com "ca-pub-".
          </p>
        )}
      </div>

      {/* Status */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">Status</span>
          {isValid ? (
            <span className="flex items-center gap-1.5 text-green-600 font-semibold">
              <CheckCircle className="w-4 h-4" /> Configurado
            </span>
          ) : (
            <span className="text-slate-400">{publisherId ? 'ID inválido' : 'Não configurado'}</span>
          )}
        </div>
        {isValid && (
          <div className="flex items-center justify-between text-sm mt-2">
            <span className="text-slate-500">ID ativo</span>
            <span className="font-mono font-bold text-slate-700">{publisherId}</span>
          </div>
        )}
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
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar Configuração'}
      </button>

      {/* Instructions */}
      <div className="bg-blue-50 rounded-2xl border border-blue-200 p-5">
        <p className="text-xs font-bold text-blue-700 uppercase tracking-widest mb-3">Como configurar</p>
        <ol className="space-y-2">
          {[
            'Acesse adsense.google.com e crie ou entre na sua conta',
            'No menu lateral, vá em Conta → Informações da conta',
            'Copie o Publisher ID (formato ca-pub-XXXXXXXXXXXXXXXX)',
            'Cole aqui e clique em "Salvar Configuração"',
            'O script AdSense auto-ads será inserido no <head> de todas as páginas',
            'O Google configurará automaticamente os locais dos anúncios',
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-blue-800">
              <span className="w-5 h-5 rounded-full bg-blue-200 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
