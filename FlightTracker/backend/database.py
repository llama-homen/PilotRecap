"""
SQLite database layer for Pilot Dashboard.
Handles table initialization and all query operations.
"""
import aiosqlite
import os
from typing import Optional

DB_PATH = os.path.join(os.path.dirname(__file__), "pilot_dashboard.db")


async def init_db():
    """Create the flights_history table if it doesn't exist."""
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS flights_history (
                id                  INTEGER PRIMARY KEY AUTOINCREMENT,
                fa_flight_id        TEXT UNIQUE,
                flight_number       TEXT NOT NULL,
                origin_airport      TEXT NOT NULL,
                destination_airport TEXT NOT NULL,
                departure_time      TEXT,
                arrival_time        TEXT,
                duration_minutes    INTEGER,
                aircraft_model      TEXT,
                tail_number         TEXT
            )
        """)
        # Auto-seed sample flights if table is empty
        cursor = await db.execute("SELECT COUNT(*) FROM flights_history")
        count_row = await cursor.fetchone()
        if count_row and count_row[0] == 0:
            sample_flights = [
                ("SEED-01", "DAL2106", "KORD", "KJFK", "2026-05-10T14:00:00Z", "2026-05-10T16:18:00Z", 138, "B738", "N3743H"),
                ("SEED-02", "DAL2106", "KORD", "KJFK", "2026-05-12T14:10:00Z", "2026-05-12T16:32:00Z", 142, "B738", "N3819A"),
                ("SEED-03", "DAL2106", "KORD", "KJFK", "2026-05-14T14:05:00Z", "2026-05-14T16:30:00Z", 145, "A320", "N294DN"),
                ("SEED-04", "DAL2106", "KORD", "KJFK", "2026-05-18T14:00:00Z", "2026-05-18T16:22:00Z", 142, "B77W", "N701DN"),
                ("SEED-05", "UAL442",  "KORD", "KLAX", "2026-05-15T09:30:00Z", "2026-05-15T13:45:00Z", 255, "B738", "N77261"),
                ("SEED-06", "AAL102",  "KDFW", "KMIA", "2026-05-16T11:00:00Z", "2026-05-16T13:40:00Z", 160, "B738", "N912AA"),
                ("SEED-07", "SWA890",  "KMDW", "KBOS", "2026-05-17T08:15:00Z", "2026-05-17T10:25:00Z", 130, "B737", "N482WN"),
                ("SEED-08", "DAL15",   "KJFK", "EGLL", "2026-05-20T19:00:00Z", "2026-05-21T01:50:00Z", 410, "A359", "N502DN"),
                ("SEED-09", "DAL401",  "KATL", "KMCO", "2026-05-21T16:00:00Z", "2026-05-21T16:58:00Z", 58,  "A321", "N301DN"),
                ("SEED-10", "UAL210",  "KORD", "KDEN", "2026-05-22T13:10:00Z", "2026-05-22T15:40:00Z", 150, "B738", "N37255"),
            ]
            await db.executemany("""
                INSERT OR IGNORE INTO flights_history
                    (fa_flight_id, flight_number, origin_airport, destination_airport,
                     departure_time, arrival_time, duration_minutes, aircraft_model, tail_number)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, sample_flights)
            await db.commit()


