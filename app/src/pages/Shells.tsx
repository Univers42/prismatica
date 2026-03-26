import { useState } from 'react';
import { Layers, Grid3x3, Check } from 'lucide-react';
import { MOCK_SHELLS } from '@/lib/mockData';
import AppShell from '@/components/layout/AppShell';
import { cn } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

function ShellDiagram({ shell }) {
  return (
    <div
      className="grid gap-1.5 bg-muted/40 rounded-xl p-3"
      style={{ gridTemplateColumns: 'repeat(12, 1fr)', gridTemplateRows: 'repeat(4, 28px)' }}
    >
      {shell.slots.map((slot, i) => {
        const colors = [
          'bg-primary/25 border border-primary/30',
          'bg-violet-400/20 border border-violet-400/30',
          'bg-blue-400/20 border border-blue-400/30',
          'bg-emerald-400/20 border border-emerald-400/30',
          'bg-amber-400/20 border border-amber-400/30',
          'bg-pink-400/20 border border-pink-400/30',
          'bg-teal-400/20 border border-teal-400/30',
        ];
        return (
          <div
            key={slot.id}
            className={cn('rounded-lg flex items-center justify-center', colors[i % colors.length])}
            style={{
              gridColumn: `span ${Math.min(slot.colSpan, 12)}`,
              gridRow: `span ${Math.min(slot.rowSpan || 1, 4)}`,
            }}
          >
            <span className="text-xs text-foreground/40 font-mono truncate px-1">{slot.name}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Shells() {
  const [selected, setSelected] = useState(null);

  return (
    <AppShell>
      <div className="min-h-full bg-surface-2">
        <div className="bg-card border-b border-border px-8 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-foreground">Layout Shells</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Slot topologies — the structural skeletons for your pages</p>
            </div>
            <Link
              to="/editor/new"
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all"
            >
              <Grid3x3 className="w-4 h-4" />
              Use a Shell
            </Link>
          </div>
        </div>

        <div className="px-8 py-6 max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {MOCK_SHELLS.map((shell, i) => (
              <motion.div
                key={shell.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                onClick={() => setSelected(s => s === shell.id ? null : shell.id)}
                className={cn(
                  'bg-card rounded-2xl border-2 cursor-pointer transition-all duration-200 overflow-hidden hover:shadow-lg hover:shadow-primary/5',
                  selected === shell.id ? 'border-primary shadow-lg shadow-primary/10' : 'border-border/60 hover:border-primary/40'
                )}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-foreground">{shell.name}</h3>
                      <p className="text-xs text-muted-foreground mt-1">{shell.description}</p>
                    </div>
                    {selected === shell.id && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                        <Check className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                  </div>

                  <ShellDiagram shell={shell} />

                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">{shell.slots.length} slots</span>
                    <div className="flex gap-1 flex-wrap justify-end">
                      {shell.slots.slice(0, 4).map(slot => (
                        <span key={slot.id} className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground font-mono">
                          {slot.name}
                        </span>
                      ))}
                      {shell.slots.length > 4 && (
                        <span className="text-xs px-2 py-0.5 bg-muted rounded-full text-muted-foreground">+{shell.slots.length - 4}</span>
                      )}
                    </div>
                  </div>
                </div>

                {selected === shell.id && (
                  <div className="border-t border-border/60 bg-accent/50 px-5 py-3">
                    <Link
                      to="/editor/new"
                      className="text-xs font-semibold text-primary hover:underline"
                      onClick={e => e.stopPropagation()}
                    >
                      Create page with this shell →
                    </Link>
                  </div>
                )}
              </motion.div>
            ))}
          </div>

          {/* Concept explainer */}
          <div className="mt-8 bg-card rounded-2xl border border-border/60 p-6">
            <h2 className="text-sm font-bold text-foreground mb-3">What is a Shell?</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-muted-foreground">
              {[
                { title: 'Slot Topology', desc: 'A shell defines a set of named regions (slots) with size proportions. Not a visual template — a structural map.' },
                { title: 'CSS Grid Powered', desc: 'Each slot maps to a CSS grid span. The renderer uses this to lay out your placed components at runtime.' },
                { title: 'Metadata Only', desc: 'Shells are stored as records in the database, not as HTML. Changing a shell changes the entire page layout instantly.' },
              ].map(item => (
                <div key={item.title} className="space-y-1">
                  <p className="font-semibold text-foreground">{item.title}</p>
                  <p>{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}