"use client";

import { Link2 } from "lucide-react";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type { ForeignKeyInfo } from "@/lib/types";

interface ForeignKeyBadgeProps {
  connectionId: string;
  value: unknown;
  foreignKey: ForeignKeyInfo;
  onInspectTarget?: (targetSchema: string, targetTable: string, targetColumn: string, value: unknown) => void;
}

export function ForeignKeyBadge({
  connectionId,
  value,
  foreignKey,
  onInspectTarget,
}: ForeignKeyBadgeProps) {
  const { openBrowserTab } = useWorkspaceStore();

  if (value === null || value === undefined) {
    return <span className="text-zinc-600 font-mono text-[11px] italic">NULL</span>;
  }

  const strValue = String(value);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (onInspectTarget) {
          onInspectTarget(
            foreignKey.target_schema,
            foreignKey.target_table,
            foreignKey.target_column,
            strValue
          );
        } else {
          openBrowserTab(
            connectionId,
            foreignKey.target_schema,
            foreignKey.target_table,
            {
              column: foreignKey.target_column,
              operator: "eq",
              value: strValue,
            }
          );
        }
      }}
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono bg-blue-950/40 hover:bg-blue-900/60 text-blue-300 hover:text-blue-200 border border-blue-800/40 hover:border-blue-700/60 transition-colors group cursor-pointer max-w-full"
      title={`Foreign key → ${foreignKey.target_schema}.${foreignKey.target_table}.${foreignKey.target_column} (click to view)`}
    >
      <Link2 className="size-3 text-blue-400 group-hover:scale-110 shrink-0 transition-transform" />
      <span className="truncate">{strValue}</span>
    </button>
  );
}
