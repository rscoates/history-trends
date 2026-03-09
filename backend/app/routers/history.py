from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, text, and_, or_, case, literal_column
from sqlalchemy.orm import aliased

from ..database import get_db
from ..models import Url, Visit, Machine
from ..schemas import SearchRequest, SearchResponse, VisitOut, StatsOut
from ..auth_dep import require_auth

router = APIRouter(prefix="/api/history", tags=["history"], dependencies=[Depends(require_auth)])


def _build_where_clauses(req: SearchRequest):
    """Build WHERE clause fragments from search request."""
    conditions = []

    if req.keywords:
        # Use PostgreSQL full-text search via to_tsvector/to_tsquery
        # Combine URL + title for search
        kw = req.keywords.strip()
        # Convert user keywords to tsquery-compatible format
        terms = kw.split()
        tsquery_parts = [f"{t}:*" for t in terms if t]
        if tsquery_parts:
            tsquery = " & ".join(tsquery_parts)
            conditions.append(
                text(
                    "(to_tsvector('english', coalesce(u.url, '') || ' ' || coalesce(u.title, '')) "
                    "@@ to_tsquery('english', :keywords))"
                ).bindparams(keywords=tsquery)
            )

    if req.url:
        for u in [x.strip() for x in req.url.split(",") if x.strip()]:
            conditions.append(text("u.url ILIKE :url_pattern").bindparams(url_pattern=f"%{u}%"))

    if req.domain:
        for d in [x.strip() for x in req.domain.split(",") if x.strip()]:
            if d.startswith("="):
                # Exact host match
                conditions.append(text("u.host = :exact_host").bindparams(exact_host=d[1:]))
            else:
                # Includes subdomains
                conditions.append(
                    or_(
                        text("u.host = :domain").bindparams(domain=d),
                        text("u.host LIKE :domain_suffix").bindparams(domain_suffix=f"%.{d}"),
                    )
                )

    if req.title:
        terms = req.title.strip().split()
        tsquery_parts = [f"{t}:*" for t in terms if t]
        if tsquery_parts:
            tsquery = " & ".join(tsquery_parts)
            conditions.append(
                text(
                    "to_tsvector('english', coalesce(u.title, '')) "
                    "@@ to_tsquery('english', :title_q)"
                ).bindparams(title_q=tsquery)
            )

    if req.date:
        conditions.append(text("v.visit_date = :exact_date").bindparams(exact_date=req.date))

    if req.date_from:
        conditions.append(text("v.visit_date >= :date_from").bindparams(date_from=req.date_from))

    if req.date_to:
        conditions.append(text("v.visit_date <= :date_to").bindparams(date_to=req.date_to))

    if req.years:
        conditions.append(text(f"v.year IN ({','.join(str(y) for y in req.years)})"))

    if req.months is not None and len(req.months) > 0:
        conditions.append(text(f"v.month IN ({','.join(str(m) for m in req.months)})"))

    if req.days_of_week is not None and len(req.days_of_week) > 0:
        conditions.append(text(f"v.week_day IN ({','.join(str(d) for d in req.days_of_week)})"))

    if req.days_of_month is not None and len(req.days_of_month) > 0:
        conditions.append(text(f"v.month_day IN ({','.join(str(d) for d in req.days_of_month)})"))

    if req.hours is not None and len(req.hours) > 0:
        conditions.append(text(f"v.hour IN ({','.join(str(h) for h in req.hours)})"))

    if req.transitions:
        placeholders = ",".join(f"'{t}'" for t in req.transitions)
        conditions.append(text(f"v.transition_type IN ({placeholders})"))

    if req.machine_ids:
        conditions.append(text(f"v.machine_id IN ({','.join(str(m) for m in req.machine_ids)})"))

    return conditions


