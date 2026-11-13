import React from 'react';
import { useNexus } from '../../state/NexusContext';

export function MetricGauge({ label, value, sub, percent = 0, color }) {
  const { theme } = useNexus();
  const barColor = color || theme.ui.accent;
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));

  return (
    <div
      className="p-3.5 rounded-2xl border flex flex-col gap-2"
      style={{
        backgroundColor: theme.ui.bgSecondary,
        borderColor: theme.ui.border,
      }}
    >
      <div className="flex items-center justify-between text-xs">
        <span className="opacity-70">{label}</span>
        <span className="font-mono font-bold" style={{ color: barColor }}>
          {value}
        </span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${clamped}%`, backgroundColor: barColor }}
        />
      </div>
      {sub && <div className="text-[11px] opacity-60 font-mono truncate">{sub}</div>}
    </div>
  );
}

export function LogConsole({ title = 'Execution Console', lines = [], onClear, maxHeight = '240px' }) {
  const { theme } = useNexus();
  return (
    <div
      className="rounded-2xl border overflow-hidden flex flex-col"
      style={{
        backgroundColor: '#05080F',
        borderColor: theme.ui.border,
      }}
    >
      <div
        className="px-3 py-2 border-b flex items-center justify-between text-xs"
        style={{ backgroundColor: theme.ui.bgSecondary, borderColor: theme.ui.border }}
      >
        <span className="font-mono font-semibold" style={{ color: theme.ui.accent }}>
          {title}
        </span>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] px-2 py-0.5 rounded bg-white/5 hover:bg-white/10"
          >
            Clear
          </button>
        )}
      </div>
      <pre
        className="p-3 font-mono text-xs whitespace-pre-wrap break-all overflow-y-auto leading-relaxed"
        style={{ maxHeight, color: '#D1D5DB' }}
      >
        {lines.length > 0 ? lines.join('\n') : 'Ready. Real command output will stream here.'}
      </pre>
    </div>
  );
}

export function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
  const { theme } = useNexus();
  if (!open) return null;
  const accent = danger ? theme.ui.error : theme.ui.accent;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div
        className="w-full max-w-md rounded-2xl border p-5 space-y-4 shadow-2xl"
        style={{ backgroundColor: theme.ui.bgSecondary, borderColor: `${accent}55` }}
      >
        <h3 className="text-base font-bold" style={{ color: accent }}>
          {title}
        </h3>
        <p className="text-sm opacity-85 whitespace-pre-wrap">{message}</p>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/15"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-black"
            style={{ backgroundColor: accent }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

