"""Isolated actual federation API and authenticated WebSocket phone simulator.

No physical device, native camera/microphone, push notification or provider.
"""
import asyncio
import base64
import importlib.util
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/'mcp-servers/protocol-mcp'))
sys.path.insert(0,str(ROOT/'tests/n2n'))
from bgp.federation.manager import FederationManager
from bgp.federation.service import FederationService
from bgp.federation.runtime import Runtime
from test_edge_capture import _serve, _enroll


async def main():
    home=Path(sys.argv[1]);installation=json.loads((home/'netclaw-hud/installation.json').read_text())['installationId']
    spec=importlib.util.spec_from_file_location('managed_mobile_daemon',ROOT/'mcp-servers/protocol-mcp/bgp-daemon-v2.py')
    daemon=importlib.util.module_from_spec(spec);spec.loader.exec_module(daemon)
    fed=FederationService(local_as=65001,router_id='4.4.4.4',manager=FederationManager(base_dir=str(home/'n2n')))
    fed.runtime=Runtime('openclaw',home,home/'openclaw.json',installation);daemon._federation=fed
    fed.risk.set_role('border',risk_name='risk',enabled_stacks='in2n')
    captures=[];raw=bytes([17])*70000
    def capture(args):
        captures.append(args)
        return {'decision':'captured','content_type':'image','content':base64.b64encode(raw).decode()}
    ws,port=await _serve(fed);phone=await _enroll(fed,port,capture_handler=capture)
    fed.risk.set_capture_capabilities('risk/phone1',['camera.capture'])
    async def handle(reader,writer):
        try:
            head=await asyncio.wait_for(reader.readuntil(b'\r\n\r\n'),5)
            if len(head)>8192:raise ValueError('header too large')
            lines=head.decode().split('\r\n');method,route,_=lines[0].split(' ')
            headers=dict(line.split(':',1) for line in lines[1:] if ':' in line);length=int(next((v for k,v in headers.items() if k.lower()=='content-length'),'0'));assert 0<=length<=16384
            body=json.loads(await reader.readexactly(length)) if length else {}
            if route=='/status':code,value=200,{'installation_id':installation,'harness_type':'openclaw','federation_ready':True}
            else:code,value=await daemon.handle_n2n(method,route,body)
            data=json.dumps(value).encode();writer.write(f'HTTP/1.1 {code} Result\r\nContent-Type: application/json\r\nContent-Length: {len(data)}\r\nConnection: close\r\n\r\n'.encode()+data);await writer.drain()
        finally:writer.close();await writer.wait_closed()
    api=await asyncio.start_server(handle,'127.0.0.1',0)
    print(json.dumps({'port':api.sockets[0].getsockname()[1],'phone':'risk/phone1','mediaBytes':len(raw)}),flush=True)
    try:
        while True:
            line=await asyncio.to_thread(sys.stdin.readline)
            if not line:break
            if line.strip()=='count':print(json.dumps({'captures':len(captures)}),flush=True)
    finally:
        api.close();await api.wait_closed();await phone.close();ws.close();await ws.wait_closed();fed.manager.close()


asyncio.run(main())
