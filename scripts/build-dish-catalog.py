#!/usr/bin/env python3
"""
Builds data/dish-catalog.json: a de-duplicated list of dish names for scripts/enrich-cache.ts.

Sources (names and categories only; nutrition is added later by the enrich script):
  • INDB (data/indian-foods.json, run scripts/build-indian-foods.py first)
  • 6000+ Indian Food Recipes Dataset (Archana's Kitchen), Kanishk Jain, 2020
    https://github.com/kanishk307/IndianFoodDatasetGeneration · Mendeley Data doi:10.17632/xsphgmmh7b.1
  • Wikipedia "List of Indian dishes" (CC BY-SA 4.0)

Usage:  python3 -I scripts/build-dish-catalog.py
Standard library only. Commit the generated JSON.
"""
from __future__ import annotations

import csv
import io
import json
import re
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDB_FILE = ROOT / "data" / "indian-foods.json"
OUT = ROOT / "data" / "dish-catalog.json"
AK_URL = "https://raw.githubusercontent.com/kanishk307/IndianFoodDatasetGeneration/main/Dataset/IndianFoodDatasetCSV.csv"
WIKI_URL = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(
    {"action": "parse", "page": "List of Indian dishes", "prop": "wikitext", "format": "json", "formatversion": "2"}
)

NON_INDIAN = {
    "continental", "italian recipes", "mexican", "chinese", "thai", "japanese", "korean", "vietnamese", "french",
    "greek", "lebanese", "middle eastern", "mediterranean", "american", "british", "european", "indonesian",
    "malaysian", "burmese", "sri lankan", "nepalese", "afghan", "arab", "african", "caribbean", "spanish",
    "german", "swedish", "jewish", "russian", "brazilian", "cuban", "hawaiian", "singapore", "asian", "world breakfast",
}
STOP = {"and", "with", "the", "a", "an", "of", "in", "recipe", "recipes"}


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "CrazyRep catalog build (chinmaicoder@gmail.com)"})
    with urllib.request.urlopen(req, timeout=180) as res:
        return res.read()


def dedupe_key(name: str) -> str:
    """'Aloo Gobi' and 'gobi aloo' are the same dish; word order and punctuation don't matter."""
    words = [w for w in re.split(r"[^a-z]+", name.lower()) if w and w not in STOP]
    words = [w[:-1] if len(w) > 3 and w.endswith("s") and not w.endswith("ss") else w for w in words]
    return " ".join(sorted(words))


def clean(name: str) -> tuple[str, list[str]]:
    """'Mixed Veg Koora Recipe - Mixed Vegetable Poriyal' → ('Mixed Veg Koora', ['Mixed Vegetable Poriyal'])."""
    name = re.sub(r"\(\s*recipe in [a-z]+\s*\)", "", name, flags=re.I)
    name = re.sub(r"\brecipe(s)?\b", "", name, flags=re.I)
    # "… Made Using Preethi Electric Pressure Cooker", "… in an Air Fryer" describe the method, not the dish
    name = re.sub(r"\s+(made\s+)?using\s+.*$", "", name, flags=re.I)
    name = re.sub(r"\s+(made\s+)?in\s+(a|an|the)?\s*(pressure cooker|oven|air fryer|microwave|instant pot|otg|kadai|tawa)\b.*$", "", name, flags=re.I)
    parts = [p.strip(" -–|") for p in re.split(r"\s+[-–|]\s+", name) if p.strip(" -–|")]
    main = parts[0] if parts else ""
    aliases = parts[1:]
    for paren in re.findall(r"\(([^)]*)\)", main):
        if paren.strip():
            aliases.append(paren.strip())
    main = re.sub(r"\([^)]*\)", "", main)
    tidy = lambda s: re.sub(r"\s+", " ", s).strip(" ,.-")
    main = tidy(main)
    aliases = [tidy(a) for a in aliases if tidy(a) and tidy(a).lower() != main.lower()]
    return main, aliases


catalog: dict[str, dict] = {}


