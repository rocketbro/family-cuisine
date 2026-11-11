// How this phone reads the app, right here, and a row for everything else.
import { api } from '../api.ts';
import { useLoad } from '../hooks/useLoad.ts';
import { usePreferences } from '../preferences.ts';
import { ShowTipsAgain } from '../onboarding/ShowTipsAgain.tsx';
import { Segmented } from '../ui/Common.tsx';
import { SettingsMenu } from './settings/SettingsMenu.tsx';

export function SettingsScreen() {
  const [prefs, update] = usePreferences();
  const { data: status } = useLoad('status', () => api.status());

  return (
    <div className="page">
      <h1>Settings</h1>

      <section className="section stack">
        <span className="eyebrow">Text size</span>
        <Segmented label="Text size" value={prefs.size} onChange={size => update({ size })}
          options={[{ value: 's', label: 'Small' }, { value: 'm', label: 'Medium' }, { value: 'l', label: 'Large' }, { value: 'xl', label: 'Largest' }]} />
        <span className="eyebrow">Typeface</span>
        <Segmented label="Typeface" value={prefs.font} onChange={font => update({ font })}
          options={[
            { value: 'serif', label: <span style={{ fontFamily: 'var(--serif)', fontSize: '1rem' }}>Serif</span> },
            { value: 'sans', label: <span style={{ fontFamily: 'var(--sans)' }}>Sans serif</span> },
          ]} />
        <span className="eyebrow">Appearance</span>
        <Segmented label="Appearance" value={prefs.theme} onChange={theme => update({ theme })}
          options={[{ value: 'auto', label: 'Auto' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
      </section>

      <SettingsMenu status={status} />
      <ShowTipsAgain />

      {status && (
        <p className="faint small section">
          Planning with {status.ai ? 'Claude' : 'the simple rotation (no API key yet)'} · photos {status.images ? 'from Unsplash' : 'off (no Unsplash key yet)'}
        </p>
      )}
    </div>
  );
}
