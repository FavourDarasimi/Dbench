from __future__ import annotations

import csv
from datetime import date, datetime, time
from decimal import Decimal
from enum import Enum
import io
import json
import re
from typing import Any, Generator
import uuid

from django.http import StreamingHttpResponse

from apps.drivers.base import BaseDriver, serialize_value


class ExportFormat(str, Enum):
    CSV = "csv"
    JSON = "json"
    JSONL = "jsonl"


def format_export_val(val: Any) -> Any:
    """Format single database cell value for streaming export serialization."""
    if val is None:
        return None
    if isinstance(val, bool):
        return val
    if isinstance(val, (int, float)):
        return val
    if isinstance(val, Decimal):
        exp = val.as_tuple().exponent
        return float(val) if (-6 <= exp <= 6) else str(val)
    if isinstance(val, (datetime, date, time)):
        return val.isoformat()
    if isinstance(val, uuid.UUID):
        return str(val)
    if isinstance(val, (bytes, bytearray, memoryview)):
        return f"<binary: {len(val)} bytes>"
    if isinstance(val, (dict, list)):
        return val
    return str(val)


def stream_csv(
    driver: BaseDriver,
    sql: str,
    params: tuple | list | dict | None = None,
    chunk_size: int = 1000,
    max_rows: int | None = None,
) -> Generator[str, None, None]:
    """Stream SQL query results as RFC 4180 CSV chunks."""
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    first_chunk = True

    for col_names, rows in driver.stream_query(
        sql=sql, params=params, chunk_size=chunk_size, max_rows=max_rows
    ):
        if first_chunk:
            writer.writerow(col_names)
            first_chunk = False

        for row in rows:
            formatted_row = []
            for val in row:
                fv = format_export_val(val)
                if fv is None:
                    formatted_row.append("")
                elif isinstance(fv, (dict, list)):
                    formatted_row.append(json.dumps(fv))
                else:
                    formatted_row.append(str(fv))
            writer.writerow(formatted_row)

        chunk_data = output.getvalue()
        output.seek(0)
        output.truncate(0)
        yield chunk_data


def stream_json(
    driver: BaseDriver,
    sql: str,
    params: tuple | list | dict | None = None,
    chunk_size: int = 1000,
    max_rows: int | None = None,
) -> Generator[str, None, None]:
    """Stream SQL query results as a JSON array of objects: [ {...}, {...} ]."""
    yield "[\n"
    first_row = True

    for col_names, rows in driver.stream_query(
        sql=sql, params=params, chunk_size=chunk_size, max_rows=max_rows
    ):
        lines: list[str] = []
        for row in rows:
            row_dict = {}
            for col, val in zip(col_names, row):
                row_dict[col] = format_export_val(val)
            serialized = json.dumps(row_dict, default=str)
            if first_row:
                lines.append(f"  {serialized}")
                first_row = False
            else:
                lines.append(f",\n  {serialized}")

        if lines:
            yield "".join(lines)

    yield "\n]\n"


def stream_jsonl(
    driver: BaseDriver,
    sql: str,
    params: tuple | list | dict | None = None,
    chunk_size: int = 1000,
    max_rows: int | None = None,
) -> Generator[str, None, None]:
    """Stream SQL query results as newline-delimited JSON (NDJSON / JSONL)."""
    for col_names, rows in driver.stream_query(
        sql=sql, params=params, chunk_size=chunk_size, max_rows=max_rows
    ):
        lines: list[str] = []
        for row in rows:
            row_dict = {}
            for col, val in zip(col_names, row):
                row_dict[col] = format_export_val(val)
            lines.append(json.dumps(row_dict, default=str) + "\n")

        if lines:
            yield "".join(lines)


def sanitize_filename(name: str) -> str:
    """Sanitize filename to prevent header injection or directory traversal."""
    cleaned = re.sub(r'[^a-zA-Z0-9_\-\.]', '_', name)
    return cleaned.strip("._") or "export"


def build_streaming_export_response(
    driver: BaseDriver,
    sql: str,
    params: tuple | list | dict | None = None,
    export_format: str = "csv",
    filename: str | None = None,
    max_rows: int | None = None,
    chunk_size: int = 1000,
) -> StreamingHttpResponse:
    """Construct an HTTP response that streams query results with minimal memory overhead."""
    fmt = (export_format or "csv").lower().strip()
    base_name = sanitize_filename(filename or f"export_{datetime.now().strftime('%Y%m%d_%H%M%S')}")

    if fmt == ExportFormat.JSON.value:
        content_type = "application/json; charset=utf-8"
        file_ext = "json"
        streamer = stream_json(driver, sql, params, chunk_size=chunk_size, max_rows=max_rows)
    elif fmt in (ExportFormat.JSONL.value, "ndjson"):
        content_type = "application/x-ndjson; charset=utf-8"
        file_ext = "jsonl"
        streamer = stream_jsonl(driver, sql, params, chunk_size=chunk_size, max_rows=max_rows)
    else:  # default to CSV
        content_type = "text/csv; charset=utf-8"
        file_ext = "csv"
        streamer = stream_csv(driver, sql, params, chunk_size=chunk_size, max_rows=max_rows)

    full_filename = f"{base_name}.{file_ext}" if not base_name.endswith(f".{file_ext}") else base_name

    response = StreamingHttpResponse(streamer, content_type=content_type)
    response["Content-Disposition"] = f'attachment; filename="{full_filename}"'
    response["Cache-Control"] = "no-cache, no-store, must-revalidate"
    return response
