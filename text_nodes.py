# SPDX-License-Identifier: GPL-3.0-only
# Adahm contributions: Copyright (c) 2026 Adahm83.
# Adapted from Kijai and ComfyUI-KJNodes contributors:
# https://github.com/kijai/ComfyUI-KJNodes/blob/main/nodes/nodes.py
# Adahm modifications (2026-10-03): optional/empty-safe joining, simplified
# outputs, and retained primitive/list conversion with normal caching.
# See LICENSE and THIRD_PARTY_NOTICES.md. Provided without warranty.

"""Deterministic text utilities using ComfyUI's normal input cache."""


class JoinStringMultiAdahm:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "inputcount": ("INT", {"default": 2, "min": 2, "max": 1000}),
                "delimiter": ("STRING", {"default": " ", "multiline": False}),
            },
            "optional": {
                "string_1": ("STRING", {"default": "", "forceInput": True}),
                "string_2": ("STRING", {"default": "", "forceInput": True}),
            },
        }

    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("string",)
    FUNCTION = "combine"
    CATEGORY = "Adahm/text"
    DESCRIPTION = "Join optional strings in socket order, skipping empty inputs."

    def combine(self, inputcount=2, delimiter=" ", **kwargs):
        strings = []
        for index in range(1, int(inputcount) + 1):
            value = kwargs.get(f"string_{index}")
            if value is None or value == "":
                continue
            strings.append(value)
        return (delimiter.join(strings),)


class SomethingToStringAdahm:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {"input": ("*",)},
            "optional": {
                "prefix": ("STRING", {"default": ""}),
                "suffix": ("STRING", {"default": ""}),
            },
        }

    RETURN_TYPES = ("STRING",)
    FUNCTION = "stringify"
    CATEGORY = "Adahm/text"
    DESCRIPTION = "Convert primitives or lists to text using normal ComfyUI caching."

    def stringify(self, input, prefix="", suffix=""):
        # Preserve KJNodes' conversion and unsupported-object passthrough.
        if isinstance(input, (int, float, bool, str)):
            text = str(input)
        elif isinstance(input, list):
            text = ", ".join(str(item) for item in input)
        else:
            return (input,)
        return ((prefix or "") + text + (suffix or ""),)
