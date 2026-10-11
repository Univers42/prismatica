export function initBackendArchitecture(): void {
	const dataEl = document.querySelector('[data-arch-data]');
	if (!dataEl) return;
	const data = JSON.parse(dataEl.textContent ?? '{}');
	const servicesData = (data.servicesData ?? []) as any[];
	const presetsData = (data.presetsData ?? []) as any[];
	const root = document.querySelector('.backend-arch');
	const svg = root?.querySelector('[data-arch-svg]');
	const titleEl = root?.querySelector('[data-arch-title]');
	const tradeoffEl = root?.querySelector('[data-arch-tradeoff]');
	const tooltipEl = root?.querySelector('[data-arch-tooltip]');
	if (!root || !(svg instanceof SVGElement) || !(titleEl instanceof HTMLElement)
		|| !(tradeoffEl instanceof HTMLElement) || !(tooltipEl instanceof HTMLElement)) return;
	const presetButtons = root.querySelectorAll('[data-preset]');
	const nodes = svg.querySelectorAll('[data-node]');
	const setMetric = (key: string, value: string) => {
		const el = root.querySelector(`[data-metric="${key}"]`);
		if (el) el.textContent = value;
	};

	const enabled = new Set();
	const TOTAL_GDPR_MAX = servicesData.reduce((s, x) => s + x.gdprPoints, 0);

	const applyState = () => {
		servicesData.forEach((svc) => {
			const node = svg.querySelector(`[data-node="${svc.id}"]`);
			node?.setAttribute('data-active', enabled.has(svc.id) ? 'true' : 'false');
			node?.setAttribute('aria-pressed', enabled.has(svc.id) ? 'true' : 'false');
		});
		svg.querySelectorAll('[data-edge]').forEach((edge) => {
			const live = enabled.has(edge.getAttribute('data-from')) && enabled.has(edge.getAttribute('data-to'));
			edge.setAttribute('data-active', live ? 'true' : 'false');
		});
		recomputeMetrics();
	};

	const recomputeMetrics = () => {
		let count = 0, cost = 0, latency = 0, gdpr = 0, risk = 0;
		servicesData.forEach((svc) => {
			if (!enabled.has(svc.id)) return;
			count += 1; cost += svc.cost; latency += svc.latencyMs;
			gdpr += svc.gdprPoints; risk += svc.risk;
		});
		const gdprPct = Math.min(100, Math.round((gdpr / TOTAL_GDPR_MAX) * 100));
		const riskScore = Math.min(10, Math.round(risk * 0.7));
		let mau = 0;
		if (enabled.has('kong') && enabled.has('postgres')) {
			mau = 50_000;
			if (enabled.has('mongo')) mau += 50_000;
			if (enabled.has('storage')) mau += 25_000;
			if (enabled.has('analytics')) mau += 25_000;
			if (enabled.has('logs')) mau += 10_000;
		}
		setMetric('count', String(count));
		setMetric('latency', String(latency));
		setMetric('cost', String(cost));
		setMetric('gdpr', String(gdprPct));
		setMetric('risk', String(riskScore));
		setMetric('mau', mau >= 1000 ? `${(mau / 1000).toFixed(0)}K` : String(mau));

		const messages = [];
		if (!enabled.has('gdpr')) messages.push('No GDPR module — DSAR exports become a manual job.');
		if (!enabled.has('logs')) messages.push('Logs disabled — incident response slows down.');
		if (!enabled.has('permission')) messages.push('No permission engine — RLS in Postgres becomes mandatory.');
		if (enabled.has('ai') && !enabled.has('gdpr')) messages.push('AI on without GDPR module: prompt-vault retention is on you.');
		if (enabled.has('mongo') && !enabled.has('schema')) messages.push('Mongo without schema-service — drift will hit you in week 6.');
		if (enabled.has('newsletter') && !enabled.has('email')) messages.push('Newsletter needs the email service to deliver.');
		if (count <= 4) messages.push('Lean stack — perfect for prototypes, not for billing customers.');
		if (count >= 12) messages.push('All-in stack — great for product-market fit, expect ops work.');
		tradeoffEl.textContent = messages[0] ?? 'Balanced stack — production-ready out of the box.';
	};

	const applyPreset = (id: any) => {
		const preset = presetsData.find((p) => p.id === id);
		if (!preset) return;
		enabled.clear();
		preset.enabled.forEach((s: any) => enabled.add(s));
		servicesData.forEach((svc) => { if (svc.required) enabled.add(svc.id); });
		presetButtons.forEach((btn) => btn.setAttribute('aria-pressed', btn.getAttribute('data-preset') === id ? 'true' : 'false'));
		titleEl.textContent = `preset · ${preset.label.toLowerCase()}`;
		applyState();
	};

	const toggleService = (id: any) => {
		const svc = servicesData.find((s) => s.id === id);
		if (!svc || svc.required) return;
		if (enabled.has(id)) enabled.delete(id); else enabled.add(id);
		presetButtons.forEach((btn) => btn.setAttribute('aria-pressed', 'false'));
		titleEl.textContent = 'preset · custom';
		applyState();
	};

	nodes.forEach((node) => {
		const id = node.getAttribute('data-node');
		node.addEventListener('click', () => toggleService(id));
		node.addEventListener('keydown', (event) => {
			if (!(event instanceof KeyboardEvent)) return;
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				toggleService(id);
			}
		});
		const showTip = () => {
			const svc = servicesData.find((s) => s.id === id);
			if (!svc) return;
			tooltipEl.textContent = `${svc.name} — ${svc.desc}`;
			tooltipEl.hidden = false;
		};
		const hideTip = () => { tooltipEl.hidden = true; };
		node.addEventListener('pointerenter', showTip);
		node.addEventListener('pointerleave', hideTip);
		node.addEventListener('focus', showTip);
		node.addEventListener('blur', hideTip);
	});

	presetButtons.forEach((btn) => btn.addEventListener('click', () => applyPreset(btn.getAttribute('data-preset'))));

	const defaultBtn = root.querySelector('[data-preset][data-default="true"]');
	applyPreset(defaultBtn?.getAttribute('data-preset') ?? presetsData[0].id);
}
