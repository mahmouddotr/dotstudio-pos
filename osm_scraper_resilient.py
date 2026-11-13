#!/usr/bin/env python3
"""
Resilient runner for osm_scraper.py.

Same query / same parsing / same CSV output as osm_scraper.py, but hardened
against the failures that actually occur in the field:

  1. TLS 1.3 - the Overpass front-ends refuse TLS 1.2, and macOS system
     Python is linked against LibreSSL 2.8.3 (no TLS 1.3). `requests` alone
     dies with SSLV3_ALERT_HANDSHAKE_FAILURE -> fall back to `curl`
     (system curl 8.x uses SecureTransport/LibreSSL 3.3.6 and negotiates TLS 1.3).
  2. Mirror rotation - overpass-api.de answers 406/502 depending on the
     node, so try every known endpoint instead of trusting one.
  3. Rate limits / capacity - 429/502/503/504 are "busy, retry later":
     exponential backoff on the same mirror, then move on to the next.
  4. Partial databases - overpass.osm.ch only holds a regional extract
     (zero Egypt coverage), so it is excluded.

Usage:
    python3 osm_scraper_resilient.py            # nodes  (same scope as osm_scraper.py)
    python3 osm_scraper_resilient.py --ways     # + ways/relations POIs (superset)
"""

import argparse
import csv
import json
import os
import subprocess
import sys
import time

import requests

UA = "DotStudio-POS/1.0"

# Ordered by observed reliability for this workload.
MIRRORS = [
    "https://z.overpass-api.de/api/interpreter",
    "https://lz4.overpass-api.de/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
]

# Mirrors that answer but hold only a regional extract -> results would be silently wrong.
BLACKLIST = {
    "overpass.osm.ch": "partial database (no Egypt coverage)",
}

OUTPUT_CSV = "osm_businesses.csv"

BASE_QUERY = """
[out:json][timeout:60];
area["name:ar"="كفر الشيخ"]->.searchArea;
(
  node["amenity"~"restaurant|cafe|fast_food|pharmacy"](area.searchArea);
  node["shop"~"clothes|electronics|supermarket|bakery"](area.searchArea);
);
out body;
"""

WAYS_QUERY = """
[out:json][timeout:90];
area["name:ar"="كفر الشيخ"]->.searchArea;
(
  node["amenity"~"restaurant|cafe|fast_food|pharmacy"](area.searchArea);
  node["shop"~"clothes|electronics|supermarket|bakery"](area.searchArea);
  way["amenity"~"restaurant|cafe|fast_food|pharmacy"](area.searchArea);
  way["shop"~"clothes|electronics|supermarket|bakery"](area.searchArea);
  relation["amenity"~"restaurant|cafe|fast_food|pharmacy"](area.searchArea);
  relation["shop"~"clothes|electronics|supermarket|bakery"](area.searchArea);
);
out body;
"""


# --------------------------------------------------------------------------- #
# transports
# --------------------------------------------------------------------------- #
def post_via_requests(url, query, timeout):
    """Primary transport. Raises on any requests-level failure."""
    resp = requests.post(
        url, data={"data": query}, headers={"User-Agent": UA}, timeout=timeout
    )
    return resp.status_code, resp.text


def post_via_curl(url, query, timeout):
    """Fallback transport. System curl negotiates TLS 1.3, unlike stock Python SSL."""
    marker = "__HTTP_STATUS__"
    cmd = [
        "curl", "-sS", "--compressed",
        "--max-time", str(timeout),
        "-A", UA,
        "-w", "\n" + marker + "%{http_code}",
        "-X", "POST",
        "--data-urlencode", "data=" + query,
        url,
    ]
    out = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout + 15)
    if out.returncode != 0:
        raise RuntimeError("curl exit %d: %s" % (out.returncode, (out.stderr or "").strip()[:200]))
    body, _, status = out.stdout.rpartition("\n" + marker)
    return int(status.strip() or 0), body


def fetch(url, query, timeout):
    """Try requests, then curl. Returns (status_code, body_text)."""
    try:
        return post_via_requests(url, query, timeout)
    except requests.exceptions.RequestException as e:
        last = str(e)
        try:
            return post_via_curl(url, query, timeout)
        except Exception as ce:
            raise RuntimeError("requests: %s | curl: %s" % (last[:120], str(ce)[:120]))


