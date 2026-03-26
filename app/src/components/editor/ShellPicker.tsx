import { MOCK_SHELLS } from '@/lib/mockData';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

const ShellPreview = ({ shell }) => {
  const preview = shell.slots.slice(0, 6);
  return (
    <div className="grid gap-0.5 bg-muted/50 rounded-lg p-1.5" style={{ gridTemplateColumns: 'repeat(12, 1fr)', gridTemplateRows: 'repeat(3, 12px)' }}>
      {preview.map((slot, i) => (
        <div
          key={slot.id}
          className="bg-primary/30 rounded-sm"
          style={{
            gridColumn: `span ${Math.min(slot.colSpan, 12)}`,
            gridRow: `span ${Math.min(slot.rowSpan || 1, 3)}`,
          }}
        />
      ))}
    </div>
  );
};

export default function ShellPicker({ selectedShellId, onSelect }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {MOCK_SHELLS.map(shell => {
        const isSelected = shell.id === selectedShellId;
        return (
          <button
            key={shell.id}
            onClick={() => onSelect(shell.id)}
            className={cn(
              'relative text-left p-3 rounded-xl border-2 transition-all duration-200 hover:border-primary/50 hover:shadow-md',
              isSelected ? 'border-primary bg-accent shadow-md' : 'border-border bg-card hover:bg-accent/30'
            )}
          >
            {isSelected && (
              <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            )}
            <ShellPreview shell={shell} />
            <p className="text-xs font-semibold text-foreground mt-2">{shell.name}</p>
            <p className="text-xs text-muted-foreground leading-tight mt-0.5">{shell.description}</p>
            <p className="text-xs text-muted-foreground/50 mt-1">{shell.slots.length} slots</p>
          </button>
        );
      })}
    </div>
  );
}