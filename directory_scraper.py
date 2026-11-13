import csv
import re
import time
import requests

BASE = "https://www.140online.com"
SEARCH_TERM = "كفر الشيخ"
TIMEOUT = 15
HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; DotStudio-POS/1.0)"}


def get_viewstate(html):
    vs = re.search(r'id="__VIEWSTATE" value="([^"]+)"', html)
    ev = re.search(r'id="__EVENTVALIDATION" value="([^"]+)"', html)
    vg = re.search(r'id="__VIEWSTATEGENERATOR" value="([^"]+)"', html)
    return (
        vs.group(1) if vs else "",
        ev.group(1) if ev else "",
        vg.group(1) if vg else "",
    )


def search(term):
    r = requests.get(BASE + "/", headers=HEADERS, timeout=TIMEOUT)
    r.raise_for_status()
    vs, ev, vg = get_viewstate(r.text)
    data = {
        "__VIEWSTATE": vs,
        "__EVENTVALIDATION": ev,
        "__VIEWSTATEGENERATOR": vg,
        "Search1$txtSearch": term,
        "Search1$btnSearch": "",
    }
    r2 = requests.post(BASE + "/", data=data, headers=HEADERS, timeout=TIMEOUT)
    r2.raise_for_status()
    links = re.findall(r"href=['\"](/company/[^'\"]+)['\"]", r2.text)
    # Normalize to unique company ids
    ids = set()
    for l in links:
        m = re.search(r'/company/([^/]+)/', l)
        if m:
            ids.add(m.group(1))
    return list(ids)


def fetch_company(cid):
    # Use canonical company.aspx URL with id only
    url = BASE + "/company.aspx?CompanyId=" + cid
    r = requests.get(url, headers=HEADERS, timeout=TIMEOUT)
    r.raise_for_status()
    html = r.text

    # Name from og:title
    name_m = re.search(r'property="og:title" content="([^"]+)"', html)
    name = name_m.group(1).strip() if name_m else cid

    # Category from article:section
    cat_m = re.search(r'property="article:section" content="([^"]+)"', html)
    category = cat_m.group(1).strip() if cat_m else ""

    # Address: first branch address link text
    addr_m = re.search(r"العنوان\s*</span>\s*</td>\s*<td>\s*(?:<a[^>]*>)?([^<]+)", html)
    address = addr_m.group(1).strip() if addr_m else ""

    # Phones: collect spans after تليفونات
    phones = set(re.findall(r"0\d[\d\- ]{6,}", html))
    phone = " / ".join(sorted(phones)) if phones else ""

    return [name, category, address, phone, "140online.com"]


def main():
    print("⏳ جاري سحب البيانات من 140online.com ...")
    try:
        ids = search(SEARCH_TERM)
    except Exception as e:
        print("❌ فشل البحث:", e)
        return
    print(f"📦 عدد الشركات: {len(ids)}")

    rows = []
    for i, cid in enumerate(ids, 1):
        try:
            row = fetch_company(cid)
            rows.append(row)
            print(f"  [{i}/{len(ids)}] {row[0]}")
        except Exception as e:
            print(f"  [{i}/{len(ids)}] ❌ {cid}: {e}")
        time.sleep(0.5)

    with open("directory_businesses.csv", "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["الاسم", "التصنيف", "العنوان", "رقم الهاتف", "المصدر"])
        w.writerows(rows)

    print(f"✅ تم حفظ {len(rows)} شركة في directory_businesses.csv")


if __name__ == "__main__":
    main()