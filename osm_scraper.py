import csv
import requests
import time

TIMEOUT = 15
HEADERS = {"User-Agent": "DotStudio-POS/1.0"}
MIRRORS = [
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass-api.de/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
]

QUERY = """
[out:json][timeout:15];
area["name:ar"="كفر الشيخ"]->.searchArea;
(
  node["amenity"~"restaurant|cafe|fast_food|pharmacy"](area.searchArea);
  node["shop"~"clothes|electronics|supermarket|bakery"](area.searchArea);
);
out body;
"""

def fetch_osm():
    print("⏳ جاري سحب البيانات من OpenStreetMap...")
    data = None
    for url in MIRRORS:
        try:
            print(f"📡 محاولة: {url}")
            response = requests.post(url, data={"data": QUERY}, headers=HEADERS, timeout=TIMEOUT)
            print(f"   حالة السيرفر: {response.status_code}")
            if response.status_code == 200:
                data = response.json()
                break
        except Exception as e:
            print(f"   ❌ {e}")
    if data is None:
        print("❌ تعذر الاتصال بـ OpenStreetMap. الاحتفاظ بالملف الحالي.")
        return

    leads = []
    elements = data.get("elements", [])
    print(f"📦 عدد النتائج الخام: {len(elements)}")
    for el in elements:
        tags = el.get("tags", {})
        name = tags.get("name", tags.get("name:ar", "بدون اسم"))
        phone = tags.get("phone", tags.get("contact:phone", "لا يوجد"))
        cat = tags.get("amenity", tags.get("shop", "نشاط"))
        if name and name != "بدون اسم":
            leads.append([name, cat, phone, "OpenStreetMap"])

    if not leads:
        print("⚠️ لم يتم العثور على نتائج جديدة. الاحتفاظ بالملف الحالي.")
        return

    with open("osm_businesses.csv", "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["الاسم", "النشاط", "رقم الهاتف", "المصدر"])
        writer.writerows(leads)

    print(f"✅ تم حفظ {len(leads)} محل في ملف osm_businesses.csv")

fetch_osm()