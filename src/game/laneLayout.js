// One layout owns pin placement, lane width, and the depth of the pin deck.
// Rows grow from 4 to 15: 10, 15, 21 ... 120 pins over a twelve-frame run.
export const APPROACH_LENGTH = 7;
export const RELEASE_BEHIND_FOUL_LINE = 3;
// Existing project limits, shared with spawn jitter and manual lane tuning.
export const PIN_RACK_MICRO_JITTER = 0.018;
export const MIN_PLAYABLE_LANE_WIDTH = 1.5;

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
    // Preserve the original progression envelope when deriving route points:
    // existing wide/split/boss offsets and their clamping must not change.
    const designWidth = classic
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
    const room = designWidth / 2 - radius - padding - jitter;
    if (extent > room) points.forEach(point => { point.x *= room / extent; });
    const occupiedExtent = points.reduce((max, point) => Math.max(max, Math.abs(point.x)), 0);
    // Fit the actual playable lane, not the widest hypothetical route. Include
    // both rack jitter and spawn micro-jitter so corner pins retain safe margins.
    // Lane width can now vary by route; visual surface, gutters and collider all
    // receive this same width. Classic dimensions/manual debug tuning stay intact.
    const width = classic ? designWidth : Math.max(MIN_PLAYABLE_LANE_WIDTH,
        2 * (occupiedExtent + radius + Math.max(0, padding) + jitter + PIN_RACK_MICRO_JITTER / 2));
    return { rows, width, depth: (rows - 1) * rowDepth, jitter, radius, points };
}

export function laneCameraDistance(width, aspect = 16 / 9, fov = 45) {
    // Reserve screen space for the HUD and keep both gutters in view.
    const horizontalFov = 2 * Math.atan(Math.tan(fov * Math.PI / 360) * Math.max(0.45, aspect));
    return Math.max(9, (width + 3) / (2 * Math.tan(horizontalFov / 2)) * 1.15);
}

// Only the current rack is retained. Every input participates in invalidation,
// including mutable debug controls; points are read-only after construction.
export function createLaneLayoutCache(create = createLaneLayout) {
    let previous = null, result;
    return ({ frame = 1, classic = false, layout = 'classic', scale = 0.8, padding = 0.45 } = {}) => {
        if (!previous || previous.frame !== frame || previous.classic !== classic ||
            previous.layout !== layout || previous.scale !== scale || previous.padding !== padding) {
            previous = { frame, classic, layout, scale, padding };
            result = create(previous);
        }
        return result;
    };
}
