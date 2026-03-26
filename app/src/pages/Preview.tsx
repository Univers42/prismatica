import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Edit3, ArrowLeft, RefreshCw, Clock, Tag } from 'lucide-react';
import { store } from '@/lib/mockData';
import AppShell from '@/components/layout/AppShell';
import PageRenderer from '@/components/renderer/PageRenderer';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

export default function Preview() {
  const { pageId } = useParams();
  const [page, setPage] = useState(() => store.getPage(pageId));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    // Simulate async data hydration
    const t = setTimeout(() => {
      setPage(store.getPage(pageId));
      setIsLoading(false);
    }, 600);
    return () => clearTimeout(t);
  }, [pageId]);

  useEffect(() => {
    return store.subscribe(() => setPage(store.getPage(pageId)));
  }, [pageId]);

  if (!page) return (
    <AppShell>
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <p className="text-5xl mb-4">🔍</p>
          <p className="font-semibold">Page not found</p>
          <Link to="/" className="text-sm text-primary mt-2 block hover:underline">← Back to pages</Link>
        </div>
      </div>
    </AppShell>
  );

  return (
    <AppShell>
      <div className="flex flex-col h-full overflow-hidden">
        {/* Preview toolbar */}
        <div className="bg-card border-b border-border px-6 py-3 flex items-center gap-4 flex-shrink-0">
          <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center gap-2.5">
            <span className="text-xl">{page.icon}</span>
            <div>
              <h1 className="text-sm font-semibold text-foreground leading-none">{page.name}</h1>
              {page.description && <p className="text-xs text-muted-foreground mt-0.5">{page.description}</p>}
            </div>
          </div>

          {page.tags?.length > 0 && (
            <div className="flex items-center gap-1.5 ml-2">
              {page.tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                  <Tag className="w-2.5 h-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          <div className="ml-auto flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse-slow" />
              Live
            </div>
            <Link
              to={`/editor/${page.id}`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-white hover:bg-primary/90 transition-all"
            >
              <Edit3 className="w-3.5 h-3.5" />
              Edit
            </Link>
          </div>
        </div>

        {/* Page content */}
        <div className="flex-1 overflow-auto bg-surface-2">
          {isLoading ? (
            <div className="p-6">
              <div className="grid gap-4 animate-pulse" style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}>
                {[3, 3, 3, 3, 8, 4, 12].map((span, i) => (
                  <div
                    key={i}
                    className="bg-muted rounded-xl"
                    style={{ gridColumn: `span ${span}`, height: span >= 8 ? '280px' : '130px' }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.3 }}
            >
              <PageRenderer page={page} isEditing={false} />
            </motion.div>
          )}
        </div>
      </div>
    </AppShell>
  );
}