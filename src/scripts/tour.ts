// Click 1: [data-open-tour] links open the tour <dialog> in place of navigating to /tour. Closing
// pauses the video and returns focus to the link (the native dialog restores focus itself).

export function bindTourDialog(): void {
	const dialog = document.querySelector<HTMLDialogElement>('[data-tour-dialog]');
	if (!dialog) return;
	const video = dialog.querySelector<HTMLVideoElement>('[data-tour-video]');
	document.querySelectorAll<HTMLAnchorElement>('a[data-open-tour]').forEach((link) => {
		link.addEventListener('click', (event) => {
			if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
			event.preventDefault();
			dialog.showModal();
		});
	});
	dialog.querySelector('[data-close-tour]')?.addEventListener('click', () => dialog.close());
	dialog.addEventListener('click', (event) => {
		if (event.target === dialog) dialog.close();
	});
	dialog.addEventListener('close', () => video?.pause());
}
