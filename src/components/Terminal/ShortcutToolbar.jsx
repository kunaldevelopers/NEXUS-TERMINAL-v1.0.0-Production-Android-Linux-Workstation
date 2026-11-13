import React from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from 'lucide-react';
import { ALL_CUSTOMIZABLE_KEYS } from '../../constants/shortcuts';
import { useNexus } from '../../state/NexusContext';

const ARROW_ICONS = {
  up: ArrowUp,
  down: ArrowDown,
  left: ArrowLeft,
  right: ArrowRight,
};

export default function ShortcutToolbar({
  ctrlActive,
  altActive,
  onToggleCtrl,
  onToggleAlt,
  onSendSequence,
}) {
  const { settings, theme } = useNexus();
  const keyIds = settings.toolbarKeyIds || [];
  const keys = keyIds
    .map((id) => ALL_CUSTOMIZABLE_KEYS.find((k) => k.id === id))
    .filter(Boolean);

  return (
    <div
      className="shrink-0 border-t px-2 py-1.5 flex items-center gap-1.5 overflow-x-auto select-none"
      style={{
        backgroundColor: theme.ui.bgSecondary,
        borderColor: theme.ui.border,
      }}
    >
      {keys.map((key) => {
        const isCtrl = key.mod === 'ctrl';
        const isAlt = key.mod === 'alt';
        const active = (isCtrl && ctrlActive) || (isAlt && altActive);
        const ArrowIcon = ARROW_ICONS[key.id];

        return (
          <button
            key={key.id}
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
            }}
            onClick={() => {
              if (isCtrl) {
                onToggleCtrl();
              } else if (isAlt) {
                onToggleAlt();
              } else {
                onSendSequence(key.value);
              }
            }}
            className="shrink-0 h-8 min-w-10 px-2.5 rounded-lg font-mono text-[11px] font-semibold flex items-center justify-center border active:scale-95 transition"
            style={{
              backgroundColor: active ? `${theme.ui.accent}30` : theme.ui.bgElevated,
              borderColor: active ? theme.ui.accent : 'rgba(255,255,255,0.10)',
              color: active ? theme.ui.accent : theme.ui.text,
            }}
          >
            {ArrowIcon ? <ArrowIcon className="w-3.5 h-3.5" /> : key.label}
          </button>
        );
      })}
    </div>
  );
}

