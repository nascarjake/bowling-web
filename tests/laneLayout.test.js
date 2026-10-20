import test from 'node:test';
import assert from 'node:assert/strict';
import { createLaneDimensions, createLaneLayout, laneCameraDistance } from '../src/game/laneLayout.js';

test('all routes expand from ten to 120 pins and keep the entire rack on the lane', () => {
    for (const layout of ['classic', 'wide', 'split', 'boss', 'fragile', 'messy']) {
        let previousWidth = 0;
        for (let frame = 1; frame <= 12; frame++) {
            const rack = createLaneLayout({ frame, layout });
            assert.equal(rack.points.length, (frame + 3) * (frame + 4) / 2);
            assert.ok(rack.width > previousWidth, `${layout}: frame ${frame} must expand`);
            for (const point of rack.points) {
                assert.ok(Math.abs(point.x) + rack.radius + rack.jitter < rack.width / 2);
                assert.ok(point.z >= 0 && point.z <= rack.depth);
            }
            previousWidth = rack.width;
        }
    }
});

test('classic ten-pin mode keeps ten pins and a fixed lane in every frame', () => {
    for (let frame = 1; frame <= 10; frame++) {
        const rack = createLaneLayout({ frame, classic: true, layout: 'wide' });
        assert.equal(rack.points.length, 10);
        assert.equal(rack.width, 4.8);
        assert.equal(rack.points[0].x, 0);
    }
});

test('route changes preserve width and camera backs up for wide racks and portrait screens', () => {
    assert.equal(createLaneLayout({ frame: 8, layout: 'split' }).width, createLaneLayout({ frame: 8 }).width);
    assert.ok(laneCameraDistance(20) > laneCameraDistance(5));
    assert.ok(laneCameraDistance(20, 0.6) > laneCameraDistance(20, 1.8));
});

test('each wider rack adds length behind the first pin while the release and foul line stay fixed', () => {
    const first = createLaneDimensions();
    const firstRack = createLaneLayout({ frame: 1 });
    const firstPinZ = first.endZ + 3.5 + firstRack.depth;
    for (let frame = 1; frame <= 12; frame++) {
        const dimensions = createLaneDimensions({ frame });
        const rack = createLaneLayout({ frame });
        assert.ok(Math.abs(dimensions.endZ + 3.5 + rack.depth - firstPinZ) < 1e-9);
        assert.equal(dimensions.foulLineZ, first.foulLineZ);
        assert.equal(dimensions.releaseZ, first.releaseZ);
        assert.ok(dimensions.releaseZ > dimensions.foulLineZ);
        assert.ok(dimensions.releaseZ < dimensions.foulLineZ + dimensions.approachLength);
        assert.ok(Math.abs(dimensions.length - first.length - (rack.depth - firstRack.depth)) < 1e-9);
    }
    const classic = createLaneDimensions({ frame: 10, classic: true });
    assert.equal(classic.length, first.length);
});
