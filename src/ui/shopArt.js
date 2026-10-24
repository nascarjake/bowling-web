// The pro shop displays the effect first. Complete mechanics stay in Inspect.
const entry = (kind, color, value, label, summary, duration = 'THIS RUN') => ({ kind, color, value, label, summary, duration });
const RUN_GEAR = {
    ball_trait_drive: entry('core', '#71d9ff', '+1.8', 'ONE BALL / MASS', 'More carry on one chosen ball.'),
    ball_trait_focus: entry('tape', '#ffbd69', '+.012', 'ONE BALL / TIMING', 'A cleaner release on one chosen ball.'),
    ball_trait_pearl: entry('pearl', '#ef9bff', '+25%', 'ONE BALL / HOOK', 'A later, stronger finish on one chosen ball.'),
    ball_trait_anchor: entry('urethane', '#78edbc', '−45%', 'ONE BALL / MAW PULL', 'Resist black holes on one chosen ball.'),
    gold_pins: entry('gold', '#f2d079', '+10%', 'GOLD PIN CHANCE', 'More gold in every rack.'),
    explosive_pins: entry('explosive', '#ff9478', '+7%', 'TNT PIN CHANCE', 'Give nearby pins a blast.'),
    implosive_pins: entry('implosive', '#c5a1ff', '+7%', 'GRAVITY PIN CHANCE', 'Pull clusters together.'),
    heavy_ball: entry('core', '#86d9ed', '+2 LB', 'BALL WEIGHT', 'Drive deeper through the deck.'),
    steer_ball: entry('gyro', '#b6a4fa', '+STEER', 'MID-ROLL CONTROL', 'Guide the ball with A / D.'),
    big_ball: entry('titan', '#82dce5', '+8%', 'BALL SIZE', 'A bigger footprint on contact.'),
    extra_roll: entry('reserve', '#93e8c2', '+1', 'THROW / FRAME', 'One more chance every frame.'),
    bouncy_pins: entry('bouncy', '#91e1b1', '+10%', 'BOUNCY PIN CHANCE', 'More bounce. Messier carry.'),
    multiplier: entry('score', '#ffd58b', '+12%', 'PIN SCORE', 'Make every knockdown count.'),
    gutters: entry('guards', '#ffac87', '+3', 'SHARED IMPACT CHARGES', 'Either side spends one. Buy again to stack.'),
    thumb_tape: entry('tape', '#a5e6c6', '+TIMING', 'CLEAN RELEASE WINDOW', 'A little more room to hit gold.'),
    dampener_rings: entry('rings', '#e0bb82', 'SMOOTHER', 'SPECIAL PIN FORCES', 'Wider, calmer special-pin effects.'),
    lane_read: entry('notes', '#a7baf0', 'STEER +', 'TIMING ASSIST', 'Small corrections. Cleaner releases.'),
    hot_towel: entry('towel', '#ffb3b9', '+FOCUS', 'CLEAN RELEASE WINDOW', 'A generous timing boost.', 'NEXT THROW'),
    polished_ball: entry('polish', '#8fe4dd', '+2.5', 'LAUNCH SPEED', 'More speed on your next throw.', 'NEXT THROW'),
    oil_sponge: entry('sponge', '#95cded', 'STEER +', 'TIMING ASSIST', 'Find control on a slick lane.'),
    spare_chalk: entry('chalk', '#e9d7a9', '−3', 'TARGET PRESSURE', 'Lower targets, down to −8 total.'),
    soft_core: entry('core', '#c9b8f1', '+2 LB', 'CONTROLLED CORE', 'Extra weight. Calmer special effects.'),
    practice_frame: entry('ticket', '#f3c18c', 'FOCUS +', 'SPEED BOOST', 'A clutch boost for your next throw.', 'NEXT THROW'),
    house_heavy_ball: entry('core', '#9ed7e9', 'HEAVY', 'POCKET CARRY', 'Extra impact. A steadier roll.', 'NEXT THROW'),
    pearl_coverstock: entry('pearl', '#f0b7df', 'LATE SNAP', 'HOOK FINISH', 'Slide longer, then turn harder.', 'NEXT THROW'),
    urethane_read: entry('urethane', '#aab7f1', 'STEADIER', 'HOOK CONTROL', 'Less hook. More control.', 'NEXT THROW'),
    fresh_tape: entry('tape', '#bce7cf', '+FOCUS', 'TIMING WINDOW', 'A little room to hit the gold.', 'NEXT THROW'),
    speed_polish: entry('polish', '#ffbb89', '+SPEED', 'CASH +18%', 'Less hook. More speed and cash.', 'NEXT THROW')
};
const RACK_GEAR = {
    gold: entry('gold', '#f2d079', '+1', 'FRAME & BONUS SCORE', 'A gold pin in your next rack.', 'THIS RACK'),
    silver: entry('silver', '#bcd7e9', '+1', 'STRIKE / SPARE BONUS', 'Boost a previous strike or spare.', 'THIS RACK'),
    bouncy: entry('bouncy', '#91e1b1', 'BOUNCE', 'PIN CARRY', 'One springy pin for messy carry.', 'THIS RACK'),
    explosive: entry('explosive', '#ff9478', 'BLAST', 'AREA FORCE', 'Shake up the deck with one TNT pin.', 'THIS RACK'),
    implosive: entry('implosive', '#c5a1ff', 'PULL', 'CLUSTER CONTROL', 'Bring nearby pins into the action.', 'THIS RACK'),
    manual_rack: entry('rack', '#8fe5d3', 'YOU PICK', 'SPECIAL PIN POSITIONS', 'Place your bought pins on the rack.', 'NEXT FRAME')
};
const CLASSIC_ALIASES = { tenpin_heavy_ball: 'house_heavy_ball', tenpin_pearl_coverstock: 'pearl_coverstock', tenpin_urethane_read: 'urethane_read', tenpin_fresh_tape: 'fresh_tape', tenpin_speed_polish: 'speed_polish' };

