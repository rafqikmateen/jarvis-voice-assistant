"""Live Cartagena scraper (keyless): weather from Open-Meteo, water/utility alerts from Aguas de Cartagena (Acuacar),
cultural bulletins from the Instituto de Patrimonio y Cultura de Cartagena (IPCC, incl. the "Preludios" launches),
and USD/COP rates. Used by knowledge_galaxy.py to fill the Daily Cartagena Digest node. Run it directly to preview.

Feed text is untrusted web content: it is only ever shown as text, never executed or given to a model as instructions.
Blocking (requests): call from a thread in async code."""
import html
import re
import sys
import threading
import time
import xml.etree.ElementTree as ET
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime

import requests

from cartagena_digest import LAT, LON, WMO_TEXT

TIMEOUT = 8
CACHE_SECONDS = 10 * 60
HEADERS = {"User-Agent": "Mozilla/5.0 (Jarvis Cartagena scraper)"}

# aguasdecartagena.com.co does not answer from here; the same company's newsroom is served by www.acuacar.com.
ACUACAR_FEED = "https://www.acuacar.com/feed/"
IPCC_FEED = "https://ipcc.gov.co/feed/"
IPCC_SEARCH_FEED = "https://ipcc.gov.co/?s={q}&feed=rss2"   # WordPress search feed: reaches older "Preludio" posts

UTILITY_DAYS = 7      # water alerts older than this are dropped
EVENT_DAYS = 45       # festival and Preludio announcements stay relevant longer
MAX_UTILITY, MAX_EVENTS = 5, 5
EXCERPT_LIMIT = 1500

UTILITY_RE = re.compile(r"fuga|reparaci|da[ñn]o|rotura|ruptura|suspensi|corte|interrupci|mantenimiento|parada t[eé]cnica|"
                        r"emergencia|tuber[ií]a|sin servicio|desabastec|baja presi", re.I)
EVENT_RE = re.compile(r"preludio|fiestas|programaci[oó]n|desfile|festival|carnaval|noche de museos|reinado", re.I)
PRELUDIO_RE = re.compile(r"preludio", re.I)
_WEEKDAY = r"(?:lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)"
WHEN_RE = re.compile(rf"{_WEEKDAY}\s+\d{{1,2}}\s+de\s+[a-záéíóú]+", re.I)
TIME_RE = re.compile(r"\d{1,2}:\d{2}\s*[ap]\.?\s?m\.?", re.I)
_NS_CONTENT = {"c": "http://purl.org/rss/1.0/modules/content/"}
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")

_cache = {"t": 0.0, "data": None}
_lock = threading.Lock()


def _text(raw):
    return _WS_RE.sub(" ", html.unescape(_TAG_RE.sub(" ", raw or ""))).strip()


def _feed(url):
    """Items of an RSS feed as dicts {title, link, date (aware datetime), body (plain text)}."""
    r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    r.raise_for_status()
    root = ET.fromstring(r.content.lstrip())   # the IPCC feed starts with blank lines before the XML declaration
    items = []
    for it in root.iterfind("./channel/item"):
        try:
            date = parsedate_to_datetime(it.findtext("pubDate"))
        except (TypeError, ValueError):
            continue
        items.append({"title": _text(it.findtext("title")), "link": (it.findtext("link") or "").strip(), "date": date,
                      "body": _text(it.findtext("c:encoded", namespaces=_NS_CONTENT) or it.findtext("description"))})
    return items


def _sentence_case(title):
    title = re.sub(r"^#?\d+\s*[–-]\s*", "", title).strip()   # Acuacar bulletin numbers: "#2893 – ..."
    if not title.isupper():
        return title
    title = title[:1] + title[1:].lower()
    for word in ("Cartagena", "Pasacaballos", "Bolívar", "Acuacar", "Turbaco", "Canapote"):   # proper nouns lost by lower()
        title = re.sub(word, word, title, flags=re.I)
    return title


def fetch_weather():
    r = requests.get("https://api.open-meteo.com/v1/forecast", timeout=TIMEOUT, params={
        "latitude": LAT, "longitude": LON, "timezone": "America/Bogota", "forecast_days": 1,
        "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code",
        "daily": "temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max"})
    r.raise_for_status()
    j = r.json()
    c, d = j["current"], j["daily"]
    t = c["temperature_2m"]
    return {"temp": f"{t * 9 / 5 + 32:.0f}°F ({t:.1f}°C)", "condition": WMO_TEXT.get(c.get("weather_code"), "Unknown"),
            "humidity": f"{c['relative_humidity_2m']:.0f}%",
            "high_c": d["temperature_2m_max"][0], "low_c": d["temperature_2m_min"][0],
            "rain_mm": d["precipitation_sum"][0], "rain_chance": d["precipitation_probability_max"][0]}


