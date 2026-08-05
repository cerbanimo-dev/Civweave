#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';
import { deflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < CRC_TABLE.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1);
  }
  CRC_TABLE[index] = value >>> 0;
}

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function dosDateTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  const year = Math.max(1980, Math.min(2107, date.getFullYear()));
  const month = Math.max(1, Math.min(12, date.getMonth() + 1));
  const day = Math.max(1, Math.min(31, date.getDate()));
  const hours = Math.max(0, Math.min(23, date.getHours()));
  const minutes = Math.max(0, Math.min(59, date.getMinutes()));
  const seconds = Math.max(0, Math.min(59, date.getSeconds()));
  return {
    date: ((year - 1980) << 9) | (month << 5) | day,
    time: (hours << 11) | (minutes << 5) | Math.floor(seconds / 2),
  };
}

function archiveName(value, directory = false) {
  const normalized = String(value).split(path.sep).join('/').replace(/^\/+/, '');
  if (!normalized || normalized.includes('../') || normalized === '..') {
    throw new Error(`Unsafe ZIP entry name: ${value}`);
  }
  return directory && !normalized.endsWith('/') ? `${normalized}/` : normalized;
}

async function collectEntries(fullPath, name, output) {
  const stat = await fs.lstat(fullPath);
  if (stat.isSymbolicLink()) throw new Error(`Symbolic links are not supported in release ZIPs: ${fullPath}`);

  if (stat.isDirectory()) {
    output.push({
      name: archiveName(name, true),
      directory: true,
      data: Buffer.alloc(0),
      mode: stat.mode,
      mtime: stat.mtime,
    });
    const children = (await fs.readdir(fullPath, { withFileTypes: true }))
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const child of children) {
      await collectEntries(path.join(fullPath, child.name), path.join(name, child.name), output);
    }
    return;
  }

  if (!stat.isFile()) throw new Error(`Unsupported release ZIP entry: ${fullPath}`);
  output.push({
    name: archiveName(name),
    directory: false,
    data: await fs.readFile(fullPath),
    mode: stat.mode,
    mtime: stat.mtime,
  });
}

function encodeEntry(entry, offset, level) {
  const name = Buffer.from(entry.name, 'utf8');
  const source = entry.data;
  const compressedCandidate = entry.directory || source.length === 0
    ? source
    : deflateRawSync(source, { level });
  const compressed = compressedCandidate.length < source.length ? compressedCandidate : source;
  const method = compressed === source ? 0 : 8;
  const checksum = crc32(source);
  const stamp = dosDateTime(entry.mtime);
  const flags = 0x0800;

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(flags, 6);
  localHeader.writeUInt16LE(method, 8);
  localHeader.writeUInt16LE(stamp.time, 10);
  localHeader.writeUInt16LE(stamp.date, 12);
  localHeader.writeUInt32LE(checksum, 14);
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(source.length, 22);
  localHeader.writeUInt16LE(name.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(0x0314, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(flags, 8);
  centralHeader.writeUInt16LE(method, 10);
  centralHeader.writeUInt16LE(stamp.time, 12);
  centralHeader.writeUInt16LE(stamp.date, 14);
  centralHeader.writeUInt32LE(checksum, 16);
  centralHeader.writeUInt32LE(compressed.length, 20);
  centralHeader.writeUInt32LE(source.length, 24);
  centralHeader.writeUInt16LE(name.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  const externalAttributes = ((((entry.mode || 0o100644) & 0xffff) << 16) | (entry.directory ? 0x10 : 0)) >>> 0;
  centralHeader.writeUInt32LE(externalAttributes, 38);
  centralHeader.writeUInt32LE(offset, 42);

  return {
    local: Buffer.concat([localHeader, name, compressed]),
    central: Buffer.concat([centralHeader, name]),
  };
}

export async function createZipArchive(archivePath, sourceDir, entryName, options = {}) {
  const level = Number.isInteger(options.level) ? Math.max(0, Math.min(9, options.level)) : 9;
  const root = path.resolve(sourceDir, entryName);
  const entries = [];
  await collectEntries(root, entryName, entries);
  if (entries.length > 0xffff) throw new Error(`ZIP entry count exceeds the classic ZIP limit: ${entries.length}`);

  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const entry of entries) {
    const encoded = encodeEntry(entry, offset, level);
    localParts.push(encoded.local);
    centralParts.push(encoded.central);
    offset += encoded.local.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  await fs.mkdir(path.dirname(path.resolve(archivePath)), { recursive: true });
  await fs.writeFile(archivePath, Buffer.concat([...localParts, centralDirectory, end]));
  return { archivePath: path.resolve(archivePath), entries: entries.length };
}

function parseArguments(argv) {
  const positional = [];
  let level = 9;
  for (const argument of argv) {
    if (argument === '-q' || argument === '-r') continue;
    if (/^-[0-9]$/.test(argument)) {
      level = Number(argument.slice(1));
      continue;
    }
    if (argument.startsWith('-')) throw new Error(`Unsupported portable ZIP option: ${argument}`);
    positional.push(argument);
  }
  if (positional.length !== 2) {
    throw new Error('Usage: portable-zip.mjs [-q] -r [-0..-9] ARCHIVE ENTRY');
  }
  return { archivePath: positional[0], entryName: positional[1], level };
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath === fileURLToPath(import.meta.url)) {
  try {
    const { archivePath, entryName, level } = parseArguments(process.argv.slice(2));
    await createZipArchive(archivePath, process.cwd(), entryName, { level });
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
