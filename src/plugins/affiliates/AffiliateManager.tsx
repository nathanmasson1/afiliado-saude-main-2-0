/**
 * AffiliateManager.tsx — Plugin Amazon Affiliates Manager
 *
 * CRUD de produtos afiliados + configurações do plugin.
 * Salva em src/data/affiliateProducts.json e src/data/pluginsConfig.json via githubApi().
 */

import { useState, useEffect } from 'react';
import {
  Save, Loader2, AlertCircle, Plus, Trash2, Edit2,
  ToggleLeft, ToggleRight, ShoppingCart, Copy, Settings, Package,
} from 'lucide-react';
import { githubApi } from '../../lib/adminApi';
import { triggerToast } from '../../components/admin/CmsToaster';

const PRODUCTS_PATH = 'src/data/affiliateProducts.json';
const CONFIG_PATH = 'src/data/pluginsConfig.json';

interface ExtraLink {
  label: string;
  url: string;
}

interface Product {
  id: string;
  slug: string;
  title: string;
  description: string;
  image: string;
  amazonUrl: string;
  extraLinks: ExtraLink[];
  price: string;
  originalPrice: string;
  rating: number;
  pros: string[];
  cons: string[];
  badge: string;
  buttonText: string;
  enabled: boolean;
}

interface AffiliateConfig {
  enabled: boolean;
  amazonTag: string;
  defaultButtonText: string;
  buttonColor: string;
  showPrices: boolean;
  showRatings: boolean;
  showProscons: boolean;
  showBadges: boolean;
  disclaimer: string;
  showDisclaimer: boolean;
}

const defaultConfig: AffiliateConfig = {
  enabled: true,
  amazonTag: '',
  defaultButtonText: 'Ver na Amazon',
  buttonColor: '#FF9900',
  showPrices: true,
  showRatings: true,
  showProscons: true,
  showBadges: true,
  disclaimer: 'Este artigo contém links de afiliado. Podemos receber uma comissão por compras feitas através deles.',
  showDisclaimer: true,
};

const emptyProduct = (): Omit<Product, 'id'> => ({
  slug: '',
  title: '',
  description: '',
  image: '',
  amazonUrl: '',
  extraLinks: [],
  price: '',
  originalPrice: '',
  rating: 4.5,
  pros: [],
  cons: [],
  badge: '',
  buttonText: '',
  enabled: true,
});

const BADGE_OPTIONS = ['', 'Melhor Escolha', 'Mais Vendido', 'Melhor Custo-Benefício', 'Recomendado', 'Editor\'s Choice', 'Premium', 'Orçamento'];

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

const inputClass = 'w-full bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all shadow-sm';
const labelClass = 'block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 ml-1';

