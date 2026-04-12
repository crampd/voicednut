import type { ReactNode } from 'react';

type AdminPageIntroProps = {
  eyebrow: string;
  title: string;
  summary: ReactNode;
  meta?: ReactNode;
  note?: ReactNode;
  metaAriaLabel?: string;
};

export function AdminPageIntro({
  eyebrow,
  title,
  summary,
  meta,
  note,
  metaAriaLabel,
}: AdminPageIntroProps) {
  return (
    <section className="va-page-intro va-title-card">
      <div className="va-title-card-copy">
        <div className="va-title-card-eyebrow-row">
          <p className="va-kicker va-title-card-eyebrow">{eyebrow}</p>
        </div>
        <h2 className="va-page-title va-title-card-title">{title}</h2>
        <p className="va-muted va-title-card-note">{summary}</p>
      </div>
      {meta ? (
        <div className="va-page-intro-meta va-title-card-meta" aria-label={metaAriaLabel}>
          {meta}
        </div>
      ) : null}
      {note ? <p className="va-page-intro-note va-title-card-note">{note}</p> : null}
    </section>
  );
}
