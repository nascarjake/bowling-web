import { STARTER_BALLS, BALL_TRAITS, createBallLoadout } from '../game/ballLoadout.js?v=0.4.1';

export const STARTER_PORTRAITS = Object.fromEntries(STARTER_BALLS.map(ball => [ball.id, new URL(`../assets/balls/${ball.id}.png`, import.meta.url).href]));
export function chooseStarterBall(ids, slot, id) {
    const next = createBallLoadout(ids).balls.map(ball => ball.id);
    if (![0, 1].includes(slot) || !STARTER_BALLS.some(ball => ball.id === id)) return next;
    const previous = next[slot], other = 1 - slot;
    next[slot] = id;
    if (next[other] === id) next[other] = previous;
    return next;
}
export function starterBayMarkup(ids, activeSlot) {
    return ids.map((id, index) => {
        const ball = STARTER_BALLS.find(item => item.id === id), trait = BALL_TRAITS[ball.trait];
        return `<button type="button" class="equipment-bay" data-equipment-slot="${index}" aria-pressed="${index === activeSlot}" aria-label="Ball ${index + 1}: ${ball.name}, ${trait.name}. Select to change." style="--skin:${ball.color}">
            <span class="bay-top"><span>0${index + 1} / ${index ? 'RESERVE' : 'LEAD'}</span><span class="bay-edit">${index === activeSlot ? 'EDITING' : 'CHANGE'}</span></span>
            <span class="bay-display"><span class="bay-number" aria-hidden="true">0${index + 1}</span><img src="${STARTER_PORTRAITS[id]}" width="256" height="256" alt="" draggable="false" decoding="async"><span class="ball-plinth" aria-hidden="true"></span></span>
            <span class="bay-copy"><b>${ball.name}</b><span class="equipment-trait">${trait.name}</span></span>
        </button>`;
    }).join('');
}
export function starterRackMarkup(ids, activeSlot) {
    return STARTER_BALLS.map(ball => {
        const equippedSlot = ids.indexOf(ball.id), checked = ids[activeSlot] === ball.id;
        return `<button type="button" role="radio" aria-checked="${checked}" tabindex="${checked ? 0 : -1}" class="equipment-rack-ball" data-starter-id="${ball.id}" aria-label="${ball.name}, ${BALL_TRAITS[ball.trait].name}${equippedSlot >= 0 ? `, in slot ${equippedSlot + 1}` : ''}" style="--skin:${ball.color}"><img src="${STARTER_PORTRAITS[ball.id]}" width="256" height="256" alt="" draggable="false" decoding="async"><span><b>${ball.name}</b><small>${BALL_TRAITS[ball.trait].name}</small></span><i aria-hidden="true">${equippedSlot >= 0 ? `0${equippedSlot + 1}` : '+'}</i></button>`;
    }).join('');
}
export function mountStarterEquipment(container, { ids, onChange = () => {} }) {
    let selected = createBallLoadout(ids).balls.map(ball => ball.id), activeSlot = 0;
    container.innerHTML = `<div class="equipment-stage-heading"><span>YOUR TWO-BALL BAG</span><small>Select a slot to change it</small></div><div class="equipment-bays" role="group" aria-label="Selected loadout slots"></div><div class="equipment-readout" aria-live="polite" aria-atomic="true"></div><div class="equipment-rack-heading"><b></b><small>← → to browse</small></div><div class="equipment-rack" role="radiogroup"></div><span class="equipment-sr-only" role="status" aria-live="polite" data-equipment-status></span>`;
    const bays = container.querySelector('.equipment-bays'), rack = container.querySelector('.equipment-rack');
    const detail = container.querySelector('.equipment-readout'), heading = container.querySelector('.equipment-rack-heading b');
    const status = container.querySelector('[data-equipment-status]');
    function render(focusSelector) {
        const ball = STARTER_BALLS.find(item => item.id === selected[activeSlot]), trait = BALL_TRAITS[ball.trait];
        bays.innerHTML = starterBayMarkup(selected, activeSlot);
        rack.innerHTML = starterRackMarkup(selected, activeSlot);
        rack.setAttribute('aria-label', `Choose ball for slot ${activeSlot + 1}`);
        heading.textContent = `CHOOSE FOR SLOT 0${activeSlot + 1}`;
        detail.innerHTML = `<span class="readout-signal" style="--skin:${ball.color}" aria-hidden="true"></span><div><b>${trait.name}</b><p>${trait.desc}</p></div>`;
        if (focusSelector) container.querySelector(focusSelector)?.focus({ preventScroll: true });
    }
    function choose(id, restoreFocus = true) {
        selected = chooseStarterBall(selected, activeSlot, id);
        onChange([...selected]);
        render(restoreFocus ? `[data-starter-id="${id}"]` : null);
        status.textContent = `Slot 1 ${STARTER_BALLS.find(ball => ball.id === selected[0]).name}. Slot 2 ${STARTER_BALLS.find(ball => ball.id === selected[1]).name}.`;
    }
    function click(event) {
        const bay = event.target.closest('[data-equipment-slot]'), ball = event.target.closest('[data-starter-id]');
        if (bay) { activeSlot = Number(bay.dataset.equipmentSlot); render(`[data-equipment-slot="${activeSlot}"]`); }
        else if (ball) choose(ball.dataset.starterId);
    }
    function keydown(event) {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        const bay = event.target.closest('[data-equipment-slot]'), ball = event.target.closest('[data-starter-id]');
        if (!bay && !ball) return;
        event.preventDefault(); event.stopPropagation();
        if (bay) {
            activeSlot = event.key === 'Home' ? 0 : event.key === 'End' ? 1 : 1 - activeSlot;
            render(`[data-equipment-slot="${activeSlot}"]`);
        } else {
            const current = STARTER_BALLS.findIndex(item => item.id === ball.dataset.starterId);
            const index = event.key === 'Home' ? 0 : event.key === 'End' ? STARTER_BALLS.length - 1 : (current + (event.key === 'ArrowRight' ? 1 : -1) + STARTER_BALLS.length) % STARTER_BALLS.length;
            choose(STARTER_BALLS[index].id);
        }
    }
    container.addEventListener('click', click); container.addEventListener('keydown', keydown);
    render();
    return { destroy() { container.removeEventListener('click', click); container.removeEventListener('keydown', keydown); } };
}

