export function Analytics() {
  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-on-surface mb-1">Analytics y cobertura</h2>
        <p className="text-sm text-on-surface-variant">Métricas de calidad y estabilidad del proyecto</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-high p-5 rounded-xl">
          <div className="text-xs uppercase tracking-wider text-on-surface-variant font-medium mb-2">Tasa de éxito</div>
          <div className="text-3xl font-bold text-secondary">80.9%</div>
          <div className="mt-2 text-xs text-secondary">↑ 3.2% esta semana</div>
        </div>
        <div className="bg-surface-high p-5 rounded-xl">
          <div className="text-xs uppercase tracking-wider text-on-surface-variant font-medium mb-2">Cobertura</div>
          <div className="text-3xl font-bold text-on-surface">67%</div>
          <div className="mt-2 text-xs text-on-surface-variant">de rutas críticas</div>
        </div>
        <div className="bg-surface-high p-5 rounded-xl">
          <div className="text-xs uppercase tracking-wider text-on-surface-variant font-medium mb-2">Ejecuciones / día</div>
          <div className="text-3xl font-bold text-on-surface">14</div>
          <div className="mt-2 text-xs text-on-surface-variant">media últimos 7 días</div>
        </div>
        <div className="bg-surface-high p-5 rounded-xl">
          <div className="text-xs uppercase tracking-wider text-on-surface-variant font-medium mb-2">Tests flaky</div>
          <div className="text-3xl font-bold text-tertiary">4</div>
          <div className="mt-2 text-xs text-on-surface-variant">fallan &gt;20%</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface rounded-xl p-6 border border-outline/10">
          <h3 className="text-sm font-medium text-on-surface mb-6">Resultados por día (última semana)</h3>
          <div className="flex items-end gap-2 h-32 mb-2">
            {[55, 62, 48, 70, 58, 30, 65].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end gap-1">
                <div className="w-full bg-secondary/80 rounded-t-sm" style={{ height: `${h}%` }}></div>
              </div>
            ))}
          </div>
          <div className="flex items-end gap-2 h-8 mb-4">
            {[8, 5, 14, 4, 9, 3, 6].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col justify-end gap-1">
                <div className="w-full bg-error/80 rounded-t-sm" style={{ height: `${h * 3}%` }}></div>
              </div>
            ))}
          </div>
          <div className="flex justify-between text-xs text-on-surface-variant px-2">
            <span>L</span><span>M</span><span>X</span><span>J</span><span>V</span><span>S</span><span>D</span>
          </div>
          <div className="flex gap-4 mt-6">
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <div className="w-2 h-2 rounded-sm bg-secondary"></div> Pass
            </div>
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <div className="w-2 h-2 rounded-sm bg-error"></div> Fail
            </div>
          </div>
        </div>

        <div className="bg-surface rounded-xl p-6 border border-outline/10">
          <h3 className="text-sm font-medium text-on-surface mb-6">Tests más inestables (flaky)</h3>
          <div className="space-y-4">
            {[
              { id: 'AUTH-002', title: 'Rechazo de token expirado', pct: 68 },
              { id: 'PAY-003', title: 'Webhook de pago recibido', pct: 42 },
              { id: 'GW-001', title: 'Rate limiting en gateway', pct: 31 },
              { id: 'AUTH-003', title: 'Refresh token válido', pct: 24 },
            ].map(test => (
              <div key={test.id} className="flex items-center gap-4">
                <span className="font-mono text-xs text-on-surface-variant w-20">{test.id}</span>
                <span className="text-sm text-on-surface flex-1 truncate">{test.title}</span>
                <div className="w-32 h-1.5 bg-surface-highest rounded-full overflow-hidden">
                  <div className="h-full bg-error" style={{ width: `${test.pct}%` }}></div>
                </div>
                <span className="text-xs text-error font-medium w-8 text-right">{test.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
