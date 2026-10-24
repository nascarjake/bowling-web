import test from 'node:test';
import assert from 'node:assert/strict';
import { createRapierCannonShim } from '../src/physics/rapierShim.js?v=0.4.1';

import {fakeRapier} from './helpers/fakeRapier.js?v=0.4.1';

test('compound pin mass is distributed exactly once, lower center is weighted, and pins start asleep', () => {
    const CANNON = createRapierCannonShim(fakeRapier);
    const world = new CANNON.World();
    const pin = new CANNON.Body({ mass: 1.5, material: new CANNON.Material({ name: 'pin' }), shapeMassWeights: [3, 1], ccdEnabled: true });
    pin.addShape(new CANNON.Sphere(0.25), new CANNON.Vec3(0, -0.4, 0));
    pin.addShape(new CANNON.Sphere(0.15), new CANNON.Vec3(0, 0.5, 0));
    pin.sleep();
    world.addBody(pin);

    const colliders = world.raw.colliders;
    assert.equal(colliders.reduce((sum, collider) => sum + collider.mass, 0), 1.5);
    assert.equal(colliders[0].mass, 1.125);
    assert.ok(colliders.reduce((sum, collider) => sum + collider.mass * collider.translation.y, 0) < 0);
    assert.equal(world.raw.bodyDesc.ccdEnabled, true);
    assert.equal(world.raw.body.slept, true);
});

test('pocket carry applies an impulse at a contact point and solver settings reach Rapier', () => {
    const CANNON = createRapierCannonShim(fakeRapier);
    const world = new CANNON.World();
    world.solver.iterations = 8;
    assert.equal(world.raw.numSolverIterations, 8);
    assert.equal(world.raw.maxCcdSubsteps, 2);

    const pin = new CANNON.Body({ mass: 1.5, material: new CANNON.Material({ name: 'pin' }) });
    pin.addShape(new CANNON.Cylinder(0.2, 0.3, 0.4));
    world.addBody(pin);
    assert.equal(world.raw.colliders[0].size.radius, 0.25);
    assert.equal(world.raw.bodyDesc.ccdEnabled, undefined);

    pin.applyImpulseAtPoint(new CANNON.Vec3(1, 0, -2), new CANNON.Vec3(0.1, 0.5, 0));
    assert.deepEqual(world.raw.body.lastImpulse, {
        impulse: { x: 1, y: 0, z: -2 },
        point: { x: 0.1, y: 0.5, z: 0 },
        wakeUp: true
    });
});

test('multiple collider contacts report one pin-to-pin impact per physics step', () => {
    const CANNON = createRapierCannonShim(fakeRapier);
    const world = new CANNON.World();
    const first = new CANNON.Body({ mass: 1 });
    first.addShape(new CANNON.Sphere(0.2));
    first.addShape(new CANNON.Sphere(0.2));
    const second = new CANNON.Body({ mass: 1 });
    second.addShape(new CANNON.Sphere(0.2));
    world.addBody(first);
    world.addBody(second);
    let impacts = 0;
    first.addEventListener('collide', () => impacts++);
    world.eventQueue.events = [[1, 3, true], [2, 3, true]];
    world.step(1 / 60);
    assert.equal(impacts, 1);
});


test('24 racks release only owned collider handles, listeners and body references', () => {
    const CANNON = createRapierCannonShim(fakeRapier);
    const world = new CANNON.World();
    const guard = new CANNON.Body({ mass: 0, shape: new CANNON.Box(new CANNON.Vec3(1, 1, 1)) });
    world.addBody(guard);
    world.bodiesByCollider.entries = () => { throw new Error('teardown must not scan the whole world'); };
    for (let round = 0; round < 24; round++) {
        const pins = Array.from({length:120}, () => {
            const pin = new CANNON.Body({mass:1.5});
            for (let i = 0; i < 6; i++) pin.addShape(new CANNON.Sphere(.2));
            pin.addEventListener('collide', () => {});
            world.addBody(pin);return pin;
        });
        assert.equal(world.bodiesByCollider.size,721);
        pins.forEach(pin => { world.remove(pin);world.remove(pin);assert.equal(pin.raw,null);assert.equal(pin.world,null);assert.equal(pin.colliderHandles.length,0); });
        assert.equal(world.bodiesByCollider.size,1);assert.equal(world.raw.bodies.length,1);
    }
    // A removed wrapper can be added again with its newly assigned handles.
    world.remove(guard);world.addBody(guard);
    assert.equal(world.bodiesByCollider.size,1);world.remove(guard);assert.equal(world.bodiesByCollider.size,0);
});

test('removing from another world cannot delete a colliding numeric handle', () => {
    const CANNON = createRapierCannonShim(fakeRapier);
    const first = new CANNON.World(), second = new CANNON.World();
    const pin = new CANNON.Body({mass:1,shape:new CANNON.Sphere(.2)});
    first.addBody(pin);second.remove(pin);
    assert.equal(first.bodiesByCollider.size,1);assert.ok(pin.raw);first.remove(pin);
});

