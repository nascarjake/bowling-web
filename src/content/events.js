import { addBumperCharges } from '../game/laneHazards.js?v=0.4.1';
import { GAME } from '../core/state.js?v=0.4.1';

export const EVENT_TYPES = [
    {
        id: 'bookie',
        name: 'Back-Alley Bookie',
        label: 'EVENT',
        desc: 'A chalk-stained bookie offers shortcuts with strings attached.',
        choices: [
            {
                title: 'Take the Cash',
                desc: '+18 Pin Dollars, but future targets rise by 4.',
                apply: () => {
                    GAME.cash += 18;
                    GAME.activeUpgrades.targetTax += 4;
                }
            },
            {
                title: 'Buy Information',
                desc: 'Lose 6 Pin Dollars if possible. Gain timing forgiveness.',
                apply: () => {
                    GAME.cash = Math.max(0, GAME.cash - 6);
                    GAME.activeUpgrades.timingForgiveness += 0.014;
                }
            }
        ]
    },
    {
        id: 'mechanic',
        name: 'Lane Mechanic',
        label: 'EVENT',
        desc: 'The mechanic can tune your ball or hand you a one-throw trick.',
        choices: [
            {
                title: 'Polish the Ball',
                desc: 'Next throw gets extra speed and focus.',
                apply: () => {
                    GAME.activeUpgrades.nextThrowPowerBoost += 2;
                    GAME.activeUpgrades.nextThrowFocus += 0.02;
                }
            },
            {
                title: 'Dampen the Deck',
                desc: 'Special pin forces become smoother for the rest of the run.',
                apply: () => {
                    GAME.activeUpgrades.specialControl += 0.16;
                }
            }
        ]
    },
    {
        id: 'league_night',
        name: 'League Night',
        label: 'EVENT',
        desc: 'A regular league offers a steady, practical advantage.',
        choices: [
            {
                title: 'Borrow Bumpers',
                desc: 'Gain 3 shared bumper impact charges and +4 Pin Dollars. Charges persist until spent.',
                apply: () => {
                    addBumperCharges(GAME.activeUpgrades);
                    GAME.cash += 4;
                }
            },
            {
                title: 'Practice Line',
                desc: 'Gain a small permanent steering boost.',
                apply: () => {
                    GAME.activeUpgrades.spinPower += 0.65;
                }
            }
        ]
    },
    {
        id: 'lost_ball_return',
        name: 'Lost Ball Return',
        label: 'EVENT',
        desc: 'The return coughs up an old house ball. It is ugly, steady, and somehow lucky.',
        choices: [
            {
                title: 'Use the House Ball',
                desc: 'Gain controlled ball mass and a small future target reduction.',
                apply: () => {
                    GAME.activeUpgrades.ballMass += 1.2;
                    GAME.activeUpgrades.targetTax = Math.max(-10, GAME.activeUpgrades.targetTax - 2);
                }
            },
            {
                title: 'Sell It Back',
                desc: '+12 Pin Dollars now, but no control help.',
                apply: () => {
                    GAME.cash += 12;
                }
            }
        ]
    },
    {
        id: 'pinsetter_jam',
        name: 'Pinsetter Jam',
        label: 'EVENT',
        desc: 'The rack machine coughs, clanks, and offers a questionable adjustment.',
        choices: [
            {
                title: 'Force a Neat Rack',
                desc: 'Gain timing forgiveness. Future targets rise by 2.',
                apply: () => {
                    GAME.activeUpgrades.timingForgiveness += 0.012;
                    GAME.activeUpgrades.targetTax += 2;
                }
            },
            {
                title: 'Let It Rattle',
                desc: 'Special pins get smoother. Gain +6 Pin Dollars.',
                apply: () => {
                    GAME.activeUpgrades.specialControl += 0.1;
                    GAME.cash += 6;
                }
            }
        ]
    },
    {
        id: 'snack_bar',
        name: 'Snack Bar Break',
        label: 'EVENT',
        desc: 'A quiet minute away from the lane. Grease pencil, soda fizz, better nerves.',
        choices: [
            {
                title: 'Steady the Hand',
                desc: 'Gain a permanent timing cushion.',
                apply: () => {
                    GAME.activeUpgrades.timingForgiveness += 0.01;
                }
            },
            {
                title: 'Pocket the Change',
                desc: '+8 Pin Dollars and a one-throw focus boost.',
                apply: () => {
                    GAME.cash += 8;
                    GAME.activeUpgrades.nextThrowFocus += 0.018;
                }
            }
        ]
    },
    {
        id: 'counterfeit_pins',
        name: 'Counterfeit Pin Crate',
        label: 'EVENT',
        desc: 'A suspicious crate of special pins arrives with a handwritten warning label.',
        choices: [
            {
                title: 'Take the Gold Stamp',
                desc: 'Gold pins pay x2 Pin Dollars for the rest of the run.',
                apply: () => {
                    GAME.runModifiers.pinCashMultipliers.GOLD = (GAME.runModifiers.pinCashMultipliers.GOLD || 1) * 2;
                }
            },
            {
                title: 'Risk the Bad TNT',
                desc: 'TNT pins stop exploding, but each fallen TNT pin costs -1 Pin Dollar.',
                apply: () => {
                    GAME.runModifiers.disabledPinEffects.EXPLOSIVE = true;
                    GAME.runModifiers.pinCashOverrides.EXPLOSIVE = -1;
                }
            }
        ]
    }
];
