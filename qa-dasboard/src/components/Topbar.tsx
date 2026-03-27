import { Search, Bell } from 'lucide-react';

export function Topbar() {
  return (
    <header className="fixed top-0 right-0 left-64 h-16 z-40 bg-background/80 backdrop-blur-xl border-b border-outline/15 flex justify-between items-center px-8">
      <div className="flex items-center gap-8">
        <nav className="flex items-center gap-6">
          <a href="#" className="text-primary font-semibold border-b-2 border-primary-container pb-1 text-sm">All Tests</a>
          <a href="#" className="text-on-surface-variant hover:text-on-surface hover:bg-surface-high/50 rounded-lg transition-all px-2 py-1 text-sm">Recent</a>
          <a href="#" className="text-on-surface-variant hover:text-on-surface hover:bg-surface-high/50 rounded-lg transition-all px-2 py-1 text-sm">Favorites</a>
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search tests..." 
            className="bg-surface-highest border-none rounded-lg py-1.5 pl-10 pr-4 text-sm w-64 focus:ring-1 focus:ring-primary transition-all outline-none text-on-surface placeholder:text-on-surface-variant/50"
          />
        </div>
        <div className="flex items-center gap-3 border-l border-outline/30 pl-4">
          <button className="p-2 text-on-surface-variant hover:text-primary transition-colors">
            <Bell className="w-5 h-5" />
          </button>
          <div className="h-8 w-8 rounded-full overflow-hidden bg-surface-high border border-outline/50">
            <img 
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=Felix" 
              alt="User" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </header>
  );
}
