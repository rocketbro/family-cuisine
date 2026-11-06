// One labelled control: the same label, spacing and help line everywhere in a form.
import type { ReactNode } from 'react';

type Props = {
  label: string;
  /** The control's id. Leave it out for a group of buttons, which names itself with aria-label. */
  htmlFor?: string;
  help?: ReactNode;
  /** Label on the left and the control on the right, for something small like a stepper. */
  inline?: boolean;
  children: ReactNode;
};

export function FormField({ label, htmlFor, help, inline, children }: Props) {
  const labelClass = 'eyebrow form-field-label';
  return (
    <div className={inline ? 'form-field inline' : 'form-field'}>
      {inline
        ? <div className="form-field-control">{htmlFor ? <label className={labelClass} htmlFor={htmlFor}>{label}</label> : <span className={labelClass}>{label}</span>}{children}</div>
        : <>{htmlFor ? <label className={labelClass} htmlFor={htmlFor}>{label}</label> : <span className={labelClass}>{label}</span>}{children}</>}
      {help && <p className="form-field-help">{help}</p>}
    </div>
  );
}
