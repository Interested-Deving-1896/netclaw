#!/usr/bin/env bash
# Fresh runtimes and local MCP discovery. No device or service tool calls.
set -euo pipefail
INSTALLER_TEST_REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
INSTALLER_TEST_DIR="$(mktemp -d)"
trap 'rc=$?; if [ "$rc" -ne 0 ]; then tail -40 "$INSTALLER_TEST_DIR"/*.log 2>/dev/null || true; fi; rm -rf "$INSTALLER_TEST_DIR"' EXIT
cd "$INSTALLER_TEST_REPO"
source scripts/lib/pip-helper.sh
unset NETCLAW_VENV
export NETCLAW_RUNTIME_ROOT="$INSTALLER_TEST_DIR/runtimes"
export NETCLAW_INSTALL_FAILURE_FILE="$INSTALLER_TEST_DIR/failures"
for component in bgp-intel gnmi nautobot suzieq fwrule; do
    export NETCLAW_INSTALL_COMPONENT="$component"
    component_source="$INSTALLER_TEST_REPO/mcp-servers/$component-mcp"
    [ "$component" != nautobot ] || component_source="$INSTALLER_TEST_REPO/mcp-servers/nautobot-mcp-v2"
    if [ "$component" = fwrule ]; then
        # External checkout is optional in CI; exercise it when present.
        # The console-entrypoint contract also has offline tests.
        if [ ! -f "$component_source/pyproject.toml" ]; then
            echo 'fwrule: BLOCKED_DEPENDENCY (optional source checkout absent)'
            continue
        fi
        netclaw_pip_install -e "$component_source" > "$INSTALLER_TEST_DIR/$component.log" 2>&1
    else
        netclaw_pip_install -r "$component_source/requirements.txt" > "$INSTALLER_TEST_DIR/$component.log" 2>&1
    fi
    echo "$component: isolated install PASS"
done
components='bgp-intel gnmi nautobot suzieq'
[ ! -f "$NETCLAW_RUNTIME_ROOT/records/fwrule" ] || components="$components fwrule"
python3 scripts/install-mcp-config.py --repo "$INSTALLER_TEST_REPO" \
    --runtime-root "$NETCLAW_RUNTIME_ROOT" --components "$components" \
    --output "$INSTALLER_TEST_DIR/selected.json"
"$NETCLAW_RUNTIME_ROOT/bgp-intel/bin/python" tests/installer/discover.py "$INSTALLER_TEST_DIR"
