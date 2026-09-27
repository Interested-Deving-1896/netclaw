# Installer state preservation (spec 124)

External federation now refuses admission when the local role store is unavailable
or has an unknown role. Restore the store from a trusted backup and verify the
intended role before reconnecting. Valid standalone/border/member state is unchanged.
Expired approvals are expired during listing and resolution, even before the task
poller visits them. Start a new invocation to request fresh approval; elapsed
approval records cannot be revived. No stored schema conversion is required.

CLI role persistence now uses private atomic environment writes and decodes quoted
values. Managed mesh values take precedence over fallback dotenv settings. Existing
values are preserved; re-enter a previously corrupted role name through `netclaw
risk role` after checking the intended local role. No automatic name reconstruction
is attempted. systemd EnvironmentFile encoding is verified separately from dotenv.

Budget settings now reject non-finite, negative and malformed limits, retaining
the previous valid layer (or default). Zero remains an immediate ceiling. Boolean
settings accept booleans or the strings `true`/`false`. Correct invalid settings
before relying on a custom budget; warnings name the rejected setting.

Memory semantic search now returns `success: false` on backend/model failure.
Consumers must inspect that field before interpreting results. Date and any-topic
filters work with existing ISO timestamps and comma-separated topic metadata;
no reindex is required. Filtering examines at most 200 nearest candidates. If
the corpus exceeds this bound, `data.partial` is true and the response says more
matches may exist. An empty partial search is not proof of absence. Unfiltered
search keeps its requested top-k behavior.

pyATS now stages its pinned source and a Python 3.12 environment in a separate
generation before replacing `~/.openclaw/pyats-venv`. Package or import failure
leaves the old runtime intact. The installer adopts the verified source through
`PYATS_UPSTREAM_SCRIPT`; the old repository clone is preserved. Existing HTTP
migration backups remain intact; managed-source adoption uses the separate
`.env.pre-pyats-managed` backup and conflict-detecting restore journal.

Preview with `python3 scripts/setup-pyats-runtime.py --preview`. Run the installer
with `--add pyats` to install and migrate together. A repeat verifies the existing
generation; explicit `--rebuild` refuses to overwrite a retained `.previous`
runtime. Inspect and archive that recovery point before requesting another rebuild.
For recovery before subsequent environment edits, restore the environment with
`python3 scripts/migrate-pyats-http.py --restore --apply --upstream
~/.openclaw/pyats-venv/upstream/pyats_mcp_server.py`, then restore the runtime with
`python3 scripts/setup-pyats-runtime.py --restore`. Use matching `--env-file`,
`--venv` and `--target` options for custom paths. Environment recovery refuses
intervening changes; use the private pre-upgrade backup to reconcile those changes
instead of overwriting them. Runtime restoration retains the replaced generation.

Office ingestion applies `RAG_MAX_DOC_MB` to both the compressed file and its
declared expanded ZIP content. `RAG_MAX_DOC_PAGES` also limits workbook sheets,
presentation slides and Visio pages. DOCX does not expose reliable rendered page
counts; its size limit still applies. Existing indexed documents are unchanged.
For a trusted oversized document, review the resource cost before raising the
existing limits. This is input preflight, not a parser process-memory sandbox.

Replica promotion now keeps the previous Chroma collection until staging has
successfully taken its stable name. A failed rename restores the previous name;
after a process interruption, the next collection access recovers a missing stable
name from its retained generation before it can create an empty collection.
If both generations remain after an interrupted cleanup, reads use the stable
collection and another promotion refuses to overwrite the retained generation.
Back up the store, inspect both collections, and archive the retained generation
before retrying. Rollback names are `netclaw-rollback-` plus the first 32 hexadecimal
characters of SHA-256 of the stable name. Existing corpus formats are unchanged.

Snapshot secret scrubbing now handles explicit type-0 and multiword enable
credentials. This changes future snapshots only. Review older indexed snapshots
privately and replace affected snapshots from trusted originals using the normal
snapshot workflow. Rotate an exposed credential through approved device change
management if it was disclosed; do not paste suspect content into audit reports.

Re-running the installer now preserves existing workspace `SOUL.md`, `AGENTS.md`,
`IDENTITY.md`, `USER.md`, `TOOLS.md`, `HEARTBEAT.md`, and the workspace testbed
(including symlinks). Fresh installations receive repository defaults. Configured
`PYATS_TESTBED_PATH`, `RAG_DATA_DIR` and `MEMORY_DATA_DIR` values remain unchanged.
Review repository persona changes and merge useful guidance into your own notes.

No state conversion is needed for this preservation fix. Before upgrading an
older installation, privately back up its runtime directory and repository `.env`
and testbed. Existing data lost to a previous installer can only be recovered from
an existing backup; this change cannot reconstruct it.

Deployment and Forward credential setup use the shared literal dotenv writer:
values are quoted as data, files are atomically replaced with mode `0600`, and
symlink environment files are refused. A failed write stops normal deployment.
Move a symlinked environment file to a regular file only after preserving its
target and confirming the intended runtime. Do not source dotenv files as shell.

Regression evidence: `tests/unit/test_core_deploy_preservation.py` runs the real
deployment function in temporary directories for fresh/repeat installs, unusual
path characters, private permissions, and pre-existing operator state.
