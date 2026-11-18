export const SHELL_LEFT = 'M15 34 C26 20, 51 16, 69 27 C80 34, 87 48, 86 62 C85 78, 73 90, 55 94 C34 98, 14 90, 7 75 C1 61, 4 45, 15 34Z';
export const SHELL_RIGHT = 'M115 27 C134 16, 158 20, 169 34 C180 49, 183 65, 177 78 C170 92, 150 98, 129 94 C111 90, 99 78, 98 62 C97 48, 104 34, 115 27Z';
export const TUBE_SLICES = 6;

export function tubeSlices(shell: string): string {
	return Array.from({ length: TUBE_SLICES }, () => `<path class="svg-tube" d="${shell}" />`).join('');
}

export function mascotSvgMarkup(): string {
	return `
		<svg class="binocle__svg" viewBox="0 0 184 118" aria-hidden="true">
			<g class="svg-body-group">
				<path class="svg-arm left" d="M49 31 C39 18, 25 18, 19 32" />
				<path class="svg-arm right" d="M135 31 C147 18, 161 19, 166 33" />
				<g class="svg-tube-stack">${tubeSlices(SHELL_LEFT)}</g>
				<g class="svg-tube-stack">${tubeSlices(SHELL_RIGHT)}</g>
				<g class="svg-volume">
					<path class="svg-shell left" d="${SHELL_LEFT}" />
					<path class="svg-shell right" d="${SHELL_RIGHT}" />
				</g>
				<path class="svg-barrel left" d="M20 39 C29 28, 47 25, 62 32 C50 29, 33 32, 24 43 C16 54, 16 67, 24 77 C12 69, 9 51, 20 39Z" />
				<path class="svg-barrel right" d="M122 32 C136 25, 154 28, 164 39 C175 51, 172 69, 160 77 C168 67, 168 54, 160 43 C151 32, 134 29, 122 32Z" />
				<ellipse class="svg-frame left-frame" cx="43" cy="57" rx="39" ry="34" />
				<ellipse class="svg-frame right-frame" cx="141" cy="57" rx="39" ry="34" />
				<ellipse class="svg-inner-rim" cx="43" cy="57" rx="28" ry="24" />
				<ellipse class="svg-inner-rim" cx="141" cy="57" rx="28" ry="24" />
				<ellipse class="svg-rim" cx="38" cy="53" rx="24" ry="20" />
				<ellipse class="svg-rim" cx="136" cy="53" rx="24" ry="20" />
				<path class="svg-center-band" d="M84 53 C88 48, 96 48, 100 53" />
				<path class="svg-center-band" d="M86 67 C90 71, 95 71, 99 67" />
				<path class="svg-bridge-shadow" d="M99 62 C103 54, 110 54, 114 62" />
				<path class="svg-bridge" d="M80 61 C84 51, 91 48, 97 52 C101 55, 104 59, 108 62 C110 63, 112 63, 114 62" />
				<path class="svg-detail" d="M16 55 C20 34, 36 24, 56 28" />
				<path class="svg-detail" d="M19 62 C21 76, 35 86, 52 85" />
				<path class="svg-detail" d="M118 28 C139 23, 158 34, 164 55" />
				<path class="svg-detail" d="M162 63 C159 78, 145 86, 129 84" />
				<path class="svg-stitch" d="M28 80 C40 86, 57 85, 67 77" />
				<path class="svg-stitch" d="M123 77 C134 86, 152 85, 162 78" />
				<path class="svg-brow left" d="M22 20 C34 14, 54 14, 66 21" />
				<path class="svg-brow right" d="M118 21 C130 14, 151 14, 163 20" />
				<ellipse class="svg-cheek left" cx="22" cy="68" rx="10" ry="7" />
				<ellipse class="svg-cheek right" cx="162" cy="68" rx="10" ry="7" />
				<path class="svg-sweat" d="M166 32 C173 42, 172 50, 165 53 C158 48, 158 40, 166 32Z" />
				<path class="svg-tear" d="M157 69 C164 79, 163 87, 156 90 C149 85, 150 77, 157 69Z" />
				<g class="svg-stars"><path class="svg-star" d="M23 13 L26 20 L33 21 L28 26 L29 33 L23 29 L17 33 L18 26 L13 21 L20 20Z" /><path class="svg-star" d="M159 10 L162 17 L169 18 L164 23 L165 30 L159 26 L153 30 L154 23 L149 18 L156 17Z" /><path class="svg-star" d="M94 5 L96 11 L102 12 L98 16 L99 22 L94 19 L89 22 L90 16 L86 12 L92 11Z" /></g>
				<path class="svg-spiral left" d="M33 56 C33 48, 47 47, 48 56 C49 66, 36 67, 36 58 C36 53, 43 53, 43 58" />
				<path class="svg-spiral right" d="M131 56 C131 48, 145 47, 146 56 C147 66, 134 67, 134 58 C134 53, 141 53, 141 58" />
				<g class="svg-eye left"><circle class="svg-pupil" cx="43" cy="57" r="11.4" /><circle class="svg-pupil-shine" cx="38.8" cy="52.8" r="2.7" /></g>
				<g class="svg-eye right"><circle class="svg-pupil" cx="141" cy="57" r="11.4" /><circle class="svg-pupil-shine" cx="136.8" cy="52.8" r="2.7" /></g>
				<path class="svg-pupil-heart left" d="M43 52 C43 46, 35 43, 32 50 C29 57, 43 66, 43 66 C43 66, 57 57, 54 50 C51 43, 43 46, 43 52Z" />
				<path class="svg-pupil-heart right" d="M141 52 C141 46, 133 43, 130 50 C127 57, 141 66, 141 66 C141 66, 155 57, 152 50 C149 43, 141 46, 141 52Z" />
				<g class="svg-thought-bubble"><circle cx="14" cy="30" r="2.5" /><circle cx="9" cy="22" r="4" /><circle cx="5" cy="13" r="6" /></g>
				<ellipse class="svg-mouth-pad" cx="92" cy="96" rx="23" ry="15" />
				<path class="svg-mouth smile" d="M76 93 C83 105, 101 105, 108 93" />
				<path class="svg-mouth ajar" d="M78 94 C84 102, 100 102, 106 94 C101 99, 84 99, 78 94Z" />
				<path class="svg-mouth open" d="M77 93 C77 80, 86 73, 93 73 C102 73, 111 81, 110 94 C109 108, 99 115, 91 115 C83 115, 77 107, 77 93Z" />
				<path class="svg-mouth-core" d="M83 95 C83 85, 88 80, 93 80 C100 80, 105 86, 104 96 C103 106, 96 110, 91 110 C85 110, 83 104, 83 95Z" />
				<ellipse class="svg-mouth-shine" cx="88" cy="88" rx="3" ry="2.2" />
				<path class="svg-mouth flat" d="M81 96 C87 98, 98 98, 103 96" />
				<path class="svg-mouth grimace" d="M80 91 C87 89, 98 89, 105 91 L104 101 C97 104, 86 104, 80 101Z" />
				<path class="svg-mouth teeth" d="M80 92 L106 92 M84 92 L84 101 M90 92 L90 102 M96 92 L96 102 M102 92 L102 101" />
				<ellipse class="svg-mouth ooh" cx="92" cy="95" rx="8" ry="10" />
				<path class="svg-mouth tremble" d="M78 96 C82 91, 86 101, 90 96 C94 91, 98 101, 104 95" />
				<path class="svg-mouth smirk" d="M80 97 C84 103, 96 104, 106 95" />
				<path class="svg-mouth silly-open" d="M78 92 C78 80, 86 73, 93 73 C102 73, 110 81, 110 92" />
				<ellipse class="svg-mouth silly-tongue" cx="92" cy="100" rx="9" ry="7" />
				<path class="svg-mouth zip" d="M80 96 L106 96 M84 93 L88 99 M88 93 M92 99 M92 93 L96 99 M96 93 L100 99 M100 93 L104 99" />
				<path class="svg-spark" d="M117 84 L124 78 M119 92 L128 93 M112 91 L106 96" />
			</g>
		</svg>`;
}

export function prepareMascotSvg(mascot: HTMLButtonElement): void {
	const svg = mascot.querySelector('.binocle__svg');
	if (!(svg instanceof SVGSVGElement)) {
		return;
	}
	svg.setAttribute('focusable', 'false');
}

export function characterMarkup(): string {
	return `
		<button class="binocle" type="button" data-mood="curious" aria-label="Open Prismatica portal">
			${mascotSvgMarkup()}
			<span class="right-lens-hotspot" aria-hidden="true"></span>
		</button>`;
}