// SPDX-License-Identifier: MIT
// Copyright (C) 2026 Adahm83
// See ../web/js/subgraph-preview-LICENSE.txt for the complete license.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { contain, createSubgraphPreviewController, executionSource, finalImages,
    PREVIEW_NAME, previewLayout, previewTargets, WIDGET_NAME,
} from "../web/js/subgraph_preview_logic.js";

const image = (width = 640, height = 480) => ({ naturalWidth: width, naturalHeight: height });
const descriptor = (filename = "preview.png") => ({ filename, subfolder: "folder", type: "temp" });
function graph(id, nodes = []) {
    return { id, nodes, getNodeById: (id) => nodes.find((node) => String(node.id) === String(id)),
        setDirtyCanvas() {} };
}
function host(id, subgraph, sourceId = "2") {
    const base = [{ name: "seed", value: 42 }];
    const extras = [];
    const node = { id, type: subgraph.id, subgraph, size: [320, 100], flags: {},
        inputs: [{ name: "images" }], outputs: [{ name: "IMAGE" }],
        color: "#123456", bgcolor: "#334455", isSubgraphNode: () => true,
        promotions: [{ name: PREVIEW_NAME, sourceNodeId: String(sourceId), sourcePreviewName: PREVIEW_NAME }],
        properties: { previewExposures: [] }, // Deliberately stale, as in current frontend.
        serialize() { return { properties: { previewExposures: this.promotions }, widgets_values: [42] }; },
        get widgets() { return [...base, ...extras]; }, // Same ephemeral view as SubgraphNode.
        addCustomWidget(widget) { extras.push(widget); return widget; },
        removeWidget(widget) { extras.splice(extras.indexOf(widget), 1); widget.onRemove?.(); },
        arrange() {
            let y = 40;
            for (const widget of extras) {
                widget.y = y;
                widget.computedHeight = widget.computeLayoutSize().minHeight;
                y += widget.computedHeight;
            }
            this.size[1] = Math.max(this.size[1], y);
        },
        onDrawBackground() {}, onDrawForeground() {}, getExtraMenuOptions() {},
    };
    return node;
}
function fixture(options = {}) {
    const source = { id: 2, type: "PreviewImage" };
    const subgraph = graph("subgraph", [source]);
    source.graph = subgraph;
    const outer = host(1, subgraph);
    const root = graph("root", [outer]);
    outer.graph = root;
    const app = { rootGraph: root, nodeOutputs: { "subgraph:2": { images: [descriptor()] } },
        extensionManager: { workflow: { nodeToNodeLocatorId: (node) => `${node.graph.id}:${node.id}` } } };
    const requests = [];
    const api = new EventTarget();
    api.apiURL = (path) => path;
    const controller = createSubgraphPreviewController(app, api, {
        createImage() { const img = image(); requests.push(img); return img; }, ...options,
    });
    const dispatch = (name, detail = {}) => {
        const event = new Event(name); Object.defineProperty(event, "detail", { value: detail });
        api.dispatchEvent(event);
    };
    return { source, subgraph, outer, root, app, requests, controller, dispatch };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));
async function load(f) {
    f.controller.sync();
    f.requests.at(-1).onload();
    await settle();
    return f.outer.widgets.find((widget) => widget.name === WIDGET_NAME);
}
function draw(widget, host) {
    const calls = [];
    const ctx = Object.fromEntries(["save", "restore", "beginPath", "rect", "clip", "drawImage"]
        .map((name) => [name, (...args) => calls.push([name, ...args])]));
    widget.draw(ctx, host, host.size[0], widget.y);
    return calls;
}