def fetch_rates():
    r = requests.get("https://open.er-api.com/v6/latest/USD", timeout=TIMEOUT)
    r.raise_for_status()
    j = r.json()
    cop, eur = j["rates"]["COP"], j["rates"]["EUR"]
    return {"usd_cop": cop, "eur_cop": cop / eur, "as_of": j.get("time_last_update_utc", "")[:16]}


def fetch_utilities():
    """Recent Acuacar newsroom items that read like water ruptures, repairs, cuts or maintenance."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=UTILITY_DAYS)
    out = []
    for it in _feed(ACUACAR_FEED):
        if it["date"] >= cutoff and UTILITY_RE.search(it["title"]):
            out.append({"title": _sentence_case(it["title"]), "date": it["date"], "link": it["link"]})
    return out[:MAX_UTILITY]


def _when(body):
    """'viernes 2 de octubre · 4:00 p.m.' when the article says so, else ''."""
    day, hour = WHEN_RE.search(body), TIME_RE.search(body)
    return " · ".join(m.group(0) for m in (day, hour) if m)


def fetch_events():
    """IPCC news that announce festivals and the neighbourhood Preludios (own feed plus a 'preludio' search feed)."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=EVENT_DAYS)
    seen, out = set(), []
    pool = _feed(IPCC_FEED)
    try:
        pool += _feed(IPCC_SEARCH_FEED.format(q="preludio"))
    except Exception:
        pass   # the main feed alone is enough
    for it in sorted(pool, key=lambda i: i["date"], reverse=True):
        if it["link"] in seen or it["date"] < cutoff or not EVENT_RE.search(it["title"]):
            continue
        seen.add(it["link"])
        out.append({"title": it["title"], "date": it["date"], "link": it["link"],
                    "preludio": bool(PRELUDIO_RE.search(it["title"])), "when": _when(it["body"]) if PRELUDIO_RE.search(it["title"]) else ""})
    out.sort(key=lambda e: not e["preludio"])   # Preludio launches first (stable: newest first inside each group)
    return out[:MAX_EVENTS]


def collect(force=False):
    """{"fetched_at", "weather", "rates", "utilities", "events", "errors"}; cached for CACHE_SECONDS, sources fail independently."""
    with _lock:
        if not force and _cache["data"] and time.time() - _cache["t"] < CACHE_SECONDS:
            return _cache["data"]
        sources = {"weather": fetch_weather, "rates": fetch_rates, "utilities": fetch_utilities, "events": fetch_events}
        data = {"fetched_at": datetime.now().strftime("%Y-%m-%d %H:%M"), "errors": []}
        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = {k: pool.submit(f) for k, f in sources.items()}
        for k, fut in futures.items():
            try:
                data[k] = fut.result()
            except Exception as e:
                data[k] = [] if k in ("utilities", "events") else None
                data["errors"].append(f"{k}: {type(e).__name__}")
        if len(data["errors"]) == len(sources) and _cache["data"]:
            return _cache["data"]   # everything failed: keep the last good data
        _cache.update(t=time.time(), data=data)
        return data


def _day(dt):
    return dt.astimezone().strftime("%b %d")


def bulletins(data):
    """Plain-text lines for the Daily Cartagena Digest excerpt."""
    lines = []
    w, rates = data.get("weather"), data.get("rates")
    if w:
        lines.append(f"Weather: {w['temp']}, {w['condition']}; today {w['low_c']:.0f}-{w['high_c']:.0f}°C, "
                     f"rain {w['rain_chance']}% ({w['rain_mm']:g} mm)")
    if rates:
        lines.append(f"USD/COP: 1 USD = {rates['usd_cop']:,.0f} COP; 1 EUR = {rates['eur_cop']:,.0f} COP")
    lines.append("Water & utilities (Acuacar):")
    lines += [f"- {_day(u['date'])}: {u['title']}" for u in data.get("utilities") or []] or ["- no alerts in the last week"]
    lines.append("Culture & festivals (IPCC):")
    for e in data.get("events") or []:
        tag = "Preludio" if e["preludio"] else "News"
        lines.append(f"- {_day(e['date'])} [{tag}]: {e['title']}" + (f" ({e['when']})" if e["when"] else ""))
    if not data.get("events"):
        lines.append("- no announcements in the last 45 days")
    if data.get("errors"):
        lines.append("Unavailable: " + ", ".join(data["errors"]))
    return lines


def excerpt(data=None):
    """Digest excerpt text, capped at EXCERPT_LIMIT characters."""
    data = data or collect()
    return (f"Live Cartagena bulletin (updated {data['fetched_at']})\n" + "\n".join(bulletins(data)))[:EXCERPT_LIMIT]


if __name__ == "__main__":
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    print(excerpt(collect(force=True)))
