import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Save, Eye, ArrowLeft, Plus, Layers, ChevronRight, X } from 'lucide-react';
import { store, MOCK_SHELLS } from '@/lib/mockData';
import PageRenderer from '@/components/renderer/PageRenderer';
import ComponentPicker from '@/components/editor/ComponentPicker';
import ConfigPanel from '@/components/editor/ConfigPanel';
import ShellPicker from '@/components/editor/ShellPicker';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const EMOJI_OPTIONS = ['📊', '🗂️', '👥', '📈', '🎯', '🚀', '💡', '🏆', '📋', '🔮'];

export default function Editor() {
  const { pageId } = useParams();
  const navigate = useNavigate();
  const isNew = pageId === 'new';

  const [page, setPage] = useState(() => {
    if (isNew) return { id: `page-${Date.now()}`, name: 'Untitled Page', description: '', icon: '📊', shellId: 'shell-kpi-grid', tags: [], componentRecords: [] };
    const existing = store.getPage(pageId);
    return existing ? { ...existing, componentRecords: [...(existing.componentRecords || [])] } : null;
  });

  const [selectedComponent, setSelectedComponent] = useState(null);
  const [showPicker, setShowPicker] = useState(false);
  const [showShellPicker, setShowShellPicker] = useState(isNew);
  const [dragOverSlot, setDragOverSlot] = useState(null);
  const [draggingComponent, setDraggingComponent] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isNew && !page) navigate('/');
  }, []);

  if (!page) return null;

  const handleSave = async () => {
    setIsSaving(true);
    await new Promise(r => setTimeout(r, 400));
    store.savePage(page);
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleDropToSlot = (slotId) => {
    if (!draggingComponent) return;
    const existing = (page.componentRecords || []).find(r => r.slotId === slotId);
    if (existing) return;
    const newRecord = {
      id: `cr-${Date.now()}`,
      typeId: draggingComponent.typeId,
      slotId,
      props: { ...draggingComponent.defaultProps },
      dataBinding: null,
    };
    setPage(p => ({ ...p, componentRecords: [...(p.componentRecords || []), newRecord] }));
    setDraggingComponent(null);
  };

  const handleSelectComponent = (record) => {
    setSelectedComponent(record);
    setShowPicker(false);
  };

  const handleUpdateComponent = (updatedRecord) => {
    setPage(p => ({
      ...p,
      componentRecords: p.componentRecords.map(r => r.id === updatedRecord.id ? updatedRecord : r),
    }));
    setSelectedComponent(updatedRecord);
  };

  const handleDeleteComponent = (id) => {
    setPage(p => ({ ...p, componentRecords: p.componentRecords.filter(r => r.id !== id) }));
    setSelectedComponent(null);
  };

  const handleShellChange = (shellId) => {
    setPage(p => ({ ...p, shellId, componentRecords: [] }));
    setShowShellPicker(false);
    setSelectedComponent(null);
  };

  const placeInFirstEmptySlot = (comp) => {
    const shell = MOCK_SHELLS.find(s => s.id === page.shellId);
    if (!shell) return;
    const usedSlots = (page.componentRecords || []).map(r => r.slotId);
    const emptySlot = shell.slots.find(s => !usedSlots.includes(s.id));
    if (!emptySlot) return;
    const newRecord = {
      id: `cr-${Date.now()}`,
      typeId: comp.typeId,
      slotId: emptySlot.id,
      props: { ...comp.defaultProps },
      dataBinding: null,
    };
    setPage(p => ({ ...p, componentRecords: [...(p.componentRecords || []), newRecord] }));
    setShowPicker(false);
  };

  const currentShell = MOCK_SHELLS.find(s => s.id === page.shellId);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background font-inter">
      {/* Narrow sidebar */}
      <aside className="w-14 flex-shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col items-center py-3 gap-2 z-10">
        <Link to="/" className="w-9 h-9 rounded-xl flex items-center justify-center text-sidebar-foreground/60 hover:text-white hover:bg-white/10 transition-all" title="Back">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1" />
        <button
          onClick={() => { setShowPicker(p => !p); setSelectedComponent(null); }}
          className={cn('w-9 h-9 rounded-xl flex items-center justify-center transition-all', showPicker ? 'bg-primary text-white' : 'text-sidebar-foreground/60 hover:text-white hover:bg-white/10')}
          title="Add Component"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowShellPicker(true)}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-sidebar-foreground/60 hover:text-white hover:bg-white/10 transition-all"
          title="Change Shell"
        >
          <Layers className="w-4 h-4" />
        </button>
        <div className="flex-1" />
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Top bar */}
        <div className="h-12 bg-card border-b border-border flex items-center px-4 gap-4 flex-shrink-0 z-20">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="text-lg">{page.icon}</span>
            <input
              value={page.name}
              onChange={e => setPage(p => ({ ...p, name: e.target.value }))}
              className="text-sm font-semibold bg-transparent border-none outline-none text-foreground max-w-[220px] focus:ring-1 focus:ring-primary/40 rounded px-1 py-0.5"
            />
            <span className="text-muted-foreground/40 text-xs hidden sm:block">·</span>
            <span className="text-xs text-muted-foreground hidden sm:block">{currentShell?.name}</span>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={`/preview/${page.id}`}
              onClick={handleSave}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </Link>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={cn(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all',
                saved ? 'bg-emerald-500 text-white' : 'bg-primary text-white hover:bg-primary/90',
              )}
            >
              <Save className="w-3.5 h-3.5" />
              {isSaving ? 'Saving…' : saved ? 'Saved!' : 'Save'}
            </button>
          </div>
        </div>

        {/* Canvas + panels */}
        <div className="flex-1 flex overflow-hidden">
          {/* Component picker overlay */}
          <AnimatePresence>
            {showPicker && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                className="absolute left-3 top-14 z-30"
              >
                <ComponentPicker
                  onDragStart={setDraggingComponent}
                  onSelect={placeInFirstEmptySlot}
                  onClose={() => setShowPicker(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Canvas */}
          <div className="flex-1 overflow-auto bg-canvas p-6">
            <div className="min-h-full bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
              <PageRenderer
                page={page}
                isEditing={true}
                selectedComponentId={selectedComponent?.id}
                onSelectComponent={handleSelectComponent}
                onDropToSlot={handleDropToSlot}
                dragOverSlot={dragOverSlot}
                setDragOverSlot={setDragOverSlot}
              />
            </div>
          </div>

          {/* Config panel */}
          <AnimatePresence>
            {selectedComponent && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="flex-shrink-0 h-full"
              >
                <ConfigPanel
                  record={selectedComponent}
                  onUpdate={handleUpdateComponent}
                  onDelete={handleDeleteComponent}
                  onClose={() => setSelectedComponent(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Shell picker modal */}
      <AnimatePresence>
        {showShellPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={(e) => { if (e.target === e.currentTarget && !isNew) setShowShellPicker(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 8 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card rounded-2xl border border-border shadow-2xl w-full max-w-2xl overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-foreground">{isNew ? 'Create New Page' : 'Change Shell'}</h2>
                  <p className="text-sm text-muted-foreground">Pick a layout shell to define available slots</p>
                </div>
                {!isNew && (
                  <button onClick={() => setShowShellPicker(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>

              {isNew && (
                <div className="px-6 py-4 border-b border-border space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Page Name</label>
                      <input
                        value={page.name}
                        onChange={e => setPage(p => ({ ...p, name: e.target.value }))}
                        className="w-full px-3 py-2 text-sm bg-muted/50 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="My Dashboard"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Description</label>
                      <input
                        value={page.description}
                        onChange={e => setPage(p => ({ ...p, description: e.target.value }))}
                        className="w-full px-3 py-2 text-sm bg-muted/50 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/30"
                        placeholder="Optional description"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Icon</label>
                    <div className="flex gap-2 flex-wrap">
                      {EMOJI_OPTIONS.map(emoji => (
                        <button
                          key={emoji}
                          onClick={() => setPage(p => ({ ...p, icon: emoji }))}
                          className={cn('w-9 h-9 rounded-xl text-xl flex items-center justify-center transition-all', page.icon === emoji ? 'bg-primary/20 ring-2 ring-primary' : 'bg-muted hover:bg-accent')}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="px-6 py-4 max-h-[50vh] overflow-y-auto scrollbar-thin">
                <ShellPicker selectedShellId={page.shellId} onSelect={handleShellChange} />
              </div>

              {isNew && (
                <div className="px-6 py-4 border-t border-border flex justify-end">
                  <button
                    onClick={() => page.shellId && setShowShellPicker(false)}
                    disabled={!page.shellId}
                    className="px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-40 flex items-center gap-2"
                  >
                    Start Building
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}