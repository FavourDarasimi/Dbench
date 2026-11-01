"use client";

import { useState, useEffect } from "react";
import {
  X,
  Plus,
  Pencil,
  KeyRound,
  Link2,
  Lock,
  Sparkles,
  AlertCircle,
  Check,
} from "lucide-react";
import { apiPost } from "@/lib/api";
import { MutationDiffDialog } from "./mutation-diff-dialog";
import type {
  ColumnInfo,
  RowMutationAction,
  RowMutationRequest,
  RowMutationResponse,
} from "@/lib/types";

interface RowFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: "insert" | "edit";
  connectionId: string;
  schema: string;
  table: string;
  columns: ColumnInfo[];
  initialData?: Record<string, unknown> | null;
  onSuccess: () => void;
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
}: RowFormModalProps) {
  // Form values: map of column name -> value
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  // Track which columns are explicitly set to NULL
  const [nullFlags, setNullFlags] = useState<Record<string, boolean>>({});

  // Confirm Diff Modal State
  const [diffOpen, setDiffOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sqlPreview, setSqlPreview] = useState<string>("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Identify Primary Key column
  const pkCol = columns.find((c) => c.is_primary_key);
  const pkValue = pkCol && initialData ? initialData[pkCol.name] : null;
  const mutationAction: RowMutationAction = mode === "edit" ? "update" : "insert";

  // Initialize form values when modal opens or initialData changes
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

  if (!isOpen) return null;

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
        payload[col.name] = col.generic_type === "number" ? null : "";
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

  // Step 1: Click Review -> Call preview API and show Diff Dialog (F18)
  async function handleReviewDiff() {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const dataPayload = buildPayloadData();
      const requestPayload: RowMutationRequest = {
        action: mutationAction,
        schema,
        table,
        pk: pkValue !== undefined && pkValue !== null ? String(pkValue) : undefined,
        data: dataPayload,
        preview: true,
      };

      const res = await apiPost<RowMutationResponse>(
        `/connections/${connectionId}/rows/`,
        requestPayload
      );

      setSqlPreview(res.sql);
      setDiffOpen(true);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to generate mutation preview");
    } finally {
      setIsSubmitting(false);
    }
  }

  // Step 2: Confirm in Diff Dialog -> Commit mutation
  async function handleFinalCommit() {
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

      await apiPost<RowMutationResponse>(
        `/connections/${connectionId}/rows/`,
        requestPayload
      );

      setDiffOpen(false);
      onClose();
      onSuccess();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Mutation execution failed");
      setDiffOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 animate-in fade-in duration-150">
        <div className="w-full max-w-2xl bg-[#0c0c0e] border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-[#09090b]">
            <div className="flex items-center gap-2.5">
              <div
                className={`size-8 rounded-xl flex items-center justify-center border ${
                  mode === "insert"
                    ? "bg-emerald-950/40 border-emerald-500/30 text-emerald-400"
                    : "bg-blue-950/40 border-blue-500/30 text-blue-400"
                }`}
              >
                {mode === "insert" ? <Plus className="size-4" /> : <Pencil className="size-4" />}
              </div>
              <div>
                <h3 className="text-sm font-mono font-bold text-white">
                  {mode === "insert" ? "Insert New Record" : "Edit Record"}
                </h3>
                <p className="text-[11px] font-mono text-zinc-400">
                  Target table: <span className="text-zinc-200">{schema}.{table}</span>
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="size-7 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="mx-6 mt-4 p-3 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300 text-xs font-mono flex items-center gap-2">
              <AlertCircle className="size-4 text-red-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Form Fields List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 font-mono text-xs">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {columns.map((col) => {
                const isPk = col.is_primary_key;
                const isNull = !!nullFlags[col.name];
                const rawVal = formValues[col.name];
                const strVal = rawVal === null || rawVal === undefined ? "" : String(rawVal);
                const isJson = col.generic_type === "json";

                return (
                  <div
                    key={col.name}
                    className={`space-y-1.5 p-3 rounded-xl border transition-colors ${
                      isPk && mode === "edit"
                        ? "bg-[#09090b] border-zinc-800/40 md:col-span-2 opacity-80"
                        : isJson
                        ? "bg-[#121214] border-zinc-800 md:col-span-2"
                        : "bg-[#121214] border-zinc-800"
                    }`}
                  >
                    {/* Label & Metadata Badges */}
                    <div className="flex items-center justify-between gap-2">
                      <label className="flex items-center gap-1.5 font-semibold text-zinc-200 truncate">
                        {isPk && <KeyRound className="size-3 text-amber-400 shrink-0" />}
                        {col.foreign_key && <Link2 className="size-3 text-blue-400 shrink-0" />}
                        <span className="truncate" title={col.name}>{col.name}</span>
                        {!col.nullable && !col.default && !isPk && (
                          <span className="text-red-400">*</span>
                        )}
                      </label>

                      <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                        <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-400">
                          {col.data_type}
                        </span>

                        {col.nullable && (
                          <label className="flex items-center gap-1 text-zinc-400 hover:text-zinc-200 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={isNull}
                              onChange={() => handleToggleNull(col.name)}
                              disabled={isPk && mode === "edit"}
                              className="size-3 rounded border-zinc-700 bg-zinc-900 text-emerald-500 focus:ring-0 cursor-pointer"
                            />
                            <span>NULL</span>
                          </label>
                        )}
                      </div>
                    </div>

                    {/* Foreign Key Reference Info */}
                    {col.foreign_key && (
                      <div className="text-[10px] text-blue-400/90 flex items-center gap-1">
                        <span>→ {col.foreign_key.target_schema}.{col.foreign_key.target_table}.{col.foreign_key.target_column}</span>
                      </div>
                    )}

                    {/* Input Field Rendering */}
                    {isPk && mode === "edit" ? (
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-[#08080a] border border-zinc-800 text-zinc-400">
                        <span>{strVal}</span>
                        <div className="flex items-center gap-1 text-[10px] text-zinc-500">
                          <Lock className="size-3" />
                          <span>Primary key locked</span>
                        </div>
                      </div>
                    ) : isNull ? (
                      <div className="px-3 py-2 rounded-lg bg-[#08080a] border border-zinc-800/60 text-zinc-600 italic">
                        NULL (Value will be cleared)
                      </div>
                    ) : col.generic_type === "boolean" ? (
                      <select
                        value={strVal}
                        onChange={(e) => handleFieldChange(col.name, e.target.value)}
                        className="w-full bg-[#161619] border border-zinc-700/80 rounded-lg px-3 py-2 text-zinc-200 focus:outline-none focus:border-emerald-500"
                      >
                        <option value="true">TRUE</option>
                        <option value="false">FALSE</option>
                      </select>
                    ) : isJson ? (
                      <textarea
                        rows={4}
                        value={strVal}
                        onChange={(e) => handleFieldChange(col.name, e.target.value)}
                        placeholder={`{\n  "key": "value"\n}`}
                        className="w-full bg-[#161619] border border-zinc-700/80 rounded-lg px-3 py-2 text-emerald-400/90 font-mono text-xs focus:outline-none focus:border-emerald-500 resize-y"
                      />
                    ) : (
                      <input
                        type={col.generic_type === "number" ? "number" : "text"}
                        value={strVal}
                        onChange={(e) => handleFieldChange(col.name, e.target.value)}
                        placeholder={
                          isPk && mode === "insert"
                            ? "Auto-generated if left empty"
                            : col.default
                            ? `Default: ${col.default}`
                            : `Enter ${col.name}...`
                        }
                        className="w-full bg-[#161619] border border-zinc-700/80 rounded-lg px-3 py-2 text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-800 bg-[#09090b]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl hover:bg-zinc-800 text-xs font-mono text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleReviewDiff}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-mono font-bold text-zinc-950 transition-all shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-40"
            >
              <Sparkles className="size-3.5 text-zinc-950" />
              <span>Review Changes (Diff)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Step 2: Confirm-Before-Commit Diff Dialog */}
      <MutationDiffDialog
        isOpen={diffOpen}
        onClose={() => setDiffOpen(false)}
        onConfirm={handleFinalCommit}
        isSubmitting={isSubmitting}
        action={mutationAction}
        schema={schema}
        table={table}
        sqlPreview={sqlPreview}
        originalRow={initialData}
        newValues={buildPayloadData()}
        pkColumn={pkCol?.name}
        pkValue={pkValue ? String(pkValue) : null}
      />
    </>
  );
}
