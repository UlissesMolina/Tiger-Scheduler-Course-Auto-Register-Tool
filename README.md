# Course Auto-Register

Automated course seat monitor and registration tool for Auburn University's TigerScheduler.

## How It Works

The tool uses Selenium to interact with TigerScheduler in a real browser session. It logs in with your Auburn credentials, loads your saved schedule favorites, and continuously checks whether monitored courses have open seats. When a seat opens, it can automatically attempt registration and notify you via email.

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Login &     │────>│  Monitor     │────>│  Register    │
│  Load Favs   │     │  Seat Status │     │  When Open   │
└──────────────┘     └──────┬───────┘     └──────┬───────┘
                            │                     │
                     ┌──────▼───────┐     ┌──────▼───────┐
                     │  Log to      │     │  Email       │
                     │  SQLite DB   │     │  Notification│
                     └──────────────┘     └──────────────┘
```

## Features

- **Seat Monitoring** — checks course availability on a configurable interval
- **Auto-Registration** — attempts to register as soon as a seat opens
- **Email Alerts** — SMTP notifications when seats open or registration completes
- **History Tracking** — SQLite database logs every status check
- **CLI Interface** — configure courses, interval, and mode via command-line flags
- **Headless Mode** — run without a visible browser window (useful for servers/Docker)
- **Dry Run Mode** — monitor status without attempting registration

## Setup

### Prerequisites

- Python 3.10+
- Google Chrome installed

### Local Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/courseAuto.git
cd courseAuto

# Install dependencies
pip install -r requirements.txt

# Create your config file
cp .env.example .env
# Edit .env with your Auburn credentials and preferences
```

### Docker

```bash
docker build -t course-auto .

# Run with a .env file
docker run --env-file .env course-auto

# Or pass args directly
docker run course-auto python script.py --courses "MATH 2660" --headless --interval 30
```

## Usage

```bash
# Default: monitor courses from .env config
python script.py

# Monitor specific courses
python script.py --courses "ELEC 2200,MATH 2660"

# Custom interval (seconds)
python script.py --interval 30

# Headless mode (no browser window)
python script.py --headless

# Dry run (check status only, no registration)
python script.py --dry-run

# Combine flags
python script.py --courses "MATH 2660" --interval 30 --headless --dry-run
```

### CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `--courses` | Comma-separated course list | From `.env` |
| `--interval` | Check interval in seconds | `60` |
| `--headless` | Run browser in headless mode | `false` |
| `--dry-run` | Check without registering | `false` |

## Configuration

All settings are managed via the `.env` file. CLI arguments override `.env` values when provided.

| Variable | Description | Default |
|----------|-------------|---------|
| `AUBURN_USERNAME` | Auburn login username | — |
| `AUBURN_PASSWORD` | Auburn login password | — |
| `COURSES` | Comma-separated course list | `ELEC 2200,MATH 2660` |
| `CHECK_INTERVAL` | Seconds between checks | `60` |
| `HEADLESS` | Run in headless mode | `false` |
| `SMTP_HOST` | SMTP server host | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | `587` |
| `SENDER_EMAIL` | Email to send alerts from | — |
| `SENDER_PASSWORD` | App password for sender email | — |
| `RECIPIENT_EMAIL` | Email to receive alerts | — |
| `EMAIL_NOTIFICATIONS_ENABLED` | Enable email alerts | `false` |

## Tech Stack

- **Python 3.11** — core language
- **Selenium** — browser automation
- **webdriver-manager** — automatic ChromeDriver management
- **python-dotenv** — environment variable configuration
- **SQLite** — check history persistence
- **smtplib** — email notifications
- **Docker** — containerized deployment

## Disclaimer

Use responsibly. Do not violate Auburn's terms of service or automate actions without permission. This project is for educational purposes only.
=======
# Tiger Scheduler Course Auto-Register Tool

This Python script automatically checks for open seats in specific Auburn University courses on TigerScheduler and will attempt to register.

## Features
- Monitor course availability (refreshes every mintue)
- Filter guven course
- Auto-login and action

## ⚠️ Disclaimer
Use responsibly. Do not violate Auburn's terms of service or automate actions without permission. This project is for educational purposes only.

## Setup
- Python 3.x
- `selenium`
- Chrome + chromedriver

## Usage
Edit `script.py` to set your course preferences. Then run:
>>>>>>> 4af52312c372d73084011e3f01fb0537ccdc1f46