test("reads current store-backed exposures rather than stale properties", () => {
    const f = fixture();
    assert.deepEqual(previewTargets(f.outer).map((x) => x.source), [f.source]);
    f.controller.dispose();
});
test("resolves multiple and nested promotions in shown-on-node order, excluding KSampler", () => {
    const preview = { id: 2, type: "PreviewImage" };
    const sampler = { id: 3, type: "KSampler" };
    const inner = host(4, graph("inner", [preview, sampler]));
    inner.promotions.push({ name: "sampler", sourceNodeId: "3", sourcePreviewName: PREVIEW_NAME });
    const outer = host(1, graph("outer", [inner]), "4");
    outer.promotions.push({ name: `${PREVIEW_NAME}_1`, sourceNodeId: "4", sourcePreviewName: PREVIEW_NAME });
    assert.deepEqual(previewTargets(outer).map((target) => target.name), [PREVIEW_NAME, `${PREVIEW_NAME}_1`]);
    inner.subgraph.nodes.push(outer);
    inner.promotions.push({ name: PREVIEW_NAME, sourceNodeId: "1", sourcePreviewName: PREVIEW_NAME });
    assert.equal(previewTargets(outer).length, 2); // Recursive references do not recurse forever.
});
test("fits portrait and landscape images without cropping, with bounded height and batch grids", () => {
    assert.deepEqual(contain(image(400, 800), 0, 0, 300, 200),
        { x: 100, y: 0, width: 100, height: 200 });
    assert.equal(contain(image(0, 0), 0, 0, 100, 100), null);
    const layout = previewLayout([[image(400, 800)], [image(), image()]], 320, 180);
    assert.equal(layout.tiles.length, 3);
    assert.ok(layout.height <= 6 + 2 * (180 + 8));
    for (const tile of layout.tiles) {
        assert.ok(tile.x >= 10 && tile.x + tile.width <= 310.001);
        assert.ok(Math.abs(tile.width / tile.height - tile.image.naturalWidth / tile.image.naturalHeight) < 0.001);
    }
    assert.equal(previewLayout([], 320).height, 0);
});
test("only final file-based non-animated results qualify", () => {
    assert.deepEqual(finalImages({ images: [descriptor(), {}, null, { filename: "x", type: "bogus" }] }), [descriptor()]);
    assert.deepEqual(finalImages({ images: [descriptor()], animated: [true] }), []);
    assert.deepEqual(finalImages({}), []);
});
test("adds one non-serialized widget and leaves slots, colors, drawing and menu hooks intact", async () => {
    const f = fixture();
    const preserved = [f.outer.inputs, f.outer.outputs, f.outer.onDrawBackground,
        f.outer.onDrawForeground, f.outer.getExtraMenuOptions];
    const results = JSON.stringify(f.app.nodeOutputs);
    const widget = await load(f);
    assert.equal(widget.serialize, false);
    assert.equal(widget.options.canvasOnly, true);
    f.controller.sync(); f.controller.sync();
    assert.equal(f.outer.widgets.filter((x) => x.name === WIDGET_NAME).length, 1);
    assert.deepEqual([f.outer.inputs, f.outer.outputs, f.outer.onDrawBackground,
        f.outer.onDrawForeground, f.outer.getExtraMenuOptions], preserved);
    assert.equal(JSON.stringify(f.app.nodeOutputs), results);
    assert.equal(f.source.imgs, undefined);
    assert.equal(f.outer.color, "#123456");
    assert.equal(f.outer.bgcolor, "#334455");
    assert.deepEqual(f.outer.serialize().widgets_values, [42]);
    const calls = draw(widget, f.outer);
    assert.equal(calls.filter(([name]) => name === "drawImage").length, 1);
    assert.equal(calls[0][0], "save"); assert.equal(calls.at(-1)[0], "restore");
    f.controller.dispose();
});
test("draw uses newly loaded images and invalidates URLs even for repeated filenames", async () => {
    const f = fixture();
    const widget = await load(f);
    const first = f.requests[0];
    f.dispatch("executed", { node: "1:2" }); await settle();
    assert.equal(f.requests.length, 2);
    assert.notEqual(f.requests[1].src, first.src);
    f.requests[1].onload(); await settle();
    const secondWidget = f.outer.widgets.find((x) => x.name === WIDGET_NAME);
    assert.equal(secondWidget, widget); // No widget replacement / preview flicker while loading.
    const call = draw(secondWidget, f.outer).find(([name]) => name === "drawImage");
    assert.equal(call[1], f.requests[1]);
    // A redraw does not initiate requests or change execution/cache signatures.
    draw(secondWidget, f.outer); f.controller.sync();
    assert.equal(f.requests.length, 2);
    assert.ok(widget);
    f.controller.dispose();
});
test("clear-previews output removal hides the workaround and rejects stale image loads", async () => {
    const f = fixture();
    f.controller.sync();
    f.app.nodeOutputs["subgraph:2"].images = [];
    f.dispatch("execution_start"); await settle();
    f.requests[0].onload(); await settle();
    assert.equal(f.outer.widgets.length, 1);
    f.controller.dispose();
});
test("demotion, graph replacement, opt-out and Nodes 2.0 remove only our widget", async () => {
    for (const change of ["demote", "graph", "off", "vue"]) {
        let on = true; let classic = true;
        const f = fixture({ enabled: () => on, classic: () => classic });
        await load(f);
        if (change === "demote") f.outer.promotions = [];
        if (change === "graph") f.app.rootGraph = graph("new");
        if (change === "off") on = false;
        if (change === "vue") classic = false;
        const size = [...f.outer.size];
        f.controller.sync();
        assert.equal(f.outer.widgets.length, 1);
        assert.deepEqual(f.outer.size, size); // Do not discard the user's chosen size.
        f.controller.dispose();
    }
});
test("native promoted preview suppresses fallback and removes an existing fallback", async () => {
    const f = fixture(); await load(f);
    f.outer.addCustomWidget({ name: PREVIEW_NAME, computeLayoutSize: () => ({ minHeight: 100 }) });
    f.controller.sync();
    assert.equal(f.outer.widgets.some((x) => x.name === WIDGET_NAME), false);
    assert.equal(f.outer.widgets.some((x) => x.name === PREVIEW_NAME), true);
    f.controller.dispose();
});
test("width and height setting changes relayout; collapse draws nothing", async () => {
    let max = 300;
    const f = fixture({ maxHeight: () => max });
    const widget = await load(f);
    const initial = widget.computeLayoutSize().minHeight;
    f.outer.size[0] = 180; f.controller.sync();
    assert.ok(widget.computeLayoutSize().minHeight < initial);
    max = 80; f.controller.sync();
    assert.ok(widget.computeLayoutSize().minHeight <= 94);
    f.outer.flags.collapsed = true;
    assert.equal(draw(widget, f.outer).length, 0);
    f.controller.dispose();
});
test("failed files or unsupported promotion APIs leave normal rendering intact", async () => {
    const warnings = [];
    const f = fixture({ warn: (error) => warnings.push(error) });
    f.controller.sync(); f.requests[0].onerror(); await settle();
    assert.equal(f.outer.widgets.length, 1);
    f.outer.serialize = () => { throw Error("API changed"); };
    f.controller.sync(); f.controller.sync();
    assert.equal(warnings.length, 1);
    assert.equal(f.outer.widgets.length, 1);
    f.controller.dispose();
});
test("dispose releases listeners and late loads cannot attach a preview", async () => {
    const f = fixture(); f.controller.sync(); f.controller.dispose();
    f.requests[0].onload(); f.dispatch("executed", { node: "1:2" }); await settle();
    assert.equal(f.outer.widgets.length, 1);
    assert.equal(f.requests.length, 1);
});
test("execution ids resolve interior nodes, not just their parent subgraph", () => {
    const f = fixture();
    assert.equal(executionSource(f.root, "1:2"), f.source);
    assert.equal(executionSource(f.root, "missing:2"), undefined);
    f.controller.dispose();
});

