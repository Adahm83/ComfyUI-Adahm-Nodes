import { app } from "../../scripts/app.js";
import { NODE_ID_BADGE_MODES } from "./node_id_badge_logic.js";

const EXTENSION_NAME = "comfyui.adahm-nodes.node-id-badges";
const MODE_SETTING = "Adahm.NodeBadge.NodeIdBadgeMode";
const CORE_ID_MODE_SETTING = "Comfy.NodeBadge.NodeIdBadgeMode";
const CORE_LIFECYCLE_MODE_SETTING = "Comfy.NodeBadge.NodeLifeCycleBadgeMode";
const CORE_SOURCE_MODE_SETTING = "Comfy.NodeBadge.NodeSourceBadgeMode";
const CORE_NONE = "None";
const CORE_SHOW_ALL = "Show all";
const LEGACY_SELECTED_ONLY = "Selected Only";

function nodeDefinition(node) {
    return {
        ...(node?.constructor?.nodeData ?? {}),
        ...(node?.nodeData ?? {}),
    };
}

function lifecycleBadgeText(definition) {
    const explicit = definition.nodeLifeCycleBadgeText ??
        definition.node_lifecycle_badge_text ?? definition.lifecycle_badge_text;
    if (explicit) return String(explicit);
    if (definition.deprecated) return "[DEPR]";
    if (definition.experimental) return "[BETA]";
    if (definition.dev_only) return "[DEV]";
    return "";
}

function sourceBadgeText(definition, node = undefined) {
    const explicit = definition.nodeSource?.badgeText ??
        definition.node_source?.badgeText ?? definition.node_source?.badge_text ??
        definition.source_badge_text;
    if (explicit) return String(explicit);
    const moduleName = definition.python_module ??
        definition.RELATIVE_PYTHON_MODULE ?? definition.relative_python_module ??
        definition.module ?? "";
    const typeText = String(node?.type ?? node?.constructor?.type ?? "").toLowerCase();

    // These frontend-only registrations are known to carry their package
    // identity in the LiteGraph type rather than in nodeData.python_module.
    // Resolve them before the generic frontend_only category fallback.
    if (typeText === "setnode" || typeText === "getnode") return "KJNodes";
    if (typeText.startsWith("rgthree.") || typeText.includes("(rgthree)")) {
        return "rgthree";
    }
    if (String(definition.category ?? "").startsWith("__frontend_only__") ||
        String(node?.category ?? "").startsWith("__frontend_only__")) {
        return "frontend_only";
    }
    const modules = String(moduleName).split(".");
    if (modules[0] === "custom_nodes" && modules[1]) {
        return modules[1]
            .split("@")[0]
            .replace(/^(ComfyUI-|ComfyUI_|Comfy-|Comfy_)/, "")
            .replace(/(-ComfyUI|_ComfyUI|-Comfy|_Comfy)$/, "");
    }
    if (["nodes", "comfy_extras", "comfy_api_nodes"].includes(modules[0])) {
        return "🦊";
    }
    if (modules[0] === "blueprint") return "bp";
    if (modules.length > 1 && modules.at(-1)) return modules.at(-1);

    // Some frontend-only extensions register generic LiteGraph types, so the
    // normal node definition has no package/module metadata to identify them.
    // Keep these fallbacks narrowly scoped to registrations verified in the
    // installed extensions rather than guessing from a node title.
    if (definition.isCoreNode || typeText === "markdownnote" ||
        typeText.includes("markdown") || typeText === "note") {
        return "🦊";
    }
    if (typeText.includes("kjnodes") || typeText.includes("kj_node")) {
        return "KJNodes";
    }
    return "";
}

function selectedBadgeText(node) {
    if (currentMode() !== NODE_ID_BADGE_MODES.SELECTED_ONLY || !isNodeSelected(node)) {
        return "";
    }
    const definition = nodeDefinition(node);
    return [
        `#${node.id}`,
        lifecycleBadgeText(definition),
        sourceBadgeText(definition, node),
    ].filter(Boolean).join(" ");
}

function isNodeSelected(node) {
    const selectedNodes = app.canvas?.selected_nodes;
    const selected = selectedNodes?.[node.id] ?? selectedNodes?.[String(node.id)];
    return node.selected === true || node.is_selected === true ||
        selected === true || selected === node;
}

function usesCanvasBadgeFallback(node) {
    const name = String(nodeDefinition(node).name ?? node.comfyClass ?? "").toLowerCase();
    const source = sourceBadgeText(nodeDefinition(node), node).toLowerCase();
    // These node families use a renderer that does not consistently refresh
    // extension badges after selection changes. Draw their supplemental badge
    // through the standard LiteGraph foreground hook instead.
    return name === "markdownnote" || source.includes("kjnodes") ||
        source.includes("rgthree") || source.includes("frontend_only");
}

function installSelectionRefresh() {
    const canvas = app.canvas;
    if (!canvas || canvas.__adahmBadgeSelectionRefresh) return;
    canvas.__adahmBadgeSelectionRefresh = true;

    const previousSelected = canvas.onNodeSelected;
    canvas.onNodeSelected = function (node) {
        previousSelected?.apply(this, arguments);
        ensureBadge(node);
        app.canvas?.setDirty(true, true);
    };

    const previousDeselected = canvas.onNodeDeselected;
    canvas.onNodeDeselected = function (node) {
        previousDeselected?.apply(this, arguments);
        ensureBadge(node);
        app.canvas?.setDirty(true, true);
    };
}

