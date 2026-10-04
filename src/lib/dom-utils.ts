type TrustedTypesFactory = {
	createPolicy(name: string, rules: { createHTML?: (s: string) => string }): any;
};

let trustedHtmlPolicy: any | null | undefined;

/** Returns an internal TrustedHTML value when the browser enforces Trusted Types. */
export function trustedHTML(markup: string): unknown {
	if (trustedHtmlPolicy === undefined) {
		const trustedTypes = (globalThis as typeof globalThis & { trustedTypes?: TrustedTypesFactory }).trustedTypes;
		try {
			trustedHtmlPolicy = trustedTypes?.createPolicy('prismatica-static-markup', { createHTML: (value) => value }) ?? null;
		} catch {
			trustedHtmlPolicy = null;
		}
	}
	return trustedHtmlPolicy ? trustedHtmlPolicy.createHTML(markup) : markup;
}

/** Assigns static internal markup through Trusted Types-aware DOM sinks. */
export function setTrustedInnerHTML(element: HTMLElement, markup: string): void {
	(element as unknown as { innerHTML: unknown }).innerHTML = trustedHTML(markup);
}

/** Inserts static internal markup through Trusted Types-aware DOM sinks. */
export function insertTrustedHTML(element: HTMLElement, position: InsertPosition, markup: string): void {
	element.insertAdjacentHTML(position, trustedHTML(markup) as string);
}

/** Returns an element when it matches the expected runtime type. */
export function queryElement<T extends Element>(selector: string, guard: (element: Element) => element is T): T | null {
	const element = document.querySelector(selector);
	return element && guard(element) ? element : null;
}

/** Returns all elements matching the expected runtime type. */
export function queryElements<T extends Element>(selector: string, guard: (element: Element) => element is T): T[] {
	return Array.from(document.querySelectorAll(selector)).filter(guard);
}

/** Narrows an element to an HTML button. */
export function isButton(element: Element): element is HTMLButtonElement {
	return element instanceof HTMLButtonElement;
}

/** Narrows an element to a generic HTML element. */
export function isHtmlElement(element: Element): element is HTMLElement {
	return element instanceof HTMLElement;
}

/** Narrows an element to an input field. */
export function isInput(element: Element): element is HTMLInputElement {
	return element instanceof HTMLInputElement;
}
