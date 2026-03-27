import { Package, CheckCircle2, XCircle, Ban, Filter, Play, Edit2 } from 'lucide-react';

export function Explorer({ setCurrentView }: { setCurrentView: (v: string) => void }) {
  const tests = [
    { id: 'PR-0092', title: 'Auth Gateway Handshake', type: 'HTTP', domain: 'gateway', prio: 'P0', status: 'Pass', time: '2m ago' },
    { id: 'PR-1240', title: 'Payment Provider Callback', type: 'Bash', domain: 'payments', prio: 'P1', status: 'Fail', time: '14m ago' },
    { id: 'PR-0481', title: 'User Profile Hydration', type: 'HTTP', domain: 'api', prio: 'P2', status: 'Pass', time: '1h ago' },
    { id: 'PR-2219', title: 'Infra Health Projection', type: 'Manual', domain: 'infra', prio: 'P1', status: 'Skip', time: '5h ago' },
    { id: 'PR-0931', title: 'OAuth2 Scoping Flow', type: 'HTTP', domain: 'auth', prio: 'P0', status: 'Pass', time: 'Yesterday' },
  ];

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex justify-between items-end mb-10">
        <div>
          <h2 className="text-2xl font-semibold text-on-surface mb-1">Explorer View</h2>
          <p className="text-sm text-on-surface-variant">Global test suite orchestration and status monitoring</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setCurrentView('editor')}
            className="px-4 py-2 bg-surface-high text-on-surface text-sm font-medium rounded-lg hover:bg-surface-highest transition-colors"
          >
            Create New Test
          </button>
          <button 
            onClick={() => setCurrentView('runner')}
            className="px-4 py-2 bg-primary text-background text-sm font-bold rounded-lg shadow-lg shadow-primary/10 hover:opacity-90 transition-opacity"
          >
            Run All Tests
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-surface-high p-5 rounded-xl">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs uppercase tracking-wider text-on-surface-variant font-medium">Total Tests</span>
            <Package className="w-5 h-5 text-primary" />
          </div>
          <div className="text-4xl font-bold text-on-surface">47</div>
          <div className="mt-2 text-xs text-primary">+4 from last sync</div>
        </div>
        <div className="bg-surface-high p-5 rounded-xl border-l-4 border-secondary">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs uppercase tracking-wider text-on-surface-variant font-medium">Passing</span>
            <CheckCircle2 className="w-5 h-5 text-secondary" />
          </div>
          <div className="text-4xl font-bold text-secondary">38</div>
          <div className="mt-2 text-xs text-on-surface-variant">80.8% Pass Rate</div>
        </div>
        <div className="bg-surface-high p-5 rounded-xl border-l-4 border-error">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs uppercase tracking-wider text-on-surface-variant font-medium">Failing</span>
            <XCircle className="w-5 h-5 text-error" />
          </div>
          <div className="text-4xl font-bold text-error">06</div>
          <div className="mt-2 text-xs text-error">Critical intervention required</div>
        </div>
        <div className="bg-surface-high p-5 rounded-xl border-l-4 border-tertiary">
          <div className="flex justify-between items-start mb-4">
            <span className="text-xs uppercase tracking-wider text-on-surface-variant font-medium">Skipped</span>
            <Ban className="w-5 h-5 text-tertiary" />
          </div>
          <div className="text-4xl font-bold text-tertiary">03</div>
          <div className="mt-2 text-xs text-on-surface-variant">Maintenance mode</div>
        </div>
      </div>

      <div className="flex gap-8">
        <div className="flex-1 min-w-0">
          {/* Filters */}
          <div className="bg-surface rounded-xl p-2 mb-6 flex items-center justify-between border border-outline/10">
            <div className="flex items-center gap-1">
              <button className="px-4 py-1.5 text-sm font-medium bg-surface-highest text-primary rounded-lg">All</button>
              <button className="px-4 py-1.5 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">Pass</button>
              <button className="px-4 py-1.5 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">Fail</button>
              <div className="h-6 w-px bg-outline/20 mx-2"></div>
              <button className="px-4 py-1.5 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">HTTP</button>
              <button className="px-4 py-1.5 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">Bash</button>
              <button className="px-4 py-1.5 text-sm font-medium text-on-surface-variant hover:text-on-surface transition-colors">Manual</button>
            </div>
            <div className="flex items-center gap-2 pr-2">
              <span className="text-xs text-on-surface-variant mr-2">Displaying 47 items</span>
              <button className="p-1.5 hover:bg-surface-highest rounded-lg transition-colors text-on-surface-variant">
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="bg-surface rounded-xl overflow-hidden border border-outline/10 shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-high/50 border-b border-outline/15">
                  <th className="px-6 py-4 text-xs uppercase tracking-widest text-on-surface-variant font-medium">ID</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest text-on-surface-variant font-medium">Test Title</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest text-on-surface-variant font-medium">Type</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest text-on-surface-variant font-medium">Domain</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest text-on-surface-variant font-medium text-center">Priority</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest text-on-surface-variant font-medium">Status</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest text-on-surface-variant font-medium">Last Run</th>
                  <th className="px-6 py-4 text-xs uppercase tracking-widest text-on-surface-variant font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline/5">
                {tests.map((test) => (
                  <tr key={test.id} className="hover:bg-surface-high transition-colors group">
                    <td className="px-6 py-4 font-mono text-xs text-primary/80">{test.id}</td>
                    <td className="px-6 py-4 font-medium text-on-surface text-sm">{test.title}</td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-0.5 rounded-full text-[10px] bg-surface-highest text-on-surface-variant font-medium">
                        {test.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-on-surface-variant">{test.domain}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        test.prio === 'P0' ? 'bg-error/20 text-error' : 
                        test.prio === 'P1' ? 'bg-tertiary/20 text-tertiary' : 
                        'bg-outline/20 text-on-surface-variant'
                      }`}>
                        {test.prio}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          test.status === 'Pass' ? 'bg-secondary shadow-[0_0_8px_rgba(173,203,218,0.5)]' :
                          test.status === 'Fail' ? 'bg-error shadow-[0_0_8px_rgba(255,180,171,0.5)]' :
                          'bg-tertiary shadow-[0_0_8px_rgba(255,183,125,0.5)]'
                        }`}></span>
                        <span className={`text-xs font-semibold uppercase tracking-wider ${
                          test.status === 'Pass' ? 'text-secondary' :
                          test.status === 'Fail' ? 'text-error' :
                          'text-tertiary'
                        }`}>
                          {test.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-on-surface-variant">{test.time}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setCurrentView('runner')} className="p-1 hover:text-primary transition-colors text-on-surface-variant"><Play className="w-4 h-4" /></button>
                        <button onClick={() => setCurrentView('editor')} className="p-1 hover:text-primary transition-colors text-on-surface-variant"><Edit2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="bg-surface/30 px-6 py-3 border-t border-outline/15 flex justify-between items-center">
              <span className="text-xs text-on-surface-variant">Showing 1-5 of 47 tests</span>
              <div className="flex gap-2">
                <button className="px-3 py-1 bg-surface-high rounded border border-outline/20 text-xs hover:bg-surface-highest disabled:opacity-50 text-on-surface-variant" disabled>Previous</button>
                <button className="px-3 py-1 bg-surface-high rounded border border-outline/20 text-xs hover:bg-surface-highest text-on-surface-variant">Next</button>
              </div>
            </div>
          </div>
        </div>

        {/* Domains Sidebar */}
        <aside className="w-72 hidden xl:block">
          <div className="bg-surface rounded-xl p-6 border border-outline/10">
            <h3 className="text-xs uppercase tracking-widest text-primary font-bold mb-6">Domains</h3>
            <div className="space-y-5">
              {[
                { name: 'auth', count: 12, pass: 100, fail: 0 },
                { name: 'api', count: 15, pass: 85, fail: 15 },
                { name: 'infra', count: 8, pass: 70, fail: 0, skip: 30 },
                { name: 'gateway', count: 5, pass: 100, fail: 0 },
                { name: 'payments', count: 7, pass: 40, fail: 60 },
              ].map(d => (
                <div key={d.name} className="group cursor-pointer">
                  <div className="flex justify-between items-center mb-1.5">
                    <span className="text-sm font-medium text-on-surface group-hover:text-primary transition-colors">{d.name}</span>
                    <span className="text-[10px] bg-surface-highest px-1.5 py-0.5 rounded text-on-surface-variant">{d.count}</span>
                  </div>
                  <div className="w-full h-1.5 bg-surface-highest rounded-full overflow-hidden flex">
                    {d.pass > 0 && <div className="h-full bg-secondary" style={{ width: `${d.pass}%` }}></div>}
                    {d.fail > 0 && <div className="h-full bg-error" style={{ width: `${d.fail}%` }}></div>}
                    {d.skip > 0 && <div className="h-full bg-tertiary" style={{ width: `${d.skip}%` }}></div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
