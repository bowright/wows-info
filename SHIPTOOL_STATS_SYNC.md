# ShipTool statistics synchronization

`wows-info` uses ShipTool’s public aggregate statistics bundles for the server-statistics view.

The sync importer downloads the public EU, NA, and Asia bundles for:

- the current update (`1`)
- the latest three updates (`3`)
- all-time (`all`)

It validates the upstream version, ship coverage, raw counters, catalog fingerprint, and region/span metadata before publishing. The sync service publishes new generations behind a manifest pointer, so an interrupted update cannot mix files from different upstream versions. The service worker refreshes that pointer network-first and keeps the last validated generation for offline use.

Premium-only annual/full bundles and unsupported Top 1% data are not synthesized or exposed. PR is calculated locally from the repository’s class/tier community baselines because ShipTool does not publish PR expectation values in the public aggregate bundle.

Run a manual refresh with:

```bash
npm run sync
```

The current source, upstream version, catalog fingerprint, cache generation, and freshness state are recorded in `public/data/stats/manifest.json`. The production sync daemon also exposes these fields through `/api/status`.
