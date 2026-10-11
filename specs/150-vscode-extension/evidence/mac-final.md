# Final Mac qualification — in progress, publication held

Owner direction on 2026-10-11: complete Spec150 implementation and functionality;
**do not publish**. Advanced enhancements/aesthetics belong to a future Spec151.

## Returned source review

Fetched `af66075411b6ccfbc52adfad9d278ca70985bd87` in a new isolated checkout.
The WSL-qualified candidate is retained unchanged as `netclaw-0.1.0-wsl-fixes.vsix`,
SHA-256 `f75b73bdeaf524bf647ad4920ea5b5c85979ee1c20cba62d9cd6a20f6f79af45`.
It contains 25 ZIP entries / 2,349,236 bytes. Mobile logo is byte-identical to the
original asset; assistant payload is byte-identical to the original candidate.

The WSL fixes persist per-view message sequences and correct Windows-local WSL
guidance. They retain host identity/replay/trust checks. WSL evidence is accepted
for its documented existing OpenClaw scope, including the reported Copilot
permission deviation and subsequent Default-permissions recheck. No uninterrupted
default-permission or broader Hermes/SSH/reboot claim is made.

Mac source check/build: passed; 18 default tests passed and the opt-in RAG test was
skipped. The opt-in test then passed separately using actual unchanged HUD/RAG MCP
and cached local embeddings, with a disposable corpus and zero provider requests.

## Additional confirmed RAG defect

Exact installed returned candidate on macOS / VS Code 1.141: RAG search submitted
immediately after Refresh collections was silently discarded by the host's busy
guard. The frontend still displayed search progress and no result arrived.
The failure was reproduced in the actual editor, not inferred only from source.
Other checks reached successful activation, identity/MCP binding, themes, Chat,
tab restore, actual RAG retrieval and Canvas restore before this failure.

The extension-only fix disables controls synchronously while a knowledge operation
or native review is active, reports busy state across webview recreation, and
restores controls on completion/cancellation/error. Disconnection remains final
even if a late completion arrives. Host overlap refusal is explicit. No automatic
queue/retry, backend change or new authority is introduced.

Focused DOM regression covers initial loading, refresh/search overlap, explicit
next search, failure, cancelled review and late completion after invalidation.
Source check/build and 19 default tests pass (one optional RAG fixture skipped).
Development-editor regression passed on 1.141, including restored RAG refresh/search
and cited results, Canvas save/open after reveal and Chat/Overview restore.

The test runner now supports installing an exact VSIX into a private profile and
checks every installed payload byte against it (only editor-added package metadata
is excluded). It can explicitly target an already-running HUD for a harmless real
provider check. These runner changes are excluded from the VSIX. Packaging and
exact new-artifact checks follow; do not treat source tests as package acceptance.

The previous WSL evidence remains evidence for its recorded artifact; it does not
claim execution of this Mac-discovered RAG delta on WSL. Any later public release
must review the exact final artifact's remaining host qualification.
