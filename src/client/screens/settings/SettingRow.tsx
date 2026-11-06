// A row that pushes its own screen, showing what's set there in a few words.
import { ChevronRight } from 'lucide-react';
import { TabLink } from '../../navigation/TabLink.tsx';

export function SettingRow({ to, title, value, ask }: { to: string; title: string; value: string; ask?: boolean }) {
  return (
    <TabLink to={to} className="setting-row">
      <span className="grow">
        <span className="setting-title">{title}</span>
        <span className={ask ? 'setting-value ask' : 'setting-value'}>{value}</span>
      </span>
      <ChevronRight size={20} className="chevron" />
    </TabLink>
  );
}
