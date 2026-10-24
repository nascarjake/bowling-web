import test from 'node:test';
import assert from 'node:assert/strict';
import { createLaneDimensions, createLaneLayout, createLaneLayoutCache, laneCameraDistance, PIN_RACK_MICRO_JITTER, MIN_PLAYABLE_LANE_WIDTH } from '../src/game/laneLayout.js?v=0.4.0';

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

test('playable width follows the occupied route rack and camera fits wide/portrait views', () => {
    assert.ok(createLaneLayout({ frame: 8, layout: 'split' }).width > createLaneLayout({ frame: 8 }).width);
    assert.ok(createLaneLayout({ frame: 8, layout: 'wide' }).width > createLaneLayout({ frame: 8 }).width);
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


test('layout cache reuses only identical geometry inputs and invalidates mutable tuning', () => {
    let constructions = 0;
    const cached = createLaneLayoutCache(options => { constructions++; return createLaneLayout(options); });
    const settings = {frame:12,classic:false,layout:'classic',scale:.8,padding:.45};
    const first = cached(settings);
    for (let i = 0; i < 600; i++) assert.equal(cached({...settings}), first);
    assert.equal(constructions,1);
    for (const [key,value] of [['frame',9],['classic',true],['layout','split'],['scale',1.2],['padding',.8]]) {
        settings[key] = value;
        const next = cached(settings);
        assert.deepEqual(next,createLaneLayout(settings));
        assert.equal(cached(settings),next);
    }
    assert.equal(constructions,6);
});

test('layout cache has no growth across 24 runs and matches every route/frame', () => {
    let constructions = 0;
    const cached = createLaneLayoutCache(options => { constructions++;return createLaneLayout(options); });
    for (let run = 0; run < 24; run++) for (let frame = 1; frame <= 12; frame++) {
        for (const layout of ['classic','wide','split','boss','fragile','messy']) {
            const options = {frame,layout,scale:run%2 ? 1:.8};
            const actual = cached(options);
            assert.deepEqual(actual,createLaneLayout(options));
            assert.equal(cached(options),actual);
        }
    }
    const a = cached({frame:1});cached({frame:12});
    assert.notEqual(cached({frame:1}),a,'only the latest layout is retained');
    assert.equal(constructions,24*12*6+3);
});


test('default corner clearances include all spawn jitter but cannot fit a default ball', () => {
    const ballDiameter = .49 * 2; // existing spawnBall baseRadius, not a real-world measurement
    for(const layout of ['classic','wide','split','boss','fragile','messy']) for(let frame=1;frame<=12;frame++) {
        const rack=createLaneLayout({frame,layout});
        const corners=rack.points.filter(p=>p.row===rack.rows-1 && (p.col===0||p.col===p.row));
        const jitter=rack.jitter+PIN_RACK_MICRO_JITTER/2;
        for(const point of corners) {
            const clearance=rack.width/2-Math.abs(point.x)-rack.radius;
            assert.ok(clearance-jitter>=.45-1e-12,`${layout} ${frame}: outward jitter remains inside configured margin`);
            assert.ok(clearance+jitter<ballDiameter,`${layout} ${frame}: corner gap does not fit a full default ball`);
        }
    }
});

test('fitted lane honors project minimum width and intentional padding overrides', () => {
    const small=createLaneLayout({frame:1,scale:.2,padding:0});assert.ok(small.width>=MIN_PLAYABLE_LANE_WIDTH);
    const normal=createLaneLayout({frame:12,padding:.45}),custom=createLaneLayout({frame:12,padding:1.2});
    assert.ok(custom.width>normal.width);assert.deepEqual(custom.points,normal.points);
    for(const point of small.points) assert.ok(Math.abs(point.x)+small.radius+small.jitter+PIN_RACK_MICRO_JITTER/2<=small.width/2);
});

test('actual app width provider follows fitted route geometry and preserves manual/classic tuning',async()=>{
    const fs=await import('node:fs'),vm=await import('node:vm');
    const source=fs.readFileSync(new URL('../src/game/app.js',import.meta.url),'utf8');
    const context={GAME:{frame:1,mode:'roguelike',currentRoute:{layout:'classic'}},
        debugState:{config:{pins:{scale:.8},physicsLane:{frameWidthPadding:.45,useFrameWidth:true,width:9}}},
        DEFAULT_DEBUG_CONFIG:{physicsLane:{}},LANE:{referenceWidth:4.8},MIN_PLAYABLE_LANE_WIDTH,
        getCachedRackLayout:createLaneLayoutCache(),pinGroupScale:()=>.8};
    context.isTenPinMode=()=>context.GAME.mode==='tenpin';
    const functions=['currentRackLayout','laneWidthForFrame','requestedPhysicsLaneWidth'].map(name=>{const start=source.indexOf(`function ${name}(`);return source.slice(start,source.indexOf('\n}',start)+2);}).join('\n');
    vm.createContext(context);vm.runInContext(functions,context);
    for(const layout of ['classic','wide','split','boss','fragile','messy'])for(let frame=1;frame<=12;frame++) {
        context.GAME.frame=frame;context.GAME.currentRoute.layout=layout;
        assert.equal(context.requestedPhysicsLaneWidth(frame),createLaneLayout({frame,layout}).width);
    }
    context.debugState.config.physicsLane.useFrameWidth=false;
    assert.equal(context.requestedPhysicsLaneWidth(),9);
    context.debugState.config.physicsLane.width=1;assert.equal(context.requestedPhysicsLaneWidth(),MIN_PLAYABLE_LANE_WIDTH);
    context.debugState.config.physicsLane.useFrameWidth=true;context.GAME.mode='tenpin';context.GAME.frame=10;
    assert.equal(context.requestedPhysicsLaneWidth(),4.8);
});
