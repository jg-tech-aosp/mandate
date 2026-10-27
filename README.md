# Mandate · Europe
Buildless HTML/CSS/Canvas strategy sandbox. Serve `dist/` over HTTP; no build or external JavaScript dependencies required. The game has 50 selectable states, three scenario modes, monthly economy and elections, diplomacy, coalition defence, gradual territorial campaigns, and local browser saves.

Country geometry: datasets/geo-countries, Natural Earth, public domain. Settlement data: GeoNames cities500, CC BY 4.0. Attribution and scenario limitations are available in-game. Data preparation is reproducible with `prepare.py`, Shapely, the geo-countries countries.geojson download saved as countries-source.geojson and the GeoNames cities500.zip download saved as cities.zip.

Run logic checks with `node verify.cjs`. All country economy/force statistics are illustrative game values. The 2026 control mode uses the 27 October 2026 DeepStateMap reported-control polygon via cyterat/deepstate-map-data, clipped to Ukraine and lightly simplified. It begins in October 2026 at a gameplay ceasefire: the initial occupied zone is fixed, while newly declared wars use the monthly campaign simulation. Existing campaigns do not automatically liberate or modify the initial scenario polygon. This is a dated snapshot, not live battlefield data. Occupation data is separately distributed under GPL-3.0; see dist/CONTROL-LICENSE.txt and dist/occupation.json for provenance. National election systems and alliance procedures are simplified.

## Run locally

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. Settlement data is split into JSON parts listed in `dist/places.json`; all parts are required. The repository’s existing AGPL-3.0 LICENSE is preserved. Third-party data retains its documented licenses.
