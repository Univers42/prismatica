import type { ConnectedAppId } from './connected-apps';

// Stroke paths for each app's icon on a 24px grid (1.75 stroke, round caps).
// AppGlyph.astro renders them server-side; the sign-in dialog, built as a
// string in scripts/portal-markup.ts, draws the same icons from here.
export const APP_GLYPH_PATHS: Record<ConnectedAppId, readonly string[]> = {
	docs: ['M6.5 3.5h7.2l4.3 4.3v12.7H6.5z', 'M13.5 3.5v4.5H18', 'M9 12h6', 'M9 15.5h6'],
	database: ['M4 5.5c0-1.7 3.6-2.8 8-2.8s8 1.1 8 2.8-3.6 2.8-8 2.8-8-1.1-8-2.8z', 'M4 5.5v13c0 1.7 3.6 2.8 8 2.8s8-1.1 8-2.8v-13', 'M4 12c0 1.7 3.6 2.8 8 2.8s8-1.1 8-2.8'],
	board: ['M4 4.5h4.5v15H4z', 'M9.75 4.5h4.5v10h-4.5z', 'M15.5 4.5H20v6.5h-4.5z'],
	calendar: ['M4.5 6h15v13.5h-15z', 'M4.5 10h15', 'M8.5 3.5V7', 'M15.5 3.5V7', 'M8.5 14h2', 'M13.5 14h2'],
	mail: ['M3.75 6h16.5v12H3.75z', 'M4 6.5l8 6 8-6'],
	whiteboard: ['M4 17.5c2.5-6 5-8 7-5.5s4.5.5 6.5-4', 'M16 5.5l2.5 2.5', 'M3.5 20.5h17'],
};
