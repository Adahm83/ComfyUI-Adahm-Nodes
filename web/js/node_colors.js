import { app } from "../../../scripts/app.js";
import {
    applyNodeColors, companionBody, createColorPreferences, currentColors,
    nodeColorTargets, normalizeHex, noteNodes, pairFromHex, parseColorClipboard,
    selectedNodes,
} from "./node_color_logic.js";

let preferences;
let activeDialog;

function prefs() {
    return preferences ??= createColorPreferences();
}

function element(tag, className, text) {
    const result = document.createElement(tag);
    if (className) result.className = className;
    if (text != null) result.textContent = text;
    return result;
}

function button(text, action) {
    const result = element("button", "", text);
    result.type = "button";
    result.addEventListener("click", action);
    return result;
}

function injectStyles() {
    if (document.getElementById("adahm-node-color-styles")) return;
    const style = element("style");
    style.id = "adahm-node-color-styles";
    style.textContent = `
      .adahm-node-color-dialog { box-sizing:border-box; width:min(480px,calc(100vw - 32px));
        max-height:calc(100vh - 32px); overflow:auto; padding:22px; border-radius:12px;
        border:1px solid var(--border-color,#666); background:var(--comfy-menu-bg,#202328);
        color:var(--fg-color,#e4e4e7); font:14px/1.5 system-ui; }
      .adahm-node-color-dialog::backdrop { background:rgba(0,0,0,.6); }
      .adahm-node-color-dialog * { box-sizing:border-box; }
      .adahm-node-color-dialog h2 { font-size:19px; margin:0 0 8px; color:inherit; }
      .adahm-node-color-dialog p { margin:8px 0 14px; }
      .adahm-node-color-dialog input[type=text], .adahm-node-color-dialog textarea,
      .adahm-node-color-dialog select { background:var(--comfy-input-bg,#16191d);
        color:inherit; border:1px solid var(--border-color,#666); border-radius:5px;
        padding:8px; min-width:0; font:inherit; }
      .adahm-node-color-dialog input[type=text] { width:100%; font-family:monospace; }
      .adahm-node-color-dialog input[aria-invalid=true] { border-color:#e87171; }
      .adahm-node-color-dialog input:disabled { opacity:.65; }
      .adahm-node-color-dialog button { border:1px solid var(--border-color,#666);
        border-radius:5px; background:var(--comfy-input-bg,#30343c); color:inherit;
        padding:7px 11px; cursor:pointer; font:inherit; }
      .adahm-node-color-dialog button:focus-visible,
      .adahm-node-color-dialog input:focus-visible,
      .adahm-node-color-dialog select:focus-visible,
      .adahm-node-color-dialog textarea:focus-visible { outline:2px solid #87b8fa; outline-offset:2px; }
      .adahm-node-color-dialog button[type=submit] { background:#315d88; color:white; }
      .adahm-node-color-fields { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
      .adahm-node-color-field { display:flex; flex-direction:column; gap:6px; }
      .adahm-node-color-swatch { height:26px; border:1px solid var(--border-color,#666); border-radius:5px; }
      .adahm-node-color-link { display:flex; align-items:center; gap:8px; margin:14px 0 6px; }
      .adahm-node-color-preview { margin:14px 0; border:1px solid #777; border-radius:7px; overflow:hidden; }
      .adahm-node-color-preview > div { padding:9px 12px; color:white; text-shadow:0 1px 3px black; }
      .adahm-node-color-preview > div:last-child { min-height:55px; }
      .adahm-node-color-favorites { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin:10px 0; }
      .adahm-node-color-favorite { display:flex; gap:5px; min-width:0; }
      .adahm-node-color-favorite button:first-child { flex:1; border-left-width:10px; font-family:monospace; }
      .adahm-node-color-status { min-height:22px; overflow-wrap:anywhere; }
      .adahm-node-color-actions { display:flex; flex-wrap:wrap; justify-content:flex-end; gap:8px; margin-top:12px; }
      .adahm-node-color-dialog textarea { width:100%; min-height:110px; font-family:monospace; }
      @media(max-width:400px) { .adahm-node-color-fields, .adahm-node-color-favorites { grid-template-columns:1fr; } }
    `;
    document.head.append(style);
}

