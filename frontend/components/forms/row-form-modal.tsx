"use client";

import { useState, useEffect, useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Cancel01Icon,
  Link02Icon,
  LockIcon,
  ReloadIcon,
} from "@hugeicons/core-free-icons";
import { apiPost } from "@/lib/api";
import { cn } from "@/lib/utils";
import type {
  ColumnInfo,
  RowMutationAction,
  RowMutationRequest,
  RowMutationResponse,
} from "@/lib/types";

// Helper to format ISO or DB date/time strings for HTML datetime-local input (YYYY-MM-DDTHH:mm:ss)
function formatForDateTimeInput(raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "";
  const str = String(raw).trim();
  const normalized = str.replace(" ", "T");
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?)/);
  if (match) return match[1];

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
  return str;
}

// Helper to format date strings for HTML date input (YYYY-MM-DD)
function formatForDateInput(raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "";
  const str = String(raw).trim();
  const match = str.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  return str;
}

// Helper to format time strings for HTML time input (HH:mm:ss or HH:mm)
function formatForTimeInput(raw: unknown): string {
  if (raw === null || raw === undefined || raw === "") return "";
  const str = String(raw).trim();
  const match = str.match(/^(\d{2}:\d{2}(?::\d{2})?)/);
  if (match) return match[1];
  return str;
}

interface RowFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "insert" | "edit";
  connectionId: string;
  schema: string;
  table: string;
  columns: ColumnInfo[];
  initialData?: Record<string, unknown> | null;
  onSuccess: (res?: RowMutationResponse) => void;
  onStage?: (data: Record<string, unknown>) => void;
}