# --------------------------------------------------------------------------- #
# resilient query
# --------------------------------------------------------------------------- #
def run_query(query, timeout=180, max_attempts=4, verbose=True):
    """Returns (data, mirror) or (None, error_string)."""
    last_err = "no attempt made"

    for url in MIRRORS:
        host = url.split("/")[2]
        if host in BLACKLIST:
            if verbose:
                print("   [skip] %-28s (%s)" % (host, BLACKLIST[host]))
            continue

        for attempt in range(max_attempts):
            try:
                if verbose:
                    print("   -> %s  (attempt %d/%d)" % (host, attempt + 1, max_attempts))
                status, body = fetch(url, query, timeout)
            except Exception as e:
                last_err = "transport: %s" % str(e)[:200]
                if verbose:
                    print("      [x] %s" % last_err)
                time.sleep(2 ** attempt)
                continue

            if status == 200:
                try:
                    data = json.loads(body)
                except ValueError:
                    last_err = "%s: response was not JSON" % host
                    if verbose:
                        print("      [x] %s" % last_err)
                    time.sleep(2 ** attempt)
                    continue

                if "elements" not in data:
                    last_err = "%s: JSON without 'elements'" % host
                    time.sleep(2 ** attempt)
                    continue

                if verbose:
                    print("      [ok] %d elements" % len(data["elements"]))
                return data, url

            # busy / rate-limited / rejected
            snippet = " ".join(body.strip().split())[:110]
            last_err = "%s: HTTP %d %s" % (host, status, snippet)
            if verbose:
                print("      [x] HTTP %d  %s" % (status, snippet))

            if status in (429, 502, 503, 504):
                wait = min(2 ** attempt * 3, 30)
                if verbose:
                    print("      ... server busy -> sleeping %ds" % wait)
                time.sleep(wait)
                continue  # retry same mirror with backoff

            break  # hard rejection (400/403/406) -> move to next mirror

        if verbose:
            print("   -- moving past %s" % host)
        time.sleep(1)

    return None, last_err


# --------------------------------------------------------------------------- #
# parsing + output (identical semantics to osm_scraper.py)
# --------------------------------------------------------------------------- #
def extract_leads(elements):
    leads = []
    seen = set()
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name", tags.get("name:ar", "بدون اسم"))
        phone = tags.get("phone", tags.get("contact:phone", "لا يوجد"))
        cat = tags.get("amenity", tags.get("shop", "نشاط"))

        if name and name != "بدون اسم":
            key = (name, cat, phone)
            if key in seen:
                continue
            seen.add(key)
            leads.append([name, cat, phone, "OpenStreetMap"])
    return leads


def save_csv(leads, path=OUTPUT_CSV):
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["الاسم", "النشاط", "رقم الهاتف", "المصدر"])
        writer.writerows(leads)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ways", action="store_true", help="also collect way/relation POIs")
    ap.add_argument("--timeout", type=int, default=180)
    args = ap.parse_args()

    print("⏳ جاري سحب البيانات من OpenStreetMap...")
    query = WAYS_QUERY if args.ways else BASE_QUERY

    data, mirror = run_query(query, timeout=args.timeout)

    if not data:
        print("❌ فشل السحب بعد تجربة كل المرايا. آخر خطأ: %s" % mirror)
        return 1

    elements = data.get("elements", [])
    print("📦 عدد النتائج الخام: %d  (المصدر: %s)" % (len(elements), mirror.split("/")[2]))

    leads = extract_leads(elements)
    save_csv(leads)

    with_phone = sum(1 for l in leads if l[2] != "لا يوجد")
    print("✅ تم حفظ %d محل في ملف %s" % (len(leads), OUTPUT_CSV))
    print("   ├─ أرقام هاتف متوفرة: %d" % with_phone)
    cats = {}
    for l in leads:
        cats[l[1]] = cats.get(l[1], 0) + 1
    for c, n in sorted(cats.items(), key=lambda x: -x[1]):
        print("   ├─ %-14s %d" % (c, n))
    return 0


if __name__ == "__main__":
    sys.exit(main())
