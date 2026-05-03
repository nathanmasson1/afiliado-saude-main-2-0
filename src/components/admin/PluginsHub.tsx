import React from 'react';
import {
    BarChart3, Mail, Target, Sparkles, Search, Upload,
    Share2, Cookie, SearchCheck, DollarSign, ArrowRightLeft,
    ShoppingCart, ChevronRight, BookOpen, Shield, Globe,
    RefreshCw, Download, Package,
} from 'lucide-react';

const iconMap: Record<string, React.ElementType> = {
    BarChart3, Mail, Target, Sparkles, Search, Upload,
    Share2, Cookie, SearchCheck, DollarSign, ArrowRightLeft,
    ShoppingCart, BookOpen, Shield, Globe, RefreshCw, Download,
};

interface PluginEntry {
    name: string;
    label: string;
    description: string;
    icon: string;
    color: string;
    bg: string;
    href: string;
}

interface Props {
    registry: PluginEntry[];
}

export default function PluginsHub({ registry }: Props) {
    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {registry.map(p => {
                    const Icon = iconMap[p.icon] ?? Package;
                    return (
                        <a
                            key={p.name}
                            href={p.href}
                            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all flex flex-col gap-4 group"
                        >
                            <div className="flex items-start justify-between">
                                <div className={`w-11 h-11 rounded-xl ${p.bg} flex items-center justify-center shrink-0`}>
                                    <Icon className={`w-5 h-5 ${p.color}`} />
                                </div>
                                <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 group-hover:translate-x-0.5 transition-all mt-1" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-800 mb-1">{p.label}</h3>
                                <p className="text-sm text-slate-500 leading-relaxed">{p.description}</p>
                            </div>
                        </a>
                    );
                })}
            </div>

        </div>
    );
}