class AdahmNodeIdBadge {
    constructor(node) {
        this.node = node;
        this.fgColor = "white";
        this.bgColor = "#0F1F0F";
        this.fontSize = 12;
        this.padding = 6;
        this.height = 20;
        this.cornerRadius = 5;
        this._boundingRect = [0, 0, 0, 0];
    }

    get text() {
        // All mode uses ComfyUI's native renderer. Selected Only needs a
        // supplemental badge because the native settings have no selected-only
        // option and must remain disabled globally.
        return selectedBadgeText(this.node);
    }

    get visible() {
        return this.text.length > 0;
    }

    get boundingRect() {
        return this._boundingRect;
    }

    getWidth(ctx) {
        if (!this.visible) return 0;
        const previousFont = ctx.font;
        ctx.font = `${this.fontSize}px sans-serif`;
        const width = ctx.measureText(this.text).width + this.padding * 2;
        ctx.font = previousFont;
        return width;
    }

    draw(ctx, x, y) {
        if (!this.visible) return;
        const previous = {
            font: ctx.font,
            fillStyle: ctx.fillStyle,
            textBaseline: ctx.textBaseline,
            textAlign: ctx.textAlign,
        };
        ctx.font = `${this.fontSize}px sans-serif`;
        const width = this.getWidth(ctx);
        this._boundingRect.splice(0, 4, x, y, width, this.height);
        ctx.fillStyle = this.bgColor;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, y, width, this.height, this.cornerRadius);
        else ctx.rect(x, y, width, this.height);
        ctx.fill();
        ctx.fillStyle = this.fgColor;
        ctx.textBaseline = "middle";
        ctx.textAlign = "left";
        ctx.fillText(this.text, x + this.padding, y + this.height / 2 + 1);
        Object.assign(ctx, previous);
    }
}

function currentMode() {
    const mode = app.ui.settings.getSettingValue(MODE_SETTING, NODE_ID_BADGE_MODES.OFF);
    if (mode === "Off") return NODE_ID_BADGE_MODES.OFF;
    if (mode === "All") return NODE_ID_BADGE_MODES.ALL;
    return mode === LEGACY_SELECTED_ONLY ? NODE_ID_BADGE_MODES.SELECTED_ONLY : mode;
}

function setCoreBadgeModes(mode) {
    const all = mode === NODE_ID_BADGE_MODES.ALL;
    const values = {
        [CORE_ID_MODE_SETTING]: all ? CORE_SHOW_ALL : CORE_NONE,
        [CORE_LIFECYCLE_MODE_SETTING]: all ? CORE_SHOW_ALL : CORE_NONE,
        [CORE_SOURCE_MODE_SETTING]: all ? CORE_SHOW_ALL : CORE_NONE,
    };
    for (const [setting, value] of Object.entries(values)) {
        if (app.ui.settings.getSettingValue(setting) !== value) {
            app.ui.settings.setSettingValue(setting, value);
        }
    }
}

function applyMode(mode) {
    setCoreBadgeModes(mode);
    app.canvas?.setDirty(true, true);
}

function ensureBadge(node) {
    if (!node) return;
    node.__adahmNodeIdBadge ??= new AdahmNodeIdBadge(node);
    node.badges ??= [];
    // ComfyUI's current badge renderer accepts LGraphBadge instances or
    // thunks returning one. The thunk keeps selection-dependent text live.
    node.__adahmNodeIdBadgeThunk ??= () => node.__adahmNodeIdBadge;
    if (usesCanvasBadgeFallback(node)) {
        node.badges = node.badges.filter((badge) => badge !== node.__adahmNodeIdBadgeThunk);
    } else if (!node.badges.includes(node.__adahmNodeIdBadgeThunk)) {
        node.badges = [...node.badges, node.__adahmNodeIdBadgeThunk];
    }
    installCanvasBadgeFallback(node);
}

function installCanvasBadgeFallback(node) {
    if (!usesCanvasBadgeFallback(node) || node.__adahmCanvasBadgeFallback) return;
    node.__adahmCanvasBadgeFallback = true;
    const previous = node.onDrawForeground;
    node.onDrawForeground = function (ctx) {
        previous?.apply(this, arguments);
        if (currentMode() !== NODE_ID_BADGE_MODES.SELECTED_ONLY || !isNodeSelected(this)) return;
        const badge = this.__adahmNodeIdBadge;
        if (!badge?.visible) return;
        const width = badge.getWidth(ctx);
        const titleHeight = globalThis.LiteGraph?.NODE_TITLE_HEIGHT ?? 30;
        badge.draw(ctx, this.width - width, -titleHeight - badge.height - 2);
    };
}

function visitGraph(graph, callback, visited = new Set()) {
    if (!graph || visited.has(graph)) return;
    visited.add(graph);
    for (const node of graph._nodes ?? graph.nodes ?? []) {
        callback(node);
        if (node.isSubgraphNode?.()) visitGraph(node.subgraph, callback, visited);
    }
}

app.registerExtension({
    name: EXTENSION_NAME,
    setup() {
        app.ui.settings.addSetting({
            id: MODE_SETTING,
            category: ["Adahm", "Node Badge"],
            name: "Show Node Badges",
            type: "combo",
            options: Object.values(NODE_ID_BADGE_MODES),
            defaultValue: NODE_ID_BADGE_MODES.OFF,
            onChange: applyMode,
        });
        applyMode(currentMode());
        visitGraph(app.rootGraph, ensureBadge);
        installSelectionRefresh();
    },
    nodeCreated(node) {
        ensureBadge(node);
    },
});
