"""ComfyUI-Adahm-Nodes custom node pack."""

try:
    from .resolution_selector import ResolutionSelectorAdahm
    from .legacy_dpmpp_sde import LegacyDPMppSDEAdahm
    from .lora_folder_loader import LoraFolderLoaderAdahm
    from .text_nodes import JoinStringMultiAdahm, SomethingToStringAdahm
except ImportError:  # Direct loading by the standalone contract tests.
    from resolution_selector import ResolutionSelectorAdahm
    from legacy_dpmpp_sde import LegacyDPMppSDEAdahm
    from lora_folder_loader import LoraFolderLoaderAdahm
    from text_nodes import JoinStringMultiAdahm, SomethingToStringAdahm


class ClearPreviewsOnStart:
    @classmethod
    def INPUT_TYPES(cls):
        return {"required": {"enabled": ("BOOLEAN", {
            "default": False,
            "label_on": "enabled",
            "label_off": "disabled",
        })}}

    RETURN_TYPES = ()
    FUNCTION = "execute"
    CATEGORY = "Adahm/preview"
    OUTPUT_NODE = True
    DESCRIPTION = "Clear generated image previews when execution starts."

    def execute(self, enabled=False):
        return ()


class LegacyClearPreviewsOnStart(ClearPreviewsOnStart):
    """Workflow-compatible alias hidden from the add-node menu by default."""

    DEPRECATED = True
    # Keep this old workflow type loadable, but exclude it from the default
    # context-menu lookup used by current LiteGraph.
    filter = "__adahm_legacy__"


NODE_CLASS_MAPPINGS = {
    "AdahmJoinStringMulti": JoinStringMultiAdahm,
    "AdahmSomethingToString": SomethingToStringAdahm,
    "AdahmClearPreviewsOnStart": ClearPreviewsOnStart,
    "ClearPreviewsOnStart": LegacyClearPreviewsOnStart,
    "AdahmResolutionSelector": ResolutionSelectorAdahm,
    "AdahmLegacyDPMppSDE": LegacyDPMppSDEAdahm,
    "AdahmLoraFolderLoader": LoraFolderLoaderAdahm,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "AdahmJoinStringMulti": "Adahm Join String Multi",
    "AdahmSomethingToString": "Adahm Something To String",
    "AdahmClearPreviewsOnStart": "Adahm Clear Previews on Start",
    "ClearPreviewsOnStart": "Adahm Clear Previews on Start",
    "AdahmResolutionSelector": "Adahm Resolution Selector",
    "AdahmLegacyDPMppSDE": "Adahm Legacy DPM++ SDE",
    "AdahmLoraFolderLoader": "Adahm LoRA Folder Loader",
}
WEB_DIRECTORY = "./web"

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
