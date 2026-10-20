import { shopArtwork } from './shopArt.js?v=20261019h';

const reward = (value, label, duration = 'THIS RUN') => ({ value, label, duration });
const EVENTS = {
    bookie: { color: '#ffd27d', tag: 'A DEAL WITH THE HOUSE', line: 'Easy money. Interesting consequences.', scene: 'bookie' },
    mechanic: { color: '#8ce7dc', tag: 'UNDER THE HOOD', line: 'A little tuning. A very different roll.', scene: 'mechanic' },
    league_night: { color: '#b5a0ff', tag: 'HOUSE REGULARS', line: 'The regulars have your back.', scene: 'league' },
    lost_ball_return: { color: '#90ccea', tag: 'FINDERS KEEPERS', line: 'One old ball. Two good opportunities.', scene: 'return' },
    pinsetter_jam: { color: '#ffac87', tag: 'TECHNICAL DIFFICULTIES', line: 'The machine has a mind of its own.', scene: 'machine' },
    snack_bar: { color: '#f5a7cc', tag: 'TAKE FIVE', line: 'A little break can change your game.', scene: 'snack' },
    counterfeit_pins: { color: '#efcd83', tag: 'SPECIAL DELIVERY', line: 'Fresh stock. Questionable origins.', scene: 'crate' }
};
export const EVENT_IDS = Object.keys(EVENTS);
export function eventVisual(id) { return EVENTS[id] || EVENTS.bookie; }
export function eventChoiceVisual(id, index, context = {}) {
    const cash = Math.max(0, context.cash || 0);
    const targetTax = context.targetTax || 0;
    const choices = {
        bookie: [
            { art: 'cash', gains: [reward('+18', 'PIN DOLLARS', 'RIGHT NOW')], trade: '+4 TO FUTURE TARGETS', note: 'Cash now. Tougher frames ahead.' },
            { art: 'thumb_tape', gains: [reward('+1.4%', 'TIMING WINDOW')], trade: `PAY $${Math.min(6, cash)}`, note: 'The bookie takes up to $6 of your cash.' }
        ],
        mechanic: [
            { art: 'polished_ball', gains: [reward('+2', 'LAUNCH SPEED', 'NEXT THROW'), reward('+2%', 'FOCUS WINDOW', 'NEXT THROW')], note: 'One throw with a little extra fire.' },
            { art: 'dampener_rings', gains: [reward('+16%', 'SPECIAL PIN CONTROL')], note: 'Smoother, wider special-pin forces.' }
        ],
        league_night: [
            { art: 'gutters', gains: [reward('GUARDS', 'GUTTER PROTECTION', 'NEXT FRAME'), reward('+4', 'PIN DOLLARS', 'RIGHT NOW')], note: 'Keep the next frame on the lane.' },
            { art: 'steer_ball', gains: [reward('+0.65', 'STEERING POWER')], note: 'Guide your roll with A / D or the arrows.' }
        ],
        lost_ball_return: [
            { art: 'heavy_ball', gains: [reward('+1.2 LB', 'BALL WEIGHT'), reward(targetTax <= -10 ? 'AT MIN' : `−${targetTax - Math.max(-10, targetTax - 2)}`, 'FUTURE TARGETS')], note: 'Target relief stops at −10 total.' },
            { art: 'cash', gains: [reward('+12', 'PIN DOLLARS', 'RIGHT NOW')], note: 'Leave the ball. Take the cash.' }
        ],
        pinsetter_jam: [
            { art: 'fresh_tape', gains: [reward('+1.2%', 'TIMING WINDOW')], trade: '+2 TO FUTURE TARGETS', note: 'A cleaner release, with a little pressure.' },
            { art: 'dampener_rings', gains: [reward('+10%', 'SPECIAL PIN CONTROL'), reward('+6', 'PIN DOLLARS', 'RIGHT NOW')], note: 'Calmer special-pin forces. Cash on top.' }
        ],
        snack_bar: [
            { art: 'hot_towel', gains: [reward('+1%', 'TIMING WINDOW')], note: 'Keep the timing cushion all run.' },
            { art: 'cash', gains: [reward('+8', 'PIN DOLLARS', 'RIGHT NOW'), reward('+1.8%', 'FOCUS WINDOW', 'NEXT THROW')], note: 'A pocketful of change and fresh focus.' }
        ],
        counterfeit_pins: [
            { art: 'gold_pins', gains: [reward('×2', 'GOLD PIN CASH')], note: 'Double the current payout of every gold pin.' },
            { art: 'explosive_pins', gains: [reward('OFF', 'TNT EXPLOSIONS')], trade: '−$1 PER FALLEN TNT PIN', note: 'Stop the blasts. Pay for every fallen TNT pin.' }
        ]
    };
    return choices[id]?.[index] || null;
}

