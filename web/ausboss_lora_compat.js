// SPDX-License-Identifier: GPL-3.0-only
// Adahm contributions: Copyright (c) 2026 Adahm83.
// Power LoRA Loader-compatible row format: rgthree-comfy,
// Copyright (c) 2023 Regis Gaughan, III (rgthree), MIT; notice retained in
// THIRD_PARTY_NOTICES.md (https://github.com/rgthree/rgthree-comfy).
// Adahm modifications (2026-10-03): folder population, DOM stack controls,
// read-only metadata popup, and AusBoss chain compatibility.
// See LICENSE and THIRD_PARTY_NOTICES.md. Provided without warranty.

import { app } from "../../scripts/app.js";
import { api } from "/scripts/api.js";

const NODE_TYPE = "AdahmLoraFolderLoader";
const ROOT_FOLDER = "[root]";
const MIN_NODE_WIDTH = 336;
const ROW_HEIGHT = 30;
const ROW_GAP = 2;
const STEP = 0.05;
const SCRUB_PIXELS_PER_STEP = 10;

function normaliseName(value) {
    return String(value ?? "").replaceAll("\\", "/");
}

function nameForDisplay(value) {
    const filename = normaliseName(value).split("/").pop() || "Choose LoRA...";
    return filename.replace(/\.(safetensors|ckpt|pt|pth|bin)$/i, "");
}

function keyForName(value) {
    return normaliseName(value).toLowerCase();
}

function roundStrength(value) {
    return Math.round(Number(value) * 100) / 100;
}

function roundSliderStrength(value) {
    return roundStrength(Math.round(Number(value) / STEP) * STEP);
}

function strengthBarBackground(value) {
    const strength = Number(value);
    if (!Number.isFinite(strength) || Math.abs(strength) < 0.005) {
        return "#23272c";
    }
    const amount = Math.min(1, Math.abs(strength));
    const end = 50 + amount * 50;
    const start = 50 - amount * 50;
    const color = strength >= 0 ? "rgba(0,220,205,.58)" : "rgba(255,138,128,.58)";
    return strength >= 0
        ? `linear-gradient(to right, #23272c 0 50%, ${color} 50% ${end}%, #23272c ${end}% 100%)`
        : `linear-gradient(to right, #23272c 0 ${start}%, ${color} ${start}% 50%, #23272c 50% 100%)`;
}