export default function AffiliateManager() {
  const [tab, setTab] = useState<'products' | 'settings'>('products');
  const [products, setProducts] = useState<Product[]>([]);
  const [productsSha, setProductsSha] = useState('');
  const [configSha, setConfigSha] = useState('');
  const [fullConfig, setFullConfig] = useState<any>(null);
  const [config, setConfig] = useState<AffiliateConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyProduct());
  const [prosText, setProsText] = useState('');
  const [consText, setConsText] = useState('');
  const [extraLinks, setExtraLinks] = useState<ExtraLink[]>([]);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    Promise.all([
      githubApi('read', PRODUCTS_PATH).catch(() => null),
      githubApi('read', CONFIG_PATH).catch(() => null),
    ]).then(([prodData, cfgData]) => {
      if (prodData) {
        const arr = JSON.parse(prodData.content);
        setProducts(Array.isArray(arr) ? arr : []);
        setProductsSha(prodData.sha);
      }
      if (cfgData) {
        const cfg = JSON.parse(cfgData.content);
        setFullConfig(cfg);
        setConfigSha(cfgData.sha);
        if (cfg.affiliates) {
          setConfig({ ...defaultConfig, ...cfg.affiliates });
        }
      }
    }).finally(() => setLoading(false));
  }, []);

  const saveProducts = async (newList: Product[]) => {
    setSaving(true);
    setError('');
    try {
      const res = await githubApi('write', PRODUCTS_PATH, {
        content: JSON.stringify(newList, null, 2),
        sha: productsSha || undefined,
        message: 'CMS: Update affiliate products',
      });
      setProductsSha(res.sha || productsSha);
      setProducts(newList);
      triggerToast('Produtos salvos!', 'success', 100);
    } catch (err: any) {
      setError(err.message);
      triggerToast(`Erro: ${err.message}`, 'error');
    } finally {
      setSaving(false);
    }
  };

  const saveConfig = async () => {
    if (!fullConfig) return;
    setSavingConfig(true);
    setError('');
    try {
      const newFullConfig = { ...fullConfig, affiliates: config };
      const res = await githubApi('write', CONFIG_PATH, {
        content: JSON.stringify(newFullConfig, null, 4),
        sha: configSha || undefined,
        message: 'CMS: Update affiliates config',
      });
      setConfigSha(res.sha || configSha);
      setFullConfig(newFullConfig);
      triggerToast('Configurações salvas!', 'success', 100);
    } catch (err: any) {
      setError(err.message);
      triggerToast(`Erro: ${err.message}`, 'error');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleAdd = () => {
    setEditingId(null);
    const p = emptyProduct();
    setForm(p);
    setProsText('');
    setConsText('');
    setExtraLinks([]);
    setShowForm(true);
  };

  const handleEdit = (p: Product) => {
    setEditingId(p.id);
    setForm({
      slug: p.slug,
      title: p.title,
      description: p.description,
      image: p.image,
      amazonUrl: p.amazonUrl,
      extraLinks: p.extraLinks || [],
      price: p.price,
      originalPrice: p.originalPrice,
      rating: p.rating,
      pros: p.pros,
      cons: p.cons,
      badge: p.badge,
      buttonText: p.buttonText,
      enabled: p.enabled,
    });
    setProsText((p.pros || []).join('\n'));
    setConsText((p.cons || []).join('\n'));
    setExtraLinks(p.extraLinks || []);
    setShowForm(true);
  };

  const handleFormSave = () => {
    if (!form.title.trim()) {
      triggerToast('Preencha o título do produto', 'error');
      return;
    }
    if (!form.amazonUrl.trim()) {
      triggerToast('Preencha a URL da Amazon', 'error');
      return;
    }

    const finalSlug = form.slug.trim() || slugify(form.title);
    const finalPros = prosText.split('\n').map(s => s.trim()).filter(Boolean);
    const finalCons = consText.split('\n').map(s => s.trim()).filter(Boolean);

    const product: Product = {
      ...form,
      slug: finalSlug,
      pros: finalPros,
      cons: finalCons,
      extraLinks: extraLinks.filter(l => l.label.trim() && l.url.trim()),
      id: editingId || `p_${Date.now()}`,
    };

    let newList: Product[];
    if (editingId) {
      newList = products.map(p => p.id === editingId ? product : p);
    } else {
      newList = [...products, product];
    }

    setShowForm(false);
    setEditingId(null);
    saveProducts(newList);
  };

  const handleDelete = (id: string) => {
    if (!confirm('Remover este produto?')) return;
    saveProducts(products.filter(p => p.id !== id));
  };

  const handleToggle = (id: string) => {
    saveProducts(products.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p));
  };

  const copyShortcode = (slug: string) => {
    navigator.clipboard.writeText(`[affiliate:${slug}]`);
    triggerToast('Shortcode copiado!', 'success', 100);
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center p-20 text-slate-400 bg-white rounded-3xl border border-slate-200">
      <Loader2 className="w-8 h-8 animate-spin mb-4 text-violet-500" />
      <p className="font-medium animate-pulse">Carregando...</p>
    </div>
  );

  return (
    <div className="max-w-4xl space-y-6">
      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab('products')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'products' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Package className="w-4 h-4" /> Produtos
        </button>
        <button
          onClick={() => setTab('settings')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'settings' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Settings className="w-4 h-4" /> Configurações
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 border-l-4 border-red-500 text-sm font-medium rounded-r-xl flex gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
        </div>
      )}

      {/* ── PRODUCTS TAB ── */}
      {tab === 'products' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">{products.length} produto{products.length !== 1 ? 's' : ''} cadastrado{products.length !== 1 ? 's' : ''}</p>
            <button
              onClick={handleAdd}
              className="bg-amber-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
            >
              <Plus className="w-4 h-4" /> Novo Produto
            </button>
          </div>

          {/* Form */}
          {showForm && (
            <div className="bg-white rounded-2xl border border-amber-200 shadow-sm p-6">
              <h3 className="font-bold text-slate-800 mb-5">{editingId ? 'Editar Produto' : 'Novo Produto'}</h3>
              <div className="space-y-4">

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Título *</label>
                    <input
                      type="text"
                      value={form.title}
                      onChange={e => {
                        const title = e.target.value;
                        setForm(f => ({ ...f, title, slug: f.slug || slugify(title) }));
                      }}
                      className={inputClass}
                      placeholder="Sony WH-1000XM5"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Slug (auto)</label>
                    <input
                      type="text"
                      value={form.slug}
                      onChange={e => setForm(f => ({ ...f, slug: slugify(e.target.value) }))}
                      className={`${inputClass} font-mono`}
                      placeholder="sony-wh-1000xm5"
                    />
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Descrição curta</label>
                  <input
                    type="text"
                    value={form.description}
                    onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                    className={inputClass}
                    placeholder="Fone com cancelamento de ruído líder de mercado."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>URL da Imagem</label>
                    <input
                      type="url"
                      value={form.image}
                      onChange={e => setForm(f => ({ ...f, image: e.target.value }))}
                      className={inputClass}
                      placeholder="https://m.media-amazon.com/images/..."
                    />
                  </div>
                  <div>
                    {form.image && (
                      <div className="mt-6">
                        <img src={form.image} alt="preview" className="h-20 w-full object-contain rounded-lg border border-slate-200 bg-slate-50" />
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>URL Amazon *</label>
                  <input
                    type="url"
                    value={form.amazonUrl}
                    onChange={e => setForm(f => ({ ...f, amazonUrl: e.target.value }))}
                    className={`${inputClass} font-mono`}
                    placeholder="https://www.amazon.com.br/dp/..."
                  />
                </div>

                {/* Extra links */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className={labelClass + ' mb-0'}>Links adicionais (Mercado Livre, Magalu, etc.)</label>
                    <button
                      type="button"
                      onClick={() => setExtraLinks(l => [...l, { label: '', url: '' }])}
                      className="flex items-center gap-1.5 text-xs font-bold text-amber-600 hover:text-amber-700 bg-amber-50 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" /> Adicionar loja
                    </button>
                  </div>
                  {extraLinks.length === 0 && (
                    <p className="text-xs text-slate-400 ml-1">Nenhum link adicional. Clique em "Adicionar loja" para incluir Mercado Livre, Magalu, etc.</p>
                  )}
                  <div className="space-y-2">
                    {extraLinks.map((link, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input
                          type="text"
                          value={link.label}
                          onChange={e => setExtraLinks(ls => ls.map((l, j) => j === i ? { ...l, label: e.target.value } : l))}
                          className={inputClass + ' w-36 shrink-0'}
                          placeholder="Magalu"
                        />
                        <input
                          type="url"
                          value={link.url}
                          onChange={e => setExtraLinks(ls => ls.map((l, j) => j === i ? { ...l, url: e.target.value } : l))}
                          className={`${inputClass} font-mono flex-1`}
                          placeholder="https://www.magazineluiza.com.br/..."
                        />
                        <button
                          type="button"
                          onClick={() => setExtraLinks(ls => ls.filter((_, j) => j !== i))}
                          className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className={labelClass}>Preço</label>
                    <input
                      type="text"
                      value={form.price}
                      onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                      className={inputClass}
                      placeholder="R$ 1.899,00"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Preço Original</label>
                    <input
                      type="text"
                      value={form.originalPrice}
                      onChange={e => setForm(f => ({ ...f, originalPrice: e.target.value }))}
                      className={inputClass}
                      placeholder="R$ 2.299,00"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Rating (1–5)</label>
                    <input
                      type="number"
                      min={1}
                      max={5}
                      step={0.5}
                      value={form.rating}
                      onChange={e => setForm(f => ({ ...f, rating: Number(e.target.value) }))}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Prós (1 por linha)</label>
                    <textarea
                      value={prosText}
                      onChange={e => setProsText(e.target.value)}
                      rows={4}
                      className={inputClass}
                      placeholder={"Cancelamento excepcional\nBateria 30h\nConforto premium"}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Contras (1 por linha)</label>
                    <textarea
                      value={consText}
                      onChange={e => setConsText(e.target.value)}
                      rows={4}
                      className={inputClass}
                      placeholder={"Preço alto\nSem case rígido\nNão dobrável"}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelClass}>Badge</label>
                    <select
                      value={form.badge}
                      onChange={e => setForm(f => ({ ...f, badge: e.target.value }))}
                      className={inputClass}
                    >
                      {BADGE_OPTIONS.map(b => (
                        <option key={b} value={b}>{b || '— Sem badge —'}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Texto do Botão (deixe vazio para padrão)</label>
                    <input
                      type="text"
                      value={form.buttonText}
                      onChange={e => setForm(f => ({ ...f, buttonText: e.target.value }))}
                      className={inputClass}
                      placeholder={config.defaultButtonText}
                    />
                  </div>
                </div>

                <label className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl hover:bg-amber-50 transition-colors w-fit">
                  <input
                    type="checkbox"
                    checked={form.enabled}
                    onChange={e => setForm(f => ({ ...f, enabled: e.target.checked }))}
                    className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                  />
                  <span className="text-sm font-medium text-slate-700">Ativo</span>
                </label>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleFormSave}
                    disabled={saving}
                    className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button
                    onClick={() => { setShowForm(false); setEditingId(null); }}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-all"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Products list */}
          {products.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
              <ShoppingCart className="w-12 h-12 text-slate-200 mx-auto mb-4" />
              <p className="text-slate-500 font-medium">Nenhum produto cadastrado</p>
              <p className="text-slate-400 text-sm mt-1">Clique em "Novo Produto" para começar</p>
            </div>
          ) : (
            <div className="space-y-3">
              {products.map(p => (
                <div
                  key={p.id}
                  className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex items-center gap-4 ${!p.enabled ? 'opacity-50' : ''}`}
                >
                  {p.image && (
                    <img
                      src={p.image}
                      alt={p.title}
                      className="w-14 h-14 object-contain rounded-lg border border-slate-100 bg-slate-50 shrink-0"
                    />
                  )}
                  {!p.image && (
                    <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                      <ShoppingCart className="w-6 h-6 text-slate-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-slate-800 truncate">{p.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <code className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-mono">[affiliate:{p.slug}]</code>
                      {p.badge && (
                        <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">{p.badge}</span>
                      )}
                      {p.price && (
                        <span className="text-xs text-slate-500 font-medium">{p.price}</span>
                      )}
                      {p.rating && (
                        <span className="text-xs text-amber-500 font-medium">★ {p.rating}</span>
                      )}
                      {p.extraLinks && p.extraLinks.length > 0 && (
                        <span className="text-xs text-slate-400 font-medium">+{p.extraLinks.length} loja{p.extraLinks.length > 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => copyShortcode(p.slug)}
                      title="Copiar shortcode"
                      className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleEdit(p)}
                      className="p-1.5 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleToggle(p.id)} className="text-slate-400 hover:text-amber-600 transition-colors p-1.5">
                      {p.enabled
                        ? <ToggleRight className="w-5 h-5 text-amber-500" />
                        : <ToggleLeft className="w-5 h-5" />
                      }
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Shortcode help */}
          <div className="bg-amber-50 rounded-2xl border border-amber-200 p-5">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-2">Como usar nos artigos</p>
            <ul className="space-y-1.5 text-sm text-amber-800">
              <li>• Use <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-xs">[affiliate:slug]</code> para inserir um card completo com prós/contras e CTA</li>
              <li>• Use <code className="font-mono bg-amber-100 px-1.5 py-0.5 rounded text-xs">[affiliate-compare:slug1,slug2]</code> para inserir cards comparativos lado a lado</li>
              <li>• O shortcode deve estar em uma linha isolada no markdown do post</li>
              <li>• Clique no ícone <Copy className="w-3 h-3 inline" /> de cada produto para copiar o shortcode</li>
            </ul>
          </div>
        </>
      )}

      {/* ── SETTINGS TAB ── */}
      {tab === 'settings' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Amazon Associate Tag ID</label>
              <input
                type="text"
                value={config.amazonTag}
                onChange={e => setConfig(c => ({ ...c, amazonTag: e.target.value }))}
                className={`${inputClass} font-mono`}
                placeholder="meublog-20"
              />
              <p className="text-xs text-slate-400 mt-1.5 ml-1">Será adicionado automaticamente em todos os links (<code className="font-mono">?tag=...</code>)</p>
            </div>
            <div>
              <label className={labelClass}>Texto padrão do botão</label>
              <input
                type="text"
                value={config.defaultButtonText}
                onChange={e => setConfig(c => ({ ...c, defaultButtonText: e.target.value }))}
                className={inputClass}
                placeholder="Ver na Amazon"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Cor do botão CTA</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={config.buttonColor}
                  onChange={e => setConfig(c => ({ ...c, buttonColor: e.target.value }))}
                  className="w-12 h-12 rounded-xl border border-slate-200 cursor-pointer p-1"
                />
                <input
                  type="text"
                  value={config.buttonColor}
                  onChange={e => setConfig(c => ({ ...c, buttonColor: e.target.value }))}
                  className={`${inputClass} font-mono`}
                  placeholder="#FF9900"
                />
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Texto do Disclaimer</label>
            <textarea
              value={config.disclaimer}
              onChange={e => setConfig(c => ({ ...c, disclaimer: e.target.value }))}
              rows={2}
              className={inputClass}
              placeholder="Este artigo contém links de afiliado..."
            />
          </div>

          <div className="space-y-3 pt-1">
            <p className={labelClass}>Visibilidade dos elementos</p>
            {([
              ['showPrices', 'Mostrar preços'],
              ['showRatings', 'Mostrar avaliações (★)'],
              ['showProscons', 'Mostrar prós e contras'],
              ['showBadges', 'Mostrar badges (ex: "Melhor Escolha")'],
              ['showDisclaimer', 'Mostrar disclaimer no topo do post'],
              ['enabled', 'Plugin ativo'],
            ] as [keyof AffiliateConfig, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer p-3 bg-slate-50 rounded-xl hover:bg-amber-50 transition-colors w-fit">
                <input
                  type="checkbox"
                  checked={!!config[key]}
                  onChange={e => setConfig(c => ({ ...c, [key]: e.target.checked }))}
                  className="rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                />
                <span className="text-sm font-medium text-slate-700">{label}</span>
              </label>
            ))}
          </div>

          <button
            onClick={saveConfig}
            disabled={savingConfig}
            className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 transition-all"
          >
            {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {savingConfig ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      )}
    </div>
  );
}
