import copy
import hashlib
import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts/lib'))
from setup_schema import Invalid, loads, canonical, validate


def sample_plan(root='/private/tmp/netclaw-fixture'):
    return {'schema': 1, 'source': {'channel': 'main', 'ref': 'main', 'commit': 'a'*40,
        'treeHash': 'b'*64, 'path': root+'/source', 'dirty': False},
        'host': {'platform': 'macos', 'architecture': 'arm64', 'osVersion': '26.0',
                 'remote': 'local', 'distribution': '', 'fingerprint': 'c'*64},
        'shape': 'focused', 'claws': [{'id': 'fixture-claw', 'displayName': 'Fixture',
        'role': 'focused', 'runtimeHome': root+'/claw', 'workspace': root+'/claw/workspace',
        'harness': 'openclaw', 'harnessChoice': 'explicit', 'runtimeVersion': '2026.7.1-2',
        'provider': {'kind': 'cloud', 'id': 'anthropic', 'model': 'fixture-model',
                     'apiMode': 'anthropic', 'endpoint': '', 'credentialKeys': ['ANTHROPIC_API_KEY']},
        'channels': [], 'capabilities': {'profile': 'minimal', 'components': ['subnet-calc'],
        'skills': ['subnet-calculator'], 'trustDomain': 'lab'},
        'settings': {'ANTHROPIC_API_KEY': {'kind': 'secret', 'key': 'ANTHROPIC_API_KEY',
                      'owner': 'fixture-claw', 'source': 'prompt'}},
        'endpoints': {'gatewayPort': 18791, 'hudPort': 3001, 'hudUiPort': 3000, 'companionPort': 8643, 'bgpApiPort':8179,'bgpPort':1179,'federationPort': 5001},
        'service': {'mode': 'hot', 'name': 'netclaw-fixture'}}], 'inventory': [], 'identity': [],
        'posture': {'mode': 'testing', 'requiredControls': []},
        'verification': {'tiers': [1, 2, 3], 'risk': False, 'costConsent': False,
                         'networkReadOnly': True, 'channelTests': []},
        'assumptions': [], 'unresolved': []}


class StrictJSONTests(unittest.TestCase):
    def test_published_schemas_match_reference_validator(self):
        import jsonschema
        for file in ['config/claw-plan.schema.json', 'config/components/schema.json']:
            schema = json.loads((ROOT / file).read_text())
            jsonschema.Draft202012Validator.check_schema(schema)
            reference = jsonschema.Draft202012Validator(schema)
            valid = sample_plan() if 'claw-plan' in file else json.loads((ROOT / 'config/components/catalog.json').read_text())
            vectors = [valid, {}, None, [], {**valid, 'unexpected': True}]
            if 'claw-plan' in file:
                for key in valid:
                    missing = copy.deepcopy(valid); del missing[key]; vectors.append(missing)
                changed = copy.deepcopy(valid); changed['verification']['tiers'] = [1, 1, 2]; vectors.append(changed)
            for value in vectors:
                self.assertEqual(not validate(value, schema), reference.is_valid(value), (file, type(value)))

    def test_rejects_ambiguous_or_unbounded_inputs_without_echo(self):
        for data in [b'{"a":1,"a":2}', b'{"x":NaN}', b'{"x":1.0}', b'{"x":9007199254740992}',
                     b'{"x":"\\ud800"}', b'{"x":"\\u0000"}', b'\xff', b'['*40+b'0'+b']'*40]:
            with self.assertRaises(Invalid): loads(data)
        with self.assertRaises(Invalid): loads(b'[]', 1)

    def test_canonical_hash_ignores_object_format_not_array_order(self):
        self.assertEqual(canonical(loads('{"b":2,"a":"🦞"}')), canonical(loads('{ "a":"🦞", "b":2 }')))
        self.assertNotEqual(canonical([1, 2]), canonical([2, 1]))
        with self.assertRaises(Invalid): canonical({'é': 1})

    def test_unknown_key_diagnostic_is_private(self):
        schema = {'type': 'object', 'additionalProperties': False, 'properties': {}}
        errors = validate({'sensitive-canary-key': 'sensitive-canary-value'}, schema)
        self.assertNotIn('canary', json.dumps(errors))
        with self.assertRaises(Invalid): validate({}, {'notARealKeyword': True})


