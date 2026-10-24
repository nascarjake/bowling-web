// Twelve fixed meshes (six ring/core pairs), shared geometry/materials; no particles or per-tick allocation.
export function createMawVisuals(T, scene, { origin, length, gutterX, safeHalfWidth = 0, warningSeconds = 0 }) {
    const group = new T.Group();
    const ringGeometry = new T.TorusGeometry(0.34, 0.055, 5, 20);
    const coreGeometry = new T.CircleGeometry(0.29, 20);
    const ringMaterial = new T.MeshBasicMaterial({ color: 0xc78aff });
    const coreMaterial = new T.MeshBasicMaterial({ color: 0x100523, side: T.DoubleSide });
    let safeCenterCue = null;
    let safeCenterGeometry = null;
    let safeCenterMaterial = null;
    for (const side of [-1, 1]) for (const offset of [-0.28, 0, 0.28]) {
        for (const [geometry, material] of [[ringGeometry, ringMaterial], [coreGeometry, coreMaterial]]) {
            const mesh = new T.Mesh(geometry, material);
            mesh.rotation.x = -Math.PI / 2;
            mesh.position.set(origin.x + side * gutterX, origin.y + 0.07, origin.z + offset * length);
            group.add(mesh);
        }
    }
    if (safeHalfWidth > 0 && warningSeconds > 0) {
        safeCenterCue = new T.Group();
        safeCenterCue.visible = false;
        safeCenterGeometry = new T.BoxGeometry(0.055, 0.018, length);
        safeCenterMaterial = new T.MeshBasicMaterial({ color: 0xa9f8ea, transparent: true, opacity: 0.92, depthWrite: false });
        for (const side of [-1, 1]) {
            const marker = new T.Mesh(safeCenterGeometry, safeCenterMaterial);
            marker.position.set(origin.x + side * safeHalfWidth, origin.y + 0.025, origin.z);
            safeCenterCue.add(marker);
        }
        group.add(safeCenterCue);
    }
    scene.add(group);
    return {
        update(time) {
            ringMaterial.color.setHSL(0.76, 0.85, 0.57 + Math.sin(time * 3) * 0.1);
            if (!safeCenterCue) return;
            safeCenterCue.visible = Number.isFinite(time) && time >= 0 && time < warningSeconds;
            if (safeCenterCue.visible) safeCenterMaterial.opacity = 0.2 + 0.72 * ((warningSeconds - time) / warningSeconds);
        },
        hideWarning() { if (safeCenterCue) safeCenterCue.visible = false; },
        dispose() {
            scene.remove(group);
            ringGeometry.dispose(); coreGeometry.dispose(); ringMaterial.dispose(); coreMaterial.dispose();
            safeCenterGeometry?.dispose(); safeCenterMaterial?.dispose();
        }
    };
}
