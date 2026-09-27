import assert from "node:assert/strict";
import test from "node:test";
import {
    NODE_ID_BADGE_MODES,
    nextNodeIdBadgeMode,
    shouldShowNodeId,
} from "../web/node_id_badge_logic.js";

test("cycles Off to On selection to All and back to Off", () => {
    assert.equal(nextNodeIdBadgeMode(NODE_ID_BADGE_MODES.OFF), NODE_ID_BADGE_MODES.SELECTED_ONLY);
    assert.equal(nextNodeIdBadgeMode(NODE_ID_BADGE_MODES.SELECTED_ONLY), NODE_ID_BADGE_MODES.ALL);
    assert.equal(nextNodeIdBadgeMode(NODE_ID_BADGE_MODES.ALL), NODE_ID_BADGE_MODES.OFF);
});

test("shows IDs according to the selected mode", () => {
    assert.equal(shouldShowNodeId(NODE_ID_BADGE_MODES.OFF, true), false);
    assert.equal(shouldShowNodeId(NODE_ID_BADGE_MODES.SELECTED_ONLY, false), false);
    assert.equal(shouldShowNodeId(NODE_ID_BADGE_MODES.SELECTED_ONLY, true), true);
    assert.equal(shouldShowNodeId(NODE_ID_BADGE_MODES.ALL, false), true);
});
