// Where the evening's "Did you go shopping today?" lands: add the receipt, or say which day it's really on.
import { Receipt as ReceiptIcon } from 'lucide-react';
import { useState } from 'react';
import { useParams } from 'react-router';
import { addDays, longDate, weekdayDate } from '../../../domain/dates.ts';
import { api } from '../../api.ts';
import { announceChange } from '../../data-events.ts';
import { useToday } from '../../hooks/useToday.ts';
import { useWrite } from '../../hooks/useWrite.ts';
import { TabLink } from '../../navigation/TabLink.tsx';
import { useBack } from '../../navigation/useTabNav.ts';
import { useReceiptUpload } from './useReceiptUpload.ts';

export function TripCheckScreen() {
  const today = useToday();
  const { date = today } = useParams();
  const back = useBack();
  const { busy, error, upload } = useReceiptUpload();
  const write = useWrite();
  const dayAfter = addDays(date > today ? date : today, 1);
  const [day, setDay] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);

  const move = async (to: string) => {
    setMoving(true);
    const moved = await write.run(async () => {
      await api.moveTrip(date, to);
      announceChange();
    });
    setMoving(false);
    if (moved) back();
  };

  return (
    <div className="page">
      <span className="eyebrow">{longDate(date)}</span>
      <h1 style={{ marginTop: 6 }}>Did you go shopping?</h1>

      <section className="section stack">
        <label className="button wide" style={{ cursor: 'pointer' }}>
          <ReceiptIcon size={18} /> {busy ? 'Sending it…' : 'Add the receipt'}
          <input type="file" accept="image/*,application/pdf" multiple hidden disabled={busy} onChange={e => void upload(Array.from(e.target.files ?? []))} />
        </label>
        {error && <p className="error">{error}</p>}
        <TabLink to="/shop" className="button quiet wide">We went, no receipt</TabLink>
      </section>

      <section className="section stack">
        <span className="eyebrow">We didn’t go</span>
        <div className="row" style={{ gap: 10, flexWrap: 'wrap' }}>
          <span className="muted">We’ll go on</span>
          <label className="chip date-chip" aria-pressed>
            {weekdayDate(day ?? dayAfter)}
            <input type="date" min={today} value={day ?? dayAfter} aria-label="The day you’ll go" onChange={e => setDay(e.target.value || null)} />
          </label>
        </div>
        <button className="button quiet wide" disabled={moving} onClick={() => void move(day ?? dayAfter)}>Move the trip to {weekdayDate(day ?? dayAfter)}</button>
        {write.problem && <p className="error">{write.problem}</p>}
      </section>
    </div>
  );
}
