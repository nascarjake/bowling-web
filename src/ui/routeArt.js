// Shared visual language for the circuit, boss reveals, and arena signage.
// SVG artwork stays crisp at every screen size and needs no extra downloads.
export const DISTRICTS = [
    { name: 'Neon Social', tag: 'THE HOUSE IS OPEN', color: '#72efd2', secondary: '#f7b76a', dark: '#12343c', note: 'Find your line. Wake the house.' },
    { name: 'Midnight Works', tag: 'AFTER HOURS. NO MERCY.', color: '#fb946d', secondary: '#f4cf75', dark: '#37272e', note: 'Hot lanes. Heavy timber. Keep rolling.' },
    { name: 'Crown District', tag: 'ONE SHOT AT THE CROWN', color: '#c8a1ff', secondary: '#ffe098', dark: '#292448', note: 'The widest racks. The final showdown.' }
];

export function districtForStage(stage = 1) {
    return DISTRICTS[Math.max(0, Math.min(2, Math.floor(stage) - 1))];
}

export function routeTheme(route = {}) {
    const id = route.id || '';
    if (id.includes('gravity')) return { color: '#c6a0ff', dark: '#32264c', motif: 'gravity', title: 'BEND THE HOUSE' };
    if (id.includes('bomb') || route.layout === 'fragile') return { color: '#ff9275', dark: '#422734', motif: 'blast', title: 'CONTROL THE CHAOS' };
    if (id.includes('oil')) return { color: '#78cbff', dark: '#18344a', motif: 'oil', title: 'FIND THE FRICTION' };
    if (id.includes('gutter')) return { color: '#ff7b98', dark: '#452234', motif: 'maw', title: 'STAY OUT OF THE TEETH' };
    if (route.layout === 'split') return { color: '#9cefc9', dark: '#193b39', motif: 'split', title: 'DIVIDE AND CONQUER' };
    if (route.layout === 'heavy') return { color: '#f3c777', dark: '#403126', motif: 'heavy', title: 'HIT LIKE A HAMMER' };
    if (route.layout === 'wide') return { color: '#71e9e0', dark: '#193c43', motif: 'wide', title: 'GO BIG. BOWL BOLD.' };
    if (route.boss) return { color: '#ffdf8d', dark: '#3e2e3f', motif: 'crown', title: 'TAKE THE CROWN' };
    if (route.event) return { color: '#d5a7ff', dark: '#322748', motif: 'event', title: 'A STRANGE DETOUR' };
    return { color: '#f3d392', dark: '#313136', motif: route.layout === 'messy' ? 'messy' : 'house', title: 'MAKE SOME NOISE' };
}

export function routeNodePosition(node, portrait = false) {
    const column = (node.frame - 1) % 4;
    const branch = node.frame % 4 === 0 || node.frame === 1 ? 50 : [22, 50, 78][node.index] ?? 50;
    const progress = [12, 36, 60, 86][column];
    return portrait ? { x: branch, y: progress } : { x: progress, y: branch };
}

export function stageConnections(rows, stage) {
    const start = (stage - 1) * 4;
    const links = [];
    for (let i = start; i < Math.min(start + 3, rows.length - 1); i++) {
        for (const from of rows[i]) for (const to of rows[i + 1]) links.push({ from, to });
    }
    return links;
}

function pin(x, y, size = 1, color = '#fff4d7') {
    return `<g transform="translate(${x} ${y}) scale(${size})"><path d="M0-19C-5-19-6-14-4-9L-3-5C-3-1-9 5-8 11Q-7 17 0 17T8 11C9 5 3-1 3-5L4-9C6-14 5-19 0-19Z" fill="${color}" stroke="#111b2b" stroke-width="2"/><path d="M-4-7H4M-4-3H4" stroke="#f2757a" stroke-width="2.4"/></g>`;
}

