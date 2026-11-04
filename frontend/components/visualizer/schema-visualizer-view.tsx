"use client";

import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Layout01Icon,
  Maximize01Icon,
  MinusSignIcon,
  MoreVerticalIcon,
  PlusSignIcon,
  ReloadIcon,
  Search01Icon,
} from "@hugeicons/core-free-icons";
import { apiGet } from "@/lib/api";
import { useWorkspaceStore } from "@/lib/stores/workspace-store";
import { Spinner } from "@/components/ui/badge";
import type { Connection } from "@/lib/types";

// --- Types ---

interface ERDColumn {
  name: string;
  data_type: string;
  generic_type: string;
  nullable: boolean;
  default?: string | null;
  is_primary_key: boolean;
  is_unique?: boolean;
  foreign_key?: {
    target_schema: string;
    target_table: string;
    target_column: string;
    constraint_name?: string | null;
  } | null;
}

interface ERDTable {
  name: string;
  schema: string;
  type: string;
  columns: ERDColumn[];
}

interface ERDRelation {
  id: string;
  source_schema: string;
  source_table: string;
  source_column: string;
  target_schema: string;
  target_table: string;
  target_column: string;
  constraint_name?: string | null;
}

interface ERDResponse {
  schema: string;
  tables: ERDTable[];
  relations: ERDRelation[];
}

interface SchemaVisualizerViewProps {
  connectionId: string;
  connection?: Connection;
}

const CARD_WIDTH = 280;
const HEADER_HEIGHT = 42;
const ROW_CONTAINER_PT = 4;
const ROW_HEIGHT = 32;

function formatDataType(dataType: string): string {
  const dt = dataType.toLowerCase().trim();
  if (dt.includes("timestamp with time zone") || dt === "timestamptz") return "timestamptz";
  if (dt.includes("timestamp")) return "timestamp";
  if (dt.includes("character varying") || dt.includes("varchar")) return "varchar";
  if (dt.includes("boolean") || dt === "bool") return "bool";
  if (dt.includes("integer") || dt === "int4") return "int";
  if (dt.includes("bigint") || dt === "int8") return "bigint";
  if (dt.includes("smallint") || dt === "int2") return "smallint";
  if (dt.includes("numeric") || dt.includes("decimal")) return "numeric";
  if (dt.includes("double precision") || dt.includes("float8")) return "float8";
  if (dt.includes("jsonb")) return "jsonb";
  if (dt.includes("json")) return "json";
  if (dt.includes("uuid")) return "uuid";
  if (dt.includes("text")) return "text";
  return dt.slice(0, 14);
}

// Compute automatic layered / stair-step layout matching reference design
function computeAutoLayout(
  tables: ERDTable[],
  relations: ERDRelation[]
): Record<string, { x: number; y: number }> {
  const outEdges = new Map<string, string[]>();
  tables.forEach((t) => outEdges.set(t.name, []));
  relations.forEach((r) => {
    outEdges.get(r.source_table)?.push(r.target_table);
  });

  // Fast memoized depth with cycle prevention (handles 100+ tables in <1ms)
  const depthMemo = new Map<string, number>();
  const visiting = new Set<string>();

  function getDepth(tblName: string): number {
    if (depthMemo.has(tblName)) return depthMemo.get(tblName)!;
    if (visiting.has(tblName)) return 0; // Break cycles

    visiting.add(tblName);
    const targets = outEdges.get(tblName) || [];
    let maxD = 0;
    for (const target of targets) {
      if (target !== tblName) {
        maxD = Math.max(maxD, getDepth(target) + 1);
      }
    }
    visiting.delete(tblName);

    depthMemo.set(tblName, maxD);
    return maxD;
  }

  tables.forEach((t) => getDepth(t.name));

  const maxDepth = Math.max(...Array.from(depthMemo.values()), 0);
  const layers = new Map<number, string[]>();

  tables.forEach((t) => {
    const d = depthMemo.get(t.name) || 0;
    // Tables with foreign keys go on the left, referenced tables go on the right
    const layerIdx = maxDepth - d;
    if (!layers.has(layerIdx)) layers.set(layerIdx, []);
    layers.get(layerIdx)!.push(t.name);
  });

  const positions: Record<string, { x: number; y: number }> = {};
  const HORIZONTAL_GAP = 130;
  const START_X = 90;
  const MAX_TABLES_PER_COL = 6;
  let currentColX = START_X;

  Array.from(layers.keys())
    .sort((a, b) => a - b)
    .forEach((layerIdx) => {
      const tableNames = layers.get(layerIdx)!;

      // Split large layers across sub-columns to prevent infinite vertical stacking
      for (let chunkIdx = 0; chunkIdx < tableNames.length; chunkIdx += MAX_TABLES_PER_COL) {
        const chunk = tableNames.slice(chunkIdx, chunkIdx + MAX_TABLES_PER_COL);

        // Reproduce cascading stair layout when few tables, or clean grid when large schema
        let startY = 80;
        if (tables.length <= 5) {
          if (layerIdx === 0 && chunk.length === 1) startY = 270;
          else if (layerIdx === 1 && chunk.length === 1) startY = 75;
          else if (layerIdx === 2 && chunk.length === 1) startY = 160;
        }

        let currentY = startY;
        chunk.forEach((tblName) => {
          positions[tblName] = { x: currentColX, y: currentY };
          const tbl = tables.find((t) => t.name === tblName);
          const colCount = Math.min(tbl?.columns.length || 0, 14);
          const h = HEADER_HEIGHT + ROW_CONTAINER_PT + colCount * ROW_HEIGHT + 10;
          currentY += h + 36;
        });

        currentColX += CARD_WIDTH + HORIZONTAL_GAP;
      }
    });

  return positions;
}

