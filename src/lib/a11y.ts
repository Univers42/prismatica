/** Moves keyboard focus to meaningful content when the skip link is used. */
function removeTemporaryTabindex(element: HTMLElement, shouldRemove: boolean): void {
	if (shouldRemove) {
		element.removeAttribute('tabindex');
	}
}

function focusSkipTarget(focusTarget: HTMLElement, removeTabindexOnBlur: boolean): void {
	focusTarget.focus({ preventScroll: true });
	focusTarget.addEventListener('blur', () => removeTemporaryTabindex(focusTarget, removeTabindexOnBlur), { once: true });
}

function handleSkipLinkClick(event: Event): void {
	const link = event.currentTarget;
	if (!(link instanceof HTMLAnchorElement)) {
		return;
	}
	const target = document.getElementById(link.hash.slice(1));
	if (!(target instanceof HTMLElement)) {
		return;
	}
	const focusTarget = target.querySelector('h1, h2, [tabindex], a[href], button, input, select, textarea') ?? target;
	if (!(focusTarget instanceof HTMLElement)) {
		return;
	}
	const hadTabindex = focusTarget.hasAttribute('tabindex');
	if (!hadTabindex) {
		focusTarget.setAttribute('tabindex', '-1');
	}
	requestAnimationFrame(() => focusSkipTarget(focusTarget, !hadTabindex));
}

export function bindSkipLinkFocus(): void {
	const links = document.querySelectorAll('.skip-link[href^="#"]');
	links.forEach((node) => {
		if (node instanceof HTMLAnchorElement) {
			node.addEventListener('click', handleSkipLinkClick);
		}
	});
}
