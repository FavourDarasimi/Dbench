from __future__ import annotations

import logging
from typing import Any
import sqlglot
from sqlglot import exp

logger = logging.getLogger(__name__)


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
        # If sqlglot can't parse it, we do not block here; target DB driver will validate syntax.
        return warnings

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
    """Return True if the SQL contains any modifying/DML/DDL statements."""
    try:
        read_dialect = "postgres" if dialect == "postgres" else "mysql"
        statements = sqlglot.parse(sql, read=read_dialect)
    except Exception:
        return False

    mutation_types = (
        exp.Insert,
        exp.Update,
        exp.Delete,
        exp.Drop,
        exp.TruncateTable,
        exp.Create,
        exp.Alter,
    )
    for stmt in statements:
        if stmt is None:
            continue
        if isinstance(stmt, mutation_types) or any(stmt.find(t) is not None for t in mutation_types):
            return True
    return False