export const RELIC_VISUALS = {
    last_frame_token: { art: 'practice_frame', value: '+1 SAVE', label: 'EMERGENCY THROW', desc: 'Miss a target? Take one extra roll.', duration: 'ONCE PER RUN' },
    house_float: { art: 'cash', value: '+$3', label: 'STARTING CASH', desc: 'A head start at the pro shop.', duration: 'RUN START' },
    warmup_lane: { art: 'extra_roll', value: '+1 ROLL', label: 'FRAME ONE', desc: 'An extra shot to find your line.', duration: 'FIRST FRAME' },
    reroll_coupon: { art: 'practice_frame', value: 'FREE', label: 'FIRST SHOP REROLL', desc: 'One fresh shelf, on the house.', duration: 'ONCE PER RUN' }
};

export function cabinetArt(kind, color = '#ffd27d') {
    if (kind !== 'cash' && kind !== 'trophy' && kind !== 'record' && kind !== 'locked') return shopArtwork({ id: kind });
    const ink = '#170e29';
    const object = kind === 'cash' ? `<g fill="${color}" stroke="${ink}" stroke-width="5"><path d="M84 146v24c0 28 96 28 96 0v-24Z"/><ellipse cx="132" cy="146" rx="48" ry="17"/><path d="M149 112v24c0 28 92 28 92 0v-24Z"/><ellipse cx="195" cy="112" rx="46" ry="17"/><circle cx="143" cy="93" r="44"/></g><path d="M143 68v49m13-39c-30-16-42 19-14 16 26-3 13 31-14 15" fill="none" stroke="${ink}" stroke-width="6"/>`
        : kind === 'trophy' ? `<path d="M122 45h76l-6 72q-32 39-64 0Zm6 9H97v25q0 32 32 35m64-60h30v25q0 32-32 35M160 137v30m-33 14h66" fill="none" stroke="${color}" stroke-width="13"/><path d="m160 64 7 14 16 2-12 12 3 17-14-8-14 8 3-17-12-12 16-2Z" fill="${color}"/>`
        : kind === 'locked' ? `<path d="M125 97V75a35 35 0 0 1 70 0v22M112 97h96v81h-96Z" fill="none" stroke="${color}" stroke-width="7"/><circle cx="160" cy="129" r="11" fill="${color}"/><path d="M160 139v18" stroke="${color}" stroke-width="7"/>`
        : `<path d="M87 51h146v132H87Z" fill="${ink}" stroke="${color}" stroke-width="5"/><path d="M87 87h146m-99-36v132m49-132v132" stroke="${color}" stroke-width="3"/><path d="m99 65 20 12m0-12-20 12m49 35 18 12m0-12-18 12m34 21 34-34" stroke="${color}" stroke-width="4"/>`;
    return `<svg viewBox="0 0 320 220" aria-hidden="true"><circle cx="160" cy="111" r="94" fill="${color}" opacity=".06"/><path d="m62 185 98-26 98 26-98 22Z" fill="${ink}" stroke="${color}" stroke-opacity=".3"/>${object}<path d="M69 76h14m-7-7v14m167 76h12m-6-6v12" stroke="${color}" stroke-width="2"/></svg>`;
}

