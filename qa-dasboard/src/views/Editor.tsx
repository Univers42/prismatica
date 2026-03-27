import { useState } from 'react';

export function Editor() {
  const [type, setType] = useState('http');

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-on-surface mb-1">Editor de tests</h2>
        <p className="text-sm text-on-surface-variant">Crea o modifica definiciones de tests</p>
      </div>

      <div className="flex gap-2 mb-6">
        {['http', 'bash', 'manual'].map(t => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors border ${
              type === t 
                ? 'bg-primary-container/20 text-primary border-primary-container/50' 
                : 'bg-transparent text-on-surface-variant border-outline/20 hover:text-on-surface hover:bg-surface-high'
            }`}
          >
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-xl p-6 border border-outline/10">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">ID del test</label>
              <input type="text" defaultValue="AUTH-008" className="w-full bg-surface-highest border border-outline/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Dominio</label>
              <select className="w-full bg-surface-highest border border-outline/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors appearance-none">
                <option>auth</option>
                <option>api</option>
                <option>infra</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Título</label>
            <input type="text" defaultValue="Verificar logout invalida sesión" className="w-full bg-surface-highest border border-outline/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors" />
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Prioridad</label>
              <select className="w-full bg-surface-highest border border-outline/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors appearance-none">
                <option>P0 — Crítico</option>
                <option>P1 — Alto</option>
                <option>P2 — Medio</option>
              </select>
            </div>
            {type === 'http' && (
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Método HTTP</label>
                <select className="w-full bg-surface-highest border border-outline/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors appearance-none">
                  <option>POST</option>
                  <option>GET</option>
                  <option>PUT</option>
                  <option>DELETE</option>
                </select>
              </div>
            )}
          </div>

          {type === 'http' && (
            <>
              <div className="mb-4">
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">URL</label>
                <input type="text" defaultValue="https://api.prismatica.dev/auth/logout" className="w-full bg-surface-highest border border-outline/20 rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary transition-colors" />
              </div>
              <div className="mb-6">
                <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Assertions</label>
                <div className="bg-[#0c0e10] rounded-lg p-3 space-y-2 border border-outline/10">
                  <div className="flex gap-2">
                    <input type="text" defaultValue="statusCode" className="w-1/3 bg-surface-high border border-outline/20 rounded-md px-2 py-1.5 text-xs font-mono text-on-surface-variant focus:outline-none focus:border-primary" />
                    <input type="text" defaultValue="200" className="flex-1 bg-surface-high border border-outline/20 rounded-md px-2 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:border-primary" />
                  </div>
                  <div className="flex gap-2">
                    <input type="text" defaultValue="bodyContains" className="w-1/3 bg-surface-high border border-outline/20 rounded-md px-2 py-1.5 text-xs font-mono text-on-surface-variant focus:outline-none focus:border-primary" />
                    <input type="text" defaultValue="logged_out" className="flex-1 bg-surface-high border border-outline/20 rounded-md px-2 py-1.5 text-xs font-mono text-on-surface focus:outline-none focus:border-primary" />
                  </div>
                </div>
              </div>
            </>
          )}

          {type === 'bash' && (
            <div className="mb-6">
              <label className="block text-xs font-medium text-on-surface-variant mb-1.5">Script bash</label>
              <textarea 
                className="w-full h-32 bg-[#0c0e10] border border-outline/20 rounded-lg px-3 py-2 text-sm font-mono text-on-surface focus:outline-none focus:border-primary transition-colors resize-none"
                defaultValue="#!/bin/bash\ncurl -s https://api.prismatica.dev/health | grep 'ok'"
              ></textarea>
            </div>
          )}

          <div className="flex gap-3">
            <button className="px-4 py-2 bg-primary text-background text-sm font-bold rounded-lg shadow-lg shadow-primary/10 hover:opacity-90 transition-opacity">
              Guardar test
            </button>
            <button className="px-4 py-2 bg-transparent border border-outline/30 text-on-surface text-sm font-medium rounded-lg hover:bg-surface-high transition-colors">
              Cancelar
            </button>
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-on-surface-variant mb-2">Vista previa JSON</div>
          <div className="bg-[#0c0e10] rounded-xl p-4 text-xs font-mono leading-relaxed border border-outline/10 overflow-x-auto">
            <span className="text-on-surface-variant">{"{"}</span><br/>
            &nbsp;&nbsp;<span className="text-primary">"id"</span>: <span className="text-secondary">"AUTH-008"</span>,<br/>
            &nbsp;&nbsp;<span className="text-primary">"type"</span>: <span className="text-secondary">"{type}"</span>,<br/>
            &nbsp;&nbsp;<span className="text-primary">"domain"</span>: <span className="text-secondary">"auth"</span>,<br/>
            &nbsp;&nbsp;<span className="text-primary">"priority"</span>: <span className="text-secondary">"P0"</span>,<br/>
            &nbsp;&nbsp;<span className="text-primary">"title"</span>: <span className="text-secondary">"Verificar logout invalida sesión"</span>,<br/>
            &nbsp;&nbsp;<span className="text-primary">"config"</span>: <span className="text-on-surface-variant">{"{"}</span><br/>
            {type === 'http' ? (
              <>
                &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-primary">"method"</span>: <span className="text-secondary">"POST"</span>,<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-primary">"url"</span>: <span className="text-secondary">"https://api.prismatica.dev/auth/logout"</span>,<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-primary">"assertions"</span>: <span className="text-on-surface-variant">{"{"}</span><br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-primary">"statusCode"</span>: <span className="text-error">200</span>,<br/>
                &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-primary">"bodyContains"</span>: <span className="text-secondary">"logged_out"</span><br/>
                &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-on-surface-variant">{"}"}</span><br/>
              </>
            ) : type === 'bash' ? (
              <>
                &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-primary">"script"</span>: <span className="text-secondary">"#!/bin/bash\ncurl -s https://api.prismatica.dev/health | grep 'ok'"</span><br/>
              </>
            ) : (
              <>
                &nbsp;&nbsp;&nbsp;&nbsp;<span className="text-primary">"instructions"</span>: <span className="text-secondary">"..."</span><br/>
              </>
            )}
            &nbsp;&nbsp;<span className="text-on-surface-variant">{"}"}</span><br/>
            <span className="text-on-surface-variant">{"}"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
