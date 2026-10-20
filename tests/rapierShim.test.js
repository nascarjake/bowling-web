import test from 'node:test';
import assert from 'node:assert/strict';
import { createRapierCannonShim } from '../src/physics/rapierShim.js';

class ColliderDesc {
    static ball(radius) { return new ColliderDesc('ball', radius); }
    static cylinder(halfHeight, radius) { return new ColliderDesc('cylinder', { halfHeight, radius }); }
    static cuboid(x, y, z) { return new ColliderDesc('box', { x, y, z }); }
    constructor(kind, size) { this.kind = kind; this.size = size; }
    setFriction(value) { this.friction = value; return this; }
    setRestitution(value) { this.restitution = value; return this; }
    setMass(value) { this.mass = value; return this; }
    setTranslation(x, y, z) { this.translation = { x, y, z }; return this; }
    setActiveEvents(value) { this.events = value; return this; }
}

class RigidBodyDesc {
    static dynamic() { return new RigidBodyDesc('dynamic'); }
    static fixed() { return new RigidBodyDesc('fixed'); }
    constructor(type) { this.type = type; }
    setTranslation(x, y, z) { this.translation = { x, y, z }; return this; }
    setCanSleep(value) { this.canSleep = value; return this; }
    setLinearDamping(value) { this.linearDamping = value; return this; }
    setAngularDamping(value) { this.angularDamping = value; return this; }
    setCcdEnabled(value) { this.ccdEnabled = value; return this; }
}

class RawWorld {
    constructor() { this.numSolverIterations = 4; this.colliders = []; this.bodies = []; }
    createRigidBody(desc) {
        this.bodyDesc = desc;
        this.body = {
            slept: false,
            sleep() { this.slept = true; },
            isDynamic() { return true; },
            resetForces() {},
            applyImpulseAtPoint(impulse, point, wakeUp) { this.lastImpulse = { impulse, point, wakeUp }; }
        };
        this.bodies.push(this.body);
        return this.body;
    }
    createCollider(desc) {
        this.colliders.push(desc);
        return { handle: this.colliders.length };
    }
    forEachRigidBody(callback) { this.bodies.forEach(callback); }
    step() {}
}

const fakeRapier = {
    World: RawWorld,
    RigidBodyDesc,
    ColliderDesc,
    EventQueue: class {
        events = [];
        drainCollisionEvents(callback) { this.events.forEach(event => callback(...event)); }
    },
    ActiveEvents: { COLLISION_EVENTS: 1 }
};

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
