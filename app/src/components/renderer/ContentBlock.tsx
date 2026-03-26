import { AlertCircle, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ContentHeading({ props }) {
  const { text, subtitle, level = 'h2' } = props;
  return (
    <div className="px-1 py-2 h-full flex flex-col justify-center">
      {level === 'h1' && <h1 className="text-3xl font-bold tracking-tight text-foreground">{text}</h1>}
      {level === 'h2' && <h2 className="text-2xl font-bold tracking-tight text-foreground">{text}</h2>}
      {level === 'h3' && <h3 className="text-xl font-semibold text-foreground">{text}</h3>}
      {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}

export function ContentDivider({ props }) {
  return <hr className="border-border/60 w-full my-2" />;
}

export function ContentAlert({ props }) {
  const { message = 'Alert message', variant = 'info', dismissible = true } = props;
  const styles = {
    info: { bg: 'bg-blue-50 dark:bg-blue-950/30', border: 'border-blue-200 dark:border-blue-800', text: 'text-blue-800 dark:text-blue-300', Icon: Info },
    success: { bg: 'bg-emerald-50 dark:bg-emerald-950/30', border: 'border-emerald-200 dark:border-emerald-800', text: 'text-emerald-800 dark:text-emerald-300', Icon: CheckCircle },
    warning: { bg: 'bg-amber-50 dark:bg-amber-950/30', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-800 dark:text-amber-300', Icon: AlertTriangle },
    error: { bg: 'bg-red-50 dark:bg-red-950/30', border: 'border-red-200 dark:border-red-800', text: 'text-red-800 dark:text-red-300', Icon: AlertCircle },
  };
  const s = styles[variant] || styles.info;
  return (
    <div className={cn('flex items-center gap-3 px-4 py-3 rounded-xl border text-sm', s.bg, s.border, s.text)}>
      <s.Icon className="w-4 h-4 flex-shrink-0" />
      <p>{message}</p>
    </div>
  );
}

export function ContentRichText({ props }) {
  const { content = '' } = props;
  return (
    <div className="bg-card rounded-xl p-5 h-full border border-border/60 overflow-auto">
      <div className="prose prose-sm dark:prose-invert max-w-none text-foreground">
        {content.split('\n').map((line, i) => {
          if (line.startsWith('# ')) return <h1 key={i} className="text-2xl font-bold mt-0">{line.slice(2)}</h1>;
          if (line.startsWith('## ')) return <h2 key={i} className="text-xl font-semibold">{line.slice(3)}</h2>;
          if (line.startsWith('### ')) return <h3 key={i} className="text-lg font-semibold">{line.slice(4)}</h3>;
          if (!line.trim()) return <br key={i} />;
          return <p key={i} className="text-sm text-muted-foreground leading-relaxed">{line}</p>;
        })}
      </div>
    </div>
  );
}