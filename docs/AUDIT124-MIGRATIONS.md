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

HUD skill/session detail identifiers now stay inside their resolved data roots;
encoded path separators and links outside those roots return404. Move a legitimate
resource into its managed directory instead of passing a path as its identifier.
No existing file is moved or rewritten. HUD budget status now preserves zero
ceilings and rejects invalid numeric overrides consistently with enforced limits.

Updated skill GAIT examples use `user_text`/`assistant_text`. Older nested `input`
or `prompt`/`response` calls can return success while recording empty text. Review
recent records with `gait_show`; missing historical content must be reconstructed
only from actual retained evidence, never from illustrative skill examples.

### Skill deployment recovery (A124-075)

Installer upgrades now retain originals of changed skills under the runtime's
`skill-deployment-backups/deploy-*` directories before replacing any files.
Each private generation contains a journal and original bytes. Repeated deployment
of identical content creates no new generation. Files absent from the repository
are preserved, and Hermes substitutions apply only to incoming files.

Preview skill changes without writing files:

```bash
python3 scripts/deploy-skills.py --source workspace/skills \
  --destination ~/.openclaw/workspace/skills \
  --backups ~/.openclaw/skill-deployment-backups --preview
```

Deployment refuses symlink destinations and symlink ancestors before updating
skills; use a regular skill directory to adopt this installer. Existing links are
left untouched. A failed deployment can leave a partially updated tree, but retains
all originals. Restore the generation printed by the installer with:

```bash
python3 scripts/deploy-skills.py --restore ~/.openclaw/skill-deployment-backups/deploy-EXACT_GENERATION
```

Restore checks all target digests before writing and refuses subsequent local
edits. Resolve such conflicts manually using the retained originals; do not force
an older generation over newer changes. Restore removes only newly deployed files
whose bytes still match the journal and restores replaced files with their former
permissions. Recovery is repeatable and keeps the journal. Review/merge operator
skill customizations from the originals after an upgrade.

A124-076 corrects edge queue TTL enforcement when a phone reconnects without a new enqueue. Expired messages are excluded from replay and pending counts; the next enqueue performs existing cleanup. No database conversion is needed.

A124-077 validates optional pricing override shapes and numeric ranges. Invalid entries now warn and use default pricing. If direct usage accounting supplies an invalid/non-finite cost, the session ledger halts with `invalid_cost`, reports its total as incomplete and refuses a budget override. Correct the usage source before starting a new ledger. Valid zero/positive costs and existing stored data are unchanged. Estimates are not provider invoices.

A124-078 adds Fortinet `request_failed` for malformed/error JSON-RPC replies. Consumers must treat it as an unavailable answer, not a successful empty inventory. Valid empty lists remain `empty_result`. A124-079 supports fractional `BGP_INTEL_MAX_RPS` below1 with a longer pacing window; no state migration.