export function bossEmblem(route = {}) {
    const { color, dark, motif } = routeTheme(route);
    let face = '<path d="m70 97 7-47 36 26 37-45 37 45 36-26 7 47-18 62H88Z" fill="'+color+'"/><path d="M94 169h112v19H94Z" fill="'+color+'"/><path d="m109 119 17 7m65-7-17 7" stroke="#101827" stroke-width="9"/><path d="m137 150 13-10 13 10" fill="none" stroke="#101827" stroke-width="7"/>';
    if (motif === 'blast') face = '<circle cx="150" cy="134" r="64" fill="'+color+'"/><path d="m151 69 13-25 27 3 10-21m-19 2 24 8m-9-22 5 28" fill="none" stroke="'+color+'" stroke-width="9"/><path d="m110 118 24 12m56-12-24 12" stroke="#101827" stroke-width="9"/><path d="m124 158 13-10 13 10 13-10 13 10" fill="none" stroke="#101827" stroke-width="7"/>';
    if (motif === 'gravity' || motif === 'oil') face = `<path d="M150 39c-14 35-66 66-66 111a66 66 0 0 0 132 0c0-45-52-76-66-111Z" fill="${color}"/><path d="M110 139q40-45 80 0-40 45-80 0Z" fill="${dark}"/><ellipse cx="150" cy="139" rx="12" ry="23" fill="${color}"/><path d="M123 179q27 16 54 0" stroke="${dark}" stroke-width="7" fill="none"/>`;
    if (motif === 'gravity') face = `<ellipse cx="150" cy="132" rx="104" ry="40" transform="rotate(-28 150 132)" fill="none" stroke="${color}" stroke-width="8"/><circle cx="150" cy="132" r="65" fill="${color}" stroke="${dark}" stroke-width="9"/><path d="M106 132q44-48 88 0-44 48-88 0Z" fill="${dark}"/><ellipse cx="150" cy="132" rx="11" ry="24" fill="${color}"/><path d="m150 49 9-16-9-16-9 16m0 182 9 16 9-16-9-16" fill="${color}"/>`;
    if (motif === 'maw') face = `<path d="m74 79 35-30 41 20 41-20 35 30-6 87-70 43-70-43Z" fill="${color}"/><path d="m99 105 31 13m71-13-31 13" stroke="#111b2b" stroke-width="10"/><path d="M100 140h100l-17 41h-66Z" fill="#111b2b"/><path d="m113 141 9 18 10-18m35 0 10 18 9-18m-56 40 10-18 10 18 10-18 10 18" fill="${color}"/>`;
    return `<svg viewBox="0 0 300 260" aria-hidden="true" class="boss-emblem"><path d="m150 8 31 40 49-8 3 49 43 25-28 40 10 48-49 7-29 39-42-25-48 14-14-47-41-22 23-43-6-49 48-7Z" fill="${dark}" stroke="${color}" stroke-width="2"/><circle cx="150" cy="130" r="100" fill="none" stroke="${color}" stroke-opacity=".26" stroke-width="12" stroke-dasharray="2 12"/><path d="M20 130h28m204 0h28M150 0v22m0 217v21" stroke="${color}" stroke-width="3"/>${face}<path d="m45 30 4 9 10 4-10 4-4 9-4-9-10-4 10-4m204 150 3 7 8 3-8 3-3 7-3-7-8-3 8-3" fill="${color}"/></svg>`;
}

