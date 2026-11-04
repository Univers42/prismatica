import fs from 'node:fs';
import { chromium } from 'playwright';

// The containers run as root with a small /dev/shm, and carry the distro's Chromium rather than a
// Playwright download, so every audit launches it the same way.
export function launchChromium() {
	return chromium.launch({
		executablePath: process.env.CHROME_BIN || (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
		args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
		env: { ...process.env, HOME: '/tmp' },
	});
}
