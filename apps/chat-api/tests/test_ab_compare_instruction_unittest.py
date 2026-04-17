from __future__ import annotations

import os
import unittest


class TestAbCompareInstruction(unittest.TestCase):
    def test_chat_router_contains_ab_compare_instruction_and_flag(self):
        here = os.path.dirname(__file__)
        chat_py = os.path.join(here, "..", "app", "routers", "chat.py")
        with open(chat_py, "r", encoding="utf-8") as f:
            src = f.read()

        self.assertIn("ab_compare", src)
        self.assertIn("A/B Compare Mode", src)
        self.assertIn("FIRST image", src)
        self.assertIn("SECOND image", src)


if __name__ == "__main__":
    unittest.main()

