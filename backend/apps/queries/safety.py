from __future__ import annotations

import logging
import re
from typing import Any
import sqlglot
from sqlglot import exp

logger = logging.getLogger(__name__)


def _fallback_destructive_check(sql: str) -> list[str]:
    """Fallback safety analysis using regex matching when AST parser cannot parse dialect SQL."""
    warnings: list[str] = []
    # Strip string literals and comments to avoid false positives inside string literals
    clean_sql = re.sub(r"'[^']*'", "", sql)
    clean_sql = re.sub(r"--.*$", "", clean_sql, flags=re.MULTILINE)
    clean_sql = re.sub(r"/\*.*?\*/", "", clean_sql, flags=re.DOTALL)

    # 1. DROP
    if re.search(r"\bDROP\s+(TABLE|VIEW|DATABASE|SCHEMA|INDEX|COLUMN|TRIGGER|PROCEDURE|FUNCTION)\b", clean_sql, re.IGNORECASE):
        warnings.append("DROP statement will permanently destroy schema objects.")

    # 2. TRUNCATE
    if re.search(r"\bTRUNCATE\b", clean_sql, re.IGNORECASE):
        warnings.append("TRUNCATE statement will immediately remove all records.")

    # 3. DELETE without WHERE
    if re.search(r"\bDELETE\s+FROM\b", clean_sql, re.IGNORECASE) and not re.search(r"\bWHERE\b", clean_sql, re.IGNORECASE):
        warnings.append("DELETE statement without a WHERE clause will delete all rows in the table.")

    # 4. UPDATE without WHERE
    if re.search(r"\bUPDATE\s+\S+\s+SET\b", clean_sql, re.IGNORECASE) and not re.search(r"\bWHERE\b", clean_sql, re.IGNORECASE):
        warnings.append("UPDATE statement without a WHERE clause will modify all rows in the table.")

    return warnings


def analyze_sql_safety(sql: str, dialect: str = "postgres") -> list[str]:
    """
    Parse SQL using sqlglot and inspect for destructive statements (PRD F6):
    - Warn before DELETE or UPDATE without a WHERE clause
    - Warn before DROP or TRUNCATE
    """
    warnings: list[str] = []
    if not sql or not sql.strip():
        return warnings

    try:
        read_dialect = "postgres" if dialect == "postgres" else "mysql"
        statements = sqlglot.parse(sql, read=read_dialect)
    except Exception as exc:
        logger.debug("Could not parse SQL with sqlglot: %s", exc)
        # Fail safe fallback: inspect with token regex so unparseable SQL does not fail-open
        return _fallback_destructive_check(sql)

    for stmt in statements:
        if stmt is None:
            continue

        # 1. DELETE without WHERE
        if isinstance(stmt, exp.Delete):
            if stmt.find(exp.Where) is None:
                warnings.append("DELETE statement without a WHERE clause will delete all rows in the table.")

        # 2. UPDATE without WHERE
        elif isinstance(stmt, exp.Update):
            if stmt.find(exp.Where) is None:
                warnings.append("UPDATE statement without a WHERE clause will modify all rows in the table.")

        # 3. DROP
        elif isinstance(stmt, exp.Drop) or stmt.find(exp.Drop) is not None:
            warnings.append("DROP statement will permanently destroy schema objects.")

        # 4. TRUNCATE
        elif isinstance(stmt, exp.TruncateTable) or stmt.find(exp.TruncateTable) is not None:
            warnings.append("TRUNCATE statement will immediately remove all records.")

    return warnings


def is_mutation_statement(sql: str, dialect: str = "postgres") -> bool:
    """Return True if the SQL contains any modifying/DML/DDL statements or session alterations."""
    if not sql or not sql.strip():
        return False

    try:
        read_dialect = "postgres" if dialect == "postgres" else "mysql"
        statements = sqlglot.parse(sql, read=read_dialect)
    except Exception:
        # Fail safe: if SQL cannot be parsed, treat as potentially mutating
        return True

    mutation_types = (
        exp.Insert,
        exp.Update,
        exp.Delete,
        exp.Drop,
        exp.TruncateTable,
        exp.Create,
        exp.Alter,
        exp.Set,
        exp.Copy,
        exp.Transaction,
        exp.Commit,
    )
    for stmt in statements:
        if stmt is None:
            continue
        if isinstance(stmt, mutation_types) or any(stmt.find(t) is not None for t in mutation_types):
            return True
        if isinstance(stmt, exp.Command):
            cmd_name = str(stmt.this).upper() if stmt.this else ""
            if cmd_name in ("DO", "CALL", "EXEC", "EXECUTE", "LOCK", "SHUTDOWN"):
                return True
    return False
