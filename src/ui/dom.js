// Compare the actual property rather than a shadow cache, so replacing a node
// or changing a control elsewhere is corrected on the next update.
export function setIfChanged(target, property, value) {
    if (target[property] === value) return false;
    target[property] = value;
    return true;
}
