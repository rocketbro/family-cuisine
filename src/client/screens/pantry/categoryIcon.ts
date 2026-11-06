// An icon for each pantry category, so a long list is easy to scan.
import { Beef, Carrot, Croissant, Leaf, Milk, Package, Shapes, Snowflake, Wheat, type LucideIcon } from 'lucide-react';

const ICONS: Record<string, LucideIcon> = {
  produce: Carrot,
  'dairy & eggs': Milk,
  meat: Beef,
  pantry: Package,
  baking: Wheat,
  bread: Croissant,
  frozen: Snowflake,
  spices: Leaf,
};

export function categoryIcon(category: string): LucideIcon {
  return ICONS[category.toLowerCase()] ?? Shapes;
}
