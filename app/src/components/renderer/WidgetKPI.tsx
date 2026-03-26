import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function WidgetKPI({ props }) {
  const { title, value, trend, trendDirection, prefix = '', suffix = '' } = props;

  const isUp = trendDirection === 'up';
  const isDown = trendDirection === 'down';

  return (
    <div className="bg-card rounded-xl p-5 h-full flex flex-col justify-between border border-border/60 hover:border-primary/30 transition-all duration-200 hover:shadow-md">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div className={cn(
          'flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full',
          isUp && 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
          isDown && 'bg-red-50 text-red-600 dark:bg-red-950 dark:text-red-400',
          !isUp && !isDown && 'bg-muted text-muted-foreground'
        )}>
          {isUp && <TrendingUp className="w-3 h-3" />}
          {isDown && <TrendingDown className="w-3 h-3" />}
          {!isUp && !isDown && <Minus className="w-3 h-3" />}
          {trend}
        </div>
      </div>

      <div className="mt-3">
        <p className="text-3xl font-bold tracking-tight text-foreground">
          {prefix}{value}{suffix}
        </p>
        <p className="text-xs text-muted-foreground mt-1">vs. previous period</p>
      </div>
    </div>
  );
}