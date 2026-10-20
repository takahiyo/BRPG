import dataclasses
from pathlib import Path
import random
import subprocess
import sys
import unittest

import generate_monster_names as names


ROOT = Path(__file__).resolve().parents[1]
DIRECTORY = ROOT / "docs" / "monsters"


class MonsterGenerationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.monsters, cls.titles = names.load_dictionaries(DIRECTORY)
        cls.monster = {row.name: row for row in cls.monsters}
        cls.title = {row.name: row for row in cls.titles}

    def run_cli(self, *args):
        return subprocess.run([sys.executable, str(ROOT / "scripts/generate_monster_names.py"), *args],
                              capture_output=True, encoding="utf-8")

    def test_dictionary_coverage_and_anchors(self):
        self.assertEqual([row.id for row in self.monsters], [f"M{i:04}" for i in range(1, 401)])
        self.assertEqual([row.id for row in self.titles], [f"MT{i:04}" for i in range(1, 161)])
        for level, name in enumerate(["オーガ", "ミノタウロス", "ワイバーン", "ヒュドラ", "成竜",
                                      "リッチ", "エルダードラゴン", "クラーケン", "古竜王", "終焉竜"], 1):
            self.assertEqual(self.monster[name].level, level * 30)
            self.assertEqual(sum((level - 1) * 30 < row.level <= level * 30 for row in self.monsters), 40)
        self.assertEqual(self.monster["スライム"].level, 1)
        self.assertTrue(all(1 <= row.minimum <= row.maximum <= 300 for row in self.titles))

    def test_every_title_and_base_is_reachable(self):
        for title in self.titles:
            self.assertTrue(any(names.compatible(monster, title) for monster in self.monsters), title.id)
        pool = names.candidates(self.monsters, self.titles)
        self.assertEqual(len({row[0] for row in pool}), len(pool))
        self.assertTrue(all(1 <= row[1] <= 300 for row in pool))
        self.assertEqual(len([row for row in pool if row[3] == "-"]), 400)

    def test_user_examples(self):
        kobold, slime, dragon = (self.monster[name] for name in ("コボルト", "スライム", "成竜"))
        for title, expected in [("ありふれた", 10), ("屈強な", 18), ("ジェネラル", 45)]:
            self.assertTrue(names.compatible(kobold, self.title[title]))
            self.assertEqual(kobold.level + self.title[title].delta, expected)
        self.assertFalse(names.compatible(slime, self.title["屈強な"]))
        self.assertFalse(names.compatible(slime, self.title["ジェネラル"]))
        self.assertFalse(names.compatible(dragon, self.title["ジェネラル"]))
        self.assertTrue(names.compatible(slime, self.title["濃縮された"]))

    def test_all_condition_columns_are_required(self):
        base = self.monster["コボルト"]
        general = self.title["ジェネラル"]
        self.assertFalse(names.compatible(dataclasses.replace(base, traits=base.traits - {"軍制"}), general))
        self.assertFalse(names.compatible(dataclasses.replace(base, traits=base.traits - {"知性"}), general))
        self.assertFalse(names.compatible(dataclasses.replace(base, category="竜"), general))
        self.assertFalse(names.compatible(dataclasses.replace(base, traits=base.traits | {"無形"}), self.title["屈強な"]))

    def test_level_bounds_without_clamping(self):
        weak = self.title["力を失った"]
        self.assertFalse(names.compatible(self.monster["スライム"], weak))
        self.assertFalse(names.compatible(self.monster["終焉竜"], self.title["悪名高い"]))
        self.assertTrue(names.compatible(self.monster["終焉竜"], self.title["ありふれた"]))
        self.assertFalse(names.compatible(self.monster["スライム"], dataclasses.replace(self.title["濃縮された"], minimum=10)))

    def test_band_crossing_and_sampling(self):
        rows = names.candidates([self.monster["コボルト"]], [self.title["ジェネラル"]], 31, 60, False)
        self.assertEqual([(row[0], row[1]) for row in rows], [("ジェネラルコボルト", 45)])
        for minimum in range(1, 301, 30):
            pool = names.candidates(self.monsters, self.titles, minimum, minimum + 29)
            sample = random.Random(19).sample(pool, 120)
            self.assertEqual(len(sample), 120)
            self.assertTrue(all(minimum <= row[1] <= minimum + 29 for row in sample))

    def test_markdown_schemas(self):
        for path in DIRECTORY.glob("*.md"):
            expected = None
            for line in path.read_text(encoding="utf-8").splitlines():
                if line.startswith("| ID |"):
                    expected = len(line.strip("|").split("|"))
                elif expected and line.startswith("|"):
                    self.assertEqual(len(line.strip("|").split("|")), expected, (path.name, line))
                elif not line.startswith("|"):
                    expected = None

    def test_cli_valid_and_invalid_requests(self):
        good = self.run_cli("--monster", "コボルト", "--title", "ジェネラル", "--count", "1")
        self.assertEqual(good.returncode, 0, good.stderr)
        self.assertIn("| ジェネラルコボルト | 45 |", good.stdout)
        for arguments in [("--monster", "スライム", "--title", "屈強な"),
                          ("--monster", "成竜", "--title", "ジェネラル"),
                          ("--level", "301"), ("--min-level", "60", "--max-level", "30"),
                          ("--monster", "不明なモンスター"), ("--title", "不明な称号"),
                          ("--base-only", "--title", "ありふれた")]:
            self.assertEqual(self.run_cli(*arguments).returncode, 2, arguments)

    def test_cli_reproducibility_and_exact_level(self):
        arguments = ("--min-level", "31", "--max-level", "60", "--count", "100", "--seed", "19", "--with-ids")
        first = self.run_cli(*arguments)
        self.assertEqual(first.returncode, 0, first.stderr)
        self.assertEqual(first.stdout, self.run_cli(*arguments).stdout)
        exact = self.run_cli("--level", "180", "--count", "5")
        self.assertEqual(exact.returncode, 0, exact.stderr)
        self.assertTrue(all("| 180 |" in line for line in exact.stdout.splitlines()[2:]))
        base = self.run_cli("--base-only", "--monster", "スライム", "--count", "1")
        self.assertIn("| スライム | 1 |", base.stdout)


if __name__ == "__main__":
    unittest.main()
