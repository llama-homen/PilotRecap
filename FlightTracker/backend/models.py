"""
Pydantic models for request/response validation.
"""
from pydantic import BaseModel
from typing import Optional


class FlightRecord(BaseModel):
    fa_flight_id: Optional[str] = None
    flight_number: str
    origin_airport: str
    destination_airport: str
    departure_time: Optional[str] = None
    arrival_time: Optional[str] = None
    duration_minutes: Optional[int] = None
    aircraft_model: Optional[str] = None
    tail_number: Optional[str] = None


class ManualFlightInput(BaseModel):
    flight_number: str
    origin_airport: str
    destination_airport: str
    aircraft_model: Optional[str] = None
    tail_number: Optional[str] = None
    departure_time: Optional[str] = None   # ISO8601 or human-readable
    arrival_time: Optional[str] = None
    duration_minutes: Optional[int] = None  # If provided directly


class LiveFlightQuery(BaseModel):
    flight_number: str


class AnalyticsResponse(BaseModel):
    airports: list
    aircraft_models: list
    flight_regions: list


class MilestonesResponse(BaseModel):
    favorite_airport: Optional[str] = None
    favorite_model: Optional[str] = None
    favorite_route: Optional[str] = None
    fastest_flight: Optional[str] = None
    fastest_origin: Optional[str] = None
    fastest_dest: Optional[str] = None
    fastest_model: Optional[str] = None
    longest_flight: Optional[str] = None
    longest_origin: Optional[str] = None
    longest_dest: Optional[str] = None
    longest_model: Optional[str] = None


class RoutePerformanceResponse(BaseModel):
    flight_number: str
    avg_duration_minutes: Optional[float] = None
    fastest_duration_minutes: Optional[int] = None
    aircraft_models: list[str] = []
    total_records: int = 0
