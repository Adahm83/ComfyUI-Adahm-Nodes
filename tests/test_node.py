import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
import lora_folder_loader
spec = importlib.util.spec_from_file_location("adahm_nodes", root / "__init__.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class LoraFolderSelectionTest(unittest.TestCase):
    def test_folder_options_include_root_and_parent_folders(self):
        self.assertEqual(
            lora_folder_loader.folder_options(["Detail/a.safetensors"]),
            ["[root]", "Detail"],
        )

    def test_matching_loras_can_exclude_or_include_subfolders(self):
        names = ["Detail/b.safetensors", "Detail/Sub/a.safetensors", "Other/c.safetensors"]
        self.assertEqual(
            lora_folder_loader.matching_loras(names, "Detail", False),
            ["Detail/b.safetensors"],
        )
        self.assertEqual(
            lora_folder_loader.matching_loras(names, "Detail", True),
            ["Detail/b.safetensors", "Detail/Sub/a.safetensors"],
        )

    def test_lora_info_reads_local_metadata_preview_and_civitai_sidecar(self):
        class FakeFolderPaths:
            def __init__(self, root, user):
                self.root = Path(root)
                self.user = Path(user)

            def get_full_path(self, category, name):
                return str(self.root / name) if category == "loras" else None

            def get_folder_paths(self, category):
                return [str(self.root)] if category == "loras" else []

            def get_user_directory(self):
                return str(self.user)

        with tempfile.TemporaryDirectory() as temp:
            root = Path(temp) / "loras"
            user = Path(temp) / "user"
            root.mkdir()
            user.mkdir()
            lora = root / "Detail" / "PerfectEyesXL.safetensors"
            lora.parent.mkdir()
            metadata = {
                "__metadata__": {
                    "modelspec.architecture": "stable-diffusion-xl-v1-base",
                    "ss_trigger_words": "perfecteyes, close up",
                }
            }
            header = json.dumps(metadata).encode("utf-8")
            lora.write_bytes(len(header).to_bytes(8, "little") + header)
            (lora.with_suffix(".preview.png")).write_bytes(b"preview")
            (lora.with_suffix(".civitai.info")).write_text(
                json.dumps({
                    "model": {"name": "Perfect Eyes XL"},
                    "baseModel": "SDXL",
                    "trainedWords": ["green eyes"],
                    "modelId": 133,
                    "id": 456,
                }),
                encoding="utf-8",
            )
            store = user / "ausboss"
            store.mkdir()
            (store / "lora_triggers.json").write_text(
                json.dumps({"Detail/PerfectEyesXL.safetensors": {"min": 0.2, "max": 0.8}}),
                encoding="utf-8",
            )
            original = lora_folder_loader.folder_paths
            lora_folder_loader.folder_paths = FakeFolderPaths(root, user)
            try:
                info = lora_folder_loader._lora_info("Detail/PerfectEyesXL.safetensors")
            finally:
                lora_folder_loader.folder_paths = original
            self.assertEqual(info["base_model"], "SDXL")
            self.assertEqual(info["file_triggers"], ["perfecteyes", "close up"])
            self.assertEqual(info["civitai_triggers"], ["green eyes"])
            self.assertEqual(info["civitai_title"], "Perfect Eyes XL")
            self.assertEqual(info["civitai_model_id"], 133)
            self.assertEqual(info["civitai_version_id"], 456)
            self.assertTrue(info["has_preview"])
            self.assertEqual(info["range"], {"min": 0.2, "max": 0.8})


class NodeContractTest(unittest.TestCase):
    def test_clear_previews_contract(self):
        node = module.NODE_CLASS_MAPPINGS["AdahmClearPreviewsOnStart"]
        self.assertEqual(node.RETURN_TYPES, ())
        self.assertTrue(node.OUTPUT_NODE)
        self.assertEqual(node().execute(enabled=False), ())

    def test_resolution_outputs_nominal_ratio(self):
        node = module.NODE_CLASS_MAPPINGS["AdahmResolutionSelector"]
        self.assertEqual(node.RETURN_TYPES, ("INT", "INT", "STRING"))
        width, height, ratio = node().select("2:3", 0.5, 32)
        self.assertEqual((width, height, ratio), (576, 864, "2:3"))

    def test_legacy_clear_previews_alias_stays_loadable_but_hidden_from_default_menu(self):
        node = module.NODE_CLASS_MAPPINGS["ClearPreviewsOnStart"]
        self.assertTrue(node.DEPRECATED)
        self.assertEqual(node.filter, "__adahm_legacy__")

    def test_legacy_dpmpp_sde_registration_and_defaults(self):
        node = module.NODE_CLASS_MAPPINGS["AdahmLegacyDPMppSDE"]
        self.assertEqual(node.RETURN_TYPES, ("LATENT",))
        inputs = node.INPUT_TYPES()["required"]
        self.assertEqual(inputs["seed"][1]["default"], 5775662)
        self.assertEqual(inputs["ensd"][1]["default"], 31337)
        self.assertEqual(inputs["steps"][1]["default"], 30)
        self.assertEqual(inputs["cfg"][1]["default"], 9.0)
        self.assertEqual(inputs["denoise"][1]["default"], 1.0)
        self.assertEqual(inputs["denoise"][1]["max"], 1.0)

    def test_lora_folder_loader_registration_and_outputs(self):
        node = module.NODE_CLASS_MAPPINGS["AdahmLoraFolderLoader"]
        self.assertEqual(node.RETURN_TYPES, ("MODEL", "CLIP", "STRING"))
        self.assertEqual(node.RETURN_NAMES, ("MODEL", "CLIP", "stack_text"))
        self.assertEqual(node.INPUT_TYPES()["required"]["folder"][1]["default"], "[root]")
        self.assertEqual(
            module.NODE_DISPLAY_NAME_MAPPINGS["AdahmLoraFolderLoader"],
            "Adahm LoRA Folder Loader",
        )

    def test_lora_folder_loader_builds_ausboss_rows(self):
        rows = lora_folder_loader.build_lora_rows(
            ["Detail/a.safetensors"], 0.75, 0.5
        )
        self.assertEqual(rows[0]["lora"], "Detail/a.safetensors")
        self.assertTrue(rows[0]["on"])
        self.assertEqual(rows[0]["strength"], 0.75)
        self.assertEqual(rows[0]["strengthTwo"], 0.5)
        self.assertIn('"lora":"Detail/a.safetensors"', lora_folder_loader.serialise_lora_rows(rows))

    def test_stack_text_includes_only_enabled_loras_in_order(self):
        rows = [
            {"on": True, "lora": r"SDXL\Detail\add-detail-xl.safetensors", "strength": 1},
            {"on": False, "lora": r"SDXL\Detail\off.safetensors", "strength": 0.8},
            {"on": True, "lora": r"SDXL\Detail\AdvancedEnhancerXLv2.safetensors", "strength": 0.3},
            {"on": True, "lora": r"SDXL\Detail\detailed_hands-000002.safetensors", "strength": -0.5},
            {"on": True, "lora": r"SDXL\Other\other.safetensors", "strength": 0.2},
            {"on": True, "lora": r"SDXL\Detail\last.safetensors", "strength": 0.7},
        ]
        self.assertEqual(
            lora_folder_loader.build_stack_text(rows),
            "### SDXL\\Detail\n"
            "add-detail-xl.safetensors: 1.0  \n"
            "AdvancedEnhancerXLv2.safetensors: 0.3  \n"
            "detailed_hands-000002.safetensors: -0.5  \n"
            "last.safetensors: 0.7  \n"
            "### SDXL\\Other\n"
            "other.safetensors: 0.2  \n\n",
        )

    def test_lora_loader_returns_stack_text_output(self):
        node = module.NODE_CLASS_MAPPINGS["AdahmLoraFolderLoader"]()
        result = node.load_loras(
            None,
            None,
            lora_1={"on": True, "lora": "Detail/a.safetensors", "strength": 0.75},
            lora_2={"on": False, "lora": "Detail/off.safetensors", "strength": 0.25},
        )
        self.assertEqual(result[:2], (None, None))
        self.assertEqual(result[2], "### Detail\na.safetensors: 0.75  \n\n")

    def test_lora_loader_prefers_live_serialized_stack_text(self):
        node = module.NODE_CLASS_MAPPINGS["AdahmLoraFolderLoader"]()
        result = node.load_loras(
            None,
            None,
            __adahm_stack_text="### Detail\n"
            "PerfectEyesXL.safetensors: 0.45  \n"
            "PerfectEyesXL.safetensors: 0.60  \n\n",
            lora_1={"on": True, "lora": "Detail/PerfectEyesXL.safetensors", "strength": 1.0},
            lora_2={"on": False, "lora": "Detail/off.safetensors", "strength": 1.0},
        )
        self.assertEqual(
            result[2],
            "### Detail\n"
            "PerfectEyesXL.safetensors: 0.45  \n"
            "PerfectEyesXL.safetensors: 0.60  \n\n",
        )


if __name__ == "__main__":
    unittest.main()
