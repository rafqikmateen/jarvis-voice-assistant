"""Haiku token/cost accumulator, persisted to claude_usage.json so totals survive restarts.

record() is called after every Anthropic call (server.py wraps ai.messages.create); only Haiku models are billed here.
Prices are USD per million tokens. Prompt-cache reads/writes are not priced separately (Jarvis doesn't use caching).
"""
import json
import os
import threading
import time

HERE = os.path.dirname(os.path.abspath(__file__))
USAGE_FILE = os.path.join(HERE, "claude_usage.json")
INPUT_PER_M = 1.00
OUTPUT_PER_M = 5.00

_lock = threading.Lock()
_zero = {"input_tokens": 0, "output_tokens": 0, "turns": 0, "usd": 0.0}
_total = dict(_zero)
_session = dict(_zero)
_started = time.time()


def _load():
    try:
        with open(USAGE_FILE, encoding="utf-8") as f:
            saved = json.load(f)["total"]
        for k in _zero:
            _total[k] = type(_zero[k])(saved.get(k, 0))
    except Exception:
        pass   # missing or corrupt file: start from zero


def _save():
    try:
        tmp = USAGE_FILE + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"total": _total, "updated": time.strftime("%Y-%m-%d %H:%M:%S")}, f, indent=2)
        os.replace(tmp, USAGE_FILE)
    except Exception:
        pass


def record(model, usage):
    """Add one Haiku turn. Ignores other models and responses without usage data."""
    if "haiku" not in str(model or "").lower() or usage is None:
        return
    inp, out = int(getattr(usage, "input_tokens", 0) or 0), int(getattr(usage, "output_tokens", 0) or 0)
    usd = inp * INPUT_PER_M / 1e6 + out * OUTPUT_PER_M / 1e6
    with _lock:
        for acc in (_total, _session):
            acc["input_tokens"] += inp
            acc["output_tokens"] += out
            acc["turns"] += 1
            acc["usd"] += usd
        _save()


def _view(acc):
    return {"input_tokens": acc["input_tokens"], "output_tokens": acc["output_tokens"],
            "total_tokens": acc["input_tokens"] + acc["output_tokens"], "turns": acc["turns"],
            "usd": round(acc["usd"], 6), "usd_per_turn": round(acc["usd"] / acc["turns"], 6) if acc["turns"] else 0.0}


def stats():
    with _lock:
        return {"model": "haiku", "pricing_per_million": {"input": INPUT_PER_M, "output": OUTPUT_PER_M},
                "session": _view(_session), "cumulative": _view(_total),
                "session_started": time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(_started))}


_load()
