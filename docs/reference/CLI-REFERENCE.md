# NetClaw CLI and interface reference

Repository script entry points, non-vendored Python/shell launchers, npm scripts and Node service/preview launchers. Static declarations include positional args, defaults and choices when present; delegated upstream/runtime CLIs require their installed help. MCP source signatures are not runtime schema attestations.

Generated with `python3 scripts/build-hud-reference.py`. Nothing is executed during extraction.

## Modalities

Canvas branching chat; HUD dashboards; terminal/TUI; Slack and WebEx; mobile text, voice, QR/deep links and camera/microphone capture; MCP stdio/HTTP; external eN2N and internal iN2N delegation. Availability depends on installed/configured integrations. Mobile has no local LLM runtime; Border or a delegated member answers.

## Top-level command

Run `scripts/netclaw` for the interactive menu. `tui` delegates to OpenClaw (`openclaw tui`) or Hermes (`hermes --tui`). `install` forwards arguments to scripts/install.sh. `help`, `-h`, `--help` display the built-in summary.

`peering`: status (default), bgp, n2n, ngrok, up, down, announce.

`risk`: status (default), members, health, add <profile|custom> <name> [csv-skills], remove <member>, role <role> <risk-name> [stacks], edge-check (aliases edge_check/preflight), token [--edge] [label], enroll-mobile [label] (alias enroll_mobile), route <request> [capability].

`chats`: list, <id-prefix> to tail, --watch (alias watch) [seconds]. `link` recreates the local launcher symlink. These commands may mutate state; documentation is not authorization to run them.

## HTTP and MCP

[HUD OpenAPI JSON](hud-openapi.json) inventories every registered HUD HTTP route. Generic schemas remain unspecified; detailed schemas exist for RAG retrieval/upload. [Machine-readable reference](interfaces.json) includes source-declared MCP signatures and daemon route conditions. MCP is JSON-RPC, not REST; use tools/list from the installed server for authoritative schemas. This reference does not contact servers, execute tools or include configuration values.

## .specify/scripts/bash/check-prerequisites.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--arg`, `--argjson`, `--help`, `--include-tasks`, `--json`, `--paths-only`, `--require-tasks`

```text
L8: # Usage: ./check-prerequisites.sh [OPTIONS]
L11: #   --json              Output in JSON format
L12: #   --require-tasks     Require tasks.md to exist (for implementation phase)
L13: #   --include-tasks     Include tasks.md in AVAILABLE_DOCS list
L14: #   --paths-only        Only output path variables (no validation)
L15: #   --help, -h          Show help message
L31: case "$arg" in
L32: --json)
L35: --require-tasks)
L38: --include-tasks)
L41: --paths-only)
L44: --help|-h)
L46: Usage: check-prerequisites.sh [OPTIONS]
L51: --json              Output in JSON format
L52: --require-tasks     Require tasks.md to exist (for implementation phase)
L53: --include-tasks     Include tasks.md in AVAILABLE_DOCS list
L54: --paths-only        Only output path variables (no prerequisite validation)
L55: --help, -h          Show this help message
L59: ./check-prerequisites.sh --json
L62: ./check-prerequisites.sh --json --require-tasks --include-tasks
L65: ./check-prerequisites.sh --paths-only
L70: *)
L71: echo "ERROR: Unknown option '$arg'. Use --help for usage information." >&2
L93: --arg repo_root "$REPO_ROOT" \
L94: --arg branch "$CURRENT_BRANCH" \
L95: --arg feature_dir "$FEATURE_DIR" \
L96: --arg feature_spec "$FEATURE_SPEC" \
L97: --arg impl_plan "$IMPL_PLAN" \
L98: --arg tasks "$TASKS" \
L164: --arg feature_dir "$FEATURE_DIR" \
L165: --argjson docs "$json_docs" \
```

## .specify/scripts/bash/common.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--abbrev-ref`, `--is-inside-work-tree`, `--show-toplevel`

```text
L9: # Use -- to handle paths starting with - (e.g., -P, -L)
L38: if git rev-parse --show-toplevel >/dev/null 2>&1; then
L39: git rev-parse --show-toplevel
L59: git -C "$repo_root" rev-parse --abbrev-ref HEAD
L114: git -C "$repo_root" rev-parse --is-inside-work-tree >/dev/null 2>&1
L315: case "$(basename "$ext")" in .*) continue;; esac
```

## .specify/scripts/bash/create-new-feature.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--all`, `--arg`, `--help`, `--json`, `--list`, `--number`, `--prune`, `--short-name`, `--timestamp`

```text
L13: case "$arg" in
L14: --json)
L17: --short-name)
L19: echo 'Error: --short-name requires a value' >&2
L24: # Check if the next argument is another option (starts with --)
L26: echo 'Error: --short-name requires a value' >&2
L31: --number)
L33: echo 'Error: --number requires a value' >&2
L39: echo 'Error: --number requires a value' >&2
L44: --timestamp)
L47: --help|-h)
L48: echo "Usage: $0 [--json] [--short-name <name>] [--number N] [--timestamp] <feature_description>"
L51: echo "  --json              Output in JSON format"
L52: echo "  --short-name <name> Provide a custom short name (2-4 words) for the branch"
L53: echo "  --number N          Specify branch number manually (overrides auto-detection)"
L54: echo "  --timestamp         Use timestamp prefix (YYYYMMDD-HHMMSS) instead of sequential numbering"
L55: echo "  --help, -h          Show this help message"
L58: echo "  $0 'Add user authentication system' --short-name 'user-auth'"
L59: echo "  $0 'Implement OAuth2 integration for API' --number 5"
L60: echo "  $0 --timestamp --short-name 'user-auth' 'Add user authentication'"
L63: *)
L72: echo "Usage: $0 [--json] [--short-name <name>] [--number N] [--timestamp] <feature_description>" >&2
L137: git fetch --all --prune >/dev/null 2>&1 || true
L186: # Convert to lowercase and split into words
L189: # Filter words: remove stop words and words shorter than 3 chars (unless they're uppercase acronyms in original)
L236: # Warn if --number and --timestamp are both specified
L238: >&2 echo "[specify] Warning: --number is ignored when --timestamp is used"
L289: if git branch --list "$BRANCH_NAME" | grep -q .; then
L291: >&2 echo "Error: Branch '$BRANCH_NAME' already exists. Rerun to get a new timestamp or use a different --short-name."
L293: >&2 echo "Error: Branch '$BRANCH_NAME' already exists. Please use a different feature name or specify a different number with --number."
L323: --arg branch_name "$BRANCH_NAME" \
L324: --arg spec_file "$SPEC_FILE" \
L325: --arg feature_num "$FEATURE_NUM" \
```

## .specify/scripts/bash/setup-plan.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--arg`, `--help`, `--json`

```text
L10: case "$arg" in
L11: --json)
L14: --help|-h)
L15: echo "Usage: $0 [--json]"
L16: echo "  --json    Output results in JSON format"
L17: echo "  --help    Show this help message"
L20: *)
L56: --arg feature_spec "$FEATURE_SPEC" \
L57: --arg impl_plan "$IMPL_PLAN" \
L58: --arg specs_dir "$FEATURE_DIR" \
L59: --arg branch "$CURRENT_BRANCH" \
L60: --arg has_git "$HAS_GIT" \
```

## .specify/scripts/bash/update-agent-context.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
L37: # Usage: ./update-agent-context.sh [agent_type]
L262: case "$lang" in
L272: *)
L374: printf '%s\n' "---" "description: Project Development Guidelines" "globs: [\"**/*\"]" "alwaysApply: true" "---" "" > "$frontmatter_file"
L518: if ! head -1 "$temp_file" | grep -q '^---'; then
L521: printf '%s\n' "---" "description: Project Development Guidelines" "globs: [\"**/*\"]" "alwaysApply: true" "---" "" > "$frontmatter_file"
L617: case "$agent_type" in
L618: claude)
L621: gemini)
L624: copilot)
L627: cursor-agent)
L630: qwen)
L633: opencode)
L636: codex)
L639: windsurf)
L642: junie)
L645: kilocode)
L648: auggie)
L651: roo)
L654: codebuddy)
L657: qodercli)
L660: amp)
L663: shai)
L666: tabnine)
L669: kiro-cli)
L672: agy)
L675: bob)
L678: vibe)
L681: kimi)
L684: trae)
L687: pi)
L690: iflow)
L693: generic)
L696: *)
L786: log_info "Usage: $0 [claude|gemini|copilot|cursor-agent|qwen|opencode|codex|windsurf|junie|kilocode|auggie|roo|codebuddy|amp|shai|tabnine|kiro-cli|agy|bob|vibe|qodercli|kimi|trae|pi|iflow|generic]"
```

## benchmarks/audit124/gcf_cost.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--iterations`

```text
L14: argparse.ArgumentParser()
L14: p.add_argument('--iterations',type=int,default=20)
```

## benchmarks/gcf_graph_benchmark.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
L10: Usage:
```

## benchmarks/gcf_vs_toon_benchmark.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
L6: Usage:
```

## blender_addon.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## captures/analysis-20260714/build_report2.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## lab/frr-testbed/scripts/setup-gre.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--format`

```text
L24: # --- Step 0: Fix IPv6 sysctl in each container via nsenter ---
L27: PID=$(docker inspect "$CTR" --format '{{.State.Pid}}' 2>/dev/null || echo "")
L43: # --- Step 1: Host peering IPv6 address on Docker bridge ---
L64: # --- Step 2: GRE tunnel (IPv6 outer — ip6gre) ---
L72: # --- Step 3: IPv6 inner addressing on host GRE ---
L77: # --- Step 4: GRE tunnel inside Edge1 + IPv6 inner address ---
L87: # --- Step 5: Host identity route + IPv6 routes to lab networks via GRE ---
```

## lab/frr-testbed/scripts/teardown-gre.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## lab/frr-testbed/scripts/verify.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--format`

```text
L19: # --- Container health ---
L20: echo "--- Container Status ---"
L22: if docker ps --format '{{.Names}}' | grep -q "^${c}$"; then
L30: # --- OSPFv3 convergence ---
L31: echo "--- OSPFv3 Neighbors ---"
L55: # --- Loopback reachability via OSPFv3 routing table ---
L57: echo "--- Loopback Reachability (OSPFv3 routing table) ---"
L71: # --- MP-BGP IPv6 unicast convergence ---
L74: echo "--- MP-BGP IPv6 Unicast Sessions ---"
L95: # --- Route propagation ---
L96: echo "--- IPv6 Route Propagation ---"
L109: # --- GRE tunnel + eBGP to WSL NetClaw (optional) ---
L110: echo "--- GRE Tunnel (host side) ---"
L128: # --- eBGP to WSL NetClaw ---
L129: echo "--- eBGP to WSL NetClaw ---"
L138: # --- Summary ---
```

## labs/multivendor-r1/frr-ssh/start.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/analysis-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/anta-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/auvik-mcp/auvik_mcp_server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/azure-network-mcp/azure_network_mcp_server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/batfish-mcp/batfish_mcp_server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/bgp-intel-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/catc-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/cisco-psirt-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/claroty-mcp/claroty_mcp_server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/document-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/eve-ng-mcp-server/eve_ng_mcp_server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/eve-ng-mcp-server/tests/test_eve_live_health.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--fail-fast`, `--mutating`, `--target`

```text
L49: argparse.ArgumentParser(add_help=False)
L50: parser.add_argument("--target", choices=("local", "external", "both"), default=os.getenv("EVE_HEALTH_TARGET", "local"))
L286: argparse.ArgumentParser(description="Fast live EVE-NG MCP operation health diagnostics")
L287: parser.add_argument("--target", choices=("local", "external", "both"), default=TARGET, help="EVE profile to test (default: local)")
L288: parser.add_argument("--mutating", action="store_true", help="run reversible start/stop and config set/wipe checks")
L289: parser.add_argument("--fail-fast", action="store_true", help="stop after the first failed capability")
```

