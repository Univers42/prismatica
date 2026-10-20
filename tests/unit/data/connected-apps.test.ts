import { describe, expect, it } from 'vitest';
import { CONNECTED_APPS, appName } from '../../../src/data/connected-apps';
import { MEDIA_SHOTS } from '../../../src/data/media-shots';

describe('connected apps', () => {
	const ids = CONNECTED_APPS.map((app) => app.id);

	it('has unique ids and slash commands', () => {
		expect(new Set(ids).size).toBe(ids.length);
		expect(new Set(CONNECTED_APPS.map((app) => app.command)).size).toBe(ids.length);
	});

	it('links only to other apps that exist', () => {
		for (const app of CONNECTED_APPS) {
			expect(app.links.length).toBeGreaterThan(0);
			for (const link of app.links) {
				expect(ids).toContain(link);
				expect(link).not.toBe(app.id);
			}
		}
	});

	it('points every app at a media shot from the shot list', () => {
		const shots = Object.values(MEDIA_SHOTS);
		for (const app of CONNECTED_APPS) expect(shots).toContain(app.shot);
	});

	it('names apps by id', () => {
		expect(appName('board')).toBe('Board');
	});
});

describe('media shots', () => {
	it('keys every shot by its own id and gives videos a duration', () => {
		for (const [key, shot] of Object.entries(MEDIA_SHOTS)) {
			expect(shot.id).toBe(key);
			if (shot.kind === 'video') expect(shot.durationSeconds).toBeGreaterThan(0);
		}
	});
});