export function laneArtwork(route = {}) {
    const { color, dark, motif } = routeTheme(route);
    if (route.boss) return bossEmblem(route);
    const split = motif === 'split';
    let pins = '';
    for (let row = 2; row >= 0; row--) for (let col = 0; col <= row; col++) {
        const x = 182 + (motif === 'messy' ? Math.sin(col * 5 + row) * 8 : 0) + (col - row / 2) * 18 + (split ? (col >= row / 2 ? 21 : -21) : 0);
        pins += pin(x, 80 + row * 9, .6, motif === 'heavy' ? '#e6b86b' : motif === 'blast' && col === row ? '#ff8c6c' : '#fff1d8');
    }
    const oil = motif === 'oil' ? '<path d="m149 101 69 0-70 58H72Z" fill="#65d6e9" opacity=".4"/><path d="m104 146 59-35m-37 42 59-35" stroke="#a6efff" opacity=".5"/>' : '';
    const stampPaths = {
        house: '<path d="m-10 1 10-10 10 10v10h-7V4h-6v7h-7Z"/>',
        oil: '<path d="M0-12c-3 7-10 12-10 17a10 10 0 0 0 20 0c0-5-7-10-10-17Z"/>',
        split: '<path d="M-3 12V0L-13-9l5-5L0-6l8-8 5 5L3 0v12Z"/>',
        wide: '<path d="m-17 0 9-9v6H8v-6l9 9-9 9V3H-8v6Z"/>',
        heavy: '<path d="M-11-6h22l4 20h-30Z"/><path d="M-5-6v-6H5v6" fill="none" stroke="currentColor" stroke-width="4"/>',
        blast: '<path d="m0-16 4 10 12-6-6 12 10 4-12 4 4 12-12-6-5 10-3-12-12 5 6-12-10-5 12-2-4-12 11 6Z"/>',
        maw: '<path d="M-13-9h26v18H-13Z"/><path d="m-8-9 4 9 4-9 4 9 4-9" fill="#101b2a"/>',
        messy: '<path d="m-11-9 7 4-4 7 6 5-7 6-6-7 5-7-6-4Zm16-4 8 6-4 8 6 8-8 4-5-8 3-8-6-4Z"/>'
    };
    const stamp = motif !== 'event' ? `<g transform="translate(284 42)" style="color:${color}"><path d="m0-23 20 12v23L0 24-20 12v-23Z" fill="${dark}" stroke="${color}" stroke-width="1.5"/><g fill="${color}" transform="scale(.72)">${stampPaths[motif] || stampPaths.house}</g></g>` : '';
    const detail = motif === 'event'  ? '<path d="m180 55 14 24 28 5-19 20 4 28-27-12-26 12 4-28-19-20 28-5Z" fill="#d5a7ff"/><text x="180" y="110" font-size="42" fill="#23223c" font-family="monospace" text-anchor="middle">?</text>' : pins;
    return `<svg viewBox="0 0 360 210" aria-hidden="true" class="lane-artwork"><ellipse cx="180" cy="178" rx="141" ry="16" fill="#040a13" opacity=".6"/><path d="m43 153 127-99 150 37-128 107Z" fill="#090f1c" stroke="${color}" stroke-opacity=".4"/><path d="m43 153 149 45v-14L43 140Z" fill="${dark}"/><path d="m192 184 128-107v14L192 198Z" fill="#0c1827"/><path d="m62 140 111-82 126 29-111 95Z" fill="#9b684e"/><path d="m74 139 103-76 107 25-100 86Z" fill="#c49964"/><path d="m100 149 105-80m-80 87 103-81m-77 89 100-84m-77 91 100-84" stroke="#725744" stroke-width="1.2" opacity=".65"/>${oil}<path d="m61 138 111-82m18 125 111-93" fill="none" stroke="${color}" stroke-width="3"/><path d="m149 72 15-25 121 29v23Z" fill="${dark}" stroke="${color}" stroke-width="1.5"/><path d="m174 56 73 18" stroke="${color}" stroke-width="3"/>${detail}${stamp}<circle cx="117" cy="142" r="18" fill="${dark}" stroke="${color}" stroke-width="2"/><path d="M105 137q14-16 25 3m-22 9q17-12 23-3" fill="none" stroke="${color}" stroke-width="4"/><circle cx="116" cy="130" r="2.5" fill="#080e19"/><circle cx="121" cy="134" r="2.5" fill="#080e19"/><path d="m36 78 9-9m272 77 9-9M88 43l6 6" stroke="${color}" stroke-width="2"/></svg>`;
}

export function districtBackdrop(stage) {
    const district = districtForStage(stage);
    let buildings = '';
    for (let i = 0; i < 18; i++) {
        const height = 35 + (i * 47 % 118), x = i * 63 - 35;
        buildings += `<path d="M${x} 254v-${height}h46v${height}" fill="${district.dark}"/><path d="M${x+8} ${264-height}h25m-25 14h25" stroke="${district.color}" stroke-opacity=".13" stroke-width="3"/>`;
    }
    let grid = '';
    for (let i = -4; i < 14; i++) grid += `<path d="M500 242  ${i*120} 600"/>`;
    for (const y of [277,312,359,423,514,599]) grid += `<path d="M0 ${y}h1000"/>`;
    return `<svg viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><circle cx="790" cy="163" r="105" fill="${district.color}" opacity=".035"/><circle cx="790" cy="163" r="81" fill="none" stroke="${district.color}" stroke-opacity=".12"/><path d="M0 255q210-125 407-46t593-29V600H0Z" fill="${district.dark}" opacity=".25"/>${buildings}<path d="M0 254h1000" stroke="${district.color}" stroke-opacity=".13"/><g fill="none" stroke="${district.color}" stroke-opacity=".075">${grid}</g><text x="820" y="575" fill="${district.color}" opacity=".035" font-size="300" font-family="monospace" font-weight="bold">${stage}</text></svg>`;
}
