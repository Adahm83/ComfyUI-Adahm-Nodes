export const COLOR_STORAGE_KEY = "Adahm.NodeColors.v1";
export const DEFAULT_FAVORITES = Object.freeze([
    "#3B4252", "#8F4A4A", "#426B50", "#3F5675",
]);

export function normalizeHex(value) {
    if (typeof value !== "string") return null;
    const hex = value.trim().replace(/^#/, "");
    if (/^[\da-f]{3}$/i.test(hex)) {
        return `#${[...hex].map((digit) => digit + digit).join("").toUpperCase()}`;
    }
    return /^[\da-f]{6}$/i.test(hex) ? `#${hex.toUpperCase()}` : null;
}

export function companionBody(value) {
    const hex = normalizeHex(value);
    if (!hex) throw new Error("Enter a HEX color such as #3B4252 or #ABC.");
    // Blend 25% toward black: keep the hue while distinguishing the body.
    return `#${[1, 3, 5].map((index) => Math.round(
        parseInt(hex.slice(index, index + 2), 16) * 0.75,
    ).toString(16).padStart(2, "0")).join("").toUpperCase()}`;
}

export function pairFromHex(value) {
    const color = normalizeHex(value);
    if (!color) throw new Error("Enter a HEX color such as #3B4252 or #ABC.");
    return { color, bgcolor: companionBody(color) };
}

export function parseColorClipboard(text) {
    if (normalizeHex(text)) return pairFromHex(text);
    try {
        const value = JSON.parse(text);
        const color = normalizeHex(value?.color);
        const bgcolor = normalizeHex(value?.bgcolor);
        if (color && bgcolor) return { color, bgcolor };
    } catch { /* Display a useful validation error instead of a JSON error. */ }
    throw new Error('Paste a HEX color or a color pair: {"color":"#3B4252","bgcolor":"#2C323E"}.');
}

export function currentColors(node, liteGraph = globalThis.LiteGraph) {
    return {
        color: normalizeHex(node?.color) ?? normalizeHex(node?.constructor?.color) ??
            normalizeHex(liteGraph?.NODE_DEFAULT_COLOR) ?? "#333333",
        bgcolor: normalizeHex(node?.bgcolor) ?? normalizeHex(node?.constructor?.bgcolor) ??
            normalizeHex(liteGraph?.NODE_DEFAULT_BGCOLOR) ?? "#353535",
    };
}

export function graphNodes(graph) {
    return Array.from(graph?.nodes ?? graph?._nodes ?? []);
}

export function selectedNodes(canvas, graph = canvas?.graph) {
    const nodes = graphNodes(graph);
    // selectedItems also contains groups and reroutes: intersect by identity.
    if (canvas?.selectedItems instanceof Set) {
        return nodes.filter((node) => canvas.selectedItems.has(node));
    }
    const values = canvas?.selected_nodes instanceof Map
        ? [...canvas.selected_nodes.values()]
        : Object.values(canvas?.selected_nodes ?? {});
    return nodes.filter((node) => values.includes(node));
}

export function nodeColorTargets(node, canvas) {
    const selected = selectedNodes(canvas, node?.graph);
    return selected.includes(node) ? selected : (node ? [node] : []);
}

export function noteNodes(graph) {
    // Exact registered types only. Titles may be renamed; third-party notes
    // are available through the normal clicked/selected-node actions.
    return graphNodes(graph).filter((node) =>
        ["Note", "MarkdownNote"].includes(node.type ?? node.comfyClass ?? node.constructor?.type),
    );
}

export function createColorPreferences(getStorage = () => globalThis.localStorage) {
    let state = { favorites: [...DEFAULT_FAVORITES], linked: false };
    try {
        const saved = JSON.parse(getStorage()?.getItem(COLOR_STORAGE_KEY) ?? "null");
        if (saved && typeof saved === "object") {
            state = {
                favorites: DEFAULT_FAVORITES.map((fallback, index) =>
                    normalizeHex(saved.favorites?.[index]) ?? fallback),
                linked: saved.linked === true,
            };
        }
    } catch { /* Private mode, corrupt data, or disabled storage: use defaults. */ }
    const persist = () => {
        try {
            const storage = getStorage();
            if (!storage) return false;
            storage.setItem(COLOR_STORAGE_KEY, JSON.stringify(state));
            return true;
        } catch { return false; }
    };
    return {
        get favorites() { return [...state.favorites]; },
        get linked() { return state.linked; },
        setLinked(value) { state.linked = value === true; return persist(); },
        saveFavorite(index, value) {
            const hex = normalizeHex(value);
            if (!Number.isInteger(index) || index < 0 || index >= 4 || !hex) {
                throw new Error("Choose one of the four favorite slots and a valid HEX color.");
            }
            state.favorites[index] = hex;
            return persist();
        },
    };
}

export function applyNodeColors(graph, targets, values, canvas) {
    const color = normalizeHex(values?.color);
    const bgcolor = normalizeHex(values?.bgcolor);
    if (!color || !bgcolor) throw new Error("Both Header and Body must contain valid HEX colors.");
    if (!graph || (canvas?.graph && canvas.graph !== graph)) {
        throw new Error("The displayed graph changed. Reopen the color dialog.");
    }
    const live = new Set(graphNodes(graph));
    const nodes = [...new Set(targets)].filter((node) => live.has(node) && node.graph === graph);
    if (!nodes.length) throw new Error("The target nodes are no longer in this graph.");
    const changed = nodes.filter((node) => node.color !== color || node.bgcolor !== bgcolor);
    if (!changed.length) return 0;

    // Match installed LiteGraph editing operations. Current ChangeTracker
    // listens to canvas events; older frontends use the graph hooks.
    // One balanced transaction covers the entire batch, including failures.
    const emit = typeof canvas?.emitBeforeChange === "function" &&
        typeof canvas?.emitAfterChange === "function";
    let graphStarted = false;
    if (emit) canvas.emitBeforeChange();
    try {
        graph.beforeChange?.();
        graphStarted = true;
        for (const node of changed) {
            node.color = color;
            node.bgcolor = bgcolor;
        }
    } finally {
        try {
            if (graphStarted) graph.afterChange?.();
        } finally {
            if (emit) canvas.emitAfterChange();
            graph.change?.();
            graph.setDirtyCanvas?.(true, true);
            canvas?.setDirty?.(true, true);
        }
    }
    return changed.length;
}
