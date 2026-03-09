import io
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text, func
from sqlalchemy.dialects.postgresql import insert as pg_insert

from ..database import get_db
from ..models import Machine, Url, Visit, Import
from ..schemas import ImportOut
from ..auth_dep import require_auth
from ..tsv_parser import parse_line

router = APIRouter(prefix="/api/imports", tags=["imports"], dependencies=[Depends(require_auth)])

BATCH_SIZE = 500


@router.post("/upload", response_model=ImportOut)
async def upload_tsv(
    file: UploadFile = File(...),
    machine_name: str = Form(...),
    db: AsyncSession = Depends(get_db),
):
    """Upload and import a TSV file with history data, tagged to a machine."""
    # Get or create machine
    result = await db.execute(select(Machine).where(Machine.name == machine_name))
    machine = result.scalar_one_or_none()
    if not machine:
        machine = Machine(name=machine_name)
        db.add(machine)
        await db.flush()

    # Create import record
    imp = Import(machine_id=machine.id, filename=file.filename or "unknown.tsv", row_count=0)
    db.add(imp)
    await db.flush()

    # Read and parse file
    content = await file.read()
    try:
        text_content = content.decode("utf-8")
    except UnicodeDecodeError:
        text_content = content.decode("latin-1")

    lines = text_content.split("\n")
    parsed_rows = []
    skipped = 0

    for line in lines:
        row = parse_line(line)
        if row is None:
            skipped += 1
            continue
        parsed_rows.append(row)

    if not parsed_rows:
        raise HTTPException(status_code=400, detail=f"No valid rows found in file (skipped {skipped} lines)")

    # Batch insert: first URLs, then visits
    inserted_visits = 0

    for i in range(0, len(parsed_rows), BATCH_SIZE):
        batch = parsed_rows[i:i + BATCH_SIZE]

        # Upsert URLs
        url_dicts = []
        seen_urls = set()
        for row in batch:
            if row["url"] not in seen_urls:
                seen_urls.add(row["url"])
                url_dicts.append({
                    "url": row["url"],
                    "url_hash": Url.compute_hash(row["url"]),
                    "host": row["host"],
                    "root_domain": row["root_domain"],
                    "title": row["title"],
                })

        if url_dicts:
            stmt = pg_insert(Url).values(url_dicts)
            stmt = stmt.on_conflict_do_update(
                index_elements=["url_hash"],
                set_={
                    "title": stmt.excluded.title,
                    "host": stmt.excluded.host,
                    "root_domain": stmt.excluded.root_domain,
                },
            )
            await db.execute(stmt)

        # Fetch url_ids for this batch using url_hash lookups
        batch_hashes = [Url.compute_hash(u) for u in seen_urls]
        url_id_map = {}
        for chunk_start in range(0, len(batch_hashes), 500):
            chunk = batch_hashes[chunk_start:chunk_start + 500]
            result = await db.execute(
                select(Url.id, Url.url).where(Url.url_hash.in_(chunk))
            )
            for uid, uurl in result:
                url_id_map[uurl] = uid

        # Insert visits
        visit_dicts = []
        for row in batch:
            url_id = url_id_map.get(row["url"])
            if url_id is None:
                continue
            visit_dicts.append({
                "url_id": url_id,
                "machine_id": machine.id,
                "import_id": imp.id,
                "visit_time": row["visit_time"],
                "visit_date": row["visit_date"],
                "year": row["year"],
                "month": row["month"],
                "month_day": row["month_day"],
                "week_day": row["week_day"],
                "hour": row["hour"],
                "transition_type": row["transition_type"],
            })

        if visit_dicts:
            stmt = pg_insert(Visit).values(visit_dicts)
            stmt = stmt.on_conflict_do_nothing(constraint="uq_visit")
            result = await db.execute(stmt)
            inserted_visits += result.rowcount

    # Update import row count
    imp.row_count = inserted_visits
    await db.commit()
    await db.refresh(imp)

    return ImportOut(
        id=imp.id,
        machine_id=imp.machine_id,
        machine_name=machine.name,
        filename=imp.filename,
        imported_at=imp.imported_at,
        row_count=imp.row_count,
    )


@router.get("/", response_model=list[ImportOut])
async def list_imports(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Import, Machine.name)
        .join(Machine, Import.machine_id == Machine.id)
        .order_by(Import.imported_at.desc())
    )
    imports = []
    for imp, machine_name in result:
        imports.append(ImportOut(
            id=imp.id,
            machine_id=imp.machine_id,
            machine_name=machine_name,
            filename=imp.filename,
            imported_at=imp.imported_at,
            row_count=imp.row_count,
        ))
    return imports


@router.delete("/{import_id}", status_code=204)
async def delete_import(import_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Import).where(Import.id == import_id))
    imp = result.scalar_one_or_none()
    if not imp:
        raise HTTPException(status_code=404, detail="Import not found")
    # Delete associated visits
    await db.execute(
        text("DELETE FROM visits WHERE import_id = :import_id"),
        {"import_id": import_id},
    )
    await db.delete(imp)
    await db.commit()
