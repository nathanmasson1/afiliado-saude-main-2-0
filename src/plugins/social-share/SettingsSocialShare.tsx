/**
 * SettingsSocialShare.tsx — Plugin Social Share
 *
 * Configura plataformas de compartilhamento e estilo.
 * Salva em src/data/pluginsConfig.json via githubApi().
 */

import { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, CheckCircle, Share2 } from 'lucide-react';
import { githubApi } from '../../lib/adminApi';
import { triggerToast } from '../../components/admin/CmsToaster';

const CONFIG_PATH = 'src/data/pluginsConfig.json';

const PLATFORMS = [
  { id: 'facebook',  label: 'Facebook',  icon: '📘' },
  { id: 'twitter',   label: 'Twitter/X', icon: '🐦' },
  { id: 'whatsapp',  label: 'WhatsApp',  icon: '💬' },
  { id: 'linkedin',  label: 'LinkedIn',  icon: '💼' },
  { id: 'telegram',  label: 'Telegram',  icon: '✈️' },
  { id: 'pinterest', label: 'Pinterest', icon: '📌' },
  { id: 'copy',      label: 'Copiar Link', icon: '🔗' },
];

const STYLES = [
  { id: 'icon',  label: 'Apenas ícones' },
  { id: 'label', label: 'Apenas texto' },
  { id: 'both',  label: 'Ícone + texto' },
];

export default function SettingsSocialShare() {
  const [enabled, setEnabled] = useState(true);
  const [sectionTitle, setSectionTitle] = useState('Compartilhe nas redes sociais');
  const [platforms, setPlatforms] = useState<string[]>(['facebook', 'twitter', 'whatsapp', 'linkedin', 'telegram', 'copy']);
  const [style, setStyle] = useState('icon');
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
        const sc = config?.socialShare;
        if (sc) {
          setEnabled(sc.enabled !== false);
          setSectionTitle(sc.sectionTitle ?? 'Compartilhe nas redes sociais');
          setPlatforms(sc.platforms || ['facebook', 'twitter', 'whatsapp', 'linkedin', 'telegram', 'copy']);
          setStyle(sc.style || 'icon');
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const togglePlatform = (id: string) => {
    setPlatforms(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    triggerToast('Salvando configuração de compartilhamento...', 'progress', 30);
    try {
      const updated = {
        ...fullConfig,
        socialShare: { enabled, sectionTitle, platforms, style },
      };
      const res = await githubApi('write', CONFIG_PATH, {
        content: JSON.stringify(updated, null, 4),
        sha: fileSha,
        message: 'CMS: Update Social Share settings',
      });
      setFileSha(res.sha || fileSha);
      setFullConfig(updated);
      triggerToast('Compartilhamento configurado!', 'success', 100);
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
            <h3 className="font-bold text-slate-800">Ativar Compartilhamento</h3>
            <p className="text-sm text-slate-500 mt-0.5">Exibe botões de share nos artigos</p>
          </div>
          <div
            onClick={() => setEnabled(!enabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-violet-600' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${enabled ? 'left-7' : 'left-1'}`} />
          </div>
        </label>
      </div>

      {/* Section title */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-800 mb-1">Título da Seção</h3>
        <p className="text-sm text-slate-500 mb-4">Texto exibido acima dos botões de compartilhamento nos artigos</p>
        <input
          type="text"
          value={sectionTitle}
          onChange={e => setSectionTitle(e.target.value)}
          placeholder="Compartilhe nas redes sociais"
          className={inputClass}
        />
        {sectionTitle && (
          <p className="text-xs text-slate-400 mt-2 ml-1">
            Preview: <span className="font-bold uppercase tracking-widest text-slate-500" style={{ fontSize: '0.7rem' }}>{sectionTitle}</span>
          </p>
        )}
      </div>

      {/* Platforms */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-800 mb-1">Plataformas</h3>
        <p className="text-sm text-slate-500 mb-4">Selecione quais redes exibir nos artigos</p>
        <div className="grid grid-cols-2 gap-2">
          {PLATFORMS.map(p => (
            <label key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${platforms.includes(p.id) ? 'border-violet-300 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input
                type="checkbox"
                checked={platforms.includes(p.id)}
                onChange={() => togglePlatform(p.id)}
                className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <span className="text-lg">{p.icon}</span>
              <span className="text-sm font-medium text-slate-700">{p.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Style */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-800 mb-1">Estilo dos Botões</h3>
        <p className="text-sm text-slate-500 mb-4">Como os botões aparecem nos artigos</p>
        <label className={labelClass}>Estilo</label>
        <select value={style} onChange={e => setStyle(e.target.value)} className={inputClass}>
          {STYLES.map(s => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
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
