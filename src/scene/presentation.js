// Presentation for a single, continuously widening lane. Dimensions are in world
// units: boards, trim, and light fixtures retain their scale as the rack grows.
const T = window.THREE;

function canvasTexture(width, height, draw, color = true) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    draw(canvas.getContext('2d'), width, height);
    const texture = new T.CanvasTexture(canvas);
    if (color) texture.encoding = T.sRGBEncoding;
    texture.anisotropy = 8;
    return texture;
}

function woodTexture(roughness = false) {
    return canvasTexture(512, 1024, (ctx, w, h) => {
        let seed = 41;
        const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
        for (let board = 0; board < 8; board++) {
            const tone = random();
            ctx.fillStyle = roughness ? `rgb(${150 + tone * 28},${150 + tone * 28},${150 + tone * 28})` : `hsl(${34 + tone * 5}, ${48 + tone * 10}%, ${43 + tone * 12}%)`;
            ctx.fillRect(board * 64, 0, 64, h);
            for (let i = 0; i < 90; i++) {
                const x = board * 64 + random() * 64;
                ctx.strokeStyle = roughness ? 'rgba(60,60,60,.08)' : `rgba(93,52,16,${0.025 + random() * 0.07})`;
                ctx.lineWidth = random() * 1.2 + 0.3;
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.bezierCurveTo(x + random() * 8, h * 0.3, x - random() * 9, h * 0.7, x, h);
                ctx.stroke();
            }
            ctx.fillStyle = roughness ? '#bababa' : 'rgba(64,34,12,.32)';
            ctx.fillRect(board * 64, 0, 1, h);
            const seam = Math.floor(random() * h);
            ctx.fillRect(board * 64, seam, 64, 1.2);
        }
    }, !roughness);
}

function disposeGroup(group) {
    const geometry = new Set(), materials = new Set(), textures = new Set();
    group.traverse(object => {
        if (object.geometry) geometry.add(object.geometry);
        for (const material of [object.material].flat().filter(Boolean)) {
            materials.add(material);
            for (const key of ['map', 'roughnessMap']) if (material[key]?.userData?.ownedByLane) textures.add(material[key]);
        }
        object.shadow?.map?.dispose();
    });
    geometry.forEach(value => value.dispose());
    materials.forEach(value => value.dispose());
    textures.forEach(value => value.dispose());
    group.clear();
}

