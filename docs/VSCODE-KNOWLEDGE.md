# Selected context, GCF and live meetings

The Knowledge section keeps RAG collections, recorded memory, retained context
and live meeting buffers separate. None is evidence of current device state.
Use **Search Recorded Memory** for literal recorded facts/decisions and validity
windows, or **RAG knowledge base** for cited retrieval from the selected corpus.

## Analyze selected context with GCF

Choose **Analyze Selected Context with GCF**, then one retained context. Contexts
come from an explicitly reviewed editor selection, RAG selection or meeting
excerpt; the extension does not scan the workspace. The list is paged, and each
analysis is bounded to 1 MiB of retained text.

The backend uses its existing `netclaw_tokens.gcf_serializer` in the selected
`NETCLAW_PY` interpreter, or `python3` if none is configured. It applies that
installation's `NETCLAW_GCF_MODE` and `NETCLAW_TABULAR_FORMAT` for this analysis.
It returns measured characters/UTF-8 bytes for the selected text, normalized JSON
and encoded representation. Token savings use the serializer's character-based
estimate; they are not tokenizer counts, historical runtime totals or billed
provider usage. JSON fallback and the actual profile are visible. Session and
delta state are disabled. No provider request, package installation, runtime
setting change or ingestion occurs.

## Review live meeting context

**Review Live Meeting Context** reads the existing Zoom process through its
already-configured loopback federation channel. Both components must have the
management-context update and resolve the same existing private installation
identity. The new read channel uses fresh two-way shared-key proofs; it never
sends the key in this handshake. Legacy investigation-only connections cannot
supply management context. Missing, disconnected or ambiguous processes are
reported as unavailable. The extension never starts a second Zoom MCP process,
listener, recording or investigation to obtain a transcript.

Select a live meeting to inspect its most recent 60 buffered entries, participants,
timestamps, source citations and up to 10 retained investigation summaries.
Long entries are explicitly truncated. The existing source buffer contains at
most 15 minutes/500 entries and is destroyed when the meeting ends. Historical
meeting search is unavailable; an expired buffer is not silently replaced by a
new empty process or inferred history. Statements and summaries are reference
material, not change approval or verified network observations.

Optionally select excerpts, inspect the exact copy and confirm **Retain selected
excerpts**. This deliberately retains that copy after the original buffer expires.
It becomes optional Chat/Canvas context. Sharing it with a model requires a
subsequent submitted request that selects that context. Switching installations
during review prevents retention under the replacement connection.

Current evidence is in the [workspace record](../specs/150-vscode-extension/evidence/workspace.md).
Actual Zoom account/RTMS capture and WSL/Remote SSH acceptance remain separate
from the local authenticated-channel and native-view checks.
