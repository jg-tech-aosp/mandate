# Mandate · Europe
Buildless HTML/CSS/Canvas strategy sandbox. Serve `dist/` over HTTP; no build or external JavaScript dependencies required. The game has 50 selectable states, three scenario modes, monthly economy and elections, diplomacy, coalition defence, gradual territorial campaigns, and local browser saves.

Country geometry: datasets/geo-countries, Natural Earth, public domain. Settlement data: GeoNames cities500, CC BY 4.0. Attribution and scenario limitations are available in-game. Data preparation is reproducible with `prepare.py`, Shapely, the geo-countries countries.geojson download saved as countries-source.geojson and the GeoNames cities500.zip download saved as cities.zip.

Run logic checks with `node verify.cjs`. All country economy/force statistics are illustrative game values. The 2026 control mode uses the 27 October 2026 DeepStateMap reported-control polygon via cyterat/deepstate-map-data, clipped to Ukraine and lightly simplified. It begins in October 2026 with an active Russia–Ukraine war. A shared control mesh starts from the dated occupation polygon; both sides can gain or recapture adjacent hex sectors each month. The starting occupation and all subsequent changes use the same fine combat hex grid. Strength, readiness, posture, aid, and local variation determine simulated movement. Ceasefires preserve current control; reloading never resets a running front. This is a game simulation, not a forecast. This is a dated snapshot, not live battlefield data. Occupation data is separately distributed under GPL-3.0; see dist/CONTROL-LICENSE.txt and dist/occupation.json for provenance. National election systems and alliance procedures are simplified.

## Run locally

```sh
python3 -m http.server 8000 --directory dist
```

Open http://localhost:8000. Settlement data is split into JSON parts listed in `dist/places.json`; all parts are required. The repository’s existing AGPL-3.0 LICENSE is preserved. Third-party data retains its documented licenses.

## Autonomous governments

`dist/simulation.js` implements seeded monthly AI decisions; `dist/warfare.js` implements shared territorial control. Country profiles have distinct economic, welfare, security, neutrality or influence priorities; these are illustrative game personalities. Non-player governments respond to budget pressure and public events, invest, recruit, improve relations, sign trade agreements and defence pacts, send Ukraine aid, and undergo modeled elections. They can send the player proposals for acceptance in Cabinet. Highly aggressive AI may initiate a campaign against a sufficiently weak, hostile rival; it checks coalition strength first. The player retains control of their own domestic policy. Inspect any country to see its agenda and latest decision.

In the 2026 control scenario, the Ukraine front runs even if the player chooses another country. Russia and Ukraine can select their posture in Forces. Save files from the previous static scenario are migrated; existing Russian gains from old Ukrainian campaigns are folded into control. Legacy paired invasions are consolidated by the warfare-v3 migration described below. Countries and economic statistics remain simplified.

## Shared fronts and morale (warfare v3)

Every war now uses one shared line of control. `state.control` stores a single controller per fine global hex; the engine cannot paint two independent invasions over the same territory. The hex radius is 0.016 degrees of latitude (roughly 1.8 km), with a longitude adjustment; unlike the previous adaptive grids, Russia does not get enormous cells. Only the frontline band and actual control changes are stored. Land wars start on the actual shared border; non-adjacent wars use one supplied beachhead instead of mirrored invasions. Each turn chooses a front winner and advances connected sectors. Counterattacks prioritize lost home territory.

The initiating country gets a 25% initiative multiplier for exactly the first three resolved monthly turns. It is not renewed by resuming a ceasefire; the already-running 2026 Ukraine war gets no new opening bonus. Afterwards, force, readiness, morale, posture, coalition defence, fatigue, government support, debt and supply drive the outcome. Major-city capture or liberation raises the winner's morale and lowers the loser's: +/−4 for a major city, +/−7 for one with 500,000+ residents, and +/−10 for a capital. Public support also changes. A six-month per-city cooldown prevents repeated capture farming. A capital held for three turns can contribute to capitulation only when military strength or morale has also collapsed.

Existing v2 Ukraine-front gains and ceasefires migrate to the finer grid. The old, contradictory paired generic invasions restart at their shared border; forces, budgets, political progress and all other save data are retained. Before converting such a browser save, the game keeps a backup under `mandate-before-shared-front` when storage space permits. New control, war age, morale and city cooldowns persist across saves.

## Occupation map rendering

The dated occupation polygon is sampled by hex centre using the exact `wcBase` controller rule. A cached union outline follows those hex edges, so the initial Russian occupation and combat frontline agree with each other. Coasts remain clipped to the geographic country boundary. New advances, liberated cells and starting occupation use one consistent palette: occupied foreign territory is a darker shade (66% RGB brightness) of the controlling country; recovered home territory returns to its normal country shade. The same treatment applies to legacy occupations and capitulated countries. The legend identifies occupied fill and the frontline. This is a rendering update; saved territorial control and war progress do not reset.