## mcp-servers/eve-ng-mcp-server/tests/test_eve_skills_smoke.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--help`

```text
```

## mcp-servers/fortinet-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/gnmi-mcp/gnmi_mcp_server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/gns3-mcp-server/gns3_mcp_server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/gns3-mcp-server/tests/test_gns3_mcp_server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/halo-mcp/halo_mcp_server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/image-style-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/ipfix-mcp/ipfix_mcp_server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/jev-mcp/audit_worker.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/jev-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--env-file`, `--read-task-id`, `--status`

```text
L113: argparse.ArgumentParser(description=__doc__)
L114: parser.add_argument("--status", action="store_true", help="Print secret-free local status without inference")
L115: parser.add_argument("--env-file", metavar="PATH", help="Load allowlisted literal Jev settings from this operator-selected environment file")
L116: parser.add_argument("--read-task-id", help="Operator-owned task binding for a read-only assessment process; never a model argument")
```

## mcp-servers/memory-mcp/memory_mcp_server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/multivendor-cli-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/n2n-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/nautobot-golden-config-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/nautobot-mcp-v2/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/nautobot-routing-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/nsm-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/ollama-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/packet-buddy-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/protocol-mcp/bgp-daemon-v2.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--break-system-packages`, `--edge`

```text
```

## mcp-servers/protocol-mcp/bgp-daemon.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/protocol-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/rag-mcp/rag_mcp_server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/redfish-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/snmptrap-mcp/snmptrap_mcp_server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/suzieq-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/syslog-mcp/syslog_mcp_server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/topology-diagram-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/tts-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/twilio-voice-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/twilio-voice-mcp/webhook_server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
L12: Usage:
```

## mcp-servers/twitter-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
L2095: for cmd in self_commands:
```

## mcp-servers/worldlabs-marble-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## mcp-servers/zoom-rtms-mcp/server.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## scripts/add-skill-licenses.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--add-frontmatter`, `--dry-run`, `--license`, `--path`

```text
L148: argparse.ArgumentParser(description="Add missing license fields to skill files")
L149: parser.add_argument("--dry-run", action="store_true", help="Show what would change")
L150: parser.add_argument("--license", default="Apache-2.0", help="License identifier (default: Apache-2.0)")
L151: parser.add_argument("--path", default=None, help="Path to skills directory")
L152: parser.add_argument("--add-frontmatter", action="store_true", help="Add frontmatter to files without it")
L7: Usage:
```

## scripts/build-hud-reference.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--edge`, `--exclude-standard`, `--help`, `--others`, `--tui`, `--watch`

```text
L43: if re.search(r'sys\.argv|Usage:|usage:|cmd ==|cmd in ',line):
L49: if re.search(r'(^\s*#.*(?:netclaw|--|Usage)|Usage:|case .* in|^\s*[\w|*-]+\)|--[\w-]+)',line):
L71: 'declarations':[{'line':n,'declaration':line.strip()} for n,line in enumerate(source.splitlines(),1) if re.search(r'process\.argv|Usage:|usage:',line)],
```

## scripts/check-dependency-pins.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--json`, `--warn-only`

```text
L353: argparse.ArgumentParser(description=__doc__.split("\n")[0])
L354: ap.add_argument("--json", action="store_true", dest="as_json")
L355: ap.add_argument("--warn-only", action="store_true")
```

## scripts/check-mcp-portability.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--config`, `--json`, `--repo`, `--warn-only`

```text
L121: argparse.ArgumentParser(description=__doc__.split("\n")[0])
L122: parser.add_argument("--config", default=DEFAULT_CONFIG,
                        help="path to openclaw.json (default: repo config)")
L124: parser.add_argument("--repo", default=REPO_ROOT,
                        help="repository root used to resolve relative paths")
L126: parser.add_argument("--warn-only", action="store_true",
                        help="print findings but always exit 0")
L128: parser.add_argument("--json", action="store_true", dest="as_json",
                        help="emit machine-readable results")
```

## scripts/check-meraki-capability-ids.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--warn-only`

```text
L108: argparse.ArgumentParser(description=__doc__)
L109: ap.add_argument("--warn-only", action="store_true", help="report findings but exit 0")
```

## scripts/check-mobile-bundle.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
L34: argparse.ArgumentParser(description=__doc__)
L35: parser.add_argument('app', type=Path)
```

## scripts/check-package-references.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--refresh`, `--warn-only`

```text
L184: argparse.ArgumentParser(description=__doc__)
L185: ap.add_argument("--warn-only", action="store_true", help="report findings but exit 0")
L186: ap.add_argument("--refresh", action="store_true",
                    help="re-query the registries and rewrite the manifest (needs network)")
```

## scripts/check-server-startup.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--config`, `--directory`, `--only`, `--warn-only`, `--with`

```text
L236: argparse.ArgumentParser(description=__doc__)
L237: ap.add_argument("--warn-only", action="store_true",
                    help="report findings but exit 0")
L239: ap.add_argument("--only", help="check a single server by name")
L242: ap.add_argument("--config", default=CONFIG,
                    help=f"registration file to read (default: {CONFIG})")
L184: if cmd in ("npx", "uvx", "docker", "node", "npm") and not shutil.which(cmd):
```

## scripts/checkpoint-enable.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--version`

```text
L44: NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
L46: log_error "Node.js >= 18 required. Found: $(node --version)"
L49: log_info "Node.js version: $(node --version)"
L133: echo "--- Management Server (most common) ---"
L163: echo "--- Reputation Service (threat intelligence) ---"
L168: echo "--- Harmony SASE (optional) ---"
L347: echo "  Usage:"
```

## scripts/chrome-devtools-enable.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--browserUrl`, `--channel`, `--executablePath`, `--headless`, `--help`, `--path`, `--remote-debugging-port`, `--user-data-dir`, `--version`

```text
L13: #      explicit --executablePath, then reload the MCP runtime.
L15: # Why --executablePath instead of --channel: chrome-devtools-mcp's --channel
L19: # post-implementation notes). Pinning --executablePath to a NetClaw-managed,
L42: # (see: npx chrome-devtools-mcp@latest --help). NetClaw does not override
L63: node_major="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
L65: log_error "Node.js 18+ is required. Found: $(node --version)"
L68: log_info "Node.js version: $(node --version)"
L108: install_output="$(npx -y @puppeteer/browsers install chrome@stable --path "$BROWSER_CACHE_DIR" 2>&1 | tail -1)"
L114: log_warn "chrome-devtools-mcp may still auto-download its own copy on first use, but this is unverified — pass --executablePath manually if it fails."
L123: HEADLESS_ARGS="[\"-y\",\"chrome-devtools-mcp@latest\",\"--headless=true\",\"--executablePath=$EXECUTABLE_PATH\"]"
L124: VISIBLE_ARGS="[\"-y\",\"chrome-devtools-mcp@latest\",\"--headless=false\",\"--executablePath=$EXECUTABLE_PATH\"]"
L126: HEADLESS_ARGS="[\"-y\",\"chrome-devtools-mcp@latest\",\"--headless=true\"]"
L127: VISIBLE_ARGS="[\"-y\",\"chrome-devtools-mcp@latest\",\"--headless=false\"]"
L148: log_info "Use this --executablePath: $EXECUTABLE_PATH"
L165: echo "    npx chrome-devtools-mcp@latest --headless=false${EXECUTABLE_PATH:+ --executablePath=\"$EXECUTABLE_PATH\"}"
L172: echo "       google-chrome --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-devtools-signin-profile"
L177: echo "       npx chrome-devtools-mcp@latest --browserUrl=http://127.0.0.1:9222"
```

## scripts/cloudflared-transport.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--help`, `--lines`, `--no-pager`, `--now`, `--port`, `--property`, `--user`, `--version`

```text
L4: # Generates and manages a systemd --user unit for cloudflared tunnel transport.
L34: # Usage:
L35: #   ./scripts/cloudflared-transport.sh generate <tunnel-name> [--port PORT]
L39: #   ./scripts/cloudflared-transport.sh --help
L62: Usage:
L63: ${SCRIPT_NAME} generate <tunnel-name> [--port PORT]
L67: ${SCRIPT_NAME} --help | -h
L71: enable    Enable and start the unit (daemon-reload + enable --now)
L76: --port PORT   Local eN2N listener port (default: ${DEFAULT_PORT})
L77: --help, -h    Show this help
L80: # One-time setup for a tunnel named "netclaw-byrnbaker":
L88: ${SCRIPT_NAME} generate netclaw-byrnbaker --port 8179
L125: # Check that systemctl --user is functional
L128: systemctl --user show-environment >/dev/null 2>&1 || die "systemctl --user is not functional. Ensure XDG_RUNTIME_DIR is set and a user session is active (loginctl enable-linger \$USER)."
L225: echo "  systemctl --user daemon-reload"
L226: echo "  systemctl --user enable --now ${unit}"
L243: systemctl --user daemon-reload
L244: systemctl --user enable --now "${unit}"
L248: systemctl --user status "${unit}" --no-pager --lines=5 2>/dev/null || true
L250: info "Logs: journalctl --user -u ${unit} -f"
L262: state=$(systemctl --user is-active "${unit}" 2>/dev/null) || true
L269: systemctl --user show "${unit}" --property=MainPID,ActiveEnterTimestamp --no-pager 2>/dev/null | sed 's/^/  /'
L273: journalctl --user -u "${unit}" --no-pager --lines=10 2>/dev/null || true
L296: systemctl --user disable --now "${unit}" 2>/dev/null || true
L297: systemctl --user daemon-reload
L307: # Handle --help / -h / no args
L308: if [[ $# -eq 0 ]] || [[ "$1" == "--help" ]] || [[ "$1" == "-h" ]]; then
L315: case "${cmd}" in
L316: generate|enable|status|disable)
L318: --version|-V)
L322: *)
L323: die "Unknown subcommand '${cmd}'. Use '${SCRIPT_NAME} --help' for usage."
L329: die "Missing <tunnel-name>. Usage: ${SCRIPT_NAME} ${cmd} <tunnel-name>"
L335: # Parse optional flags (only --port is supported, only for generate)
L338: case "$1" in
L339: --port)
L341: die "--port requires a value"
L346: *)
L347: die "Unknown option '$1'. Use '${SCRIPT_NAME} --help' for usage."
L353: case "${cmd}" in
L354: generate) cmd_generate "${tunnel_name}" "${local_port}" ;;
L355: enable)   cmd_enable "${tunnel_name}" ;;
L356: status)   cmd_status "${tunnel_name}" ;;
L357: disable)  cmd_disable "${tunnel_name}" ;;
```

## scripts/defenseclaw-disable.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
L5: # Usage: ./scripts/defenseclaw-disable.sh
```

## scripts/defenseclaw-enable.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--args`, `--command`, `--enable-guardrail`, `--mode`, `--skip-scan`, `--url`, `--version`

```text
L5: # Usage: ./scripts/defenseclaw-enable.sh
L96: NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
L140: CURRENT_VERSION=$(defenseclaw --version 2>/dev/null || echo "unknown")
L171: defenseclaw init --enable-guardrail 2>/dev/null || log_warn "Guardrail init may have failed - check manually"
L176: "$HOME/.local/bin/defenseclaw" init --enable-guardrail 2>/dev/null || log_warn "Guardrail init may have failed"
L179: log_warn "Then run: defenseclaw init --enable-guardrail"
L220: CURRENT_VERSION=$(openshell --version 2>/dev/null || echo "unknown")
L298: cmd = [defenseclaw, 'mcp', 'set', name, '--skip-scan']
L301: cmd.extend(['--command', server_config['command']])
L306: cmd.extend(['--args', json.dumps(args)])
L308: cmd.extend(['--args', str(args)])
L317: cmd.extend(['--url', url])
L354: echo "  ---------------------------------------------------------"
L365: echo "  ----------------------------------------------------------"
L370: echo "    defenseclaw setup guardrail --mode action"
L381: echo "    openshell --version                # Check version"
L388: echo "    defenseclaw --version              # Check version"
L394: echo "    defenseclaw setup guardrail --mode action  # Enable blocking"
```

