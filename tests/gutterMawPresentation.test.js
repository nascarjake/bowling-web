import test from 'node:test';
import assert from 'node:assert/strict';
import { createMawVisuals } from '../src/scene/gameplayVisuals.js?v=0.4.1';

function harness() {
    const disposed = [];
    class Geometry {
        constructor(...args) { this.args = args; }
        dispose() { disposed.push(this); }
    }
    class Material {
        constructor(options) { Object.assign(this, options); this.color = { setHSL() {} }; }
        dispose() { disposed.push(this); }
    }
    class Group {
        constructor() { this.children = []; this.visible = true; }
        add(child) { this.children.push(child); child.parent = this; }
    }
    class Mesh extends Group {
        constructor(geometry, material) {
            super(); Object.assign(this, { geometry, material, position: { set(x, y, z) { Object.assign(this, { x, y, z }); } }, rotation: {} });
        }
    }
    const T = { Group, Mesh, TorusGeometry: Geometry, CircleGeometry: Geometry, BoxGeometry: Geometry,
        MeshBasicMaterial: Material, DoubleSide: 2 };
    const scene = new Group();
    scene.remove = child => { scene.children = scene.children.filter(item => item !== child); };
    return { T, scene, disposed };
}

test('Gutter Maw center cue follows only the existing grace and disposes cleanly', () => {
    const { T, scene, disposed } = harness();
    const visual = createMawVisuals(T, scene, {
        origin: { x: 2, y: 0, z: -10 }, length: 40, gutterX: 3,
        safeHalfWidth: 1.2, warningSeconds: 0.65
    });
    const group = scene.children[0], cue = group.children.at(-1);
    assert.equal(group.children.length, 13);
    assert.equal(cue.visible, false, 'hidden while aiming');
    assert.deepEqual(cue.children.map(marker => marker.position.x), [0.8, 3.2]);

    visual.update(0.016);
    assert.equal(cue.visible, true);
    const startingOpacity = cue.children[0].material.opacity;
    visual.update(0.32);
    assert.equal(cue.visible, true);
    assert.ok(cue.children[0].material.opacity < startingOpacity, 'fades during existing grace');
    visual.update(0.65);
    assert.equal(cue.visible, false, 'hidden when the existing grace ends');

    visual.update(0.1); // the next roll starts at its own elapsed time
    assert.equal(cue.visible, true);
    visual.hideWarning(); // settling early hides the current cue
    assert.equal(cue.visible, false);
    visual.dispose();
    assert.equal(scene.children.length, 0);
    assert.equal(disposed.length, 6, 'portals and cue release their shared resources');
});

test('without a warning window the visual has portals only', () => {
    const { T, scene } = harness();
    const visual = createMawVisuals(T, scene, { origin: { x: 0, y: 0, z: 0 }, length: 20, gutterX: 3 });
    assert.equal(scene.children[0].children.length, 12);
    visual.dispose();
});
