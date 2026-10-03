import assert from "node:assert/strict";
import { test } from "node:test";
import { setupStringInputs } from "../web/text_inputs.js";

function makeNode() {
    return {
        inputs: [{ name: "string_1", link: 10 }, { name: "string_2", link: 11 }],
        widgets: [{ name: "inputcount", value: 2 }],
        addWidget(type, name, value, callback) {
            const widget = { type, name, value, callback };
            this.widgets.push(widget);
            return widget;
        },
        addInput(name, type, options) { this.inputs.push({ name, type, ...options }); },
        removeInput(index) { this.inputs.splice(index, 1); },
        computeSize() { return [250, 150]; },
    };
}

test("Update Inputs grows and shrinks sockets while retaining existing links", () => {
    const node = makeNode();
    setupStringInputs(node);
    const button = node.widgets.find((w) => w.name === "Update Inputs");
    assert.equal(button.options.serialize, false);
    node.widgets[0].value = 4;
    button.callback();
    assert.deepEqual(node.inputs.map((i) => i.name), ["string_1", "string_2", "string_3", "string_4"]);
    assert.equal(node.inputs[0].link, 10);
    assert.equal(node.inputs[1].link, 11);
    node.widgets[0].value = 2;
    button.callback();
    assert.equal(node.inputs.length, 2);
    assert.equal(node.inputs[1].link, 11);
});

test("Workflow restoration and API callbacks restore extra sockets", () => {
    const node = makeNode();
    let configured = false;
    node.onConfigure = () => { configured = true; };
    setupStringInputs(node);
    node.widgets[0].value = 3;
    node.onConfigure();
    assert.equal(configured, true);
    assert.equal(node.inputs.length, 3);
    node.widgets[0].value = 4;
    node.widgets[0].callback(4, {});
    assert.equal(node.inputs.length, 3);
    node.widgets[0].callback(4);
    assert.equal(node.inputs.length, 4);
});
