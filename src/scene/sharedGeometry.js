// Geometry is immutable after construction. A mesh owns one lease; a clone
// must retain its own lease. Idempotent release also handles retired pin records
// being visited again when the next rack is generated.
export function createSharedGeometryPool() {
    const entries = new Map(), byGeometry = new WeakMap(), owners = new WeakMap();
    return {
        get size() { return entries.size; },
        get(key, create) {
            if (!entries.has(key)) {
                const entry = { key, geometry: create(), references: 0 };
                entries.set(key, entry);
                byGeometry.set(entry.geometry, entry);
            }
            return entries.get(key).geometry;
        },
        retain(mesh) {
            const entry = byGeometry.get(mesh.geometry);
            if (!entry || entries.get(entry.key) !== entry || owners.has(mesh)) return;
            owners.set(mesh, entry);
            entry.references++;
        },
        release(mesh) {
            const entry = owners.get(mesh);
            if (entry) {
                owners.delete(mesh);
                if (--entry.references === 0) {
                    entries.delete(entry.key);
                    entry.geometry.dispose();
                }
            }
            // Managed geometries are released here, including on repeat cleanup;
            // the caller must not also dispose them as individually owned assets.
            return byGeometry.has(mesh.geometry);
        }
    };
}
