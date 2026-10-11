# Usage, logs and diagnostic previews

Tokenomics labels recorded provider/model/request counters, missing usage and
unknown prices. OpenClaw reporting reads the selected installation's bounded
session history; Hermes management reporting uses completed owned requests.
External-assistant charges and remote-member totals are not inferred from local
records. Reporting windows and their timestamp basis remain visible.

**NetClaw: Open Installation Logs** lists fixed log sources in the connected
installation. It reads at most the latest 256 KiB, supports source, severity,
text and inclusive time-window filtering, and returns up to 250 matching rows.
File/row truncation and rows excluded because their timestamp is unavailable
are explicit. Debug and unknown severity are selectable. A missing file is
unavailable, not a successful empty health result. Shared `/tmp` logs and ambient
system services are not adopted.

ISO timestamps must carry a timezone. Numeric timestamps are filterable only
when the source supplies `timestampUnit: seconds` or `milliseconds`; no unit is
guessed. Unrecognized timestamps remain visible without a time filter. Log
severity is parsed or inferred, and log entries remain historical evidence.
Each preview includes the selected source, read time, time window and a source
reference with opaque file identity, observed modification time and byte range.
References contain no filesystem path or content-derived credential hash. A
rotating/appending log is not an immutable artifact.

Configured credential values and credential-pattern lines are redacted before
text matching. Redaction is followed by a visible preview; review remains
necessary before sharing arbitrary diagnostic text. The preview opens as an
editable untitled document. **Save reviewed local copy** saves the visible text,
including any additional redaction you made, to an explicitly selected local or
connected-workspace file. It does not upload content. Cancellation or a changed
installation connection prevents the save.

**NetClaw: Export Diagnostics** uses the same review/export flow and includes
only the selected backend identity, compatibility, declared capabilities and
the actual extension version. It does not collect environment values, logs or
network evidence as a side effect.

Network presently lists configured pyATS inventory with live state unknown.
Full observed topology, provenance and simulation views remain an open Spec 150
implementation gate; configured names and federation relationships must never
be described as live physical topology.