async def insert_flight(record: dict) -> dict:
    """
    Insert a flight record. Uses INSERT OR IGNORE to prevent duplicates
    based on fa_flight_id UNIQUE constraint.
    Returns {'inserted': True/False, 'id': row_id_or_none}
    """
    async with aiosqlite.connect(DB_PATH) as db:
        cursor = await db.execute("""
            INSERT OR IGNORE INTO flights_history
                (fa_flight_id, flight_number, origin_airport, destination_airport,
                 departure_time, arrival_time, duration_minutes, aircraft_model, tail_number)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            record.get("fa_flight_id"),
            record.get("flight_number"),
            record.get("origin_airport"),
            record.get("destination_airport"),
            record.get("departure_time"),
            record.get("arrival_time"),
            record.get("duration_minutes"),
            record.get("aircraft_model"),
            record.get("tail_number"),
        ))
        await db.commit()
        inserted = cursor.rowcount > 0
        return {"inserted": inserted, "id": cursor.lastrowid if inserted else None}


async def get_all_flights() -> list[dict]:
    """Return all flights ordered by most recent departure."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT * FROM flights_history
            ORDER BY departure_time DESC
        """) as cursor:
            rows = await cursor.fetchall()
            return [dict(r) for r in rows]


def _date_clause(year: Optional[int], month: Optional[int]) -> tuple[str, list]:
    """Helper to build WHERE condition and query params for departure_time filtering."""
    conditions = []
    params = []
    if year:
        if month:
            conditions.append("departure_time LIKE ?")
            params.append(f"{year:04d}-{month:02d}%")
        else:
            conditions.append("departure_time LIKE ?")
            params.append(f"{year:04d}%")
    return (" AND " + " AND ".join(conditions)) if conditions else "", params


AIRPORT_COUNTRY_MAP = {
    # United States
    "KORD": "United States", "ORD": "United States",
    "KJFK": "United States", "JFK": "United States",
    "KLAX": "United States", "LAX": "United States",
    "KATL": "United States", "ATL": "United States",
    "KDFW": "United States", "DFW": "United States",
    "KDEN": "United States", "DEN": "United States",
    "KMCO": "United States", "MCO": "United States",
    "KMIA": "United States", "MIA": "United States",
    "KBOS": "United States", "BOS": "United States",
    "KMDW": "United States", "MDW": "United States",
    "KSFO": "United States", "SFO": "United States",
    "KSEA": "United States", "SEA": "United States",
    "KLAS": "United States", "LAS": "United States",
    "KEWR": "United States", "EWR": "United States",
    "KCLT": "United States", "CLT": "United States",
    "KPHX": "United States", "PHX": "United States",
    "KIAH": "United States", "IAH": "United States",
    "KMSP": "United States", "MSP": "United States",
    "KDTW": "United States", "DTW": "United States",
    "PHNL": "United States", "HNL": "United States",
    "PANC": "United States", "ANC": "United States",
    # United Kingdom
    "EGLL": "United Kingdom", "LHR": "United Kingdom",
    "EGKK": "United Kingdom", "LGW": "United Kingdom",
    "EGSS": "United Kingdom", "STN": "United Kingdom",
    "EGCC": "United Kingdom", "MAN": "United Kingdom",
    "EGPH": "United Kingdom", "EDI": "United Kingdom",
    # Canada
    "CYYZ": "Canada", "YYZ": "Canada",
    "CYVR": "Canada", "YVR": "Canada",
    "CYUL": "Canada", "YUL": "Canada",
    "CYYC": "Canada", "YYC": "Canada",
    # France
    "LFPG": "France", "CDG": "France",
    "LFPO": "France", "ORY": "France",
    "LFMN": "France", "NCE": "France",
    # Germany
    "EDDF": "Germany", "FRA": "Germany",
    "EDDM": "Germany", "MUC": "Germany",
    "EDDB": "Germany", "BER": "Germany",
    # Netherlands
    "EHAM": "Netherlands", "AMS": "Netherlands",
    # Spain
    "LEMD": "Spain", "MAD": "Spain",
    "LEBL": "Spain", "BCN": "Spain",
    # Italy
    "LIRF": "Italy", "FCO": "Italy",
    "LIMC": "Italy", "MXP": "Italy",
    # Japan
    "RJTT": "Japan", "HND": "Japan",
    "RJAA": "Japan", "NRT": "Japan",
    "RJBB": "Japan", "KIX": "Japan",
    # Australia
    "YSSY": "Australia", "SYD": "Australia",
    "YMML": "Australia", "MEL": "Australia",
    # Mexico
    "MMMX": "Mexico", "MEX": "Mexico",
    "MMUN": "Mexico", "CUN": "Mexico",
    # UAE
    "OMDB": "UAE", "DXB": "UAE",
    "OMAA": "UAE", "AUH": "UAE",
    # Singapore
    "WSSS": "Singapore", "SIN": "Singapore",
    # Switzerland
    "LSZH": "Switzerland", "ZRH": "Switzerland",
    "LSGG": "Switzerland", "GVA": "Switzerland",
    # Ireland
    "EIDW": "Ireland", "DUB": "Ireland",
}

def airport_to_country(code: str) -> str:
    if not code:
        return "Other"
    code = code.strip().upper()
    if code in AIRPORT_COUNTRY_MAP:
        return AIRPORT_COUNTRY_MAP[code]
    
    # 4-letter ICAO prefix heuristics
    if len(code) == 4:
        if code.startswith("K") or code.startswith("PH") or code.startswith("PA"):
            return "United States"
        elif code.startswith("C"):
            return "Canada"
        elif code.startswith("EG"):
            return "United Kingdom"
        elif code.startswith("LF"):
            return "France"
        elif code.startswith("ED") or code.startswith("ET"):
            return "Germany"
        elif code.startswith("LE"):
            return "Spain"
        elif code.startswith("LI"):
            return "Italy"
        elif code.startswith("EH"):
            return "Netherlands"
        elif code.startswith("EB"):
            return "Belgium"
        elif code.startswith("LS"):
            return "Switzerland"
        elif code.startswith("EI"):
            return "Ireland"
        elif code.startswith("EK"):
            return "Denmark"
        elif code.startswith("EN"):
            return "Norway"
        elif code.startswith("ES"):
            return "Sweden"
        elif code.startswith("EF"):
            return "Finland"
        elif code.startswith("EP"):
            return "Poland"
        elif code.startswith("LOW"):
            return "Austria"
        elif code.startswith("LP"):
            return "Portugal"
        elif code.startswith("LG"):
            return "Greece"
        elif code.startswith("LT"):
            return "Turkey"
        elif code.startswith("RJ") or code.startswith("RO"):
            return "Japan"
        elif code.startswith("RK"):
            return "South Korea"
        elif code.startswith("Z"):
            return "China"
        elif code.startswith("V"):
            return "India"
        elif code.startswith("VT"):
            return "Thailand"
        elif code.startswith("W"):
            return "Singapore"
        elif code.startswith("Y"):
            return "Australia"
        elif code.startswith("NZ"):
            return "New Zealand"
        elif code.startswith("MM"):
            return "Mexico"
        elif code.startswith("SB") or code.startswith("SD"):
            return "Brazil"
        elif code.startswith("SA"):
            return "Argentina"
        elif code.startswith("OM"):
            return "UAE"
    elif len(code) == 3:
        return "United States"
    return "Other"


async def get_analytics(year: Optional[int] = None, month: Optional[int] = None) -> dict:
    """
    Returns aggregated data for the 3 donut charts filtered by optional year and month:
    - airports: top airports by visit count
    - aircraft_models: aircraft types and frequencies
    - flight_regions: countries breakdown by flight destination
    """
    where_extra, params = _date_clause(year, month)

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # --- Airports visited (combining origin + destination) ---
        async with db.execute(f"""
            SELECT airport, COUNT(*) as count FROM (
                SELECT origin_airport as airport FROM flights_history WHERE 1=1 {where_extra}
                UNION ALL
                SELECT destination_airport as airport FROM flights_history WHERE 1=1 {where_extra}
            ) GROUP BY airport ORDER BY count DESC LIMIT 10
        """, params + params) as cursor:
            airport_rows = await cursor.fetchall()
            airports = [{"label": r["airport"], "value": r["count"]} for r in airport_rows]

        # --- Aircraft models ---
        async with db.execute(f"""
            SELECT aircraft_model, COUNT(*) as count
            FROM flights_history
            WHERE aircraft_model IS NOT NULL AND aircraft_model != '' {where_extra}
            GROUP BY aircraft_model
            ORDER BY count DESC
        """, params) as cursor:
            model_rows = await cursor.fetchall()
            aircraft_models = [{"label": r["aircraft_model"], "value": r["count"]} for r in model_rows]

        # --- Countries flown ---
        async with db.execute(f"""
            SELECT origin_airport, destination_airport FROM flights_history WHERE 1=1 {where_extra}
        """, params) as cursor:
            flight_rows = await cursor.fetchall()

        country_counts = {}
        for row in flight_rows:
            dest_code = (row["destination_airport"] or "").upper()
            country = airport_to_country(dest_code)
            country_counts[country] = country_counts.get(country, 0) + 1

        flight_regions = [
            {"label": country, "value": count}
            for country, count in sorted(country_counts.items(), key=lambda x: x[1], reverse=True)
        ]

        return {
            "airports": airports,
            "aircraft_models": aircraft_models,
            "flight_regions": flight_regions,
        }


async def get_milestones(year: Optional[int] = None, month: Optional[int] = None) -> dict:
    """Returns computed values for the milestone cards with optional date filter."""
    where_extra, params = _date_clause(year, month)

    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        # Favorite airport (most frequent across origin+destination)
        async with db.execute(f"""
            SELECT airport, COUNT(*) as cnt FROM (
                SELECT origin_airport as airport FROM flights_history WHERE 1=1 {where_extra}
                UNION ALL
                SELECT destination_airport as airport FROM flights_history WHERE 1=1 {where_extra}
            ) GROUP BY airport ORDER BY cnt DESC LIMIT 1
        """, params + params) as cursor:
            row = await cursor.fetchone()
            favorite_airport = row["airport"] if row else None

        # Favorite aircraft model
        async with db.execute(f"""
            SELECT aircraft_model, COUNT(*) as cnt
            FROM flights_history
            WHERE aircraft_model IS NOT NULL AND aircraft_model != '' {where_extra}
            GROUP BY aircraft_model ORDER BY cnt DESC LIMIT 1
        """, params) as cursor:
            row = await cursor.fetchone()
            favorite_model = row["aircraft_model"] if row else None

        # Favorite route (origin+destination pair)
        async with db.execute(f"""
            SELECT origin_airport, destination_airport, COUNT(*) as cnt
            FROM flights_history
            WHERE 1=1 {where_extra}
            GROUP BY origin_airport, destination_airport
            ORDER BY cnt DESC LIMIT 1
        """, params) as cursor:
            row = await cursor.fetchone()
            favorite_route = f"{row['origin_airport']} → {row['destination_airport']}" if row else None

        # Fastest flight (minimum duration_minutes with duration > 0)
        async with db.execute(f"""
            SELECT duration_minutes, origin_airport, destination_airport, aircraft_model
            FROM flights_history
            WHERE duration_minutes IS NOT NULL AND duration_minutes > 0 {where_extra}
            ORDER BY duration_minutes ASC LIMIT 1
        """, params) as cursor:
            row = await cursor.fetchone()
            fastest_flight = _fmt_duration(row["duration_minutes"]) if row else None
            fastest_origin = row["origin_airport"] if row else None
            fastest_dest = row["destination_airport"] if row else None
            fastest_model = row["aircraft_model"] if row else None

        # Longest flight
        async with db.execute(f"""
            SELECT duration_minutes, origin_airport, destination_airport, aircraft_model
            FROM flights_history
            WHERE duration_minutes IS NOT NULL AND duration_minutes > 0 {where_extra}
            ORDER BY duration_minutes DESC LIMIT 1
        """, params) as cursor:
            row = await cursor.fetchone()
            longest_flight = _fmt_duration(row["duration_minutes"]) if row else None
            longest_origin = row["origin_airport"] if row else None
            longest_dest = row["destination_airport"] if row else None
            longest_model = row["aircraft_model"] if row else None

        return {
            "favorite_airport": favorite_airport,
            "favorite_model": favorite_model,
            "favorite_route": favorite_route,
            "fastest_flight": fastest_flight,
            "fastest_origin": fastest_origin,
            "fastest_dest": fastest_dest,
            "fastest_model": fastest_model,
            "longest_flight": longest_flight,
            "longest_origin": longest_origin,
            "longest_dest": longest_dest,
            "longest_model": longest_model,
        }


async def get_available_dates() -> dict:
    """Returns available years and months from recorded flight departure dates."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute("""
            SELECT DISTINCT
                substr(departure_time, 1, 4) as yr,
                substr(departure_time, 6, 2) as mo
            FROM flights_history
            WHERE departure_time IS NOT NULL AND length(departure_time) >= 7
            ORDER BY yr DESC, mo ASC
        """) as cursor:
            rows = await cursor.fetchall()
            years = sorted(list(set(int(r["yr"]) for r in rows if r["yr"] and r["yr"].isdigit())), reverse=True)
            months = [{"year": int(r["yr"]), "month": int(r["mo"])} for r in rows if r["yr"] and r["yr"].isdigit() and r["mo"] and r["mo"].isdigit()]
            return {"years": years, "months": months}


async def get_route_performance(flight_number: str) -> dict:
    """Returns performance stats for a given flight number."""
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row

        async with db.execute("""
            SELECT
                COUNT(*) as total,
                AVG(CASE WHEN duration_minutes > 0 THEN duration_minutes END) as avg_dur,
                MIN(CASE WHEN duration_minutes > 0 THEN duration_minutes END) as min_dur
            FROM flights_history
            WHERE UPPER(flight_number) = UPPER(?)
        """, (flight_number,)) as cursor:
            row = await cursor.fetchone()
            total = row["total"] if row else 0
            avg_dur = row["avg_dur"] if row else None
            min_dur = row["min_dur"] if row else None

        async with db.execute("""
            SELECT DISTINCT aircraft_model FROM flights_history
            WHERE UPPER(flight_number) = UPPER(?)
              AND aircraft_model IS NOT NULL AND aircraft_model != ''
        """, (flight_number,)) as cursor:
            model_rows = await cursor.fetchall()
            models = [r["aircraft_model"] for r in model_rows]

        return {
            "flight_number": flight_number.upper(),
            "avg_duration_minutes": round(avg_dur, 1) if avg_dur else None,
            "fastest_duration_minutes": min_dur,
            "aircraft_models": models,
            "total_records": total,
        }


def _fmt_duration(minutes: Optional[int]) -> str:
    """Convert integer minutes to human-readable string like '2h 35m'."""
    if minutes is None:
        return "N/A"
    h = minutes // 60
    m = minutes % 60
    if h > 0:
        return f"{h}h {m:02d}m"
    return f"{m}m"
