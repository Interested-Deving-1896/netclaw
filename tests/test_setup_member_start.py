from pathlib import Path
import sys
import tempfile
import unittest
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts/lib'))
from setup_schema import canonical
from setup_state import guarded_write,revision,Conflict
from setup_risk import descriptor
from setup_member_start import start
from test_setup_systemd import bus_reply

class MemberStartTests(unittest.TestCase):
    def fixture(self,root,platform):
        home=root/'claw with spaces $literal% "quote"; café';source=home/'.setup/source';account=root/'account'
        script=source/'scripts/setup-service.py';guarded_write(script,b'# fixture; never executed')
        index=home/'.setup/service-source.json'
        guarded_write(index,canonical({'schema':1,'source':str(source),'files':[{'path':'scripts/setup-service.py','sha256':revision(script)}]}))
        guarded_write(home/'.netclaw-setup-owner.json',canonical({'schema':1,'runId':'run-fixture','installationId':'member','planHash':'a'*64}))
        item,content=descriptor(platform,'netclaw-fixture','federation',home,source,Path(sys.executable),account,hot=False)
        guarded_write(item['file'],content)
        data={'schema':1,'home':str(home),'source':str(source),'userHome':str(account),'role':'member','runId':'run-fixture','owner':'member',
            'platform':platform,'sourceIndex':{'sha256':revision(index),'count':1},'services':[item]}
        guarded_write(home/'.setup/services.json',canonical(data))
        return home,source,account,item

    def test_mac_wake_uses_owned_manager_without_killing_or_spawning_a_second_worker(self):
        for state in ('absent','owned','foreign'):
            with self.subTest(state=state),tempfile.TemporaryDirectory() as tmp:
                home,source,account,item=self.fixture(Path(tmp).resolve(),'macos');calls=[]
                def execute(args,**options):
                    calls.append(args);self.assertEqual(set(options['env']),{'PATH','HOME','LANG','XDG_RUNTIME_DIR','DBUS_SESSION_BUS_ADDRESS'})
                    if args[1]=='print' and args[-1].endswith('/'+item['label']):
                        if state=='absent':return {'returncode':1,'stdout':b''}
                        argv=item['arguments'] if state=='owned' else ['neighbor']
                        return {'returncode':0,'stdout':('path = '+item['file']+'\n arguments = {\n'+'\n'.join(argv)+'\n }\n').encode()}
                    return {'returncode':0,'stdout':b''}
                if state=='foreign':
                    with self.assertRaises(Conflict):start(home,source,execute=execute,user_home=account)
                    self.assertFalse(any(c[1] in ('bootstrap','kickstart') for c in calls))
                else:
                    self.assertTrue(start(home,source,execute=execute,user_home=account))
                    self.assertEqual(sum(c[1]=='bootstrap' for c in calls),int(state=='absent'))
                    self.assertEqual(calls[-1][1],'kickstart');self.assertNotIn('-k',calls[-1])
                self.assertTrue(all(c[0]=='/bin/launchctl' for c in calls))

    def test_wsl_wake_refuses_loaded_definition_drift_before_start(self):
        for changed in (False,True):
            with tempfile.TemporaryDirectory() as tmp:
                home,source,account,item=self.fixture(Path(tmp).resolve(),'wsl2');calls=[]
                def execute(args,**options):
                    calls.append(args)
                    reply=bus_reply(args,item)
                    if reply is not None:return reply
                    return {'returncode':0,'stdout':('FragmentPath='+item['file']+'\nDropInPaths='+('foreign.conf' if changed else '')+'\nNeedDaemonReload=no\nExecStart={ argv[]='+' '.join(item['arguments'])+'; }\n').encode()}
                if changed:
                    with self.assertRaises(Conflict):start(home,source,execute=execute,user_home=account)
                    self.assertEqual(len(calls),1)
                else:
                    self.assertTrue(start(home,source,execute=execute,user_home=account))
                    self.assertEqual(calls[-1],['/usr/bin/systemctl','--user','start',Path(item['file']).name])
                guarded_write(source/'scripts/setup-service.py',b'changed')
                count=len(calls)
                with self.assertRaises(Conflict):start(home,source,execute=execute,user_home=account)
                self.assertEqual(len(calls),count)
