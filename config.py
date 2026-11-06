import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # Credentials
    AUBURN_USERNAME = os.getenv("AUBURN_USERNAME", "")
    AUBURN_PASSWORD = os.getenv("AUBURN_PASSWORD", "")

    # Course settings
    COURSES = [
        c.strip()
        for c in os.getenv("COURSES", "ELEC 2200,MATH 2660").split(",")
        if c.strip()
    ]
    CHECK_INTERVAL = int(os.getenv("CHECK_INTERVAL", "60"))
    # TigerSchedule term code, from the data-term attribute on the term picker
    # "or": a blank value (an unset GitHub Actions variable) still gets the default
    TERM_CODE = os.getenv("TERM_CODE") or "202720"

    # Email notifications
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SENDER_EMAIL = os.getenv("SENDER_EMAIL", "")
    SENDER_PASSWORD = os.getenv("SENDER_PASSWORD", "")
    RECIPIENT_EMAIL = os.getenv("RECIPIENT_EMAIL", "")
    EMAIL_NOTIFICATIONS_ENABLED = os.getenv(
        "EMAIL_NOTIFICATIONS_ENABLED", "false"
    ).lower() == "true"

    # Alert-only seat watcher (watch.py)
    WATCH_CRNS = [c.strip() for c in os.getenv("WATCH_CRNS", "").split(",") if c.strip()]
    WATCH_MIN_MINUTES = float(os.getenv("WATCH_MIN_MINUTES", "5"))
    WATCH_MAX_MINUTES = float(os.getenv("WATCH_MAX_MINUTES", "15"))
    QUIET_HOURS = os.getenv("QUIET_HOURS", "23-7")
    WATCH_UNTIL = os.getenv("WATCH_UNTIL", "")
    NTFY_TOPIC = os.getenv("NTFY_TOPIC", "")
    NTFY_SERVER = os.getenv("NTFY_SERVER", "https://ntfy.sh")
    # Where --check keeps seats from the last run, so each opening alerts once
    WATCH_STATE = os.getenv("WATCH_STATE") or "logs/watch-state.json"

    # Browser settings
    HEADLESS = os.getenv("HEADLESS", "false").lower() == "true"

    # URLs
    URL = "https://tigerschedule.auburn.edu/"
    LOGIN_URL = (
        "https://authenticate.auburn.edu/cas/login"
        "?service=https%3A%2F%2Ftigerschedule.auburn.edu%2Fvsb%2Fcriteria.jsp"
    )

    # Seconds to wait for login to finish (includes approving Duo)
    LOGIN_TIMEOUT = int(os.getenv("LOGIN_TIMEOUT", "180"))
