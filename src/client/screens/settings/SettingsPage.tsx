// The frame of a screen pushed from Settings: its title, an optional action, a line saying what
// the screen is for, then the controls. Back is the edge swipe, as everywhere.
import type { ReactNode } from 'react';

export function SettingsPage({ title, action, intro, children }: { title: string; action?: ReactNode; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="page">
      <div className="spread title-row">
        <h1>{title}</h1>
        {action}
      </div>
      {intro && <p className="settings-intro">{intro}</p>}
      <div className="settings-body">{children}</div>
    </div>
  );
}
