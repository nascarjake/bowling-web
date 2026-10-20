import test from 'node:test';
import assert from 'node:assert/strict';
import { routeNodePosition, stageConnections, districtForStage, routeTheme } from '../src/ui/routeArt.js';
import { ROUTE_TYPES, BOSS_VARIANTS } from '../src/content/routes.js';

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
