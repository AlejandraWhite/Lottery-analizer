"""
Diagnóstico rápido: guarda en disco lo que requests recibe realmente de
resultadodelaloteria.com para Risaralda, para ver si es la página real
o algo distinto (challenge anti-bot, redirección, etc).

Uso:
    python -m scrapers.debug_fetch
"""

import requests

url = "https://resultadodelaloteria.com/colombia/loteria-de-risaralda"
resp = requests.get(url, headers={"User-Agent": "Mozilla/5.0"}, timeout=15)

print("status_code:", resp.status_code)
print("url final (por si hubo redirect):", resp.url)
print("largo del contenido:", len(resp.text))
print("primeros 1000 caracteres:")
print(resp.text[:1000])

with open("debug_risaralda.html", "w", encoding="utf-8") as f:
    f.write(resp.text)

print("\nSe guardó el HTML completo en debug_risaralda.html — ábrelo y busca")
print("si aparece 'Risaralda' y el número del sorteo en algún lado.")