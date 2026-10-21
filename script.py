from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException
import argparse
import time
import os
import logging
import sys
from datetime import datetime

from config import Config
from db import init_db, log_check
from notifier import send_email_alert

# === LOGGING SETUP ===
os.makedirs('logs', exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/course_monitor.log'),
        logging.StreamHandler(sys.stdout)
    ]
)


def log_and_print(message, level=logging.INFO):
    """Log a message (the StreamHandler also prints it to the console)."""
    logging.log(level, message)


def load_saved_favorites(driver):
    """Load saved favorites."""
    try:
        log_and_print("[FAVORITES] Loading saved favorites...")

        favorites_button = WebDriverWait(driver, 30).until(
            EC.element_to_be_clickable((By.ID, "page_favorites_expander"))
        )
        favorites_button.click()

        favorite_schedule = WebDriverWait(driver, 30).until(
            EC.element_to_be_clickable((By.ID, "thumbtest1_0"))
        )
        favorite_schedule.click()

        load_button = WebDriverWait(driver, 30).until(
            EC.element_to_be_clickable((By.CLASS_NAME, "load_button"))
        )
        load_button.click()

        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.ID, "legend_box"))
        )

        log_and_print("[SUCCESS] Successfully loaded saved favorites!")
        return True
    except Exception as e:
        log_and_print(f"[WARNING] Failed to load favorites: {str(e)}")
        return False


def select_term(driver, term_code):
    """Select the configured semester on the term selection page."""
    try:
        log_and_print(f"[SEMESTER] Selecting term {term_code}...")

        term_link = WebDriverWait(driver, 30).until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, f"div[data-term='{term_code}'] a"))
        )
        term_link.click()

        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.ID, "legend_box"))
        )

        log_and_print(f"[SUCCESS] Successfully selected term {term_code}!")
        return True
    except Exception as e:
        log_and_print(f"[WARNING] Failed to select term {term_code}: {str(e)}")
        return False


def login(driver):
    """Log in to the Auburn system."""
    max_retries = 3
    retry_count = 0

    while retry_count < max_retries:
        try:
            log_and_print("[LOGIN] Attempting to log in...")

            driver.get(Config.LOGIN_URL)

            WebDriverWait(driver, 60).until(
                EC.presence_of_element_located((By.ID, "username"))
            )

            username_field = driver.find_element(By.ID, "username")
            password_field = driver.find_element(By.ID, "password")

            username_field.send_keys(Config.AUBURN_USERNAME)
            password_field.send_keys(Config.AUBURN_PASSWORD)

            login_button = driver.find_element(By.NAME, "submit")
            login_button.click()

            # The login redirects through Duo first, so wait until we're actually back on TigerSchedule
            log_and_print(f"[LOGIN] Approve the Duo prompt if asked (waiting up to {Config.LOGIN_TIMEOUT}s)...")
            WebDriverWait(driver, Config.LOGIN_TIMEOUT).until(
                lambda d: d.current_url.startswith(Config.URL)
            )

            log_and_print("[SUCCESS] Successfully logged in!")

            if select_term(driver, Config.TERM_CODE):
                if load_saved_favorites(driver):
                    return True
            return False

        except TimeoutException:
            retry_count += 1
            log_and_print(f"[WARNING] Login attempt {retry_count} timed out. Retrying...")
            if retry_count < max_retries:
                time.sleep(5)
            else:
                log_and_print("[WARNING] Login failed after multiple attempts due to timeout")
                return False

        except Exception as e:
            log_and_print(f"[WARNING] Login failed: {str(e)}")
            return False

    return False


def is_logged_in(driver):
    try:
        WebDriverWait(driver, 5).until(
            EC.presence_of_element_located((By.ID, "legend_box"))
        )
        return True
    except TimeoutException:
        return False


def setup_driver(headless=False):
    """Set up and return a configured WebDriver instance."""
    try:
        options = webdriver.ChromeOptions()
        if headless:
            options.add_argument('--headless=new')
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--disable-gpu')
        options.add_argument('--window-size=1920,1080')

        # Selenium Manager (built into Selenium 4.6+) downloads a matching ChromeDriver
        driver = webdriver.Chrome(options=options)
        driver.set_page_load_timeout(300)
        return driver
    except Exception as e:
        logging.error(f"Failed to set up driver: {str(e)}")
        raise


def save_page_snapshot(driver, label):
    """Save the current page HTML to logs/ for inspecting what the site showed."""
    path = os.path.join('logs', f"{label}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.html")
    try:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(driver.page_source)
        log_and_print(f"Saved page snapshot to {path}")
    except Exception as e:
        log_and_print(f"[WARNING] Could not save page snapshot: {e}")


def attempt_registration(driver):
    """Submit the loaded schedule via "Get this Schedule" -> "Do Actions".

    Returns True if the submit buttons were clicked. This does NOT confirm the
    registration went through; check the saved page snapshot or TigerSchedule.
    """
    try:
        log_and_print("[ACTION] Attempting to register...")

        get_schedule_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CLASS_NAME, "button_get_schedule"))
        )
        get_schedule_button.click()

        do_actions_button = WebDriverWait(driver, 10).until(
            EC.element_to_be_clickable((By.CLASS_NAME, "button_do_actions"))
        )
        do_actions_button.click()

        # TODO: wait for TigerSchedule's result message and parse it once we know its selector
        time.sleep(5)
        save_page_snapshot(driver, "registration_result")
        log_and_print("[ACTION] Registration submitted; result not verified")
        return True
    except Exception as e:
        log_and_print(f"[WARNING] Registration failed: {e}")
        save_page_snapshot(driver, "registration_error")
        return False


