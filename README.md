# Aardvarkland Process Lab

[Česky](#česky) · [Open preview](https://michalmachalik.github.io/Aardvarkland-Process-Lab/)

| Workflow | What to try |
| --- | --- |
| [Quote preparation](https://michalmachalik.github.io/Aardvarkland-Process-Lab/#nabidky) | Load an email and item CSV, approve the quote, and retry a CRM write after a lost acknowledgement. |
| [Run monitor](https://michalmachalik.github.io/Aardvarkland-Process-Lab/#provoz) | Simulate an outage, recover under the same run ID and inspect both structured events. |
| [Catalog validation](https://michalmachalik.github.io/Aardvarkland-Process-Lab/#katalog) | Remove an unsupported size or correct it against the supplier record before approval. |
| [Internal approvals](https://michalmachalik.github.io/Aardvarkland-Process-Lab/#schvalovani) | Route a request, switch roles, return it and review the approval history. |
| [Support desk](https://michalmachalik.github.io/Aardvarkland-Process-Lab/#podpora) | Check a cited answer, remove a necessary source and hand the unresolved case to an operator. |
| [Bookings](https://michalmachalik.github.io/Aardvarkland-Process-Lab/#rezervace) · [Venue hire](https://michalmachalik.github.io/Aardvarkland-Process-Lab/#eventy) | Price a fixed-day reservation, reject overlaps and reuse the same confirmation on repeat. |

All files and records are fictional. Browser state, roles, CRM writes and the provider failure are simulated in the preview. The browser stores changes locally. The quote importer expects the included UTF-8 email and separate semicolon-delimited attachment.

## Run locally

```sh
npm ci --ignore-scripts
npm test
python -m unittest discover -s test -p 'test_*.py'
npm run dev
```

The optional monitor loads and writes an actual SQLite event log. Start it with `python server/monitor.py` (port 4188), then start Vite with `VITE_CONNECTOR=live`. Point `TRACE_DB` to a fresh local SQLite file for a clean run. The API exposes `GET /health`, `GET /api/run`, and `POST /api/run` with `{"available":false}` or `{"available":true}`. A successful run remains complete when repeated. CI builds and exercises the same service from the included Dockerfile.

MIT license. Third-party font and bundle notices are included in the build.

## Česky

[Otevřít ukázku](https://michalmachalik.github.io/Aardvarkland-Process-Lab/)

Načtěte nabídku z e-mailu a souboru CSV, ověřte bezpečné opakování po výpadku, zkontrolujte popis proti feedu, projděte interní schválení nebo vyzkoušejte citovanou odpověď. Rezervace a pronájem sdílejí kalendář jednoho ukázkového dne a odmítají časové překryvy ve stejném prostoru.

Veřejná ukázka používá fiktivní data a ukládá stav v prohlížeči. CRM i výpadek služby jsou simulované. Lokální Python služba ukládá pokusy do SQLite, zapisuje strukturované události a má test kontejneru v CI. Příkazy jsou v anglické části.
