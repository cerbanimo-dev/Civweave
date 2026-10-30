import importlib.util
import io
import json
import tempfile
import unittest
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

SPEC=importlib.util.spec_from_file_location("seedling_builder","scripts/build_seedling_public_domain_shelf.py")
mod=importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mod)

def valid_sample():
    buf=io.BytesIO()
    with zipfile.ZipFile(buf,"w") as z:
        z.writestr("mimetype","application/epub+zip",compress_type=zipfile.ZIP_STORED)
        z.writestr("META-INF/container.xml","<container/>")
        z.writestr("OEBPS/content.opf","<package/>")
    return buf.getvalue()

class TestSeedlingBookShelf(unittest.TestCase):
    def test_valid_epub_acceptance(self):
        ok,why=mod.epub_valid(valid_sample())
        self.assertTrue(ok,why)
    def test_fake_download_is_rejected(self):
        ok,_=mod.epub_valid(b"<html>HTTP block page</html>")
        self.assertFalse(ok)
    def test_epub_without_container_rejected(self):
        with io.BytesIO() as data:
            with zipfile.ZipFile(data,"w") as z:
                z.writestr("mimetype","application/epub+zip",compress_type=zipfile.ZIP_STORED)
                z.writestr("OEBPS/content.opf","<package/>")
            self.assertFalse(mod.epub_valid(data.getvalue())[0])
    def test_opds_points_to_original_project_gutenberg_epubs(self):
        xml=mod.build_opds(mod.BOOKS[:2],"2026-10-29T00:00:00Z")
        root=ET.fromstring(xml)
        ns={"a":"http://www.w3.org/2005/Atom"}
        entries=root.findall("a:entry",ns)
        self.assertEqual(len(entries),2)
        for item in entries:
            links=item.findall("a:link",ns)
            epub=[x for x in links if x.attrib.get("type")=="application/epub+zip"]
            self.assertEqual(len(epub),1)
            self.assertTrue(epub[0].attrib["href"].startswith("https://www.gutenberg.org/ebooks/"))
    def test_published_x4pro_opds_catalog_has_all_full_books(self):
        xml_path=Path('public/seedling/books.opds.xml')
        self.assertTrue(xml_path.is_file())
        root=ET.fromstring(xml_path.read_bytes())
        entries=root.findall('a:entry',{'a':'http://www.w3.org/2005/Atom'})
        self.assertEqual(len(entries),14)
        ids={entry.find('a:id',{'a':'http://www.w3.org/2005/Atom'}).text for entry in entries}
        self.assertEqual(ids,{f'urn:gutenberg:ebook:{n}' for n,*_ in mod.BOOKS})
        for entry in entries:
            links=entry.findall('a:link',{'a':'http://www.w3.org/2005/Atom'})
            self.assertEqual(len([a for a in links if a.attrib.get('type')=='application/epub+zip']),1)
    def test_catalog_only_does_not_claim_downloaded_books(self):
        with tempfile.TemporaryDirectory() as temp:
            obj=mod.build(Path(temp),limit=2,skip_download=True)
            self.assertEqual(obj["includedCount"],0)
            self.assertEqual(obj["catalogCount"],2)
            archive=Path(temp)/"Living-Library-Seedling-Edition-v0.2-Full-Books.zip"
            self.assertTrue(archive.is_file())
            with zipfile.ZipFile(archive) as z:
                self.assertEqual(z.testzip(),None)
                self.assertFalse([name for name in z.namelist() if name.endswith(".epub")])
                actual=json.loads(z.read("catalog.json"))
                self.assertEqual(actual["includedCount"],0)
if __name__=="__main__":unittest.main()