function modal(title, description) {
    injectStyles();
    activeDialog?.close();
    const previousFocus = document.activeElement;
    const dialog = element("dialog", "adahm-node-color-dialog");
    const heading = element("h2", "", title);
    heading.id = "adahm-node-color-heading";
    dialog.setAttribute("aria-labelledby", heading.id);
    dialog.append(heading, element("p", "", description));
    const status = element("div", "adahm-node-color-status");
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    dialog.addEventListener("close", () => {
        if (activeDialog === dialog) activeDialog = undefined;
        dialog.remove();
        if (previousFocus?.isConnected) previousFocus.focus?.();
    }, { once: true });
    // Keep graph shortcuts and pointer handlers out of these controls.
    for (const event of ["keydown", "pointerdown", "wheel"]) {
        dialog.addEventListener(event, (e) => e.stopPropagation());
    }
    document.body.append(dialog);
    activeDialog = dialog;
    return { dialog, status };
}

function manualClipboard(mode, text, accept) {
    const copying = mode === "copy";
    const { dialog, status } = modal(copying ? "Copy current color" : "Paste color",
        copying ? "Clipboard access is unavailable. Copy the selected color pair with Ctrl+C."
            : "Paste a HEX color or a copied Header/Body color pair below.");
    const input = element("textarea");
    input.setAttribute("aria-label", "Color clipboard text");
    input.value = text;
    input.readOnly = copying;
    const actions = element("div", "adahm-node-color-actions");
    actions.append(button(copying ? "Done" : "Cancel", () => dialog.close()));
    if (!copying) {
        actions.append(button("Paste", () => {
            try { accept(input.value); dialog.close(); }
            catch (error) { status.textContent = error.message; }
        }));
    }
    dialog.append(input, status, actions);
    dialog.showModal();
    input.focus();
    if (copying) input.select();
}

function showError(message) {
    const { dialog } = modal("Node color", message);
    dialog.append(button("Close", () => dialog.close()));
    dialog.showModal();
}

async function copyColor(values, report) {
    const text = JSON.stringify(values);
    try {
        if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
        await navigator.clipboard.writeText(text);
        report?.("Header and Body copied.");
    } catch {
        // Inline fallback preserves an open color editor and its draft.
        if (report) report("Select and copy the text below with Ctrl+C.", text);
        else manualClipboard("copy", text);
    }
}

async function pasteColor(accept, report) {
    let text;
    try {
        if (!navigator.clipboard?.readText) throw new Error("Clipboard unavailable");
        text = await navigator.clipboard.readText();
    } catch {
        if (report) report("Paste into the text field below, then choose Use pasted color.", "");
        else manualClipboard("paste", "", accept);
        return;
    }
    try { accept(text); }
    catch (error) {
        if (report) report(error.message, text);
        else manualClipboard("paste", text, accept);
    }
}

