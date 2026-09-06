import urllib.request
import json
import urllib.parse

loterias = [
    "boyaca",
    "cauca",
    "cruz roja",
    "huila",
    "manizales",
    "meta",
    "quindio",
    "risaralda",
    "valle",
    "tolima premio mayor",
    "extra de colombia",
    "cundinamarca premio mayor",
]

for nombre in loterias:
    q = urllib.parse.quote(nombre)
    url = f"https://api.us.socrata.com/api/catalog/v1?domains=www.datos.gov.co&q={q}&limit=10"
    with urllib.request.urlopen(url) as resp:
        data = json.load(resp)
    print(f"--- {nombre.upper()} ---")
    for r in data["results"]:
        res = r["resource"]
        print(f"  {res['id']:12} | {res['data_updated_at'][:10]} | {res['name']}")
    print()