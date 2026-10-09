"""
Read every row of a Supabase query, not just the first page.

PostgREST (behind supabase-py) returns at most "Max rows" rows per request
(1000 by default, configurable per project), silently truncating the rest.
fetch_all() requests consecutive .range() windows until a request comes back
empty, so it also works when the project's cap is lower than the page size.

Paging needs a stable sort order, otherwise rows can be skipped or repeated
between pages: pass the display order in `order`, and `tiebreak` (a unique
column, "id" by default) is appended so ties are resolved deterministically.
"""

PAGE_SIZE = 1000


def fetch_all(build_query, order=(), tiebreak="id", page_size=PAGE_SIZE, label=""):
    """Return all rows of the query built by build_query().

    build_query: zero-argument callable returning a fresh query with select()
                 and filters applied, e.g. lambda: sb.table("t").select("*").eq("x", 1)
    order:       sequence of (column, descending) pairs for the result order
    tiebreak:    unique column appended to the order; if the table has no such
                 column the query is retried without it (with a warning)
    """
    try:
        return _fetch_pages(build_query, list(order) + ([(tiebreak, False)] if tiebreak else []), page_size)
    except Exception as e:
        if tiebreak and tiebreak in str(e) and "does not exist" in str(e):
            print(f"[UniAdvisor] {label or 'query'}: no '{tiebreak}' column, paging without a unique "
                  "tiebreak (rows with equal sort keys may be skipped or repeated)")
            return _fetch_pages(build_query, list(order), page_size)
        raise


def _fetch_pages(build_query, order, page_size):
    rows, start = [], 0
    while True:
        q = build_query()
        for column, descending in order:
            q = q.order(column, desc=descending)
        batch = q.range(start, start + page_size - 1).execute().data or []
        if not batch:
            return rows
        rows.extend(batch)
        start += len(batch)
