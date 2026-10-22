// Expire a whole batch before releasing its shared geometry. Burst particles
// share geometry; their materials can be independent because opacity changes.
export function updateParticles(particles, dt) {
    const expiredGeometry = new Set(), expiredMaterials = new Set();
    const liveGeometry = new Set(), liveMaterials = new Set();
    for (let index = particles.length - 1; index >= 0; index--) {
        const particle = particles[index];
        particle.mesh.position.addScaledVector(particle.vel, dt);
        if (particle.fade && particle.mesh.material) {
            particle.mesh.material.opacity = Math.max(0, particle.timer / (particle.duration || 0.26)) * 0.62;
        } else {
            particle.vel.y -= 14 * dt;
        }
        particle.timer -= dt;
        if (particle.timer <= 0) {
            if (particle.fade) {
                particle.mesh.parent?.remove(particle.mesh);
                if (particle.mesh.geometry) expiredGeometry.add(particle.mesh.geometry);
                if (particle.mesh.material) expiredMaterials.add(particle.mesh.material);
            }
            particles.splice(index, 1);
        } else {
            liveGeometry.add(particle.mesh.geometry);
            liveMaterials.add(particle.mesh.material);
        }
    }
    expiredGeometry.forEach(geometry => { if (!liveGeometry.has(geometry)) geometry.dispose(); });
    expiredMaterials.forEach(material => { if (!liveMaterials.has(material)) material.dispose(); });
}