## scripts/defenseclaw-slack-guard.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--user`

```text
L21: # visible in `journalctl --user -u openclaw-gateway | grep slack-guard`.
```

## scripts/defenseclaw-slack-watch.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## scripts/deploy-skills.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--backups`, `--destination`, `--preview`, `--restore`, `--source`, `--state-base`

```text
L115: argparse.ArgumentParser(description=__doc__)
L116: parser.add_argument('--source', type=Path)
L117: parser.add_argument('--destination', type=Path)
L118: parser.add_argument('--backups', type=Path)
L119: parser.add_argument('--state-base', default='.openclaw')
L120: parser.add_argument('--restore', type=Path)
L121: parser.add_argument('--preview', action='store_true')
```

## scripts/edge-enrollments.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--dry-run`, `--force`, `--older-than`, `--retire`, `--retire-stale`

```text
L138: argparse.ArgumentParser(
        description="List and retire NetClaw Mobile edge enrollments (FR-017).")
L140: ap.add_argument("--retire", metavar="MEMBER_ID",
                    help="retire this enrollment")
L142: ap.add_argument("--retire-stale", action="store_true",
                    help="retire every enrollment unseen beyond --older-than")
L144: ap.add_argument("--older-than", type=float, default=DEFAULT_STALE_DAYS,
                    metavar="DAYS",
                    help=f"staleness threshold in days (default {DEFAULT_STALE_DAYS})")
L147: ap.add_argument("--dry-run", action="store_true",
                    help="show what would be retired without doing it")
L149: ap.add_argument("--force", action="store_true",
                    help="retire a non-stale enrollment anyway (NOT reversible: "
                         "the pinned key is deleted and the device must re-enroll)")
L213: f"days. Retire with:  {os.path.basename(sys.argv[0])} --retire-stale")
```

## scripts/edge-heartbeat.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--all`, `--dry-run`, `--member`, `--no-pager`, `--since`, `--stale-after-days`, `--user`

```text
L197: argparse.ArgumentParser()
L198: ap.add_argument("--dry-run", action="store_true",
                    help="print the heartbeat instead of pushing it")
L200: ap.add_argument("--member", help="push to only this member_id")
L201: ap.add_argument("--stale-after-days", type=float, default=3.0,
                    help="skip unreachable devices unseen for longer than this "
                         "(abandoned enrollments); ignored for --member")
L204: ap.add_argument("--all", action="store_true",
                    help="push to every enrolled device, including stale ones")
```

## scripts/forward-enable.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--quiet`, `--tags`, `--verify`

```text
L56: git -C "$dir" fetch origin --tags
L62: if git -C "$dir" rev-parse --verify --quiet "origin/$ref" >/dev/null; then
```

## scripts/gait-stdio.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
L34: os.execv(venv_python, [venv_python, os.path.abspath(__file__), *sys.argv[1:]])
```

## scripts/gait-venv-setup.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--restore`

```text
L2: # Create a verified isolated GAIT generation; retain prior runtime for --restore.
```

## scripts/godaddy-ddns.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--max-time`

```text
L16: #   DDNS_NAME     required   record name, e.g. netclaw  ("@" for the apex)
L36: ip="$(curl -fsS --max-time 10 "$url" 2>/dev/null | tr -d '[:space:]')"
L45: curl -fsS --max-time 15 \
L65: code="$(curl -fsS --max-time 20 -o /dev/null -w '%{http_code}' \
L70: case "$code" in
L71: 2*) log "updated ${DDNS_NAME}.${DDNS_DOMAIN} -> ${wanted} (ttl ${TTL})" ;;
L72: *)  log "ERROR GoDaddy PUT returned HTTP ${code}"; exit 1 ;;
```

## scripts/in2n-border-workspace.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--live-workspace`, `--members`, `--on-demand`, `--out`, `--risk`

```text
L131: argparse.ArgumentParser()
L132: ap.add_argument("--risk", required=True)
L133: ap.add_argument("--members", default="", help="always-on member names, comma-sep")
L134: ap.add_argument("--on-demand", default="", help="on-demand member names, comma-sep")
L135: ap.add_argument("--live-workspace", default="~/.openclaw/workspace")
L136: ap.add_argument("--out", default=None)
L16: Usage:
```

## scripts/in2n-member-home.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--anthropic-key-from`, `--border-config`, `--local`, `--member`, `--model`, `--risk`

```text
L44: argparse.ArgumentParser()
L45: ap.add_argument("--risk", required=True)
L46: ap.add_argument("--member", required=True, help="profile/member name, e.g. ipfabric")
L47: ap.add_argument("--model", default=None, help="override model (default: profile tier)")
L48: ap.add_argument("--anthropic-key-from", default="~/.openclaw/.env")
L49: ap.add_argument("--border-config", default=f"{HOME}/.openclaw/openclaw.json")
L16: Usage: python3 scripts/in2n-member-home.py --risk johns-risk --member ipfabric \
```

## scripts/in2n-member.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--idle-exit`, `--local`, `--model`

```text
L148: argparse.ArgumentParser(description="iN2N lightweight member launcher")
L149: ap.add_argument("--idle-exit", type=int, default=int(os.environ.get("N2N_IDLE_EXIT_S", "0")),
                    help="exit after N idle seconds (cold/on-demand); 0 = always-on")
```

## scripts/in2n-migrate.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--border-endpoint`, `--hot`, `--idle-exit`, `--live-env`, `--local`, `--profile`, `--risk`, `--staging`

```text
L58: argparse.ArgumentParser(description="iN2N migration scaffold (generate-only)")
L59: ap.add_argument("--risk", default="johns-risk")
L60: ap.add_argument("--border-endpoint", default="127.0.0.1:11790")
L61: ap.add_argument("--staging", default=os.path.join(REPO, "migration-staging"))
L62: ap.add_argument("--hot", default="cml,pyats,ipfabric,viz",
                    help="comma-separated always-on members; the rest are cold/on-demand")
L64: ap.add_argument("--idle-exit", type=int, default=900,
                    help="idle seconds before a cold/on-demand member exits")
L66: ap.add_argument("--live-env", default="~/.openclaw/.env")
L22: Usage:
```

## scripts/in2n-profiles.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--all`

```text
L10: Usage:
L290: if cmd == "list":
L295: elif cmd == "show" and len(argv) > 1:
L301: elif cmd == "scope" and len(argv) > 1:
L312: sys.exit(_main(sys.argv[1:]))
```

## scripts/in2n-services.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--collect`, `--now`, `--quiet`, `--user`, `--wait`

```text
L332: argparse.ArgumentParser(description="iN2N durable-runtime service generator")
L333: ap.add_subparsers(dest="cmd", required=True)
L334: sub.add_parser("generate")
L335: sub.add_parser("enable")
L336: sub.add_parser("status")
L337: sub.add_parser("disable")
L338: d.add_argument("member", help="member id (<risk>/<name>) or bare name")
L22: Usage:
L249: for member_id, launch_cmd in _always_on_members(risk):
```

## scripts/install.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--add`, `--all`, `--components`, `--full`, `--help`, `--install-daemon`, `--list`, `--new`, `--profile`, `--runtime`, `--tui`, `--user`, `--version`

