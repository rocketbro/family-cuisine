// The recipe's picture. Tap it to use our own photo or try another one from Unsplash; the
// credit Unsplash asks for sits quietly at the foot of the page.
import { Camera, RefreshCw } from 'lucide-react';
import { useRef, useState } from 'react';
import type { RecipeImage as Image } from '../../../domain/recipe.ts';
import { api } from '../../api.ts';
import { RecipeImage } from '../../ui/RecipeImage.tsx';
import { Sheet } from '../../ui/Sheet.tsx';

type Props = {
  slug: string; title: string; image: Image | null; canSearch: boolean; editable: boolean;
  onChanged: () => Promise<void>;
};

export function Portrait({ slug, title, image, canSearch, editable, onChanged }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const run = async (work: () => Promise<unknown>) => {
    setOpen(false);
    setNotFound(false);
    setBusy(true);
    try { await work(); await onChanged(); } finally { setBusy(false); }
  };

  const picture = <RecipeImage image={image} title={title} size="full" />;
  if (!editable) return <div className="portrait">{picture}</div>;

  return (
    <>
      <button className={`portrait ${busy ? 'busy' : ''}`} aria-label="Change the photo" onClick={() => setOpen(true)}>
        {picture}
        <span className="portrait-badge" aria-hidden="true"><Camera size={16} /></span>
      </button>
      <input ref={input} type="file" accept="image/*" hidden
        onChange={e => { const file = e.target.files?.[0]; if (file) void run(() => api.uploadRecipePhoto(slug, file)); }} />
      {notFound && <p className="faint small" role="status">Couldn’t find a different photo.</p>}
      {open && (
        <Sheet title="Photo" onClose={() => setOpen(false)}>
          <div className="stack" style={{ ['--gap' as string]: '10px' }}>
            <button className="button quiet wide" onClick={() => input.current?.click()}><Camera size={18} /> Use our photo</button>
            {canSearch && (
              <button className="button quiet wide" onClick={() => {
                // Finding another photo deletes one of our own for good.
                if (image?.kind === 'photo' && !window.confirm('This replaces your own photo, and it can’t be brought back. Find a different one?')) return;
                void run(async () => setNotFound(!(await api.refreshRecipeImage(slug)).found));
              }}><RefreshCw size={16} /> Find a different photo</button>
            )}
          </div>
        </Sheet>
      )}
    </>
  );
}

export function PhotoCredit({ image }: { image: Image | null }) {
  if (image?.kind !== 'unsplash') return null;
  return (
    <p className="faint small photo-credit">
      Photo by <a href={image.creditUrl} target="_blank" rel="noreferrer">{image.credit}</a> on{' '}
      <a href="https://unsplash.com/?utm_source=cuisine&utm_medium=referral" target="_blank" rel="noreferrer">Unsplash</a>
    </p>
  );
}