def get_course_status(driver, course_name):
    """Return (status, time_info) for a course on the loaded schedule."""
    course_header = WebDriverWait(driver, 10).until(
        EC.presence_of_element_located((By.XPATH, f"//div[contains(@class, 'header_cell')]//h4[contains(@class, 'course_title') and contains(text(), '{course_name}')]"))
    )
    header_cell = course_header.find_element(By.XPATH, "./..")
    time_info = header_cell.find_element(By.ID, "hoursInLegend").text.strip()
    # TODO: match on a real "open" marker; anything not labeled "Full" is treated as open for now
    status = "FULL" if "Full" in header_cell.text else "OPEN"
    return status, time_info


def check_class_status(driver, courses, last_status, dry_run=False):
    """Check the status of monitored classes.

    Args:
        driver: Selenium WebDriver instance
        courses: List of course names to monitor
        last_status: Dict of (course, section) -> status from previous checks, updated in place
        dry_run: If True, check status without attempting registration
    Returns:
        False if the session looks broken and the caller should restart the browser.
    """
    max_retries = 3
    retry_count = 0

    while retry_count < max_retries:
        try:
            if not is_logged_in(driver):
                log_and_print("[WARNING] Schedule not loaded; session may have expired")
                return False

            WebDriverWait(driver, 30).until(
                EC.presence_of_element_located((By.CLASS_NAME, "timetable.table_container"))
            )

            for course_name in courses:
                try:
                    status, time_info = get_course_status(driver, course_name)

                    log_and_print(f"\n=== {course_name} Status ===")
                    log_and_print(f"Time: {time_info}: [{status}]")
                    log_check(course_name, time_info, status)

                    key = (course_name, time_info)
                    newly_open = status == "OPEN" and last_status.get(key) != "OPEN"
                    last_status[key] = status

                    if newly_open:
                        send_email_alert(course_name, f"OPEN - {time_info}")
                        if not dry_run:
                            if attempt_registration(driver):
                                send_email_alert(course_name, "Registration submitted - verify in TigerSchedule")
                            else:
                                send_email_alert(course_name, "Registration failed")
                        else:
                            log_and_print("[DRY RUN] Skipping registration attempt")

                except Exception as e:
                    log_and_print(f"Error checking course {course_name}: {str(e)}")

            log_and_print("\nRefreshing for next check...")
            driver.refresh()
            WebDriverWait(driver, 30).until(
                EC.presence_of_element_located((By.CLASS_NAME, "timetable.table_container"))
            )

            return True

        except TimeoutException:
            retry_count += 1
            log_and_print(f"Check attempt {retry_count} timed out. Retrying...")
            if retry_count < max_retries:
                time.sleep(5)
                try:
                    driver.refresh()
                except Exception:
                    return False
            else:
                log_and_print("Failed to check class status after multiple attempts")
                return False

        except Exception as e:
            log_and_print(f"Error during check: {str(e)}")
            return False

    return False


def parse_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Auburn University Course Auto-Register — monitors TigerScheduler for open seats and auto-registers."
    )
    parser.add_argument(
        "--courses",
        type=str,
        default=None,
        help='Comma-separated course list (e.g., "ELEC 2200,MATH 2660"). Overrides .env config.'
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=None,
        help="Check interval in seconds (default: 60). Overrides .env config."
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        default=None,
        help="Run browser in headless mode."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Check course status without attempting registration."
    )
    return parser.parse_args()


def main():
    """Main function to run the course monitoring script."""
    args = parse_args()

    # CLI args override .env config
    courses = [c.strip() for c in args.courses.split(",") if c.strip()] if args.courses else Config.COURSES
    interval = args.interval if args.interval is not None else Config.CHECK_INTERVAL
    headless = args.headless if args.headless else Config.HEADLESS
    dry_run = args.dry_run

    init_db()

    log_and_print("Starting course monitoring script...")
    log_and_print(f"Monitoring courses: {', '.join(courses)} | Term: {Config.TERM_CODE}")
    log_and_print(f"Check interval: {interval}s | Headless: {headless} | Dry run: {dry_run}")

    max_retries = 3
    retry_count = 0
    last_status = {}
    driver = None

    while retry_count < max_retries:
        try:
            driver = setup_driver(headless)
            if login(driver):
                retry_count = 0
                while True:
                    if not check_class_status(driver, courses, last_status, dry_run):
                        driver.quit()
                        driver = setup_driver(headless)
                        if not login(driver):
                            break
                    time.sleep(interval)
            # Login failed (initially or after a restart)
            retry_count += 1
            driver.quit()
            driver = None
            if retry_count < max_retries:
                time.sleep(5)

        except Exception as e:
            log_and_print(f"Error in main loop: {str(e)}")
            retry_count += 1
            if driver:
                try:
                    driver.quit()
                except Exception:
                    pass
                driver = None
            if retry_count < max_retries:
                time.sleep(5)

    log_and_print("Script stopped after multiple failures")

    if driver:
        try:
            driver.quit()
        except Exception:
            pass


if __name__ == "__main__":
    main()
