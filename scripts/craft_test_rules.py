"""加工経路・過渡期・履歴継承を仕様例で検証する。"""
import copy
import unittest
import evaluate_craft as c


class CraftTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.data = c.load_data()

    def make(self, material="S0135", product="P0031", route="M", skill=151, **kwargs):
        _, tech, equipment = c.requirements(self.data, material, product, route)
        return c.evaluate(self.data, material, product, route, skill,
                          kwargs.pop("technologies", tech), kwargs.pop("equipment", equipment),
                          kwargs.pop("recipe_known", True), **kwargs)

    def test_magic_transition_has_three_stages(self):
        self.assertEqual(c.magic_cost_and_residue(66, 0), (3, 66))
        self.assertEqual(c.magic_cost_and_residue(66, 30), (2, 44))
        self.assertEqual(c.magic_cost_and_residue(66, 60), (1, 22))
        self.assertEqual(c.magic_cost_and_residue(66, 200), (1, 22))

    def test_all_materials_improve_without_zero_residue(self):
        for base in range(1, 101):
            values = [c.magic_cost_and_residue(base, s) for s in range(301)]
            self.assertGreater(values[-1][1], 0)
            self.assertTrue(all(a[0] >= b[0] and a[1] >= b[1] for a, b in zip(values, values[1:])))

    def test_adamantine_spear_progress(self):
        novice = self.make()
        veteran = self.make(skill=211)
        self.assertTrue(novice["craftable"])
        self.assertEqual(novice["required_skill"], 151)
        self.assertEqual((novice["residual"], veteran["residual"]), (66, 22))
        self.assertGreater(veteran["enchantment_transmission"], novice["enchantment_transmission"])

    def test_skill_below_requirement_does_not_spend_extra_mana(self):
        result = self.make(skill=150)
        self.assertFalse(result["craftable"])
        self.assertIn("技能不足", result["reasons"])
        self.assertNotIn("magic_mana_multiplier", result)

    def test_traditional_forge_cannot_process_tungsten_at_300(self):
        result = self.make(material="S0060", route="F", skill=300)
        self.assertFalse(result["craftable"])
        self.assertIn("この経路では加工不可", result["reasons"])

    def test_torch_can_start_at_one(self):
        result = self.make(material="S0001", product="P0331", route="H", skill=1)
        self.assertTrue(result["craftable"])
        self.assertEqual(result["required_skill"], 1)

    def test_required_machine_and_knowledge_are_not_replaced_by_skill(self):
        self.assertIn("設備不足", self.make(route="I", skill=300, equipment=())["reasons"])
        self.assertIn("未発見技術", self.make(route="I", skill=300, technologies=())["reasons"])
        self.assertIn("加工品レシピ未取得", self.make(recipe_known=False)["reasons"])

    def test_top_technology_without_prerequisites_is_rejected(self):
        result = self.make(route="X", skill=300, technologies={"K12"})
        self.assertFalse(result["craftable"])
        self.assertIn("K01", result["missing_technologies"])

    def test_science_full_transmission_and_reused_mana(self):
        fresh = self.make(route="X", skill=296)
        reused = self.make(route="X", skill=296, inherited_residue=66)
        self.assertEqual((fresh["quality"], fresh["residual"], fresh["enchantment_transmission"]), (100, 0, 1))
        self.assertEqual((reused["quality"], reused["residual"], reused["enchantment_transmission"]), (100, 66, 0.34))

    def test_material_category_and_ore_are_not_automatic_finished_material(self):
        self.assertIn("素材カテゴリ不適合", self.make(material="S0259", product="P0195", route="H", skill=300)["reasons"])
        self.assertIn("鉱石は別レシピで精錬が必要", self.make(material="S0028", product="P0001", route="M", skill=300)["reasons"])

    def test_over_300_not_clamped(self):
        data = copy.deepcopy(self.data)
        data["material_work"]["S0135"][7] = "300"
        required, tech, eq = c.requirements(data, "S0135", "P0001", "X")
        self.assertEqual(required, 302)
        result = c.evaluate(data, "S0135", "P0001", "X", 300, tech, eq, True)
        self.assertIn("必要技能が上限300を超過", result["reasons"])

    def test_enchantment_tier_does_not_ignore_quality(self):
        self.assertFalse(c.enchantment_gate(5, 300, 85, {"K12"}, {"精密刻印機"}))
        self.assertFalse(c.enchantment_gate(5, 240, 95, {"K12"}, set()))
        self.assertTrue(c.enchantment_gate(5, 240, 95, {"K12"}, {"精密刻印機"}))


if __name__ == "__main__":
    unittest.main()
