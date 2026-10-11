# Observability evidence — Mac 2026-10-11

This checkpoint extends implemented usage/log projections and native diagnostic
review. T059/T060 remain open for the complete network/topology/provenance and
supporting acceptance. It is not a WSL, Linux or remote-host qualification.

Log reads now support inclusive ISO time filters and debug/unknown severity.
Unknown or ambiguous timestamps are counted when excluded rather than assigned
a guessed time. Numeric values require explicit epoch units. Configured secret
values are redacted before query matching, fixing a reproducible case where a
secret-only query selected an otherwise redacted row. Opened file descriptors
must still match the observed owned inode; linked/replaced or writable-by-other
sources cannot be accepted as that source. Tail byte references, row/file caps
and truncation remain visible.

Native log and identity-diagnostic previews support explicit local export. The
export saves the visible editor document, including the user's additional
redaction, rather than an earlier hidden string. Cancelled export, connection
change or a nonlocal destination scheme cannot write a file. Identity diagnostics
use the extension manifest version and fetch no logs or network/config content.

The two initially failing log cases demonstrated the absent time contract and
pre-redaction secret-query matching. Current targeted observability tests cover
usage reconciliation/gaps, owned Hermes usage, bounded secret-redacted logs,
configured inventory, time/provenance, query redaction, numeric-time ambiguity
and descriptor identity. Native tests verify exact filters, edited-text export,
cancellation, connection changes and nonlocal-destination denial. All use
synthetic temporary files and mocked editor surfaces; no owner logs were read
or exported. Validation: 180 operator tests passed (16 optional process tests
skipped), 24 assistant contract tests passed (one optional process test skipped),
and the shared HUD observability regression passed without provider contact.
The eight observability cases include multiline configured-value redaction
across log line boundaries. All 63 extension tests and TypeScript checking passed. GAIT: `d6d8087c`.
