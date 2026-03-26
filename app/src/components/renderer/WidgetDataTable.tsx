import { useState } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { store } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const STATUS_COLORS = {
  'Done': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
  'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
  'Review': 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
  'Backlog': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};
const PRIORITY_COLORS = {
  'Critical': 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
  'High': 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  'Medium': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-400',
  'Low': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

export default function WidgetDataTable({ props, dataBinding }) {
  const { title, pageSize = 6 } = props;
  const [sortField, setSortField] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(0);

  let data = [];
  let columns = [];
  if (dataBinding?.collectionId) {
    const col = store.getCollectionData(dataBinding.collectionId);
    data = [...col];
    if (data.length > 0) columns = Object.keys(data[0]);
  }

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  if (sortField) {
    data.sort((a, b) => {
      const av = a[sortField], bv = b[sortField];
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const totalPages = Math.ceil(data.length / pageSize);
  const pageData = data.slice(page * pageSize, (page + 1) * pageSize);

  const formatValue = (col, val) => {
    if (col === 'status' && STATUS_COLORS[val]) {
      return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', STATUS_COLORS[val])}>{val}</span>;
    }
    if (col === 'priority' && PRIORITY_COLORS[val]) {
      return <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', PRIORITY_COLORS[val])}>{val}</span>;
    }
    if (typeof val === 'number') return val > 999 ? `$${(val / 1000).toFixed(1)}k` : val.toLocaleString();
    return val;
  };

  return (
    <div className="bg-card rounded-xl h-full flex flex-col border border-border/60 overflow-hidden hover:border-primary/30 transition-all duration-200 hover:shadow-md">
      <div className="px-5 py-4 border-b border-border/60 flex-shrink-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 sticky top-0">
            <tr>
              {columns.map(col => (
                <th
                  key={col}
                  onClick={() => handleSort(col)}
                  className="px-4 py-2.5 text-left font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground select-none whitespace-nowrap"
                >
                  <div className="flex items-center gap-1">
                    {col.replace(/_/g, ' ')}
                    {sortField === col
                      ? sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      : <ChevronsUpDown className="w-3 h-3 opacity-30" />
                    }
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {pageData.map((row, i) => (
              <tr key={i} className="hover:bg-muted/30 transition-colors">
                {columns.map(col => (
                  <td key={col} className="px-4 py-2.5 text-foreground/80 whitespace-nowrap">
                    {formatValue(col, row[col])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-5 py-3 border-t border-border/60 flex-shrink-0">
          <p className="text-xs text-muted-foreground">{data.length} rows</p>
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
              className="px-2 py-1 rounded text-xs disabled:opacity-30 hover:bg-muted transition-colors">←</button>
            <span className="text-xs text-muted-foreground px-2">{page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
              className="px-2 py-1 rounded text-xs disabled:opacity-30 hover:bg-muted transition-colors">→</button>
          </div>
        </div>
      )}
    </div>
  );
}