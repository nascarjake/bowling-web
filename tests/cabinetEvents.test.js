import test from 'node:test';
import assert from 'node:assert/strict';
import { GAME } from '../src/core/state.js?v=0.4.1';
import { EVENT_TYPES } from '../src/content/events.js?v=0.4.1';
import { EVENT_IDS, eventVisual, eventChoiceVisual, eventSceneArt } from '../src/ui/cabinetArt.js?v=0.4.1';

const number = value => Number(value.replace('−', '-').replace(/[^0-9.+-]/g, ''));
const effects = {
    'PIN DOLLARS': ['cash', 1],
    'TIMING WINDOW': ['timingForgiveness', 100],
    'FOCUS WINDOW': ['nextThrowFocus', 100],
    'LAUNCH SPEED': ['nextThrowPowerBoost', 1],
    'SPECIAL PIN CONTROL': ['specialControl', 100],
    'STEERING POWER': ['spinPower', 1],
    'BALL WEIGHT': ['ballMass', 1],
    'FUTURE TARGETS': ['targetTax', 1],
    'BUMPER IMPACTS': ['bumperCharges', 1]
};

test('every event and choice has a complete visual preview', () => {
    assert.deepEqual(EVENT_IDS.sort(), EVENT_TYPES.map(event => event.id).sort());
    for (const event of EVENT_TYPES) {
        assert.match(eventSceneArt(event.id), /^<svg/);
        assert.match(eventVisual(event.id).color, /^#[0-9a-f]{6}$/i);
        for (let index = 0; index < event.choices.length; index++) {
            const visual = eventChoiceVisual(event.id, index, { cash: 18 });
            assert.ok(visual.art && visual.gains.length && visual.note);
            for (const gain of visual.gains) assert.ok(gain.value && gain.label && gain.duration);
        }
    }
});

test('displayed event rewards and catches match the actual game effects', () => {
    const original = structuredClone(GAME);
    try {
        for (const event of EVENT_TYPES) for (let index = 0; index < event.choices.length; index++) {
            Object.assign(GAME, structuredClone(original));
            GAME.cash = 18;
            const before = structuredClone(GAME);
            const visual = eventChoiceVisual(event.id, index, { cash: GAME.cash, targetTax: GAME.activeUpgrades.targetTax });
            event.choices[index].apply();
            for (const gain of visual.gains) {
                if (effects[gain.label]) {
                    const [field, scale] = effects[gain.label];
                    const delta = field === 'cash' ? GAME.cash - before.cash : GAME.activeUpgrades[field] - before.activeUpgrades[field];
                    assert.ok(Math.abs(number(gain.value) - delta * scale) < 1e-8, `${event.id}/${index}: ${gain.label}`);
                } else if (gain.label === 'GOLD PIN CASH') assert.equal(GAME.runModifiers.pinCashMultipliers.GOLD / (before.runModifiers.pinCashMultipliers.GOLD || 1), number(gain.value));
                else if (gain.label === 'TNT EXPLOSIONS') assert.equal(GAME.runModifiers.disabledPinEffects.EXPLOSIVE, true);
                else assert.fail(`Unverified reward: ${gain.label}`);
            }
            if (visual.trade?.includes('FUTURE TARGETS')) assert.equal(number(visual.trade), GAME.activeUpgrades.targetTax - before.activeUpgrades.targetTax);
            if (visual.trade?.startsWith('PAY')) assert.equal(number(visual.trade), before.cash - GAME.cash);
            if (visual.trade?.includes('FALLEN TNT')) assert.equal(GAME.runModifiers.pinCashOverrides.EXPLOSIVE, -1);
        }
    } finally { Object.assign(GAME, original); }
});

test('information costs reflect available cash and target relief respects its floor', () => {
    for (const cash of [0, 2, 6, 18]) assert.equal(eventChoiceVisual('bookie', 1, { cash }).trade, `PAY $${Math.min(6, cash)}`);
    assert.equal(eventChoiceVisual('lost_ball_return', 0, { targetTax: -9 }).gains[1].value, '−1');
    assert.equal(eventChoiceVisual('lost_ball_return', 0, { targetTax: -10 }).gains[1].value, 'AT MIN');
    assert.equal(eventChoiceVisual('mechanic', 0).gains[0].duration, 'NEXT THROW');
    assert.equal(eventChoiceVisual('league_night', 0).gains[0].duration, 'THIS RUN');
});