export function createLanePresentation(scene, renderer) {
    const root = new T.Group();
    root.name = 'Pinfall arena';
    scene.add(root);
    const wood = woodTexture();
    const rough = woodTexture(true);
    const effects = [];
    let surfaceY = 0;
    let laneWidth = 5;
    let laneCenter = 0;

    // A prefiltered indoor environment gives lacquer and resin broad highlights.
    const studio = new T.Scene();
    studio.add(new T.Mesh(new T.BoxGeometry(60, 30, 80), new T.MeshBasicMaterial({ color: 0x080b14, side: T.BackSide })));
    for (const [x, y, z, w, d, color] of [[-8, 10, 0, 4, 40, 0xffb760], [8, 8, 0, 3, 36, 0x32bbb4], [0, 12, -20, 18, 6, 0xe48f6b]]) {
        const light = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ color, side: T.DoubleSide }));
        light.material.color.convertSRGBToLinear().multiplyScalar(1.4);
        light.rotation.x = Math.PI / 2;
        light.position.set(x, y, z);
        studio.add(light);
    }
    const pmrem = new T.PMREMGenerator(renderer);
    const environmentTarget = pmrem.fromScene(studio, 0.03);
    const environment = environmentTarget.texture;
    pmrem.dispose();
    disposeGroup(studio);
    scene.environment = environment;

    const aim = new T.Group();
    aim.name = 'Initial release line';
    scene.add(aim);
    const aimMaterial = new T.MeshBasicMaterial({ color: 0xa9f8ea, transparent: true, opacity: 0.7, depthWrite: false });
    for (let i = 0; i < 18; i++) {
        const dash = new T.Mesh(new T.PlaneGeometry(0.035, 0.32), aimMaterial);
        dash.rotation.x = -Math.PI / 2;
        dash.position.z = -1.15 - i * 0.55;
        aim.add(dash);
    }
    const aimTip = new T.Mesh(new T.RingGeometry(0.12, 0.15, 32), aimMaterial);
    aimTip.rotation.x = -Math.PI / 2;
    aimTip.position.z = -11.1;
    aim.add(aimTip);
    aim.visible = false;

    const contactTexture = canvasTexture(64, 64, (ctx, w, h) => {
        const gradient = ctx.createRadialGradient(w/2, h/2, 1, w/2, h/2, w/2);
        gradient.addColorStop(0, 'rgba(0,0,0,.8)');
        gradient.addColorStop(.35, 'rgba(0,0,0,.45)');
        gradient.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, w, h);
    });
    const contact = new T.Mesh(new T.PlaneGeometry(1.45, 1.45), new T.MeshBasicMaterial({ map: contactTexture, transparent: true, depthWrite: false, toneMapped: false }));
    contact.rotation.x = -Math.PI / 2;
    contact.renderOrder = 2;
    contact.userData.excludeFromPlanarReflection = true;
    contact.visible = false;
    scene.add(contact);

    const burstGeometry = new T.RingGeometry(0.8, 1, 48);
    const burstLight = new T.PointLight(0xffa354, 0, 12, 2);
    scene.add(burstLight);

    function rebuild({ width, length, origin, pins, frame, approachLength = 12, cameraBack = 9 }) {
        disposeGroup(root);
        laneWidth = width;
        laneCenter = origin.x;
        surfaceY = origin.y + 0.004;
        const start = origin.z + length / 2;
        const end = origin.z - length / 2;
        const roomWidth = width + 12;
        const approachWidth = width + 2.8;
        const floorFront = Math.max(start + approachLength + 12, start + 3 + cameraBack + 12);
        const floorRear = end - 8;
        const roomFront = floorFront + 2;
        const roomRear = end - 12;
        const roomLength = roomFront - roomRear;
        const roomCenter = (roomFront + roomRear) / 2;
        const standard = (color, roughness = 0.55, metalness = 0) => {
            const material = new T.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: 0.35 });
            material.color.convertSRGBToLinear();
            return material;
        };
        const dark = standard(0x101e2b, 0.68, 0.08);
        const brass = standard(0xc79b58, 0.28, 0.65);
        const teal = new T.MeshBasicMaterial({ color: new T.Color(0x35d0bd).convertSRGBToLinear() });
        const warm = new T.MeshBasicMaterial({ color: new T.Color(0xf4a45d).convertSRGBToLinear() });
        const box = (w, h, d, x, y, z, material) => {
            const mesh = new T.Mesh(new T.BoxGeometry(w, h, d), material);
            mesh.position.set(x + origin.x, y + origin.y, z);
            mesh.receiveShadow = true;
            root.add(mesh);
            return mesh;
        };
        const repeat = (source, sectionWidth = width, sectionLength = length) => {
            const texture = source.clone();
            texture.wrapS = texture.wrapT = T.RepeatWrapping;
            texture.repeat.set(sectionWidth / 2.8, sectionLength / 8);
            texture.needsUpdate = true;
            texture.userData = { ownedByLane: true };
            return texture;
        };
        const maple = new T.MeshPhysicalMaterial({ color: 0xffeed7, map: repeat(wood), roughnessMap: repeat(rough), roughness: 0.72, metalness: 0, clearcoat: 0.12, clearcoatRoughness: 0.42, envMapIntensity: 0.24 });
        maple.color.convertSRGBToLinear();
        const surface = new T.Mesh(new T.PlaneGeometry(width, length), maple);
        surface.name = 'Maple lane / constant board scale';
        surface.rotation.x = -Math.PI / 2;
        surface.position.set(origin.x, surfaceY, origin.z);
        surface.receiveShadow = true;
        root.add(surface);
        box(width, 0.3, length, 0, -0.16, origin.z, dark);
        box(roomWidth, 0.25, floorFront - floorRear, 0, -0.65, (floorFront + floorRear) / 2, standard(0x0c1723, 0.86));

        // The approach is real wood and supported by the lane collider. The
        // carpet beyond it keeps the foreground inside the bowling venue.
        const approachMaple = new T.MeshPhysicalMaterial({
            color: 0xe8bb87, map: repeat(wood, approachWidth, approachLength),
            roughnessMap: repeat(rough, approachWidth, approachLength),
            roughness: 0.8, clearcoat: 0.08, clearcoatRoughness: 0.55, envMapIntensity: 0.18
        });
        approachMaple.color.convertSRGBToLinear();
        const approach = new T.Mesh(new T.PlaneGeometry(approachWidth, approachLength), approachMaple);
        approach.name = 'Wood approach behind foul line';
        approach.rotation.x = -Math.PI / 2;
        approach.position.set(origin.x, surfaceY + 0.003, start + approachLength / 2);
        approach.receiveShadow = true;
        root.add(approach);
        box(approachWidth, 0.3, approachLength, 0, -0.16, start + approachLength / 2, dark);
        const carpetLength = floorFront - (start + approachLength);
        box(roomWidth, 0.04, carpetLength, 0, -0.5, start + approachLength + carpetLength / 2, standard(0x271a2c, 0.94));
        for (const side of [-1, 1]) {
            box(0.045, 0.025, carpetLength, side * (approachWidth / 2 + 0.35), -0.46, start + approachLength + carpetLength / 2, brass);
        }

        const foulInk = new T.MeshBasicMaterial({ color: new T.Color(0x2b1e20).convertSRGBToLinear() });
        box(approachWidth, 0.006, 0.085, 0, 0.011, start, foulInk);

        for (const side of [-1, 1]) {
            box(0.16, 0.12, length, side * (width / 2 + 0.95), 0, origin.z, brass);
            box(0.035, 0.025, length, side * (width / 2 + 1.06), 0.065, origin.z, teal);
            box(1.5, 0.14, length, side * (width / 2 + 1.85), -0.18, origin.z, dark);
            box(0.3, 12, roomLength, side * roomWidth / 2, 5.4, roomCenter, dark);
            box(0.04, 0.055, roomLength, side * (roomWidth / 2 - 0.17), 1.25, roomCenter, teal);
            for (let i = 0; i < 7; i++) {
                const z = start - i * length / 6;
                box(0.35, 6.6, 0.28, side * (roomWidth / 2 - 0.2), 3.3, z, standard(0x263643));
                box(0.05, 3.9, 0.08, side * (roomWidth / 2 - 0.4), 3.9, z, warm);
            }
        }
        // Low spectator seating and inset wall graphics give the lane a place.
        const leather = standard(0x5e2638, .74);
        const upholsterySeam = standard(0x241622, .9);
        const poster = canvasTexture(512, 768, (ctx, w, h) => {
            ctx.fillStyle = '#16121f'; ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#803d43';
            for (let i = -6; i < 12; i++) {
                ctx.beginPath(); ctx.moveTo(i * 90, h); ctx.lineTo(i * 90 + 48, h);
                ctx.lineTo(i * 90 + 480, 0); ctx.lineTo(i * 90 + 432, 0); ctx.fill();
            }
            ctx.fillStyle = '#16121f'; ctx.fillRect(22, 190, w - 44, 370);
            ctx.fillStyle = '#e9c185'; ctx.textAlign = 'center';
            ctx.font = '900 106px sans-serif'; ctx.fillText('BOWL', w / 2, 325); ctx.fillText('BOLD.', w / 2, 445);
            ctx.font = '24px sans-serif'; ctx.fillText('P I N F A L L   S O C I A L', w / 2, 515);
            ctx.strokeStyle = '#c29962'; ctx.lineWidth = 8; ctx.strokeRect(8, 8, w - 16, h - 16);
        });
        poster.userData = { ownedByLane: true };
        const posterMaterial = new T.MeshBasicMaterial({ map: poster });
        for (const side of [-1, 1]) {
            for (const z of [start + 7, start - 12, start - 26]) {
                const x = side * (width / 2 + 4.5);
                box(1.15, .35, 4.8, x, -.02, z, leather);
                box(.24, 1.15, 4.8, x + side * .5, .32, z, leather);
                for (const dz of [-2, -1, 0, 1, 2]) {
                    box(1.1, .012, .025, x, .162, z + dz, upholsterySeam);
                }
                for (const dz of [-1.9, 1.9]) box(.9, .28, .12, x, -.33, z + dz, brass);
            }
            const graphic = new T.Mesh(new T.PlaneGeometry(2.1, 3.15), posterMaterial);
            graphic.position.set(origin.x + side * (roomWidth / 2 - .18), origin.y + 3.35, start - 18);
            graphic.rotation.y = -side * Math.PI / 2;
            root.add(graphic);
            box(.12, .06, roomLength, side * (roomWidth / 2 - .22), .35, roomCenter, brass);
        }
        // A single open pin deck and a width-aware architectural backdrop.
        box(roomWidth, 12.5, 0.5, 0, 5.5, end - 2.7, dark);
        box(width + 2.2, 1.05, 0.22, 0, 0.2, end - 1.5, standard(0x080e15));
        box(width + 2.8, 0.055, 0.08, 0, 1.4, end - 1.3, teal);
        const slatMaterial = standard(0x6c4f32, 0.65);
        const slats = Math.ceil(roomWidth / 0.36);
        const slatMesh = new T.InstancedMesh(new T.BoxGeometry(0.15, 3.3, 0.18), slatMaterial, slats);
        const matrix = new T.Matrix4();
        for (let i = 0; i < slats; i++) {
            matrix.makeTranslation(origin.x - roomWidth / 2 + (i + 0.5) * roomWidth / slats, origin.y + 4.3, end - 2.34);
            slatMesh.setMatrixAt(i, matrix);
        }
        root.add(slatMesh);
        const sign = canvasTexture(1536, 384, (ctx, w, h) => {
            ctx.fillStyle = '#101d28'; ctx.fillRect(0, 0, w, h);
            ctx.strokeStyle = '#ad8c53'; ctx.lineWidth = 3; ctx.strokeRect(14, 14, w - 28, h - 28);
            ctx.textAlign = 'center';
            ctx.fillStyle = '#79e7d8'; ctx.font = '500 25px sans-serif';
            ctx.fillText('THE  E X P A N D I N G  ALLEY', w / 2, 73);
            ctx.fillStyle = '#fff0d6'; ctx.font = '900 156px sans-serif';
            ctx.fillText('P I N F A L L', w / 2, 236);
            ctx.fillStyle = '#acbcc3'; ctx.font = '500 28px sans-serif';
            ctx.fillText(`${String(pins).padStart(3, '0')} PINS     /     FRAME ${String(frame).padStart(2, '0')}     /     MAKE SOME NOISE`, w / 2, 316);
        });
        sign.userData = { ownedByLane: true };
        const plaque = new T.Mesh(new T.PlaneGeometry(Math.min(roomWidth - 2, 15), 3.75), new T.MeshBasicMaterial({ map: sign }));
        plaque.position.set(origin.x, origin.y + 4.5, end - 2.1);
        root.add(plaque);

        // Large, warm overhead fixtures make glossy shapes readable without bloom haze.
        for (let i = 0; i < 5; i++) {
            const z = start - 2 - i * (length - 4) / 4;
            box(width + 4.5, 0.2, 0.5, 0, 11.8, z, dark);
            box(width + 2, 0.025, 0.15, 0, 11.68, z, warm);
        }
        for (const z of [start + 3, start + approachLength - 1]) {
            box(approachWidth + 2, 0.2, 0.5, 0, 11.8, z, dark);
            box(approachWidth, 0.025, 0.15, 0, 11.68, z, warm);
        }
        const markings = new T.MeshBasicMaterial({ color: 0x493d30, transparent: true, opacity: 0.72, depthWrite: false });
        box(width, 0.01, 0.085, 0, 0.014, start - 1.6, markings);
        const markerCount = Math.max(7, Math.floor(width / 0.72) | 1);
        for (let i = 0; i < markerCount; i++) {
            const x = (i - (markerCount - 1) / 2) * (width * 0.75 / (markerCount - 1));
            const shape = new T.Shape();
            shape.moveTo(-0.09, -0.13); shape.lineTo(0, 0.14); shape.lineTo(0.09, -0.13); shape.closePath();
            const arrow = new T.Mesh(new T.ShapeGeometry(shape), markings);
            arrow.rotation.x = -Math.PI / 2;
            arrow.position.set(origin.x + x, surfaceY + 0.013, start - 8 - Math.abs(x) * 0.12);
            root.add(arrow);
            const dot = new T.Mesh(new T.CircleGeometry(0.045, 12), markings);
            dot.rotation.x = -Math.PI / 2;
            dot.position.set(origin.x + x, surfaceY + 0.013, start - 3.5);
            root.add(dot);
        }
        for (const [z, color, strength] of [[start + 5, 0xffb76d, 1.1], [start - 5, 0xffb76d, 1.4], [origin.z, 0x3bccc1, 1.0], [end + 6, 0xffc289, 1.65]]) {
            const pool = new T.PointLight(color, strength, 24, 2);
            pool.color.convertSRGBToLinear();
            pool.position.set(origin.x, origin.y + 5.5, z);
            root.add(pool);
        }
        const hemisphere = new T.HemisphereLight(0x8199bb, 0x39291d, 0.24);
        root.add(hemisphere);
        const key = new T.DirectionalLight(0xffc990, 0.72);
        key.color.convertSRGBToLinear();
        key.position.set(origin.x - 5, origin.y + 12, start - 12);
        key.target.position.set(origin.x, origin.y, end + 10);
        key.castShadow = true;
        key.shadow.mapSize.set(2048, 2048);
        Object.assign(key.shadow.camera, { left: -width / 2 - 4, right: width / 2 + 4, top: 24, bottom: -24, near: 0.5, far: 70 });
        key.shadow.bias = -0.0002;
        key.shadow.normalBias = 0.02;
        key.shadow.radius = 2;
        root.add(key, key.target);
        const fill = new T.DirectionalLight(0x51c4d1, 0.24);
        fill.color.convertSRGBToLinear();
        fill.position.set(origin.x + 7, origin.y + 8, end);
        fill.target.position.set(origin.x, origin.y, origin.z);
        root.add(fill, fill.target);
    }

    function impact(position, color = 0xffba68) {
        // Bound effects so a 120-pin chain cannot accumulate unbounded draw calls.
        if (effects.length >= 12) return;
        const material = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false, side: T.DoubleSide, blending: T.AdditiveBlending });
        const ring = new T.Mesh(burstGeometry, material);
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(position.x, surfaceY + 0.025, position.z);
        ring.scale.setScalar(0.15);
        scene.add(ring);
        effects.push({ mesh: ring, age: 0 });
        burstLight.position.set(position.x, position.y + 1.2, position.z);
        burstLight.color.setHex(color);
        burstLight.intensity = 2.4;
    }

    const pinTexture = canvasTexture(32, 256, (ctx, w, h) => {
        ctx.fillStyle = '#fffdf5'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#d63c37'; ctx.fillRect(0, 58, w, 10); ctx.fillRect(0, 76, w, 10);
    });
    const specialTexture = canvasTexture(32, 256, (ctx, w, h) => {
        ctx.fillStyle = '#fffdf5'; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#162936'; ctx.fillRect(0, 58, w, 10); ctx.fillRect(0, 76, w, 10);
    });
    const ballTexture = canvasTexture(512, 256, (ctx, w, h) => {
        const pixels = ctx.createImageData(w, h);
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
            const u = x / w * Math.PI * 2, v = y / h * Math.PI;
            const t = Math.sin(u * 5 + Math.sin(v * 8 + Math.cos(u * 3)) * 2.5);
            const vein = Math.pow((t + 1) / 2, 5);
            const i = (y * w + x) * 4;
            pixels.data[i] = 16 + vein * 44; pixels.data[i + 1] = 49 + vein * 145; pixels.data[i + 2] = 100 + vein * 104; pixels.data[i + 3] = 255;
        }
        ctx.putImageData(pixels, 0, 0);
    });

    return {
        environment, rebuild, impact,
        setVisible(value) { root.visible = value; },
        setBall(position, radius = .49) {
            contact.visible = Boolean(position) && Math.abs(position.x - laneCenter) < laneWidth / 2;
            if (!contact.visible) return;
            const height = Math.max(0, position.y - radius - surfaceY);
            contact.position.set(position.x, surfaceY + .018, position.z);
            contact.scale.setScalar(radius / .49);
            contact.material.opacity = Math.max(0, 1 - height * 2);
        },
        setAim({ visible, position, angle }) {
            aim.visible = visible;
            if (!visible || !position) return;
            aim.position.set(position.x, surfaceY + 0.035, position.z);
            aim.rotation.y = -angle;
            // Clip individual dashes at the actual playable edge.
            aim.children.forEach(dash => { dash.visible = Math.abs(position.x + Math.sin(angle) * -dash.position.z - laneCenter) < laneWidth / 2 - 0.08; });
        },
        update(dt) {
            burstLight.intensity *= Math.exp(-12 * dt);
            for (let i = effects.length - 1; i >= 0; i--) {
                const effect = effects[i];
                effect.age += dt;
                effect.mesh.scale.setScalar(0.15 + effect.age * 5);
                effect.mesh.material.opacity = Math.max(0, 1 - effect.age / 0.55) * 0.65;
                if (effect.age >= 0.55) {
                    scene.remove(effect.mesh); effect.mesh.material.dispose(); effects.splice(i, 1);
                }
            }
        },
        createPin(type, radius, height, standard) {
            const profile = [[0, 0], [.6, 0], [.7, .05], [.91, .18], [1, .3], [.92, .42], [.64, .55], [.4, .66], [.39, .76], [.53, .84], [.55, .9], [.4, .97], [0, 1]];
            const points = profile.map(([x, y]) => new T.Vector2(x * radius, (y - 0.5) * height));
            const geometry = new T.LatheGeometry(points, 24);
            const uv = geometry.attributes.uv, pos = geometry.attributes.position;
            for (let i = 0; i < uv.count; i++) uv.setY(i, pos.getY(i) / height + 0.5);
            const material = new T.MeshPhysicalMaterial({ map: standard ? pinTexture : specialTexture, color: standard ? 0xffffff : type.color, roughness: 0.24, metalness: type.name === 'Gold' ? 0.5 : 0, clearcoat: 0.65, clearcoatRoughness: 0.2, envMapIntensity: 0.7 });
            material.color.convertSRGBToLinear();
            const mesh = new T.Mesh(geometry, material);
            mesh.castShadow = mesh.receiveShadow = true;
            return mesh;
        },
        createBall(radius) {
            const group = new T.Group();
            const mesh = new T.Mesh(new T.SphereGeometry(radius, 48, 32), new T.MeshPhysicalMaterial({ map: ballTexture, roughness: 0.17, metalness: 0.08, clearcoat: 1, clearcoatRoughness: 0.22, envMapIntensity: 1.05 }));
            mesh.castShadow = true;
            group.add(mesh);
            const holes = new T.MeshBasicMaterial({ color: 0x030b13 });
            for (const [x, z, size] of [[-.14, .2, .065], [.14, .2, .065], [0, -.12, .08]]) {
                const normal = new T.Vector3(x, Math.sqrt(1 - x * x - z * z), z).normalize();
                const hole = new T.Mesh(new T.CircleGeometry(radius * size * 1.6, 20), holes);
                hole.position.copy(normal).multiplyScalar(radius * 1.003);
                hole.quaternion.setFromUnitVectors(new T.Vector3(0, 0, 1), normal);
                group.add(hole);
            }
            return group;
        }
    };
}
