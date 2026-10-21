import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MEDIA_SHOTS, type MediaShot } from '../../../src/data/media-shots';

const SHOTS: readonly MediaShot[] = Object.values(MEDIA_SHOTS);

describe('MEDIA_SHOTS', () => {
	it('names only files that exist in public/assets', () => {
		for (const shot of SHOTS) {
			for (const name of [shot.src, shot.srcSmall, shot.poster]) {
				if (name) {
					expect(
						existsSync(resolve(process.cwd(), 'public/assets', name)),
						`missing file for shot ${shot.id}: ${name}`,
					).toBe(true);
				}
			}
		}
	});

	it('gives every image shot with a src a half-width srcSmall copy', () => {
		for (const shot of SHOTS) {
			if (shot.kind === 'image' && shot.src) {
				expect(
					shot.srcSmall,
					`shot ${shot.id} has src but no srcSmall`,
				).toBeTruthy();
			}
		}
	});
});
