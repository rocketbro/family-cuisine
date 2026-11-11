// Settings: bring every first-visit tip back, on this phone.
import { useState } from 'react';
import { forgetSeen } from './tip-memory.ts';

export function ShowTipsAgain() {
  const [done, setDone] = useState(false);
  return (
    <section className="section stack">
      <button className="button quiet wide" onClick={() => { forgetSeen(); setDone(true); }}>Show tips again</button>
      {done && <p className="faint small" role="status" style={{ margin: 0 }}>Each screen will show its tip again on this phone.</p>}
    </section>
  );
}
