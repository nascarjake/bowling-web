// Same 24-segment silhouette and UVs for every pin of the same size. Materials
// remain per-pin, so special colors and visual overrides remain independent.
export function createPinGeometry(T, radius, height) {
    const profile = [[0, 0], [.6, 0], [.7, .05], [.91, .18], [1, .3], [.92, .42], [.64, .55], [.4, .66], [.39, .76], [.53, .84], [.55, .9], [.4, .97], [0, 1]];
    const points = profile.map(([x, y]) => new T.Vector2(x * radius, (y - 0.5) * height));
    const geometry = new T.LatheGeometry(points, 24);
    const uv = geometry.attributes.uv, pos = geometry.attributes.position;
    for (let i = 0; i < uv.count; i++) uv.setY(i, pos.getY(i) / height + 0.5);
    return geometry;
}
