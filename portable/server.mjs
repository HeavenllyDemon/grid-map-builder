#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { createReadStream, promises as fs } from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const HOST = '127.0.0.1';
const PORT = 58137;
const REPO_OWNER = 'HeavenllyDemon';
const REPO_NAME = 'grid-map-builder';
const UPDATE_ASSET_PREFIX = 'grid-map-builder-update-';
const STATE_DIR = '.grid-map-builder';
const DEFAULT_BROWSER_OPEN = `http://${HOST}:${PORT}`;

const __filename = fileURLToPath(import.meta.url);
const packageRoot = path.resolve(path.dirname(__filename), '..');
const appDir = await firstExistingDir([
  path.join(packageRoot, 'app'),
  path.join(packageRoot, 'dist'),
]);
const stateDir = path.join(packageRoot, STATE_DIR);
const updateDir = path.join(stateDir, 'updates');
const manifestPath = path.join(packageRoot, 'release-manifest.json');
const packageJsonPath = path.join(packageRoot, 'package.json');
const currentVersion = await readCurrentVersion();

const applyIndex = process.argv.indexOf('--apply-update');
if (applyIndex !== -1) {
  const stagedPath = process.argv[applyIndex + 1];
  const parentPid = Number(process.argv[process.argv.indexOf('--parent-pid') + 1]);
  await applyStagedUpdate(stagedPath, parentPid);
  process.exit(0);
}

if (Number(process.versions.node.split('.')[0]) < 20) {
  console.error('Grid Map Builder requires Node.js 20 or newer.');
  console.error('Install Node.js from https://nodejs.org/ and run this again.');
  process.exit(1);
}

if (!appDir) {
  console.error('Could not find the app build. Expected ./app or ./dist.');
  console.error('For source builds, run `npm run build` before starting the portable server.');
  process.exit(1);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(res, url.pathname);
  } catch (err) {
    console.error(err);
    sendJson(res, 500, {
      ok: false,
      error: err instanceof Error ? err.message : 'Unknown server error',
    });
  }
});

server.listen(PORT, HOST, () => {
  const appUrl = `http://${HOST}:${PORT}`;
  console.log(`Grid Map Builder is running at ${appUrl}`);
  console.log('Keep this window open while you use the app.');
  if (process.env.GRID_MAP_BUILDER_OPEN === '1') {
    openBrowser(appUrl);
  }
});

server.on('error', (err) => {
  if (err && err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
    console.error(`Open ${DEFAULT_BROWSER_OPEN} if Grid Map Builder is already running.`);
    console.error('The package uses a fixed port so your browser data stays attached to the same local address.');
    process.exit(1);
  }
  throw err;
});

