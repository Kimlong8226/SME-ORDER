import unittest
from types import SimpleNamespace

from api.meal_section_rules import (
    category_rule_for_meal_section,
    effective_meal_section_categories,
    invalid_meal_section_categories,
)


class MealSectionRulesTest(unittest.TestCase):
    def test_breakfast_excludes_bulk_meals(self):
        section = SimpleNamespace(name="早餐（供餐）", allowed_categories="早餐,大型供餐")
        self.assertEqual(effective_meal_section_categories(section), {"早餐"})

    def test_lunch_keeps_bento_and_bulk_meals(self):
        section = SimpleNamespace(name="午餐（供餐）", allowed_categories="饭盒,大型供餐,Buffet")
        self.assertEqual(effective_meal_section_categories(section), {"饭盒", "大型供餐"})

    def test_dinner_keeps_bento_and_bulk_meals(self):
        section = SimpleNamespace(name="晚餐（供餐）", allowed_categories="饭盒,大型供餐,Buffet")
        self.assertEqual(effective_meal_section_categories(section), {"饭盒", "大型供餐"})

    def test_english_names_use_the_same_rules(self):
        self.assertEqual(category_rule_for_meal_section("Breakfast"), {"早餐", "早点"})
        self.assertEqual(category_rule_for_meal_section("Day Shift Lunch"), {"饭盒", "大型供餐"})
        self.assertEqual(category_rule_for_meal_section("Dinner"), {"饭盒", "大型供餐"})

    def test_custom_section_preserves_configured_categories(self):
        section = SimpleNamespace(name="下午茶点", allowed_categories="茶点,Buffet")
        self.assertEqual(effective_meal_section_categories(section), {"茶点", "Buffet"})

    def test_invalid_categories_are_reported_for_admin_validation(self):
        self.assertEqual(invalid_meal_section_categories("早班早餐", "早餐,大型供餐"), {"大型供餐"})


if __name__ == "__main__":
    unittest.main()
