// SPDX-License-Identifier: GPL-3.0-only
// Adahm contributions: Copyright (c) 2026 Adahm83.
// Adapted from Kijai and ComfyUI-KJNodes contributors' dynamic-input helper:
// https://github.com/kijai/ComfyUI-KJNodes/blob/main/web/js/jsnodes.js
// Adahm modifications (2026-10-03): optional string sockets, count bounds,
// retained links, non-serialized controls, and workflow/API restoration.
// See LICENSE and THIRD_PARTY_NOTICES.md. Provided without warranty.

export function setupStringInputs(node) {
    const count = node.widgets?.find((widget) => widget.name === "inputcount");
    if (!count) return;
    const rebuild = () => {
        const target = Math.max(2, Math.min(1000, Math.trunc(Number(count.value) || 2)));
        count.value = target;
        // Remove only trailing string sockets; retained links stay connected.
        for (let index = (node.inputs?.length ?? 0) - 1; index >= 0; index--) {
            const match = /^string_(\d+)$/.exec(node.inputs[index].name);
            if (match && Number(match[1]) > target) node.removeInput(index);
        }
        for (let index = 1; index <= target; index++) {
            if (!node.inputs?.some((input) => input.name === `string_${index}`)) {
                node.addInput(`string_${index}`, "STRING", { shape: 7 });
            }
        }
        node.setSize?.(node.computeSize());
        node.setDirtyCanvas?.(true, true);
    };
    const button = node.addWidget("button", "Update Inputs", null, rebuild);
    button.options = { ...button.options, serialize: false };
    const callback = count.callback;
    count.callback = function (value, canvas) {
        const result = callback?.apply(this, arguments);
        // Restore extra sockets when importing API-format workflows.
        if (!canvas) rebuild();
        return result;
    };
    // Workflow configure restores serialized sockets and links before this hook.
    const configured = node.onConfigure;
    node.onConfigure = function () {
        const result = configured?.apply(this, arguments);
        rebuild();
        return result;
    };
}