export function shopVisual(item) {
    return RUN_GEAR[item.id] || RACK_GEAR[item.id] || RUN_GEAR[CLASSIC_ALIASES[item.id]] || entry('core', '#9fcedd', 'GEAR', 'HOUSE EQUIPMENT', 'A new tool for your next lane.');
}

export function shopOfferState({ cash, cost, soldOut = false, rackFull = false, ready = false, temporary = false }) {
    if (soldOut) return { canBuy: false, label: temporary ? 'PACKED' : 'INSTALLED', state: 'owned' };
    if (ready) return { canBuy: false, label: 'READY', state: 'owned' };
    if (rackFull) return { canBuy: false, label: 'RACK FULL', state: 'full' };
    if (cash < cost) return { canBuy: false, label: `NEED $${Math.ceil(cost - cash)}`, state: 'short' };
    return { canBuy: true, label: temporary ? 'PACK IT' : 'INSTALL', state: 'available' };
}

const ink = '#101a2a';
function pinBody(color, kind = 'standard') {
    const band = kind === 'standard' ? '#ed8b88' : ink;
    const symbol = kind === 'gold' || kind === 'silver'
        ? `<path d="m0 9 5 9 10 2-7 7 1 10-9-4-9 4 1-10-7-7 10-2Z" fill="${ink}"/>`
        : kind === 'explosive' ? `<path d="m0 9 4 10 11-6-6 12 10 4-12 3 4 11-11-6-5 10-2-12-11 4 6-10-10-5 12-2-5-11 11 5Z" fill="${ink}"/>`
        : kind === 'implosive' ? `<ellipse cy="28" rx="22" ry="8" transform="rotate(-25)" fill="none" stroke="${ink}" stroke-width="3"/><circle cy="28" r="8" fill="${ink}"/>`
        : kind === 'bouncy' ? `<path d="m-13 36 8-13 8 13 10-13" fill="none" stroke="${ink}" stroke-width="4"/>` : '';
    return `<path d="M0-71c-12 0-17 9-14 22l4 18c2 12-1 19-9 34-9 16-19 36-15 54 4 17 18 23 34 23s30-6 34-23c4-18-6-38-15-54-8-15-11-22-9-34l4-18c3-13-2-22-14-22Z" fill="${color}" stroke="${ink}" stroke-width="5"/><path d="M-13-35h26M-12-25h24" stroke="${band}" stroke-width="5"/><path d="M-6-59c-5 9-1 19 0 26M-22 14c-10 23-8 38-1 45" fill="none" stroke="#fff8dd" stroke-opacity=".52" stroke-width="4" stroke-linecap="round"/>${symbol}`;
}

export function shopPinArt(kind = 'standard') {
    const colors = { gold: '#efca75', silver: '#bbd4df', bouncy: '#93d9aa', explosive: '#f69b82', implosive: '#bc9ee7', standard: '#f5e6ca' };
    return `<svg viewBox="0 0 100 175" aria-hidden="true" class="shop-pin-art"><g transform="translate(50 82)">${pinBody(colors[kind] || colors.standard, kind)}</g></svg>`;
}