export function RowFormModal({
  isOpen,
  onClose,
  mode,
  connectionId,
  schema,
  table,
  columns,
  initialData,
  onSuccess,
  onStage,
}: RowFormDrawerProps) {
  // Form values: map of column name -> value
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  // Track which columns are explicitly set to NULL
  const [nullFlags, setNullFlags] = useState<Record<string, boolean>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Identify Primary Key column
  const pkCol = columns.find((c) => c.is_primary_key);
  const pkValue = pkCol && initialData ? initialData[pkCol.name] : null;
  const mutationAction: RowMutationAction = mode === "edit" ? "update" : "insert";

  // Split columns into Main Fields (required / primary key) and Optional Fields (nullable or default)
  const mainColumns = useMemo(() => {
    return columns.filter((col) => col.is_primary_key || (!col.nullable && !col.default));
  }, [columns]);

  const optionalColumns = useMemo(() => {
    return columns.filter((col) => !col.is_primary_key && (col.nullable || Boolean(col.default)));
  }, [columns]);

  // Initialize form values when drawer opens or initialData changes
  useEffect(() => {
    if (!isOpen) return;

    setErrorMessage(null);
    const initialVals: Record<string, unknown> = {};
    const initialNulls: Record<string, boolean> = {};

    for (const col of columns) {
      if (mode === "edit" && initialData) {
        const val = initialData[col.name];
        if (val === null || val === undefined) {
          initialNulls[col.name] = true;
          initialVals[col.name] = "";
        } else if (typeof val === "object") {
          initialVals[col.name] = JSON.stringify(val, null, 2);
          initialNulls[col.name] = false;
        } else {
          initialVals[col.name] = String(val);
          initialNulls[col.name] = false;
        }
      } else {
        // Insert mode
        if (col.is_primary_key) {
          initialVals[col.name] = "";
          initialNulls[col.name] = false;
        } else if (col.default !== null && col.default !== undefined) {
          initialVals[col.name] = "";
          initialNulls[col.name] = false;
        } else if (col.nullable) {
          initialVals[col.name] = "";
          initialNulls[col.name] = true;
        } else {
          initialVals[col.name] = col.generic_type === "boolean" ? "false" : "";
          initialNulls[col.name] = false;
        }
      }
    }

    setFormValues(initialVals);
    setNullFlags(initialNulls);
  }, [isOpen, mode, initialData, columns]);

  // Keyboard shortcuts: Escape to close, Ctrl+Enter to save
  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isSubmitting) {
        onClose();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && !isSubmitting) {
        e.preventDefault();
        handleSave();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isSubmitting, formValues, nullFlags]);

  function handleFieldChange(colName: string, val: unknown) {
    setFormValues((prev) => ({ ...prev, [colName]: val }));
    setNullFlags((prev) => ({ ...prev, [colName]: false }));
  }

  function handleToggleNull(colName: string) {
    setNullFlags((prev) => {
      const nextState = !prev[colName];
      if (nextState) {
        setFormValues((v) => ({ ...v, [colName]: "" }));
      }
      return { ...prev, [colName]: nextState };
    });
  }

  // Construct clean payload data
  function buildPayloadData(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};

    for (const col of columns) {
      // In edit mode, never send PK in the SET clause
      if (mode === "edit" && col.is_primary_key) continue;

      // In insert mode, skip PK if empty (assume serial / auto-uuid)
      if (mode === "insert" && col.is_primary_key && !formValues[col.name]) continue;

      if (nullFlags[col.name]) {
        payload[col.name] = null;
        continue;
      }

      const rawVal = formValues[col.name];
      if (rawVal === undefined || rawVal === "") {
        // In insert mode, skip if has default or is nullable
        if (mode === "insert" && (col.default || col.nullable)) continue;
        if (
          col.nullable ||
          col.generic_type === "number" ||
          col.generic_type === "datetime" ||
          col.generic_type === "date" ||
          col.generic_type === "time"
        ) {
          payload[col.name] = null;
        } else if (col.generic_type === "json") {
          payload[col.name] = col.nullable ? null : {};
        } else {
          payload[col.name] = "";
        }
        continue;
      }

      if (col.generic_type === "number") {
        const num = Number(rawVal);
        payload[col.name] = isNaN(num) ? rawVal : num;
      } else if (col.generic_type === "boolean") {
        payload[col.name] = rawVal === "true" || rawVal === true;
      } else if (col.generic_type === "json") {
        try {
          payload[col.name] = JSON.parse(String(rawVal));
        } catch {
          payload[col.name] = rawVal;
        }
      } else {
        payload[col.name] = String(rawVal);
      }
    }

    return payload;
  }

  // Direct Minimal Save (PRD F18 & F22)
  async function handleSave() {
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const dataPayload = buildPayloadData();
      const requestPayload: RowMutationRequest = {
        action: mutationAction,
        schema,
        table,
        pk: pkValue !== undefined && pkValue !== null ? String(pkValue) : undefined,
        data: dataPayload,
        preview: false,
      };

      const res = await apiPost<RowMutationResponse>(
        `/connections/${connectionId}/rows/`,
        requestPayload
      );

      onSuccess(res);
      onClose();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to save record");
    } finally {
      setIsSubmitting(false);
    }
  }

  function renderFieldRow(col: ColumnInfo) {
    const isPk = col.is_primary_key;
    const isNull = Boolean(nullFlags[col.name]);
    const val = formValues[col.name];
    const displayVal = val === null || val === undefined ? "" : String(val);
    const isJson = col.generic_type === "json";
    const isBool = col.generic_type === "boolean";
    const isText =
      col.generic_type === "text" ||
      col.data_type.toLowerCase() === "text" ||
      col.data_type.toLowerCase().includes("text");
    const isTimestamp =
      col.generic_type === "datetime" ||
      col.data_type.toLowerCase().includes("timestamp") ||
      col.data_type.toLowerCase().includes("datetime");
    const isDate =
      col.generic_type === "date" ||
      col.data_type.toLowerCase() === "date";
    const isTime =
      col.generic_type === "time" ||
      col.data_type.toLowerCase().startsWith("time");
    const isNumber =
      col.generic_type === "number" ||
      ["int", "integer", "bigint", "smallint", "numeric", "decimal", "real", "double precision"].some((t) =>
        col.data_type.toLowerCase().includes(t)
      );
    const isLocked = isPk && mode === "edit";

    return (
      <div
        key={col.name}
        className="grid grid-cols-1 sm:grid-cols-12 gap-2 sm:gap-6 items-start"
      >
        {/* Left Column: Label & Plain Metadata */}
        <div className="sm:col-span-4 space-y-1 sm:pt-2">
          <label className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-zinc-200">
            {col.foreign_key && (
              <span title={`Foreign Key: ${col.foreign_key.target_schema}.${col.foreign_key.target_table}.${col.foreign_key.target_column}`}>
                <HugeiconsIcon icon={Link02Icon} className="size-3.5 text-blue-400 shrink-0" />
              </span>
            )}
            <span className="truncate">{col.name}</span>
          </label>

          <div className="flex flex-wrap items-center gap-2">
            {/* Field type without any border/background */}
            <span className="text-zinc-500 font-mono text-xs">
              {col.data_type}
            </span>

            {col.nullable && !isLocked && (
              <label className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 cursor-pointer select-none text-[11px]">
                <input
                  type="checkbox"
                  checked={isNull}
                  onChange={() => handleToggleNull(col.name)}
                  className="sr-only peer"
                />
                <div
                  className={cn(
                    "size-3 rounded-[2px] border border-zinc-700 bg-black flex items-center justify-center transition-colors",
                    isNull ? "bg-zinc-800 border-zinc-400" : "hover:border-zinc-500"
                  )}
                >
                  {isNull && (
                    <svg className="size-2 text-zinc-100 stroke-[3]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M4 12l5 5L20 6" />
                    </svg>
                  )}
                </div>
                <span className="text-[10px]">NULL</span>
              </label>
            )}
          </div>

          {/* Foreign key reference text */}
          {col.foreign_key && (
            <div className="text-[10px] text-blue-400/80 flex items-center gap-1">
              <span>→ {col.foreign_key.target_table}.{col.foreign_key.target_column}</span>
            </div>
          )}
        </div>

        {/* Right Column: Input Field */}
        <div className="sm:col-span-8 space-y-1">
          {isLocked ? (
            <div className="h-10 px-3.5 flex items-center justify-between rounded-[3px] bg-[#09090c] border border-zinc-800 text-zinc-400 text-xs font-mono">
              <span className="truncate">{displayVal}</span>
              <span className="flex items-center gap-1 text-[10px] text-zinc-500 shrink-0 ml-2">
                <HugeiconsIcon icon={LockIcon} className="size-3" />
                Primary key locked
              </span>
            </div>
          ) : isNull ? (
            <div className="h-10 px-3.5 flex items-center rounded-[3px] bg-[#09090c] border border-zinc-800/60 text-zinc-500 text-xs italic">
              NULL (Value will be cleared)
            </div>
          ) : isBool ? (
            <select
              value={displayVal}
              onChange={(e) => handleFieldChange(col.name, e.target.value)}
              className="h-10 w-full bg-[#0a0a0c] border border-zinc-800 focus:border-emerald-500/80 rounded-[3px] px-3.5 text-xs sm:text-sm text-zinc-200 outline-none transition-colors cursor-pointer"
            >
              <option value="true">TRUE</option>
              <option value="false">FALSE</option>
            </select>
          ) : isText || isJson ? (
            /* Text type uses text box (textarea) */
            <textarea
              rows={isJson ? 4 : 3}
              value={displayVal}
              onChange={(e) => handleFieldChange(col.name, e.target.value)}
              placeholder={
                col.default
                  ? `Default: ${col.default}`
                  : col.nullable
                  ? "NULL"
                  : isJson
                  ? "{ ... }"
                  : "Enter text..."
              }
              className="w-full bg-[#0a0a0c] border border-zinc-800 focus:border-emerald-500/80 rounded-[3px] p-3 text-xs sm:text-sm text-zinc-200 font-mono outline-none transition-colors placeholder:text-zinc-600 resize-y min-h-[90px]"
            />
          ) : isTimestamp ? (
            <input
              type="datetime-local"
              step="1"
              style={{ colorScheme: "dark" }}
              value={formatForDateTimeInput(displayVal)}
              onChange={(e) => handleFieldChange(col.name, e.target.value)}
              placeholder={
                col.default ? `Default: ${col.default}` : col.nullable ? "NULL" : "YYYY-MM-DD HH:MM:SS"
              }
              className="h-10 w-full bg-[#0a0a0c] border border-zinc-800 focus:border-emerald-500/80 rounded-[3px] px-3.5 text-xs sm:text-sm text-zinc-200 font-mono outline-none transition-colors placeholder:text-zinc-600"
            />
          ) : isDate ? (
            <input
              type="date"
              style={{ colorScheme: "dark" }}
              value={formatForDateInput(displayVal)}
              onChange={(e) => handleFieldChange(col.name, e.target.value)}
              placeholder={
                col.default ? `Default: ${col.default}` : col.nullable ? "NULL" : "YYYY-MM-DD"
              }
              className="h-10 w-full bg-[#0a0a0c] border border-zinc-800 focus:border-emerald-500/80 rounded-[3px] px-3.5 text-xs sm:text-sm text-zinc-200 font-mono outline-none transition-colors placeholder:text-zinc-600"
            />
          ) : isTime ? (
            <input
              type="time"
              step="1"
              style={{ colorScheme: "dark" }}
              value={formatForTimeInput(displayVal)}
              onChange={(e) => handleFieldChange(col.name, e.target.value)}
              placeholder={
                col.default ? `Default: ${col.default}` : col.nullable ? "NULL" : "HH:MM:SS"
              }
              className="h-10 w-full bg-[#0a0a0c] border border-zinc-800 focus:border-emerald-500/80 rounded-[3px] px-3.5 text-xs sm:text-sm text-zinc-200 font-mono outline-none transition-colors placeholder:text-zinc-600"
            />
          ) : isNumber ? (
            <input
              type="number"
              step="any"
              value={displayVal}
              onChange={(e) => handleFieldChange(col.name, e.target.value)}
              placeholder={
                col.default ? `Default: ${col.default}` : col.nullable ? "NULL" : "0"
              }
              className="h-10 w-full bg-[#0a0a0c] border border-zinc-800 focus:border-emerald-500/80 rounded-[3px] px-3.5 text-xs sm:text-sm text-zinc-200 font-mono outline-none transition-colors placeholder:text-zinc-600"
            />
          ) : (
            <input
              type="text"
              value={displayVal}
              onChange={(e) => handleFieldChange(col.name, e.target.value)}
              placeholder={
                col.default ? `Default: ${col.default}` : col.nullable ? "NULL" : "Enter value..."
              }
              className="h-10 w-full bg-[#0a0a0c] border border-zinc-800 focus:border-emerald-500/80 rounded-[3px] px-3.5 text-xs sm:text-sm text-zinc-200 outline-none transition-colors placeholder:text-zinc-600"
            />
          )}

          {/* Helper hint if default value is specified */}
          {col.default && !isLocked && !isNull && !displayVal && (
            <p className="text-[10px] text-zinc-500">
              Leave blank to use default ({col.default})
            </p>
          )}
        </div>
      </div>
    );
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-mono select-none">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-200"
        onClick={isSubmitting ? undefined : onClose}
      />

      {/* Slide-over Drawer from Right */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-[#111113] border-l border-zinc-800 shadow-2xl animate-in slide-in-from-right duration-200 ease-out">
        {/* Header (styled similar to reference image) */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#0e0e10]">
          <div className="flex items-center gap-2">
            <h2 className="text-sm sm:text-base font-bold text-white tracking-tight">
              {mode === "insert" ? "Add new record to" : "Edit record in"}
            </h2>
            <span className="px-2 py-0.5 rounded-[3px] bg-zinc-800/80 border border-zinc-700/80 text-xs font-mono text-zinc-200">
              {table}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
            className="flex size-7 items-center justify-center rounded-[3px] hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
          </button>
        </div>

        {/* Error notification banner if any */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-[3px] bg-red-950/40 border border-red-500/40 text-red-300 text-xs">
            {errorMessage}
          </div>
        )}

        {/* Form Body: Separated into Main fields and Optional fields */}
        <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar space-y-6">
          {/* Main Fields Section: no header at top */}
          {mainColumns.length > 0 && (
            <div className="space-y-6">
              {mainColumns.map(renderFieldRow)}
            </div>
          )}

          {/* Optional Fields Section: separated by border */}
          {optionalColumns.length > 0 && (
            <div
              className={cn(
                "space-y-6",
                mainColumns.length > 0 && "pt-6 border-t border-zinc-800"
              )}
            >
              <div className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
                Optional fields
              </div>
              <div className="space-y-6">
                {optionalColumns.map(renderFieldRow)}
              </div>
            </div>
          )}
        </div>

        {/* Sticky Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-[#0e0e10]">
          {/* Bottom Left: optional PK info in edit mode */}
          <div className="text-[11px] text-zinc-500 font-mono">
            {mode === "edit" && pkValue ? `PK: ${pkValue}` : ""}
          </div>

          {/* Bottom Right: Cancel, Stage, & Save Ctrl+Enter */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-[3px] hover:bg-zinc-800 text-xs sm:text-sm font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
            >
              Cancel
            </button>

            {onStage && (
              <button
                type="button"
                onClick={() => {
                  const dataPayload = buildPayloadData();
                  onStage(dataPayload);
                  onClose();
                }}
                disabled={isSubmitting}
                className="px-3.5 py-2 rounded-[3px] border border-amber-500/40 bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 font-mono font-medium text-xs sm:text-sm transition-colors cursor-pointer disabled:opacity-40"
              >
                Stage {mode === "edit" ? "Edit" : "Insert"}
              </button>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2 rounded-[3px] bg-white hover:bg-zinc-200 text-zinc-950 font-mono font-bold text-xs sm:text-sm transition-all shadow-sm cursor-pointer disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <HugeiconsIcon icon={ReloadIcon} className="size-3.5 animate-spin text-zinc-950" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>Save</span>
                  <span className="text-[10px] text-zinc-500 font-normal">Ctrl ↵</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
