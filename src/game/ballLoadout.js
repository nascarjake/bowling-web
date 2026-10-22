import { isGutterMawRoute } from './laneHazards.js?v=0.3.0';
// Gameplay balance lives here; legacy house upgrades remain shared by both balls.
export const BALL_TRAITS = {
    drive: { name: 'Drive Core', desc: '+1.8 physical mass for stronger carry.', color: '#71d9ff', mass: 1.8 },
    focus: { name: 'Focus Grip', desc: '+0.012 clean timing window.', color: '#ffbd69', focus: 0.012 },
    pearl: { name: 'Pearl Snap', desc: 'Hook starts later and finishes 25% stronger.', color: '#ef9bff', hook: 0.25, delay: 0.06 },
    anchor: { name: 'Anchor Cover', desc: '45% less Gutter Maw pull; normal gutters still catch.', color: '#78edbc', resistance: 0.45 }
};
export const STARTER_BALLS = [
    { id: 'azure', name: 'Azure', color: '#36b8ef', trait: 'drive' },
    { id: 'amber', name: 'Amber', color: '#ff9947', trait: 'focus' },
    { id: 'jade', name: 'Jade', color: '#42dca4', trait: 'anchor' }
];
export function createBallLoadout(ids = ['azure', 'amber']) {
    const chosen = [...new Set(ids)].filter(id => STARTER_BALLS.some(ball => ball.id === id)).slice(0, 2);
    for (const ball of STARTER_BALLS) if (chosen.length < 2 && !chosen.includes(ball.id)) chosen.push(ball.id);
    return { version: 1, selected: 0, balls: chosen.map(id => {
        const ball = STARTER_BALLS.find(candidate => candidate.id === id);
        return { id, traits: [ball.trait] };
    }) };
}
export function migrateBallLoadout(value) {
    const savedBalls = Array.isArray(value?.balls) ? value.balls : [];
    const result = createBallLoadout(savedBalls.length ? savedBalls.map(ball => ball?.id) : undefined);
    result.selected = value?.selected === 1 ? 1 : 0;
    for (const ball of result.balls) {
        const saved = savedBalls.find(candidate => candidate?.id === ball.id);
        ball.traits = [...new Set([...ball.traits, ...(Array.isArray(saved?.traits) ? saved.traits : [])])].filter(id => BALL_TRAITS[id]);
    }
    return result;
}
export function selectedBall(game) {
    return game.mode === 'roguelike' ? game.ballLoadout?.balls[game.ballLoadout.selected] : null;
}
export function ballBonuses(game) {
    const bonuses = { mass: 0, focus: 0, hook: 0, delay: 0, resistance: 0 };
    for (const id of selectedBall(game)?.traits || []) {
        const trait = BALL_TRAITS[id];
        for (const key of Object.keys(bonuses)) bonuses[key] += trait?.[key] || 0;
    }
    return bonuses;
}
export function canSwitchBall(game, stage, debug = false) {
    return game.mode === 'roguelike' && !game.paused && !debug && ((game.state === 'MAIN_METER' && stage === 'AIM') || game.state === 'SHOP');
}
export function switchBall(game, index, stage, debug = false) {
    if (!canSwitchBall(game, stage, debug) || ![0, 1].includes(index) || !game.ballLoadout?.balls[index] || index === game.ballLoadout.selected) return false;
    game.ballLoadout.selected = index;
    return true;
}
export function addBallTrait(game, traitId) {
    const ball = selectedBall(game);
    if (!ball || !BALL_TRAITS[traitId] || ball.traits.includes(traitId)) return false;
    ball.traits.push(traitId);
    return true;
}
export function laneModifierLabel(game) {
    if (game.mode === 'tenpin') return 'TEN-PIN • HOUSE LANE';
    if (game.mode === 'practice') return 'FREE PLAY • HOUSE LANE';
    const route = game.currentRoute;
    if (!route) return 'CHOOSE YOUR LANE';
    const modifier = route.heavyPins ? 'HEAVY PINS' : isGutterMawRoute(route) ? 'GUTTER BLACK HOLES' : route.label || 'STANDARD';
    return `${route.name} • ${modifier}`;
}
