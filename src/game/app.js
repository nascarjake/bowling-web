import { buildSummaryMarkup, equipmentScope, quoteBallTrait, ballTraitEligibility, receiverMarkup } from '../ui/buildSummary.js?v=0.4.0';
import { mountStarterEquipment, bindEquipmentNavigation } from '../ui/starterEquipment.js?v=0.4.0';
import { renderReflectionPass, shouldUpdateReflection, syncReflectionClone } from '../scene/reflectionPass.js?v=0.4.0';
import { BALL_TRAITS, STARTER_BALLS, createBallLoadout, migrateBallLoadout, selectedBall, ballBonuses, canSwitchBall, switchBall, laneModifierLabel } from './ballLoadout.js?v=0.4.0';
import { migrateBumperCharges, createBumperContacts, consumeBumperImpact, rearmBumperContacts, gutterMawDelta, isGutterMawRoute } from './laneHazards.js?v=0.4.0';
import { createMawVisuals } from '../scene/gameplayVisuals.js?v=0.4.0';
import { syncTextCells } from '../ui/scoreHud.js?v=0.4.0';
import { setIfChanged, containDialogTab } from '../ui/dom.js?v=0.4.0';
import { updateParticles } from '../scene/particles.js?v=0.4.0';
import { RetroAudio } from '../audio/retroAudio.js?v=0.4.0';
import { GAME } from '../core/state.js?v=0.4.0';
import { SHOP_UPGRADES } from '../content/shopUpgrades.js?v=0.4.0';
import { ROUTE_TYPES, BOSS_VARIANTS } from '../content/routes.js?v=0.4.0';
import { EVENT_TYPES } from '../content/events.js?v=0.4.0';
import { VOCABULARY } from '../content/vocabulary.js?v=0.4.0';
import { TENPIN_SHOP_ITEMS, TENPIN_RACK_SLOTS } from '../content/tenpinShop.js?v=0.4.0';
import { PIN_TYPES } from '../content/pinTypes.js?v=0.4.0';
import { MODEL_ASSETS, CONVERTED_ALLEY_TEXTURES, ALLEY_MATERIAL_PROFILES } from '../scene/assets.js?v=0.4.0';
import { DEBUG_CONFIG_VERSION, DEBUG_STORAGE_KEY, DEFAULT_DEBUG_CONFIG } from '../debug/defaultConfig.js?v=0.4.0';
import { initPhysics } from '../physics/rapierShim.js?v=0.4.0';
import { createLaneDimensions, createLaneLayoutCache, laneCameraDistance, PIN_RACK_MICRO_JITTER, MIN_PLAYABLE_LANE_WIDTH } from './laneLayout.js?v=0.4.0';
import { createLanePresentation } from '../scene/presentation.js?v=0.4.0';
import { DISTRICTS, districtForStage, routeTheme, routeNodePosition as circuitNodePosition, circuitWires, laneArtwork, bossEmblem, districtBackdrop } from '../ui/routeArt.js?v=0.4.0';

import { shopVisual, shopOfferState, shopArtwork, shopPinArt } from '../ui/shopArt.js?v=0.4.0';
import { eventVisual, eventChoiceVisual, eventSceneArt, cabinetArt, RELIC_VISUALS } from '../ui/cabinetArt.js?v=0.4.0';
let eventRewardTimer = null;
let debugEventIndex = 0;

let shopCatalogFilter = 'all';
let shopInspectorReturnFocus = null;
let pendingBallPurchase = null;
let shopFeedbackTimer = null;

let displayedRouteStage = 1;
let routePreviewNodeId = '';
let routeMapResizeObserver = null;

const RUN_SAVE_KEY = 'pinfallRunSlotsV1';
const PROFILE_KEY = 'pinfallProfileV1';
const DAILY_HISTORY_LIMIT = 30;
const MAX_RUN_SLOTS = 3;
const SHOP_OFFER_COUNT = 3;
const RELICS = [
    { id: 'last_frame_token', name: 'Last Frame Token', icon: 'fa-ticket', desc: 'Once per run, if you fail a roguelike target, you get one emergency extra frame roll.' },
    { id: 'house_float', name: 'House Float', icon: 'fa-coins', desc: 'Start each roguelike run with +3 pin dollars.' },
    { id: 'warmup_lane', name: 'Warmup Lane', icon: 'fa-bowling-ball', desc: 'Start each roguelike run with +1 roll on Frame 1.' },
    { id: 'reroll_coupon', name: 'Reroll Coupon', icon: 'fa-rotate', desc: 'Your first shop reroll each run is free.' }
];

const DAILY_POOLS = {
    map: [
        { id: 'route-rush', name: 'Route Rush', type: "Today's Route", icon: 'fa-route', desc: 'A quick-read route with a softer opening target.', mechanic: 'Daily runs get -2 target pressure.', targetTax: -2 },
        { id: 'boss-scout', name: 'Boss Scout', type: "Today's Route", icon: 'fa-crown', desc: 'The house posts boss prep notes early.', mechanic: 'Daily runs get -1 target pressure and a boss-forward seed.', targetTax: -1 },
        { id: 'oil-night', name: 'Oil Night', type: "Today's Route", icon: 'fa-droplet', desc: 'Slicker lanes pay better when you keep the ball clean.', mechanic: 'Daily runs start with +1 pin dollar.', cashBonus: 1 },
        { id: 'split-school', name: 'Split School', type: "Today's Route", icon: 'fa-code-branch', desc: 'Angle practice with stranger spare looks.', mechanic: 'Special pins get a small +2% feature bump.', specialBoost: 0.02 },
        { id: 'house-warmup', name: 'House Warmup', type: "Today's Route", icon: 'fa-house', desc: 'A cleaner first stage for learning the daily slate.', mechanic: 'Daily runs start with +1 pin dollar.', cashBonus: 1 },
        { id: 'late-shift', name: 'Late Shift', type: "Today's Route", icon: 'fa-moon', desc: 'A warmer, slower house pattern for patient lines.', mechanic: 'Daily runs get -1 target pressure and +1 pin dollar.', targetTax: -1, cashBonus: 1 },
        { id: 'jackpot-row', name: 'Jackpot Row', type: "Today's Route", icon: 'fa-coins', desc: 'The house wants flashy scoring and bigger payouts.', mechanic: 'Daily runs start with +2 pin dollars.', cashBonus: 2 },
        { id: 'pinfall-open', name: 'Pinfall Open', type: "Today's Route", icon: 'fa-trophy', desc: 'A balanced competitive daily with no gimmick overload.', mechanic: 'Daily runs use the fixed daily seed with no extra route tax.', targetTax: 0 },
        { id: 'neon-gutters', name: 'Neon Gutters', type: "Today's Route", icon: 'fa-arrows-left-right', desc: 'Wider-looking choices, tighter consequences.', mechanic: 'Daily runs get +1 pin dollar and a +1% special bump.', cashBonus: 1, specialBoost: 0.01 },
        { id: 'clinic-night', name: 'Clinic Night', type: "Today's Route", icon: 'fa-notes-medical', desc: 'The house gives you a little room to experiment.', mechanic: 'Daily runs get -3 target pressure.', targetTax: -3 },
        { id: 'strange-house', name: 'Strange House', type: "Today's Route", icon: 'fa-wand-sparkles', desc: 'A weirder route mix with more unusual scoring texture.', mechanic: 'Special pins get a +3% feature bump.', specialBoost: 0.03 },
        { id: 'double-feature', name: 'Double Feature', type: "Today's Route", icon: 'fa-clapperboard', desc: 'A daily built around bigger shop decisions.', mechanic: 'Daily runs start with +2 pin dollars but no target discount.', cashBonus: 2 }
    ],
    shop: [
        { id: 'heavy-house', name: 'Heavy House Ball', type: 'Featured Shop', icon: 'fa-weight-hanging', desc: 'Ball-weight picks are featured today.', mechanic: 'Daily shops try to include Heavy House Ball early.', shopUpgradeId: 'house_heavy_ball' },
        { id: 'thumb-tape', name: 'Thumb Tape Ritual', type: 'Featured Shop', icon: 'fa-bullseye', desc: 'Control and timing tools get the spotlight.', mechanic: 'Daily shops bias toward consistency upgrades.', shopCategory: 'CONSISTENCY' },
        { id: 'gold-rack', name: 'Gold Rack Promo', type: 'Featured Shop', icon: 'fa-coins', desc: 'Economy picks show up more often.', mechanic: 'Daily shops bias toward pin-dollar upgrades.', shopCategory: 'ECONOMY' },
        { id: 'pin-tech', name: 'Pin Tech Night', type: 'Featured Shop', icon: 'fa-map-pin', desc: 'Special pin upgrades are more likely early.', mechanic: 'Daily shops try to include a pins upgrade early.', shopCategory: 'PINS' },
        { id: 'release-lab', name: 'Release Lab', type: 'Featured Shop', icon: 'fa-bolt', desc: 'One-throw effects are on display.', mechanic: 'Daily shops bias toward one-throw upgrades.', shopCategory: 'ONE THROW' },
        { id: 'fresh-tape', name: 'Fresh Tape Bin', type: 'Featured Shop', icon: 'fa-tape', desc: 'Cheap focus tools are stocked today.', mechanic: 'Fresh Tape is favored when available.', shopUpgradeId: 'fresh_tape' },
        { id: 'spare-chalk', name: 'Spare Chalk Marks', type: 'Featured Shop', icon: 'fa-chalkboard', desc: 'Target relief builds have a better shot.', mechanic: 'Spare Chalk Marks is favored when available.', shopUpgradeId: 'spare_chalk' },
        { id: 'polish-counter', name: 'Polish Counter', type: 'Featured Shop', icon: 'fa-spray-can-sparkles', desc: 'Speed and polish options show up more.', mechanic: 'Fresh Polish is favored when available.', shopUpgradeId: 'polished_ball' },
        { id: 'gyro-sale', name: 'Gyro Sale', type: 'Featured Shop', icon: 'fa-sliders', desc: 'Steering builds are easier to start.', mechanic: 'Control upgrades are more likely.', shopCategory: 'CONTROL' },
        { id: 'bumper-bin', name: 'Bumper Bin', type: 'Featured Shop', icon: 'fa-shield-halved', desc: 'Shared bumper impact charges are stocked.', mechanic: 'Charged Bumper Guards is favored.', shopUpgradeId: 'gutters' },
        { id: 'core-night', name: 'Core Night', type: 'Featured Shop', icon: 'fa-bowling-ball', desc: 'Ball-core upgrades get extra shelf space.', mechanic: 'Ball upgrades are more likely.', shopCategory: 'BALL' },
        { id: 'practice-table', name: 'Practice Table', type: 'Featured Shop', icon: 'fa-clipboard-check', desc: 'Clutch one-throw tools are easier to find.', mechanic: 'Practice Frame Coupon is favored.', shopUpgradeId: 'practice_frame' }
    ],
    pin: [
        { id: 'gold-rush', name: 'Gold Rush Pins', type: 'Event Pin', icon: 'fa-medal', desc: 'Gold pins are more common in daily runs.', mechanic: 'Gold pin chance gets a small daily boost.', pinBias: 'GOLD' },
        { id: 'spring-loaded', name: 'Spring Loaded', type: 'Event Pin', icon: 'fa-up-right-and-down-left-from-center', desc: 'Bouncy pins are on the poster today.', mechanic: 'Bouncy pin chance gets a small daily boost.', pinBias: 'BOUNCY' },
        { id: 'gravity-well', name: 'Gravity Well', type: 'Event Pin', icon: 'fa-circle-dot', desc: 'Purple pin behavior is featured.', mechanic: 'Implosive pin chance gets a small daily boost.', pinBias: 'IMPLOSIVE' },
        { id: 'crackerjack', name: 'Crackerjack Pins', type: 'Event Pin', icon: 'fa-burst', desc: 'Explosive pins get a feature bump.', mechanic: 'Explosive pin chance gets a small daily boost.', pinBias: 'EXPLOSIVE' },
        { id: 'clean-ten', name: 'Clean Ten', type: 'Event Pin', icon: 'fa-bowling-ball', desc: 'A more classic-feeling daily.', mechanic: 'No extra pin bias. This is the house-control daily.' },
        { id: 'midas-mix', name: 'Midas Mix', type: 'Event Pin', icon: 'fa-star', desc: 'Value pins headline the event board.', mechanic: 'Gold pin chance gets a stronger daily boost.', pinBias: 'GOLD', specialBoost: 0.01 },
        { id: 'purple-hour', name: 'Purple Hour', type: 'Event Pin', icon: 'fa-circle-nodes', desc: 'Cluster-pulling pins are in the house lights.', mechanic: 'Implosive pins get a stronger daily boost.', pinBias: 'IMPLOSIVE', specialBoost: 0.01 },
        { id: 'red-line', name: 'Red Line', type: 'Event Pin', icon: 'fa-fire', desc: 'Red pins add a little impact drama.', mechanic: 'Explosive pins get a stronger daily boost.', pinBias: 'EXPLOSIVE', specialBoost: 0.01 },
        { id: 'rubber-room', name: 'Rubber Room', type: 'Event Pin', icon: 'fa-arrows-spin', desc: 'Bouncy pin texture is featured today.', mechanic: 'Bouncy pins get a stronger daily boost.', pinBias: 'BOUNCY', specialBoost: 0.01 },
        { id: 'mixed-bag', name: 'Mixed Bag', type: 'Event Pin', icon: 'fa-dice', desc: 'A little of everything, without overwhelming the rack.', mechanic: 'All featured pins get a tiny boost.', specialBoost: 0.02 },
        { id: 'quiet-rack', name: 'Quiet Rack', type: 'Event Pin', icon: 'fa-volume-xmark', desc: 'Lower chaos, cleaner reads.', mechanic: 'No extra event-pin boost today.' },
        { id: 'arcade-rack', name: 'Arcade Rack', type: 'Event Pin', icon: 'fa-gamepad', desc: 'More special-pin sparkle for a flashier daily.', mechanic: 'All featured pins get a +3% daily boost.', specialBoost: 0.03 }
    ]
};
const HOW_TO_PLAY_STEPS = [
    {
        title: 'Set The Line',
        kicker: 'Step 1 / Aim',
        body: 'Slide left or right before the throw. The white rail marks your starting lane and the pocket you are trying to shape.',
        icon: 'fa-arrows-left-right',
        art: 'line'
    },
    {
        title: 'Hit The Meter',
        kicker: 'Step 2 / Release',
        body: 'Tap the meter near the bright band. Better timing means better speed, carry, and control through the rack.',
        icon: 'fa-gauge-high',
        art: 'meter'
    },
    {
        title: 'Beat The Target',
        kicker: 'Step 3 / Score',
        body: 'Each roguelike frame has a target. Knock down enough value before your rolls run out, then spend pin dollars.',
        icon: 'fa-bowling-ball',
        art: 'pins'
    },
    {
        title: 'Build The Run',
        kicker: 'Step 4 / Route',
        body: 'Choose lanes, buy upgrades, and survive boss frames. Your save slot autosaves at route, shop, and upgrade breaks.',
        icon: 'fa-route',
        art: 'route'
    }
];

const { CANNON } = await initPhysics();
const loadingState = {
    total: 5,
    completed: 0,
    labels: []
};



updateLoading('PHYSICS CORE ONLINE');



const sfx = new RetroAudio();

















let scene, camera, renderer;
let presentation;
let releaseFeedbackUntil = 0;
let releaseFeedback = '';
let world;
let laneBody, ballBody, ballMesh;
let physicalPins = [];
let activeThrowMods = {};
let laneObjects = [];
let megaLaneObjects = [];
let gutterObjects = [];
let pinDeckWallObjects = [];
let venueObjects = [];
let laneDecorationObjects = [];
let lanePolishObjects = [];
let ceilingLightObjects = [];
let sceneLightObjects = [];
let reflectionObjects = [];
let laneReflector = null;
let pinDeckBodies = [];
let laneStaticBodies = [];
let gutterGuardsArray = [];
let bumperContacts = createBumperContacts();
let mawVisuals = null;
let throwElapsed = 0;
let ballHudSignature = '';
let starterBallIds = ['azure', 'amber'];
let starterEquipment = null;
let fpsCounter = null;
let legendActiveTab = 'upgrades';
let howToStepIndex = 0;
let dailyReviewOffset = 0;
let physicsAccumulator = 0;
let rollWatchdogTimer = null;
const ROLL_WATCHDOG_MS = 9000;
const ballMotionState = {
    initialized: false,
    prevPos: new THREE.Vector3(),
    currPos: new THREE.Vector3(),
    visualPos: new THREE.Vector3(),
    prevQuat: new THREE.Quaternion(),
    currQuat: new THREE.Quaternion(),
    curveSpin: 0
};
const ballVisualSpinQuat = new THREE.Quaternion();
const ballVisualLeanQuat = new THREE.Quaternion();
const ballVisualUpAxis = new THREE.Vector3(0, 1, 0);
const ballVisualForwardAxis = new THREE.Vector3(0, 0, 1);
let MATERIALS = {};
let cameraShake = 0;
let cameraLookTarget = new THREE.Vector3();
let preRollViewRaised = false;
let preRollViewBlend = 0;
const impactCamera = {
    active: false,
    elapsed: 0,
    anchor: new THREE.Vector3(),
    side: 1
};
let launchX = 0;
let activeHook = 0;
const PHYSICS_STEP = 1 / 60;
const MAX_PHYSICS_STEPS = 5;
const perfState = {
    showFps: false,
    frames: 0,
    elapsed: 0,
    fps: 0,
    physicsSteps: 0,
    alpha: 0,
    ballDelta: 0,
    cameraDelta: 0,
    zeroStepFrames: 0,
    zeroStepFramesSample: 0
};

function nativePlatform() {
    if (window.bowlingRogueNative?.platform === 'electron') return 'electron';
    const capacitor = window.Capacitor;
    if (capacitor?.isNativePlatform?.()) return capacitor.getPlatform?.() || 'mobile';
    return 'web';
}

function isNativeMobilePlatform() {
    const platform = nativePlatform();
    return platform === 'android' || platform === 'ios';
}

function rendererPixelRatioCap() {
    return isNativeMobilePlatform() ? 1.15 : 1.5;
}

function canQuitNativeShell() {
    const platform = nativePlatform();
    return platform === 'electron' || platform === 'android';
}

function startNativeShellAudio() {
    if (nativePlatform() === 'web') return;
    sfx.init();
}

function requestNativeQuit() {
    const platform = nativePlatform();
    if (platform === 'electron') {
        window.bowlingRogueNative?.quit?.();
        return;
    }
    const capacitorApp = window.Capacitor?.Plugins?.App;
    if (platform === 'android' && capacitorApp?.exitApp) {
        capacitorApp.exitApp();
        return;
    }
    showAlert('Quit is only available in the app');
}

function setupNativeShellUi() {
    const platform = nativePlatform();
    document.body.dataset.nativePlatform = platform;
    document.body.dataset.nativeShell = platform === 'web' ? 'web' : 'native';
    document.querySelectorAll('.native-quit-control').forEach((button) => {
        button.classList.toggle('hidden', !canQuitNativeShell());
    });
    updateControlLabels();
}

function setupNativeAudioLifecycle() {
    let backgrounded = false;
    const setBackgrounded = (isBackgrounded) => {
        if (backgrounded === isBackgrounded) return;
        backgrounded = isBackgrounded;
        if (backgrounded) {
            sfx.muteForBackground();
        } else {
            sfx.resumeFromBackground();
        }
    };

    document.addEventListener('visibilitychange', () => {
        setBackgrounded(document.visibilityState === 'hidden');
    });
    window.addEventListener('pagehide', () => setBackgrounded(true));
    window.addEventListener('pageshow', () => {
        if (document.visibilityState !== 'hidden') setBackgrounded(false);
    });

    const capacitorApp = window.Capacitor?.Plugins?.App;
    capacitorApp?.addListener?.('appStateChange', ({ isActive }) => {
        setBackgrounded(!isActive);
    })?.catch?.(() => {});
    capacitorApp?.addListener?.('pause', () => {
        setBackgrounded(true);
    })?.catch?.(() => {});
    capacitorApp?.addListener?.('resume', () => {
        if (document.visibilityState !== 'hidden') setBackgrounded(false);
    })?.catch?.(() => {});
}

function updateControlLabels() {
    const mobile = isPortraitMobileLayout();
    const steerLabel = document.getElementById('mobile-steer-label');
    const leftButton = document.getElementById('btn-steer-left');
    const rightButton = document.getElementById('btn-steer-right');
    if (steerLabel) steerLabel.innerText = 'MOVE / STEER';
    if (leftButton) leftButton.innerText = mobile ? '←' : '← A';
    if (rightButton) rightButton.innerText = mobile ? '→' : 'D →';
}


const ALLEY_TEXTURE_OPTIONS = Object.keys(CONVERTED_ALLEY_TEXTURES);
const ALLEY_OBJECT_TEXTURE_OPTIONS = ['Inherit', ...ALLEY_TEXTURE_OPTIONS];

const modelState = {
    loader: null,
    textureLoader: null,
    convertedAlleyTextures: new Map(),
    reflectionMap: null,
    alleyMeshes: [],
    alley: null,
    pinTemplate: null,
    ballTemplate: null,
    ready: false
};
const debugState = {
    active: false,
    panel: null,
    helpers: null,
    targetMarker: null,
    previousPaused: false,
    pointerLocked: false,
    flyKeys: {},
    flyYaw: 0,
    flyPitch: 0,
    hasSavedConfig: false,
    config: loadDebugConfig()
};
debugState.hasSavedConfig = Boolean(loadDebugConfig.wasSaved);
const clock = new THREE.Clock();
const LANE = {
    referenceWidth: 4.8,
    length: 56,
    height: 0.4,
    centerZ: -8,
    gutterWidth: 0.7,
    currentWidth: 4.8
};
const PIN_SCALE = {
    spacing: 1.37,
    radius: 0.27,
    height: 1.71
};
const BOWLING_PHYSICS = {
    ballMass: 7.6,
    tenPinBallMassBonus: 0.48,
    roguelikeBallMassBonus: 0.18,
    poundsOverHouseBallScale: 0.18,
    pinMass: 1.5,
    heavyPinMassBonus: 0.68, // roughly +1.5 lb if treating physics mass like kg
    rackJitter: PIN_RACK_MICRO_JITTER,
    launchBase: 14.4,
    launchPower: 9.6,
    skidPortion: 0.5,
    rollPortion: 0.82,
    hookForce: 68,
    rollStability: 0.72,
    idealEntryDeg: 6,
    flatAngleDeg: 2.8,
    centerHitX: 0.22,
    flatCenterSpeedLoss: 0.54,
    flatCenterDeflection: 0.34,
    pocketCarryMinSpeed: 9.8,
    pocketCarryMinOffset: 0.14,
    pocketCarryMaxOffset: 0.62,
    pocketCarryImpulse: 0.1
};

// Pin types registry


function initEngine() {
    const container = document.getElementById('canvas-container');
    
    // ThreeJS setup
    scene = new THREE.Scene();
    scene.fog = null;

    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, DEFAULT_DEBUG_CONFIG.render.cameraFar);
    camera.position.set(0, 4.8, 27);
    cameraLookTarget.set(0, 0.5, -7);
    camera.lookAt(cameraLookTarget);

    renderer = new THREE.WebGLRenderer({ antialias: !isNativeMobilePlatform(), powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, rendererPixelRatioCap()));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = !isNativeMobilePlatform();
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.setClearColor(0x0b1621, 1);
    container.appendChild(renderer.domElement);
    fpsCounter = document.createElement('div');
    fpsCounter.id = 'fps-counter';
    fpsCounter.className = 'hidden';
    fpsCounter.textContent = 'FPS --';
    document.body.appendChild(fpsCounter);
    presentation = createLanePresentation(scene, renderer);
    modelState.reflectionMap = presentation.environment;
    scene.environment = modelState.reflectionMap;
    applyRenderSettings();

    // CannonJS world setup
    world = new CANNON.World();
    world.gravity.set(0, -12, 0); // brisk, but stable enough for tall pins
    world.broadphase = new CANNON.NaiveBroadphase();
    world.solver.iterations = 8;
    world.solver.tolerance = 0.001;
    setupPhysicsMaterials();

    buildPhysicalLane(LANE.referenceWidth);
    buildSceneLighting();

    // Setup decorative retro glowing arches over lane
    buildLaneDecorations();

    window.addEventListener('resize', () => {
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, rendererPixelRatioCap()));
        renderer.setSize(window.innerWidth, window.innerHeight);
        updateControlLabels();
        if (GAME.mode === 'tenpin' || GAME.mode === 'roguelike') updateUI();
        if (GAME.state === 'MAIN_METER') setPreRollCamera();
        if (GAME.state === 'ROUTE') drawRouteMapLines();
    });
}

function updateLoading(label, amount = 1) {
    loadingState.completed = Math.min(loadingState.total, loadingState.completed + amount);
    if (label) loadingState.labels.push(label);
    const pct = Math.max(6, Math.round((loadingState.completed / loadingState.total) * 100));
    const status = document.getElementById('loading-status');
    const bar = document.getElementById('loading-bar');
    if (status) status.innerText = label || loadingState.labels[loadingState.labels.length - 1] || 'LOADING...';
    if (bar) bar.style.width = `${pct}%`;
}

function finishLoadingScreen() {
    updateLoading('READY TO ROLL', loadingState.total);
    const startButton = document.getElementById('btn-start-game');
    startButton.disabled = false;
    startButton.classList.remove('pixel-btn-disabled');
    startButton.innerText = 'Play Roguelike Run';
    const tenPinButton = document.getElementById('btn-start-tenpin');
    tenPinButton.disabled = false;
    tenPinButton.classList.remove('pixel-btn-disabled');
    tenPinButton.innerText = 'Start 10-Pin';
    updateMainMenuMeta();
    setTimeout(() => {
        document.getElementById('loading-screen')?.classList.add('hidden');
    }, 450);
}

function setupPhysicsMaterials() {
    MATERIALS.lane = new CANNON.Material({ name: 'lane' });
    MATERIALS.pin = new CANNON.Material({ name: 'pin' });
    MATERIALS.ball = new CANNON.Material({ name: 'ball' });
    MATERIALS.bouncyPin = new CANNON.Material({ name: 'bouncyPin' });
    MATERIALS.guard = new CANNON.Material({ name: 'guard' });
    MATERIALS.gutter = new CANNON.Material({ name: 'gutter' });

    // Historical requested pair coefficients: inactive in the Rapier shim.
    // Shipping response uses rapierShim.js materialPresets/native Average.
    // Do not tune this table expecting an effect or duplicate colliders to wire it.
    world.addContactMaterial(new CANNON.ContactMaterial(MATERIALS.ball, MATERIALS.lane, {
        friction: 0.018,
        restitution: 0.02
    }));
    world.addContactMaterial(new CANNON.ContactMaterial(MATERIALS.pin, MATERIALS.lane, {
        friction: 0.32,
        restitution: 0.04
    }));
    world.addContactMaterial(new CANNON.ContactMaterial(MATERIALS.bouncyPin, MATERIALS.lane, {
        friction: 0.28,
        restitution: 0.25
    }));
    world.addContactMaterial(new CANNON.ContactMaterial(MATERIALS.ball, MATERIALS.pin, {
        friction: 0.04,
        restitution: 0.42
    }));
    world.addContactMaterial(new CANNON.ContactMaterial(MATERIALS.pin, MATERIALS.pin, {
        friction: 0.16,
        restitution: 0.34
    }));
    world.addContactMaterial(new CANNON.ContactMaterial(MATERIALS.ball, MATERIALS.bouncyPin, {
        friction: 0.04,
        restitution: 0.7
    }));
    world.addContactMaterial(new CANNON.ContactMaterial(MATERIALS.bouncyPin, MATERIALS.pin, {
        friction: 0.12,
        restitution: 0.55
    }));
    world.addContactMaterial(new CANNON.ContactMaterial(MATERIALS.bouncyPin, MATERIALS.bouncyPin, {
        friction: 0.1,
        restitution: 0.65
    }));
    world.addContactMaterial(new CANNON.ContactMaterial(MATERIALS.ball, MATERIALS.guard, {
        friction: 0.01,
        restitution: 0.35
    }));
    world.addContactMaterial(new CANNON.ContactMaterial(MATERIALS.ball, MATERIALS.gutter, {
        friction: 0.035,
        restitution: 0.03
    }));
    world.addContactMaterial(new CANNON.ContactMaterial(MATERIALS.pin, MATERIALS.gutter, {
        friction: 0.42,
        restitution: 0.02
    }));
}

function cloneModel(source) {
    const clone = source.clone(true);
    const importedLights = [];
    clone.traverse((child) => {
        if (child.isLight) {
            importedLights.push(child);
            return;
        }
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
            if (child.material) child.material = child.material.clone();
        }
    });
    importedLights.forEach((light) => {
        if (light.parent) light.parent.remove(light);
        if (light.target?.parent) light.target.parent.remove(light.target);
    });
    return clone;
}

function fitModelToVisualBounds(object, { height = null, radius = null, centerY = 0 } = {}) {
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const size = box.getSize(new THREE.Vector3());
    const diameter = Math.max(size.x, size.z);
    let scale = 1;

    if (height && size.y > 0) {
        scale = height / size.y;
    } else if (radius && diameter > 0) {
        scale = (radius * 2) / diameter;
    }

    object.scale.multiplyScalar(scale);
    object.updateMatrixWorld(true);

    const scaledBox = new THREE.Box3().setFromObject(object);
    const center = scaledBox.getCenter(new THREE.Vector3());
    object.position.add(new THREE.Vector3(-center.x, centerY - center.y, -center.z));
    return object;
}

function fittedModelGroup(source, fitOptions, configure = null) {
    const model = cloneModel(source);
    if (configure) configure(model);
    fitModelToVisualBounds(model, fitOptions);
    const group = new THREE.Group();
    group.add(model);
    return { group, model };
}

function createBowlingReflectionMap() {
    const faces = ['#15110d', '#18140f', '#21180f', '#0d0c0b', '#2a1e12', '#080807'];
    const canvases = faces.map((base) => {
        const canvas = document.createElement('canvas');
        canvas.width = 128;
        canvas.height = 128;
        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 128, 128);
        gradient.addColorStop(0, base);
        gradient.addColorStop(0.52, '#342718');
        gradient.addColorStop(1, '#050403');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, 128, 128);
        ctx.fillStyle = '#fff6d8';
        ctx.globalAlpha = 0.16;
        ctx.fillRect(0, 58, 128, 6);
        ctx.globalAlpha = 0.08;
        ctx.fillRect(0, 76, 128, 4);
        ctx.globalAlpha = 1;
        return canvas;
    });
    const texture = new THREE.CubeTexture(canvases);
    texture.needsUpdate = true;
    texture.encoding = THREE.sRGBEncoding;
    return texture;
}

function setProceduralLaneVisible(visible) {
    laneObjects.forEach(obj => {
        obj.visible = visible;
    });
}

function currentLaneDimensions() {
    const lane = debugState.config.physicsLane || DEFAULT_DEBUG_CONFIG.physicsLane;
    return createLaneDimensions({
        baseLength: Number(lane.length || LANE.length),
        centerZ: Number(lane.position?.z ?? LANE.centerZ),
        frame: GAME.frame || 1,
        scale: pinGroupScale(),
        classic: isTenPinMode()
    });
}

function laneOrigin() {
    const position = debugState.config.physicsLane?.position || { x: 0, y: 0, z: LANE.centerZ };
    return { ...position, z: currentLaneDimensions().centerZ };
}

function laneLength() {
    return currentLaneDimensions().length;
}

function requestedPhysicsLaneWidth(frameNumber = GAME?.frame || 1) {
    const cfg = debugState.config.physicsLane || DEFAULT_DEBUG_CONFIG.physicsLane;
    if (cfg.useFrameWidth !== false) return laneWidthForFrame(frameNumber);
    return Math.max(MIN_PLAYABLE_LANE_WIDTH, Number(cfg.width || LANE.referenceWidth));
}

function pinRackOffset() {
    return debugState.config.pins?.position || { x: 0, y: 0, z: 0 };
}

function pinGroupScale() {
    return Math.max(0.2, debugState.config.pins?.scale || 1);
}

function pinVisualRotation() {
    return debugState.config.pins?.rotation || { x: -90, y: 0, z: 0 };
}

function ballStartZ() {
    return currentLaneDimensions().releaseZ;
}

function ballOffset() {
    return debugState.config.ball?.position || { x: 0, y: 0, z: 0 };
}

function ballStartPosition(radius = ballBody?.shapes?.[0]?.radius || 0.49) {
    const origin = laneOrigin();
    const offset = ballOffset();
    return {
        x: origin.x + clampLaunchX(launchX, radius) + Number(offset.x || 0),
        y: origin.y + radius + 0.03 + Number(offset.y || 0),
        z: ballStartZ() + Number(offset.z || 0)
    };
}

function laneEndZ() {
    return currentLaneDimensions().endZ;
}

function laneStartZ() {
    return currentLaneDimensions().foulLineZ;
}

function cleanupKillY() {
    return Number(debugState.config.render?.killPlaneY ?? -8);
}

function pinDeckContainmentMetrics(laneWidth = LANE.currentWidth) {
    const cfg = debugState.config.pinDeckPhysics || DEFAULT_DEBUG_CONFIG.pinDeckPhysics;
    const origin = laneOrigin();
    const rackOffset = pinRackOffset();
    const position = cfg.position || { x: 0, y: 0, z: 0 };
    const rackDepth = currentRackLayout().depth;
    const headPinZ = laneEndZ() + 3.5 + rackOffset.z + rackDepth;
    const widthPadding = Number(cfg.widthPadding ?? 0);
    const sideLength = Math.max(rackDepth + 6, Number(cfg.length || 10.5));
    const wallHeight = Math.max(0.5, Number(cfg.height || 1.75));
    const thickness = Math.max(0.05, Number(cfg.thickness || 0.18));
    const gutterMetrics = gutterChannelMetrics(laneWidth);
    const gutterOuterHalfWidth = gutterMetrics.visualWidth / 2 + gutterMetrics.gutterWidth + gutterMetrics.railWidth;
    return {
        enabled: cfg.enabled !== false,
        centerX: origin.x + rackOffset.x + Number(position.x || 0),
        centerY: origin.y + wallHeight / 2 + 0.08 + Number(position.y || 0),
        centerZ: headPinZ - rackDepth / 2 + Number(cfg.zOffset || 0) + Number(position.z || 0),
        halfWidth: Math.max(laneWidth / 2 + widthPadding, gutterOuterHalfWidth + Math.max(0, widthPadding)),
        sideLength,
        wallHeight,
        thickness
    };
}

function clonePlain(value) {
    return JSON.parse(JSON.stringify(value));
}

function mergeDebugConfig(base, saved) {
    const merged = clonePlain(base);
    if (!saved || typeof saved !== 'object') return merged;
    Object.keys(saved).forEach(key => {
        if (saved[key] && typeof saved[key] === 'object' && !Array.isArray(saved[key]) && merged[key]) {
            merged[key] = mergeDebugConfig(merged[key], saved[key]);
        } else {
            merged[key] = saved[key];
        }
    });
    return merged;
}

function ensureDebugLightingConfig(config) {
    if (!config.lighting || !Array.isArray(config.lighting.lights)) {
        config.lighting = clonePlain(DEFAULT_DEBUG_CONFIG.lighting);
    }
    if (!config.render) config.render = clonePlain(DEFAULT_DEBUG_CONFIG.render);
    if (!config.pinDeckPhysics) config.pinDeckPhysics = clonePlain(DEFAULT_DEBUG_CONFIG.pinDeckPhysics);
    if (!config.ball) config.ball = clonePlain(DEFAULT_DEBUG_CONFIG.ball);
    if (!config.reflections) config.reflections = clonePlain(DEFAULT_DEBUG_CONFIG.reflections);
    if (!config.planarReflection) config.planarReflection = clonePlain(DEFAULT_DEBUG_CONFIG.planarReflection);
    if (!config.megaLane) config.megaLane = clonePlain(DEFAULT_DEBUG_CONFIG.megaLane);
    if (!config.ceilingLights) config.ceilingLights = clonePlain(DEFAULT_DEBUG_CONFIG.ceilingLights);
    if (!config.atmosphere) config.atmosphere = clonePlain(DEFAULT_DEBUG_CONFIG.atmosphere);
    if (!config.alleySplit) config.alleySplit = clonePlain(DEFAULT_DEBUG_CONFIG.alleySplit);
    if (!config.venue) config.venue = clonePlain(DEFAULT_DEBUG_CONFIG.venue);
    if (!config.materialOverrides) config.materialOverrides = clonePlain(DEFAULT_DEBUG_CONFIG.materialOverrides);
    if (!config.objectOverrides) config.objectOverrides = clonePlain(DEFAULT_DEBUG_CONFIG.objectOverrides);
    if (!config.nodeVisibility) config.nodeVisibility = clonePlain(DEFAULT_DEBUG_CONFIG.nodeVisibility);
    config.lighting.lights = config.lighting.lights.map((light, index) => normalizeLightConfig(light, index));
    return config;
}

function normalizeLightConfig(light, index = 0) {
    const base = {
        id: light.id || `light-${Date.now()}-${index}`,
        name: light.name || `Light ${index + 1}`,
        type: light.type || 'point',
        enabled: light.enabled !== false,
        color: light.color || '#ffffff',
        intensity: Number(light.intensity ?? 1),
        distance: Number(light.distance ?? 24),
        decay: Number(light.decay ?? 1.4),
        angle: Number(light.angle ?? 35),
        penumbra: Number(light.penumbra ?? 0.45),
        castShadow: Boolean(light.castShadow),
        position: {
            x: Number(light.position?.x ?? 0),
            y: Number(light.position?.y ?? 4),
            z: Number(light.position?.z ?? -18)
        },
        target: {
            x: Number(light.target?.x ?? 0),
            y: Number(light.target?.y ?? 0.5),
            z: Number(light.target?.z ?? -30)
        }
    };
    return base;
}

function loadDebugConfig() {
    try {
        let raw = localStorage.getItem(DEBUG_STORAGE_KEY);
        let migratedFromLegacy = false;
        if (!raw) {
            raw = localStorage.getItem('bowlingRogueDebugPlacementV22') || localStorage.getItem('bowlingRogueDebugPlacementV21') || localStorage.getItem('bowlingRogueDebugPlacementV19') || localStorage.getItem('bowlingRogueDebugPlacementV18') || localStorage.getItem('bowlingRogueDebugPlacementV17') || localStorage.getItem('bowlingRogueDebugPlacementV16');
            migratedFromLegacy = Boolean(raw);
        }
        const parsed = raw ? JSON.parse(raw) : null;
        loadDebugConfig.wasSaved = Boolean(parsed && (parsed.version === DEBUG_CONFIG_VERSION || migratedFromLegacy));
        const config = loadDebugConfig.wasSaved ? mergeDebugConfig(DEFAULT_DEBUG_CONFIG, parsed) : clonePlain(DEFAULT_DEBUG_CONFIG);
        ensureDebugLightingConfig(config);
        if (migratedFromLegacy) {
            config.version = DEBUG_CONFIG_VERSION;
            config.splitAlley = false;
            config.alleySplit.enabled = false;
        }
        if (migratedFromLegacy) {
            // Keep the original saved placement in its old key; start the new arena
            // with a coherent coordinate system rather than mixing two venues.
            for (const section of ['physicsLane', 'pins', 'ball', 'pinDeckPhysics', 'render', 'lighting', 'megaLane', 'planarReflection']) config[section] = clonePlain(DEFAULT_DEBUG_CONFIG[section]);
            config.showAlley = false;
        }
        config.showProcedural = false;
        return config;
    } catch (error) {
        console.warn('Debug placement config could not be loaded.', error);
        loadDebugConfig.wasSaved = false;
        return ensureDebugLightingConfig(clonePlain(DEFAULT_DEBUG_CONFIG));
    }
}

function readObjectTransform(object) {
    return {
        position: {
            x: Number(object.position.x.toFixed(3)),
            y: Number(object.position.y.toFixed(3)),
            z: Number(object.position.z.toFixed(3))
        },
        rotation: {
            x: Number(THREE.MathUtils.radToDeg(object.rotation.x).toFixed(2)),
            y: Number(THREE.MathUtils.radToDeg(object.rotation.y).toFixed(2)),
            z: Number(THREE.MathUtils.radToDeg(object.rotation.z).toFixed(2))
        },
        scale: Number(object.scale.x.toFixed(4))
    };
}

function applyObjectTransform(object, transform) {
    if (!object || !transform) return;
    object.position.set(transform.position.x, transform.position.y, transform.position.z);
    object.rotation.set(
        THREE.MathUtils.degToRad(transform.rotation.x),
        THREE.MathUtils.degToRad(transform.rotation.y),
        THREE.MathUtils.degToRad(transform.rotation.z)
    );
    object.scale.setScalar(transform.scale);
}

function applyMaterialTuning(material, override = {}, profile = {}, settings = {}, options = {}) {
    const textureKey = override.texture;
    if (textureKey && textureKey !== 'Inherit' && textureKey !== 'None' && CONVERTED_ALLEY_TEXTURES[textureKey]) {
        material.map = convertedAlleyTexture(CONVERTED_ALLEY_TEXTURES[textureKey]);
    } else if (textureKey === 'None') {
        material.map = null;
    }
    if (override.color) material.color.set(override.color);
    if ('roughness' in material) {
        material.roughness = THREE.MathUtils.clamp(Number(override.roughness ?? profile.roughness ?? settings.roughness), 0.02, 1);
    }
    if ('metalness' in material) {
        material.metalness = THREE.MathUtils.clamp(Number(override.metalness ?? profile.metalness ?? settings.metalness), 0, 1);
    }
    if ('emissiveIntensity' in material) {
        const globalEmissive = options.skipGlobalEmissive ? 0 : Math.max(0, settings.emissiveIntensity || 0);
        material.emissiveIntensity = Math.max(0, Number(override.emissiveIntensity ?? profile.emissiveIntensity ?? 0)) + globalEmissive;
    }
    if ('envMapIntensity' in material) {
        material.envMapIntensity = Number(override.envMapIntensity ?? profile.envMapIntensity ?? material.envMapIntensity ?? 0.4);
    }
    material.needsUpdate = true;
}

function applyAlleyMaterialSettings() {
    if (!modelState.alley) return;
    const settings = debugState.config.alleyMaterial || DEFAULT_DEBUG_CONFIG.alleyMaterial;
    const materialOverrides = debugState.config.materialOverrides || {};
    const objectOverrides = debugState.config.objectOverrides || {};
    modelState.alley.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
            const profile = material.userData.alleyProfile || {};
            applyMaterialTuning(material, materialOverrides[material.name] || {}, profile, settings);
            if (objectOverrides[child.name]) {
                applyMaterialTuning(material, objectOverrides[child.name], material.userData.alleyProfile || {}, settings, { skipGlobalEmissive: true });
            }
        });
    });
}

function applyAlleySplitSettings() {
    if (!modelState.alley) return;
    const cfg = debugState.config.alleySplit || DEFAULT_DEBUG_CONFIG.alleySplit;
    const alleyScale = Math.max(0.001, Number(debugState.config.alley?.scale || 1));
    const extraWorldWidth = Math.max(0, LANE.currentWidth - Number(cfg.baseWidth || LANE.referenceWidth));
    const localOffset = cfg.enabled === false
        ? 0
        : THREE.MathUtils.clamp((extraWorldWidth * Number(cfg.expansionScale || 1)) / (2 * alleyScale), 0, Number(cfg.maxOffset || 12));
    const sourceLaneZ = Number(cfg.sourceLaneZ ?? -2.92);
    const deadZone = Math.max(0, Number(cfg.deadZone ?? 0.55));

    modelState.alley.traverse((child) => {
        if (!child.isMesh || !child.userData.alleyOriginalPosition || !child.userData.alleyOriginalScale) return;
        const original = child.userData.alleyOriginalPosition;
        const originalScale = child.userData.alleyOriginalScale;
        const centerZ = Number(child.userData.alleySplitCenterZ ?? 0);
        const minZ = Number(child.userData.alleySplitMinZ ?? centerZ);
        const maxZ = Number(child.userData.alleySplitMaxZ ?? centerZ);
        let offsetZ = 0;
        const spansGameplayLane = minZ < sourceLaneZ + deadZone && maxZ > sourceLaneZ - deadZone;
        if (!spansGameplayLane) {
            if (centerZ < sourceLaneZ - deadZone) offsetZ = -localOffset;
            if (centerZ > sourceLaneZ + deadZone) offsetZ = localOffset;
        }
        child.position.set(original.x, original.y, original.z + offsetZ);
        child.scale.copy(originalScale);
    });
}

function applyAlleyNodeVisibility() {
    if (!modelState.alley) return;
    const visibility = debugState.config.nodeVisibility || {};
    modelState.alley.traverse((child) => {
        if (!child.isMesh || !child.name) return;
        const fallback = child.userData.alleyDefaultVisible !== false;
        child.visible = visibility[child.name] !== undefined ? visibility[child.name] !== false : fallback;
    });
}

function alleyMaterialProfile(materialName) {
    if (/^Ball_/i.test(materialName)) return ALLEY_MATERIAL_PROFILES.Ball;
    if (/^Dark metal$/i.test(materialName)) return ALLEY_MATERIAL_PROFILES.Dark_Metal;
    if (/^Black_Gloss$/i.test(materialName)) return ALLEY_MATERIAL_PROFILES.Black_Gloss;
    if (/^Black$/i.test(materialName)) return ALLEY_MATERIAL_PROFILES.Black;
    if (/^Metal$/i.test(materialName)) return ALLEY_MATERIAL_PROFILES.Metal;
    if (/^wood_gloss|^Light_Wood$/i.test(materialName)) return ALLEY_MATERIAL_PROFILES.Wood;
    if (/^Dark_Wood$/i.test(materialName)) return ALLEY_MATERIAL_PROFILES.Dark_Wood;
    if (/^Monitor$/i.test(materialName)) return ALLEY_MATERIAL_PROFILES.Monitor;
    if (/^Light_points$/i.test(materialName)) return ALLEY_MATERIAL_PROFILES.Light_points;
    if (/^Blue_F$/i.test(materialName)) return ALLEY_MATERIAL_PROFILES.Blue_F;
    if (/^Target$/i.test(materialName)) return ALLEY_MATERIAL_PROFILES.Target;
    return ALLEY_MATERIAL_PROFILES.Black;
}

function convertedAlleyTexture(path) {
    if (!modelState.textureLoader) modelState.textureLoader = new THREE.TextureLoader();
    if (!modelState.convertedAlleyTextures.has(path)) {
        const texture = modelState.textureLoader.load(path);
        texture.flipY = false;
        texture.encoding = THREE.sRGBEncoding;
        texture.wrapS = THREE.RepeatWrapping;
        texture.wrapT = THREE.RepeatWrapping;
        if (renderer?.capabilities) texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
        modelState.convertedAlleyTextures.set(path, texture);
    }
    return modelState.convertedAlleyTextures.get(path);
}

function applyConvertedAlleyTextures(alley) {
    alley.traverse((child) => {
        if (!child.isMesh || !child.material) return;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
            const profile = alleyMaterialProfile(material.name || '');
            const texturePath = CONVERTED_ALLEY_TEXTURES[material.name];
            material.userData.alleyProfile = profile;
            material.color.setHex(profile.color);
            material.roughness = profile.roughness;
            material.metalness = profile.metalness;
            material.envMap = modelState.reflectionMap;
            material.envMapIntensity = profile.envMapIntensity;
            if (texturePath) {
                material.map = convertedAlleyTexture(texturePath);
                material.color.setHex(0xffffff);
            } else {
                material.map = null;
            }
            if (profile.emissiveIntensity) {
                material.emissive = new THREE.Color(profile.color);
                material.emissiveMap = material.map || null;
                material.emissiveIntensity = profile.emissiveIntensity;
            } else if (material.emissive) {
                material.emissive.setHex(0x000000);
                material.emissiveMap = null;
                material.emissiveIntensity = 0;
            }
            material.needsUpdate = true;
        });
    });
    applyAlleyMaterialSettings();
}

function optimizeAlleyModel(alley) {
    alley.traverse((child) => {
        if (!child.isMesh) return;
        child.frustumCulled = true;
        child.castShadow = false;
        child.receiveShadow = true;
    });
}

function collectAlleyMeshes(alley) {
    const meshes = [];
    alley.traverse((child) => {
        if (!child.isMesh || !child.name) return;
        child.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(child);
        const center = bounds.getCenter(new THREE.Vector3());
        const size = bounds.getSize(new THREE.Vector3());
        child.userData.alleyOriginalPosition = child.position.clone();
        child.userData.alleyOriginalScale = child.scale.clone();
        child.userData.alleyDefaultVisible = child.visible;
        child.userData.alleySplitCenterZ = center.z;
        child.userData.alleySplitMinZ = bounds.min.z;
        child.userData.alleySplitMaxZ = bounds.max.z;
        child.userData.alleySplitSizeZ = size.z;
        const materials = (Array.isArray(child.material) ? child.material : [child.material])
            .filter(Boolean)
            .map((material) => material.name || 'Unnamed');
        meshes.push({
            name: child.name,
            materials: [...new Set(materials)],
            centerZ: Number(center.z.toFixed(3)),
            widthZ: Number(size.z.toFixed(3)),
            defaultVisible: child.visible !== false
        });
    });
    modelState.alleyMeshes = meshes.sort((a, b) => a.name.localeCompare(b.name));
    renderDebugObjectEditor();
    renderDebugNodeEditor();
}

function setByPath(root, path, value) {
    const parts = path.split('.');
    let target = root;
    for (let i = 0; i < parts.length - 1; i++) target = target[parts[i]];
    target[parts[parts.length - 1]] = value;
}

function getByPath(root, path) {
    return path.split('.').reduce((target, part) => target?.[part], root);
}

function debugExportPayload() {
    const payload = {
        version: 1,
        note: 'Pinfall placement export. Values are Three.js world units; rotations are degrees.',
        config: debugState.config,
        runtime: {
            debugSaveLoaded: debugState.hasSavedConfig,
            debugStorageKey: DEBUG_STORAGE_KEY,
            lane: {
                width: Number(LANE.currentWidth.toFixed(3)),
                length: laneLength(),
                configuredWidth: debugState.config.physicsLane.width,
                useFrameWidth: debugState.config.physicsLane.useFrameWidth !== false,
                centerZ: LANE.centerZ,
                gutterWidth: LANE.gutterWidth,
                physicsPosition: debugState.config.physicsLane.position
            },
            ball: ballBody ? {
                position: {
                    x: Number(ballBody.position.x.toFixed(3)),
                    y: Number(ballBody.position.y.toFixed(3)),
                    z: Number(ballBody.position.z.toFixed(3))
                },
                radius: ballBody.shapes?.[0]?.radius || null
            } : null,
            firstPins: physicalPins.slice(0, 6).map(pin => ({
                type: pin.type.name,
                position: pin.body ? {
                    x: Number(pin.body.position.x.toFixed(3)),
                    y: Number(pin.body.position.y.toFixed(3)),
                    z: Number(pin.body.position.z.toFixed(3))
                } : null
            }))
        }
    };
    return JSON.stringify(payload, null, 2);
}

function updateDebugPanel() {
    if (!debugState.panel) return;
    const cfg = debugState.config;
    syncDebugInputs();

    ['showAlley', 'showMegaLane', 'showProcedural', 'showHelpers', 'useDebugCamera', 'splitAlley'].forEach(key => {
        const input = debugState.panel.querySelector(`[data-debug-toggle="${key}"]`);
        if (input) input.checked = Boolean(cfg[key]);
    });
    debugState.panel.querySelectorAll('[data-debug-toggle*="."]').forEach((input) => {
        input.checked = Boolean(getByPath(cfg, input.dataset.debugToggle));
    });

    const exportBox = debugState.panel.querySelector('#debug-export');
    if (exportBox) exportBox.value = debugExportPayload();
}

function applyDebugPlacement() {
    physicalPins.forEach(pin => { pin.sleepingUpright = false; });
    if (modelState.alley) {
        applyAlleySplitSettings();
        applyAlleyNodeVisibility();
        applyObjectTransform(modelState.alley, debugState.config.alley);
        modelState.alley.visible = Boolean(debugState.config.showAlley);
        applyAlleyMaterialSettings();
    }
    setMegaLaneVisible(Boolean(debugState.config.showMegaLane));
    setProceduralLaneVisible(Boolean(debugState.config.showProcedural));
    buildVenueShell();
    applyRenderSettings();
    syncSceneLighting();
    updateDebugHelpers();
    if (debugState.active) applyDebugCamera();
    updateDebugPanel();
    window.__bowlingDebugExport = debugExportPayload();
}

function applyRenderSettings() {
    if (!renderer || !camera || !scene || !debugState?.config?.render) return;
    const cfg = debugState.config.render;
    camera.far = Math.max(40, Number(cfg.cameraFar || 250));
    camera.updateProjectionMatrix();
    renderer.toneMappingExposure = Math.max(0.05, Number(cfg.exposure || 0.9));
    scene.fog = cfg.fogEnabled ? new THREE.FogExp2(0x0c0617, Math.max(0, Number(cfg.fogDensity || 0))) : null;
    document.documentElement.style.setProperty('--scanline-opacity', String(THREE.MathUtils.clamp(Number(cfg.scanlineOpacity ?? 0.055), 0, 0.35)));
    document.documentElement.style.setProperty('--scanline-spacing', `${Math.max(2, Number(cfg.scanlineSpacing || 3))}px`);
    document.querySelector('.scanlines')?.classList.toggle('hidden', cfg.scanlinesEnabled === false);
    const moodOverlay = document.getElementById('mood-overlay');
    if (moodOverlay) {
        moodOverlay.classList.toggle('hidden', cfg.moodEnabled === false);
        document.documentElement.style.setProperty('--mood-opacity', String(THREE.MathUtils.clamp(Number(cfg.moodOpacity ?? 0.72), 0, 1)));
        document.documentElement.style.setProperty('--mood-vignette', String(THREE.MathUtils.clamp(Number(cfg.moodVignette ?? 0.38), 0, 0.9)));
        document.documentElement.style.setProperty('--mood-cyan', String(THREE.MathUtils.clamp(Number(cfg.moodCyan ?? 0.035), 0, 0.4)));
        document.documentElement.style.setProperty('--mood-red', String(THREE.MathUtils.clamp(Number(cfg.moodRed ?? 0.045), 0, 0.4)));
    }
    updateLaneReflector();
}

function removeLaneReflector() {
    if (!laneReflector) return;
    if (laneReflector.parent) laneReflector.parent.remove(laneReflector);
    if (laneReflector.geometry) laneReflector.geometry.dispose();
    if (laneReflector.material) laneReflector.material.dispose();
    if (laneReflector.userData.renderTarget) laneReflector.userData.renderTarget.dispose();
    laneReflector = null;
}

function createPlanarReflector(geometry, options = {}) {
    const scope = new THREE.Mesh(geometry);
    const textureWidth = options.textureWidth || 1024;
    const textureHeight = options.textureHeight || 1024;
    const clipBias = options.clipBias || 0;
    const clipEnabled = options.clipEnabled === true;
    const updateInterval = Math.max(1, Math.round(Number(options.updateInterval || 1)));
    const reflectorPlane = new THREE.Plane();
    const normal = new THREE.Vector3();
    const reflectorWorldPosition = new THREE.Vector3();
    const cameraWorldPosition = new THREE.Vector3();
    const rotationMatrix = new THREE.Matrix4();
    const lookAtPosition = new THREE.Vector3(0, 0, -1);
    const clipPlane = new THREE.Vector4();
    const view = new THREE.Vector3();
    const target = new THREE.Vector3();
    const q = new THREE.Vector4();
    const textureMatrix = new THREE.Matrix4();
    const virtualCamera = new THREE.PerspectiveCamera();
    const renderTarget = new THREE.WebGLRenderTarget(textureWidth, textureHeight);
    renderTarget.texture.encoding = THREE.sRGBEncoding;
    renderTarget.texture.generateMipmaps = false;

    scope.material = new THREE.ShaderMaterial({
        uniforms: {
            color: { value: new THREE.Color(options.color || 0xffffff) },
            tDiffuse: { value: renderTarget.texture },
            textureMatrix: { value: textureMatrix },
            reflectionOpacity: { value: Number(options.opacity ?? 0.22) },
            reflectionBrightness: { value: Number(options.brightness ?? 0.74) },
            reflectionSaturation: { value: Number(options.saturation ?? 0.32) }
        },
        vertexShader: `
            uniform mat4 textureMatrix;
            varying vec4 vUv;
            varying vec2 vLaneUv;
            varying vec3 vWorldPosition;
            void main() {
                vWorldPosition = (modelMatrix * vec4(position, 1.0)).xyz;
                vLaneUv = uv;
                vUv = textureMatrix * vec4(position, 1.0);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 color;
            uniform sampler2D tDiffuse;
            uniform float reflectionOpacity;
            uniform float reflectionBrightness;
            uniform float reflectionSaturation;
            varying vec4 vUv;
            varying vec2 vLaneUv;
            varying vec3 vWorldPosition;
            void main() {
                vec2 uv = vUv.xy / vUv.w;
                // Lacquer keeps a clear grazing reflection and a softer near field.
                float facing = abs(normalize(cameraPosition - vWorldPosition).y);
                float fresnel = .45 + .55 * pow(1.0 - facing, 2.0);
                uv.x += sin(vLaneUv.x * 420.0) * .00012;
                vec4 reflected = texture2D(tDiffuse, uv) * 0.4;
                reflected += texture2D(tDiffuse, uv + vec2(.001, 0.0)) * .15;
                reflected += texture2D(tDiffuse, uv - vec2(.001, 0.0)) * .15;
                reflected += texture2D(tDiffuse, uv + vec2(0.0, .001)) * .15;
                reflected += texture2D(tDiffuse, uv - vec2(0.0, .001)) * .15;
                float luma = dot(reflected.rgb, vec3(0.299, 0.587, 0.114));
                float edge = smoothstep(0.0, 0.025, vLaneUv.x) * (1.0 - smoothstep(.975, 1.0, vLaneUv.x));
                vec3 toned = mix(vec3(luma), reflected.rgb, reflectionSaturation) * color * reflectionBrightness;
                gl_FragColor = vec4(toned, reflected.a * reflectionOpacity * edge * fresnel);
            }
        `,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    scope.frustumCulled = false;
    scope.userData.renderTarget = renderTarget;

    scope.onBeforeRender = function(reflectionRenderer, reflectionScene, reflectionCamera) {
        if (!shouldUpdateReflection(scope, updateInterval)) return;
        reflectorWorldPosition.setFromMatrixPosition(scope.matrixWorld);
        cameraWorldPosition.setFromMatrixPosition(reflectionCamera.matrixWorld);
        rotationMatrix.extractRotation(scope.matrixWorld);
        normal.set(0, 0, 1).applyMatrix4(rotationMatrix);

        view.subVectors(reflectorWorldPosition, cameraWorldPosition);
        if (view.dot(normal) > 0) normal.negate();
        view.reflect(normal).negate();
        view.add(reflectorWorldPosition);

        rotationMatrix.extractRotation(reflectionCamera.matrixWorld);
        lookAtPosition.set(0, 0, -1).applyMatrix4(rotationMatrix).add(cameraWorldPosition);
        target.subVectors(reflectorWorldPosition, lookAtPosition);
        target.reflect(normal).negate();
        target.add(reflectorWorldPosition);

        virtualCamera.position.copy(view);
        virtualCamera.up.set(0, 1, 0).applyMatrix4(rotationMatrix).reflect(normal);
        virtualCamera.lookAt(target);
        virtualCamera.near = reflectionCamera.near;
        virtualCamera.far = reflectionCamera.far;
        virtualCamera.aspect = reflectionCamera.aspect;
        virtualCamera.projectionMatrix.copy(reflectionCamera.projectionMatrix);
        virtualCamera.updateMatrixWorld();
        virtualCamera.matrixWorldInverse.copy(virtualCamera.matrixWorld).invert();

        textureMatrix.set(
            0.5, 0.0, 0.0, 0.5,
            0.0, 0.5, 0.0, 0.5,
            0.0, 0.0, 0.5, 0.5,
            0.0, 0.0, 0.0, 1.0
        );
        textureMatrix.multiply(virtualCamera.projectionMatrix);
        textureMatrix.multiply(virtualCamera.matrixWorldInverse);
        textureMatrix.multiply(scope.matrixWorld);

        if (clipEnabled) {
            reflectorPlane.setFromNormalAndCoplanarPoint(normal, reflectorWorldPosition);
            reflectorPlane.applyMatrix4(virtualCamera.matrixWorldInverse);
            clipPlane.set(reflectorPlane.normal.x, reflectorPlane.normal.y, reflectorPlane.normal.z, reflectorPlane.constant);

            const projectionMatrix = virtualCamera.projectionMatrix;
            q.x = (Math.sign(clipPlane.x) + projectionMatrix.elements[8]) / projectionMatrix.elements[0];
            q.y = (Math.sign(clipPlane.y) + projectionMatrix.elements[9]) / projectionMatrix.elements[5];
            q.z = -1.0;
            q.w = (1.0 + projectionMatrix.elements[10]) / projectionMatrix.elements[14];

            clipPlane.multiplyScalar(2.0 / clipPlane.dot(q));
            projectionMatrix.elements[2] = clipPlane.x;
            projectionMatrix.elements[6] = clipPlane.y;
            projectionMatrix.elements[10] = clipPlane.z + 1.0 - clipBias;
            projectionMatrix.elements[14] = clipPlane.w;
        }

        renderReflectionPass(reflectionRenderer, reflectionScene, virtualCamera, scope, renderTarget, reflectionCamera.viewport);
    };

    return scope;
}

function updateLaneReflector() {
    if (!scene || !renderer || !debugState?.config?.planarReflection) return;
    const cfg = debugState.config.planarReflection;
    if (!cfg.enabled) {
        removeLaneReflector();
        return;
    }
    const megaCfg = debugState.config.megaLane || {};

    const maxReflectionTextureSize = isNativeMobilePlatform() ? 512 : 2048;
    const textureSize = Math.max(256, Math.min(maxReflectionTextureSize, Math.round(Number(cfg.textureSize || 1024))));
    const laneReflectionWidth = LANE.currentWidth + Number(megaCfg.widthPadding || 0) * 2 + Number(megaCfg.gutterWidth || 0) * 2 + Number(megaCfg.railWidth || 0) * 2;
    const width = presentation ? LANE.currentWidth : Math.max(1, Number(cfg.width || laneReflectionWidth || LANE.currentWidth || 4.8));
    const length = presentation ? laneLength() : Math.max(8, Number(cfg.length || (laneLength() + Number(megaCfg.lengthPadding || 0))));
    const clipEnabled = cfg.clipEnabled === true;
    const desiredKey = `${textureSize}:${width.toFixed(3)}:${length.toFixed(3)}:${clipEnabled}:${Number(cfg.clipBias || 0.003).toFixed(5)}`;

    if (!laneReflector || laneReflector.userData.key !== desiredKey) {
        removeLaneReflector();
        const geometry = new THREE.PlaneGeometry(width, length);
        const reflectorOptions = {
            clipBias: Math.max(0, Number(cfg.clipBias || 0.003)),
            clipEnabled,
            textureWidth: textureSize,
            textureHeight: textureSize,
            color: 0xffffff,
            opacity: Number(cfg.opacity ?? 0.34),
            brightness: Number(cfg.brightness ?? 0.74),
            saturation: Number(cfg.saturation ?? 0.32),
            updateInterval: isNativeMobilePlatform() ? 2 : 1,
            encoding: THREE.sRGBEncoding
        };
        laneReflector = createPlanarReflector(geometry, reflectorOptions);
        laneReflector.name = 'Lane planar reflection';
        laneReflector.userData.key = desiredKey;
        laneReflector.renderOrder = 1;
        scene.add(laneReflector);
    }

    const origin = laneOrigin();
    laneReflector.visible = Boolean(cfg.enabled);
    laneReflector.position.set(origin.x, origin.y + Number(cfg.yOffset ?? 0.055), origin.z + Number(cfg.zOffset || 0));
    laneReflector.rotation.set(-Math.PI / 2, 0, 0);
    if (laneReflector.material?.uniforms?.reflectionOpacity) {
        laneReflector.material.uniforms.reflectionOpacity.value = THREE.MathUtils.clamp(Number(cfg.opacity ?? 0.34), 0, 0.85);
        laneReflector.material.uniforms.reflectionBrightness.value = THREE.MathUtils.clamp(Number(cfg.brightness ?? 0.74), 0, 2);
        laneReflector.material.uniforms.reflectionSaturation.value = THREE.MathUtils.clamp(Number(cfg.saturation ?? 0.32), 0, 2);
    }
}

function applyDebugCamera() {
    const cfg = debugState.config.camera;
    camera.position.set(cfg.position.x, cfg.position.y, cfg.position.z);
    cameraLookTarget.set(cfg.target.x, cfg.target.y, cfg.target.z);
    camera.lookAt(cameraLookTarget);
    if (debugState.targetMarker) {
        debugState.targetMarker.position.set(cfg.target.x, cfg.target.y, cfg.target.z);
    }
}

function clearSceneLighting() {
    sceneLightObjects.forEach((object) => {
        if (object.target) scene.remove(object.target);
        scene.remove(object);
    });
    sceneLightObjects = [];
}

function makeLightFromConfig(lightCfg) {
    const color = new THREE.Color(lightCfg.color || '#ffffff');
    let light;
    if (lightCfg.type === 'ambient') {
        light = new THREE.AmbientLight(color, lightCfg.intensity);
    } else if (lightCfg.type === 'directional') {
        light = new THREE.DirectionalLight(color, lightCfg.intensity);
    } else if (lightCfg.type === 'spot') {
        light = new THREE.SpotLight(color, lightCfg.intensity, lightCfg.distance, THREE.MathUtils.degToRad(lightCfg.angle), lightCfg.penumbra, lightCfg.decay);
    } else {
        light = new THREE.PointLight(color, lightCfg.intensity, lightCfg.distance, lightCfg.decay);
    }

    light.name = `debug-light-${lightCfg.id}`;
    light.userData.debugLightId = lightCfg.id;
    light.visible = lightCfg.enabled !== false;
    if (light.position && lightCfg.position) {
        light.position.set(lightCfg.position.x, lightCfg.position.y, lightCfg.position.z);
    }
    if ('castShadow' in light) {
        light.castShadow = Boolean(lightCfg.castShadow);
        if (light.castShadow && light.shadow) {
            light.shadow.mapSize.width = 1024;
            light.shadow.mapSize.height = 1024;
        }
    }
    if (light.target && lightCfg.target) {
        light.target.position.set(lightCfg.target.x, lightCfg.target.y, lightCfg.target.z);
        light.target.name = `debug-light-target-${lightCfg.id}`;
        scene.add(light.target);
    }
    return light;
}

function buildSceneLighting() {
    if (!scene || !debugState?.config) return;
    clearSceneLighting();
    ensureDebugLightingConfig(debugState.config);
    debugState.config.lighting.lights.forEach((lightCfg, index) => {
        const normalized = normalizeLightConfig(lightCfg, index);
        debugState.config.lighting.lights[index] = normalized;
        const light = makeLightFromConfig(normalized);
        scene.add(light);
        sceneLightObjects.push(light);
    });
}

function syncSceneLighting() {
    if (!scene) return;
    const expected = debugState.config.lighting?.lights || [];
    if (sceneLightObjects.length !== expected.length) {
        buildSceneLighting();
        return;
    }
    let needsRebuild = false;
    expected.forEach((lightCfg, index) => {
        const light = sceneLightObjects[index];
        if (!light || light.userData.debugLightId !== lightCfg.id || light.type.toLowerCase().indexOf(lightCfg.type) === -1) {
            needsRebuild = true;
            return;
        }
        light.visible = lightCfg.enabled !== false;
        light.color?.set(lightCfg.color || '#ffffff');
        light.intensity = Number(lightCfg.intensity ?? light.intensity);
        if ('distance' in light) light.distance = Number(lightCfg.distance ?? light.distance);
        if ('decay' in light) light.decay = Number(lightCfg.decay ?? light.decay);
        if ('angle' in light) light.angle = THREE.MathUtils.degToRad(Number(lightCfg.angle ?? 35));
        if ('penumbra' in light) light.penumbra = Number(lightCfg.penumbra ?? light.penumbra);
        if ('castShadow' in light) light.castShadow = Boolean(lightCfg.castShadow);
        if (light.position && lightCfg.position) light.position.set(lightCfg.position.x, lightCfg.position.y, lightCfg.position.z);
        if (light.target && lightCfg.target) {
            light.target.position.set(lightCfg.target.x, lightCfg.target.y, lightCfg.target.z);
            light.target.updateMatrixWorld();
        }
    });
    if (needsRebuild) buildSceneLighting();
}

function syncDebugAnglesFromConfig() {
    const cfg = debugState.config.camera;
    const dir = new THREE.Vector3(
        cfg.target.x - cfg.position.x,
        cfg.target.y - cfg.position.y,
        cfg.target.z - cfg.position.z
    ).normalize();
    debugState.flyYaw = Math.atan2(-dir.x, -dir.z);
    debugState.flyPitch = Math.asin(THREE.MathUtils.clamp(dir.y, -0.98, 0.98));
}

function syncDebugConfigFromCamera() {
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const target = camera.position.clone().addScaledVector(forward, 8);
    debugState.config.camera.position = {
        x: Number(camera.position.x.toFixed(3)),
        y: Number(camera.position.y.toFixed(3)),
        z: Number(camera.position.z.toFixed(3))
    };
    debugState.config.camera.target = {
        x: Number(target.x.toFixed(3)),
        y: Number(target.y.toFixed(3)),
        z: Number(target.z.toFixed(3))
    };
}

function updateDebugFlyCamera(dt) {
    if (!debugState.active) return;
    const move = new THREE.Vector3();
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    const right = new THREE.Vector3().crossVectors(forward, camera.up).normalize();
    const flatForward = forward.clone();
    flatForward.y = 0;
    if (flatForward.lengthSq() > 0.0001) flatForward.normalize();

    if (debugState.flyKeys.KeyW) move.add(flatForward);
    if (debugState.flyKeys.KeyS) move.sub(flatForward);
    if (debugState.flyKeys.KeyD) move.add(right);
    if (debugState.flyKeys.KeyA) move.sub(right);
    if (debugState.flyKeys.KeyE || debugState.flyKeys.Space) move.y += 1;
    if (debugState.flyKeys.KeyQ || debugState.flyKeys.ShiftLeft || debugState.flyKeys.ShiftRight) move.y -= 1;

    if (move.lengthSq() > 0.0001) {
        move.normalize().multiplyScalar((debugState.flyKeys.AltLeft || debugState.flyKeys.AltRight ? 12 : 5) * dt);
        camera.position.add(move);
    }

    const lookDir = new THREE.Vector3(
        -Math.sin(debugState.flyYaw) * Math.cos(debugState.flyPitch),
        Math.sin(debugState.flyPitch),
        -Math.cos(debugState.flyYaw) * Math.cos(debugState.flyPitch)
    );
    camera.lookAt(camera.position.clone().add(lookDir));
    syncDebugConfigFromCamera();
    updateDebugPanel();
}

function updateDebugHelpers() {
    if (!scene) return;
    const shouldShow = debugState.active && debugState.config.showHelpers;
    if (shouldShow && !debugState.helpers) {
        const helpers = new THREE.Group();
        helpers.userData.excludeFromPlanarReflection = true;
        const grid = new THREE.GridHelper(64, 32, 0x22d3ee, 0x334155);
        grid.position.y = 0.015;
        grid.userData.excludeFromPlanarReflection = true;
        helpers.add(grid);
        const axes = new THREE.AxesHelper(4);
        axes.position.set(0, 0.05, 18.4);
        axes.userData.excludeFromPlanarReflection = true;
        helpers.add(axes);
        const deck = new THREE.Box3Helper(new THREE.Box3(
            new THREE.Vector3(-LANE.currentWidth / 2, 0.02, -31),
            new THREE.Vector3(LANE.currentWidth / 2, 2, -23)
        ), 0xfacc15);
        deck.name = 'debug-lane-physics-box';
        deck.userData.excludeFromPlanarReflection = true;
        helpers.add(deck);
        const pinDeck = new THREE.Box3Helper(new THREE.Box3(), 0xff7a18);
        pinDeck.name = 'debug-pin-deck-physics-box';
        pinDeck.userData.excludeFromPlanarReflection = true;
        helpers.add(pinDeck);
        [-1, 1].forEach((side) => {
            const sideBox = new THREE.Box3Helper(new THREE.Box3(), 0xff7a18);
            sideBox.name = `debug-pin-deck-side-${side}`;
            sideBox.userData.excludeFromPlanarReflection = true;
            helpers.add(sideBox);
        });
        const targetGeo = new THREE.SphereGeometry(0.16, 12, 8);
        const targetMat = new THREE.MeshBasicMaterial({ color: 0xec4899 });
        debugState.targetMarker = new THREE.Mesh(targetGeo, targetMat);
        debugState.targetMarker.userData.excludeFromPlanarReflection = true;
        helpers.add(debugState.targetMarker);
        scene.add(helpers);
        debugState.helpers = helpers;
    }
    if (debugState.helpers) {
        debugState.helpers.visible = shouldShow;
        const origin = laneOrigin();
        const deck = debugState.helpers.getObjectByName('debug-lane-physics-box');
        if (deck) {
            deck.box.min.set(origin.x - LANE.currentWidth / 2, origin.y + 0.02, origin.z - laneLength() / 2);
            deck.box.max.set(origin.x + LANE.currentWidth / 2, origin.y + 2, origin.z + laneLength() / 2);
            deck.updateMatrixWorld(true);
        }
        const pinDeck = debugState.helpers.getObjectByName('debug-pin-deck-physics-box');
        const metrics = pinDeckContainmentMetrics(LANE.currentWidth);
        if (pinDeck) {
            pinDeck.visible = shouldShow && metrics.enabled;
            pinDeck.box.min.set(metrics.centerX - metrics.halfWidth, origin.y + 0.04, metrics.centerZ - metrics.sideLength / 2);
            pinDeck.box.max.set(metrics.centerX + metrics.halfWidth, origin.y + metrics.wallHeight, metrics.centerZ + metrics.sideLength / 2);
            pinDeck.updateMatrixWorld(true);
        }
        [-1, 1].forEach((side) => {
            const sideBox = debugState.helpers.getObjectByName(`debug-pin-deck-side-${side}`);
            if (!sideBox) return;
            sideBox.visible = shouldShow && metrics.enabled;
            const x = metrics.centerX + side * metrics.halfWidth;
            sideBox.box.min.set(x - metrics.thickness / 2, metrics.centerY - metrics.wallHeight / 2, metrics.centerZ - metrics.sideLength / 2);
            sideBox.box.max.set(x + metrics.thickness / 2, metrics.centerY + metrics.wallHeight / 2, metrics.centerZ + metrics.sideLength / 2);
            sideBox.updateMatrixWorld(true);
        });
        if (debugState.targetMarker) {
            const cfg = debugState.config.camera.target;
            debugState.targetMarker.position.set(cfg.x, cfg.y, cfg.z);
        }
        updateDebugLightHelpers();
    }
}

function updateDebugLightHelpers() {
    if (!debugState.helpers) return;
    const existing = new Set();
    debugState.config.lighting.lights.forEach((lightCfg) => {
        const markerName = `debug-light-helper-${lightCfg.id}`;
        const targetName = `debug-light-target-helper-${lightCfg.id}`;
        existing.add(markerName);
        if (lightCfg.type === 'spot' || lightCfg.type === 'directional') existing.add(targetName);

        let marker = debugState.helpers.getObjectByName(markerName);
        if (!marker) {
            marker = new THREE.Mesh(
                new THREE.SphereGeometry(0.22, 12, 8),
                new THREE.MeshBasicMaterial({ color: lightCfg.color || '#ffffff' })
            );
            marker.name = markerName;
            marker.userData.excludeFromPlanarReflection = true;
            debugState.helpers.add(marker);
        }
        marker.visible = lightCfg.enabled !== false && lightCfg.type !== 'ambient';
        marker.material.color.set(lightCfg.color || '#ffffff');
        marker.position.set(lightCfg.position?.x || 0, lightCfg.position?.y || 0, lightCfg.position?.z || 0);

        if (lightCfg.type === 'spot' || lightCfg.type === 'directional') {
            let target = debugState.helpers.getObjectByName(targetName);
            if (!target) {
                target = new THREE.Mesh(
                    new THREE.BoxGeometry(0.22, 0.22, 0.22),
                    new THREE.MeshBasicMaterial({ color: 0xfacc15 })
                );
                target.name = targetName;
                target.userData.excludeFromPlanarReflection = true;
                debugState.helpers.add(target);
            }
            target.visible = lightCfg.enabled !== false;
            target.position.set(lightCfg.target?.x || 0, lightCfg.target?.y || 0, lightCfg.target?.z || 0);
        }
    });

    for (let i = debugState.helpers.children.length - 1; i >= 0; i--) {
        const child = debugState.helpers.children[i];
        if (/^debug-light-(helper|target-helper)-/.test(child.name) && !existing.has(child.name)) {
            debugState.helpers.remove(child);
        }
    }
}

function debugNumberRow(label, path, delta, min = null, max = null) {
    const minAttr = min === null ? '' : ` data-min="${min}"`;
    const maxAttr = max === null ? '' : ` data-max="${max}"`;
    return `<span>${label}</span><button class="debug-mini-btn" data-debug-adjust="${path}" data-delta="${-delta}">-</button><button class="debug-mini-btn" data-debug-adjust="${path}" data-delta="${delta}">+</button><input class="debug-value-input" type="number" step="${delta}" data-debug-input="${path}"${minAttr}${maxAttr}>`;
}

function debugVecRows(prefix, path, delta = 0.25) {
    return [
        debugNumberRow(`${prefix}X`, `${path}.x`, delta),
        debugNumberRow(`${prefix}Y`, `${path}.y`, delta),
        debugNumberRow(`${prefix}Z`, `${path}.z`, delta)
    ].join('');
}

function debugSection(title, rows) {
    return `<div class="text-yellow-300 mb-1">${title}</div><div class="debug-grid mb-3">${rows}</div>`;
}

function newDebugLight(type = 'point') {
    const count = debugState.config.lighting.lights.length + 1;
    return normalizeLightConfig({
        id: `custom-${Date.now()}-${count}`,
        name: `Custom ${count}`,
        type,
        enabled: true,
        color: '#fff1d6',
        intensity: type === 'ambient' ? 0.12 : 0.5,
        distance: 30,
        decay: 1.35,
        angle: 35,
        penumbra: 0.45,
        castShadow: false,
        position: { x: 0, y: 5, z: -20 },
        target: { x: 0, y: 0.8, z: -40 }
    }, count);
}

function lightPath(index, suffix) {
    return `lighting.lights.${index}.${suffix}`;
}

function renderDebugLightEditor() {
    if (!debugState.panel) return;
    const container = debugState.panel.querySelector('#debug-lights');
    if (!container) return;
    ensureDebugLightingConfig(debugState.config);
    container.innerHTML = debugState.config.lighting.lights.map((light, index) => {
        const positionalRows = light.type === 'ambient' ? '' : debugVecRows('P', lightPath(index, 'position'), 0.25);
        const targetRows = light.type === 'spot' || light.type === 'directional'
            ? debugVecRows('T', lightPath(index, 'target'), 0.25)
            : '';
        const rangeRows = light.type === 'ambient' || light.type === 'directional' ? '' : debugNumberRow('DST', lightPath(index, 'distance'), 1, 0);
        const spotRows = light.type === 'spot'
            ? debugNumberRow('ANG', lightPath(index, 'angle'), 1, 1, 90) + debugNumberRow('PEN', lightPath(index, 'penumbra'), 0.05, 0, 1)
            : '';
        return `
            <div class="debug-light-card" data-debug-light-card="${index}">
                <div class="grid grid-cols-[1fr_92px_68px] gap-2 mb-2">
                    <input class="debug-value-input" data-debug-text="${lightPath(index, 'name')}" value="${light.name}">
                    <select class="debug-select" data-debug-light-type="${index}">
                        ${['ambient', 'point', 'spot', 'directional'].map(type => `<option value="${type}" ${light.type === type ? 'selected' : ''}>${type}</option>`).join('')}
                    </select>
                    <label class="flex items-center gap-1"><input type="checkbox" data-debug-light-enabled="${index}" ${light.enabled !== false ? 'checked' : ''}> ON</label>
                </div>
                <div class="debug-grid mb-2">
                    <span>COL</span><span></span><span></span><input class="debug-color-input" type="color" data-debug-color="${lightPath(index, 'color')}" value="${light.color}">
                    ${debugNumberRow('INT', lightPath(index, 'intensity'), 0.05, 0)}
                    ${positionalRows}
                    ${targetRows}
                    ${rangeRows}
                    ${light.type !== 'ambient' ? debugNumberRow('DCY', lightPath(index, 'decay'), 0.05, 0) : ''}
                    ${spotRows}
                </div>
                <div class="grid grid-cols-3 gap-2">
                    <button class="debug-mini-btn" data-debug-light-action="duplicate" data-index="${index}">DUP</button>
                    <button class="debug-mini-btn" data-debug-light-action="delete" data-index="${index}">DEL</button>
                    <label class="flex items-center gap-1"><input type="checkbox" data-debug-light-shadow="${index}" ${light.castShadow ? 'checked' : ''}> SHD</label>
                </div>
            </div>
        `;
    }).join('');
    syncDebugInputs();
}

function renderDebugMaterialEditor() {
    if (!debugState.panel) return;
    const container = debugState.panel.querySelector('#debug-materials');
    if (!container) return;
    const names = Object.keys(debugState.config.materialOverrides || {});
    container.innerHTML = names.map((name) => {
        const basePath = `materialOverrides.${name}`;
        const cfg = debugState.config.materialOverrides[name];
        return `
            <div class="debug-light-card">
                <div class="grid grid-cols-[1fr_110px] gap-2 mb-2">
                    <div class="text-cyan-200 truncate">${name}</div>
                    <select class="debug-select" data-debug-material-texture="${name}">
                        ${ALLEY_TEXTURE_OPTIONS.map(option => `<option value="${option}" ${cfg.texture === option ? 'selected' : ''}>${option}</option>`).join('')}
                    </select>
                </div>
                <div class="debug-grid mb-2">
                    <span>COL</span><span></span><span></span><input class="debug-color-input" type="color" data-debug-color="${basePath}.color" value="${cfg.color || '#ffffff'}">
                    ${debugNumberRow('RUF', `${basePath}.roughness`, 0.02, 0, 1)}
                    ${debugNumberRow('MET', `${basePath}.metalness`, 0.02, 0, 1)}
                    ${debugNumberRow('REF', `${basePath}.envMapIntensity`, 0.05, 0)}
                    ${debugNumberRow('EMI', `${basePath}.emissiveIntensity`, 0.02, 0)}
                </div>
            </div>
        `;
    }).join('');
    syncDebugInputs();
}

function objectOverrideBase(meshName) {
    const meshInfo = modelState.alleyMeshes.find((mesh) => mesh.name === meshName);
    const materialName = meshInfo?.materials?.[0] || '';
    const profile = alleyMaterialProfile(materialName);
    return {
        texture: 'Inherit',
        color: `#${new THREE.Color(profile.color).getHexString()}`,
        roughness: profile.roughness,
        metalness: profile.metalness,
        envMapIntensity: profile.envMapIntensity,
        emissiveIntensity: profile.emissiveIntensity || 0
    };
}

function renderDebugObjectEditor() {
    if (!debugState.panel) return;
    const container = debugState.panel.querySelector('#debug-objects');
    const select = debugState.panel.querySelector('#debug-object-source');
    if (!container || !select) return;
    const overrideNames = Object.keys(debugState.config.objectOverrides || {});
    const meshOptions = modelState.alleyMeshes
        .filter((mesh) => !overrideNames.includes(mesh.name))
        .map((mesh) => {
            const label = `${mesh.name} / ${mesh.materials.join(', ')}`;
            return `<option value="${mesh.name}">${label}</option>`;
        })
        .join('');
    select.innerHTML = meshOptions || '<option value="">No more meshes</option>';
    container.innerHTML = overrideNames.map((name) => {
        const basePath = `objectOverrides.${name}`;
        const cfg = debugState.config.objectOverrides[name];
        const meshInfo = modelState.alleyMeshes.find((mesh) => mesh.name === name);
        const materialLabel = meshInfo?.materials?.join(', ') || 'unknown material';
        return `
            <div class="debug-light-card">
                <div class="grid grid-cols-[1fr_110px] gap-2 mb-1">
                    <div class="text-cyan-200 truncate" title="${name}">${name}</div>
                    <select class="debug-select" data-debug-object-texture="${name}">
                        ${ALLEY_OBJECT_TEXTURE_OPTIONS.map(option => `<option value="${option}" ${cfg.texture === option ? 'selected' : ''}>${option}</option>`).join('')}
                    </select>
                </div>
                <div class="text-slate-400 truncate mb-2">${materialLabel}</div>
                <div class="debug-grid mb-2">
                    <span>COL</span><span></span><span></span><input class="debug-color-input" type="color" data-debug-color="${basePath}.color" value="${cfg.color || '#ffffff'}">
                    ${debugNumberRow('RUF', `${basePath}.roughness`, 0.02, 0, 1)}
                    ${debugNumberRow('MET', `${basePath}.metalness`, 0.02, 0, 1)}
                    ${debugNumberRow('REF', `${basePath}.envMapIntensity`, 0.05, 0)}
                    ${debugNumberRow('EMI', `${basePath}.emissiveIntensity`, 0.02, 0)}
                </div>
                <button class="debug-mini-btn w-full" data-debug-object-remove="${name}">REMOVE OBJECT OVERRIDE</button>
            </div>
        `;
    }).join('') || '<div class="text-slate-400 mb-2">Add a mesh here when one imported piece needs different texture or gloss than the rest of its material group.</div>';
    syncDebugInputs();
}

function renderDebugNodeEditor() {
    if (!debugState.panel) return;
    const container = debugState.panel.querySelector('#debug-nodes');
    if (!container) return;
    ensureDebugLightingConfig(debugState.config);
    const visibility = debugState.config.nodeVisibility || {};
    if (!modelState.alleyMeshes.length) {
        container.innerHTML = '<div class="text-slate-400 mb-2">Alley nodes will appear here after the GLB loads.</div>';
        return;
    }
    container.innerHTML = `
        <div class="grid grid-cols-2 gap-2 mb-2">
            <button class="debug-mini-btn" data-debug-action="show-all-nodes">SHOW ALL</button>
            <button class="debug-mini-btn" data-debug-action="restore-default-nodes">DEFAULT VIS</button>
        </div>
        <div class="max-h-72 overflow-y-auto pr-1">
            ${modelState.alleyMeshes.map((mesh) => {
                const checked = visibility[mesh.name] !== undefined ? visibility[mesh.name] !== false : mesh.defaultVisible !== false;
                const materialLabel = mesh.materials.join(', ') || 'unknown';
                const safeName = escapeHtml(mesh.name);
                const safeMaterials = escapeHtml(materialLabel);
                return `
                    <label class="grid grid-cols-[18px_1fr] gap-2 items-start py-1 border-b border-cyan-950/70">
                        <input type="checkbox" data-debug-node-visible="${safeName}" ${checked ? 'checked' : ''}>
                        <span class="min-w-0">
                            <span class="block text-cyan-200 truncate" title="${safeName}">${safeName}</span>
                            <span class="block text-slate-500 truncate">${safeMaterials} | z ${mesh.centerZ} | w ${mesh.widthZ}</span>
                        </span>
                    </label>
                `;
            }).join('')}
        </div>
    `;
}

function syncDebugInputs() {
    if (!debugState.panel) return;
    debugState.panel.querySelectorAll('[data-debug-input]').forEach((input) => {
        if (document.activeElement === input) return;
        const value = Number(getByPath(debugState.config, input.dataset.debugInput));
        input.value = Number.isFinite(value) ? value.toFixed(input.dataset.debugInput.includes('rotation') ? 1 : 2) : '';
    });
    debugState.panel.querySelectorAll('[data-debug-color]').forEach((input) => {
        if (document.activeElement !== input) input.value = getByPath(debugState.config, input.dataset.debugColor) || '#ffffff';
    });
    debugState.panel.querySelectorAll('[data-debug-text]').forEach((input) => {
        if (document.activeElement !== input) input.value = getByPath(debugState.config, input.dataset.debugText) || '';
    });
}

function handleDebugConfigEdit(path) {
    if (path === 'showAlley' && debugState.config.showAlley && !modelState.alley) {
        loadModelAssets();
    }
    if (path.startsWith('physicsLane.')) rebuildLaneFromDebug();
    if (path.startsWith('pinDeckPhysics.')) rebuildLaneFromDebug();
    if (path.startsWith('megaLane.')) rebuildLaneFromDebug();
    if (path === 'splitAlley') {
        debugState.config.alleySplit.enabled = Boolean(debugState.config.splitAlley);
        applyAlleySplitSettings();
    }
    if (path.startsWith('alleySplit.')) applyAlleySplitSettings();
    if (path.startsWith('pins.')) {
        buildPhysicalLane(requestedPhysicsLaneWidth(GAME.frame));
        if (physicalPins.length) generatePinGrid(GAME.frame);
    }
    if (path.startsWith('ball.')) {
        if (ballBody) {
            const radius = ballBody.shapes?.[0]?.radius || 0.49;
            const next = ballStartPosition(radius);
            ballBody.position.set(next.x, next.y, next.z);
            ballBody.velocity.set(0, 0, 0);
            ballBody.angularVelocity.set(0, 0, 0);
            if (ballMesh) ballBody.position.copyTo(ballMesh.position);
            resetBallMotionState();
        }
    }
    if (path.startsWith('lighting.')) syncSceneLighting();
    if (path.startsWith('ceilingLights.') || path.startsWith('atmosphere.')) buildLaneDecorations();
    if (path.startsWith('render.')) applyRenderSettings();
    if (path.startsWith('reflections.')) updatePinReflections();
    if (path.startsWith('planarReflection.')) updateLaneReflector();
    if (path.startsWith('materialOverrides.')) applyAlleyMaterialSettings();
    if (path.startsWith('objectOverrides.')) applyAlleyMaterialSettings();
    if (path.startsWith('alleyMaterial.')) applyAlleyMaterialSettings();
    applyDebugPlacement();
}

function clampDebugValue(path, value) {
    if (path.endsWith('.scale')) return Math.max(0.2, value);
    if (path === 'physicsLane.length') return Math.max(20, value);
    if (path === 'physicsLane.width') return Math.max(1.5, value);
    if (path === 'physicsLane.frameWidthPadding') return Math.max(0, value);
    if (path.includes('count') || path.includes('Count')) return Math.max(0, Math.round(value));
    if (path.includes('size') || path.includes('Width') || path.includes('Height') || path.includes('Depth') || path.includes('Length') || path.includes('Spacing')) return Math.max(0, value);
    if (path.includes('intensity') || path.includes('distance') || path.includes('decay')) return Math.max(0, value);
    if (path.includes('roughness') || path.includes('metalness') || path.includes('penumbra') || path.includes('Opacity') || path.includes('opacity')) return THREE.MathUtils.clamp(value, 0, 1);
    if (path.endsWith('.angle')) return THREE.MathUtils.clamp(value, 1, 90);
    return value;
}

function createDebugPanel() {
    const panel = document.createElement('div');
    panel.id = 'debug-panel';
    panel.className = 'hidden';
    panel.innerHTML = `
        <div class="flex items-center justify-between gap-3 mb-3">
            <div class="text-cyan-300 text-[10px]">DEBUG PLACEMENT</div>
            <button class="debug-mini-btn" data-debug-action="close">F1 CLOSE</button>
        </div>
        <div class="grid grid-cols-2 gap-2 mb-3">
            <label class="flex items-center gap-2"><input type="checkbox" data-debug-toggle="showAlley"> ALLEY GLB</label>
            <label class="flex items-center gap-2"><input type="checkbox" data-debug-toggle="showMegaLane"> MEGA LANE</label>
            <label class="flex items-center gap-2"><input type="checkbox" data-debug-toggle="splitAlley"> SPLIT ALLEY</label>
            <label class="flex items-center gap-2"><input type="checkbox" data-debug-toggle="showProcedural"> OLD LANE</label>
            <label class="flex items-center gap-2"><input type="checkbox" data-debug-toggle="showHelpers"> HELPERS</label>
            <label class="flex items-center gap-2"><input type="checkbox" data-debug-toggle="useDebugCamera"> USE CAMERA</label>
        </div>
        <div class="text-slate-300 mb-3">Click the 3D view, then WASD moves, QE rises/falls, mouse looks. Esc releases mouse.</div>
        ${debugSection('ALLEY MODEL', debugVecRows('P', 'alley.position', 0.25) + debugVecRows('R', 'alley.rotation', 5) + debugNumberRow('S', 'alley.scale', 0.05, 0.2))}
        ${debugSection('CAMERA / LOOK TARGET', debugVecRows('CP', 'camera.position', 0.25) + debugVecRows('T', 'camera.target', 0.25))}
        ${debugSection('RENDER / VIEW', debugNumberRow('FAR', 'render.cameraFar', 5, 40) + debugNumberRow('EXP', 'render.exposure', 0.05, 0.05) + debugNumberRow('FOG', 'render.fogDensity', 0.001, 0) + debugNumberRow('SOP', 'render.scanlineOpacity', 0.01, 0, 0.35) + debugNumberRow('SSP', 'render.scanlineSpacing', 1, 2, 12) + debugNumberRow('SHK', 'render.cameraShake', 0.05, 0, 1) + debugNumberRow('FOL', 'render.cameraFollow', 0.05, 0, 2))}
        <label class="flex items-center gap-2 mb-3"><input type="checkbox" data-debug-toggle="render.fogEnabled"> FOG ENABLED</label>
        <label class="flex items-center gap-2 mb-3"><input type="checkbox" data-debug-toggle="render.scanlinesEnabled"> SCANLINES ENABLED</label>
        ${debugSection('END CAMERA', debugNumberRow('ST', 'render.endCameraStart', 0.02, 0, 1) + debugNumberRow('Y', 'render.endCameraHeight', 0.05, 0.5, 5) + debugNumberRow('LY', 'render.endCameraLookHeight', 0.05, 0.5, 5) + debugNumberRow('BK', 'render.endCameraBack', 0.5, 4) + debugNumberRow('LZ', 'render.endCameraLookAhead', 0.5, -10, 20))}
        <label class="flex items-center gap-2 mb-3"><input type="checkbox" data-debug-toggle="render.endCameraEnabled"> END CAMERA ENABLED</label>
        ${debugSection('CLEANUP / KILL PLANE', debugNumberRow('KY', 'render.killPlaneY', 0.5, -40, 2) + debugNumberRow('BZ', 'render.ballKillZPadding', 0.5, 0, 20))}
        ${debugSection('MOOD SHADER', debugNumberRow('OPC', 'render.moodOpacity', 0.05, 0, 1) + debugNumberRow('VIG', 'render.moodVignette', 0.05, 0, 0.9) + debugNumberRow('CYN', 'render.moodCyan', 0.01, 0, 0.4) + debugNumberRow('RED', 'render.moodRed', 0.01, 0, 0.4))}
        <label class="flex items-center gap-2 mb-3"><input type="checkbox" data-debug-toggle="render.moodEnabled"> MOOD SHADER ENABLED</label>
        ${debugSection('CEILING LIGHT FIXTURES', debugNumberRow('Y', 'ceilingLights.y', 0.1, 0) + debugNumberRow('XOF', 'ceilingLights.xOffset', 0.05, 0) + debugNumberRow('ZST', 'ceilingLights.zStartOffset', 0.5, 0) + debugNumberRow('ZSP', 'ceilingLights.zSpacing', 0.5, 1) + debugNumberRow('CNT', 'ceilingLights.count', 1, 0) + debugNumberRow('FW', 'ceilingLights.fixtureWidth', 0.05, 0.1) + debugNumberRow('FH', 'ceilingLights.fixtureHeight', 0.01, 0.01) + debugNumberRow('FD', 'ceilingLights.fixtureDepth', 0.05, 0.1) + debugNumberRow('SCL', 'ceilingLights.fixtureScale', 0.05, 0.1))}
        ${debugSection('LIGHT SHAFTS / POOLS', debugNumberRow('CONE', 'atmosphere.lightShafts.coneOpacity', 0.01, 0, 1) + debugNumberRow('CR', 'atmosphere.lightShafts.coneRadius', 0.1, 0) + debugNumberRow('CH', 'atmosphere.lightShafts.coneHeight', 0.1, 0) + debugNumberRow('SOP', 'atmosphere.lightShafts.shaftOpacity', 0.01, 0, 1) + debugNumberRow('SW', 'atmosphere.lightShafts.shaftWidth', 0.1, 0) + debugNumberRow('SH', 'atmosphere.lightShafts.shaftHeight', 0.1, 0) + debugNumberRow('POP', 'atmosphere.lightShafts.poolOpacity', 0.01, 0, 1) + debugNumberRow('PW', 'atmosphere.lightShafts.poolWidth', 0.1, 0) + debugNumberRow('PL', 'atmosphere.lightShafts.poolLength', 0.1, 0))}
        <label class="flex items-center gap-2 mb-3"><input type="checkbox" data-debug-toggle="atmosphere.lightShafts.enabled"> LIGHT SHAFTS ENABLED</label>
        ${debugSection('DUST PARTICLES', debugNumberRow('CNT', 'atmosphere.dust.count', 1, 0) + debugNumberRow('MOB', 'atmosphere.dust.mobileCount', 1, 0) + debugNumberRow('SMN', 'atmosphere.dust.sizeMin', 0.005, 0) + debugNumberRow('SMX', 'atmosphere.dust.sizeMax', 0.005, 0) + debugNumberRow('OMN', 'atmosphere.dust.opacityMin', 0.005, 0, 1) + debugNumberRow('OMX', 'atmosphere.dust.opacityMax', 0.005, 0, 1) + debugNumberRow('VMN', 'atmosphere.dust.speedMin', 0.02, 0) + debugNumberRow('VMX', 'atmosphere.dust.speedMax', 0.02, 0) + debugNumberRow('DMN', 'atmosphere.dust.driftMin', 0.02, 0) + debugNumberRow('DMX', 'atmosphere.dust.driftMax', 0.02, 0))}
        <label class="flex items-center gap-2 mb-3"><input type="checkbox" data-debug-toggle="atmosphere.dust.enabled"> DUST ENABLED</label>
        <div class="text-yellow-300 mb-1">DUST SPOT LIGHTS</div>
        <div class="debug-grid mb-2">
            <span>COL</span><span></span><span></span><input class="debug-color-input" type="color" data-debug-color="atmosphere.dustLights.color">
            ${debugNumberRow('CNT', 'atmosphere.dustLights.count', 1, 0)}
            ${debugNumberRow('INT', 'atmosphere.dustLights.intensity', 0.01, 0)}
            ${debugNumberRow('MOB', 'atmosphere.dustLights.mobileIntensity', 0.01, 0)}
            ${debugNumberRow('DST', 'atmosphere.dustLights.distance', 0.5, 0)}
            ${debugNumberRow('DCY', 'atmosphere.dustLights.decay', 0.1, 0)}
            ${debugNumberRow('ANG', 'atmosphere.dustLights.angle', 1, 1, 90)}
            ${debugNumberRow('PEN', 'atmosphere.dustLights.penumbra', 0.05, 0, 1)}
            ${debugNumberRow('Y', 'atmosphere.dustLights.y', 0.1, 0)}
            ${debugNumberRow('TY', 'atmosphere.dustLights.targetY', 0.1, -2)}
            ${debugNumberRow('ZST', 'atmosphere.dustLights.zStartOffset', 0.5, 0)}
            ${debugNumberRow('ZSP', 'atmosphere.dustLights.zSpacing', 0.5, 1)}
        </div>
        <label class="flex items-center gap-2 mb-3"><input type="checkbox" data-debug-toggle="atmosphere.dustLights.enabled"> DUST SPOT LIGHTS ENABLED</label>
        ${debugSection('VENUE SHELL', debugVecRows('V', 'venue.position', 0.25) + debugNumberRow('WID', 'venue.width', 1, 10) + debugNumberRow('PAD', 'venue.widthPadding', 0.5, 0) + debugNumberRow('DEP', 'venue.depth', 2, 30) + debugNumberRow('Z', 'venue.zOffset', 0.5) + debugNumberRow('HGT', 'venue.wallHeight', 0.5, 3) + debugNumberRow('CY', 'venue.ceilingY', 0.5, 4) + debugNumberRow('GRT', 'venue.grit', 0.05, 0, 1) + debugNumberRow('SHD', 'venue.cornerShadow', 0.05, 0, 0.9) + debugNumberRow('LIT', 'venue.lightIntensity', 0.05, 0) + debugNumberRow('ROW', 'venue.lightRows', 1, 1) + debugNumberRow('LSP', 'venue.lightSpacing', 1, 3) + debugNumberRow('DSP', 'venue.detailSpacing', 1, 2))}
        <label class="flex items-center gap-2 mb-3"><input type="checkbox" data-debug-toggle="venue.enabled"> VENUE ENABLED</label>
        ${debugSection('PHYSICS LANE / FLOOR', debugVecRows('L', 'physicsLane.position', 0.25) + debugNumberRow('LEN', 'physicsLane.length', 1, 20) + debugNumberRow('WID', 'physicsLane.width', 0.1, 1.5) + debugNumberRow('FWP', 'physicsLane.frameWidthPadding', 0.05, 0))}
        <label class="flex items-center gap-2 mb-3"><input type="checkbox" data-debug-toggle="physicsLane.useFrameWidth"> FRAME WIDTH ENABLED</label>
        ${debugSection('MODULAR MEGA LANE', debugNumberRow('PAD', 'megaLane.widthPadding', 0.05, 0) + debugNumberRow('LPD', 'megaLane.lengthPadding', 1, 0) + debugNumberRow('Y', 'megaLane.yOffset', 0.005, 0) + debugNumberRow('Z', 'megaLane.zOffset', 0.25) + debugNumberRow('GUT', 'megaLane.gutterWidth', 0.05, 0) + debugNumberRow('RLW', 'megaLane.railWidth', 0.02, 0) + debugNumberRow('RLH', 'megaLane.railHeight', 0.02, 0) + debugNumberRow('EDG', 'megaLane.edgeBoardWidth', 0.05, 0) + debugNumberRow('PLK', 'megaLane.plankSpacing', 0.02, 0.1) + debugNumberRow('RPX', 'megaLane.woodRepeatX', 0.05, 0.1) + debugNumberRow('RPZ', 'megaLane.woodRepeatZ', 0.25, 0.5) + debugNumberRow('ROT', 'megaLane.woodRotation', 5) + debugNumberRow('RUF', 'megaLane.roughness', 0.02, 0, 1) + debugNumberRow('REF', 'megaLane.envMapIntensity', 0.05, 0))}
        <label class="flex items-center gap-2 mb-3"><input type="checkbox" data-debug-toggle="megaLane.enabled"> MODULAR LANE ENABLED</label>
        ${debugSection('IMPORTED ALLEY SPLIT', debugNumberRow('SRC', 'alleySplit.sourceLaneZ', 0.1) + debugNumberRow('DZN', 'alleySplit.deadZone', 0.05, 0) + debugNumberRow('BAS', 'alleySplit.baseWidth', 0.1, 1) + debugNumberRow('SCL', 'alleySplit.expansionScale', 0.05, 0) + debugNumberRow('MAX', 'alleySplit.maxOffset', 0.25, 0))}
        <label class="flex items-center gap-2 mb-3"><input type="checkbox" data-debug-toggle="alleySplit.enabled"> IMPORTED SPLIT ENABLED</label>
        ${debugSection('PIN DECK PHYSICS', debugVecRows('P', 'pinDeckPhysics.position', 0.1) + debugNumberRow('PAD', 'pinDeckPhysics.widthPadding', 0.05, -2) + debugNumberRow('LEN', 'pinDeckPhysics.length', 0.5, 2) + debugNumberRow('HGT', 'pinDeckPhysics.height', 0.1, 0.5) + debugNumberRow('THK', 'pinDeckPhysics.thickness', 0.02, 0.05) + debugNumberRow('ZOF', 'pinDeckPhysics.zOffset', 0.25))}
        <label class="flex items-center gap-2 mb-3"><input type="checkbox" data-debug-toggle="pinDeckPhysics.enabled"> PIN SIDE WALLS ENABLED</label>
        ${debugSection('PIN RACK OFFSET', debugVecRows('P', 'pins.position', 0.05) + debugNumberRow('S', 'pins.scale', 0.05, 0.2) + debugVecRows('R', 'pins.rotation', 5))}
        ${debugSection('BALL OFFSET', debugVecRows('B', 'ball.position', 0.05))}
        ${debugSection('ALLEY MATERIAL', debugNumberRow('RUF', 'alleyMaterial.roughness', 0.05, 0, 1) + debugNumberRow('MET', 'alleyMaterial.metalness', 0.05, 0, 1) + debugNumberRow('EMI', 'alleyMaterial.emissiveIntensity', 0.02, 0))}
        ${debugSection('REAL LANE REFLECTION', debugNumberRow('OPC', 'planarReflection.opacity', 0.02, 0, 0.85) + debugNumberRow('BRI', 'planarReflection.brightness', 0.05, 0, 2) + debugNumberRow('SAT', 'planarReflection.saturation', 0.05, 0, 2) + debugNumberRow('Y', 'planarReflection.yOffset', 0.005, 0) + debugNumberRow('W', 'planarReflection.width', 0.1, 1) + debugNumberRow('LEN', 'planarReflection.length', 1, 8) + debugNumberRow('Z', 'planarReflection.zOffset', 0.5) + debugNumberRow('TEX', 'planarReflection.textureSize', 128, 256, 2048) + debugNumberRow('CLP', 'planarReflection.clipBias', 0.001, 0))}
        <label class="flex items-center gap-2 mb-3"><input type="checkbox" data-debug-toggle="planarReflection.clipEnabled"> REFLECTION CLIP ENABLED</label>
        <label class="flex items-center gap-2 mb-3"><input type="checkbox" data-debug-toggle="planarReflection.enabled"> REAL REFLECTION ENABLED</label>
        <div class="flex items-center justify-between mb-2">
            <div class="text-yellow-300">MATERIAL GROUPS</div>
            <button class="debug-mini-btn" data-debug-action="apply-materials">APPLY</button>
        </div>
        <div id="debug-materials" class="mb-3"></div>
        <div class="flex items-center justify-between mb-2">
            <div class="text-yellow-300">OBJECT OVERRIDES</div>
            <button class="debug-mini-btn" data-debug-action="add-object-override">ADD SELECTED</button>
        </div>
        <select id="debug-object-source" class="debug-select mb-2"></select>
        <div id="debug-objects" class="mb-3"></div>
        <div class="flex items-center justify-between mb-2">
            <div class="text-yellow-300">ALLEY NODE VISIBILITY</div>
            <span class="text-slate-500">SAVED</span>
        </div>
        <div id="debug-nodes" class="mb-3"></div>
        <div class="flex items-center justify-between mb-2">
            <div class="text-yellow-300">VENUE COLORS / TEXT</div>
            <span class="text-slate-500">ROOM</span>
        </div>
        <div class="debug-light-card mb-3">
            <div class="debug-grid mb-2">
                <span>WAL</span><span></span><span></span><input class="debug-color-input" type="color" data-debug-color="venue.wallColor">
                <span>BAK</span><span></span><span></span><input class="debug-color-input" type="color" data-debug-color="venue.backWallColor">
                <span>CEL</span><span></span><span></span><input class="debug-color-input" type="color" data-debug-color="venue.ceilingColor">
                <span>TRM</span><span></span><span></span><input class="debug-color-input" type="color" data-debug-color="venue.trimColor">
                <span>SIG</span><span></span><span></span><input class="debug-color-input" type="color" data-debug-color="venue.signColor">
                <span>LGT</span><span></span><span></span><input class="debug-color-input" type="color" data-debug-color="venue.lightColor">
            </div>
            <input class="debug-value-input mb-2" data-debug-text="venue.textLeft" placeholder="Left wall text">
            <input class="debug-value-input mb-2" data-debug-text="venue.textRight" placeholder="Right wall text">
            <input class="debug-value-input" data-debug-text="venue.textBack" placeholder="Back wall text">
        </div>
        <div class="flex items-center justify-between mb-2">
            <div class="text-yellow-300">LIGHTING</div>
            <button class="debug-mini-btn" data-debug-light-action="add" data-type="point">ADD LIGHT</button>
        </div>
        <div id="debug-lights" class="mb-3"></div>
        <div class="grid grid-cols-2 gap-2 mb-3">
            <button class="debug-action" data-debug-action="save">SAVE</button>
            <button class="debug-action" data-debug-action="copy">COPY JSON</button>
            <button class="debug-action" data-debug-action="capture-camera">CAPTURE CAM</button>
            <button class="debug-action" data-debug-action="capture-target">CAPTURE LOOK</button>
            <button class="debug-action" data-debug-action="reset">RESET</button>
        </div>
        <textarea id="debug-export" readonly></textarea>
        <div class="text-slate-400 mt-2">F1 or backquote toggles. Values save to localStorage and export here.</div>
    `;
    panel.addEventListener('click', (event) => event.stopPropagation());
    panel.addEventListener('pointerdown', (event) => event.stopPropagation());
    panel.addEventListener('input', (event) => {
        const key = event.target?.dataset?.debugToggle;
        const inputPath = event.target?.dataset?.debugInput;
        const colorPath = event.target?.dataset?.debugColor;
        const textPath = event.target?.dataset?.debugText;
        const lightTypeIndex = event.target?.dataset?.debugLightType;
        const lightEnabledIndex = event.target?.dataset?.debugLightEnabled;
        const lightShadowIndex = event.target?.dataset?.debugLightShadow;
        const materialTexture = event.target?.dataset?.debugMaterialTexture;
        const objectTexture = event.target?.dataset?.debugObjectTexture;
        const nodeVisible = event.target?.dataset?.debugNodeVisible;
        if (key) {
            setByPath(debugState.config, key, event.target.checked);
            handleDebugConfigEdit(key);
            return;
        }
        if (inputPath) {
            let value = Number(event.target.value);
            if (!Number.isFinite(value)) return;
            value = clampDebugValue(inputPath, value);
            if (event.target.dataset.min !== undefined) value = Math.max(Number(event.target.dataset.min), value);
            if (event.target.dataset.max !== undefined) value = Math.min(Number(event.target.dataset.max), value);
            setByPath(debugState.config, inputPath, Number(value.toFixed(3)));
            handleDebugConfigEdit(inputPath);
            return;
        }
    if (colorPath) {
        setByPath(debugState.config, colorPath, event.target.value);
        handleDebugConfigEdit(colorPath);
        return;
    }
    if (textPath) {
        setByPath(debugState.config, textPath, event.target.value);
        handleDebugConfigEdit(textPath);
        updateDebugPanel();
        return;
    }
        if (lightTypeIndex !== undefined) {
            const index = Number(lightTypeIndex);
            debugState.config.lighting.lights[index].type = event.target.value;
            debugState.config.lighting.lights[index] = normalizeLightConfig(debugState.config.lighting.lights[index], index);
            buildSceneLighting();
            renderDebugLightEditor();
            applyDebugPlacement();
            return;
        }
        if (lightEnabledIndex !== undefined) {
            debugState.config.lighting.lights[Number(lightEnabledIndex)].enabled = event.target.checked;
            handleDebugConfigEdit('lighting.lights');
            return;
        }
        if (lightShadowIndex !== undefined) {
            debugState.config.lighting.lights[Number(lightShadowIndex)].castShadow = event.target.checked;
            buildSceneLighting();
            applyDebugPlacement();
            return;
        }
        if (materialTexture) {
            debugState.config.materialOverrides[materialTexture].texture = event.target.value;
            applyAlleyMaterialSettings();
            updateDebugPanel();
        }
        if (objectTexture) {
            debugState.config.objectOverrides[objectTexture].texture = event.target.value;
            applyAlleyMaterialSettings();
            updateDebugPanel();
        }
        if (nodeVisible) {
            debugState.config.nodeVisibility[nodeVisible] = event.target.checked;
            applyAlleyNodeVisibility();
            updateDebugPanel();
        }
    });
    panel.addEventListener('click', async (event) => {
        const adjust = event.target?.dataset?.debugAdjust;
        const action = event.target?.dataset?.debugAction;
        const lightAction = event.target?.dataset?.debugLightAction;
        const objectRemove = event.target?.dataset?.debugObjectRemove;
        if (objectRemove) {
            delete debugState.config.objectOverrides[objectRemove];
            applyAlleyMaterialSettings();
            renderDebugObjectEditor();
            applyDebugPlacement();
            return;
        }
        if (adjust) {
            const current = Number(getByPath(debugState.config, adjust));
            const delta = Number(event.target.dataset.delta);
            const min = event.target.dataset.min === undefined ? null : Number(event.target.dataset.min);
            const max = event.target.dataset.max === undefined ? null : Number(event.target.dataset.max);
            let next = clampDebugValue(adjust, current + delta);
            if (min !== null) next = Math.max(min, next);
            if (max !== null) next = Math.min(max, next);
            setByPath(debugState.config, adjust, Number(next.toFixed(3)));
            handleDebugConfigEdit(adjust);
            return;
        }
        if (lightAction) {
            const index = Number(event.target.dataset.index);
            if (lightAction === 'add') {
                debugState.config.lighting.lights.push(newDebugLight(event.target.dataset.type || 'point'));
            } else if (lightAction === 'duplicate') {
                const copy = clonePlain(debugState.config.lighting.lights[index]);
                copy.id = `custom-${Date.now()}-${index}`;
                copy.name = `${copy.name} Copy`;
                debugState.config.lighting.lights.splice(index + 1, 0, normalizeLightConfig(copy, index + 1));
            } else if (lightAction === 'delete') {
                debugState.config.lighting.lights.splice(index, 1);
            }
            buildSceneLighting();
            renderDebugLightEditor();
            applyDebugPlacement();
            return;
        }
        if (!action) return;
        if (action === 'close') toggleDebugMode(false);
        if (action === 'save') saveDebugPlacement();
        if (action === 'copy') await copyDebugExport();
        if (action === 'apply-materials') {
            applyAlleyMaterialSettings();
            updateDebugPanel();
        }
        if (action === 'show-all-nodes') {
            modelState.alleyMeshes.forEach((mesh) => {
                debugState.config.nodeVisibility[mesh.name] = true;
            });
            applyAlleyNodeVisibility();
            renderDebugNodeEditor();
            updateDebugPanel();
        }
        if (action === 'restore-default-nodes') {
            debugState.config.nodeVisibility = {};
            applyAlleyNodeVisibility();
            renderDebugNodeEditor();
            updateDebugPanel();
        }
        if (action === 'add-object-override') {
            const select = debugState.panel.querySelector('#debug-object-source');
            const meshName = select?.value;
            if (meshName) {
                debugState.config.objectOverrides[meshName] = objectOverrideBase(meshName);
                applyAlleyMaterialSettings();
                renderDebugObjectEditor();
                applyDebugPlacement();
            }
        }
        if (action === 'capture-camera') {
            debugState.config.camera.position = {
                x: Number(camera.position.x.toFixed(3)),
                y: Number(camera.position.y.toFixed(3)),
                z: Number(camera.position.z.toFixed(3))
            };
            applyDebugPlacement();
        }
        if (action === 'capture-target') {
            const forward = new THREE.Vector3(0, 0, -8).applyQuaternion(camera.quaternion).add(camera.position);
            debugState.config.camera.target = {
                x: Number(forward.x.toFixed(3)),
                y: Number(forward.y.toFixed(3)),
                z: Number(forward.z.toFixed(3))
            };
            applyDebugPlacement();
        }
        if (action === 'reset') {
            localStorage.removeItem(DEBUG_STORAGE_KEY);
            debugState.config = ensureDebugLightingConfig(clonePlain(DEFAULT_DEBUG_CONFIG));
            debugState.hasSavedConfig = false;
            buildSceneLighting();
            renderDebugMaterialEditor();
            renderDebugObjectEditor();
            renderDebugNodeEditor();
            renderDebugLightEditor();
            rebuildLaneFromDebug();
            if (physicalPins.length) generatePinGrid(GAME.frame);
            applyDebugPlacement();
        }
    });
    document.body.appendChild(panel);
    debugState.panel = panel;
    renderDebugMaterialEditor();
    renderDebugObjectEditor();
    renderDebugNodeEditor();
    renderDebugLightEditor();
    updateDebugPanel();
}

function saveDebugPlacement() {
    debugState.config.version = DEBUG_CONFIG_VERSION;
    ensureDebugLightingConfig(debugState.config);
    localStorage.setItem(DEBUG_STORAGE_KEY, JSON.stringify(debugState.config, null, 2));
    debugState.hasSavedConfig = true;
    updateDebugPanel();
}

async function copyDebugExport() {
    const text = debugExportPayload();
    try {
        await navigator.clipboard.writeText(text);
    } catch (error) {
        console.warn('Clipboard copy failed; select the debug export textarea instead.', error);
    }
    updateDebugPanel();
}

function toggleDebugMode(forceState = null) {
    const next = forceState === null ? !debugState.active : forceState;
    if (next === debugState.active) return;
    debugState.active = next;
    if (!debugState.panel) createDebugPanel();
    debugState.panel.classList.toggle('hidden', !debugState.active);

    if (debugState.active) {
        document.body.classList.add('debug-mode');
        debugState.previousPaused = GAME.paused;
        GAME.paused = true;
        sfx.stopBallRoll();
        applyDebugPlacement();
        applyDebugCamera();
        syncDebugAnglesFromConfig();
    } else {
        document.body.classList.remove('debug-mode');
        if (document.pointerLockElement === renderer?.domElement) document.exitPointerLock();
        debugState.flyKeys = {};
        GAME.paused = debugState.previousPaused;
        updateDebugHelpers();
        if (!debugState.config.useDebugCamera && GAME.state === 'MAIN_METER') setPreRollCamera();
    }
}

function loadGLB(path) {
    if (!modelState.loader) {
        if (!THREE.GLTFLoader) {
            console.warn('GLTFLoader unavailable; falling back to procedural models.');
            return Promise.reject(new Error('GLTFLoader unavailable'));
        }
        modelState.loader = new THREE.GLTFLoader();
    }
    return new Promise((resolve, reject) => {
        modelState.loader.load(path, resolve, undefined, reject);
    });
}

async function loadModelAssets() {
    // The expanding arena and hero objects are authored at their actual world
    // scale. The legacy imported venue remains available through the debug toggle.
    if (debugState.config.showAlley) {
        try { installAlleyModel((await loadGLB(MODEL_ASSETS.alleyMedium)).scene); }
        catch (error) { console.warn('Optional imported venue could not load.', error); }
    }
    modelState.ready = true;
    updateLoading('LANE READY', 4);
}

let modelAssetsReady = null;

function installAlleyModel(alleyScene) {
    if (modelState.alley) {
        scene.remove(modelState.alley);
    }

    const alley = cloneModel(alleyScene);
    alley.traverse((child) => {
        if (/^BowlingPin(\.|$)|_pin_0$|^bowling_pins/i.test(child.name)) {
            child.visible = false;
        }
    });
    applyConvertedAlleyTextures(alley);
    optimizeAlleyModel(alley);
    collectAlleyMeshes(alley);

    scene.add(alley);
    modelState.alley = alley;

    if (!debugState.hasSavedConfig) {
        debugState.config.alley = clonePlain(DEFAULT_DEBUG_CONFIG.alley);
    }
    debugState.config.showProcedural = false;
    applyDebugPlacement();
}

function createPinVisual(type, pinRadius, pinHeight) {
    if (presentation) return presentation.createPin(type, pinRadius, pinHeight, type === PIN_TYPES.STANDARD);
    if (modelState.pinTemplate) {
        const { group, model } = fittedModelGroup(modelState.pinTemplate, { height: pinHeight, centerY: 0 }, (visual) => {
            const rot = pinVisualRotation();
            visual.rotation.set(
                THREE.MathUtils.degToRad(rot.x),
                THREE.MathUtils.degToRad(rot.y),
                THREE.MathUtils.degToRad(rot.z)
            );
        });
        model.traverse((child) => {
            if (!child.isMesh) return;
            if (child.material) {
                child.material = child.material.clone();
                child.material.roughness = Math.max(child.material.roughness ?? 0.34, 0.38);
                child.material.metalness = Math.min(child.material.metalness ?? 0.02, 0.03);
                if ('envMapIntensity' in child.material) child.material.envMapIntensity = 0.32;
            }
            if (type !== PIN_TYPES.STANDARD && child.material) {
                child.material.color.setHex(type.color);
                child.material.emissive = new THREE.Color(type.color);
                child.material.emissiveIntensity = type === PIN_TYPES.GOLD ? 0.08 : 0.18;
            }
        });
        return group;
    }

    const pinGroup = new THREE.Group();
    const bodyGeo = new THREE.CylinderGeometry(pinRadius * 0.42, pinRadius, pinHeight * 0.82, 12);
    const mainMat = new THREE.MeshStandardMaterial({
        color: type.color,
        roughness: 0.22,
        metalness: type === PIN_TYPES.GOLD ? 0.45 : 0.04,
        emissive: type === PIN_TYPES.EXPLOSIVE ? 0x2a0505 : type === PIN_TYPES.IMPLOSIVE ? 0x1d0b32 : 0x000000,
        emissiveIntensity: type === PIN_TYPES.STANDARD ? 0 : 0.18
    });
    const pinBodyMesh = new THREE.Mesh(bodyGeo, mainMat);
    pinBodyMesh.position.y = -pinHeight * 0.05;
    pinBodyMesh.castShadow = true;
    pinGroup.add(pinBodyMesh);

    const headGeo = new THREE.SphereGeometry(pinRadius * 0.54, 16, 12);
    const headMesh = new THREE.Mesh(headGeo, mainMat);
    headMesh.position.y = pinHeight * 0.42;
    headMesh.castShadow = true;
    pinGroup.add(headMesh);

    const stripeGeo = new THREE.CylinderGeometry(pinRadius * 0.43, pinRadius * 0.43, 0.09, 16);
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.2, emissive: 0x220000 });
    const stripeMesh = new THREE.Mesh(stripeGeo, stripeMat);
    stripeMesh.position.y = pinHeight * 0.23;
    pinGroup.add(stripeMesh);
    return pinGroup;
}

function createReflectionClone(source) {
    if (!debugState.config.reflections.enabled) return null;
    const clone = source.clone(true);
    clone.userData.excludeFromPlanarReflection = true;
    clone.traverse((child) => {
        if (!child.isMesh) return;
        presentation?.retainGeometry(child);
        child.castShadow = false;
        const sourceMaterial = child.material;
        const color = sourceMaterial?.color ? sourceMaterial.color.clone() : new THREE.Color(0xffffff);
        child.material = new THREE.MeshBasicMaterial({
            color,
            map: sourceMaterial?.map || null,
            transparent: true,
            opacity: debugState.config.reflections.opacity,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        child.renderOrder = -1;
    });
    clone.scale.y *= -1;
    clone.visible = Boolean(debugState.config.reflections.enabled);
    scene.add(clone);
    reflectionObjects.push(clone);
    return clone;
}

function updateReflectionClone(source, reflection) {
    if (!source || !reflection) return;
    const cfg = debugState.config.reflections || DEFAULT_DEBUG_CONFIG.reflections;
    const floorY = Number(cfg.floorY ?? laneOrigin().y);
    syncReflectionClone(source, reflection, cfg, floorY);
}

function updatePinReflections() {
    physicalPins.forEach((pin) => updateReflectionClone(pin.mesh, pin.reflection));
}

function clearMegaLaneVisual() {
    const materials = new Set();
    megaLaneObjects.forEach((object) => {
        if (object.parent) object.parent.remove(object);
        if (object.geometry) object.geometry.dispose();
        if (Array.isArray(object.material)) {
            object.material.forEach((material) => materials.add(material));
        } else if (object.material) {
            materials.add(object.material);
        }
    });
    materials.forEach((material) => material.dispose?.());
    megaLaneObjects = [];
}

function clearPinDeckWallVisuals() {
    const materials = new Set();
    pinDeckWallObjects.forEach((object) => {
        if (object.parent) object.parent.remove(object);
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
            if (Array.isArray(object.material)) object.material.forEach(mat => materials.add(mat));
            else materials.add(object.material);
        }
    });
    materials.forEach(mat => mat.dispose?.());
    pinDeckWallObjects = [];
}

function clearGutterVisuals() {
    const materials = new Set();
    gutterObjects.forEach((object) => {
        if (object.parent) object.parent.remove(object);
        if (object.geometry) object.geometry.dispose();
        if (object.material) {
            if (Array.isArray(object.material)) object.material.forEach(mat => materials.add(mat));
            else materials.add(object.material);
        }
    });
    materials.forEach(mat => mat.dispose?.());
    gutterObjects = [];
}

function clearLanePolishObjects() {
    lanePolishObjects.forEach((object) => {
        if (object.parent) object.parent.remove(object);
        if (object.geometry) object.geometry.dispose();
        if (object.material) object.material.dispose();
    });
    lanePolishObjects = [];
}

function setMegaLaneVisible(visible) {
    presentation?.setVisible(visible);
    megaLaneObjects.forEach((object) => {
        object.visible = visible;
    });
    lanePolishObjects.forEach((object) => {
        object.visible = visible;
    });
    gutterObjects.forEach((object) => {
        object.visible = visible;
    });
}

function updateLanePolish(dt) {
    if (!lanePolishObjects.length) return;
    lanePolishObjects.forEach((object) => {
        if (object.material?.uniforms?.time) object.material.uniforms.time.value += dt;
        if (object.userData.polishPulse !== undefined && object.material) {
            const pulse = Math.sin(clock.elapsedTime * 1.25 + object.userData.polishPulse) * 0.5 + 0.5;
            object.material.opacity = object.userData.baseOpacity * (0.62 + pulse * 0.54);
        }
        if (object.userData.sweepVelocity && object.material) {
            if (!object.userData.sweepActive) {
                object.material.opacity = 0;
                return;
            }
            object.position.z += object.userData.sweepVelocity * dt;
            if (object.position.z < object.userData.sweepEndZ) {
                object.userData.sweepActive = false;
                object.material.opacity = 0;
                return;
            }
            const travel = THREE.MathUtils.clamp((object.position.z - object.userData.sweepEndZ) / (object.userData.sweepStartZ - object.userData.sweepEndZ), 0, 1);
            object.material.opacity = object.userData.baseOpacity * Math.sin(travel * Math.PI);
        }
    });
}

function updateLaneDecorationLife() {
    ceilingLightObjects.forEach((object, index) => {
        if (!object.material) return;
        const pulse = Math.sin(clock.elapsedTime * 2.1 + index * 0.8) * 0.5 + 0.5;
        object.material.emissive?.setHex(0x1f1708);
        object.material.emissiveIntensity = 0.08 + pulse * 0.08;
    });
    laneDecorationObjects.forEach((object, index) => {
        if (object.userData.lightShaft && object.material) {
            const pulse = Math.sin(clock.elapsedTime * 1.35 + index * 0.55) * 0.5 + 0.5;
            object.material.opacity = object.userData.baseOpacity * (0.74 + pulse * 0.26);
            return;
        }
        if (object.userData.lightPool && object.material) {
            const pulse = Math.sin(clock.elapsedTime * 1.1 + index * 0.42) * 0.5 + 0.5;
            object.material.opacity = object.userData.baseOpacity * (0.68 + pulse * 0.32);
            return;
        }
        if (!object.userData.floatMote) return;
        const base = object.userData.basePosition;
        const t = clock.elapsedTime * object.userData.driftSpeed + index;
        const driftX = Math.sin(t * 0.73) * object.userData.driftAmount;
        const driftY = Math.sin(t * 0.41 + index * 0.33) * object.userData.driftAmount * 0.7;
        const driftZ = Math.cos(t * 0.58) * object.userData.driftAmount * 1.25;
        object.position.set(base.x + driftX, base.y + driftY, base.z + driftZ);
        if (object.material) {
            object.material.opacity = object.userData.baseOpacity * (0.48 + 0.52 * (Math.sin(t * 0.9) * 0.5 + 0.5));
        }
    });
}

function makeRepeatedTexture(path, repeatX, repeatY, rotationDeg = 0) {
    const source = convertedAlleyTexture(path);
    const texture = source.clone();
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(Math.max(0.1, repeatX), Math.max(0.1, repeatY));
    texture.center.set(0.5, 0.5);
    texture.rotation = THREE.MathUtils.degToRad(Number(rotationDeg || 0));
    texture.encoding = THREE.sRGBEncoding;
    texture.needsUpdate = true;
    return texture;
}

function buildMegaLaneVisual(laneWidth = LANE.currentWidth) {
    clearMegaLaneVisual();
    clearLanePolishObjects();
    if (presentation) {
        presentation.rebuild({
            width: laneWidth, length: laneLength(), origin: laneOrigin(),
            pins: currentRackLayout().points.length, frame: GAME.frame,
            approachLength: currentLaneDimensions().approachLength,
            cameraBack: laneCameraDistance(laneWidth, camera.aspect, camera.fov),
            route: GAME.mode === 'roguelike' ? GAME.currentRoute : null, stage: GAME.stage
        });
        presentation.setVisible(debugState.config.showMegaLane);
        return;
    }
    const cfg = debugState.config.megaLane || DEFAULT_DEBUG_CONFIG.megaLane;
    if (!cfg.enabled) return;

    const origin = laneOrigin();
    const length = laneLength() + Number(cfg.lengthPadding || 0);
    const visualWidth = laneWidth + Number(cfg.widthPadding || 0) * 2;
    const z = origin.z + Number(cfg.zOffset || 0);
    const y = origin.y + Number(cfg.yOffset || 0.075);
    const gutterWidth = Math.max(0, Number(cfg.gutterWidth || 0.72));
    const railWidth = Math.max(0, Number(cfg.railWidth || 0.2));
    const railHeight = Math.max(0.02, Number(cfg.railHeight || 0.18));
    const edgeBoardWidth = Math.max(0, Number(cfg.edgeBoardWidth || 0.32));

    const woodMap = makeRepeatedTexture(
        CONVERTED_ALLEY_TEXTURES.Light_Wood,
        Math.max(0.1, Number(cfg.woodRepeatX || 0.42) * visualWidth),
        Math.max(0.1, Number(cfg.woodRepeatZ || 4.6)),
        Number(cfg.woodRotation || 0)
    );
    const laneMat = new THREE.MeshStandardMaterial({
        color: 0xfff0ca,
        map: woodMap,
        bumpMap: woodMap,
        bumpScale: 0.006,
        roughness: THREE.MathUtils.clamp(Number(cfg.roughness ?? 0.18), 0.08, 1),
        metalness: 0.01,
        envMap: modelState.reflectionMap,
        envMapIntensity: Number(cfg.envMapIntensity ?? 1.05)
    });
    const lane = new THREE.Mesh(new THREE.PlaneGeometry(visualWidth, length), laneMat);
    lane.name = 'modular-mega-lane-surface';
    lane.rotation.x = -Math.PI / 2;
    lane.position.set(origin.x, y, z);
    lane.receiveShadow = true;
    scene.add(lane);
    megaLaneObjects.push(lane);
    buildLanePolishOverlay(visualWidth, length, y, z);

    const laneEdgeGlowMat = new THREE.MeshBasicMaterial({
        color: 0x8bd4e6,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    [-1, 1].forEach((side, index) => {
        const strip = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.035, length * 0.84), laneEdgeGlowMat.clone());
        strip.name = `coded-lane-edge-accent-${side}`;
        strip.position.set(origin.x + side * (visualWidth / 2 - 0.08), y + 0.045, z - length * 0.02);
        strip.renderOrder = 6;
        strip.userData.polishPulse = index * 1.4;
        strip.userData.baseOpacity = side < 0 ? 0.08 : 0.11;
        strip.userData.excludeFromPlanarReflection = true;
        scene.add(strip);
        lanePolishObjects.push(strip);
    });

    const edgeMap = makeRepeatedTexture(CONVERTED_ALLEY_TEXTURES.Dark_Wood, 1.2, Math.max(1, Number(cfg.woodRepeatZ || 4.6)), Number(cfg.woodRotation || 0));
    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: edgeMap, bumpMap: edgeMap, bumpScale: 0.018, roughness: 0.38, metalness: 0.01, envMap: modelState.reflectionMap, envMapIntensity: 0.22 });

    [-1, 1].forEach((side) => {
        const edge = new THREE.Mesh(new THREE.BoxGeometry(edgeBoardWidth, 0.08, length), edgeMat);
        edge.name = `modular-mega-lane-edge-${side}`;
        edge.position.set(origin.x + side * (visualWidth / 2 + gutterWidth + railWidth + edgeBoardWidth / 2), y - 0.03, z);
        scene.add(edge);
        megaLaneObjects.push(edge);
    });

    const foulMat = new THREE.MeshBasicMaterial({ color: 0x2b1e20 });
    const foulLine = new THREE.Mesh(new THREE.BoxGeometry(visualWidth * 0.92, 0.006, 0.085), foulMat);
    foulLine.name = 'modular-mega-lane-foul-line';
    foulLine.position.set(origin.x, y + 0.012, laneStartZ());
    scene.add(foulLine);
    megaLaneObjects.push(foulLine);

    const plankMat = new THREE.MeshBasicMaterial({ color: 0x4a2a13, transparent: true, opacity: 0.24 });
    const plankSpacing = Math.max(0.1, Number(cfg.plankSpacing || 0.42));
    for (let x = -visualWidth / 2 + plankSpacing; x < visualWidth / 2 - 0.01; x += plankSpacing) {
        const line = new THREE.Mesh(new THREE.PlaneGeometry(0.018, length), plankMat);
        line.name = 'modular-mega-lane-plank-line';
        line.rotation.x = -Math.PI / 2;
        line.position.set(origin.x + x, y + 0.004, z);
        scene.add(line);
        megaLaneObjects.push(line);
    }

    if (cfg.endWallEnabled !== false) {
        const wallWidth = visualWidth + gutterWidth * 2 + railWidth * 2 + edgeBoardWidth * 2 + Number(cfg.endWallExtraWidth || 1.6);
        const wallZ = origin.z + Number(cfg.endWallZOffset ?? (-laneLength() / 2 - 1.7));
        const wallY = Number(cfg.endWallY ?? 4.2);
        const wallHeight = Math.max(1, Number(cfg.endWallHeight || 5.6));
        const wallDepth = Math.max(0.05, Number(cfg.endWallDepth || 0.18));
        const woodHeight = Math.min(wallHeight, Math.max(0.5, Number(cfg.endWallWoodHeight || 2.75)));
        const signHeight = Math.min(wallHeight - woodHeight, Math.max(0.4, Number(cfg.endWallSignHeight || 1.7)));
        const blackHeight = Math.max(0.1, wallHeight - woodHeight);
        const wallWoodMap = makeRepeatedTexture(CONVERTED_ALLEY_TEXTURES.Light_Wood, Math.max(1, wallWidth * 0.55), 1.15, 0);
        const wallWoodMat = new THREE.MeshStandardMaterial({ color: 0xd1a060, map: wallWoodMap, bumpMap: wallWoodMap, bumpScale: 0.02, roughness: 0.62, metalness: 0.01, envMap: modelState.reflectionMap, envMapIntensity: 0.08 });
        const wallBlackMat = new THREE.MeshStandardMaterial({ color: 0x030303, roughness: 0.66, metalness: 0.02, envMap: modelState.reflectionMap, envMapIntensity: 0.14 });
        const signMat = new THREE.MeshStandardMaterial({ color: 0x020202, emissive: 0x000c0b, emissiveIntensity: 0.08, roughness: 0.64, metalness: 0.02 });
        const woodBand = new THREE.Mesh(new THREE.BoxGeometry(wallWidth, woodHeight, wallDepth), wallWoodMat);
        woodBand.name = 'modular-mega-lane-end-wall-wood';
        woodBand.position.set(origin.x, wallY, wallZ);
        scene.add(woodBand);
        megaLaneObjects.push(woodBand);

        const blackBand = new THREE.Mesh(new THREE.BoxGeometry(wallWidth, blackHeight, wallDepth), wallBlackMat);
        blackBand.name = 'modular-mega-lane-end-wall-black';
        blackBand.position.set(origin.x, wallY + woodHeight / 2 + blackHeight / 2, wallZ);
        scene.add(blackBand);
        megaLaneObjects.push(blackBand);

        const signBand = new THREE.Mesh(new THREE.BoxGeometry(wallWidth * 0.58, signHeight, wallDepth + 0.02), signMat);
        signBand.name = 'modular-mega-lane-end-wall-sign';
        signBand.position.set(origin.x, wallY + woodHeight + signHeight * 0.5, wallZ + 0.02);
        scene.add(signBand);
        megaLaneObjects.push(signBand);
    }

    if (cfg.sideWallEnabled !== false) {
        const sideHeight = Math.max(1, Number(cfg.sideWallHeight || 7.5));
        const sideDepth = Math.max(10, Number(cfg.sideWallDepth || length));
        const sideY = Number(cfg.sideWallY || 3.8);
        const sidePadding = Number(cfg.sideWallPadding || 1.2);
        const sideWallMat = new THREE.MeshStandardMaterial({ color: 0x0b0615, roughness: 0.72, metalness: 0.01, envMap: modelState.reflectionMap, envMapIntensity: 0.05 });
        [-1, 1].forEach((side) => {
            const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.24, sideHeight, sideDepth), sideWallMat);
            sideWall.name = `modular-mega-lane-side-wall-${side}`;
            sideWall.position.set(origin.x + side * (visualWidth / 2 + gutterWidth + railWidth + edgeBoardWidth + sidePadding), sideY, z);
            scene.add(sideWall);
            megaLaneObjects.push(sideWall);
        });
    }

    setMegaLaneVisible(Boolean(debugState.config.showMegaLane));
}

function buildLanePolishOverlay(visualWidth, length, y, z) {
    const origin = laneOrigin();
    const polishMat = new THREE.ShaderMaterial({
        uniforms: {
            time: { value: 0 },
            opacity: { value: isNativeMobilePlatform() ? 0.045 : 0.065 },
            laneWidth: { value: visualWidth },
            laneLength: { value: length }
        },
        vertexShader: `
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform float time;
            uniform float opacity;
            varying vec2 vUv;
            float stripe(float x, float center, float width) {
                return smoothstep(width, 0.0, abs(x - center));
            }
            void main() {
                float laneFade = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
                float depthFade = smoothstep(0.02, 0.24, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
                float oil = sin((vUv.y * 9.0) + sin(vUv.x * 7.0) * 0.8 + time * 0.12) * 0.5 + 0.5;
                oil *= 0.1 + 0.45 * smoothstep(0.16, 0.72, vUv.y);
                float centerSheen = stripe(vUv.x, 0.54 + sin(time * 0.12) * 0.018, 0.18);
                float sideFalloff = smoothstep(0.0, 0.3, vUv.x) * smoothstep(1.0, 0.7, vUv.x);
                vec3 amber = vec3(1.0, 0.72, 0.34);
                vec3 color = amber * (centerSheen * 0.12 + oil * 0.045);
                float alpha = (centerSheen * 0.08 + oil * 0.04) * opacity * laneFade * depthFade * sideFalloff;
                gl_FragColor = vec4(color, alpha);
            }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const polish = new THREE.Mesh(new THREE.PlaneGeometry(visualWidth * 0.96, length * 0.98), polishMat);
    polish.name = 'coded-lane-oil-sheen';
    polish.rotation.x = -Math.PI / 2;
    polish.position.set(origin.x, y + 0.028, z);
    polish.renderOrder = 4;
    polish.userData.polishAnimated = true;
    polish.userData.excludeFromPlanarReflection = true;
    scene.add(polish);
    lanePolishObjects.push(polish);

    const sweepMat = new THREE.MeshBasicMaterial({
        color: 0xffd36a,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    const sweep = new THREE.Mesh(new THREE.PlaneGeometry(visualWidth * 0.54, 0.12), sweepMat);
    sweep.name = 'coded-rack-loaded-sweep';
    sweep.rotation.x = -Math.PI / 2;
    sweep.position.set(origin.x, y + 0.045, origin.z - laneLength() / 2 + 9);
    sweep.renderOrder = 8;
    sweep.userData.sweepVelocity = -7.4;
    sweep.userData.sweepStartZ = origin.z - laneLength() / 2 + 9;
    sweep.userData.sweepEndZ = origin.z - laneLength() / 2 + 2.4;
    sweep.userData.sweepActive = false;
    sweep.userData.baseOpacity = 0.24;
    sweep.userData.excludeFromPlanarReflection = true;
    scene.add(sweep);
    lanePolishObjects.push(sweep);

    const markerMat = new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        transparent: true,
        opacity: 0.42,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });
    const arrowShape = new THREE.Shape();
    arrowShape.moveTo(0, 0.36);
    arrowShape.lineTo(0.18, -0.18);
    arrowShape.lineTo(0, -0.06);
    arrowShape.lineTo(-0.18, -0.18);
    arrowShape.lineTo(0, 0.36);
    const arrowGeo = new THREE.ShapeGeometry(arrowShape);
    [-0.92, -0.46, 0, 0.46, 0.92].forEach((xOffset, index) => {
        const arrow = new THREE.Mesh(arrowGeo, markerMat.clone());
        arrow.name = 'coded-lane-emissive-arrow';
        arrow.rotation.x = -Math.PI / 2;
        arrow.rotation.z = 0;
        arrow.scale.setScalar(0.86);
        arrow.position.set(origin.x + xOffset, y + 0.05, origin.z + laneLength() / 2 - 9.4);
        arrow.renderOrder = 7;
        arrow.userData.polishPulse = index * 0.55;
        arrow.userData.baseOpacity = 0.18;
        arrow.userData.excludeFromPlanarReflection = true;
        scene.add(arrow);
        lanePolishObjects.push(arrow);
    });

    const signGlowMat = new THREE.MeshBasicMaterial({
        color: 0xffc45c,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });
    const triangle = new THREE.Shape();
    triangle.moveTo(0, -0.62);
    triangle.lineTo(0.72, 0.42);
    triangle.lineTo(-0.72, 0.42);
    triangle.lineTo(0, -0.62);
    const signGeo = new THREE.ShapeGeometry(triangle);
    [-3.1, -1.55, 0, 1.55, 3.1].forEach((xOffset, index) => {
        const sign = new THREE.Mesh(signGeo, signGlowMat.clone());
        sign.name = 'coded-back-wall-triangle-glow';
        sign.position.set(origin.x + xOffset, origin.y + 4.78, origin.z - laneLength() / 2 - 1.46);
        sign.scale.setScalar(0.9);
        sign.userData.polishPulse = index * 0.7;
        sign.userData.baseOpacity = 0.11;
        sign.userData.excludeFromPlanarReflection = true;
        scene.add(sign);
        lanePolishObjects.push(sign);
    });

    const returnLightMat = new THREE.MeshBasicMaterial({
        color: 0x38d9ff,
        transparent: true,
        opacity: 0.22,
        depthWrite: false,
        blending: THREE.AdditiveBlending
    });
    [-1, 1].forEach((side, index) => {
        const light = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 2.2), returnLightMat.clone());
        light.name = 'coded-ball-return-pulse';
        light.rotation.x = -Math.PI / 2;
        light.position.set(origin.x + side * (visualWidth * 0.62), y + 0.06, origin.z + laneLength() / 2 - 4.4);
        light.renderOrder = 8;
        light.userData.polishPulse = index * 1.3;
        light.userData.baseOpacity = 0.12;
        light.userData.excludeFromPlanarReflection = true;
        scene.add(light);
        lanePolishObjects.push(light);
    });
}

function gutterChannelMetrics(laneWidth = LANE.currentWidth) {
    const origin = laneOrigin();
    const megaCfg = debugState.config.megaLane || DEFAULT_DEBUG_CONFIG.megaLane;
    const useMega = megaCfg.enabled !== false;
    const visualWidth = laneWidth + (useMega ? Number(megaCfg.widthPadding || 0) * 2 : 0);
    const gutterWidth = Math.max(0.42, Number(megaCfg.gutterWidth || LANE.gutterWidth));
    const railWidth = Math.max(0.14, Number(megaCfg.railWidth || 0.2));
    const length = laneLength() + Math.max(0, Number(megaCfg.lengthPadding || 0));
    const endPadding = Math.max(4, Number(debugState.config.render?.ballKillZPadding ?? 4) + 8);
    const approachLength = currentLaneDimensions().approachLength;
    const physicsLength = length + endPadding + approachLength;
    const zOffset = useMega ? Number(megaCfg.zOffset || 0) : 0;
    const centerZ = origin.z + zOffset;
    const physicsCenterZ = centerZ + (approachLength - endPadding) / 2;
    const surfaceY = origin.y + (useMega ? Number(megaCfg.yOffset || 0.06) : 0.02);
    const floorHeight = 0.12;
    const floorTopY = origin.y - 0.32;
    const floorY = floorTopY - floorHeight / 2;
    const outerWallHeight = 0.46;
    const outerWallY = floorTopY + outerWallHeight / 2;
    return {
        origin,
        visualWidth,
        gutterWidth,
        railWidth,
        length,
        physicsLength,
        centerZ,
        physicsCenterZ,
        surfaceY,
        floorHeight,
        floorTopY,
        floorY,
        outerWallHeight,
        outerWallY
    };
}

function buildGutterChannels(laneWidth = LANE.currentWidth) {
    clearGutterVisuals();
    const metrics = gutterChannelMetrics(laneWidth);
    const gutterMat = new THREE.MeshStandardMaterial({
        color: 0x020204,
        roughness: 0.12,
        metalness: 0.65,
        envMap: modelState.reflectionMap,
        envMapIntensity: 0.45
    });
    const railMat = new THREE.MeshStandardMaterial({
        color: 0x03080d,
        roughness: 0.36,
        metalness: 0.15,
        envMap: modelState.reflectionMap,
        envMapIntensity: 0.25
    });
    const lipMat = new THREE.MeshStandardMaterial({
        color: 0x0a0704,
        roughness: 0.2,
        metalness: 0.08,
        envMap: modelState.reflectionMap,
        envMapIntensity: 0.75
    });

    [-1, 1].forEach((side) => {
        const gutterCenterX = metrics.origin.x + side * (metrics.visualWidth / 2 + metrics.gutterWidth / 2);
        const outerWallX = metrics.origin.x + side * (metrics.visualWidth / 2 + metrics.gutterWidth + metrics.railWidth / 2);
        const innerLipX = metrics.origin.x + side * (metrics.visualWidth / 2 + 0.035);

        const floorBody = new CANNON.Body({ mass: 0, material: MATERIALS.gutter });
        floorBody.addShape(new CANNON.Box(new CANNON.Vec3(metrics.gutterWidth / 2, metrics.floorHeight / 2, metrics.physicsLength / 2)));
        floorBody.position.set(gutterCenterX, metrics.floorY, metrics.physicsCenterZ);
        floorBody.userData = { role: 'gutterFloor' };
        world.addBody(floorBody);
        laneStaticBodies.push(floorBody);

        const wallBody = new CANNON.Body({ mass: 0, material: MATERIALS.gutter });
        wallBody.addShape(new CANNON.Box(new CANNON.Vec3(metrics.railWidth / 2, metrics.outerWallHeight / 2, metrics.physicsLength / 2)));
        wallBody.position.set(outerWallX, metrics.outerWallY, metrics.physicsCenterZ);
        wallBody.userData = { role: 'gutterOuterWall' };
        world.addBody(wallBody);
        laneStaticBodies.push(wallBody);

        const floor = new THREE.Mesh(new THREE.BoxGeometry(metrics.gutterWidth, metrics.floorHeight, metrics.length), gutterMat);
        floor.name = `mega-physical-gutter-floor-${side}`;
        floor.position.set(gutterCenterX, metrics.floorY, metrics.centerZ);
        floor.receiveShadow = true;
        scene.add(floor);
        gutterObjects.push(floor);

        const outerRail = new THREE.Mesh(new THREE.BoxGeometry(metrics.railWidth, metrics.outerWallHeight, metrics.length), railMat);
        outerRail.name = `mega-physical-gutter-outer-wall-${side}`;
        outerRail.position.set(outerWallX, metrics.outerWallY, metrics.centerZ);
        outerRail.castShadow = true;
        outerRail.receiveShadow = true;
        scene.add(outerRail);
        gutterObjects.push(outerRail);

        const innerLip = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.08, metrics.length), lipMat);
        innerLip.name = `mega-physical-gutter-inner-lip-${side}`;
        innerLip.position.set(innerLipX, metrics.surfaceY - 0.045, metrics.centerZ);
        scene.add(innerLip);
        gutterObjects.push(innerLip);
    });

    setMegaLaneVisible(Boolean(debugState.config.showMegaLane));
}

function clearVenueShell() {
    const materials = new Set();
    venueObjects.forEach((object) => {
        if (object.parent) object.parent.remove(object);
        if (object.geometry) object.geometry.dispose();
        if (Array.isArray(object.material)) {
            object.material.forEach((material) => materials.add(material));
        } else if (object.material) {
            materials.add(object.material);
        }
    });
    materials.forEach((material) => {
        if (material.map) material.map.dispose?.();
        material.dispose?.();
    });
    venueObjects = [];
}

function venueTextTexture(text, fg = '#ffffff', bg = 'rgba(0,0,0,0)') {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = '900 126px Arial Black, Impact, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 18;
    ctx.strokeStyle = '#2a0505';
    ctx.shadowColor = 'rgba(255,255,255,0.5)';
    ctx.shadowBlur = 18;
    ctx.strokeText(String(text || '').toUpperCase(), canvas.width / 2, canvas.height / 2 + 6);
    ctx.fillStyle = fg;
    ctx.fillText(String(text || '').toUpperCase(), canvas.width / 2, canvas.height / 2 + 6);
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.anisotropy = renderer?.capabilities ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
    return texture;
}

function addSideWallLetterSigns({ text, side, halfW, wallHeight, venueX, venueY, centerZ, depth, signColor, detailSpacing }) {
    const letters = String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6).split('');
    if (!letters.length) return;
    const sectionSpacing = Math.max(3.6, Number(detailSpacing || 6));
    const startZ = centerZ + 4;
    const minZ = centerZ - depth * 0.36;
    const x = venueX + side * (halfW - 0.34);
    letters.forEach((letter, index) => {
        const z = Math.max(minZ, startZ - index * sectionSpacing);
        const material = new THREE.MeshBasicMaterial({
            map: venueTextTexture(letter, signColor),
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide
        });
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.15, 3.05), material);
        sign.name = side < 0 ? 'venue-left-wall-letter' : 'venue-right-wall-letter';
        sign.position.set(x, wallHeight * 0.56 + venueY, z);
        sign.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        addVenueObject(sign);
    });
}

function venueGrimeTexture(baseColor, grit = 0.35, width = 512, height = 512) {
    const color = new THREE.Color(baseColor || '#8f1d1d');
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(width, height);
    const strength = THREE.MathUtils.clamp(Number(grit || 0), 0, 1);
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;
            const grain = (Math.random() - 0.5) * 82 * strength;
            const verticalWear = Math.sin(x * 0.055) * 18 * strength;
            const stain = Math.max(0, Math.sin((x + y * 0.35) * 0.024) - 0.35) * 42 * strength;
            const topSmoke = Math.max(0, 1 - y / height) * 36 * strength;
            const shade = grain + verticalWear - stain - topSmoke;
            image.data[i] = THREE.MathUtils.clamp(r + shade, 0, 255);
            image.data[i + 1] = THREE.MathUtils.clamp(g + shade, 0, 255);
            image.data[i + 2] = THREE.MathUtils.clamp(b + shade, 0, 255);
            image.data[i + 3] = 255;
        }
    }
    ctx.putImageData(image, 0, 0);
    ctx.fillStyle = `rgba(0,0,0,${0.16 * strength})`;
    for (let i = 0; i < 34 * strength; i++) {
        const x = Math.random() * width;
        const y = Math.random() * height;
        const w = 18 + Math.random() * 95;
        const h = 2 + Math.random() * 16;
        ctx.fillRect(x, y, w, h);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.encoding = THREE.sRGBEncoding;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    texture.anisotropy = renderer?.capabilities ? Math.min(8, renderer.capabilities.getMaxAnisotropy()) : 1;
    return texture;
}

function addVenueObject(object) {
    scene.add(object);
    venueObjects.push(object);
    return object;
}

function buildVenueShell() {
    if (presentation) return;
    clearVenueShell();
    const cfg = debugState.config.venue || DEFAULT_DEBUG_CONFIG.venue;
    if (cfg.enabled === false) return;

    const origin = laneOrigin();
    const offset = cfg.position || { x: 0, y: 0, z: 0 };
    const venueX = origin.x + Number(offset.x || 0);
    const venueY = Number(offset.y || 0);
    const width = Math.max(Number(cfg.width || 28), LANE.currentWidth + Number(cfg.widthPadding || 7.5) * 2);
    const depth = Math.max(30, Number(cfg.depth || 92));
    const centerZ = origin.z + Number(cfg.zOffset || 0) + Number(offset.z || 0);
    const wallHeight = Math.max(3, Number(cfg.wallHeight || 9.5));
    const ceilingY = Math.max(origin.y + 3, Number(cfg.ceilingY || 9.7) + venueY);
    const halfW = width / 2;
    const halfD = depth / 2;
    const wallY = wallHeight / 2 + venueY;
    const backZ = centerZ - halfD;
    const sideWallDepth = depth;

    const grit = THREE.MathUtils.clamp(Number(cfg.grit ?? 0.38), 0, 1);
    const wallTexture = venueGrimeTexture(cfg.wallColor || '#8f1d1d', grit);
    const backTexture = venueGrimeTexture(cfg.backWallColor || '#1b0b12', grit * 0.85);
    const ceilingTexture = venueGrimeTexture(cfg.ceilingColor || '#130913', grit * 0.75);
    const wallMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: wallTexture, bumpMap: wallTexture, bumpScale: 0.018, roughness: 0.84, metalness: 0.005, envMap: modelState.reflectionMap, envMapIntensity: 0.035 });
    const backMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: backTexture, bumpMap: backTexture, bumpScale: 0.014, roughness: 0.88, metalness: 0.005, envMap: modelState.reflectionMap, envMapIntensity: 0.03 });
    const ceilingMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: ceilingTexture, bumpMap: ceilingTexture, bumpScale: 0.01, roughness: 0.9, metalness: 0.005 });
    const trimMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(cfg.trimColor || '#f4efe1'), roughness: 0.72, metalness: 0.01, envMap: modelState.reflectionMap, envMapIntensity: 0.08 });
    const lightMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(cfg.lightColor || '#fff4d6'),
        emissive: new THREE.Color(cfg.lightColor || '#fff4d6'),
        emissiveIntensity: 1.2,
        roughness: 0.18,
        metalness: 0.02
    });

    const ceiling = new THREE.Mesh(new THREE.BoxGeometry(width, 0.22, depth), ceilingMat);
    ceiling.name = 'venue-ceiling';
    ceiling.position.set(venueX, ceilingY, centerZ);
    addVenueObject(ceiling);

    [-1, 1].forEach((side) => {
        const wall = new THREE.Mesh(new THREE.BoxGeometry(0.32, wallHeight, sideWallDepth), wallMat);
        wall.name = side < 0 ? 'venue-left-wall' : 'venue-right-wall';
        wall.position.set(venueX + side * halfW, wallY, centerZ);
        addVenueObject(wall);

        const base = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.32, sideWallDepth), trimMat);
        base.name = `${wall.name}-base-trim`;
        base.position.set(venueX + side * (halfW - 0.03), origin.y + 0.35 + venueY, centerZ);
        addVenueObject(base);

        const crown = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, sideWallDepth), trimMat);
        crown.name = `${wall.name}-crown-trim`;
        crown.position.set(venueX + side * (halfW - 0.03), ceilingY - 0.35, centerZ);
        addVenueObject(crown);
    });

    const backWall = new THREE.Mesh(new THREE.BoxGeometry(width, wallHeight, 0.32), backMat);
    backWall.name = 'venue-back-wall';
    backWall.position.set(venueX, wallY, backZ);
    addVenueObject(backWall);

    const detailSpacing = Math.max(2, Number(cfg.detailSpacing || 6));
    for (let x = -halfW + detailSpacing; x < halfW; x += detailSpacing) {
        const pilaster = new THREE.Mesh(new THREE.BoxGeometry(0.18, wallHeight * 0.72, 0.42), trimMat);
        pilaster.name = 'venue-back-wall-pilaster';
        pilaster.position.set(venueX + x, wallHeight * 0.48 + venueY, backZ + 0.23);
        addVenueObject(pilaster);
    }
    for (let z = centerZ - halfD + detailSpacing; z < centerZ + halfD - detailSpacing; z += detailSpacing) {
        [-1, 1].forEach((side) => {
            const rib = new THREE.Mesh(new THREE.BoxGeometry(0.42, wallHeight * 0.62, 0.16), trimMat);
            rib.name = 'venue-side-wall-rib';
            rib.position.set(venueX + side * (halfW - 0.24), wallHeight * 0.45 + venueY, z);
            addVenueObject(rib);
        });
    }

    const shadowOpacity = THREE.MathUtils.clamp(Number(cfg.cornerShadow ?? 0.42), 0, 0.9);
    const shadowMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: shadowOpacity, depthWrite: false });
    [-1, 1].forEach((side) => {
        const wallFloorShadow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, depth), shadowMat);
        wallFloorShadow.name = 'venue-side-floor-shadow';
        wallFloorShadow.position.set(venueX + side * (halfW - 0.32), origin.y + 0.11 + venueY, centerZ);
        addVenueObject(wallFloorShadow);
        const ceilingCornerShadow = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, depth), shadowMat.clone());
        ceilingCornerShadow.name = 'venue-side-ceiling-shadow';
        ceilingCornerShadow.position.set(venueX + side * (halfW - 0.32), ceilingY - 0.24, centerZ);
        addVenueObject(ceilingCornerShadow);
    });
    const backCornerShadow = new THREE.Mesh(new THREE.BoxGeometry(width, 0.12, 0.12), shadowMat.clone());
    backCornerShadow.name = 'venue-back-floor-shadow';
    backCornerShadow.position.set(venueX, origin.y + 0.12 + venueY, backZ + 0.28);
    addVenueObject(backCornerShadow);

    const rows = Math.max(1, Math.round(Number(cfg.lightRows || 7)));
    const spacing = Math.max(3, Number(cfg.lightSpacing || 8));
    const firstZ = centerZ + Math.min(halfD - 8, (rows - 1) * spacing * 0.5);
    for (let i = 0; i < rows; i++) {
        const z = firstZ - i * spacing;
        [-0.27, 0.27].forEach((xFactor) => {
            const panel = new THREE.Mesh(new THREE.BoxGeometry(width * 0.28, 0.06, 1.15), lightMat);
            panel.name = 'venue-ceiling-light-panel';
            panel.position.set(venueX + width * xFactor, ceilingY - 0.18, z);
            addVenueObject(panel);
        });
    }
    if (Number(cfg.lightIntensity || 0) > 0) {
        const light = new THREE.PointLight(new THREE.Color(cfg.lightColor || '#fff4d6'), Number(cfg.lightIntensity || 0.35), depth * 0.8, 1.5);
        light.name = 'venue-soft-ceiling-light';
        light.position.set(venueX, ceilingY - 1.2, centerZ - 6);
        addVenueObject(light);
    }

    const signColor = cfg.signColor || '#ffffff';
    addSideWallLetterSigns({ text: cfg.textLeft || 'BOWL', side: -1, halfW, wallHeight, venueX, venueY, centerZ, depth, signColor, detailSpacing });
    addSideWallLetterSigns({ text: cfg.textRight || 'POW', side: 1, halfW, wallHeight, venueX, venueY, centerZ, depth, signColor, detailSpacing });
    const signMatBack = new THREE.MeshBasicMaterial({ map: venueTextTexture(cfg.textBack || 'PINFALL', signColor), transparent: true, depthWrite: false });
    const backSign = new THREE.Mesh(new THREE.PlaneGeometry(13, 2.2), signMatBack);
    backSign.name = 'venue-back-wall-text';
    backSign.position.set(venueX, wallHeight * 0.72 + venueY, backZ + 0.19);
    addVenueObject(backSign);
}

function createBallVisual(radius) {
    if (presentation) return presentation.createBall(radius);
    if (modelState.ballTemplate) {
        const { group } = fittedModelGroup(modelState.ballTemplate, { radius, centerY: 0 });
        group.traverse((child) => {
            if (!child.isMesh || !child.material) return;
            child.material = child.material.clone();
            child.material.roughness = Math.max(0.18, child.material.roughness ?? 0.18);
            child.material.metalness = Math.min(0.28, child.material.metalness ?? 0.12);
            if ('envMapIntensity' in child.material) child.material.envMapIntensity = 0.9;
        });
        return group;
    }

    const ballGeo = new THREE.SphereGeometry(radius, 24, 18);
    const ballMat = new THREE.MeshStandardMaterial({
        color: 0xc084fc,
        roughness: 0.12,
        metalness: 0.62,
        emissive: 0x23103d,
        emissiveIntensity: 0.25
    });
    const mesh = new THREE.Mesh(ballGeo, ballMat);
    const fingerGeo = new THREE.SphereGeometry(radius * 0.14, 10, 8);
    const fingerMat = new THREE.MeshBasicMaterial({ color: 0x110520 });
    for(let i=0; i<3; i++) {
        const f = new THREE.Mesh(fingerGeo, fingerMat);
        f.position.set(
            Math.sin(i * 1.6) * radius * 0.75,
            Math.cos(i * 1.6) * radius * 0.75,
            radius * 0.55
        );
        mesh.add(f);
    }
    return mesh;
}

function buildPhysicalLane(laneWidth = LANE.currentWidth) {
    mawVisuals?.dispose();
    mawVisuals = null;
    laneObjects.forEach(obj => disposeGameVisual(obj));
    laneObjects = [];
    clearGutterVisuals();
    clearPinDeckWallVisuals();
    clearMegaLaneVisual();
    laneStaticBodies.forEach(body => world.remove(body));
    laneStaticBodies = [];
    pinDeckBodies.forEach(body => world.remove(body));
    pinDeckBodies = [];
    if (laneBody) {
        world.remove(laneBody);
        laneBody = null;
    }

    LANE.currentWidth = laneWidth;
    const currentLaneLength = laneLength();
    const gutterMetrics = gutterChannelMetrics(laneWidth);
    const physicsLaneLength = gutterMetrics.physicsLength;
    const physicsCenterZ = gutterMetrics.physicsCenterZ;
    const laneHeight = LANE.height;
    const origin = laneOrigin();

    // Cannon Physics Body
    const laneShape = new CANNON.Box(new CANNON.Vec3(laneWidth/2, laneHeight/2, physicsLaneLength/2));
    laneBody = new CANNON.Body({ mass: 0, material: MATERIALS.lane });
    laneBody.addShape(laneShape);
    laneBody.position.set(origin.x, origin.y - laneHeight/2, physicsCenterZ);
    world.addBody(laneBody);

    buildLaneDecorations();
    buildPinDeckContainment(laneWidth);
    buildMegaLaneVisual(laneWidth);
    buildGutterChannels(laneWidth);
    buildVenueShell();
    applyAlleySplitSettings();
    updateLaneReflector();

    // Visual mesh representation
    const laneGeo = new THREE.BoxGeometry(laneWidth, laneHeight, currentLaneLength);
    const laneMat = new THREE.MeshStandardMaterial({
        color: 0x3d2716, // rich retro walnut
        roughness: 0.18,
        metalness: 0.08
    });
    const laneMesh = new THREE.Mesh(laneGeo, laneMat);
    laneBody.position.copyTo(laneMesh.position);
    laneMesh.receiveShadow = true;
    scene.add(laneMesh);
    laneObjects.push(laneMesh);

    const capGeo = new THREE.BoxGeometry(laneWidth + 0.14, 0.006, 0.085);
    const capMat = new THREE.MeshBasicMaterial({ color: 0x2b1e20 });
    const foulLine = new THREE.Mesh(capGeo, capMat);
    foulLine.position.set(origin.x, origin.y + 0.01, laneStartZ());
    scene.add(foulLine);
    laneObjects.push(foulLine);

    // Wood visual planks markers
    const lineGeo = new THREE.PlaneGeometry(0.04, currentLaneLength);
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x22140a, transparent: true, opacity: 0.5 });
    const plankCount = Math.max(4, Math.floor(laneWidth / 0.9));
    for(let i = -plankCount; i <= plankCount; i++) {
        if (i === 0) continue;
        const plankLine = new THREE.Mesh(lineGeo, lineMat);
        plankLine.rotation.x = -Math.PI / 2;
        plankLine.position.set(origin.x + i * 0.45, origin.y + 0.005, origin.z);
        if (Math.abs(plankLine.position.x - origin.x) >= laneWidth / 2 - 0.12) continue;
        scene.add(plankLine);
        laneObjects.push(plankLine);
    }

    setProceduralLaneVisible(Boolean(debugState.config.showProcedural));
    updateLaneReflector();
}

function buildPinDeckContainment(laneWidth) {
    const cfg = debugState.config.pinDeckPhysics || DEFAULT_DEBUG_CONFIG.pinDeckPhysics;
    if (!cfg.enabled) return;

    const metrics = pinDeckContainmentMetrics(laneWidth);
    const visualThickness = Math.max(metrics.thickness * 1.8, 0.32);
    const visualMat = new THREE.MeshStandardMaterial({
        color: 0x010101,
        roughness: 0.48,
        metalness: 0.03,
        envMap: modelState.reflectionMap,
        envMapIntensity: 0.35,
        emissive: 0x050403,
        emissiveIntensity: 0.08
    });
    const railHeight = 0.08;
    const railWidth = Math.max(visualThickness * 1.25, 0.42);

    [-1, 1].forEach((side) => {
        const body = new CANNON.Body({ mass: 0, material: MATERIALS.guard });
        body.addShape(new CANNON.Box(new CANNON.Vec3(metrics.thickness / 2, metrics.wallHeight / 2, metrics.sideLength / 2)));
        body.position.set(metrics.centerX + side * metrics.halfWidth, metrics.centerY, metrics.centerZ);
        body.userData = { role: 'pinDeckSideWall' };
        world.addBody(body);
        pinDeckBodies.push(body);

        const wall = new THREE.Mesh(
            new THREE.BoxGeometry(visualThickness, metrics.wallHeight, metrics.sideLength),
            visualMat
        );
        wall.name = `pin-deck-visible-wall-${side}`;
        body.position.copyTo(wall.position);
        wall.castShadow = true;
        wall.receiveShadow = true;
        scene.add(wall);
        pinDeckWallObjects.push(wall);

        const topRail = new THREE.Mesh(
            new THREE.BoxGeometry(railWidth, railHeight, metrics.sideLength),
            visualMat
        );
        topRail.name = `pin-deck-visible-wall-top-${side}`;
        topRail.position.set(body.position.x, body.position.y + metrics.wallHeight / 2 + railHeight / 2, body.position.z);
        topRail.castShadow = true;
        topRail.receiveShadow = true;
        scene.add(topRail);
        pinDeckWallObjects.push(topRail);
    });
    updateDebugHelpers();
}

function rebuildLaneFromDebug() {
    buildPhysicalLane(requestedPhysicsLaneWidth(GAME.frame));
    toggleGutterGuards(migrateBumperCharges(GAME.activeUpgrades) > 0);
    syncMawVisuals();
    if (ballBody) {
        const radius = ballBody.shapes?.[0]?.radius || 0.49;
        const next = ballStartPosition(radius);
        ballBody.position.set(next.x, next.y, next.z);
        ballBody.velocity.set(0, 0, 0);
        ballBody.angularVelocity.set(0, 0, 0);
        if (ballMesh) ballBody.position.copyTo(ballMesh.position);
        resetBallMotionState();
    }
}

function buildLaneDecorations() {
    if (presentation) return;
    laneDecorationObjects.forEach(obj => scene.remove(obj));
    laneDecorationObjects = [];
    ceilingLightObjects.forEach(obj => scene.remove(obj));
    ceilingLightObjects = [];

    const origin = laneOrigin();
    const length = laneLength();
    const ceilingCfg = debugState.config.ceilingLights || DEFAULT_DEBUG_CONFIG.ceilingLights;
    const atmosphereCfg = debugState.config.atmosphere || DEFAULT_DEBUG_CONFIG.atmosphere;
    const shaftCfg = atmosphereCfg.lightShafts || DEFAULT_DEBUG_CONFIG.atmosphere.lightShafts;
    const dustCfg = atmosphereCfg.dust || DEFAULT_DEBUG_CONFIG.atmosphere.dust;
    const dustLightCfg = atmosphereCfg.dustLights || DEFAULT_DEBUG_CONFIG.atmosphere.dustLights;
    const fixtureCount = Math.max(0, Math.round(Number(ceilingCfg.count ?? 4)));
    const fixtureY = Number(ceilingCfg.y ?? 6.2);
    const fixtureXOffset = Number(ceilingCfg.xOffset ?? Math.max(1.1, LANE.currentWidth * 0.24));
    const fixtureStartOffset = Number(ceilingCfg.zStartOffset ?? 9);
    const fixtureSpacing = Number(ceilingCfg.zSpacing ?? Math.max(1, length / 5));
    const fixtureScale = Math.max(0.1, Number(ceilingCfg.fixtureScale ?? 1));
    const randRange = (min, max) => {
        const low = Number(min ?? 0);
        const high = Number(max ?? low);
        const sortedMin = Math.min(low, high);
        const sortedMax = Math.max(low, high);
        return sortedMin + Math.random() * (sortedMax - sortedMin);
    };

    // World polish lives outside the old procedural lane visibility now, so keep it restrained.
    const archCount = 0;
    for (let i = 0; i < archCount; i++) {
        const zPos = origin.z + length / 2 - 10 - (i * 7);
        const archGeo = new THREE.TorusGeometry(5, 0.08, 8, 24, Math.PI);
        const archMat = new THREE.MeshBasicMaterial({ 
            color: i % 2 === 0 ? 0xef4444 : 0xa855f7 
        });
        const arch = new THREE.Mesh(archGeo, archMat);
        arch.position.set(origin.x, fixtureY - 0.75, zPos);
        scene.add(arch);
        laneDecorationObjects.push(arch);
    }

    const fixtureGeo = new THREE.BoxGeometry(
        Math.max(0.1, Number(ceilingCfg.fixtureWidth ?? 0.75)),
        Math.max(0.01, Number(ceilingCfg.fixtureHeight ?? 0.08)),
        Math.max(0.1, Number(ceilingCfg.fixtureDepth ?? 1.1))
    );
    const fixtureMat = new THREE.MeshStandardMaterial({
        color: 0xfff4d0,
        emissive: 0x000000,
        emissiveIntensity: 0,
        roughness: 0.25
    });
    const coneGeo = new THREE.ConeGeometry(
        Math.max(0.01, Number(shaftCfg.coneRadius ?? 2.2)),
        Math.max(0.01, Number(shaftCfg.coneHeight ?? 4.4)),
        32,
        1,
        true
    );
    const coneMat = new THREE.MeshBasicMaterial({
        color: 0xffe8a6,
        transparent: true,
        opacity: THREE.MathUtils.clamp(Number(shaftCfg.coneOpacity ?? 0.025), 0, 1),
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });
    const shaftMat = new THREE.SpriteMaterial({
        map: getLightShaftTexture(),
        color: 0xffe8a6,
        transparent: true,
        opacity: THREE.MathUtils.clamp(Number(shaftCfg.shaftOpacity ?? 0.11), 0, 1),
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending
    });
    const lightPoolMat = new THREE.MeshBasicMaterial({
        map: getSoftDotTexture(),
        color: 0xffe2a3,
        transparent: true,
        opacity: THREE.MathUtils.clamp(Number(shaftCfg.poolOpacity ?? 0.075), 0, 1),
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide
    });
    for (let i = 0; i < fixtureCount; i++) {
        const z = origin.z + length / 2 - fixtureStartOffset - i * fixtureSpacing;
        [-1, 1].forEach(side => {
            const fixture = new THREE.Mesh(fixtureGeo, fixtureMat.clone());
            fixture.position.set(origin.x + side * fixtureXOffset, fixtureY, z);
            fixture.scale.setScalar(fixtureScale);
            fixture.castShadow = false;
            scene.add(fixture);
            ceilingLightObjects.push(fixture);

            if (shaftCfg.enabled === false) return;
            const cone = new THREE.Mesh(coneGeo, coneMat.clone());
            cone.name = 'coded-overhead-light-volume';
            cone.position.set(fixture.position.x, fixtureY - Math.max(0.01, Number(shaftCfg.coneHeight ?? 4.4)) * 0.43, z);
            cone.rotation.y = Math.PI / 4;
            cone.scale.set(1.1, 1, 1.45);
            cone.userData.lightShaft = true;
            cone.userData.baseOpacity = THREE.MathUtils.clamp(Number(shaftCfg.coneOpacity ?? 0.025), 0, 1);
            scene.add(cone);
            laneDecorationObjects.push(cone);

            if (side < 0) {
                for (let panel = 0; panel < 2; panel++) {
                    const shaft = new THREE.Sprite(shaftMat.clone());
                    shaft.name = 'coded-overhead-light-shaft';
                    shaft.position.set(origin.x + (panel - 0.5) * 0.22, fixtureY - 2.35, z - 0.2 - panel * 0.18);
                    shaft.scale.set(panel === 0 ? Number(shaftCfg.shaftWidth ?? 1.9) : Number(shaftCfg.shaftWidth ?? 1.9) * 0.68, panel === 0 ? Number(shaftCfg.shaftHeight ?? 5.4) : Number(shaftCfg.shaftHeight ?? 5.4) * 0.81, 1);
                    shaft.userData.lightShaft = true;
                    shaft.userData.baseOpacity = THREE.MathUtils.clamp(Number(shaftCfg.shaftOpacity ?? 0.11) * (panel === 0 ? 1 : 0.6), 0, 1);
                    shaft.renderOrder = 8;
                    scene.add(shaft);
                    laneDecorationObjects.push(shaft);
                }

                const pool = new THREE.Mesh(new THREE.PlaneGeometry(Math.max(0.01, Number(shaftCfg.poolWidth ?? 2.7)), Math.max(0.01, Number(shaftCfg.poolLength ?? 6.6))), lightPoolMat.clone());
                pool.name = 'coded-lane-soft-light-pool';
                pool.rotation.x = -Math.PI / 2;
                pool.position.set(origin.x, origin.y + 0.09, z - 1.6);
                pool.renderOrder = 7;
                pool.userData.lightPool = true;
                pool.userData.baseOpacity = THREE.MathUtils.clamp(Number(shaftCfg.poolOpacity ?? 0.075), 0, 1);
                scene.add(pool);
                laneDecorationObjects.push(pool);
            }
        });
    }

    if (dustLightCfg.enabled !== false) {
        const dustLightCount = Math.max(0, Math.round(Number(dustLightCfg.count ?? 3)));
        const dustLightColor = new THREE.Color(dustLightCfg.color || '#ffd993');
        const dustLightIntensity = Number(isNativeMobilePlatform() ? dustLightCfg.mobileIntensity ?? dustLightCfg.intensity : dustLightCfg.intensity ?? 0.11);
        for (let i = 0; i < dustLightCount; i++) {
            const z = origin.z + length / 2 - Number(dustLightCfg.zStartOffset ?? 13) - i * Number(dustLightCfg.zSpacing ?? 14);
            const kicker = new THREE.SpotLight(
                dustLightColor,
                Math.max(0, dustLightIntensity),
                Math.max(0, Number(dustLightCfg.distance ?? 9)),
                THREE.MathUtils.degToRad(THREE.MathUtils.clamp(Number(dustLightCfg.angle ?? 24), 1, 90)),
                THREE.MathUtils.clamp(Number(dustLightCfg.penumbra ?? 0.8), 0, 1),
                Math.max(0, Number(dustLightCfg.decay ?? 2.2))
            );
            kicker.name = 'coded-dust-spot-light';
            kicker.position.set(origin.x, origin.y + Number(dustLightCfg.y ?? 3.8), z);
            kicker.target.position.set(origin.x, origin.y + Number(dustLightCfg.targetY ?? 0.75), z - 4);
            scene.add(kicker);
            scene.add(kicker.target);
            laneDecorationObjects.push(kicker, kicker.target);
        }
    }

    const moteMat = new THREE.SpriteMaterial({
        map: getSoftDotTexture(),
        color: 0xffe8a6,
        transparent: true,
        opacity: THREE.MathUtils.clamp(Number(dustCfg.opacityMax ?? 0.11), 0, 1),
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending
    });
    const moteCount = dustCfg.enabled === false ? 0 : Math.max(0, Math.round(Number(isNativeMobilePlatform() ? dustCfg.mobileCount ?? dustCfg.count : dustCfg.count ?? 92)));
    for (let i = 0; i < moteCount; i++) {
        const mote = new THREE.Sprite(moteMat.clone());
        const x = origin.x + (Math.random() - 0.5) * Math.max(2.4, LANE.currentWidth * 0.78);
        const y = origin.y + 0.9 + Math.random() * 3.4;
        const z = origin.z + length / 2 - 6 - Math.random() * (length * 0.64);
        mote.position.set(x, y, z);
        mote.scale.setScalar(randRange(dustCfg.sizeMin ?? 0.035, dustCfg.sizeMax ?? 0.105));
        mote.userData.floatMote = true;
        mote.userData.basePosition = mote.position.clone();
        mote.userData.baseOpacity = randRange(dustCfg.opacityMin ?? 0.035, dustCfg.opacityMax ?? 0.11);
        mote.userData.driftSpeed = randRange(dustCfg.speedMin ?? 0.16, dustCfg.speedMax ?? 0.48);
        mote.userData.driftAmount = randRange(dustCfg.driftMin ?? 0.14, dustCfg.driftMax ?? 0.52);
        mote.renderOrder = 9;
        scene.add(mote);
        laneDecorationObjects.push(mote);
    }

    const endCfg = debugState.config.endLight;
    const endFixture = new THREE.Mesh(
        new THREE.BoxGeometry(1.4, 0.1, 1.4),
        new THREE.MeshStandardMaterial({ color: 0xe0f2fe, emissive: 0x000000, emissiveIntensity: 0 })
    );
    endFixture.position.set(endCfg.position.x, endCfg.position.y, endCfg.position.z);
    scene.add(endFixture);
    ceilingLightObjects.push(endFixture);
    setProceduralLaneVisible(Boolean(debugState.config.showProcedural));
}

function toggleGutterGuards(active) {
    gutterGuardsArray.forEach(g => {
        world.remove(g.body);
        disposeGameVisual(g.mesh);
    });
    gutterGuardsArray = [];

    if (active) {
        const guardMat = new THREE.MeshStandardMaterial({ color: 0xf43f5e, emissive: 0xaa1c3b, emissiveIntensity: 0.35 });
        const laneWidth = LANE.currentWidth;
        const currentLaneLength = laneLength();
        const origin = laneOrigin();

        [-1, 1].forEach(side => {
            const guardShape = new CANNON.Box(new CANNON.Vec3(0.04, 0.35, currentLaneLength/2));
            const guardBody = new CANNON.Body({ mass: 0, material: MATERIALS.guard });
            guardBody.addShape(guardShape);
            guardBody.position.set(origin.x + side * (laneWidth/2 + 0.08), origin.y + 0.2, origin.z);
            guardBody.addEventListener('collide', event => {
                if (event.body !== ballBody) return;
                if (consumeBumperImpact(GAME.activeUpgrades, bumperContacts, side, GAME.state === 'BALL_ROLLING')) {
                    showAlert(`BUMPER SAVE • ${GAME.activeUpgrades.bumperCharges} charges left`);
                    sfx.playTick();
                    const guard = gutterGuardsArray.find(item => item.body === guardBody);
                    if (guard) guard.flash = 0.35;
                    autoSaveRunSlot();
                }
            });
            world.addBody(guardBody);

            const guardGeo = new THREE.BoxGeometry(0.08, 0.7, currentLaneLength);
            const guardMesh = new THREE.Mesh(guardGeo, guardMat.clone());
            guardBody.position.copyTo(guardMesh.position);
            scene.add(guardMesh);

            gutterGuardsArray.push({ body: guardBody, mesh: guardMesh, flash: 0 });
        });
        guardMat.dispose();
    }
}

function spawnPin(x, z, type) {
    const pinRadius = PIN_SCALE.radius * pinGroupScale();
    const pinHeight = PIN_SCALE.height * pinGroupScale();
    const scale = pinGroupScale();
    const route = GAME.currentRoute || ROUTE_TYPES.STANDARD;
    const pinMass = (BOWLING_PHYSICS.pinMass + (route.heavyPins ? BOWLING_PHYSICS.heavyPinMassBonus : 0)) * Math.max(0.9, Math.pow(scale, 1.2));

    // Compound silhouette: Rapier's cylinders are already upright on Y.
    const baseShape = new CANNON.Cylinder(pinRadius * 0.45, pinRadius * 0.6, 0.24 * scale, 10);
    const lowerShape = new CANNON.Cylinder(pinRadius * 0.78, pinRadius * 0.58, 0.38 * scale, 10);
    const bellyShape = new CANNON.Sphere(pinRadius);
    const shoulderShape = new CANNON.Cylinder(pinRadius * 0.58, pinRadius * 0.95, 0.42 * scale, 10);
    const neckShape = new CANNON.Cylinder(pinRadius * 0.39, pinRadius * 0.45, 0.5 * scale, 8);
    const headShape = new CANNON.Sphere(pinRadius * 0.54);

    const material = type === PIN_TYPES.BOUNCY ? MATERIALS.bouncyPin : MATERIALS.pin;
    const body = new CANNON.Body({
        mass: pinMass,
        material: material,
        shapeMassWeights: [0.12, 0.25, 0.38, 0.16, 0.06, 0.03],
        ccdEnabled: isTenPinMode() || GAME.frame <= 3,
        sleepTimeLimit: 0.32,
        sleepSpeedLimit: 0.045
    });
    body.isBowlingPin = true;
    body.addShape(baseShape, new CANNON.Vec3(0, -0.76 * scale, 0));
    body.addShape(lowerShape, new CANNON.Vec3(0, -0.52 * scale, 0));
    body.addShape(bellyShape, new CANNON.Vec3(0, -0.22 * scale, 0));
    body.addShape(shoulderShape, new CANNON.Vec3(0, 0.12 * scale, 0));
    body.addShape(neckShape, new CANNON.Vec3(0, 0.46 * scale, 0));
    body.addShape(headShape, new CANNON.Vec3(0, 0.72 * scale, 0));
    body.position.set(x, laneOrigin().y + pinRackOffset().y + pinHeight / 2 + 0.02, z);
    
    // Random tiny micro-offsets to trigger realistic physical chaotic collisions
    const microJitter = BOWLING_PHYSICS.rackJitter;
    body.position.x += (Math.random() - 0.5) * microJitter;
    body.position.z += (Math.random() - 0.5) * microJitter;

    body.angularDamping = 0.2;
    body.linearDamping = 0.032;
    body.sleep();

    world.addBody(body);

    const pinGroup = createPinVisual(type, pinRadius, pinHeight);
    body.position.copyTo(pinGroup.position);
    body.quaternion.copyTo(pinGroup.quaternion);
    scene.add(pinGroup);
    const reflection = createReflectionClone(pinGroup);
    updateReflectionClone(pinGroup, reflection);

    const pinRecord = {
        body: body,
        mesh: pinGroup,
        reflection,
        type: type,
        exploded: false,
        scored: false,
        knocked: false,
        cleanupStarted: false,
        cleanupTimer: 0,
        bodyRemoved: false,
        meshRemoved: false,
        impactSounded: false,
        lastImpactSoundTime: -999
    };
    rememberLegendSeen('pins', pinTypeKey(type));
    attachPinImpactSound(pinRecord);
    physicalPins.push(pinRecord);
    return pinRecord;
}

const getCachedRackLayout = createLaneLayoutCache();

function currentRackLayout(frameNumber = GAME.frame) {
    return getCachedRackLayout({ frame: frameNumber, classic: isTenPinMode(), layout: GAME.currentRoute?.layout, scale: pinGroupScale(), padding: debugState.config.physicsLane.frameWidthPadding });
}

function generatePinGrid(frameNumber) {
    physicalPins.forEach(pin => {
        if (pin.body) world.remove(pin.body);
        disposeGameVisual(pin.mesh);
        if (pin.reflection) disposeGameVisual(pin.reflection);
    });
    reflectionObjects = [];
    physicalPins = [];
    const rack = currentRackLayout(frameNumber);
    const origin = laneOrigin();
    const offset = pinRackOffset();
    if (isTenPinMode()) primeTenPinRackSpecials();
    const featuredType = !isTenPinMode() && PIN_TYPES[GAME.currentRoute?.featuredPin];
    let featuredSeen = false;
    rack.points.forEach((point, index) => {
        // Keep the regular roll/RNG consumption. Only fill the last slot when
        // this boss's advertised mechanic would otherwise be absent entirely.
        const x = origin.x + offset.x + point.x + (Math.random() * 2 - 1) * rack.jitter;
        const z = laneEndZ() + 3.5 + offset.z + point.z + (Math.random() * 2 - 1) * rack.jitter;
        const rolledType = rollPinType();
        const type = featuredType && !featuredSeen && index === rack.points.length - 1 ? featuredType : rolledType;
        featuredSeen ||= type === featuredType;
        const pin = spawnPin(
            x, z, type
        );
        pin.rackIndex = index;
    });
    GAME.stats.pinsSpawned = physicalPins.length;
    world.solver.iterations = physicalPins.length <= 36 ? 8 : 5;
}

// Pin/ball textures belong to the presentation and are shared across racks.
function disposeGameVisual(object) {
    if (!object) return;
    object.removeFromParent ? object.removeFromParent() : scene.remove(object);
    const geometries = new Set(), materials = new Set();
    object.traverse(child => {
        if (child.geometry && !presentation?.releaseGeometry(child)) geometries.add(child.geometry);
        [child.material].flat().filter(Boolean).forEach(material => materials.add(material));
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
}

function getRackX(col, row, rowScale = 1) {
    return (col - row * 0.5) * PIN_SCALE.spacing * pinGroupScale() * rowScale;
}

function isTenPinMode() {
    return GAME.mode === 'tenpin';
}

function uiNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? String(Math.round(number)) : String(value);
}

function uiExactNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? String(Math.round(number * 1000) / 1000) : String(value);
}

function primeTenPinRackSpecials() {
    GAME.tenPin.rackPinIndex = 0;
    GAME.tenPin.pendingRackSpecialTypes = Array(10).fill('STANDARD');
    if (!GAME.tenPin.specialPinsEnabled) return;

    const bought = GAME.tenPin.selectedRackSpecials.slice(0, 3);
    if (GAME.tenPin.manualRackNext && GAME.tenPin.manualRackAssignments?.length) {
        GAME.tenPin.manualRackAssignments.forEach((purchaseIndex, slotIndex) => {
            if (purchaseIndex === null || purchaseIndex === undefined) return;
            const typeKey = bought[purchaseIndex];
            if (typeKey) GAME.tenPin.pendingRackSpecialTypes[slotIndex] = typeKey;
        });
    } else {
        const slots = [...Array(10).keys()].sort(() => Math.random() - 0.5).slice(0, bought.length);
        bought.forEach((typeKey, index) => {
            GAME.tenPin.pendingRackSpecialTypes[slots[index]] = typeKey;
        });
    }
    GAME.tenPin.selectedRackSpecials = [];
    GAME.tenPin.manualRackAssignments = Array(10).fill(null);
    GAME.tenPin.manualRackSelectedIndex = null;
    GAME.tenPin.manualRackNext = false;
}

function laneWidthForFrame(frameNumber) {
    return currentRackLayout(frameNumber).width;
}

function rollPinType() {
    if (isTenPinMode()) {
        const typeKey = GAME.tenPin.pendingRackSpecialTypes[GAME.tenPin.rackPinIndex++] || 'STANDARD';
        return PIN_TYPES[typeKey] || PIN_TYPES.STANDARD;
    }
    const rand = Math.random();
    const route = GAME.currentRoute || ROUTE_TYPES.STANDARD;
    const specialMod = route.specialMod ?? (route.layout === 'start' ? 0.12 : route.boss ? 0.82 : route.layout === 'messy' ? 0.95 : 1);

    let gold = Math.min(0.28, GAME.activeUpgrades.goldPinChance * specialMod);
    let explosive = Math.min(0.2, GAME.activeUpgrades.explosivePinChance * specialMod);
    let implosive = Math.min(0.2, GAME.activeUpgrades.implosivePinChance * specialMod);
    let bouncy = Math.min(0.24, GAME.activeUpgrades.bouncyPinChance * specialMod);
    const dailyBoost = Number(GAME.runModifiers?.daily?.specialBoost || 0);
    (GAME.runModifiers?.daily?.pinBiases || []).forEach((bias) => {
        if (bias === 'GOLD') gold += 0.04 + dailyBoost;
        if (bias === 'EXPLOSIVE') explosive += 0.035 + dailyBoost;
        if (bias === 'IMPLOSIVE') implosive += 0.035 + dailyBoost;
        if (bias === 'BOUNCY') bouncy += 0.04 + dailyBoost;
    });
    const totalSpecial = gold + explosive + implosive + bouncy;
    const maxSpecial = route.layout === 'fragile' ? 0.56 : 0.42;
    if (totalSpecial > maxSpecial) {
        const scale = maxSpecial / totalSpecial;
        gold *= scale;
        explosive *= scale;
        implosive *= scale;
        bouncy *= scale;
    }

    if (rand < gold) return PIN_TYPES.GOLD;
    if (rand < gold + explosive) return PIN_TYPES.EXPLOSIVE;
    if (rand < gold + explosive + implosive) return PIN_TYPES.IMPLOSIVE;
    if (rand < gold + explosive + implosive + bouncy) return PIN_TYPES.BOUNCY;
    
    return PIN_TYPES.STANDARD;
}

function applyOneThrowBallUpgrade(kind) {
    const upgrades = GAME.activeUpgrades;
    if (kind === 'heavy') {
        upgrades.nextThrowMassBoost += 4.2;
        upgrades.nextThrowStability += 0.08;
    } else if (kind === 'pearl') {
        upgrades.nextThrowHookBoost += 0.38;
        upgrades.nextThrowHookDelay += 0.08;
    } else if (kind === 'urethane') {
        upgrades.nextThrowHookBoost -= 0.18;
        upgrades.nextThrowStability += 0.18;
        upgrades.nextThrowFocus += 0.012;
    } else if (kind === 'tape') {
        upgrades.nextThrowFocus += 0.026;
    } else if (kind === 'speed') {
        upgrades.nextThrowPowerBoost += 1.8;
        upgrades.nextThrowHookBoost -= 0.24;
        upgrades.nextThrowCashMultiplier *= 1.18;
    }
}

function captureThrowMods() {
    const traits = ballBonuses(GAME);
    activeThrowMods = {
        hookBoost: (GAME.activeUpgrades.nextThrowHookBoost || 0) + traits.hook,
        hookDelay: (GAME.activeUpgrades.nextThrowHookDelay || 0) + traits.delay,
        resistance: traits.resistance,
        stability: GAME.activeUpgrades.nextThrowStability || 0,
        cashMultiplier: GAME.activeUpgrades.nextThrowCashMultiplier || 1
    };
}

function clearOneThrowBallUpgrades() {
    GAME.activeUpgrades.nextThrowMassBoost = 0;
    GAME.activeUpgrades.nextThrowHookBoost = 0;
    GAME.activeUpgrades.nextThrowHookDelay = 0;
    GAME.activeUpgrades.nextThrowStability = 0;
    GAME.activeUpgrades.nextThrowCashMultiplier = 1;
}

function spawnBall() {
    bumperContacts = createBumperContacts();
    throwElapsed = 0;
    if (ballBody) {
        world.remove(ballBody);
        disposeGameVisual(ballMesh);
    }

    const baseRadius = 0.49;
    const radius = baseRadius * GAME.activeUpgrades.ballSize;
    const modeMassBonus = isTenPinMode() ? BOWLING_PHYSICS.tenPinBallMassBonus : BOWLING_PHYSICS.roguelikeBallMassBonus;
    const upgradedWeightBonus = Math.max(0, GAME.activeUpgrades.ballMass - 12.0) * BOWLING_PHYSICS.poundsOverHouseBallScale;
    const ballMass = BOWLING_PHYSICS.ballMass + modeMassBonus + upgradedWeightBonus + (GAME.activeUpgrades.nextThrowMassBoost || 0) + ballBonuses(GAME).mass;
    
    ballBody = new CANNON.Body({
        mass: ballMass,
        shape: new CANNON.Sphere(radius),
        material: MATERIALS.ball
    });
    
    const start = ballStartPosition(radius);
    ballBody.position.set(start.x, start.y, start.z);
    ballBody.angularDamping = 0.035;
    ballBody.linearDamping = 0.02;
    world.addBody(ballBody);

    ballMesh = createBallVisual(radius);
    applyLoadoutBallSkin(ballMesh, radius);
    ballMesh.castShadow = true;

    scene.add(ballMesh);
    ballBody.position.copyTo(ballMesh.position);
    resetBallMotionState();
}

function removeBallFromWorld() {
    if (ballBody) {
        world.remove(ballBody);
        ballBody = null;
    }
    if (ballMesh) {
        disposeGameVisual(ballMesh);
        ballMesh = null;
    }
    sfx.stopBallRoll();
    resetBallMotionState();
}

function clampLaunchX(x, radius = ballBody?.shapes?.[0]?.radius || 0.49) {
    const laneLimit = LANE.currentWidth / 2 - radius - 0.18;
    return THREE.MathUtils.clamp(x, -laneLimit, laneLimit);
}

function moveLaunchPosition(dir) {
    if (GAME.state !== 'MAIN_METER' || gauge.stage !== 'AIM' || !ballBody) return;
    launchX = clampLaunchX(launchX + dir * 0.22);
    const next = ballStartPosition(ballBody.shapes?.[0]?.radius || 0.49);
    ballBody.position.set(next.x, next.y, next.z);
    ballBody.velocity.set(0, 0, 0);
    ballBody.angularVelocity.set(0, 0, 0);
    if (ballMesh) ballBody.position.copyTo(ballMesh.position);
    resetBallMotionState();
    gauge.updatePositionLabel();
    setPreRollCamera();
    sfx.playTick();
}

function triggerExplosiveForce(pinIndex, origin) {
    sfx.playExplosion();
    const control = GAME.activeUpgrades.specialControl || 0;
    const radius = 2.15 + control * 0.45;
    const forceStrength = 12 + control * 2.5;

    physicalPins.forEach((other, idx) => {
        if (idx === pinIndex) return;
        if (!other.body) return;
        const pinPos = other.body.position;
        const dist = pinPos.distanceTo(origin);
        
        if (dist < radius) {
            const dir = new CANNON.Vec3();
            pinPos.vsub(origin, dir);
            dir.normalize();
            const force = dir.scale((1 - (dist / radius)) * forceStrength);
            force.y *= 0.18;
            other.body.applyImpulse(force, other.body.position);
            other.body.velocity.x = THREE.MathUtils.clamp(other.body.velocity.x, -8, 8);
            other.body.velocity.y = THREE.MathUtils.clamp(other.body.velocity.y, -3, 4);
            other.body.velocity.z = THREE.MathUtils.clamp(other.body.velocity.z, -8, 8);
        }
    });

    createVisualExplosion(origin, 0xef4444);
    presentation?.impact(origin, 0xffa45e);
    triggerCameraShake(0.14);
}

function triggerImplosiveForce(pinIndex, origin) {
    sfx.playImplosion();
    const control = GAME.activeUpgrades.specialControl || 0;
    const radius = 2.75 + control * 0.55;
    const forceStrength = -9.5 - control * 1.5;

    physicalPins.forEach((other, idx) => {
        if (idx === pinIndex) return;
        if (!other.body) return;
        const pinPos = other.body.position;
        const dist = pinPos.distanceTo(origin);
        
        if (dist < radius) {
            const dir = new CANNON.Vec3();
            pinPos.vsub(origin, dir);
            dir.normalize();
            const force = dir.scale((1 - (dist / radius)) * forceStrength);
            force.y *= 0.12;
            other.body.applyImpulse(force, other.body.position);
            other.body.velocity.x = THREE.MathUtils.clamp(other.body.velocity.x, -7, 7);
            other.body.velocity.y = THREE.MathUtils.clamp(other.body.velocity.y, -3, 4);
            other.body.velocity.z = THREE.MathUtils.clamp(other.body.velocity.z, -7, 7);
        }
    });

    createVisualExplosion(origin, 0xa855f7);
    presentation?.impact(origin, 0xb49aff);
}

function calculateTargetScore(frameNumber) {
    const level = frameNumber - 1;
    const route = GAME.currentRoute || ROUTE_TYPES.STANDARD;
    const stageTax = Math.max(0, GAME.stage - 1) * 5;
    const earlyRelief = frameNumber <= 3 ? 2 : frameNumber === 4 ? 4 : 0;
    return Math.ceil(7 + level * 4 + Math.pow(level, 1.42) * 2.15 + stageTax + (GAME.activeUpgrades.targetTax || 0) + (route.targetMod || 0) + (GAME.runModifiers?.daily?.targetTax || 0) - earlyRelief);
}

function chooseRollCount(frameNumber) {
    const route = GAME.currentRoute || ROUTE_TYPES.STANDARD;
    if (route.boss) return 3;
    if (frameNumber === 1) return 2 + (route.rollBonus || 0);
    if (frameNumber <= 3) return 2 + (route.rollBonus || 0);
    const roll = Math.random();
    const base = roll < 0.12 ? 1 : roll < 0.76 ? 2 : 3;
    return THREE.MathUtils.clamp(base + (route.rollBonus || 0), 1, 3);
}

function triggerCameraShake(amount) {
    const shakeAmount = THREE.MathUtils.clamp(Number(debugState.config.render?.cameraShake ?? 0), 0, 1);
    if (shakeAmount <= 0) return;
    const cap = GAME.state === 'BALL_ROLLING' ? 0.09 : 0.22;
    const scale = GAME.state === 'BALL_ROLLING' ? 0.38 : 0.75;
    cameraShake = Math.min(cap * shakeAmount, cameraShake + amount * scale * shakeAmount);
}

function setPreRollCamera() {
    impactCamera.active = false;
    impactCamera.elapsed = 0;
    if (debugState.config.useDebugCamera) {
        const cfg = debugState.config.camera;
        camera.position.set(
            cfg.position.x + launchX,
            cfg.position.y,
            cfg.position.z
        );
        cameraLookTarget.set(cfg.target.x + launchX, cfg.target.y, cfg.target.z);
        camera.lookAt(
            cameraLookTarget.x,
            cameraLookTarget.y,
            cameraLookTarget.z
        );
        return;
    }
    const origin = laneOrigin();
    const back = THREE.MathUtils.clamp(laneCameraDistance(LANE.currentWidth, camera.aspect, camera.fov) * 0.48, 7.8, 10);
    const overviewBack = back + THREE.MathUtils.clamp(LANE.currentWidth * 0.07, 2.5, 4.5);
    camera.position.set(
        origin.x + launchX * THREE.MathUtils.lerp(0.42, 0.25, preRollViewBlend),
        THREE.MathUtils.lerp(origin.y + 2.8 + back * 0.04, origin.y + 7.8 + Math.min(2, LANE.currentWidth * 0.08), preRollViewBlend),
        ballStartZ() + THREE.MathUtils.lerp(back, overviewBack, preRollViewBlend)
    );
    cameraLookTarget.set(
        origin.x + launchX * (1 - preRollViewBlend) * 0.25,
        THREE.MathUtils.lerp(origin.y + 0.7, origin.y + 0.55, preRollViewBlend),
        laneStartZ() - THREE.MathUtils.lerp(7, 9, preRollViewBlend)
    );
    camera.lookAt(cameraLookTarget);
}

function updateCameraViewButton() {
    const button = document.getElementById('btn-camera-view');
    if (!button) return;
    button.setAttribute('aria-pressed', String(preRollViewRaised));
    button.setAttribute('aria-label', preRollViewRaised ? 'Lower camera behind the ball' : 'Raise camera to view the lane');
    button.title = preRollViewRaised ? 'Lower to ball view (V)' : 'Raise to lane overview (V)';
    button.textContent = preRollViewRaised ? 'LOWER VIEW' : 'RAISE VIEW';
}

function togglePreRollView() {
    if (GAME.state !== 'MAIN_METER' || GAME.paused || debugState.active) return;
    preRollViewRaised = !preRollViewRaised;
    updateCameraViewButton();
    sfx.playTick();
}

let particles = [];
let lastSpeedTrailAt = 0;
let mobileControlRailHidden = false;
let softDotTexture = null;
let lightShaftTexture = null;

function getSoftDotTexture() {
    if (softDotTexture) return softDotTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
    gradient.addColorStop(0, 'rgba(255, 244, 190, 1)');
    gradient.addColorStop(0.32, 'rgba(255, 210, 106, 0.45)');
    gradient.addColorStop(1, 'rgba(255, 210, 106, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    softDotTexture = new THREE.CanvasTexture(canvas);
    softDotTexture.encoding = THREE.sRGBEncoding;
    return softDotTexture;
}

function getLightShaftTexture() {
    if (lightShaftTexture) return lightShaftTexture;
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 384;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y++) {
        const v = y / (canvas.height - 1);
        const topFade = THREE.MathUtils.smoothstep(v, 0.03, 0.24);
        const bottomFade = 1 - THREE.MathUtils.smoothstep(v, 0.72, 1);
        const vertical = topFade * bottomFade;
        const taper = THREE.MathUtils.lerp(0.88, 0.34, v);
        for (let x = 0; x < canvas.width; x++) {
            const u = (x / (canvas.width - 1)) * 2 - 1;
            const core = Math.exp(-Math.pow(Math.abs(u) / taper, 2.8) * 3.2);
            const halo = Math.exp(-Math.pow(Math.abs(u) / (taper * 1.9), 2) * 2.2) * 0.32;
            const grain = 0.92 + Math.sin(x * 0.23 + y * 0.071) * 0.035 + Math.sin(x * 0.047 - y * 0.19) * 0.025;
            const alpha = THREE.MathUtils.clamp((core * 0.82 + halo) * vertical * grain, 0, 1);
            const index = (y * canvas.width + x) * 4;
            image.data[index] = 255;
            image.data[index + 1] = 232;
            image.data[index + 2] = 166;
            image.data[index + 3] = Math.round(alpha * 190);
        }
    }
    ctx.putImageData(image, 0, 0);
    lightShaftTexture = new THREE.CanvasTexture(canvas);
    lightShaftTexture.encoding = THREE.sRGBEncoding;
    lightShaftTexture.minFilter = THREE.LinearFilter;
    lightShaftTexture.magFilter = THREE.LinearFilter;
    return lightShaftTexture;
}

function createVisualExplosion(pos, colorHex) {
    const count = 16;
    const group = new THREE.Group();
    const pGeo = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const pMat = new THREE.MeshBasicMaterial({ color: colorHex });

    for (let i = 0; i < count; i++) {
        const p = new THREE.Mesh(pGeo, pMat);
        p.position.set(
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3,
            (Math.random() - 0.5) * 0.3
        );
        const velocity = new THREE.Vector3(
            (Math.random() - 0.5) * 10,
            (Math.random()) * 8 + 1,
            (Math.random() - 0.5) * 10
        );
        group.add(p);
        particles.push({ mesh: p, vel: velocity, timer: 0.7 });
    }

    group.position.set(pos.x, pos.y, pos.z);
    scene.add(group);
    setTimeout(() => { disposeGameVisual(group); }, 700);
}

function createStrikeLaneBurst() {
    if (!scene) return;
    const metrics = pinDeckContainmentMetrics(LANE.currentWidth);
    const origin = laneOrigin();
    const burstPos = new THREE.Vector3(metrics.centerX, origin.y + 0.85, metrics.centerZ + metrics.sideLength * 0.12);
    createVisualExplosion(burstPos, 0xfacc15);
    createVisualExplosion(burstPos.clone().add(new THREE.Vector3(-0.75, 0.12, 0.35)), 0x8bd4e6);
    createVisualExplosion(burstPos.clone().add(new THREE.Vector3(0.75, 0.12, 0.35)), 0xf7ead1);
}

function createPinPopParticles(pos, colorHex) {
    const count = 9;
    const group = new THREE.Group();
    const pGeo = new THREE.BoxGeometry(0.055, 0.055, 0.055);
    const pMat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.78 });
    for (let i = 0; i < count; i++) {
        const p = new THREE.Mesh(pGeo, pMat.clone());
        p.position.set((Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.16, (Math.random() - 0.5) * 0.16);
        const velocity = new THREE.Vector3((Math.random() - 0.5) * 2.8, Math.random() * 2.4 + 0.8, (Math.random() - 0.5) * 2.8);
        group.add(p);
        particles.push({ mesh: p, vel: velocity, timer: 0.42, duration: 0.42, fade: true });
    }
    group.position.set(pos.x, pos.y, pos.z);
    scene.add(group);
    pMat.dispose();
    setTimeout(() => { disposeGameVisual(group); }, 520);
}

function createPinImpactFlash(pos, intensity = 1) {
    if (!scene || isNativeMobilePlatform()) return;
    const group = new THREE.Group();
    const sparkCount = 4;
    const length = THREE.MathUtils.clamp(0.22 + intensity * 0.018, 0.22, 0.42);
    const sparkGeo = new THREE.BoxGeometry(0.035, 0.035, length);
    const colors = [0xffd36a, 0x8bd4e6, 0xffa15f, 0xf7ead1];
    for (let i = 0; i < sparkCount; i++) {
        const mat = new THREE.MeshBasicMaterial({
            color: colors[i % colors.length],
            transparent: true,
            opacity: THREE.MathUtils.clamp(0.22 + intensity * 0.018, 0.22, 0.42),
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const spark = new THREE.Mesh(sparkGeo, mat);
        const angle = (i / sparkCount) * Math.PI * 2 + Math.random() * 0.35;
        spark.position.set(Math.cos(angle) * 0.08, Math.random() * 0.12, Math.sin(angle) * 0.08);
        spark.quaternion.setFromEuler(new THREE.Euler(Math.random() * 0.7, angle, Math.PI / 2 + Math.random() * 0.5));
        spark.renderOrder = 12;
        group.add(spark);
        particles.push({
            mesh: spark,
            vel: new THREE.Vector3(Math.cos(angle) * 0.55, 0.42 + Math.random() * 0.35, Math.sin(angle) * 0.55),
            timer: 0.2,
            duration: 0.2,
            fade: true
        });
    }
    group.position.set(pos.x, pos.y + 0.24, pos.z);
    scene.add(group);
    setTimeout(() => { disposeGameVisual(group); }, 260);
}

function triggerRackLoadedSweep() {
    lanePolishObjects.forEach((object) => {
        if (!object.userData.sweepVelocity) return;
        object.position.z = object.userData.sweepStartZ;
        object.userData.sweepActive = true;
        if (object.material) object.material.opacity = object.userData.baseOpacity;
    });
}

class RetroGauge {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.stage = 'OFF';
        this.aimAngle = 0;
        this.power = 0;
        this.timingPower = 0;
        this.landedPower = 0;
        this.selectedPower = 0;
        this.curve = 0;
        this.maxAim = 0.23;
        this.accuracyLine = 0.25;
        this.trueWindow = 0.055;
        this.safeWindow = 0.16;
        this.gutterWindow = 0.33;
    }

    tenPinAimMultiplier() {
        return isTenPinMode() ? 1.68 : 1;
    }

    start() {
        this.stage = 'AIM';
        preRollViewRaised = false;
        preRollViewBlend = 0;
        updateCameraViewButton();
        setMobileControlRailHidden(false);
        this.aimAngle = 0;
        this.power = 0;
        this.timingPower = 0;
        this.landedPower = 0;
        this.selectedPower = 0;
        this.curve = 0;
        this.updatePositionLabel();
        document.getElementById('gauge-sub-label').style.color = '#f59e0b';
    }

    updateLabels(stageText, subText) {
        document.getElementById('gauge-stage-label').innerText = stageText;
        document.getElementById('gauge-sub-label').innerText = subText;
        const mobileStage = document.getElementById('mobile-gauge-stage');
        const mobileValue = document.getElementById('mobile-gauge-value');
        if (mobileStage) mobileStage.innerText = stageText;
        if (mobileValue) mobileValue.innerText = subText;
    }

    setAim(angle) {
        const maxAim = this.maxAim * this.tenPinAimMultiplier();
        this.aimAngle = THREE.MathUtils.clamp(angle, -maxAim, maxAim);
        this.updateAimLabel();
    }

    nudgeAim(dir) {
        if (this.stage !== 'AIM') return;
        this.setAim(this.aimAngle + dir * (isTenPinMode() ? 0.034 : 0.018));
        sfx.playTick();
    }

    updatePositionLabel() {
        const percent = Math.round((launchX / Math.max(0.1, LANE.currentWidth / 2)) * 100);
        this.updateLabels('SET SPOT', `${percent > 0 ? '+' : ''}${percent}%`);
    }

    updateAimLabel() {
        const degrees = Math.round(THREE.MathUtils.radToDeg(this.aimAngle));
        this.updateLabels('SET LINE', `${degrees} DEG`);
    }

    setAimFromPointer(event) {
        if (this.stage !== 'AIM') return;
        const source = event.currentTarget?.getBoundingClientRect ? event.currentTarget : this.canvas;
        const rect = source.getBoundingClientRect();
        const x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        this.setAim(x * this.maxAim * this.tenPinAimMultiplier());
    }

    triggerClick() {
        sfx.playTick();
        if (this.stage === 'AIM') {
            this.stage = 'POWER_UP';
            this.power = 0;
            this.selectedPower = 0;
            this.updateLabels('POWER', 'LOCK RED');
            document.getElementById('gauge-sub-label').style.color = '#ef4444';
        } else if (this.stage === 'POWER_UP' || this.stage === 'POWER_RED_DOWN') {
            this.selectedPower = THREE.MathUtils.clamp(this.power, 0.08, 1);
            this.timingPower = 1;
            this.power = this.selectedPower;
            this.stage = 'POWER_DOWN';
            this.updateLabels('TIMING', 'HIT LINE');
            document.getElementById('gauge-sub-label').style.color = '#38d9ff';
        } else if (this.stage === 'POWER_RETURN_UP') {
            return;
        } else if (this.stage === 'POWER_DOWN') {
            this.launch();
        }
    }

    launch() {
        this.stage = 'OFF';
        this.landedPower = this.timingPower;
        const timingError = this.timingPower - this.accuracyLine;
        releaseFeedback = Math.abs(timingError) <= this.trueWindow ? 'PERFECT RELEASE' : Math.abs(timingError) <= this.safeWindow ? 'CLEAN RELEASE' : timingError > 0 ? 'EARLY · HOOK RIGHT' : 'LATE · HOOK LEFT';
        releaseFeedbackUntil = performance.now() + 1500;
        this.curve = this.calculateCurve(timingError);
        if (Math.abs(timingError) > this.gutterWindow) {
            this.curve = Math.sign(this.curve || -timingError) * 1.05;
        }
        this.updateLabels('LAUNCH', 'GO!');
        document.getElementById('gauge-sub-label').style.color = '#10b981';
        executeRoll(this.aimAngle, this.selectedPower, this.curve);
    }

    update(dt) {
        if (this.stage === 'POWER_UP') {
            this.power += dt * 0.85;
            if (this.power >= 1) {
                this.power = 1;
                this.selectedPower = 1;
                this.stage = 'POWER_RED_DOWN';
                this.updateLabels('POWER', 'LOCK RED');
                document.getElementById('gauge-sub-label').style.color = '#ef4444';
            }
            document.getElementById('gauge-sub-label').innerText = `${Math.round(this.power * 100)}%`;
        } else if (this.stage === 'POWER_RED_DOWN') {
            this.power -= dt * 0.85;
            document.getElementById('gauge-sub-label').innerText = `${Math.max(0, Math.round(this.power * 100))}%`;
            if (this.power <= 0) {
                this.cancelPower();
            }
        } else if (this.stage === 'POWER_RETURN_UP') {
            this.timingPower += dt * 1.48;
            if (this.timingPower >= 1) {
                this.timingPower = 1;
                this.stage = 'POWER_DOWN';
                this.updateLabels('TIMING', 'HIT LINE');
                document.getElementById('gauge-sub-label').style.color = '#38d9ff';
            }
            document.getElementById('gauge-sub-label').innerText = `${Math.round(this.selectedPower * 100)}%`;
        } else if (this.stage === 'POWER_DOWN') {
            this.timingPower -= dt * 0.65;
            const timingError = this.timingPower - this.accuracyLine;
            const curvePreview = this.calculateCurve(timingError);
            const direction = curvePreview < -0.08 ? 'LEFT' : curvePreview > 0.08 ? 'RIGHT' : 'TRUE';
            document.getElementById('gauge-sub-label').innerText = direction;
            if (this.timingPower <= 0) {
                this.timingPower = 0;
                this.launch();
            }
        }
    }

    cancelPower() {
        this.stage = 'AIM';
        this.power = 0;
        this.timingPower = 0;
        this.landedPower = 0;
        this.selectedPower = 0;
        this.curve = 0;
        this.updateLabels('SET LINE', 'TRY AGAIN');
        document.getElementById('gauge-sub-label').style.color = '#f59e0b';
        sfx.playTick();
    }

    calculateCurve(timingError) {
        const absError = Math.abs(timingError);
        const trueWindow = (isTenPinMode() ? this.trueWindow * 0.58 : this.trueWindow) + (GAME.activeUpgrades.timingForgiveness || 0) + (GAME.activeUpgrades.nextThrowFocus || 0) + ballBonuses(GAME).focus;
        if (absError <= trueWindow) return 0;
        const normalized = (absError - trueWindow) / (this.gutterWindow - trueWindow);
        const eased = Math.pow(THREE.MathUtils.clamp(normalized, 0, 1), 1.1);
        return Math.sign(timingError) * eased * 0.72;
    }

    draw() {
        // Canvas pixels persist. During rolls, pauses and menus the gauge is
        // usually unchanged; repaint only when an actual drawing input changes.
        const previous = this.lastDrawState;
        if (previous && previous.stage === this.stage && previous.gameState === GAME.state &&
            previous.aimAngle === this.aimAngle && previous.power === this.power &&
            previous.timingPower === this.timingPower && previous.landedPower === this.landedPower &&
            previous.selectedPower === this.selectedPower && previous.accuracyLine === this.accuracyLine &&
            previous.safeWindow === this.safeWindow && previous.gutterWindow === this.gutterWindow &&
            previous.width === this.canvas.width && previous.height === this.canvas.height) return;
        this.lastDrawState = {
            stage: this.stage, gameState: GAME.state, aimAngle: this.aimAngle, power: this.power,
            timingPower: this.timingPower, landedPower: this.landedPower, selectedPower: this.selectedPower,
            accuracyLine: this.accuracyLine, safeWindow: this.safeWindow, gutterWindow: this.gutterWindow,
            width: this.canvas.width, height: this.canvas.height
        };
        this.drawMobileGauge();
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const r = this.canvas.width / 2 - 11;
        
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();
        this.ctx.imageSmoothingEnabled = false;

        const bg = this.ctx.createRadialGradient(cx, cy - 8, 8, cx, cy, r + 8);
        bg.addColorStop(0, 'rgba(76, 35, 98, 0.22)');
        bg.addColorStop(0.55, 'rgba(22, 10, 28, 0.16)');
        bg.addColorStop(1, 'rgba(2, 1, 8, 0.05)');
        this.ctx.fillStyle = bg;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        for (let i = 0; i < 40; i++) {
            const angle = (i / 40) * Math.PI * 2;
            const chunk = i % 5 === 0 ? 4 : 2;
            this.ctx.fillStyle = i % 5 === 0 ? 'rgba(255, 219, 117, 0.72)' : 'rgba(139, 212, 230, 0.3)';
            this.ctx.fillRect(
                Math.round(cx + Math.cos(angle) * (r + 1) - chunk / 2),
                Math.round(cy + Math.sin(angle) * (r + 1) - chunk / 2),
                chunk,
                chunk
            );
        }

        this.ctx.strokeStyle = 'rgba(11, 7, 5, 0.72)';
        this.ctx.lineWidth = 16;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, r, 0, Math.PI * 2);
        this.ctx.stroke();

        this.ctx.strokeStyle = 'rgba(255, 196, 77, 0.64)';
        this.ctx.lineWidth = 5;
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, r - 1, 0, Math.PI * 2);
        this.ctx.stroke();

        if (this.stage === 'AIM' || this.stage === 'POWER_UP' || this.stage === 'POWER_RED_DOWN' || this.stage === 'POWER_RETURN_UP' || this.stage === 'POWER_DOWN' || this.stage === 'OFF') {
            this.ctx.strokeStyle = 'rgba(11, 7, 5, 0.78)';
            this.ctx.lineWidth = 12;
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, r - 13, Math.PI, Math.PI * 2);
            this.ctx.stroke();

            this.ctx.strokeStyle = '#ffbd4a';
            this.ctx.lineWidth = 8;
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, r - 13, Math.PI, Math.PI * 2);
            this.ctx.stroke();

            const needleAngle = -Math.PI/2 + this.aimAngle;
            this.ctx.strokeStyle = 'rgba(11, 7, 5, 0.84)';
            this.ctx.lineWidth = 10;
            this.ctx.beginPath();
            this.ctx.moveTo(cx, cy);
            this.ctx.lineTo(cx + Math.cos(needleAngle) * (r - 19), cy + Math.sin(needleAngle) * (r - 19));
            this.ctx.stroke();
            this.ctx.strokeStyle = '#ff5fab';
            this.ctx.lineWidth = 6;
            this.ctx.beginPath();
            this.ctx.moveTo(cx, cy);
            this.ctx.lineTo(cx + Math.cos(needleAngle) * (r - 19), cy + Math.sin(needleAngle) * (r - 19));
            this.ctx.stroke();
            this.ctx.fillStyle = '#ffbd4a';
            this.ctx.fillRect(cx - 5, cy - 5, 10, 10);
        }

        if (this.stage === 'POWER_UP' || this.stage === 'POWER_RED_DOWN' || this.stage === 'POWER_RETURN_UP' || this.stage === 'POWER_DOWN' || (this.stage === 'OFF' && (GAME.state === 'BALL_ROLLING' || GAME.state === 'ROLL_SETTLING' || GAME.state === 'ROUND_OVER'))) {
            const isTimingSweep = this.stage === 'POWER_RETURN_UP' || this.stage === 'POWER_DOWN';
            const displayPower = this.stage === 'OFF' ? this.landedPower : (isTimingSweep ? this.timingPower : this.power);
            const markerAngle = Math.PI / 2 + displayPower * Math.PI;
            const isRedSweep = this.stage === 'POWER_UP' || this.stage === 'POWER_RED_DOWN';
            const redPower = isRedSweep ? this.power : this.selectedPower;
            const redAngle = Math.PI / 2 + redPower * Math.PI;
            const ringR = r - 25;
            const drawTick = (value, color, width, extra = 15) => {
                const angle = Math.PI / 2 + value * Math.PI;
                this.ctx.strokeStyle = 'rgba(11, 7, 5, 0.86)';
                this.ctx.lineWidth = width + 5;
                this.ctx.beginPath();
                this.ctx.moveTo(cx + Math.cos(angle) * (ringR - 12), cy + Math.sin(angle) * (ringR - 12));
                this.ctx.lineTo(cx + Math.cos(angle) * (ringR + extra), cy + Math.sin(angle) * (ringR + extra));
                this.ctx.stroke();
                this.ctx.strokeStyle = color;
                this.ctx.lineWidth = width;
                this.ctx.beginPath();
                this.ctx.moveTo(cx + Math.cos(angle) * (ringR - 12), cy + Math.sin(angle) * (ringR - 12));
                this.ctx.lineTo(cx + Math.cos(angle) * (ringR + extra), cy + Math.sin(angle) * (ringR + extra));
                this.ctx.stroke();
            };
            const drawCenterTick = (value) => {
                const angle = Math.PI / 2 + value * Math.PI;
                this.ctx.strokeStyle = '#ffffff';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                this.ctx.moveTo(cx + Math.cos(angle) * (ringR - 16), cy + Math.sin(angle) * (ringR - 16));
                this.ctx.lineTo(cx + Math.cos(angle) * (ringR + 20), cy + Math.sin(angle) * (ringR + 20));
                this.ctx.stroke();
            };

            this.ctx.strokeStyle = 'rgba(11, 7, 5, 0.82)';
            this.ctx.lineWidth = 20;
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, ringR, Math.PI / 2, Math.PI * 1.5);
            this.ctx.stroke();

            this.ctx.strokeStyle = 'rgba(78, 39, 96, 0.58)';
            this.ctx.lineWidth = 14;
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, ringR, Math.PI / 2, Math.PI * 1.5);
            this.ctx.stroke();

            this.ctx.strokeStyle = '#ff4f45';
            this.ctx.lineWidth = 13;
            this.ctx.beginPath();
            this.ctx.arc(cx, cy, ringR, Math.PI / 2, redAngle);
            this.ctx.stroke();

            if (this.stage === 'POWER_RETURN_UP' || this.stage === 'POWER_DOWN' || this.stage === 'OFF') {
                this.ctx.strokeStyle = '#38d9ff';
                this.ctx.lineWidth = 9;
                this.ctx.beginPath();
                this.ctx.arc(cx, cy, ringR, Math.PI / 2, markerAngle);
                this.ctx.stroke();
            }

            drawTick(THREE.MathUtils.clamp(this.accuracyLine - this.gutterWindow, 0, 1), '#ff4f45', 4, 12);
            drawTick(THREE.MathUtils.clamp(this.accuracyLine - this.safeWindow, 0, 1), '#ff9b45', 5, 13);
            drawTick(this.accuracyLine, '#ffe16a', 9, 19);
            drawCenterTick(this.accuracyLine);
            drawTick(THREE.MathUtils.clamp(this.accuracyLine + this.safeWindow, 0, 1), '#ff9b45', 5, 13);
            drawTick(THREE.MathUtils.clamp(this.accuracyLine + this.gutterWindow, 0, 1), '#ff4f45', 4, 12);

            this.ctx.fillStyle = 'rgba(11, 7, 5, 0.86)';
            this.ctx.beginPath();
            this.ctx.arc(cx + Math.cos(markerAngle) * ringR, cy + Math.sin(markerAngle) * ringR, 10, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.fillStyle = isRedSweep ? '#ff4f45' : '#38d9ff';
            this.ctx.beginPath();
            this.ctx.arc(cx + Math.cos(markerAngle) * ringR, cy + Math.sin(markerAngle) * ringR, 7, 0, Math.PI * 2);
            this.ctx.fill();
        }
        this.ctx.restore();
    }

    drawMobileGauge() {
        const control = document.getElementById('mobile-gauge-control');
        if (!control) return;

        const fill = document.getElementById('mobile-gauge-fill');
        const sweep = document.getElementById('mobile-gauge-sweep');
        const target = document.getElementById('mobile-gauge-target');
        const hint = document.getElementById('mobile-gauge-hint');
        const value = document.getElementById('mobile-gauge-value');
        if (!fill || !sweep || !target || !hint || !value) return;

        const isPower = this.stage === 'POWER_UP' || this.stage === 'POWER_RED_DOWN';
        const isTiming = this.stage === 'POWER_RETURN_UP' || this.stage === 'POWER_DOWN';
        const isRolling = this.stage === 'OFF' && (GAME.state === 'BALL_ROLLING' || GAME.state === 'ROLL_SETTLING' || GAME.state === 'ROUND_OVER');
        const showMeter = isPower || isTiming || isRolling;
        const displayPower = isRolling ? this.landedPower : isTiming ? this.timingPower : isPower ? this.power : 0;
        const selectedPower = isTiming || isRolling ? this.selectedPower : isPower ? this.power : 0;
        const bottom = `${THREE.MathUtils.clamp(displayPower, 0, 1) * 100}%`;
        const selectedBottom = `${THREE.MathUtils.clamp(selectedPower, 0, 1) * 100}%`;
        const targetBottom = `${THREE.MathUtils.clamp(this.accuracyLine, 0, 1) * 100}%`;

        control.dataset.stage = this.stage.toLowerCase().replace(/_/g, '-');
        fill.style.height = isPower ? selectedBottom : showMeter ? selectedBottom : '0%';
        fill.style.opacity = showMeter ? '1' : '0.18';
        sweep.style.bottom = showMeter ? bottom : '50%';
        sweep.style.opacity = showMeter ? '1' : '0';
        target.style.bottom = targetBottom;

        if (this.stage === 'AIM') {
            hint.innerText = 'Drag / Tap';
        } else if (isPower) {
            hint.innerText = 'Lock';
        } else if (isTiming) {
            hint.innerText = 'Release';
        } else if (this.stage === 'OFF') {
            hint.innerText = GAME.state === 'MAIN_METER' ? 'Tap' : 'Roll';
        }
    }
}

const gauge = new RetroGauge('gauge-canvas');

function startPractice(frame = 1) {
    clearRollWatchdog();
    clearTimeout(GAME.stats.reviewTimer);
    GAME.stats.reviewTimer = null;
    GAME.mode = 'practice';
    GAME.paused = false;
    GAME.saveSlot = null;
    GAME.frame = Number(frame);
    GAME.cash = 0;
    GAME.currentRoute = { ...ROUTE_TYPES.STANDARD };
    GAME.activeUpgrades = defaultActiveUpgrades();
    GAME.activeUpgrades.goldPinChance = 0;
    GAME.activeUpgrades.bouncyPinChance = 0;
    GAME.activeUpgrades.explosivePinChance = document.getElementById('practice-specials').checked ? 0.15 : 0;
    GAME.runModifiers = defaultRunModifiers();
    document.getElementById('practice-rack').value = String(frame);
    document.querySelectorAll('[data-practice-frame]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.practiceFrame) === GAME.frame)));
    for (const id of ['main-menu', 'roguelike-hub-screen', 'route-screen', 'event-screen', 'shop-screen', 'game-over-screen', 'pause-screen', 'center-message']) document.getElementById(id)?.classList.add('hidden');
    clearScoreCelebrationClasses();
    releaseFeedbackUntil = 0;
    sfx.init();
    startFrame();
    GAME.targetScore = GAME.stats.pinsSpawned;
    GAME.rollsLeft = GAME.stats.maxRollsThisFrame = 2;
    updateUI();
}

let lastShotLabel = '';
function updateGameplayHud() {
    const active = ['MAIN_METER', 'BALL_ROLLING', 'ROLL_SETTLING'].includes(GAME.state) && !GAME.paused && !debugState.active;
    setIfChanged(document.getElementById('practice-toolbar'), 'hidden', GAME.mode !== 'practice' || !active);
    setIfChanged(document.body.dataset, 'playing', String(active));
    setIfChanged(document.body.dataset, 'practice', String(GAME.mode === 'practice'));
    const feedback = document.getElementById('release-feedback');
    setIfChanged(feedback, 'hidden', !active || performance.now() > releaseFeedbackUntil);
    if (!feedback.hidden && feedback.textContent !== releaseFeedback) feedback.textContent = releaseFeedback;
    if (!active) return;
    const power = ['POWER_UP', 'POWER_RED_DOWN'].includes(gauge.stage);
    const timing = ['POWER_DOWN', 'POWER_RETURN_UP'].includes(gauge.stage);
    const aiming = GAME.state === 'MAIN_METER' && gauge.stage === 'AIM';
    const ready = GAME.state === 'ROLL_SETTLING' && GAME.stats.canContinueRoll;
    const label = aiming ? 'aim' : power ? 'power' : timing ? 'timing' : ready ? 'ready' : 'rolling';
    setIfChanged(document.getElementById('control-hud-row').dataset, 'stage', label);
    if (lastShotLabel !== label) {
        document.getElementById('meter-caption').textContent = {
            aim: '01 / SET YOUR LINE', power: '02 / LOCK YOUR POWER',
            timing: '03 / HIT THE GOLD', ready: 'SPACE TO CONTINUE', rolling: 'MAKE SOME NOISE'
        }[label];
        lastShotLabel = label;
    }
    for (const id of ['btn-aim-left', 'btn-aim-right']) setIfChanged(document.getElementById(id), 'disabled', !aiming);
    setIfChanged(document.getElementById('btn-camera-view'), 'disabled', GAME.state !== 'MAIN_METER' || GAME.paused || debugState.active);
}

function bindInputs() {
    renderStarterChoices();
    bindEquipmentNavigation(document.getElementById('roguelike-run-screen'));
    document.getElementById('ball-bag-buttons').addEventListener('keydown', event => {
        if (event.code === 'Space' || event.code === 'Enter') event.stopPropagation();
    });
    document.getElementById('ball-bag-buttons').addEventListener('click', event => {
        const button = event.target.closest('[data-ball-index]');
        if (button) selectLoadoutBall(Number(button.dataset.ballIndex));
    });
    const tutorial = document.querySelector('.tutorial-grid');
    const lessons = [
        ['01 / PICK A LANE', 'steer_ball', 'Twelve frames. Choose a route, then make it yours.'],
        ['02 / BEAT THE TARGET', 'gold_pins', 'Reach the pin target before your throws run out.'],
        ['03 / BUILD YOUR BALL', 'heavy_ball', 'Buy gear between frames. Reroll for fresh stock.'],
        ['04 / FACE THE HOUSE', 'trophy', 'Bosses wait on frames 4, 8, and 12. Read their rules.'],
        ['05 / PACK A KEEPSAKE', 'practice_frame', 'Pick one relic before the run for a special edge.'],
        ['06 / COME BACK FOR MORE', 'record', 'Choose a save slot. The circuit saves your progress.']
    ];
    if (tutorial) tutorial.innerHTML = lessons.map(([title, art, line]) => `<article><span class="tutorial-art">${cabinetArt(art)}</span><b>${title}</b><p>${line}</p></article>`).join('');
    document.getElementById('btn-close-shop-inspect').addEventListener('click', () => closeShopInspector());
    document.getElementById('shop-inspect-screen').addEventListener('click', event => {
        if (event.target.id === 'shop-inspect-screen') closeShopInspector();
    });
    document.getElementById('shop-inspect-screen').addEventListener('keydown', event => {
        containDialogTab(event, event.currentTarget);
    });
    if (window.ResizeObserver) {
        routeMapResizeObserver = new ResizeObserver(() => {
            if (GAME.state === 'ROUTE') drawRouteMapLines();
        });
        routeMapResizeObserver.observe(document.getElementById('route-map-stage'));
    }
    document.getElementById('btn-practice-lane').addEventListener('click', () => startPractice());
    document.getElementById('practice-rack').addEventListener('change', event => startPractice(Number(event.target.value)));
    document.getElementById('practice-specials').addEventListener('change', () => startPractice(GAME.frame));
    document.getElementById('practice-reset').addEventListener('click', () => startPractice(GAME.frame));
    document.getElementById('practice-exit').addEventListener('click', returnToMainMenu);
    document.querySelectorAll('[data-practice-frame]').forEach(button => {
        button.addEventListener('click', () => startPractice(Number(button.dataset.practiceFrame)));
    });
    document.getElementById('btn-aim-left').addEventListener('click', () => gauge.nudgeAim(-1));
    document.getElementById('btn-aim-right').addEventListener('click', () => gauge.nudgeAim(1));
    document.getElementById('gauge-canvas').addEventListener('keydown', event => {
        if (event.code === 'Enter' && !event.repeat) {
            event.preventDefault();
            event.stopPropagation();
            triggerLaunchClick();
        }
    });
    window.addEventListener('keydown', (e) => {
        if (e.code === 'F1' || e.code === 'Backquote') {
            e.preventDefault();
            toggleDebugMode();
            return;
        }
        if (e.code === 'KeyP') {
            e.preventDefault();
            toggleFpsCounter();
            return;
        }
        if (e.code === 'KeyO') {
            e.preventDefault();
            toggleDebugActions();
            return;
        }
        if (debugState.active && e.code === 'KeyR') {
            e.preventDefault();
            openDailyReviewDebug();
            return;
        }
        if (debugState.active) {
            debugState.flyKeys[e.code] = true;
            if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'Space', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
                e.preventDefault();
            }
            return;
        }
        if (e.code === 'Escape') {
            e.preventDefault();
            if (closeTopmostOverlay()) return;
            togglePause();
            return;
        }
        if (GAME.paused) return;
        if (e.code === 'Space') {
            if (e.target.closest?.('input, select, textarea, [contenteditable="true"]')) return;
            if (e.target.closest?.('button, [role="button"], summary') && !e.target.closest('#game-hud')) return;
            e.preventDefault();
            if (e.repeat) return;
            triggerLaunchClick();
            return;
        }
        if (e.code === 'KeyV' && !e.repeat && GAME.state === 'MAIN_METER') {
            e.preventDefault();
            togglePreRollView();
            return;
        }
        if (GAME.state === 'MAIN_METER' && gauge.stage === 'AIM') {
            if (e.code === 'KeyQ') { e.preventDefault(); gauge.nudgeAim(-1); }
            if (e.code === 'KeyE') { e.preventDefault(); gauge.nudgeAim(1); }
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
                e.preventDefault();
                moveLaunchPosition(-1);
            }
            if (e.code === 'ArrowRight' || e.code === 'KeyD') {
                e.preventDefault();
                moveLaunchPosition(1);
            }
        }
        if (GAME.state === 'BALL_ROLLING') {
            if (e.code === 'ArrowLeft' || e.code === 'KeyA') applyBallSteer(-1);
            if (e.code === 'ArrowRight' || e.code === 'KeyD') applyBallSteer(1);
        }
    });

    window.addEventListener('keyup', (e) => {
        debugState.flyKeys[e.code] = false;
    });

    document.addEventListener('pointerlockchange', () => {
        debugState.pointerLocked = document.pointerLockElement === renderer?.domElement;
    });

    document.addEventListener('mousemove', (e) => {
        if (!debugState.active || !debugState.pointerLocked) return;
        debugState.flyYaw -= e.movementX * 0.0025;
        debugState.flyPitch = THREE.MathUtils.clamp(debugState.flyPitch - e.movementY * 0.0025, -1.45, 1.45);
    });

    document.getElementById('canvas-container').addEventListener('click', () => {
        if (!debugState.active || !renderer?.domElement?.requestPointerLock) return;
        renderer.domElement.requestPointerLock();
    });

    let meterDragStart = null;
    let meterDragged = false;
    document.getElementById('gauge-canvas').addEventListener('pointerdown', (e) => {
        if (GAME.state !== 'MAIN_METER' || gauge.stage !== 'AIM') return;
        meterDragStart = { x: e.clientX, y: e.clientY };
        meterDragged = false;
    });

    document.getElementById('gauge-canvas').addEventListener('pointermove', (e) => {
        if (!meterDragStart || GAME.state !== 'MAIN_METER' || gauge.stage !== 'AIM') return;
        const dx = e.clientX - meterDragStart.x;
        const dy = e.clientY - meterDragStart.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= 9 && !meterDragged) return;
        meterDragged = true;
        gauge.setAimFromPointer(e);
    });

    window.addEventListener('pointerup', () => {
        meterDragStart = null;
    });

    document.getElementById('gauge-canvas').addEventListener('click', (e) => {
        e.stopPropagation();
        if (meterDragged) {
            meterDragged = false;
            return;
        }
        triggerLaunchClick();
    });

    const mobileGaugeControl = document.getElementById('mobile-gauge-control');
    let mobileGaugeDragStart = null;
    let mobileGaugeDragged = false;
    mobileGaugeControl?.addEventListener('pointerdown', (e) => {
        if (GAME.state !== 'MAIN_METER' || gauge.stage !== 'AIM') return;
        mobileGaugeDragStart = { x: e.clientX, y: e.clientY };
        mobileGaugeDragged = false;
    });
    mobileGaugeControl?.addEventListener('pointermove', (e) => {
        if (!mobileGaugeDragStart || GAME.state !== 'MAIN_METER' || gauge.stage !== 'AIM') return;
        const dx = e.clientX - mobileGaugeDragStart.x;
        const dy = e.clientY - mobileGaugeDragStart.y;
        const distance = Math.hypot(dx, dy);
        if (distance <= 8 && !mobileGaugeDragged) return;
        mobileGaugeDragged = true;
        gauge.setAimFromPointer(e);
    });
    window.addEventListener('pointerup', () => {
        mobileGaugeDragStart = null;
    });
    mobileGaugeControl?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (mobileGaugeDragged) {
            mobileGaugeDragged = false;
            return;
        }
        triggerLaunchClick();
    });
    mobileGaugeControl?.addEventListener('keydown', (e) => {
        if (e.code === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            triggerLaunchClick();
        }
    });

    document.getElementById('btn-camera-view').addEventListener('click', (e) => {
        e.stopPropagation();
        togglePreRollView();
    });
    document.getElementById('btn-roll-action').addEventListener('click', (e) => {
        e.stopPropagation();
        triggerLaunchClick();
    });

    document.getElementById('btn-debug-mode').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleDebugMode();
    });

    document.getElementById('btn-steer-left').addEventListener('click', () => handleAimOrSteer(-1));
    document.getElementById('btn-steer-right').addEventListener('click', () => handleAimOrSteer(1));

    document.getElementById('debug-actions-screen').addEventListener('click', (e) => {
        const actionButton = e.target.closest('[data-debug-action]');
        if (actionButton) {
            runDebugAction(actionButton.dataset.debugAction);
            return;
        }
        if (e.target.id === 'debug-actions-screen') {
            toggleDebugActions(false);
        }
    });

    document.addEventListener('mouseover', (e) => {
        const keyword = e.target.closest('.vocab-keyword');
        if (!keyword) return;
        showVocabTooltip(e, keyword);
    });
    document.addEventListener('mousemove', (e) => {
        if (!e.target.closest('.vocab-keyword')) return;
        moveVocabTooltip(e);
    });
    document.addEventListener('mouseout', (e) => {
        if (!e.target.closest('.vocab-keyword')) return;
        hideVocabTooltip();
    });

    document.getElementById('btn-start-game').addEventListener('click', () => {
        sfx.playStrike();
        updateMainMenuMeta();
        document.getElementById('roguelike-run-screen').classList.remove('hidden');
        document.querySelector('[data-equipment-slot="0"]')?.focus({ preventScroll: true });
    });
    document.getElementById('btn-start-run-hub').addEventListener('click', () => {
        sfx.playStrike();
        startRunInSlot(defaultStartRunSlot());
    });
    document.getElementById('run-seed-input')?.addEventListener('keydown', (e) => {
        if (e.code !== 'Enter') return;
        e.preventDefault();
        sfx.playStrike();
        startRunInSlot(defaultStartRunSlot());
    });
    document.getElementById('btn-start-daily-run-hub').addEventListener('click', () => {
        startDailyRunFromMenu();
    });
    document.getElementById('btn-start-daily-panel')?.addEventListener('click', () => {
        startDailyRunFromMenu();
    });
    document.getElementById('daily-score-card')?.addEventListener('click', () => {
        showDailyOverview();
    });
    document.getElementById('btn-review-dailies')?.addEventListener('click', () => {
        openDailyReviewDebug();
    });
    document.getElementById('btn-close-roguelike-run').addEventListener('click', () => {
        document.getElementById('roguelike-run-screen').classList.add('hidden');
        document.getElementById('btn-start-game').focus({ preventScroll: true });
    });
    document.getElementById('btn-how-to-play-hub').addEventListener('click', () => {
        showRoguelikeHubDetail('howto');
    });
    document.getElementById('btn-relic-shelf-hub').addEventListener('click', () => {
        showRoguelikeHubDetail('relics');
    });
    document.getElementById('btn-stats-screen-hub').addEventListener('click', () => {
        showRoguelikeHubDetail('stats');
    });

    document.getElementById('btn-start-tenpin').addEventListener('click', () => {
        sfx.playStrike();
        resetTenPinState(document.getElementById('tenpin-special-toggle')?.checked !== false, document.getElementById('tenpin-full-bag-toggle')?.checked !== false);
        document.getElementById('main-menu').classList.add('hidden');
        startTenPinGame();
    });

    document.getElementById('btn-next-frame').addEventListener('click', () => {
        sfx.playCoin();
        if (isTenPinMode()) {
            document.getElementById('shop-screen').classList.add('hidden');
            if (shouldShowManualRack()) {
                showManualRackScreen();
            } else {
                startTenPinFrame();
            }
            return;
        }
        showRouteMap();
    });

    document.getElementById('score-hud-panel').addEventListener('click', () => {
        if (isTenPinMode()) showTenPinScoreboard();
    });
    document.getElementById('score-hud-panel').addEventListener('keydown', (event) => {
        if (!isTenPinMode() || !['Enter', 'Space'].includes(event.code) || event.repeat) return;
        event.preventDefault();
        event.stopPropagation();
        showTenPinScoreboard();
    });
    document.getElementById('btn-close-scoreboard').addEventListener('click', hideTenPinScoreboard);
    document.getElementById('btn-tenpin-reroll-shop').addEventListener('click', () => {
        if (!isTenPinMode() || GAME.tenPin.fullBag) return;
        const cost = tenPinShopRerollCost();
        if (GAME.cash < cost) {
            showAlert('Not enough pin dollars');
            return;
        }
        GAME.cash -= cost;
        GAME.tenPin.shopRerolls++;
        sfx.playCoin();
        chooseTenPinShopSelection(true);
        renderTenPinShop();
        updateUI();
    });
    document.getElementById('btn-shop-reroll').addEventListener('click', () => {
        if (isTenPinMode() || GAME.state !== 'SHOP') return;
        const cost = Math.max(0, shopRerollCost() - shopRerollDiscount());
        if (GAME.cash < cost) {
            showAlert('Not enough pin dollars');
            return;
        }
        GAME.cash -= cost;
        if (GAME.selectedRelic === 'reroll_coupon' && !GAME.relicsUsed.rerollCoupon) {
            GAME.relicsUsed.rerollCoupon = true;
            showSpecialUseOverlay('Reroll Coupon', 'First shop reroll is covered by your relic.', 'fa-rotate');
        }
        GAME.shopRerolls++;
        GAME.shopSoldOut = [];
        GAME.shopSelection = chooseShopSelection({ excludeIds: GAME.shopSelection }).map(item => item.id);
        sfx.playCoin();
        showAlert('Shop rerolled');
        triggerShopTransition();
        updateUI();
    });
    document.getElementById('btn-how-to-play').addEventListener('click', () => showHowToPlayInCenter(0));
    document.getElementById('btn-close-tutorial').addEventListener('click', () => document.getElementById('tutorial-screen').classList.add('hidden'));
    document.getElementById('btn-relic-shelf').addEventListener('click', () => {
        showMenuRelicsInCenter();
    });
    document.getElementById('btn-close-relics').addEventListener('click', () => {
        document.getElementById('relic-screen').classList.add('hidden');
        updateMainMenuMeta();
    });
    document.getElementById('btn-stats-screen').addEventListener('click', () => {
        showMenuStatsInCenter();
    });
    document.getElementById('btn-close-stats').addEventListener('click', () => document.getElementById('stats-screen').classList.add('hidden'));
    document.getElementById('btn-start-boss').addEventListener('click', () => {
        document.getElementById('boss-intro-screen').classList.add('hidden');
        startFrame();
    });
    document.querySelectorAll('[data-save-slot]').forEach(button => {
        button.addEventListener('click', () => saveRunToSlot(Number(button.dataset.saveSlot)));
    });
    document.getElementById('tenpin-scoreboard-screen').addEventListener('click', (event) => {
        if (event.target.id === 'tenpin-scoreboard-screen') hideTenPinScoreboard();
    });
    document.getElementById('btn-clear-manual-rack').addEventListener('click', () => {
        GAME.tenPin.manualRackAssignments = Array(10).fill(null);
        GAME.tenPin.manualRackSelectedIndex = 0;
        renderManualRackScreen();
    });
    document.getElementById('btn-confirm-manual-rack').addEventListener('click', () => {
        if (!manualRackIsComplete()) {
            showAlert('Place every bought pin');
            return;
        }
        document.getElementById('tenpin-rack-screen').classList.add('hidden');
        startTenPinFrame();
    });

    document.getElementById('btn-restart').addEventListener('click', () => {
        resetRun();
    });

    document.getElementById('btn-resume').addEventListener('click', () => togglePause(false));
    document.getElementById('btn-pause-restart').addEventListener('click', () => {
        togglePause(false);
        resetRun();
    });
    document.getElementById('btn-open-legend-menu').addEventListener('click', () => showLegend());
    document.getElementById('btn-pause-legend').addEventListener('click', () => showLegend());
    document.getElementById('btn-close-legend').addEventListener('click', hideLegend);
    document.getElementById('btn-main-quit').addEventListener('click', requestNativeQuit);
    document.getElementById('btn-pause-quit').addEventListener('click', requestNativeQuit);
    document.getElementById('legend-screen').addEventListener('click', (event) => {
        if (event.target.id === 'legend-screen') hideLegend();
        const tabButton = event.target.closest('[data-legend-tab]');
        if (tabButton) showLegend(tabButton.dataset.legendTab);
    });
    document.getElementById('btn-main-menu').addEventListener('click', () => returnToMainMenu());
    bindVolumeControls();

    window.addEventListener('click', (event) => {
        if (GAME.paused || debugState.active) return;
        if (!event.target.closest('#canvas-container, #game-hud')) return;
        if (event.target.closest('button, input, select, textarea, a, [role="button"], #score-hud-panel')) return;
        if (GAME.state === 'MAIN_METER' || GAME.state === 'ROLL_SETTLING') triggerLaunchClick();
    });
}

function bindVolumeControls() {
    [
        ['master', 'vol-master', 'vol-master-label'],
        ['music', 'vol-music', 'vol-music-label'],
        ['alley', 'vol-alley', 'vol-alley-label'],
        ['effects', 'vol-effects', 'vol-effects-label']
    ].forEach(([kind, inputId, labelId]) => {
        const input = document.getElementById(inputId);
        const label = document.getElementById(labelId);
        const update = () => {
            const value = Number(input.value);
            label.innerText = `${value}%`;
            sfx.setVolume(kind, value / 100);
        };
        input.addEventListener('input', update);
        update();
    });
}

function togglePause(forceState = null) {
    if (GAME.state === 'TITLE' || GAME.state === 'GAMEOVER') return;
    GAME.paused = forceState === null ? !GAME.paused : forceState;
    document.getElementById('pause-screen').classList.toggle('hidden', !GAME.paused);
    if (GAME.paused) {
        document.querySelector('#pause-screen .save-slots').hidden = isTenPinMode();
        GAME.pauseBlockedState = GAME.state;
        sfx.stopBallRoll();
        autoSaveRunSlot();
        updateSeedDisplays();
    } else if (GAME.state === 'BALL_ROLLING') {
        sfx.startBallRoll();
    }
}

function toggleDebugActions(forceState = null) {
    const screen = document.getElementById('debug-actions-screen');
    const shouldShow = forceState === null ? screen.classList.contains('hidden') : forceState;
    screen.classList.toggle('hidden', !shouldShow);
}

function runDebugAction(action) {
    toggleDebugActions(false);
    if (action === 'gameplayLab') {
        if (GAME.mode !== 'roguelike' || GAME.state === 'TITLE' || GAME.state === 'GAMEOVER') return;
        removeBallFromWorld();
        GAME.shopSelection = ['ball_trait_pearl', 'ball_trait_anchor', 'gutters'];
        GAME.shopSoldOut = [];
        GAME.cash += 100;
        triggerShopTransition();
        return;
    }
    if (action === 'gutterMaw') {
        if (GAME.mode !== 'roguelike' || !['MAIN_METER', 'SHOP', 'ROUTE'].includes(GAME.state)) return;
        removeBallFromWorld();
        GAME.currentRoute = { ...BOSS_VARIANTS[8].find(route => route.id === 'boss_gutter_maw') };
        GAME.frame = 8;
        for (const id of ['shop-screen', 'route-screen', 'boss-intro-screen']) document.getElementById(id).classList.add('hidden');
        startFrame();
        return;
    }
    if (action === 'eventGallery') {
        for (const id of ['main-menu', 'roguelike-run-screen', 'legend-screen', 'pause-screen', 'game-over-screen']) document.getElementById(id).classList.add('hidden');
        startNewRun();
        GAME.frame = 5;
        GAME.cash = 18;
        const event = EVENT_TYPES[debugEventIndex++ % EVENT_TYPES.length];
        GAME.currentRoute = { id: `event_${event.id}`, name: event.name, event: true, eventId: event.id };
        showEventScreen(GAME.currentRoute);
        updateUI();
        return;
    }
    if (action === 'pocketShot') {
        if (GAME.state !== 'MAIN_METER' || !ballBody) return;
        gauge.selectedPower = 0.9;
        gauge.timingPower = gauge.accuracyLine;
        gauge.aimAngle = 0;
        gauge.launch();
        return;
    }
    if (action === 'lose') {
        endRun(false);
        return;
    }
    if (action === 'score500') {
        GAME.score += 500;
        GAME.cumulativeScore += 500;
        GAME.cash += 100;
        showAlert('+500 points / +100 pin dollars');
        updateUI();
        return;
    }
    if (action === 'cash100') {
        GAME.cash += 100;
        showAlert('+100 pin dollars');
        updateUI();
        return;
    }
    if (action === 'route') {
        if (GAME.state === 'TITLE') startNewRun();
        document.getElementById('event-screen').classList.add('hidden');
        document.getElementById('shop-screen').classList.add('hidden');
        document.getElementById('game-over-screen').classList.add('hidden');
        showRouteMap();
        return;
    }
    if (action === 'dailyReview') {
        openDailyReviewDebug();
        showAlert('Daily review calendar');
        return;
    }
    if (action === 'shop' || action === 'winFrame') {
        if (GAME.state === 'TITLE') startNewRun();
        GAME.score = Math.max(GAME.score, GAME.targetScore);
        showAlert(action === 'shop' ? 'Skipped to shop' : 'Frame cleared');
        triggerShopTransition();
        updateUI();
        return;
    }
    if (action === 'freshRack') {
        if (world && GAME.state !== 'TITLE' && GAME.state !== 'GAMEOVER') {
            generatePinGrid(GAME.frame);
            showAlert('Fresh rack');
            updateUI();
        }
        return;
    }
    if (action === 'bossShowdown' || action === 'finalShowdown') {
        document.getElementById('main-menu').classList.add('hidden');
        startNewRun();
        GAME.frame = action === 'finalShowdown' ? 11 : 3;
        GAME.cash = 30;
        GAME.completedNodes = GAME.routeMap.slice(0, GAME.frame).map(row => row[0].id);
        showRouteMap();
        return;
    }
    if (action === 'stressRack') {
        startPractice(12);
        return;
    }
    if (action === 'gutter') {
        debugGutterThrow();
    }
}

function debugGutterThrow() {
    if (!['MAIN_METER', 'BALL_ROLLING', 'ROLL_SETTLING', 'ROUND_OVER'].includes(GAME.state)) return;
    clearRollWatchdog();
    clearTimeout(GAME.stats.reviewTimer);
    GAME.stats.reviewTimer = null;
    sfx.stopBallRoll();
    activeHook = 0;
    if (ballBody) {
        ballBody.velocity.set(0, 0, 0);
        ballBody.angularVelocity.set(0, 0, 0);
        ballBody.sleep();
    }
    if (GAME.state === 'MAIN_METER' || GAME.state === 'ROUND_OVER') {
        GAME.rollsLeft = Math.max(0, GAME.rollsLeft - 1);
        GAME.stats.rollsThisFrame++;
    }
    GAME.stats.currentRollScore = 0;
    GAME.stats.currentRollPins = 0;
    GAME.stats.currentRollBonusScore = 0;
    if (!GAME.stats.rollRecorded) {
        GAME.stats.rollScores.push(0);
        GAME.stats.rollRecorded = true;
    }
    document.getElementById('center-message').classList.add('hidden');
    GAME.state = 'ROUND_OVER';
    updateUI();
    showAlert('Gutter ball');
    if (GAME.rollsLeft <= 0) {
        endRun(false);
    } else {
        prepareNextRoll(false);
    }
}

function showVocabTooltip(event, keywordEl) {
    const key = keywordEl.dataset.vocab;
    const vocab = VOCABULARY[key];
    const tooltip = document.getElementById('vocab-tooltip');
    if (!vocab || !tooltip) return;
    const title = tooltip.querySelector('strong');
    const body = tooltip.querySelector('span');
    title.innerText = vocab.label;
    title.style.color = vocab.color;
    body.innerText = vocab.desc;
    tooltip.classList.remove('hidden');
    moveVocabTooltip(event);
}

function moveVocabTooltip(event) {
    const tooltip = document.getElementById('vocab-tooltip');
    if (!tooltip || tooltip.classList.contains('hidden')) return;
    const padding = 16;
    const box = tooltip.getBoundingClientRect();
    const x = Math.min(window.innerWidth - box.width - padding, event.clientX + 16);
    const y = Math.min(window.innerHeight - box.height - padding, event.clientY + 16);
    tooltip.style.left = `${Math.max(padding, x)}px`;
    tooltip.style.top = `${Math.max(padding, y)}px`;
}

function hideVocabTooltip() {
    const tooltip = document.getElementById('vocab-tooltip');
    if (tooltip) tooltip.classList.add('hidden');
}

function loadRunSlots() {
    try {
        const slots = JSON.parse(localStorage.getItem(RUN_SAVE_KEY) || '[]');
        return Array.from({ length: MAX_RUN_SLOTS }, (_, index) => slots[index] || null);
    } catch {
        return Array(MAX_RUN_SLOTS).fill(null);
    }
}

function saveRunSlots(slots) {
    localStorage.setItem(RUN_SAVE_KEY, JSON.stringify(Array.from({ length: MAX_RUN_SLOTS }, (_, index) => slots[index] || null)));
}

function firstAvailableRunSlot() {
    const slots = loadRunSlots();
    return slots.findIndex(slot => !slot);
}

function defaultStartRunSlot() {
    const firstEmpty = firstAvailableRunSlot();
    return firstEmpty >= 0 ? firstEmpty : 0;
}

function autoSaveRunSlot(reason = 'autosave') {
    if (isTenPinMode() || GAME.saveSlot === null || GAME.saveSlot === undefined) return;
    if (GAME.state === 'TITLE' || GAME.state === 'GAMEOVER') return;
    const slots = loadRunSlots();
    slots[GAME.saveSlot] = snapshotRun();
    saveRunSlots(slots);
    renderRunSlots();
    if (reason === 'manual') showAlert(`Saved slot ${GAME.saveSlot + 1}`);
}

function clearRunSlot(index) {
    if (index === null || index === undefined) return;
    const slots = loadRunSlots();
    slots[index] = null;
    saveRunSlots(slots);
    renderRunSlots();
}

function loadProfile() {
    const fallback = {
        selectedRelic: 'last_frame_token',
        runs: [],
        tenPinGames: [],
        wins: 0,
        bestRunScore: 0,
        bestTenPin: 0,
        dailyRuns: [],
        bossesBeaten: {}
    };
    try {
        const profile = { ...fallback, ...JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') };
        profile.runs = Array.isArray(profile.runs) ? profile.runs : [];
        profile.tenPinGames = Array.isArray(profile.tenPinGames) ? profile.tenPinGames : [];
        profile.dailyRuns = Array.isArray(profile.dailyRuns) ? profile.dailyRuns : [];
        profile.bossesBeaten = profile.bossesBeaten && typeof profile.bossesBeaten === 'object' ? profile.bossesBeaten : {};
        return profile;
    } catch {
        return fallback;
    }
}

function saveProfile(profile) {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

function dailyHistory(profile = loadProfile()) {
    return (profile.dailyRuns || []).filter(entry => entry?.seed);
}

function todayDailyEntries(profile = loadProfile()) {
    const seed = dailySeed();
    return dailyHistory(profile).filter(entry => entry.seed === seed);
}

function bestDailyEntry(seed = dailySeed(), profile = loadProfile()) {
    return dailyHistory(profile)
        .filter(entry => entry.seed === seed)
        .sort((a, b) => (b.score || 0) - (a.score || 0))[0] || null;
}

function dailySeed(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dailyDateFromOffset(offset = 0) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offset);
    return date;
}

function formatDailyDisplayDate(seed = dailySeed()) {
    const [year, month, day] = seed.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
    }).toUpperCase();
}

function hashString(value) {
    let hash = 2166136261;
    for (let i = 0; i < value.length; i++) {
        hash ^= value.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function seededRandom(seed) {
    let state = hashString(seed) || 1;
    return () => {
        state = Math.imul(1664525, state) + 1013904223;
        return ((state >>> 0) / 4294967296);
    };
}

function withSeededRandom(seed, fn) {
    const originalRandom = Math.random;
    Math.random = seededRandom(seed);
    try {
        return fn();
    } finally {
        Math.random = originalRandom;
    }
}

function buildSeededRouteMap(seed = runSeedLabel()) {
    return seed ? withSeededRandom(`${seed}:route-map`, buildRouteMap) : buildRouteMap();
}

function normalizeRunSeed(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    const cleaned = raw
        .replace(/\s+/g, '-')
        .replace(/[^a-zA-Z0-9_-]/g, '')
        .replace(/-+/g, '-')
        .replace(/^[-_]+|[-_]+$/g, '')
        .slice(0, 48);
    const hash = hashString(raw).toString(36).toUpperCase();
    return cleaned || `SEED-${hash}`;
}

function createRunSeed() {
    const datePart = new Date().toISOString().slice(2, 10).replace(/-/g, '');
    const randomPart = Math.floor(Math.random() * 0xffffff).toString(36).padStart(5, '0').toUpperCase();
    return `PIN-${datePart}-${randomPart}`;
}

function runSeedLabel() {
    return GAME.runModifiers?.daily?.seed || GAME.runSeed || '';
}

function updateSeedDisplays() {
    const seed = runSeedLabel();
    document.querySelectorAll('#route-seed-chip, #pause-seed-chip').forEach((chip) => {
        const value = chip.querySelector('span');
        if (value) value.innerText = seed;
        chip.classList.toggle('hidden', !seed);
    });
}

function pickDailyItems(pool, count, salt, seed = dailySeed()) {
    return [...pool]
        .map((item, index) => ({ item, rank: hashString(`${seed}:${salt}:${item.id}:${index}`) }))
        .sort((a, b) => a.rank - b.rank)
        .slice(0, count)
        .map(entry => entry.item);
}

function dailyMenuForSeed(seed = dailySeed()) {
    const map = pickDailyItems(DAILY_POOLS.map, 4, 'map', seed);
    const shop = pickDailyItems(DAILY_POOLS.shop, 3, 'shop', seed);
    const pin = pickDailyItems(DAILY_POOLS.pin, 3, 'pin', seed);
    return {
        id: seed,
        seed,
        title: `${map[0]?.name || 'House'} / ${pin[0]?.name || 'Daily'}`,
        map,
        shop,
        pin
    };
}

function currentDailyMenu() {
    return dailyMenuForSeed(dailySeed());
}

function getDailyItemByKey(key) {
    const daily = currentDailyMenu();
    const match = String(key || '').match(/^(map|shop|pin)(\d+)$/);
    if (!match) return null;
    return daily[match[1]]?.[Number(match[2])] || null;
}

function dailyRunModifiersForMenu(daily) {
    const mapMods = daily.map.reduce((mods, item) => {
        mods.targetTax += Number(item.targetTax || 0);
        mods.cashBonus += Number(item.cashBonus || 0);
        mods.specialBoost += Number(item.specialBoost || 0);
        return mods;
    }, { targetTax: 0, cashBonus: 0, specialBoost: 0 });
    const pinSpecialBoost = daily.pin.reduce((sum, item) => sum + Number(item.specialBoost || 0), 0);
    return {
        enabled: true,
        seed: daily.seed,
        title: daily.title,
        targetTax: Math.max(-4, mapMods.targetTax),
        cashBonus: Math.min(3, mapMods.cashBonus),
        specialBoost: Math.min(0.07, mapMods.specialBoost + pinSpecialBoost),
        shopUpgradeIds: daily.shop.map(item => item.shopUpgradeId).filter(Boolean),
        shopCategories: daily.shop.map(item => item.shopCategory).filter(Boolean),
        pinBiases: daily.pin.map(item => item.pinBias).filter(Boolean)
    };
}

function dailyRunModifiers() {
    return dailyRunModifiersForMenu(currentDailyMenu());
}

function updateMainMenuMeta() {
    renderRunSlots();
    renderRelicShelf();
    renderSelectedRelicSummary();
    renderDailyPanelMeta();
    showMenuCenterHome();
}

function renderDailyPanelMeta() {
    const daily = currentDailyMenu();
    const best = bestDailyEntry(daily.seed);
    document.querySelectorAll('.daily-icon-card[data-daily-key]').forEach((button) => {
        const item = getDailyItemByKey(button.dataset.dailyKey);
        if (!item) return;
        button.removeAttribute('title');
        button.setAttribute('aria-label', `${item.type}: ${item.name}`);
        button.dataset.dailyTitle = item.name;
        button.dataset.dailyType = item.type;
        button.dataset.dailyDesc = item.desc;
        button.dataset.dailyMechanic = item.mechanic;
        if (!button.dataset.dailyBound) {
            button.addEventListener('mouseenter', () => showMenuDailyDetail(button.dataset.dailyKey));
            button.addEventListener('mouseleave', () => showMenuCenterHome());
            button.addEventListener('focus', () => showMenuDailyDetail(button.dataset.dailyKey));
            button.addEventListener('blur', () => showMenuCenterHome());
            button.addEventListener('click', () => showMenuDailyDetail(button.dataset.dailyKey));
            button.dataset.dailyBound = 'true';
        }
    });
    const summary = document.getElementById('daily-summary');
    if (summary) {
        summary.innerHTML = `
            <span class="daily-summary-title">${escapeHtml(daily.title)}</span>
            <span class="daily-date-chip">${escapeHtml(formatDailyDisplayDate(daily.seed))}</span>
        `;
    }
    const score = document.getElementById('daily-score-card');
    if (score) score.innerText = best ? `Best Today: ${uiNumber(best.score)} / F${best.frames}` : 'Best Today: --';
}

function setDailyIconActive(key) {
    document.querySelectorAll('.daily-icon-card[data-daily-key]').forEach(button => {
        button.classList.toggle('active', button.dataset.dailyKey === key);
    });
}

function menuCenterElement() {
    return document.getElementById('menu-center-content');
}

function showMenuCenterHome() {
    const center = menuCenterElement();
    const stage = document.querySelector('.arcade-center-stage');
    if (!center || !stage) return;
    center.classList.add('hidden');
    center.innerHTML = '';
    stage.classList.remove('is-panel-mode');
    setDailyIconActive(null);
}

function showMenuCenterPanel(markup, activeDailyKey = null) {
    const center = menuCenterElement();
    const stage = document.querySelector('.arcade-center-stage');
    if (!center || !stage) return;
    center.innerHTML = markup;
    center.classList.remove('hidden');
    stage.classList.add('is-panel-mode');
    setDailyIconActive(activeDailyKey);
}

function dailyItemMarkup(item) {
    return `
        <article class="menu-detail-card daily-detail-card">
            <span class="menu-detail-icon"><i class="fa-solid ${escapeHtml(item.icon)}"></i></span>
            <div>
                <span class="menu-detail-kicker">${escapeHtml(item.type)}</span>
                <h2>${escapeHtml(item.name)}</h2>
            </div>
            <p>${escapeHtml(item.desc)}</p>
            <p><b>Plays like:</b> ${escapeHtml(item.mechanic)}</p>
        </article>
    `;
}

function showMenuDailyDetail(key) {
    const item = getDailyItemByKey(key);
    if (!item) return;
    showMenuCenterPanel(dailyItemMarkup(item), key);
}

function dailyLeaderboardMarkup(seed = dailySeed(), profile = loadProfile()) {
    const entries = dailyHistory(profile)
        .filter(entry => entry.seed === seed)
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, 5);
    if (!entries.length) return '<li>No local daily runs yet</li>';
    return entries.map((entry, index) => `<li><b>#${index + 1}</b> ${uiNumber(entry.score)} - Frame ${entry.frames}${entry.victory ? ' - Clear' : ''}</li>`).join('');
}

function showDailyOverview() {
    const daily = currentDailyMenu();
    const best = bestDailyEntry(daily.seed);
    const featured = [...daily.map.slice(0, 2), ...daily.shop.slice(0, 2), ...daily.pin.slice(0, 2)];
    showMenuCenterPanel(`
        <article class="menu-detail-card daily-overview-card">
            <span class="menu-detail-icon"><i class="fa-solid fa-calendar-day"></i></span>
            <div>
                <span class="menu-detail-kicker">Today's Daily Run</span>
                <h2>${escapeHtml(daily.title)}</h2>
            </div>
            <p>Today's seed. The same strange circuit on every attempt.</p>
            <div class="daily-overview-list">
                ${featured.map(item => `<span><i class="fa-solid ${escapeHtml(item.icon)}"></i> ${escapeHtml(item.name)}</span>`).join('')}
            </div>
            <div class="daily-leaderboard">
                <b>Local Leaderboard</b>
                <ol>${dailyLeaderboardMarkup(daily.seed)}</ol>
            </div>
            <div class="daily-detail-actions">
                <span>${best ? `Best today ${uiNumber(best.score)} / Frame ${best.frames}` : "Set today's first local score"}</span>
            </div>
        </article>
    `);
}

function dailyReviewSummary(daily) {
    const mods = dailyRunModifiersForMenu(daily);
    const tags = [
        mods.targetTax ? `Target ${mods.targetTax > 0 ? '+' : ''}${mods.targetTax}` : 'Target even',
        mods.cashBonus ? `Cash +${mods.cashBonus}` : 'No cash bump',
        mods.specialBoost ? `Special +${Math.round(mods.specialBoost * 100)}%` : 'Base pins',
        mods.pinBiases.length ? `Pins ${mods.pinBiases.join('/')}` : 'No pin bias'
    ];
    return { mods, tags };
}

function dailyReviewCardMarkup(dayOffset) {
    const seed = dailySeed(dailyDateFromOffset(dayOffset));
    const daily = dailyMenuForSeed(seed);
    const { mods, tags } = dailyReviewSummary(daily);
    const isToday = dayOffset === 0;
    const shopFocus = [
        ...mods.shopUpgradeIds.map(id => SHOP_UPGRADES.find(item => item.id === id)?.name || id),
        ...mods.shopCategories
    ].slice(0, 3);
    return `
        <article class="daily-review-card ${isToday ? 'today' : ''}">
            <div class="daily-review-card-head">
                <span>${isToday ? 'Today' : dayOffset > 0 ? `+${dayOffset} Days` : `${dayOffset} Days`}</span>
                <b>${escapeHtml(seed)}</b>
            </div>
            <h3>${escapeHtml(daily.title)}</h3>
            <div class="daily-review-tags">${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
            <div class="daily-review-columns">
                <p><b>Route</b>${daily.map.map(item => escapeHtml(item.name)).join('<br>')}</p>
                <p><b>Shop</b>${daily.shop.map(item => escapeHtml(item.name)).join('<br>')}</p>
                <p><b>Pins</b>${daily.pin.map(item => escapeHtml(item.name)).join('<br>')}</p>
            </div>
            <p class="daily-review-note">${shopFocus.length ? `Shop focus: ${escapeHtml(shopFocus.join(', '))}` : 'Shop focus: open mix'}</p>
        </article>
    `;
}

function openDailyReviewDebug() {
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('event-screen').classList.add('hidden');
    document.getElementById('shop-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('debug-actions-screen')?.classList.add('hidden');
    dailyReviewOffset = 0;
    showDailyReviewInCenter();
}

function showDailyReviewInCenter(offset = dailyReviewOffset) {
    dailyReviewOffset = offset;
    const start = dailyReviewOffset;
    const end = dailyReviewOffset + 29;
    const cards = Array.from({ length: 30 }, (_, index) => dailyReviewCardMarkup(start + index)).join('');
    showMenuCenterPanel(`
        <div class="menu-center-header daily-review-header">
            <span>Debug Daily Calendar</span>
            <h2>30 Run Review</h2>
        </div>
        <div class="daily-review-toolbar">
            <button type="button" class="pixel-btn gray-cell" data-daily-review-prev><i class="fa-solid fa-arrow-left"></i> Prev 30</button>
            <span>${start === 0 ? 'Today' : start > 0 ? `+${start}` : start} through ${end > 0 ? `+${end}` : end}</span>
            <button type="button" class="pixel-btn teal-cell" data-daily-review-next>Next 30 <i class="fa-solid fa-arrow-right"></i></button>
        </div>
        <div class="daily-review-grid">${cards}</div>
    `);
    const center = menuCenterElement();
    center?.querySelector('[data-daily-review-prev]')?.addEventListener('click', () => showDailyReviewInCenter(dailyReviewOffset - 30));
    center?.querySelector('[data-daily-review-next]')?.addEventListener('click', () => showDailyReviewInCenter(dailyReviewOffset + 30));
}

function howToArtMarkup(kind) {
    if (kind === 'meter') {
        return `
            <svg class="howto-svg howto-meter-svg" viewBox="0 0 320 220" aria-hidden="true">
                <defs>
                    <linearGradient id="howtoMeterGradient" x1="0" x2="0" y1="1" y2="0">
                        <stop offset="0" stop-color="#20c997"/>
                        <stop offset="0.52" stop-color="#f7d572"/>
                        <stop offset="1" stop-color="#ef4444"/>
                    </linearGradient>
                </defs>
                <rect class="howto-lane" x="42" y="170" width="236" height="20" rx="2"/>
                <rect class="howto-meter-track" x="138" y="26" width="44" height="146" rx="20"/>
                <rect class="howto-meter-fill" x="150" y="40" width="20" height="118" rx="10"/>
                <rect class="howto-meter-hit" x="132" y="94" width="56" height="18" rx="3"/>
                <circle class="howto-meter-ball top" cx="160" cy="42" r="18"/>
                <circle class="howto-meter-ball bottom" cx="160" cy="156" r="18"/>
                <rect class="howto-meter-marker" x="126" y="134" width="68" height="10" rx="2"/>
                <path class="howto-spark one" d="M220 76h22M231 65v22"/>
                <path class="howto-spark two" d="M91 116h18M100 107v18"/>
            </svg>
        `;
    }
    if (kind === 'pins') {
        return `
            <svg class="howto-svg howto-pins-svg" viewBox="0 0 320 220" aria-hidden="true">
                <path class="howto-lane-perspective" d="M78 190 128 34h64l50 156Z"/>
                <g class="howto-pin-rack">
                    <path class="howto-pin pin-one" d="M156 34c13 0 16 9 14 22l-3 21c0 12 8 19 14 30 12 22 2 44-25 44s-37-22-25-44c6-11 14-18 14-30l-3-21c-2-13 1-22 14-22Z"/>
                    <path class="howto-pin pin-two" d="M116 70c11 0 14 8 12 19l-3 18c0 10 7 16 12 26 10 18 2 36-21 36s-31-18-21-36c5-10 12-16 12-26l-3-18c-2-11 1-19 12-19Z"/>
                    <path class="howto-pin pin-three" d="M204 70c11 0 14 8 12 19l-3 18c0 10 7 16 12 26 10 18 2 36-21 36s-31-18-21-36c5-10 12-16 12-26l-3-18c-2-11 1-19 12-19Z"/>
                </g>
                <circle class="howto-roll-ball" cx="160" cy="176" r="26"/>
                <path class="howto-impact" d="M134 88 108 66M184 88l28-20M160 73V42"/>
            </svg>
        `;
    }
    if (kind === 'route') {
        return `
            <svg class="howto-svg howto-route-svg" viewBox="0 0 320 220" aria-hidden="true">
                <path class="howto-route-board" d="M40 176h240V52H40Z"/>
                <path class="howto-route-path base" d="M74 150 120 104 168 130 226 76"/>
                <path class="howto-route-path pulse" d="M74 150 120 104 168 130 226 76"/>
                <g class="howto-route-nodes">
                    <circle cx="74" cy="150" r="16"/>
                    <circle cx="120" cy="104" r="16"/>
                    <circle cx="168" cy="130" r="16"/>
                    <circle cx="226" cy="76" r="16"/>
                </g>
                <g class="howto-route-icons">
                    <path d="M69 150h10M74 145v10"/>
                    <path d="M114 104h12M120 98v12"/>
                    <circle cx="168" cy="130" r="5"/>
                    <path d="m219 84 7-17 7 17Z"/>
                </g>
            </svg>
        `;
    }
    return `
        <svg class="howto-svg howto-line-svg" viewBox="0 0 320 220" aria-hidden="true">
            <path class="howto-lane-perspective" d="M72 190 120 28h80l48 162Z"/>
            <path class="howto-lane-center" d="M160 44v134"/>
            <path class="howto-aim-rail" d="M70 178h180"/>
            <path class="howto-aim-arrow left" d="M105 178H82m0 0 10-10m-10 10 10 10"/>
            <path class="howto-aim-arrow right" d="M215 178h23m0 0-10-10m10 10-10 10"/>
            <circle class="howto-aim-ball" cx="160" cy="176" r="24"/>
            <path class="howto-pocket" d="M146 54h28M136 70h48M128 86h64"/>
        </svg>
    `;
}

function howToStepMarkup(index = howToStepIndex) {
    const stepCount = HOW_TO_PLAY_STEPS.length;
    const safeIndex = ((index % stepCount) + stepCount) % stepCount;
    const step = HOW_TO_PLAY_STEPS[safeIndex];
    return `
        <article class="menu-detail-card howto-card">
            <button type="button" class="howto-close" data-howto-close aria-label="Close tutorial"><i class="fa-solid fa-xmark"></i></button>
            <div class="howto-badge">
                <span>Pinfall Academy</span>
                <b>${safeIndex + 1}/${stepCount}</b>
            </div>
            <div class="howto-art howto-art-${escapeHtml(step.art)}">${howToArtMarkup(step.art)}</div>
            <div class="howto-copy">
                <span class="menu-detail-kicker">${escapeHtml(step.kicker)}</span>
                <h2>${escapeHtml(step.title)}</h2>
                <p>${escapeHtml(step.body)}</p>
            </div>
            <div class="howto-controls" aria-label="How to play steps">
                <button type="button" class="pixel-btn howto-nav-btn gray-cell" data-howto-prev><i class="fa-solid fa-arrow-left"></i> Back</button>
                <div class="howto-dots" aria-label="Step ${safeIndex + 1} of ${stepCount}">
                    ${HOW_TO_PLAY_STEPS.map((_, dotIndex) => `<button type="button" class="howto-dot ${dotIndex === safeIndex ? 'active' : ''}" data-howto-step="${dotIndex}" aria-label="Show step ${dotIndex + 1}"></button>`).join('')}
                </div>
                <button type="button" class="pixel-btn howto-nav-btn teal-cell" data-howto-next>Next <i class="fa-solid fa-arrow-right"></i></button>
            </div>
        </article>
    `;
}

function bindHowToControls(container = menuCenterElement(), renderFn = showHowToPlayInCenter) {
    if (!container) return;
    const goToStep = (index) => {
        howToStepIndex = ((index % HOW_TO_PLAY_STEPS.length) + HOW_TO_PLAY_STEPS.length) % HOW_TO_PLAY_STEPS.length;
        renderFn(howToStepIndex);
    };
    container.querySelector('[data-howto-prev]')?.addEventListener('click', () => goToStep(howToStepIndex - 1));
    container.querySelector('[data-howto-next]')?.addEventListener('click', () => goToStep(howToStepIndex + 1));
    container.querySelector('[data-howto-close]')?.addEventListener('click', () => {
        if (container.id === 'menu-center-content') {
            showMenuCenterHome();
            return;
        }
        container.classList.add('hidden');
        container.innerHTML = '';
    });
    container.querySelectorAll('[data-howto-step]').forEach(button => {
        button.addEventListener('click', () => goToStep(Number(button.dataset.howtoStep)));
    });
}

function showHowToPlayInCenter(index = howToStepIndex) {
    howToStepIndex = ((index % HOW_TO_PLAY_STEPS.length) + HOW_TO_PLAY_STEPS.length) % HOW_TO_PLAY_STEPS.length;
    showMenuCenterPanel(howToStepMarkup(howToStepIndex));
    bindHowToControls(menuCenterElement(), showHowToPlayInCenter);
}

function relicCardsMarkup(profile = loadProfile()) {
    return RELICS.map(relic => {
        const visual = RELIC_VISUALS[relic.id];
        const selected = profile.selectedRelic === relic.id;
        return `<button type="button" class="relic-card ${selected ? 'selected' : ''}" data-relic-id="${escapeHtml(relic.id)}" aria-pressed="${selected}" aria-label="${escapeHtml(relic.name + ': ' + relic.desc)}">
            <span class="relic-card-status">${selected ? '✓ EQUIPPED' : 'SELECT KEEPSAKE'}</span><span class="relic-art">${cabinetArt(visual.art)}</span><b>${escapeHtml(relic.name)}</b>
            <span class="relic-payoff"><strong>${visual.value}</strong><span>${visual.label}</span></span><p>${visual.desc}</p><small>${visual.duration}</small>
        </button>`;
    }).join('');
}

function bindRelicCardClicks(container) {
    container.querySelectorAll('[data-relic-id]').forEach(button => {
        button.addEventListener('click', () => {
            const nextProfile = loadProfile();
            nextProfile.selectedRelic = button.dataset.relicId;
            saveProfile(nextProfile);
            GAME.selectedRelic = nextProfile.selectedRelic;
            renderRelicShelf();
            renderSelectedRelicSummary();
            if (container.id === 'menu-center-content') showMenuRelicsInCenter();
            showAlert('Relic selected');
        });
    });
}

function showMenuRelicsInCenter() {
    const profile = loadProfile();
    showMenuCenterPanel(`
        <div class="menu-center-header">
            <span>Player Hub</span>
            <h2>Relic Shelf</h2>
        </div>
        <div class="menu-center-grid relic-grid compact-relic-grid">${relicCardsMarkup(profile)}</div>
    `);
    bindRelicCardClicks(menuCenterElement());
}

function statsCardsMarkup(profile = loadProfile()) {
    const runs = profile.runs || [], games = profile.tenPinGames || [], dailies = dailyHistory(profile);
    const average = records => records.length ? Math.round(records.reduce((sum, entry) => sum + (entry.score || 0), 0) / records.length) : 0;
    const bestDaily = [...dailies].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
    const records = [
        { art: 'trophy', title: 'CIRCUIT BEST', value: profile.bestRunScore || 0, line: `${runs.length} RUNS · ${profile.wins || 0} WINS · AVG ${uiNumber(average(runs))}` },
        { art: 'record', title: '10-PIN BEST', value: profile.bestTenPin || 0, line: `${games.length} GAMES · AVG ${uiNumber(average(games))}` },
        { art: 'practice_frame', title: 'DAILY BEST', value: bestDaily?.score || 0, line: `${dailies.length} ATTEMPTS · ${todayDailyEntries(profile).length} TODAY` },
        { art: 'trophy', title: 'BOSS COLLECTION', value: Object.keys(profile.bossesBeaten || {}).length, line: 'HOUSE BOSS VARIANTS DEFEATED' }
    ];
    return records.map(record => `<article class="stat-card record-card"><span class="record-art">${cabinetArt(record.art)}</span><b>${record.title}</b><strong>${uiNumber(record.value)}</strong><p>${record.line}</p>${record.title === 'BOSS COLLECTION' ? `<span class="record-medals">${Object.keys(profile.bossesBeaten || {}).map(name => { const boss = Object.values(BOSS_VARIANTS).flat().find(boss => boss.name === name); return boss ? `<span role="img" aria-label="${escapeHtml(name)} defeated" title="${escapeHtml(name)}">${bossEmblem(boss)}</span>` : ''; }).join('')}</span>` : ''}</article>`).join('') +
        `<article class="stat-card recent-records"><b>LAST CIRCUIT RUNS</b>${runs.slice(0, 4).map(run => `<div><span>${run.victory ? '★ CLEAR' : `FRAME ${run.frames}`}</span><strong>${uiNumber(run.score)}</strong></div>`).join('') || '<p>YOUR FIRST RUN STARTS THE STORY.</p>'}</article>` +
        `<article class="stat-card recent-records"><b>LAST 10-PIN GAMES</b>${games.slice(0, 4).map((game, index) => `<div><span>GAME ${games.length - index}</span><strong>${uiNumber(game.score)}</strong></div>`).join('') || '<p>THE PERFECT 300 IS WAITING.</p>'}</article>`;
}

function showMenuStatsInCenter() {
    showMenuCenterPanel(`
        <div class="menu-center-header">
            <span>Player Hub</span>
            <h2>Stats</h2>
        </div>
        <div class="menu-center-grid stats-grid compact-stats-grid">${statsCardsMarkup()}</div>
    `);
}

function startDailyRunFromMenu() {
    sfx.playStrike();
    startRunInSlot(defaultStartRunSlot(), { daily: true });
}

function seedInputValue() {
    return normalizeRunSeed(document.getElementById('run-seed-input')?.value);
}

function startRunInSlot(index = firstAvailableRunSlot(), options = {}) {
    if (index < 0 || index >= MAX_RUN_SLOTS) {
        updateMainMenuMeta();
        document.getElementById('roguelike-run-screen').classList.remove('hidden');
        showAlert('Choose a save slot');
        return;
    }
    const existingRun = loadRunSlots()[index];
    GAME.mode = 'roguelike';
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('roguelike-run-screen').classList.add('hidden');
    const customSeed = options.daily ? null : seedInputValue();
    startNewRun({ ...options, saveSlot: index, seed: options.seed || customSeed || null });
    if (existingRun) showAlert(`Started fresh in slot ${index + 1}`);
}

function showRoguelikeHubDetail(view) {
    const detail = document.getElementById('roguelike-hub-detail');
    if (!detail) return;
    if (view === 'stats') {
        detail.innerHTML = `
            <div class="menu-center-header">
                <span>Player Hub</span>
                <h2>Stats</h2>
            </div>
            <div class="menu-center-grid stats-grid compact-stats-grid">${statsCardsMarkup()}</div>
        `;
    } else if (view === 'howto') {
        howToStepIndex = 0;
        const renderHubHowTo = (index) => {
            howToStepIndex = index;
            detail.innerHTML = howToStepMarkup(howToStepIndex);
            bindHowToControls(detail, renderHubHowTo);
            installEquipmentDetailClose(detail, view);
            detail.focus({ preventScroll: true });
        };
        renderHubHowTo(howToStepIndex);
    } else {
        detail.innerHTML = `
            <div class="menu-center-header">
                <span>Player Hub</span>
                <h2>Relic Shelf</h2>
            </div>
            <div class="menu-center-grid relic-grid compact-relic-grid">${relicCardsMarkup()}</div>
        `;
        bindRelicCardClicks(detail);
    }
    installEquipmentDetailClose(detail, view);
    detail.classList.remove('hidden');
    detail.focus({ preventScroll: true });
}

function renderRunSlots() {
    const slots = loadRunSlots();
    const firstEmptyIndex = slots.findIndex(slot => !slot);
    const markup = slots.map((slot, index) => {
        if (!slot) {
            const mobileClass = index === firstEmptyIndex ? 'mobile-primary-empty' : 'mobile-extra-empty';
            return `<button class="run-slot empty ${mobileClass}" type="button" data-start-slot="${index}"><span class="slot-number">0${index + 1}</span><span class="slot-copy"><b>NEW RUN</b><small>EMPTY SAVE SLOT</small></span><span class="slot-arrow" aria-hidden="true">+</span></button>`;
        }
        const seed = slot.runModifiers?.daily?.seed || slot.runSeed || '';
        return `<button class="run-slot" type="button" data-load-slot="${index}" title="${escapeHtml(seed)}"><span class="slot-number">0${index + 1}</span><span class="slot-copy"><b>${slot.runModifiers?.daily?.enabled ? 'DAILY RUN' : 'CONTINUE RUN'}</b><small>FRAME ${slot.frame || 1} / ${slot.maxFrames || 12} · ${uiNumber(slot.cumulativeScore || 0)} PTS</small><span class="slot-progress" aria-hidden="true"><i style="width:${Math.min(100, (slot.frame || 1) / (slot.maxFrames || 12) * 100)}%"></i></span></span><span class="slot-arrow" aria-hidden="true">↗</span></button>`;
    }).join('');
    ['run-slots', 'run-slots-hub'].forEach((id) => {
        const container = document.getElementById(id);
        if (!container) return;
        container.innerHTML = markup;
        container.querySelectorAll('[data-load-slot]').forEach(button => {
            button.addEventListener('click', () => loadRunFromSlot(Number(button.dataset.loadSlot)));
        });
        container.querySelectorAll('[data-start-slot]').forEach(button => {
            button.addEventListener('click', () => startRunInSlot(Number(button.dataset.startSlot)));
        });
    });
}

function renderSelectedRelicSummary() {
    const profile = loadProfile();
    const relic = RELICS.find(item => item.id === profile.selectedRelic) || RELICS[0];
    const label = document.getElementById('selected-relic-label');
    const desc = document.getElementById('selected-relic-desc');
    if (label) label.innerText = relic.name;
    if (desc) desc.innerText = relic.desc;
    const art = document.getElementById('selected-relic-art');
    if (art) art.innerHTML = cabinetArt(RELIC_VISUALS[relic.id].art);
}

function snapshotRun() {
    return {
        savedAt: Date.now(),
        state: GAME.state,
        frame: GAME.frame,
        stage: GAME.stage,
        frameInStage: GAME.frameInStage,
        score: GAME.score,
        targetScore: GAME.targetScore,
        rollsLeft: GAME.rollsLeft,
        cash: GAME.cash,
        cumulativeScore: GAME.cumulativeScore,
        maxFrames: GAME.maxFrames,
        currentRoute: GAME.currentRoute,
        routeMap: GAME.routeMap,
        completedNodes: GAME.completedNodes,
        shopSelection: GAME.shopSelection,
        shopSoldOut: GAME.shopSoldOut,
        shopRerolls: GAME.shopRerolls,
        upgradePurchases: GAME.upgradePurchases,
        activeUpgrades: GAME.activeUpgrades,
        ballLoadout: GAME.ballLoadout,
        gameplayVersion: 1,
        runModifiers: GAME.runModifiers,
        runSeed: GAME.runSeed,
        saveSlot: GAME.saveSlot,
        selectedRelic: GAME.selectedRelic,
        relicsUsed: GAME.relicsUsed
    };
}

function saveRunToSlot(index) {
    if (isTenPinMode() || GAME.state === 'TITLE' || GAME.state === 'GAMEOVER') {
        showAlert('No roguelike run to save');
        return;
    }
    const slots = loadRunSlots();
    GAME.saveSlot = index;
    slots[index] = snapshotRun();
    saveRunSlots(slots);
    renderRunSlots();
    showAlert(`Saved run slot ${index + 1}`);
}

function loadRunFromSlot(index) {
    const slot = loadRunSlots()[index];
    if (!slot) return;
    GAME.mode = 'roguelike';
    GAME.paused = false;
    activeHook = 0;
    Object.assign(GAME, {
        frame: slot.frame ?? 0,
        stage: slot.stage ?? stageForFrame(slot.frame ?? 1),
        frameInStage: slot.frameInStage ?? (slot.frame ? frameInStage(slot.frame) : 0),
        score: slot.score || 0,
        targetScore: slot.targetScore || 8,
        rollsLeft: slot.rollsLeft || 2,
        cash: slot.cash || 0,
        cumulativeScore: slot.cumulativeScore || 0,
        maxFrames: slot.maxFrames || 12,
        currentRoute: slot.currentRoute || null,
        routeMap: slot.routeMap || (slot.runSeed || slot.runModifiers?.daily?.seed ? withSeededRandom(`${slot.runSeed || slot.runModifiers.daily.seed}:route-map`, buildRouteMap) : buildRouteMap()),
        completedNodes: slot.completedNodes || [],
        runSeed: slot.runSeed || slot.runModifiers?.daily?.seed || null,
        shopSelection: slot.shopSelection || [],
        shopSoldOut: slot.shopSoldOut || [],
        shopRerolls: slot.shopRerolls || 0,
        upgradePurchases: slot.upgradePurchases || 0,
        activeUpgrades: { ...defaultActiveUpgrades(), ...(slot.activeUpgrades || {}), bumperCharges: migrateBumperCharges(slot.activeUpgrades), gutterGuards: false },
        ballLoadout: migrateBallLoadout(slot.ballLoadout),
        runModifiers: { ...defaultRunModifiers(), ...(slot.runModifiers || {}) },
        saveSlot: index,
        selectedRelic: slot.selectedRelic || loadProfile().selectedRelic || 'last_frame_token',
        relicsUsed: slot.relicsUsed || {}
    });
    GAME.state = slot.state || (GAME.shopSelection?.length ? 'SHOP' : 'ROUTE');
    document.getElementById('main-menu').classList.add('hidden');
    document.getElementById('roguelike-run-screen').classList.add('hidden');
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('shop-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    if (GAME.state === 'SHOP') {
        triggerShopTransition();
    } else if (GAME.state === 'EVENT' && GAME.currentRoute?.event) {
        showEventScreen(GAME.currentRoute);
    } else if (GAME.state === 'BOSS_INTRO' && GAME.currentRoute?.boss) {
        showBossIntro(GAME.currentRoute);
    } else if (GAME.state === 'ROUTE' && !GAME.shopSelection.length && GAME.currentRoute?.nodeId && GAME.completedNodes.includes(GAME.currentRoute.nodeId)) {
        // Older saves recorded the route before entering its lane.
        startFrame();
        autoSaveRunSlot();
    } else if (GAME.state === 'ROUTE' || !GAME.currentRoute || GAME.frame <= 0) {
        showRouteMap();
    } else {
        startFrame();
        autoSaveRunSlot();
    }
}

function renderRelicShelf() {
    const grid = document.getElementById('relic-grid');
    if (!grid) return;
    grid.innerHTML = relicCardsMarkup();
    bindRelicCardClicks(grid);
}

function renderStatsScreen() {
    const grid = document.getElementById('stats-grid');
    if (!grid) return;
    grid.innerHTML = statsCardsMarkup();
}

function recordRunStats(victory) {
    const profile = loadProfile();
    const entry = { at: Date.now(), victory, frames: victory ? GAME.maxFrames : Math.max(0, GAME.frame - 1), score: GAME.cumulativeScore, relic: GAME.selectedRelic };
    profile.runs = [entry, ...(profile.runs || [])].slice(0, 40);
    if (GAME.runModifiers?.daily?.enabled) {
        const dailyEntry = {
            ...entry,
            seed: GAME.runModifiers.daily.seed,
            title: GAME.runModifiers.daily.title
        };
        const cutoff = Date.now() - DAILY_HISTORY_LIMIT * 24 * 60 * 60 * 1000;
        profile.dailyRuns = [dailyEntry, ...(profile.dailyRuns || [])]
            .filter(run => (run.at || 0) >= cutoff)
            .slice(0, 120);
    }
    if (victory) profile.wins = (profile.wins || 0) + 1;
    profile.bestRunScore = Math.max(profile.bestRunScore || 0, GAME.cumulativeScore || 0);
    if (victory && GAME.currentRoute?.boss) profile.bossesBeaten[GAME.currentRoute.name] = true;
    saveProfile(profile);
}

function recordTenPinStats() {
    const profile = loadProfile();
    const entry = { at: Date.now(), score: GAME.score };
    profile.tenPinGames = [entry, ...(profile.tenPinGames || [])].slice(0, 40);
    profile.bestTenPin = Math.max(profile.bestTenPin || 0, GAME.score || 0);
    saveProfile(profile);
}

function recordBossBeat(route) {
    if (!route?.boss) return;
    const profile = loadProfile();
    profile.bossesBeaten[route.name || route.id] = true;
    saveProfile(profile);
}

function applySelectedRelic() {
    const profile = loadProfile();
    GAME.selectedRelic = profile.selectedRelic || 'last_frame_token';
    GAME.relicsUsed = {};
    if (GAME.selectedRelic === 'house_float') GAME.cash += 3;
    if (GAME.selectedRelic === 'warmup_lane') GAME.activeUpgrades.extraRolls += 1;
}

function shopRerollDiscount() {
    return GAME.selectedRelic === 'reroll_coupon' && !GAME.relicsUsed.rerollCoupon ? shopRerollCost() : 0;
}

function showSpecialUseOverlay(title, body, icon = 'fa-star') {
    const layer = document.getElementById('gain-fx-layer') || document.body;
    const existing = document.querySelector('.special-use-overlay');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.className = 'special-use-overlay';
    overlay.innerHTML = `
        <div class="special-use-card">
            <span class="special-use-icon"><i class="fa-solid ${escapeHtml(icon)}"></i></span>
            <div>
                <span class="special-use-kicker">Special Used</span>
                <h2>${escapeHtml(title)}</h2>
                <p>${escapeHtml(body)}</p>
            </div>
        </div>
    `;
    layer.appendChild(overlay);
    setTimeout(() => overlay.classList.add('is-leaving'), 2200);
    setTimeout(() => overlay.remove(), 2850);
}

function maybeUseDeathRelic() {
    if (GAME.selectedRelic !== 'last_frame_token' || GAME.relicsUsed.lastFrameToken) return false;
    GAME.relicsUsed.lastFrameToken = true;
    GAME.rollsLeft = Math.max(GAME.rollsLeft, 1);
    showSpecialUseOverlay('Last Frame Token', 'Target missed. One emergency roll keeps the run alive.', 'fa-ticket');
    showAlert('Relic saved you: +1 emergency roll');
    prepareNextRoll(false);
    updateUI();
    return true;
}

function returnToMainMenu() {
    autoSaveRunSlot();
    clearGameplayLaneEffects();
    togglePause(false);
    toggleDebugActions(false);
    clearRollWatchdog();
    sfx.stopBallRoll();
    activeHook = 0;
    clearTimeout(GAME.stats.reviewTimer);
    GAME.stats.reviewTimer = null;
    GAME.state = 'TITLE';
    GAME.mode = 'roguelike';
    GAME.frame = 0;
    GAME.stage = 1;
    GAME.frameInStage = 0;
    GAME.currentRoute = null;
    GAME.routeOptions = [];
    GAME.routeMap = [];
    GAME.completedNodes = [];
    GAME.saveSlot = null;
    GAME.selectedRelic = loadProfile().selectedRelic || 'last_frame_token';
    GAME.relicsUsed = {};
    GAME.shopSelection = [];
    GAME.shopSoldOut = [];
    GAME.shopRerolls = 0;
    GAME.upgradePurchases = 0;
    GAME.score = 0;
    GAME.cash = 2;
    GAME.cumulativeScore = 0;
    GAME.activeUpgrades = defaultActiveUpgrades();
    GAME.runModifiers = defaultRunModifiers();
    resetTenPinState(document.getElementById('tenpin-special-toggle')?.checked !== false, document.getElementById('tenpin-full-bag-toggle')?.checked !== false);
    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('roguelike-run-screen').classList.add('hidden');
    document.getElementById('shop-screen').classList.add('hidden');
    document.getElementById('route-screen').classList.add('hidden');
    document.getElementById('event-screen').classList.add('hidden');
    document.getElementById('debug-actions-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('tenpin-scoreboard-screen').classList.add('hidden');
    document.getElementById('tenpin-rack-screen').classList.add('hidden');
    document.getElementById('legend-screen').classList.add('hidden');
    document.getElementById('tutorial-screen').classList.add('hidden');
    document.getElementById('relic-screen').classList.add('hidden');
    document.getElementById('stats-screen').classList.add('hidden');
    document.getElementById('boss-intro-screen').classList.add('hidden');
    document.getElementById('main-menu').classList.remove('hidden');
    document.getElementById('center-message').classList.add('hidden');
    updateMainMenuMeta();
    updateUI();
}

function triggerLaunchClick() {
    if (GAME.paused) return;
    if (GAME.state === 'TITLE') return;
    if (GAME.state === 'MAIN_METER') {
        gauge.triggerClick();
    } else if (GAME.state === 'ROLL_SETTLING') {
        finishRollReview();
    }
}

function handleAimOrSteer(dir) {
    if (GAME.paused) return;
    if (GAME.state === 'MAIN_METER' && gauge.stage === 'AIM') {
        moveLaunchPosition(dir);
        return;
    }
    applyBallSteer(dir);
}

function applyBallSteer(dir) {
    if (GAME.paused) return;
    if (GAME.activeUpgrades.spinPower <= 0) {
        showAlert("Steer Locked! Buy 'Magnetic Spin' in shop!");
        return;
    }
    if (ballBody && GAME.state === 'BALL_ROLLING') {
        const force = new CANNON.Vec3(dir * GAME.activeUpgrades.spinPower * 3.6, 0, 0);
        ballBody.applyForce(force, ballBody.position);
        createVisualExplosion(ballBody.position, 0xc084fc);
        sfx.playTick();
    }
}

function applyGutterCatch(dt) {
    if (!ballBody?.shapes?.[0]) return;
    const origin = laneOrigin();
    const metrics = gutterChannelMetrics(LANE.currentWidth);
    const radius = ballBody.shapes[0].radius || 0.49;
    const route = GAME.currentRoute || ROUTE_TYPES.STANDARD;
    const pull = route.gutterPull || 1;
    const localX = ballBody.position.x - origin.x;
    if (gutterGuardsArray.length && Math.abs(localX) < LANE.currentWidth / 2 + radius) return;
    const laneEdge = LANE.currentWidth / 2 - radius * (0.18 + (pull - 1) * 0.16);
    if (Math.abs(localX) <= laneEdge) return;

    const side = Math.sign(localX) || 1;
    const gutterCenterX = origin.x + side * (metrics.visualWidth / 2 + metrics.gutterWidth * 0.5);
    const gutterOuterLimit = origin.x + side * (metrics.visualWidth / 2 + metrics.gutterWidth - radius * 0.35);
    const targetY = metrics.floorTopY + radius;

    ballBody.velocity.x *= Math.pow(0.08 / pull, dt);
    ballBody.velocity.y -= 18 * pull * dt;
    ballBody.velocity.z *= Math.pow(0.82, dt * pull);
    ballBody.position.x = THREE.MathUtils.lerp(ballBody.position.x, gutterCenterX, Math.min(0.18, dt * 4 * pull));

    if ((side > 0 && ballBody.position.x > gutterOuterLimit) || (side < 0 && ballBody.position.x < gutterOuterLimit)) {
        ballBody.position.x = gutterOuterLimit;
        if (ballBody.velocity.x * side > 0) ballBody.velocity.x = 0;
    }
    if (ballBody.position.y < targetY) {
        ballBody.position.y = THREE.MathUtils.lerp(ballBody.position.y, targetY, Math.min(0.18, dt * 5));
    }
}

function applyTimingHook(dt) {
    if (!ballBody || GAME.state !== 'BALL_ROLLING' || Math.abs(activeHook) < 0.01) return;
    const origin = laneOrigin();
    const rackFrontZ = laneEndZ() + 3.5 + pinRackOffset().z + currentRackLayout().depth;
    const travelToRack = ballStartZ() - rackFrontZ;
    const progress = THREE.MathUtils.clamp((ballStartZ() - ballBody.position.z) / Math.max(1, travelToRack * 0.9), 0, 1);
    const skidPortion = THREE.MathUtils.clamp(BOWLING_PHYSICS.skidPortion + (activeThrowMods.hookDelay || 0), 0.35, 0.72);
    const hookMultiplier = Math.max(0.35, 1 + (activeThrowMods.hookBoost || 0));
    const phaseProgress = THREE.MathUtils.clamp((progress - skidPortion) / Math.max(0.001, BOWLING_PHYSICS.rollPortion - skidPortion), 0, 1);
    const hookRamp = phaseProgress * phaseProgress * (3 - 2 * phaseProgress);
    const lateFade = 1 - 0.18 * THREE.MathUtils.smoothstep(progress, 0.86, 1);
    const laneCenterPull = THREE.MathUtils.clamp((ballBody.position.x - origin.x) / Math.max(1, LANE.currentWidth / 2), -1, 1);
    const route = GAME.currentRoute || ROUTE_TYPES.STANDARD;
    const hookForce = (activeHook * BOWLING_PHYSICS.hookForce * hookMultiplier * (route.hookMod || 1) * hookRamp * lateFade) - (laneCenterPull * Math.abs(activeHook) * 3.2 * hookRamp);
    ballBody.applyForce(new CANNON.Vec3(hookForce, 0, 0), ballBody.position);
    if (progress > BOWLING_PHYSICS.rollPortion) {
        const stability = THREE.MathUtils.clamp(BOWLING_PHYSICS.rollStability + (activeThrowMods.stability || 0), 0.45, 0.94);
        ballBody.velocity.x *= Math.pow(stability, dt);
    }
    ballBody.angularVelocity.y = THREE.MathUtils.lerp(ballBody.angularVelocity.y, activeHook * 3.2, Math.min(0.08, dt * 3));
}

function updateSpeedLines() {
    if (!ballBody || !ballMesh || GAME.state !== 'BALL_ROLLING') return;
    const speed = ballBody.velocity.length();
    const powerFactor = THREE.MathUtils.clamp((speed - 9) / 16, 0, 1);
    if (powerFactor <= 0.05) return;

    const now = performance.now();
    const interval = THREE.MathUtils.lerp(100, 30, powerFactor);
    if (now - lastSpeedTrailAt < interval) return;
    lastSpeedTrailAt = now;

    const velocity = new THREE.Vector3(ballBody.velocity.x, ballBody.velocity.y, ballBody.velocity.z);
    if (velocity.lengthSq() < 0.001) return;
    const direction = velocity.normalize();
    const side = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
    const count = powerFactor > 0.65 ? 2 : 1;

    for (let i = 0; i < count; i++) {
        const length = THREE.MathUtils.lerp(0.45, 1.05, powerFactor);
        const dash = new THREE.Mesh(
            new THREE.BoxGeometry(0.035, 0.035, length),
            new THREE.MeshBasicMaterial({
                color: i % 2 ? 0xfacc15 : 0x7dd3fc,
                transparent: true,
                opacity: THREE.MathUtils.lerp(0.28, 0.62, powerFactor)
            })
        );
        ballBody.position.copyTo(dash.position);
        dash.position.addScaledVector(direction, -0.85 - i * 0.22);
        dash.position.addScaledVector(side, (Math.random() - 0.5) * 0.7);
        dash.position.y += 0.08 + Math.random() * 0.18;
        dash.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), direction);
        scene.add(dash);
        particles.push({
            mesh: dash,
            vel: direction.clone().multiplyScalar(-0.4),
            timer: 0.26,
            duration: 0.26,
            fade: true
        });
    }
}

function attachPinImpactSound(pin) {
    pin.body.addEventListener('collide', (event) => {
        if (!pin.body || pin.cleanupStarted) return;
        const other = event.body;
        if (other !== ballBody && !other?.isBowlingPin) return;

        if (other === ballBody) applyBowlingHeadPinEntryPhysics(pin);

        const relativeVelocity = new CANNON.Vec3();
        pin.body.velocity.vsub(other.velocity, relativeVelocity);
        const speed = relativeVelocity.length();
        const now = performance.now();

        if (speed > 1.7 && now - pin.lastImpactSoundTime > 220) {
            pin.lastImpactSoundTime = now;
            sfx.playPinStrike(speed);
            triggerCameraShake(Math.min(0.22, speed * 0.025));
            if (speed > 4.2) createPinImpactFlash(pin.body.position, speed);
            if (other === ballBody && speed > 4.2) presentation?.impact(pin.body.position, GAME.currentRoute?.boss ? new THREE.Color(routeTheme(GAME.currentRoute).color).getHex() : 0xffc783);
        }
    });
}

function clearRollWatchdog() {
    if (!rollWatchdogTimer) return;
    clearTimeout(rollWatchdogTimer);
    rollWatchdogTimer = null;
}

function scheduleRollWatchdog() {
    clearRollWatchdog();
    rollWatchdogTimer = setTimeout(() => {
        rollWatchdogTimer = null;
        if (GAME.paused && GAME.state === 'BALL_ROLLING') {
            scheduleRollWatchdog();
            return;
        }
        if (GAME.state !== 'BALL_ROLLING') return;
        if (ballBody) {
            ballBody.velocity.set(0, 0, 0);
            ballBody.angularVelocity.set(0, 0, 0);
        }
        beginRollSettling();
    }, ROLL_WATCHDOG_MS);
}

function applyBowlingHeadPinEntryPhysics(pin) {
    if (pin.rackIndex !== 0 || GAME.stats.lastEntry || !ballBody) return;
    const vx = ballBody.velocity.x;
    const vz = ballBody.velocity.z;
    const speed = Math.hypot(vx, vz);
    if (speed < 1) return;

    const entryAngleDeg = Math.abs(THREE.MathUtils.radToDeg(Math.atan2(vx, -vz)));
    const offsetX = ballBody.position.x - pin.body.position.x;
    const centerHit = Math.abs(offsetX) < BOWLING_PHYSICS.centerHitX;
    const flatHit = entryAngleDeg < BOWLING_PHYSICS.flatAngleDeg;
    GAME.stats.lastEntry = {
        offsetX,
        entryAngleDeg,
        speed,
        centerHit,
        flatHit
    };

    if (centerHit && flatHit) {
        const side = Math.sign(offsetX || vx || (Math.random() - 0.5)) || 1;
        ballBody.velocity.x += side * speed * BOWLING_PHYSICS.flatCenterDeflection;
        ballBody.velocity.z *= BOWLING_PHYSICS.flatCenterSpeedLoss;
        ballBody.angularVelocity.y *= 0.55;
    } else if (entryAngleDeg < BOWLING_PHYSICS.idealEntryDeg * 0.55) {
        ballBody.velocity.z *= 0.78;
    }

    applyPocketCarryAssist(pin, GAME.stats.lastEntry);
}

function applyPocketCarryAssist(headPin, entry) {
    if (!headPin?.body || !entry || entry.speed < BOWLING_PHYSICS.pocketCarryMinSpeed) return;
    if (entry.centerHit || entry.flatHit) return;
    const absOffset = Math.abs(entry.offsetX);
    if (absOffset < BOWLING_PHYSICS.pocketCarryMinOffset || absOffset > BOWLING_PHYSICS.pocketCarryMaxOffset) return;
    const angleScore = 1 - Math.min(1, Math.abs(entry.entryAngleDeg - BOWLING_PHYSICS.idealEntryDeg) / BOWLING_PHYSICS.idealEntryDeg);
    const offsetScore = 1 - Math.min(1, Math.abs(absOffset - 0.34) / 0.34);
    const quality = THREE.MathUtils.clamp(0.42 + angleScore * 0.34 + offsetScore * 0.24, 0.35, 1);
    const route = GAME.currentRoute || ROUTE_TYPES.STANDARD;
    const heavyPinDampen = route.heavyPins ? 0.7 : 1;
    const side = Math.sign(entry.offsetX || ballBody?.velocity?.x || (Math.random() - 0.5)) || 1;
    const assist = entry.speed * BOWLING_PHYSICS.pocketCarryImpulse * quality * heavyPinDampen;
    // Boost only the pin actually struck. An off-center impulse produces the
    // tumble; the rest of the rack moves through pin-to-pin contact.
    const center = headPin.body.position;
    headPin.body.applyImpulseAtPoint(
        new CANNON.Vec3(-side * assist * 0.2, 0, -assist),
        new CANNON.Vec3(center.x + side * 0.1, center.y + 0.12, center.z + 0.06)
    );
}

function executeRoll(aim, power, spin) {
    preRollViewRaised = false;
    preRollViewBlend = 0;
    updateCameraViewButton();
    GAME.state = 'BALL_ROLLING';
    impactCamera.active = false;
    impactCamera.elapsed = 0;
    scheduleRollWatchdog();
    setMobileControlRailHidden(false);
    GAME.rollsLeft--;
    GAME.stats.rollsThisFrame++;
    GAME.stats.currentRollScore = 0;
    GAME.stats.currentRollPins = 0;
    GAME.stats.currentRollBonusScore = 0;
    GAME.stats.rollRecorded = false;
    GAME.stats.canContinueRoll = false;
    GAME.stats.promptSounded = false;
    GAME.stats.lastEntry = null;
    updateUI();
    captureThrowMods();
    activeHook = THREE.MathUtils.clamp(spin, -0.85, 0.85);

    const launchSpeed = BOWLING_PHYSICS.launchBase + (power * BOWLING_PHYSICS.launchPower) + (GAME.activeUpgrades.nextThrowPowerBoost || 0);
    const fx = Math.sin(aim);
    const fz = -Math.cos(aim);
    ballBody.wakeUp();
    ballBody.velocity.set(fx * launchSpeed, 0, fz * launchSpeed);
    ballBody.angularVelocity.set(fz * launchSpeed / ballBody.shapes[0].radius, activeHook * 2.1, -fx * launchSpeed / ballBody.shapes[0].radius);
    GAME.activeUpgrades.nextThrowPowerBoost = 0;
    GAME.activeUpgrades.nextThrowFocus = 0;
    clearOneThrowBallUpgrades();

    sfx.startBallRoll();
    triggerCameraShake(0.04);
}

// Synchronous scratch values: never retained by a pin or returned to callers.
const pinQueryUp = new THREE.Vector3();
const pinQueryPosition = new THREE.Vector3();

function isPinKnocked(pin) {
    if (pin.knocked) return true;
    if (!pin.body) return false;
    if (pin.sleepingUpright && pin.body.raw?.isSleeping?.()) return false;
    pinQueryUp.set(0, 1, 0).applyQuaternion(pin.mesh.quaternion);
    if (pinQueryUp.y < 0.66) return true;
    // Z depends on widening-lane dimensions; X/Y are the configured origin.
    // This predicate needs no lane/rack dimension calculation or copied origin.
    const origin = debugState.config.physicsLane?.position || { x: 0, y: 0 };
    pin.body.position.copyTo(pinQueryPosition);
    return pinQueryPosition.y < origin.y + 0.22 || Math.abs(pinQueryPosition.x - origin.x) > (LANE.currentWidth / 2 + PIN_SCALE.radius * pinGroupScale());
}

function startPinCleanup(pin) {
    if (pin.cleanupStarted) return;
    pin.knocked = true;
    pin.cleanupStarted = true;
    pin.cleanupTimer = 0;
    pin.popScale = pin.mesh?.scale?.clone?.() || new THREE.Vector3(1, 1, 1);
    pin.popEffectDone = false;
}

function disposePinReflection(pin) {
    if (!pin.reflection) return;
    disposeGameVisual(pin.reflection);
    pin.reflection = null;
}

function removePinFromWorld(pin) {
    if (!pin) return;
    if (pin.body && !pin.bodyRemoved) {
        world.remove(pin.body);
        pin.body = null;
        pin.bodyRemoved = true;
    }
    if (pin.mesh && !pin.meshRemoved) {
        disposeGameVisual(pin.mesh);
        pin.meshRemoved = true;
    }
    if (pin.reflection) {
        disposePinReflection(pin);
    }
    reflectionObjects = reflectionObjects.filter(obj => obj.parent);
}

function tenPinPinScore(pin) {
    if (pin.type === PIN_TYPES.GOLD) return { pins: 1, frameScore: 2, bonusScore: 2 };
    if (pin.type === PIN_TYPES.SILVER) return { pins: 1, frameScore: 1, bonusScore: 2 };
    return { pins: 1, frameScore: 1, bonusScore: 1 };
}

function pinTypeKey(type) {
    return Object.entries(PIN_TYPES).find(([, value]) => value === type)?.[0] || 'STANDARD';
}

function pinCashValue(pin) {
    const key = pinTypeKey(pin.type);
    const override = GAME.runModifiers?.pinCashOverrides?.[key];
    const base = override !== undefined ? Number(override) : Number(pin.type.cashValue ?? 0.5);
    const multiplier = Number(GAME.runModifiers?.pinCashMultipliers?.[key] ?? 1);
    const throwMultiplier = Number(activeThrowMods.cashMultiplier ?? 1);
    return base * multiplier * throwMultiplier;
}

function pinPayoutDetails(pin, cashValue, tenPinScore = null) {
    const key = pinTypeKey(pin.type);
    const details = [];
    if (key !== 'STANDARD') details.push(pin.type.name);
    const cashMultiplier = Number(GAME.runModifiers?.pinCashMultipliers?.[key] ?? 1);
    if (cashMultiplier !== 1) details.push(`cash x${uiExactNumber(cashMultiplier)}`);
    if (GAME.runModifiers?.pinCashOverrides?.[key] !== undefined) details.push(`cash set ${uiExactNumber(GAME.runModifiers.pinCashOverrides[key])}`);
    if (activeThrowMods.cashMultiplier && activeThrowMods.cashMultiplier !== 1) details.push(`throw x${uiExactNumber(activeThrowMods.cashMultiplier)}`);
    if (GAME.runModifiers?.disabledPinEffects?.[key]) details.push('effect off');
    if (tenPinScore && tenPinScore.frameScore > tenPinScore.pins) details.push(`score +${tenPinScore.frameScore - tenPinScore.pins}`);
    if (tenPinScore && tenPinScore.bonusScore > tenPinScore.pins) details.push(`bonus +${tenPinScore.bonusScore - tenPinScore.pins}`);
    if (!isTenPinMode()) {
        const route = GAME.currentRoute || ROUTE_TYPES.STANDARD;
        if ((route.pinScoreMod || 1) !== 1) details.push(`route score x${uiExactNumber(route.pinScoreMod)}`);
        if (GAME.activeUpgrades.pinValueMultiplier > 1) details.push(`upgrade x${uiExactNumber(GAME.activeUpgrades.pinValueMultiplier)}`);
    }
    return details.slice(0, 3).join(' / ');
}

function worldToScreenPosition(pos) {
    const vector = new THREE.Vector3(pos.x, pos.y, pos.z);
    vector.project(camera);
    return {
        x: (vector.x * 0.5 + 0.5) * window.innerWidth,
        y: (-vector.y * 0.5 + 0.5) * window.innerHeight,
        visible: vector.z > -1 && vector.z < 1
    };
}

function showPinPayoutFx(pin, cashValue, details) {
    const layer = document.getElementById('gain-fx-layer');
    if (!layer || !pin.mesh) return;
    const pos = pin.mesh.position.clone();
    pos.y += PIN_SCALE.height * pinGroupScale() * 0.75;
    const screen = worldToScreenPosition(pos);
    if (!screen.visible) return;
    const el = document.createElement('div');
    el.className = 'pin-payout-fx';
    el.style.left = `${screen.x}px`;
    el.style.top = `${screen.y}px`;
    const sign = cashValue >= 0 ? '+' : '-';
    el.innerHTML = `${sign}${uiNumber(Math.abs(cashValue))} $${details ? `<span>${escapeHtml(details)}</span>` : ''}`;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 1100);
}

function addCash(amount, reason = 'Pin Dollars') {
    if (!amount) return;
    GAME.cash = Math.max(0, GAME.cash + amount);
    showGainFloat(amount, reason);
    updateCashHud();
}

function updateCashHud() {
    const cashEl = document.getElementById('hud-cash');
    if (!cashEl) return;
    cashEl.innerText = isTenPinMode() && !GAME.tenPin.specialPinsEnabled ? 'OFF' : uiNumber(GAME.cash);
    cashEl.title = `Exact: ${uiExactNumber(GAME.cash)}`;
}

function showGainFloat(amount, reason = 'Pin Dollars') {
    const layer = document.getElementById('gain-fx-layer');
    if (!layer) return;
    const el = document.createElement('div');
    el.className = 'gain-float';
    el.style.left = `${46 + Math.random() * 16}%`;
    el.style.top = `${24 + Math.random() * 18}%`;
    const sign = amount >= 0 ? '+' : '-';
    el.innerText = `${sign}${uiNumber(Math.abs(amount))} $ ${reason}`;
    layer.appendChild(el);
    setTimeout(() => el.remove(), 1250);
}

function scoreFallenPins() {
    let scoredNow = 0;
    let pinsNow = 0;
    let bonusNow = 0;
    let cashNow = 0;
    physicalPins.forEach((pin) => {
        if (!pin.scored && isPinKnocked(pin)) {
            pin.scored = true;
            if (isTenPinMode()) {
                const tenPinScore = tenPinPinScore(pin);
                const pinCash = pinCashValue(pin);
                pinsNow += tenPinScore.pins;
                scoredNow += tenPinScore.frameScore;
                bonusNow += tenPinScore.bonusScore;
                cashNow += pinCash;
                showPinPayoutFx(pin, pinCash, pinPayoutDetails(pin, pinCash, tenPinScore));
                sfx.playTick();
                startPinCleanup(pin);
                return;
            }
            const val = pinScoreValue(pin);
            const pinCash = pinCashValue(pin);
            scoredNow += val;
            cashNow += pinCash;
            showPinPayoutFx(pin, pinCash, pinPayoutDetails(pin, pinCash));
            sfx.playTick();
            startPinCleanup(pin);
        }
    });

    if (scoredNow > 0) {
        if (isTenPinMode()) {
            GAME.stats.currentRollScore += scoredNow;
            GAME.stats.currentRollPins += pinsNow;
            GAME.stats.currentRollBonusScore += bonusNow;
            GAME.score = calculateTenPinScore(GAME.tenPin.frames);
            if (GAME.tenPin.specialPinsEnabled) addCash(cashNow, 'collected');
            updateUI();
            if (GAME.state === 'ROLL_SETTLING' && GAME.stats.canContinueRoll) {
                showSettlingPrompt();
                scheduleRollReviewAutoContinue();
            }
            return scoredNow;
        }
        const route = GAME.currentRoute || ROUTE_TYPES.STANDARD;
    const walletGain = (cashNow * (route.cashMod || 1)) + Math.max(0, Math.floor(scoredNow * 0.12));
        GAME.stats.currentRollScore += scoredNow;
        GAME.score += scoredNow;
        addCash(walletGain, 'collected');
        GAME.cumulativeScore += scoredNow;
        updateUI();
        if (GAME.state === 'ROLL_SETTLING' && GAME.stats.canContinueRoll) {
            showSettlingPrompt();
            scheduleRollReviewAutoContinue();
        }
    }

    return scoredNow;
}

function setMobileControlRailHidden(hidden) {
    if (mobileControlRailHidden === hidden) return;
    mobileControlRailHidden = hidden;
    document.getElementById('control-hud-row')?.classList.toggle('mobile-controls-hidden', hidden);
}

function updateMobileControlRailVisibility() {
    if (GAME.state === 'ROLL_SETTLING') {
        setMobileControlRailHidden(true);
        return;
    }
    if (!ballBody || GAME.state !== 'BALL_ROLLING') {
        setMobileControlRailHidden(false);
        return;
    }
    const metrics = pinDeckContainmentMetrics(LANE.currentWidth);
    const pinPhysicsEntryZ = metrics.centerZ + metrics.sideLength / 2 + 0.75;
    setMobileControlRailHidden(ballBody.position.z <= pinPhysicsEntryZ);
}

function clearScoreCelebrationClasses() {
    const centerMsg = document.getElementById('center-message');
    centerMsg?.classList.remove('score-celebration', 'score-strike', 'score-spare', 'score-big', 'score-gutter');
}

function createStrikeScreenSparks() {
    const layer = document.getElementById('gain-fx-layer');
    if (!layer) return;
    const count = isPortraitMobileLayout() ? 14 : 22;
    for (let i = 0; i < count; i++) {
        const spark = document.createElement('span');
        spark.className = 'strike-spark';
        const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.42;
        const distance = 80 + Math.random() * (isPortraitMobileLayout() ? 90 : 150);
        spark.style.setProperty('--spark-x', `${Math.cos(angle) * distance}px`);
        spark.style.setProperty('--spark-y', `${Math.sin(angle) * distance - 28}px`);
        spark.style.setProperty('--spark-rot', `${Math.round((Math.random() - 0.5) * 540)}deg`);
        spark.style.animationDelay = `${Math.random() * 0.12}s`;
        layer.appendChild(spark);
        setTimeout(() => spark.remove(), 1250);
    }
}

function applyScoreCelebration(kind) {
    const centerMsg = document.getElementById('center-message');
    if (!centerMsg) return;
    centerMsg.classList.remove('score-celebration', 'score-strike', 'score-spare', 'score-big', 'score-gutter');
    void centerMsg.offsetWidth;
    centerMsg.classList.add('score-celebration');
    if (kind) centerMsg.classList.add(`score-${kind}`);
    if (kind === 'strike' && !GAME.stats.promptSounded) {
        createStrikeScreenSparks();
        createStrikeLaneBurst();
        triggerCameraShake(0.18);
    }
}

function showSettlingPrompt() {
    const centerMsg = document.getElementById('center-message');
    centerMsg.classList.remove('hidden');
    if (isTenPinMode()) {
        const frame = GAME.tenPin.frames[GAME.frame - 1];
        const rollIndex = Math.max(0, GAME.stats.rollsThisFrame - 1);
        const rollRecord = createTenPinRollRecord();
        const projectedFrame = { rolls: [...(frame?.rolls || []), rollRecord] };
        const pinCount = rollRecord.pins;
        const scoreExtra = Math.max(0, rollRecord.frameScore - pinCount);
        let resultText = `${pinCount} PIN${pinCount === 1 ? '' : 'S'}${scoreExtra ? ` +${scoreExtra}` : ''}`;
        let celebrationKind = pinCount > 6 ? 'big' : '';
        if (pinCount === 10) {
            resultText = `${rollIndex === 0 ? 'STRIKE!' : 'BONUS STRIKE!'}${scoreExtra ? ` +${scoreExtra}` : ''}`;
            celebrationKind = 'strike';
        } else if (frame && GAME.frame < 10 && rollIndex === 1 && tenPinRollPins(frame.rolls[0]) + pinCount === 10) {
            resultText = `SPARE!${scoreExtra ? ` +${scoreExtra}` : ''}`;
            celebrationKind = 'spare';
        } else if (pinCount === 0) {
            resultText = 'GUTTER BALL';
            celebrationKind = 'gutter';
        }
        const nextText = tenPinFrameIsComplete(projectedFrame, GAME.frame) ? (GAME.frame >= 10 ? 'FINAL TALLY' : 'NEXT FRAME') : 'NEXT BALL LOADING';
        centerMsg.innerText = `${resultText}\nFRAME ${GAME.frame} / 10\n${nextText}`;
        centerMsg.style.whiteSpace = 'pre-line';
        centerMsg.style.color = pinCount > 0 ? "#f59e0b" : "#ef4444";
        applyScoreCelebration(celebrationKind);
        if (!GAME.stats.promptSounded) {
            GAME.stats.promptSounded = true;
            if (pinCount >= 10) sfx.playStrike();
            else sfx.playHit();
        }
        return;
    }
    let resultText = `+${uiNumber(GAME.stats.currentRollScore)} PINS`;
    let celebrationKind = GAME.stats.currentRollScore > 6 ? 'big' : '';
    if (GAME.stats.currentRollScore === GAME.stats.pinsSpawned) {
        resultText = 'STRIKE!';
        celebrationKind = 'strike';
    } else if (GAME.stats.currentRollScore > 6) {
        resultText = 'BIG HIT!';
    } else if (GAME.stats.currentRollScore === 0) {
        resultText = 'GUTTER BALL';
        celebrationKind = 'gutter';
    }
    const nextText = GAME.score >= GAME.targetScore ? 'FRAME CLEARED' : GAME.rollsLeft > 0 ? 'NEXT BALL LOADING' : 'FINAL TALLY';
    centerMsg.innerText = `${resultText}\n${uiNumber(GAME.score)}/${uiNumber(GAME.targetScore)} PINS\n${nextText}`;
    centerMsg.style.whiteSpace = 'pre-line';
    centerMsg.style.color = GAME.stats.currentRollScore > 0 ? "#f59e0b" : "#ef4444";
    applyScoreCelebration(celebrationKind);
    if (!GAME.stats.promptSounded) {
        GAME.stats.promptSounded = true;
        if (GAME.stats.currentRollScore > 6) {
            sfx.playStrike();
        } else {
            sfx.playHit();
        }
    }
}

function beginRollSettling() {
    if (GAME.state !== 'BALL_ROLLING') return;
    clearRollWatchdog();
    GAME.state = 'ROLL_SETTLING';
    setMobileControlRailHidden(true);
    activeHook = 0;
    sfx.stopBallRoll();
    GAME.stats.canContinueRoll = false;
    GAME.stats.promptSounded = false;
    clearTimeout(GAME.stats.reviewTimer);
    GAME.stats.reviewTimer = null;
    scoreFallenPins();
    const centerMsg = document.getElementById('center-message');
    centerMsg.classList.remove('hidden');
    clearScoreCelebrationClasses();
    centerMsg.innerText = 'COUNTING PINS';
    centerMsg.style.whiteSpace = 'normal';
    centerMsg.style.color = '#d8bd8b';
    setTimeout(() => {
        if (GAME.state !== 'ROLL_SETTLING') return;
        scoreFallenPins();
        GAME.stats.canContinueRoll = true;
        showSettlingPrompt();
        scheduleRollReviewAutoContinue();
    }, 1800);
}

function scheduleRollReviewAutoContinue() {
    clearTimeout(GAME.stats.reviewTimer);
    GAME.stats.reviewTimer = setTimeout(() => {
        finishRollReview();
    }, 2800);
}

function finishRollReview() {
    if (GAME.state !== 'ROLL_SETTLING') return;
    if (!GAME.stats.canContinueRoll) return;
    if (GAME.mode === 'practice') {
        clearTimeout(GAME.stats.reviewTimer);
        clearRollWatchdog();
        document.getElementById('center-message').classList.add('hidden');
        clearScoreCelebrationClasses();
        if (!GAME.stats.rollRecorded) {
            GAME.stats.rollScores.push(GAME.stats.currentRollScore);
            GAME.stats.rollRecorded = true;
        }
        if (GAME.rollsLeft > 0 && !isRackCleared()) prepareNextRoll();
        else startPractice(GAME.frame);
        return;
    }
    if (isTenPinMode()) {
        finishTenPinRollReview();
        return;
    }
    clearTimeout(GAME.stats.reviewTimer);
    GAME.stats.reviewTimer = null;
    clearRollWatchdog();
    scoreFallenPins();
    const rerackDecision = roguelikeRerackDecision();
    const shouldRerack = rerackDecision.shouldRerack;
    if (shouldRerack && GAME.rollsLeft <= 0) {
        GAME.rollsLeft = 1;
    }
    GAME.state = 'ROUND_OVER';
    if (!GAME.stats.rollRecorded) {
        GAME.stats.rollScores.push(GAME.stats.currentRollScore);
        GAME.stats.rollRecorded = true;
    }
    updateUI();

    const centerMsg = document.getElementById('center-message');
    centerMsg.classList.add('hidden');
    clearScoreCelebrationClasses();
    centerMsg.style.whiteSpace = 'normal';

    if (GAME.score >= GAME.targetScore) {
        if (GAME.frame >= GAME.maxFrames) {
            endRun(true);
        } else {
            triggerShopTransition();
        }
    } else if (GAME.rollsLeft <= 0 && !shouldRerack) {
        if (maybeUseDeathRelic()) return;
        endRun();
    } else {
        if (shouldRerack && rerackDecision.reason) showAlert(rerackDecision.reason);
        prepareNextRoll(shouldRerack);
    }
}

function isRackCleared() {
    return physicalPins.length > 0 && physicalPins.every(pin => pin.scored || isPinKnocked(pin));
}

function pinScoreValue(pin) {
    const route = GAME.currentRoute || ROUTE_TYPES.STANDARD;
    return Math.ceil(pin.type.pointValue * GAME.activeUpgrades.pinValueMultiplier * (route.pinScoreMod || 1));
}

function remainingRackScoreValue() {
    return physicalPins.reduce((sum, pin) => {
        if (pin.scored || isPinKnocked(pin)) return sum;
        return sum + pinScoreValue(pin);
    }, 0);
}

function roguelikeRerackDecision() {
    if (isTenPinMode() || GAME.score >= GAME.targetScore || GAME.rollsLeft <= 0) {
        return { shouldRerack: false, reason: '' };
    }
    if (isRackCleared()) {
        return { shouldRerack: true, reason: 'Fresh rack!' };
    }
    const standingPins = physicalPins.filter(pin => !pin.scored && !isPinKnocked(pin)).length;
    const spawned = Math.max(1, GAME.stats.pinsSpawned || physicalPins.length || 1);
    const knockedPins = Math.max(0, spawned - standingPins);
    const nearClear = standingPins <= 2 || knockedPins / spawned >= 0.85;
    if (nearClear) {
        return { shouldRerack: true, reason: 'Near clear: fresh rack!' };
    }
    const remainingValue = remainingRackScoreValue();
    const finalRollSafetyNet = GAME.rollsLeft === 1;
    if (finalRollSafetyNet && GAME.score + remainingValue < GAME.targetScore) {
        return { shouldRerack: true, reason: 'Rack cannot cover target: fresh rack!' };
    }
    return { shouldRerack: false, reason: '' };
}

function prepareNextRoll(forceFreshRack = false) {
    clearRollWatchdog();
    GAME.state = 'MAIN_METER';
    launchX = 0;
    GAME.stats.currentRollScore = 0;
    GAME.stats.currentRollPins = 0;
    GAME.stats.currentRollBonusScore = 0;
    GAME.stats.rollRecorded = false;
    spawnBall();

    // Clear scored pins to prevent double-counting and collision path blocking.
    physicalPins.forEach((pin) => {
        if (pin.scored || isPinKnocked(pin)) {
            if (pin.body) world.remove(pin.body);
            disposeGameVisual(pin.mesh);
            disposePinReflection(pin);
        }
    });
    reflectionObjects = reflectionObjects.filter(obj => obj.parent);
    physicalPins = physicalPins.filter(pin => !pin.scored && !isPinKnocked(pin));
    if (forceFreshRack || physicalPins.length === 0) {
        generatePinGrid(GAME.frame);
        triggerRackLoadedSweep();
        if (forceFreshRack) showAlert('Fresh rack!');
    }

    gauge.start();
    setPreRollCamera();
    if (GAME.currentRoute && GAME.frame > 1) {
        showAlert(`${GAME.currentRoute.label}: ${GAME.currentRoute.name}`);
    }
    updateUI();
}

function resetTenPinState(specialPinsEnabled = true, fullBag = GAME.tenPin?.fullBag ?? true) {
    GAME.tenPin = {
        specialPinsEnabled,
        fullBag,
        frames: Array.from({ length: 10 }, () => ({ rolls: [] })),
        selectedRackSpecials: [],
        shopSelection: [],
        shopRerolls: 0,
        pendingRackSpecialTypes: [],
        manualRackAssignments: Array(10).fill(null),
        manualRackSelectedIndex: null,
        manualRackNext: false,
        rackPinIndex: 0,
        awaitingShopFrame: 1
    };
}

function startTenPinGame() {
    GAME.paused = false;
    GAME.mode = 'tenpin';
    activeHook = 0;
    GAME.frame = 1;
    GAME.stage = 1;
    GAME.frameInStage = 1;
    GAME.score = 0;
    GAME.targetScore = 300;
    GAME.cash = GAME.tenPin.specialPinsEnabled ? 8 : 0;
    GAME.cumulativeScore = 0;
    GAME.currentRoute = { ...ROUTE_TYPES.STANDARD, layout: 'classic', pinScoreMod: 1 };
    GAME.routeOptions = [];
    GAME.completedNodes = [];
    GAME.runSeed = null;
    GAME.saveSlot = null;
    GAME.shopSelection = [];
    GAME.shopSoldOut = [];
    GAME.shopRerolls = 0;
    GAME.upgradePurchases = 0;
    GAME.activeUpgrades = defaultActiveUpgrades();
    GAME.runModifiers = defaultRunModifiers();
    GAME.activeUpgrades.goldPinChance = 0;
    GAME.activeUpgrades.bouncyPinChance = 0;
    document.getElementById('shop-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('event-screen').classList.add('hidden');
    document.getElementById('route-screen').classList.add('hidden');
    if (GAME.tenPin.specialPinsEnabled) {
        showTenPinShop(1);
    } else {
        startTenPinFrame();
    }
}

function startTenPinFrame() {
    clearRollWatchdog();
    GAME.mode = 'tenpin';
    GAME.state = 'MAIN_METER';
    GAME.targetScore = 300;
    GAME.stats.maxRollsThisFrame = GAME.frame === 10 ? 3 : 2;
    GAME.rollsLeft = GAME.stats.maxRollsThisFrame;
    GAME.stats.rollsThisFrame = 0;
    GAME.stats.currentRollScore = 0;
    GAME.stats.currentRollPins = 0;
    GAME.stats.currentRollBonusScore = 0;
    GAME.stats.rollScores = [];
    GAME.stats.rollRecorded = false;
    GAME.stats.canContinueRoll = false;
    GAME.stats.promptSounded = false;
    clearTimeout(GAME.stats.reviewTimer);
    GAME.stats.reviewTimer = null;

    buildPhysicalLane(requestedPhysicsLaneWidth(GAME.frame));
    generatePinGrid(GAME.frame);
    triggerRackLoadedSweep();
    toggleGutterGuards(false);
    launchX = 0;
    spawnBall();
    gauge.start();
    setPreRollCamera();
    updateUI();
}

function tenPinRollPins(roll) {
    return typeof roll === 'object' ? roll.pins : Number(roll || 0);
}

function tenPinRollFrameScore(roll) {
    return typeof roll === 'object' ? roll.frameScore : Number(roll || 0);
}

function tenPinRollBonusScore(roll) {
    return typeof roll === 'object' ? roll.bonusScore : Number(roll || 0);
}

function createTenPinRollRecord() {
    const pins = Math.min(10, GAME.stats.currentRollPins || 0);
    const frameScore = Math.max(pins, GAME.stats.currentRollScore || 0);
    const bonusScore = Math.max(frameScore, GAME.stats.currentRollBonusScore || frameScore);
    return { pins, frameScore, bonusScore };
}

function tenPinFrameIsComplete(frame, frameNumber) {
    if (!frame) return false;
    const rolls = frame.rolls;
    if (frameNumber < 10) return tenPinRollPins(rolls[0]) === 10 || rolls.length >= 2;
    if (rolls.length < 2) return false;
    if (rolls.length >= 3) return true;
    return tenPinRollPins(rolls[0]) + tenPinRollPins(rolls[1]) < 10;
}

function tenPinNeedsFreshRack(frame, frameNumber) {
    const rolls = frame.rolls;
    if (frameNumber < 10) return false;
    if (rolls.length === 1 && tenPinRollPins(rolls[0]) === 10) return true;
    if (rolls.length === 2 && (tenPinRollPins(rolls[0]) === 10 || tenPinRollPins(rolls[0]) + tenPinRollPins(rolls[1]) === 10)) return true;
    return false;
}

function finishTenPinRollReview() {
    clearTimeout(GAME.stats.reviewTimer);
    GAME.stats.reviewTimer = null;
    scoreFallenPins();
    const frame = GAME.tenPin.frames[GAME.frame - 1];
    const rollRecord = createTenPinRollRecord();
    frame.rolls.push(rollRecord);
    GAME.stats.rollScores.push(rollRecord.pins);
    GAME.stats.rollRecorded = true;
    GAME.score = calculateTenPinScore(GAME.tenPin.frames);
    GAME.cumulativeScore = GAME.score;

    const centerMsg = document.getElementById('center-message');
    centerMsg.classList.add('hidden');
    clearScoreCelebrationClasses();
    centerMsg.style.whiteSpace = 'normal';

    const complete = tenPinFrameIsComplete(frame, GAME.frame);
    updateUI();
    if (complete) {
        if (GAME.frame >= 10) {
            endTenPinGame();
            return;
        }
        GAME.frame++;
        if (GAME.tenPin.specialPinsEnabled) {
            showTenPinShop(GAME.frame);
        } else {
            startTenPinFrame();
        }
        return;
    }

    prepareNextRoll(tenPinNeedsFreshRack(frame, GAME.frame));
}

function calculateTenPinScore(frames) {
    const rolls = [];
    frames.forEach(frame => frame.rolls.forEach(roll => rolls.push(roll)));
    let score = 0;
    let rollIndex = 0;
    for (let frameIndex = 0; frameIndex < 10; frameIndex++) {
        const first = rolls[rollIndex];
        if (first === undefined) break;
        if (tenPinRollPins(first) === 10) {
            if (rolls[rollIndex + 1] === undefined || rolls[rollIndex + 2] === undefined) break;
            score += tenPinRollFrameScore(first) + tenPinRollBonusScore(rolls[rollIndex + 1]) + tenPinRollBonusScore(rolls[rollIndex + 2]);
            rollIndex += 1;
            continue;
        }
        const second = rolls[rollIndex + 1];
        if (second === undefined) break;
        const framePins = tenPinRollPins(first) + tenPinRollPins(second);
        const frameScore = tenPinRollFrameScore(first) + tenPinRollFrameScore(second);
        if (framePins === 10) {
            if (rolls[rollIndex + 2] === undefined) break;
            score += frameScore + tenPinRollBonusScore(rolls[rollIndex + 2]);
        } else {
            score += frameScore;
        }
        rollIndex += 2;
    }
    return score;
}

function calculateTenPinHudScore(frames) {
    const officialScore = calculateTenPinScore(frames);
    const tenthFrame = frames[9];
    if (!tenthFrame?.rolls?.length || tenPinFrameIsComplete(tenthFrame, 10)) return officialScore;
    const firstNineScore = calculateTenPinScore(frames.slice(0, 9));
    const partialTenthScore = tenthFrame.rolls.reduce((sum, roll) => sum + tenPinRollFrameScore(roll), 0);
    return Math.max(officialScore, firstNineScore + partialTenthScore);
}

function tenPinRunningTotal(frameIndex) {
    return calculateTenPinScore(GAME.tenPin.frames.slice(0, frameIndex + 1));
}

function tenPinProjectedFramesForHud() {
    const frames = GAME.tenPin.frames.map(frame => ({ rolls: [...(frame?.rolls || [])] }));
    const activeFrame = frames[GAME.frame - 1];
    const shouldShowLiveRoll = activeFrame && !GAME.stats.rollRecorded && GAME.stats.rollsThisFrame > 0 && GAME.state !== 'MAIN_METER';
    if (shouldShowLiveRoll) activeFrame.rolls.push(createTenPinRollRecord());
    return frames;
}

function tenPinLiveScore() {
    const committedScore = calculateTenPinHudScore(GAME.tenPin.frames);
    if (GAME.stats.rollsThisFrame <= 0 || GAME.stats.rollRecorded || GAME.state === 'MAIN_METER') return committedScore;
    const projectedScore = calculateTenPinHudScore(tenPinProjectedFramesForHud());
    return Math.max(projectedScore, committedScore + GAME.stats.currentRollScore);
}

function tenPinRollMarks(frame, frameNumber) {
    const rolls = frame?.rolls || [];
    if (!rolls.length) return ['-', frameNumber === 10 ? '-' : ''];
    const markWithExtra = (roll, mark) => {
        const extra = Math.max(0, tenPinRollFrameScore(roll) - tenPinRollPins(roll));
        return extra && mark !== '-' ? `${mark}+${extra}` : mark;
    };
    if (frameNumber < 10) {
        const firstPins = tenPinRollPins(rolls[0]);
        if (firstPins === 10) return [markWithExtra(rolls[0], 'X'), ''];
        if (rolls.length === 1) return [markWithExtra(rolls[0], firstPins === 0 ? '-' : String(firstPins)), ''];
        const secondPins = tenPinRollPins(rolls[1]);
        return [
            markWithExtra(rolls[0], firstPins === 0 ? '-' : String(firstPins)),
            markWithExtra(rolls[1], firstPins + secondPins === 10 ? '/' : secondPins === 0 ? '-' : String(secondPins))
        ];
    }
    return [0, 1, 2].map((index) => {
        const roll = rolls[index];
        if (roll === undefined) return '-';
        const pins = tenPinRollPins(roll);
        if (pins === 10) return markWithExtra(roll, 'X');
        if (index > 0 && tenPinRollPins(rolls[index - 1]) !== 10 && tenPinRollPins(rolls[index - 1]) + pins === 10) return markWithExtra(roll, '/');
        return markWithExtra(roll, pins === 0 ? '-' : String(pins));
    });
}

function showTenPinShop(frameNumber) {
    closeShopInspector(false);
    shopCatalogFilter = GAME.tenPin.fullBag ? 'pins' : 'all';
    document.getElementById('shop-screen').classList.remove('boss-cleared');
    document.getElementById('shop-screen').dataset.mode = 'tenpin';
    GAME.state = 'SHOP';
    document.getElementById('shop-purchase-feedback').hidden = true;
    GAME.tenPin.awaitingShopFrame = frameNumber;
    GAME.tenPin.selectedRackSpecials = [];
    GAME.tenPin.shopSelection = [];
    GAME.tenPin.shopRerolls = 0;
    chooseTenPinShopSelection();
    document.getElementById('shop-screen').classList.remove('hidden');
    document.getElementById('event-screen').classList.add('hidden');
    document.getElementById('route-screen').classList.add('hidden');
    document.querySelector('#shop-screen h2').innerText = 'RACK & ROLL.';
    document.getElementById('shop-kicker').textContent = `CLASSIC / FRAME ${String(frameNumber).padStart(2, '0')} PRO SHOP`;
    document.querySelector('#shop-screen p').innerText = 'Pick your pins. Pack your next throw.';
    document.getElementById('shop-next-goal-row').classList.add('hidden');
    document.getElementById('btn-next-frame').innerText = `Start Frame ${frameNumber}`;
    document.getElementById('btn-shop-reroll').classList.add('hidden');
    document.getElementById('btn-tenpin-reroll-shop').classList.toggle('hidden', GAME.tenPin.fullBag);
    document.getElementById('shop-cash-display').innerText = uiNumber(GAME.cash);
    document.getElementById('shop-cash-display').title = `Exact: ${uiExactNumber(GAME.cash)}`;
    renderTenPinShop();
}

function chooseTenPinShopSelection(force = false) {
    if (GAME.tenPin.fullBag) {
        GAME.tenPin.shopSelection = TENPIN_SHOP_ITEMS.map(item => item.id);
        return;
    }
    if (!force && GAME.tenPin.shopSelection?.length) return;
    GAME.tenPin.shopSelection = [...TENPIN_SHOP_ITEMS]
        .sort(() => Math.random() - 0.5)
        .slice(0, Math.min(6, TENPIN_SHOP_ITEMS.length))
        .map(item => item.id);
}

function renderTenPinShop() {
    const visibleItems = (GAME.tenPin.shopSelection?.length ? GAME.tenPin.shopSelection : TENPIN_SHOP_ITEMS.map(item => item.id))
        .map(itemId => TENPIN_SHOP_ITEMS.find(item => item.id === itemId)).filter(Boolean);
    const rerollButton = document.getElementById('btn-tenpin-reroll-shop');
    const rerollCost = tenPinShopRerollCost();
    rerollButton.classList.toggle('hidden', GAME.tenPin.fullBag);
    rerollButton.disabled = GAME.cash < rerollCost;
    rerollButton.classList.toggle('pixel-btn-disabled', GAME.cash < rerollCost);
    rerollButton.innerText = `NEW BAG / $${rerollCost}`;
    document.getElementById('shop-cash-display').textContent = uiNumber(GAME.cash);
    document.getElementById('shop-shelf-title').textContent = GAME.tenPin.fullBag ? 'THE FULL BAG' : 'TONIGHT’S FINDS';
    document.getElementById('shop-stock-note').textContent = 'Up to 3 special pins per rack.';
    const tabs = document.getElementById('shop-catalog-tabs');
    tabs.hidden = false;
    tabs.innerHTML = [['all', 'ALL GEAR'], ['pins', 'PIN RACK'], ['gear', 'BALL BAG']].map(([key, label]) => {
        const count = visibleItems.filter(item => key === 'all' || (key === 'pins' ? item.typeKey : !item.typeKey)).length;
        return `<button type="button" data-shelf="${key}" aria-pressed="${shopCatalogFilter === key}" ${count ? '' : 'disabled'}>${label} <small>${count}</small></button>`;
    }).join('');
    tabs.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
        shopCatalogFilter = button.dataset.shelf;
        document.getElementById('shop-items-container').scrollTop = 0;
        sfx.playTick();
        renderTenPinShop();
    }));
    renderProShopCards(visibleItems.filter(item => shopCatalogFilter === 'all' || (shopCatalogFilter === 'pins' ? item.typeKey : !item.typeKey)), true);
    renderProShopLoadout();
}

function renderProShopCards(items, classic = false) {
    const container = document.getElementById('shop-items-container');
    const scrollTop = container.scrollTop;
    container.dataset.catalog = classic ? 'rack' : 'upgrades';
    container.innerHTML = items.map((item, index) => {
        const visual = shopVisual(item);
        const cost = classic ? item.cost : upgradeCost(item);
        const soldOut = !classic && (item.traitId ? GAME.ballLoadout.balls.every(ball => ball.traits.includes(item.traitId)) : !item.repeatable && (GAME.shopSoldOut || []).includes(item.id));
        const count = classic && item.typeKey ? GAME.tenPin.selectedRackSpecials.filter(type => type === item.typeKey).length : 0;
        const temporary = visual.duration !== 'THIS RUN';
        const offer = shopOfferState({ cash: GAME.cash, cost, soldOut, temporary, rackFull: classic && item.typeKey && GAME.tenPin.selectedRackSpecials.length >= 3, ready: classic && item.id === 'manual_rack' && GAME.tenPin.manualRackNext });
        const scope = classic ? null : equipmentScope(item);
        // Ball traits open the receiver selector even when the active ball owns
        // one; the reserve ball may still be eligible.
        const canOpenReceiver = !classic && item.traitId && !GAME.ballLoadout.balls.every(ball => ball.traits.includes(item.traitId));
        const actionLabel = canOpenReceiver ? `Choose receiving ball for ${item.name}` : `${offer.label} ${item.name}${offer.canBuy ? ` for ${cost} Pin Dollars` : ''}`;
        return `<article class="gear-card ${offer.state}" data-gear-id="${item.id}" style="--gear-color:${visual.color};--gear-order:${index}">
            <div class="gear-card-top"><span>${scope?.label || visual.duration}</span><button type="button" class="gear-inspect-button" data-inspect-gear="${item.id}" aria-label="Inspect ${escapeHtml(item.name)}">i</button></div>
            <div class="gear-display">${shopArtwork(item)}${count ? `<span class="gear-packed-count">×${count} PACKED</span>` : ''}${soldOut ? `<span class="gear-owned-stamp">✓ ${temporary ? 'PACKED' : 'INSTALLED'}</span>` : ''}</div>
            <div class="gear-copy"><span class="gear-category">${escapeHtml(item.category)}</span><h3>${escapeHtml(item.name)}</h3><div class="gear-benefit"><b>${visual.value}</b><span>${visual.label}</span></div><p>${visual.summary}</p>${scope ? `<small class="gear-scope-limit">${scope.limit}</small>` : ''}</div>
            <button type="button" class="gear-buy" data-buy-gear="${item.id}" aria-label="${escapeHtml(actionLabel)}" ${offer.canBuy || canOpenReceiver ? '' : 'disabled'}><span>${canOpenReceiver ? 'CHOOSE BALL' : offer.label}</span><b>${offer.state === 'owned' && !canOpenReceiver ? '✓' : `$${cost}`}</b></button>
        </article>`;
    }).join('');
    container.scrollTop = scrollTop;
    container.querySelectorAll('[data-buy-gear]').forEach(button => button.addEventListener('click', () => classic ? window.purchaseTenPinItem(button.dataset.buyGear) : SHOP_UPGRADES.find(item => item.id === button.dataset.buyGear)?.traitId ? openShopInspector(button.dataset.buyGear, false) : window.purchaseUpgrade(button.dataset.buyGear)));
    container.querySelectorAll('[data-inspect-gear]').forEach(button => button.addEventListener('click', () => openShopInspector(button.dataset.inspectGear, classic)));
}

function renderProShopLoadout() {
    const container = document.getElementById('shop-loadout');
    if (isTenPinMode()) {
        const selected = GAME.tenPin.selectedRackSpecials;
        const nextThrowReady = ['nextThrowMassBoost', 'nextThrowPowerBoost', 'nextThrowFocus', 'nextThrowHookBoost', 'nextThrowStability'].some(key => Boolean(GAME.activeUpgrades[key]));
        container.innerHTML = `<div class="loadout-label"><span>YOUR NEXT RACK</span><b>${selected.length} / 3 PACKED</b></div><div class="rack-bag-slots">${Array.from({ length: 3 }, (_, index) => {
            const key = selected[index];
            return `<div class="rack-bag-slot ${key ? 'is-packed' : ''}">${key ? shopPinArt(key.toLowerCase()) : '<span class="empty-bag-slot">+</span>'}<span>${key ? escapeHtml(pinTypeLabel(key)) : 'EMPTY'}</span></div>`;
        }).join('')}</div><div class="loadout-note">${GAME.tenPin.manualRackNext ? 'MANUAL SETUP READY' : 'AUTO RACK'}<span>${nextThrowReady ? 'BALL TECH PACKED' : 'PICK YOUR EDGE'}</span></div>`;
    } else {
        container.innerHTML = buildSummaryMarkup(GAME);
        container.querySelectorAll('[data-ball-index]').forEach(button => button.addEventListener('click', () => selectLoadoutBall(Number(button.dataset.ballIndex))));
    }
}

function openShopInspector(itemId, classic) {
    if (GAME.state !== 'SHOP') return;
    const item = (classic ? TENPIN_SHOP_ITEMS : SHOP_UPGRADES).find(candidate => candidate.id === itemId);
    if (!item) return;
    pendingBallPurchase = null;
    const visual = shopVisual(item);
    const screen = document.getElementById('shop-inspect-screen');
    shopInspectorReturnFocus = document.activeElement;
    screen.style.setProperty('--gear-color', visual.color);
    document.getElementById('gear-inspect-content').innerHTML = `<div class="gear-inspect-art">${shopArtwork(item)}<span>${visual.duration}</span></div><div class="gear-inspect-copy"><span class="arcade-eyebrow">${escapeHtml(item.category)}</span><h2 id="gear-inspect-name">${escapeHtml(item.name)}</h2><div class="gear-benefit"><b>${visual.value}</b><span>${visual.label}</span></div><p>${renderVocabularyText(item.desc)}</p><div class="gear-spec-price"><span>HOUSE PRICE</span><b>$${classic ? item.cost : upgradeCost(item)}</b></div></div>`;
    if (!classic && item.traitId) renderTraitReceiver(item);
    screen.classList.remove('hidden');
    document.getElementById('btn-close-shop-inspect').focus({ preventScroll: true });
    sfx.playTick();
}

function closeShopInspector(restoreFocus = true) {
    pendingBallPurchase = null;
    document.getElementById('shop-inspect-screen')?.classList.add('hidden');
    if (restoreFocus && shopInspectorReturnFocus?.isConnected) shopInspectorReturnFocus.focus({ preventScroll: true });
    shopInspectorReturnFocus = null;
}

function showShopPurchase(item, receiverName = null) {
    const feedback = document.getElementById('shop-purchase-feedback');
    const visual = shopVisual(item);
    clearTimeout(shopFeedbackTimer);
    feedback.style.setProperty('--gear-color', visual.color);
    feedback.innerHTML = `${shopArtwork(item)}<div><span>${visual.duration === 'THIS RUN' ? 'UPGRADE INSTALLED' : 'READY TO ROLL'}</span><b>${escapeHtml(item.name)}${receiverName ? ` → ${escapeHtml(receiverName)}` : ''}</b></div><strong>✓</strong>`;
    feedback.hidden = false;
    shopFeedbackTimer = setTimeout(() => { feedback.hidden = true; }, 2200);
}

function tenPinShopRerollCost() {
    const used = Math.max(0, GAME.tenPin.shopRerolls || 0);
    return 2 + used * 2 + Math.floor(Math.pow(used, 1.35));
}

window.purchaseTenPinItem = function(itemId) {
    if (GAME.state !== 'SHOP' || !isTenPinMode()) return;
    const item = TENPIN_SHOP_ITEMS.find(candidate => candidate.id === itemId);
    if (!item || GAME.cash < item.cost) return;
    if (item.typeKey && GAME.tenPin.selectedRackSpecials.length >= 3) return;
    if (item.id === 'manual_rack' && GAME.tenPin.manualRackNext) return;
    GAME.cash -= item.cost;
    if (item.typeKey) GAME.tenPin.selectedRackSpecials.push(item.typeKey);
    if (item.effect) item.effect();
    sfx.playCoin();
    document.getElementById('shop-cash-display').innerText = uiNumber(GAME.cash);
    document.getElementById('shop-cash-display').title = `Exact: ${uiExactNumber(GAME.cash)}`;
    renderTenPinShop();
    showShopPurchase(item);
    updateUI();
};

function shouldShowManualRack() {
    return isTenPinMode() && GAME.tenPin.manualRackNext && GAME.tenPin.selectedRackSpecials.length > 0;
}

function manualRackIsComplete() {
    const assignments = GAME.tenPin.manualRackAssignments || [];
    const placed = assignments.filter(index => index !== null && index !== undefined).length;
    return placed === GAME.tenPin.selectedRackSpecials.length;
}

function pinTypeLabel(typeKey) {
    return PIN_TYPES[typeKey]?.name || typeKey || 'Pin';
}

function pinTypeColor(typeKey) {
    const color = PIN_TYPES[typeKey]?.color ?? 0xffffff;
    return `#${color.toString(16).padStart(6, '0')}`;
}

const LEGEND_SEEN = {
    upgrades: new Set(),
    bosses: new Set(),
    events: new Set(),
    pins: new Set(['STANDARD'])
};

function rememberLegendSeen(kind, id) {
    if (!LEGEND_SEEN[kind] || !id) return;
    LEGEND_SEEN[kind].add(id);
}

function legendEntriesFor(tab) {
    if (tab === 'upgrades') {
        return SHOP_UPGRADES.map(item => ({
            id: item.id,
            title: item.name,
            meta: `${item.category || 'UPGRADE'} / ${item.cost} $`,
            desc: item.desc,
            seen: LEGEND_SEEN.upgrades.has(item.id)
        }));
    }
    if (tab === 'bosses') {
        return Object.values(BOSS_VARIANTS).flat().map(item => ({
            id: item.id,
            title: item.name,
            meta: `${item.label} / reward ${item.reward || 0}`,
            desc: item.desc,
            seen: LEGEND_SEEN.bosses.has(item.id)
        }));
    }
    if (tab === 'events') {
        return EVENT_TYPES.map(item => ({
            id: item.id,
            title: item.name,
            meta: item.label,
            desc: `${item.desc} ${item.choices.map(choice => `${choice.title}: ${choice.desc}`).join(' ')}`,
            seen: LEGEND_SEEN.events.has(item.id)
        }));
    }
    if (tab === 'pins') {
        return Object.entries(PIN_TYPES).map(([key, item]) => ({
            id: key,
            title: item.name,
            meta: `Score ${item.pointValue} / Cash ${uiNumber(item.cashValue)}`,
            desc: key === 'GOLD' ? 'High-value pin. In 10-pin it adds +1 score to this frame and strike/spare bonuses.'
                : key === 'SILVER' ? '10-pin bonus pin. Normal on this frame, +1 when this roll pays a previous strike or spare.'
                : key === 'EXPLOSIVE' ? 'Special pin that can shove nearby pins unless an event disables TNT.'
                : key === 'IMPLOSIVE' ? 'Special pin that can pull nearby pins into tighter clusters.'
                : key === 'BOUNCY' ? 'Springy pin with extra bounce for messy carry.'
                : 'Standard house pin.',
            seen: LEGEND_SEEN.pins.has(key)
        }));
    }
    return TENPIN_SHOP_ITEMS.map(item => ({
        id: item.id,
        title: item.name,
        meta: `${item.category} / ${item.cost} $`,
        desc: item.desc,
        seen: true
    }));
}

function showLegend(tab = legendActiveTab) {
    legendActiveTab = tab;
    renderLegend();
    document.getElementById('legend-screen').classList.remove('hidden');
}

function hideLegend() {
    document.getElementById('legend-screen').classList.add('hidden');
}

function closeTopmostOverlay() {
    const inspect = document.getElementById('shop-inspect-screen');
    if (inspect && !inspect.classList.contains('hidden')) { closeShopInspector(); return true; }
    const legendScreen = document.getElementById('legend-screen');
    if (legendScreen && !legendScreen.classList.contains('hidden')) {
        hideLegend();
        return true;
    }
    const tutorialScreen = document.getElementById('tutorial-screen');
    if (tutorialScreen && !tutorialScreen.classList.contains('hidden')) {
        tutorialScreen.classList.add('hidden');
        return true;
    }
    const relicScreen = document.getElementById('relic-screen');
    if (relicScreen && !relicScreen.classList.contains('hidden')) {
        relicScreen.classList.add('hidden');
        updateMainMenuMeta();
        return true;
    }
    const statsScreen = document.getElementById('stats-screen');
    if (statsScreen && !statsScreen.classList.contains('hidden')) {
        statsScreen.classList.add('hidden');
        return true;
    }
    const center = menuCenterElement();
    if (center && !center.classList.contains('hidden') && !document.getElementById('main-menu')?.classList.contains('hidden')) {
        showMenuCenterHome();
        return true;
    }
    const hubDetail = document.getElementById('roguelike-hub-detail');
    if (hubDetail && !hubDetail.classList.contains('hidden')) {
        hubDetail.classList.add('hidden');
        hubDetail.innerHTML = '';
        return true;
    }
    return false;
}

function animateTextChars(text) {
    return [...String(text)].map((character, index) => {
        if (character === ' ') return ' ';
        return `<span class="item-char" style="--char-index:${index}">${escapeHtml(character)}</span>`;
    }).join('');
}

function renderLegend() {
    const tabs = [
        ['upgrades', 'Upgrades'],
        ['bosses', 'Bosses'],
        ['events', 'Events'],
        ['pins', 'Pins'],
        ['tenpin', '10-Pin']
    ];
    const tabContainer = document.getElementById('legend-tabs');
    const grid = document.getElementById('legend-grid');
    tabContainer.innerHTML = tabs.map(([id, label]) => `<button class="legend-tab ${id === legendActiveTab ? 'active' : ''}" data-legend-tab="${id}">${label}</button>`).join('');
    grid.innerHTML = legendEntriesFor(legendActiveTab).map(entry => {
        if (!entry.seen && legendActiveTab !== 'tenpin') return `<article class="legend-card legend-unknown"><div class="field-guide-art">${cabinetArt('locked', '#9272bc')}</div><b>UNDISCOVERED</b><p>Find it out on the circuit.</p></article>`;
        const item = [...SHOP_UPGRADES, ...TENPIN_SHOP_ITEMS].find(item => item.id === entry.id);
        const boss = Object.values(BOSS_VARIANTS).flat().find(item => item.id === entry.id);
        const event = EVENT_TYPES.find(item => item.id === entry.id);
        const art = legendActiveTab === 'pins' ? shopPinArt(entry.id.toLowerCase()) : boss ? bossEmblem(boss) : event ? eventSceneArt(event.id) : item ? shopArtwork(item) : cabinetArt('record');
        const summary = item ? `${shopVisual(item).value} ${shopVisual(item).label}` : boss ? 'HOUSE BOSS' : event ? eventVisual(event.id).tag : entry.meta;
        return `<article class="legend-card"><div class="field-guide-art">${art}</div><span class="legend-meta">${escapeHtml(summary || '')}</span><h3>${escapeHtml(entry.title)}</h3><details><summary>FULL HOUSE RULES <span>+</span></summary><p>${renderVocabularyText(entry.desc || '')}</p></details></article>`;
    }).join('');
}

function showManualRackScreen() {
    GAME.tenPin.manualRackAssignments = Array(10).fill(null);
    GAME.tenPin.manualRackSelectedIndex = 0;
    document.getElementById('tenpin-rack-screen').classList.remove('hidden');
    renderManualRackScreen();
}

function renderManualRackScreen() {
    const selectedPins = GAME.tenPin.selectedRackSpecials;
    const assignments = GAME.tenPin.manualRackAssignments || Array(10).fill(null);
    const placedIndexes = new Set(assignments.filter(index => index !== null && index !== undefined));
    if (GAME.tenPin.manualRackSelectedIndex !== null && placedIndexes.has(GAME.tenPin.manualRackSelectedIndex)) {
        const nextAvailable = selectedPins.findIndex((_, index) => !placedIndexes.has(index));
        GAME.tenPin.manualRackSelectedIndex = nextAvailable >= 0 ? nextAvailable : null;
    }
    const selectedIndex = GAME.tenPin.manualRackSelectedIndex;
    const board = document.getElementById('tenpin-rack-board');
    const palette = document.getElementById('tenpin-rack-palette');
    const status = document.getElementById('tenpin-rack-status');
    board.innerHTML = '';
    palette.innerHTML = '';

    TENPIN_RACK_SLOTS.forEach((slot, slotIndex) => {
        const purchaseIndex = assignments[slotIndex];
        const typeKey = purchaseIndex !== null && purchaseIndex !== undefined ? selectedPins[purchaseIndex] : null;
        const button = document.createElement('button');
        button.className = `rack-slot ${typeKey ? 'is-special' : ''}`;
        button.style.left = `${slot.x}%`;
        button.style.top = `${slot.y}%`;
        button.innerHTML = `${shopPinArt(typeKey ? typeKey.toLowerCase() : 'standard')}<span>${slot.label}</span>`;
        button.title = typeKey ? `${pinTypeLabel(typeKey)} in ${slot.label} pin slot` : `${slot.label} pin slot`;
        button.setAttribute('aria-label', button.title);
        button.addEventListener('click', () => {
            if (typeKey) {
                assignments[slotIndex] = null;
                GAME.tenPin.manualRackSelectedIndex = purchaseIndex;
            } else if (selectedIndex !== null && selectedIndex !== undefined && !placedIndexes.has(selectedIndex)) {
                assignments[slotIndex] = selectedIndex;
                const nextIndex = selectedPins.findIndex((_, index) => index !== selectedIndex && !placedIndexes.has(index));
                GAME.tenPin.manualRackSelectedIndex = nextIndex >= 0 ? nextIndex : null;
            }
            renderManualRackScreen();
        });
        board.appendChild(button);
    });

    selectedPins.forEach((typeKey, index) => {
        const placed = placedIndexes.has(index);
        const button = document.createElement('button');
        button.className = 'rack-palette-pin';
        button.setAttribute('aria-pressed', String(selectedIndex === index));
        button.disabled = placed;
        button.innerHTML = `${shopPinArt(typeKey.toLowerCase())}<span><b>${escapeHtml(pinTypeLabel(typeKey))}</b><small>${placed ? '✓ PLACED' : 'PICK A SLOT'}</small></span>`;
        button.addEventListener('click', () => {
            GAME.tenPin.manualRackSelectedIndex = index;
            renderManualRackScreen();
        });
        palette.appendChild(button);
    });

    const placedCount = placedIndexes.size;
    status.innerText = `${placedCount} / ${selectedPins.length} PINS SET`;
    document.getElementById('btn-confirm-manual-rack').disabled = !manualRackIsComplete();
    document.getElementById('btn-confirm-manual-rack').classList.toggle('pixel-btn-disabled', !manualRackIsComplete());
}

function showTenPinScoreboard() {
    renderTenPinScoreboard();
    document.getElementById('tenpin-scoreboard-screen').classList.remove('hidden');
}

function hideTenPinScoreboard() {
    document.getElementById('tenpin-scoreboard-screen').classList.add('hidden');
}

function renderTenPinScoreboard() {
    const grid = document.getElementById('tenpin-scoreboard-grid');
    grid.innerHTML = '';
    for (let frameNumber = 1; frameNumber <= 10; frameNumber++) {
        const frame = GAME.tenPin.frames[frameNumber - 1];
        const marks = tenPinRollMarks(frame, frameNumber);
        const active = frameNumber === GAME.frame && GAME.state !== 'GAMEOVER';
        const box = document.createElement('div');
        box.className = `border-2 ${active ? 'border-yellow-300 text-yellow-200' : 'border-white/70 text-white'} bg-violet-950/50`;
        box.innerHTML = `
            <div class="border-b border-white/70 px-3 py-3 text-center text-[12px]">FRAME ${frameNumber}</div>
            <div class="grid ${frameNumber === 10 ? 'grid-cols-3' : 'grid-cols-2'} min-h-14 text-[17px]">
                ${marks.map(mark => `<span class="border-r border-white/40 py-3 text-center">${mark}</span>`).join('')}
            </div>
            <div class="border-t border-white/70 px-3 py-3 text-center text-[16px] text-emerald-300">${tenPinRunningTotal(frameNumber - 1) ? uiNumber(tenPinRunningTotal(frameNumber - 1)) : '-'}</div>
        `;
        grid.appendChild(box);
    }
}

function triggerShopTransition() {
    closeShopInspector(false);
    document.getElementById('route-screen').classList.add('hidden');
    document.getElementById('shop-screen').dataset.mode = 'roguelike';
    document.getElementById('shop-catalog-tabs').hidden = true;
    document.getElementById('shop-shelf-title').textContent = 'FRESH FROM THE HOUSE';
    document.getElementById('shop-stock-note').textContent = 'Prices rise as you upgrade.';
    document.getElementById('shop-kicker').textContent = GAME.currentRoute?.boss ? 'HOUSE BOSS DEFEATED / PRO SHOP' : `FRAME ${String(GAME.frame).padStart(2, '0')} CLEARED / PRO SHOP`;
    const enteringShop = GAME.state !== 'SHOP';
    if (GAME.currentRoute?.boss) recordBossBeat(GAME.currentRoute);
    GAME.state = 'SHOP';
    if (enteringShop) {
        clearGameplayLaneEffects();
        document.getElementById('shop-purchase-feedback').hidden = true;
        GAME.shopRerolls = 0;
        GAME.shopSoldOut = [];
    }
    document.getElementById('shop-screen').classList.remove('hidden');
    document.getElementById('event-screen').classList.add('hidden');
    document.getElementById('debug-actions-screen').classList.add('hidden');
    document.getElementById('btn-tenpin-reroll-shop').classList.add('hidden');
    document.getElementById('btn-shop-reroll').classList.remove('hidden');
    document.getElementById('shop-screen').classList.toggle('boss-cleared', Boolean(GAME.currentRoute?.boss));
    document.querySelector('#shop-screen h2').innerText = GAME.currentRoute?.boss ? 'THE HOUSE IS YOURS.' : 'BUILD YOUR HOUSE.';
    document.querySelector('#shop-screen p').innerText = 'Pick some trouble. Take it to the lane.';
    document.getElementById('shop-next-goal-row').classList.remove('hidden');
    
    const nextFrame = Math.min(GAME.maxFrames, GAME.frame + 1);
    document.getElementById('shop-next-target').innerText = GAME.frame >= GAME.maxFrames ? 'Run Complete' : `Choose route to Frame ${nextFrame}`;
    document.getElementById('btn-next-frame').innerText = 'Return to Route Map';
    document.getElementById('shop-cash-display').innerText = uiNumber(GAME.cash);
    document.getElementById('shop-cash-display').title = `Exact: ${uiExactNumber(GAME.cash)}`;
    renderShopRerollButton();

    const container = document.getElementById('shop-items-container');
    container.innerHTML = '';

    if (!GAME.shopSelection.length) {
        GAME.shopSelection = chooseShopSelection().map(item => item.id);
    }
    GAME.shopSelection = GAME.shopSelection.slice(0, SHOP_OFFER_COUNT);
    autoSaveRunSlot();
    const selection = GAME.shopSelection
        .map(itemId => SHOP_UPGRADES.find(item => item.id === itemId))
        .filter(Boolean);
    selection.forEach(item => rememberLegendSeen('upgrades', item.id));

    renderProShopCards(selection);
    renderProShopLoadout();
}

function shopRerollCost() {
    const used = Math.max(0, GAME.shopRerolls || 0);
    return 2 + used * 2 + Math.floor(Math.pow(used, 1.35));
}

function renderShopRerollButton() {
    const button = document.getElementById('btn-shop-reroll');
    if (!button) return;
    const cost = Math.max(0, shopRerollCost() - shopRerollDiscount());
    const canAfford = GAME.cash >= cost;
    button.innerText = `NEW STOCK / $${cost}`;
    button.disabled = !canAfford;
    button.classList.toggle('pixel-btn-disabled', !canAfford);
}

function upgradeCost(item) {
    const stageTax = Math.max(0, GAME.stage - 1) * 3;
    const purchaseTax = GAME.upgradePurchases <= 1
        ? GAME.upgradePurchases * 2
        : GAME.upgradePurchases * 3 + Math.floor(Math.pow(GAME.upgradePurchases - 1, 1.2));
    const earlyDiscount = GAME.frame <= 2 ? 2 : GAME.frame === 3 ? 1 : 0;
    return Math.max(3, Math.ceil(item.cost + stageTax + purchaseTax - earlyDiscount));
}

function chooseShopSelection(options = {}) {
    const activeSeed = GAME.runModifiers?.daily?.enabled ? GAME.runModifiers.daily.seed : GAME.runSeed;
    if (activeSeed && !options.seededRun) {
        const excludeKey = (options.excludeIds || []).join(',');
        return withSeededRandom(`${activeSeed}:shop:${GAME.frame}:${GAME.shopRerolls}:${excludeKey}`, () => chooseShopSelection({ ...options, seededRun: true }));
    }
    const excludeIds = new Set(options.excludeIds || []);
    const pool = SHOP_UPGRADES.filter(item => !excludeIds.has(item.id));
    const source = pool.length >= 3 ? pool : SHOP_UPGRADES;
    const byCategory = new Map();
    source.forEach((item) => {
        const category = item.category || 'UPGRADE';
        if (!byCategory.has(category)) byCategory.set(category, []);
        byCategory.get(category).push(item);
    });
    const categories = [...byCategory.keys()].sort(() => 0.5 - Math.random());
    const picks = [];
    const addUnique = (item) => {
        if (picks.length >= SHOP_OFFER_COUNT) return;
        if (item && !picks.some(existing => existing.id === item.id)) picks.push(item);
    };
    const pickFromCategory = (category) => {
        const items = byCategory.get(category);
        if (!items?.length) return null;
        return items[Math.floor(Math.random() * items.length)];
    };
    (GAME.runModifiers?.daily?.shopUpgradeIds || []).forEach((id) => addUnique(source.find(item => item.id === id)));
    (GAME.runModifiers?.daily?.shopCategories || []).forEach((category) => {
        addUnique(pickFromCategory(category));
    });
    if (GAME.frame <= 4) {
        addUnique(pickFromCategory('BALL'));
        addUnique(pickFromCategory('PINS'));
        addUnique(pickFromCategory(Math.random() < 0.55 ? 'ONE THROW' : 'CONTROL'));
    }
    categories.forEach((category) => {
        addUnique(pickFromCategory(category));
    });
    while (picks.length < SHOP_OFFER_COUNT) {
        const item = source[Math.floor(Math.random() * source.length)];
        addUnique(item);
    }
    if (GAME.frame <= 3 && !picks.some(item => upgradeCost(item) <= GAME.cash)) {
        const affordable = source
            .filter(item => upgradeCost(item) <= GAME.cash)
            .sort((a, b) => upgradeCost(a) - upgradeCost(b))[0];
        if (affordable) picks[picks.length - 1] = affordable;
    }
    return picks;
}

function stageForFrame(frameNumber) {
    return Math.min(3, Math.ceil(frameNumber / 4));
}

function frameInStage(frameNumber) {
    return ((frameNumber - 1) % 4) + 1;
}

function generateRouteOptions(nextFrame) {
    if (nextFrame % 4 === 0) {
        return [{ ...chooseBossRoute(nextFrame) }];
    }
    const stage = stageForFrame(nextFrame);
    const pool = [
        ROUTE_TYPES.MESSY,
        ROUTE_TYPES.SPLIT,
        ROUTE_TYPES.OIL,
        ROUTE_TYPES.HEAVY,
        ROUTE_TYPES.FRAGILE,
        ROUTE_TYPES.GUTTER,
        ROUTE_TYPES.WIDE
    ];
    if (stage === 1) pool.push(ROUTE_TYPES.STANDARD);
    if (stage >= 2) {
        pool.push(ROUTE_TYPES.FRAGILE, ROUTE_TYPES.GUTTER, ROUTE_TYPES.WIDE);
    }
    const shuffled = [...pool].sort(() => 0.5 - Math.random());
    const routes = [];
    for (const route of shuffled) {
        if (!routes.some(existing => existing.id === route.id)) routes.push(route);
        if (routes.length >= 3) break;
    }
    if (nextFrame === 2 && !routes.some(route => route.id === 'standard')) routes[0] = ROUTE_TYPES.STANDARD;
    const shouldOfferEvent = frameInStage(nextFrame) === 2 || Math.random() < 0.35;
    if (nextFrame > 2 && nextFrame % 4 !== 3 && !routes.some(route => route.event) && shouldOfferEvent) {
        routes[routes.length - 1] = chooseEventRoute(nextFrame);
    }
    return routes.map(route => ({ ...route }));
}

function chooseBossRoute(frameNumber) {
    const variants = BOSS_VARIANTS[frameNumber] || [ROUTE_TYPES.BOSS];
    return variants[Math.floor(Math.random() * variants.length)];
}

function chooseEventRoute(frameNumber) {
    const event = EVENT_TYPES[Math.floor(Math.random() * EVENT_TYPES.length)];
    return {
        id: `event_${event.id}`,
        name: event.name,
        label: 'EVENT',
        desc: event.desc,
        reward: 0,
        targetMod: 0,
        rollBonus: 0,
        layout: 'event',
        event: true,
        eventId: event.id,
        frameNumber
    };
}

function buildRouteMap() {
    const rows = [];
    for (let frame = 1; frame <= GAME.maxFrames; frame++) {
        const routes = frame === 1 ? [{ ...ROUTE_TYPES.START }] : generateRouteOptions(frame);
        rows.push(routes.map((route, index) => ({
            id: `f${frame}-${index}`,
            frame,
            index,
            route,
            x: index,
            y: frame - 1
        })));
    }
    return rows;
}

function isPortraitMobileLayout() {
    return window.matchMedia?.('(max-width: 760px) and (orientation: portrait)')?.matches;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    })[char]);
}

function renderVocabularyText(value) {
    const keys = Object.keys(VOCABULARY).sort((a, b) => b.length - a.length);
    const pattern = new RegExp(`\\b(${keys.map(escapeRegExp).join('|')})\\b`, 'gi');
    return escapeHtml(value).replace(pattern, (match) => {
        const key = match.toLowerCase();
        const vocab = VOCABULARY[key];
        if (!vocab) return match;
        return `<span class="vocab-keyword" data-vocab="${escapeHtml(key)}" style="color:${vocab.color}">${escapeHtml(match)}</span>`;
    });
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function startNewRun(options = {}) {
    clearGameplayLaneEffects();
    GAME.paused = false;
    GAME.mode = 'roguelike';
    activeHook = 0;
    GAME.frame = 0;
    GAME.stage = 1;
    GAME.frameInStage = 0;
    GAME.score = 0;
    GAME.cash = 2;
    GAME.cumulativeScore = 0;
    GAME.currentRoute = null;
    GAME.routeOptions = [];
    GAME.completedNodes = [];
    GAME.saveSlot = options.saveSlot ?? null;
    GAME.runSeed = options.daily ? dailySeed() : (normalizeRunSeed(options.seed) || createRunSeed());
    GAME.shopSelection = [];
    GAME.upgradePurchases = 0;
    GAME.activeUpgrades = defaultActiveUpgrades();
    GAME.ballLoadout = createBallLoadout(options.daily ? undefined : starterBallIds);
    GAME.shopSoldOut = [];
    GAME.shopRerolls = 0;
    GAME.runModifiers = defaultRunModifiers();
    if (options.daily) {
        GAME.runModifiers.daily = dailyRunModifiers();
        GAME.cash += GAME.runModifiers.daily.cashBonus || 0;
    }
    applySelectedRelic();
    GAME.routeMap = buildSeededRouteMap();
    document.getElementById('shop-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('event-screen').classList.add('hidden');
    document.getElementById('debug-actions-screen').classList.add('hidden');
    if (options.daily) showAlert(`Daily Run: ${GAME.runModifiers.daily.title}`);
    else if (options.seed) showAlert(`Seed: ${GAME.runSeed}`);
    autoSaveRunSlot();
    showRouteMap();
}

function showRouteMap() {
    if (GAME.frame >= GAME.maxFrames) {
        endRun(true);
        return;
    }
    const nextFrame = GAME.frame + 1;
    if (!GAME.routeMap.length) GAME.routeMap = buildSeededRouteMap();
    GAME.routeOptions = GAME.routeMap[nextFrame - 1].map(node => ({ ...node.route, nodeId: node.id }));
    GAME.state = 'ROUTE';
    autoSaveRunSlot();
    document.getElementById('shop-screen').classList.add('hidden');
    document.getElementById('route-screen').classList.remove('hidden');
    document.getElementById('route-stage').textContent = stageForFrame(nextFrame);
    document.getElementById('route-frame').textContent = nextFrame;
    document.getElementById('route-bank').textContent = `$ ${uiNumber(GAME.cash)}`;
    document.getElementById('route-title').innerHTML = nextFrame % 4 === 0 ? 'THE HOUSE FIGHTS BACK<span>.</span>' : 'RULE THE HOUSE<span>.</span>';
    document.getElementById('route-subtitle').textContent = nextFrame % 4 === 0 ? 'House boss ahead. Make every throw count.' : 'Pick your lane. Make your name.';
    displayedRouteStage = stageForFrame(nextFrame);
    routePreviewNodeId = GAME.routeMap[nextFrame - 1][0].id;
    updateSeedDisplays();
    renderRouteDistrict();
}

function renderRouteDistrict() {
    const nextFrame = GAME.frame + 1;
    const district = districtForStage(displayedRouteStage);
    const screen = document.getElementById('route-screen');
    screen.style.setProperty('--district', district.color);
    screen.style.setProperty('--district-dark', district.dark);
    document.getElementById('route-district-name').textContent = district.name;
    document.getElementById('route-district-tag').textContent = district.tag;
    document.getElementById('route-district-art').innerHTML = districtBackdrop(displayedRouteStage);
    const districts = document.getElementById('route-districts');
    districts.innerHTML = DISTRICTS.map((item, index) => {
        const stage = index + 1;
        const cleared = GAME.frame >= stage * 4;
        return `<button type="button" aria-pressed="${stage === displayedRouteStage}" data-stage="${stage}" style="--tab-color:${item.color}"><span class="district-number">${cleared ? '✓' : `0${stage}`}</span><span><small>${cleared ? 'HOUSE CLEARED' : stage === stageForFrame(nextFrame) ? 'YOU ARE HERE' : 'ON THE CIRCUIT'}</small><b>${item.name}</b></span><span class="district-tab-frames">${index*4+1}—${stage*4}</span></button>`;
    }).join('');
    districts.querySelectorAll('button').forEach(button => button.addEventListener('click', () => {
        displayedRouteStage = Number(button.dataset.stage);
        const rows = GAME.routeMap.slice((displayedRouteStage - 1) * 4, displayedRouteStage * 4);
        routePreviewNodeId = rows.flat().find(node => node.frame === nextFrame)?.id || rows.at(-1)[0].id;
        sfx.playTick();
        renderRouteDistrict();
    }));
    document.getElementById('route-frame-markers').innerHTML = Array.from({ length: 4 }, (_, index) => `<span style="--stop:${index}">${index === 3 ? 'SHOWDOWN' : `FRAME ${String((displayedRouteStage - 1) * 4 + index + 1).padStart(2, '0')}`}</span>`).join('');
    const container = document.getElementById('route-options-container');
    container.innerHTML = '';
    GAME.routeMap.slice((displayedRouteStage - 1) * 4, displayedRouteStage * 4).flat().forEach(node => {
        const { route } = node;
        if (route.boss && node.frame <= nextFrame) rememberLegendSeen('bosses', route.id);
        const current = node.frame === nextFrame;
        const completed = GAME.completedNodes.includes(node.id);
        const passed = node.frame < nextFrame && !completed;
        const card = document.createElement('button');
        const theme = routeTheme(route);
        card.type = 'button';
        card.dataset.nodeId = node.id;
        card.style.setProperty('--lane-color', theme.color);
        card.className = `circuit-stop ${route.boss ? 'is-boss' : ''} ${current ? 'is-current' : ''} ${completed ? 'is-cleared' : ''} ${passed ? 'is-bypassed' : ''}`;
        card.setAttribute('aria-label', `Frame ${node.frame}: ${route.name}${current ? ', available' : completed ? ', cleared' : ', preview'}`);
        card.setAttribute('aria-pressed', String(node.id === routePreviewNodeId));
        card.innerHTML = `<span class="stop-platform">${laneArtwork(route)}</span><span class="stop-name">${escapeHtml(route.boss ? route.name : route.label)}</span><span class="stop-status">${completed ? '✓ CLEARED' : current ? 'PLAY NEXT' : route.boss ? 'HOUSE BOSS' : String(node.frame).padStart(2, '0')}</span>`;
        card.addEventListener('click', () => {
            routePreviewNodeId = node.id;
            container.querySelectorAll('button').forEach(other => other.setAttribute('aria-pressed', String(other === card)));
            sfx.playTick();
            renderRoutePreview();
            drawRouteMapLines();
        });
        container.appendChild(card);
    });
    drawRouteMapLines();
    renderRoutePreview();
}

function renderRoutePreview() {
    const node = GAME.routeMap.flat().find(item => item.id === routePreviewNodeId);
    if (!node) return;
    const route = node.route, theme = routeTheme(route);
    const available = node.frame === GAME.frame + 1;
    const cleared = GAME.completedNodes.includes(node.id);
    const count = (node.frame + 3) * (node.frame + 4) / 2;
    const panel = document.getElementById('route-choice-panel');
    panel.style.setProperty('--lane-color', theme.color);
    panel.classList.toggle('is-boss-preview', Boolean(route.boss));
    panel.innerHTML = `<div class="preview-topline"><span>${route.boss ? 'HOUSE BOSS' : route.event ? 'MYSTERY STOP' : 'LANE SELECT'}</span><b>F${String(node.frame).padStart(2, '0')}</b></div>
        <div class="route-preview-art">${laneArtwork(route)}<span>${theme.title}</span></div>
        <div class="route-preview-copy"><span class="arcade-eyebrow">${available ? 'YOUR NEXT CHALLENGE' : cleared ? 'HOUSE CLEARED' : 'COMING UP ON THE CIRCUIT'}</span><h3>${escapeHtml(route.name)}</h3><p>${renderVocabularyText(route.desc)}</p></div>
        <div class="route-preview-stats"><div><b>${route.event ? '?' : count}</b><span>${route.event ? 'DETOUR' : 'PINS'}</span></div><div><b>${route.boss ? '3' : route.rollBonus ? '+1' : '—'}</b><span>${route.boss ? 'THROWS' : 'BONUS THROW'}</span></div><div><b>${route.event ? '?' : `+${Math.ceil((route.reward || 0) * .75)}`}</b><span>ENTRY CASH</span></div></div>
        <button class="arcade-launch" type="button" ${available ? '' : 'disabled'}>${available ? route.boss ? 'FACE THE HOUSE' : route.event ? 'TAKE THE DETOUR' : 'ENTER THE LANE' : cleared ? 'CLEARED' : 'UP AHEAD'}<span aria-hidden="true">${available ? '↗' : '◇'}</span></button>`;
    panel.querySelector('button').addEventListener('click', () => chooseRouteByNode(node.id));
}

function drawRouteMapLines() {
    const svg = document.getElementById('route-map-lines');
    const stage = document.getElementById('route-map-stage');
    if (!svg || !stage || GAME.state !== 'ROUTE' || !GAME.routeMap.length) return;
    const portrait = isPortraitMobileLayout();
    const nextFrame = GAME.frame + 1;
    const nodes = new Map(GAME.routeMap.flat().map(node => [node.id, node]));
    const cards = [...document.querySelectorAll('.circuit-stop')];
    cards.forEach(card => {
        const node = nodes.get(card.dataset.nodeId);
        if (!node) return;
        const pos = circuitNodePosition(node, portrait);
        card.style.left = `${pos.x}%`;
        card.style.top = `${pos.y}%`;
    });
    const bounds = stage.getBoundingClientRect();
    if (!bounds.width || !bounds.height) return;
    // Explicit dimensions prevent SVG's intrinsic square from stretching paths
    // below the stops on wide maps. Anchors include viewBox letterboxing.
    svg.setAttribute('width', bounds.width);
    svg.setAttribute('height', bounds.height);
    svg.setAttribute('viewBox', `0 0 ${bounds.width} ${bounds.height}`);
    const anchors = {};
    cards.forEach(card => {
        const art = card.querySelector('.stop-platform > svg');
        const matrix = art?.getScreenCTM();
        if (!matrix) return;
        const boss = nodes.get(card.dataset.nodeId)?.route.boss;
        const point = new DOMPoint(boss ? 150 : 180, boss ? 130 : 128).matrixTransform(matrix);
        anchors[card.dataset.nodeId] = {
            x: point.x - bounds.left, y: point.y - bounds.top,
            rx: (boss ? 122 : 151) * Math.hypot(matrix.a, matrix.b),
            ry: (boss ? 105 : 88) * Math.hypot(matrix.c, matrix.d)
        };
    });
    const wires = circuitWires(GAME.routeMap, displayedRouteStage, anchors, portrait);
    const state = id => GAME.completedNodes.includes(id) ? 'is-cleared' : nodes.get(id).frame === nextFrame ? 'is-active' : nodes.get(id).frame < nextFrame ? 'is-bypassed' : '';
    const focused = id => id === routePreviewNodeId ? 'is-focused' : '';
    svg.innerHTML = wires.paths.map(wire => `<path d="${wire.d}" data-node-id="${wire.nodeId}" data-side="${wire.side}" class="circuit-link ${state(wire.nodeId)} ${focused(wire.nodeId)}" style="--wire-color:${routeTheme(nodes.get(wire.nodeId).route).color}"/>`).join('')
        + wires.junctions.map(point => `<path class="circuit-junction" d="M${point.x} ${point.y-3}l3 3-3 3-3-3Z"/>`).join('')
        + wires.ports.map(point => `<circle data-port-node="${point.nodeId}" class="circuit-port ${state(point.nodeId)} ${focused(point.nodeId)}" cx="${point.x}" cy="${point.y}" r="2.5" style="--wire-color:${routeTheme(nodes.get(point.nodeId).route).color}"/>`).join('');
}

function chooseRouteByNode(nodeId) {
    const node = GAME.routeMap.flat().find(candidate => candidate.id === nodeId);
    if (!node || node.frame !== GAME.frame + 1) return;
    const route = { ...node.route, nodeId: node.id };
    GAME.currentRoute = { ...route };
    if (!route.event) addCash(Math.ceil((route.reward || 0) * 0.75), 'route');
    GAME.shopSelection = [];
    GAME.frame = node.frame;
    GAME.stage = stageForFrame(GAME.frame);
    GAME.frameInStage = frameInStage(GAME.frame);
    GAME.completedNodes.push(node.id);
    document.getElementById('route-screen').classList.add('hidden');
    sfx.playCoin();
    if (route.event) {
        showEventScreen(route);
    } else if (route.boss) {
        showBossIntro(route);
    } else {
        startFrame();
    }
    autoSaveRunSlot();
}

function showBossIntro(route) {
    GAME.state = 'BOSS_INTRO';
    const theme = routeTheme(route);
    const screen = document.getElementById('boss-intro-screen');
    screen.style.setProperty('--boss-color', theme.color);
    screen.style.setProperty('--boss-dark', theme.dark);
    document.getElementById('boss-intro-sigil').innerHTML = bossEmblem(route);
    document.getElementById('boss-intro-number').textContent = `HOUSE BOSS 0${GAME.stage}`;
    document.getElementById('boss-intro-kicker').textContent = GAME.frame === GAME.maxFrames ? 'THE FINAL SHOWDOWN' : `STAGE 0${GAME.stage} / SHOWDOWN`;
    document.getElementById('boss-intro-title').textContent = route.name || 'Boss Lane';
    document.getElementById('boss-intro-motto').textContent = theme.title;
    document.getElementById('boss-intro-desc').textContent = route.desc || 'A strange lane bends the house rules.';
    document.getElementById('boss-intro-rule').innerHTML = `<div><b>${currentRackLayout().points.length}</b><span>PINS ON DECK</span></div><div><b>3</b><span>THROWS</span></div><p>${escapeHtml(bossRuleText(route))}</p>`;
    screen.classList.remove('hidden');
    sfx.playImplosion();
    document.getElementById('btn-start-boss').focus({ preventScroll: true });
}

function bossRuleText(route) {
    const parts = [];
    if (isGutterMawRoute(route)) parts.push('Black holes pull at the edges; center line is safe. Anchor Cover resists pull. Bumpers block exits while charged.');
    if (route.targetMod) parts.push(`Target +${route.targetMod}`);

    if (route.hookMod && route.hookMod !== 1) parts.push(`Hook ${Math.round(route.hookMod * 100)}%`);
    if (route.specialMod) parts.push(`Special pins ${Math.round(route.specialMod * 100)}%`);
    if (route.pinScoreMod && route.pinScoreMod !== 1) parts.push(`Pin value ${Math.round(route.pinScoreMod * 100)}%`);
    return parts.join('  //  ') || 'The lane changes its rules.';
}

function showEventScreen(route) {
    const event = EVENT_TYPES.find(item => item.id === route.eventId) || EVENT_TYPES[0];
    const theme = eventVisual(event.id);
    rememberLegendSeen('events', event.id);
    GAME.state = 'EVENT';
    const screen = document.getElementById('event-screen');
    for (const id of ['route-screen', 'shop-screen', 'boss-intro-screen']) document.getElementById(id).classList.add('hidden');
    screen.style.setProperty('--event-color', theme.color);
    screen.classList.remove('hidden');
    document.getElementById('event-title').textContent = event.name;
    document.getElementById('event-kicker').textContent = theme.tag;
    document.getElementById('event-desc').textContent = theme.line;
    document.getElementById('event-art').innerHTML = eventSceneArt(event.id);
    document.getElementById('event-frame').textContent = `FRAME ${String(GAME.frame).padStart(2, '0')}`;
    document.getElementById('event-cash').textContent = `$${uiNumber(GAME.cash)} PIN DOLLARS`;
    const options = document.getElementById('event-options');
    options.innerHTML = event.choices.map((choice, index) => {
        const visual = eventChoiceVisual(event.id, index, { cash: GAME.cash, targetTax: GAME.activeUpgrades.targetTax });
        return `<button type="button" class="encounter-choice" data-event-choice="${index}" aria-label="${escapeHtml(choice.title + ': ' + choice.desc)}">
            <span class="encounter-choice-top"><b>0${index + 1}</b><span>${visual.gains[0].duration}</span></span>
            <span class="encounter-choice-art">${cabinetArt(visual.art, theme.color)}</span>
            <span class="encounter-choice-copy"><strong>${escapeHtml(choice.title)}</strong><span class="encounter-rewards">${visual.gains.map(gain => `<span class="encounter-reward"><b>${gain.value}</b><span>${gain.label}<small>${gain.duration}</small></span></span>`).join('')}</span>
            <span class="encounter-note">${visual.note}</span></span>
            <span class="encounter-trade ${visual.trade ? 'has-cost' : ''}">${visual.trade ? `<span>THE CATCH</span> ${visual.trade}` : '<span>ON THE HOUSE</span> NO CASH COST'}</span>
            <span class="encounter-take">${index ? 'TAKE THIS EDGE' : 'MAKE IT HAPPEN'}<b aria-hidden="true">↗</b></span>
        </button>`;
    }).join('');
    options.querySelectorAll('[data-event-choice]').forEach(button => button.addEventListener('click', () => resolveEventChoice(event, event.choices[Number(button.dataset.eventChoice)])));
    screen.querySelector('.event-cabinet').scrollTop = 0;
}

function resolveEventChoice(event, choice) {
    if (GAME.state !== 'EVENT' || !event.choices.includes(choice)) return;
    const visual = eventChoiceVisual(event.id, event.choices.indexOf(choice), { cash: GAME.cash, targetTax: GAME.activeUpgrades.targetTax });
    choice.apply();
    sfx.playCoin();
    document.getElementById('event-screen').classList.add('hidden');
    triggerShopTransition();
    const receipt = document.getElementById('event-reward-toast');
    clearTimeout(eventRewardTimer);
    receipt.innerHTML = `${cabinetArt(visual.art, eventVisual(event.id).color)}<div><span>DEAL TAKEN / ${escapeHtml(choice.title)}</span><b>${visual.gains.map(gain => `${gain.value} ${gain.label}`).join(' · ')}</b>${visual.trade ? `<small>${visual.trade}</small>` : ''}</div><strong>✓</strong>`;
    receipt.hidden = false;
    eventRewardTimer = setTimeout(() => { receipt.hidden = true; }, 3400);
}

window.purchaseUpgrade = function(itemId, receiverQuote = null) {
    if (GAME.state !== 'SHOP' || isTenPinMode()) return;
    const upgrade = SHOP_UPGRADES.find(u => u.id === itemId);
    if (!upgrade || !(GAME.shopSelection || []).includes(itemId)) return;
    if (!upgrade.repeatable && !upgrade.traitId && (GAME.shopSoldOut || []).includes(itemId)) return;
    const cost = upgradeCost(upgrade);
    if (upgrade.traitId && (receiverQuote !== pendingBallPurchase || !ballTraitEligibility(GAME, upgrade, cost, receiverQuote).canBuy)) return;
    if (GAME.cash < cost) return;

    GAME.cash -= cost;
    GAME.upgradePurchases++;
    sfx.playCoin();
    upgrade.effect(upgrade.traitId ? receiverQuote.index : undefined);
    pendingBallPurchase = null;
    if (!GAME.shopSoldOut) GAME.shopSoldOut = [];
    if (!upgrade.repeatable && !upgrade.traitId && !GAME.shopSoldOut.includes(itemId)) GAME.shopSoldOut.push(itemId);
    const receiverName = upgrade.traitId ? STARTER_BALLS.find(ball => ball.id === GAME.ballLoadout.balls[receiverQuote.index].id)?.name : null;
    showAlert(`${upgrade.name}${receiverName ? ` → ${receiverName}` : ' upgraded'}!`);
    autoSaveRunSlot();

    triggerShopTransition();
    showShopPurchase(upgrade, receiverName);
    updateUI();
};

function startFrame() {
    clearRollWatchdog();
    GAME.state = 'MAIN_METER';
    GAME.stage = stageForFrame(GAME.frame);
    GAME.frameInStage = frameInStage(GAME.frame);
    if (!GAME.currentRoute) GAME.currentRoute = GAME.frame === 1 ? { ...ROUTE_TYPES.START } : { ...ROUTE_TYPES.STANDARD };
    GAME.score = 0;
    GAME.targetScore = calculateTargetScore(GAME.frame);
    GAME.stats.maxRollsThisFrame = chooseRollCount(GAME.frame) + GAME.activeUpgrades.extraRolls;
    GAME.rollsLeft = GAME.stats.maxRollsThisFrame;
    GAME.stats.rollsThisFrame = 0;
    GAME.stats.currentRollScore = 0;
    GAME.stats.currentRollPins = 0;
    GAME.stats.currentRollBonusScore = 0;
    GAME.stats.rollScores = [];
    GAME.stats.rollRecorded = false;
    GAME.stats.canContinueRoll = false;
    GAME.stats.promptSounded = false;
    clearTimeout(GAME.stats.reviewTimer);
    GAME.stats.reviewTimer = null;

    buildPhysicalLane(requestedPhysicsLaneWidth(GAME.frame));
    generatePinGrid(GAME.frame);
    // A perfect rack must always clear a round, even when a route raises its target.
    GAME.targetScore = Math.min(GAME.targetScore, physicalPins.reduce((total, pin) => total + pinScoreValue(pin), 0));
    triggerRackLoadedSweep();
    GAME.activeUpgrades.bumperCharges = migrateBumperCharges(GAME.activeUpgrades);
    GAME.activeUpgrades.gutterGuards = false;
    toggleGutterGuards(GAME.activeUpgrades.bumperCharges > 0);
    syncMawVisuals();
    if (isGutterMawRoute(GAME.currentRoute)) {
        showAlert('GUTTER MAW • Keep to the center. Anchor Cover resists the pull.');
    }
    launchX = 0;
    spawnBall();

    gauge.start();
    setPreRollCamera();
    updateUI();
}

function endRun(victory = false) {
    clearGameplayLaneEffects();
    clearRollWatchdog();
    const finishedSlot = GAME.saveSlot;
    recordRunStats(victory);
    GAME.state = 'GAMEOVER';
    clearRunSlot(finishedSlot);
    GAME.saveSlot = null;
    document.getElementById('game-over-screen').classList.remove('hidden');
    document.querySelector('#game-over-screen h2').innerText = victory ? 'RUN COMPLETE' : 'GAME OVER';
    const dailyText = GAME.runModifiers?.daily?.enabled ? ' Daily score saved.' : '';
    document.getElementById('game-over-screen').dataset.outcome = victory ? 'win' : 'loss';
    document.getElementById('result-art').innerHTML = cabinetArt(victory ? 'trophy' : 'extra_roll', victory ? '#ffd27d' : '#b991ef');
    document.querySelector('#game-over-screen p').innerText = victory ? `Twelve frames. Three bosses. The house is yours.${dailyText}` : `The house takes this one. Come back swinging.${dailyText}`;
    
    document.getElementById('final-frames').innerText = victory ? GAME.maxFrames : GAME.frame - 1;
    document.getElementById('final-level').innerText = GAME.frame;
    document.getElementById('final-cash').innerText = uiNumber(GAME.cumulativeScore);
}

function endTenPinGame() {
    clearRollWatchdog();
    GAME.state = 'GAMEOVER';
    GAME.score = calculateTenPinScore(GAME.tenPin.frames);
    GAME.cumulativeScore = GAME.score;
    recordTenPinStats();
    document.getElementById('game-over-screen').classList.remove('hidden');
    document.querySelector('#game-over-screen h2').innerText = 'GAME COMPLETE';
    document.querySelector('#game-over-screen p').innerText = 'Ten frames in the books. Make the next one legendary.';
    document.getElementById('game-over-screen').dataset.outcome = 'win';
    document.getElementById('result-art').innerHTML = cabinetArt('trophy');
    document.getElementById('final-frames').innerText = '10';
    document.getElementById('final-level').innerText = '10-PIN';
    document.getElementById('final-cash').innerText = uiNumber(GAME.score);
    updateUI();
}

function defaultActiveUpgrades() {
    return {
        goldPinChance: 0.12,
        explosivePinChance: 0.0,
        implosivePinChance: 0.0,
        bouncyPinChance: 0.05,
        ballSize: 1.0,
        ballMass: 12.0,
        spinPower: 0.0,
        extraRolls: 0,
        pinValueMultiplier: 1.0,
        timingForgiveness: 0.0,
        specialControl: 0.0,
        targetTax: 0,
        nextThrowPowerBoost: 0,
        nextThrowFocus: 0,
        nextThrowMassBoost: 0,
        nextThrowHookBoost: 0,
        nextThrowHookDelay: 0,
        nextThrowStability: 0,
        nextThrowCashMultiplier: 1,
        gutterGuards: false,
        bumperCharges: 0
    };
}

function defaultRunModifiers() {
    return {
        pinCashMultipliers: {},
        pinCashOverrides: {},
        disabledPinEffects: {},
        daily: null
    };
}

function resetRun() {
    GAME.paused = false;
    sfx.stopBallRoll();
    activeHook = 0;
    const restartMode = GAME.mode;
    const tenPinSpecials = GAME.tenPin.specialPinsEnabled;
    const tenPinFullBag = GAME.tenPin.fullBag;
    const restartSlot = GAME.saveSlot;
    const restartDaily = GAME.runModifiers?.daily?.enabled;
    const restartSeed = GAME.runSeed;
    GAME.frame = 0;
    GAME.stage = 1;
    GAME.frameInStage = 0;
    GAME.currentRoute = null;
    GAME.routeOptions = [];
    GAME.routeMap = [];
    GAME.completedNodes = [];
    GAME.runSeed = null;
    GAME.shopSelection = [];
    GAME.shopSoldOut = [];
    GAME.shopRerolls = 0;
    GAME.upgradePurchases = 0;
    GAME.score = 0;
    GAME.cash = 0;
    GAME.cumulativeScore = 0;
    GAME.activeUpgrades = defaultActiveUpgrades();
    GAME.runModifiers = defaultRunModifiers();

    document.getElementById('pause-screen').classList.add('hidden');
    document.getElementById('game-over-screen').classList.add('hidden');
    document.getElementById('shop-screen').classList.add('hidden');
    document.getElementById('route-screen').classList.add('hidden');
    document.getElementById('event-screen').classList.add('hidden');
    document.getElementById('debug-actions-screen').classList.add('hidden');
    document.getElementById('tenpin-scoreboard-screen').classList.add('hidden');
    document.getElementById('tenpin-rack-screen').classList.add('hidden');
    document.getElementById('legend-screen').classList.add('hidden');
    document.getElementById('tutorial-screen').classList.add('hidden');
    document.getElementById('relic-screen').classList.add('hidden');
    document.getElementById('stats-screen').classList.add('hidden');
    document.getElementById('boss-intro-screen').classList.add('hidden');
    document.getElementById('main-menu').classList.add('hidden');
    if (restartMode === 'tenpin') {
        resetTenPinState(tenPinSpecials, tenPinFullBag);
        startTenPinGame();
    } else {
        startNewRun({ saveSlot: restartSlot, daily: restartDaily, seed: restartSeed });
    }
}

function updateBossHud() {
    const hud = document.getElementById('boss-battle-hud');
    hud.hidden = GAME.mode !== 'roguelike' || !GAME.currentRoute?.boss;
    if (hud.hidden) return;
    hud.style.setProperty('--boss-color', routeTheme(GAME.currentRoute).color);
    document.getElementById('boss-hud-name').textContent = GAME.currentRoute.name;
    document.getElementById('boss-hud-fill').style.width = `${Math.min(100, GAME.score / Math.max(1, GAME.targetScore) * 100)}%`;
    document.getElementById('boss-hud-progress').textContent = `${uiNumber(GAME.score)} / ${uiNumber(GAME.targetScore)} TO BEAT THE HOUSE`;
}

function updateUI() {
    updateBossHud();
    const scorePanel = document.getElementById('score-hud-panel');
    scorePanel.dataset.mode = GAME.mode;
    if (isTenPinMode()) {
        scorePanel.setAttribute('aria-label', 'Open full ten-pin scorecard');
        scorePanel.setAttribute('role', 'button');
        scorePanel.tabIndex = 0;
    } else {
        scorePanel.removeAttribute('aria-label');
        scorePanel.removeAttribute('role');
        scorePanel.removeAttribute('tabindex');
    }
    if (isTenPinMode()) {
        updateTenPinUI();
        return;
    }
    const rackCount = GAME.stats.pinsSpawned || physicalPins.length || 0;
    document.getElementById('hud-frame-label').innerText = GAME.mode === 'practice' ? 'FREE PLAY' : 'ROUND';
    document.getElementById('hud-score-label').innerText = 'PINS';
    document.getElementById('hud-target-separator').classList.remove('hidden');
    document.getElementById('hud-target').classList.remove('hidden');
    document.getElementById('hud-frame').innerText = GAME.frame;
    document.getElementById('hud-target').innerText = uiNumber(GAME.targetScore);
    document.getElementById('hud-score').innerText = uiNumber(GAME.score);
    document.getElementById('hud-rolls').innerText = `${GAME.stats.rollsThisFrame}/${GAME.stats.maxRollsThisFrame}`;
    document.getElementById('hud-cash').innerText = uiNumber(GAME.cash);
    document.getElementById('hud-score').title = `Exact: ${uiExactNumber(GAME.score)}`;
    document.getElementById('hud-cash').title = `Exact: ${uiExactNumber(GAME.cash)}`;
    document.getElementById('hud-rack-pill')?.classList.remove('hidden');
    document.getElementById('hud-rack-label').innerText = 'RACK';
    document.getElementById('hud-rack-count').innerText = uiNumber(rackCount);
    document.getElementById('hud-rack-box-label').innerText = 'RACK';
    document.getElementById('hud-rack-box-count').innerText = uiNumber(rackCount);

    const frameBoxes = document.getElementById('hud-frame-boxes');
    const compactScoreHud = isPortraitMobileLayout();
    const frameCells = [];
    setIfChanged(frameBoxes.style, 'gridTemplateColumns', compactScoreHud
        ? `repeat(${GAME.stats.maxRollsThisFrame}, minmax(24px, 1fr)) 38px`
        : `repeat(${GAME.stats.maxRollsThisFrame}, minmax(42px, 1fr)) 56px`);
    for (let i = 0; i < GAME.stats.maxRollsThisFrame; i++) {
        const completed = GAME.stats.rollScores[i];
        const isCurrent = i === GAME.stats.rollsThisFrame - 1 && !GAME.stats.rollRecorded && GAME.state !== 'MAIN_METER';
        const className = `${compactScoreHud ? 'h-8 text-[10px]' : 'h-11 text-[13px]'} border-r-2 border-white flex items-center justify-center font-bold ${isCurrent ? 'text-yellow-300 bg-violet-900/80' : 'text-white bg-violet-950/40'}`;
        let text;
        if (completed !== undefined) {
            text = completed >= GAME.stats.pinsSpawned ? 'X' : uiNumber(completed);
        } else if (isCurrent) {
            text = uiNumber(GAME.stats.currentRollScore);
        } else {
            text = '-';
        }
        frameCells.push({ className, text });
    }
    const totalClassName = `${compactScoreHud ? 'h-8 text-[10px]' : 'h-11 text-[13px]'} flex items-center justify-center font-bold text-emerald-300 bg-black`;
    frameCells.push({ className: totalClassName, text: uiNumber(GAME.score) });
    syncTextCells(frameBoxes, frameCells);

    const listContainer = document.getElementById('hud-upgrades-list');

    const listItems = [];
    if (GAME.activeUpgrades.goldPinChance > 0.12) listItems.push(`Gold: +${Math.round((GAME.activeUpgrades.goldPinChance-0.12)*100)}%`);
    if (GAME.activeUpgrades.explosivePinChance > 0) listItems.push(`Explosive: ${Math.round(GAME.activeUpgrades.explosivePinChance*100)}%`);
    if (GAME.activeUpgrades.implosivePinChance > 0) listItems.push(`Implosion: ${Math.round(GAME.activeUpgrades.implosivePinChance*100)}%`);
    if (GAME.activeUpgrades.ballMass > 12.0) listItems.push(`Weight: ${GAME.activeUpgrades.ballMass.toFixed(1)} lb`);
    if (GAME.activeUpgrades.spinPower > 0) listItems.push(`Steering: Active`);
    if (GAME.activeUpgrades.ballSize > 1.0) listItems.push(`Big Ball: +${Math.round((GAME.activeUpgrades.ballSize-1.0)*100)}%`);
    if (GAME.activeUpgrades.extraRolls > 0) listItems.push(`Rolls: +${GAME.activeUpgrades.extraRolls}`);
    if (GAME.activeUpgrades.pinValueMultiplier > 1.0) listItems.push(`Multi: ${GAME.activeUpgrades.pinValueMultiplier.toFixed(1)}x`);
    if (GAME.activeUpgrades.timingForgiveness > 0) listItems.push(`Timing: +${Math.round(GAME.activeUpgrades.timingForgiveness * 1000)}`);
    if (GAME.activeUpgrades.specialControl > 0) listItems.push(`Dampers: ${Math.round(GAME.activeUpgrades.specialControl * 100)}%`);
    if (GAME.activeUpgrades.targetTax > 0) listItems.push(`Debt: +${GAME.activeUpgrades.targetTax} target`);
    if (GAME.activeUpgrades.nextThrowPowerBoost > 0) listItems.push(`Next: power +${GAME.activeUpgrades.nextThrowPowerBoost.toFixed(1)}`);
    if (GAME.activeUpgrades.nextThrowFocus > 0) listItems.push(`Next: focus`);
    if (GAME.activeUpgrades.nextThrowMassBoost > 0) listItems.push(`Next: mass +${GAME.activeUpgrades.nextThrowMassBoost.toFixed(1)}`);
    if (GAME.activeUpgrades.nextThrowHookBoost > 0) listItems.push(`Next: hook +${Math.round(GAME.activeUpgrades.nextThrowHookBoost * 100)}%`);
    if (GAME.activeUpgrades.nextThrowHookBoost < 0) listItems.push(`Next: hook ${Math.round(GAME.activeUpgrades.nextThrowHookBoost * 100)}%`);
    if (GAME.activeUpgrades.nextThrowStability > 0) listItems.push(`Next: steady`);

    syncTextCells(listContainer, listItems.map(item => ({
        className: 'upgrade-wave text-[8px] text-emerald-400 uppercase font-bold', text: `• ${item}`
    })), 'span', 'None');
}

function updateTenPinUI() {
    GAME.score = calculateTenPinScore(GAME.tenPin.frames);
    const liveScore = tenPinLiveScore();
    const hudFrames = tenPinProjectedFramesForHud();
    document.getElementById('hud-frame-label').innerText = 'FRAME';
    document.getElementById('hud-score-label').innerText = 'SCORE';
    document.getElementById('hud-target-separator').classList.add('hidden');
    document.getElementById('hud-target').classList.add('hidden');
    document.getElementById('hud-frame').innerText = GAME.frame;
    document.getElementById('hud-target').innerText = '';
    document.getElementById('hud-score').innerText = uiNumber(liveScore);
    document.getElementById('hud-rolls').innerText = `${GAME.stats.rollsThisFrame}/${GAME.stats.maxRollsThisFrame}`;
    document.getElementById('hud-cash').innerText = GAME.tenPin.specialPinsEnabled ? uiNumber(GAME.cash) : 'OFF';
    document.getElementById('hud-score').title = `Exact: ${uiExactNumber(liveScore)}`;
    document.getElementById('hud-cash').title = `Exact: ${uiExactNumber(GAME.cash)}`;
    document.getElementById('hud-rack-pill')?.classList.add('hidden');
    document.getElementById('hud-rack-box-label').innerText = 'RACK';
    document.getElementById('hud-rack-box-count').innerText = '10';

    const frameBoxes = document.getElementById('hud-frame-boxes');
    const compactScoreHud = isPortraitMobileLayout();
    frameBoxes.innerHTML = '';
    frameBoxes.style.gridTemplateColumns = compactScoreHud
        ? 'repeat(3, minmax(42px, 1fr))'
        : 'repeat(3, minmax(72px, 1fr))';
    const startFrame = GAME.frame <= 3 ? 1 : Math.min(8, GAME.frame - 2);
    const endFrame = Math.min(10, startFrame + 2);
    for (let frameNumber = startFrame; frameNumber <= endFrame; frameNumber++) {
        const frame = hudFrames[frameNumber - 1];
        const marks = tenPinRollMarks(frame, frameNumber);
        const box = document.createElement('div');
        const active = frameNumber === GAME.frame && GAME.state !== 'GAMEOVER';
        const frameTotal = active ? liveScore : tenPinRunningTotal(frameNumber - 1);
        box.className = `${compactScoreHud ? 'min-h-[38px]' : 'min-h-[58px]'} border-r-2 border-white bg-violet-950/40 ${active ? 'text-yellow-300' : 'text-white'}`;
        box.innerHTML = `
            <div class="border-b-2 border-white px-1 ${compactScoreHud ? 'py-0.5 text-[7px]' : 'py-1 text-[9px]'} text-center">F${frameNumber}</div>
            <div class="grid ${frameNumber === 10 ? 'grid-cols-3' : 'grid-cols-2'} ${compactScoreHud ? 'text-[10px]' : 'text-[13px]'}">
                ${marks.map(mark => `<span class="border-r border-white/70 ${compactScoreHud ? 'py-0.5' : 'py-1'} text-center">${mark}</span>`).join('')}
            </div>
            <div class="px-1 ${compactScoreHud ? 'py-0.5 text-[9px]' : 'py-1 text-[11px]'} text-center text-emerald-300">${frameTotal ? uiNumber(frameTotal) : '-'}</div>
        `;
        frameBoxes.appendChild(box);
    }

    const listContainer = document.getElementById('hud-upgrades-list');
    const items = [];
    if (GAME.tenPin.specialPinsEnabled) {
        const rackSpecialCount = GAME.tenPin.pendingRackSpecialTypes.filter(type => type && type !== 'STANDARD').length;
        const selectedCount = GAME.tenPin.selectedRackSpecials.length;
        items.push(rackSpecialCount > 0 ? `Special pins in rack: ${rackSpecialCount}` : `Rack pins selected: ${selectedCount}/3`);
    } else {
        items.push('Regular bowling');
    }
    if (GAME.tenPin.manualRackNext) items.push('Manual rack ready');
    if (GAME.activeUpgrades.spinPower > 0) items.push('Steering: league assist');
    if (GAME.activeUpgrades.nextThrowMassBoost > 0) items.push('Next throw: heavy ball');
    if (GAME.activeUpgrades.nextThrowHookBoost > 0) items.push('Next throw: pearl snap');
    if (GAME.activeUpgrades.nextThrowHookBoost < 0 || GAME.activeUpgrades.nextThrowStability > 0) items.push('Next throw: steady read');
    if (GAME.activeUpgrades.nextThrowFocus > 0) items.push('Next throw: focus');
    if (GAME.activeUpgrades.nextThrowPowerBoost > 0) items.push('Next throw: speed');
    syncTextCells(listContainer, items.map(item => ({
        className: 'upgrade-wave text-[8px] text-emerald-400 uppercase font-bold', text: `• ${item}`
    })), 'span');
}

function showAlert(text) {
    const alertBox = document.getElementById('alert-box');
    alertBox.innerText = text;
    alertBox.classList.remove('opacity-0');
    alertBox.classList.add('opacity-100');

    setTimeout(() => {
        alertBox.classList.remove('opacity-100');
        alertBox.classList.add('opacity-0');
    }, 2500);
}

function updateVisuals(dt) {
    updateMobileControlRailVisibility();
    if (ballBody && ballMesh) {
        if (GAME.state === 'BALL_ROLLING') {
            applyTimingHook(dt);
            updateLaneHazards(dt);
            applyGutterCatch(dt);
        }
        ballBody.position.copyTo(ballMesh.position);
        ballBody.quaternion.copyTo(ballMesh.quaternion);

        const hitKillPlane = ballBody.position.y < cleanupKillY();
        const leftBackOfLane = ballBody.position.z < laneEndZ() - Number(debugState.config.render?.ballKillZPadding ?? 4);
        if (GAME.state === 'BALL_ROLLING') {
            const stopped = ballBody.velocity.length() < 0.28;
            if (hitKillPlane || leftBackOfLane || stopped) {
                beginRollSettling();
                if (hitKillPlane || leftBackOfLane) removeBallFromWorld();
            }
        } else if (GAME.state === 'ROLL_SETTLING' && (hitKillPlane || leftBackOfLane)) {
            removeBallFromWorld();
        }

    }

    for (let i = physicalPins.length - 1; i >= 0; i--) {
        const pin = physicalPins[i];
        // A pose validated upright on the previous step stays unchanged while
        // Rapier sleeps. Recheck immediately on wake; cleanup always advances.
        const sleeping = pin.body?.raw?.isSleeping?.() || false;
        if (pin.sleepingUpright && sleeping && !pin.cleanupStarted) continue;
        pin.sleepingUpright = false;
        const belowKillPlane = pin.body && pin.body.position.y < cleanupKillY();

        if (belowKillPlane) {
            scoreFallenPins();
            startPinCleanup(pin);
            removePinFromWorld(pin);
            continue;
        }

        if (pin.cleanupStarted) {
            pin.cleanupTimer += dt;
            if (pin.body) {
                pin.body.position.copyTo(pin.mesh.position);
                pin.body.quaternion.copyTo(pin.mesh.quaternion);
                updateReflectionClone(pin.mesh, pin.reflection);
                if (pin.body.position.y < cleanupKillY()) {
                    scoreFallenPins();
                    removePinFromWorld(pin);
                    continue;
                }

            }

            if (!pin.meshRemoved) {
                const popT = THREE.MathUtils.clamp(Math.max(0, pin.cleanupTimer - 1.1) / 0.4, 0, 1);
                const inflate = popT < 1 ? 1 + Math.sin(popT * Math.PI) * 0.2 : 1;
                const baseScale = pin.popScale || new THREE.Vector3(1, 1, 1);
                pin.mesh.scale.set(baseScale.x * inflate, baseScale.y * inflate, baseScale.z * inflate);
                updateReflectionClone(pin.mesh, pin.reflection);
            }

            if (pin.cleanupTimer >= 1.5 && !pin.popEffectDone && pin.mesh && !pin.meshRemoved) {
                pin.popEffectDone = true;
                createPinPopParticles(pin.mesh.position, pin.type.color || 0xfacc15);
                sfx.playCoin();
                if (pin.body) {
                    world.remove(pin.body);
                    pin.body = null;
                    pin.bodyRemoved = true;
                }
                disposeGameVisual(pin.mesh);
                disposePinReflection(pin);
                reflectionObjects = reflectionObjects.filter(obj => obj.parent);
                pin.meshRemoved = true;
            }

            if (pin.cleanupTimer >= 1.9 && !pin.meshRemoved) {
                disposeGameVisual(pin.mesh);
                disposePinReflection(pin);
                reflectionObjects = reflectionObjects.filter(obj => obj.parent);
                pin.meshRemoved = true;
            }
            continue;
        }

        if (!pin.body) continue;

        pin.body.position.copyTo(pin.mesh.position);
        pin.body.quaternion.copyTo(pin.mesh.quaternion);
        updateReflectionClone(pin.mesh, pin.reflection);

        const speed = pin.impactSounded ? 0 : pin.body.velocity.length();
        if (speed > 3.8 && !pin.impactSounded) {
            pin.impactSounded = true;
            if (!impactCamera.active && (GAME.state === 'BALL_ROLLING' || GAME.state === 'ROLL_SETTLING')) {
                const origin = laneOrigin();
                impactCamera.active = true;
                impactCamera.elapsed = 0;
                pin.body.position.copyTo(impactCamera.anchor);
                impactCamera.side = Math.sign(pin.body.position.x - origin.x) || Math.sign(activeHook) || 1;
            }
            const typeKey = pinTypeKey(pin.type);
            const effectDisabled = Boolean(GAME.runModifiers?.disabledPinEffects?.[typeKey]);
            if (!effectDisabled && pin.type === PIN_TYPES.EXPLOSIVE && !pin.exploded) {
                pin.exploded = true;
                triggerExplosiveForce(i, pin.body.position);
            } else if (!effectDisabled && pin.type === PIN_TYPES.IMPLOSIVE && !pin.exploded) {
                pin.exploded = true;
                triggerImplosiveForce(i, pin.body.position);
            }
        }

        if (isPinKnocked(pin)) {
            startPinCleanup(pin);
        } else {
            pin.sleepingUpright = sleeping;
        }
    }

    if (GAME.state === 'BALL_ROLLING' || GAME.state === 'ROLL_SETTLING') {
        scoreFallenPins();
    }
    updateSpeedLines();
}

function resetBallMotionState() {
    if (!ballBody) {
        ballMotionState.initialized = false;
        return;
    }
    ballBody.position.copyTo(ballMotionState.prevPos);
    ballMotionState.currPos.copy(ballMotionState.prevPos);
    ballMotionState.visualPos.copy(ballMotionState.prevPos);
    ballBody.quaternion.copyTo(ballMotionState.prevQuat);
    ballMotionState.currQuat.copy(ballMotionState.prevQuat);
    ballMotionState.curveSpin = 0;
    ballMotionState.initialized = true;
}

function applyBallVisualCurveSpin(dt) {
    if (!ballBody || !ballMesh) return;
    const speed = ballBody.velocity.length();
    if (speed < 0.15) return;
    const curveInput = THREE.MathUtils.clamp(activeHook * 0.85 + ballBody.velocity.x * 0.035, -1, 1);
    if (Math.abs(curveInput) < 0.015) return;
    const stateScale = GAME.state === 'BALL_ROLLING' ? 1 : 0.35;
    ballMotionState.curveSpin += curveInput * speed * dt * 0.55 * stateScale;
    const lean = THREE.MathUtils.clamp(curveInput * 0.16, -0.16, 0.16);
    ballVisualSpinQuat.setFromAxisAngle(ballVisualUpAxis, ballMotionState.curveSpin);
    ballVisualLeanQuat.setFromAxisAngle(ballVisualForwardAxis, lean);
    ballMesh.quaternion.multiply(ballVisualSpinQuat).multiply(ballVisualLeanQuat);
}

function prepareBallMotionStep() {
    if (!ballBody) return;
    if (!ballMotionState.initialized) resetBallMotionState();
    ballMotionState.prevPos.copy(ballMotionState.currPos);
    ballMotionState.prevQuat.copy(ballMotionState.currQuat);
}

function finishBallMotionStep() {
    if (!ballBody) return;
    ballBody.position.copyTo(ballMotionState.currPos);
    ballBody.quaternion.copyTo(ballMotionState.currQuat);
    ballMotionState.initialized = true;
}

function updateFollowCamera(visualBallPos, dt) {
    if (debugState.active || debugState.config.useDebugCamera || GAME.paused) return;
    if (GAME.state !== 'BALL_ROLLING' && GAME.state !== 'ROLL_SETTLING') return;
    const origin = laneOrigin();
    const renderCfg = debugState.config.render || DEFAULT_DEBUG_CONFIG.render;
    const follow = THREE.MathUtils.clamp(Number(renderCfg.cameraFollow ?? 1), 0, 2);
    if (follow <= 0) return;
    const rack = currentRackLayout();
    const rackFront = laneEndZ() + 3.5 + pinRackOffset().z + rack.depth;
    const chaseBack = THREE.MathUtils.clamp(laneCameraDistance(LANE.currentWidth, camera.aspect, camera.fov) * 0.3, 5.2, 7.2);
    let desiredPosition;
    let desiredLook;
    let response = 5.6;

    if (impactCamera.active && renderCfg.endCameraEnabled !== false) {
        impactCamera.elapsed = Math.min(2.5, impactCamera.elapsed + dt);
        const sweep = THREE.MathUtils.smoothstep(impactCamera.elapsed, 0, 1.45);
        const deck = pinDeckContainmentMetrics(LANE.currentWidth);
        const orbit = Math.min(2.2, LANE.currentWidth * 0.13) * sweep;
        const impactBack = THREE.MathUtils.clamp(chaseBack + 5, 11, 16);
        desiredPosition = new THREE.Vector3(
            THREE.MathUtils.lerp(deck.centerX, impactCamera.anchor.x, 0.35) + impactCamera.side * orbit,
            origin.y + 6.2 + Math.min(2, LANE.currentWidth * 0.08) + sweep * 0.4,
            rackFront + impactBack - sweep * 1.5
        );
        desiredLook = new THREE.Vector3(
            THREE.MathUtils.lerp(deck.centerX, impactCamera.anchor.x, 0.55),
            origin.y + 0.65,
            rackFront - Math.min(2.4, rack.depth * 0.3)
        );
        response = 6.5;
    } else {
        if (!visualBallPos) return;
        const travel = Math.max(1, ballStartZ() - rackFront);
        const progress = THREE.MathUtils.clamp((ballStartZ() - visualBallPos.z) / travel, 0, 1);
        const rush = THREE.MathUtils.smoothstep(progress, 0.55, 0.95);
        const back = chaseBack - rush * 1.1;
        const bank = Math.sin(progress * Math.PI) * 0.35 * (Math.sign(visualBallPos.x - origin.x) || Math.sign(activeHook) || 1);
        desiredPosition = new THREE.Vector3(
            origin.x + (visualBallPos.x - origin.x) * 0.78 + bank,
            origin.y + 1.5 + chaseBack * 0.07 - rush * 0.15,
            visualBallPos.z + back
        );
        desiredLook = new THREE.Vector3(
            visualBallPos.x,
            origin.y + 0.65,
            visualBallPos.z - 3.8 + rush * 0.9
        );
    }

    const xzAlpha = 1 - Math.exp(-response * follow * dt);
    const yAlpha = 1 - Math.exp(-(response - 1.5) * follow * dt);
    camera.position.x = THREE.MathUtils.lerp(camera.position.x, desiredPosition.x, xzAlpha);
    camera.position.z = THREE.MathUtils.lerp(camera.position.z, desiredPosition.z, xzAlpha);
    camera.position.y = THREE.MathUtils.lerp(camera.position.y, desiredPosition.y, yAlpha);
    const lookAlpha = 1 - Math.exp(-(response - 0.7) * follow * dt);
    cameraLookTarget.lerp(desiredLook, lookAlpha);
    camera.lookAt(cameraLookTarget);
}

function renderInterpolatedMotion(alpha, dt) {
    const cameraBefore = camera.position.clone();
    if (ballBody && ballMesh) {
        if (!ballMotionState.initialized) resetBallMotionState();
        const t = THREE.MathUtils.clamp(alpha, 0, 1);
        ballMotionState.visualPos.copy(ballMotionState.prevPos).lerp(ballMotionState.currPos, t);
        ballMesh.position.copy(ballMotionState.visualPos);
        ballMesh.quaternion.copy(ballMotionState.prevQuat).slerp(ballMotionState.currQuat, t);
        applyBallVisualCurveSpin(dt);
        updateFollowCamera(ballMotionState.visualPos, dt);
        perfState.ballDelta = ballMotionState.prevPos.distanceTo(ballMotionState.currPos);
    } else {
        if (impactCamera.active) updateFollowCamera(null, dt);
        perfState.ballDelta = 0;
    }
    perfState.cameraDelta = cameraBefore.distanceTo(camera.position);
    perfState.alpha = alpha;
}

function toggleFpsCounter() {
    perfState.showFps = !perfState.showFps;
    if (fpsCounter) fpsCounter.classList.toggle('hidden', !perfState.showFps);
}

function updateFpsCounter(dt, physicsSteps) {
    perfState.frames += 1;
    perfState.elapsed += dt;
    perfState.physicsSteps = physicsSteps;
    if (perfState.elapsed >= 0.25) {
        perfState.fps = Math.round(perfState.frames / perfState.elapsed);
        perfState.frames = 0;
        perfState.elapsed = 0;
        perfState.zeroStepFramesSample = perfState.zeroStepFrames;
        perfState.zeroStepFrames = 0;
    }
    if (fpsCounter && perfState.showFps) {
        fpsCounter.textContent = [
            `FPS ${perfState.fps || '--'} | PHYS ${physicsSteps}`,
            `A ${perfState.alpha.toFixed(2)} | 0STEP ${perfState.zeroStepFramesSample}`,
            `BALL ${perfState.ballDelta.toFixed(3)} | CAM ${perfState.cameraDelta.toFixed(3)}`
        ].join('\n');
    }
}

function animate() {
    requestAnimationFrame(animate);

    const dt = Math.min(clock.getDelta(), 0.1);
    let physicsStepsThisFrame = 0;

    if (!GAME.paused && (GAME.state === 'BALL_ROLLING' || GAME.state === 'ROLL_SETTLING')) {
        physicsAccumulator = Math.min(physicsAccumulator + dt, PHYSICS_STEP * MAX_PHYSICS_STEPS);
        while (physicsAccumulator >= PHYSICS_STEP && physicsStepsThisFrame < MAX_PHYSICS_STEPS) {
            prepareBallMotionStep();
            world.step(PHYSICS_STEP);
            updateVisuals(PHYSICS_STEP);
            finishBallMotionStep();
            physicsAccumulator -= PHYSICS_STEP;
            physicsStepsThisFrame += 1;
        }
        if (physicsStepsThisFrame >= MAX_PHYSICS_STEPS) physicsAccumulator = 0;
        if (physicsStepsThisFrame === 0) perfState.zeroStepFrames += 1;
        const interpolationAlpha = THREE.MathUtils.clamp(physicsAccumulator / PHYSICS_STEP, 0, 1);
        renderInterpolatedMotion(interpolationAlpha, dt);
    } else {
        physicsAccumulator = 0;
        perfState.zeroStepFrames = 0;
        updateSpeedLines();
    }

    if (!GAME.paused && GAME.state === 'MAIN_METER') {
        gauge.update(dt);
        if (GAME.state === 'MAIN_METER' && !debugState.active && !debugState.config.useDebugCamera) {
            const blend = 1 - Math.exp(-5 * dt);
            preRollViewBlend = THREE.MathUtils.lerp(preRollViewBlend, preRollViewRaised ? 1 : 0, blend);
            if (Math.abs(preRollViewBlend - Number(preRollViewRaised)) < 0.001) preRollViewBlend = Number(preRollViewRaised);
            setPreRollCamera();
        }
    }
    gauge.draw();

    if (!GAME.paused && particles.length) updateParticles(particles, dt);

    if (debugState.active) {
        updateDebugFlyCamera(dt);
    }
    presentation?.setAim({ visible: GAME.state === 'MAIN_METER' && !debugState.active && !GAME.paused, position: ballMesh?.position, angle: gauge.aimAngle });
    presentation?.setBall(ballMesh?.position, ballBody?.shapes?.[0]?.radius);
    presentation?.update(GAME.paused ? 0 : dt);
    updateGameplayHud();
    updateBallBagHud();
    updateLanePolish(dt);
    updateLaneDecorationLife();

    const originalCameraPosition = camera.position.clone();
    if (!debugState.active && cameraShake > 0.001) {
        camera.position.x += (Math.random() - 0.5) * cameraShake;
        camera.position.y += (Math.random() - 0.5) * cameraShake * 0.6;
        cameraShake *= Math.pow(0.08, dt);
    } else {
        cameraShake = 0;
    }

    renderer.render(scene, camera);
    camera.position.copy(originalCameraPosition);
    updateFpsCounter(dt, physicsStepsThisFrame);
}

export async function bootGame() {
    setupNativeShellUi();
    setupNativeAudioLifecycle();
    initEngine();
    bindInputs();
    modelAssetsReady = loadModelAssets();
    await modelAssetsReady;
    finishLoadingScreen();
    startNativeShellAudio();
    animate();
}


function renderStarterChoices() {
    starterEquipment?.destroy();
    starterEquipment = mountStarterEquipment(document.getElementById('starter-ball-choices'), {
        ids: starterBallIds,
        onChange(ids) { starterBallIds = ids; sfx.playTick(); }
    });
}

function ballButtonsMarkup() {
    return (GAME.ballLoadout?.balls || []).map((ball, index) => {
        const starter = STARTER_BALLS.find(item => item.id === ball.id);
        return `<button type="button" data-ball-index="${index}" aria-pressed="${GAME.ballLoadout.selected === index}" style="--ball-color:${starter.color}" title="${escapeHtml(ball.traits.map(id => BALL_TRAITS[id].desc).join(' '))}"><span class="ball-swatch" aria-hidden="true">●</span><b>${starter.name}</b><small>${ball.traits.map(id => BALL_TRAITS[id].name).join(' · ')}</small></button>`;
    }).join('');
}

function selectLoadoutBall(index) {
    if (!switchBall(GAME, index, gauge.stage, debugState.active)) return;
    if (GAME.state === 'MAIN_METER') {
        spawnBall();
        gauge.start();
        setPreRollCamera();
    } else {
        triggerShopTransition();
    }
    autoSaveRunSlot();
    sfx.playTick();
    updateBallBagHud();
}

function updateBallBagHud() {
    const active = ['MAIN_METER', 'BALL_ROLLING', 'ROLL_SETTLING'].includes(GAME.state) && !GAME.paused && !debugState.active;
    setIfChanged(document.getElementById('lane-modifier-label'), 'hidden', !active);
    setIfChanged(document.getElementById('lane-modifier-label'), 'textContent', laneModifierLabel(GAME));
    const tray = document.getElementById('ball-bag-hud');
    setIfChanged(tray, 'hidden', !active || GAME.mode !== 'roguelike');
    if (tray.hidden) return;
    const bag = GAME.ballLoadout;
    const signature = JSON.stringify(bag);
    if (signature !== ballHudSignature) {
        document.getElementById('ball-bag-buttons').innerHTML = ballButtonsMarkup();
        ballHudSignature = signature;
    }
    const canSwap = canSwitchBall(GAME, gauge.stage, debugState.active);
    for (const button of document.getElementById('ball-bag-buttons').querySelectorAll('button')) setIfChanged(button, 'disabled', !canSwap);
    setIfChanged(document.getElementById('bumper-charge-label'), 'textContent', `BUMPERS • ${migrateBumperCharges(GAME.activeUpgrades)} shared impacts`);
}

function applyLoadoutBallSkin(mesh, radius) {
    const ball = selectedBall(GAME);
    if (!ball) return;
    const starter = STARTER_BALLS.find(item => item.id === ball.id);
    // Tint only the sphere body, preserving the finger holes and shared textures.
    mesh.traverse(child => {
        if (child.geometry?.type !== 'SphereGeometry' || !child.material?.color) return;
        child.material.color.set(starter.color);
        if (child.material.emissive) {
            child.material.emissive.set(starter.color);
            child.material.emissiveIntensity = 0.08 + ball.traits.length * 0.035;
        }
    });
    // Up to four readable bands. No throw-time geometry or particle churn.
    const colors = ball.traits.map(id => BALL_TRAITS[id].color);
    if (GAME.activeUpgrades.ballMass > 12) colors.push('#d7e8fa');
    if (GAME.activeUpgrades.spinPower > 0) colors.push('#a99bff');
    if (GAME.activeUpgrades.ballSize > 1) colors.push('#6fe5e6');
    colors.forEach((color, index) => {
        const band = new THREE.Mesh(new THREE.TorusGeometry(radius * 1.012, radius * 0.022, 5, 32), new THREE.MeshBasicMaterial({ color }));
        band.rotation.set(Math.PI / 2 + index * 0.38, index * 0.55, 0);
        mesh.add(band);
    });
}

function updateLaneHazards(dt) {
    throwElapsed += dt;
    const origin = laneOrigin(), radius = ballBody.shapes[0].radius || 0.49;
    const localX = ballBody.position.x - origin.x;
    rearmBumperContacts(bumperContacts, localX, LANE.currentWidth / 2, radius);
    // Remove depleted guards after Rapier finishes dispatching the contact batch.
    if (gutterGuardsArray.length && migrateBumperCharges(GAME.activeUpgrades) === 0) toggleGutterGuards(false);
    for (const guard of gutterGuardsArray) {
        guard.flash = Math.max(0, guard.flash - dt);
        guard.mesh.material.emissiveIntensity = 0.35 + guard.flash * 4;
    }
    if (ballBody.position.z < laneEndZ() || ballBody.position.z > ballStartZ() || ballBody.position.y < origin.y - 0.1) return;
    ballBody.velocity.x += gutterMawDelta({ route: GAME.currentRoute, rolling: GAME.state === 'BALL_ROLLING', elapsed: throwElapsed, localX, halfWidth: LANE.currentWidth / 2, velocityX: ballBody.velocity.x, resistance: activeThrowMods.resistance || 0, dt });
    mawVisuals?.update(throwElapsed);
}

function clearGameplayLaneEffects() {
    mawVisuals?.dispose();
    mawVisuals = null;
    toggleGutterGuards(false);
    bumperContacts = createBumperContacts();
    throwElapsed = 0;
}

function syncMawVisuals() {
    mawVisuals?.dispose();
    mawVisuals = null;
    if (!isGutterMawRoute(GAME.currentRoute)) return;
    const metrics = gutterChannelMetrics(LANE.currentWidth);
    mawVisuals = createMawVisuals(THREE, scene, { origin: laneOrigin(), length: laneLength(), gutterX: metrics.visualWidth / 2 + metrics.gutterWidth * 0.5 });
}

function renderTraitReceiver(item) {
    const content = document.getElementById('gear-inspect-content');
    let receiver = content.querySelector('.trait-receiver-host');
    if (!receiver) { receiver = document.createElement('div'); receiver.className = 'trait-receiver-host'; content.appendChild(receiver); }
    const cost = upgradeCost(item);
    receiver.innerHTML = receiverMarkup(GAME, item, cost, pendingBallPurchase);
    receiver.querySelectorAll('[data-receive-ball]').forEach(button => button.addEventListener('click', () => {
        pendingBallPurchase = quoteBallTrait(GAME, item, upgradeCost(item), Number(button.dataset.receiveBall));
        renderTraitReceiver(item);
        content.querySelector(`[data-receive-ball="${button.dataset.receiveBall}"]`)?.focus({ preventScroll: true });
    }));
    receiver.querySelector('#btn-confirm-ball-trait').addEventListener('click', () => {
        const quote = pendingBallPurchase;
        if (!ballTraitEligibility(GAME, item, upgradeCost(item), quote).canBuy) {
            pendingBallPurchase = null;
            renderTraitReceiver(item);
            return;
        }
        window.purchaseUpgrade(item.id, quote);
    });
}

function installEquipmentDetailClose(detail, view) {
    detail.querySelector('.equipment-detail-close')?.remove();
    detail.insertAdjacentHTML('afterbegin', '<button type="button" class="equipment-detail-close">BACK TO YOUR BAG ×</button>');
    detail.querySelector('.equipment-detail-close').addEventListener('click', () => {
        detail.classList.add('hidden');
        document.getElementById(view === 'stats' ? 'btn-stats-screen-hub' : view === 'howto' ? 'btn-how-to-play-hub' : 'btn-relic-shelf-hub').focus({ preventScroll: true });
    });
}
