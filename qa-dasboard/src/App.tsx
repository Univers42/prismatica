import { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Topbar } from './components/Topbar';
import { Explorer } from './views/Explorer';
import { Runner } from './views/Runner';
import { Analytics } from './views/Analytics';
import { Editor } from './views/Editor';

export default function App() {
  const [currentView, setCurrentView] = useState('explorer');

  return (
    <div className="min-h-screen bg-background text-on-surface font-sans selection:bg-primary-container selection:text-on-primary-container">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      <Topbar />
      
      <main className="pl-64 pt-16 min-h-screen">
        <div className="p-8 max-w-[1600px] mx-auto">
          {currentView === 'explorer' && <Explorer setCurrentView={setCurrentView} />}
          {currentView === 'runner' && <Runner />}
          {currentView === 'analytics' && <Analytics />}
          {currentView === 'editor' && <Editor />}
        </div>
      </main>
    </div>
  );
}
