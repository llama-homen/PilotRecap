"""
FlightAware AeroAPI integration module.
Handles live flight data fetching and parsing.
"""
import httpx
import os
from datetime import datetime, timezone
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

AEROAPI_BASE = "https://aeroapi.flightaware.com/aeroapi"
AEROAPI_KEY = os.getenv("AEROAPI_KEY", "")


def _headers() -> dict:
    return {"x-apikey": AEROAPI_KEY}


async def get_live_flight(flight_number: str) -> dict:
    """
    Fetch the latest flight data from FlightAware AeroAPI.
    Returns the most recent flight entry plus live position data.
    Raises httpx.HTTPStatusError on API errors.
    """
    if not AEROAPI_KEY or AEROAPI_KEY == "your_aeroapi_key_here":
        raise ValueError("AeroAPI key not configured. Set AEROAPI_KEY in backend/.env")

    url = f"{AEROAPI_BASE}/flights/{flight_number.upper()}"
    params = {"max_pages": 1}

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(url, headers=_headers(), params=params)
        resp.raise_for_status()
        data = resp.json()

    flights = data.get("flights", [])
    if not flights:
        return {}

    # Return the most recent (first) flight entry
    latest = flights[0]

    # Also fetch live position if available
    position_data = {}
    fa_id = latest.get("fa_flight_id", "")
    if fa_id:
        position_data = await get_flight_position(fa_id)

    parsed = parse_flight_record(latest)
    parsed["live_position"] = position_data
    return parsed


async def get_flight_position(fa_flight_id: str) -> dict:
    """
    Fetch current live position for a flight.
    Returns progress percentage and position info.
    """
    try:
        url = f"{AEROAPI_BASE}/flights/{fa_flight_id}/position"
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=_headers())
            if resp.status_code == 200:
                return resp.json()
    except Exception:
        pass
    return {}


def parse_flight_record(flight: dict) -> dict:
    """
    Parse a raw AeroAPI flight payload into our normalized schema.
    """
    # Extract airport codes (prefer ICAO, fall back to IATA/code)
    origin = _extract_airport_code(flight.get("origin", {}))
    destination = _extract_airport_code(flight.get("destination", {}))

    # Times — prefer actual, fall back to scheduled
    dep_time = (
        flight.get("actual_off")
        or flight.get("actual_out")
        or flight.get("scheduled_off")
        or flight.get("scheduled_out")
        or ""
    )
    arr_time = (
        flight.get("actual_on")
        or flight.get("actual_in")
        or flight.get("scheduled_on")
        or flight.get("scheduled_in")
        or ""
    )

    # Aircraft
    aircraft_type = flight.get("aircraft_type", "") or ""
    tail_number = flight.get("registration", "") or ""

    # Duration
    duration_min = calc_duration_minutes(dep_time, arr_time)

    # Progress percentage (0-100) for live tracker
    progress_pct = _calc_progress(flight, dep_time, arr_time)

    # Remaining time
    remaining_min = None
    if progress_pct is not None and duration_min:
        elapsed_min = int(duration_min * progress_pct / 100)
        remaining_min = max(0, duration_min - elapsed_min)

    return {
        "fa_flight_id": flight.get("fa_flight_id", ""),
        "flight_number": flight.get("ident", ""),
        "origin_airport": origin,
        "destination_airport": destination,
        "departure_time": dep_time,
        "arrival_time": arr_time,
        "duration_minutes": duration_min,
        "aircraft_model": aircraft_type,
        "tail_number": tail_number,
        "status": flight.get("status", ""),
        "progress_percent": progress_pct,
        "remaining_minutes": remaining_min,
        "gate_origin": flight.get("origin", {}).get("gate", ""),
        "gate_destination": flight.get("destination", {}).get("gate", ""),
        "altitude": flight.get("last_position", {}).get("altitude"),
        "groundspeed": flight.get("last_position", {}).get("groundspeed"),
    }


def calc_duration_minutes(dep_time: str, arr_time: str) -> Optional[int]:
    """
    Convert two ISO8601 timestamp strings to duration in minutes.
    Returns None if either timestamp is missing or unparseable.
    """
    if not dep_time or not arr_time:
        return None
    try:
        dep = _parse_iso(dep_time)
        arr = _parse_iso(arr_time)
        if dep and arr and arr > dep:
            return int((arr - dep).total_seconds() / 60)
    except Exception:
        pass
    return None


def _parse_iso(ts: str) -> Optional[datetime]:
    """Parse ISO8601 string to timezone-aware datetime."""
    if not ts:
        return None
    # Handle Z suffix
    ts = ts.replace("Z", "+00:00")
    try:
        return datetime.fromisoformat(ts)
    except ValueError:
        # Try stripping fractional seconds
        try:
            ts = ts[:19] + ts[19:].split(".")[0] if "." in ts else ts
            return datetime.fromisoformat(ts)
        except Exception:
            return None


def _extract_airport_code(airport_obj: dict) -> str:
    """Extract the best available airport code from AeroAPI airport object."""
    if not airport_obj:
        return ""
    # Prefer ICAO, then IATA, then generic code
    return (
        airport_obj.get("code_icao")
        or airport_obj.get("code_iata")
        or airport_obj.get("code")
        or airport_obj.get("iata")
        or ""
    )


def _calc_progress(flight: dict, dep_time: str, arr_time: str) -> Optional[float]:
    """
    Calculate flight progress as a percentage (0.0 - 100.0).
    Uses scheduled times if actual times are not available.
    """
    status = flight.get("status", "").lower()
    if "arrived" in status or "landed" in status:
        return 100.0
    if "scheduled" in status or "filed" in status:
        return 0.0

    # Try time-based calculation
    dep = _parse_iso(dep_time)
    arr = _parse_iso(arr_time)

    if dep and arr:
        total = (arr - dep).total_seconds()
        if total <= 0:
            return None
        now = datetime.now(timezone.utc)
        elapsed = (now - dep).total_seconds()
        pct = (elapsed / total) * 100.0
        return round(max(0.0, min(100.0, pct)), 1)

    return None
