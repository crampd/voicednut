import type {
  ButtonHTMLAttributes,
  DetailsHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react';
import { forwardRef, useId } from 'react';

import { classNames } from '@/css/classnames';

type UiCardTone = 'default' | 'subcard' | 'fallback' | 'blocked' | 'status' | 'empty';

type UiButtonVariant = 'primary' | 'secondary' | 'chip' | 'plain';

type UiBadgeVariant = 'meta' | 'info' | 'success' | 'warning' | 'error';
type UiStateTone = 'info' | 'success' | 'warning' | 'error';

const CARD_TONE_CLASS: Record<UiCardTone, string> = {
  default: '',
  subcard: 'va-subcard',
  fallback: 'va-module-fallback',
  blocked: 'va-blocked',
  status: 'va-status-card',
  empty: 'va-empty-state',
};

const BUTTON_VARIANT_CLASS: Record<UiButtonVariant, string[]> = {
  primary: ['va-btn', 'va-btn-primary'],
  secondary: ['va-btn', 'va-btn-secondary'],
  chip: ['va-chip'],
  plain: [],
};

const BADGE_VARIANT_CLASS: Record<UiBadgeVariant, string[]> = {
  meta: ['va-meta-chip'],
  info: ['va-pill', 'va-pill-info'],
  success: ['va-pill', 'va-pill-success'],
  warning: ['va-pill', 'va-pill-warning'],
  error: ['va-pill', 'va-pill-error'],
};

type UiCardProps = HTMLAttributes<HTMLDivElement> & {
  tone?: UiCardTone;
};

export function UiCard({
  tone = 'default',
  className,
  children,
  ...rest
}: UiCardProps) {
  return (
    <div className={classNames('va-card', CARD_TONE_CLASS[tone], className)} {...rest}>
      {children}
    </div>
  );
}

type UiButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: UiButtonVariant;
};

export const UiButton = forwardRef<HTMLButtonElement, UiButtonProps>(function UiButton(
  {
    variant = 'secondary',
    className,
    type = 'button',
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={classNames(BUTTON_VARIANT_CLASS[variant], className)}
      {...rest}
    >
      {children}
    </button>
  );
});

type UiInputProps = InputHTMLAttributes<HTMLInputElement>;

export const UiInput = forwardRef<HTMLInputElement, UiInputProps>(function UiInput(
  {
    className,
    ...rest
  },
  ref,
) {
  return <input ref={ref} className={classNames('va-input', className)} {...rest} />;
});

type UiTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

export const UiTextarea = forwardRef<HTMLTextAreaElement, UiTextareaProps>(function UiTextarea(
  {
    className,
    ...rest
  },
  ref,
) {
  return (
    <textarea ref={ref} className={classNames('va-input', 'va-textarea', className)} {...rest} />
  );
});

type UiSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export const UiSelect = forwardRef<HTMLSelectElement, UiSelectProps>(function UiSelect(
  {
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <select ref={ref} className={classNames('va-input', className)} {...rest}>
      {children}
    </select>
  );
});

type UiBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: UiBadgeVariant;
  children: ReactNode;
};

export function UiBadge({
  variant = 'meta',
  className,
  children,
  ...rest
}: UiBadgeProps) {
  return (
    <span className={classNames(BADGE_VARIANT_CLASS[variant], className)} {...rest}>
      {children}
    </span>
  );
}

type UiMetricTileProps = HTMLAttributes<HTMLElement> & {
  label: ReactNode;
  value: ReactNode;
};

