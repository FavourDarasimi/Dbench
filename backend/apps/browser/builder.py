from __future__ import annotations

import re
from typing import Any
from rest_framework.exceptions import ValidationError

from apps.drivers.base import ColumnMeta


def quote_identifier(name: str, dialect: str = "postgres") -> str:
    """Safely quote a SQL identifier according to the target engine dialect."""
    if "\x00" in name:
        raise ValidationError("Invalid identifier containing null byte.")
    if dialect == "mysql":
        escaped = name.replace("`", "``")
        return f"`{escaped}`"
    escaped = name.replace('"', '""')
    return f'"{escaped}"'


class BrowseQueryBuilder:
    """
    Builds parameterized SQL SELECT queries strictly from structured parameters.
    Guarantees SQL injection safety via column whitelisting and parameterized bounds.
    """

    ALLOWED_OPERATORS = {
        "eq": "= %s",
        "neq": "<> %s",
        "gt": "> %s",
        "gte": ">= %s",
        "lt": "< %s",
        "lte": "<= %s",
        "contains": "contains",  # Handled specially per dialect
        "starts_with": "starts_with",
        "ends_with": "ends_with",
        "is_null": "IS NULL",
        "not_null": "IS NOT NULL",
        "between": "between",
        "in": "in",
    }

    def __init__(
        self,
        schema: str,
        table: str,
        columns: list[ColumnMeta],
        dialect: str = "postgres",
        page: int = 1,
        page_size: int = 50,
        sort: list[dict[str, str]] | str | None = None,
        filters: list[dict[str, Any]] | None = None,
        search: str | None = None,
        cursor: dict[str, Any] | None = None,
    ):
        self.schema = schema.strip()
        self.table = table.strip()
        self.dialect = "postgres" if dialect == "postgres" else "mysql"
        self.columns_by_name: dict[str, ColumnMeta] = {col.name: col for col in columns}
        self.primary_key_col: str | None = next((c.name for c in columns if c.is_primary_key), None)

        self.page = max(int(page), 1)
        self.page_size = min(max(int(page_size), 1), 500)
        self.sort = self._normalize_sort(sort)
        self.filters = filters or []
        self.search = (search or "").strip()
        self.cursor = cursor

    def _normalize_sort(self, sort_input: Any) -> list[tuple[str, str]]:
        """Normalize various sort inputs into list of (column, 'ASC'|'DESC')."""
        result: list[tuple[str, str]] = []
        if not sort_input:
            if self.primary_key_col:
                return [(self.primary_key_col, "ASC")]
            elif self.columns_by_name:
                first_col = next(iter(self.columns_by_name.keys()))
                return [(first_col, "ASC")]
            return result

        if isinstance(sort_input, str):
            # Parse comma-separated "col:asc,-other_col,name"
            parts = [p.strip() for p in sort_input.split(",") if p.strip()]
            for p in parts:
                if ":" in p:
                    col, direction = p.split(":", 1)
                    direction = "DESC" if direction.lower() == "desc" else "ASC"
                elif p.startswith("-"):
                    col = p[1:]
                    direction = "DESC"
                else:
                    col = p
                    direction = "ASC"
                result.append((col, direction))
        elif isinstance(sort_input, list):
            for item in sort_input:
                if isinstance(item, dict):
                    col = item.get("column") or item.get("col") or ""
                    d = str(item.get("direction") or item.get("dir") or "ASC").upper()
                    direction = "DESC" if d == "DESC" else "ASC"
                    if col:
                        result.append((col, direction))
                elif isinstance(item, str):
                    result.extend(self._normalize_sort(item))

        # Validate each sorted column against column whitelist
        for col, _ in result:
            if col not in self.columns_by_name:
                raise ValidationError(f"Invalid sort column: '{col}' does not exist in table.")
        return result

    def _quote(self, identifier: str) -> str:
        return quote_identifier(identifier, dialect=self.dialect)

    def build(self) -> tuple[str, list[Any]]:
        """Compile structured query into parameterized SQL and parameter tuple."""
        table_ref = f"{self._quote(self.schema)}.{self._quote(self.table)}"
        params: list[Any] = []
        where_clauses: list[str] = []

        like_keyword = "ILIKE" if self.dialect == "postgres" else "LIKE"

        # 1. Structured Column Filters
        for flt in self.filters:
            col_name = flt.get("column") or flt.get("col")
            if not col_name or col_name not in self.columns_by_name:
                raise ValidationError(f"Invalid filter column: '{col_name}'.")

            op = (flt.get("operator") or flt.get("op") or "eq").lower().strip()
            if op not in self.ALLOWED_OPERATORS:
                raise ValidationError(f"Unsupported filter operator: '{op}'.")

            val = flt.get("value")
            quoted_col = self._quote(col_name)

            if op == "is_null":
                where_clauses.append(f"{quoted_col} IS NULL")
            elif op == "not_null":
                where_clauses.append(f"{quoted_col} IS NOT NULL")
            elif op == "contains":
                where_clauses.append(f"{quoted_col} {like_keyword} %s")
                params.append(f"%{val}%")
            elif op == "starts_with":
                where_clauses.append(f"{quoted_col} {like_keyword} %s")
                params.append(f"{val}%")
            elif op == "ends_with":
                where_clauses.append(f"{quoted_col} {like_keyword} %s")
                params.append(f"%{val}")
            elif op == "between":
                if not isinstance(val, (list, tuple)) or len(val) != 2:
                    raise ValidationError(f"Filter operator 'between' requires a list of 2 values.")
                where_clauses.append(f"{quoted_col} BETWEEN %s AND %s")
                params.extend(val)
            elif op == "in":
                if not isinstance(val, (list, tuple)) or not val:
                    raise ValidationError("Filter operator 'in' requires a non-empty list of values.")
                placeholders = ", ".join(["%s"] * len(val))
                where_clauses.append(f"{quoted_col} IN ({placeholders})")
                params.extend(val)
            else:
                sql_op = self.ALLOWED_OPERATORS[op]
                where_clauses.append(f"{quoted_col} {sql_op}")
                params.append(val)

        # 2. Global Text Search
        if self.search:
            text_columns = [
                self._quote(c.name)
                for c in self.columns_by_name.values()
                if c.generic_type == "text"
            ]
            if text_columns:
                search_subclauses = [f"{col} {like_keyword} %s" for col in text_columns]
                where_clauses.append("(" + " OR ".join(search_subclauses) + ")")
                params.extend([f"%{self.search}%"] * len(text_columns))

        # 3. Keyset Pagination (Cursor)
        if self.cursor and isinstance(self.cursor, dict):
            cursor_col = self.cursor.get("column")
            cursor_val = self.cursor.get("value")
            direction = (self.cursor.get("direction") or "gt").lower()
            if cursor_col in self.columns_by_name and cursor_val is not None:
                comp = ">" if direction == "gt" else "<"
                where_clauses.append(f"{self._quote(cursor_col)} {comp} %s")
                params.append(cursor_val)

        # 4. Assemble WHERE clause
        where_sql = ""
        if where_clauses:
            where_sql = " WHERE " + " AND ".join(where_clauses)

        # 5. ORDER BY
        order_clauses = [f"{self._quote(col)} {direction}" for col, direction in self.sort]
        order_sql = ""
        if order_clauses:
            order_sql = " ORDER BY " + ", ".join(order_clauses)

        # 6. LIMIT & OFFSET
        if self.cursor:
            limit_sql = f" LIMIT {self.page_size}"
        else:
            offset = (self.page - 1) * self.page_size
            limit_sql = f" LIMIT {self.page_size} OFFSET {offset}"

        sql = f"SELECT * FROM {table_ref}{where_sql}{order_sql}{limit_sql};"
        return sql, params

    def build_count_query(self) -> tuple[str, list[Any]]:
        """Compile a matching COUNT(*) query honoring all active filters and search terms."""
        table_ref = f"{self._quote(self.schema)}.{self._quote(self.table)}"
        params: list[Any] = []
        where_clauses: list[str] = []

        like_keyword = "ILIKE" if self.dialect == "postgres" else "LIKE"

        for flt in self.filters:
            col_name = flt.get("column") or flt.get("col")
            if not col_name or col_name not in self.columns_by_name:
                continue
            op = (flt.get("operator") or flt.get("op") or "eq").lower().strip()
            val = flt.get("value")
            quoted_col = self._quote(col_name)

            if op == "is_null":
                where_clauses.append(f"{quoted_col} IS NULL")
            elif op == "not_null":
                where_clauses.append(f"{quoted_col} IS NOT NULL")
            elif op == "contains":
                where_clauses.append(f"{quoted_col} {like_keyword} %s")
                params.append(f"%{val}%")
            elif op == "starts_with":
                where_clauses.append(f"{quoted_col} {like_keyword} %s")
                params.append(f"{val}%")
            elif op == "ends_with":
                where_clauses.append(f"{quoted_col} {like_keyword} %s")
                params.append(f"%{val}")
            elif op == "between" and isinstance(val, (list, tuple)) and len(val) == 2:
                where_clauses.append(f"{quoted_col} BETWEEN %s AND %s")
                params.extend(val)
            elif op == "in" and isinstance(val, (list, tuple)) and val:
                placeholders = ", ".join(["%s"] * len(val))
                where_clauses.append(f"{quoted_col} IN ({placeholders})")
                params.extend(val)
            elif op in self.ALLOWED_OPERATORS:
                where_clauses.append(f"{quoted_col} {self.ALLOWED_OPERATORS[op]}")
                params.append(val)

        if self.search:
            text_columns = [
                self._quote(c.name)
                for c in self.columns_by_name.values()
                if c.generic_type == "text"
            ]
            if text_columns:
                search_subclauses = [f"{col} {like_keyword} %s" for col in text_columns]
                where_clauses.append("(" + " OR ".join(search_subclauses) + ")")
                params.extend([f"%{self.search}%"] * len(text_columns))

        where_sql = f" WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        return f"SELECT COUNT(*) FROM {table_ref}{where_sql};", params

    def render_sql_preview(self) -> str:
        """Render a readable preview of the query with bound values safely formatted for display."""
        sql, params = self.build()
        if not params:
            return sql

        # Safely format preview values for display
        def repr_val(v: Any) -> str:
            if v is None:
                return "NULL"
            if isinstance(v, (int, float)):
                return str(v)
            if isinstance(v, bool):
                return "TRUE" if v else "FALSE"
            clean = str(v).replace("'", "''")
            return f"'{clean}'"

        formatted = sql
        for p in params:
            formatted = formatted.replace("%s", repr_val(p), 1)
        return formatted
