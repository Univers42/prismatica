import { useState } from 'react';
import { X, Trash2, Link, Unlink, ChevronDown } from 'lucide-react';
import { MOCK_VIEWS, MOCK_COLLECTIONS, COMPONENT_REGISTRY } from '@/lib/mockData';
import { cn } from '@/lib/utils';

export default function ConfigPanel({ record, onUpdate, onDelete, onClose }) {
  const [activeTab, setActiveTab] = useState('props');

  if (!record) return null;

  const typeDef = COMPONENT_REGISTRY.find(c => c.typeId === record.typeId);
  const props = record.props || {};
  const dataBinding = record.dataBinding;

  const updateProp = (key, value) => {
    onUpdate({ ...record, props: { ...props, [key]: value } });
  };

  const bindView = (viewId) => {
    const view = MOCK_VIEWS.find(v => v.id === viewId);
    if (view) {
      onUpdate({ ...record, dataBinding: { viewId: view.id, collectionId: view.collectionId } });
    }
  };

  const compatibleViews = MOCK_VIEWS.filter(v => {
    if (record.typeId.includes('chart.line') || record.typeId.includes('chart.area')) return v.type === 'chart.line' || v.type === 'chart.area';
    if (record.typeId.includes('chart.bar')) return v.type === 'chart.bar';
    if (record.typeId.includes('chart.pie')) return v.type === 'chart.pie';
    if (record.typeId.includes('table')) return v.type === 'table';
    if (record.typeId.includes('kanban')) return v.type === 'kanban';
    return true;
  });

  return (
    <div className="w-72 bg-card border-l border-border flex flex-col h-full overflow-hidden animate-slide-in-right">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{typeDef?.name || record.typeId}</h3>
          <p className="text-xs text-muted-foreground font-mono">{record.typeId}</p>
        </div>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border px-4 flex-shrink-0">
        {['props', 'data'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              'py-2.5 px-1 mr-4 text-xs font-semibold border-b-2 transition-all capitalize',
              activeTab === tab ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {tab === 'data' ? 'Data Binding' : 'Properties'}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-4">
        {activeTab === 'props' && (
          <div className="space-y-3">
            {Object.entries(props).map(([key, value]) => {
              if (key === 'trendDirection') return null;
              return (
                <div key={key}>
                  <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                    {key.replace(/_/g, ' ')}
                  </label>
                  {typeof value === 'boolean' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateProp(key, !value)}
                        className={cn(
                          'relative w-9 h-5 rounded-full transition-colors',
                          value ? 'bg-primary' : 'bg-muted'
                        )}
                      >
                        <span className={cn('absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all', value ? 'left-4' : 'left-0.5')} />
                      </button>
                      <span className="text-xs text-muted-foreground">{value ? 'On' : 'Off'}</span>
                    </div>
                  ) : key === 'trendDirection' ? (
                    <select
                      value={String(value)}
                      onChange={e => updateProp(key, e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-muted/50 rounded-lg border border-border/60 focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="up">Up</option>
                      <option value="down">Down</option>
                      <option value="neutral">Neutral</option>
                    </select>
                  ) : (
                    <input
                      type="text"
                      value={String(value)}
                      onChange={e => updateProp(key, e.target.value)}
                      className="w-full px-3 py-1.5 text-xs bg-muted/50 rounded-lg border border-border/60 focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                    />
                  )}
                </div>
              );
            })}

            {/* Trend direction special case */}
            {props.hasOwnProperty('trendDirection') && (
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Trend Direction</label>
                <select
                  value={props.trendDirection}
                  onChange={e => updateProp('trendDirection', e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-muted/50 rounded-lg border border-border/60 focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="up">Up (positive)</option>
                  <option value="down">Down (negative)</option>
                  <option value="neutral">Neutral</option>
                </select>
              </div>
            )}
          </div>
        )}

        {activeTab === 'data' && (
          <div className="space-y-4">
            {typeDef?.supportsBinding ? (
              <>
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Current Binding</p>
                  {dataBinding ? (
                    <div className="flex items-center gap-2 p-3 bg-accent rounded-xl border border-primary/20">
                      <Link className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-primary truncate">
                          {MOCK_VIEWS.find(v => v.id === dataBinding.viewId)?.name || dataBinding.viewId}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {MOCK_COLLECTIONS.find(c => c.id === dataBinding.collectionId)?.name}
                        </p>
                      </div>
                      <button
                        onClick={() => onUpdate({ ...record, dataBinding: null })}
                        className="text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Unlink className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <div className="p-3 bg-muted/30 rounded-xl border border-dashed border-border/60 text-center">
                      <Unlink className="w-4 h-4 text-muted-foreground/40 mx-auto mb-1" />
                      <p className="text-xs text-muted-foreground/60">Not bound to any view</p>
                    </div>
                  )}
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Compatible Views</p>
                  <div className="space-y-1.5">
                    {compatibleViews.map(view => {
                      const col = MOCK_COLLECTIONS.find(c => c.id === view.collectionId);
                      const isActive = dataBinding?.viewId === view.id;
                      return (
                        <button
                          key={view.id}
                          onClick={() => bindView(view.id)}
                          className={cn(
                            'w-full text-left p-3 rounded-xl border transition-all duration-150 text-xs',
                            isActive
                              ? 'bg-accent border-primary/40 text-primary'
                              : 'border-border/60 hover:border-primary/30 hover:bg-accent/50 text-foreground'
                          )}
                        >
                          <p className="font-semibold">{view.name}</p>
                          <p className="text-muted-foreground mt-0.5">{col?.name} · {view.type}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-6">
                <Unlink className="w-6 h-6 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">This component doesn't support data binding</p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-border flex-shrink-0">
        <button
          onClick={() => onDelete(record.id)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-destructive bg-destructive/10 hover:bg-destructive/20 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Remove Component
        </button>
      </div>
    </div>
  );
}