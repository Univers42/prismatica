import { useState } from 'react';
import { Database, ChevronRight, Hash, Calendar, Type, List, Circle } from 'lucide-react';
import { MOCK_COLLECTIONS } from '@/lib/mockData';
import AppShell from '@/components/layout/AppShell';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const FIELD_ICONS = { text: Type, number: Hash, date: Calendar, select: List };
const FIELD_COLORS = {
  text: 'text-blue-500 bg-blue-100 dark:bg-blue-950',
  number: 'text-violet-500 bg-violet-100 dark:bg-violet-950',
  date: 'text-amber-500 bg-amber-100 dark:bg-amber-950',
  select: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-950',
};

export default function Collections() {
  const [selectedId, setSelectedId] = useState(MOCK_COLLECTIONS[0]?.id);
  const selected = MOCK_COLLECTIONS.find(c => c.id === selectedId);

  return (
    <AppShell>
      <div className="flex h-full overflow-hidden">
        {/* Collection list */}
        <div className="w-64 flex-shrink-0 bg-card border-r border-border flex flex-col">
          <div className="px-4 py-4 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Collections</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Structured data tables</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {MOCK_COLLECTIONS.map(col => (
              <button
                key={col.id}
                onClick={() => setSelectedId(col.id)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all',
                  selectedId === col.id ? 'bg-accent text-primary' : 'hover:bg-accent/50 text-foreground'
                )}
              >
                <Database className="w-4 h-4 flex-shrink-0 opacity-60" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{col.name}</p>
                  <p className="text-xs text-muted-foreground">{col.rows.length} rows · {col.fields.length} fields</p>
                </div>
                <ChevronRight className={cn('w-3.5 h-3.5 opacity-40 transition-transform', selectedId === col.id && 'rotate-90 opacity-60')} />
              </button>
            ))}
          </div>
        </div>

        {/* Collection detail */}
        {selected && (
          <div className="flex-1 overflow-auto bg-surface-2">
            <div className="px-6 py-5 bg-card border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Database className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">{selected.name}</h1>
                  <p className="text-sm text-muted-foreground">{selected.rows.length} rows · {selected.fields.length} fields</p>
                </div>
              </div>

              {/* Fields */}
              <div className="mt-4 flex flex-wrap gap-2">
                {selected.fields.map(field => {
                  const Icon = FIELD_ICONS[field.type] || Circle;
                  return (
                    <div key={field.id} className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold', FIELD_COLORS[field.type] || 'bg-muted text-muted-foreground')}>
                      <Icon className="w-3 h-3" />
                      {field.name}
                      <span className="opacity-60 font-normal">· {field.type}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Data table */}
            <div className="p-6">
              <div className="bg-card rounded-2xl border border-border/60 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide w-10">#</th>
                        {selected.fields.map(field => (
                          <th key={field.id} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {(() => { const Icon = FIELD_ICONS[field.type] || Circle; return <Icon className="w-3 h-3" />; })()}
                              {field.name}
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/40">
                      {selected.rows.map((row, i) => (
                        <motion.tr
                          key={i}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03 }}
                          className="hover:bg-muted/20 transition-colors"
                        >
                          <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{i + 1}</td>
                          {selected.fields.map(field => (
                            <td key={field.id} className="px-4 py-3 text-sm text-foreground/80">
                              {field.type === 'select' ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                                  {row[field.name]}
                                </span>
                              ) : typeof row[field.name] === 'number' ? (
                                <span className="font-mono font-medium">{row[field.name].toLocaleString()}</span>
                              ) : (
                                row[field.name]
                              )}
                            </td>
                          ))}
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}