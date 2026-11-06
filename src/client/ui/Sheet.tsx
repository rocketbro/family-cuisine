// A panel that slides up from the bottom (a centered dialog on desktop), so a quick choice
// doesn't feel like leaving the screen.
import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

export function Sheet({ title, onClose, children, footer, holdOpen }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode; holdOpen?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('sheet-open');
    return () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('sheet-open'); };
  }, [onClose]);

  return createPortal(
    <div className="sheet-backdrop" onClick={holdOpen ? undefined : onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Close" onClick={onClose}><X size={20} /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