@router.post("/search", response_model=SearchResponse)
async def search_history(req: SearchRequest, db: AsyncSession = Depends(get_db)):
    """Search browsing history with flexible filtering."""
    conditions = _build_where_clauses(req)
    where_sql = " AND ".join(f"({c.text})" for c in conditions) if conditions else "1=1"

    # We need to carefully build the SQL with bound params
    # Using raw SQL for flexibility with FTS
    sort_order = "DESC" if req.sort == "newest" else "ASC"
    offset = (req.page - 1) * req.page_size

    # Collect all bind params
    all_params = {}
    for c in conditions:
        if hasattr(c, "_orig_key") or hasattr(c, "compile"):
            try:
                compiled = c.compile()
                all_params.update(compiled.params)
            except Exception:
                pass

    # Build params from the request directly for safety
    params = {"limit": req.page_size, "offset": offset}
    if req.keywords:
        terms = req.keywords.strip().split()
        tsquery_parts = [f"{t}:*" for t in terms if t]
        params["keywords"] = " & ".join(tsquery_parts)
    if req.url:
        for i, u in enumerate(x.strip() for x in req.url.split(",") if x.strip()):
            params[f"url_pattern_{i}"] = f"%{u}%"
    if req.domain:
        for i, d in enumerate(x.strip() for x in req.domain.split(",") if x.strip()):
            if d.startswith("="):
                params[f"exact_host_{i}"] = d[1:]
            else:
                params[f"domain_{i}"] = d
                params[f"domain_suffix_{i}"] = f"%.{d}"
    if req.title:
        terms = req.title.strip().split()
        tsquery_parts = [f"{t}:*" for t in terms if t]
        params["title_q"] = " & ".join(tsquery_parts)
    if req.date:
        params["exact_date"] = req.date
    if req.date_from:
        params["date_from"] = req.date_from
    if req.date_to:
        params["date_to"] = req.date_to

    # Build WHERE clause more carefully with proper param names
    where_parts = []

    if req.keywords:
        where_parts.append(
            "(to_tsvector('english', coalesce(u.url, '') || ' ' || coalesce(u.title, '')) "
            "@@ to_tsquery('english', :keywords))"
        )

    if req.url:
        for i, u in enumerate(x.strip() for x in req.url.split(",") if x.strip()):
            where_parts.append(f"u.url ILIKE :url_pattern_{i}")

    if req.domain:
        for i, d in enumerate(x.strip() for x in req.domain.split(",") if x.strip()):
            if d.startswith("="):
                where_parts.append(f"u.host = :exact_host_{i}")
            else:
                where_parts.append(f"(u.host = :domain_{i} OR u.host LIKE :domain_suffix_{i})")

    if req.title:
        where_parts.append(
            "to_tsvector('english', coalesce(u.title, '')) "
            "@@ to_tsquery('english', :title_q)"
        )

    if req.date:
        where_parts.append("v.visit_date = :exact_date")
    if req.date_from:
        where_parts.append("v.visit_date >= :date_from")
    if req.date_to:
        where_parts.append("v.visit_date <= :date_to")

    if req.years:
        where_parts.append(f"v.year IN ({','.join(str(y) for y in req.years)})")
    if req.months is not None and len(req.months) > 0:
        where_parts.append(f"v.month IN ({','.join(str(m) for m in req.months)})")
    if req.days_of_week is not None and len(req.days_of_week) > 0:
        where_parts.append(f"v.week_day IN ({','.join(str(d) for d in req.days_of_week)})")
    if req.days_of_month is not None and len(req.days_of_month) > 0:
        where_parts.append(f"v.month_day IN ({','.join(str(d) for d in req.days_of_month)})")
    if req.hours is not None and len(req.hours) > 0:
        where_parts.append(f"v.hour IN ({','.join(str(h) for h in req.hours)})")
    if req.transitions:
        trans_list = ",".join(f"'{t}'" for t in req.transitions)
        where_parts.append(f"v.transition_type IN ({trans_list})")
    if req.machine_ids:
        where_parts.append(f"v.machine_id IN ({','.join(str(m) for m in req.machine_ids)})")

    where_sql = " AND ".join(where_parts) if where_parts else "1=1"

    # Count query
    count_sql = f"""
        SELECT COUNT(*) FROM visits v
        JOIN urls u ON v.url_id = u.id
        WHERE {where_sql}
    """
    count_result = await db.execute(text(count_sql), params)
    total = count_result.scalar()

    # Data query
    data_sql = f"""
        SELECT v.id, u.url, u.host, u.root_domain, u.title,
               v.visit_time, v.visit_date, v.year, v.month,
               v.month_day, v.week_day, v.hour, v.transition_type,
               m.name as machine_name
        FROM visits v
        JOIN urls u ON v.url_id = u.id
        JOIN machines m ON v.machine_id = m.id
        WHERE {where_sql}
        ORDER BY v.visit_time {sort_order}
        LIMIT :limit OFFSET :offset
    """
    data_result = await db.execute(text(data_sql), params)
    rows = data_result.fetchall()

    results = [
        VisitOut(
            id=r.id,
            url=r.url,
            host=r.host,
            root_domain=r.root_domain,
            title=r.title,
            visit_time=r.visit_time,
            visit_date=r.visit_date,
            year=r.year,
            month=r.month,
            month_day=r.month_day,
            week_day=r.week_day,
            hour=r.hour,
            transition_type=r.transition_type,
            machine_name=r.machine_name,
        )
        for r in rows
    ]

    return SearchResponse(
        results=results,
        total=total,
        page=req.page,
        page_size=req.page_size,
        has_next=(offset + req.page_size) < total,
    )