function ball(color, core = false) {
    return `<circle r="61" fill="${ink}" stroke="${color}" stroke-width="4"/><path d="M-42-40q65-27 78 30T-25 48M-53-8q51-49 93-14M-48 30q54-34 101-3" fill="none" stroke="${color}" stroke-width="11" stroke-opacity=".75"/><path d="M-39-36q10-10 21-12" fill="none" stroke="#f9e9c5" stroke-opacity=".8" stroke-width="6" stroke-linecap="round"/><circle cx="-12" cy="-31" r="5" fill="${ink}"/><circle cx="1" cy="-28" r="5" fill="${ink}"/><circle cx="-9" cy="-15" r="6" fill="${ink}"/>${core ? `<path d="M0-56a56 56 0 0 1 0 112Z" fill="${color}"/><path d="m7-33 29 16v34L7 34Z" fill="${ink}"/><path d="m12-22 15 9v25l-15 10Z" fill="#f2c584"/>` : ''}`;
}

export function shopArtwork(item) {
    const { kind, color } = shopVisual(item);
    let object = '';
    if (['gold', 'silver', 'explosive', 'implosive', 'bouncy'].includes(kind)) {
        object = `<g transform="translate(160 108) scale(.86)">${pinBody(color, kind)}</g>`;
        if (kind === 'implosive') object += `<ellipse cx="160" cy="129" rx="83" ry="24" transform="rotate(-15 160 129)" fill="none" stroke="${color}" stroke-width="2" stroke-dasharray="4 7"/>`;
        if (kind === 'explosive') object += `<path d="m105 74-18-13m126 10 18-18M94 133l-20 4m148-8 19 9" stroke="${color}" stroke-width="4"/>`;
        if (kind === 'bouncy') object += `<path d="M94 137q-20-55 0-66l-8 1m8-1 3 9m128 57q20-55 0-66l8 1m-8-1-3 9" fill="none" stroke="${color}" stroke-width="3"/>`;
    } else if (['core', 'titan', 'pearl', 'urethane', 'reserve', 'gyro'].includes(kind)) {
        object = `<g transform="translate(160 111)">${ball(color, kind === 'core')}</g>`;
        if (kind === 'gyro') object += `<ellipse cx="160" cy="111" rx="95" ry="29" transform="rotate(-24 160 111)" fill="none" stroke="${color}" stroke-width="3"/><circle cx="246" cy="77" r="8" fill="${color}" stroke="${ink}" stroke-width="3"/>`;
        if (kind === 'titan') object += `<path d="M78 60v-15h18m-18 0 25 23m139 87v15h-18m18 0-25-23" fill="none" stroke="${color}" stroke-width="4"/>`;
        if (kind === 'reserve') object = `<g transform="translate(203 103) scale(.72)" opacity=".65">${ball(color)}</g><g transform="translate(128 125) scale(.79)">${ball(color)}</g><path d="M247 145v32m-16-16h32" stroke="${color}" stroke-width="6"/>`;
        if (kind === 'pearl' || kind === 'urethane') object += `<path d="M74 164q-17-73 27-112m-16 0h16v16" fill="none" stroke="${color}" stroke-width="3" stroke-dasharray="5 5"/>`;
    } else if (kind === 'tape' || kind === 'rings') {
        object = `<g transform="translate(155 105)"><ellipse rx="63" ry="48" fill="${color}" stroke="${ink}" stroke-width="5"/><ellipse rx="31" ry="25" fill="${ink}"/><path d="M-63 0v30q0 47 63 48t63-48V0q0 48-63 48T-63 0Z" fill="${color}" stroke="${ink}" stroke-width="5"/><path d="M-53 36q24 28 78 16" stroke="#fff5d6" stroke-opacity=".55" stroke-width="4" fill="none"/></g>`;
        if (kind === 'tape') object += `<path d="m205 114 23 36-24 32-35-25 24-18Z" fill="${color}" stroke="${ink}" stroke-width="4"/>`;
        if (kind === 'rings') object += `<ellipse cx="155" cy="162" rx="66" ry="23" fill="none" stroke="${color}" stroke-width="5"/>`;
    } else if (kind === 'polish') {
        object = `<path d="M129 81h62v88q-31 14-62 0Z" fill="${color}" stroke="${ink}" stroke-width="5"/><path d="M137 54h46v27h-46Z" fill="${ink}" stroke="${color}" stroke-width="3"/><path d="M149 42h22v12h-22Z" fill="${color}"/><path d="M173 44h22m7-1 17-7m-17 12 22 4m-18 2 12 13" stroke="${color}" stroke-width="3"/><path d="m160 106 8 17 17 3-12 13 2 18-15-9-15 9 2-18-12-13 17-3Z" fill="${ink}"/>`;
    } else if (kind === 'sponge') {
        object = `<path d="m98 90 86-27 40 40-86 31Z" fill="#e6cd91" stroke="${ink}" stroke-width="5"/><path d="m98 90 40 44v43l-40-42Zm40 44 86-31v43l-86 31Z" fill="${color}" stroke="${ink}" stroke-width="5"/><g fill="${ink}" opacity=".45"><circle cx="148" cy="92" r="6"/><circle cx="182" cy="85" r="4"/><circle cx="178" cy="113" r="5"/><circle cx="156" cy="151" r="4"/><circle cx="206" cy="138" r="4"/></g><path d="M227 43c-4 10-14 18-14 26a14 14 0 0 0 28 0c0-8-10-16-14-26Z" fill="${color}"/>`;
    } else if (kind === 'notes' || kind === 'chalk') {
        object = `<path d="m113 58 99 11-17 121-99-11Z" fill="#dfd3ac" stroke="${ink}" stroke-width="5"/><path d="m128 90 62 7m-65 13 62 7m-65 13 62 7m-65 13 40 5" stroke="${ink}" stroke-opacity=".35" stroke-width="3"/><path d="m121 162 17-20 19 7 25-43m-10 6 10-6 2 11" fill="none" stroke="${ink}" stroke-width="4"/><path d="m206 121 12 5-27 57-13 4 2-14Z" fill="${color}" stroke="${ink}" stroke-width="4"/>`;
    } else if (kind === 'towel') {
        object = `<path d="m99 102 99-14 25 67-98 20Z" fill="${color}" stroke="${ink}" stroke-width="5"/><path d="m110 116 77-12 20 47-77 17Z" fill="none" stroke="#fff0d5" stroke-opacity=".5" stroke-width="3"/><path d="M125 76q-17-12 0-26m34 25q-17-12 0-26m34 25q-17-12 0-26" fill="none" stroke="${color}" stroke-width="3"/>`;
    } else if (kind === 'ticket') {
        object = `<path d="m80 103 138-32 14 37q-18 5-12 20l10 13-131 39-12-36q18-6 10-21Z" fill="${color}" stroke="${ink}" stroke-width="5"/><path d="m180 84 28 67" stroke="${ink}" stroke-width="3" stroke-dasharray="4 5"/><path d="m143 104 9 12 15-1-9 14 5 15-16-5-13 9-1-17-12-10 16-4Z" fill="${ink}"/>`;
    } else if (kind === 'guards' || kind === 'rack') {
        object = `<path d="m81 155 79-98 80 98-80 33Z" fill="${ink}" stroke="${color}" stroke-width="3"/><path d="m101 151 59-73 60 73-60 25Z" fill="#b58c60"/><path d="m82 141 68-83m22 0 67 83" stroke="${color}" stroke-width="11"/>`;
        if (kind === 'rack') for (let row = 0; row < 3; row++) for (let col = 0; col <= row; col++) object += `<circle cx="${160+(col-row/2)*22}" cy="${103+row*21}" r="8" fill="${row === 2 ? color : '#f7e8c8'}" stroke="${ink}" stroke-width="2"/>`;
        else object += `<circle cx="160" cy="151" r="15" fill="${color}" stroke="${ink}" stroke-width="3"/><path d="M159 126V89m-9 10 10-10 10 10" fill="none" stroke="${color}" stroke-width="3"/>`;
    } else {
        object = `<path d="M86 65h148v109H86Z" fill="${ink}" stroke="${color}" stroke-width="4"/><path d="M94 73h132v33H94Z" fill="${color}"/><text x="160" y="96" text-anchor="middle" font-size="25" font-family="monospace" fill="${ink}">PIN SCORE</text><text x="160" y="154" text-anchor="middle" font-size="42" font-family="monospace" fill="${color}">×1.12</text>`;
    }
    return `<svg viewBox="0 0 320 220" aria-hidden="true" class="gear-art"><circle cx="160" cy="112" r="85" fill="${color}" opacity=".045"/><circle cx="160" cy="112" r="91" fill="none" stroke="${color}" stroke-opacity=".18" stroke-dasharray="2 10"/><path d="m61 180 99-27 99 27-99 27Z" fill="${ink}" stroke="${color}" stroke-opacity=".22"/><ellipse cx="160" cy="182" rx="66" ry="10" fill="#040a12" opacity=".6"/>${object}<path d="M66 64h12m-6-6v12m168 92h10m-5-5v10" stroke="${color}" stroke-width="2"/></svg>`;
}
