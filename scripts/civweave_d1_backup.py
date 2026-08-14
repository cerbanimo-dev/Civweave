#!/usr/bin/env python3
"""Civweave D1 backup, integrity verification, and guarded restore tooling."""
from __future__ import annotations
import argparse, hashlib, json, pathlib, sqlite3, subprocess, sys, tempfile
from datetime import datetime, timezone

SCHEMA = "civweave.d1-backup-manifest.v1"
def utc_now(): return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
def sha256(path):
    digest=hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024*1024), b""): digest.update(chunk)
    return digest.hexdigest()
def run(command):
    print("+", " ".join(command), file=sys.stderr)
    subprocess.run(command, check=True)
def wrangler_base(config):
    command=["npx","wrangler"]
    if config: command.extend(["--config",config])
    return command

def verify_export(path, required_tables=None):
    path=path.resolve()
    if not path.is_file() or path.stat().st_size==0: raise SystemExit(f"Backup is missing or empty: {path}")
    sql=path.read_text(encoding="utf-8")
    if "CREATE TABLE" not in sql.upper(): raise SystemExit("Backup does not appear to contain a D1 schema export.")
    with tempfile.TemporaryDirectory(prefix="civweave-d1-verify-") as temp_dir:
        connection=sqlite3.connect(pathlib.Path(temp_dir)/"verify.sqlite3")
        try:
            connection.executescript(sql)
            integrity=connection.execute("PRAGMA integrity_check").fetchone()[0]
            if integrity!="ok": raise SystemExit(f"SQLite integrity_check failed: {integrity}")
            tables=[row[0] for row in connection.execute("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").fetchall()]
        finally: connection.close()
    missing=sorted(set(required_tables or [])-set(tables))
    if missing: raise SystemExit(f"Backup is missing required tables: {', '.join(missing)}")
    return {"schema":SCHEMA,"verifiedAt":utc_now(),"backupFile":path.name,"sizeBytes":path.stat().st_size,"sha256":sha256(path),"integrityCheck":"ok","tables":tables,"requiredTables":sorted(required_tables or [])}

def write_manifest(path, manifest):
    target=path.with_suffix(path.suffix+".manifest.json")
    target.write_text(json.dumps(manifest,indent=2)+"\n",encoding="utf-8")
    return target

def backup(args):
    output=pathlib.Path(args.output).resolve(); output.parent.mkdir(parents=True,exist_ok=True)
    run(wrangler_base(args.config)+["d1","export",args.database,"--remote","--output",str(output),"--skip-confirmation"])
    manifest=verify_export(output,args.required_table); manifest.update({"database":args.database,"source":"cloudflare-d1-remote"})
    manifest_path=write_manifest(output,manifest)
    print(json.dumps({"ok":True,"backup":str(output),"manifest":str(manifest_path),"sha256":manifest["sha256"]},indent=2))
def verify(args):
    path=pathlib.Path(args.input).resolve(); manifest=verify_export(path,args.required_table); manifest_path=write_manifest(path,manifest)
    print(json.dumps({"ok":True,"backup":str(path),"manifest":str(manifest_path),**manifest},indent=2))
def restore(args):
    path=pathlib.Path(args.input).resolve(); manifest=verify_export(path,args.required_table)
    if not args.confirm_remote_restore: raise SystemExit("Refusing remote restore. Re-run with --confirm-remote-restore only after verifying the target database, backup SHA-256, and rollback plan.")
    expected=(args.expected_sha256 or "").strip().lower()
    if expected and expected!=manifest["sha256"]: raise SystemExit(f"Backup SHA-256 mismatch: expected {expected}, got {manifest['sha256']}")
    run(wrangler_base(args.config)+["d1","execute",args.database,"--remote","--file",str(path),"--yes"])
    print(json.dumps({"ok":True,"restored":args.database,"backup":str(path),"sha256":manifest["sha256"],"completedAt":utc_now()},indent=2))

def parser():
    root=argparse.ArgumentParser(description="Civweave D1 backup and guarded restore tool"); sub=root.add_subparsers(dest="command",required=True)
    b=sub.add_parser("backup",help="Export and verify a remote D1 database"); b.add_argument("--database",required=True); b.add_argument("--output",required=True); b.add_argument("--config"); b.add_argument("--required-table",action="append",default=[]); b.set_defaults(func=backup)
    v=sub.add_parser("verify",help="Verify a D1 SQL export offline"); v.add_argument("--input",required=True); v.add_argument("--required-table",action="append",default=[]); v.set_defaults(func=verify)
    r=sub.add_parser("restore",help="Verify and restore a D1 SQL export to a remote database"); r.add_argument("--database",required=True); r.add_argument("--input",required=True); r.add_argument("--config"); r.add_argument("--required-table",action="append",default=[]); r.add_argument("--expected-sha256"); r.add_argument("--confirm-remote-restore",action="store_true"); r.set_defaults(func=restore)
    return root
def main():
    args=parser().parse_args()
    try: args.func(args)
    except subprocess.CalledProcessError as error: raise SystemExit(error.returncode) from error
if __name__=="__main__": main()
