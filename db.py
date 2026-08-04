import sqlite3
import os
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DB_PATH = os.path.join(DB_DIR, "course_history.db")


def init_db():
    """Create the database and checks table if they don't exist."""
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS checks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            course_name TEXT NOT NULL,
            section TEXT,
            status TEXT NOT NULL,
            seats_info TEXT
        )
        """
    )
    conn.commit()
    conn.close()
    logger.info(f"Database initialized at {DB_PATH}")


def log_check(course_name, section, status, seats_info=None):
    """Log a course status check to the database.

    Args:
        course_name: Name of the course (e.g., "MATH 2660")
        section: Section identifier or time info
        status: "FULL" or "OPEN"
        seats_info: Optional additional info about seats
    """
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        "INSERT INTO checks (timestamp, course_name, section, status, seats_info) "
        "VALUES (?, ?, ?, ?, ?)",
        (datetime.now().isoformat(), course_name, section, status, seats_info),
    )
    conn.commit()
    conn.close()


def get_history(course_name=None, limit=50):
    """Query recent check history.

    Args:
        course_name: Filter by course name (optional)
        limit: Maximum number of results to return
    Returns:
        List of tuples (id, timestamp, course_name, section, status, seats_info)
    """
    conn = sqlite3.connect(DB_PATH)
    if course_name:
        rows = conn.execute(
            "SELECT * FROM checks WHERE course_name = ? ORDER BY id DESC LIMIT ?",
            (course_name, limit),
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM checks ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
    conn.close()
    return rows
