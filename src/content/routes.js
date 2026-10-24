export const ROUTE_TYPES = {
    STANDARD: {
        id: 'standard',
        name: 'House Lane',
        label: 'STANDARD',
        desc: 'A cleaner rack with a fair target. Lower payout, safer tempo.',
        reward: 7,
        targetMod: 0,
        rollBonus: 0,
        layout: 'classic',
        hookMod: 1,
        pinScoreMod: 1
    },
    START: {
        id: 'start',
        name: 'House Start',
        label: 'START',
        desc: 'A clean 10-pin opener with almost no weirdness. Get your bearings.',
        reward: 0,
        targetMod: -2,
        rollBonus: 0,
        layout: 'start',
        hookMod: 1,
        pinScoreMod: 1
    },
    MESSY: {
        id: 'messy',
        name: 'Crooked Rack',
        label: 'MESSY',
        desc: 'Pins spawn slightly off pattern. Better cash, less reliable chain reactions.',
        reward: 11,
        targetMod: 2,
        rollBonus: 0,
        layout: 'messy',
        hookMod: 1,
        pinScoreMod: 1.08
    },
    SPLIT: {
        id: 'split',
        name: 'Split Deck',
        label: 'SPLIT',
        desc: 'Two clusters force a real line choice. More reward if you can clear both sides.',
        reward: 14,
        targetMod: 5,
        rollBonus: 1,
        layout: 'split',
        hookMod: 1,
        pinScoreMod: 1.12
    },
    OIL: {
        id: 'oil',
        name: 'Oil Baron Lane',
        label: 'OIL',
        desc: 'Hook is muted and the ball slides longer. Precision matters more than power.',
        reward: 13,
        targetMod: 3,
        rollBonus: 0,
        layout: 'classic',
        hookMod: 0.52,
        pinScoreMod: 1.1
    },
    HEAVY: {
        id: 'heavy',
        name: 'Heavy Timber',
        label: 'HEAVY',
        desc: 'Pins hit harder and score more, but messy clears are tougher.',
        reward: 15,
        targetMod: 6,
        rollBonus: 0,
        layout: 'heavy',
        hookMod: 1,
        pinScoreMod: 1.22,
        heavyPins: true
    },
    FRAGILE: {
        id: 'fragile',
        name: 'Glass Rack',
        label: 'FRAGILE',
        desc: 'More special pins appear, but the target jumps and chain reactions can scatter the rack.',
        reward: 16,
        targetMod: 6,
        rollBonus: 0,
        layout: 'fragile',
        hookMod: 1.05,
        pinScoreMod: 1.08,
        specialMod: 1.85
    },
    GUTTER: {
        id: 'gutter',
        name: 'Gutter Pull',
        label: 'GUTTER',
        desc: 'The lane edges bite harder. Safer center shots matter more than wild hooks.',
        reward: 15,
        targetMod: 5,
        rollBonus: 0,
        layout: 'classic',
        hookMod: 1.08,
        pinScoreMod: 1.15,
        gutterPull: 1.55
    },
    WIDE: {
        id: 'wide',
        name: 'Wide House',
        label: 'WIDE',
        desc: 'A broad rack stretches toward the edges. Bigger angles, bigger cleanup problems.',
        reward: 17,
        targetMod: 7,
        rollBonus: 1,
        layout: 'wide',
        hookMod: 1,
        pinScoreMod: 1.1
    },
    BOSS: {
        id: 'boss',
        name: 'Boss Rack',
        label: 'BOSS',
        desc: 'A stage-ending rack with extra spread and a punishing target.',
        reward: 23,
        targetMod: 10,
        rollBonus: 1,
        layout: 'boss',
        hookMod: 0.9,
        pinScoreMod: 1.25,
        boss: true
    }
};

export const BOSS_VARIANTS = {
    4: [
        {
            id: 'boss_split_king',
            name: 'Split King',
            label: 'BOSS',
            desc: 'Two royal clusters sit far apart. Choose a side, then earn the cleanup.',
            reward: 23,
            targetMod: 9,
            rollBonus: 1,
            layout: 'split',
            hookMod: 1,
            pinScoreMod: 1.18,
            boss: true
        },
        {
            id: 'boss_bomb_rack',
            name: 'Bomb Rack',
            label: 'BOSS',
            desc: 'At least one explosive pin joins the volatile rack, but forces are damped. Control the chaos.',
            reward: 23,
            targetMod: 10,
            rollBonus: 1,
            layout: 'fragile',
            hookMod: 1,
            pinScoreMod: 1.14,
            specialMod: 1.65,
            featuredPin: 'EXPLOSIVE',
            boss: true
        }
    ],
    8: [
        {
            id: 'boss_oil_baron',
            name: 'Oil Baron',
            label: 'BOSS',
            desc: 'The hook window shrinks and the ball slides long. Position matters more than power.',
            reward: 27,
            targetMod: 13,
            rollBonus: 1,
            layout: 'classic',
            hookMod: 0.42,
            pinScoreMod: 1.22,
            boss: true
        },
        {
            id: 'boss_gutter_maw',
            name: 'Gutter Maw',
            label: 'BOSS',
            desc: 'Gutter black holes pull near the edges after a brief launch grace. Keep a center line; Anchor Cover resists the pull and charged bumpers catch exits.',
            reward: 27,
            targetMod: 14,
            rollBonus: 1,
            layout: 'wide',
            hookMod: 1.05,
            pinScoreMod: 1.2,
            gutterPull: 1.9,
            gutterMaw: true,
            boss: true
        }
    ],
    12: [
        {
            id: 'boss_crown_rack',
            name: 'Crown Rack',
            label: 'FINAL',
            desc: 'A dense championship rack with a punishing target and very little mercy.',
            reward: 0,
            targetMod: 19,
            rollBonus: 1,
            layout: 'boss',
            hookMod: 0.92,
            pinScoreMod: 1.28,
            boss: true
        },
        {
            id: 'boss_gravity_final',
            name: 'Gravity Well',
            label: 'FINAL',
            desc: 'At least one implosive pin joins the special rack. Clear deliberately before the rack folds in on itself.',
            reward: 0,
            targetMod: 18,
            rollBonus: 1,
            layout: 'fragile',
            hookMod: 0.95,
            pinScoreMod: 1.24,
            specialMod: 1.9,
            featuredPin: 'IMPLOSIVE',
            boss: true
        }
    ]
};
