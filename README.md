# Mandate · Europe
Buildless HTML/CSS/Canvas strategy sandbox. Serve `dist/` over HTTP; no build or external JavaScript dependencies required. The game has 50 selectable states, three scenario modes, monthly economy and elections, diplomacy, coalition defence, gradual territorial campaigns, and local browser saves.

Country geometry: datasets/geo-countries, Natural Earth, public domain. Settlement data: GeoNames cities500, CC BY 4.0. Attribution and scenario limitations are available in-game. Data preparation is reproducible with `prepare.py`, Shapely, the geo-countries countries.geojson download saved as countries-source.geojson and the GeoNames cities500.zip download saved as cities.zip.

Run logic checks with `node verify.cjs`. All country economy/force statistics are illustrative game values. The 2026 control mode uses the 27 October 2026 DeepStateMap reported-control polygon via cyterat/deepstate-map-data, clipped to Ukraine and lightly simplified. It begins in October 2026 with an active Russia–Ukraine war. A shared control mesh starts from the dated occupation polygon; both sides can gain or recapture adjacent hex sectors each month. Unchanged borders retain the original polygon detail. Strength, readiness, posture, aid, and local variation determine simulated movement. Ceasefires preserve current control; reloading never resets a running front. This is a game simulation, not a forecast. This is a dated snapshot, not live battlefield data. Occupation data is separately distributed under GPL-3.0; see dist/CONTROL-LICENSE.txt and dist/occupation.json for provenance. National election systems and alliance procedures are simplified.

## Run locally

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. Settlement data is split into JSON parts listed in `dist/places.json`; all parts are required. The repository’s existing AGPL-3.0 LICENSE is preserved. Third-party data retains its documented licenses.

## Autonomous governments

`dist/simulation.js` implements seeded monthly AI decisions. Country profiles have distinct economic, welfare, security, neutrality or influence priorities; these are illustrative game personalities. Non-player governments respond to budget pressure and public events, invest, recruit, improve relations, sign trade agreements and defence pacts, send Ukraine aid, and undergo modeled elections. They can send the player proposals for acceptance in Cabinet. Highly aggressive AI may initiate a campaign against a sufficiently weak, hostile rival; it checks coalition strength first. The player retains control of their own domestic policy. Inspect any country to see its agenda and latest decision.

In the 2026 control scenario, the Ukraine front runs even if the player chooses another country. Russia and Ukraine can select their posture in Forces. Save files from the previous static scenario are migrated; existing Russian gains from old Ukrainian campaigns are folded into control. Existing Ukrainian campaigns inside Russia remain separate. Countries and economic statistics remain simplified.
