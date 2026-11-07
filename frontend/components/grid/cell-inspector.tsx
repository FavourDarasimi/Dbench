"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  CheckIcon,
  Copy01Icon,
  ExpandIcon,
  ExternalLinkIcon,
  FileCodeIcon,
  KeyRoundIcon,
  LayersIcon,
  Link02Icon,
  ListIcon,
  PencilIcon,
  TableIcon,
  TrashIcon,
} from "@hugeicons/core-free-icons";
import { useQuery } from "@tanstack/react-query";
import { apiGet } from "@/lib/api";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import type { ColumnInfo, RowDetailResponse } from "@/lib/types";

interface CellInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  connectionId: string;
  schema: string;
  table: string;
  columns: ColumnInfo[];
  row: Record<string, unknown> | null;
  activeColumnName?: string | null;
  canMutate?: boolean;
  onEditRow?: (row: Record<string, unknown>) => void;
  onDeleteRow?: (row: Record<string, unknown>) => void;
}

export function CellInspector({
  isOpen,
  onClose,
  connectionId,
  schema,
  table,
  columns,
  row,
  activeColumnName,
  canMutate = false,
  onEditRow,
  onDeleteRow,
}: CellInspectorProps) {
  const { openBrowserTab } = useWorkspaceStore();
  const [activeTab, setActiveTab] = useState<"cell" | "row" | "related">("cell");
  const [selectedColumn, setSelectedColumn] = useState<string>(
    activeColumnName || columns[0]?.name || ""
  );
  const [copied, setCopied] = useState(false);

  // Identify Primary Key column if present
  const pkCol = columns.find((c) => c.is_primary_key);
  const pkValue = pkCol && row ? String(row[pkCol.name] ?? "") : null;

  // Fetch related row counts if PK is available
  const { data: detailData, isLoading: isDetailLoading } = useQuery<RowDetailResponse>({
    queryKey: ["row-detail", connectionId, schema, table, pkValue],
    queryFn: () =>
      apiGet<RowDetailResponse>(
        `/connections/${connectionId}/tables/${schema}.${table}/rows/${encodeURIComponent(
          pkValue || ""
        )}/`
      ),
    enabled: isOpen && !!pkValue && activeTab === "related",
  });

  if (!isOpen || !row) return null;

  const currentColumn = columns.find((c) => c.name === selectedColumn) || columns[0];
  const cellValue = currentColumn ? row[currentColumn.name] : null;

  let formattedValue = "";
  let isJson = false;

  if (cellValue === null || cellValue === undefined) {
    formattedValue = "NULL";
  } else if (typeof cellValue === "object") {
    try {
      formattedValue = JSON.stringify(cellValue, null, 2);
      isJson = true;
    } catch {
      formattedValue = String(cellValue);
    }
  } else {
    formattedValue = String(cellValue);
    // Check if valid JSON string
    if (
      (formattedValue.startsWith("{") && formattedValue.endsWith("}")) ||
      (formattedValue.startsWith("[") && formattedValue.endsWith("]"))
    ) {
      try {
        const parsed = JSON.parse(formattedValue);
        formattedValue = JSON.stringify(parsed, null, 2);
        isJson = true;
      } catch {
        // keep as string
      }
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(formattedValue);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[540px] md:w-[620px] bg-[#0c0c0e] border-l border-zinc-800 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800/80 bg-[#0a0a0c]">
        <div className="flex items-center gap-2">
          <div className="size-7 rounded-lg bg-emerald-950/60 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
            <HugeiconsIcon icon={ExpandIcon} className="size-4" />
          </div>
          <div>
            <div className="text-xs font-mono font-bold text-white flex items-center gap-1.5">
              <span>{schema}</span>
              <span className="text-zinc-600">/</span>
              <span>{table}</span>
            </div>
            <div className="text-[11px] text-zinc-400">Record & Value Inspector</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canMutate && row && onEditRow && (
            <button
              onClick={() => onEditRow(row)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-[3px] bg-[#141416] hover:bg-zinc-800 border border-zinc-800 text-xs sm:text-sm font-mono text-zinc-300 hover:text-blue-400 transition-colors cursor-pointer"
              title="Edit record"
            >
              <HugeiconsIcon icon={PencilIcon} className="size-3 text-blue-400" />
              <span>Edit</span>
            </button>
          )}

          {canMutate && row && onDeleteRow && (
            <button
              onClick={() => onDeleteRow(row)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-[3px] bg-[#141416] hover:bg-zinc-800 border border-zinc-800 text-xs sm:text-sm font-mono text-zinc-300 hover:text-red-400 transition-colors cursor-pointer"
              title="Delete record"
            >
              <HugeiconsIcon icon={TrashIcon} className="size-3 text-red-400" />
              <span>Delete</span>
            </button>
          )}

          <button
            onClick={onClose}
            className="size-7 rounded-[3px] hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Close inspector (Esc)"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center px-5 border-b border-zinc-800/80 bg-[#08080a] text-xs font-mono">
        <button
          onClick={() => setActiveTab("cell")}
          className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
            activeTab === "cell"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <HugeiconsIcon icon={FileCodeIcon} className="size-3.5" />
          <span>Cell Value</span>
        </button>

        <button
          onClick={() => setActiveTab("row")}
          className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
            activeTab === "row"
              ? "border-emerald-500 text-emerald-400"
              : "border-transparent text-zinc-400 hover:text-zinc-200"
          }`}
        >
          <HugeiconsIcon icon={ListIcon} className="size-3.5" />
          <span>Full Record ({columns.length})</span>
        </button>

        {pkCol && (
          <button
            onClick={() => setActiveTab("related")}
            className={`flex items-center gap-1.5 py-2.5 px-3 border-b-2 font-medium transition-colors cursor-pointer ${
              activeTab === "related"
                ? "border-emerald-500 text-emerald-400"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <HugeiconsIcon icon={LayersIcon} className="size-3.5" />
            <span>Related Tables</span>
          </button>
        )}
      </div>

      {/* Tab 1: Single Cell Value */}
      {activeTab === "cell" && (
        <div className="flex-1 flex flex-col overflow-hidden p-5">
          {/* Column Selector */}
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex-1">
              <label className="text-[10px] font-mono uppercase tracking-wider text-zinc-400 block mb-1">
                Selected Column
              </label>
              <select
                value={selectedColumn}
                onChange={(e) => setSelectedColumn(e.target.value)}
                className="w-full bg-[#121214] border border-zinc-800 rounded-lg px-2.5 py-1.5 text-xs font-mono text-zinc-200 focus:outline-none focus:border-emerald-500 cursor-pointer"
              >
                {columns.map((col) => (
                  <option key={col.name} value={col.name}>
                    {col.name} ({col.data_type}) {col.is_primary_key ? "• PK" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="shrink-0 self-end">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 px-3 py-1.5 rounded-[3px] bg-[#141416] hover:bg-zinc-800 border border-zinc-800 text-xs sm:text-sm font-mono text-zinc-300 hover:text-white transition-colors cursor-pointer"
                title="Copy value to clipboard"
              >
                {copied ? (
                  <>
                    <HugeiconsIcon icon={CheckIcon} className="size-3.5 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={Copy01Icon} className="size-3.5 text-zinc-400" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Column Metadata Badge Row */}
          {currentColumn && (
            <div className="flex flex-wrap items-center gap-2 mb-3 text-[11px] font-mono">
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                type: <span className="text-zinc-200">{currentColumn.data_type}</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                generic: <span className="text-zinc-200">{currentColumn.generic_type}</span>
              </span>
              {currentColumn.is_primary_key && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/40 border border-amber-500/30 text-amber-300">
                  <HugeiconsIcon icon={KeyRoundIcon} className="size-3 text-amber-400" />
                  Primary Key
                </span>
              )}
              {currentColumn.foreign_key && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-950/40 border border-blue-500/30 text-blue-300">
                  <HugeiconsIcon icon={Link02Icon} className="size-3 text-blue-400" />
                  → {currentColumn.foreign_key.target_schema}.
                  {currentColumn.foreign_key.target_table}.
                  {currentColumn.foreign_key.target_column}
                </span>
              )}
              <span className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                {currentColumn.nullable ? "nullable" : "not null"}
              </span>
            </div>
          )}

          {/* Formatted Text / JSON Viewport */}
          <div className="flex-1 bg-[#050507] border border-zinc-800/80 rounded-xl p-3 overflow-auto font-mono text-xs text-zinc-200 select-text leading-relaxed">
            {cellValue === null || cellValue === undefined ? (
              <span className="text-zinc-600 italic">NULL (No value set)</span>
            ) : isJson ? (
              <pre className="text-emerald-300/90 whitespace-pre-wrap break-all">
                {formattedValue}
              </pre>
            ) : (
              <p className="whitespace-pre-wrap break-words">{formattedValue}</p>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Full Record Inspection */}
      {activeTab === "row" && (
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-zinc-400">
              Record Fields ({columns.length} columns)
            </span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(row, null, 2));
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex items-center gap-1 text-[11px] font-mono text-zinc-400 hover:text-emerald-400 transition-colors"
            >
              {copied ? <HugeiconsIcon icon={CheckIcon} className="size-3 text-emerald-400" /> : <HugeiconsIcon icon={Copy01Icon} className="size-3" />}
              <span>Copy Full Record JSON</span>
            </button>
          </div>

          <div className="space-y-2">
            {columns.map((col) => {
              const val = row[col.name];
              const valStr =
                val === null || val === undefined
                  ? "NULL"
                  : typeof val === "object"
                  ? JSON.stringify(val)
                  : String(val);

              return (
                <div
                  key={col.name}
                  onClick={() => {
                    setSelectedColumn(col.name);
                    setActiveTab("cell");
                  }}
                  className="p-2.5 rounded-lg bg-[#121214] hover:bg-zinc-800/70 border border-zinc-800/60 hover:border-zinc-700 transition-colors cursor-pointer group"
                >
                  <div className="flex items-center justify-between text-xs font-mono mb-1">
                    <div className="flex items-center gap-1.5">
                      {col.foreign_key && <HugeiconsIcon icon={Link02Icon} className="size-3 text-blue-400" />}
                      <span className="font-semibold text-zinc-200 group-hover:text-emerald-300 transition-colors">
                        {col.name}
                      </span>
                    </div>
                    <span className="text-[10px] text-zinc-500">{col.data_type}</span>
                  </div>

                  <div className="text-xs font-mono text-zinc-400 truncate">
                    {val === null || val === undefined ? (
                      <span className="text-zinc-600 italic">NULL</span>
                    ) : (
                      valStr
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Related Rows & Foreign Key Reverse Lookups (F17) */}
      {activeTab === "related" && (
        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4">
            <h4 className="text-xs font-mono font-bold text-white mb-1">
              Referencing Records ({pkCol?.name} = {pkValue})
            </h4>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Tables in this database that hold foreign keys referencing this primary key.
            </p>
          </div>

          {isDetailLoading ? (
            <div className="flex items-center justify-center p-8 text-xs font-mono text-zinc-500">
              Loading foreign key relations...
            </div>
          ) : detailData?.related && detailData.related.length > 0 ? (
            <div className="space-y-2">
              {detailData.related.map((rel) => (
                <div
                  key={`${rel.schema}.${rel.table}.${rel.column}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-[#121214] border border-zinc-800 hover:border-zinc-700 transition-colors"
                >
                  <div>
                    <div className="text-xs font-mono font-semibold text-white flex items-center gap-1.5">
                      <HugeiconsIcon icon={TableIcon} className="size-3.5 text-emerald-400" />
                      <span>{rel.schema}</span>
                      <span className="text-zinc-600">/</span>
                      <span>{rel.table}</span>
                    </div>
                    <div className="text-[11px] font-mono text-zinc-500 mt-0.5">
                      via column <span className="text-zinc-300">`{rel.column}`</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-mono text-zinc-300">
                      {rel.count} rows
                    </span>

                    <button
                      onClick={() => {
                        onClose();
                        openBrowserTab(connectionId, rel.schema, rel.table, {
                          column: rel.column,
                          operator: "eq",
                          value: pkValue || "",
                        });
                      }}
                      disabled={rel.count === 0}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-950/60 hover:bg-emerald-900/80 border border-emerald-500/30 text-emerald-300 text-xs font-mono transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                    >
                      <span>View</span>
                      <HugeiconsIcon icon={ExternalLinkIcon} className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 bg-[#121214]/50 rounded-xl border border-dashed border-zinc-800 text-xs font-mono text-zinc-500">
              No foreign key relationships detected targeting this table.
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}