export function bindEquipmentNavigation(root) {
    function keydown(event) {
        if (root.classList.contains('hidden')) return;
        const detail = root.querySelector('#roguelike-hub-detail');
        if (event.key === 'Escape') {
            event.preventDefault(); event.stopPropagation();
            if (detail && !detail.classList.contains('hidden')) detail.querySelector('.equipment-detail-close')?.click();
            else {
                const disclosure = root.querySelector('details[open]');
                if (disclosure) { disclosure.open = false; disclosure.querySelector('summary')?.focus({ preventScroll:true }); }
                else root.querySelector('#btn-close-roguelike-run').click();
            }
            return;
        }
        if (event.key !== 'Tab') {
            if (event.target.closest('input, textarea, select')) event.stopPropagation();
            return;
        }
        const scope = detail && !detail.classList.contains('hidden') ? detail : root;
        const controls = [...scope.querySelectorAll('button, input, summary, [tabindex="0"]')].filter(control=>!control.disabled && control.getClientRects().length);
        const first = controls[0], last = controls.at(-1), current = root.ownerDocument.activeElement;
        if (!first) return;
        if (event.shiftKey && (current === first || !controls.includes(current))) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && (current === last || !controls.includes(current))) { event.preventDefault(); first.focus(); }
    }
    function click(event) {
        const close = event.target.closest('[data-close-continue]');
        if (!close) return;
        const disclosure = close.closest('details'); disclosure.open = false;
        disclosure.querySelector('summary')?.focus({ preventScroll:true });
    }
    root.addEventListener('keydown',keydown); root.addEventListener('click',click);
    return () => {root.removeEventListener('keydown',keydown);root.removeEventListener('click',click);};
}
