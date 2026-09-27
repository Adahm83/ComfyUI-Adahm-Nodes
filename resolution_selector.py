"""Resolution selector with a stable nominal aspect-ratio graph output."""

import math


RATIOS = {
    "1:1": (1, 1),
    "2:3": (2, 3),
    "3:2": (3, 2),
    "3:4": (3, 4),
    "4:3": (4, 3),
    "9:16": (9, 16),
    "16:9": (16, 9),
}


class ResolutionSelectorAdahm:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {
            "aspect_ratio": (list(RATIOS),),
            "megapixels": ("FLOAT", {"default": 1.0, "min": 0.01, "max": 256.0, "step": 0.01}),
            "multiple": ("INT", {"default": 32, "min": 1, "max": 1024, "step": 1}),
        }}

    RETURN_TYPES = ("INT", "INT", "STRING")
    RETURN_NAMES = ("width", "height", "aspect_ratio")
    FUNCTION = "select"
    CATEGORY = "Adahm/conditioning"
    DESCRIPTION = "Calculate dimensions from megapixels and expose the selected nominal ratio as a STRING."

    def select(self, aspect_ratio, megapixels, multiple):
        ratio_width, ratio_height = RATIOS[aspect_ratio]
        pixels = float(megapixels) * 1_000_000.0
        width = math.sqrt(pixels * ratio_width / ratio_height)
        height = math.sqrt(pixels * ratio_height / ratio_width)
        multiple = max(1, int(multiple))
        width = max(multiple, int(round(width / multiple)) * multiple)
        height = max(multiple, int(round(height / multiple)) * multiple)
        return (width, height, aspect_ratio)
