# Map coverage audit: Abuja

Audit date: 2026-11-09. Tool: `scripts/compare-map-styles.ts`.

## Method

Six areas were resolved once through Places Text Search, and their coordinates were saved to `scripts/map-audit-locations.json`. Each area was captured with Google Static Maps at zooms 13, 15 and 17 in three versions:

- `google-default`: Google's unstyled map, which shows what is in Google's data.
- `pantra-before`: the previous Pantra style.
- `pantra-after`: the new style (`constants/map-style.ts`).

Each pair uses the same centre and zoom.

This separates two cases:

- **Hidden by our style:** visible in `google-default` but missing from Pantra.
- **Missing from Google's data:** absent from `google-default` as well.

To regenerate the comparison, run:

```
bun scripts/compare-map-styles.ts --label after
```

This writes `testing/artifacts/map-styles/index.html`, which is gitignored.

Static Maps uses the same style rules as the Android SDK. The phone is still the final check, because label placement and how many POIs appear differ slightly between the two.

## Findings

| Area | Character | Coordinates | Google data | Before (old style) | After |
|---|---|---|---|---|---|
| Wuse 2 | Dense commercial centre | 9.078749, 7.470186 | Dense. Streets named down to closes (Parakou St, Oda Cres, Fandriana Cl); many shops, cafés, schools. | Major road names only. No minor street names, no landmarks. | Everything in Google's data is visible |
| Garki | Dense mixed government and commercial | 9.031896, 7.482812 | Dense. Garki Hospital, pharmacies, hotels, banks. | Area names only | Everything in Google's data is visible |
| Gwarinpa | Planned residential estate | 9.10989, 7.404241 | Dense. Numbered and named avenues, restaurants, churches. | Only a few road names | Everything in Google's data is visible |
| Kubwa | Large residential satellite town | 9.149075, 7.326806 | Dense. Named roads (Gado Nasko Rd, NYSC Rd), hotels, malls. | Major roads only, faint | Everything in Google's data is visible |
| Lugbe | Fast-growing fringe settlement | 8.964086, 7.381371 | Good. Named streets in the estates, shops, event centres. | Faint road outlines only | Everything in Google's data is visible |
| Mararaba (Nasarawa) | Less-developed settlement | 9.026682, 7.607355 | **Road layout complete, but most streets have no name.** Landmarks are well covered: Mararaba Market, New Orange Market, Orange Market Junction, Muhammad Buhari International Market, King's Care Hospital, mosques, schools. | Blank beige; streets nearly invisible | Streets and all landmarks visible. Street names are still absent because Google has none. |

## Conclusion

The bland look came almost entirely from our style, not from Google's data. The old style turned off:

- every point of interest;
- every map icon;
- every local street name.

It also drew minor roads almost the same colour as the land.

With the new style, every area shows everything Google's data contains.

## Coverage limitations (Google data)

1. **Unnamed streets in less-developed settlements.** In Mararaba, Google has the road layout but almost no street names. Riders and drivers there have to navigate by landmarks (markets, mosques, schools, hospitals). Those landmarks are present and now visible. Expect the same in other fringe settlements around Abuja (likely Nyanya, Karu, parts of Lugbe and Kubwa extensions), but only Mararaba was checked.
2. **Not covered by this audit:** areas outside the six points above. Lagos was not audited.

## Alternative data sources (not built)

For the unnamed-street problem, the candidate is **OpenStreetMap**, whose Nigerian coverage is partly community-mapped. It would need a separate check:

- Does OSM have street names where Google doesn't (start with Mararaba at the coordinates above)?
- How fresh is it?
- What would showing it involve? It can't be layered into Google's base map, so it would mean an overlay or a provider change.

That is a separate decision. Nothing in the app uses OSM today.