@router.get("/stats", response_model=StatsOut)
async def get_stats(
    machine_ids: Optional[str] = Query(None, description="Comma-separated machine IDs"),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregate statistics for the trends/dashboard view."""
    machine_filter = ""
    params = {}
    if machine_ids:
        ids = [int(x) for x in machine_ids.split(",")]
        machine_filter = f"WHERE v.machine_id IN ({','.join(str(i) for i in ids)})"

    # Total visits and URLs
    total_visits_q = await db.execute(text(f"SELECT COUNT(*) FROM visits v {machine_filter}"), params)
    total_visits = total_visits_q.scalar()

    total_urls_q = await db.execute(text(
        f"SELECT COUNT(DISTINCT v.url_id) FROM visits v {machine_filter}"
    ), params)
    total_urls = total_urls_q.scalar()

    total_machines_q = await db.execute(text("SELECT COUNT(*) FROM machines"))
    total_machines = total_machines_q.scalar()

    # Oldest/newest
    minmax_q = await db.execute(text(
        f"SELECT MIN(v.visit_time), MAX(v.visit_time) FROM visits v {machine_filter}"
    ), params)
    row = minmax_q.fetchone()
    oldest = row[0] if row else None
    newest = row[1] if row else None

    # By hour
    hour_q = await db.execute(text(
        f"SELECT v.hour, COUNT(*) FROM visits v {machine_filter} GROUP BY v.hour ORDER BY v.hour"
    ), params)
    by_hour = {str(r[0]): r[1] for r in hour_q.fetchall()}

    # By day of week
    dow_q = await db.execute(text(
        f"SELECT v.week_day, COUNT(*) FROM visits v {machine_filter} GROUP BY v.week_day ORDER BY v.week_day"
    ), params)
    by_dow = {str(r[0]): r[1] for r in dow_q.fetchall()}

    # By month
    month_q = await db.execute(text(
        f"SELECT v.month, COUNT(*) FROM visits v {machine_filter} GROUP BY v.month ORDER BY v.month"
    ), params)
    by_month = {str(r[0]): r[1] for r in month_q.fetchall()}

    # By year
    year_q = await db.execute(text(
        f"SELECT v.year, COUNT(*) FROM visits v {machine_filter} GROUP BY v.year ORDER BY v.year"
    ), params)
    by_year = {str(r[0]): r[1] for r in year_q.fetchall()}

    # By transition
    trans_q = await db.execute(text(
        f"SELECT v.transition_type, COUNT(*) FROM visits v {machine_filter} GROUP BY v.transition_type ORDER BY COUNT(*) DESC"
    ), params)
    by_transition = {r[0]: r[1] for r in trans_q.fetchall()}

    # Top domains
    domains_q = await db.execute(text(f"""
        SELECT u.root_domain, COUNT(*) as cnt
        FROM visits v JOIN urls u ON v.url_id = u.id
        {machine_filter}
        GROUP BY u.root_domain ORDER BY cnt DESC LIMIT 20
    """), params)
    top_domains = [{"domain": r[0], "count": r[1]} for r in domains_q.fetchall()]

    # Top URLs
    urls_q = await db.execute(text(f"""
        SELECT u.url, u.title, COUNT(*) as cnt
        FROM visits v JOIN urls u ON v.url_id = u.id
        {machine_filter}
        GROUP BY u.url, u.title ORDER BY cnt DESC LIMIT 20
    """), params)
    top_urls = [{"url": r[0], "title": r[1], "count": r[2]} for r in urls_q.fetchall()]

    return StatsOut(
        total_visits=total_visits,
        total_urls=total_urls,
        total_machines=total_machines,
        oldest_visit=oldest,
        newest_visit=newest,
        by_hour=by_hour,
        by_day_of_week=by_dow,
        by_month=by_month,
        by_year=by_year,
        by_transition=by_transition,
        top_domains=top_domains,
        top_urls=top_urls,
    )
