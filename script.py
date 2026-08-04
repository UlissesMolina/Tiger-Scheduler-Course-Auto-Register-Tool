import argparse
import logging
import os
import sys
import time
import traceback
from datetime import datetime, timedelta

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import WebDriverException, TimeoutException
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager

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
    """Helper function to both log and print messages"""
    message = message.replace('🔑', '[LOGIN]')
    message = message.replace('✅', '[SUCCESS]')
    message = message.replace('📅', '[SEMESTER]')
    message = message.replace('📋', '[FAVORITES]')
    message = message.replace('📚', '[COURSE]')
    message = message.replace('⚠️', '[WARNING]')
    message = message.replace('🔄', '[ACTION]')
    logging.log(level, message)
    print(message)


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


def select_fall_2025(driver):
    """Select Fall 2025 semester."""
    try:
        log_and_print("[SEMESTER] Selecting Fall 2025 semester...")

        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "div[data-term='202610']"))
        )

        fall_2025_link = driver.find_element(By.CSS_SELECTOR, "div[data-term='202610'] a")
        fall_2025_link.click()

        WebDriverWait(driver, 30).until(
            EC.presence_of_element_located((By.ID, "legend_box"))
        )

        log_and_print("[SUCCESS] Successfully selected Fall 2025!")
        return True
    except Exception as e:
        log_and_print(f"[WARNING] Failed to select Fall 2025: {str(e)}")
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

            WebDriverWait(driver, 60).until(
                lambda d: d.current_url != Config.LOGIN_URL
            )

            log_and_print("[SUCCESS] Successfully logged in!")

            if select_fall_2025(driver):
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

        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        driver.set_page_load_timeout(300)
        driver.implicitly_wait(30)
        return driver
    except Exception as e:
        logging.error(f"Failed to set up driver: {str(e)}")
        raise


def attempt_registration(driver):
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

        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.ID, "legend_box"))
        )
        log_and_print("[SUCCESS] Registration attempt completed!")
        return True
    except Exception as e:
        log_and_print(f"[WARNING] Registration failed: {e}")
        return False


