# Spec153 WSL qualification findings

Mac baseline: `89627477fb470cd7c293e33e192c5983819d45d4`. Qualification continues the accepted W01–W07 scope; no Spec Kit decisions are regenerated. This is a running findings record, not gate closure.

| ID | Observation | Disposition and verification |
| --- | --- | --- |
| W153-001 | The native PTY survivor fixture failed on Linux: session-leader exit sends SIGHUP to the foreground child, so the purported surviving writer had already exited. | The fixture now ignores SIGHUP before spawning its child. All three native-terminal tests pass on the observed Ubuntu 26.04 WSL2 development host. Production lock behavior is unchanged; rerun this fixture on Mac. |
| W153-002 | Native service discovery rejected valid unquoted EnvironmentFile values containing interior spaces or quotes, blocking unrelated selected fixture lifecycle operations. | Accept the literal single-line unquoted subset documented by [systemd.exec](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html#EnvironmentFile=). Escapes/multiline values still refuse. Added selected/foreign scope and non-disclosure tests; actual disposable-manager evidence pending. |
| W153-003 | After the literal parser fix, lifecycle tests on the development account still refuse an existing native gateway without an explicit verifiable installation scope. | Preserve this refusal. Do not infer that an ambiguous unit belongs elsewhere, change its environment, or disable ownership checks to make tests green. Run acceptance in separate disposable distributions/accounts. The development-host run is not a clean-host pass. |

Initial environment findings: the existing distribution registration name differs from its observed Ubuntu release; actual `/etc/os-release` is authoritative. Default PATH Node 25 is outside policy. A private checksum-verified Node 24.19.0 is used. Fresh extension tests also require the HUD's npm dependencies. The first legacy test run used the default Node and failed one policy-sensitive test; the qualified-Node rerun passed 216 tests and 16 subtests. Missing opt-in interpreters are recorded as skips until provisioned and rerun.

Host preparation is separate from the product's read-only Windows gate. Official Ubuntu WSL images are imported as uniquely named disposable distributions; only these fixtures may be terminated/restarted. Existing distributions, runtime homes and credentials are preserved. No provider turn, channel message or device connection is authorized by this qualification.
