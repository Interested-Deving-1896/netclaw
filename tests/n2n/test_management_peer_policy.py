"""Synthetic policy transactions; real admission proofs are a separate process test."""
import json
from types import SimpleNamespace

import pytest

from bgp.federation.management_peer_policy import ManagementPeerPolicy
from bgp.federation.service import FederationService


@pytest.fixture
def policy(manager):
    service=FederationService(local_as=65001,router_id='1.1.1.1',manager=manager)
    manager.local_consent(65002,'2.2.2.2');manager.remote_consent(65002,'2.2.2.2')
    peer='as65002-2.2.2.2'; controller=ManagementPeerPolicy(service)
    runtime=SimpleNamespace(installation='fixture-installation',kind='hermes')
    controller.current=lambda:runtime
    controller.targets=lambda ident:[{'type':'tool','name':'fixture/calculate'}]
    return controller,service,peer,runtime


def reviewed(f,patch,action='peer.trust'):
    controller,service,peer,runtime=f
    baseline=controller.snapshot(peer)
    proposal={'proposalId':'fixture-proposal','action':action,'patch':{'acknowledgeActiveWork':True,**patch}}
    # This fixture tests SQLite/permission semantics only, not lease authentication.
    controller.admission=lambda *args,**kwargs:(runtime,proposal,baseline)
    return baseline,proposal


def test_legacy_writers_increment_revision_only_on_real_changes_and_keep_aba_tombstones(policy):
    controller,service,peer,_=policy
    original=controller.policy(peer)['revision']
    service.manager.set_chat_enabled(peer,False)
    assert controller.policy(peer)['revision']==original
    service.manager.set_chat_enabled(peer,True);service.manager.set_chat_enabled(peer,False)
    assert controller.policy(peer)['revision']==original+2
    before=controller.policy(peer)['revision'];grant=service.authz.grant(peer,'tool','fixture/calculate')
    service.authz.revoke(grant)
    assert controller.policy(peer)['revision']==before+2
    row=service.manager.get_peer(peer);db=service.manager._conn
    db.execute('DELETE FROM federation_peer WHERE identity=?',(peer,));db.commit()
    service.manager.upsert_peer(row['peer_as'],row['router_id'])
    assert controller.policy(peer)['revision']>before+2


def test_apply_is_atomic_idempotent_and_exact_rollback_keeps_unselected_grants(policy):
    controller,service,peer,_=policy
    preserved=service.authz.grant(peer,'skill','existing-read',True)
    baseline,_=reviewed(policy,{'chatEnabled':True,'grant':{'type':'tool','name':'fixture/calculate','requiresApproval':True,'timeoutSeconds':30}})
    first=controller.mutate('operation','lease')
    assert first['verified'] and first['policy']['chatEnabled']
    assert len(first['policy']['grants'])==2
    assert controller.mutate('operation','lease')==first
    assert len(service.authz.list_grants(peer))==2
    assert controller.verify('operation','lease')['verified']
    restored=controller.mutate('operation','lease',rollback=True)
    assert restored['state']=='rolled-back'
    assert controller.policy(peer)['chatEnabled'] is False
    assert [row['id'] for row in service.authz.list_grants(peer)]==[preserved]
    with pytest.raises(ValueError):controller.mutate('operation','lease')
    assert controller.mutate('operation','lease',rollback=True)['verified']


def test_later_hud_change_prevents_apply_and_prevents_rollback_overwrite(policy):
    controller,service,peer,_=policy
    reviewed(policy,{'chatEnabled':True})
    service.manager.set_chat_enabled(peer,True);service.manager.set_chat_enabled(peer,False)
    with pytest.raises(ValueError):controller.mutate('first','lease')
    reviewed(policy,{'chatEnabled':True});controller.mutate('second','lease')
    service.authz.grant(peer,'skill','newer-grant',True)
    with pytest.raises(ValueError):controller.mutate('second','lease',rollback=True)
    assert controller.policy(peer)['chatEnabled'] is True
    assert service.authz.list_grants(peer)[0]['target_name']=='newer-grant'


