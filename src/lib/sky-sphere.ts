// Pure maths for the hero planet (scripts/sky-planet.ts): points on a unit
// sphere, the spin-tilt-project pipeline that turns them into screen offsets,
// and a seeded noise mask that groups the surface dots into continents.

export type Vec3 = { x: number; y: number; z: number };

/** A point on the unit sphere; y is the polar axis. Angles in radians. */
export function spherePoint(lat: number, lon: number): Vec3 {
	return { x: Math.cos(lat) * Math.sin(lon), y: Math.sin(lat), z: Math.cos(lat) * Math.cos(lon) };
}

/**
 * Spins `point` about the polar axis, tilts the pole toward the viewer by
 * `tilt` (negative tips it away), and projects orthographically. Returns the
 * screen offset from the sphere's centre (y down) and the depth `z`: above 0
 * faces the viewer, 1 is the point nearest them.
 */
export function projectSphere(point: Vec3, spin: number, tilt: number, radius: number): Vec3 {
	return sphereProjector(spin, tilt, radius)(point, { x: 0, y: 0, z: 0 });
}

/** projectSphere with the trig done once, writing into `out`: for projecting thousands of points a frame. */
export function sphereProjector(spin: number, tilt: number, radius: number): (point: Vec3, out: Vec3) => Vec3 {
	const cosSpin = Math.cos(spin);
	const sinSpin = Math.sin(spin);
	const cosTilt = Math.cos(tilt);
	const sinTilt = Math.sin(tilt);
	return (point, out) => {
		const x = point.x * cosSpin + point.z * sinSpin;
		const z = -point.x * sinSpin + point.z * cosSpin;
		out.x = x * radius;
		out.y = -(point.y * cosTilt - z * sinTilt) * radius;
		out.z = point.y * sinTilt + z * cosTilt;
		return out;
	};
}

function hash3(x: number, y: number, z: number, seed: number): number {
	let h = Math.trunc(Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1274126177) + Math.imul(seed, 2654435761));
	h = Math.imul(h ^ (h >>> 13), 1274126177);
	return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);
const mix = (a: number, b: number, t: number): number => a + (b - a) * t;

/** Smooth 3D value noise in [0, 1). */
export function valueNoise3(x: number, y: number, z: number, seed: number): number {
	const ix = Math.floor(x);
	const iy = Math.floor(y);
	const iz = Math.floor(z);
	const fx = smooth(x - ix);
	const fy = smooth(y - iy);
	const fz = smooth(z - iz);
	const corner = (dx: number, dy: number, dz: number): number => hash3(ix + dx, iy + dy, iz + dz, seed);
	const bottom = mix(mix(corner(0, 0, 0), corner(1, 0, 0), fx), mix(corner(0, 1, 0), corner(1, 1, 0), fx), fy);
	const top = mix(mix(corner(0, 0, 1), corner(1, 0, 1), fx), mix(corner(0, 1, 1), corner(1, 1, 1), fx), fy);
	return mix(bottom, top, fz);
}

/**
 * Whether a surface point is "land". Two octaves of noise make coastlines
 * that read as continents rather than static.
 * Caveat: value noise, not a real map. The default seed covers 40% of the
 * sphere (20,000-point Fibonacci sample); seeds 3, 7, 21 and 42 gave 49–59%,
 * so another seed can change the look noticeably.
 */
export function isLand(point: Vec3, seed = 11): boolean {
	const broad = valueNoise3(point.x * 2.6 + 9, point.y * 2.6 + 9, point.z * 2.6 + 9, seed);
	const fine = valueNoise3(point.x * 7 + 3, point.y * 7 + 3, point.z * 7 + 3, seed + 1);
	return broad * 0.72 + fine * 0.28 > 0.5;
}
