"use client";

import { useEffect, useRef } from "react";
import Editor, { type OnMount } from "@monaco-editor/react";
import type { SchemaTreeItem } from "@/lib/types";

interface MonacoSqlCanvasProps {
  value: string;
  onChange: (value: string) => void;
  onRunQuery: (selectedSql?: string) => void;
  schemaTree?: SchemaTreeItem[];
}

const SQL_KEYWORDS = [
  "SELECT",
  "FROM",
  "WHERE",
  "JOIN",
  "LEFT JOIN",
  "RIGHT JOIN",
  "INNER JOIN",
  "OUTER JOIN",
  "ON",
  "GROUP BY",
  "ORDER BY",
  "HAVING",
  "LIMIT",
  "OFFSET",
  "INSERT INTO",
  "VALUES",
  "UPDATE",
  "SET",
  "DELETE FROM",
  "CREATE TABLE",
  "DROP TABLE",
  "ALTER TABLE",
  "COUNT",
  "SUM",
  "AVG",
  "MIN",
  "MAX",
  "COALESCE",
  "DISTINCT",
  "AS",
  "AND",
  "OR",
  "NOT",
  "IN",
  "IS NULL",
  "IS NOT NULL",
  "LIKE",
  "ILIKE",
  "BETWEEN",
  "EXISTS",
  "CASE",
  "WHEN",
  "THEN",
  "ELSE",
  "END",
];

export function MonacoSqlCanvas({
  value,
  onChange,
  onRunQuery,
  schemaTree = [],
}: MonacoSqlCanvasProps) {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const completionProviderRef = useRef<any>(null);
  const schemaTreeRef = useRef(schemaTree);
  schemaTreeRef.current = schemaTree;

  // Clean up completion provider on unmount
  useEffect(() => {
    return () => {
      if (completionProviderRef.current) {
        completionProviderRef.current.dispose();
        completionProviderRef.current = null;
      }
    };
  }, []);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    // Define Custom Linear Pitch-Black Theme
    monaco.editor.defineTheme("dbench-dark", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "keyword", foreground: "34d399", fontStyle: "bold" }, // emerald-400
        { token: "string", foreground: "6ee7b7" }, // emerald-300
        { token: "number", foreground: "fbbf24" }, // amber-400
        { token: "comment", foreground: "71717a", fontStyle: "italic" }, // zinc-500
        { token: "operator", foreground: "60a5fa" }, // blue-400
        { token: "delimiter", foreground: "a1a1aa" }, // zinc-400
        { token: "identifier", foreground: "f4f4f5" }, // zinc-100
      ],
      colors: {
        "editor.background": "#050505",
        "editor.foreground": "#f4f4f5",
        "editorCursor.foreground": "#10b981",
        "editor.lineHighlightBackground": "#0c0c0e",
        "editorLineNumber.foreground": "#52525b",
        "editorLineNumber.activeForeground": "#34d399",
        "editor.selectionBackground": "#10b98126",
        "editor.inactiveSelectionBackground": "#10b98115",
        "editorIndentGuide.background": "#18181b",
        "editorIndentGuide.activeBackground": "#27272a",
        "editorWidget.background": "#0c0c0e",
        "editorWidget.border": "#27272a",
        "editorSuggestWidget.background": "#0c0c0e",
        "editorSuggestWidget.border": "#27272a",
        "editorSuggestWidget.selectedBackground": "#18181b",
        "editorSuggestWidget.highlightForeground": "#34d399",
      },
    });

    monaco.editor.setTheme("dbench-dark");

    // Register Cmd+Enter / Ctrl+Enter shortcut to execute query (PRD F4)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
      const selection = editor.getSelection();
      const model = editor.getModel();
      let sqlToRun = "";

      if (selection && !selection.isEmpty() && model) {
        sqlToRun = model.getValueInRange(selection);
      } else {
        sqlToRun = editor.getValue();
      }

      onRunQuery(sqlToRun);
    });

    // Register Schema-Aware Autocomplete / IntelliSense (PRD F4)
    if (completionProviderRef.current) {
      completionProviderRef.current.dispose();
    }

    completionProviderRef.current = monaco.languages.registerCompletionItemProvider("sql", {
      provideCompletionItems: (model: any, position: any) => {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };

        const suggestions: any[] = [];

        // 1. SQL Keywords
        for (const kw of SQL_KEYWORDS) {
          suggestions.push({
            label: kw,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: kw,
            detail: "SQL Keyword",
            range,
          });
        }

        // 2. Schema and Table Names from cached schema tree
        for (const item of schemaTreeRef.current) {
          suggestions.push({
            label: item.schema,
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: `"${item.schema}"`,
            detail: "Database Schema",
            range,
          });

          for (const tbl of item.tables) {
            suggestions.push({
              label: tbl.name,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: `"${tbl.name}"`,
              detail: `Table (${item.schema})`,
              range,
            });

            suggestions.push({
              label: `${item.schema}.${tbl.name}`,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: `"${item.schema}"."${tbl.name}"`,
              detail: `Qualified Table`,
              range,
            });
          }
        }

        return { suggestions };
      },
    });

    // Focus editor automatically
    editor.focus();
  };

  return (
    <div className="flex-1 w-full h-full bg-[#050505] overflow-hidden select-text">
      <Editor
        height="100%"
        defaultLanguage="sql"
        theme="vs-dark"
        value={value}
        onChange={(val) => onChange(val || "")}
        onMount={handleEditorMount}
        options={{
          fontSize: 13,
          lineHeight: 22,
          fontFamily:
            "'JetBrains Mono', 'Fira Code', Menlo, Monaco, 'Courier New', monospace",
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          automaticLayout: true,
          wordWrap: "on",
          padding: { top: 12, bottom: 12 },
          lineNumbersMinChars: 3,
          renderLineHighlight: "all",
          tabSize: 2,
          suggestOnTriggerCharacters: true,
          quickSuggestions: true,
          smoothScrolling: true,
          cursorBlinking: "smooth",
          cursorSmoothCaretAnimation: "on",
          fixedOverflowWidgets: true,
        }}
        loading={
          <div className="flex items-center justify-center h-full bg-[#050505] font-mono text-xs text-zinc-500">
            <span className="size-2 rounded-full bg-emerald-400 animate-pulse mr-2" />
            Loading Monaco SQL Editor...
          </div>
        }
      />
    </div>
  );
}
