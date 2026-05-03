import React, { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { githubApi } from '../../lib/adminApi';

const DISMISS_KEY = 'cms-ai-warning-dismissed';

export default function AiWarningBanner() {
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (typeof window !== 'undefined' && sessionStorage.getItem(DISMISS_KEY) === '1') return;
        if (typeof window !== 'undefined' && window.location.pathname.includes('/admin/config')) return;

        githubApi('read', 'src/data/siteConfig.json')
            .then(res => {
                try {
                    const cfg = JSON.parse(res?.content || '{}');
                    const configured = !!(cfg.ai && cfg.ai.openaiKey && cfg.ai.openaiKey.length > 10);
                    if (!configured) setShow(true);
                } catch { setShow(true); }
            })
            .catch(() => { });
    }, []);

    const dismiss = () => {
        sessionStorage.setItem(DISMISS_KEY, '1');
        setShow(false);
    };

    if (!show) return null;

    return (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border-b-2 border-amber-300 px-8 py-3 flex items-center gap-4">
            <div className="bg-amber-200 rounded-lg p-1.5 shrink-0">
                <AlertCircle className="w-4 h-4 text-amber-800" />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm text-amber-900">
                    <strong className="font-bold">OpenAI API Key não configurada.</strong>
                    <span className="ml-1 text-amber-800">O Gerador de Review com IA precisa da chave para funcionar.</span>
                </p>
            </div>
            <a
                href="/admin/config#ai"
                className="text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 px-4 py-1.5 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
                Configurar agora →
            </a>
            <button
                onClick={dismiss}
                className="text-amber-700 hover:text-amber-900 hover:bg-amber-200 rounded-lg p-1.5 shrink-0 transition-colors"
                aria-label="Dispensar"
                title="Dispensar até a próxima sessão"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
}