function openEditor(graph, targets, canvas, title, reference = targets[0]) {
    if (!targets.length) return;
    const { dialog, status } = modal(title,
        `Apply to ${targets.length} node${targets.length === 1 ? "" : "s"} in the displayed graph. Changes are saved only when you choose Apply.`);
    const initial = currentColors(reference);
    const form = element("form");
    const fields = element("div", "adahm-node-color-fields");
    const controls = {};
    for (const [key, label] of [["color", "Header / Title"], ["bgcolor", "Body / Background"]]) {
        const row = element("label", "adahm-node-color-field", label);
        const input = element("input");
        input.type = "text";
        input.value = initial[key];
        input.placeholder = "#3B4252";
        input.maxLength = 7;
        input.spellcheck = false;
        input.autocomplete = "off";
        input.setAttribute("aria-label", `${label} HEX color`);
        const swatch = element("div", "adahm-node-color-swatch");
        swatch.setAttribute("aria-hidden", "true");
        row.append(input, swatch);
        fields.append(row);
        controls[key] = { input, swatch };
    }
    const linked = element("input");
    linked.type = "checkbox";
    linked.checked = prefs().linked;
    const linkLabel = element("label", "adahm-node-color-link");
    linkLabel.append(linked, document.createTextNode("Link title/background"));
    const help = element("p", "", "When linked, the Body is derived from the Header (25% darker).");
    const preview = element("div", "adahm-node-color-preview");
    const previewHeader = element("div", "", "Header / Title preview");
    const previewBody = element("div", "", "Body / Background preview");
    preview.append(previewHeader, previewBody);
    const favoriteLabel = element("label", "", "Favorites use: ");
    const favoriteField = element("select");
    favoriteField.setAttribute("aria-label", "Color field for favorites");
    for (const [value, label] of [["color", "Header"], ["bgcolor", "Body"]]) {
        const option = element("option", "", label);
        option.value = value;
        favoriteField.append(option);
    }
    favoriteLabel.append(favoriteField);
    const favorites = element("div", "adahm-node-color-favorites");
    const clipboardText = element("textarea");
    clipboardText.hidden = true;
    clipboardText.setAttribute("aria-label", "Manual color clipboard");
    const usePasted = button("Use pasted color", () => {
        try { acceptClipboard(clipboardText.value); clipboardText.hidden = usePasted.hidden = true; }
        catch (error) { status.textContent = error.message; }
    });
    usePasted.hidden = true;
    const reportClipboard = (message, text) => {
        if (!dialog.isConnected) return;
        status.textContent = message;
        if (text == null) return;
        clipboardText.hidden = false;
        usePasted.hidden = false;
        clipboardText.value = text;
        clipboardText.focus();
        clipboardText.select();
    };
    const readValues = () => {
        const color = normalizeHex(controls.color.input.value);
        const bgcolor = normalizeHex(controls.bgcolor.input.value);
        if (!color || !bgcolor) throw new Error("Both Header and Body must contain valid HEX colors.");
        return { color, bgcolor };
    };
    const refresh = () => {
        if (linked.checked && normalizeHex(controls.color.input.value)) {
            controls.bgcolor.input.value = companionBody(controls.color.input.value);
        }
        controls.bgcolor.input.disabled = linked.checked;
        favoriteField.options[1].disabled = linked.checked;
        if (linked.checked) favoriteField.value = "color";
        for (const [key, target] of [["color", previewHeader], ["bgcolor", previewBody]]) {
            const hex = normalizeHex(controls[key].input.value);
            controls[key].input.setAttribute("aria-invalid", String(!hex));
            if (hex) controls[key].swatch.style.backgroundColor = target.style.backgroundColor = hex;
        }
    };
    const acceptClipboard = (text) => {
        if (!dialog.isConnected) return;
        const values = parseColorClipboard(text);
        // Copy/Paste carries both independent colors. Unlink when pasting a
        // pair so a previously linked setting cannot silently alter its body.
        if (!normalizeHex(text)) {
            linked.checked = false;
            prefs().setLinked(false);
        }
        controls.color.input.value = values.color;
        controls.bgcolor.input.value = values.bgcolor;
        refresh();
        status.textContent = "Color pasted into the preview. Choose Apply to save.";
    };
    const renderFavorites = () => {
        favorites.replaceChildren();
        prefs().favorites.forEach((hex, index) => {
            const row = element("div", "adahm-node-color-favorite");
            const use = button(`${index + 1}: ${hex}`, () => {
                controls[favoriteField.value].input.value = prefs().favorites[index];
                refresh();
            });
            use.style.borderLeftColor = hex;
            use.title = `Use favorite ${index + 1} for the chosen field`;
            const save = button("Save", () => {
                try {
                    const persisted = prefs().saveFavorite(index, controls[favoriteField.value].input.value);
                    renderFavorites();
                    status.textContent = persisted ? `Favorite ${index + 1} saved.`
                        : "Favorite saved for this page only; browser storage is unavailable.";
                } catch (error) { status.textContent = error.message; }
            });
            save.setAttribute("aria-label", `Save chosen field as favorite ${index + 1}`);
            row.append(use, save);
            favorites.append(row);
        });
    };
    for (const [key, { input }] of Object.entries(controls)) {
        input.addEventListener("input", refresh);
        input.addEventListener("focus", () => { favoriteField.value = key; });
        input.addEventListener("blur", () => {
            const hex = normalizeHex(input.value);
            if (hex) input.value = hex;
        });
    }
    linked.addEventListener("change", () => {
        const persisted = prefs().setLinked(linked.checked);
        refresh();
        if (!persisted) status.textContent = "Link preference kept for this page only; browser storage is unavailable.";
    });
    const clipboardActions = element("div", "adahm-node-color-actions");
    clipboardActions.append(button("Copy current color", () => {
        try { void copyColor(readValues(), reportClipboard); }
        catch (error) { status.textContent = error.message; }
    }), button("Paste color", () => { void pasteColor(acceptClipboard, reportClipboard); }));
    const actions = element("div", "adahm-node-color-actions");
    const apply = element("button", "", "Apply");
    apply.type = "submit";
    actions.append(button("Cancel", () => dialog.close()), apply);
    form.addEventListener("submit", (event) => {
        event.preventDefault();
        try {
            applyNodeColors(graph, targets, readValues(), canvas);
            dialog.close();
        } catch (error) { status.textContent = error.message; }
    });
    form.append(fields, linkLabel, help, preview, favoriteLabel, favorites,
        clipboardActions, clipboardText, usePasted, status, actions);
    dialog.append(form);
    renderFavorites();
    refresh();
    dialog.showModal();
    controls.color.input.focus();
    controls.color.input.select();
}

