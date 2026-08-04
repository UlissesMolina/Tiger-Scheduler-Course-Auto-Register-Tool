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

    # Email notifications
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SENDER_EMAIL = os.getenv("SENDER_EMAIL", "")
    SENDER_PASSWORD = os.getenv("SENDER_PASSWORD", "")
    RECIPIENT_EMAIL = os.getenv("RECIPIENT_EMAIL", "")
    EMAIL_NOTIFICATIONS_ENABLED = os.getenv(
        "EMAIL_NOTIFICATIONS_ENABLED", "false"
    ).lower() == "true"

    # Browser settings
    HEADLESS = os.getenv("HEADLESS", "false").lower() == "true"

    # URLs
    URL = "https://tigerschedule.auburn.edu/"
    LOGIN_URL = (
        "https://authenticate.auburn.edu/cas/login"
        "?service=https%3A%2F%2Ftigerschedule.auburn.edu%2Fvsb%2Fcriteria.jsp"
    )

    # Timeouts
    SESSION_TIMEOUT = 3600
    LOGIN_CHECK_INTERVAL = 1800
