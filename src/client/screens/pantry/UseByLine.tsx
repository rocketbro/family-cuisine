// A date as a fact: what it is, whether it's a guess or past, and the way to change or clear it.
import { shortDate, type ISODate } from '../../../domain/dates.ts';
import { USE_SOON_DAYS, goingOffSoon } from '../../../domain/use-by.ts';
import { PickDate } from './PickField.tsx';

type Props = { name: string; useBy: ISODate | null; estimated: boolean; today: ISODate; onChange: (useBy: ISODate | null) => void };

export function UseByLine({ name, useBy, estimated, today, onChange }: Props) {
  const urgent = useBy !== null && goingOffSoon([{ status: 'have' as const, useBy }], today, USE_SOON_DAYS).length > 0;
  const past = useBy !== null && useBy < today;
  return (
    <div className="item-line">
      <span className="item-label">Use by</span>
      <PickDate label={`Use-by date for ${name}`} value={useBy ?? ''} urgent={urgent} onChange={value => onChange(value || null)}>
        {useBy ? `${estimated ? 'About ' : ''}${shortDate(useBy)}${past ? ', past' : ''}` : 'No date'}
      </PickDate>
      <span className="item-line-end">
        {useBy && <button type="button" className="link-button" aria-label={`Clear the use-by date for ${name}`} onClick={() => onChange(null)}>Clear</button>}
      </span>
    </div>
  );
}
