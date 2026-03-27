import { useState, useEffect, useRef } from 'react';
import { Play, Square, Terminal } from 'lucide-react';

export function Runner() {
  const [progress, setProgress] = useState(25);
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([
    { type: 'info', time: '10:42:01', text: 'Iniciando suite completa — 47 tests' },
    { type: 'info', time: '10:42:01', text: 'Dominio: auth (6 tests)' },
    { type: 'pass', time: '10:42:02', text: '✓ AUTH-001 — 201ms' },
    { type: 'fail', time: '10:42:03', text: '✗ AUTH-002 — expected 401, got 200' },
    { type: 'dim', time: '10:42:04', text: '  → body: {"error":"token_not_validated"}' },
    { type: 'info', time: '10:42:05', text: '⟳ AUTH-003 — running...' },
  ]);
  
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (consoleRef.current) {
      consoleRef.current.scrollTop = consoleRef.current.scrollHeight;
    }
  }, [logs]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isRunning) {
      interval = setInterval(() => {
        setProgress(p => {
          if (p >= 100) {
            setIsRunning(false);
            return 100;
          }
          return p + Math.random() * 10;
        });
        
        const isPass = Math.random() > 0.3;
        const time = new Date().toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const id = `API-00${Math.floor(Math.random() * 9) + 1}`;
        
        setLogs(prev => [...prev, {
          type: isPass ? 'pass' : 'fail',
          time,
          text: `${isPass ? '✓' : '✗'} ${id} — ${isPass ? Math.floor(Math.random() * 300 + 50) + 'ms' : 'expected 200, got 500'}`
        }]);
      }, 800);
    }
    return () => clearInterval(interval);
  }, [isRunning]);

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-on-surface mb-1">Runner</h2>
        <p className="text-sm text-on-surface-variant">Ejecución en vivo y feedback en tiempo real</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-surface-high p-5 rounded-xl">
          <div className="text-xs uppercase tracking-wider text-on-surface-variant font-medium mb-2">En cola</div>
          <div className="text-3xl font-bold text-on-surface">47</div>
        </div>
        <div className="bg-surface-high p-5 rounded-xl">
          <div className="text-xs uppercase tracking-wider text-on-surface-variant font-medium mb-2">Completados</div>
          <div className="text-3xl font-bold text-secondary">{Math.floor((progress / 100) * 47)}</div>
        </div>
        <div className="bg-surface-high p-5 rounded-xl">
          <div className="text-xs uppercase tracking-wider text-on-surface-variant font-medium mb-2">Fallidos</div>
          <div className="text-3xl font-bold text-error">2</div>
        </div>
        <div className="bg-surface-high p-5 rounded-xl">
          <div className="text-xs uppercase tracking-wider text-on-surface-variant font-medium mb-2">Progreso</div>
          <div className="text-3xl font-bold text-primary">{Math.round(progress)}%</div>
        </div>
      </div>

      <div className="bg-surface-highest rounded-full h-2 mb-8 overflow-hidden">
        <div 
          className="bg-primary h-full transition-all duration-300 ease-out" 
          style={{ width: `${progress}%` }}
        ></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-xl p-6 border border-outline/10">
          <h3 className="text-sm font-medium text-on-surface mb-4 pb-4 border-b border-outline/10">Cola de ejecución</h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-secondary"></div>
              <span className="font-mono text-xs text-on-surface-variant">AUTH-001</span>
              <span className="flex-1 text-on-surface">Login con credenciales válidas</span>
              <span className="text-xs font-medium text-secondary bg-secondary/10 px-2 py-0.5 rounded">pass</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-error"></div>
              <span className="font-mono text-xs text-on-surface-variant">AUTH-002</span>
              <span className="flex-1 text-on-surface">Rechazo de token expirado</span>
              <span className="text-xs font-medium text-error bg-error/10 px-2 py-0.5 rounded">fail</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
              <span className="font-mono text-xs text-on-surface-variant">AUTH-003</span>
              <span className="flex-1 text-on-surface">Refresh token válido</span>
              <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded">running</span>
            </div>
            <div className="flex items-center gap-3 text-sm opacity-50">
              <div className="w-2 h-2 rounded-full bg-outline"></div>
              <span className="font-mono text-xs text-on-surface-variant">API-001</span>
              <span className="flex-1 text-on-surface">GET /products devuelve 200</span>
              <span className="text-xs font-medium text-on-surface-variant">pendiente</span>
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-6 border border-outline/10 flex flex-col">
          <div className="flex justify-between items-center mb-4 pb-4 border-b border-outline/10">
            <h3 className="text-sm font-medium text-on-surface flex items-center gap-2">
              <Terminal className="w-4 h-4" />
              Consola en tiempo real
            </h3>
            <span className="text-xs text-primary flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
              WebSocket
            </span>
          </div>
          
          <div 
            ref={consoleRef}
            className="flex-1 bg-[#0c0e10] rounded-lg p-4 font-mono text-xs leading-relaxed overflow-y-auto min-h-[250px] max-h-[400px]"
          >
            {logs.map((log, i) => (
              <div key={i} className="mb-1">
                <span className={
                  log.type === 'info' ? 'text-secondary' : 
                  log.type === 'pass' ? 'text-secondary' : 
                  log.type === 'fail' ? 'text-error' : 
                  'text-on-surface-variant'
                }>[{log.time}]</span>{' '}
                <span className={
                  log.type === 'dim' ? 'text-on-surface-variant' : 
                  log.type === 'fail' ? 'text-error' : 
                  'text-on-surface'
                }>{log.text}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3 mt-4">
            <button 
              onClick={() => {
                if (progress >= 100) setProgress(0);
                setIsRunning(!isRunning);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-surface-high hover:bg-surface-highest text-on-surface text-sm font-medium rounded-lg transition-colors border border-outline/20"
            >
              {isRunning ? <Square className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              {isRunning ? 'Pausar' : 'Simular progreso'}
            </button>
            <button className="flex items-center gap-2 px-4 py-2 text-error hover:bg-error/10 text-sm font-medium rounded-lg transition-colors">
              <Square className="w-4 h-4" />
              Detener
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
