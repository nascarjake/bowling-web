// Shared by the live ball texture and the cached equipment portraits. Keep this
// recipe deterministic so the selection screen depicts the equipped skin.
export function ballTextureVein(u, v) {
    const t = Math.sin(u * 5 + Math.sin(v * 8 + Math.cos(u * 3)) * 2.5);
    return Math.pow((t + 1) / 2, 5);
}
export const BALL_TEXTURE_CHANNELS = [[16, 44], [49, 145], [100, 104]];
