/**
 * LeadsPanel.tsx — Painel de subscribers da newsletter
 */

import { useState, useEffect } from 'react';
import { Loader2, Download, Search, Users, AlertCircle } from 'lucide-react';

interface Subscriber {
    email: string;
    name: string;
    subscribedAt: string;
    source: string;
    tags: string[];
}

export default function LeadsPanel() {
    const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetch('/api/admin/plugins/email-list/leads')
            .then(r => r.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                setSubscribers(data.subscribers || []);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, []);

    const filtered = subscribers.filter(s =>
        s.email.toLowerCase().includes(search.toLowerCase()) ||
        s.name?.toLowerCase().includes(search.toLowerCase())
    );

    function exportCsv() {
        const header = 'Email,Nome,Data,Fonte,Tags';
        const rows = subscribers.map(s =>
            [
                `"${s.email}"`,
                `"${s.name || ''}"`,
                `"${new Date(s.subscribedAt).toLocaleString('pt-BR')}"`,
                `"${s.source}"`,
                `"${(s.tags || []).join(', ')}"`,
            ].join(',')
        );
        const csv = [header, ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `leads_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    const sourceLabel: Record<string, string> = {
        popup: 'Popup',
        widget: 'Widget',
        api: 'API',
    };

    const sourceBadge: Record<string, string> = {
        popup: 'bg-violet-100 text-violet-700',
        widget: 'bg-blue-100 text-blue-700',
        api: 'bg-slate-100 text-slate-600',
    };

    if (loading) return (
        <div className="flex flex-col items-center justify-center p-16 text-slate-400">
            <Loader2 className="w-7 h-7 animate-spin mb-3 text-violet-500" />
            <p className="text-sm font-medium animate-pulse">Carregando leads...</p>
        </div>
    );

    if (error) return (
        <div className="bg-red-50 text-red-700 p-6 rounded-2xl border border-red-200 flex gap-3 items-start">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm">{error}</p>
        </div>
    );

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
                        <Users className="w-5 h-5 text-violet-600" />
                    </div>
                    <div>
                        <p className="font-bold text-slate-800">{subscribers.length} inscritos</p>
                        <p className="text-xs text-slate-500">total na lista</p>
                    </div>
                </div>
                <button
                    onClick={exportCsv}
                    disabled={subscribers.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                    <Download className="w-4 h-4" />
                    Exportar CSV
                </button>
            </div>

            {/* Busca */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar por email ou nome..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 transition-all"
                />
            </div>

            {/* Tabela */}
            {filtered.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <Users className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-medium">
                        {subscribers.length === 0 ? 'Nenhum inscrito ainda.' : 'Nenhum resultado para sua busca.'}
                    </p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50">
                                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Email</th>
                                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Nome</th>
                                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Data</th>
                                <th className="text-left px-4 py-3 text-xs font-bold text-slate-500 uppercase tracking-wider">Fonte</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map((sub, i) => (
                                <tr key={sub.email} className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${i === filtered.length - 1 ? 'border-0' : ''}`}>
                                    <td className="px-4 py-3 font-medium text-slate-800">{sub.email}</td>
                                    <td className="px-4 py-3 text-slate-600">{sub.name || <span className="text-slate-300">—</span>}</td>
                                    <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">
                                        {new Date(sub.subscribedAt).toLocaleDateString('pt-BR', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric',
                                        })}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${sourceBadge[sub.source] || 'bg-slate-100 text-slate-600'}`}>
                                            {sourceLabel[sub.source] || sub.source}
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