function injectStyles() {
    if (document.getElementById("adahm-lora-folder-styles")) return;
    const style = document.createElement("style");
    style.id = "adahm-lora-folder-styles";
    style.textContent = `
      .adahm-lora-panel { width:100%; box-sizing:border-box; padding:4px 8px 8px;
        container-type:inline-size; container-name:adahm-lora-panel;
        color:#d7dde2; font:12px system-ui; pointer-events:auto; }
      .adahm-lora-panel, .adahm-lora-panel * { box-sizing:border-box; }
      .adahm-lora-toggle-row { height:28px; display:flex; align-items:center; gap:8px;
        color:#d7dde2; }
      .adahm-lora-toggle { width:30px; height:16px; padding:0; border:0; border-radius:8px;
        background:#3a4047; position:relative; flex:none; cursor:pointer; }
      .adahm-lora-toggle::after { content:""; position:absolute; top:2px; left:2px;
        width:12px; height:12px; border-radius:50%; background:#9ba2aa; transition:left .12s; }
      .adahm-lora-toggle.on { background:#08b7ae; }
      .adahm-lora-toggle.on::after { left:16px; background:#fff; }
      .adahm-lora-toggle.mixed { background:#4d6763; }
      .adahm-lora-toggle.mixed::after { left:9px; background:#cfd6da; }
      .adahm-lora-count { color:#9ba2aa; font-variant-numeric:tabular-nums; }
      .adahm-lora-strength-label { margin-left:auto; color:#9ba2aa; }
      .adahm-lora-stack { display:flex; flex-direction:column; gap:${ROW_GAP}px; }
      .adahm-lora-row { height:${ROW_HEIGHT}px; display:flex; align-items:center; gap:6px;
        min-width:0; }
      .adahm-lora-row.off { opacity:.45; }
      .adahm-lora-row.dragging { position:relative; z-index:2; opacity:.92;
        outline:2px solid #08b7ae; outline-offset:1px; background:#344e50;
        box-shadow:0 4px 12px rgba(0,0,0,.5); transform:scale(1.01); }
      .adahm-lora-row.drop-target { box-shadow:inset 0 -2px 0 #9becf5; }
      .adahm-lora-grip { width:14px; height:24px; padding:0; border:0; background:transparent;
        color:#5c646c; cursor:grab; flex:none; touch-action:none; }
      .adahm-lora-grip:active { cursor:grabbing; }
      .adahm-lora-toggle-row .adahm-lora-grip { display:none; }
      .adahm-lora-name { flex:1 1 auto; min-width:0; height:24px; padding:0 8px;
        border:1px solid #3a4047; border-radius:5px; color:#d7dde2; text-align:left;
        overflow:hidden; text-overflow:ellipsis; white-space:nowrap; cursor:ew-resize;
        touch-action:none; user-select:none; background:#23272c; }
      .adahm-lora-name:hover { border-color:#08b7ae; }
      .adahm-lora-strengthbox { width:68px; height:24px; display:flex; flex:none;
        border:1px solid #3a4047; border-radius:5px; overflow:hidden; background:#23272c; }
      .adahm-lora-strength { width:52px; min-width:0; height:100%; padding:0; border:0;
        background:transparent; color:#e5f4f3; text-align:center; cursor:ew-resize;
        user-select:none; outline:none; }
      .adahm-lora-strength:focus { cursor:text; user-select:text; }
      .adahm-lora-step { width:15px; display:flex; flex-direction:column; border-left:1px solid #3a4047; }
      .adahm-lora-step button { flex:1 1 0; padding:0; border:0; background:transparent;
        color:#9ba2aa; cursor:pointer; line-height:9px; font-size:9px; }
      .adahm-lora-step button:hover { color:#08b7ae; background:rgba(255,255,255,.06); }
      .adahm-lora-actions { display:flex; gap:4px; margin-top:4px; }
      .adahm-lora-actions button { flex:1 1 0; height:26px; padding:0 8px; border:1px solid #08b7ae;
        border-radius:5px; background:#08b7ae; color:#062d30; font-weight:600; cursor:pointer;
        white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
      .adahm-lora-actions button:hover { background:#00c9be; }
      .adahm-lora-actions button.secondary { border-color:#59636a; background:#59636a; color:#e9eeee; }
      .adahm-lora-actions button.secondary:hover { background:#6b767e; }
      .adahm-lora-info { width:24px; height:24px; padding:0; border:1px solid #3a4047;
        border-radius:5px; background:#23272c; color:#9ba2aa; cursor:pointer; flex:none;
        font:700 11px system-ui; }
      .adahm-lora-info:hover { border-color:#08b7ae; color:#08b7ae; }
      .adahm-lora-info-card { position:fixed; z-index:10000; width:336px; max-width:calc(100vw - 16px);
        max-height:calc(100vh - 16px); overflow:auto; padding:10px; border:1px solid #3a4047;
        border-radius:7px; background:#1c1f23; box-shadow:0 8px 28px rgba(0,0,0,.5);
        color:#d7dde2; font:12px system-ui; pointer-events:auto; }
      .adahm-lora-info-card img { display:block; max-width:100%; max-height:240px; margin:0 auto 10px;
        border-radius:4px; object-fit:contain; }
      .adahm-lora-info-card h4 { margin:0 0 8px; color:#f1f5f5; font-size:14px; }
      .adahm-lora-info-meta { margin:6px 0; color:#aeb7bc; line-height:1.35; }
      .adahm-lora-info-label { margin-top:10px; color:#aeb7bc; }
      .adahm-lora-info-words { margin-top:4px; color:#e2e8e8; line-height:1.45; overflow-wrap:anywhere; }
      .adahm-lora-info-link { display:inline-block; margin:8px 0 2px; color:#08c8bd; text-decoration:none; }
      .adahm-lora-info-link:hover { color:#9becf5; text-decoration:underline; }
      .adahm-lora-info-empty { color:#9ba2aa; font-style:italic; }
      .adahm-lora-panel button:focus-visible, .adahm-lora-panel input:focus-visible {
        outline:2px solid #9becf5; outline-offset:1px; }
      .adahm-lora-short { display:none; }
      @container adahm-lora-panel (max-width:480px) {
        .adahm-lora-full { display:none; }
        .adahm-lora-short { display:inline; }
      }
    `;
    document.head.append(style);
}

class HiddenLoraWidget {
    constructor(name, value) {
        this.name = name;
        this.type = "custom";
        this.value = { ...value };
        this.serialize = true;
        this.hidden = true;
        this.options = { serialize: true };
        this.__adahmLoraRow = true;
        this.y = 0;
        this.last_y = 0;
    }

    computeSize() {
        return [0, 0];
    }

    draw() {}

    mouse() {
        return false;
    }

    serializeValue() {
        return { ...this.value };
    }
}

async function listLoras(folder = ROOT_FOLDER, recursive = false) {
    const query = new URLSearchParams({ folder, recursive: String(Boolean(recursive)) });
    const response = await api.fetchApi(`/adahm/lora/list?${query.toString()}`);
    if (!response.ok) throw new Error(`LoRA list request failed (${response.status})`);
    const data = await response.json();
    return Array.isArray(data.loras) ? data.loras : [];
}

let activeLoraInfo = null;

function closeLoraInfo() {
    if (!activeLoraInfo) return;
    activeLoraInfo.cleanup?.();
    activeLoraInfo.abort?.abort();
    activeLoraInfo.card.remove();
    activeLoraInfo = null;
}

