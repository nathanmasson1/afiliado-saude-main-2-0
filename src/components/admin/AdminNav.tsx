import React, { useEffect, useState } from 'react';
import {
    LayoutDashboard, FileText, Tag, Users, Home, Info, Phone,
    Shield, Settings, LogOut, ChevronRight, ExternalLink, Navigation,
    Sparkles, Package, Layout, Star, AlertTriangle, Wand2,
} from 'lucide-react';
import { githubApi } from '../../lib/adminApi';

interface NavItem {
    label: string;
    href: string;
    icon: React.ElementType;
    section: string;
    highlight?: boolean;
}

const mainItems: NavItem[] = [
    { label: 'Dashboard', href: '/admin', icon: LayoutDashboard, section: 'dashboard' },
    { label: 'Artigos', href: '/admin/posts', icon: FileText, section: 'posts' },
    { label: 'Gerador de Review', href: '/admin/reviews/new', icon: Wand2, section: 'reviews', highlight: true },
    { label: 'Categorias', href: '/admin/categories', icon: Tag, section: 'categories' },
    { label: 'Autores', href: '/admin/authors', icon: Users, section: 'authors' },
];

const pageItems: NavItem[] = [
    { label: 'Menu', href: '/admin/menu', icon: Navigation, section: 'menu' },
    { label: 'Home', href: '/admin/home', icon: Home, section: 'home' },
    { label: 'Sobre', href: '/admin/sobre', icon: Info, section: 'sobre' },
    { label: 'Contato', href: '/admin/contato', icon: Phone, section: 'contato' },
    { label: 'Rodapé', href: '/admin/footer', icon: Layout, section: 'footer' },
    { label: 'Privacidade & Termos', href: '/admin/legal', icon: Shield, section: 'legal' },
];

const pluginItems: NavItem[] = [
    { label: 'Plugins', href: '/admin/plugins', icon: Sparkles, section: 'plugins' },
    { label: 'Google Tag', href: '/admin/google-tag', icon: Tag, section: 'google-tag' },
];

interface AdminNavProps {
    activeSection?: string;
    extraItems?: NavItem[];
}

export default function AdminNav({ activeSection = '', extraItems = [] }: AdminNavProps) {
    const allMainItems = [...mainItems, ...extraItems];
    const [aiConfigured, setAiConfigured] = useState<boolean | null>(null);

    useEffect(() => {
        githubApi('read', 'src/data/siteConfig.json')
            .then(res => {
                try {
                    const cfg = JSON.parse(res?.content || '{}');
                    setAiConfigured(!!(cfg.ai && cfg.ai.openaiKey && cfg.ai.openaiKey.length > 10));
                } catch { setAiConfigured(false); }
            })
            .catch(() => setAiConfigured(false));
    }, []);

    return (
        <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-slate-100 flex flex-col z-50 shadow-sm">
            {/* Logo */}
            <div className="h-16 flex items-center px-6 border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-violet-600 rounded-lg flex items-center justify-center">
                        <LayoutDashboard className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-slate-800">Admin CMS</span>
                </div>
            </div>

            {/* Nav */}
            <nav className="flex-1 overflow-y-auto py-4 px-3">
                {/* Seção Principal */}
                <div className="mb-6">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Principal</p>
                    {allMainItems.map(item => (
                        <NavLink
                            key={item.href}
                            item={item}
                            active={activeSection === item.section}
                            warning={item.section === 'reviews' && aiConfigured === false}
                        />
                    ))}
                </div>

                {/* Páginas */}
                <div className="mb-6">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Páginas</p>
                    {pageItems.map(item => (
                        <NavLink key={item.href} item={item} active={activeSection === item.section} />
                    ))}
                </div>

                {/* Plugins */}
                <div className="mb-6">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Plugins</p>
                    {pluginItems.map(item => (
                        <NavLink key={item.href} item={item} active={activeSection === item.section} />
                    ))}
                </div>

                {/* Configurações */}
                <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-2">Sistema</p>
                    <NavLink item={{ label: 'Configurações', href: '/admin/config', icon: Settings, section: 'config' }} active={activeSection === 'config'} />
                </div>
            </nav>

            {/* Ver site + Logout */}
            <div className="p-3 border-t border-slate-100 space-y-1">
                <a
                    href="/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:text-violet-700 hover:bg-violet-50 transition-all group"
                >
                    <ExternalLink className="w-4 h-4 shrink-0 group-hover:text-violet-600" />
                    <span className="text-sm font-medium">Ver site</span>
                </a>
                <a
                    href="/api/admin/logout"
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 transition-all group"
                >
                    <LogOut className="w-4 h-4 shrink-0 group-hover:text-red-500" />
                    <span className="text-sm font-medium">Sair</span>
                </a>
            </div>
        </aside>
    );
}

function NavLink({ item, active, warning }: { item: NavItem; active: boolean; warning?: boolean }) {
    const Icon = item.icon;

    if (item.highlight) {
        return (
            <a
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 transition-all group relative ${
                    active
                        ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-md shadow-violet-600/30'
                        : 'bg-gradient-to-r from-violet-50 to-fuchsia-50 hover:from-violet-100 hover:to-fuchsia-100 text-violet-800 border border-violet-200'
                }`}
            >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-white' : 'text-violet-600'}`} />
                <span className={`text-sm font-bold flex-1 ${active ? 'text-white' : 'text-violet-800'}`}>{item.label}</span>
                <span className={`flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${active ? 'bg-white/25 text-white' : 'bg-amber-400 text-amber-900'}`}>
                    <Star className="w-2.5 h-2.5 fill-current" /> AI
                </span>
                {warning && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full border-2 border-white animate-pulse" title="API não configurada" />
                )}
            </a>
        );
    }

    return (
        <a
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 transition-all group ${
                active
                    ? 'bg-violet-50 text-violet-700'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
        >
            <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-violet-600' : 'text-slate-400 group-hover:text-slate-600'}`} />
            <span className={`text-sm font-medium flex-1 ${active ? 'font-semibold' : ''}`}>{item.label}</span>
            {active && <ChevronRight className="w-3 h-3 text-violet-400" />}
        </a>
    );
}
