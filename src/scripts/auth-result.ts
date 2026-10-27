/* Fills the AuthResult card (src/components/ui/AuthResult.astro) with one outcome. Every string
   lands through textContent, so gateway or URL text can never become markup. */

export type AuthResultTone = 'notice' | 'danger' | 'success';

export type AuthResult = {
	tone: AuthResultTone;
	title: string;
	message: string;
	steps: string[];
	// Label of the button that opens the sign-in window; without one only "Back to homepage" shows.
	action?: string;
	// Plain support reference, shown only when set.
	code?: string;
};

function part(card: HTMLElement, name: string): HTMLElement | null {
	return card.querySelector<HTMLElement>(`[data-result-${name}]`);
}

function setShown(element: HTMLElement | null, shown: boolean): void {
	if (element) element.hidden = !shown;
}

export function showAuthResult(card: HTMLElement, result: AuthResult): void {
	document.title = `${result.title} · Prismatica`;
	card.hidden = false;
	card.dataset.tone = result.tone;
	const title = part(card, 'title');
	if (title) title.textContent = result.title;
	const message = part(card, 'message');
	if (message) message.textContent = result.message;
	part(card, 'steps')?.replaceChildren(
		...result.steps.map((step) => {
			const item = document.createElement('li');
			item.textContent = step;
			return item;
		}),
	);
	setShown(part(card, 'next'), result.steps.length > 0);
	const action = part(card, 'action');
	if (action) action.textContent = result.action ?? '';
	setShown(action, Boolean(result.action));
	setShown(part(card, 'actions'), true);
	const code = part(card, 'code');
	if (code) code.textContent = result.code ?? '';
	setShown(part(card, 'reference'), Boolean(result.code));
	// The heading carries the outcome: focus moves there so a screen reader starts on it.
	title?.focus();
}
