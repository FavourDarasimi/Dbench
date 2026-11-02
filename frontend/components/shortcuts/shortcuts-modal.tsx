"use client";

import { Keyboard, X } from "lucide-react";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutItem {
  keys: string[];
  description: string;
}

interface ShortcutGroup {
  category: string;
  items: ShortcutItem[];
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    category: "General",
    items: [
      { keys: ["⌘", "K"], description: "Open Command Palette" },
      { keys: ["?"], description: "Open Keyboard Shortcuts cheat sheet" },
      { keys: ["Esc"], description: "Close any modal, drawer, or palette" },
    ],
  },
  {
    category: "Workspace & Navigation",
    items: [
      { keys: ["⌘", "T"], description: "Open a new SQL Query tab" },
      { keys: ["⌘", "W"], description: "Close the currently active tab" },
      { keys: ["⌘", "B"], description: "Toggle schema explorer sidebar" },
      { keys: ["⌘", "H"], description: "Open query execution history" },
    ],
  },
  {
    category: "SQL Editor",
    items: [
      { keys: ["⌘", "↵"], description: "Execute SQL query (or selection)" },
      { keys: ["⌘", "S"], description: "Save query to snippets" },
      { keys: ["Ctrl", "Space"], description: "Trigger autocomplete / IntelliSense" },
    ],
  },
];

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-[#0c0c0e] border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden font-mono text-xs">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#0e0e11]">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Keyboard className="size-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Keyboard Shortcuts</h3>
              <p className="text-[11px] text-zinc-400">Speed up your workflow with hotkeys</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Shortcuts List */}
        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.category} className="space-y-2.5">
              <h4 className="text-[11px] font-bold text-zinc-500 uppercase tracking-wider">
                {group.category}
              </h4>
              <div className="space-y-1.5">
                {group.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-[#141417] border border-zinc-800/80 hover:border-zinc-700 transition-colors"
                  >
                    <span className="text-zinc-300 text-xs">{item.description}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-0.5 rounded-md bg-[#08080a] border border-zinc-700 text-zinc-300 text-[11px] font-semibold shadow-xs"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-800 bg-[#0a0a0c] text-[11px] text-zinc-500">
          <span>Tip: Press <kbd className="px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300">Esc</kbd> anytime to dismiss.</span>
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
