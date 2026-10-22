export function createRapierCannonShim(RAPIER) {
    let nextBodyId = 1;
    class Vec3 {
        constructor(x = 0, y = 0, z = 0, owner = null, kind = 'position') {
            this._x = x;
            this._y = y;
            this._z = z;
            this.owner = owner;
            this.kind = kind;
        }
        get x() { return this._read().x; }
        get y() { return this._read().y; }
        get z() { return this._read().z; }
        set x(value) { const v = this._read(); this.set(value, v.y, v.z); }
        set y(value) { const v = this._read(); this.set(v.x, value, v.z); }
        set z(value) { const v = this._read(); this.set(v.x, v.y, value); }
        _read() {
            if (!this.owner?.raw) return { x: this._x, y: this._y, z: this._z };
            if (this.kind === 'velocity') return this.owner.raw.linvel();
            if (this.kind === 'angularVelocity') return this.owner.raw.angvel();
            return this.owner.raw.translation();
        }
        set(x, y, z) {
            this._x = x;
            this._y = y;
            this._z = z;
            if (!this.owner?.raw) return this;
            const v = { x, y, z };
            if (this.kind === 'velocity') this.owner.raw.setLinvel(v, true);
            else if (this.kind === 'angularVelocity') this.owner.raw.setAngvel(v, true);
            else this.owner.raw.setTranslation(v, true);
            return this;
        }
        copy(source) {
            const value = source instanceof Vec3 ? source._read() : source;
            return this.set(value.x, value.y, value.z);
        }
        // Three.Vector3.copy reads x/y/z separately, crossing into Rapier three
        // times. Read one current native value and copy into a reusable target.
        copyTo(target) {
            const value = this._read();
            return target.set(value.x, value.y, value.z);
        }
        clone() { const v = this._read(); return new Vec3(v.x, v.y, v.z); }
        length() { const v = this._read(); return Math.hypot(v.x, v.y, v.z); }
        distanceTo(other) {
            const a = this._read();
            const b = other instanceof Vec3 ? other._read() : other;
            return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        }
        vsub(other, target = new Vec3()) {
            const a = this._read();
            const b = other instanceof Vec3 ? other._read() : other;
            target.set(a.x - b.x, a.y - b.y, a.z - b.z);
            return target;
        }
        normalize() {
            const value = this._read();
            const len = Math.hypot(value.x, value.y, value.z) || 1;
            return this.set(value.x / len, value.y / len, value.z / len);
        }
        scale(factor, target = new Vec3()) {
            const value = this._read();
            target.set(value.x * factor, value.y * factor, value.z * factor);
            return target;
        }
    }

    class Quaternion {
        constructor(x = 0, y = 0, z = 0, w = 1, owner = null) {
            this._x = x; this._y = y; this._z = z; this._w = w; this.owner = owner;
        }
        get x() { return this.owner?.raw ? this.owner.raw.rotation().x : this._x; }
        get y() { return this.owner?.raw ? this.owner.raw.rotation().y : this._y; }
        get z() { return this.owner?.raw ? this.owner.raw.rotation().z : this._z; }
        get w() { return this.owner?.raw ? this.owner.raw.rotation().w : this._w; }
        copyTo(target) {
            const value = this.owner?.raw ? this.owner.raw.rotation() : {
                x: this._x, y: this._y, z: this._z, w: this._w
            };
            return target.set(value.x, value.y, value.z, value.w);
        }
        setFromAxisAngle(axis, angle) {
            const half = angle / 2;
            const s = Math.sin(half);
            this._x = axis.x * s;
            this._y = axis.y * s;
            this._z = axis.z * s;
            this._w = Math.cos(half);
            return this;
        }
    }

    class Material {
        constructor(options = {}) { this.name = options.name || 'material'; }
    }
    class ContactMaterial { constructor() {} }
    class Sphere { constructor(radius) { this.type = 'sphere'; this.radius = radius; } }
    class Box {
        constructor(halfExtents) {
            this.type = 'box';
            this.halfExtents = halfExtents;
        }
    }
    class Cylinder {
        constructor(radiusTop, radiusBottom, height) {
            this.type = 'cylinder';
            // Rapier's cylinder has one radius; the mean follows a tapered pin
            // more closely than the widest end of every overlapping segment.
            this.radius = (radiusTop + radiusBottom) / 2;
            this.height = height;
        }
    }

    class Body {
        constructor(options = {}) {
            this.id = nextBodyId++;
            this.mass = options.mass || 0;
            this.material = options.material || null;
            this.shapes = [];
            this.shapeOffsets = [];
            this.shapeMassWeights = options.shapeMassWeights || null;
            this.ccdEnabled = options.ccdEnabled ?? (options.material?.name === 'ball');
            this.sleepRequested = false;
            this.listeners = {};
            this.raw = null;
            this.world = null;
            this.position = new Vec3(0, 0, 0, this, 'position');
            this.velocity = new Vec3(0, 0, 0, this, 'velocity');
            this.angularVelocity = new Vec3(0, 0, 0, this, 'angularVelocity');
            this.quaternion = new Quaternion(0, 0, 0, 1, this);
            this.linearDamping = 0;
            this.angularDamping = 0;
            if (options.shape) this.addShape(options.shape);
        }
        addShape(shape, offset = new Vec3(0, 0, 0)) {
            this.shapes.push(shape);
            this.shapeOffsets.push(offset);
        }
        addEventListener(type, handler) {
            if (!this.listeners[type]) this.listeners[type] = [];
            this.listeners[type].push(handler);
        }
        _emit(type, event) {
            (this.listeners[type] || []).forEach(handler => handler(event));
        }
        wakeUp() { this.sleepRequested = false; this.raw?.wakeUp(); }
        sleep() { this.sleepRequested = true; this.raw?.sleep(); }
        applyImpulse(impulse) { this.raw?.applyImpulse({ x: impulse.x, y: impulse.y, z: impulse.z }, true); }
        applyImpulseAtPoint(impulse, point) {
            this.raw?.applyImpulseAtPoint(
                { x: impulse.x, y: impulse.y, z: impulse.z },
                { x: point.x, y: point.y, z: point.z },
                true
            );
        }
        applyForce(force) {
            if (!this.raw) return;
            this.raw.addForce({ x: force.x, y: force.y, z: force.z }, true);
            this.world.forcedBodies.add(this);
        }
    }

    function colliderDescForShape(shape) {
        if (shape.type === 'sphere') return RAPIER.ColliderDesc.ball(shape.radius);
        if (shape.type === 'box') return RAPIER.ColliderDesc.cuboid(shape.halfExtents.x, shape.halfExtents.y, shape.halfExtents.z);
        if (shape.type === 'cylinder') return RAPIER.ColliderDesc.cylinder(shape.height / 2, shape.radius);
        throw new Error(`Unsupported Rapier shim shape: ${shape.type}`);
    }

    function applyMaterial(desc, material) {
        const name = material?.name || '';
        const presets = {
            lane: { friction: 0.22, restitution: 0.02 },
            pin: { friction: 0.3, restitution: 0.25 },
            bouncyPin: { friction: 0.14, restitution: 0.65 },
            ball: { friction: 0.04, restitution: 0.28 },
            guard: { friction: 0.02, restitution: 0.35 },
            gutter: { friction: 0.18, restitution: 0.03 }
        };
        const preset = presets[name] || { friction: 0.2, restitution: 0.1 };
        return desc.setFriction(preset.friction).setRestitution(preset.restitution);
    }

    class World {
        constructor(gravity = { x: 0, y: -9.81, z: 0 }) {
            this.raw = new RAPIER.World(gravity);
            this.eventQueue = new RAPIER.EventQueue(true);
            this.bodiesByCollider = new Map();
            this.forcedBodies = new Set();
            this.gravity = new Vec3(gravity.x, gravity.y, gravity.z);
            const originalSet = this.gravity.set.bind(this.gravity);
            this.gravity.set = (x, y, z) => {
                originalSet(x, y, z);
                this.raw.gravity = { x, y, z };
            };
            this.solver = { tolerance: 0.001 };
            Object.defineProperty(this.solver, 'iterations', {
                get: () => this.raw.numSolverIterations,
                set: (value) => { this.raw.numSolverIterations = Math.max(1, Math.floor(value)); }
            });
            this.raw.numInternalPgsIterations = 2;
            this.raw.maxCcdSubsteps = 2;
        }
        addBody(body) {
            const pos = body.position._read();
            const desc = body.mass > 0
                ? RAPIER.RigidBodyDesc.dynamic().setTranslation(pos.x, pos.y, pos.z).setCanSleep(true)
                : RAPIER.RigidBodyDesc.fixed().setTranslation(pos.x, pos.y, pos.z);
            if (body.mass > 0) {
                desc.setLinearDamping(body.linearDamping || 0);
                desc.setAngularDamping(body.angularDamping || 0);
                if (body.ccdEnabled) desc.setCcdEnabled(true);
            }
            body.colliderHandles = [];
            body.raw = this.raw.createRigidBody(desc);
            body.world = this;
            const weights = body.shapeMassWeights?.length === body.shapes.length
                ? body.shapeMassWeights
                : body.shapes.map(() => 1);
            const totalWeight = weights.reduce((sum, weight) => sum + Math.max(0, weight), 0) || 1;
            body.shapes.forEach((shape, index) => {
                let colliderDesc = applyMaterial(colliderDescForShape(shape), body.material);
                if (body.mass > 0) colliderDesc = colliderDesc.setMass(body.mass * Math.max(0, weights[index]) / totalWeight);
                const offset = body.shapeOffsets[index];
                if (offset) colliderDesc = colliderDesc.setTranslation(offset.x, offset.y, offset.z);
                colliderDesc = colliderDesc.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
                const collider = this.raw.createCollider(colliderDesc, body.raw);
                this.bodiesByCollider.set(collider.handle, body);
                body.colliderHandles.push(collider.handle);
            });
            if (body.sleepRequested) body.raw.sleep();
        }
        remove(body) {
            if (!body?.raw || body.world !== this) return;
            this.forcedBodies.delete(body);
            this.raw.removeRigidBody(body.raw);
            // Each pin owns six collider handles. Removing only those handles
            // keeps full-rack teardown linear instead of scanning the world per pin.
            for (const handle of body.colliderHandles) this.bodiesByCollider.delete(handle);
            body.colliderHandles.length = 0;
            body.raw = null;
            body.world = null;
        }
        addContactMaterial() {}
        step(timeStep) {
            this.raw.timestep = timeStep;
            this.raw.step(this.eventQueue);
            // Cannon forces last one step; Rapier forces persist until cleared.
            // Without this, hook/steering forces accumulate throughout a throw.
            // Only Body.applyForce creates persistent forces through this API.
            // Pin impulses do not. Clear each touched body once, after its step;
            // collision callbacks below may enqueue forces for the next step.
            for (const body of this.forcedBodies) {
                if (body.raw?.isDynamic()) body.raw.resetForces(false);
            }
            this.forcedBodies.clear();
            const reportedPairs = new Set();
            this.eventQueue.drainCollisionEvents((h1, h2, started) => {
                if (!started) return;
                const bodyA = this.bodiesByCollider.get(h1);
                const bodyB = this.bodiesByCollider.get(h2);
                if (!bodyA || !bodyB || bodyA === bodyB) return;
                const pair = bodyA.id < bodyB.id ? `${bodyA.id}:${bodyB.id}` : `${bodyB.id}:${bodyA.id}`;
                if (reportedPairs.has(pair)) return;
                reportedPairs.add(pair);
                bodyA._emit('collide', { body: bodyB });
                bodyB._emit('collide', { body: bodyA });
            });
        }
    }

    return { World, Body, Material, ContactMaterial, Vec3, Quaternion, Sphere, Box, Cylinder, NaiveBroadphase: class {} };
}

let physicsReady = null;

export async function initPhysics() {
    if (!physicsReady) {
        physicsReady = import('https://cdn.skypack.dev/@dimforge/rapier3d-compat').then(async ({ default: RAPIER }) => {
            await RAPIER.init();
            return { RAPIER, CANNON: createRapierCannonShim(RAPIER) };
        });
    }
    return physicsReady;
}
