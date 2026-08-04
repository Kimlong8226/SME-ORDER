from collections.abc import Iterable

from model.models import MealSection


BREAKFAST_CATEGORIES = frozenset({"早餐", "早点"})
LUNCH_CATEGORIES = frozenset({"饭盒", "大型供餐"})
DINNER_CATEGORIES = frozenset({"饭盒", "大型供餐"})


def category_rule_for_meal_section(name: str) -> frozenset[str] | None:
    normalized_name = (name or "").strip().lower()
    if "早餐" in normalized_name or "breakfast" in normalized_name:
        return BREAKFAST_CATEGORIES
    if "午餐" in normalized_name or "lunch" in normalized_name:
        return LUNCH_CATEGORIES
    if "晚餐" in normalized_name or "dinner" in normalized_name:
        return DINNER_CATEGORIES
    return None


def parse_categories(value: str | Iterable[str] | None) -> set[str]:
    values = value.split(",") if isinstance(value, str) else (value or [])
    return {str(item).strip() for item in values if str(item).strip()}


def effective_meal_section_categories(section: MealSection) -> set[str]:
    configured = parse_categories(section.allowed_categories)
    rule = category_rule_for_meal_section(section.name)
    return configured.intersection(rule) if rule is not None else configured


def invalid_meal_section_categories(name: str, categories: str | Iterable[str] | None) -> set[str]:
    configured = parse_categories(categories)
    rule = category_rule_for_meal_section(name)
    return configured.difference(rule) if rule is not None else set()
