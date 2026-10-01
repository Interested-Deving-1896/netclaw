# Changelog

NetClaw source releases use `1.x.y`. Feature specs increment the minor version and reset the patch; fixes, documentation and maintenance increment the patch. Every release records its numbered specs. Component and mobile distribution versions are independent.

## [1.2.1] - 2026-10-01

- Isolate legacy installer Python dependencies and bind MCP launchers to their runtimes.
- Report dependency failures accurately; fix independent component paths, Nautobot source selection and gNMI startup.

Spec [133-installer-python-isolation](specs/133-installer-python-isolation/spec.md). See [release notes](docs/releases/1.2.1.md).

## [1.2.0] - 2026-09-29

- Equinix Fabric and Network Edge MCP integration with two skills, OAuth, scoped Risk membership, installer/setup and HUD entries.
- Documented Fabric create/update/actions gated by observed baselines, exact-operation ServiceNow approval and GAIT; delete is not exposed upstream.

Spec [132-equinix-fabric-mcp](specs/132-equinix-fabric-mcp/spec.md). See [release notes](docs/releases/1.2.0.md).

## [1.1.0] - 2026-09-28

- Standard Chat is now the default HUD view, alongside preserved Canvas and native OpenClaw in a separate tab.
- Isolated conversations, draft/error recovery, safe native UI navigation and corrected empty gateway reply classification.

Spec [130-chat-interface-switch](specs/130-chat-interface-switch/spec.md). See [release notes](docs/releases/1.1.0.md).

## [1.0.0] - 2026-09-28

First official versioned source release, including the function-first HUD (spec127), optional Jev Science Officer (spec125), README refresh (spec126), and contribution/release foundation (spec129), on top of the existing network engineering platform.

- 233 skills and 173 MCP integrations, with selective installation.
- Operations panels, preserved Canvas, specialist federation, cited document retrieval, mobile and Zoom integration surfaces.
- Numbered Spec Kit contribution workflow, PR template and repeatable versioned releases.
- Restored the protected HUD inventory statement required by documentation reconciliation.

See [full release notes and validation boundaries](docs/releases/1.0.0.md).
