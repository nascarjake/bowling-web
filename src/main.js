import { bootGame } from './game/app.js?v=0.4.0';

const studioSplash = document.getElementById('studio-splash');
const splashDuration = 2200;
let splashPaused = false;
let splashFinished = false;
let splashRemaining = splashDuration;
let splashStartedAt = performance.now();
let splashTimer = window.setTimeout(finishSplash, splashDuration);

function finishSplash() {
    if (splashPaused || splashFinished) return;
    splashFinished = true;
    studioSplash?.classList.add('fade-out');
    window.setTimeout(() => {
        studioSplash?.remove();
    }, 700);
}

function toggleSplashPause() {
    if (!studioSplash || splashFinished) return false;
    splashPaused = !splashPaused;
    studioSplash.classList.toggle('paused', splashPaused);
    if (splashPaused) {
        window.clearTimeout(splashTimer);
        splashRemaining = Math.max(0, splashRemaining - (performance.now() - splashStartedAt));
    } else {
        splashStartedAt = performance.now();
        splashTimer = window.setTimeout(finishSplash, splashRemaining);
    }
    return true;
}

window.addEventListener('keydown', (event) => {
    if (event.key.toLowerCase() !== 'd') return;
    if (!toggleSplashPause()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
}, true);

if (document.readyState === 'loading') {
    window.addEventListener('load', bootGame, { once: true });
} else {
    bootGame();
}
