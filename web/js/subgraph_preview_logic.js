// SPDX-License-Identifier: MIT
// Copyright (C) 2026 Adahm83
// See subgraph-preview-LICENSE.txt for the complete license.

export const PREVIEW_NAME = "$$canvas-image-preview";
export const WIDGET_NAME = "adahm-legacy-subgraph-previews";

export function previewExposures(node) {
    // Current promotions live in a store. serialize() projects that store;
    // node.properties alone can still contain the previously saved promotions.
    const properties = typeof node.serialize === "function"
        ? node.serialize()?.properties : node.properties;
    return Array.isArray(properties?.previewExposures) ? properties.previewExposures : [];
}

export function previewTargets(host, seen = new Set()) {
    if (!host?.isSubgraphNode?.() || seen.has(host)) return [];
    const ancestors = new Set(seen).add(host);
    return previewExposures(host).flatMap((exposure) => {
        if (!exposure || typeof exposure.sourcePreviewName !== "string" ||
            !exposure.sourcePreviewName.startsWith(PREVIEW_NAME)) return [];
        const source = host.subgraph?.getNodeById?.(exposure.sourceNodeId);
        if (source?.type === "PreviewImage" && exposure.sourcePreviewName === PREVIEW_NAME) {
            return [{ name: exposure.name, source }];
        }
        // A promoted preview can itself be re-promoted through another subgraph.
        return previewTargets(source, ancestors)
            .filter((target) => target.name === exposure.sourcePreviewName)
            .map((target) => ({ ...target, name: exposure.name }));
    });
}

export function subgraphHosts(graph, seen = new Set()) {
    if (!graph || seen.has(graph)) return [];
    seen.add(graph);
    const result = [];
    for (const node of graph.nodes ?? graph._nodes ?? []) {
        if (!node.isSubgraphNode?.()) continue;
        result.push(node, ...subgraphHosts(node.subgraph, seen));
    }
    return result;
}

export function finalImages(output) {
    if (!Array.isArray(output?.images) || output.animated?.some(Boolean)) return [];
    return output.images.filter((item) => typeof item?.filename === "string" &&
        item.filename.length && ["temp", "output", "input"].includes(item.type ?? "temp"));
}

export function contain(image, x, y, width, height) {
    const iw = image.naturalWidth || image.width;
    const ih = image.naturalHeight || image.height;
    if (!(iw > 0 && ih > 0 && width > 0 && height > 0)) return null;
    const scale = Math.min(width / iw, height / ih);
    return { x: x + (width - iw * scale) / 2, y: y + (height - ih * scale) / 2,
        width: iw * scale, height: ih * scale };
}

export function previewLayout(groups, nodeWidth, maxHeight = 300) {
    const width = Math.max(1, Number(nodeWidth) - 20);
    const limit = Math.max(80, Math.min(1200, Number(maxHeight) || 300));
    let y = 6;
    const tiles = [];
    for (const images of groups) {
        if (!images.length) continue;
        const columns = Math.ceil(Math.sqrt(images.length));
        const rows = Math.ceil(images.length / columns);
        const cellWidth = (width - 4 * (columns - 1)) / columns;
        const naturalHeight = Math.max(...images.map((image) =>
            cellWidth * (image.naturalHeight || image.height) / (image.naturalWidth || image.width)));
        const height = Math.min(limit, naturalHeight * rows + 4 * (rows - 1));
        const cellHeight = (height - 4 * (rows - 1)) / rows;
        images.forEach((image, index) => {
            const rect = contain(image, 10 + (index % columns) * (cellWidth + 4),
                y + Math.floor(index / columns) * (cellHeight + 4), cellWidth, cellHeight);
            if (rect) tiles.push({ image, ...rect });
        });
        y += height + 8;
    }
    return { height: tiles.length ? y : 0, tiles };
}

export function executionSource(root, executionId) {
    const ids = String(executionId ?? "").split(":");
    let graph = root;
    let node;
    for (const id of ids) {
        node = graph?.getNodeById?.(id);
        graph = node?.subgraph;
    }
    return node;
}

