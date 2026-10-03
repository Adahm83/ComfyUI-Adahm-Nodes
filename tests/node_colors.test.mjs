import assert from "node:assert/strict";
import test from "node:test";
import {
    applyNodeColors, COLOR_STORAGE_KEY, companionBody, createColorPreferences,
    currentColors, DEFAULT_FAVORITES, nodeColorTargets, normalizeHex, noteNodes,
    pairFromHex, parseColorClipboard, selectedNodes,
} from "../web/js/node_color_logic.js";

function fixture() {
    const events = [];
    const graph = {
        nodes: [],
        beforeChange() { events.push("graph:before"); },
        afterChange() { events.push("graph:after"); },
        change() { events.push("graph:change"); },
        setDirtyCanvas(fg, bg) { assert.deepEqual([fg, bg], [true, true]); },
    };
    graph.nodes = ["Note", "MarkdownNote", "KSampler", "ThirdParty.Note"].map((type, id) =>
        ({ id, type, graph, color: "#123456", bgcolor: "#654321" }));
    const canvas = {
        graph,
        selectedItems: new Set(),
        emitBeforeChange() { events.push("canvas:before"); },
        emitAfterChange() { events.push("canvas:after"); },
        setDirty(fg, bg) { assert.deepEqual([fg, bg], [true, true]); },
    };
    return { graph, canvas, events, nodes: graph.nodes };
}

test("HEX accepts optional hash, case, and shorthand, rejects CSS/injection/alpha", () => {
    assert.equal(normalizeHex(" #aBc "), "#AABBCC");
    assert.equal(normalizeHex("1f2937"), "#1F2937");
    for (const value of [null, {}, "", "#12", "#12345678", "rgb(1,2,3)", "red", "#fff; color:red"]) {
        assert.equal(normalizeHex(value), null);
    }
    assert.equal(companionBody("#FFFFFF"), "#BFBFBF");
    assert.equal(companionBody("#000000"), "#000000");
    assert.deepEqual(pairFromHex("#3B4252"), { color: "#3B4252", bgcolor: "#2C323E" });
});

test("clipboard round-trips independent colors and interprets a single HEX", () => {
    const pair = { color: "#ABCDEF", bgcolor: "#012345" };
    assert.deepEqual(parseColorClipboard(JSON.stringify(pair)), pair);
    assert.deepEqual(parseColorClipboard("abc"), pairFromHex("#ABC"));
    assert.deepEqual(parseColorClipboard('{"color":"abc","bgcolor":"123","ignored":"x"}'),
        { color: "#AABBCC", bgcolor: "#112233" });
    for (const text of ["invalid", "null", "{}", '{"color":"#123456","bgcolor":"red"}']) {
        assert.throws(() => parseColorClipboard(text), /Paste a HEX/);
    }
});

test("current colors resolve explicit, class, and theme defaults", () => {
    assert.deepEqual(currentColors({ color: "#ABC", constructor: { bgcolor: "#DEF" } }),
        { color: "#AABBCC", bgcolor: "#DDEEFF" });
    assert.deepEqual(currentColors({}, { NODE_DEFAULT_COLOR: "#123", NODE_DEFAULT_BGCOLOR: "#456" }),
        { color: "#112233", bgcolor: "#445566" });
});

test("selection excludes groups/reroutes and scopes an unselected right-click", () => {
    const { nodes, canvas, graph } = fixture();
    const group = { id: nodes[2].id, color: "#000" };
    canvas.selectedItems = new Set([nodes[0], nodes[1], group, { id: 99 }]);
    assert.deepEqual(selectedNodes(canvas), nodes.slice(0, 2));
    assert.deepEqual(nodeColorTargets(nodes[0], canvas), nodes.slice(0, 2));
    assert.deepEqual(nodeColorTargets(nodes[2], canvas), [nodes[2]]);
    canvas.selectedItems = undefined;
    canvas.selected_nodes = { 0: nodes[0], 99: { id: 99 } };
    assert.deepEqual(selectedNodes(canvas), [nodes[0]]);
    canvas.selected_nodes = new Map([[1, nodes[1]]]);
    assert.deepEqual(selectedNodes(canvas), [nodes[1]]);
    // A modern empty selection is authoritative even if the legacy map is stale.
    canvas.selectedItems = new Set();
    assert.deepEqual(selectedNodes(canvas, graph), []);
});