```text
L6: # recorded in ~/.openclaw/netclaw-components.conf so setup.sh only asks for
L10: #   ./scripts/install.sh --profile recommended
L11: #   ./scripts/install.sh --components "pyats netbox gait"   # exact set (replaces manifest)
L12: #   ./scripts/install.sh --add "gns3 cml"                   # add to what's installed
L13: #   ./scripts/install.sh --all
L14: #   ./scripts/install.sh --list
L35: # `netclaw` launcher inherit the same choice. --runtime / the TUI can change it.
L47: echo "Usage: ./scripts/install.sh [options]"
L50: echo "  --runtime <name>          agent runtime to install: openclaw (default) or hermes"
L52: echo "  --profile <name>          install a profile without the TUI"
L54: echo "  --components \"id id ...\"  install an exact component list (see --list);"
L56: echo "  --add \"id id ...\"         install components on top of an existing install;"
L58: echo "  --all                     install everything ($TOTAL_COMPONENTS components)"
L59: echo "  --list                    list all components and profiles, then exit"
L60: echo "  --help                    this help"
L89: case "$1" in
L90: --runtime)
L91: [ $# -ge 2 ] || { log_error "--runtime needs a value (openclaw|hermes)"; usage; exit 1; }
L92: case "$2" in
L93: openclaw|hermes) NETCLAW_RUNTIME="$2"; NETCLAW_RUNTIME_EXPLICIT=1; define_runtime ;;
L94: *) log_error "Unknown runtime: $2 (valid: openclaw, hermes)"; exit 1 ;;
L97: --profile)
L98: [ $# -ge 2 ] || { log_error "--profile needs a value"; usage; exit 1; }
L101: --components)
L102: [ $# -ge 2 ] || { log_error "--components needs a value"; usage; exit 1; }
L104: catalog_has "$id" || { log_error "Unknown component: $id (run --list to see valid ids)"; exit 1; }
L108: --add)
L109: [ $# -ge 2 ] || { log_error "--add needs a value"; usage; exit 1; }
L111: catalog_has "$id" || { log_error "Unknown component: $id (run --list to see valid ids)"; exit 1; }
L116: --all|--full)
L119: --list)  list_components; exit 0 ;;
L120: --help|-h) usage; exit 0 ;;
L121: *) log_error "Unknown option: $1"; usage; exit 1 ;;
L163: DETECTED_OPENCLAW="$(openclaw --version 2>/dev/null | head -1 || true)"
L174: [ "$(systemctl --user is-active openclaw-gateway.service 2>/dev/null || true)" = "active" ]; then
L232: # --runtime / NETCLAW_RUNTIME was already given explicitly.
L240: case "$TUI_CHOICE" in
L241: 0) NETCLAW_RUNTIME="openclaw" ;;
L242: 1) NETCLAW_RUNTIME="hermes" ;;
L338: log_info "  ./scripts/install.sh --profile recommended"
L339: log_info "  ./scripts/install.sh --components \"pyats netbox gait\""
L340: log_info "  ./scripts/install.sh --add \"gns3 cml\"       # add to an existing install"
L341: log_info "  ./scripts/install.sh --all"
L440: # --add merges into the existing manifest; every other path records the
L451: # Top-level `netclaw` command (menu: TUI / installer / protocol peering)
L516: case "$id" in
L517: pyats)           verify_file "$name" "$PYATS_MCP_DIR/pyats_mcp_server.py" ;;
L518: junos)           verify_dir  "$name" "$JUNOS_MCP_DIR" ;;
L519: arista-cvp)      verify_dir  "$name" "$CVP_MCP_DIR" ;;
L520: f5)              verify_file "$name" "$F5_MCP_DIR/F5MCPserver.py" ;;
L521: catalyst-center) verify_file "$name" "$CATC_MCP_DIR/catalyst-center-mcp.py" ;;
L522: aruba-cx)        verify_dir  "$name" "$ARUBA_CX_MCP_DIR" ;;
L523: gnmi)            verify_dir  "$name" "$GNMI_MCP_DIR" ;;
L524: radkit)          verify_dir  "$name" "$RADKIT_MCP_DIR" ;;
L525: netbox)          verify_file "$name" "$NETBOX_MCP_DIR/src/netbox_mcp_server/server.py" ;;
L526: nautobot)        verify_dir  "$name" "$NAUTOBOT_MCP_DIR" ;;
L527: infrahub)        verify_cmd_or_module "$name" infrahub-mcp infrahub_mcp "pip3 install infrahub-mcp" ;;
L528: infoblox)        verify_cmd_or_module "$name" infoblox-ddi-mcp infoblox_ddi_mcp "pip3 install infoblox-ddi-mcp" ;;
L529: aci)             verify_file "$name" "$ACI_MCP_DIR/aci_mcp/main.py" ;;
L530: nso)             verify_cmd_or_module "$name" cisco-nso-mcp-server cisco_nso_mcp_server "requires Python 3.12+, pip3 install cisco-nso-mcp-server" ;;
L531: itential)        verify_cmd_or_module "$name" itential-mcp itential_mcp "pip3 install itential-mcp" ;;
L532: meraki)          verify_dir  "$name" "$MERAKI_MCP_DIR" ;;
L533: sdwan)           verify_dir  "$name" "$SDWAN_MCP_DIR" ;;
L534: prisma-sdwan)    verify_dir  "$name" "$PRISMA_SDWAN_MCP_DIR" ;;
L535: aap)             verify_dir  "$name" "$AAP_MCP_DIR" ;;
L536: ise)             verify_file "$name" "$ISE_MCP_DIR/src/ise_mcp_server/server.py" ;;
L537: fmc)             verify_dir  "$name" "$FMC_MCP_DIR" ;;
L538: panorama)        verify_cmd_or_module "$name" palo-alto-mcp palo_alto_mcp "pip3 install iflow-mcp-cdot65-palo-alto-mcp" ;;
L539: fortinet)        verify_file "$name" "$FORTINET_MCP_DIR/server.py" ;;
L540: bgp-intel)       verify_file "$name" "$BGP_INTEL_MCP_DIR/server.py" ;;
L541: checkpoint)      verify_dir  "$name" "$CHECKPOINT_MCP_DIR" ;;
L542: claroty)         verify_dir  "$name" "$CLAROTY_MCP_DIR" ;;
L543: nvd-cve)         verify_file "$name" "$NVD_MCP_DIR/mcp_nvd/main.py" ;;
L544: nmap)            verify_file "$name" "$NMAP_MCP_DIR/server.py" ;;
L545: fwrule)          verify_dir  "$name" "$FWRULE_MCP_DIR" ;;
L546: aws)             verify_runner "$name" uvx "6 servers run via uvx" ;;
L547: azure)           verify_dir  "$name" "$AZURE_NET_MCP_DIR" ;;
L548: gcp|cloudflare|terraform|vault|zscaler|datadog|jenkins|kubeshark|ue5)
L550: grafana)         verify_runner "$name" uvx "runs via uvx mcp-grafana" ;;
L551: prometheus)      verify_runner "$name" prometheus-mcp-server "pip CLI entry point" ;;
L552: te-community)    verify_file "$name" "$TE_COMMUNITY_MCP_DIR/src/server.py" ;;
L553: te-official)     verify_runner "$name" npx "remote HTTP via npx mcp-remote" ;;
L554: forward)         verify_dir  "$name" "$FORWARD_MCP_DIR" ;;
L555: suzieq)          verify_dir  "$name" "$SUZIEQ_MCP_DIR" ;;
L556: gtrace)          verify_runner "$name" gtrace "standalone Go binary" ;;
L557: cml)             verify_cmd_or_module "$name" cml-mcp cml_mcp "requires Python 3.12+, pip3 install cml-mcp" ;;
L558: containerlab)    verify_file "$name" "$CLAB_MCP_DIR/clab_mcp_server.py" ;;
L559: batfish)         verify_dir  "$name" "$BATFISH_MCP_DIR" ;;
L560: protocol)        verify_file "$name" "$PROTOCOL_MCP_DIR/server.py" ;;
L561: servicenow)      verify_file "$name" "$SERVICENOW_MCP_DIR/src/servicenow_mcp/cli.py" ;;
L562: github)          verify_runner "$name" docker "runs the GitHub MCP Docker image" ;;
L563: gitlab|msgraph|drawio-rfc)
L565: packet-buddy)    verify_file "$name" "$PACKET_BUDDY_MCP_DIR/server.py" ;;
L566: markmap)         verify_file "$name" "$MARKMAP_INNER/dist/index.js" ;;
L567: uml)             verify_dir  "$name" "$UML_MCP_DIR" ;;
L568: subnet-calc)     verify_file "$name" "$SUBNET_MCP_DIR/servers/subnetcalculator_mcp.py" ;;
L569: wikipedia)       verify_file "$name" "$WIKIPEDIA_MCP_DIR/main.py" ;;
L570: tts)             verify_file "$name" "$TTS_MCP_DIR/server.py" ;;
L571: twitter)         verify_file "$name" "$TWITTER_MCP_DIR/server.py" ;;
L572: twilio)          verify_file "$name" "$TWILIO_MCP_DIR/server.py" ;;
L573: gait)            verify_file "$name" "$GAIT_MCP_DIR/gait_mcp.py" ;;
L574: mempalace)       verify_file "$name" "$MEMPALACE_MCP_DIR/mempalace/mcp_server.py" ;;
L575: humanrail)       verify_file "$name" "$HUMANRAIL_MCP_DIR/server.py" ;;
L576: *)               log_info "$name: configured (no local artifact to check)"
L668: echo "  3. hermes chat                      # Talk to NetClaw (or: hermes --tui)"
L674: echo "    ./scripts/install.sh --runtime hermes   # Add or remove MCP servers"
L678: echo "  3. openclaw chat --new              # Talk to NetClaw"
L681: echo "    openclaw onboard --install-daemon  # AI provider, gateway, channels"
L716: echo "    ./scripts/install.sh --add \"$(echo $PROBLEM_COMPONENTS | tr '\n' ' ' | sed 's/ $//')\""
```

## scripts/ipfabric-enable.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--get`, `--header`, `--max-time`, `--user`, `--version`

```text
L52: NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
L54: log_error "Node.js >= 18 required. Found: $(node --version)"
L57: log_info "Node.js version: $(node --version)"
L152: IPFABRIC_HOST="$(python3 "$NETCLAW_DIR/scripts/write-env.py" --get "$OPENCLAW_ENV" IPFABRIC_HOST)"
L153: IPFABRIC_API_TOKEN="$(python3 "$NETCLAW_DIR/scripts/write-env.py" --get "$OPENCLAW_ENV" IPFABRIC_API_TOKEN)"
L160: if curl -sf --max-time 10 -o /dev/null -w "%{http_code}" \
L192: echo '    "args": ["-y", "mcp-remote", "${IPFABRIC_HOST}/mcp", "--header", "Authorization:${IPFABRIC_AUTH_HEADER}"],'
L224: echo "  Usage:"
L231: echo "    1. Restart OpenClaw gateway: systemctl --user restart openclaw-gateway.service"
```

## scripts/jev-adopt.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--apply`, `--config`, `--env-file`, `--repo`, `--restore`

```text
L73: argparse.ArgumentParser(description=__doc__)
L74: parser.add_argument('--config', required=True, type=Path, help='Discovered active Border OpenClaw config')
L75: parser.add_argument('--env-file', type=Path, help='Chosen runtime env file; required except restore')
L76: parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[1])
L77: parser.add_argument('--apply', action='store_true')
L78: parser.add_argument('--restore', action='store_true')
```

## scripts/jev-audit/build_findings.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## scripts/jev-audit/candidates.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## scripts/jev-audit/common.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## scripts/jev-audit/fix_failure_behavior.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## scripts/jev-audit/sweep1_skill_health.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## scripts/jev-audit/sweep2_overlap_matrix.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## scripts/jev-audit/sweep3_coverage_gaps.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## scripts/jev-border-adopt.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--apply`, `--restore`, `--workspace`

```text
L170: argparse.ArgumentParser(description=__doc__)
L171: parser.add_argument('--workspace', required=True, type=Path)
L173: group.add_argument('--apply', action='store_true')
L174: group.add_argument('--restore', type=Path, metavar='RECOVERY_JSON')
```

## scripts/jev-settings.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--case`, `--daily`, `--data-dir`, `--endpoint`, `--env-file`, `--expires-in`, `--task`

```text
L95: argparse.ArgumentParser(description=__doc__)
L96: parser.add_argument('--env-file', type=Path, default=Path.home()/'.openclaw/.env')
L97: parser.add_argument('--data-dir', type=Path)
L98: parser.add_subparsers(dest='command', required=True)
L99: subs.add_parser('setup')
L100: subs.add_parser('disable')
L101: subs.add_parser('status', help='Show local status without provider calls')
L102: subs.add_parser('task', help='Bind an originating task without resetting spending')
L103: bind.add_argument('task_id')
L104: subs.add_parser('limits', help='Set operator overrides; changes apply to subsequent calls')
L105: limits.add_argument('--daily', type=money)
L106: limits.add_argument('--case', type=money)
L107: limits.add_argument('--task', help='Bind --case override to this trusted runtime task ID')
L108: subs.add_parser('approve-disclosure', help='Approve the exact previewed request for one use')
L109: grant.add_argument('digest')
L110: grant.add_argument('--endpoint', required=True)
L111: grant.add_argument('--task', required=True)
L112: grant.add_argument('--expires-in', type=int, default=300)
```

## scripts/lib/catalog.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
L176: case "$1" in
L177: minimal)        echo "$PROFILE_MINIMAL" ;;
L178: recommended)    echo "$PROFILE_RECOMMENDED" ;;
L179: cisco)          echo "$PROFILE_CISCO" ;;
L180: multivendor)    echo "$PROFILE_MULTIVENDOR" ;;
L181: cloud)          echo "$PROFILE_CLOUD" ;;
L182: security)       echo "$PROFILE_SECURITY" ;;
L183: labs)           echo "$PROFILE_LABS" ;;
L184: observability)  echo "$PROFILE_OBSERVABILITY" ;;
L185: full)           catalog_ids | tr '\n' ' ' ;;
L186: *)              return 1 ;;
```

## scripts/lib/common.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--runtime`

```text
L54: # changes (e.g. after a --runtime flag or the TUI prompt).
L58: case "$RUNTIME" in
L59: openclaw)
L67: hermes)
L75: *)
L209: # re-derives after a --runtime flag or the TUI prompt. Idempotent.
```

## scripts/lib/fetch-lego.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--version`

```text
L12: echo "lego already installed at $DEST ($("$DEST" --version 2>/dev/null | head -1))"
L16: case "$(uname -m)" in
L17: x86_64|amd64) ARCH=amd64 ;;
L18: aarch64|arm64) ARCH=arm64 ;;
L19: *) echo "unsupported arch $(uname -m) — install lego manually into $DEST" >&2; exit 1 ;;
L27: case "$(uname -s)" in
L28: Linux) OS=linux ;;
L29: Darwin) OS=darwin ;;
L30: *) echo "unsupported OS $(uname -s) — install lego manually into $DEST" >&2; exit 1 ;;
```

## scripts/lib/godaddy-acme-hook.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--accept-tos`, `--dns`, `--domains`, `--email`, `--max-time`

```text
L11: #   lego --dns exec --domains netclaw.automateyournetwork.ca --email you@x --accept-tos run
L32: case "$ACTION" in
L33: present)
L34: curl -s -o /dev/null -w "%{http_code}" --max-time 30 "${hdr[@]}" -X PUT \
L39: cleanup)
L42: curl -s -o /dev/null --max-time 30 "${hdr[@]}" -X DELETE \
L45: *) echo "unknown action $ACTION" >&2; exit 1 ;;
```

## scripts/lib/install-steps.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--add`, `--apply`, `--args`, `--backups`, `--break-system-packages`, `--check`, `--command`, `--config`, `--destination`, `--dns-provider`, `--domain`, `--dry-run`, `--edge`, `--enable-guardrail`, `--env`, `--env-file`, `--executablePath`, `--from`, `--global`, `--headless`, `--help`, `--install-daemon`, `--listen`, `--mode`, `--no-pager`, `--no-test`, `--noconfirm`, `--path`, `--python`, `--quiet`, `--repo`, `--restore`, `--reverse`, `--rm`, `--set`, `--sidecar`, `--source`, `--state-base`, `--tags`, `--target`, `--upgrade`, `--upstream`, `--user`, `--venv`, `--verify`, `--version`, `--vnc`, `--web`, `--with`

