// Keep the last reflection image paired with the projection that produced it.
// Render the first frame, then honor the existing update interval.
export function shouldUpdateReflection(reflector, interval) {
    const frame = reflector.userData.reflectionFrameCounter || 0;
    reflector.userData.reflectionFrameCounter = (frame + 1) % interval;
    return frame === 0;
}

export function renderReflectionPass(renderer, scene, camera, reflector, target, viewport) {
    const previousTarget = renderer.getRenderTarget();
    const previousXr = renderer.xr.enabled;
    const previousShadowUpdate = renderer.shadowMap.autoUpdate;
    const previousVisible = reflector.visible;
    const hidden = [];
    try {
        reflector.visible = false;
        scene.traverse(object => {
            if (!object.userData?.excludeFromPlanarReflection || !object.visible) return;
            hidden.push(object);
            object.visible = false;
        });
        renderer.xr.enabled = false;
        renderer.shadowMap.autoUpdate = false;
        renderer.setRenderTarget(target);
        // gl.clear(DEPTH_BUFFER_BIT) obeys the depth write mask. A preceding
        // transparent particle/contact draw may have disabled it. Without this,
        // old reflection depths reject moved pins/scene geometry on later frames.
        renderer.state.buffers.depth.setMask(true);
        renderer.clear();
        renderer.render(scene, camera);
    } finally {
        renderer.xr.enabled = previousXr;
        renderer.shadowMap.autoUpdate = previousShadowUpdate;
        try {
            renderer.setRenderTarget(previousTarget);
            if (viewport !== undefined) renderer.state.viewport(viewport);
        } finally {
            hidden.forEach(object => { object.visible = true; });
            reflector.visible = previousVisible;
        }
    }
}

export function syncReflectionClone(source, reflection, config, floorY) {
    if (!source || !reflection) return;
    reflection.visible = Boolean(config.enabled && source.visible);
    reflection.position.set(source.position.x, floorY - (source.position.y - floorY) + 0.03, source.position.z);
    reflection.quaternion.copy(source.quaternion);
    // Pop animation changes the source scale; its inverted clone must follow it.
    reflection.scale.copy(source.scale);
    reflection.scale.y *= -1;
    reflection.traverse(child => {
        if (child.isMesh && child.material) child.material.opacity = config.opacity;
    });
}