test('only force-bearing bodies are cleared once, after the force has acted', () => {
    const C=createRapierCannonShim(fakeRapier),world=new C.World();
    const pins=Array.from({length:120},()=>new C.Body({mass:1.5,shape:new C.Sphere(.2)}));
    const ball=new C.Body({mass:7.6,shape:new C.Sphere(.49)});
    world.addBody(ball);pins.forEach(pin=>world.addBody(pin));
    ball.applyForce(new C.Vec3(2,0,-3));ball.applyForce(new C.Vec3(4,0,1));
    assert.equal(world.forcedBodies.size,1);world.step(1/60);
    assert.deepEqual(world.raw.stepForces[0],{x:6,y:0,z:-2});
    assert.deepEqual(ball.raw.force,{x:0,y:0,z:0});assert.equal(ball.raw.lastResetWake,false);
    assert.equal(world.raw.operations.resetForces,1);assert.equal(world.raw.operations.bodyVisits,0);
    assert.equal(world.forcedBodies.size,0);world.step(1/60);
    assert.deepEqual(world.raw.stepForces[0],{x:0,y:0,z:0});assert.equal(world.raw.operations.resetForces,1);
});

test('collision-added forces survive for the next step and removed bodies are not retained', () => {
    const C=createRapierCannonShim(fakeRapier),world=new C.World();
    const ball=new C.Body({mass:7.6,shape:new C.Sphere(.49)}),pin=new C.Body({mass:1.5,shape:new C.Sphere(.2)});
    world.addBody(ball);world.addBody(pin);
    pin.addEventListener('collide',()=>ball.applyForce(new C.Vec3(3,0,0)));
    world.eventQueue.events=[[ball.colliderHandles[0],pin.colliderHandles[0],true]];
    world.step(1/60);assert.equal(world.forcedBodies.size,1);assert.equal(ball.raw.force.x,3);
    world.eventQueue.events=[];world.step(1/60);assert.equal(world.raw.stepForces[0].x,3);
    assert.equal(ball.raw.force.x,0);assert.equal(world.forcedBodies.size,0);
    ball.applyForce(new C.Vec3(5,0,0));world.remove(ball);
    assert.equal(world.forcedBodies.size,0);world.step(1/60);
    ball.applyForce(new C.Vec3(5,0,0));assert.equal(world.forcedBodies.size,0);
});

test('transform transfers read current native values once without modifying the body', () => {
    const C=createRapierCannonShim(fakeRapier),world=new C.World();
    const body=new C.Body({mass:1,shape:new C.Sphere(.2)});world.addBody(body);
    const vector={set(x,y,z){Object.assign(this,{x,y,z});return this;}};
    const quaternion={set(x,y,z,w){Object.assign(this,{x,y,z,w});return this;}};
    for(let i=0;i<120;i++) {
        body.raw.pos={x:i,y:-i,z:i*.5};body.raw.rot={x:.1,y:.2,z:.3,w:.9};
        assert.equal(body.position.copyTo(vector),vector);body.quaternion.copyTo(quaternion);
        assert.deepEqual([vector.x,vector.y,vector.z],[i,-i,i*.5]);
        assert.deepEqual([quaternion.x,quaternion.y,quaternion.z,quaternion.w],[.1,.2,.3,.9]);
    }
    assert.equal(world.raw.operations.translations,120);assert.equal(world.raw.operations.rotations,120);
    assert.deepEqual(body.raw.force,{x:0,y:0,z:0});
    const standalone=new C.Vec3(-2,3,4);standalone.copyTo(vector);
    assert.deepEqual([vector.x,vector.y,vector.z],[-2,3,4]);
    new C.Quaternion(0,0,.5,.5).copyTo(quaternion);assert.equal(quaternion.w,.5);
});

test('vector arithmetic reads each native operand once and keeps numeric results', () => {
    const C=createRapierCannonShim(fakeRapier),world=new C.World();
    const a=new C.Body({mass:1,shape:new C.Sphere(.2)}),b=new C.Body({mass:1,shape:new C.Sphere(.2)});
    world.addBody(a);world.addBody(b);a.raw.pos={x:3,y:4,z:0};b.raw.pos={x:0,y:0,z:0};
    const target=new C.Vec3();a.position.vsub(b.position,target);
    assert.deepEqual([target.x,target.y,target.z],[3,4,0]);assert.equal(world.raw.operations.translations,2);
    target.copy(a.position);assert.equal(world.raw.operations.translations,3);
    assert.equal(a.position.distanceTo(b.position),5);assert.equal(world.raw.operations.translations,5);
    a.position.scale(2,target);assert.deepEqual([target.x,target.y,target.z],[6,8,0]);assert.equal(world.raw.operations.translations,6);
    a.position.normalize();assert.deepEqual(a.raw.pos,{x:.6,y:.8,z:0});assert.equal(world.raw.operations.translations,7);
    b.position.normalize();assert.deepEqual(b.raw.pos,{x:0,y:0,z:0});
    const plain={x:1,y:2,z:3};target.copy(plain);assert.deepEqual([target.x,target.y,target.z],[1,2,3]);
});
