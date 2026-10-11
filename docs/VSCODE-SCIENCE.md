# Science Officer in VS Code

Open **NetClaw: Science Officer** to inspect Jev advice linked to a management
conversation. The view shows its originating conversation and request, original
or reconsidered assessment, typed questions and answers, reported usage, retained
charges, and current UTC daily and originating-task budgets. Runtime-authored
reports of how advice influenced a recommendation are labelled interpretation.
Advice never supplies approval or execution authority.

Assessment IDs pasted into prompts, imported Canvas files, another HUD session,
and the installation's global latest-assessment record cannot grant access.
The OpenClaw adapter registers only new matching `jev_evaluate` tool calls and
results in the exact managed session transcript, then verifies the assessment's
task and parent in the existing private Jev ledger. If the transcript, ledger,
or proof is unavailable, no ownership is invented. Protected Hermes assessment
proofs are not yet qualified and are reported explicitly.

Read views copy a stable bounded database/WAL snapshot into private scratch.
They never initialize the source ledger, run inference, change its permissions,
or open its original SQLite sidecars. Original raw network state is not retained
by Jev and is not reconstructed from an assessment.

## Reconsideration

For an original successful assessment with no reconsideration, choose **Review
a reconsideration question**. The review contains the retained typed advice,
your new question, explicit historical-evidence limitations, destination,
maximum charge reservation, and originating-task budgets. No provider call is
made to prepare this review. Submitting uses the existing `jev_evaluate` tool
from the selected runtime home's existing `jev-venv`; the extension installs
nothing.

The request is classified private. A remote provider still requires Jev's exact
local disclosure grant. The review includes its backend command; VS Code's
confirmation cannot issue that grant. Jev retains budget enforcement and allows
only one reconsideration per successful original assessment. The result does
not run tools or change the network.

The backend retains a 15-minute review bound to the question, task, model,
endpoint, credentials, pricing, and budget-settings bytes. A changed review or
configuration is rejected. Work runs independently of the editor/MCP connection.
Reopen Science Officer or Operations to inspect progress. Uncertain requests
are reconciled only against their exact task, parent, request digest and review
ID in the Jev ledger; they are never resent. A missing result remains unknown.

Mac controlled-provider process evidence is in
[the Spec150 workspace checkpoint](../specs/150-vscode-extension/evidence/workspace.md).
It does not qualify the full originating OpenClaw workflow, Hermes proofs, WSL,
Remote SSH or external provider accounts.
