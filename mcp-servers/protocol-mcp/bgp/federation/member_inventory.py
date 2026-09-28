"""Content-free member runtime inventory for the operator's internal HUD.

These are configuration observations, never execution permissions or live tool
availability. Never project command lines, URLs, environment values or credentials.
"""
import json
import os
import re
from pathlib import Path


def _name(value):
    return value if isinstance(value, str) and re.fullmatch(r"[A-Za-z0-9_.:/@+-]{1,200}", value) else None


def project_inventory(card):
    if not isinstance(card, dict):
        return {"mcp_servers": [], "llm": {"primary_model": None}, "source": "member configuration"}
    llm = card.get("llm") or {}
    servers = card.get("mcp_servers")
    out = []
    for server in (servers if isinstance(servers, list) else [])[:256]:
        if not isinstance(server, dict) or not _name(server.get("name")):
            continue
        tools = server.get("tools")
        out.append({"name": server["name"], "tools": list(dict.fromkeys(
            n for value in (tools if isinstance(tools, list) else [])[:512]
            if (n := _name(value if isinstance(value, str) else value.get("name") if isinstance(value, dict) else None))))})
    return {"mcp_servers": out, "llm": {"primary_model": _name(llm.get("primary_model")) if isinstance(llm, dict) else None},
            "source": "member configuration", "availability": "configured; execution not verified", "available": card.get("available") is not False}


def local_inventory(env=None):
    env = os.environ if env is None else env
    home = Path(env.get("OPENCLAW_STATE_DIR") or env.get("OPENCLAW_HOME") or Path(env.get("HOME", str(Path.home()))) / ".openclaw")
    source = Path(env.get("OPENCLAW_CONFIG_PATH") or home / "openclaw.json")
    try:
        if source.stat().st_size > 4 * 1024 * 1024:
            raise ValueError("oversized config")
        config = json.loads(source.read_text())
        servers = (config.get("mcp") or {}).get("servers")
        if servers is None:
            servers = config.get("mcpServers") or {}
        model = ((config.get("agents") or {}).get("defaults") or {}).get("model")
        for agent in (config.get("agents") or {}).get("list") or []:
            if agent.get("id") == env.get("N2N_AGENT_ID", "main") and agent.get("model") is not None:
                model = agent["model"]
        primary = env.get("N2N_MEMBER_MODEL") or (model.get("primary") if isinstance(model, dict) else model)
        return project_inventory({"llm": {"primary_model": primary}, "mcp_servers": [
            {"name": name, "tools": value.get("tools", [])} for name, value in servers.items() if isinstance(value, dict)]})
    except (OSError, ValueError, TypeError, AttributeError):
        return {"mcp_servers": [], "llm": {"primary_model": _name(env.get("N2N_MEMBER_MODEL"))}, "source": "member configuration unavailable", "available": False}


def stored_inventory(member):
    try:
        health = json.loads(member["health"] or "{}")
        if not isinstance(health.get("inventory"), dict):
            return None
        return {**project_inventory(health["inventory"]), "received_at": health.get("inventory_at")}
    except (KeyError, TypeError, ValueError):
        return None
