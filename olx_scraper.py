import csv
import json
import re
import time
import requests
from requests.auth import HTTPBasicAuth

URL = "https://www.olx.com.pk/mobile-phones_c1453"
TIMEOUT = 20
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; DotStudio-POS/1.0)"}
# OLX endpoints are fronted by an interstitial that expects HTTP Basic Auth.
AUTH = HTTPBasicAuth("user", "pass")


def scrape():
    print("⏳ جاري سحب البيانات من OLX...")
    try:
        r = requests.get(URL, headers=HEADERS, auth=AUTH, timeout=TIMEOUT)
        print(f"📡 حالة السيرفر: {r.status_code}")
        r.raise_for_status()
    except Exception as e:
        print(f"❌ فشل الطلب: {e}")
        return []

    html = r.text
    # Extract the ItemList JSON-LD block for real listing data.
    leads = []
    seen = set()
    for m in re.finditer(r'"@type":"ListItem".*?"item":\{"@type":"Product","name":"([^"]+)","url":"([^"]+)".*?"price":([0-9.]+).*?"priceCurrency":"([^"]+)".*?"name":"([^"]+)"', html):
        title = m.group(1)
        link = m.group(2)
        price = m.group(3)
        currency = m.group(4)
        location = m.group(5)
        key = link
        if key in seen:
            continue
        seen.add(key)
        leads.append([title, price, currency, location, link, "OLX"])

    # Fallback: simple anchor parsing if JSON-LD regex misses.
    if not leads:
        for href, title in re.findall(r'<a href="(/item/[^"]+)" title="([^"]+)"', html):
            if href in seen:
                continue
            seen.add(href)
            leads.append([title, "", "", "", "https://www.olx.com.pk" + href, "OLX"])

    print(f"📦 عدد النتائج: {len(leads)}")
    return leads


def main():
    leads = scrape()
    with open("olx_leads.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["العنوان", "السعر", "العملة", "الموقع", "الرابط", "المصدر"])
        w.writerows(leads)
    print(f"✅ تم حفظ {len(leads)} إعلان في olx_leads.csv")


if __name__ == "__main__":
    main()
