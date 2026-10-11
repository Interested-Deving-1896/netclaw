# Preserved backend experiment — outside extension release

This branch preserves the unfinished peer-execution work present when the owner
reaffirmed on 2026-10-11 that Spec150 should ideally change only the extension,
using existing NetClaw interfaces. It is not the selected extension architecture
and is not approved for publication or merge as part of the extension release.

The prototype adds another backend operation type, worker, federation receiver,
native calculation command and tests. It demonstrates exact read-only subnet
tool/Hermes-skill review and retained receipts, but does not establish that a new
backend orchestration layer is necessary. Existing NCFED invocation and task APIs
must be assessed first. Do not continue this experiment merely to satisfy the
earlier expanded task list.

At preservation: five targeted Node cases, 19 Python receiver cases, all 85
extension tests and TypeScript/build passed. A real Node/Python/GAIT worker test
passed for both origin harness selections with synthetic remote responses.
No live remote runtime/provider, actual peer transport, WSL or full regression
qualification is claimed. Nothing from this experiment was published.

Parent `4ed565b` contains the last pushed extension inspection checkpoint. It
still includes earlier backend changes; preserving this experiment separately
does not make that parent branch extension-only. See the subsequent scope audit
on `150-vscode-extension-release` before selecting any release source.
