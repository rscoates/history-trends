from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..database import get_db
from ..models import Machine
from ..schemas import MachineCreate, MachineOut
from ..auth_dep import require_auth

router = APIRouter(prefix="/api/machines", tags=["machines"], dependencies=[Depends(require_auth)])


@router.get("/", response_model=list[MachineOut])
async def list_machines(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Machine).order_by(Machine.name))
    return result.scalars().all()


@router.post("/", response_model=MachineOut, status_code=201)
async def create_machine(body: MachineCreate, db: AsyncSession = Depends(get_db)):
    existing = await db.execute(select(Machine).where(Machine.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Machine already exists")
    machine = Machine(name=body.name)
    db.add(machine)
    await db.commit()
    await db.refresh(machine)
    return machine


@router.delete("/{machine_id}", status_code=204)
async def delete_machine(machine_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Machine).where(Machine.id == machine_id))
    machine = result.scalar_one_or_none()
    if not machine:
        raise HTTPException(status_code=404, detail="Machine not found")
    await db.delete(machine)
    await db.commit()
