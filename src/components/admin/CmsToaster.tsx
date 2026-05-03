import React, { useState, useEffect } from 'react';
import { CheckCircle2, AlertCircle, Loader2, Info, ExternalLink, X } from 'lucide-react';

export interface ToastEvent {
    id?: string;
    message: string;
    type: 'success' | 'error' | 'info' | 'progress';
    progress?: number;
    link?: string;
}

export const triggerToast = (message: string, type: 'success' | 'error' | 'info' | 'progress' = 'info', progress?: number, link?: string) => {
    window.dispatchEvent(new CustomEvent('cms-toast', { detail: { message, type, progress, link } }));
};

export default function CmsToaster() {
    const [toasts, setToasts] = useState<ToastEvent[]>([]);

    useEffect(() => {
        const handleToast = (e: any) => {
            const newToast = { id: Date.now().toString() + Math.random(), ...e.detail } as ToastEvent;

            if (newToast.type === 'progress') {
                setToasts(prev => {
                    const exists = prev.find(t => t.type === 'progress');
                    if (exists) {
                        return prev.map(t => t.type === 'progress' ? { ...t, ...newToast } : t);
                    }
                    return [...prev, newToast];
                });
            } else {
                setToasts(prev => {
                    const withoutProgress = prev.filter(t => t.type !== 'progress');
                    return [...withoutProgress, newToast];
                });
                setTimeout(() => {
                    setToasts(prev => prev.filter(t => t.id !== newToast.id));
                }, 6000);
            }
        };

        window.addEventListener('cms-toast', handleToast);
        return () => window.removeEventListener('cms-toast', handleToast);
    }, []);

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 items-end pointer-events-none">
            {toasts.map(toast => (
                <div key={toast.id} className="pointer-events-auto bg-white border border-violet-100 shadow-2xl shadow-violet-500/10 rounded-2xl w-80 overflow-hidden transform transition-all duration-300">
                    <div className="p-4 flex items-start gap-4">
                        <div className="shrink-0 mt-0.5">
                            {toast.type === 'success' && <CheckCircle2 className="w-5 h-5 text-violet-600" />}
                            {toast.type === 'error' && <AlertCircle className="w-5 h-5 text-red-500" />}
                            {toast.type === 'info' && <Info className="w-5 h-5 text-violet-400" />}
                            {toast.type === 'progress' && <Loader2 className="w-5 h-5 text-violet-600 animate-spin" />}
                        </div>
                        <div className="flex-1">
                            <p className="text-sm font-bold text-slate-800 leading-snug">{toast.message}</p>
                            {toast.link && (
                                <a href={toast.link} target="_blank" className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 text-violet-700 hover:bg-violet-600 hover:text-white rounded-lg text-xs font-bold transition-colors">
                                    Ver alteração ao vivo <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>
                        {toast.type !== 'progress' && (
                            <button onClick={() => removeToast(toast.id!)} className="shrink-0 text-slate-400 hover:text-violet-600 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                    {toast.type === 'progress' && toast.progress !== undefined && (
                        <div className="w-full h-1.5 bg-slate-100">
                            <div className="h-full bg-violet-600 transition-all duration-700 ease-out" style={{ width: `${toast.progress}%` }}></div>
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
}
