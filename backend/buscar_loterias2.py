import urllib.request
import json
import urllib.parse

consultas = [
    "premio mayor loteria",
    "resultados sorteo loteria",
    "vista coljuegos loteria",
]

for q_texto in consultas:
    q = urllib.parse.quote(q_texto)
    url = f"https://api.us.socrata.com/api/catalog/v1?domains=www.datos.gov.co&q={q}&limit=40"
    with urllib.request.urlopen(url) as resp:
        data = json.load(resp)
    print(f"=== BUSQUEDA: {q_texto} ===")
    for r in data["results"]:
        res = r["resource"]
        print(f"  {res['id']:12} | {res['data_updated_at'][:10]} | {res['name']}")
    print()