// One pantry category, foldable. Folded, it still says what's running low.
import { ChevronDown } from 'lucide-react';
import { createElement, type ReactNode } from 'react';
import type { PantryItem } from '../../../domain/pantry.ts';
import { categoryIcon } from './categoryIcon.ts';

type Props = { name: string; items: PantryItem[]; collapsed: boolean; onToggle: () => void; children: ReactNode };

export function CategorySection({ name, items, collapsed, onToggle, children }: Props) {
  const low = items.filter(i => !i.staple && !i.occasional && i.status === 'low').length;
  const out = items.filter(i => !i.staple && !i.occasional && i.status === 'out').length;
  const note = [low && `${low} low`, out && `${out} out`].filter(Boolean).join(' · ');

  return (
    <section className="section category">
      <button className="category-head" aria-expanded={!collapsed} onClick={onToggle}>
        {createElement(categoryIcon(name), { size: 18 })}
        <span className="eyebrow grow">{name}</span>
        <span className="faint small">{collapsed && note ? note : items.length}</span>
        <ChevronDown size={18} className="chevron" />
      </button>
      {!collapsed && <div className="list">{children}</div>}
    </section>
  );
}
