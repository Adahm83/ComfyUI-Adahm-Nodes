import importlib.util
from pathlib import Path
import sys
import unittest

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
spec = importlib.util.spec_from_file_location("adahm_nodes", root / "__init__.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


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


if __name__ == "__main__":
    unittest.main()
