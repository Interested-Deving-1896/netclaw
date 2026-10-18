"""Canonical catalog checks use source data only, never installed claw homes."""
import importlib.util
import json
from pathlib import Path
import subprocess
import tempfile
import hashlib
import io
import unittest

ROOT = Path(__file__).resolve().parents[1]


class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.baseline = json.loads((ROOT / 'tests/fixtures/setup/catalog-baseline.json').read_text())
        self.catalog = json.loads((ROOT / 'config/components/catalog.json').read_text())

    def test_components_and_profiles_preserve_baseline(self):
        self.assertEqual([[c[k] for k in ('id', 'category', 'title', 'description')]
                          for c in self.catalog['components']], self.baseline['components'])
        self.assertEqual({p['id']: p['components'] for p in self.catalog['profiles']}, self.baseline['profiles'])
        self.assertNotIn('id', [c['id'] for c in self.catalog['components']])

    def test_actual_bash_output_matches_baseline(self):
        result = subprocess.run(['bash', '--noprofile', '--norc', '-c',
            'source scripts/lib/catalog.sh; printf "%s\\n" "${CATALOG[@]}"'],
            cwd=ROOT, capture_output=True, text=True, env={'PATH': '/usr/bin:/bin'})
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout.splitlines(), ['|'.join(row) for row in self.baseline['components']])
        for name, expected in self.baseline['profiles'].items():
            result = subprocess.run(['bash', '--noprofile', '--norc', '-c',
                'source scripts/lib/catalog.sh; profile_components "$1"', 'profile', name],
                cwd=ROOT, capture_output=True, text=True, env={'PATH': '/usr/bin:/bin'})
            self.assertEqual(result.returncode, 0)
            self.assertEqual(result.stdout.split(), expected)

    def test_every_real_skill_is_accounted_for(self):
        self.assertEqual(sorted(s['id'] for s in self.catalog['skills']), self.baseline['skillIds'])
        for skill in self.catalog['skills']:
            self.assertTrue((ROOT / skill['path']).is_file())
            self.assertTrue(skill['reason'])

    def test_generator_and_metadata_checks(self):
        for command in (["python3", "scripts/build-catalog.py", "--check"],
                        ["python3", "scripts/check-catalog-metadata.py"]):
            result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_all_registered_servers_have_explicit_join(self):
        expected = set(json.loads((ROOT / 'config/openclaw.json').read_text())['mcpServers'])
        actual = {s for c in self.catalog['components'] for s in c['servers']}
        self.assertEqual(actual, expected)

    def test_no_hud_alias_points_to_missing_component(self):
        ids = {c['id'] for c in self.catalog['components']}
        for alias in self.catalog['surfaceAliases']:
            self.assertLessEqual(set(alias['components']), ids)

    def test_all_installers_exist_including_k8s(self):
        import re
        functions = set(re.findall(r'^(component_install_\w+)\(\)',
                                    (ROOT / 'scripts/lib/install-steps.sh').read_text(), re.M))
        for c in self.catalog['components']:
            self.assertIn(c['installer']['function'], functions, c['id'])


class ArtifactTests(unittest.TestCase):
    def setUp(self):
        spec = importlib.util.spec_from_file_location('artifact', ROOT / 'scripts/install-pinned-artifact.py')
        self.module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(self.module)

    def test_qualified_platform_pins_only(self):
        for system, arch in [('Darwin', 'arm64'), ('Darwin', 'x86_64'), ('Linux', 'x86_64')]:
            artifact = self.module.artifact_for('k8s', system, arch)
            self.assertIn('/v0.0.66/', artifact['url'])
            self.assertEqual(len(artifact['sha256']), 64)
        with self.assertRaises(ValueError):
            self.module.artifact_for('k8s', 'Linux', 'arm64')

    def test_checksum_atomicity_preservation_and_symlink_refusal(self):
        payload = b'controlled binary fixture'
        artifact = {'url': 'https://fixture.invalid/binary', 'sha256': hashlib.sha256(payload).hexdigest()}
        with tempfile.TemporaryDirectory() as root:
            root = str(Path(root).resolve())
            target = Path(root) / 'binary'
            opener = lambda *a, **k: io.BytesIO(payload)
            self.assertEqual(self.module.install(artifact, target, opener), 'installed_verified')
            self.assertEqual(target.stat().st_mode & 0o777, 0o700)
            self.assertEqual(self.module.install(artifact, target, opener), 'already_verified')
            target.write_bytes(b'preexisting different binary')
            with self.assertRaises(ValueError):
                self.module.install(artifact, target, opener)
            self.assertEqual(target.read_bytes(), b'preexisting different binary')
            fresh = Path(root) / 'mismatch'
            with self.assertRaises(ValueError):
                self.module.install(artifact, fresh, lambda *a, **k: io.BytesIO(b'bad bytes'))
            self.assertFalse(fresh.exists())
            alias = Path(root) / 'alias'
            alias.symlink_to(target)
            with self.assertRaises(ValueError):
                self.module.install(artifact, alias, opener)


if __name__ == '__main__':
    unittest.main()
