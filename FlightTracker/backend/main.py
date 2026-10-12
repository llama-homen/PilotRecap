"""
FastAPI main application — Pilot Dashboard Backend.
Run with: uvicorn main:app --reload --port 8000
The frontend is served at http://localhost:8000 via StaticFiles.
"""
import os
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from contextlib import asynccontextmanager
from typing import Optional
import httpx

from database import (
    init_db, insert_flight, get_all_flights, get_analytics,
    get_milestones, get_route_performance, get_available_dates
)
from aeroapi import get_live_flight, parse_flight_record, calc_duration_minutes
from models import ManualFlightInput, FlightRecord

# Resolve frontend directory relative to this file
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
FRONTEND_DIR = os.path.abspath(FRONTEND_DIR)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize the database on startup."""
    await init_db()
    yield


app = FastAPI(
    title="Pilot Dashboard API",
    description="Backend for the Pilot Dashboard — flight tracking, history, and analytics.",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow the frontend to call the API from any local origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────
# LIVE FLIGHT
# ─────────────────────────────────────────────

@app.get("/api/live-flight/{flight_number}")
async def track_live_flight(flight_number: str, save: bool = False):
    """
    Fetch real-time data for a flight number from FlightAware AeroAPI.
    Optionally save the flight to history (save=true).
    """
    try:
        data = await get_live_flight(flight_number)
    except ValueError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 401:
            raise HTTPException(status_code=401, detail="Invalid AeroAPI key.")
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail=f"Flight '{flight_number}' not found.")
        raise HTTPException(status_code=502, detail=f"AeroAPI error: {e.response.status_code}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=503, detail=f"Network error reaching AeroAPI: {str(e)}")

    if not data:
        raise HTTPException(status_code=404, detail=f"No data found for flight '{flight_number}'.")

    if save and data.get("fa_flight_id"):
        await insert_flight(data)

    return data


# ─────────────────────────────────────────────
# MANUAL FLIGHT LOGGING
# ─────────────────────────────────────────────

@app.post("/api/log-flight", status_code=status.HTTP_201_CREATED)
async def log_manual_flight(payload: ManualFlightInput):
    """
    Manually log a past flight record into the database.
    Automatically calculates duration_minutes if departure_time and
    arrival_time are both provided and duration is not given.
    """
    record = payload.model_dump()

    # Auto-calculate duration if not provided
    if not record.get("duration_minutes") and record.get("departure_time") and record.get("arrival_time"):
        dur = calc_duration_minutes(record["departure_time"], record["arrival_time"])
        record["duration_minutes"] = dur

    # Generate a pseudo fa_flight_id for manual entries to prevent duplicates
    if not record.get("fa_flight_id"):
        import hashlib, json
        key_str = f"{record['flight_number']}|{record.get('departure_time', '')}|{record['origin_airport']}|{record['destination_airport']}"
        record["fa_flight_id"] = "MANUAL-" + hashlib.md5(key_str.encode()).hexdigest()[:12]

    result = await insert_flight(record)
    if not result["inserted"]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A flight with this identifier already exists in the database."
        )
    return {"status": "logged", "id": result["id"], "fa_flight_id": record["fa_flight_id"]}


# ─────────────────────────────────────────────
# ANALYTICS
# ─────────────────────────────────────────────

@app.get("/api/analytics")
async def get_chart_analytics(year: Optional[int] = None, month: Optional[int] = None):
    """Returns aggregated data for the 3 donut charts with optional date filter."""
    return await get_analytics(year=year, month=month)


# ─────────────────────────────────────────────
# MILESTONES
# ─────────────────────────────────────────────

@app.get("/api/milestones")
async def get_milestone_cards(year: Optional[int] = None, month: Optional[int] = None):
    """Returns computed values for the milestone cards with optional date filter."""
    return await get_milestones(year=year, month=month)


# ─────────────────────────────────────────────
# AVAILABLE DATES FOR FILTERING
# ─────────────────────────────────────────────

@app.get("/api/available-dates")
async def fetch_available_dates():
    """Returns list of years and months with flight records."""
    return await get_available_dates()


# ─────────────────────────────────────────────
# ROUTE PERFORMANCE
# ─────────────────────────────────────────────

@app.get("/api/route-performance/{flight_number}")
async def fetch_route_performance(flight_number: str):
    """Returns past performance stats for a given flight number."""
    return await get_route_performance(flight_number)


# ─────────────────────────────────────────────
# ALL FLIGHTS
# ─────────────────────────────────────────────

@app.get("/api/flights")
async def list_all_flights():
    """Returns all logged flights ordered by departure time."""
    return await get_all_flights()


# ─────────────────────────────────────────────
# HEALTH CHECK
# ─────────────────────────────────────────────

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "Pilot Dashboard API"}


# ─────────────────────────────────────────────
# SERVE FRONTEND — must come LAST
# ─────────────────────────────────────────────

# Mount static files (CSS, JS, images) under /static
app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")

# Catch-all: serve index.html for the root and any non-API route
@app.get("/")
async def serve_index():
    """Serve the Pilot Dashboard SPA at the root URL."""
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    return FileResponse(index_path, media_type="text/html")

@app.get("/{full_path:path}")
async def serve_spa(full_path: str):
    """
    Fallback route — serves static files by path, or index.html for unknown routes.
    This allows direct linking to SPA routes without 404s.
    """
    # Don't intercept API routes (they're registered above and matched first)
    target = os.path.join(FRONTEND_DIR, full_path)
    if os.path.isfile(target):
        return FileResponse(target)
    # Fall back to index.html for SPA client-side routing
    return FileResponse(os.path.join(FRONTEND_DIR, "index.html"), media_type="text/html")
