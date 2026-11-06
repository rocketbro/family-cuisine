// A whole recipe in your own words, typed or said. Claude writes it up from there.
import { Mic } from 'lucide-react';
import { useDictation } from '../../dictation/useDictation.ts';
import { useFieldDictation } from '../../dictation/useFieldDictation.ts';

export function DescribeField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const dictation = useDictation();
  const listen = useFieldDictation('describe', 'Describe the recipe', text => {
    onChange(value.trim() ? `${value.trim()} ${text}` : text);
  });

  return (
    <div className="our-way">
      <div className="spread">
        <label className="eyebrow" htmlFor="describe">The recipe, in your words</label>
        <button type="button" className="icon-button" aria-label="Say it instead" disabled={dictation.phase !== 'idle'} onClick={listen}><Mic size={20} /></button>
      </div>
      <textarea id="describe" className="field" rows={8} value={value} onChange={e => onChange(e.target.value)}
        placeholder="Grandma’s chili: brown two pounds of ground beef with an onion, add kidney beans, two cans of tomatoes and a lot of cumin, and let it go for an hour." />
    </div>
  );
}
