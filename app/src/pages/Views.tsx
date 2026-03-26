import { useState } from 'react';
import { Eye, LineChart, BarChart2, PieChart, Table, Kanban, AreaChart, ChevronRight, Link as LinkIcon } from 'lucide-react';
import { MOCK_VIEWS, MOCK_COLLECTIONS, store } from '@/lib/mockData';
import AppShell from '@/components/layout/AppShell';
import { cn } from '@/lib/utils';
import WidgetLineChart from '@/components/renderer/WidgetLineChart';
import WidgetPieChart from '@/components/renderer/WidgetPieChart';
import WidgetDataTable from '@/components/renderer/WidgetDataTable';
import WidgetKanban from '@/components/renderer/WidgetKanban';

const VIEW_TYPE_META = {
  'chart.line': { icon: LineChart, label: 'Line Chart', color: 'text-blue-500 bg-blue-100 dark:bg-blue-950' },
  'chart.area': { icon: AreaChart, label: 'Area Chart', color: 'text-indigo-500 bg-indigo-100 dark:bg-indigo-950' },
  'chart.bar': { icon: BarChart2, label: 'Bar Chart', color: 'text-violet-500 bg-violet-100 dark:bg-violet-950' },
  'chart.pie': { icon: PieChart, label: 'Pie Chart', color: 'text-pink-500 bg-pink-100 dark:bg-pink-950' },
  'table': { icon: Table, label: 'Table', color: 'text-emerald-500 bg-emerald-100 dark:bg-emerald-950' },
  'kanban': { icon: Kanban, label: 'Kanban', color: 'text-amber-500 bg-amber-100 dark:bg-amber-950' },
};

function ViewPreview({ view }) {
  const col = MOCK_COLLECTIONS.find(c => c.id === view.collectionId);
  const binding = { viewId: view.id, collectionId: view.collectionId };
  const previewProps = { title: view.name, xKey: view.xKey, yKey: view.yKey, nameKey: view.nameKey, valueKey: view.valueKey, groupField: view.groupField };

  const wrapperClass = "h-72 w-full";

  if (view.type === 'chart.line') return <div className={wrapperClass}><WidgetLineChart props={previewProps} dataBinding={binding} chartType="line" /></div>;
  if (view.type === 'chart.area') return <div className={wrapperClass}><WidgetLineChart props={previewProps} dataBinding={binding} chartType="area" /></div>;
  if (view.type === 'chart.bar') return <div className={wrapperClass}><WidgetLineChart props={previewProps} dataBinding={binding} chartType="bar" /></div>;
  if (view.type === 'chart.pie') return <div className={wrapperClass}><WidgetPieChart props={previewProps} dataBinding={binding} /></div>;
  if (view.type === 'table') return <div className={wrapperClass}><WidgetDataTable props={{ title: view.name, pageSize: 5 }} dataBinding={binding} /></div>;
  if (view.type === 'kanban') return <div className={wrapperClass}><WidgetKanban props={{ title: view.name, groupField: view.groupField || 'status' }} dataBinding={binding} /></div>;
  return null;
}

export default function Views() {
  const [selectedId, setSelectedId] = useState(MOCK_VIEWS[0]?.id);
  const selected = MOCK_VIEWS.find(v => v.id === selectedId);

  return (
    <AppShell>
      <div className="flex h-full overflow-hidden">
        {/* Views list */}
        <div className="w-64 flex-shrink-0 bg-card border-r border-border flex flex-col">
          <div className="px-4 py-4 border-b border-border">
            <h2 className="text-sm font-bold text-foreground">Views</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Saved queries + display configs</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {MOCK_VIEWS.map(view => {
              const meta = VIEW_TYPE_META[view.type] || { icon: Eye, label: view.type, color: 'text-muted-foreground bg-muted' };
              const Icon = meta.icon;
              const col = MOCK_COLLECTIONS.find(c => c.id === view.collectionId);
              return (
                <button
                  key={view.id}
                  onClick={() => setSelectedId(view.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all',
                    selectedId === view.id ? 'bg-accent text-primary' : 'hover:bg-accent/50 text-foreground'
                  )}
                >
                  <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', meta.color)}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{view.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{col?.name}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* View detail */}
        {selected && (
          <div className="flex-1 overflow-auto bg-surface-2">
            <div className="px-6 py-5 bg-card border-b border-border">
              {(() => {
                const meta = VIEW_TYPE_META[selected.type] || { icon: Eye, label: selected.type, color: 'bg-muted text-muted-foreground' };
                const Icon = meta.icon;
                const col = MOCK_COLLECTIONS.find(c => c.id === selected.collectionId);
                return (
                  <div className="flex items-start gap-4">
                    <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0', meta.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <h1 className="text-lg font-bold text-foreground">{selected.name}</h1>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <LinkIcon className="w-3 h-3" />
                          {col?.name}
                        </span>
                        <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', meta.color)}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-3 mt-3 text-xs text-muted-foreground">
                        {selected.xKey && <span><span className="font-semibold text-foreground">X:</span> {selected.xKey}</span>}
                        {selected.yKey && <span><span className="font-semibold text-foreground">Y:</span> {selected.yKey}</span>}
                        {selected.nameKey && <span><span className="font-semibold text-foreground">Name:</span> {selected.nameKey}</span>}
                        {selected.valueKey && <span><span className="font-semibold text-foreground">Value:</span> {selected.valueKey}</span>}
                        {selected.groupField && <span><span className="font-semibold text-foreground">Group by:</span> {selected.groupField}</span>}
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-6">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Live Preview</p>
              <div className="bg-card rounded-2xl border border-border/60 p-4 shadow-sm">
                <ViewPreview view={selected} />
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}