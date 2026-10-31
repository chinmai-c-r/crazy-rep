#!/usr/bin/env python3
"""
Builds data/indian-foods.json from two open Indian food databases (input for scripts/enrich-cache.ts).

  • INDB, Indian Nutrient Databank: 1,014 commonly eaten Indian recipes, per 100 g and per serving.
    Vijayakumar A, Dubasi HB, Awasthi A, Jaacks LM. Development of an Indian Food Composition
    Database. Curr Dev Nutr. 2024;8(7):103790. doi:10.1016/j.cdnut.2024.103790
    https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-
  • IFCT 2017, Indian Food Composition Tables: 542 raw foods measured by ICMR-NIN, Hyderabad.
    Longvah T, et al. Indian Food Composition Tables 2017. National Institute of Nutrition.
    Data via https://github.com/ifct2017/compositions (Zenodo record 7088590).

Usage:  python3 -I scripts/build-indian-foods.py
Standard library only. Re-run to refresh the data; commit the generated JSON.
"""
from __future__ import annotations

import csv
import io
import json
import re
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
import zipfile
from datetime import date
from pathlib import Path

INDB_URL = "https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-/raw/refs/heads/main/INDB.xlsx"
IFCT_URL = "https://zenodo.org/records/7088590/files/ifct2017/compositions-2.0.5.zip?download=1"
OUT = Path(__file__).resolve().parent.parent / "data" / "indian-foods.json"

# Common names people type → the exact INDB dish. Every target is checked at build time.
INDB_ALIASES = {
    "Paneer in butter sauce": ["paneer butter masala", "paneer makhani", "paneer makhanwala"],
    "Chickpeas curry (Safed channa curry)": ["chole", "chana masala", "chole masala", "chickpea curry"],
    "Kidney bean curry (Rajmah curry)": ["rajma", "rajma masala"],
    "Hot tea (Garam Chai)": ["chai", "tea", "masala chai", "milk tea"],
    "Spinach paneer (Palak paneer)": ["saag paneer"],
    "Boiled rice (Uble chawal)": ["plain rice", "steamed rice", "white rice", "chawal"],
}


def fetch(url: str, dest: Path) -> Path:
    req = urllib.request.Request(url, headers={"User-Agent": "CrazyRep data build"})
    with urllib.request.urlopen(req, timeout=120) as res, open(dest, "wb") as f:
        f.write(res.read())
    return dest


def read_xlsx_first_sheet(path: Path) -> list[dict]:
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    z = zipfile.ZipFile(path)
    shared = []
    if "xl/sharedStrings.xml" in z.namelist():
        for si in ET.fromstring(z.read("xl/sharedStrings.xml")).findall("m:si", ns):
            shared.append("".join(t.text or "" for t in si.iter(f"{{{ns['m']}}}t")))

    def col(ref: str) -> int:
        n = 0
        for ch in re.match(r"[A-Z]+", ref).group(0):
            n = n * 26 + ord(ch) - 64
        return n - 1

    rows = []
    for r in ET.fromstring(z.read("xl/worksheets/sheet1.xml")).iter(f"{{{ns['m']}}}row"):
        row = {}
        for c in r.findall("m:c", ns):
            v = c.find("m:v", ns)
            if v is not None:
                row[col(c.get("r"))] = shared[int(v.text)] if c.get("t") == "s" else v.text
        if row:
            rows.append([row.get(i) for i in range(max(row) + 1)])
    header = rows[0]
    return [dict(zip(header, r)) for r in rows[1:]]


def num(v, scale=1.0):
    try:
        x = float(v) * scale
    except (TypeError, ValueError):
        return 0.0
    return round(x, 2) if x > 0 else 0.0


def build_indb(path: Path) -> list[dict]:
    foods = []
    names = set()
    for d in read_xlsx_first_sheet(path):
        name = (d.get("food_name") or "").strip()
        kcal = num(d.get("energy_kcal"))
        if not name or kcal <= 0:
            continue
        names.add(name)
        serving_kcal = num(d.get("unit_serving_energy_kcal"))
        unit = (d.get("servings_unit") or "").strip().lower() or None
        foods.append({
            "code": d["food_code"],
            "name": name,
            "aliases": INDB_ALIASES.get(name, []),
            "per100": {
                "calories": kcal,
                "protein_g": num(d.get("protein_g")),
                "carbs_g": num(d.get("carb_g")),
                "fat_g": num(d.get("fat_g")),
                "fiber_g": num(d.get("fibre_g")),
                "sugar_g": num(d.get("freesugar_g")),
                "saturated_fat_g": num(d.get("sfa_mg"), 0.001),
                "sodium_mg": num(d.get("sodium_mg")),
                "cholesterol_mg": num(d.get("cholesterol_mg")),
            },
            "serving_unit": unit if serving_kcal > 0 else None,
            "serving_g": round(serving_kcal / kcal * 100, 1) if serving_kcal > 0 else None,
        })
    missing = [n for n in INDB_ALIASES if n not in names]
    if missing:
        raise SystemExit(f"INDB_ALIASES point at unknown dishes: {missing}")
    return foods


def build_ifct(path: Path) -> list[dict]:
    z = zipfile.ZipFile(path)
    index = next(n for n in z.namelist() if n.endswith("/index.csv"))
    foods = []
    for r in csv.DictReader(io.StringIO(z.read(index).decode("utf-8"))):
        protein, fat, carbs = num(r.get("protcnt")), num(r.get("fatce")), num(r.get("choavldf"))
        kcal = num(r.get("enerc"), 1 / 4.184)  # IFCT energy is in kJ
        if kcal <= 0:  # some oils have no energy value; use Atwater factors
            kcal = round(protein * 4 + carbs * 4 + fat * 9, 2)
        if kcal <= 0:
            continue
        # Keep Hindi (H.) and English (E.) names only; other languages collide too often
        # (Manipuri "Channa" means paneer, but users typing "chana" mean chickpeas).
        local = []
        for part in (r.get("lang") or "").split(";"):
            m = re.match(r"^\s*([A-Za-z]{1,5})\.\s*(.+?)[\s.]*$", part)
            if m and m.group(1) in ("H", "E"):
                local.append(m.group(2))
        foods.append({
            "code": r["code"],
            "name": r["name"].strip(),
            "group": r["grup"].strip(),
            "aliases": [n for n in local if n],
            "per100": {
                "calories": kcal,
                "protein_g": protein,
                "carbs_g": carbs,
                "fat_g": fat,
                "fiber_g": num(r.get("fibtg")),
                "sugar_g": num(r.get("fsugar")),
                "saturated_fat_g": num(r.get("fasat")),
                "sodium_mg": num(r.get("na"), 1000),  # IFCT sodium is in g
                "cholesterol_mg": num(r.get("cholc")),
            },
        })
    return foods


def main():
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        indb = build_indb(fetch(INDB_URL, tmp / "INDB.xlsx"))
        ifct = build_ifct(fetch(IFCT_URL, tmp / "ifct.zip"))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({
        "generated": date.today().isoformat(),
        "sources": {
            "indb": "Indian Nutrient Databank (INDB), Vijayakumar et al., Curr Dev Nutr 2024. doi:10.1016/j.cdnut.2024.103790",
            "ifct": "Indian Food Composition Tables 2017, ICMR-National Institute of Nutrition, Hyderabad",
        },
        "indb": indb,
        "ifct": ifct,
    }, ensure_ascii=False, separators=(",", ":")))
    print(f"Wrote {OUT} · INDB {len(indb)} dishes · IFCT {len(ifct)} foods · {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
