"""TSV import utilities — parsing logic ported from the HTU Chrome extension."""

import re
from datetime import datetime, timezone
from urllib.parse import urlparse
from typing import Optional, Tuple


# Windows epoch offset: microseconds between 1601-01-01 and 1970-01-01
WINDOWS_EPOCH_OFFSET_US = 11644473600 * 1000000

TRANSITION_MAP = {
    0: "link",
    1: "typed",
    2: "auto_bookmark",
    3: "auto_subframe",
    4: "manual_subframe",
    5: "generated",
    6: "auto_toplevel",
    7: "form_submit",
    8: "reload",
    9: "keyword",
    10: "keyword_generated",
}

VALID_TRANSITIONS = set(TRANSITION_MAP.values())

VISIT_TIME_RE = re.compile(r"^U?\d+\.?\d*$")
TRANSITION_RE = re.compile(r"^(?:-?\d+|[a-z_]+)$", re.IGNORECASE)


def convert_to_unix_ms(visit_time_str: str) -> Optional[float]:
    """Convert a visit time string to Unix epoch milliseconds."""
    if visit_time_str.startswith("U"):
        return float(visit_time_str[1:])
    else:
        # Windows epoch (microseconds since 1601-01-01)
        windows_us = float(visit_time_str)
        unix_us = windows_us - WINDOWS_EPOCH_OFFSET_US
        return unix_us / 1000.0  # convert to ms


def transition_id_to_name(transition_str: str) -> str:
    """Convert a numeric transition (possibly with flags) to text name."""
    try:
        num = int(transition_str)
        core = num & 0xFF
        return TRANSITION_MAP.get(core, "link")
    except ValueError:
        t = transition_str.lower().strip()
        return t if t in VALID_TRANSITIONS else "link"


def extract_host(url: str) -> str:
    """Extract hostname from URL."""
    try:
        parsed = urlparse(url)
        return parsed.hostname or ""
    except Exception:
        return ""


def extract_root_domain(host: str) -> str:
    """Extract root domain from a hostname. Simple heuristic."""
    if not host:
        return ""
    # IP addresses
    if re.match(r"^\d+\.\d+\.\d+\.\d+$", host):
        return host
    parts = host.split(".")
    if len(parts) <= 2:
        return host
    # Handle common 2-part TLDs like co.uk, com.au, etc.
    two_part_tlds = {
        "co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "org.au",
        "co.nz", "co.za", "co.jp", "co.kr", "co.in", "com.br",
        "com.cn", "com.mx", "com.sg", "com.hk", "com.tw",
    }
    last_two = ".".join(parts[-2:])
    if last_two in two_part_tlds and len(parts) >= 3:
        return ".".join(parts[-3:])
    return ".".join(parts[-2:])


def datetime_from_unix_ms(unix_ms: float) -> datetime:
    """Create a datetime from Unix epoch milliseconds."""
    return datetime.fromtimestamp(unix_ms / 1000.0, tz=timezone.utc)


def parse_line(line: str) -> Optional[dict]:
    """Parse a single TSV line. Returns dict with url, visit_time_ms, transition, title,
    host, root_domain, and date components, or None if invalid."""
    line = line.strip("\r\n")
    if not line:
        return None

    parts = line.split("\t")
    num_cols = len(parts)

    url = title = visit_time_raw = transition_raw = host = root_domain = None

    if num_cols == 3:
        # 3-col: url, visitTime, transition (no title)
        url, visit_time_raw, transition_raw = parts
        title = ""
    elif num_cols == 4:
        # 4-col: url, visitTime, transition, title
        url, visit_time_raw, transition_raw, title = parts
    elif num_cols == 8:
        # 8-col: url, host, root_domain, visitTime, datetime_str, weekday, transition, title
        url = parts[0]
        host = parts[1]
        root_domain = parts[2]
        visit_time_raw = parts[3]
        transition_raw = parts[6]
        title = parts[7]
    else:
        return None

    # Validate URL
    if not url or not (url.startswith("http") or url.startswith("ftp") or url.startswith("file") or url.startswith("chrome")):
        return None

    # Validate and convert visit time
    visit_time_raw = visit_time_raw.strip()
    if not VISIT_TIME_RE.match(visit_time_raw):
        return None

    if num_cols == 8:
        # 8-col format: visitTime is already Unix ms
        try:
            unix_ms = float(visit_time_raw)
        except ValueError:
            return None
    else:
        unix_ms = convert_to_unix_ms(visit_time_raw)
        if unix_ms is None:
            return None

    # Sanity check: must be after 1990 and not far in the future
    if unix_ms < 631152000000 or unix_ms > 4102444800000:
        return None

    # Validate and convert transition
    transition_raw = transition_raw.strip()
    if not TRANSITION_RE.match(transition_raw):
        return None

    if num_cols == 8:
        transition = transition_raw.lower().strip()
        if transition not in VALID_TRANSITIONS:
            transition = "link"
    else:
        transition = transition_id_to_name(transition_raw)

    # Extract host/domain if not provided
    if not host:
        host = extract_host(url)
    if not root_domain:
        root_domain = extract_root_domain(host)

    # Date components from visit time
    dt = datetime_from_unix_ms(unix_ms)
    visit_date = dt.strftime("%Y-%m-%d")
    year = dt.year
    month = dt.month - 1  # 0-indexed to match Chrome
    month_day = dt.day
    week_day = (dt.weekday() + 1) % 7  # Python: Mon=0, we want Sun=0
    hour = dt.hour

    title = (title or "").strip()

    return {
        "url": url,
        "visit_time": str(unix_ms),
        "transition_type": transition,
        "title": title,
        "host": host,
        "root_domain": root_domain,
        "visit_date": visit_date,
        "year": year,
        "month": month,
        "month_day": month_day,
        "week_day": week_day,
        "hour": hour,
    }