test("entry point registers distinct settings-tree leaves and guards Classic mode", () => {
    const code = fs.readFileSync(new URL("../web/js/subgraph_previews.js", import.meta.url), "utf8")
        .replace(/^import .*?;\n/gm, "");
    const definitions = [];
    const values = new Map();
    let extension; let options; let ticks = 0; let interval;
    const app = { registerExtension(e) { extension = e; }, ui: { settings: {
        addSetting(e) { definitions.push(e); values.set(e.id, e.defaultValue); },
        getSettingValue(...args) { assert.equal(args.length, 1); return values.get(args[0]); },
    } } };
    vm.runInNewContext(code, { app, api: {}, document: { visibilityState: "visible" },
        setInterval(fn) { interval = fn; }, clearInterval() {}, queueMicrotask: (fn) => fn(),
        createSubgraphPreviewController(a, b, opts) { options = opts;
            return { sync() { ticks++; }, dispose() {} }; },
    });
    extension.setup();
    assert.equal(definitions.length, 2);
    assert.equal(new Set(definitions.map((s) => s.category.join("/"))).size, 2);
    assert.ok(definitions.every((s) => s.category.length === 3));
    assert.equal(options.enabled(), true);
    assert.equal(options.classic(), true);
    values.set("Comfy.VueNodes.Enabled", true);
    assert.equal(options.classic(), false);
    assert.equal(options.maxHeight(), 300);
    interval(); extension.afterConfigureGraph(); extension.nodeCreated();
    assert.ok(ticks >= 4);
});
