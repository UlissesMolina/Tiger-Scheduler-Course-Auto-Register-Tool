import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import Config

logger = logging.getLogger(__name__)


def send_email_alert(course_name, status):
    """Send an email alert about course availability changes.

    Args:
        course_name: Name of the course (e.g., "MATH 2660")
        status: Status message (e.g., "OPEN", "Registration succeeded", "Registration failed")
    """
    if not Config.EMAIL_NOTIFICATIONS_ENABLED:
        return

    if not all([Config.SENDER_EMAIL, Config.SENDER_PASSWORD, Config.RECIPIENT_EMAIL]):
        logger.warning("Email notification skipped: missing email configuration")
        return

    subject = f"Course Alert: {course_name} - {status}"
    body = (
        f"Course: {course_name}\n"
        f"Status: {status}\n\n"
        f"This is an automated alert from Course Auto-Register."
    )

    msg = MIMEMultipart()
    msg["From"] = Config.SENDER_EMAIL
    msg["To"] = Config.RECIPIENT_EMAIL
    msg["Subject"] = subject
    msg.attach(MIMEText(body, "plain"))

    try:
        with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT) as server:
            server.starttls()
            server.login(Config.SENDER_EMAIL, Config.SENDER_PASSWORD)
            server.send_message(msg)
        logger.info(f"Email alert sent for {course_name}: {status}")
    except Exception as e:
        logger.error(f"Failed to send email alert: {e}")
