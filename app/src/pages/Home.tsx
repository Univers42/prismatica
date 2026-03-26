import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, LayoutDashboard, Clock, Eye, Edit3, Trash2, Search, BarChart2, Kanban, Tag } from 'lucide-react';
import { store } from '@/lib/mockData';
import AppShell from '@/components/layout/AppShell';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const TAG_COLORS = {
  analytics: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
  saas: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  projects: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  tasks: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
  users: 'bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300',
};

export default function Home() {
  const navigate = useNavigate();
  const [pages, setPages] = useState(store.getPages());
  const [search, setSearch] = useState('');

  useEffect(() => {
    return store.subscribe(() => setPages(store.getPages()));
  }, []);

  const filtered = pages.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) || p.description?.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Delete this page?')) store.deletePage(id);
  };

  return (
    <AppShell>
      <div className="min-h-full bg-surface-2">
        {/* Top bar */}
        <div className="bg-card border-b border-border px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Pages</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Your metadata-driven dashboard collection</p>
          </div>
          <Link
            to="/editor/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all shadow-sm hover:shadow-md hover:shadow-primary/20"
          >
            <Plus className="w-4 h-4" />
            New Page
          </Link>
        </div>

        <div className="px-8 py-6 max-w-7xl mx-auto">
          {/* Search */}
          <div className="relative mb-6 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search pages..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-card border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 placeholder:text-muted-foreground/60"
            />
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: 'Total Pages', value: pages.length, icon: LayoutDashboard, color: 'text-violet-600 bg-violet-100 dark:bg-violet-950' },
              { label: 'Components Placed', value: pages.reduce((s, p) => s + (p.componentRecords?.length || 0), 0), icon: BarChart2, color: 'text-blue-600 bg-blue-100 dark:bg-blue-950' },
              { label: 'Data Collections', value: 4, icon: Kanban, color: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950' },
            ].map(stat => (
              <div key={stat.label} className="bg-card rounded-2xl p-5 border border-border/60 flex items-center gap-4">
                <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', stat.color)}>
                  <stat.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pages grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {filtered.map((page, i) => (
                <motion.div
                  key={page.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <div className="group bg-card rounded-2xl border border-border/60 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 overflow-hidden cursor-pointer">
                    {/* Page header */}
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="text-3xl leading-none">{page.icon}</div>
                          <div>
                            <h3 className="font-semibold text-foreground text-sm group-hover:text-primary transition-colors">{page.name}</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">{page.description}</p>
                          </div>
                        </div>
                      </div>

                      {/* Tags */}
                      <div className="flex flex-wrap gap-1.5 mb-4">
                        {page.tags?.map(tag => (
                          <span key={tag} className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium', TAG_COLORS[tag] || 'bg-muted text-muted-foreground')}>
                            <Tag className="w-2.5 h-2.5" />
                            {tag}
                          </span>
                        ))}
                      </div>

                      {/* Meta */}
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <LayoutDashboard className="w-3 h-3" />
                          {page.componentRecords?.length || 0} components
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Updated today
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="border-t border-border/60 flex">
                      <Link
                        to={`/preview/${page.id}`}
                        className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold text-muted-foreground hover:text-primary hover:bg-accent/50 transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Preview
                      </Link>
                      <div className="w-px bg-border/60" />
                      <Link
                        to={`/editor/${page.id}`}
                        className="flex-1 flex items-center justify-center gap-2 py-3 text-xs font-semibold text-muted-foreground hover:text-primary hover:bg-accent/50 transition-all"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </Link>
                      <div className="w-px bg-border/60" />
                      <button
                        onClick={(e) => handleDelete(e, page.id)}
                        className="px-4 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* New page card */}
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: filtered.length * 0.05 }}>
              <Link
                to="/editor/new"
                className="flex flex-col items-center justify-center gap-3 p-8 rounded-2xl border-2 border-dashed border-border/60 hover:border-primary/40 hover:bg-accent/30 transition-all duration-300 text-center min-h-[180px] group"
              >
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <Plus className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">New Page</p>
                  <p className="text-xs text-muted-foreground mt-1">Pick a shell and start building</p>
                </div>
              </Link>
            </motion.div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}