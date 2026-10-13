import type { ComponentChildren } from 'preact';
import { usePracticeTimer } from '../state/practice';
import { toolInfo, type ToolId } from '../tools/registry';

export function ToolHeader(props: { id: ToolId; children?: ComponentChildren; actions?: ComponentChildren }) {
  const t = toolInfo(props.id);
  usePracticeTimer(props.id);
  return (
    <div class="tool-head">
      <div class="tool-title">
        <span class="eyebrow code">
          <span class="led" style={{ '--c': t.color }} />
          {t.code}
        </span>
        <h1>{t.name}</h1>
        {props.children && <p>{props.children}</p>}
      </div>
      {props.actions && <div class="row">{props.actions}</div>}
    </div>
  );
}

export interface SegOption<T extends string | number> {
  value: T;
  label: ComponentChildren;
  title?: string;
}

export function Seg<T extends string | number>(props: {
  value: T;
  options: SegOption<T>[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div class="seg" role="group" aria-label={props.label}>
      {props.options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === props.value} title={o.title} onClick={() => props.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Field(props: { label: string; htmlFor?: string; children: ComponentChildren; grow?: boolean }) {
  return (
    <div class="field" style={props.grow ? { flex: '1 1 200px' } : undefined}>
      {props.htmlFor ? <label for={props.htmlFor}>{props.label}</label> : <span class="label">{props.label}</span>}
      {props.children}
    </div>
  );
}

export function PlayIcon() {
  return (
    <svg class="ic" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M4 2.5v11l9-5.5z" fill="currentColor" />
    </svg>
  );
}

export function StopIcon() {
  return (
    <svg class="ic" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" fill="currentColor" />
    </svg>
  );
}

export function SpeakerIcon() {
  return (
    <svg class="ic" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M2 6h3l4-3v10l-4-3H2z" fill="currentColor" />
      <path d="M11 5.5c1 .8 1 4.2 0 5M12.8 4c1.9 1.6 1.9 6.4 0 8" stroke="currentColor" fill="none" stroke-width="1.3" stroke-linecap="round" />
    </svg>
  );
}

export function MicIcon() {
  return (
    <svg class="ic" viewBox="0 0 16 16" aria-hidden="true">
      <rect x="5.5" y="1.5" width="5" height="8.5" rx="2.5" fill="currentColor" />
      <path d="M3.5 7.5a4.5 4.5 0 0 0 9 0M8 12v2.5" stroke="currentColor" fill="none" stroke-width="1.4" stroke-linecap="round" />
    </svg>
  );
}