function positionLoraInfo(card, anchor) {
    const rect = anchor.getBoundingClientRect();
    const margin = 8;
    const width = card.offsetWidth || 336;
    const height = card.offsetHeight || 260;
    let left = rect.right + margin;
    let top = rect.top;
    if (left + width > window.innerWidth - margin) left = rect.left - width - margin;
    if (left < margin) left = margin;
    if (top + height > window.innerHeight - margin) top = window.innerHeight - height - margin;
    if (top < margin) top = margin;
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
}

function formatInfoSize(bytes) {
    let value = Number(bytes);
    if (!Number.isFinite(value) || value < 0) return "";
    let unit = "B";
    for (const next of ["KB", "MB", "GB", "TB"]) {
        if (value < 1024) break;
        value /= 1024;
        unit = next;
    }
    return `${unit === "B" ? Math.round(value) : value.toFixed(1).replace(/\.0$/, "")} ${unit}`;
}

function appendInfoWordGroup(card, label, words) {
    if (!Array.isArray(words) || !words.length) return;
    const heading = document.createElement("div");
    heading.className = "adahm-lora-info-label";
    heading.textContent = label;
    const list = document.createElement("div");
    list.className = "adahm-lora-info-words";
    list.textContent = words.join(", ");
    card.append(heading, list);
}

function openLoraInfo(node, index, anchor) {
    const row = stateRows(node)[index];
    if (!row?.lora) return;
    closeLoraInfo();

    const card = document.createElement("div");
    card.className = "adahm-lora-info-card";
    const loading = document.createElement("div");
    loading.className = "adahm-lora-info-empty";
    loading.textContent = "Loading...";
    card.append(loading);
    document.body.append(card);
    const abort = new AbortController();
    activeLoraInfo = { card, abort };
    positionLoraInfo(card, anchor);

    const outside = (event) => {
        if (!card.contains(event.target) && event.target !== anchor) closeLoraInfo();
    };
    const escape = (event) => { if (event.key === "Escape") closeLoraInfo(); };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", escape, true);
    const cleanup = activeLoraInfo.cleanup = () => {
        document.removeEventListener("pointerdown", outside, true);
        document.removeEventListener("keydown", escape, true);
    };

    const render = (info) => {
        card.textContent = "";
        if (info.has_preview) {
            const image = document.createElement("img");
            image.alt = "";
            image.src = api.apiURL(`/adahm/lora/thumb?name=${encodeURIComponent(row.lora)}`);
            image.addEventListener("error", () => image.remove());
            card.append(image);
        }
        const title = document.createElement("h4");
        title.textContent = info.civitai_title || nameForDisplay(row.lora);
        card.append(title);
        if (info.base_model) {
            const base = document.createElement("div");
            base.className = "adahm-lora-info-meta";
            base.textContent = `Base model: ${info.base_model}`;
            card.append(base);
        }
        const size = formatInfoSize(info.size_bytes);
        if (size) {
            const modified = Number.isFinite(Number(info.mtime))
                ? ` · modified ${new Date(Number(info.mtime) * 1000).toLocaleDateString()}` : "";
            const file = document.createElement("div");
            file.className = "adahm-lora-info-meta";
            file.textContent = `${size}${modified}`;
            card.append(file);
        }
        if (Number.isInteger(info.civitai_model_id)) {
            const link = document.createElement("a");
            link.className = "adahm-lora-info-link";
            link.textContent = "View on Civitai ↗";
            const version = Number.isInteger(info.civitai_version_id)
                ? `?modelVersionId=${info.civitai_version_id}` : "";
            link.href = `https://civitai.red/models/${info.civitai_model_id}${version}`;
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            card.append(link);
        }
        appendInfoWordGroup(card, "Trigger words from the file", info.file_triggers);
        appendInfoWordGroup(card, "Trigger words from Civitai", info.civitai_triggers);
        if (info.range && (info.range.min != null || info.range.max != null)) {
            const range = document.createElement("div");
            range.className = "adahm-lora-info-meta";
            const min = info.range.min == null ? "any" : info.range.min;
            const max = info.range.max == null ? "any" : info.range.max;
            range.textContent = `Suggested strength: ${min} to ${max}`;
            card.append(range);
        }
        positionLoraInfo(card, anchor);
    };

    api.fetchApi(`/adahm/lora/info?name=${encodeURIComponent(row.lora)}`, { signal: abort.signal })
        .then((response) => response.json())
        .then((data) => {
            if (!data.ok) throw new Error(data.error);
            render(data.info);
        })
        .catch((error) => {
            if (error?.name === "AbortError") return;
            card.textContent = "";
            const message = document.createElement("div");
            message.className = "adahm-lora-info-empty";
            message.textContent = "Could not read LoRA info.";
            card.append(message);
            positionLoraInfo(card, anchor);
        });
}

function isLoraWidget(widget) {
    return Boolean(widget?.__adahmLoraRow ||
        (widget?.name?.startsWith("lora_") && widget?.value && typeof widget.value === "object" && widget.value.lora));
}

