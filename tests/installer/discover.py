"""Credential-free MCP startup checks for fresh installer runtimes."""
import asyncio
from datetime import timedelta
import json
import os
from pathlib import Path
import sys

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client


async def main(directory):
    entries = json.loads((directory / 'selected.json').read_text())['mcpServers']
    for name, entry in entries.items():
        env = {
            'PATH': os.environ['PATH'],
            'NAUTOBOT_URL': 'http://127.0.0.1:9',
            'NAUTOBOT_TOKEN': 'fixture-not-a-secret',
            'SUZIEQ_API_URL': 'http://127.0.0.1:9',
            'SUZIEQ_API_KEY': 'fixture-not-a-secret',
        }
        with (directory / (name + '-startup.log')).open('w') as errors:
            async with asyncio.timeout(40):
                parameters = StdioServerParameters(command=entry['command'],
                    args=entry.get('args', []), env=env, cwd=str(directory))
                async with stdio_client(parameters, errlog=errors) as (read, write):
                    async with ClientSession(read, write,
                            read_timeout_seconds=timedelta(seconds=30)) as session:
                        await session.initialize()
                        result = await session.list_tools()
                        assert result.tools, name + ': no tools discovered'
                        print(f'{name}: initialize/tools-list PASS ({len(result.tools)} tools)', flush=True)


if __name__ == '__main__':
    asyncio.run(main(Path(sys.argv[1])))
