import importlib.util
from pathlib import Path
import socket
import ssl
import threading
import tempfile
import json
import unittest
from unittest.mock import Mock, patch

spec=importlib.util.spec_from_file_location('watch',Path(__file__).resolve().parents[2]/'scripts/watch-sources.py')
watch=importlib.util.module_from_spec(spec)
spec.loader.exec_module(watch)


class WatchTests(unittest.TestCase):
    def test_institutional_watch_respects_explicit_selection(self):
        src = {'id': 'insee', 'kind': 'institution'}
        self.assertFalse(watch.monitored(src))
        self.assertTrue(watch.monitored({**src, 'watch': True}))
        self.assertTrue(watch.monitored({**src, 'id': 'sondages'}))
        self.assertFalse(watch.monitored({**src, 'id': 'archive', 'kind': 'parti', 'watch': False}))

    def test_first_observation_survives_a_change_an_outage_and_an_editorial_review(self):
        source = {'id': 'source', 'url': 'https://example.org/page'}
        old = b'<article>' + b'Programme initial et engagement chiffre distinct. ' * 6 + b'</article>'
        new = b'<article>' + b'Nouvelle proposition avec un engagement different. ' * 6 + b'</article>'
        with patch.object(watch, 'fetch_reliably', return_value=(200, 'text/html', old)):
            first = watch.compare_source(source, {}, {}, {'example.org'})
        refs = watch.initial_references([{'scope': 'sondages'}, {'sourceChecks': [first]}])
        self.assertEqual(refs['source'], first['fingerprint'])
        with patch.object(watch, 'fetch_reliably', return_value=(200, 'text/html', new)):
            change = watch.compare_source(source, {}, refs, {'example.org'})
        self.assertEqual(change['status'], 'modifie')
        with patch.object(watch, 'fetch_reliably', return_value=(404, 'text/html', b'')):
            outage = watch.compare_source(source, {}, refs, {'example.org'})
        self.assertEqual(outage['initialFingerprint'], first['fingerprint'])
        next_refs = watch.initial_references([{'sourceChecks':[outage, change]}])
        self.assertEqual(next_refs, refs)
        with patch.object(watch, 'fetch_reliably', return_value=(200, 'text/html', new)):
            reviewed = watch.compare_source(source, {'status':'accessible', 'fingerprint':change['fingerprint']}, refs, {'example.org'})
        self.assertEqual(reviewed['status'], 'accessible')
        self.assertNotIn('initialFingerprint', reviewed)

    def setUp(self):
        self.sleep_patch=patch.object(watch.time,'sleep')
        self.sleep_patch.start()
        self.addCleanup(self.sleep_patch.stop)
        watch.HOST_LAST.clear()
        watch.HOST_LOCKS.clear()

    allowed={'example.org','other.example.org'}

    def test_only_declared_https_hosts_without_credentials_or_ports(self):
        for value in ['http://example.org/','https://user:secret@example.org/','https://@example.org/','https://example.org:443/','https://127.0.0.1/','https://[::1]/','https://unknown.org/','https://example.org/\nheader','https://example.org\\@localhost/']:
            with self.subTest(value=value), self.assertRaises(ValueError):
                watch.checked_url(value,self.allowed)
        self.assertEqual(watch.checked_url('https://example.org/a?q=1',self.allowed).hostname,'example.org')

    def test_every_dns_address_must_be_public_including_ipv6(self):
        for address in ['127.0.0.1','10.1.1.1','169.254.169.254','192.168.0.1','::1','fc00::1','fe80::1','::ffff:127.0.0.1']:
            answers=[(socket.AF_INET,socket.SOCK_STREAM,6,'',('1.1.1.1',443)),(socket.AF_INET6,socket.SOCK_STREAM,6,'',(address,443))]
            with self.subTest(address=address), patch.object(watch.socket,'getaddrinfo',return_value=answers), self.assertRaises(ValueError):
                watch.public_addresses('example.org')

    def test_redirects_revalidate_host_and_only_upgrade_same_host_http(self):
        current='https://example.org/catalogue'
        self.assertEqual(watch.redirect_url(current,'http://example.org/notice',self.allowed),'https://example.org/notice')
        self.assertEqual(watch.redirect_url(current,'/notice',self.allowed),'https://example.org/notice')
        for location in ['http://other.example.org/','https://127.0.0.1/','https://unknown.org/','https://user:secret@example.org/','']:
            with self.subTest(location=location), self.assertRaises(ValueError):
                watch.redirect_url(current,location,self.allowed)

    def test_normalization_ignores_active_content_and_page_furniture(self):
        text='Programme documenté et disponible pour consultation. '*10
        a=f'<html><header>heure A</header><main>{text}</main><script>secretA()</script></html>'.encode()
        b=f'<html><header>heure B</header><main>{text}</main><script>secretB()</script></html>'.encode()
        self.assertEqual(watch.fingerprint('text/html',a),watch.fingerprint('text/html',b))
        self.assertNotEqual(watch.fingerprint('text/html',a),watch.fingerprint('text/html',f'<main>{text}Nouvelle mesure.</main>'.encode()))
        for content_type,body in [('application/pdf',b'<html>erreur</html>'),('text/html',b'just a moment'),('application/json',b'{}'),('text/html',b'access denied '+b'x'*200)]:
            with self.subTest(content_type=content_type), self.assertRaises(ValueError):
                watch.fingerprint(content_type,body)

    def test_document_scope_ignores_sidebars_and_following_posts(self):
        body='Propositions politiques du document officiel. '*12
        first=f'<aside>Actualite A</aside><div class="ob-sections"><div><p>{body}</p><script>hidden()</script></div></div><div class="ob-sections">autre billet A</div>'
        second=first.replace('Actualite A','Actualite B').replace('autre billet A','autre billet B')
        self.assertEqual(watch.fingerprint('text/html',first.encode(),'ob-sections'),watch.fingerprint('text/html',second.encode(),'ob-sections'))
        self.assertNotEqual(watch.fingerprint('text/html',first.encode(),'ob-sections'),watch.fingerprint('text/html',first.replace(body,body+' Nouvelle proposition.').encode(),'ob-sections'))

    def test_document_scope_fails_closed_when_missing_incomplete_or_invalid(self):
        body=b'Programme officiel documente. '*20
        for html,scope in [(body,'ob-sections'),(b'<div class="ob-sections">'+body,'ob-sections'),(body,'x]script'),(b'<div class="ob-sections"></div>'+body,'ob-sections'),(b'<div class>'+body+b'</div>','ob-sections')]:
            with self.subTest(scope=scope),self.assertRaises(ValueError):
                watch.fingerprint('text/html',html,scope)

    def programme_source(self):
        sources=json.loads((Path(__file__).resolve().parents[2]/'src/data/sources.json').read_text())
        source=next(row for row in sources if row['id']=='kazib-premieres-mesures-2027')
        self.assertTrue(source['watch'])
        self.assertEqual(source['watchContentClass'],'parrafos')
        return source

    programme_paragraphs=(
        'Proposition de test A : valeur de référence 100. Ce paragraphe décrit les conditions et le calendrier de cette mesure fictive utilisée pour vérifier la veille.',
        'Proposition de test B : le texte de cette mesure fictive reste dans le document surveillé. Ses modalités doivent continuer à déclencher un signalement si elles changent.',
        'Proposition de test C : les paragraphes du programme sont comparés dans leur ordre initial, indépendamment des autres actualités affichées autour du document.',
    )

    def programme_page(self,paragraphs=None,associated=('Article associé A','Article associé B')):
        if paragraphs is None:
            paragraphs=self.programme_paragraphs
        body=''.join(f'<div><p>{paragraph}</p></div>' for paragraph in paragraphs)
        related=''.join(f'<div class="container-block-article"><a>{title}</a></div>' for title in associated)
        return f'<div class="article"><div class="container-title-article container"><h2>Document de test</h2></div><article class="container-article"><div class="parrafos">{body}</div></article><div class="container-other">{related}</div></div>'.encode()

    def test_programme_watch_ignores_related_article_changes_and_order(self):
        source=self.programme_source()
        baseline={'fingerprint':watch.fingerprint('text/html',self.programme_page(),'parrafos'),'reviewedAt':'2026-11-17T12:00:00Z','reviewNote':'Corps du document relu'}
        for related in [('Article associé B','Article associé A'),('Nouvel article associé','Article associé A'),()]:
            with self.subTest(related=related),patch.object(watch,'fetch_reliably',return_value=(200,'text/html',self.programme_page(associated=related))):
                row=watch.inspect(source,baseline,{'www.revolutionpermanente.fr'})
            self.assertEqual(row['status'],'accessible')
            self.assertEqual(row['fingerprint'],baseline['fingerprint'])
            self.assertEqual(row['reviewedAt'],baseline['reviewedAt'])

    def test_programme_changes_still_trigger_review_including_paragraph_order(self):
        source=self.programme_source()
        body=self.programme_page()
        baseline={'fingerprint':watch.fingerprint('text/html',body,'parrafos'),'reviewedAt':'2026-11-17T12:00:00Z','reviewNote':'Corps du document relu'}
        variants=[
            body.replace(b'100',b'101'),
            self.programme_page([*self.programme_paragraphs,'Nouvelle mesure de test.']),
            self.programme_page(self.programme_paragraphs[:-1]),
            self.programme_page(reversed(self.programme_paragraphs)),
        ]
        for html in variants:
            with self.subTest(html=html[:80]),patch.object(watch,'fetch_reliably',return_value=(200,'text/html',html)):
                row=watch.inspect(source,baseline,{'www.revolutionpermanente.fr'})
            self.assertEqual(row['status'],'modifie')
            self.assertEqual(row['previousFingerprint'],baseline['fingerprint'])
            self.assertNotIn('reviewedAt',row)

    def test_programme_container_failure_never_falls_back_to_related_articles(self):
        source=self.programme_source()
        baseline={'fingerprint':watch.fingerprint('text/html',self.programme_page(),'parrafos')}
        related='Actualité associée sans contenu de programme. '*20
        for html in [f'<div class="container-other">{related}</div>',f'<div class="parrafos">{related}',f'<div class="parrafos"></div><div>{related}</div>']:
            with self.subTest(html=html[:80]),patch.object(watch,'fetch_reliably',return_value=(200,'text/html',html.encode())):
                row=watch.inspect(source,baseline,{'www.revolutionpermanente.fr'})
            self.assertEqual(row['status'],'bloque')
            self.assertIsNone(row['fingerprint'])
            self.assertEqual(row['previousFingerprint'],baseline['fingerprint'])

    def test_failure_is_exposed_without_exception_details_or_fake_hash(self):
        source={'id':'source-test','url':'https://example.org/'}
        with patch.object(watch,'fetch',side_effect=OSError('private detail secret')):
            row=watch.inspect(source,{},self.allowed)
        self.assertEqual(row['status'],'indisponible')
        self.assertIsNone(row['fingerprint'])
        self.assertNotIn('secret',str(row))
        with patch.object(watch,'fetch',return_value=(403,'text/html',b'')):
            self.assertEqual(watch.inspect(source,{},self.allowed)['status'],'bloque')

    def test_content_change_only_requests_review_and_preserves_source(self):
        source={'id':'source-test','url':'https://example.org/','checked':'2026-11-16'}
        content=b'<main>'+b'Programme public documente. '*20+b'</main>'
        with patch.object(watch,'fetch',return_value=(200,'text/html',content)):
            row=watch.inspect(source,{'fingerprint':'a'*64},self.allowed)
        self.assertEqual(row['status'],'modifie')
        self.assertEqual(row['previousFingerprint'],'a'*64)
        self.assertEqual(source['checked'],'2026-11-16')
        self.assertEqual(row['fingerprint'],watch.fingerprint('text/html',content))

    def test_unreviewed_change_stays_open_on_the_next_check(self):
        raw = ('<main>' + 'Proposition détaillée. ' * 24 + '</main>').encode()
        previous = {'fingerprint': 'a'*64, 'status':'accessible'}
        source = {'id':'programme','url':'https://example.org/programme'}
        with patch.object(watch, 'fetch_reliably', return_value=(200,'text/html',raw)):
            changed = watch.inspect(source,previous,self.allowed)
            repeated = watch.inspect(source,changed,self.allowed)
        self.assertEqual((repeated['status'],repeated['previousFingerprint'],repeated['fingerprint']),('modifie','a'*64,changed['fingerprint']))

    def test_editorial_review_is_kept_only_for_the_same_fingerprint(self):
        source={'id':'source-test','url':'https://example.org/'}
        body=b'<main>'+b'Programme documente pour la consultation. '*12+b'</main>'
        previous={'fingerprint':watch.fingerprint('text/html',body),'reviewedAt':'2026-11-17T12:00:00Z','reviewNote':'Document relu'}
        with patch.object(watch,'fetch',return_value=(200,'text/html',body)):
            row=watch.inspect(source,previous,self.allowed)
        self.assertEqual(row['reviewedAt'],previous['reviewedAt'])
        with patch.object(watch,'fetch',return_value=(200,'text/html',body+b' Nouveau contenu.')):
            row=watch.inspect(source,previous,self.allowed)
        self.assertEqual(row['status'],'modifie')
        self.assertNotIn('reviewedAt',row)

    def fake_fetch(self,response):
        response.isclosed.return_value=False
        connection=Mock()
        connection.getresponse.return_value=response
        context=Mock()
        raw=Mock()
        patches=[patch.object(watch,'public_addresses',return_value=['1.1.1.1']),patch.object(watch.http.client,'HTTPSConnection',return_value=connection),patch.object(watch.ssl,'create_default_context',return_value=context),patch.object(watch.socket,'create_connection',return_value=raw)]
        return connection,context,patches

    def test_fetch_pins_validated_ip_and_keeps_tls_hostname_validation(self):
        response=Mock(status=200)
        response.getheader.side_effect=lambda name,default='': {'Content-Type':'text/html','Content-Length':'3'}.get(name,default)
        response.read1.side_effect=[b'abc',b'']
        connection,context,patches=self.fake_fetch(response)
        with patches[0],patches[1],patches[2],patches[3] as create:
            self.assertEqual(watch.fetch('https://example.org/source',self.allowed),(200,'text/html',b'abc'))
        self.assertEqual(create.call_args.args[0],('1.1.1.1',443))
        self.assertEqual(context.wrap_socket.call_args.kwargs['server_hostname'],'example.org')
        self.assertEqual(connection.request.call_args.args[:2],('GET','/source'))
        connection.close.assert_called_once()

    def test_fetch_reads_body_after_remote_peer_requests_connection_close(self):
        response=Mock(status=200)
        response.getheader.side_effect=lambda name,default='': {'Content-Type':'text/html'}.get(name,default)
        response.isclosed.side_effect=[False,True]
        response.read1.return_value=b'page'
        connection,context,patches=self.fake_fetch(response)
        def detach_socket():
            connection.sock=None
            return response
        connection.getresponse.side_effect=detach_socket
        with patches[0],patches[1],patches[2],patches[3]:
            self.assertEqual(watch.fetch('https://example.org/source',self.allowed,with_url=True),
                             (200,'text/html',b'page','https://example.org/source'))
        response.read1.assert_called_once()

    def test_oversized_and_encoded_documents_are_blocked(self):
        for headers in [{'Content-Type':'text/html','Content-Length':str(watch.LIMIT+1)},{'Content-Type':'text/html','Content-Encoding':'gzip'}]:
            response=Mock(status=200)
            response.getheader.side_effect=lambda name,default='',headers=headers:headers.get(name,default)
            connection,context,patches=self.fake_fetch(response)
            with patches[0],patches[1],patches[2],patches[3],self.assertRaises(ValueError):
                watch.fetch('https://example.org/source',self.allowed)
            response.read1.assert_not_called()

    def test_retries_are_bounded_and_errors_are_not_turned_into_success(self):
        with patch.object(watch,'fetch',side_effect=[(403,'text/html',b''),(503,'text/html',b''),(200,'text/html',b'ok')]) as fetch:
            self.assertEqual(watch.fetch_reliably('https://example.org/',self.allowed)[0],200)
            self.assertEqual(fetch.call_count,3)
        with patch.object(watch,'fetch',return_value=(403,'text/html',b'')) as fetch:
            self.assertEqual(watch.fetch_reliably('https://example.org/',self.allowed)[0],403)
            self.assertEqual(fetch.call_count,3)
        with patch.object(watch,'fetch',return_value=(404,'text/html',b'')) as fetch:
            self.assertEqual(watch.fetch_reliably('https://example.org/',self.allowed)[0],404)
            self.assertEqual(fetch.call_count,1)
        with patch.object(watch,'fetch',side_effect=[(526,'text/html',b''),(200,'text/html',b'ok')]) as fetch:
            self.assertEqual(watch.fetch_reliably('https://example.org/',self.allowed)[0],200)
            self.assertEqual(fetch.call_count,2)

    def test_tls_failures_do_not_trigger_availability_retries(self):
        with patch.object(watch,'fetch',side_effect=ssl.SSLError('certificate failed')) as fetch, self.assertRaises(ssl.SSLError):
            watch.fetch_reliably('https://example.org/',self.allowed)
        self.assertEqual(fetch.call_count,1)

    def test_same_publisher_requests_are_serialized(self):
        entered=threading.Event();release=threading.Event();second=threading.Event()
        def fetch(url,hosts):
            if url.endswith('/one'):
                entered.set();release.wait(2)
            else:second.set()
            return (200,'text/html',b'ok')
        with patch.object(watch,'fetch',side_effect=fetch):
            a=threading.Thread(target=watch.fetch_reliably,args=('https://example.org/one',self.allowed))
            b=threading.Thread(target=watch.fetch_reliably,args=('https://example.org/two',self.allowed))
            a.start();self.assertTrue(entered.wait(2));b.start()
            self.assertFalse(second.wait(.03));release.set();a.join(2);b.join(2)
            self.assertTrue(second.is_set());self.assertFalse(a.is_alive() or b.is_alive())

    def test_excluded_index_is_preserved_as_a_source_but_not_fetched(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory);(root/'src/data').mkdir(parents=True)
            sources=[{'id':'index','url':'https://example.org/','kind':'campagne','watch':False},{'id':'chapter','url':'https://example.org/chapter','kind':'campagne'}]
            (root/'src/data/sources.json').write_text(json.dumps(sources))
            with patch.object(watch,'ROOT',root),patch.object(watch,'inspect',return_value={'sourceId':'chapter','status':'accessible','checkedAt':'2026-11-17T12:00:00Z'}) as inspect:
                watch.run(root/'report.json',root/'missing.json')
            self.assertEqual(inspect.call_count,1)
            self.assertEqual(inspect.call_args.args[0]['id'],'chapter')

    def test_a_source_has_a_total_deadline(self):
        with patch.object(watch.time,'monotonic',side_effect=[0,46]),patch.object(watch,'public_addresses',return_value=['1.1.1.1']),self.assertRaises(TimeoutError):
            watch.fetch('https://example.org/',self.allowed)


    def test_chunked_downloads_are_also_bounded(self):
        response=Mock(status=200)
        response.getheader.side_effect=lambda name,default='':{'Content-Type':'text/html'}.get(name,default)
        response.read1.side_effect=[b'x'*(watch.LIMIT+1)]
        connection,context,patches=self.fake_fetch(response)
        with patches[0],patches[1],patches[2],patches[3],self.assertRaises(ValueError):
            watch.fetch('https://example.org/',self.allowed)

    def test_redirect_dns_is_checked_again_before_connecting(self):
        response=Mock(status=302)
        response.getheader.side_effect=lambda name,default='':{'Location':'https://other.example.org/','Content-Type':'text/html'}.get(name,default)
        connection,context,patches=self.fake_fetch(response)
        def addresses(host,*args,**kwargs):
            address='1.1.1.1' if host=='example.org' else '127.0.0.1'
            return [(socket.AF_INET,socket.SOCK_STREAM,6,'',(address,443))]
        with patch.object(watch.socket,'getaddrinfo',side_effect=addresses),patches[1],patches[2],patches[3] as create,self.assertRaises(ValueError):
            watch.fetch('https://example.org/',self.allowed)
        self.assertEqual(create.call_count,1)
        self.assertEqual(connection.request.call_count,1)


    def video_metadata(self):
        return {'type':'video','provider_name':'YouTube','provider_url':'https://www.youtube.com/','title':'Discours officiel','author_name':'PCF','author_url':'https://www.youtube.com/@PCF','html':'<iframe src="https://www.youtube.com/embed/8p5_pfTtcck?feature=oembed"></iframe>'}

    def test_video_metadata_endpoint_is_fixed_and_canonical(self):
        source='https://www.youtube.com/watch?v=8p5_pfTtcck'
        endpoint,video=watch.youtube_metadata_url(source,{'www.youtube.com'})
        self.assertEqual(video,'8p5_pfTtcck')
        self.assertEqual(watch.urllib.parse.urlsplit(endpoint).path,'/oembed')
        self.assertEqual(watch.urllib.parse.parse_qs(watch.urllib.parse.urlsplit(endpoint).query),{'url':[source],'format':['json']})
        for url in [source+'&v=abcdefghijk',source+'&next=https://example.org/',source+'#x','https://www.youtube.com/shorts/8p5_pfTtcck','https://example.org/watch?v=8p5_pfTtcck','https://www.youtube.com/watch?v=../private']:
            with self.subTest(url=url),self.assertRaises(ValueError):watch.youtube_metadata_url(url,{'www.youtube.com','example.org'})

    def test_video_fingerprint_only_compares_metadata_and_binds_the_video(self):
        data=self.video_metadata()
        digest=watch.youtube_metadata_fingerprint('application/json',json.dumps(data).encode(),'8p5_pfTtcck')
        data['thumbnail_width']=480
        self.assertEqual(digest,watch.youtube_metadata_fingerprint('application/json',json.dumps(data).encode(),'8p5_pfTtcck'))
        data['title']='Nouveau titre'
        self.assertNotEqual(digest,watch.youtube_metadata_fingerprint('application/json',json.dumps(data).encode(),'8p5_pfTtcck'))
        for key,value in [('type','rich'),('provider_name','Autre'),('provider_url','https://example.org/'),('title',None),('author_url','https://www.youtube.com.evil.example/@PCF'),('author_url','https://user:secret@www.youtube.com/@PCF'),('author_url','https://www.youtube.com:8443/@PCF'),('html','<iframe src="https://www.youtube.com/embed/abcdefghijk"></iframe>'),('html','<iframe src="http://www.youtube.com/embed/8p5_pfTtcck"></iframe>'),('html','<iframe src="https://www.youtube.com/embed/8p5_pfTtcck"></iframe><iframe src="https://example.org/"></iframe>')]:
            bad=self.video_metadata();bad[key]=value
            with self.subTest(key=key,value=value),self.assertRaises(ValueError):watch.youtube_metadata_fingerprint('application/json',json.dumps(bad).encode(),'8p5_pfTtcck')
        for kind,body in [('text/html',json.dumps(data).encode()),('application/json',b'[]'),('application/json',b'not-json')]:
            with self.assertRaises(ValueError):watch.youtube_metadata_fingerprint(kind,body,'8p5_pfTtcck')

    def test_video_availability_errors_remain_visible(self):
        source={'id':'video','url':'https://www.youtube.com/watch?v=8p5_pfTtcck','watchFormat':'youtube-oembed'}
        with patch.object(watch,'fetch_reliably',return_value=(200,'application/json',json.dumps(self.video_metadata()).encode())) as fetch:
            row=watch.inspect(source,{}, {'www.youtube.com'})
        self.assertEqual(row['status'],'accessible');self.assertIn('métadonnées',row['message'])
        self.assertTrue(fetch.call_args.args[0].startswith('https://www.youtube.com/oembed?'))
        with patch.object(watch,'fetch_reliably',return_value=(429,'text/html',b'')):
            row=watch.inspect(source,{'fingerprint':'a'*64},{'www.youtube.com'})
        self.assertEqual(row['status'],'bloque');self.assertIsNone(row['fingerprint']);self.assertEqual(row['previousFingerprint'],'a'*64)
        source['watchContentClass']='article'
        with patch.object(watch,'fetch_reliably') as fetch:
            row=watch.inspect(source,{}, {'www.youtube.com'})
        fetch.assert_not_called();self.assertEqual(row['status'],'bloque')


if __name__=='__main__':
    unittest.main()