function loraWidgets(node) {
    return (node.widgets ?? []).filter(isLoraWidget);
}

function addHiddenWidget(node, widget) {
    node.widgets ??= [];
    node.widgets.push(widget);
    return widget;
}

function stateRows(node) {
    return node.__adahmLoraState?.rows ?? loraWidgets(node).map((widget) => widget.value);
}

function normaliseRow(row) {
    const strength = Number(row?.strength);
    const safeStrength = Number.isFinite(strength) ? strength : 1;
    const strengthTwo = row?.strengthTwo == null ? safeStrength : Number(row.strengthTwo);
    return {
        on: row?.on !== false,
        lora: String(row?.lora ?? ""),
        strength: safeStrength,
        strengthTwo: Number.isFinite(strengthTwo) ? strengthTwo : safeStrength,
    };
}

function formatStackStrength(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return "1.0";
    const normalised = Object.is(number, -0) ? 0 : number;
    const text = String(normalised);
    return text.includes(".") || text.toLowerCase().includes("e") ? text : `${text}.0`;
}

function buildStackText(rows) {
    const groups = new Map();
    rows
        .filter((row) => row?.lora && row.on !== false)
        .forEach((row) => {
            const parts = normaliseName(row.lora).split("/").filter(Boolean);
            const name = parts.pop() || "";
            const folder = parts.length ? parts.join("\\") : ROOT_FOLDER;
            if (!groups.has(folder)) groups.set(folder, []);
            groups.get(folder).push(`${name}: ${formatStackStrength(row.strength)}  `);
        });
    const text = [...groups.entries()]
        .map(([folder, entries]) => `### ${folder}\n${entries.join("\n")}`)
        .join("\n");
    return text ? `${text}\n\n` : "";
}

function ensureStackTextWidget(node) {
    let widget = node.widgets?.find((item) => item.name === "__adahm_stack_text");
    if (!widget && typeof node.addWidget === "function") {
        widget = node.addWidget("text", "__adahm_stack_text", "", () => {}, {
            serialize: true,
            hidden: true,
        });
    }
    if (!widget) return null;
    widget.hidden = true;
    widget.options ??= {};
    widget.options.serialize = true;
    widget.options.hidden = true;
    widget.computeSize = () => [0, 0];
    return widget;
}

function serializedWidgetValues(node, preserved) {
    const values = [];
    for (const widget of preserved) {
        if (widget?.options?.serialize === false) continue;
        let value = widget?.value;
        if (typeof widget?.serializeValue === "function") {
            try {
                value = widget.serializeValue(node, values.length);
            } catch {
                value = widget.value;
            }
        }
        if (value !== undefined) values.push(value);
    }
    return values;
}

function syncSerializedWidgets(node, preserved, rows) {
    node.widgets_values = [
        ...serializedWidgetValues(node, preserved),
        ...rows.map((row) => ({ ...row })),
    ];
}

function syncHiddenRows(node, rows) {
    const normalized = rows.map(normaliseRow);
    if (node.__adahmLoraState) node.__adahmLoraState.rows = normalized;
    const stackTextWidget = ensureStackTextWidget(node);
    const preserved = (node.widgets ?? []).filter((widget) => !isLoraWidget(widget));
    node.widgets = preserved;
    normalized.forEach((row, index) => {
        addHiddenWidget(node, new HiddenLoraWidget(`lora_${index + 1}`, row));
    });
    if (stackTextWidget) stackTextWidget.value = buildStackText(normalized);
    syncSerializedWidgets(node, preserved, normalized);
}

function setRows(node, rows, render = true) {
    const state = node.__adahmLoraState;
    if (state) state.rows = rows;
    syncHiddenRows(node, rows);
    if (render) renderRows(node);
    node.graph?.setDirtyCanvas?.(true, true);
}

function existingNames(rows) {
    return new Set(rows.map((row) => keyForName(row.lora)));
}

function toggleAll(node) {
    const rows = stateRows(node);
    const turnOn = rows.length === 0 || rows.some((row) => row.on === false);
    setRows(node, rows.map((row) => ({ ...row, on: turnOn })));
}

function clearAll(node) {
    setRows(node, []);
}

function addRows(node, names) {
    const rows = stateRows(node);
    const known = existingNames(rows);
    const added = [...rows];
    for (const name of names) {
        if (!name || known.has(keyForName(name))) continue;
        known.add(keyForName(name));
        added.push({ on: true, lora: name, strength: 1 });
    }
    setRows(node, added);
}

function openAddPicker(node, event) {
    listLoras(ROOT_FOLDER, true)
        .then((names) => {
            if (!names.length) {
                window.alert("No LoRAs are registered in ComfyUI.");
                return;
            }
            new LiteGraph.ContextMenu(names, {
                event,
                title: "Add LoRA",
                callback: (name) => addRows(node, [name]),
            });
        })
        .catch((error) => window.alert(error.message));
}

