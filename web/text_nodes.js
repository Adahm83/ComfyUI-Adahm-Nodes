// SPDX-License-Identifier: GPL-3.0-only
// Adahm contributions: Copyright (c) 2026 Adahm83.
// Integration for the KJNodes-based text-node adaptation; original authors:
// Kijai and ComfyUI-KJNodes contributors (https://github.com/kijai/ComfyUI-KJNodes).
// Adahm modifications (2026-10-03): register the helper for Adahm node IDs.
// See LICENSE and THIRD_PARTY_NOTICES.md. Provided without warranty.

import { app } from "../../scripts/app.js";
import { setupStringInputs } from "./text_inputs.js";

app.registerExtension({
    name: "Adahm.TextNodes",
    beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== "AdahmJoinStringMulti") return;
        const created = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const result = created?.apply(this, arguments);
            setupStringInputs(this);
            return result;
        };
    },
});
