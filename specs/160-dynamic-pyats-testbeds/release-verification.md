# Spec160 release verification — 2026-10-30

The owner explicitly authorized the versioned source/extension release, commit,
push, PR, merge, completed-branch cleanup and return to main. This supersedes the
implementation-only publication hold. Source **1.14.0** and extension **1.4.0**
are the coordinated feature increments; no second bump is made for release prep.
Existing installations and network/provider operations remain outside this release.

## Evidence and gates

Implementation commits `46441f7`, `f982300` and `09d9a21` contain the specification,
implementation and completed 30-task evidence. [Verification](verification.md)
retains the exact automated, actual MCP, terminal and native Mac Insiders results.
Live tenants/devices, Windows/WSL and stable/minimum-editor visual qualification
remain unverified. Publication does not change those results.

Release preparation adds the README announcement, a copyable community note,
tag-pinned release links and extension guidance. Two original companion articles
are staged as `draft: true` in the separate `modern_website` repository; this
release does not publish that website or send social/Slack messages.

Before release: validate release metadata, all spec artifacts and six declaration
reconciliation surfaces; verify the clean committed VSIX, exact source provenance,
required bundled assets and extension dependency audit. Applicable PR workflows,
merged-main workflows and the version tag check must pass. No failing check may
be bypassed. Marketplace publication uses the verified archive; the downloaded
public version must match it before publication is reported complete.

Final source commit, PR/CI, tag, package digest and publication receipts are retained
in release assets and local memory/GAIT so this tested source/package stays immutable.