function openReplacePicker(node, rowIndex, event) {
    listLoras(ROOT_FOLDER, true)
        .then((names) => {
            if (!names.length) {
                window.alert("No LoRAs are registered in ComfyUI.");
                return;
            }
            new LiteGraph.ContextMenu(names, {
                event,
                title: "Replace LoRA",
                callback: (name) => {
                    const rows = stateRows(node);
                    if (!rows[rowIndex]) return;
                    const next = rows.map((row, index) =>
                        index === rowIndex ? { ...row, lora: name } : row,
                    );
                    setRows(node, next);
                },
            });
        })
        .catch((error) => window.alert(error.message));
}

function selectedFolder(node) {
    const folder = node.widgets?.find((widget) => widget.name === "folder")?.value ?? ROOT_FOLDER;
    const recursive = node.widgets?.find((widget) => widget.name === "recursive")?.value ?? false;
    return { folder, recursive };
}

function loadAll(node) {
    const { folder, recursive } = selectedFolder(node);
    listLoras(folder, recursive)
        .then((names) => addRows(node, names))
        .catch((error) => window.alert(error.message));
}

function formatStrength(value) {
    return Number(value).toFixed(2);
}

function commitStrength(node, rowIndex, value) {
    const rows = stateRows(node);
    if (!rows[rowIndex]) return;
    const number = Number(value);
    if (!Number.isFinite(number)) return;
    const next = rows.map((row, index) => index === rowIndex ? { ...row, strength: number } : row);
    setRows(node, next, false);
    updateRows(node);
}

function stepStrength(node, rowIndex, direction) {
    const rows = stateRows(node);
    const value = Number(rows[rowIndex]?.strength ?? 1) + STEP * direction;
    commitStrength(node, rowIndex, roundStrength(value));
}

function scrubStrength(node, rowIndex, start, dx) {
    const steps = Math.trunc(dx / SCRUB_PIXELS_PER_STEP);
    commitStrength(node, rowIndex, roundSliderStrength(start + steps * STEP));
}

function insertEmptyRow(node, index) {
    const rows = stateRows(node);
    const next = [...rows];
    next.splice(index, 0, { on: true, lora: "", strength: 1, strengthTwo: 1 });
    setRows(node, next);
}

function moveRow(node, index, direction) {
    const rows = stateRows(node);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= rows.length) return;
    const next = [...rows];
    const [row] = next.splice(index, 1);
    next.splice(target, 0, row);
    setRows(node, next);
}

function removeRow(node, index) {
    const rows = stateRows(node);
    if (index < 0 || index >= rows.length) return;
    const next = [...rows];
    next.splice(index, 1);
    setRows(node, next);
}

function openRowMenu(node, index, event) {
    const rows = stateRows(node);
    const items = [
        { content: "Insert empty LoRA above", value: "insert_above" },
        { content: "Insert empty LoRA below", value: "insert_below" },
        null,
        { content: "Move up", value: "move_up", disabled: index === 0 },
        { content: "Move down", value: "move_down", disabled: index === rows.length - 1 },
        null,
        { content: "Remove this LoRA", value: "remove", className: "litemenu-entry-danger" },
    ];
    new LiteGraph.ContextMenu(items, {
        event,
        title: nameForDisplay(rows[index]?.lora || "LoRA"),
        callback: (choice) => {
            const action = typeof choice === "string" ? choice : choice?.value;
            if (action === "insert_above") insertEmptyRow(node, index);
            else if (action === "insert_below") insertEmptyRow(node, index + 1);
            else if (action === "move_up") moveRow(node, index, -1);
            else if (action === "move_down") moveRow(node, index, 1);
            else if (action === "remove") removeRow(node, index);
        },
    });
}

function switchButton(row, onClick) {
    const button = document.createElement("button");
    button.className = `adahm-lora-toggle${row.on !== false ? " on" : ""}`;
    button.type = "button";
    button.title = "Enable or disable this LoRA";
    button.addEventListener("click", onClick);
    return button;
}