```text
L32: case "$PKG_MGR:$id" in
L41: *)              out="$out $id" ;;
L50: case "$PKG_MGR" in
L51: apt)    echo "${sp}apt-get update && ${sp}apt-get install -y $pkgs" ;;
L52: dnf)    echo "${sp}dnf install -y $pkgs" ;;
L53: yum)    echo "${sp}yum install -y $pkgs" ;;
L54: pacman) echo "${sp}pacman -S --noconfirm $pkgs" ;;
L55: apk)    echo "${sp}apk add $pkgs" ;;
L56: brew)   echo "brew install $pkgs" ;;
L104: case "$PKG_MGR" in
L105: apt)     node_cmd="curl -fsSL https://deb.nodesource.com/setup_22.x | ${spe}bash - && ${sp}apt-get install -y nodejs" ;;
L106: dnf|yum) node_cmd="curl -fsSL https://rpm.nodesource.com/setup_22.x | ${spe}bash - && ${sp}${PKG_MGR} install -y nodejs" ;;
L107: brew)    node_cmd="brew install node" ;;
L140: NODE_VERSION=$(node --version | sed 's/v//' | cut -d. -f1)
L142: log_error "Node.js >= 18 required. Found: $(node --version)"
L146: log_info "Node.js version: $(node --version)"
L153: case " $MISSING_IDS " in
L155: *) MISSING_IDS="$MISSING_IDS npm" ;;
L245: case ":$PATH:" in
L247: *) export PATH="$HOME/.local/bin:$PATH" ;;
L262: log_info "OpenClaw already installed: $(openclaw --version 2>/dev/null || echo 'version unknown')"
L307: # openclaw's --install-daemon). Best-effort — the agent still
L329: log_info "Reconfigure provider/gateway/channels anytime: openclaw onboard --install-daemon"
L341: openclaw onboard --install-daemon || {
L343: log_warn "You can re-run it later: openclaw onboard --install-daemon"
L348: log_warn "After fixing your PATH, run: openclaw onboard --install-daemon"
L355: # `openclaw onboard --install-daemon` can report success while the gateway
L383: state="$(systemctl --user is-active openclaw-gateway.service 2>/dev/null || true)"
L384: case "$state" in
L385: active)                 break ;;
L386: activating|reloading)   sleep 1 ;;
L387: *)                      break ;;   # inactive/failed/no user bus
L411: if journalctl --user -u openclaw-gateway.service -n 10 --no-pager &> /dev/null; then
L414: journalctl --user -u openclaw-gateway.service -n 10 --no-pager 2>/dev/null | sed 's/^/    /'
L418: echo "    systemctl --user status openclaw-gateway.service"
L419: echo "    journalctl --user -u openclaw-gateway.service -n 50 --no-pager"
L423: echo "    openclaw onboard --install-daemon      # re-run the service install"
L434: openclaw onboard --install-daemon || log_warn "openclaw onboard exited with an error."
L477: python3 "$NETCLAW_DIR/scripts/setup-pyats-runtime.py" --target "$pyats_venv" || return 1
L481: --env-file "$RUNTIME_ENV" --repo "$NETCLAW_DIR" --venv "$pyats_venv" \
L482: --upstream "$PYATS_MCP_DIR/pyats_mcp_server.py" --apply; then
L486: python3 "$NETCLAW_DIR/scripts/setup-pyats-runtime.py" --target "$pyats_venv" --restore || return 1
L504: git -C "$JUNOS_MCP_DIR" pull --quiet 2>/dev/null || true
L514: # Spec 090: netclaw_pip_install handles PEP 668 itself now, so the inline
L515: # --break-system-packages retry is gone -- and stderr is no longer discarded.
L527: # only devices-template.json -- which contains placeholder credentials and a device
L556: git -C "$CVP_MCP_DIR" pull --quiet 2>/dev/null || true
L563: # foreign home directory that exists on no NetClaw host -- so the server raised
L568: # re-applied after every `git pull` above -- the same durable-patch shape the Slack
L593: # The registration passes --with urllib3 --with python-dotenv alongside fastmcp: the
L594: # server imports both, and `uv run` sees only what --with provides, never the system
L631: log_warn "Fix the error, then retry with: ./scripts/install.sh --add \"markmap\""
L683: git -C "$NAUTOBOT_MCP_DIR" pull --quiet 2>/dev/null || true
L725: git -C "$INFRAHUB_MCP_DIR" pull --quiet 2>/dev/null || true
L754: git -C "$ITENTIAL_MCP_DIR" pull --quiet 2>/dev/null || true
L952: log_info "GitHub MCP ready: docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server"
L1004: log_info "uv found: $(uv --version 2>/dev/null || echo 'version unknown')"
L1026: log_info "tshark found: $(tshark --version 2>/dev/null | head -1)"
L1143: git -C "$FMC_MCP_DIR" pull --quiet 2>/dev/null || true
L1198: # memory, RAG, federation and GAIT stores are never readable from it -- a generic SQL
L1215: # NO upper bound -- Authlib, pygnmi, service-identity, sshsig -- and NetClaw's own
L1216: # federation TLS stack (spec 060) is built on it. Measured by `pip install --dry-run`
L1223: # `python3 -m venv` fails on hosts without ensurepip (this one included); netclaw_venv_create
L1260: # Builder, which is ENTERPRISE-tier on self-managed -- so the supported path is paywalled
L1268: docker pull --quiet \
L1274: # there -- the registration adds host.docker.internal, so a local cluster is
L1298: # Ubuntu 26.04, and `suricata` needs root to install. Both images are pinned by DIGEST --
L1305: docker pull --quiet zeek/zeek@sha256:eca2b3915d3e067cbb4a904f23f4c4f461ea2b60613ab30f7ee77bbc707c87c7 \
L1307: docker pull --quiet jasonish/suricata@sha256:81468a22f0b685f3d7e0c1646ab4fdb9a67c1b3dfa3357c52b1434dd4f39dc49 \
L1324: if docker run --rm -v "$NSM_RULES:/var/lib/suricata/rules" \
L1326: suricata-update --no-test >/dev/null 2>&1 && [ -s "$NSM_RULES/suricata.rules" ]; then
L1346: # not start at all on a PEP 668 host -- one of the seven found by spec 088.
L1359: # DefenseClaw silently 403s outbound calls to unregistered domains -- this has cost this
L1386: git -C "$TE_COMMUNITY_MCP_DIR" pull --quiet 2>/dev/null || true
L1447: git -C "$RADKIT_MCP_DIR" pull --quiet 2>/dev/null || true
L1582: git -C "$UML_MCP_DIR" pull --quiet 2>/dev/null || true
L1682: uvx --help &>/dev/null || true
L1727: log_info "  Install: helm install kubeshark kubeshark/kubeshark --set mcp.enabled=true --set mcp.port=8898"
L1753: log_info "nmap already installed: $(nmap --version 2>&1 | head -1)"
L1858: log_info "gtrace MCP ready: $(gtrace --version 2>&1 | head -1) (6 tools: traceroute, mtr, globalping, asn_lookup, geo_lookup, reverse_dns)"
L1980: # `risk token --edge` answering "only a Border can issue enrollment tokens",
L2018: case "$TUI_CHOICE" in
L2019: 0)
L2023: 1)
L2030: case "$TUI_CHOICE" in
L2031: 0) _stacks=both ;; 1) _stacks=in2n ;; *) _stacks=en2n ;;
L2042: 2)
L2065: echo "  mesh daemon + always-on members durable systemd --user services."
L2084: if declare -f tui_confirm >/dev/null 2>&1 && tui_confirm "Generate + enable durable systemd --user services now?"; then
L2088: log_warn "service enable failed (systemctl --user may be unavailable on this host)"
L2116: if netclaw_pip_install -q --upgrade infoblox-ddi-mcp 2>/dev/null; then
L2132: if netclaw_pip_install -q --upgrade iflow-mcp-cdot65-palo-alto-mcp 2>/dev/null; then
L2174: git -C "$PRISMA_SDWAN_MCP_DIR" pull --quiet 2>/dev/null || true
L2296: git -C "$ARUBA_CX_MCP_DIR" pull --quiet 2>/dev/null || true
L2500: # ── Step 50c: Install Token Optimization Library (netclaw_tokens)
L2731: git -C "$dir" fetch origin --tags
L2737: if git -C "$dir" rev-parse --verify --quiet "origin/$ref" >/dev/null; then
L2864: --source "$NETCLAW_DIR/config/openclaw.json" \
L2865: --repo   "$NETCLAW_DIR" \
L2866: --env    "$RUNTIME_ENV" \
L2867: --config "$RUNTIME_CONFIG" \
L2868: --sidecar "$RUNTIME_HOME/netclaw-mcp-servers.yaml"; then
L2886: --config "$OPENCLAW_DIR/openclaw.json" \
L2887: --repo   "$NETCLAW_DIR" \
L2900: --source "$NETCLAW_DIR/workspace/skills" \
L2901: --destination "$RUNTIME_SKILLS" \
L2902: --backups "$RUNTIME_HOME/skill-deployment-backups" \
L2903: --state-base "$(basename "$RUNTIME_HOME")" || return 1
L3207: NODE_VER=$(node --version | sed 's/v//' | cut -d. -f1)
L3229: defenseclaw init --enable-guardrail 2>/dev/null || log_warn "Guardrail init failed - run manually: defenseclaw init --enable-guardrail"
L3231: log_warn "defenseclaw CLI not in PATH. Add ~/.local/bin to PATH and run: defenseclaw init --enable-guardrail"
L3267: OPENSHELL_VERSION=$(openshell --version 2>/dev/null || echo "unknown")
L3292: echo "    openshell --version                    # Check OpenShell"
L3295: echo "    defenseclaw --version                  # Check DefenseClaw"
L3297: echo "    defenseclaw setup guardrail --mode action  # Enable blocking"
L3426: log_info "  hermes mcp add memory-mcp --command uvx --args '--from,netclaw-memory-mcp,memory-mcp-server' --env MEMORY_DATA_DIR=$MEMORY_DATA_DIR"
L3428: log_info "  openclaw mcp set memory-mcp '{\"command\":\"uvx\",\"args\":[\"--from\",\"netclaw-memory-mcp\",\"memory-mcp-server\"],\"env\":{\"MEMORY_DATA_DIR\":\"$MEMORY_DATA_DIR\"}}'"
L3488: log_info "Ollama found: $(ollama --version 2>/dev/null || echo 'version unknown')"
L3582: if ! git -C "$SKETCHFAB_MCP_DIR" apply --reverse --check "$SKETCHFAB_PATCH" 2>/dev/null; then
L3649: echo "  for the WSL2 mirrored-networking check and the --listen fallback."
L3731: install_output="$(npx -y @puppeteer/browsers install chrome@stable --path "$CHROME_DEVTOOLS_CACHE_DIR" 2>&1 | tail -1)"
L3744: HEADLESS_ARGS="[\"-y\",\"chrome-devtools-mcp@latest\",\"--headless=true\",\"--executablePath=$CHROME_DEVTOOLS_EXECUTABLE\"]"
L3745: VISIBLE_ARGS="[\"-y\",\"chrome-devtools-mcp@latest\",\"--headless=false\",\"--executablePath=$CHROME_DEVTOOLS_EXECUTABLE\"]"
L3747: HEADLESS_ARGS="[\"-y\",\"chrome-devtools-mcp@latest\",\"--headless=true\"]"
L3748: VISIBLE_ARGS="[\"-y\",\"chrome-devtools-mcp@latest\",\"--headless=false\"]"
L3753: hermes mcp add chrome-devtools-mcp --command npx >/dev/null 2>&1 \
L3755: || log_warn "Could not add chrome-devtools-mcp — add it manually: hermes mcp add chrome-devtools-mcp --command npx"
L3757: log_info "  args: [\"-y\", \"chrome-devtools-mcp@latest\", \"--headless=true\"]"
L3759: log_info "hermes CLI not found — add chrome-devtools-mcp later: hermes mcp add chrome-devtools-mcp --command npx"
L3773: log_info "Sign in once per target site: npx chrome-devtools-mcp@latest --headless=false${CHROME_DEVTOOLS_EXECUTABLE:+ --executablePath=\"$CHROME_DEVTOOLS_EXECUTABLE\"}"
L3791: case "$PKG_MGR" in
L3792: apt)
L3798: dnf|yum)
L3803: pacman)
L3805: sudo pacman -S --noconfirm $COMPUTER_USE_PACKAGES 2>/dev/null || \
L3808: *)
L3829: if openclaw skills install --global computer-use 2>&1 | tail -5; then
L3835: # (0644) -- confirmed live: every action script fails with "Permission
L3842: log_warn "Could not install the computer-use skill automatically — try manually: openclaw skills install --global computer-use"
L3845: log_warn "openclaw CLI not found — install the skill manually once OpenClaw is set up: openclaw skills install --global computer-use"
L3848: # The skill only ships its action scripts (click.sh, screenshot.sh, ...) --
L3860: # and the novnc unit's --listen has no bind address) -- a real exposure
L3864: # pattern, which this doesn't change -- it just makes it mandatory.
L3872: # wrapper the skill's script assumes -- confirmed missing live on
L3875: -e 's|ExecStart=.*novnc_proxy.*|ExecStart=/usr/share/novnc/utils/launch.sh --vnc localhost:5900 --listen 127.0.0.1:6080 --web /usr/share/novnc|' \
L3876: -e 's/--listen 6080\b/--listen 127.0.0.1:6080/' \
L3912: # but install it now so `--domain` works later without a second step).
L3938: log_info "Domain-verified identity (optional): scripts/patch-claw-certs.sh --domain <name> --dns-provider <id>"
L3961: log_warn "Install it with: python3 -m pip install --user virtualenv"
L4014: # isolation from nothing. netclaw_pip_install, never bare pip — on a split
L4118: # DEDICATED VIRTUALENV -- NOT OPTIONAL, DO NOT "SIMPLIFY" THIS AWAY.
L4121: # ISE_MCP. A shared install breaks all five -- spec 076's cryptography
L4139: # netclaw_pip_install: that targets the system interpreter, which is the exact
L4141: # Naming --python satisfies the same rule netclaw_pip_install enforces --
L4144: uv pip install -q --python "$ZABBIX_MCP_DIR/.venv/bin/python" -r requirements.txt ) 2>/dev/null || \
L4244: # netclaw_pip_install: that targets the system interpreter, which is the
L4247: uv pip install -q --python "$PERCEPXION_MCP_DIR/.venv/bin/python" -r requirements.txt ) 2>/dev/null || \
L4294: uv pip install -q --python "$SLC_MCP_DIR/.venv/bin/python" -r requirements.txt ) 2>/dev/null || \
L4352: python3 "$NETCLAW_DIR/scripts/jev-settings.py" --env-file "$RUNTIME_ENV" setup || return 1
L4354: log_info "Enable and configure Jev: python3 scripts/jev-settings.py --env-file '$RUNTIME_ENV' setup"
```

