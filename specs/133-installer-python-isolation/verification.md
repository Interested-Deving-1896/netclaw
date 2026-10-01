# Verification

Date: 2026-10-01. No device changes or credentialed service calls were made.

## Passing checks

- `python3 -m pytest -q tests/unit/test_installer*.py tests/unit/test_core_deploy_preservation.py tests/unit/test_jev_installer.py`: 49 passed.
- `python3 scripts/run-contract-tests.py --suite unit --prepare`: PASS, broad offline unit suite.
- `python3 scripts/run-contract-tests.py --suite reconcile --prepare`: PASS.
- `python3 scripts/run-contract-tests.py --suite installer --prepare`: PASS, fresh isolated dependencies and MCP initialization/tool discovery. The suite is included in the CI manifest.
- `python3 scripts/verify-spec-artifacts.py`: PASS, 119 specs and four legacy exceptions.
- `python3 scripts/reconcile-mcp.py --surface catalog --surface dependencies --surface docs --surface meraki-ids --surface packages --surface portability`: all six surfaces PASS.
- `python3 scripts/run-contract-tests.py --list` and `--matrix`: manifest parity and CI discovery PASS.
- Bash syntax and `git diff --check`: PASS.
- Installed OpenClaw 2026.9.7 accepted a temporary generated configuration with `openclaw config validate`. Missing credential/endpoint warnings were expected; no live configuration was replaced.

## Fresh runtime evidence

Used protected system Python 3.13 as the base interpreter. Automatic component environments installed dependencies without system-package overrides. Generated launch commands ran from a separate temporary working directory. Only MCP initialize and tools/list were called, using fixture localhost endpoints.

| Component | Dependency installation | MCP tool discovery |
| --- | --- | --- |
| BGP Intelligence | PASS | 10 tools |
| gNMI | PASS | 10 tools |
| Nautobot | PASS | 59 tools |
| SuzieQ | PASS | 5 tools |
| Firewall Rule Analyzer | PASS | 4 tools |

The first gNMI startup exposed an unsupported FastMCP constructor keyword; it was fixed and discovery rerun successfully. Initial broader unit checks found deployment-fixture and interactive-output regressions; both were corrected before the passing rerun.

## Boundaries

Other integrations were not all freshly installed. The external firewall checkout is optional in fresh CI; the smoke suite reports BLOCKED_DEPENDENCY for that portion when absent. Credentialed endpoints, device operations, every OS/Python combination, and a live Hermes deployment are untested. Existing Hermes MCP configuration continues to require the translator's explicit sidecar merge. The live OpenClaw gateway and operator configuration were not changed by validation.

GAIT was unavailable at the initial inspection; a local development audit was recorded after the unit runtime supplied its CLI. This is a late audit, not a claim that startup protocol occurred retroactively.

## Publication

`git push --dry-run` could not authenticate to GitHub. A connected GitHub account or local Git credential is required to publish this branch and create the PR. No PR URL or CI result is claimed before publication.
