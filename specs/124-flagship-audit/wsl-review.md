# WSL continuation boundary review

This is incremental evidence, not a declaration that all pending baseline files
were semantically reviewed. Test execution and source review remain separate.

## Installer and CI

Read the real install CLI control flow, common path/environment helpers,
component pyATS/GAIT installers, core deployment, token dependencies, pip helper,
GAIT generation setup, pyATS launcher/environment migration and service templates.
Found and reproduced A124-056/057/061 at actual deployment/CLI boundaries.
Shared constraints still apply only to the legacy runtime; pyATS MCP2 is isolated.
Reviewed all four GitHub workflows: PR-triggered tests do not execute under
pull_request_target; skill review has PR-write permission and a pinned action;
HUD tests/build and manifest-selected Python suites are gates. Mobile uses its
Mac runner and serial commands. Floating action tags remain a supply-chain
limitation, not evidence that code from an untrusted PR receives secrets.

Installer continuation reproduced failed in-place pyATS replacement (A124-064).
Staged source/venv adoption now passes real WSL inventory, preview/repeat/restore
and restored-runtime imports. Debian systemd fresh install, repeat upgrade and
managed pyATS adoption passed; four operator fixture hashes survived. GAIT
rebuild/repeat/restore/imports passed. A real distro Python install is refused by
PEP668. systemd restart required readiness polling: immediate health was false,
then authenticated health became true; process-active alone is not readiness.
N2N component/CLI literal writes and required-dependency failure now have actual
shell regressions (A124-067/061); systemd parses metacharacters, quotes and tabs
correctly. Broader component-specific upgrade/recovery review is still open.

## HUD

Reviewed access middleware, Vite dev/preview configuration, gateway chat dispatch,
HUD form submission and Canvas composer. Actual Windows Edge over WSL loopback
passed HTTP, WebSocket and both UI chat submissions using an isolated synthetic
gateway; no browser JavaScript errors. Canvas Markdown correctly interprets
underscores as emphasis, so acceptance uses a plain-text marker. This was a test
assertion correction, not an application failure. A separate real-provider gateway request returned the exact expected marker.
This provider check is distinct from browser fixture submission. Previous Mac malicious-HTML evidence is retained.

## RAG, memory and token boundaries

Reviewed RAG configuration, embedder lazy loading, parser input/page caps, chunking,
scrubber, hybrid fusion/post-filtering, reranker and Chroma storage/replica promotion.
Confirmed A124-058 plaintext credential leak, A124-060 false-empty storage failure,
and A124-062 destructive promotion failure; each has reproduction and regressions.
The apparent missing BM25 metadata filter is applied by _do_search after fusion;
it is not a demonstrated scope bypass. Metadata filters may reduce recall because
candidate depth is bounded before post-filtering; no completeness claim is made.

Read memory storage validation, parametrized SQL/graph traversal and semantic
search envelopes, plus token policy/ledger/counter/pricing/footer/wrapper paths.
Memory date/topic filtering and false-success errors reproduced against actual
Chroma (A124-066); regressions now cover existing metadata and partial candidate
retrieval. Explicit errors replace false empty success. Token estimates are labelled; configured/default model prices
are estimates, not independently verified current provider billing. Budget input
validation reproduced a NaN ceiling bypass (A124-065); invalid overrides now retain
the last valid layer, with explicit boolean parsing and negative tests. RAG real-model
quality and mobile real-device behavior remain outside these offline checks.

## Fixture boundary

Docker initially named a WSL-local daemon and later Docker Desktop; fixture tests
were rerun against the latter. Existing containers and occupied port 8000 were
preserved. Redfish uses a dedicated loopback port and an official digest. FRR
accepts the Docker-obtained trusted public key and refuses unknown/mismatched keys.
NSM ran 19 checks with zero skips; a timed-out daemon preflight was separately
reported and rerun rather than treated as a failed engine test.

Linux acceptance uses a dedicated privileged systemd container with no host
filesystem or Docker socket mounts. Privilege enables its isolated init/cgroup
service manager. This validates Debian userspace and real user systemd services
on Docker's shared kernel, not a separate bare-metal kernel or a Mac installation.

## Federation and mobile continuation

Read service peer consent/hello/TOFU/TLS admission, edge enrollment/reconnect,
restricted method dispatch, approval resolution and risk-wide approval listing;
read the authorizer's grants, request/token budgets and approval lifecycle.
Found unavailable-role fail-open (A124-068) and expiry ignored at resolution/list
(A124-069), with actual service/SQLite regressions. Self-asserted peers remain
presence-only under the explicit tier policy. Edge approvals intentionally trust
an enrolled phone's confirmation report; this is not remote biometric attestation.
The documented single-approver-per-risk model is not per-user approval isolation.

Read mobile QR parsing/domain check, enrollment persistence, hardware identity
bridge and iOS Secure Enclave key generation/signing, confirmation helper,
headless reconnect, capture size admission, app lock, watch relay and watch
ApprovalsView plus Live Activity deep-link entry. No bad-certificate override was
found in the Dart/Swift sources. Watch decisions perform fresh local authentication;
Live Activity buttons open the approval screen. Headless late-connect ownership
is A124-070. Hardware identity and watch confirmation still require actual devices;
Flutter fixtures cannot establish those platform guarantees.

## Additional MCP boundary sampling

Document guards require attributed value/unavailable/failed shapes; Office images
resolve inside workspace output, outputs reserve unique names, and spreadsheets
force string cell types. These checks do not validate the factual truth of supplied
attribution. Halo uses explicit preview then submit, bounded page count and partial
error envelopes, verifies TLS by default, and does not retry the ticket POST.
Azure client selection uses SDK credential chains, fixed Azure scopes and a
subscription semaphore; pagination errors propagate. Blender's bundled addon is a
trusted local code-execution endpoint by design, default localhost; inspection is
not a Blender/Windows rendering acceptance. Broad vendor/skill review remains open.