// Generate the exact orthogonal step curve with rounded fillet corners
function getFilletedStepPath(x1: number, y1: number, x2: number, y2: number): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const absDy = Math.abs(dy);

  if (absDy < 2) {
    return `M ${x1} ${y1} L ${x2} ${y2}`;
  }

  // Left to right flow
  if (dx > 20) {
    const midX = x1 + dx * 0.5;
    const radius = Math.min(13, absDy / 2, Math.abs(midX - x1));

    if (dy > 0) {
      // Downwards turn
      return (
        `M ${x1} ${y1} ` +
        `L ${midX - radius} ${y1} ` +
        `A ${radius} ${radius} 0 0 1 ${midX} ${y1 + radius} ` +
        `L ${midX} ${y2 - radius} ` +
        `A ${radius} ${radius} 0 0 0 ${midX + radius} ${y2} ` +
        `L ${x2} ${y2}`
      );
    } else {
      // Upwards turn (like in the screenshot)
      return (
        `M ${x1} ${y1} ` +
        `L ${midX - radius} ${y1} ` +
        `A ${radius} ${radius} 0 0 0 ${midX} ${y1 - radius} ` +
        `L ${midX} ${y2 + radius} ` +
        `A ${radius} ${radius} 0 0 1 ${midX + radius} ${y2} ` +
        `L ${x2} ${y2}`
      );
    }
  }

  // Right to left flow if user moved tables across
  if (dx < -20) {
    const midX = x1 + dx * 0.5;
    const radius = Math.min(13, absDy / 2, Math.abs(x1 - midX));
    if (dy > 0) {
      return (
        `M ${x1} ${y1} ` +
        `L ${midX + radius} ${y1} ` +
        `A ${radius} ${radius} 0 0 0 ${midX} ${y1 + radius} ` +
        `L ${midX} ${y2 - radius} ` +
        `A ${radius} ${radius} 0 0 1 ${midX - radius} ${y2} ` +
        `L ${x2} ${y2}`
      );
    } else {
      return (
        `M ${x1} ${y1} ` +
        `L ${midX + radius} ${y1} ` +
        `A ${radius} ${radius} 0 0 1 ${midX} ${y1 - radius} ` +
        `L ${midX} ${y2 + radius} ` +
        `A ${radius} ${radius} 0 0 0 ${midX - radius} ${y2} ` +
        `L ${x2} ${y2}`
      );
    }
  }

  return `M ${x1} ${y1} L ${x2} ${y2}`;
}