async function handleApi(req, res, url) {
  if (req.method === 'GET' && url.pathname === '/api/version') {
    sendJson(res, 200, {
      ok: true,
      app: 'grid-map-builder',
      currentVersion,
      updateSupported: true,
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/update/check') {
    const latest = await getLatestRelease();
    const asset = findUpdateAsset(latest);
    sendJson(res, 200, {
      ok: true,
      currentVersion,
      latestVersion: normalizeVersion(latest.tag_name),
      updateAvailable: isNewerVersion(latest.tag_name, currentVersion),
      releaseUrl: latest.html_url,
      assetName: asset?.name ?? null,
      canDownload: Boolean(asset),
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/update/download') {
    const latest = await getLatestRelease();
    const asset = findUpdateAsset(latest);
    if (!asset) {
      sendJson(res, 404, {
        ok: false,
        error: 'No portable update asset found on the latest GitHub release.',
      });
      return;
    }
    if (!isNewerVersion(latest.tag_name, currentVersion)) {
      sendJson(res, 200, {
        ok: true,
        currentVersion,
        stagedVersion: normalizeVersion(latest.tag_name),
        updateAvailable: false,
        restartRequired: false,
      });
      return;
    }
    const stagedPath = await downloadAndStageUpdate(latest, asset);
    sendJson(res, 200, {
      ok: true,
      currentVersion,
      stagedVersion: normalizeVersion(latest.tag_name),
      stagedPath,
      restartRequired: true,
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/update/restart') {
    const stagedPath = await readLatestStagedUpdate();
    if (!stagedPath) {
      sendJson(res, 400, {
        ok: false,
        error: 'No staged update found. Download the update first.',
      });
      return;
    }
    sendJson(res, 200, {
      ok: true,
      message: 'Restarting to apply update.',
    });
    setTimeout(() => restartWithUpdate(stagedPath), 250);
    return;
  }

  sendJson(res, 404, {
    ok: false,
    error: 'Unknown API route.',
  });
}

async function serveStatic(res, requestPath) {
  const normalized = decodeURIComponent(requestPath.split('?')[0]);
  const safePath = normalized === '/' ? '/index.html' : normalized;
  const absolute = path.resolve(appDir, `.${safePath}`);
  if (!absolute.startsWith(appDir)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const filePath = await fileOrIndex(absolute);
  if (!filePath) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const data = await fs.readFile(filePath);
  res.writeHead(200, {
    'Content-Type': contentType(filePath),
    'Cache-Control': filePath.endsWith('index.html')
      ? 'no-cache'
      : 'public, max-age=31536000, immutable',
  });
  res.end(data);
}

async function fileOrIndex(absolute) {
  try {
    const stat = await fs.stat(absolute);
    if (stat.isFile()) return absolute;
  } catch {
    // fall through
  }
  return path.join(appDir, 'index.html');
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-cache',
  });
  res.end(JSON.stringify(body));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, {
        headers: {
          'Accept': 'application/vnd.github+json',
          'User-Agent': 'grid-map-builder-updater',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`GitHub request failed with status ${res.statusCode}: ${body}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

async function getLatestRelease() {
  const latest = await getJson(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/releases/latest`,
  );
  if (latest.draft || latest.prerelease) {
    throw new Error('The latest GitHub release is not a stable public release.');
  }
  return latest;
}

function findUpdateAsset(release) {
  return release.assets?.find((asset) =>
    asset.name.startsWith(UPDATE_ASSET_PREFIX) && asset.name.endsWith('.tgz'),
  );
}

async function downloadAndStageUpdate(release, asset) {
  const version = normalizeVersion(release.tag_name);
  const safeVersion = `v${version}`.replace(/[^a-zA-Z0-9._-]/g, '-');
  const stagedRoot = path.join(updateDir, safeVersion);
  const archivePath = path.join(stagedRoot, asset.name);
  const extractDir = path.join(stagedRoot, 'package');

  await fs.rm(stagedRoot, { recursive: true, force: true });
  await fs.mkdir(extractDir, { recursive: true });
  await downloadFile(asset.browser_download_url, archivePath);

  const expected = await findExpectedChecksum(release, asset.name);
  if (expected) {
    const actual = await sha256File(archivePath);
    if (actual !== expected) {
      throw new Error(`Update checksum mismatch for ${asset.name}.`);
    }
  }

  await run('tar', ['-xzf', archivePath, '-C', extractDir]);
  await fs.writeFile(
    path.join(updateDir, 'latest.json'),
    JSON.stringify({ stagedPath: extractDir, version, assetName: asset.name }, null, 2),
  );
  return extractDir;
}

async function findExpectedChecksum(release, assetName) {
  const checksums = release.assets?.find((asset) => asset.name === 'checksums.txt');
  if (!checksums) return null;
  const tmpPath = path.join(updateDir, 'checksums.txt');
  await fs.mkdir(updateDir, { recursive: true });
  await downloadFile(checksums.browser_download_url, tmpPath);
  const text = await fs.readFile(tmpPath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const [hash, name] = line.trim().split(/\s+/);
    if (name === assetName && /^[a-f0-9]{64}$/i.test(hash)) return hash.toLowerCase();
  }
  return null;
}

async function downloadFile(url, destination) {
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await new Promise((resolve, reject) => {
    const request = https.get(url, {
      headers: { 'User-Agent': 'grid-map-builder-updater' },
    }, (res) => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        downloadFile(res.headers.location, destination).then(resolve, reject);
        return;
      }
      if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
        reject(new Error(`Download failed with status ${res.statusCode}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', async () => {
        try {
          await fs.writeFile(destination, Buffer.concat(chunks));
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
    request.on('error', reject);
  });
}

async function readLatestStagedUpdate() {
  try {
    const row = JSON.parse(await fs.readFile(path.join(updateDir, 'latest.json'), 'utf8'));
    if (row?.stagedPath) return row.stagedPath;
  } catch {
    return null;
  }
  return null;
}

function restartWithUpdate(stagedPath) {
  const child = spawn(process.execPath, [
    __filename,
    '--apply-update',
    stagedPath,
    '--parent-pid',
    String(process.pid),
  ], {
    cwd: packageRoot,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, GRID_MAP_BUILDER_OPEN: '1' },
  });
  child.unref();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 750);
}

async function applyStagedUpdate(stagedPath, parentPid) {
  if (!stagedPath) throw new Error('Missing staged update path.');
  await waitForProcessExit(parentPid);
  const resolvedStage = path.resolve(stagedPath);
  const stat = await fs.stat(resolvedStage);
  if (!stat.isDirectory()) throw new Error('Staged update is not a directory.');

  await fs.rm(path.join(packageRoot, 'app'), { recursive: true, force: true });
  await copyDir(resolvedStage, packageRoot);
  await fs.rm(updateDir, { recursive: true, force: true });

  const child = spawn(process.execPath, [path.join(packageRoot, 'portable', 'server.mjs')], {
    cwd: packageRoot,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, GRID_MAP_BUILDER_OPEN: '1' },
  });
  child.unref();
}

async function copyDir(from, to) {
  await fs.mkdir(to, { recursive: true });
  const entries = await fs.readdir(from, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === STATE_DIR) continue;
    const source = path.join(from, entry.name);
    const dest = path.join(to, entry.name);
    if (entry.isDirectory()) {
      await copyDir(source, dest);
    } else if (entry.isFile()) {
      await fs.copyFile(source, dest);
      const mode = await fs.stat(source).then((s) => s.mode).catch(() => null);
      if (mode !== null) await fs.chmod(dest, mode);
    }
  }
}

async function waitForProcessExit(pid) {
  if (!pid || Number.isNaN(pid)) return;
  for (let i = 0; i < 80; i += 1) {
    try {
      process.kill(pid, 0);
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch {
      return;
    }
  }
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

function normalizeVersion(tagOrVersion) {
  return String(tagOrVersion ?? '0.0.0').replace(/^v/i, '');
}

function isNewerVersion(candidate, current) {
  const a = normalizeVersion(candidate).split(/[.-]/).map(Number);
  const b = normalizeVersion(current).split(/[.-]/).map(Number);
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    const av = Number.isFinite(a[i]) ? a[i] : 0;
    const bv = Number.isFinite(b[i]) ? b[i] : 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return false;
}

async function readCurrentVersion() {
  for (const file of [manifestPath, packageJsonPath]) {
    try {
      const data = JSON.parse(await fs.readFile(file, 'utf8'));
      if (data.version) return normalizeVersion(data.version);
    } catch {
      // try next
    }
  }
  return '0.0.0';
}

async function firstExistingDir(paths) {
  for (const candidate of paths) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) return candidate;
    } catch {
      // try next
    }
  }
  return null;
}

function openBrowser(url) {
  const platform = process.platform;
  const command = platform === 'darwin'
    ? 'open'
    : platform === 'win32'
      ? 'cmd'
      : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

function contentType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.json': 'application/json; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.wasm': 'application/wasm',
  }[ext] ?? 'application/octet-stream';
}