function scopedMenuItems(graph, canvas) {
    const selected = selectedNodes(canvas, graph);
    const notes = noteNodes(graph);
    return [
        {
            content: "Set selected nodes color...",
            disabled: !selected.length,
            callback: () => openEditor(graph, selected, canvas, "Selected nodes — HEX color"),
        },
        {
            content: "Set ALL notes color...",
            disabled: !notes.length,
            callback: () => openEditor(graph, notes, canvas, "All notes — HEX color"),
        },
    ];
}

app.registerExtension({
    name: "comfyui.adahm-nodes.hex-colors",
    getNodeMenuItems(node) {
        const canvas = app.canvas;
        const graph = node.graph;
        const targets = nodeColorTargets(node, canvas);
        return [
            null,
            {
                content: "Set HEX Color...",
                callback: () => openEditor(graph, targets, canvas, "Node HEX color", node),
            },
            ...scopedMenuItems(graph, canvas),
            {
                content: "HEX favorite colors",
                submenu: {
                    options: prefs().favorites.map((hex, index) => ({
                        content: `${index + 1}: ${hex}`,
                        callback: () => {
                            try { applyNodeColors(graph, targets, pairFromHex(hex), canvas); }
                            catch (error) { showError(error.message); }
                        },
                    })),
                },
            },
            { content: "Copy current color", callback: () => { void copyColor(currentColors(node)); } },
            { content: "Paste color", callback: () => { void pasteColor((text) =>
                applyNodeColors(graph, targets, parseColorClipboard(text), canvas)); } },
        ];
    },
    getCanvasMenuItems(canvas) {
        return [null, ...scopedMenuItems(canvas.graph, canvas)];
    },
});