## scripts/lib/make-logo-art.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
L8: Usage: python3 scripts/lib/make-logo-art.py [cols] [rows]
L18: COLS = int(sys.argv[1]) if len(sys.argv) > 1 else 76
L19: ROWS = int(sys.argv[2]) if len(sys.argv) > 2 else 20
```

## scripts/lib/pip-helper.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--upgrade`, `--user`, `--version`

```text
L30: #   netclaw_pip_install <args...>                  # into NETCLAW_PY (default python3)
L31: #   NETCLAW_VENV=/path/to/.venv netclaw_pip_install <args...>   # into that venv
L32: #   netclaw_venv_create /path/to/.venv             # create a venv that actually works
L72: if ! "$py" -m pip --version >/dev/null 2>&1; then
L74: echo "  Remedy: $py -m ensurepip --upgrade   (or install the matching *-venv package)" >&2
L137: echo "  Remedy (no root needed):  $base -m pip install --user virtualenv" >&2
```

## scripts/lib/render_md.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## scripts/lib/tui.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
L21: # ANSI half-block rendering of netclaw.jpg — the lobster with its CCIE badge
L23: # lib/make-logo-art.py into lib/netclaw-logo.ans; shown on 256-color
L53: case "$rest" in
L58: *)    echo esc ;;
L61: case "$k" in
L64: k|K)     echo up ;;
L65: j|J)     echo down ;;
L66: a|A)     echo all ;;
L67: n|N)     echo none ;;
L68: q|Q)     echo quit ;;
L69: *)       echo "$k" ;;
L128: case "$key" in
L129: up)    cur=$(( (cur + total - 1) % total )) ;;
L130: down)  cur=$(( (cur + 1) % total )) ;;
L131: enter) TUI_CHOICE=$cur; printf '\033[?25h'; echo ""; return 0 ;;
L132: quit|esc) printf '\033[?25h'; echo ""; return 1 ;;
L199: case "$key" in
L200: up)
L204: down)
L208: space)
L210: all)
L212: none)
L214: enter)
L221: quit|esc)
```

## scripts/mcp-call.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
L4: Usage:
L95: if len(sys.argv) < 3:
L96: print(f"Usage: {sys.argv[0]} <server-command> <tool-name> [arguments-json]", file=sys.stderr)
L99: server_cmd = sys.argv[1]
L100: tool_name = sys.argv[2]
L102: if len(sys.argv) > 3:
L104: args_json = json.loads(sys.argv[3])
```

## scripts/measure-turn-latency.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--json`, `--no-pager`, `--phone-sample-size`, `--since`, `--user`

```text
L143: argparse.ArgumentParser(description=__doc__)
L144: parser.add_argument("--phone-sample-size", type=int, default=20,
                         help="Number of recent phone-originated turns to sample (default 20, "
                              "matching the spec's original sample)")
L147: parser.add_argument("--json", action="store_true", help="Output machine-readable JSON")
L17: Usage:
```

## scripts/memory-enable.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--from`, `--help`, `--quiet`

```text
L4: # Usage: ./scripts/memory-enable.sh
L36: uv pip install -e . --quiet 2>/dev/null || {
L51: "args": ["--from", "netclaw-memory-mcp", "memory-mcp-server"],
L69: echo "To test: uvx --from netclaw-memory-mcp memory-mcp-server --help"
```

## scripts/migrate-change-gates.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--apply`, `--env-file`, `--restore`

```text
L48: argparse.ArgumentParser(description=__doc__)
L48: p.add_argument('--env-file',default=str(Path.home()/'.openclaw/.env'))
L49: p.add_argument('--apply',action='store_true')
L49: p.add_argument('--restore',action='store_true')
```

## scripts/migrate-hud-access.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--api-port`, `--connect`, `--ssh-target`, `--ui-port`

```text
L32: argparse.ArgumentParser(description=__doc__)
L33: p.add_argument('--ssh-target', required=True, type=ssh_target)
L34: p.add_argument('--ui-port', type=tcp_port, default=3000, help='same local/remote HUD_UI_PORT (default 3000)')
L35: p.add_argument('--api-port', type=tcp_port, default=3001, help='same local/remote HUD_PORT (default 3001)')
L36: p.add_argument('--connect', action='store_true', help='open the tunnel; otherwise preview only')
```

## scripts/migrate-in2n-transport.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--apply`, `--bind`, `--ca-file`, `--cert`, `--env-file`, `--key`, `--restore`

```text
L53: argparse.ArgumentParser(description=__doc__)
L54: p.add_argument('--env-file',default=str(Path.home()/'.openclaw/.env'))
L55: p.add_argument('--bind',default='127.0.0.1')
L55: p.add_argument('--cert')
L55: p.add_argument('--key')
L55: p.add_argument('--ca-file')
L56: p.add_argument('--apply',action='store_true')
L56: p.add_argument('--restore',action='store_true')
```

## scripts/migrate-integration-tls.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--apply`, `--ca-bundle`, `--env-file`, `--lab-insecure`, `--restore`, `--service`

```text
L46: argparse.ArgumentParser(description=__doc__)
L47: p.add_argument('--env-file',default=str(Path.home()/'.openclaw/.env'))
L48: p.add_argument('--service',choices=('redfish','nautobot','anta'),default='redfish')
L49: p.add_argument('--ca-bundle')
L49: p.add_argument('--lab-insecure',action='store_true')
L50: p.add_argument('--apply',action='store_true')
L50: p.add_argument('--restore',action='store_true')
```

## scripts/migrate-local-file-permissions.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--apply`, `--journal`, `--path`, `--restore`

```text
L76: argparse.ArgumentParser(description=__doc__)
L77: parser.add_argument('--path', action='append', help='Override default target set; may repeat')
L78: parser.add_argument('--journal', default=str(home / 'local-permissions-backup.json'))
L79: parser.add_argument('--apply', action='store_true')
L80: parser.add_argument('--restore', action='store_true')
```

## scripts/migrate-pyats-http.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--apply`, `--env-file`, `--repo`, `--restore`, `--upstream`, `--venv`

```text
L53: argparse.ArgumentParser(description=__doc__)
L54: ap.add_argument('--env-file',default=str(Path.home()/'.openclaw/.env'))
L55: ap.add_argument('--repo',default=str(Path(__file__).resolve().parents[1]))
L56: ap.add_argument('--venv',default=str(Path.home()/'.openclaw/pyats-venv'))
L57: ap.add_argument('--upstream',help='Explicit verified managed server script; legacy repo path remains the default')
L58: ap.add_argument('--apply',action='store_true')
L58: ap.add_argument('--restore',action='store_true')
```

## scripts/migrate-ssh-trust.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--apply`, `--env-file`, `--known-hosts`, `--restore`

```text
L55: argparse.ArgumentParser(description=__doc__)
L56: parser.add_argument('--env-file', default=str(Path.home() / '.openclaw/.env'))
L57: parser.add_argument('--known-hosts')
L58: parser.add_argument('--apply', action='store_true')
L59: parser.add_argument('--restore', action='store_true')
```

## scripts/migrate-tls-registration.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--apply`, `--config`, `--repo`, `--restore`

```text
L61: argparse.ArgumentParser(description=__doc__)
L62: parser.add_argument('--config', default=str(Path.home() / '.openclaw/openclaw.json'))
L63: parser.add_argument('--repo', default=str(Path(__file__).resolve().parent.parent))
L64: parser.add_argument('--apply', action='store_true')
L65: parser.add_argument('--restore', action='store_true')
```

## scripts/migrate-voice-auth.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--apply`, `--env-file`, `--public-url`, `--restore`

```text
L148: argparse.ArgumentParser(description=__doc__)
L149: parser.add_argument('--env-file', default='.env')
L150: parser.add_argument('--public-url')
L151: parser.add_argument('--apply', action='store_true')
L152: parser.add_argument('--restore', action='store_true')
```

## scripts/migrate-zoom-auth.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--apply`, `--env-file`, `--restore`

```text
L43: argparse.ArgumentParser(description=__doc__)
L43: p.add_argument('--env-file',default=str(Path.home()/'.openclaw/.env'))
L44: p.add_argument('--apply',action='store_true')
L44: p.add_argument('--restore',action='store_true')
```

## scripts/mobile-release-archive.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--upload-app`

```text
L4: # Produces an App Store Connect-ready .ipa from mobile/netclaw-mobile's
L7: # Usage: ./scripts/mobile-release-archive.sh
L12: #   - mobile/netclaw-mobile/ExportOptions.plist's teamID filled in
L31: # Apple Developer Program under the SAME team ID (A49777FMJG) -- common for
L59: # Sensitive Notifications -- specs 111/114) and the widget extension target
L70: echo -e "${YELLOW}Next:${NC} upload via Transporter or 'xcrun altool --upload-app', then complete"
```

