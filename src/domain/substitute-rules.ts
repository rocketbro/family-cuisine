// The common kitchen swaps, written per amount of the original. Hard-coded for now: these
// are the ones a home cook reaches for, and they don't change.
import type { Unit } from './units.ts';

export type SubstituteUse = { item: string; amount: number; unit: Unit | null };
export type SubstituteOption = { id: string; label: string; uses: SubstituteUse[]; note?: string };
export type SubstituteRule = {
  /** Ingredient names this covers, matched on whole words at the end ("large eggs" → egg). */
  names: string[];
  /** Names that end the same way but mean something else ("peanut butter"). */
  not?: string[];
  per: { amount: number; unit: Unit | null };
  options: SubstituteOption[];
};

const swap = (amount: number, unit: Unit | null, item: string): SubstituteUse => ({ item, amount, unit });

export const SUBSTITUTE_RULES: SubstituteRule[] = [
  { names: ['egg'], per: { amount: 1, unit: null }, options: [
    { id: 'flax-egg', label: 'Flax egg', uses: [swap(1, 'tbsp', 'ground flaxseed'), swap(3, 'tbsp', 'water')], note: 'Stir together and let it sit 5 minutes. Best in baking.' },
    { id: 'chia-egg', label: 'Chia egg', uses: [swap(1, 'tbsp', 'chia seeds'), swap(3, 'tbsp', 'water')], note: 'Let it gel for 5 minutes.' },
    { id: 'applesauce', label: 'Applesauce', uses: [swap(0.25, 'cup', 'applesauce')], note: 'For cakes, muffins and quick breads.' },
    { id: 'banana', label: 'Mashed banana', uses: [swap(0.25, 'cup', 'banana')], note: 'Adds a little banana flavor.' },
  ] },
  { names: ['sugar', 'granulated sugar', 'white sugar', 'cane sugar'], per: { amount: 1, unit: 'cup' }, options: [
    { id: 'honey', label: 'Honey', uses: [swap(0.75, 'cup', 'honey')], note: 'Cut other liquid a little (3 tbsp per cup) and bake 25°F lower.' },
    { id: 'maple', label: 'Maple syrup', uses: [swap(0.75, 'cup', 'maple syrup')], note: 'Cut other liquid a little (3 tbsp per cup).' },
    { id: 'brown-sugar', label: 'Brown sugar', uses: [swap(1, 'cup', 'brown sugar')], note: 'A little moister and more caramel.' },
  ] },
  { names: ['brown sugar', 'light brown sugar', 'dark brown sugar'], per: { amount: 1, unit: 'cup' }, options: [
    { id: 'sugar-molasses', label: 'Sugar and molasses', uses: [swap(1, 'cup', 'sugar'), swap(1, 'tbsp', 'molasses')] },
    { id: 'sugar', label: 'White sugar', uses: [swap(1, 'cup', 'sugar')], note: 'Slightly crisper, less caramel.' },
  ] },
  { names: ['powdered sugar', 'confectioners sugar'], per: { amount: 1, unit: 'cup' }, options: [
    { id: 'blended', label: 'Blended sugar', uses: [swap(1, 'cup', 'sugar'), swap(1, 'tbsp', 'cornstarch')], note: 'Blend until powdery.' },
  ] },
  { names: ['honey'], per: { amount: 1, unit: 'cup' }, options: [{ id: 'maple', label: 'Maple syrup', uses: [swap(1, 'cup', 'maple syrup')] }] },
  { names: ['maple syrup'], per: { amount: 1, unit: 'cup' }, options: [{ id: 'honey', label: 'Honey', uses: [swap(1, 'cup', 'honey')] }] },
  { names: ['baking powder'], per: { amount: 1, unit: 'tsp' }, options: [
    { id: 'soda-tartar', label: 'Baking soda and cream of tartar', uses: [swap(0.25, 'tsp', 'baking soda'), swap(0.5, 'tsp', 'cream of tartar')] },
  ] },
  { names: ['baking soda'], per: { amount: 1, unit: 'tsp' }, options: [
    { id: 'powder', label: 'Baking powder', uses: [swap(3, 'tsp', 'baking powder')], note: 'Three times as much; a little less salt.' },
  ] },
  { names: ['cream of tartar'], per: { amount: 0.5, unit: 'tsp' }, options: [{ id: 'lemon', label: 'Lemon juice', uses: [swap(1, 'tsp', 'lemon juice')] }] },
  { names: ['buttermilk'], per: { amount: 1, unit: 'cup' }, options: [
    { id: 'milk-lemon', label: 'Milk and lemon juice', uses: [swap(1, 'cup', 'milk'), swap(1, 'tbsp', 'lemon juice')], note: 'Let it sit 5 minutes.' },
    { id: 'milk-vinegar', label: 'Milk and vinegar', uses: [swap(1, 'cup', 'milk'), swap(1, 'tbsp', 'white vinegar')], note: 'Let it sit 5 minutes.' },
    { id: 'yogurt', label: 'Yogurt and milk', uses: [swap(0.75, 'cup', 'plain yogurt'), swap(0.25, 'cup', 'milk')] },
  ] },
  { names: ['milk', 'whole milk', '2% milk'], not: ['coconut milk', 'almond milk', 'oat milk', 'evaporated milk', 'condensed milk'], per: { amount: 1, unit: 'cup' }, options: [
    { id: 'evaporated', label: 'Evaporated milk and water', uses: [swap(0.5, 'cup', 'evaporated milk'), swap(0.5, 'cup', 'water')] },
    { id: 'oat', label: 'Oat milk', uses: [swap(1, 'cup', 'oat milk')] },
    { id: 'almond', label: 'Almond milk', uses: [swap(1, 'cup', 'almond milk')] },
  ] },
  { names: ['heavy cream', 'heavy whipping cream', 'whipping cream'], per: { amount: 1, unit: 'cup' }, options: [
    { id: 'milk-butter', label: 'Milk and melted butter', uses: [swap(0.75, 'cup', 'milk'), swap(0.25, 'cup', 'butter')], note: 'For cooking and baking; it won’t whip.' },
  ] },
  { names: ['sour cream'], per: { amount: 1, unit: 'cup' }, options: [{ id: 'greek', label: 'Greek yogurt', uses: [swap(1, 'cup', 'greek yogurt')] }] },
  { names: ['greek yogurt', 'plain yogurt', 'yogurt'], per: { amount: 1, unit: 'cup' }, options: [{ id: 'sour-cream', label: 'Sour cream', uses: [swap(1, 'cup', 'sour cream')] }] },
  { names: ['butter', 'unsalted butter', 'salted butter'], not: ['peanut butter', 'almond butter', 'apple butter'], per: { amount: 1, unit: 'cup' }, options: [
    { id: 'coconut-oil', label: 'Coconut oil', uses: [swap(1, 'cup', 'coconut oil')] },
    { id: 'oil', label: 'Olive oil', uses: [swap(0.75, 'cup', 'olive oil')], note: 'Where the butter is melted anyway.' },
  ] },
  { names: ['vegetable oil', 'canola oil'], per: { amount: 1, unit: 'cup' }, options: [
    { id: 'olive', label: 'Olive oil', uses: [swap(1, 'cup', 'olive oil')] },
    { id: 'coconut', label: 'Coconut oil', uses: [swap(1, 'cup', 'coconut oil')], note: 'Melt it first.' },
    { id: 'butter', label: 'Melted butter', uses: [swap(1, 'cup', 'butter')] },
    { id: 'applesauce', label: 'Applesauce', uses: [swap(1, 'cup', 'applesauce')], note: 'Baking only.' },
  ] },
  { names: ['cocoa powder', 'unsweetened cocoa', 'cocoa'], per: { amount: 1, unit: 'cup' }, options: [
    { id: 'cacao', label: 'Cacao powder', uses: [swap(1, 'cup', 'cacao powder')], note: 'Same amount; a little more bitter, so taste for sugar.' },
  ] },
  { names: ['cornstarch'], per: { amount: 1, unit: 'tbsp' }, options: [{ id: 'flour', label: 'Flour', uses: [swap(2, 'tbsp', 'all-purpose flour')], note: 'Cook it a minute longer to lose the raw taste.' }] },
  { names: ['self-rising flour', 'self rising flour'], per: { amount: 1, unit: 'cup' }, options: [
    { id: 'ap-plus', label: 'Flour, baking powder and salt', uses: [swap(1, 'cup', 'all-purpose flour'), swap(1.5, 'tsp', 'baking powder'), swap(0.25, 'tsp', 'salt')] },
  ] },
  { names: ['cake flour'], per: { amount: 1, unit: 'cup' }, options: [
    { id: 'ap-cornstarch', label: 'Flour and cornstarch', uses: [swap(0.875, 'cup', 'all-purpose flour'), swap(2, 'tbsp', 'cornstarch')] },
  ] },
  { names: ['lemon juice'], per: { amount: 1, unit: 'tbsp' }, options: [
    { id: 'lime', label: 'Lime juice', uses: [swap(1, 'tbsp', 'lime juice')] },
    { id: 'vinegar', label: 'White vinegar', uses: [swap(0.5, 'tbsp', 'white vinegar')] },
  ] },
  { names: ['lime juice'], per: { amount: 1, unit: 'tbsp' }, options: [{ id: 'lemon', label: 'Lemon juice', uses: [swap(1, 'tbsp', 'lemon juice')] }] },
  { names: ['garlic'], not: ['garlic powder', 'garlic salt'], per: { amount: 1, unit: 'clove' }, options: [{ id: 'powder', label: 'Garlic powder', uses: [swap(0.125, 'tsp', 'garlic powder')] }] },
  { names: ['onion', 'yellow onion', 'white onion'], not: ['green onion'], per: { amount: 1, unit: null }, options: [{ id: 'powder', label: 'Onion powder', uses: [swap(1, 'tbsp', 'onion powder')] }] },
  ...['parsley', 'basil', 'thyme', 'oregano', 'rosemary', 'dill', 'cilantro'].map(herb => ({
    names: [`fresh ${herb}`], per: { amount: 1, unit: 'tbsp' as const },
    options: [{ id: 'dried', label: `Dried ${herb}`, uses: [swap(1, 'tsp', `dried ${herb}`)], note: 'A third as much; add it earlier.' }],
  })),
  { names: ['chicken broth', 'chicken stock'], per: { amount: 1, unit: 'cup' }, options: [
    { id: 'bouillon', label: 'Bouillon and water', uses: [swap(1, 'tsp', 'chicken bouillon'), swap(1, 'cup', 'water')] },
    { id: 'veg', label: 'Vegetable broth', uses: [swap(1, 'cup', 'vegetable broth')] },
  ] },
  { names: ['vegetable broth', 'vegetable stock'], per: { amount: 1, unit: 'cup' }, options: [{ id: 'chicken', label: 'Chicken broth', uses: [swap(1, 'cup', 'chicken broth')] }] },
  { names: ['breadcrumbs', 'bread crumbs', 'panko'], per: { amount: 1, unit: 'cup' }, options: [
    { id: 'crackers', label: 'Crushed crackers', uses: [swap(1, 'cup', 'crackers')] },
    { id: 'oats', label: 'Rolled oats', uses: [swap(1, 'cup', 'rolled oats')] },
  ] },
  { names: ['vanilla extract', 'vanilla'], per: { amount: 1, unit: 'tsp' }, options: [{ id: 'maple', label: 'Maple syrup', uses: [swap(1, 'tsp', 'maple syrup')] }] },
  { names: ['tomato sauce'], per: { amount: 1, unit: 'cup' }, options: [{ id: 'paste', label: 'Tomato paste and water', uses: [swap(0.5, 'cup', 'tomato paste'), swap(0.5, 'cup', 'water')] }] },
  { names: ['shredded cheddar', 'cheddar cheese', 'cheddar'], per: { amount: 1, unit: 'cup' }, options: [
    { id: 'jack', label: 'Monterey Jack', uses: [swap(1, 'cup', 'monterey jack')] },
    { id: 'mozzarella', label: 'Mozzarella', uses: [swap(1, 'cup', 'shredded mozzarella')] },
  ] },
  { names: ['ground beef'], per: { amount: 1, unit: 'lb' }, options: [{ id: 'turkey', label: 'Ground turkey', uses: [swap(1, 'lb', 'ground turkey')] }] },
  { names: ['white wine'], per: { amount: 1, unit: 'cup' }, options: [{ id: 'broth-vinegar', label: 'Broth and vinegar', uses: [swap(1, 'cup', 'chicken broth'), swap(1, 'tbsp', 'white vinegar')] }] },
];

/** Always on hand, whatever the pantry says. */
export const ALWAYS_ON_HAND = ['water'];
