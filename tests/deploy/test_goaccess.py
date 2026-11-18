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
    def test_restrictive_operator_umask_preserves_service_and_apache_traversal(self):
        import os,stat
        with tempfile.TemporaryDirectory() as temp:
            previous=os.umask(0o077)
            try:
                for name,mode in [('code',0o755),('static',0o755),('state',0o750),('logs',0o750),('backup',0o700)]:
                    path=Path(temp)/name;installer.make_directory(path,mode)
                    self.assertEqual(stat.S_IMODE(path.stat().st_mode),mode)
            finally:
                os.umask(previous)

    def row(self,label,hits=2):
        return {'data':label,'hits':{'count':hits},'visitors':{'count':1},'bytes':{'count':120}}

    def raw(self):
        return {'general':{'valid_requests':2,'unique_visitors':1},'visitors':{'data':[self.row('20261118')]},'requests':{'data':[self.row('/mesures/?secret=test#fragment')]},'referring_sites':{'data':[self.row('example.org'),self.row('name:password@example.org/private'),self.row('192.0.2.1')]}}

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
        self.assertIn('AuthUserFile /etc/apache2/polradar-stats.htpasswd',installer.APACHE)
        self.assertNotIn('l0g-stats.htpasswd',installer.APACHE)
        self.assertNotIn('unsafe-inline',installer.CSP);self.assertNotIn('unsafe-eval',installer.CSP)
        self.assertIn('%m %U %H',installer.APACHE)
        self.assertIn('env=!polradar_stats_request',installer.APACHE)
        self.assertIn('AddType text/javascript .mjs',installer.APACHE)
        self.assertIn('AddType text/css .css',installer.APACHE)
        self.assertIn('AddType application/json .json',installer.APACHE)

    def test_manifest_rejects_extra_paths_or_mismatched_script(self):
        import hashlib
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp)
            for name in installer.BUNDLE:(root/name).write_text('fixture')
            manifest={'sourceCommit':'a'*40,'files':{name:hashlib.sha256(b'fixture').hexdigest() for name in installer.BUNDLE}}
            (root/'manifest.json').write_text(json.dumps(manifest));installer.verify_bundle(root)
            (root/'generate.py').write_text('modified')
            with self.assertRaises(ValueError):installer.verify_bundle(root)


