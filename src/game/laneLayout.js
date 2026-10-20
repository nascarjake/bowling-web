// One layout owns pin placement, lane width, and the depth of the pin deck.
// Rows grow from 4 to 15: 10, 15, 21 ... 120 pins over a twelve-frame run.
export const APPROACH_LENGTH = 7;
export const RELEASE_BEHIND_FOUL_LINE = 3;

export function createLaneDimensions({ baseLength = 42, centerZ = -12, frame = 1, scale = 0.8, classic = false } = {}) {
    const rows = classic ? 4 : 3 + Math.max(1, Math.min(12, Math.floor(frame)));
    const addedDepth = (rows - 4) * 1.37 * scale * 0.866;
    const foulLineZ = centerZ + baseLength / 2;
    const endZ = centerZ - baseLength / 2 - addedDepth;
    return {
        length: baseLength + addedDepth,
        centerZ: centerZ - addedDepth / 2,
        foulLineZ,
        endZ,
        releaseZ: foulLineZ + RELEASE_BEHIND_FOUL_LINE,
        approachLength: APPROACH_LENGTH
    };
}

export function createLaneLayout({ frame = 1, classic = false, layout = 'classic', scale = 0.8, padding = 0.45 } = {}) {
    const rows = classic ? 4 : 3 + Math.max(1, Math.min(12, Math.floor(frame)));
    const spacing = 1.37 * scale;
    const radius = 0.27 * scale;
    const rowDepth = spacing * 0.866;
    const jitter = classic ? 0 : layout === 'messy' ? 0.15 * scale : layout === 'fragile' ? 0.08 * scale : 0;
    // Width depends on progression, so taking a different route never shrinks it.
    const width = classic
        ? Math.max(4.8, (rows - 1) * spacing + 2 * (radius + padding))
        : (rows - 1) * spacing * 1.25 + 2 * (radius + padding + 0.15 * scale);
    const points = [];
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col <= row; col++) {
            let x = (col - row / 2) * spacing;
            if (!classic && layout === 'wide') x *= 1.22;
            if (!classic && layout === 'boss') x *= 1.08;
            if (!classic && layout === 'split') x += Math.sign(x || (row % 2 ? 1 : -1)) * spacing * 0.65;
            if (!classic && layout === 'fragile' && row % 2) x += spacing * 0.12;
            points.push({ x, z: (rows - 1 - row) * rowDepth, row, col });
        }
    }
    const extent = Math.max(...points.map(point => Math.abs(point.x)));
    const room = width / 2 - radius - padding - jitter;
    if (extent > room) points.forEach(point => { point.x *= room / extent; });
    return { rows, width, depth: (rows - 1) * rowDepth, jitter, radius, points };
}

export function laneCameraDistance(width, aspect = 16 / 9, fov = 45) {
    // Reserve screen space for the HUD and keep both gutters in view.
    const horizontalFov = 2 * Math.atan(Math.tan(fov * Math.PI / 360) * Math.max(0.45, aspect));
    return Math.max(9, (width + 3) / (2 * Math.tan(horizontalFov / 2)) * 1.15);
}
