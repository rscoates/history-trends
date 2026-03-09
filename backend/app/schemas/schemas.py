from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# --- Auth ---
class LoginRequest(BaseModel):
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --- Machine ---
class MachineCreate(BaseModel):
    name: str


class MachineOut(BaseModel):
    id: int
    name: str
    created_at: datetime

    class Config:
        from_attributes = True


# --- Import ---
class ImportOut(BaseModel):
    id: int
    machine_id: int
    machine_name: Optional[str] = None
    filename: str
    imported_at: datetime
    row_count: int

    class Config:
        from_attributes = True


class CleanRequest(BaseModel):
    against_import_ids: List[int]


class CleanResult(BaseModel):
    import_id: int
    removed: int
    remaining: int


# --- Search / History ---
class SearchRequest(BaseModel):
    keywords: Optional[str] = None
    url: Optional[str] = None
    domain: Optional[str] = None
    title: Optional[str] = None
    date: Optional[str] = None          # YYYY-MM-DD
    date_from: Optional[str] = None     # YYYY-MM-DD
    date_to: Optional[str] = None       # YYYY-MM-DD
    years: Optional[List[int]] = None
    months: Optional[List[int]] = None  # 0-11
    days_of_week: Optional[List[int]] = None  # 0-6
    days_of_month: Optional[List[int]] = None  # 1-31
    hours: Optional[List[int]] = None   # 0-23
    transitions: Optional[List[str]] = None
    machine_ids: Optional[List[int]] = None
    page: int = 1
    page_size: int = 100
    sort: str = "newest"  # "newest" | "oldest"


class VisitOut(BaseModel):
    id: int
    url: str
    host: str
    root_domain: str
    title: Optional[str]
    visit_time: str
    visit_date: str
    year: int
    month: int
    month_day: int
    week_day: int
    hour: int
    transition_type: str
    machine_name: str

    class Config:
        from_attributes = True


class SearchResponse(BaseModel):
    results: List[VisitOut]
    total: int
    page: int
    page_size: int
    has_next: bool


# --- Stats (minimal for now, expandable for charts later) ---
class StatsOut(BaseModel):
    total_visits: int
    total_urls: int
    total_machines: int
    oldest_visit: Optional[str] = None
    newest_visit: Optional[str] = None
    by_hour: dict
    by_day_of_week: dict
    by_month: dict
    by_year: dict
    by_transition: dict
    top_domains: List[dict]
    top_urls: List[dict]