export function eventSceneArt(id) {
    const { color, scene } = eventVisual(id);
    const ink = '#180d2c', gold = '#ffd27d';
    const pin = `<path d="M0-24c8 0 9 6 6 17-2 8 10 17 10 30 0 15-32 15-32 0 0-13 12-22 10-30-3-11-2-17 6-17Z" fill="#f7e6c4" stroke="${ink}" stroke-width="3"/><path d="M-6-4H6M-6 2H6" stroke="#f08a97" stroke-width="3"/>`;
    const orb = `<circle r="40" fill="#7141ba" stroke="#c08aff" stroke-width="4"/><path d="M-31-14q47-35 60 17M-31 14q41-23 62 8" stroke="#bc88fa" stroke-width="7" fill="none"/><g fill="${ink}"><circle cx="-7" cy="-19" r="5"/><circle cx="5" cy="-17" r="5"/><circle cy="-4" r="6"/></g>`;
    let object;
    if (scene === 'bookie') object = `<path d="m81 85 97-14 13 124-97 14Z" fill="#e2c498" stroke="${ink}" stroke-width="6"/><path d="m101 111 57-8m-55 27 57-8m-54 29 35-6" stroke="#725378" stroke-width="5"/><path d="m181 81 14 3-29 90-17 10 1-20Z" fill="${color}" stroke="${ink}" stroke-width="4"/><g fill="${gold}" stroke="${ink}" stroke-width="4"><ellipse cx="229" cy="189" rx="37" ry="14"/><ellipse cx="229" cy="178" rx="37" ry="14"/><circle cx="221" cy="133" r="32"/></g><path d="M221 115v36m-11-27h20m-20 18h20" stroke="${ink}" stroke-width="4"/>`;
    if (scene === 'mechanic') object = `<g transform="translate(132 148)">${orb}</g><path d="m226 68-17 25 14 15 25-12c7 22-2 38-24 39l-41 53-15-12 40-56c-12-17-7-42 18-52Z" fill="${color}" stroke="${ink}" stroke-width="5"/><path d="m83 82-8-9m81-14 3-13m91 117 15 3" stroke="${gold}" stroke-width="4"/>`;
    if (scene === 'league') object = `<path d="M123 66h74l-8 63q-29 36-58 0Zm6 11H99v24q0 27 32 29m60-53h30v24q0 27-32 29M160 147v33m-31 11h62" fill="none" stroke="${gold}" stroke-width="10"/><g transform="translate(86 169) scale(.75)">${pin}</g><g transform="translate(238 169) scale(.75)">${pin}</g><path d="m160 81 6 13 15 2-11 10 3 14-13-7-13 7 3-14-11-10 15-2Z" fill="${color}"/>`;
    if (scene === 'return') object = `<path d="M75 139h171v61H75Z" fill="#382249" stroke="${color}" stroke-width="4"/><path d="M88 140h145v25H88Z" fill="${ink}"/><path d="M95 184h130" stroke="${gold}" stroke-width="5" stroke-dasharray="11 10"/><g transform="translate(162 116)">${orb}</g><path d="M219 71h30v40m-8-10 8 10 8-10" fill="none" stroke="${color}" stroke-width="4"/>`;
    if (scene === 'machine') object = `<path d="M73 65h174v51H73Z" fill="#382249" stroke="${color}" stroke-width="4"/><path d="M85 116v81m150-81v81" stroke="${color}" stroke-width="9"/><path d="M95 132h130" stroke="${gold}" stroke-width="4"/><g transform="translate(125 164) scale(.6)">${pin}</g><g transform="translate(161 164) scale(.6)">${pin}</g><g transform="translate(197 164) scale(.6)">${pin}</g><path d="m152 72-8 14 13 6-7 14 23-22-14-4 6-8Z" fill="${gold}"/>`;
    if (scene === 'snack') object = `<path d="m173 101 10 97h57l10-97Z" fill="${color}" stroke="${ink}" stroke-width="5"/><ellipse cx="211" cy="101" rx="39" ry="10" fill="#f2d0db" stroke="${ink}" stroke-width="4"/><path d="m216 101 8-52 24-11" fill="none" stroke="${gold}" stroke-width="6"/><path d="m95 125 61-15-10 78-44 9Z" fill="${gold}" stroke="${ink}" stroke-width="5"/><path d="m108 112 1-31m12 29 8-34m6 33 11-29" stroke="${gold}" stroke-width="8"/><path d="M76 208h184" stroke="${color}" stroke-width="4"/>`;
    if (scene === 'crate') object = `<path d="m85 132 73-26 79 26v66l-77 23-75-23Z" fill="#8f603e" stroke="${ink}" stroke-width="5"/><g transform="translate(129 112) rotate(-12)">${pin}</g><g transform="translate(183 109) rotate(15)">${pin}</g><path d="m85 143 75 24 77-24v55l-77 23-75-23Z" fill="#b47b49" stroke="${ink}" stroke-width="5"/><path d="M160 167v54m-62-51 48 15m29 1 47-15" stroke="${ink}" stroke-width="4"/><path d="m152 180 9-5 10 6-3 13-12 1Z" fill="${gold}"/>`;
    return `<svg viewBox="0 0 320 260" aria-hidden="true"><defs><radialGradient id="event-${id}-glow"><stop stop-color="${color}" stop-opacity=".17"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient></defs><circle cx="160" cy="136" r="123" fill="url(#event-${id}-glow)"/><path d="M41 210h238M57 227h206" stroke="${color}" stroke-opacity=".2"/><ellipse cx="160" cy="215" rx="109" ry="17" fill="#090611" opacity=".65"/>${object}<path d="M63 115h10m-5-5v10m186 5h12m-6-6v12M102 49h7m-4-4v8" stroke="${color}" stroke-width="2"/></svg>`;
}
