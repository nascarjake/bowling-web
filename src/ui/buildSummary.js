import { shopPinArt } from './shopArt.js?v=0.4.0';
import { STARTER_BALLS, BALL_TRAITS } from '../game/ballLoadout.js?v=0.4.0';
import { migrateBumperCharges } from '../game/laneHazards.js?v=0.4.0';
import { STARTER_PORTRAITS } from './starterEquipment.js?v=0.4.0';
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' })[char]);
const number = value => Number(value || 0).toFixed(3).replace(/\.?0+$/, '') || '0';
const percent = value => `${Math.round(Number(value || 0) * 100)}%`;
export function equipmentScope(item) {
    if (item.traitId) return { kind:'ball', label:'ONE BALL · PERMANENT', limit:'Once per ball' };
    if (item.category === 'ONE THROW') return { kind:'throw', label:'NEXT THROW · SHARED BAG', limit:'Stacks for the next throw' };
    if (item.id === 'gutters') return { kind:'bumper', label:'BOTH SIDES · SHARED CHARGES', limit:'+3 per purchase · no charge cap' };
    if (item.id === 'spare_chalk') return { kind:'shared', label:'HOUSE GEAR · THIS RUN', limit:'Target relief floor −8 · 1 per offer' };
    if (item.category === 'PINS') return { kind:'pins', label:'PIN RACK · THIS RUN', limit:'1 per offer · stacks across shops' };
    return { kind:'shared', label:'HOUSE GEAR · BOTH BALLS', limit:'1 per offer · stacks across shops' };
}
export function buildSummary(game) {
    const u = game.activeUpgrades || {};
    const balls = (game.ballLoadout?.balls || []).map((ball, index) => ({
        ...STARTER_BALLS.find(starter => starter.id === ball.id), index,
        selected: game.ballLoadout.selected === index,
        traits: (ball.traits || []).filter(id => Object.hasOwn(BALL_TRAITS, id)).map(id => ({ id, ...BALL_TRAITS[id] }))
    }));
    const pins = [['Gold','goldPinChance'], ['TNT','explosivePinChance'], ['Gravity','implosivePinChance'], ['Bounce','bouncyPinChance']].map(([label, key]) => ({ label, value:percent(u[key]), active:Number(u[key] || 0) > 0 }));
    const shared = [
        { label:'House weight', value:`${number(u.ballMass)} lb` },
        { label:'Size', value:percent(u.ballSize) },
        { label:'Pin score', value:`×${number(u.pinValueMultiplier)}` },
        { label:'Extra throws', value:`+${number(u.extraRolls)}` }
    ];
    const effects = [
        ['Steering',u.spinPower], ['Timing window',u.timingForgiveness], ['Special control',u.specialControl], ['Target pressure',u.targetTax],
        ['Next speed',u.nextThrowPowerBoost], ['Next focus',u.nextThrowFocus], ['Next mass',u.nextThrowMassBoost], ['Next hook',u.nextThrowHookBoost],
        ['Next hook delay',u.nextThrowHookDelay], ['Next stability',u.nextThrowStability]
    ].filter(([, value]) => Number(value)).map(([label, value]) => ({label, value:number(value)}));
    if (u.nextThrowCashMultiplier && u.nextThrowCashMultiplier !== 1) effects.push({ label:'Next cash', value:`×${number(u.nextThrowCashMultiplier)}` });
    for (const [type, value] of Object.entries(game.runModifiers?.pinCashMultipliers || {})) effects.push({ label:`${type} cash`, value:`×${number(value)}` });
    for (const [type, value] of Object.entries(game.runModifiers?.pinCashOverrides || {})) effects.push({ label:`${type} cash override`, value:number(value) });
    for (const [type, disabled] of Object.entries(game.runModifiers?.disabledPinEffects || {})) if (disabled) effects.push({ label:`${type} effect`, value:'OFF' });
    if (game.runModifiers?.daily?.enabled) effects.push({ label:'Daily rules', value:game.runModifiers.daily.title || 'ACTIVE' });
    return { balls, pins, shared, effects, charges:migrateBumperCharges(u) };
}
export function buildSummaryMarkup(game) {
    const build = buildSummary(game);
    const chips = list => list.map(item => `<span class="build-chip"><span>${escape(item.label)}</span><b>${escape(item.value)}</b></span>`).join('');
    return `<div class="build-heading"><b>YOUR BUILD</b><span>LIVE EQUIPMENT</span></div><div class="build-ball-pair">${build.balls.map(ball => `<button type="button" class="build-ball" data-ball-index="${ball.index}" aria-pressed="${ball.selected}" aria-label="${escape(ball.name)}. ${ball.selected ? 'Active ball.' : 'Select as active ball.'} ${ball.traits.map(trait => escape(trait.name)).join(', ')}" style="--skin:${ball.color}"><img src="${STARTER_PORTRAITS[ball.id]}" width="64" height="64" alt=""><span><span class="build-ball-label">0${ball.index + 1} / ${ball.selected ? 'ACTIVE' : 'RESERVE'}</span><b>${escape(ball.name)}</b><span class="build-traits">${ball.traits.map(trait => `<span style="--trait-color:${trait.color}" title="${escape(trait.desc)}">${escape(trait.name)}</span>`).join('') || '<span class="build-empty">No ball traits</span>'}</span></span></button>`).join('') || '<p class="build-empty">No ball bag loaded.</p>'}</div><section class="build-pins"><h3>PIN MIX <small>BASE CHANCES</small></h3><div class="build-chip-row">${build.pins.map((pin,index)=>`<span class="build-pin-chip" title="${escape(pin.label)} base chance ${pin.value}">${shopPinArt(['gold','explosive','implosive','bouncy'][index])}<span>${pin.label}<b>${pin.value}</b></span></span>`).join('')}</div></section><section class="build-shared"><h3>HOUSE GEAR <small>SHARED BY BOTH BALLS</small></h3><div class="build-chip-row">${chips(build.shared)}</div><span class="build-bumpers">◇ BUMPERS <b>${build.charges}</b> shared impacts</span></section><details class="build-effects"><summary>HOUSE GEAR & EFFECTS <b>${build.effects.length || '—'}</b></summary><div class="build-chip-row">${chips(build.shared)}${chips(build.effects)}${!build.effects.length ? '<span class="build-empty">No extra control or next-throw effects.</span>' : ''}</div><p>Pin mix shows base upgrades. Lane and daily rules can change the rack.</p></details>`;
}
// Quotes carry the explicit receiver and relevant state. A UI redraw, selected-
// ball change, reroll, price change or ownership change invalidates confirmation.
export function quoteBallTrait(game, item, cost, index) {
    const ball = game.ballLoadout?.balls[index];
    if (!item.traitId || !ball || ![0,1].includes(index)) return null;
    return { itemId:item.id, index, ballId:ball.id, cost, selected:game.ballLoadout.selected,
        purchases:game.upgradePurchases || 0, rerolls:game.shopRerolls || 0,
        traits:JSON.stringify(game.ballLoadout.balls.map(ball => ball.traits)) };
}
export function ballTraitEligibility(game, item, cost, quote) {
    if (game.mode !== 'roguelike' || game.state !== 'SHOP') return { canBuy:false, label:'Shop closed' };
    if (!quote) return { canBuy:false, label:'Choose a receiving ball' };
    const ball = game.ballLoadout?.balls[quote.index];
    if (![0,1].includes(quote.index) || !ball || quote.itemId !== item.id || ball.id !== quote.ballId || game.ballLoadout.selected !== quote.selected || cost !== quote.cost || (game.upgradePurchases || 0) !== quote.purchases || (game.shopRerolls || 0) !== quote.rerolls || JSON.stringify(game.ballLoadout.balls.map(ball => ball.traits)) !== quote.traits) return { canBuy:false, label:'Build changed. Choose your ball again.' };
    if (!(game.shopSelection || []).includes(item.id)) return { canBuy:false, label:'Offer no longer available' };
    if (ball.traits.includes(item.traitId)) return { canBuy:false, label:'Already fitted · max 1 per ball' };
    if (game.cash < cost) return { canBuy:false, label:`Need $${Math.ceil(cost - game.cash)} more` };
    return { canBuy:true, label:`Fit to ${STARTER_BALLS.find(starter => starter.id === ball.id)?.name} · $${cost}` };
}
export function receiverMarkup(game, item, cost, quote) {
    const build = buildSummary(game), trait = BALL_TRAITS[item.traitId];
    const eligibility = ballTraitEligibility(game,item,cost,quote);
    return `<div class="trait-receiver"><h3>CHOOSE THE RECEIVING BALL</h3><div class="receiver-balls" role="group" aria-label="Receiving ball">${build.balls.map(ball => `<button type="button" data-receive-ball="${ball.index}" aria-pressed="${quote?.index === ball.index}" style="--skin:${ball.color}"><img src="${STARTER_PORTRAITS[ball.id]}" width="80" height="80" alt=""><span><b>${escape(ball.name)}</b><small>${quote?.index === ball.index ? '✓ RECEIVING' : ball.traits.some(owned => owned.id === item.traitId) ? 'ALREADY FITTED' : 'AVAILABLE'}</small></span></button>`).join('')}</div><div class="trait-result" aria-live="polite">${quote ? (() => { const ball=build.balls[quote.index]; return `<strong class="trait-recipient">RECEIVING: ${escape(ball.name)} · SLOT 0${ball.index + 1}</strong><span>NOW</span><p>${ball.traits.map(trait=>escape(trait.name)).join(' + ') || 'No traits'}</p><span>AFTER FITTING</span><p>${ball.traits.some(owned=>owned.id===item.traitId) ? 'Already at maximum' : [...ball.traits.map(trait=>escape(trait.name)), `<b>${escape(trait.name)}</b>`].join(' + ')}</p>`; })() : '<p>Select a ball above. No recipient is chosen automatically.</p>'}</div><small>Permanent · max 1 copy of this trait per ball · the other ball stays unchanged.</small><button type="button" id="btn-confirm-ball-trait" ${eligibility.canBuy ? '' : 'disabled'}>${escape(eligibility.label)}</button></div>`;
}