function strengthBox(node, rowIndex) {
    const box = document.createElement("div");
    box.className = "adahm-lora-strengthbox";
    const input = document.createElement("input");
    input.className = "adahm-lora-strength";
    input.value = formatStrength(stateRows(node)[rowIndex].strength);
    input.readOnly = true;
    let drag = null;
    input.addEventListener("pointerdown", (event) => {
        if (event.button !== 0) return;
        drag = { x: event.clientX, start: stateRows(node)[rowIndex].strength, scrubbed: false };
        input.setPointerCapture?.(event.pointerId);
        event.stopPropagation();
        event.preventDefault();
    });
    input.addEventListener("pointermove", (event) => {
        if (!drag) return;
        const dx = event.clientX - drag.x;
        if (Math.abs(dx) > 3) drag.scrubbed = true;
        if (drag.scrubbed) {
            scrubStrength(node, rowIndex, drag.start, dx);
            input.value = formatStrength(stateRows(node)[rowIndex].strength);
        }
    });
    const endDrag = (event) => {
        if (!drag) return;
        try { input.releasePointerCapture?.(event.pointerId); } catch {}
        const wasClick = !drag.scrubbed;
        drag = null;
        if (wasClick) {
            input.readOnly = false;
            input.focus();
            input.select();
        }
        event.stopPropagation();
    };
    input.addEventListener("pointerup", endDrag);
    input.addEventListener("pointercancel", endDrag);
    input.addEventListener("keydown", (event) => {
        event.stopPropagation();
        if (event.key === "Enter") {
            input.blur();
        } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            stepStrength(node, rowIndex, event.key === "ArrowUp" ? 1 : -1);
            input.value = formatStrength(stateRows(node)[rowIndex].strength);
            input.select();
        }
    });
    input.addEventListener("blur", () => {
        if (!input.readOnly) commitStrength(node, rowIndex, input.value);
        input.readOnly = true;
        input.value = formatStrength(stateRows(node)[rowIndex]?.strength ?? 1);
    });

    const steps = document.createElement("div");
    steps.className = "adahm-lora-step";
    const up = document.createElement("button");
    up.type = "button";
    up.textContent = "▲";
    up.title = "Increase strength by 0.05";
    up.addEventListener("click", (event) => { event.stopPropagation(); stepStrength(node, rowIndex, 1); input.value = formatStrength(stateRows(node)[rowIndex].strength); });
    const down = document.createElement("button");
    down.type = "button";
    down.textContent = "▼";
    down.title = "Decrease strength by 0.05";
    down.addEventListener("click", (event) => { event.stopPropagation(); stepStrength(node, rowIndex, -1); input.value = formatStrength(stateRows(node)[rowIndex].strength); });
    steps.append(up, down);
    box.append(input, steps);
    return box;
}

function reorderRows(node, from, to) {
    const rows = stateRows(node);
    if (from === to || from < 0 || to < 0 || to >= rows.length) return;
    const next = [...rows];
    const [row] = next.splice(from, 1);
    next.splice(to, 0, row);
    setRows(node, next);
}

function renderRows(node) {
    const state = node.__adahmLoraState;
    if (!state?.stack) return;
    state.stack.textContent = "";
    const rows = stateRows(node);
    const allOn = rows.length > 0 && rows.every((row) => row.on !== false);
    const mixed = rows.length > 0 && !allOn && rows.some((row) => row.on !== false);
    state.toggle.classList.toggle("on", allOn);
    state.toggle.classList.toggle("mixed", mixed);
    if (state.count) {
        const active = rows.filter((row) => row.on !== false).length;
        state.count.textContent = `${active}/${rows.length}`;
    }
    rows.forEach((row, index) => {
        const rowElement = document.createElement("div");
        const rowKey = keyForName(row.lora);
        const isDragging = state.draggingKey === rowKey;
        const isDropTarget = state.draggingKey && state.dragTarget === index;
        rowElement.className = `adahm-lora-row${row.on === false ? " off" : ""}${isDragging ? " dragging" : ""}${isDropTarget ? " drop-target" : ""}`;
        rowElement.addEventListener("contextmenu", (event) => {
            event.preventDefault();
            event.stopPropagation();
            openRowMenu(node, index, event);
        });
        const grip = document.createElement("button");
        grip.className = "adahm-lora-grip";
        grip.type = "button";
        grip.textContent = "⠿";
        grip.title = "Drag to reorder";
        let drag = null;
        grip.addEventListener("pointerdown", (event) => {
            if (event.button !== 0 || rows.length < 2) return;
            drag = { startY: event.clientY, current: index };
            state.draggingKey = rowKey;
            state.dragTarget = index;
            rowElement.classList.add("dragging");
            event.preventDefault();
            event.stopPropagation();
            const move = (moveEvent) => {
                if (!drag) return;
                const delta = moveEvent.clientY - drag.startY;
                const target = Math.max(0, Math.min(rows.length - 1, index + Math.round(delta / ROW_HEIGHT)));
                if (target !== drag.current) {
                    const currentRows = stateRows(node);
                    const next = [...currentRows];
                    const [moved] = next.splice(drag.current, 1);
                    next.splice(target, 0, moved);
                    drag.current = target;
                    state.dragTarget = target;
                    syncHiddenRows(node, next);
                    state.rows = next;
                    renderRows(node);
                    node.graph?.setDirtyCanvas?.(true, true);
                }
            };
            const finish = () => {
                if (!drag) return;
                window.removeEventListener("pointermove", move, true);
                rowElement.classList.remove("dragging");
                drag = null;
                state.draggingKey = null;
                state.dragTarget = -1;
                renderRows(node);
            };
            window.addEventListener("pointermove", move, true);
            window.addEventListener("pointerup", finish, { once: true, capture: true });
            window.addEventListener("pointercancel", finish, { once: true, capture: true });
        });

        const toggle = switchButton(row, () => {
            const next = stateRows(node).map((entry, i) => i === index ? { ...entry, on: !entry.on } : entry);
            setRows(node, next);
        });

        const name = document.createElement("div");
        name.className = "adahm-lora-name";
        name.textContent = nameForDisplay(row.lora);
        name.title = `${normaliseName(row.lora)}\nDouble-click to replace this LoRA`;
        name.addEventListener("dblclick", (event) => {
            event.preventDefault();
            event.stopPropagation();
            openReplacePicker(node, index, event);
        });
        let nameDrag = null;
        name.addEventListener("pointerdown", (event) => {
            if (event.button !== 0) return;
            nameDrag = { x: event.clientX, start: stateRows(node)[index].strength, scrubbed: false };
            name.setPointerCapture?.(event.pointerId);
            event.preventDefault();
            event.stopPropagation();
        });
        name.addEventListener("pointermove", (event) => {
            if (!nameDrag) return;
            const dx = event.clientX - nameDrag.x;
            if (Math.abs(dx) > 3) nameDrag.scrubbed = true;
            if (nameDrag.scrubbed) {
                scrubStrength(node, index, nameDrag.start, dx);
                name.style.background = strengthBarBackground(stateRows(node)[index].strength);
            }
        });
        const endNameDrag = (event) => {
            if (!nameDrag) return;
            try { name.releasePointerCapture?.(event.pointerId); } catch {}
            nameDrag = null;
            event.stopPropagation();
        };
        name.addEventListener("pointerup", endNameDrag);
        name.addEventListener("pointercancel", endNameDrag);
        name.style.background = strengthBarBackground(row.strength);

        rowElement.append(grip, toggle, name, strengthBox(node, index));
        const info = document.createElement("button");
        info.className = "adahm-lora-info";
        info.type = "button";
        info.textContent = "i";
        info.title = "Preview and LoRA details";
        info.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            openLoraInfo(node, index, info);
        });
        rowElement.append(info);
        state.stack.append(rowElement);
    });
    state.stack.style.minHeight = rows.length ? `${rows.length * (ROW_HEIGHT + ROW_GAP)}px` : "34px";
    fitNode(node);
}

