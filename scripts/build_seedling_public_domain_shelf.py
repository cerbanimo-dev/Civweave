#!/usr/bin/env python3
"""Build an XTEINK/CrossPoint-readable, provenance-aware public-domain book shelf.

Downloads unmodified Project Gutenberg EPUBs, retaining the original internal
license files. No copyrighted modern editions or AI-generated substitutes.
Only downloaded, validated files are counted as "included" in the manifest.
"""
import argparse
import csv
import hashlib
import io
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree as ET

BOOKS = [
 (201, "Flatland: A Romance of Many Dimensions", "Edwin Abbott Abbott", "Geometry and social satire"),
 (22298, "Practical Mechanics for Boys", "James Slough Zerbe", "Historical toolmaking, not current safety advice"),
 (39863, "The Montessori Method", "Maria Montessori", "Historical learning design"),
 (852, "Democracy and Education", "John Dewey", "Education and civic participation"),
 (205, "Walden and On the Duty of Civil Disobedience", "Henry David Thoreau", "Nature and moral philosophy"),
 (147, "Common Sense", "Thomas Paine", "Political history"),
 (18, "The Federalist Papers", "Alexander Hamilton, James Madison and John Jay", "Civic institutions"),
 (408, "The Souls of Black Folk", "W. E. B. Du Bois", "Culture, education, social history"),
 (23, "Narrative of the Life of Frederick Douglass", "Frederick Douglass", "Memoir and literacy"),
 (34901, "On Liberty", "John Stuart Mill", "Political philosophy"),
 (769, "The Book of Tea", "Kakuzo Okakura", "Art and cultural interpretation"),
 (11, "Alice's Adventures in Wonderland", "Lewis Carroll", "Imagination"),
 (1661, "The Adventures of Sherlock Holmes", "Arthur Conan Doyle", "Observation and stories"),
 (21, "Aesop's Fables", "Aesop", "Parables and memory"),
]

NAMESPACES={"a":"http://www.w3.org/2005/Atom"}
ATOM=NAMESPACES["a"]
OPDS="http://opds-spec.org/2010/catalog"
ET.register_namespace("",ATOM)
ET.register_namespace("opds",OPDS)

def urls(n):
    return [
      f"https://www.gutenberg.org/ebooks/{n}.epub.noimages",
      f"https://www.gutenberg.org/ebooks/{n}.epub.images",
      f"https://www.gutenberg.org/ebooks/{n}.epub3.images",
      f"https://www.gutenberg.org/cache/epub/{n}/pg{n}-images-3.epub"
    ]
def slug(s):
    return re.sub(r"[^a-zA-Z0-9]+","-",s).strip("-")[:72]

def epub_valid(content):
    if not content.startswith(b"PK\x03\x04"):return False,"not a ZIP file"
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as z:
            if z.testzip() is not None:return False,"ZIP CRC error"
            names=z.namelist()
            if not names or names[0]!="mimetype" or z.read("mimetype").strip()!=b"application/epub+zip":
                return False,"invalid EPUB mimetype"
            if "META-INF/container.xml" not in names:return False,"missing EPUB container"
            if not any(n.endswith(".opf") for n in names):return False,"missing EPUB package"
            return True,"ok"
    except (ValueError,KeyError,zipfile.BadZipFile) as e:return False,str(e)

def download(n,requester=None,retries=2):
    requester=requester or urllib.request.urlopen
    failures=[]
    for url in urls(n):
        for attempt in range(retries):
            try:
                request=urllib.request.Request(url,headers={
                    "User-Agent":"Civweave-Seedling-ArchiveBuilder/0.2 (+https://github.com/cerbanimo-dev/Civweave; noncommercial public-domain archival)",
                    "Accept":"application/epub+zip,application/octet-stream;q=0.9,*/*;q=0.1"
                })
                with requester(request,timeout=45) as response:
                    if response.headers.get("Content-Length") and int(response.headers["Content-Length"])>40*1024*1024:
                        raise ValueError("file exceeds 40 MiB per-book limit")
                    data=response.read(40*1024*1024+1)
                    if len(data)>40*1024*1024:raise ValueError("file exceeds 40 MiB per-book limit")
                    ok,reason=epub_valid(data)
                    if not ok:raise ValueError(reason)
                    return url,data
            except (urllib.error.URLError,TimeoutError,OSError,ValueError,KeyError,zipfile.BadZipFile) as error:
                failures.append(f"{url}: {type(error).__name__}: {error}")
                if attempt+1<retries:time.sleep(1+attempt)
    raise RuntimeError("All book downloads failed; first errors: "+" | ".join(failures[:4]))

