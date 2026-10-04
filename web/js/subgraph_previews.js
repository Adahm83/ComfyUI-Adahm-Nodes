// SPDX-License-Identifier: MIT
// Copyright (C) 2026 Adahm83
// See subgraph-preview-LICENSE.txt for the complete license.
import { app } from "../../../scripts/app.js";
import { api } from "../../../scripts/api.js";
import { createSubgraphPreviewController } from "./subgraph_preview_logic.js";

const ENABLED = "Adahm.SubgraphPreview.Enabled";
const MAX_HEIGHT = "Adahm.SubgraphPreview.MaxHeight";
let controller;
let timer;

function setting(id, fallback) {
    try { return app.ui.settings.getSettingValue(id) ?? fallback; }
    catch { return fallback; }
}

app.registerExtension({
    name: "comfyui.adahm-nodes.legacy-subgraph-previews",
    setup() {
        clearInterval(timer);
        controller?.dispose();
        app.ui.settings.addSetting({
            id: ENABLED, category: ["Adahm", "Subgraph Preview", "Enabled"],
            name: "Show promoted image previews on Classic subgraphs",
            type: "boolean", defaultValue: true,
            tooltip: "Compatibility workaround for promoted Preview Image widgets in legacy Nodes 1.0.",
            onChange: () => controller?.sync(),
        });
        app.ui.settings.addSetting({
            id: MAX_HEIGHT, category: ["Adahm", "Subgraph Preview", "MaxHeight"],
            name: "Maximum image preview height", type: "number", defaultValue: 300,
            attrs: { min: 80, max: 1200, step: 20 },
            tooltip: "Maximum height in graph pixels per promoted preview. Aspect ratio is preserved.",
            onChange: () => controller?.sync(),
        });
        controller = createSubgraphPreviewController(app, api, {
            enabled: () => setting(ENABLED, true),
            classic: () => !setting("Comfy.VueNodes.Enabled", false) &&
                globalThis.LiteGraph?.vueNodesMode !== true,
            maxHeight: () => setting(MAX_HEIGHT, 300),
        });
        controller.sync();
        // Subgraph creation/promotion has no public extension notification in
        // frontend 1.53.10. Reconcile via the public node serialization API,
        // off the draw loop, including promotions edited after graph load.
        timer = setInterval(() => {
            if (document.visibilityState !== "hidden") controller?.sync();
        }, 750);
    },
    afterConfigureGraph() { controller?.sync(); },
    nodeCreated() { queueMicrotask(() => controller?.sync()); },
});
