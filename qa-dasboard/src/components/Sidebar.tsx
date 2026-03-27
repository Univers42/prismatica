import { FolderOpen, PlayCircle, BarChart2, Edit, Settings, HelpCircle, Zap, Box } from 'lucide-react';

interface SidebarProps {
  currentView: string;
  setCurrentView: (view: string) => void;
}

export function Sidebar({ currentView, setCurrentView }: SidebarProps) {
  const navItems = [
    { id: 'explorer', label: 'Explorer', icon: FolderOpen },
    { id: 'runner', label: 'Runner', icon: PlayCircle },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'editor', label: 'Editor', icon: Edit },
  ];

  return (
    <aside className="h-screen w-64 fixed left-0 top-0 overflow-y-auto bg-surface border-r border-outline/15 flex flex-col py-6 z-50">
      {/* Header */}
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-container to-primary flex items-center justify-center">
          <Box className="text-background w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-primary tracking-tight">Prismatica</h1>
          <p className="text-[0.6875rem] font-medium tracking-wider uppercase text-on-surface-variant">QA Studio</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const isActive = currentView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`w-full flex items-center gap-3 px-6 py-3 transition-all duration-200 ${
                isActive
                  ? 'text-primary bg-primary-container/10 border-r-2 border-primary-container'
                  : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-high'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[0.6875rem] font-medium tracking-wider uppercase">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* CTA */}
      <div className="px-4 my-6">
        <button 
          onClick={() => setCurrentView('runner')}
          className="w-full py-3 rounded-xl bg-gradient-to-br from-primary-container to-primary-container/80 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg hover:scale-[1.02] transition-transform"
        >
          <Zap className="w-4 h-4 fill-current" />
          Run Suite
        </button>
      </div>

      {/* Footer */}
      <div className="mt-auto border-t border-outline/15 pt-4">
        <button className="w-full flex items-center gap-3 px-6 py-3 text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-all duration-200">
          <Settings className="w-5 h-5" />
          <span className="text-[0.6875rem] font-medium tracking-wider uppercase">Settings</span>
        </button>
        <button className="w-full flex items-center gap-3 px-6 py-3 text-on-surface-variant hover:text-on-surface hover:bg-surface-high transition-all duration-200">
          <HelpCircle className="w-5 h-5" />
          <span className="text-[0.6875rem] font-medium tracking-wider uppercase">Support</span>
        </button>
      </div>
    </aside>
  );
}