class PlanTests(unittest.TestCase):
    def setUp(self):
        from setup_plan import PlanValidator
        self.validator = PlanValidator(ROOT)

    def codes(self, plan):
        return {e['code'] for e in self.validator.inspect(plan)['errors']}

    def test_unqualified_legacy_production_component_is_refused_before_effects(self):
        plan=sample_plan();plan['claws'][0]['capabilities']['components'].append('in2n-production')
        self.assertIn('component_production_adapter_unqualified',self.codes(plan))
        self.assertFalse(self.validator.inspect(plan)['applyReady'])

    def test_reference_only_valid_plan_and_hash(self):
        report = self.validator.inspect(sample_plan())
        self.assertTrue(report['valid'], report)
        self.assertEqual(report['hash'], hashlib.sha256(canonical(sample_plan())).hexdigest())

    def test_literal_and_cross_owner_secrets_refused_without_echo(self):
        plan = sample_plan(); plan['claws'][0]['settings']['ANTHROPIC_API_KEY'] = {'kind': 'value', 'value': 'credential-canary'}
        report = self.validator.inspect(plan)
        self.assertIn('secret_reference_required', {e['code'] for e in report['errors']})
        self.assertNotIn('credential-canary', json.dumps(report))
        plan = sample_plan(); plan['claws'][0]['settings']['ANTHROPIC_API_KEY']['owner'] = 'neighbor'
        self.assertIn('secret_owner_mismatch', self.codes(plan))

    def test_collisions_and_missing_mandatory_tiers(self):
        plan = sample_plan(); plan['verification']['tiers'] = [4, 5, 6]
        self.assertIn('mandatory_tiers_missing', self.codes(plan))
        plan = sample_plan(); plan['claws'][0]['endpoints']['hudPort'] = 18791
        self.assertIn('endpoint_collision', self.codes(plan))

    def test_unknown_components_and_fields_do_not_gain_authority(self):
        plan = sample_plan(); plan['approved'] = True
        self.assertFalse(self.validator.inspect(plan)['valid'])
        plan = sample_plan(); plan['claws'][0]['capabilities']['components'] = ['made-up-component']
        self.assertIn('unknown_component', self.codes(plan))
        plan = sample_plan(); plan['claws'][0]['settings']['ARBITRARY_SECRET_KEY'] = {'kind': 'value', 'value': 'canary'}
        self.assertIn('unknown_setting', self.codes(plan))

    def test_incomplete_draft_is_never_apply_ready(self):
        report = self.validator.inspect({'schema': 1}, draft=True)
        self.assertFalse(report['valid'])
        self.assertFalse(report['applyReady'])
        self.assertTrue(report['errors'])

    def test_mixed_harness_inheritance_and_unqualified_profile(self):
        plan = sample_plan(); border = plan['claws'][0]; border['role'] = 'border'; border['capabilities']['components'] = ['gait']; border['capabilities']['skills'] = []
        member = copy.deepcopy(sample_plan()['claws'][0]); member.update(id='member',role='member',runtimeHome='/private/tmp/other',workspace='/private/tmp/other/workspace',harness='hermes',harnessChoice='inherit');member['settings']['ANTHROPIC_API_KEY']['owner']='member';member['endpoints']={'gatewayPort':18801,'hudPort':3101,'hudUiPort':3100,'companionPort':8644,'bgpApiPort':8180,'bgpPort':1180,'federationPort':5101};member['service']['name']='member';member['capabilities']['profile']='subnet'
        plan['shape']='risk';plan['verification']['risk']=True;plan['claws'].append(member)
        self.assertIn('inheritance_mismatch', self.codes(plan))
        member['harnessChoice']='explicit';member['capabilities']['profile']='pyats'
        self.assertIn('unsupported_member_profile', self.codes(plan))


if __name__ == '__main__': unittest.main()