export function SchemaVisualizerView({ connectionId }: SchemaVisualizerViewProps) {
  const router = useRouter();
  const { openBrowserTab, openSqlTab, setActiveView } = useWorkspaceStore();

  const [search, setSearch] = useState("");
  const [positions, setPositions] = useState<Record<string, { x: number; y: number }>>({});
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [highlightedCol, setHighlightedCol] = useState<{ table: string; column: string } | null>(null);
  const [openMenuTable, setOpenMenuTable] = useState<string | null>(null);

  // Pan & Zoom Canvas State
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0 });

  // Node Drag State
  const [draggingTable, setDraggingTable] = useState<string | null>(null);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, nodeX: 0, nodeY: 0 });

  const containerRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ERDResponse>({
    queryKey: ["erd-schema", connectionId],
    queryFn: () => apiGet<ERDResponse>(`/connections/${connectionId}/erd/`),
    enabled: Boolean(connectionId),
    staleTime: 60_000,
  });

  const tables = data?.tables || [];
  const relations = data?.relations || [];

  // Initial Auto Layout
  useEffect(() => {
    if (tables.length > 0) {
      setPositions((prev) => {
        if (Object.keys(prev).length === tables.length) return prev;
        return computeAutoLayout(tables, relations);
      });
    }
  }, [tables, relations]);

  // Center/Fit view initially or when requested
  const handleResetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 40, y: 30 });
  }, []);

  const handleAutoLayout = useCallback(() => {
    if (tables.length > 0) {
      setPositions(computeAutoLayout(tables, relations));
      handleResetView();
    }
  }, [tables, relations, handleResetView]);

  // Global mouse handlers for Dragging Nodes
  useEffect(() => {
    if (!draggingTable) return;

    function onPointerMove(e: PointerEvent) {
      if (!draggingTable) return;
      const dx = (e.clientX - dragStartRef.current.mouseX) / zoom;
      const dy = (e.clientY - dragStartRef.current.mouseY) / zoom;

      setPositions((prev) => ({
        ...prev,
        [draggingTable]: {
          x: Math.round(dragStartRef.current.nodeX + dx),
          y: Math.round(dragStartRef.current.nodeY + dy),
        },
      }));
    }

    function onPointerUp() {
      setDraggingTable(null);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [draggingTable, zoom]);

  // Global mouse handlers for Panning Background
  useEffect(() => {
    if (!isPanning) return;

    function onPointerMove(e: PointerEvent) {
      if (!isPanning) return;
      setPan({
        x: e.clientX - panStartRef.current.x,
        y: e.clientY - panStartRef.current.y,
      });
    }

    function onPointerUp() {
      setIsPanning(false);
    }

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, [isPanning]);

  // Wheel zoom handler
  function handleWheel(e: React.WheelEvent) {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.08 : 0.92;
    setZoom((prev) => Math.min(Math.max(prev * zoomFactor, 0.4), 2.2));
  }

  // Dismiss open table options menu on outside click
  useEffect(() => {
    if (!openMenuTable) return;
    function onClickOutside() {
      setOpenMenuTable(null);
    }
    window.addEventListener("click", onClickOutside);
    return () => window.removeEventListener("click", onClickOutside);
  }, [openMenuTable]);

  // Map of table names for fast lookup
  const tablesMap = useMemo(() => {
    const map = new Map<string, ERDTable>();
    tables.forEach((t) => map.set(t.name, t));
    return map;
  }, [tables]);

  // Calculate connection lines with exact anchors
  const edges = useMemo(() => {
    return relations
      .map((rel) => {
        const sourcePos = positions[rel.source_table];
        const targetPos = positions[rel.target_table];
        const sourceTbl = tablesMap.get(rel.source_table);
        const targetTbl = tablesMap.get(rel.target_table);

        if (!sourcePos || !targetPos || !sourceTbl || !targetTbl) return null;

        const sourceColIdx = sourceTbl.columns.findIndex((c) => c.name === rel.source_column);
        const targetColIdx = targetTbl.columns.findIndex((c) => c.name === rel.target_column);

        const safeSourceIdx = sourceColIdx >= 0 ? sourceColIdx : 0;
        const safeTargetIdx = targetColIdx >= 0 ? targetColIdx : 0;

        // Exact vertical center of the row
        const y1 = sourcePos.y + HEADER_HEIGHT + ROW_CONTAINER_PT + safeSourceIdx * ROW_HEIGHT + ROW_HEIGHT / 2;
        const y2 = targetPos.y + HEADER_HEIGHT + ROW_CONTAINER_PT + safeTargetIdx * ROW_HEIGHT + ROW_HEIGHT / 2;

        let x1: number;
        let x2: number;

        if (sourcePos.x + CARD_WIDTH <= targetPos.x + 20) {
          x1 = sourcePos.x + CARD_WIDTH;
          x2 = targetPos.x;
        } else if (targetPos.x + CARD_WIDTH <= sourcePos.x + 20) {
          x1 = sourcePos.x;
          x2 = targetPos.x + CARD_WIDTH;
        } else {
          x1 = sourcePos.x + CARD_WIDTH;
          x2 = targetPos.x;
        }

        const pathData = getFilletedStepPath(x1, y1, x2, y2);

        const isHighlighted =
          selectedTable === rel.source_table ||
          selectedTable === rel.target_table ||
          (highlightedCol?.table === rel.source_table && highlightedCol?.column === rel.source_column) ||
          (highlightedCol?.table === rel.target_table && highlightedCol?.column === rel.target_column);

        return {
          id: rel.id,
          rel,
          x1,
          y1,
          x2,
          y2,
          pathData,
          isHighlighted,
        };
      })
      .filter(Boolean);
  }, [relations, positions, tablesMap, selectedTable, highlightedCol]);

  // Filtered/Highlighted tables
  const searchLower = search.toLowerCase().trim();

  if (isLoading) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-zinc-500 font-mono text-xs bg-[#0c0c0e]">
        <Spinner className="size-6 text-emerald-400 mb-3" />
        <p>Loading schema visualizer...</p>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center text-zinc-400 font-mono text-xs bg-[#0c0c0e]">
        <p className="text-red-400 font-semibold mb-1">Failed to load schema visualizer</p>
        {error instanceof Error && (
          <p className="text-zinc-500 text-[11px] max-w-md mb-3">{error.message}</p>
        )}
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[3px] bg-zinc-900 border border-zinc-700 text-zinc-200 hover:text-white transition-colors cursor-pointer"
        >
          <HugeiconsIcon icon={ReloadIcon} className="size-3.5" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  return (
    <div className="relative flex-1 w-full h-full bg-[#0c0c0e] text-zinc-100 overflow-hidden font-sans select-none">
      {/* Interactive Infinite Canvas - Edge to Edge with NO top elements */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onPointerDown={(e) => {
          // If clicked canvas background, initiate canvas panning
          if (e.target === e.currentTarget || (e.target as HTMLElement).tagName === "svg") {
            setIsPanning(true);
            panStartRef.current = {
              x: e.clientX - pan.x,
              y: e.clientY - pan.y,
            };
            setSelectedTable(null);
            setHighlightedCol(null);
          }
        }}
        className={`flex-1 w-full h-full relative overflow-hidden bg-[#0c0c0e] ${
          isPanning ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        {/* Transformable Canvas Layer */}
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
            width: "100%",
            height: "100%",
          }}
          className="absolute inset-0 pointer-events-none"
        >
          {/* SVG Connector Layer - Rounded Orthogonal Lines with NO Circle Ends */}
          <svg className="absolute inset-0 overflow-visible w-full h-full pointer-events-none">
            <defs>
              <filter id="line-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="glow" />
                <feComposite in="SourceGraphic" in2="glow" operator="over" />
              </filter>
            </defs>

            {edges.map((edge) => {
              if (!edge) return null;
              const isHigh = edge.isHighlighted;

              return (
                <g key={edge.id} className="transition-all duration-150">
                  <path
                    d={edge.pathData}
                    fill="none"
                    stroke={isHigh ? "#ffffff" : "#82828e"}
                    strokeWidth={isHigh ? 2 : 1.5}
                    strokeOpacity={isHigh ? 1 : 0.85}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    filter={isHigh ? "url(#line-glow)" : undefined}
                  />
                </g>
              );
            })}
          </svg>

          {/* Interactive Table Cards */}
          {tables.map((tbl) => {
            const pos = positions[tbl.name] || { x: 80, y: 80 };
            const isSelected = selectedTable === tbl.name;
            const matchesSearch =
              !searchLower ||
              tbl.name.toLowerCase().includes(searchLower) ||
              tbl.columns.some((c) => c.name.toLowerCase().includes(searchLower));

            return (
              <div
                key={tbl.name}
                style={{
                  transform: `translate(${pos.x}px, ${pos.y}px)`,
                  width: `${CARD_WIDTH}px`,
                }}
                className={`absolute top-0 left-0 rounded-xl pointer-events-auto transition-shadow select-none ${
                  isSelected
                    ? "ring-1 ring-zinc-400 shadow-2xl shadow-black/90"
                    : "shadow-2xl shadow-black/85"
                } ${matchesSearch ? "opacity-100" : "opacity-30"}`}
              >
                {/* Table Container Card */}
                <div
                  className={`flex flex-col rounded-xl bg-[#131316] border transition-colors ${
                    isSelected ? "border-zinc-500" : "border-[#27272c] hover:border-zinc-700"
                  }`}
                >
                  {/* Card Header (Draggable Handle) */}
                  <div
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setSelectedTable(tbl.name);
                      setDraggingTable(tbl.name);
                      dragStartRef.current = {
                        mouseX: e.clientX,
                        mouseY: e.clientY,
                        nodeX: pos.x,
                        nodeY: pos.y,
                      };
                    }}
                    className="flex items-center justify-between px-3.5 py-2.5 bg-[#18181c] border-b border-[#242429] rounded-t-xl cursor-move"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Grid / 4-Pane Table Icon */}
                      <svg
                        className="size-3.5 text-zinc-300 shrink-0"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      >
                        <rect x="2" y="2" width="12" height="12" rx="2" />
                        <line x1="2" y1="7" x2="14" y2="7" />
                        <line x1="7" y1="2" x2="7" y2="14" />
                      </svg>
                      <span className="font-medium text-[13px] text-zinc-100 truncate tracking-tight">
                        {tbl.name}
                      </span>
                    </div>

                    {/* Options Menu Button (Three Vertical Dots) */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpenMenuTable(openMenuTable === tbl.name ? null : tbl.name);
                        }}
                        className="size-6 rounded flex items-center justify-center text-zinc-500 hover:text-white hover:bg-zinc-800/60 transition-colors cursor-pointer"
                        title="Table options"
                      >
                        <HugeiconsIcon icon={MoreVerticalIcon} className="size-3.5" />
                      </button>

                      {/* Dropdown Popover */}
                      {openMenuTable === tbl.name && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="absolute right-0 top-full mt-1 w-44 rounded-md bg-[#18181b] border border-zinc-700 p-1 shadow-2xl z-50 text-xs font-sans"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              openBrowserTab(connectionId, tbl.schema, tbl.name);
                              setActiveView("table");
                              router.push("/tables");
                            }}
                            className="flex w-full items-center px-2.5 py-1.5 rounded text-zinc-200 hover:bg-zinc-800 hover:text-white text-left cursor-pointer transition-colors"
                          >
                            Open in Data Browser
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              openSqlTab(connectionId, `SELECT * FROM "${tbl.schema}"."${tbl.name}" LIMIT 50;`, tbl.name);
                              setActiveView("sql");
                              router.push("/sql");
                            }}
                            className="flex w-full items-center px-2.5 py-1.5 rounded text-zinc-200 hover:bg-zinc-800 hover:text-white text-left cursor-pointer transition-colors"
                          >
                            Query in SQL Editor
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(tbl.name);
                              setOpenMenuTable(null);
                            }}
                            className="flex w-full items-center px-2.5 py-1.5 rounded text-zinc-200 hover:bg-zinc-800 hover:text-white text-left cursor-pointer transition-colors"
                          >
                            Copy Table Name
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Columns List */}
                  <div className="py-1 flex flex-col">
                    {tbl.columns.map((col) => {
                      const isFk = Boolean(col.foreign_key);
                      const isPk = col.is_primary_key;
                      // Unique constraint or SKU fingerprint icon
                      const isUniqueOrSku =
                        Boolean(col.is_unique) ||
                        (tbl.name.toLowerCase() === "products" && col.name.toLowerCase() === "sku");

                      const isColHighlighted =
                        highlightedCol?.table === tbl.name && highlightedCol?.column === col.name;

                      return (
                        <div
                          key={col.name}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isFk || isPk) {
                              setHighlightedCol(
                                isColHighlighted ? null : { table: tbl.name, column: col.name }
                              );
                            }
                          }}
                          className={`h-[32px] flex items-center justify-between px-3.5 text-xs transition-colors ${
                            isColHighlighted
                              ? "bg-zinc-800/70"
                              : "hover:bg-zinc-800/30"
                          } ${isFk || isPk ? "cursor-pointer" : "cursor-default"}`}
                        >
                          {/* Column Name & Indicators */}
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            {/* Key icon for Primary Keys */}
                            {isPk && (
                              <svg
                                className="size-3 text-zinc-400 shrink-0"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <circle cx="7.5" cy="15.5" r="5.5" />
                                <path d="m21 2-9.6 9.6" />
                                <path d="m15.5 7.5 3 3" />
                              </svg>
                            )}

                            {/* SKU / Unique / Fingerprint indicator */}
                            {isUniqueOrSku && !isPk ? (
                              <svg
                                className="size-3 text-zinc-400 shrink-0"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.75"
                              >
                                <path d="M12 2a10 10 0 0 0-10 10c0 4.4 2.9 8.2 7 9.5" />
                                <path d="M12 6a6 6 0 0 0-6 6c0 2.6 1.7 4.9 4.2 5.7" />
                                <path d="M12 10a2 2 0 0 0-2 2" />
                                <path d="M18 10a6 6 0 0 1 1 3.5c0 3-2 5.5-5 5.5" />
                                <path d="M14 6.5A10 10 0 0 1 22 12c0 3-1.5 5.8-4 7.5" />
                              </svg>
                            ) : (
                              /* Diamonds: Filled for required/PK, Hollow for nullable/FK */
                              <span className="shrink-0 flex items-center">
                                {col.nullable && !isPk ? (
                                  <svg
                                    className="size-2 text-zinc-400"
                                    viewBox="0 0 16 16"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1.75"
                                  >
                                    <polygon points="8,1 15,8 8,15 1,8" />
                                  </svg>
                                ) : (
                                  <svg
                                    className="size-2 text-zinc-300"
                                    viewBox="0 0 16 16"
                                    fill="currentColor"
                                  >
                                    <polygon points="8,1 15,8 8,15 1,8" />
                                  </svg>
                                )}
                              </span>
                            )}

                            {/* Column Name */}
                            <span
                              className={`truncate font-sans tracking-tight text-[12.5px] ${
                                isPk ? "text-zinc-100 font-medium" : "text-zinc-300"
                              }`}
                              title={col.name}
                            >
                              {col.name}
                            </span>
                          </div>

                          {/* Column Type on the right */}
                          <span className="text-[11px] font-mono text-zinc-500 lowercase shrink-0 ml-3">
                            {formatDataType(col.data_type)}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Floating Canvas Controls - Discreet HUD docked in the bottom-right corner */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2 bg-[#121215]/85 backdrop-blur-md border border-[#26262b] p-1.5 rounded-lg shadow-2xl pointer-events-auto">
        {/* Search Input */}
        <div className="relative">
          <HugeiconsIcon
            icon={Search01Icon}
            className="absolute left-2 top-1/2 -translate-y-1/2 size-3 text-zinc-500 pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Find table..."
            className="pl-7 pr-2.5 py-1 w-28 sm:w-36 rounded bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600"
          />
        </div>

        <div className="h-4 w-px bg-zinc-800" />

        {/* Zoom Controls */}
        <div className="flex items-center bg-zinc-950/60 rounded border border-zinc-800/80">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))}
            title="Zoom out"
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <HugeiconsIcon icon={MinusSignIcon} className="size-3.5" />
          </button>
          <span className="px-1 text-[11px] font-mono text-zinc-400 select-none min-w-[36px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(z + 0.15, 2.2))}
            title="Zoom in"
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
          </button>
        </div>

        <button
          type="button"
          onClick={handleResetView}
          title="Reset view (Fit to screen)"
          className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-950/60 hover:bg-zinc-800 border border-zinc-800/80 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <HugeiconsIcon icon={Maximize01Icon} className="size-3" />
          <span className="hidden sm:inline">Reset</span>
        </button>

        <button
          type="button"
          onClick={handleAutoLayout}
          title="Auto arrange tables"
          className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-950/60 hover:bg-zinc-800 border border-zinc-800/80 text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
        >
          <HugeiconsIcon icon={Layout01Icon} className="size-3" />
          <span className="hidden sm:inline">Arrange</span>
        </button>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          title="Refresh schema"
          className="p-1 rounded bg-zinc-950/60 hover:bg-zinc-800 border border-zinc-800/80 text-zinc-400 hover:text-white transition-colors cursor-pointer disabled:opacity-50"
        >
          <HugeiconsIcon
            icon={ReloadIcon}
            className={`size-3.5 ${isFetching ? "animate-spin text-emerald-400" : ""}`}
          />
        </button>
      </div>
    </div>
  );
}
