// Compare the actual property rather than a shadow cache, so replacing a node
// or changing a control elsewhere is corrected on the next update.
export function setIfChanged(target, property, value) {
    if (target[property] === value) return false;
    target[property] = value;
    return true;
}

// Let the browser advance normally between dialog controls; wrap only at edges.
export function containDialogTab(event, root) {
    if (event.key !== 'Tab') return;
    const controls = [...root.querySelectorAll('button, [href], input, select, textarea, summary, [tabindex]')]
        .filter(control => !control.disabled && control.tabIndex >= 0 && control.getClientRects().length);
    const first = controls[0], last = controls.at(-1), current = root.ownerDocument.activeElement;
    if (!first) return;
    if (event.shiftKey && (current === first || !controls.includes(current))) {
        event.preventDefault(); last.focus();
    } else if (!event.shiftKey && (current === last || !controls.includes(current))) {
        event.preventDefault(); first.focus();
    }
}
