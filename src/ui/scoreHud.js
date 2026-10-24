import { setIfChanged } from './dom.js?v=0.4.1';

// Controlled, text-only score HUD children. Compare real nodes/properties so
// mode changes, replacement nodes and outside text edits cannot stale a cache.
export function syncTextCells(container, cells, tagName = 'div', emptyText = '') {
    if (!cells.length) {
        if (container.childElementCount || container.textContent !== emptyText) container.textContent = emptyText;
        return;
    }
    // Remove an old empty-state text node or template whitespace.
    for (const node of [...container.childNodes]) if (node.nodeType !== 1) node.remove();
    const expectedTag = tagName.toUpperCase();
    cells.forEach((cell, index) => {
        let node = container.children[index];
        if (!node || node.tagName !== expectedTag) {
            const replacement = container.ownerDocument.createElement(tagName);
            if (node) container.replaceChild(replacement, node);
            else container.appendChild(replacement);
            node = replacement;
        }
        setIfChanged(node, 'className', cell.className);
        const text = String(cell.text);
        // Ten-pin cells contain rich markup. A return to text mode must flatten
        // it even if its concatenated text happens to match the desired value.
        if (node.childElementCount || node.textContent !== text) node.textContent = text;
    });
    while (container.children.length > cells.length) container.lastElementChild.remove();
}
