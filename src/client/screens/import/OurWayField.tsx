// "How we make it": anything the recipe doesn't say that you just know. Type as much as you
// like, or tap the mic and say it; the words land in the box so you can fix them.
import { Mic } from 'lucide-react';
import { useDictation } from '../../dictation/useDictation.ts';
import { useFieldDictation } from '../../dictation/useFieldDictation.ts';

export function OurWayField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const dictation = useDictation();
  const listen = useFieldDictation('our-way', 'How you make it', text => {
    onChange(value.trim() ? `${value.trim()} ${text}` : text);
  });

  return (
    <div className="our-way">
      <div className="spread">
        <label className="eyebrow" htmlFor="our-way">How we make it (optional)</label>
        <button type="button" className="icon-button" aria-label="Say it instead" disabled={dictation.phase !== 'idle'} onClick={listen}><Mic size={20} /></button>
      </div>
      <textarea id="our-way" className="field" rows={4} value={value} onChange={e => onChange(e.target.value)}
        placeholder="We use half the sugar, double the garlic, and bake it in the 9×13 for 35 minutes." />
    </div>
  );
}
