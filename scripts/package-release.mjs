#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), '..');
const packageJson = JSON.parse(
  await fs.readFile(path.join(repoRoot, 'package.json'), 'utf8'),
);

const version = packageJson.version;
const tag = `v${version}`;
const releaseDir = path.join(repoRoot, 'release');
const workDir = path.join(releaseDir, '.work');
const packageDir = path.join(workDir, 'grid-map-builder');
const portableZip = path.join(releaseDir, `grid-map-builder-portable-${tag}.zip`);
const updateTgz = path.join(releaseDir, `grid-map-builder-update-${tag}.tgz`);
const checksumsPath = path.join(releaseDir, 'checksums.txt');
const crcTable = createCrcTable();

await fs.rm(releaseDir, { recursive: true, force: true });
await fs.mkdir(packageDir, { recursive: true });

await copyDir(path.join(repoRoot, 'dist'), path.join(packageDir, 'app'));
await copyDir(path.join(repoRoot, 'portable'), path.join(packageDir, 'portable'));

await copyFileWithMode(
  path.join(repoRoot, 'launchers', 'start.sh'),
  path.join(packageDir, 'start.sh'),
  0o755,
);
await copyFileWithMode(
  path.join(repoRoot, 'launchers', 'start.command'),
  path.join(packageDir, 'start.command'),
  0o755,
);
await copyFileWithMode(
  path.join(repoRoot, 'launchers', 'start.bat'),
  path.join(packageDir, 'start.bat'),
  0o644,
);
await copyFileWithMode(
  path.join(repoRoot, 'LICENSE'),
  path.join(packageDir, 'LICENSE'),
  0o644,
);

await fs.writeFile(
  path.join(packageDir, 'package.json'),
  `${JSON.stringify(
    {
      name: packageJson.name,
      version,
      private: true,
      type: 'module',
      license: packageJson.license,
      repository: packageJson.repository,
      engines: packageJson.engines,
      scripts: {
        start: 'node portable/server.mjs',
      },
    },
    null,
    2,
  )}\n`,
);

await fs.writeFile(
  path.join(packageDir, 'release-manifest.json'),
  `${JSON.stringify(
    {
      name: packageJson.name,
      version,
      tag,
      repository: packageJson.repository?.url?.replace(/^git\+/, '') ?? '',
      fixedOrigin: 'http://127.0.0.1:58137',
      releasedAt: new Date().toISOString(),
    },
    null,
    2,
  )}\n`,
);

await fs.writeFile(
  path.join(packageDir, 'README.txt'),
  [
    `Grid Map Builder ${tag}`,
    '',
    'Quick start:',
    '- Terminal: npm run start',
    '- macOS: double-click start.command',
    '- Windows: double-click start.bat',
    '- Linux: run ./start.sh from a terminal',
    '',
    'This portable package requires Node.js 20 or newer.',
    'Install it from https://nodejs.org/ if the start script says node is missing.',
    '',
    'The app opens at http://127.0.0.1:58137.',
    'Keep that address the same between versions so browser-stored projects stay available.',
    '',
    'Updates:',
    '- Use the update button in the app when a newer GitHub release is available.',
    '- You can also unzip a newer portable package over this folder.',
    '- Project data is stored in your browser IndexedDB for 127.0.0.1:58137, not in this package folder.',
    '',
  ].join('\n'),
);

await createZip({
  sourceDir: packageDir,
  zipPath: portableZip,
  rootName: 'grid-map-builder',
});
await run('tar', ['-czf', updateTgz, '-C', packageDir, '.']);

const checksums = [
  `${await sha256File(portableZip)}  ${path.basename(portableZip)}`,
  `${await sha256File(updateTgz)}  ${path.basename(updateTgz)}`,
];
await fs.writeFile(checksumsPath, `${checksums.join('\n')}\n`);

console.log(`Wrote ${path.relative(repoRoot, portableZip)}`);
console.log(`Wrote ${path.relative(repoRoot, updateTgz)}`);
console.log(`Wrote ${path.relative(repoRoot, checksumsPath)}`);

async function copyFileWithMode(from, to, mode) {
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.copyFile(from, to);
  await fs.chmod(to, mode);
}

async function copyDir(from, to) {
  await fs.mkdir(to, { recursive: true });
  const entries = await fs.readdir(from, { withFileTypes: true });
  for (const entry of entries) {
    const source = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyDir(source, dest);
    } else if (entry.isFile()) {
      await copyFileWithMode(source, dest, (await fs.stat(source)).mode);
    }
  }
}

async function createZip({ sourceDir, zipPath, rootName }) {
  const files = await listFiles(sourceDir);
  const chunks = [];
  const central = [];
  let offset = 0;
  const date = new Date();
  const { dosTime, dosDate } = toDosDateTime(date);

  for (const file of files) {
    const relative = file.relative.split(path.sep).join('/');
    const zipName = `${rootName}/${relative}`;
    const nameBuffer = Buffer.from(zipName);
    const data = await fs.readFile(file.absolute);
    const crc = crc32(data);
    const mode = (file.mode & 0o777) || 0o644;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBuffer.length, 26);
    local.writeUInt16LE(0, 28);

    chunks.push(local, nameBuffer, data);

    const headerOffset = offset;
    offset += local.length + nameBuffer.length + data.length;

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE((3 << 8) | 20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0, 8);
    cd.writeUInt16LE(0, 10);
    cd.writeUInt16LE(dosTime, 12);
    cd.writeUInt16LE(dosDate, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(data.length, 24);
    cd.writeUInt16LE(nameBuffer.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(((mode | 0o100000) << 16) >>> 0, 38);
    cd.writeUInt32LE(headerOffset, 42);
    central.push(cd, nameBuffer);
  }

  const centralStart = offset;
  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20);

  await fs.mkdir(path.dirname(zipPath), { recursive: true });
  await fs.writeFile(zipPath, Buffer.concat([...chunks, ...central, end]));
}

async function listFiles(dir, base = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(absolute, base));
    } else if (entry.isFile()) {
      const stat = await fs.stat(absolute);
      files.push({
        absolute,
        relative: path.relative(base, absolute),
        mode: stat.mode,
      });
    }
  }
  return files.sort((a, b) => a.relative.localeCompare(b.relative));
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

async function sha256File(filePath) {
  const hash = createHash('sha256');
  await new Promise((resolve, reject) => {
    createReadStream(filePath)
      .on('data', (chunk) => hash.update(chunk))
      .on('error', reject)
      .on('end', resolve);
  });
  return hash.digest('hex');
}

function toDosDateTime(date) {
  return {
    dosTime:
      (date.getHours() << 11) |
      (date.getMinutes() << 5) |
      Math.floor(date.getSeconds() / 2),
    dosDate:
      ((date.getFullYear() - 1980) << 9) |
      ((date.getMonth() + 1) << 5) |
      date.getDate(),
  };
}

function createCrcTable() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
