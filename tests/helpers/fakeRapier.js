// Instrumented storage/API fixture. This does not implement the Rapier solver.
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
    constructor() { this.numSolverIterations = 4; this.colliders = []; this.bodies = []; this.operations = { resetForces:0, bodyVisits:0, translations:0, rotations:0, velocities:0 }; this.stepForces = []; }
    createRigidBody(desc) {
        this.bodyDesc = desc;
        const operations = this.operations;
        this.body = {
            slept: false,
            force: {x:0,y:0,z:0},
            pos: {...desc.translation},
            rot: {x:0,y:0,z:0,w:1},
            velocity: {x:1,y:2,z:3},
            translation() {operations.translations++;return {...this.pos};},
            rotation() {operations.rotations++;return {...this.rot};},
            linvel() {operations.velocities++;return {...this.velocity};},
            setLinvel(v) {this.velocity={...v};},
            setTranslation(v) {this.pos={...v};},
            addForce(v) {this.force.x+=v.x;this.force.y+=v.y;this.force.z+=v.z;},
            sleep() { this.slept = true; },
            isDynamic() { return desc.type === 'dynamic'; },
            resetForces(wake) { operations.resetForces++;this.lastResetWake=wake;this.force={x:0,y:0,z:0}; },
            applyImpulseAtPoint(impulse, point, wakeUp) { this.lastImpulse = { impulse, point, wakeUp }; }
        };
        this.bodies.push(this.body);
        return this.body;
    }
    createCollider(desc) {
        this.colliders.push(desc);
        return { handle: this.colliders.length };
    }
    removeRigidBody(body) { this.bodies = this.bodies.filter(value => value !== body); }
    forEachRigidBody(callback) { this.bodies.forEach(body=>{this.operations.bodyVisits++;callback(body);}); }
    step() { this.stepForces = this.bodies.map(body=>({...body.force})); }
}

export const fakeRapier = {
    World: RawWorld,
    RigidBodyDesc,
    ColliderDesc,
    EventQueue: class {
        events = [];
        drainCollisionEvents(callback) { this.events.forEach(event => callback(...event)); }
    },
    ActiveEvents: { COLLISION_EVENTS: 1 }
};

