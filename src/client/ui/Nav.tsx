// The five places in the app: a tab bar on phones, a sidebar on wider screens. Like a native
// tab bar, each tab remembers where you were in it; tapping the tab you're on goes to its top.
import { BookOpen, ClipboardList, Mic, Refrigerator, Settings, ShoppingBasket, Sun, type LucideIcon } from 'lucide-react';
import type { MouseEvent } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router';
import { useDictation } from '../dictation/useDictation.ts';
import { memory } from '../navigation/history.ts';
import { isSettings, TAB_ROOTS, tabOf, type NavState, type TabId } from '../navigation/tabs.ts';

const TABS: { id: TabId; label: string; icon: LucideIcon }[] = [
  { id: 'today', label: 'Today', icon: Sun },
  { id: 'week', label: 'Plan', icon: ClipboardList },
  { id: 'recipes', label: 'Recipes', icon: BookOpen },
  { id: 'pantry', label: 'Pantry', icon: Refrigerator },
  { id: 'shop', label: 'List', icon: ShoppingBasket },
];

export function Nav() {
  const dictation = useDictation();
  const location = useLocation();
  const navigate = useNavigate();
  const current = tabOf(location);

  const go = (tab: TabId) => (e: MouseEvent) => {
    e.preventDefault();
    const root = TAB_ROOTS[tab];
    if (tab === current) {
      // Already here: back to the top of the tab.
      if (location.pathname === root) window.scrollTo({ top: 0, behavior: 'smooth' });
      else navigate(root, { state: { tab } satisfies NavState });
      return;
    }
    const last = memory.lastIn(tab);
    memory.restoreNext();
    if (last) navigate(last.path, { state: last.state });
    else navigate(root, { state: { tab } satisfies NavState });
  };

  return (
    <div className="nav">
      <div className="nav-brand">Cuisine</div>
      <nav>
        {TABS.map(({ id, label, icon: Icon }) => (
          <a
            key={id}
            href={TAB_ROOTS[id]}
            onClick={go(id)}
            className={id === current && !isSettings(location.pathname) ? 'active' : ''}
            aria-current={id === current ? 'page' : undefined}
          >
            <Icon size={22} />
            <span>{label}</span>
          </a>
        ))}
      </nav>
      <div className="nav-extra">
        <button className="nav-item" disabled={dictation.phase !== 'idle'} onClick={() => dictation.start({ kind: 'anywhere' }, 'Anything: pantry, meals…')}>
          <Mic size={20} /><span>Talk to Cuisine</span>
        </button>
        <NavLink
          to="/settings"
          state={{ tab: 'today' } satisfies NavState}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
        >
          <Settings size={20} /><span>Settings</span>
        </NavLink>
      </div>
    </div>
  );
}