def add(name: str, aliases: list[str], source: str, cuisine: str | None = None, course: str | None = None, diet: str | None = None, indian: bool = True):
    if not name or len(name) < 3 or len(name) > 80 or not re.search(r"[A-Za-z]{3}", name):
        return
    key = dedupe_key(name)
    if not key:
        return
    item = catalog.setdefault(key, {"name": name, "aliases": [], "cuisine": cuisine, "course": course, "diet": diet, "indian": indian, "sources": []})
    for a in aliases:
        if a not in item["aliases"] and a.lower() != item["name"].lower():
            item["aliases"].append(a)
    if source not in item["sources"]:
        item["sources"].append(source)
    item["indian"] = item["indian"] or indian
    for field, value in (("cuisine", cuisine), ("course", course), ("diet", diet)):
        if value and not item[field]:
            item[field] = value


def from_indb():
    for food in json.loads(INDB_FILE.read_text())["indb"]:
        main, aliases = clean(food["name"])
        add(main, aliases + food.get("aliases", []), "indb", cuisine="Indian")


def from_archanas_kitchen():
    text = fetch(AK_URL).decode("utf-8-sig", errors="replace")
    for r in csv.DictReader(io.StringIO(text)):
        main, aliases = clean(r.get("TranslatedRecipeName") or "")
        cuisine = (r.get("Cuisine") or "").replace("﻿", "").strip()
        indian = cuisine.lower() not in NON_INDIAN
        add(main, aliases, "archanas-kitchen", cuisine=cuisine or None, course=(r.get("Course") or "").strip() or None, diet=(r.get("Diet") or "").strip() or None, indian=indian)


def from_wikipedia():
    wikitext = json.loads(fetch(WIKI_URL))["parse"]["wikitext"]
    region = None
    for line in wikitext.splitlines():
        heading = re.match(r"^==+\s*(.+?)\s*==+$", line)
        if heading:
            region = re.sub(r"\[\[|\]\]", "", heading.group(1))
            continue
        # Table rows start with "|" and the first cell is the dish name: | [[Biryani]] || ...
        if line.startswith("|") and not line.startswith(("|-", "|}", "|+")):
            cell = line[1:].split("||")[0]
            link = re.search(r"\[\[(?:[^|\]]*\|)?([^\]]+)\]\]", cell)
            name = (link.group(1) if link else re.sub(r"<[^>]+>|'''?|\{\{[^}]*\}\}", "", cell)).strip()
            # skip image captions, descriptions ("A sweet Bengali speciality.") and lower-case ingredients ("besan")
            if (
                name
                and name[0].isupper()
                and not re.search(r"[=|]|px\b|\.$", name)
                and len(name.split()) <= 5
                and not name.lower().startswith(("style", "class", "align", "rowspan", "colspan", "scope"))
            ):
                add(name, [], "wikipedia", cuisine=region)


def main():
    from_indb()
    counts = {"indb": len(catalog)}
    from_archanas_kitchen()
    counts["after archanas-kitchen"] = len(catalog)
    try:
        from_wikipedia()
    except Exception as exc:  # optional source; keep going if Wikipedia is unreachable
        print("Wikipedia skipped:", exc)
    counts["after wikipedia"] = len(catalog)
    items = sorted(catalog.values(), key=lambda d: (not d["indian"], d["name"].lower()))
    OUT.write_text(json.dumps({"sources": {
        "indb": "Indian Nutrient Databank (INDB), Vijayakumar et al., Curr Dev Nutr 2024",
        "archanas-kitchen": "6000+ Indian Food Recipes Dataset (Archana's Kitchen), Kanishk Jain 2020",
        "wikipedia": "Wikipedia, List of Indian dishes (CC BY-SA 4.0)",
    }, "dishes": items}, ensure_ascii=False, indent=0))
    indian = sum(1 for d in items if d["indian"])
    print(f"Wrote {OUT} · {len(items)} dishes ({indian} Indian) · {counts}")


if __name__ == "__main__":
    main()
