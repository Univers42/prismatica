/** Reflects auth state onto any elements that opt in via data attributes. */
export function reflectAuthState(loggedIn: boolean): void {
	document.documentElement.dataset.authState = loggedIn ? 'authenticated' : 'anonymous';
	
	const authOnly = document.querySelectorAll<HTMLElement>('[data-auth-only]');
	authOnly.forEach((node) => {
		node.hidden = !loggedIn;
	});
	
	const anonOnly = document.querySelectorAll<HTMLElement>('[data-anon-only]');
	anonOnly.forEach((node) => {
		node.hidden = loggedIn;
	});
}

/**
 * Restores the session from the HttpOnly refresh cookie (if any) and reflects
 * the resulting auth state into the UI.
 */
export async function rehydrateAndReflectAuth(rehydrateSession: () => Promise<boolean>): Promise<void> {
	const loggedIn = await rehydrateSession();
	reflectAuthState(loggedIn);
}

/** Wires any logout controls to clear the in-memory token and the cookie. */
export function bindLogoutControls(logoutSession: () => Promise<void>, announce: (msg: string) => void): void {
	const controls = document.querySelectorAll<HTMLElement>('[data-logout]');
	controls.forEach((control) => {
		control.addEventListener('click', (event) => {
			event.preventDefault();
			logoutSession()
				.then(() => {
					reflectAuthState(false);
					announce('You have been signed out.');
				})
				.catch((err) => {
					console.error('Logout failed:', err);
				});
		});
	});
}
