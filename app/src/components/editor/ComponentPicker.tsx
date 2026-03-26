import { useState } from 'react';
import { Search, X, TrendingUp, LineChart, BarChart2, PieChart, AreaChart, Table, Kanban, Gauge, Activity, FileText, Heading, Minus, Bell, Image, PanelTop, ChevronsUpDown, ChevronRight, ExternalLink, Box } from 'lucide-react';
import { COMPONENT_REGISTRY } from '@/lib/mockData';
import { cn } from '@/lib/utils';

const ICON_MAP = {
  TrendingUp, LineChart, BarChart2, PieChart, AreaChart, Table, Kanban, Gauge,
  Activity, FileText, Heading, Minus, Bell, Image, PanelTop, ChevronsUpDown,
  ChevronRight, ExternalLink, Box,
};

const CATEGORIES = ['Widget', 'Content', 'Layout', 'Navigation'];

export default function ComponentPicker({ onDragStart, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('Widget');

  const filtered = COMPONENT_REGISTRY.filter(c => {
    if (search) {
      return c.name.toLowerCase().includes(search.toLowerCase()) ||
             c.description.toLowerCase().includes(search.toLowerCase());
    }
    return c.category === activeCategory;
  });

  return (
    <div className="w-64 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[calc(100vh-120px)]">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Components</h3>
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search components..."
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/50 rounded-lg border border-border/60 focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      {!search && (
        <div className="flex px-3 py-2 gap-1 border-b border-border flex-wrap">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={cn(
                'px-2.5 py-1 rounded-lg text-xs font-medium transition-all',
                activeCategory === cat ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
        {filtered.map(component => {
          const Icon = ICON_MAP[component.icon] || Box;
          return (
            <div
              key={component.typeId}
              draggable
              onDragStart={() => onDragStart(component)}
              onClick={() => onSelect(component)}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-accent cursor-grab active:cursor-grabbing transition-all duration-150 group"
            >
              <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', component.color)}>
                <Icon className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{component.name}</p>
                <p className="text-xs text-muted-foreground truncate">{component.description}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}