def test_revoke_only_selected_grants_and_rollback_exact_delta(policy):
    controller,service,peer,_=policy
    first=service.authz.grant(peer,'skill','one',True);second=service.authz.grant(peer,'skill','two',True)
    service.manager.set_chat_enabled(peer,True)
    reviewed(policy,{'disableChat':True,'revokeGrantIds':[first]},'peer.untrust')
    controller.mutate('operation','lease')
    assert [row['id'] for row in service.authz.list_grants(peer)]==[second]
    assert not controller.policy(peer)['chatEnabled']
    controller.mutate('operation','lease',rollback=True)
    assert [row['id'] for row in service.authz.list_grants(peer)]==[first,second]
    assert controller.policy(peer)['chatEnabled']


def test_post_change_work_can_advance_but_verification_and_rollback_never_claim_to_undo_it(policy):
    controller,service,peer,_=policy;reviewed(policy,{'chatEnabled':True});controller.mutate('operation','lease')
    service.manager._conn.execute("INSERT INTO delegated_task(task_id,direction,peer_identity,target_type,state) VALUES ('started-after','inbound',?,'chat','working')",(peer,));service.manager._conn.commit()
    assert controller.verify('operation','lease')['verified']
    assert controller.mutate('operation','lease',rollback=True)['verified']
    observed=controller.policy(peer);assert observed['chatEnabled'] is False
    assert observed['work'][0]['task_id']=='started-after' and observed['work'][0]['state']=='working'


def test_worker_authority_loss_before_commit_rolls_back_transaction(policy):
    controller,service,peer,runtime=policy
    baseline,proposal=reviewed(policy,{'chatEnabled':True});calls=0
    def admission(*args,**kwargs):
        nonlocal calls
        calls+=1
        if calls>1:raise ValueError('expired lease')
        return runtime,proposal,baseline
    controller.admission=admission
    with pytest.raises(ValueError):controller.mutate('operation','lease')
    assert controller.policy(peer)==baseline['policy']
    assert service.manager._conn.execute('SELECT count(*) FROM management_peer_change').fetchone()[0]==0


def test_controller_fences_selected_database_path_permissions_inode_and_installation(manager):
    from pathlib import Path
    from uuid import uuid4
    from bgp.federation.runtime import Runtime,write_private
    service=FederationService(local_as=65001,router_id='1.1.1.1',manager=manager)
    home=manager.base_dir.parent;installation=str(uuid4());identity=home/'netclaw-hud/installation.json'
    write_private(identity,{'schemaVersion':1,'installationId':installation})
    service.runtime=Runtime('hermes',home,home/'config.yaml',installation)
    controller=ManagementPeerPolicy(service);assert controller.current().installation==installation
    source=Path(manager.db_path);mode=source.stat().st_mode&0o777;source.chmod(0o666)
    with pytest.raises(ValueError):controller.current()
    source.chmod(mode)
    write_private(identity,{'schemaVersion':1,'installationId':str(uuid4())})
    with pytest.raises(ValueError):controller.current()
    write_private(identity,{'schemaVersion':1,'installationId':installation})
    previous=manager._management_db_identity;manager._management_db_identity=(0,0)
    with pytest.raises(ValueError):controller.current()
    manager._management_db_identity=previous
    manager.base_dir=home/'other-n2n'
    with pytest.raises(ValueError):controller.current()


@pytest.mark.parametrize('patch', [
    {'grant':{'type':'tool','name':'unadvertised/shell','requiresApproval':True,'timeoutSeconds':30}},
    {'grant':{'type':'tool','name':'fixture/calculate','requiresApproval':False,'timeoutSeconds':30}},
    {'grant':{'type':'tool','name':'fixture/calculate','requiresApproval':True,'timeoutSeconds':1000}},
    {'chatEnabled':True,'url':'http://example.invalid'},
])
def test_mutations_cannot_invent_target_skip_approval_or_supply_dispatch_fields(policy,patch):
    controller,service,peer,_=policy;baseline,_=reviewed(policy,patch)
    with pytest.raises(ValueError):controller.mutate('operation','lease')
    assert controller.policy(peer)==baseline['policy']
