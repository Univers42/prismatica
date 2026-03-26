import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Database, Eye, Layers, Plus, ChevronRight,
  Settings, User, Zap, ChevronDown
} from 'lucide-react';
import { store } from '@/lib/mockData';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { label: 'Pages', icon: LayoutDashboard, href: '/', exact: true },
  { label: 'Collections', icon: Database, href: '/collections' },
  { label: 'Views', icon: Eye, href: '/views' },
  { label: 'Shells', icon: Layers, href: '/shells' },
];

export default function AppShell({ children }) {
  const location = useLocation();
  const pages = store.getPages();
  const [pagesOpen, setPagesOpen] = useState(true);

  const isActive = (href, exact) => {
    if (exact) return location.pathname === href;
    return location.pathname.startsWith(href);
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background font-inter">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border overflow-y-auto scrollbar-thin">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border">
          <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>
          <div>
            <span className="text-sm font-semibold text-white tracking-tight">MetaCanvas</span>
            <p className="text-xs text-sidebar-foreground/50 leading-none">Dashboard Builder</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-3 space-y-0.5">
          {NAV_ITEMS.map(({ label, icon: Icon, href, exact }) => (
            <Link
              key={href}
              to={href}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                isActive(href, exact)
                  ? 'bg-primary/20 text-white'
                  : 'text-sidebar-foreground hover:bg-white/8 hover:text-white'
              )}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
            </Link>
          ))}

          {/* Pages sub-nav */}
          <div className="mt-4">
            <button
              onClick={() => setPagesOpen(o => !o)}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-sidebar-foreground/40 hover:text-sidebar-foreground/60 transition-colors"
            >
              <ChevronDown className={cn('w-3 h-3 transition-transform', !pagesOpen && '-rotate-90')} />
              Pages
            </button>

            {pagesOpen && (
              <div className="mt-1 space-y-0.5">
                {pages.map(page => (
                  <Link
                    key={page.id}
                    to={`/preview/${page.id}`}
                    className={cn(
                      'flex items-center gap-2 pl-6 pr-3 py-1.5 rounded-lg text-sm transition-all duration-150',
                      location.pathname === `/preview/${page.id}`
                        ? 'bg-primary/15 text-white'
                        : 'text-sidebar-foreground/60 hover:text-white hover:bg-white/5'
                    )}
                  >
                    <span className="text-base leading-none">{page.icon}</span>
                    <span className="truncate">{page.name}</span>
                  </Link>
                ))}
                <Link
                  to="/editor/new"
                  className="flex items-center gap-2 pl-6 pr-3 py-1.5 rounded-lg text-sm text-primary/70 hover:text-primary transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  New Page
                </Link>
              </div>
            )}
          </div>
        </nav>

        {/* Footer */}
        <div className="px-3 py-3 border-t border-sidebar-border">
          <div className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-white/5 cursor-pointer transition-colors">
            <div className="w-7 h-7 rounded-full bg-primary/30 flex items-center justify-center flex-shrink-0">
              <User className="w-3.5 h-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">My Workspace</p>
              <p className="text-xs text-sidebar-foreground/40 truncate">admin@metaCanvas.io</p>
            </div>
            <Settings className="w-3.5 h-3.5 text-sidebar-foreground/40 flex-shrink-0" />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}