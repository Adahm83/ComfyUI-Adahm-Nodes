import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE_TYPES = new Set(["AdahmClearPreviewsOnStart", "ClearPreviewsOnStart"]);

function collectNodes(graph, result = [], visited = new Set()) {
    if (!graph || visited.has(graph)) return result;
    visited.add(graph);
    for (const node of graph.nodes || []) {
        result.push(node);
        if (node.isSubgraphNode?.()) collectNodes(node.subgraph, result, visited);
    }
    return result;
}

function enabledIn(graph) {
    for (const node of graph?.nodes || []) {
        if (node.mode !== 0) continue;
        if ((NODE_TYPES.has(node.comfyClass) || NODE_TYPES.has(node.type)) &&
            node.widgets?.find((widget) => widget.name === "enabled")?.value === true) return true;
        if (node.isSubgraphNode?.() && enabledIn(node.subgraph)) return true;
    }
    return false;
}

function clearCanvasCache(node) {
    node.imgs = undefined;
    node.images = undefined;
    node.imageIndex = null;
    node.overIndex = null;
    node.graph?.setDirtyCanvas(true, true);
}

export function createPreviewController(app, api) {
    let active = false;
    function start() {
        active = Boolean(app.rootGraph && enabledIn(app.rootGraph));
        if (!active) return;
        const outputs = { ...app.nodeOutputs };
        for (const node of collectNodes(app.rootGraph)) {
            const key = app.extensionManager.workflow.nodeToNodeLocatorId(node);
            const output = outputs[key];
            if (!output?.images?.length || output.animated?.some(Boolean)) continue;
            outputs[key] = { ...output, images: [] };
            clearCanvasCache(node);
        }
        app.nodeOutputs = outputs;
    }
    function stop() { active = false; }
    api.addEventListener("execution_start", start);
    return { stop, dispose() { stop(); api.removeEventListener("execution_start", start); } };
}

let controller;
app.registerExtension({
    name: "comfyui.adahm-nodes.clear-previews",
    setup() { controller?.dispose(); controller = createPreviewController(app, api); },
    beforeConfigureGraph() { controller?.stop(); },
});
