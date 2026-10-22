export const BUMPER_BALANCE = Object.freeze({ purchaseCharges: 3, rearmClearance: 0.16 });
export const MAW_BALANCE = Object.freeze({ graceSeconds: 0.65, safeFraction: 0.48, acceleration: 1.8, maxPullSpeed: 2.8 });
export function migrateBumperCharges(upgrades = {}) {
    const charges = Number(upgrades.bumperCharges);
    return Number.isFinite(charges) ? Math.max(0, Math.floor(charges)) : upgrades.gutterGuards ? BUMPER_BALANCE.purchaseCharges : 0;
}
export function addBumperCharges(upgrades) {
    upgrades.bumperCharges = migrateBumperCharges(upgrades) + BUMPER_BALANCE.purchaseCharges;
    upgrades.gutterGuards = false;
}
// Contact episodes re-arm only after returning inward, never on a timer or a
// second callback. This also debounces compound/repeated native contacts.
export function createBumperContacts() { return { '-1': false, '1': false }; }
export function consumeBumperImpact(upgrades, contacts, side, rolling) {
    if (!rolling || ![-1, 1].includes(side) || contacts[side] || migrateBumperCharges(upgrades) <= 0) return false;
    contacts[side] = true;
    upgrades.bumperCharges = migrateBumperCharges(upgrades) - 1;
    return true;
}
export function rearmBumperContacts(contacts, localX, halfWidth, radius) {
    const inward = halfWidth - radius - BUMPER_BALANCE.rearmClearance;
    if (localX < inward) contacts[1] = false;
    if (localX > -inward) contacts[-1] = false;
}
export function isGutterMawRoute(route) {
    // Old save snapshots predate gutterMaw; retain their route metadata and
    // recognize the existing stable boss id without rewriting any save slots.
    return Boolean(route?.gutterMaw || route?.id === 'boss_gutter_maw');
}
export function gutterMawDelta({ route, rolling, elapsed, localX, halfWidth, velocityX, resistance = 0, dt }) {
    if (!isGutterMawRoute(route) || !rolling || elapsed < MAW_BALANCE.graceSeconds || !Number.isFinite(localX) || halfWidth <= 0) return 0;
    const distance = Math.abs(localX) / halfWidth;
    if (distance <= MAW_BALANCE.safeFraction || distance > 1) return 0;
    const side = Math.sign(localX);
    const ramp = Math.min(1, (distance - MAW_BALANCE.safeFraction) / (1 - MAW_BALANCE.safeFraction));
    const acceleration = MAW_BALANCE.acceleration * ramp * Math.max(0, 1 - resistance);
    return side * Math.min(acceleration * Math.max(0, Math.min(dt, 1 / 30)), Math.max(0, MAW_BALANCE.maxPullSpeed - velocityX * side));
}
