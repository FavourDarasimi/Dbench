"use client";

import type { ExportFormat } from "./types";

/**
 * Trigger browser download for an executed query export by run_id (PRD F8).
 */
export async function downloadExportByRunId(
  connectionId: string,
  runId: string,
  format: ExportFormat = "csv",
  filename?: string
): Promise<void> {
  const query = new URLSearchParams({ format });
  if (filename) query.set("filename", filename);

  const url = `/api/connections/${connectionId}/query/${runId}/export/?${query.toString()}`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `Export failed with status ${res.status}`);
  }

  // Parse filename from Content-Disposition header if available
  const disposition = res.headers.get("Content-Disposition");
  let downloadFilename = filename ? `${filename}.${format}` : `export_${runId.slice(0, 8)}.${format}`;

  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename=["']?([^"';]+)["']?/);
    if (match && match[1]) {
      downloadFilename = match[1];
    }
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = downloadFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}

/**
 * Trigger streamed browser download for direct SQL or table browse view (PRD F8).
 */
export async function downloadDirectExport(
  connectionId: string,
  sql: string,
  format: ExportFormat = "csv",
  filename?: string,
  maxRows?: number
): Promise<void> {
  const payload = {
    sql,
    format,
    filename: filename || "export",
    max_rows: maxRows || null,
  };

  const res = await fetch(`/api/connections/${connectionId}/query/export/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Requested-With": "XMLHttpRequest",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(errorText || `Direct export failed with status ${res.status}`);
  }

  const disposition = res.headers.get("Content-Disposition");
  let downloadFilename = filename ? `${filename}.${format}` : `export_${Date.now()}.${format}`;

  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename=["']?([^"';]+)["']?/);
    if (match && match[1]) {
      downloadFilename = match[1];
    }
  }

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = downloadFilename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
