import test from 'node:test';
import assert from 'node:assert/strict';
import { routeNodePosition, stageConnections, circuitWires, districtForStage, routeTheme } from '../src/ui/routeArt.js?v=0.3.0';
import { ROUTE_TYPES, BOSS_VARIANTS } from '../src/content/routes.js?v=0.3.0';

const rows = Array.from({ length: 12 }, (_, index) => {
    const frame = index + 1;
    const count = frame === 1 || frame % 4 === 0 ? 1 : 3;
    return Array.from({ length: count }, (_, choice) => ({ id: `f${frame}-${choice}`, frame, index: choice }));
});

test('each district connects all legal next-frame choices and ends at its boss', () => {
    for (let stage = 1; stage <= 3; stage++) {
        const links = stageConnections(rows, stage);
        const firstFrame = (stage - 1) * 4 + 1;
        const boss = rows[stage * 4 - 1][0];
        assert.equal(links.filter(link => link.to.id === boss.id).length, 3);
        for (const { from, to } of links) {
            assert.equal(to.frame, from.frame + 1);
            assert.ok(from.frame >= firstFrame && to.frame <= stage * 4);
        }
        for (let frame = firstFrame; frame < stage * 4; frame++) {
            for (const from of rows[frame - 1]) for (const to of rows[frame]) {
                assert.ok(links.some(link => link.from.id === from.id && link.to.id === to.id));
            }
        }
    }
});

test('portrait maps transpose the same route positions and bosses remain centered', () => {
    for (const node of rows.flat()) {
        const desktop = routeNodePosition(node);
        const portrait = routeNodePosition(node, true);
        assert.deepEqual(portrait, { x: desktop.y, y: desktop.x });
        assert.ok(desktop.x >= 12 && desktop.x <= 86 && desktop.y >= 22 && desktop.y <= 78);
        if (node.frame % 4 === 0) assert.equal(desktop.y, 50);
    }
});

test('wires reach every artwork port through shared junctions on rectangular maps', () => {
    for (const [width, height, portrait] of [[1040, 420, false], [520, 170, false], [340, 380, true]]) {
        const anchors = Object.fromEntries(rows.flat().map(node => {
            const position = routeNodePosition(node, portrait);
            return [node.id, { x: position.x * width / 100, y: position.y * height / 100, rx: 24, ry: 16 }];
        }));
        for (let stage = 1; stage <= 3; stage++) {
            const wires = circuitWires(rows, stage, anchors, portrait);
            assert.equal(wires.junctions.length, 3);
            for (const wire of wires.paths) {
                const anchor = anchors[wire.nodeId];
                const port = wire.side === 'out' ? wire.start : wire.end;
                const direction = wire.side === 'out' ? 1 : -1;
                assert.deepEqual(port, {
                    x: anchor.x + (portrait ? 0 : anchor.rx * direction),
                    y: anchor.y + (portrait ? anchor.ry * direction : 0)
                });
                const hub = wire.side === 'out' ? wire.end : wire.start;
                assert.ok(wires.junctions.some(point => point.x === hub.x && point.y === hub.y));
            }
            for (let column = (stage - 1) * 4; column < stage * 4; column++) {
                for (const node of rows[column]) {
                    const connected = wires.paths.filter(wire => wire.nodeId === node.id);
                    assert.equal(connected.length, column % 4 === 0 || column % 4 === 3 ? 1 : 2);
                }
            }
        }
    }
});

test('every boss and route has a valid visual identity without changing gameplay rules', () => {
    const routes = [...Object.values(ROUTE_TYPES), ...Object.values(BOSS_VARIANTS).flat()];
    for (const route of routes) {
        const before = JSON.stringify(route);
        const theme = routeTheme(route);
        assert.match(theme.color, /^#[0-9a-f]{6}$/i);
        assert.ok(theme.motif && theme.title);
        assert.equal(JSON.stringify(route), before);
    }
    assert.notEqual(districtForStage(1).color, districtForStage(2).color);
    assert.notEqual(districtForStage(2).color, districtForStage(3).color);
});
