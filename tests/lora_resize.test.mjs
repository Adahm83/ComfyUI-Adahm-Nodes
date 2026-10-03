import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { test } from "node:test";

// Exercise the extension's actual row removal/render/fit path with DOM and
// LiteGraph boundaries stubbed. No browser or running server is required.
function element() {
    return {
        style: {}, children: [], scrollHeight: 1400,
        classList: { toggle() {}, add() {}, remove() {} },
        addEventListener() {}, append(...items) { this.children.push(...items); },
        set textContent(value) { this.children = []; this.text = value; },
    };
}

function fixture() {
    const source = readFileSync(new URL("../web/ausboss_lora_compat.js", import.meta.url), "utf8")
        .replace(/^import .*;\r?\n/gm, "");
    const context = vm.createContext({
        app: { registerExtension() {} }, api: {},
        document: { createElement: element },
    });
    vm.runInContext(source + "\nthis.hooks = { removeRow, clearAll, fitNode, panelMinHeight };", context);
    const { hooks } = context;
    const rows = Array.from({ length: 8 }, (_, index) => ({
        lora: `folder/${index}.safetensors`, on: true, strength: 0.5,
    }));
    const node = {
        size: [500, 1500], widgets: [],
        __adahmLoraState: {
            rows, panel: element(), stack: element(), toggle: element(), count: element(),
        },
        computeSize() {
            return [this.size[0], Math.max(this.size[1],
                120 + hooks.panelMinHeight(this, this.__adahmLoraState.panel))];
        },
        setSize(size) { this.size = [...size]; },
        graph: { setDirtyCanvas() {} },
    };
    return { node, hooks };
}

test("removing one LoRA shrinks immediately and preserves remaining serialized rows", () => {
    const { node, hooks } = fixture();
    hooks.fitNode(node);
    const previousHeight = node.size[1];
    hooks.removeRow(node, 3);
    assert.equal(node.size[0], 500);
    assert.equal(node.size[1], previousHeight - 32);
    assert.equal(node.__adahmLoraState.rows.length, 7);
    assert.equal(node.__adahmLoraState.stack.children.length, 7);
    const names = Array.from(node.widgets_values, (row) => row.lora);
    assert.equal(names.includes("folder/3.safetensors"), false);
    assert.equal(names.includes("folder/4.safetensors"), true);
});

test("Clear All shrinks to empty controls despite a stretched DOM scrollHeight", () => {
    const { node, hooks } = fixture();
    hooks.clearAll(node);
    assert.equal(node.size[1], 224);
    assert.equal(node.size[0], 500);
    assert.equal(node.__adahmLoraState.rows.length, 0);
    assert.equal(node.__adahmLoraState.stack.children.length, 0);
    assert.equal(node.widgets_values.length, 0);
    hooks.fitNode(node);
    assert.equal(node.size[1], 224);
});
