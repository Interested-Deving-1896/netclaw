# Draft: strengthening NetClaw before its next interface

Local working draft only. Spec124 is ongoing; this is not a completed-audit announcement.

This checkpoint repairs55 confirmed defects across NetClaw's operating boundaries. The work ranges from enforcing local HUD access and sanitizing tool/chat content to verified integration TLS, exact production change gates, strict SSH identity, safer RAG persistence and bounded transport workloads. Telemetry now reports actual local GAIT persistence rather than treating an ordinary log message as an audit commit.

Changes intended to reject old insecure configuration come with migration and recovery guidance. Environment values remain literal data, private writes replace files atomically, and restore refuses to overwrite later operator edits. Test preparation now preserves operator runtimes and recovers its own managed runtime when refresh fails.

The Mac checkpoint passes24 declared contract families,490 federation tests and217 HUD tests, with430 mobile tests and a signed/uploaded iOS release. Read-only CML native pCalls and disposable FRR, NSM and Redfish fixtures provide additional integration evidence. GCF retains complete source data while reducing repeated encoding cost on the measured fixture.

The project is not yet fully audited. Broad semantic review and Linux/WSL full-host adoption remain open, and mocks do not establish real provider or phone/watch acceptance. The next checkpoint must close those gaps visibly before the HUD redesign in spec125, the reserved Jev discussion in126, and the later upgrade/README work.
