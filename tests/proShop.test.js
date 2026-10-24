import test from 'node:test';
import assert from 'node:assert/strict';
import { SHOP_UPGRADES } from '../src/content/shopUpgrades.js?v=0.4.1';
import { TENPIN_SHOP_ITEMS } from '../src/content/tenpinShop.js?v=0.4.1';
import { shopVisual, shopOfferState, shopArtwork } from '../src/ui/shopArt.js?v=0.4.1';

test('every purchasable item has an illustrated identity and a concise effect', () => {
    for (const item of [...SHOP_UPGRADES, ...TENPIN_SHOP_ITEMS]) {
        const visual = shopVisual(item);
        assert.notEqual(visual.label, 'HOUSE EQUIPMENT', item.id);
        assert.ok(visual.summary.length <= 65, item.id);
        assert.match(visual.color, /^#[0-9a-f]{6}$/i);
        assert.match(shopArtwork(item), /^<svg/);
        assert.ok(['THIS RUN', 'THIS RACK', 'NEXT FRAME', 'NEXT THROW'].includes(visual.duration));
    }
});

test('classic pins, setup and ball consumables show their actual lifetimes', () => {
    for (const item of TENPIN_SHOP_ITEMS) {
        assert.equal(shopVisual(item).duration, item.typeKey ? 'THIS RACK' : item.id === 'manual_rack' ? 'NEXT FRAME' : 'NEXT THROW', item.id);
    }
    assert.equal(shopVisual({ id: 'gutters' }).duration, 'THIS RUN');
    assert.equal(shopVisual({ id: 'extra_roll' }).duration, 'THIS RUN');
});

test('shop actions communicate funds, installed gear and rack limits', () => {
    assert.deepEqual(shopOfferState({ cash: 8, cost: 8 }), { canBuy: true, label: 'INSTALL', state: 'available' });
    assert.equal(shopOfferState({ cash: 8, cost: 8, temporary: true }).label, 'PACK IT');
    assert.deepEqual(shopOfferState({ cash: 2.5, cost: 8 }), { canBuy: false, label: 'NEED $6', state: 'short' });
    assert.equal(shopOfferState({ cash: 20, cost: 3, rackFull: true }).label, 'RACK FULL');
    assert.equal(shopOfferState({ cash: 20, cost: 5, ready: true }).label, 'READY');
    assert.equal(shopOfferState({ cash: 20, cost: 8, soldOut: true }).label, 'INSTALLED');
    assert.equal(shopOfferState({ cash: 20, cost: 8, soldOut: true, temporary: true }).label, 'PACKED');
});