class GoAccessUpdateTests(unittest.TestCase):
    def test_daily_summary_mismatch_duplicates_and_missing_totals_fail_closed(self):
        raw=GoAccessTests().raw()
        for mutate in [lambda d:d['general'].update(unique_visitors=2),lambda d:d['general'].update(valid_requests=3),lambda d:d['visitors']['data'].append(d['visitors']['data'][0]),lambda d:d['general'].pop('unique_visitors')]:
            item=json.loads(json.dumps(raw));mutate(item)
            with self.assertRaises((ValueError,KeyError)):generator.qualify(item)

    def test_datetime_command_keeps_apache_offset_for_paris(self):
        from types import SimpleNamespace
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);spool=root/'input';spool.write_text('fixture');out=root/'raw.json';out.write_text(json.dumps(GoAccessTests().raw()))
            with patch.object(generator.subprocess,'run',return_value=SimpleNamespace(returncode=0)) as run:
                generator.aggregate(spool,out,False)
            command=run.call_args.args[0]
            self.assertIn('--datetime-format=%d/%b/%Y:%H:%M:%S %z',command)
            self.assertIn('--log-format=%h %^[%x] "%r" %s %b "%R" "%u"',command)
            self.assertFalse(any(c.startswith('--date-format=') or c.startswith('--time-format=') for c in command))
            self.assertIn('--anonymize-ip',command)

    def test_empty_filtered_panel_requires_a_real_zero_summary(self):
        from types import SimpleNamespace
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);spool=root/'input';spool.write_text('fixture');out=root/'raw.json'
            for requests,profiles in [(1,0),(0,1)]:
                out.write_text(json.dumps({'general':{'valid_requests':requests,'unique_visitors':profiles}}))
                with patch.object(generator.subprocess,'run',return_value=SimpleNamespace(returncode=0)):
                    with self.assertRaises(ValueError):generator.aggregate(spool,out,True)
            out.write_text(json.dumps({'general':{'valid_requests':0,'unique_visitors':0}}))
            with patch.object(generator.subprocess,'run',return_value=SimpleNamespace(returncode=0)):
                self.assertEqual(generator.aggregate(spool,out,True)['dailyProfiles'],0)

    def test_file_guards_reject_links_and_group_writable_paths(self):
        import os
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);file=root/'safe';file.write_text('fixture');file.chmod(0o640)
            installer.checked_file(file,os.getuid());installer.checked_directory(root,os.getuid())
            link=root/'link';link.symlink_to(file)
            with self.assertRaises(ValueError):installer.checked_file(link,os.getuid())
            file.chmod(0o660)
            with self.assertRaises(ValueError):installer.checked_file(file,os.getuid())
            root.chmod(0o770)
            with self.assertRaises(ValueError):installer.checked_directory(root,os.getuid())

    def update_fixture(self,root):
        import hashlib,os
        from types import SimpleNamespace
        bundle=root/'bundle';bundle.mkdir();share=root/'share';share.mkdir();lib=root/'lib';lib.mkdir();state=root/'state';state.mkdir(mode=0o750);units=root/'units';units.mkdir();backups=root/'backups';backups.mkdir()
        for name in installer.BUNDLE:(bundle/name).write_text('new-'+name)
        targets={name:share/name for name in ['index.html','viewer.mjs','viewer.css']};targets['generate.py']=lib/'generate.py'
        for name,path in targets.items():path.write_text('old-'+name)
        for name in ['polradar-stats.service','polradar-stats.timer']:(units/name).write_bytes((bundle/name).read_bytes())
        vhost=root/'vhost';include=root/'include';auth=root/'auth'
        for path in [vhost,include,auth]:path.write_text('unchanged')
        auth.chmod(0o640)
        report=state/'report.json';report.write_text(json.dumps({'schemaVersion':1,'status':'ready','marker':'old-report'}));report.chmod(0o640)
        manifest={'sourceCommit':'b'*40,'files':{name:hashlib.sha256((bundle/name).read_bytes()).hexdigest() for name in installer.BUNDLE}}
        (bundle/'manifest.json').write_text(json.dumps(manifest))
        patches=[patch.object(installer,k,v) for k,v in dict(SHARE=share,LIB=lib,STATE=state,UNITS=units,BACKUPS=backups,VHOST=vhost,INCLUDE=include,AUTH=auth).items()]
        patches += [patch.object(installer.os,'geteuid',return_value=0),patch.object(installer.pwd,'getpwnam',return_value=SimpleNamespace(pw_uid=os.getuid())),patch.object(installer,'checked_file'),patch.object(installer,'checked_directory'),patch.object(installer.os,'chown')]
        return bundle,targets,report,patches

    def test_update_is_scoped_and_failure_rolls_back_files_and_report(self):
        from contextlib import ExitStack
        from itertools import product
        for fail_new,timer in product([False,True,'interrupt'],['active','inactive']):
            with self.subTest(fail_new=fail_new,timer=timer),tempfile.TemporaryDirectory() as temp,ExitStack() as stack:
                root=Path(temp);bundle,targets,report,patches=self.update_fixture(root)
                for p in patches:stack.enter_context(p)
                starts=[];commands=[]
                def run(args):
                    commands.append(args)
                    if args==['/usr/bin/goaccess','--version']:return 'GoAccess - 1.12.'
                    if 'ActiveState' in args:return timer+'\n'
                    if args==['/bin/systemctl','start','polradar-stats.service']:
                        starts.append(True)
                        if len(starts)==2:
                            report.write_text(json.dumps({'schemaVersion':1,'status':'ready','marker':'new-report'}))
                            if fail_new:
                                (report.parent/'report.tmp').write_text('incomplete');(report.parent/'report.tmp').chmod(0o640)
                            if fail_new=='interrupt':raise KeyboardInterrupt()
                            if fail_new:raise ValueError('generation failed')
                    return ''
                stack.enter_context(patch.object(installer,'run',side_effect=run))
                stack.enter_context(patch.object(installer.subprocess,'run'))
                if fail_new:
                    with self.assertRaises(ValueError):installer.update(bundle)
                else:installer.update(bundle)
                for name,path in targets.items():self.assertEqual(path.read_text(),('old-' if fail_new else 'new-')+name)
                self.assertEqual(json.loads(report.read_text())['marker'],'old-report' if fail_new else 'new-report')
                self.assertFalse((report.parent/'report.tmp').exists())
                for name in ['vhost','include','auth']:self.assertEqual((root/name).read_text(),'unchanged')
                self.assertEqual(['/bin/systemctl','start','polradar-stats.timer'] in commands,timer=='active')
                self.assertFalse(any('daemon-reload' in a or 'enable' in a or 'reload' in a for a in commands))

    def test_atomic_copy_rejects_changed_source_before_replacing_target(self):
        import os
        with tempfile.TemporaryDirectory() as temp:
            root=Path(temp);source=root/'source';source.write_text('new');target=root/'target';target.write_text('old')
            with self.assertRaises(ValueError):installer.atomic_copy(source,target,uid=os.getuid(),gid=os.getgid(),expected_digest='0'*64)
            self.assertEqual(target.read_text(),'old')
            self.assertEqual(sorted(p.name for p in root.iterdir()),['source','target'])

    def test_failed_service_stop_does_not_resume_timer_or_claim_rollback(self):
        from contextlib import ExitStack
        with tempfile.TemporaryDirectory() as temp,ExitStack() as stack:
            root=Path(temp);bundle,targets,report,patches=self.update_fixture(root)
            for p in patches:stack.enter_context(p)
            starts=[];commands=[]
            def run(args):
                commands.append(args)
                if args==['/usr/bin/goaccess','--version']:return 'GoAccess - 1.12.'
                if 'ActiveState' in args:return 'active'
                if args==['/bin/systemctl','start','polradar-stats.service']:
                    starts.append(True)
                    if len(starts)==2:raise ValueError('new generation failed')
                if args==['/bin/systemctl','stop','polradar-stats.service']:raise ValueError('could not stop')
                return ''
            stack.enter_context(patch.object(installer,'run',side_effect=run))
            with self.assertRaisesRegex(ValueError,'rollback requires review; timer remains stopped'):
                installer.update(bundle)
            self.assertNotIn(['/bin/systemctl','start','polradar-stats.timer'],commands)

if __name__=='__main__':unittest.main()
