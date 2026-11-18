import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[2]
def module(name):
    spec=importlib.util.spec_from_file_location(name,ROOT/'deploy/goaccess'/f'{name}.py');m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m);return m
generator=module('generate');installer=module('install')

class GoAccessTests(unittest.TestCase):
    def row(self,label,hits=2):
        return {'data':label,'hits':{'count':hits},'visitors':{'count':1},'bytes':{'count':120}}

    def raw(self):
        return {'general':{'valid_requests':2},'visitors':{'data':[self.row('20261118')]},'requests':{'data':[self.row('/mesures/?secret=test#fragment')]},'referring_sites':{'data':[self.row('example.org'),self.row('name:password@example.org/private'),self.row('192.0.2.1')]}}

    def test_allowlist_removes_raw_identifiers_queries_and_credentials(self):
        raw=self.raw();raw['hosts']={'data':[self.row('192.0.2.1')]};raw['referrers']={'data':[self.row('https://example.org/?token=test')]}
        result=generator.qualify(raw)
        self.assertEqual(result['requests'],2)
        self.assertEqual(result['panels']['requests'][0]['label'],'/mesures/')
        encoded=json.dumps(result)
        for value in ['192.0.2.1','password','secret','token','fragment']:
            self.assertNotIn(value,encoded)

    def test_bad_metrics_and_dates_fail_closed(self):
        for value in [-1,float('inf'),float('nan'),True,'2',2**54]:
            with self.assertRaises(ValueError):generator.count(value)
        raw=self.raw();raw['visitors']['data'][0]['data']='20260230'
        with self.assertRaises(ValueError):generator.qualify(raw)

    def test_rebuild_is_idempotent_and_failure_keeps_last_report(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);logs=root/'logs';logs.mkdir();(logs/'access.log').write_text('fixture-only\n');runtime=root/'run';runtime.mkdir();report=root/'report.json'
            with patch.object(generator,'aggregate',return_value=generator.qualify(self.raw())):
                a=generator.generate(logs,report,runtime);b=generator.generate(logs,report,runtime)
            self.assertEqual(a['all'],b['all'])
            previous=report.read_bytes()
            with patch.object(generator,'aggregate',side_effect=ValueError('failed')):
                with self.assertRaises(ValueError):generator.generate(logs,report,runtime)
            self.assertEqual(report.read_bytes(),previous)

    def test_waiting_is_missing_not_fabricated_zero_and_symlinks_are_refused(self):
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);logs=root/'logs';logs.mkdir();runtime=root/'run';runtime.mkdir()
            result=generator.generate(logs,root/'report.json',runtime)
            self.assertIsNone(result['all']);self.assertEqual(result['status'],'waiting')
            (logs/'access.log').symlink_to(root/'report.json')
            with self.assertRaises(ValueError):generator.generate(logs,root/'report.json',runtime)

    def test_apache_patch_is_scoped_and_existing_routing_fails_before_change(self):
        original='<IfModule mod_ssl.c>\n<VirtualHost *:443>\nServerName polradar.fr\nDocumentRoot /var/www/html/polradar\n</VirtualHost>\n</IfModule>\n'
        changed=installer.patched_vhost(original)
        self.assertEqual(changed.replace('    Include /etc/apache2/polradar-stats.conf\n',''),original)
        for text in [changed,original.replace('polradar.fr','example.org'),original+original,original.replace('</VirtualHost>','CustomLog /other combined\n</VirtualHost>')]:
            with self.assertRaises(ValueError):installer.patched_vhost(text)
        self.assertIn('Require valid-user',installer.APACHE)
        self.assertNotIn('unsafe-inline',installer.CSP);self.assertNotIn('unsafe-eval',installer.CSP)
        self.assertIn('%m %U %H',installer.APACHE)
        self.assertIn('env=!polradar_stats_request',installer.APACHE)

    def test_manifest_rejects_extra_paths_or_mismatched_script(self):
        import hashlib
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            for name in installer.BUNDLE:(root/name).write_text('fixture')
            manifest={'sourceCommit':'a'*40,'files':{name:hashlib.sha256(b'fixture').hexdigest() for name in installer.BUNDLE}}
            (root/'manifest.json').write_text(json.dumps(manifest));installer.verify_bundle(root)
            (root/'generate.py').write_text('modified')
            with self.assertRaises(ValueError):installer.verify_bundle(root)

if __name__=='__main__':unittest.main()
