import { store } from '@/lib/mockData';
import { cn } from '@/lib/utils';

const COLUMNS = ['Backlog', 'In Progress', 'Review', 'Done'];
const COL_COLORS = {
  'Backlog': 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  'In Progress': 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
  'Review': 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
  'Done': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
};
const PRIORITY_DOTS = {
  'Critical': 'bg-red-500',
  'High': 'bg-orange-400',
  'Medium': 'bg-yellow-400',
  'Low': 'bg-slate-300',
};

export default function WidgetKanban({ props, dataBinding }) {
  const { title, groupField = 'status' } = props;

  let data = [];
  if (dataBinding?.collectionId) {
    data = store.getCollectionData(dataBinding.collectionId);
  }

  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col] = data.filter(row => row[groupField] === col);
    return acc;
  }, {});

  return (
    <div className="bg-card rounded-xl h-full flex flex-col border border-border/60 overflow-hidden hover:border-primary/30 transition-all duration-200">
      <div className="px-5 py-4 border-b border-border/60 flex-shrink-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
      </div>
      <div className="flex-1 overflow-x-auto p-4">
        <div className="flex gap-3 h-full min-w-max">
          {COLUMNS.map(col => (
            <div key={col} className="w-56 flex flex-col gap-2">
              <div className="flex items-center gap-2 mb-1">
                <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', COL_COLORS[col])}>{col}</span>
                <span className="text-xs text-muted-foreground ml-auto">{grouped[col].length}</span>
              </div>
              <div className="space-y-2 flex-1">
                {grouped[col].map((task, i) => (
                  <div key={i} className="bg-background rounded-lg p-3 border border-border/60 hover:border-primary/40 hover:shadow-sm cursor-pointer transition-all duration-150 animate-fade-in">
                    <p className="text-xs font-medium text-foreground leading-snug">{task.title}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', PRIORITY_DOTS[task.priority] || 'bg-slate-300')} />
                      <span className="text-xs text-muted-foreground">{task.priority}</span>
                      {task.assignee && (
                        <span className="ml-auto text-xs text-muted-foreground truncate max-w-[70px]">{task.assignee?.split(' ')[0]}</span>
                      )}
                    </div>
                    {task.due_date && (
                      <p className="text-xs text-muted-foreground/60 mt-1.5">{task.due_date}</p>
                    )}
                  </div>
                ))}
                {grouped[col].length === 0 && (
                  <div className="h-16 rounded-lg border-2 border-dashed border-border/40 flex items-center justify-center">
                    <p className="text-xs text-muted-foreground/40">Empty</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}