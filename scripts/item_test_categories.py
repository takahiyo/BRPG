"""アイテムのカテゴリ・LV・辞典整合性の回帰検証（標準ライブラリのみ）。"""

from contextlib import redirect_stdout, redirect_stderr
from dataclasses import replace
import io
import re
import unittest

import generate_item_names as g


class ItemCategoryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.titles = g.read_dictionary(g.DEFAULT_DIR / "称号辞典.md", "T")
        cls.products = g.read_dictionary(g.DEFAULT_DIR / "加工品名辞典.md", "P")
        cls.materials = g.read_material_aliases(g.DEFAULT_DIR.parent / "materials" / "素材LV辞典.md")
        cls.title = {row.name: row for row in cls.titles}
        cls.product = {row.name: row for row in cls.products}

    def allows(self, title, material, product, level=None):
        return g.compatible(self.title[title], self.materials[material], self.product[product], level)

    def cli(self, *args, error=False):
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            if error:
                with self.assertRaises(SystemExit) as raised:
                    g.main(list(args))
                self.assertEqual(raised.exception.code, 2)
            else:
                g.main(list(args))
        return err.getvalue() if error else out.getvalue()

    def test_dictionary_completeness_and_ranges(self):
        self.assertEqual([row.id for row in self.titles], [f"T{i:04}" for i in range(1, 401)])
        self.assertEqual([row.id for row in self.products], [f"P{i:04}" for i in range(1, 541)])
        self.assertEqual(len({row.name for row in self.titles}), 400)
        self.assertEqual(len({row.name for row in self.products}), 540)
        self.assertEqual(set().union(*(row.categories for row in self.products)), g.PRODUCT_CATEGORIES)
        for row in self.titles + self.products + list(self.materials.values()):
            self.assertTrue(1 <= row.min_level <= row.max_level <= 300)
        self.assertEqual((self.product['たいまつ'].min_level, self.product['たいまつ'].max_level), (1, 300))

    def test_markdown_table_headers_match_data_columns(self):
        for filename, columns, tables in [('称号辞典.md', 9, 20), ('加工品名辞典.md', 8, 18)]:
            lines = (g.DEFAULT_DIR / filename).read_text(encoding='utf-8').splitlines()
            headers = [index for index, line in enumerate(lines) if line.startswith('| ID |')]
            self.assertEqual(len(headers), tables)
            for index in headers:
                for line in lines[index:index + 3]:
                    self.assertEqual(len(line.strip().strip('|').split('|')), columns, line)

    def test_each_title_has_a_compatible_tuple(self):
        for title in self.titles:
            self.assertTrue(any(g.compatible(title, material, product)
                                for material in set(self.materials.values()) for product in self.products), title.name)

    def test_each_product_has_a_compatible_material(self):
        for product in self.products:
            self.assertTrue(any(g.compatible(self.title['ボロボロの'], material, product)
                                for material in set(self.materials.values())), product.name)

    def test_all_40_existing_examples(self):
        titles = {row.id: row for row in self.titles}
        products = {row.id: row for row in self.products}
        count = 0
        for line in (g.DEFAULT_DIR / 'アイテム名の組合せ例.md').read_text(encoding='utf-8').splitlines():
            cells = [cell.strip() for cell in line.strip().strip('|').split('|')]
            if len(cells) < 3 or not re.fullmatch(r'T\d{4}', cells[1]):
                continue
            title = titles[cells[1]]
            product = products[cells[2]] if re.fullmatch(r'P\d{4}', cells[2]) else products['P0001']
            self.assertTrue(cells[0].startswith(title.name))
            self.assertTrue(cells[0].endswith('の' + product.name))
            material = cells[0][len(title.name):-len('の' + product.name)]
            self.assertTrue(g.compatible(title, self.materials[material], product), cells[0])
            count += 1
        self.assertEqual(count, 40)

    def test_backwards_commands(self):
        self.assertIn('ボロボロの木の盾', self.cli('--material', '木', '--title', 'ボロボロの', '--product', '盾', '--count', '1'))
        self.assertIn('上質な鋼の槍', self.cli('--material', '鋼', '--title', '上質な', '--product', '槍', '--count', '1'))

    def test_rust_requires_iron(self):
        self.assertTrue(self.allows('錆に覆われた', '鉄', '盾'))
        self.assertTrue(self.allows('防錆油の香る', '玉鋼', '短剣'))
        for material, product in [('木', '盾'), ('布', '鎧'), ('銅', 'ランタン')]:
            self.assertFalse(self.allows('錆に覆われた', material, product))
            error = self.cli('--material', material, '--title', '錆に覆われた', '--product', product, '--count', '1', error=True)
            self.assertIn('適合する組合せがありません', error)

    def test_blades_are_a_feature(self):
        for title in ['刃こぼれした', '研ぎ直された', '研ぎ師オルダクの', '西門刃工連盟の']:
            self.assertTrue(self.allows(title, '鋼', '短剣'))
            self.assertFalse(self.allows(title, '鋼', 'ランタン'))
            self.assertFalse(self.allows(title, '鋼', '棍棒'))
        self.assertTrue(self.allows('研ぎ直された', '鋼', '包丁'))

    def test_title_conditions_are_and_not_or(self):
        self.assertTrue(self.allows('鍛冶師ベルカドの', '鉄', '短剣'))
        self.assertFalse(self.allows('鍛冶師ベルカドの', '木', '棍棒'))
        self.assertFalse(self.allows('鍛冶師ベルカドの', '鉄', '杯'))
        self.assertTrue(self.allows('木匠トネリオの', '木', '盾'))
        self.assertFalse(self.allows('木匠トネリオの', '鉄', '盾'))

    def test_craft_specialties(self):
        self.assertTrue(self.allows('織り手セリオナの', '布', '天幕'))
        self.assertFalse(self.allows('織り手セリオナの', '革', '天幕'))
        self.assertTrue(self.allows('三枝木工房の', '木', '盾'))
        self.assertFalse(self.allows('三枝木工房の', '鉄', '盾'))
        self.assertTrue(self.allows('灯具師エルセクの', '銅', 'ランタン'))
        self.assertFalse(self.allows('灯具師エルセクの', '銅', '盾'))

    def test_product_material_gate(self):
        self.assertFalse(self.allows('上質な', '布', '短剣'))
        self.assertFalse(self.allows('上質な', '木', 'ろうそく'))
        self.assertTrue(self.allows('上質な', '蝋', 'ろうそく'))

    def test_chain_armor_requires_metal(self):
        for product in ['鎖帷子', '鎖胴着', '鎖シャツ', '環鎧']:
            self.assertFalse(self.allows('虫食いの', '布', product))
            self.assertFalse(self.allows('上質な', '革', product))
            self.assertTrue(self.allows('上質な', '鉄', product))

    def test_required_structure(self):
        self.assertTrue(self.allows('錠を取り替えた', '木', '箱'))
        self.assertFalse(self.allows('錠を取り替えた', '木', '盾'))
        self.assertTrue(self.allows('折り畳み細工の', '木', '折り畳み椅子'))
        self.assertFalse(self.allows('折り畳み細工の', '木', '杖'))

    def test_unknown_material_requires_explicit_categories_and_level(self):
        base = ['--material', '未知の鉄樹', '--title', '上質な', '--product', '盾', '--count', '1']
        self.assertIn('未登録の素材', self.cli(*base, error=True))
        self.assertIn('material-level', self.cli(*base, '--material-tag', '未知の鉄樹=木', error=True))
        self.assertIn('未知の鉄樹の盾', self.cli(*base, '--material-tag', '未知の鉄樹=木', '--material-level', '未知の鉄樹=40:120'))
        self.assertIn('上書きできません', self.cli('--material', '木', '--material-tag', '木=金属', '--count', '1', error=True))

    def test_level_intersection_and_boundaries(self):
        self.assertFalse(self.allows('上質な', '鋼', '槍', 9))
        self.assertTrue(self.allows('上質な', '鋼', '槍', 10))
        self.assertTrue(self.allows('上質な', '鋼', '槍', 300))
        material = g.Material(frozenset({'木'}), 1, 5)
        self.assertFalse(g.compatible(self.title['上質な'], material, self.product['盾']))
        base = ['--material', '星樫', '--material-tag', '星樫=木', '--material-level', '星樫=40:120', '--title', '上質な', '--product', '盾', '--count', '1']
        for level in [39, 121]:
            self.assertIn('適合する組合せがありません', self.cli(*base, '--level', str(level), error=True))
        for level in [40, 120]:
            self.assertIn('40〜120', self.cli(*base, '--level', str(level)))
        for level in [0, 301]:
            self.assertIn('levelは1〜300', self.cli(*base, '--level', str(level), error=True))

    def test_disjoint_level_rejected_without_level_argument(self):
        error = self.cli('--material', '若樫', '--material-tag', '若樫=木', '--material-level', '若樫=1:5', '--title', '上質な', '--product', '盾', '--count', '1', error=True)
        self.assertIn('適合する組合せがありません', error)

    def test_seed_dedup_and_every_output_is_compatible(self):
        args = ['--material', '木', '--material', '鉄', '--material', '布', '--material', '鉄', '--level', '30', '--count', '100', '--seed', '19']
        output = self.cli(*args)
        self.assertEqual(output, self.cli(*args))
        rows = [line for line in output.splitlines() if re.search(r'\| T\d{4} \|', line)]
        self.assertEqual(len(rows), 100)
        self.assertEqual(len(set(rows)), 100)
        titles, products = {row.id: row for row in self.titles}, {row.id: row for row in self.products}
        for line in rows:
            cells = [cell.strip() for cell in line.strip('|').split('|')]
            self.assertTrue(g.compatible(titles[cells[1]], self.materials[cells[2]], products[cells[3]], 30))

    def test_category_and_dictionary_flags(self):
        output = self.cli('--material', '銅', '--product-category', '照明', '--title-category', '保存', '--dictionary-dir', str(g.DEFAULT_DIR), '--material-dictionary', str(g.DEFAULT_DIR.parent / 'materials' / '素材LV辞典.md'), '--count', '5', '--seed', '2')
        products = {row.id: row for row in self.products}
        for product_id in re.findall(r'\| (P\d{4}) \|', output):
            self.assertEqual(products[product_id].categories, {'照明'})


if __name__ == '__main__':
    unittest.main()
