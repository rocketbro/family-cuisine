// Bring a recipe in: paste a link (credit kept), photograph cookbook pages, or just describe it.
// With a link or photos you can add how you actually make it, and the model folds it in.
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { api } from '../api.ts';
import { ApiError } from '../api-error.ts';
import { Camera } from 'lucide-react';
import { BlockedOffer, type BlockedStep } from './import/BlockedOffer.tsx';
import { DescribeField } from './import/DescribeField.tsx';
import { OurWayField } from './import/OurWayField.tsx';
import { Segmented } from '../ui/Common.tsx';

type Mode = 'link' | 'photos' | 'words';

export function ImportScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<Mode>('link');
  const [url, setUrl] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [source, setSource] = useState('');
  const [notes, setNotes] = useState('');
  const [words, setWords] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<BlockedStep | null>(null);

  const run = async (work: () => Promise<{ slug: string }>, whenBlocked?: (problem: unknown) => BlockedStep | null) => {
    setBusy(true);
    setError(null);
    setBlocked(null);
    try {
      const { slug } = await work();
      navigate(`/recipes/${slug}`, { replace: true, state: location.state });
    } catch (e) {
      setError((e as Error).message);
      setBlocked(whenBlocked?.(e) ?? null);
    } finally {
      setBusy(false);
    }
  };

  const importLink = () => run(() => api.importUrl(url.trim(), notes), e => (e instanceof ApiError && e.code === 'site-refused' ? 'ask' : null));
  const tryClaude = () => run(() => api.importUrl(url.trim(), notes, true), () => 'screenshots');
  const choose = (next: Mode) => {
    setMode(next);
    setError(null);
    setBlocked(null);
  };
  const useScreenshots = () => {
    if (URL.canParse(url.trim())) setSource(new URL(url.trim()).hostname.replace(/^www\./, ''));
    choose('photos');
  };

  return (
    <div className="page">
      <h1 style={{ marginBottom: 18 }}>Add a recipe</h1>
      <Segmented
        label="Import from"
        value={mode}
        onChange={choose}
        options={[{ value: 'link', label: 'Link' }, { value: 'photos', label: 'Photos' }, { value: 'words', label: 'Describe it' }]}
      />

      {mode === 'words' ? (
        <form className="stack section" onSubmit={e => { e.preventDefault(); void run(() => api.importWords(words)); }}>
          <DescribeField value={words} onChange={setWords} />
          <button className="button wide" disabled={busy || !words.trim()}>{busy ? 'Writing it up…' : 'Add recipe'}</button>
        </form>
      ) : mode === 'link' ? (
        <form className="stack section" onSubmit={e => { e.preventDefault(); void importLink(); }}>
          <input className="field" type="url" inputMode="url" placeholder="https://…" value={url} onChange={e => setUrl(e.target.value)} />
          <p className="muted small">We keep a “Sourced from” credit linking back to the site.</p>
          <OurWayField value={notes} onChange={setNotes} />
          <button className="button wide" disabled={busy || !url.trim()}>{busy ? 'Reading the recipe…' : 'Import'}</button>
        </form>
      ) : (
        <div className="stack section">
          <label className="button quiet wide" style={{ cursor: 'pointer' }}>
            <Camera size={18} /> {photos.length ? `${photos.length} page${photos.length > 1 ? 's' : ''} — add more` : 'Take or choose photos'}
            <input type="file" accept="image/*" multiple hidden onChange={e => setPhotos([...photos, ...Array.from(e.target.files ?? [])])} />
          </label>
          {photos.length > 0 && (
            <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
              {photos.map((p, i) => <img key={i} src={URL.createObjectURL(p)} alt="" style={{ width: 72, height: 96, objectFit: 'cover', borderRadius: 8 }} />)}
            </div>
          )}
          <input className="field" placeholder="Where it's from (optional), e.g. Joy of Cooking" value={source} onChange={e => setSource(e.target.value)} />
          <OurWayField value={notes} onChange={setNotes} />
          <button className="button wide" disabled={busy || !photos.length} onClick={() => run(() => api.importPhotos(photos, source, notes))}>
            {busy ? 'Reading the pages…' : 'Import'}
          </button>
        </div>
      )}
      {busy && <p className="faint italic" style={{ marginTop: 12 }}>This takes about half a minute.</p>}
      {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}
      {blocked && <BlockedOffer step={blocked} busy={busy} onYes={() => void tryClaude()} onNo={() => setBlocked('screenshots')} onScreenshots={useScreenshots} />}
    </div>
  );
}
