"""Typed busctl contract fixtures, not evidence of a live WSL manager."""
import copy
import json
from pathlib import Path
import sys
import unittest

ROOT=Path(__file__).resolve().parents[1];sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_systemd import observe_argv,unit_path
from setup_schema import canonical

def bus_reply(args,item,*,foreign=False):
    if args[0]!='/usr/bin/busctl':return None
    object_path=unit_path(Path(item['file']).name)
    if 'GetUnit' in args:value={'type':'o','data':[object_path]}
    elif args[-1]=='ExecStartEx':
        argv=item['arguments']+(['foreign'] if foreign else [])
        value={'type':'a(sasasttttuii)','data':[[argv[0],argv,item.get('execFlags',[]),0,0,0,0,0,0,0]]}
    else:raise AssertionError(args)
    return {'returncode':0,'stdout':canonical(value)}

class SystemdTests(unittest.TestCase):
    def test_python_and_editor_share_typed_contract_cases(self):
        cases=json.loads((ROOT/'tests/fixtures/setup/systemd-observation.json').read_text())
        for case in cases:
            with self.subTest(case=case['name']):
                calls=[]
                def call(args):
                    calls.append(args)
                    self.assertEqual(args[:5],['/usr/bin/busctl','--user','--json=short','--no-pager','--timeout=10'])
                    self.assertNotIn('LoadUnit',args)
                    return {'returncode':case.get('returncode',0),'stdout':canonical(case['getUnit'] if 'GetUnit' in args else case['property'])}
                if case['accept']:self.assertTrue(observe_argv(call,case['item']));self.assertEqual(len(calls),2)
                else:
                    with self.assertRaises(Exception):observe_argv(call,case['item'])

    def test_bounded_or_invalid_bus_documents_never_authorize_service_control(self):
        item={'file':'/fixture/one.service','arguments':['/fixture/python','--home','/fixture/claw'],'execFlags':['no-env-expand']}
        for raw in (b'{}',b'[]',b'private-manager-error',b' '*65537,b'{"type":"o","type":"o","data":[]}'):
            with self.subTest(length=len(raw)):
                with self.assertRaises(Exception):observe_argv(lambda _:raw,item)
        for name in ('../neighbor.service','one.service\n','unit/part.service','unit\u00e9.service'):
            with self.assertRaises(Exception):unit_path(name)

if __name__=='__main__':unittest.main()
