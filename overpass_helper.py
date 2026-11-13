#!/usr/bin/env python3
"""Robust Overpass helper: mirror rotation + exponential backoff + JSON validation.
Reused by osm_scraper.py (exact copy) and the resilient runner."""
import requests
import time

MIRRORS = [
    "https://z.overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass.osm.ch/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

HEADERS = {"User-Agent": "DotStudio-POS/1.0"}


def run_query(query, mirrors=None, timeout=90, max_attempts=3, verbose=True):
    """POST query to Overpass, rotating mirrors and backing off on failure.

    Returns (data, url_used) on success or (None, last_error_string).
    """
    mirrors = mirrors or MIRRORS
    last_err = "no attempt made"
    attempt = 0

    for url in mirrors:
        for try_no in range(max_attempts):
            attempt += 1
            try:
                if verbose:
                    print(f"   ↻ محاولة {attempt} | {url.split('/')[2]} (try {try_no + 1}/{max_attempts})")
                resp = requests.post(url, data={"data": query}, headers=HEADERS, timeout=timeout)

                if resp.status_code == 200:
                    try:
                        data = resp.json()
                    except ValueError:
                        last_err = f"استجابة غير JSON من {url}"
                        if verbose:
                            print(f"     ⚠️  {last_err}")
                        time.sleep(2 ** try_no)
                        break  # try next mirror

                    if "elements" in data:
                        if verbose:
                            print(f"     ✅ نجح ({len(data['elements'])} عنصر)")
                        return data, url
                    last_err = "استجابة JSON بدون elements"
                else:
                    body = resp.text.strip().splitlines()
                    snippet = body[0][:80] if body else ""
                    last_err = f"HTTP {resp.status_code} من {url}: {snippet}"
                    if verbose:
                        print(f"     ⚠️  {last_err}")
                    # 429/504/502/503 = busy/rate limited -> backoff on same mirror
                    if resp.status_code in (429, 502, 503, 504):
                        time.sleep(2 ** try_no)
                        continue
                    break  # hard rejection -> next mirror
            except requests.exceptions.Timeout:
                last_err = f"انتهت المهلة (timeout) على {url}"
                if verbose:
                    print(f"     ⏱️  {last_err}")
                time.sleep(2 ** try_no)
            except requests.exceptions.RequestException as e:
                last_err = f"خطأ شبكة على {url}: {e}"
                if verbose:
                    print(f"     ⚠️  {last_err}")
                break  # network/DNS issue -> next mirror

        if verbose:
            print(f"   — تخطّي {url.split('/')[2]} —")
        time.sleep(1)

    return None, last_err