/** All runtime state belongs to this extension; no source imgs/results are changed. */
export function createSubgraphPreviewController(app, api, {
    enabled = () => true, classic = () => true, maxHeight = () => 300,
    createImage = () => new Image(), warn = (error) => console.warn("Adahm subgraph previews:", error),
} = {}) {
    const hosts = new Map();
    const sources = new Map();
    const revisions = new WeakMap();
    let warned = false;
    let disposed = false;
    const session = Date.now();
    const report = (error) => { if (!warned) { warned = true; warn(error); } };
    const locator = (node) => app.extensionManager?.workflow?.nodeToNodeLocatorId?.(node);
    const dirty = (host) => host.graph?.setDirtyCanvas?.(true, true);

    function detach(host, entry) {
        if (!entry.widget) return;
        host.removeWidget?.(entry.widget);
        entry.widget = null;
        if (host.graph) host.arrange?.();
        dirty(host);
    }

    function updateWidget(host, entry) {
        if (disposed) return;
        const groups = entry.targets.map(({ key }) => sources.get(key)?.images ?? []);
        const changed = groups.length !== entry.groups?.length ||
            groups.some((images, index) => images !== entry.groups?.[index]);
        entry.groups = groups;
        const layout = () => previewLayout(entry.groups, host.size?.[0] ?? 300, maxHeight());
        const nextHeight = layout().height;
        if (!nextHeight) { detach(host, entry); return; }
        if (!entry.widget) {
            entry.widget = host.addCustomWidget({
                name: WIDGET_NAME, type: "custom", value: "", y: 0, serialize: false,
                options: { serialize: false, canvasOnly: true, read_only: true },
                computeLayoutSize() {
                    const height = layout().height;
                    return { minHeight: height, maxHeight: height, minWidth: 0 };
                },
                draw(ctx, node, width, y) {
                    if (disposed || !enabled() || !classic() || node.flags?.collapsed) return;
                    ctx.save();
                    try {
                        const height = Math.max(0, Math.min(this.computedHeight ?? nextHeight,
                            (node.size?.[1] ?? Infinity) - y));
                        ctx.beginPath(); ctx.rect(0, y, width, height); ctx.clip();
                        for (const tile of previewLayout(entry.groups, width, maxHeight()).tiles) {
                            ctx.drawImage(tile.image, tile.x, y + tile.y, tile.width, tile.height);
                        }
                    } catch (error) { report(error); }
                    finally { ctx.restore(); }
                },
            });
        }
        const resized = entry.height !== nextHeight || entry.width !== host.size?.[0];
        if (resized) {
            entry.height = nextHeight;
            entry.width = host.size?.[0];
            host.arrange?.(); // Native layout reserves the widget's space and keeps ports aligned.
        }
        if (changed || resized) dirty(host);
    }

    function refreshWidgets() {
        for (const [host, entry] of hosts) {
            try { updateWidget(host, entry); } catch (error) { report(error); }
        }
    }

    function syncSource(key, source) {
        const output = app.nodeOutputs?.[key];
        const descriptors = finalImages(output);
        const revision = revisions.get(source) ?? 0;
        const signature = JSON.stringify([descriptors, revision]);
        const previous = sources.get(key);
        if (previous?.signature === signature) return;
        const state = { signature, images: descriptors.length ? previous?.images ?? [] : [], source };
        sources.set(key, state);
        if (!descriptors.length) return;
        Promise.all(descriptors.map((item) => new Promise((resolve) => {
            const image = createImage();
            image.onload = () => resolve(image.naturalWidth > 0 ? image : null);
            image.onerror = () => resolve(null);
            const query = new URLSearchParams({ filename: item.filename, type: item.type ?? "temp",
                subfolder: item.subfolder ?? "", adahm_preview: `${session}-${revision}` });
            image.src = api.apiURL(`/view?${query}`);
        }))).then((images) => {
            if (disposed || sources.get(key) !== state) return; // Removed preview / late old request.
            state.images = images.filter(Boolean);
            refreshWidgets();
        }).catch(report);
    }

    function sync() {
        if (disposed) return;
        const liveHosts = new Set();
        const liveSources = new Set();
        try {
            const root = app.rootGraph ?? app.graph;
            for (const host of enabled() && classic() ? subgraphHosts(root) : []) {
                // If a newer frontend provides the actual promoted canvas widget, stand aside.
                if (host.widgets?.some((widget) => widget.name?.startsWith(PREVIEW_NAME))) continue;
                if (typeof host.addCustomWidget !== "function" || typeof host.removeWidget !== "function") continue;
                let targets;
                try { targets = previewTargets(host).map((target) => ({ ...target,
                    key: locator(target.source) })).filter((target) => target.key); }
                catch (error) { report(error); continue; }
                if (!targets.length) continue;
                liveHosts.add(host);
                const entry = hosts.get(host) ?? { widget: null };
                entry.targets = targets;
                hosts.set(host, entry);
                for (const { key, source } of targets) {
                    liveSources.add(key);
                    syncSource(key, source);
                }
                updateWidget(host, entry);
            }
            for (const [host, entry] of hosts) {
                if (liveHosts.has(host)) continue;
                detach(host, entry);
                hosts.delete(host);
            }
            for (const key of sources.keys()) if (!liveSources.has(key)) sources.delete(key);
        } catch (error) { report(error); }
    }

    function executed(event) {
        const detail = event.detail ?? {};
        const display = executionSource(app.rootGraph, detail.display_node ?? detail.node);
        const source = display?.type === "PreviewImage" ? display
            : executionSource(app.rootGraph, detail.node);
        if (source?.type === "PreviewImage") revisions.set(source, (revisions.get(source) ?? 0) + 1);
        // Let ComfyUI publish its results first. No output writes or latent-preview listeners.
        queueMicrotask(sync);
    }
    const later = () => queueMicrotask(sync);
    api.addEventListener("executed", executed);
    api.addEventListener("execution_start", later);
    return { sync, dispose() {
        disposed = true;
        api.removeEventListener("executed", executed);
        api.removeEventListener("execution_start", later);
        for (const [host, entry] of hosts) {
            try { detach(host, entry); } catch (error) { report(error); }
        }
        hosts.clear(); sources.clear();
    } };
}
