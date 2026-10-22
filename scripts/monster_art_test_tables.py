import json
import struct
import unittest

from export_monster_art_prompts import build_prompts
from export_monster_art_tables import ART, ROOT, build_tables


class MonsterArtTableTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.outputs = build_tables()
        manifest = json.loads((ART / "manifest.json").read_text(encoding="utf-8"))
        cls.entries, cls.layout = manifest["batches"], manifest["layout"]

    def test_generated_tables_are_current(self):
        self.assertEqual(len(self.outputs), 18)
        for file, content in self.outputs.items():
            self.assertEqual(file.read_text(encoding="utf-8"), content, file.name)

    def test_each_manifest_entry_has_its_own_flavored_row(self):
        count = 0
        for entry in self.entries:
            text = self.outputs[ART / f"{entry['sheet']}.md"]
            rows = [line.split("|")[1:-1] for line in text.splitlines() if f"| {entry['id']} |" in line]
            self.assertEqual(len(rows), 1, entry["id"])
            row = [cell.strip() for cell in rows[0]]
            self.assertEqual(len(row), 8)
            self.assertEqual(row[0], str(entry["cell"]))
            self.assertEqual(row[1], str((entry["cell"] - 1) // 5 + 1))
            self.assertEqual(row[2], str((entry["cell"] - 1) % 5 + 1))
            self.assertEqual(row[4], entry["name"])
            self.assertTrue(all(row[i] for i in [5, 6, 7]), entry["id"])
            self.assertFalse(entry["verified"], "Generating tables must not approve unmade images")
            count += 1
        self.assertEqual(count, 470)

    def test_small_final_sheets_reserve_empty_cells(self):
        for name in ["catalog-14", "encounter-03"]:
            self.assertIn("枠11〜30は透明の空白。", self.outputs[ART / f"{name}.md"])
        self.assertIn("encounter-01", self.outputs[ROOT / "docs/MONSTER_ART_TABLES.md"])

    def test_sample_dimensions_match_square_cell_contract(self):
        with (ROOT / "docs/30体のモンスター透過スプライトアトラス.png").open("rb") as sample:
            header = sample.read(33)
        self.assertEqual(header[:8], b"\x89PNG\r\n\x1a\n")
        self.assertEqual(header[12:16], b"IHDR")
        width, height, depth, color = struct.unpack(">IIBB", header[16:26])
        self.assertEqual((width, height, depth, color), (1145, 1374, 8, 6))
        self.assertEqual((self.layout["width"], self.layout["height"]), (width, height))
        self.assertEqual(self.layout["cell"], 229)
        self.assertEqual(width, self.layout["columns"] * self.layout["cell"])
        self.assertEqual(height, self.layout["rows"] * self.layout["cell"])

    def test_portable_prompts_are_current(self):
        outputs = build_prompts()
        self.assertEqual(len(outputs), 2)
        for file, content in outputs.items():
            self.assertEqual(file.read_text(encoding="utf-8"), content, file.name)
            self.assertIn("1145×1374px", content)
            self.assertNotIn("2560×3072", content)
        targets = outputs[ROOT / "docs/monsters/モンスター画像生成リスト_30枠.md"]
        self.assertEqual(targets.count("基準サイズ："), 14)
        self.assertEqual(targets.count("空白（何も描かない・透明）"), 20)

    def test_every_production_sheet_has_the_sample_size_and_margin(self):
        for file, content in self.outputs.items():
            self.assertIn("1145×1374px", content, file.name)
            self.assertNotIn("2560×3072", content, file.name)
            if file.parent == ART:
                self.assertIn("229pxセルでは19px以上", content, file.name)
        skill = (ROOT / "skills/brpg-asset-sheet/SKILL.md").read_text(encoding="utf-8")
        spec = (ROOT / "docs/MONSTER_ART_SPEC.md").read_text(encoding="utf-8")
        for text in [skill, spec]:
            self.assertIn("1145×1374px", text)
            self.assertIn("19px以上", text)
            self.assertNotIn("2560×3072", text)


if __name__ == "__main__":
    unittest.main()
