# Course Auto-Register

Tools for getting into Auburn University classes:

- **[Auburn Course Finder](https://ulissesmolina.github.io/Tiger-Scheduler-Course-Auto-Register-Tool/)**: a website to search every section by course, title, professor or CRN and see open seats, refreshed daily.
- **Auto-register**: a local Selenium tool that watches TigerScheduler and registers you the moment a seat opens.

Find a class on the site, press **Watch**, paste the generated `COURSES=` line into your `.env`, and let the auto-register tool grab the seat.

```
┌──────────────────┐  daily   ┌──────────────┐  deploy  ┌──────────────────┐
│ Auburn Banner    │────────> │  data/*.json │────────> │  Course Finder   │
│ class search     │ Actions  │  (snapshots) │  Pages   │  (GitHub Pages)  │
└──────────────────┘          └──────────────┘          └────────┬─────────┘
                                                                 │ Watch → COURSES=
                                                        ┌────────▼─────────┐
                                                        │  Auto-register   │
                                                        │  (your machine)  │
                                                        └──────────────────┘
```

## Course Finder

### What it shows

- **Search** by course code (`COMP 1210`, `comp12`), title words, instructor name or CRN
- **Per-section seats**: open / capacity (green, amber when low, red when full) and waitlist
- Meeting days, times and rooms, instructors, and click-to-copy CRNs
- **Filters**: open seats only, days, start after / end by, format (campus, online, …)
- **Watch list**: kept in your browser and exported as the `COURSES=` line for `.env`
- Shareable links: the term and search are kept in the URL

Seat counts are a daily snapshot and change constantly during registration; check TigerSchedule before you register.

### Where the data comes from

Auburn's Banner class search (`erpssb.auburn.edu`) answers without a login once a term is selected. The [Seats snapshot](.github/workflows/seats.yml) workflow runs `scripts/fetch_sections.py` every day at 11:20 UTC. It saves every section of each open term to `data/sections-{term}.json` (one section per line, so diffs show what changed) plus an index in `data/terms.json`, then commits them. The [Deploy site](.github/workflows/pages.yml) workflow rebuilds the site after each snapshot and on any push to `site/` or `data/`.

The scraper uses only the Python standard library, retries failed requests, and refuses to overwrite a term if the download is incomplete or comes back under 80% of the committed size. To ship a real shrink, run the workflow by hand with **force** set.

```bash
python scripts/fetch_sections.py            # every open term
python scripts/fetch_sections.py 202720     # one term
FORCE_WRITE=1 python scripts/fetch_sections.py 202720
```

### Running the site locally

Requires Node 22.12+.

```bash
cd site
npm install
npm run dev      # http://localhost:5173, serves ../data
npm test
npm run build    # output in site/dist, data included
```

### Tests

```bash
python -m unittest discover -s tests   # scraper
cd site && npm test                    # search, filters, formatting
```

## Auto-Register

### How It Works

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

It runs on your own machine (or in Docker), not in GitHub Actions, because registering needs your Auburn login and a Duo approval.

### Features

- **Seat Monitoring** — checks course availability on a configurable interval
- **Auto-Registration** — attempts to register as soon as a seat opens
- **Email Alerts** — SMTP notifications when seats open or registration completes
- **History Tracking** — SQLite database logs every status check
- **CLI Interface** — configure courses, interval, and mode via command-line flags
- **Headless Mode** — run without a visible browser window (useful for servers/Docker)
- **Dry Run Mode** — monitor status without attempting registration

### Setup

#### Prerequisites

- Python 3.10+
- Google Chrome installed

#### Local Installation

```bash
# Clone the repository
git clone https://github.com/UlissesMolina/Tiger-Scheduler-Course-Auto-Register-Tool.git
cd Tiger-Scheduler-Course-Auto-Register-Tool

# Install dependencies
pip install -r requirements.txt

# Create your config file
cp .env.example .env
# Edit .env with your Auburn credentials and preferences
```

#### Docker

```bash
docker build -t course-auto .

# Run with a .env file
docker run --env-file .env course-auto

# Or pass args directly
docker run course-auto python script.py --courses "MATH 2660" --headless --interval 30
```

### Usage

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

#### CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `--courses` | Comma-separated course list | From `.env` |
| `--interval` | Check interval in seconds | `60` |
| `--headless` | Run browser in headless mode | `false` |
| `--dry-run` | Check without registering | `false` |

### Configuration

All settings are managed via the `.env` file. CLI arguments override `.env` values when provided.

| Variable | Description | Default |
|----------|-------------|---------|
| `AUBURN_USERNAME` | Auburn login username | — |
| `AUBURN_PASSWORD` | Auburn login password | — |
| `COURSES` | Comma-separated course list | `ELEC 2200,MATH 2660` |
| `CHECK_INTERVAL` | Seconds between checks | `60` |
| `TERM_CODE` | TigerSchedule term code (`data-term` on the term picker) | `202720` |
| `LOGIN_TIMEOUT` | Seconds to wait for login, including Duo approval | `180` |
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
- **Selenium Manager** — automatic ChromeDriver management (built into Selenium)
- **python-dotenv** — environment variable configuration
- **SQLite** — check history persistence
- **smtplib** — email notifications
- **Docker** — containerized deployment
- **React + Vite** — Course Finder site, hosted on GitHub Pages
- **GitHub Actions** — daily seat snapshot and site deploys

## Disclaimer

Use responsibly. Do not violate Auburn's terms of service or automate actions without permission. This project is for educational purposes only.