function updateRows(node) {
    const state = node.__adahmLoraState;
    if (!state?.stack) return;
    const rowElements = [...state.stack.querySelectorAll(".adahm-lora-row")];
    stateRows(node).forEach((row, index) => {
        const element = rowElements[index];
        if (!element) return;
        element.classList.toggle("off", row.on === false);
        const name = element.querySelector(".adahm-lora-name");
        if (name) name.style.background = strengthBarBackground(row.strength);
        const input = element.querySelector(".adahm-lora-strength");
        if (input && document.activeElement !== input) input.value = formatStrength(row.strength);
        const toggle = element.querySelector(".adahm-lora-toggle");
        toggle?.classList.toggle("on", row.on !== false);
    });
    node.graph?.setDirtyCanvas?.(true, true);
}

function fitNode(node) {
    if (!node.__adahmLoraState) return;
    const width = Math.max(MIN_NODE_WIDTH, node.size?.[0] ?? MIN_NODE_WIDTH);
    const previousHeight = node.size?.[1] ?? 200;
    const currentSize = node.size;
    let computedHeight = previousHeight;
    if (currentSize && typeof node.computeSize === "function") {
        // LiteGraph may treat the current height as a lower bound. Clear that
        // bound while measuring so a previously large node can shrink again.
        const savedHeight = currentSize[1];
        currentSize[1] = 0;
        try {
            const computed = node.computeSize();
            if (Number.isFinite(computed?.[1]) && computed[1] > 0) computedHeight = computed[1];
        } finally {
            currentSize[1] = savedHeight;
        }
    }
    setAutoNodeSize(node, [width, Math.max(200, computedHeight)]);
}

function setAutoNodeSize(node, size) {
    node.__adahmAutoSizing = true;
    try {
        node.setSize?.(size);
    } finally {
        node.__adahmAutoSizing = false;
    }
}

function panelMinHeight(node, panel) {
    // The DOM widget stretches to the allocated node height. Its scrollHeight
    // therefore includes unused space and must not become a new minimum.
    // Measure from the fixed controls and current rows, including when empty.
    const rowHeight = stateRows(node).length
        ? stateRows(node).length * (ROW_HEIGHT + ROW_GAP)
        : 34;
    return 12 + 28 + rowHeight + 4 + 26;
}

function installSerialization(node) {
    if (node.__adahmLoraSerializationInstalled) return;
    node.__adahmLoraSerializationInstalled = true;
    const originalOnSerialize = node.onSerialize;
    node.onSerialize = function (serialized) {
        originalOnSerialize?.apply(this, arguments);
        const rows = stateRows(this).map(normaliseRow);
        const preserved = (this.widgets ?? []).filter((widget) => !isLoraWidget(widget));
        const widgetsValues = [
            ...serializedWidgetValues(this, preserved),
            ...rows.map((row) => ({ ...row })),
        ];
        this.widgets_values = widgetsValues;
        if (serialized) serialized.widgets_values = widgetsValues;
    };
}

