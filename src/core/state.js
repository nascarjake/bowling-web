import { createBallLoadout } from '../game/ballLoadout.js?v=0.3.0';
export const GAME = {
    state: 'TITLE', // TITLE, MAIN_METER, BALL_ROLLING, ROLL_SETTLING, ROUND_OVER, SHOP, GAMEOVER
    mode: 'roguelike',
    ballLoadout: createBallLoadout(),
    paused: false,
    pauseBlockedState: null,
    frame: 1,
    score: 0,
    targetScore: 8,
    rollsLeft: 2,
    cash: 0,
    cumulativeScore: 0,
    maxFrames: 12,
    stage: 1,
    frameInStage: 1,
    currentRoute: null,
    routeOptions: [],
    routeMap: [],
    completedNodes: [],
    runSeed: null,
    saveSlot: null,
    selectedRelic: 'last_frame_token',
    relicsUsed: {},
    shopSelection: [],
    shopSoldOut: [],
    shopRerolls: 0,
    upgradePurchases: 0,
    activeUpgrades: {
        goldPinChance: 0.12,    // 12% base
        explosivePinChance: 0.0, // 0% base
        implosivePinChance: 0.0, // 0% base
        bouncyPinChance: 0.05,  // 5% base
        ballSize: 1.0,         // size multiplier
        ballMass: 12.0,        // displayed ball weight in pounds; physics maps this to tuned carry
        spinPower: 0.0,        // side control multiplier
        extraRolls: 0,         // active modifications
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
    },
    runModifiers: {
        pinCashMultipliers: {},
        pinCashOverrides: {},
        disabledPinEffects: {},
        daily: null
    },
    stats: {
        rollsThisFrame: 0,
        pinsSpawned: 0,
        currentRollScore: 0,
        currentRollPins: 0,
        currentRollBonusScore: 0,
        maxRollsThisFrame: 2,
        rollScores: [],
        rollRecorded: false,
        canContinueRoll: false,
        promptSounded: false,
        reviewTimer: null,
        lastEntry: null
    },
    tenPin: {
        specialPinsEnabled: true,
        frames: [],
        selectedRackSpecials: [],
        shopSelection: [],
        shopRerolls: 0,
        fullBag: true,
        pendingRackSpecialTypes: [],
        manualRackAssignments: Array(10).fill(null),
        manualRackSelectedIndex: null,
        manualRackNext: false,
        rackPinIndex: 0,
        awaitingShopFrame: 1
    }
};
