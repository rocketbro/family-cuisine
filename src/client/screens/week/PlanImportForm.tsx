// The plan, however you have it: a photo, typed or pasted words, or said out loud.
import { Camera, Mic } from 'lucide-react';
import { useState } from 'react';
import { api } from '../../api.ts';
import { useDictation } from '../../dictation/useDictation.ts';
import { useFieldDictation } from '../../dictation/useFieldDictation.ts';
import { useWrite } from '../../hooks/useWrite.ts';

export function PlanImportForm({ aiOn, onStarted }: { aiOn: boolean; onStarted: () => Promise<void> }) {
  const [text, setText] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const dictation = useDictation();
  const write = useWrite();
  const [busy, setBusy] = useState(false);
  const listen = useFieldDictation('plan-import', 'Say the meal plan', words => setText(now => (now.trim() ? `${now.trim()} ${words}` : words)));

  const read = async () => {
    setBusy(true);
    await write.run(async () => { await api.startPlanImport(text, photos); await onStarted(); });
    setBusy(false);
  };

  if (!aiOn) return <p className="notice section">Reading a written plan needs the Anthropic API key in <code>.env</code>, and there isn’t one. You can still plan meals one at a time from the Week tab.</p>;

  return (
    <div className="stack section">
      <p className="muted" style={{ margin: 0 }}>Partial is fine, and so is “tacos Tues”. Claude reads it and shows you each meal. Nothing is saved until you say so, and no recipes get made up.</p>
      <label className="button quiet wide" style={{ cursor: 'pointer' }}>
        <Camera size={18} /> {photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''}, add more` : 'Take or choose a photo'}
        <input type="file" accept="image/*" multiple hidden onChange={e => setPhotos([...photos, ...Array.from(e.target.files ?? [])])} />
      </label>
      {photos.length > 0 && (
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          {photos.map((p, i) => <img key={i} src={URL.createObjectURL(p)} alt="" style={{ width: 72, height: 96, objectFit: 'cover', borderRadius: 8 }} />)}
        </div>
      )}
      <div className="our-way">
        <div className="spread">
          <label className="eyebrow" htmlFor="plan-import">Or in words</label>
          <button type="button" className="icon-button" aria-label="Say it instead" disabled={dictation.phase !== 'idle'} onClick={listen}><Mic size={20} /></button>
        </div>
        <textarea id="plan-import" className="field" rows={8} value={text} onChange={e => setText(e.target.value)}
          placeholder={'Mon: chili\nTues: tacos\nWed: leftovers\nFri lunch: soup\nSat: birthday cake'} />
      </div>
      <button className="button wide" disabled={busy || (!text.trim() && !photos.length)} onClick={read}>{busy ? 'Sending it…' : 'Read this plan'}</button>
      {write.problem && <p className="error">{write.problem}</p>}
    </div>
  );
}