function installResizeBehavior(node) {
    if (node.__adahmLoraResizeInstalled) return;
    node.__adahmLoraResizeInstalled = true;
    node.resizable = true;

    const originalFindResizeDirection = node.findResizeDirection;
    if (typeof originalFindResizeDirection === "function") {
        node.findResizeDirection = function (x, y) {
            const direction = originalFindResizeDirection.call(this, x, y);
            return direction === "SE" ? direction : undefined;
        };
    }

    const originalSetSize = node.setSize;
    if (typeof originalSetSize === "function") {
        node.setSize = function (size) {
            if (this.__adahmAutoSizing || !this.__adahmLoraState) {
                return originalSetSize.call(this, size);
            }
            const height = this.size?.[1] ?? size?.[1] ?? 200;
            return originalSetSize.call(this, [
                Math.max(MIN_NODE_WIDTH, size?.[0] ?? this.size?.[0] ?? MIN_NODE_WIDTH),
                height,
            ]);
        };
    }
}

function makePanel(node) {
    injectStyles();
    const panel = document.createElement("div");
    panel.className = "adahm-lora-panel";
    ensureStackTextWidget(node);
    const toggleRow = document.createElement("div");
    toggleRow.className = "adahm-lora-toggle-row";
    const toggle = document.createElement("button");
    toggle.className = "adahm-lora-toggle";
    toggle.type = "button";
    const toggleText = document.createElement("span");
    toggleText.textContent = "Toggle All";
    const count = document.createElement("span");
    count.className = "adahm-lora-count";
    toggleRow.append(toggle, toggleText, count);
    const strengthLabel = document.createElement("span");
    strengthLabel.className = "adahm-lora-strength-label";
    strengthLabel.textContent = "Strength";
    toggleRow.append(strengthLabel);
    const stack = document.createElement("div");
    stack.className = "adahm-lora-stack";
    const actions = document.createElement("div");
    actions.className = "adahm-lora-actions";
    const add = document.createElement("button");
    add.type = "button";
    add.innerHTML = '<span class="adahm-lora-full">+ Add LoRA</span><span class="adahm-lora-short">+Add</span>';
    add.addEventListener("click", (event) => openAddPicker(node, event));
    const load = document.createElement("button");
    load.type = "button";
    load.innerHTML = '<span class="adahm-lora-full">Load all LoRAs from folder</span><span class="adahm-lora-short">Load</span>';
    load.addEventListener("click", () => loadAll(node));
    const clear = document.createElement("button");
    clear.type = "button";
    clear.className = "secondary";
    clear.innerHTML = '<span class="adahm-lora-full">Clear All</span><span class="adahm-lora-short">Clear</span>';
    clear.addEventListener("click", () => clearAll(node));
    actions.append(add, load, clear);
    panel.append(toggleRow, stack, actions);
    panel.addEventListener("pointerdown", (event) => event.stopPropagation());
    const initialRows = stateRows(node).map(normaliseRow);
    syncHiddenRows(node, initialRows);
    node.__adahmLoraState = {
        panel,
        toggle,
        count,
        stack,
        rows: initialRows,
        draggingKey: null,
        dragTarget: -1,
    };
    toggle.addEventListener("click", () => toggleAll(node));
    const domWidget = node.addDOMWidget("adahm_lora_panel", "adahm_lora_panel", panel, {
        serialize: false,
        hideOnZoom: false,
        getMinHeight: () => panelMinHeight(node, panel),
    });
    domWidget.serialize = false;
    renderRows(node);
}

function restoreRows(node, info) {
    const saved = (info?.widgets_values ?? []).filter((value) => value && typeof value === "object" && value.lora);
    if (saved.length) {
        syncHiddenRows(node, saved.map((value) => ({
            on: value.on !== false,
            lora: value.lora,
            strength: Number(value.strength ?? 1),
            ...(value.strengthTwo == null ? {} : { strengthTwo: Number(value.strengthTwo) }),
        })));
        node.__adahmLoraState.rows = stateRows(node);
        renderRows(node);
    } else {
        renderRows(node);
    }
}

function install(node) {
    if (node.__adahmLoraInstalled) return;
    node.__adahmLoraInstalled = true;
    node.serialize_widgets = true;
    node.size = node.size || [MIN_NODE_WIDTH, 200];
    node.size[0] = Math.max(node.size[0], MIN_NODE_WIDTH);
    makePanel(node);
    installResizeBehavior(node);
    fitNode(node);
    installSerialization(node);
}

app.registerExtension({
    name: "comfyui.adahm-nodes.lora-folder-loader",
    beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_TYPE) return;
        const originalCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            originalCreated?.apply(this, arguments);
            install(this);
        };
        const originalConfigure = nodeType.prototype.configure;
        nodeType.prototype.configure = function (info) {
            originalConfigure?.apply(this, arguments);
            install(this);
            restoreRows(this, info);
        };
    },
});
