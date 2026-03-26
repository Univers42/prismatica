// Renders a full page from its metadata record
import { store } from '@/lib/mockData';
import ComponentRenderer from './ComponentRenderer';
import { cn } from '@/lib/utils';

const SLOT_HEIGHT = {
  1: 'h-36',
  2: 'h-72',
  3: 'h-96',
};

export default function PageRenderer({ page, isEditing = false, selectedComponentId = null, onSelectComponent = undefined as any, onDropToSlot = undefined as any, dragOverSlot = null as any, setDragOverSlot = undefined as any }: any) {
  if (!page) return null;

  const shell = store.getShell(page.shellId);
  if (!shell) return <div className="p-8 text-muted-foreground">Shell not found: {page.shellId}</div>;

  const getRecord = (slotId) => page.componentRecords?.find(r => r.slotId === slotId);

  return (
    <div
      className={cn(
        'grid gap-4 p-4 auto-rows-auto',
        `grid-cols-12`
      )}
      style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}
    >
      {shell.slots.map(slot => {
        const record = getRecord(slot.id);
        const isDragOver = dragOverSlot === slot.id;

        return (
          <div
            key={slot.id}
            style={{
              gridColumn: `span ${slot.colSpan}`,
              gridRow: `span ${slot.rowSpan || 1}`,
              minHeight: slot.rowSpan >= 2 ? '300px' : slot.rowSpan >= 3 ? '420px' : '140px',
            }}
            className={cn(
              'transition-all duration-200',
              isEditing && !record && 'cursor-pointer',
            )}
            onDragOver={isEditing ? (e) => { e.preventDefault(); setDragOverSlot?.(slot.id); } : undefined}
            onDragLeave={isEditing ? () => setDragOverSlot?.(null) : undefined}
            onDrop={isEditing ? (e) => { e.preventDefault(); onDropToSlot?.(slot.id); setDragOverSlot?.(null); } : undefined}
          >
            {record ? (
              <div className="h-full">
                <ComponentRenderer
                  record={record}
                  isEditing={isEditing}
                  isSelected={selectedComponentId === record.id}
                  onClick={() => onSelectComponent?.(record)}
                />
              </div>
            ) : isEditing ? (
              <div
                className={cn(
                  'h-full min-h-[140px] rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all duration-200',
                  isDragOver
                    ? 'border-primary bg-accent text-primary'
                    : 'border-border/50 bg-slot-empty/30 text-muted-foreground/40 hover:border-primary/40 hover:bg-slot-hover/30 hover:text-primary/60'
                )}
              >
                <div className="w-8 h-8 rounded-lg border-2 border-dashed border-current flex items-center justify-center">
                  <span className="text-lg leading-none">+</span>
                </div>
                <p className="text-xs font-medium">{slot.name}</p>
                <p className="text-xs opacity-60">Drop a component here</p>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}