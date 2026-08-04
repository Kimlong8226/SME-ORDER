const BREAKFAST_CATEGORIES = ['早餐', '早点'] as const;
const LUNCH_CATEGORIES = ['饭盒', '大型供餐'] as const;
const DINNER_CATEGORIES = ['饭盒', '大型供餐'] as const;

export const getMealSectionCategoryRule = (name: string): readonly string[] | null => {
  const normalizedName = String(name || '').trim().toLowerCase();
  if (normalizedName.includes('早餐') || normalizedName.includes('breakfast')) {
    return BREAKFAST_CATEGORIES;
  }
  if (normalizedName.includes('午餐') || normalizedName.includes('lunch')) {
    return LUNCH_CATEGORIES;
  }
  if (normalizedName.includes('晚餐') || normalizedName.includes('dinner')) {
    return DINNER_CATEGORIES;
  }
  return null;
};

export const getDefaultMealSectionCategories = (name: string): string[] => {
  const normalizedName = String(name || '').trim().toLowerCase();
  if (normalizedName.includes('早餐') || normalizedName.includes('breakfast')) {
    return ['早餐'];
  }
  if (
    normalizedName.includes('午餐')
    || normalizedName.includes('lunch')
    || normalizedName.includes('晚餐')
    || normalizedName.includes('dinner')
  ) {
    return ['大型供餐'];
  }
  return [];
};

export const parseMealSectionCategories = (value: string | string[] | null | undefined): string[] => {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(values.map(item => item.trim()).filter(Boolean))];
};

export const getEffectiveMealSectionCategories = (
  name: string,
  configuredCategories: string | string[] | null | undefined,
): string[] => {
  const configured = parseMealSectionCategories(configuredCategories);
  const rule = getMealSectionCategoryRule(name);
  return rule ? configured.filter(category => rule.some(allowed => allowed === category)) : configured;
};

export const getInvalidMealSectionCategories = (
  name: string,
  configuredCategories: string | string[] | null | undefined,
): string[] => {
  const configured = parseMealSectionCategories(configuredCategories);
  const rule = getMealSectionCategoryRule(name);
  return rule ? configured.filter(category => !rule.some(allowed => allowed === category)) : [];
};