export function UiMetricTile({
  label,
  value,
  className,
  ...rest
}: UiMetricTileProps) {
  return (
    <article className={classNames('va-overview-metric-card', className)} {...rest}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

type UiSkeletonLineProps = HTMLAttributes<HTMLDivElement> & {
  short?: boolean;
};

export function UiSkeletonLine({
  short = false,
  className,
  ...rest
}: UiSkeletonLineProps) {
  return (
    <div
      className={classNames('va-module-skeleton-line', short && 'short', className)}
      {...rest}
    />
  );
}

type UiStatePanelProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description: ReactNode;
  tone?: UiStateTone;
  compact?: boolean;
  actions?: ReactNode;
};

export function UiStatePanel({
  title,
  description,
  tone = 'info',
  compact = false,
  actions,
  id,
  'aria-labelledby': ariaLabelledByProp,
  'aria-describedby': ariaDescribedByProp,
  'aria-live': ariaLiveProp,
  'aria-atomic': ariaAtomicProp,
  className,
  ...rest
}: UiStatePanelProps) {
  const role = tone === 'error' ? 'alert' : 'status';
  const ariaLive = ariaLiveProp || (tone === 'error' ? 'assertive' : 'polite');
  const ariaAtomic = ariaAtomicProp ?? true;
  const generatedId = useId();
  const panelId = id || `va-state-panel-${generatedId.replace(/:/g, '')}`;
  const titleId = `${panelId}-title`;
  const descriptionId = `${panelId}-description`;
  const descriptionIsPlainText = typeof description === 'string' || typeof description === 'number';

  return (
    <div
      id={panelId}
      role={role}
      aria-live={ariaLive}
      aria-atomic={ariaAtomic}
      aria-labelledby={ariaLabelledByProp || titleId}
      aria-describedby={ariaDescribedByProp || descriptionId}
      className={classNames(
        'va-state-panel',
        `is-${tone}`,
        compact && 'is-compact',
        className,
      )}
      {...rest}
    >
      <h3 id={titleId} className="va-state-panel-title">{title}</h3>
      {descriptionIsPlainText ? (
        <p id={descriptionId}>{description}</p>
      ) : (
        <div id={descriptionId} className="va-state-panel-description">
          {description}
        </div>
      )}
      {actions ? <div className="va-state-panel-actions">{actions}</div> : null}
    </div>
  );
}

type UiSurfaceStateProps = HTMLAttributes<HTMLDivElement> & {
  title: string;
  description: ReactNode;
  tone?: UiStateTone;
  cardTone?: UiCardTone;
  compact?: boolean;
  actions?: ReactNode;
  eyebrow?: ReactNode;
  status?: ReactNode;
  statusVariant?: UiBadgeVariant;
  statePanelClassName?: string;
};

export function UiSurfaceState({
  title,
  description,
  tone = 'info',
  cardTone = 'default',
  compact = false,
  actions,
  eyebrow,
  status,
  statusVariant = tone,
  className,
  statePanelClassName,
  ...rest
}: UiSurfaceStateProps) {
  return (
    <UiCard tone={cardTone} className={classNames('va-surface-state', className)} {...rest}>
      {eyebrow || status ? (
        <div className="va-surface-state-head">
          {eyebrow ? <span className="va-surface-state-eyebrow">{eyebrow}</span> : <span />}
          {status ? (
            <UiBadge variant={statusVariant} className="va-surface-state-status">
              {status}
            </UiBadge>
          ) : null}
        </div>
      ) : null}
      <UiStatePanel
        tone={tone}
        compact={compact}
        title={title}
        description={description}
        actions={actions}
        className={classNames('va-surface-state-panel', statePanelClassName)}
      />
    </UiCard>
  );
}

type UiWorkspacePulseItem = {
  label: ReactNode;
  value: ReactNode;
};

type UiWorkspacePulseTone = 'neutral' | UiStateTone;

type UiWorkspacePulseProps = HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  description?: ReactNode;
  status?: ReactNode;
  tone?: UiWorkspacePulseTone;
  items: readonly UiWorkspacePulseItem[];
};

const WORKSPACE_PULSE_TONE_TO_BADGE: Record<UiWorkspacePulseTone, UiBadgeVariant> = {
  neutral: 'meta',
  info: 'info',
  success: 'success',
  warning: 'warning',
  error: 'error',
};

export function UiWorkspacePulse({
  title,
  description,
  status,
  tone = 'neutral',
  items,
  className,
  ...rest
}: UiWorkspacePulseProps) {
  return (
    <UiCard
      tone="status"
      className={classNames(
        'va-workspace-pulse',
        tone !== 'neutral' && `is-${tone}`,
        className,
      )}
      {...rest}
    >
      <div className="va-workspace-pulse-head">
        <div className="va-workspace-pulse-copy">
          <strong className="va-workspace-pulse-title">{title}</strong>
          {description ? (
            <span className="va-workspace-pulse-description">{description}</span>
          ) : null}
        </div>
        {status ? (
          <UiBadge variant={WORKSPACE_PULSE_TONE_TO_BADGE[tone]} className="va-workspace-pulse-status">
            {status}
          </UiBadge>
        ) : null}
      </div>
      <div className="va-overview-metrics va-workspace-pulse-grid">
        {items.map((item, index) => (
          <UiMetricTile
            key={index}
            label={item.label}
            value={item.value}
          />
        ))}
      </div>
    </UiCard>
  );
}

type UiDisclosureTone = UiStateTone | 'neutral';

type UiDisclosureProps = DetailsHTMLAttributes<HTMLDetailsElement> & {
  title: ReactNode;
  subtitle?: ReactNode;
  tone?: UiDisclosureTone;
  children: ReactNode;
};

export function UiDisclosure({
  title,
  subtitle,
  tone = 'neutral',
  className,
  children,
  ...rest
}: UiDisclosureProps) {
  return (
    <details
      className={classNames(
        'va-drilldown',
        'va-disclosure',
        tone !== 'neutral' && `is-${tone}`,
        className,
      )}
      {...rest}
    >
      <summary className="va-disclosure-summary">
        <span className="va-disclosure-copy">
          <span className="va-disclosure-title">{title}</span>
          {subtitle ? <span className="va-disclosure-subtitle">{subtitle}</span> : null}
        </span>
      </summary>
      <div className="va-disclosure-body">
        {children}
      </div>
    </details>
  );
}

type UiActionBarProps = HTMLAttributes<HTMLDivElement> & {
  title: ReactNode;
  description?: ReactNode;
  actions: ReactNode;
};

export function UiActionBar({
  title,
  description,
  actions,
  className,
  ...rest
}: UiActionBarProps) {
  return (
    <div className={classNames('va-action-bar', className)} {...rest}>
      <div className="va-action-bar-copy">
        <strong className="va-action-bar-title">{title}</strong>
        {description ? <span className="va-action-bar-description">{description}</span> : null}
      </div>
      <div className="va-action-bar-actions">
        {actions}
      </div>
    </div>
  );
}
