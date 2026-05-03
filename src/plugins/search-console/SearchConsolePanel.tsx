/**
 * SearchConsolePanel.tsx — Plugin Google Search Console (Walker)
 *
 * Painel de analytics: cliques, impressões, CTR, posição média.
 * Top 10 queries e top 10 páginas do período selecionado.
 */

import { useState, useEffect } from 'react';
import { Loader2, AlertCircle, TrendingUp, MousePointerClick, Eye, Hash } from 'lucide-react';

interface SummaryData {
    totalClicks: number;
    totalImpressions: number;
    avgCtr: number;
    avgPosition: number;
}

interface AnalyticsRow {
    query?: string;
    page?: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
}

interface GSCData {
    summary: SummaryData;
    queries: AnalyticsRow[];
    pages: AnalyticsRow[];
    period: { startDate: string; endDate: string; days: number };
}

const DAYS_OPTIONS = [
    { value: 7,  label: '7 dias' },
    { value: 28, label: '28 dias' },
    { value: 90, label: '90 dias' },
];

function fmt(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n); }
function fmtCtr(n: number) { return `${(n * 100).toFixed(1)}%`; }
function fmtPos(n: number) { return n.toFixed(1); }
function fmtPage(url: string) {
    try { return new URL(url).pathname || '/'; } catch { return url; }
}

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 bg-violet-50 rounded-lg flex items-center justify-center text-violet-600">{icon}</div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</span>
            </div>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
    );
}

function DataTable({ rows, type }: { rows: AnalyticsRow[]; type: 'query' | 'page' }) {
    if (rows.length === 0) {
        return (
            <div className="text-center py-12 text-slate-400">
                <p className="text-sm">Nenhum dado disponível para o período.</p>
                <p className="text-xs mt-1">Verifique se o site tem tráfego orgânico no Google.</p>
            </div>
        );
    }
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-sm">
                <thead>
                    <tr className="border-b border-slate-100">
                        <th className="text-left py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">
                            {type === 'query' ? 'Consulta' : 'Página'}
                        </th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Cliques</th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Impressões</th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">CTR</th>
                        <th className="text-right py-3 px-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Posição</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-4 font-medium text-slate-700 max-w-xs truncate">
                                {type === 'query' ? row.query : (
                                    <a href={row.page} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:underline">
                                        {fmtPage(row.page ?? '')}
                                    </a>
                                )}
                            </td>
                            <td className="py-3 px-4 text-right font-semibold text-slate-800">{fmt(row.clicks)}</td>
                            <td className="py-3 px-4 text-right text-slate-500">{fmt(row.impressions)}</td>
                            <td className="py-3 px-4 text-right text-slate-500">{fmtCtr(row.ctr)}</td>
                            <td className="py-3 px-4 text-right">
                                <span className={`font-semibold ${row.position <= 3 ? 'text-green-600' : row.position <= 10 ? 'text-amber-600' : 'text-slate-500'}`}>
                                    #{fmtPos(row.position)}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default function SearchConsolePanel() {
    const [days, setDays] = useState(28);
    const [data, setData] = useState<GSCData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<'query' | 'page'>('query');

    const loadData = async (d: number) => {
        setLoading(true); setError('');
        try {
            const res = await fetch(`/api/admin/plugins/search-console/data?days=${d}`);
            const json = await res.json();
            if (!res.ok) throw new Error(json.error ?? 'Erro desconhecido.');
            setData(json);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(days); }, []);

    const handleDaysChange = (d: number) => {
        setDays(d);
        loadData(d);
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Loader2 className="w-8 h-8 animate-spin mb-4 text-violet-500" />
            <p className="font-medium animate-pulse">Buscando dados do Search Console...</p>
        </div>
    );

    if (error) return (
        <div className="bg-red-50 text-red-700 p-8 rounded-2xl border border-red-200 flex gap-4 items-start max-w-2xl">
            <AlertCircle className="w-6 h-6 shrink-0 mt-0.5" />
            <div>
                <p className="font-bold mb-1">Não foi possível carregar os dados</p>
                <p className="text-sm">{error}</p>
                {error.includes('não configurado') && (
                    <p className="text-sm mt-2">Configure o service account na aba <strong>Configurações</strong>.</p>
                )}
            </div>
        </div>
    );

    if (!data) return null;

    const { summary, queries, pages, period } = data;

    return (
        <div className="space-y-6">
            {/* Header com seletor de período */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <p className="text-sm text-slate-500">
                    {period.startDate} → {period.endDate}
                </p>
                <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
                    {DAYS_OPTIONS.map(opt => (
                        <button
                            key={opt.value}
                            onClick={() => handleDaysChange(opt.value)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${days === opt.value ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Cards de resumo */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard icon={<MousePointerClick className="w-4 h-4" />} label="Cliques" value={fmt(summary.totalClicks)} sub="total no período" />
                <StatCard icon={<Eye className="w-4 h-4" />} label="Impressões" value={fmt(summary.totalImpressions)} sub="total no período" />
                <StatCard icon={<TrendingUp className="w-4 h-4" />} label="CTR médio" value={fmtCtr(summary.avgCtr)} sub="cliques ÷ impressões" />
                <StatCard icon={<Hash className="w-4 h-4" />} label="Posição média" value={`#${fmtPos(summary.avgPosition)}`} sub="quanto menor, melhor" />
            </div>

            {/* Tabelas */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm">
                {/* Tabs */}
                <div className="flex gap-1 p-3 border-b border-slate-100">
                    <button
                        onClick={() => setActiveTab('query')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'query' ? 'bg-violet-50 text-violet-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                    >
                        🔍 Top Consultas
                    </button>
                    <button
                        onClick={() => setActiveTab('page')}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'page' ? 'bg-violet-50 text-violet-700' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'}`}
                    >
                        📄 Top Páginas
                    </button>
                </div>
                <DataTable rows={activeTab === 'query' ? queries : pages} type={activeTab} />
            </div>

            <p className="text-xs text-slate-400 text-center">
                Dados do Google Search Console com ~3 dias de defasagem. Atualiza a cada acesso.
            </p>
        </div>
    );
}
