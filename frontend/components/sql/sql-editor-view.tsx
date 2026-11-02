"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiGet, apiPost, ApiError } from "@/lib/api";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { MonacoSqlCanvas } from "./monaco-sql-canvas";
import { QueryToolbar } from "./query-toolbar";
import { QueryResultsPanel } from "./query-results-panel";
import { AstGuardrailModal } from "./ast-guardrail-modal";
import { SaveQueryModal } from "@/components/saved-queries/save-query-modal";
import { downloadDirectExport, downloadExportByRunId } from "@/lib/export";
import type {
  ColumnInfo,
  Connection,
  DestructiveWarningResponse,
  ExecuteQueryRequest,
  ExecuteQueryResponse,
  SchemaTreeResponse,
  WorkspaceTab,
} from "@/lib/types";

interface SqlEditorViewProps {
  tab: WorkspaceTab;
  connection?: Connection;
}

export function SqlEditorView({ tab, connection }: SqlEditorViewProps) {
  const { updateTabSql, markTabClean } = useWorkspaceStore();
  const currentSql = tab.sql || "";

  // Query Settings
  const [limit, setLimit] = useState<number>(1000);
  const [timeoutSec, setTimeoutSec] = useState<number>(30);

  // Execution State
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Results State
  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [rowCount, setRowCount] = useState<number | null>(null);
  const [durationMs, setDurationMs] = useState<number | null>(null);
  const [truncated, setTruncated] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [resultsCollapsed, setResultsCollapsed] = useState<boolean>(false);

  // AST Guardrail Modal State (PRD F6)
  const [guardrailOpen, setGuardrailOpen] = useState<boolean>(false);
  const [guardrailWarnings, setGuardrailWarnings] = useState<string[]>([]);
  const [pendingSql, setPendingSql] = useState<string>("");

  // Save Query Modal State (PRD F9)
  const [saveModalOpen, setSaveModalOpen] = useState<boolean>(false);

  // Cached Schema Tree for Autocomplete / IntelliSense (PRD F4)
  const { data: schemaTreeData } = useQuery<SchemaTreeResponse>({
    queryKey: ["schema-tree", tab.connectionId],
    queryFn: () => apiGet<SchemaTreeResponse>(`/connections/${tab.connectionId}/schema-tree/`),
    staleTime: 120_000,
  });

  const schemaTree = schemaTreeData?.tree || [];

  // Live timer tick during execution
  useEffect(() => {
    if (isRunning) {
      const startTime = Date.now();
      setElapsedMs(0);
      timerRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTime);
      }, 100);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // Execute Query Handler (PRD F4 & F6)
  async function executeSql(sqlToExecute?: string, confirmDestructive = false) {
    const rawSql = (sqlToExecute || currentSql).trim();
    if (!rawSql) return;

    setIsRunning(true);
    setErrorMessage(null);

    const payload: ExecuteQueryRequest = {
      sql: rawSql,
      limit,
      timeout: timeoutSec,
      confirm_destructive: confirmDestructive,
    };

    try {
      const res = await apiPost<ExecuteQueryResponse>(
        `/connections/${tab.connectionId}/query/`,
        payload
      );

      setActiveRunId(res.run_id);
      setColumns(res.columns || []);
      setRows(res.rows || []);
      setRowCount(res.row_count);
      setDurationMs(res.duration_ms);
      setTruncated(res.truncated);
      setResultsCollapsed(false);
      markTabClean(tab.id);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        // Destructive AST warning caught by sqlglot (PRD F6)
        const warningData = err.payload as DestructiveWarningResponse;
        if (warningData?.requires_confirmation) {
          setPendingSql(rawSql);
          setGuardrailWarnings(warningData.warnings || ["Destructive statement detected"]);
          setGuardrailOpen(true);
          return;
        }
      }

      setErrorMessage(err instanceof Error ? err.message : "Query execution failed");
      setRowCount(0);
      setResultsCollapsed(false);
    } finally {
      setIsRunning(false);
    }
  }

  // Cancel in-flight query (PRD F5)
  async function handleCancelQuery() {
    if (!activeRunId) return;
    try {
      await apiPost(`/queries/${activeRunId}/cancel/`);
    } catch {
      // Ignore
    } finally {
      setIsRunning(false);
      setErrorMessage("Query execution was cancelled by user.");
    }
  }

  // Confirm destructive query after modal warning
  function handleConfirmGuardrail() {
    setGuardrailOpen(false);
    executeSql(pendingSql, true);
  }

  // Streamed Export Handler (PRD F8)
  async function handleExport(format: "csv" | "json") {
    try {
      if (activeRunId) {
        await downloadExportByRunId(tab.connectionId, activeRunId, format);
      } else if (currentSql.trim()) {
        await downloadDirectExport(tab.connectionId, currentSql.trim(), format);
      }
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Export failed");
    }
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050505] overflow-hidden select-none">
      {/* Query Execution & Configuration Toolbar */}
      <QueryToolbar
        onRun={() => executeSql()}
        onCancel={handleCancelQuery}
        isRunning={isRunning}
        activeRunId={activeRunId}
        elapsedMs={elapsedMs}
        limit={limit}
        onLimitChange={setLimit}
        timeoutSec={timeoutSec}
        onTimeoutChange={setTimeoutSec}
        durationMs={durationMs}
        rowCount={rowCount}
        truncated={truncated}
        sqlContent={currentSql}
        isReadOnly={Boolean(connection?.read_only)}
        onSaveQuery={() => setSaveModalOpen(true)}
        onExport={handleExport}
      />

      {/* Center Monaco SQL Canvas */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-[140px]">
        <MonacoSqlCanvas
          value={currentSql}
          onChange={(newVal) => updateTabSql(tab.id, newVal)}
          onRunQuery={(selectedSql) => executeSql(selectedSql)}
          schemaTree={schemaTree}
        />
      </div>

      {/* Bottom Virtualized Results Grid & Logs */}
      <QueryResultsPanel
        connectionId={tab.connectionId}
        columns={columns}
        rows={rows}
        rowCount={rowCount}
        durationMs={durationMs}
        truncated={truncated}
        errorMessage={errorMessage}
        isRunning={isRunning}
        isCollapsed={resultsCollapsed}
        onToggleCollapse={() => setResultsCollapsed((c) => !c)}
      />

      {/* Destructive Query AST Guardrail Modal (PRD F6) */}
      <AstGuardrailModal
        isOpen={guardrailOpen}
        onClose={() => setGuardrailOpen(false)}
        onConfirm={handleConfirmGuardrail}
        isSubmitting={isRunning}
        warnings={guardrailWarnings}
        sql={pendingSql}
      />

      {/* Save Query Modal (PRD F9) */}
      <SaveQueryModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        connectionId={tab.connectionId}
        initialSql={currentSql}
      />
    </div>
  );
}
