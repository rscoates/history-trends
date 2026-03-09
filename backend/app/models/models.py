from sqlalchemy import (
    Column, Integer, BigInteger, String, Text, DateTime, ForeignKey,
    Index, UniqueConstraint, SmallInteger, func
)
from sqlalchemy.orm import relationship
from datetime import datetime

from ..database import Base


class Machine(Base):
    __tablename__ = "machines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), unique=True, nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    imports = relationship("Import", back_populates="machine", cascade="all, delete-orphan")
    visits = relationship("Visit", back_populates="machine", cascade="all, delete-orphan")


class Url(Base):
    __tablename__ = "urls"

    id = Column(Integer, primary_key=True, autoincrement=True)
    url = Column(Text, unique=True, nullable=False)
    host = Column(String(512), nullable=False, index=True)
    root_domain = Column(String(255), nullable=False, index=True)
    title = Column(Text, nullable=True)

    visits = relationship("Visit", back_populates="url_obj", cascade="all, delete-orphan")


class Visit(Base):
    __tablename__ = "visits"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    url_id = Column(Integer, ForeignKey("urls.id", ondelete="CASCADE"), nullable=False)
    machine_id = Column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), nullable=False)
    import_id = Column(Integer, ForeignKey("imports.id", ondelete="SET NULL"), nullable=True)
    visit_time = Column(String(30), nullable=False)  # Unix epoch ms as string
    visit_date = Column(String(10), nullable=False)   # YYYY-MM-DD
    year = Column(SmallInteger, nullable=False)
    month = Column(SmallInteger, nullable=False)       # 0-11
    month_day = Column(SmallInteger, nullable=False)   # 1-31
    week_day = Column(SmallInteger, nullable=False)    # 0=Sun .. 6=Sat
    hour = Column(SmallInteger, nullable=False)        # 0-23
    transition_type = Column(String(30), nullable=False, default="link")

    url_obj = relationship("Url", back_populates="visits")
    machine = relationship("Machine", back_populates="visits")
    import_record = relationship("Import", back_populates="visits")

    __table_args__ = (
        UniqueConstraint("url_id", "visit_time", "machine_id", name="uq_visit"),
        Index("ix_visits_visit_date", "visit_date"),
        Index("ix_visits_visit_time", "visit_time"),
        Index("ix_visits_year", "year"),
        Index("ix_visits_month", "month"),
        Index("ix_visits_week_day", "week_day"),
        Index("ix_visits_hour", "hour"),
        Index("ix_visits_transition_type", "transition_type"),
        Index("ix_visits_machine_id", "machine_id"),
    )


class Import(Base):
    __tablename__ = "imports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    machine_id = Column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), nullable=False)
    filename = Column(String(512), nullable=False)
    imported_at = Column(DateTime, server_default=func.now())
    row_count = Column(Integer, default=0)

    machine = relationship("Machine", back_populates="imports")
    visits = relationship("Visit", back_populates="import_record")