## scripts/netclaw

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--break-system-packages`, `--edge`, `--get`, `--help`, `--log`, `--log-format`, `--max-time`, `--since`, `--systemd`, `--tui`, `--user`, `--watch`

```text
L2: # netclaw — top-level NetClaw command.
L4: #   netclaw                 interactive menu (TUI launcher, installer, peering)
L5: #   netclaw tui             open the NetClaw chat TUI (openclaw tui)
L6: #   netclaw install [...]   run the component installer (flags pass through)
L7: #   netclaw peering [status|bgp|n2n|ngrok]    protocol peering status (non-interactive)
L8: #   netclaw peering up|down                   start/stop daemon + ngrok together
L9: #   netclaw peering announce                  print an endpoint message to relay to peers
L10: #   netclaw chats [id]       list N2N chat sessions, or tail one
L11: #   netclaw chats --watch    live-watch for new sessions/lines (Ctrl+C to stop)
L12: #   netclaw link            (re)create the ~/.local/bin/netclaw symlink
L15: #   netclaw risk enroll-mobile [device-label]     one command: checks, promotes to
L17: #   netclaw risk role border <risk-name> [in2n]   promote standalone → Border
L18: #   netclaw risk edge-check                       preflight every precondition
L19: #   netclaw risk token --edge <device-label>       mint the single-use QR
L20: #   See mobile/netclaw-mobile/MOBILE-ONBOARDING.md for the full procedure.
L39: # here so `netclaw tui` and .env reads follow the chosen runtime.
L42: RUNTIME_CMD="hermes"; RUNTIME_HOME="${HERMES_HOME:-$HOME/.hermes}"; RUNTIME_TUI=(hermes --tui)
L57: api_get() { curl -s --max-time 3 "$BGP_API$1" 2>/dev/null || true; }
L66: curl -s --max-time 30 -H 'Content-Type: application/json' -d "$body" "$BGP_API$1" 2>/dev/null || true
L69: ngrok_get() { curl -s --max-time 3 "$NGROK_API$1" 2>/dev/null || true; }
L76: # and looking at only the first file made `netclaw risk token --edge` fail with
L82: v="$(python3 "$NETCLAW_ROOT/scripts/write-env.py" --get "$f" "$1")" || return 1
L93: # 2026-08-19: `netclaw risk role border` succeeds (POST 200, `risk status`
L102: printf '%s' "$val" | python3 "$NETCLAW_ROOT/scripts/write-env.py" --systemd "$f" "$key"
L122: setsid nohup ngrok tcp "$port" --log /tmp/ngrok-mesh.log --log-format json \
L454: echo -e "  ${T_DIM}--- $(basename "$f" .txt) ---${T_NC}"
L479: case " ${days[*]-} " in *" $d "*) ;; *) days+=("$d") ;; esac
L492: case "$TUI_CHOICE" in
L493: 0) chats_watch; continue ;;
L494: 1) chat_tail "${CHAT_FILES[0]}"; continue ;;
L620: case "$role" in
L621: standalone|border|member) ;;
L622: *) echo "usage: netclaw risk role <standalone|border|member> [risk-name] [stacks]"
L646: case "$stacks" in
L647: in2n|both) ;;
L648: *) echo "  note: enabled_stacks='$stacks' does not include in2n —"
L665: print("    check:  systemctl --user status netclaw-mesh.service")
L681: echo "      systemctl --user restart netclaw-mesh.service"
L701: echo "                systemctl --user status netclaw-mesh.service"
L716: case "$stacks" in
L717: in2n|both) echo "  ✓ stack     : $stacks (in2n enabled)" ;;
L718: *) echo "  ✗ stack     : ${stacks:--} — the edge listener needs in2n"
L751: echo "                $mesh_py -m pip install --break-system-packages$missing"
L768: case "$lstate" in
L769: listening) echo "  ✓ listener  : bound" ;;
L771: *)         echo "  ✗ listener  : $lstate${lerr:+ — $lerr}"
L792: echo "                journalctl --user -u netclaw-mesh.service --since '2 min ago' | grep -i Edge"
L813: wan="$(curl -s --max-time 5 https://api.ipify.org 2>/dev/null || true)"
L828: echo "      $(basename "$0") risk token --edge <device-label>"
L831: echo "      systemctl --user restart netclaw-mesh.service"
L893: # (edge-check -> role border -> restart -> edge-check -> token --edge),
L905: # abort the WHOLE netclaw invocation right here, silently swallowed
L932: if systemctl --user restart netclaw-mesh.service 2>/dev/null; then
L936: echo "      systemctl --user restart netclaw-mesh.service"
L976: case "$TUI_CHOICE" in
L977: 0) risk_overview; pause ;;
L978: 1) risk_members; pause ;;
L979: 2) risk_health; pause ;;
L980: 3) risk_token; pause ;;
L981: 4) risk_edge_token; pause ;;
L982: 5) risk_edge_check; pause ;;
L983: 6) return 0 ;;
L1002: case "$TUI_CHOICE" in
L1003: 0) peering_overview; pause ;;
L1004: 1) peering_bgp; pause ;;
L1005: 2) peering_n2n; pause ;;
L1006: 3) peering_ngrok; pause ;;
L1007: 4) chats_menu ;;
L1008: 5) peering_start_all; pause ;;
L1009: 6) peering_stop_all; pause ;;
L1010: 7) peer_announce; pause ;;
L1011: 8) return 0 ;;
L1030: case "$TUI_CHOICE" in
L1031: 0) exec "${RUNTIME_TUI[@]}" ;;
L1032: 1) exec "$NETCLAW_ROOT/scripts/install.sh" ;;
L1033: 2) peering_menu ;;
L1034: 3) risk_menu ;;
L1035: 4) exit 0 ;;
L1048: case "${1:-}" in
L1050: tui)       exec "${RUNTIME_TUI[@]}" ;;
L1051: install)   shift; exec "$NETCLAW_ROOT/scripts/install.sh" "$@" ;;
L1052: peering)
L1053: case "${2:-status}" in
L1054: status)   peering_overview ;;
L1055: bgp)      peering_bgp ;;
L1056: n2n)      peering_n2n ;;
L1057: ngrok)    peering_ngrok ;;
L1058: up)       peering_start_all ;;
L1059: down)     peering_stop_all ;;
L1060: announce) peer_announce ;;
L1061: *)        echo "Usage: netclaw peering [status|bgp|n2n|ngrok|up|down|announce]"; exit 1 ;;
L1063: risk)
L1064: case "${2:-status}" in
L1065: status)   risk_overview ;;
L1066: members)  risk_members ;;
L1067: health)   risk_health ;;
L1068: add)      risk_add "${3:-}" "${4:-}" "${5:-}" ;;
L1069: remove)   risk_remove "${3:-}" ;;
L1070: role)     risk_role "${3:-}" "${4:-}" "${5:-}" ;;
L1071: edge-check|edge_check|preflight) risk_edge_check ;;
L1072: token)
L1073: if [ "${3:-}" = "--edge" ]; then
L1078: enroll-mobile|enroll_mobile) risk_enroll_mobile "${3:-}" ;;
L1079: route)    risk_route "${3:-}" "${4:-}" ;;
L1080: *)        echo "Usage: netclaw risk [status|members|health|role|edge-check|add|remove|token [--edge]|enroll-mobile [label]|route]"; exit 1 ;;
L1082: chats)
L1083: if [ "${2:-}" = "--watch" ] || [ "${2:-}" = "watch" ]; then
L1095: link)      do_link ;;
L1096: help|-h|--help)
L1098: *) echo "Unknown command: $1 (try: netclaw help)"; exit 1 ;;
```

## scripts/netclaw-secure-start.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--enable-guardrail`, `--from`, `--mode`, `--name`, `--policy`, `--version`, `--wait`

```text
L5: # Usage:
L6: #   ./scripts/netclaw-secure-start.sh          # Start everything
L7: #   ./scripts/netclaw-secure-start.sh stop     # Stop everything
L8: #   ./scripts/netclaw-secure-start.sh status   # Check status
L146: RUN openclaw --version
L150: openshell sandbox create --name "$SANDBOX_NAME" --from /tmp/netclaw-sandbox > /tmp/sandbox-build.log 2>&1 &
L715: if openshell policy set "$SANDBOX_NAME" --policy /tmp/netclaw-sandbox-policy.yaml --wait 2>&1; then
L867: defenseclaw init --enable-guardrail 2>/dev/null || true
L1024: echo "    defenseclaw setup guardrail --mode action"
L1036: case "${1:-start}" in
L1037: start)
L1040: stop)
L1043: status)
L1046: *)
L1047: echo "Usage: $0 {start|stop|status}"
```

## scripts/normalize-mcp-cwd.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--config`, `--dry-run`, `--repo`

```text
L51: argparse.ArgumentParser()
L52: ap.add_argument("--config", required=True)
L53: ap.add_argument("--repo", required=True)
L54: ap.add_argument("--dry-run", action="store_true")
L20: Usage:
```

## scripts/openclaw-to-hermes-mcp.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--config`, `--env`, `--repo`, `--sidecar`, `--source`

```text
L174: argparse.ArgumentParser(description=__doc__)
L175: ap.add_argument("--source", required=True, help="path to config/openclaw.json")
L176: ap.add_argument("--repo", required=True, help="NetClaw repo root (for absolute paths)")
L177: ap.add_argument("--env", default="", help="shared .env for ${VAR} resolution")
L178: ap.add_argument("--config", required=True, help="target ~/.hermes/config.yaml")
L179: ap.add_argument("--sidecar", default="", help="fallback file if config.yaml already has mcp_servers")
L23: Usage:
```

## scripts/patch-claw-certs.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--all`, `--dns-provider`, `--domain`, `--enforce`, `--ff-only`, `--max-time`, `--no-legend`, `--systemd`, `--type`, `--user`, `--yes`

```text
L4: #   scripts/patch-claw-certs.sh [--domain <name>] [--dns-provider <id>] [--enforce] [--yes]
L20: case "$1" in
L21: --domain) DOMAIN="$2"; shift 2 ;;
L22: --dns-provider) PROVIDER="$2"; shift 2 ;;
L23: --enforce) ENFORCE="enforce"; shift ;;
L24: --yes|-y) ASSUME_YES=1; shift ;;
L25: *) echo "unknown arg: $1" >&2; exit 1 ;;
L31: # --- state counts BEFORE (integrity check) ---
L53: # --- 1. pull the release ---
L56: git -C "$REPO" pull --ff-only || say "WARN: git pull skipped (dirty tree or offline)"
L59: # --- 2. lego (only needed for the domain-verified path) ---
L64: # --- 3. migrate schema + generate credentials (opening the manager runs the
L65: #        additive v3 migration; RiskManager.ensure_risk_ca creates the CA) ---
L89: # --- 4. env: turn on secured channels ---
L90: # IMPORTANT: the systemd --user mesh daemon reads its own EnvironmentFile (feature
L95: ENVF="$(systemctl --user cat netclaw-mesh.service 2>/dev/null \
L101: printf '%s' "$2" | python3 "$REPO/scripts/write-env.py" --systemd "$ENVF" "$1"
L108: # --- 5. restart services in dependency order (feature 057) ---
L109: if command -v systemctl >/dev/null && systemctl --user list-units >/dev/null 2>&1; then
L111: systemctl --user restart openclaw-gateway.service 2>/dev/null || true
L112: systemctl --user restart netclaw-mesh.service 2>/dev/null || true
L113: for u in $(systemctl --user list-units --type=service --all --no-legend 'netclaw-member-*' 2>/dev/null | awk '{print $1}'); do
L114: systemctl --user restart "$u" 2>/dev/null || true
L117: say "no systemd --user manager — restart the daemon manually to apply"
L120: # --- 6. integrity check + posture ---
L129: if curl -s --max-time 3 http://127.0.0.1:8179/n2n/certs >/dev/null 2>&1; then
```