test("ALL notes matches exact built-in types within the displayed graph", () => {
    const { graph, nodes } = fixture();
    nodes[0].title = "Renamed note";
    nodes[3].title = "Note";
    nodes[2].subgraph = { nodes: [{ type: "Note" }] };
    assert.deepEqual(noteNodes(graph), nodes.slice(0, 2));
});

test("four favorites and link preference persist and recover individually", () => {
    const data = new Map();
    const storage = { getItem: (key) => data.get(key), setItem: (key, value) => data.set(key, value) };
    const first = createColorPreferences(() => storage);
    assert.deepEqual(first.favorites, DEFAULT_FAVORITES);
    assert.equal(first.saveFavorite(2, "abc"), true);
    assert.equal(first.setLinked(true), true);
    const second = createColorPreferences(() => storage);
    assert.equal(second.favorites[2], "#AABBCC");
    assert.equal(second.favorites.length, 4);
    assert.equal(second.linked, true);
    assert.throws(() => second.saveFavorite(4, "abc"));
    data.set(COLOR_STORAGE_KEY, '{"favorites":["bad value","123",null,"abcdef","000"],"linked":"true"}');
    const repaired = createColorPreferences(() => storage);
    assert.deepEqual(repaired.favorites, [DEFAULT_FAVORITES[0], "#112233", DEFAULT_FAVORITES[2], "#ABCDEF"]);
    assert.equal(repaired.linked, false);
    data.set(COLOR_STORAGE_KEY, "broken JSON");
    assert.deepEqual(createColorPreferences(() => storage).favorites, DEFAULT_FAVORITES);
});

test("blocked localStorage keeps favorites usable in memory without throwing", () => {
    const preferences = createColorPreferences(() => { throw new Error("SecurityError"); });
    assert.equal(preferences.saveFavorite(0, "fed"), false);
    assert.equal(preferences.favorites[0], "#FFEEDD");
    assert.equal(preferences.setLinked(true), false);
    assert.equal(preferences.linked, true);
});

test("bulk color edits use one balanced transaction, preserve other node state, and skip no-ops", () => {
    const { graph, canvas, nodes, events } = fixture();
    nodes[0].widgets = [{ value: "keep" }];
    const values = { color: "#ABCDEF", bgcolor: "#987654" };
    assert.equal(applyNodeColors(graph, [nodes[0], nodes[1], nodes[0]], values, canvas), 2);
    assert.deepEqual(events, ["canvas:before", "graph:before", "graph:after", "canvas:after", "graph:change"]);
    assert.equal(nodes[0].color, "#ABCDEF");
    assert.equal(nodes[1].bgcolor, "#987654");
    assert.equal(nodes[2].color, "#123456");
    assert.deepEqual(nodes[0].widgets, [{ value: "keep" }]);
    events.length = 0;
    assert.equal(applyNodeColors(graph, [nodes[0], nodes[1]], values, canvas), 0);
    assert.deepEqual(events, []);
});

test("invalid values, deleted targets, and changed graphs never start a transaction", () => {
    const { graph, canvas, nodes, events } = fixture();
    assert.throws(() => applyNodeColors(graph, [nodes[0]], { color: "red", bgcolor: "abc" }, canvas));
    const removed = nodes[0];
    graph.nodes = nodes.slice(1);
    assert.throws(() => applyNodeColors(graph, [removed], pairFromHex("abc"), canvas), /no longer/);
    canvas.graph = { nodes: [] };
    assert.throws(() => applyNodeColors(graph, [nodes[1]], pairFromHex("abc"), canvas), /graph changed/);
    assert.deepEqual(events, []);
    assert.equal(nodes[0].color, "#123456");
});

test("graph hooks support older canvas APIs and finally balances a setter failure", () => {
    const { graph, nodes, events } = fixture();
    Object.defineProperty(nodes[1], "color", { get: () => "#123456", set: () => { throw new Error("read-only node"); } });
    assert.throws(() => applyNodeColors(graph, nodes.slice(0, 2), pairFromHex("abc")), /read-only/);
    assert.deepEqual(events, ["graph:before", "graph:after", "graph:change"]);
});