def build_opds(books=BOOKS,updated=None):
    updated=updated or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    feed=ET.Element(f"{{{ATOM}}}feed")
    ET.SubElement(feed,f"{{{ATOM}}}id").text="urn:civweave:seedling:books:v0.2"
    ET.SubElement(feed,f"{{{ATOM}}}title").text="Living Library: Seedling Edition — Public Domain Books"
    ET.SubElement(feed,f"{{{ATOM}}}updated").text=updated
    ET.SubElement(feed,f"{{{ATOM}}}author").append(ET.Element(f"{{{ATOM}}}name"))
    feed.find(f"{{{ATOM}}}author/{{{ATOM}}}name").text="Civweave Seedling"
    for n,title,author,summary in books:
        entry=ET.SubElement(feed,f"{{{ATOM}}}entry")
        ET.SubElement(entry,f"{{{ATOM}}}id").text=f"urn:gutenberg:ebook:{n}"
        ET.SubElement(entry,f"{{{ATOM}}}title").text=title
        a=ET.SubElement(entry,f"{{{ATOM}}}author")
        ET.SubElement(a,f"{{{ATOM}}}name").text=author
        ET.SubElement(entry,f"{{{ATOM}}}updated").text=updated
        ET.SubElement(entry,f"{{{ATOM}}}summary").text=summary+" — Historical reference; public domain in the United States per Project Gutenberg."
        ET.SubElement(entry,f"{{{ATOM}}}link",{
           "href":f"https://www.gutenberg.org/ebooks/{n}.epub.noimages",
           "rel":"http://opds-spec.org/acquisition",
           "type":"application/epub+zip"
        })
        ET.SubElement(entry,f"{{{ATOM}}}link",{
           "href":f"https://www.gutenberg.org/ebooks/{n}",
           "rel":"alternate","type":"text/html"
        })
    return ET.tostring(feed,encoding="utf-8",xml_declaration=True)

def build(out:Path,limit:int=14,skip_download=False):
    out.mkdir(parents=True,exist_ok=True)
    run_at=datetime.now(timezone.utc).isoformat()
    records=[]; files={}
    for n,title,author,summary in BOOKS[:limit]:
        book={"id":n,"title":title,"author":author,"summary":summary,"source":f"https://www.gutenberg.org/ebooks/{n}","included":False}
        if not skip_download:
            try:
                url,data=download(n)
                name=f"Books/Full/{n}_{slug(title)}.epub"
                files[name]=data
                book.update(included=True,filename=name,downloadUrl=url,sizeBytes=len(data),sha256=hashlib.sha256(data).hexdigest())
                print(f"INCLUDED {n} {title} ({len(data)} bytes)",flush=True)
            except Exception as error:
                book["error"]=str(error)[:400]
                print(f"NOT INCLUDED {n} {title}: {book['error']}",file=sys.stderr,flush=True)
            time.sleep(.6)
        records.append(book)
    manifest={
        "schema":"civweave.living-library.seedling-book-shelf.v0.2",
        "createdAt":run_at,"format":"Original Project Gutenberg EPUB, unmodified",
        "audience":"United States public-domain archival education",
        "includedCount":sum(1 for b in records if b["included"]),
        "catalogCount":len(records),"books":records,
        "privacy":"No Passport data, API keys, guild identities or user records"
    }
    files["catalog.json"]=json.dumps(manifest,indent=2,ensure_ascii=False).encode()
    files["catalog.opds.xml"]=build_opds(BOOKS[:limit])
    files["READ_ME_FIRST.txt"]=(
        "LIVING LIBRARY: SEEDLING EDITION — FULL BOOK SHELF v0.2\n\n"
        "The /Books/Full folder contains ORIGINAL, UNMODIFIED Project Gutenberg EPUB editions. "
        "Only books with included:true in catalog.json are actually in this archive.\n"
        "Copy EPUB files to the X4 Pro microSD card under /Books/Seedling/Full/. "
        "Open them with CrossPoint Reader. Do not copy this ZIP without extracting it.\n\n"
        "The OPDS catalog is a curated list of source links. It requires a web host to be added as an OPDS server. "
        "It is not a self-running app or firmware.\n\n"
        "Project Gutenberg licenses and notices must remain inside the original EPUB files. "
        "Do not mistake historic medical, construction or toolmaking instructions for current safety standards. "
        "Copyright laws outside the US may differ.\n\n"
        f"Built at: {run_at}\n"
    ).encode()
    checks=[f"{hashlib.sha256(b).hexdigest()}  {name}" for name,b in sorted(files.items()) if name.endswith(".epub")]
    files["SHA256SUMS.txt"]=("\n".join(checks)+"\n").encode()
    archive=out/"Living-Library-Seedling-Edition-v0.2-Full-Books.zip"
    with zipfile.ZipFile(archive,"w",zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for name,data in sorted(files.items()):z.writestr(name,data)
    (out/"catalog.json").write_bytes(files["catalog.json"])
    (out/"catalog.opds.xml").write_bytes(files["catalog.opds.xml"])
    print(json.dumps({"archive":str(archive),"booksIncluded":manifest["includedCount"],"booksCatalogued":len(records)},indent=2))
    if not skip_download and manifest["includedCount"]<1:raise RuntimeError("No full books downloaded; refusing to publish a misleading shelf.")
    return manifest

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--out",type=Path,default=Path("dist/seedling"))
    p.add_argument("--limit",type=int,default=14)
    p.add_argument("--catalog-only",action="store_true")
    a=p.parse_args()
    build(a.out,max(1,min(len(BOOKS),a.limit)),a.catalog_only)
