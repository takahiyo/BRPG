"""IDで連結するフレーバー・加工・探索・職業辞典の欠落と不正参照を検出する。"""
import re
import unittest
from pathlib import Path
from evaluate_craft import ROOT, id_rows, load_data, table_rows

D = ROOT / "docs"


class CatalogIntegrityTests(unittest.TestCase):
    def test_flavor_coverage_matches_all_originals(self):
        specs = [
            ("items/称号辞典.md", "flavor/アイテム称号フレーバー.md", "T", 9, 5, 400, 1),
            ("items/加工品名辞典.md", "crafting/加工品クラフト方向性.md", "P", 8, 6, 540, 1),
            ("materials/素材LV辞典.md", "crafting/素材加工特性.md", "S", 7, 11, 265, 2),
            ("monsters/モンスター称号辞典.md", "flavor/モンスター称号フレーバー.md", "MT", 8, 4, 160, 1),
            ("monsters/モンスター辞典_LV001-150.md", "flavor/モンスターフレーバー_LV001-150.md", "M", 5, 5, 200, 1),
            ("monsters/モンスター辞典_LV151-300.md", "flavor/モンスターフレーバー_LV151-300.md", "M", 5, 5, 200, 1),
        ]
        for original, extra, prefix, a, b, count, name in specs:
            with self.subTest(extra=extra):
                base = id_rows(D / original, prefix+r"\d{4}", a)
                flavor = id_rows(D / extra, prefix+r"\d{4}", b)
                self.assertEqual(len(base), count)
                self.assertEqual(set(base), set(flavor))
                for key in base:
                    self.assertEqual(base[key][name], flavor[key][1], key)
                    self.assertTrue(all(cell for cell in flavor[key]), key)

    def test_crafting_profiles_and_levels(self):
        data = load_data()
        self.assertEqual(set(data["routes"]), set("HFMIX"))
        self.assertEqual(len(data["profiles"]), 16)
        for row in data["material_work"].values():
            self.assertIn(row[2], data["classes"], row[0])
            for value in row[3:8]:
                self.assertTrue(value == "-" or 1 <= int(value) <= 300, row[0])
            self.assertTrue(0 <= int(row[8]) <= 100, row[0])
        for row in data["product_work"].values():
            self.assertIn(row[3], data["profiles"], row[0])
            self.assertTrue(0 <= int(row[4]) <= 30, row[0])
        for row in data["tech"].values():
            if row[2] != "-":
                self.assertTrue(set(row[2].split(",")) <= set(data["tech"]), row[0])

    def test_exploration_manuals(self):
        rows = id_rows(D / "exploration/探索行動と手引書辞典.md", r"B\d{2}", 10)
        self.assertEqual(set(rows), {f"B{i:02}" for i in range(1, 41)})
        books = {row[2] for row in rows.values()} - {"-"}
        self.assertEqual(books, {f"EB{i:03}" for i in range(1, 40)})
        for row in rows.values():
            self.assertTrue(1 <= int(row[4]) <= 300)
            self.assertTrue(1 <= int(row[5]) <= int(row[6]) <= 300)

    def test_jobs_and_skills_references(self):
        jobs, skills = {}, {}
        for suffix in ["冒険と戦闘", "生活と奇想"]:
            jobs.update(id_rows(D / f"jobs/職業辞典_{suffix}.md", r"J\d{4}", 10))
            skills.update(id_rows(D / f"jobs/スキル辞典_{suffix}.md", r"SK\d{4}", 8))
        self.assertEqual(set(jobs), {f"J{i:04}" for i in range(1, 301)})
        self.assertEqual(set(skills), {f"SK{i:04}" for i in range(1, 181)})
        self.assertEqual(len({r[1] for r in jobs.values()}), 300)
        self.assertEqual(len({r[1] for r in skills.values()}), 180)
        behavior_ids = {f"B{i:02}" for i in range(1, 41)}
        used = set()
        for row in jobs.values():
            self.assertTrue(1 <= int(row[3]) <= int(row[4]) <= 300, row[0])
            self.assertEqual(len(set(row[5:8])), 3, row[0])
            self.assertTrue(set(row[5:8]) <= set(skills), row[0])
            used.update(row[5:8])
        self.assertEqual(used, set(skills))
        for row in skills.values():
            self.assertTrue(1 <= int(row[2]) <= int(row[3]) <= 300, row[0])
            self.assertIn(row[4], {"受動", "戦闘", "探索", "制作", "交易"}, row[0])
            self.assertTrue(row[7] == "-" or set(row[7].split(",")) <= behavior_ids, row[0])

    def test_obsidian_filenames_and_links_are_unambiguous(self):
        paths = list(D.rglob("*.md"))
        self.assertEqual(len({p.stem for p in paths}), len(paths))
        names = {p.stem for p in paths} | {"素材：鉱石など"}
        for path in paths:
            content = path.read_text(encoding="utf-8-sig")
            self.assertTrue(content.startswith("---\n"), path.name)
            frontmatter = content.split("---", 2)[1]
            self.assertIn("創作", frontmatter, path.name)
            for link in re.findall(r"\[\[([^\]]+)\]\]", content):
                target = link.split("|")[0].split("#")[0]
                self.assertIn(target, names, (path.name, target))


if __name__ == "__main__":
    unittest.main()
