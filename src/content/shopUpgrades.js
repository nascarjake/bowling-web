import { BALL_TRAITS, addBallTrait } from '../game/ballLoadout.js?v=0.4.1';
import { addBumperCharges } from '../game/laneHazards.js?v=0.4.1';
import { GAME } from '../core/state.js?v=0.4.1';

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

export const SHOP_UPGRADES = [
    ...Object.entries(BALL_TRAITS).map(([id, trait]) => ({
        id: `ball_trait_${id}`, traitId: id, name: trait.name, category: 'BALL',
        desc: `${trait.desc} Permanent on the receiving ball only. Each ball can own this trait once.`,
        cost: id === 'focus' ? 7 : 9,
        effect: (ballIndex) => addBallTrait(GAME, id, ballIndex)
    })),
    {
        id: 'gold_pins',
        name: 'Midas Pin Formula',
        category: 'PINS',
        desc: 'Increases Gold Pin spawn rate by +10%. A dependable early economy and scoring starter.',
        cost: 7,
        effect: () => { GAME.activeUpgrades.goldPinChance += 0.1; }
    },
    {
        id: 'explosive_pins',
        name: 'TNT Pins',
        category: 'PINS',
        desc: 'Add a +7% chance for combustible red pins. They nudge clusters now, not detonate the whole rack.',
        cost: 8,
        effect: () => { GAME.activeUpgrades.explosivePinChance += 0.07; }
    },
    {
        id: 'implosive_pins',
        name: 'Gravitational Pins',
        category: 'PINS',
        desc: 'Add a +7% chance for purple pins that gently pull nearby pins into tighter clusters.',
        cost: 8,
        effect: () => { GAME.activeUpgrades.implosivePinChance += 0.07; }
    },
    {
        id: 'heavy_ball',
        name: 'Tungsten Ball Core',
        category: 'BALL',
        desc: 'Add +2 lb to ball weight. A cleaner power bump without turning every rack into paste.',
        cost: 9,
        effect: () => { GAME.activeUpgrades.ballMass += 2.0; }
    },
    {
        id: 'steer_ball',
        name: 'Magnetic Spin Gyros',
        category: 'CONTROL',
        desc: 'Unlock or reinforce ball steering during rolls! Use A / D (or left/right arrows).',
        cost: 9,
        effect: () => { GAME.activeUpgrades.spinPower += 1.6; }
    },
    {
        id: 'big_ball',
        name: 'Titan Sphere',
        category: 'BALL',
        desc: 'Expands ball size by +8%. Better contact, but still needs a real line.',
        cost: 11,
        effect: () => { GAME.activeUpgrades.ballSize += 0.08; }
    },
    {
        id: 'extra_roll',
        name: 'Reserve Ball Space',
        category: 'CONSISTENCY',
        desc: 'Permanently increases starting frames by +1 starting roll.',
        cost: 18,
        effect: () => { GAME.activeUpgrades.extraRolls += 1; }
    },
    {
        id: 'bouncy_pins',
        name: 'Polymer Pin Coat',
        category: 'PINS',
        desc: 'Increases bouncy pin spawn probability by +10%. Adds texture without free clears.',
        cost: 7,
        effect: () => { GAME.activeUpgrades.bouncyPinChance += 0.1; }
    },
    {
        id: 'multiplier',
        name: 'Digital Pin Scaler',
        category: 'ECONOMY',
        desc: 'All fallen pins yield +12% score. Wallet conversion stays tighter.',
        cost: 15,
        effect: () => { GAME.activeUpgrades.pinValueMultiplier += 0.12; }
    },
    {
        id: 'gutters',
        name: 'Charged Bumper Guards',
        category: 'CONSISTENCY',
        repeatable: true,
        desc: 'Add 3 shared bumper impacts to your run. Either side spends one charge per contact. Repeat purchases stack +3.',
        cost: 6,
        effect: () => addBumperCharges(GAME.activeUpgrades)
    },
    {
        id: 'thumb_tape',
        name: 'Thumb Tape Ritual',
        category: 'CONSISTENCY',
        desc: 'Widens the true timing window a little. Skill assist, not raw damage.',
        cost: 9,
        effect: () => { GAME.activeUpgrades.timingForgiveness += 0.012; }
    },
    {
        id: 'dampener_rings',
        name: 'Pin Dampener Rings',
        category: 'PINS',
        desc: 'Special pin forces get smoother and slightly wider, reducing wild physics spikes.',
        cost: 10,
        effect: () => { GAME.activeUpgrades.specialControl += 0.18; }
    },
    {
        id: 'lane_read',
        name: 'Lane Read Notes',
        category: 'CONTROL',
        desc: 'Adds gentle steering authority and helps recover small route mistakes.',
        cost: 11,
        effect: () => {
            GAME.activeUpgrades.spinPower += 0.75;
            GAME.activeUpgrades.timingForgiveness += 0.006;
        }
    },
    {
        id: 'hot_towel',
        name: 'Hot Towel Focus',
        category: 'ONE THROW',
        desc: 'Your next throw gets a much wider true timing window.',
        cost: 5,
        effect: () => { GAME.activeUpgrades.nextThrowFocus += 0.035; }
    },
    {
        id: 'polished_ball',
        name: 'Fresh Polish',
        category: 'ONE THROW',
        desc: 'Your next throw gets a small speed boost without adding more chaos to pins.',
        cost: 6,
        effect: () => { GAME.activeUpgrades.nextThrowPowerBoost += 2.5; }
    },
    {
        id: 'oil_sponge',
        name: 'Oil Pattern Sponge',
        category: 'CONTROL',
        desc: 'A practical read for slick lanes: more steering and a tiny timing cushion.',
        cost: 12,
        effect: () => {
            GAME.activeUpgrades.spinPower += 0.55;
            GAME.activeUpgrades.timingForgiveness += 0.008;
        }
    },
    {
        id: 'spare_chalk',
        name: 'Spare Chalk Marks',
        category: 'CONSISTENCY',
        desc: 'Lowers future target pressure a little. Boring, useful, beautiful.',
        cost: 12,
        effect: () => {
            GAME.activeUpgrades.targetTax = Math.max(-8, GAME.activeUpgrades.targetTax - 3);
        }
    },
    {
        id: 'soft_core',
        name: 'Soft Core Insert',
        category: 'BALL',
        desc: 'Adds controlled mass and a calmer pocket hit without huge special-pin spikes.',
        cost: 13,
        effect: () => {
            GAME.activeUpgrades.ballMass += 2.0;
            GAME.activeUpgrades.specialControl += 0.08;
        }
    },
    {
        id: 'practice_frame',
        name: 'Practice Frame Coupon',
        category: 'ONE THROW',
        desc: 'Next throw gets both focus and speed, tuned for clutch boss cleanup.',
        cost: 8,
        effect: () => {
            GAME.activeUpgrades.nextThrowFocus += 0.025;
            GAME.activeUpgrades.nextThrowPowerBoost += 1.4;
        }
    },
    {
        id: 'house_heavy_ball',
        name: 'Heavy House Ball',
        category: 'ONE THROW',
        desc: 'Next throw gets extra ball mass and better carry, but the line still matters.',
        cost: 6,
        effect: () => applyOneThrowBallUpgrade('heavy')
    },
    {
        id: 'pearl_coverstock',
        name: 'Pearl Coverstock',
        category: 'ONE THROW',
        desc: 'Next throw reads later and snaps harder near the pocket.',
        cost: 7,
        effect: () => applyOneThrowBallUpgrade('pearl')
    },
    {
        id: 'urethane_read',
        name: 'Urethane Read',
        category: 'ONE THROW',
        desc: 'Next throw is steadier and less overreactive through the roll phase.',
        cost: 6,
        effect: () => applyOneThrowBallUpgrade('urethane')
    },
    {
        id: 'fresh_tape',
        name: 'Fresh Tape',
        category: 'ONE THROW',
        desc: 'Next throw gets a small focus bump for aim and timing.',
        cost: 4,
        effect: () => applyOneThrowBallUpgrade('tape')
    },
    {
        id: 'speed_polish',
        name: 'Speed Polish',
        category: 'ONE THROW',
        desc: 'Next throw launches faster, earns a little more cash, and hooks a bit less.',
        cost: 5,
        effect: () => applyOneThrowBallUpgrade('speed')
    }
];
