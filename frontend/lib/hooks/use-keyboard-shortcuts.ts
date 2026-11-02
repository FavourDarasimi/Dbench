"use client";

import { useEffect } from "react";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";

interface UseKeyboardShortcutsOptions {
  onToggleCommandPalette?: () => void;
  onToggleHistory?: () => void;
  onToggleSavedQueries?: () => void;
  onOpenShortcuts?: () => void;
}

export function useKeyboardShortcuts({
  onToggleCommandPalette,
  onToggleHistory,
  onToggleSavedQueries,
  onOpenShortcuts,
}: UseKeyboardShortcutsOptions = {}) {
  const {
    openSqlTab,
    closeTab,
    toggleSidebar,
    activeTabId,
    activeConnectionId,
  } = useWorkspaceStore();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const tagName = target?.tagName?.toLowerCase();
      const isInputFocused =
        tagName === "input" ||
        tagName === "textarea" ||
        target?.isContentEditable ||
        target?.closest(".monaco-editor");

      // 1. Command Palette: Cmd+K / Ctrl+K (always captures)
      if (isCmdOrCtrl && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onToggleCommandPalette?.();
        return;
      }

      // 2. Toggle Schema Explorer Sidebar: Cmd+B / Ctrl+B
      if (isCmdOrCtrl && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
        return;
      }

      // 3. New SQL Query Tab: Cmd+T / Ctrl+T
      // Note: In browsers Cmd+T opens browser tab, but in web app or electron it can be trapped if preferred.
      // We also listen to Alt+T / Option+T as a foolproof alternative.
      if ((isCmdOrCtrl && e.key.toLowerCase() === "t") || (e.altKey && e.key.toLowerCase() === "t")) {
        e.preventDefault();
        if (activeConnectionId) {
          openSqlTab(activeConnectionId);
        }
        return;
      }

      // 4. Close Active Tab: Cmd+W / Ctrl+W or Alt+W
      if ((isCmdOrCtrl && e.key.toLowerCase() === "w") || (e.altKey && e.key.toLowerCase() === "w")) {
        if (activeTabId) {
          e.preventDefault();
          closeTab(activeTabId);
        }
        return;
      }

      // 5. Open Query History: Cmd+H / Ctrl+H or Alt+H
      if ((isCmdOrCtrl && e.key.toLowerCase() === "h") || (e.altKey && e.key.toLowerCase() === "h")) {
        e.preventDefault();
        onToggleHistory?.();
        return;
      }

      // 6. Keyboard Shortcuts Cheat Sheet: '?' (only when not typing in text field)
      if (e.key === "?" && !isInputFocused && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        onOpenShortcuts?.();
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    activeConnectionId,
    activeTabId,
    closeTab,
    openSqlTab,
    toggleSidebar,
    onToggleCommandPalette,
    onToggleHistory,
    onToggleSavedQueries,
    onOpenShortcuts,
  ]);
}
