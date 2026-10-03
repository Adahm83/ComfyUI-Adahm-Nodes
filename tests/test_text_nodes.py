import unittest
from text_nodes import JoinStringMultiAdahm, SomethingToStringAdahm


class TextNodesTest(unittest.TestCase):
    def test_missing_first_and_empty_inputs(self):
        join = JoinStringMultiAdahm()
        self.assertEqual(join.combine(4, ", ", string_2="second", string_3=None,
                                      string_4="last"), ("second, last",))
        self.assertEqual(join.combine(2, ", ", string_1="", string_2=""), ("",))
        self.assertEqual(join.combine(), ("",))

    def test_socket_order_and_unchanged_whitespace(self):
        join = JoinStringMultiAdahm()
        self.assertEqual(join.combine(4, "|", string_4="d", string_2="b",
                                      string_1=" a ", string_5="ignored"), (" a |b|d",))

    def test_stringify_conversion_and_affixes(self):
        convert = SomethingToStringAdahm()
        for value, expected in [(0, "0"), (False, "False"), (1.5, "1.5"),
                                ("", ""), ([1, "two", False], "1, two, False")]:
            with self.subTest(value=value):
                self.assertEqual(convert.stringify(value, "<", ">"), (f"<{expected}>",))
        obj = {"value": 1}
        self.assertIs(convert.stringify(obj, "<", ">")[0], obj)

    def test_optional_strings_and_no_forced_execution(self):
        inputs = JoinStringMultiAdahm.INPUT_TYPES()
        self.assertNotIn("string_1", inputs["required"])
        self.assertEqual(list(inputs["optional"]), ["string_1", "string_2"])
        for cls in (JoinStringMultiAdahm, SomethingToStringAdahm):
            self.assertFalse(hasattr(cls, "IS_CHANGED"))
            self.assertFalse(getattr(cls, "NOT_IDEMPOTENT", False))
            self.assertFalse(getattr(cls, "OUTPUT_NODE", False))


if __name__ == "__main__":
    unittest.main()
