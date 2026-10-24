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

export const TENPIN_SHOP_ITEMS = [
    { id: 'gold', typeKey: 'GOLD', name: 'Gold Pin', category: 'RACK PIN', desc: 'Counts as one knocked pin, but adds +1 score to this frame and strike/spare bonuses.', cost: 3 },
    { id: 'silver', typeKey: 'SILVER', name: 'Silver Pin', category: 'BONUS PIN', desc: 'Counts normal here, but adds +1 when this roll pays a previous strike or spare.', cost: 3 },
    { id: 'bouncy', typeKey: 'BOUNCY', name: 'Bouncy Pin', category: 'RACK PIN', desc: 'One springy pin for this rack. Useful for messy carry.', cost: 2 },
    { id: 'explosive', typeKey: 'EXPLOSIVE', name: 'TNT Pin', category: 'RACK PIN', desc: 'One force pin for this rack. Lower frequency, bigger moment.', cost: 4 },
    { id: 'implosive', typeKey: 'IMPLOSIVE', name: 'Gravity Pin', category: 'RACK PIN', desc: 'One pull pin for this rack. Can tighten the deck after contact.', cost: 4 },
    { id: 'manual_rack', name: 'Rack It Yourself', category: 'CONTROL', desc: 'Places bought special pins in premium slots on the next rack.', cost: 5, effect: () => { GAME.tenPin.manualRackNext = true; } },
    { id: 'tenpin_heavy_ball', name: 'Heavy House Ball', category: 'ONE THROW', desc: 'Next throw gets extra ball mass and better carry.', cost: 4, effect: () => applyOneThrowBallUpgrade('heavy') },
    { id: 'tenpin_pearl_coverstock', name: 'Pearl Coverstock', category: 'ONE THROW', desc: 'Next throw reads later and snaps harder near the pocket.', cost: 4, effect: () => applyOneThrowBallUpgrade('pearl') },
    { id: 'tenpin_urethane_read', name: 'Urethane Read', category: 'ONE THROW', desc: 'Next throw is steadier and less overreactive.', cost: 3, effect: () => applyOneThrowBallUpgrade('urethane') },
    { id: 'tenpin_fresh_tape', name: 'Fresh Tape', category: 'ONE THROW', desc: 'Next throw gets a small focus bump for aim and timing.', cost: 3, effect: () => applyOneThrowBallUpgrade('tape') },
    { id: 'tenpin_speed_polish', name: 'Speed Polish', category: 'ONE THROW', desc: 'Next throw launches faster, earns a little more cash, and hooks a bit less.', cost: 3, effect: () => applyOneThrowBallUpgrade('speed') }
];

export const TENPIN_RACK_SLOTS = [
    { label: '1', x: 50, y: 12 },
    { label: '2', x: 40, y: 32 },
    { label: '3', x: 60, y: 32 },
    { label: '4', x: 30, y: 52 },
    { label: '5', x: 50, y: 52 },
    { label: '6', x: 70, y: 52 },
    { label: '7', x: 20, y: 74 },
    { label: '8', x: 40, y: 74 },
    { label: '9', x: 60, y: 74 },
    { label: '10', x: 80, y: 74 }
];
