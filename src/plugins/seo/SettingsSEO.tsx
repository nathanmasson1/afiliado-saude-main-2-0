/**
 * SettingsSEO.tsx — Plugin SEO Toolkit
 *
 * Configura dados da organização e schemas JSON-LD.
 * Salva em src/data/pluginsConfig.json via githubApi().
 */

import { useState, useEffect } from 'react';
import { Save, Loader2, AlertCircle, Plus, Trash2 } from 'lucide-react';
import { githubApi } from '../../lib/adminApi';
import { triggerToast } from '../../components/admin/CmsToaster';

const CONFIG_PATH = 'src/data/pluginsConfig.json';

export default function SettingsSEO() {
  const [enabled, setEnabled] = useState(true);
  const [orgName, setOrgName] = useState('');
  const [orgLogo, setOrgLogo] = useState('');
  const [sameAs, setSameAs] = useState<string[]>(['']);
  const [articleSchema, setArticleSchema] = useState(true);
  const [breadcrumbSchema, setBreadcrumbSchema] = useState(true);
  const [websiteSchema, setWebsiteSchema] = useState(true);
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
        const sc = config?.seo;
        if (sc) {
          setEnabled(sc.enabled !== false);
          setOrgName(sc.orgName || '');
          setOrgLogo(sc.orgLogo || '');
          setSameAs(sc.sameAs?.length ? sc.sameAs : ['']);
          setArticleSchema(sc.articleSchema !== false);
          setBreadcrumbSchema(sc.breadcrumbSchema !== false);
          setWebsiteSchema(sc.websiteSchema !== false);
        }
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const addSameAs = () => setSameAs(prev => [...prev, '']);
  const removeSameAs = (i: number) => setSameAs(prev => prev.filter((_, idx) => idx !== i));
  const updateSameAs = (i: number, val: string) => setSameAs(prev => prev.map((v, idx) => idx === i ? val : v));

  const handleSave = async () => {
    setSaving(true);
    setError('');
    triggerToast('Salvando configuração de SEO...', 'progress', 30);
    try {
      const cleanSameAs = sameAs.filter(s => s.trim());
      const updated = {
        ...fullConfig,
        seo: { enabled, orgName, orgLogo, sameAs: cleanSameAs, articleSchema, breadcrumbSchema, websiteSchema },
      };
      const res = await githubApi('write', CONFIG_PATH, {
        content: JSON.stringify(updated, null, 4),
        sha: fileSha,
        message: 'CMS: Update SEO settings',
      });
      setFileSha(res.sha || fileSha);
      setFullConfig(updated);
      triggerToast('SEO Toolkit configurado!', 'success', 100);
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
      {/* Enable */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <label className="flex items-center justify-between cursor-pointer">
          <div>
            <h3 className="font-bold text-slate-800">Ativar SEO Toolkit</h3>
            <p className="text-sm text-slate-500 mt-0.5">Injeta JSON-LD structured data nos artigos</p>
          </div>
          <div
            onClick={() => setEnabled(!enabled)}
            className={`relative w-12 h-6 rounded-full transition-colors cursor-pointer ${enabled ? 'bg-violet-600' : 'bg-slate-200'}`}
          >
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${enabled ? 'left-7' : 'left-1'}`} />
          </div>
        </label>
      </div>

      {/* Organization */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
        <h3 className="font-bold text-slate-800">Dados da Organização</h3>
        <p className="text-sm text-slate-500 -mt-2">Usados nos schemas Publisher e WebSite</p>

        <div>
          <label className={labelClass}>Nome da Organização / Site</label>
          <input type="text" value={orgName} onChange={e => setOrgName(e.target.value)} className={inputClass} placeholder="Meu Blog" />
        </div>

        <div>
          <label className={labelClass}>URL do Logo</label>
          <input type="text" value={orgLogo} onChange={e => setOrgLogo(e.target.value)} className={inputClass} placeholder="https://meusite.com/logo.png ou /logo.png" />
        </div>

        <div>
          <label className={labelClass}>Perfis Sociais (sameAs)</label>
          <p className="text-xs text-slate-400 mb-3">URLs dos perfis sociais da organização</p>
          <div className="space-y-2">
            {sameAs.map((url, i) => (
              <div key={i} className="flex gap-2">
                <input
                  type="url"
                  value={url}
                  onChange={e => updateSameAs(i, e.target.value)}
                  className={inputClass}
                  placeholder="https://facebook.com/seuperfil"
                />
                {sameAs.length > 1 && (
                  <button onClick={() => removeSameAs(i)} className="p-3 text-red-500 hover:bg-red-50 rounded-xl transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button onClick={addSameAs} className="mt-2 flex items-center gap-2 text-sm text-violet-600 hover:text-violet-700 font-medium">
            <Plus className="w-4 h-4" /> Adicionar perfil
          </button>
        </div>
      </div>

      {/* Schema toggles */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h3 className="font-bold text-slate-800 mb-4">Tipos de Schema</h3>
        <div className="space-y-3">
          {[
            { label: 'Article Schema', desc: 'Dados do artigo, autor e editor', val: articleSchema, set: setArticleSchema },
            { label: 'BreadcrumbList Schema', desc: 'Trilha de navegação (Home > Categoria > Post)', val: breadcrumbSchema, set: setBreadcrumbSchema },
            { label: 'WebSite Schema', desc: 'Dados do site com SearchAction', val: websiteSchema, set: setWebsiteSchema },
          ].map(({ label, desc, val, set }) => (
            <label key={label} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 cursor-pointer hover:bg-violet-50 transition-colors">
              <div>
                <p className="text-sm font-semibold text-slate-800">{label}</p>
                <p className="text-xs text-slate-500">{desc}</p>
              </div>
              <input type="checkbox" checked={val} onChange={e => set(e.target.checked)} className="rounded border-slate-300 text-violet-600 focus:ring-violet-500 w-4 h-4" />
            </label>
          ))}
        </div>
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