## scripts/peering-launch.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
L20: env = environment(sys.argv[1])
L23: os.execve(sys.executable, [sys.executable, sys.argv[2]], env)
```

## scripts/peering-setup.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--get`

```text
L19: # TTY-aware yes/no (spec 119) -- this file's own ask()/ask_yn() below always
L34: python3 "$SCRIPT_DIR/write-env.py" --get "$OPENCLAW_ENV" "$1"
L56: case "$input" in
L59: *) echo -e "  ${YELLOW}Please answer y or n.${NC}" ;;
L139: case "${1:-}" in
L140: start)  daemon_start;  exit 0 ;;
L141: stop)   daemon_stop;   exit 0 ;;
L142: status) daemon_status; exit 0 ;;
L144: *) echo "Usage: $0 [start|stop|status]"; exit 1 ;;
L246: # Only worth asking once the mesh daemon is actually up -- an enrollment
L248: # running. Delegates entirely to `netclaw risk enroll-mobile` rather than
L255: # finished -- only this bonus step should stop, not the whole wizard.
```

## scripts/probe-mist-mcp.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--count`

```text
L157: if "--count" in sys.argv:
```

## scripts/pyats-stdio.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--add`

```text
```

## scripts/reconcile-mcp.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--help`, `--json`, `--quiet`, `--refresh`, `--surface`, `--warn-only`

```text
L144: argparse.ArgumentParser(
        description="Reconcile NetClaw's MCP registration surfaces.",
        epilog="Exit 0 = reconciled, 1 = inconsistent, 2 = check could not run.",
    )
L148: parser.add_argument("--surface", action="append", choices=sorted(SURFACES),
                        help="run only this surface (repeatable; default: all)")
L150: parser.add_argument("--warn-only", action="store_true",
                        help="print findings but always exit 0 (never use in CI)")
L152: parser.add_argument("--json", action="store_true", dest="as_json",
                        help="emit machine-readable results")
L154: parser.add_argument("--quiet", action="store_true",
                        help="suppress passing surfaces; print findings only")
```

## scripts/register-all-mcps.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--args`, `--command`, `--dry-run`, `--mcp-dir`, `--skip-scan`

```text
L70: argparse.ArgumentParser(description="Register ALL MCPs with DefenseClaw")
L71: parser.add_argument("--dry-run", action="store_true", help="Show commands without executing")
L72: parser.add_argument("--skip-scan", action="store_true", help="Skip security scan when registering")
L73: parser.add_argument("--mcp-dir", default="mcp-servers", help="MCP servers directory")
L7: Usage:
```

## scripts/register-mcps-with-defenseclaw.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--args`, `--command`, `--dry-run`, `--env`, `--filter`, `--skip-scan`, `--url`

```text
L65: argparse.ArgumentParser(description="Register MCPs with DefenseClaw")
L66: parser.add_argument("--dry-run", action="store_true", help="Show commands without executing")
L67: parser.add_argument("--skip-scan", action="store_true", help="Skip security scan when registering")
L68: parser.add_argument("--filter", help="Only register MCPs matching this prefix")
L7: Usage:
```

## scripts/run-contract-tests.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--json`, `--list`, `--matrix`, `--prepare`, `--python`, `--strict-capabilities`, `--suite`

```text
L809: argparse.ArgumentParser(description=__doc__)
L811: mode.add_argument("--list", action="store_true", help="list declared suites")
L812: mode.add_argument("--matrix", action="store_true", help="emit a GitHub Actions matrix")
L813: mode.add_argument("--suite", metavar="ID", help="suite id or 'all'")
L814: parser.add_argument("--prepare", action="store_true", help="prepare isolated dependencies before running")
L815: parser.add_argument("--strict-capabilities", action="store_true",
                        help="treat optional live/Docker gaps as exit 2")
L817: parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
L530: code = "import importlib.util,sys; missing=[x for x in sys.argv[1:] if importlib.util.find_spec(x) is None]; print('\\n'.join(missing))"
```

## scripts/scan-all-mcp-source.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--json`, `--mcp-dir`, `--output`

```text
L215: argparse.ArgumentParser(description="Static security scan of MCP source code")
L216: parser.add_argument("--output", "-o", help="Output file (default: stdout)")
L217: parser.add_argument("--json", action="store_true", help="Output as JSON")
L218: parser.add_argument("--mcp-dir", default="mcp-servers", help="MCP servers directory")
L7: Usage:
```

## scripts/scan-all-mcps.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
L42: echo "---" >> "$OUTPUT"
```

## scripts/scan-mcp-files.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## scripts/scan-mcp-source.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--json`

```text
L41: if result=$(defenseclaw skill scan "$server_dir" --json 2>&1); then
L93: echo "---" >> "$OUTPUT"
```

## scripts/setup-gait-runtime.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--preview`, `--python`, `--rebuild`, `--restore`, `--target`

```text
L89: argparse.ArgumentParser(description=__doc__)
L90: parser.add_argument('--restore', action='store_true')
L91: parser.add_argument('--preview', action='store_true')
L92: parser.add_argument('--rebuild', action='store_true')
L93: parser.add_argument('--target', default=os.environ.get('GAIT_VENV', str(Path.home() / '.openclaw/gait-venv')))
L94: parser.add_argument('--python', default=os.environ.get('NETCLAW_PY', sys.executable))
```

## scripts/setup-profile.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--template`

```text
L72: argparse.ArgumentParser(description=__doc__)
L73: parser.add_argument('kind', choices=['identity','voice'])
L74: parser.add_argument('path', type=Path)
L75: parser.add_argument('--template', type=Path)
```

## scripts/setup-pyats-runtime.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--detach`, `--no-checkout`, `--preview`, `--python`, `--rebuild`, `--restore`, `--target`

```text
L102: argparse.ArgumentParser(description=__doc__)
L103: parser.add_argument('--target', default=os.environ.get('PYATS_VENV', str(Path.home()/'.openclaw/pyats-venv')))
L104: parser.add_argument('--python', default=os.environ.get('PYATS_PYTHON', '3.12'))
L105: parser.add_argument('--preview', action='store_true')
L106: parser.add_argument('--restore', action='store_true')
L107: parser.add_argument('--rebuild', action='store_true')
```

## scripts/setup.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--new`, `--template`, `--tui`

```text
L74: # components was installed (per ~/.openclaw/netclaw-components.conf).
L167: # --- NetBox ---
L180: # --- Nautobot ---
L196: # --- OpsMill Infrahub ---
L216: # --- Infoblox DDI ---
L231: # --- Itential Automation Platform ---
L248: # --- Juniper JunOS ---
L262: # --- Arista CloudVision ---
L278: # --- ServiceNow ---
L293: # --- Cisco ACI ---
L308: # --- Cisco ISE ---
L323: # --- F5 BIG-IP ---
L342: # --- Catalyst Center ---
L357: # --- NVD CVE ---
L373: # --- Microsoft Graph (Office 365) ---
L397: # --- GitHub ---
L415: # --- Cisco Modeling Labs (CML) ---
L439: # --- Cisco NSO ---
L466: # --- AWS Cloud ---
L485: # --- Google Cloud Platform ---
L510: # --- Cisco Meraki ---
L529: # --- Cisco FMC (Secure Firewall) ---
L553: # --- Palo Alto Panorama ---
L568: # --- FortiManager ---
L583: # --- Ansible Automation Platform (AAP) ---
L603: # --- Cisco ThousandEyes ---
L620: # --- Cisco RADKit ---
L639: # --- ContainerLab ---
L667: # --- HumanRail ---
L685: # --- Cisco WebEx ---
L769: --template "$NETCLAW_DIR/config/twilio-voice.json.example"
L868: echo -e "    ${CYAN}hermes chat${NC}              # or: hermes --tui"
L875: echo -e "    ${CYAN}openclaw chat --new${NC}       # Terminal 2"
```

## scripts/trace-skill.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--json`

```text
L47: argparse.ArgumentParser(description=__doc__.split("\n")[0])
L48: parser.add_argument("skill", help="skill directory name under workspace/skills/")
L49: parser.add_argument("--json", action="store_true", dest="as_json")
```

## scripts/twilio_install.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--template`

```text
L166: printf '%s\0%s\0' "$whitelist_phone" "$whitelist_label" | python3 "$NETCLAW_DIR/scripts/setup-profile.py" voice "$CONFIG_FILE" --template "$NETCLAW_DIR/config/twilio-voice.json.example"
```

## scripts/twitter_install.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## scripts/twitter_oauth2_setup.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
L8: Usage:
```

## scripts/upgrade-hud.sh

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--apply`, `--check`, `--help`, `--input-type`, `--install-deps`, `--repo`

```text
L9: Usage: scripts/upgrade-hud.sh [--check | --apply] [--install-deps] [--repo PATH]
L10: --check         Check source, prerequisites and installed dependencies (default).
L11: --apply         Regenerate references and build all four HUD entry points.
L12: --install-deps  Run npm ci from the lockfile before building; requires --apply.
L13: --repo PATH     Use another existing NetClaw checkout.
L14: -h, --help      Show this help.
L23: case "$1" in
L24: --check) HUD_UPGRADE_APPLY=false ;;
L25: --apply) HUD_UPGRADE_APPLY=true ;;
L26: --install-deps) HUD_UPGRADE_INSTALL=true ;;
L27: --repo) [[ $# -ge 2 ]] || { echo 'Missing --repo path' >&2; exit 2; }; HUD_UPGRADE_ROOT="$2"; shift ;;
L28: -h|--help) usage; exit 0 ;;
L29: *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
L34: echo '--install-deps requires --apply; check mode never installs packages.' >&2
L50: (cd "$HUD_UPGRADE_UI" && node --input-type=module -e 'await import("vite"); await import("react"); await import("three");') || {
L51: echo 'HUD dependencies unavailable. Review --apply --install-deps.' >&2; exit 1;
L55: echo 'Check complete. No files or services changed. Use --apply to build this checkout.'
```

## scripts/verify-catalog-coverage.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## scripts/verify-inventory-counts.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## scripts/verify-spec-artifacts.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--specs-dir`, `--warn-only`

```text
L117: argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
L119: ap.add_argument("--warn-only", action="store_true",
                    help="report findings but exit 0")
L121: ap.add_argument("--specs-dir", default=os.path.join(REPO_ROOT, "specs"),
                    help="directory of spec folders (default: <repo>/specs)")
L28: Usage:
```

## scripts/write-env.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: `--get`, `--systemd`

```text
L92: systemd = '--systemd' in sys.argv
L94: sys.argv.remove('--systemd')
L95: if sys.argv[1] == '--get':
L96: print(values(Path(sys.argv[2]).read_text()).get(sys.argv[3], ''), end='')
L98: update(sys.argv[1], sys.argv[2], sys.stdin.read(), systemd=systemd)
```

## scripts/zabbix-stdio.py

Static source declarations; lexical flags may include delegated commands. No execution performed.

Flags mentioned: none

```text
```

## ui/netclaw-visual/package.json

All package.json script commands. Arguments after -- are delegated to the underlying command.

Flags mentioned: `--test`

```text
L1: npm run dev → concurrently "node server.js" "vite"
L1: npm run server → node server.js
L1: npm run build → vite build
L1: npm run preview → vite preview
L1: npm run test → node --test 'src/**/*.test.js'
```

## ui/netclaw-visual/server.js

Node entry point; argument/source references only. npm wrapper commands are indexed separately.

Flags mentioned: `--global`

```text
```

## ui/netclaw-visual/src/dashboard/preview-build.mjs

Node entry point; argument/source references only. npm wrapper commands are indexed separately.

Flags mentioned: none

```text
L10: const output = process.argv[2] || '/tmp/netclaw-hud127-preview.html';
```

