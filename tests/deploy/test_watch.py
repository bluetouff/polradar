import importlib.util
from pathlib import Path
import socket
import unittest
from unittest.mock import Mock, patch

spec=importlib.util.spec_from_file_location('watch',Path(__file__).resolve().parents[2]/'scripts/watch-sources.py')
watch=importlib.util.module_from_spec(spec)
spec.loader.exec_module(watch)


class WatchTests(unittest.TestCase):
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

    def fake_fetch(self,response):
        connection=Mock()
        connection.getresponse.return_value=response
        context=Mock()
        raw=Mock()
        patches=[patch.object(watch,'public_addresses',return_value=['1.1.1.1']),patch.object(watch.http.client,'HTTPSConnection',return_value=connection),patch.object(watch.ssl,'create_default_context',return_value=context),patch.object(watch.socket,'create_connection',return_value=raw)]
        return connection,context,patches

    def test_fetch_pins_validated_ip_and_keeps_tls_hostname_validation(self):
        response=Mock(status=200)
        response.getheader.side_effect=lambda name,default='': {'Content-Type':'text/html','Content-Length':'3'}.get(name,default)
        response.read.side_effect=[b'abc',b'']
        connection,context,patches=self.fake_fetch(response)
        with patches[0],patches[1],patches[2],patches[3] as create:
            self.assertEqual(watch.fetch('https://example.org/source',self.allowed),(200,'text/html',b'abc'))
        self.assertEqual(create.call_args.args[0],('1.1.1.1',443))
        self.assertEqual(context.wrap_socket.call_args.kwargs['server_hostname'],'example.org')
        self.assertEqual(connection.request.call_args.args[:2],('GET','/source'))
        connection.close.assert_called_once()

    def test_oversized_and_encoded_documents_are_blocked(self):
        for headers in [{'Content-Type':'text/html','Content-Length':str(watch.LIMIT+1)},{'Content-Type':'text/html','Content-Encoding':'gzip'}]:
            response=Mock(status=200)
            response.getheader.side_effect=lambda name,default='',headers=headers:headers.get(name,default)
            connection,context,patches=self.fake_fetch(response)
            with patches[0],patches[1],patches[2],patches[3],self.assertRaises(ValueError):
                watch.fetch('https://example.org/source',self.allowed)
            response.read.assert_not_called()

    def test_a_source_has_a_total_deadline(self):
        with patch.object(watch.time,'monotonic',side_effect=[0,46]),patch.object(watch,'public_addresses',return_value=['1.1.1.1']),self.assertRaises(TimeoutError):
            watch.fetch('https://example.org/',self.allowed)


    def test_chunked_downloads_are_also_bounded(self):
        response=Mock(status=200)
        response.getheader.side_effect=lambda name,default='':{'Content-Type':'text/html'}.get(name,default)
        response.read.side_effect=[b'x'*(watch.LIMIT+1)]
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


if __name__=='__main__':
    unittest.main()
