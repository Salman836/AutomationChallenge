# QA Automation Challenge — Test Plan & Test Cases

Test design deliverables for two challenges:

1. **Trello REST API** — automated E2E of a realistic board → list → card → update → cleanup workflow, with functional *and* performance coverage.
2. **Telenor E2E GUI** — broadband address-search journey on `https://www.telenor.se`.

Target implementation stack: **Playwright + JavaScript** (Node 20 LTS).

## Documents

| Document | Purpose |
| --- | --- |
| [docs/TEST-PLAN.md](docs/TEST-PLAN.md) | Master test plan — scope, strategy, environment, framework architecture, performance approach, risks, entry/exit criteria, CI, traceability |
| [docs/test-cases/TC-TRELLO-API.md](docs/test-cases/TC-TRELLO-API.md) | 91 Trello API test cases — 49 functional, 23 negative, 11 security-adjacent, 8 performance |
| [docs/test-cases/TC-TELENOR-E2E.md](docs/test-cases/TC-TELENOR-E2E.md) | 32 Telenor GUI test cases — 16 functional, 4 negative, 4 compatibility, 3 performance, 5 resilience (+2 discovery tasks) |

## Test case ID scheme

```
TRL-F-###    Trello  functional (positive)
TRL-N-###    Trello  negative / validation / error handling
TRL-S-###    Trello  security-adjacent (authn/authz, injection round-trip)
TRL-P-###    Trello  performance
TEL-F-###    Telenor functional (positive)
TEL-N-###    Telenor negative / validation
TEL-C-###    Telenor compatibility (browser / viewport)
TEL-P-###    Telenor performance
TEL-R-###    Telenor resilience / observability
```

Priority: **P0** must pass to ship · **P1** important · **P2** nice to have.

## Status

Design phase complete. Nothing is implemented yet — these documents are the input to the
Playwright framework build.
</content>
</invoke>