def check_class_status(driver, courses, dry_run=False):
    """Check the status of monitored classes.

    Args:
        driver: Selenium WebDriver instance
        courses: List of course names to monitor
        dry_run: If True, check status without attempting registration
    """
    max_retries = 3
    retry_count = 0

    while retry_count < max_retries:
        try:
            WebDriverWait(driver, 30).until(
                EC.presence_of_element_located((By.CLASS_NAME, "timetable.table_container"))
            )

            for course_name in courses:
                try:
                    if course_name == "ELEC 2200":
                        log_and_print("\n=== ELEC 2200 Status Check ===")

                        course_header = WebDriverWait(driver, 10).until(
                            EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'header_cell')]//h4[contains(@class, 'course_title') and contains(text(), 'ELEC 2200')]"))
                        )

                        if not course_header:
                            log_and_print("ERROR: No course header found for ELEC 2200")
                            continue

                        header_cell = course_header.find_element(By.XPATH, "./..")
                        time_info = header_cell.find_element(By.ID, "hoursInLegend").text.strip()
                        is_full = "Full" in header_cell.text
                        status = "FULL" if is_full else "OPEN"

                        log_and_print(f"1. Current Section ({time_info}): [{status}]")
                        log_check("ELEC 2200", time_info, status)

                        if not is_full:
                            send_email_alert("ELEC 2200", f"OPEN - Section {time_info}")

                        # Check alternative section
                        course_header.click()
                        time.sleep(1)

                        prev_button = WebDriverWait(driver, 10).until(
                            EC.element_to_be_clickable((By.CSS_SELECTOR, "a.results-action-previous"))
                        )
                        prev_button.click()
                        time.sleep(2)

                        new_course_header = WebDriverWait(driver, 10).until(
                            EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'header_cell')]//h4[contains(@class, 'course_title') and contains(text(), 'ELEC 2200')]"))
                        )

                        if new_course_header:
                            new_header_cell = new_course_header.find_element(By.XPATH, "./..")
                            new_time_info = new_header_cell.find_element(By.ID, "hoursInLegend").text.strip()
                            new_is_full = "Full" in new_header_cell.text
                            alt_status = "FULL" if new_is_full else "OPEN"

                            log_and_print(f"2. Alternative Section ({new_time_info}): [{alt_status}]")
                            log_check("ELEC 2200", new_time_info, alt_status)

                            if not new_is_full:
                                send_email_alert("ELEC 2200", f"OPEN - Alt Section {new_time_info}")

                            next_button = WebDriverWait(driver, 10).until(
                                EC.element_to_be_clickable((By.CSS_SELECTOR, "a.results-action-next"))
                            )
                            next_button.click()
                            time.sleep(2)

                            course_header = WebDriverWait(driver, 10).until(
                                EC.presence_of_element_located((By.XPATH, "//div[contains(@class, 'header_cell')]//h4[contains(@class, 'course_title') and contains(text(), 'ELEC 2200')]"))
                            )
                            course_header.click()

                    else:
                        course_header = WebDriverWait(driver, 10).until(
                            EC.presence_of_element_located((By.XPATH, f"//div[contains(@class, 'header_cell')]//h4[contains(@class, 'course_title') and contains(text(), '{course_name}')]"))
                        )

                        if course_header:
                            header_cell = course_header.find_element(By.XPATH, "./..")
                            time_info = header_cell.find_element(By.ID, "hoursInLegend").text.strip()
                            is_full = "Full" in header_cell.text
                            status = "FULL" if is_full else "OPEN"

                            log_and_print(f"\n=== {course_name} Status ===")
                            log_and_print(f"Time: {time_info}: [{status}]")
                            log_check(course_name, time_info, status)

                            if not is_full:
                                send_email_alert(course_name, f"OPEN - {time_info}")
                                if not dry_run:
                                    log_and_print("Attempting to register...")
                                    if attempt_registration(driver):
                                        log_and_print("Successfully registered!")
                                        send_email_alert(course_name, "Registration succeeded")
                                    else:
                                        log_and_print("Registration failed")
                                        send_email_alert(course_name, "Registration failed")
                                else:
                                    log_and_print("[DRY RUN] Skipping registration attempt")

                except Exception as e:
                    log_and_print(f"Error checking course {course_name}: {str(e)}")

            # Refresh the page after checking all courses
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
                except:
                    driver.quit()
                    driver = setup_driver(Config.HEADLESS)
                    login(driver)
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
    courses = [c.strip() for c in args.courses.split(",")] if args.courses else Config.COURSES
    interval = args.interval if args.interval is not None else Config.CHECK_INTERVAL
    headless = args.headless if args.headless else Config.HEADLESS
    dry_run = args.dry_run

    # Initialize database
    init_db()

    log_and_print("Starting course monitoring script...")
    log_and_print(f"Monitoring courses: {', '.join(courses)}")
    log_and_print(f"Check interval: {interval}s | Headless: {headless} | Dry run: {dry_run}")

    max_retries = 3
    retry_count = 0

    while retry_count < max_retries:
        try:
            driver = setup_driver(headless)
            if login(driver):
                while True:
                    if not check_class_status(driver, courses, dry_run):
                        driver.quit()
                        driver = setup_driver(headless)
                        if not login(driver):
                            break
                    time.sleep(interval)
            else:
                retry_count += 1
                if retry_count < max_retries:
                    time.sleep(5)
                else:
                    log_and_print("Failed to log in after multiple attempts")
                    break

        except Exception as e:
            log_and_print(f"Error in main loop: {str(e)}")
            retry_count += 1
            if retry_count < max_retries:
                time.sleep(5)
            else:
                log_and_print("Script stopped after multiple failures")
                break

    if retry_count >= max_retries:
        log_and_print("Script stopped after multiple failures")

    try:
        driver.quit()
    except:
        pass


if __name__ == "__main__":
    main()
