import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { access, cp, mkdir, mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises';
import net from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { setTimeout as wait } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const [packageDirectory] = process.argv.slice(2);
assert(packageDirectory, 'Usage: node backup-smoke.mjs <extracted package root>');
const source = path.resolve(packageDirectory);
const launcher = process.platform === 'win32' ? 'Start Token Pulse.cmd' : '打开我的算力看板.command';
await access(path.join(source, launcher));

async function reservePort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const { port } = listener.address();
  await new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
  return port;
}

const fixture = await mkdtemp(path.join(tmpdir(), 'pulse-release-smoke-'));
const profile = path.join(fixture, 'isolated-profile');
const workspace = path.join(fixture, 'workspace');
const packageRoot = path.join(workspace, 'Token Pulse');
const project = path.join(workspace, 'Fixture Project');
const archives = path.join(packageRoot, '备份');
const codexHome = path.join(profile, '.codex');
const preload = path.join(fixture, 'isolated-profile.mjs');
const serverLogs = [];
let child;
let childExit;

try {
  await mkdir(packageRoot, { recursive: true });
  const packageApp = path.join(source, 'app');
  await cp(packageApp, path.join(packageRoot, 'app'), {
    recursive: true,
    filter: candidate => !path.relative(packageApp, candidate).split(path.sep)
      .some(part => part.startsWith('.') || part === 'node_modules'),
  });
  await mkdir(project);
  const attachment = Buffer.from('Synthetic screenshot fixture\n'.repeat(4000), 'utf8');
  await writeFile(path.join(project, '截图.png'), attachment);
  await mkdir(path.join(codexHome, 'sessions'), { recursive: true });

  // Do not consult the tester's profile or shell environment for any data sources.
  await writeFile(preload, [
    "import os from 'node:os';",
    "import { syncBuiltinESMExports } from 'node:module';",
    "os.homedir = () => process.env.TOKEN_PULSE_TEST_PROFILE;",
    'syncBuiltinESMExports();',
  ].join('\n'));
  const stamp = new Date().toISOString();
  const transcript = 'Synthetic conversation for cross-platform restore';
  const rows = [
    { timestamp: stamp, type: 'session_meta', payload: { id: 'smoke-session', cwd: project } },
    { timestamp: stamp, type: 'turn_context', payload: { turn_id: 'smoke-turn', model: 'smoke-model', effort: 'high' } },
    { timestamp: stamp, type: 'token_usage_record', payload: {
      session_id: 'smoke-session', turn_id: 'smoke-turn', response_id: 'smoke-response',
      usage: { total_tokens: 1200, input_tokens: 1000, output_tokens: 200, cached_input_tokens: 150 },
    } },
    { timestamp: stamp, type: 'response_item', payload: {
      type: 'message', role: 'user', content: [{ type: 'input_text', text: transcript }],
    } },
    { timestamp: stamp, type: 'response_item', payload: {
      type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Synthetic response' }],
    } },
  ];
  await writeFile(path.join(codexHome, 'sessions', 'rollout-smoke.jsonl'),
    rows.map(row => JSON.stringify(row)).join('\n') + '\n');

  const port = await reservePort();
  const base = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['--import', pathToFileURL(preload).href, 'app/server.mjs'], {
    cwd: packageRoot,
    env: { ...process.env, CODEX_HOME: codexHome, CLAUDE_CONFIG_DIR: path.join(profile, '.claude'),
      TOKEN_PULSE_WORKBUDDY_DIR: path.join(profile, '.workbuddy'),
      APPDATA: path.join(profile, 'AppData', 'Roaming'), LOCALAPPDATA: path.join(profile, 'AppData', 'Local'),
      TOKEN_PULSE_TEST_PROFILE: profile, COMPUTE_DASHBOARD_PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  childExit = new Promise(resolve => {
    child.once('close', resolve);
    child.once('error', () => resolve(-1));
  });
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', value => {
      serverLogs.push(value.toString());
      if (serverLogs.length > 8) serverLogs.shift();
    });
  }

  async function request(endpoint, { method = 'GET', body, raw, headers = {}, expected = 200 } = {}) {
    const reply = await fetch(base + endpoint, {
      method, headers: body === undefined ? headers : { ...headers, 'Content-Type': 'application/json' },
      body: body === undefined ? raw : JSON.stringify(body), signal: AbortSignal.timeout(10000),
    });
    if (reply.status !== expected) {
      let message = '';
      try { message = (await reply.json()).error || ''; } catch {}
      assert.fail(`${method} ${endpoint.split('?')[0]} returned ${reply.status}, expected ${expected}. ${message}`);
    }
    return reply.json();
  }
  const api = (endpoint, options) => request('/api/backup/' + endpoint, options);
  const post = (endpoint, body, expected = 200) => api(endpoint, { method: 'POST', body, expected });

  let dashboard;
  for (let retry = 0; retry < 200; retry++) {
    if (child.exitCode !== null || child.signalCode) assert.fail('Packaged local server exited before startup');
    try {
      await request('/api/health');
      dashboard = await request('/api/dashboard?range=30');
    } catch (error) {
      if (!(error instanceof TypeError)) throw error;
    }
    if (dashboard?.complete) break;
    await wait(100);
  }
  assert(dashboard?.complete, 'Synthetic user collection did not complete');
  assert.equal(dashboard.totals.total, 1200);
  assert(dashboard.models.some(model => model.name === 'smoke-model' && model.total === 1200));

  async function completeJob(selection) {
    const { jobId } = await post('start', selection, 202);
    for (let retry = 0; retry < 200; retry++) {
      const job = await api('status?jobId=' + encodeURIComponent(jobId));
      if (job.state !== 'running') {
        assert.equal(job.state, 'complete', job.message);
        return job.fileName;
      }
      await wait(50);
    }
    assert.fail('Synthetic backup did not complete');
  }

  async function reimport(name) {
    const original = path.join(archives, name);
    const raw = await readFile(original);
    await unlink(original);
    const result = await api('import', { method: 'POST', raw, headers: {
      'Content-Type': 'application/octet-stream', 'X-Backup-Name': encodeURIComponent(name),
    } });
    assert.equal(result.alreadyPresent, false);
    assert(result.backup?.name, 'The import response did not identify the new backup');
    return result.backup.name;
  }

  const lightweight = await post('lightestimate', {});
  const selected = lightweight.projects.find(item => item.total === 1200);
  assert(selected, 'No lightweight project with synthetic usage');
  const lightName = await reimport(await completeJob({
    mode: 'light', scanId: lightweight.scanId, projects: [selected.id], encrypted: false,
  }));
  const light = await post('view', { name: lightName });
  assert.equal(light.manifest.mode, 'light');
  assert.equal(light.manifest.encrypted, false);
  assert.equal(light.manifest.usage.projects[0].total, 1200);
  assert.deepEqual(light.conversations, []);

  const full = await post('estimate', {});
  assert.equal(full.sources.find(item => item.id === 'codex')?.sessionCount, 1);
  const screenshot = full.files.find(file => file.name === '截图.png');
  assert(screenshot, 'The synthetic attachment was omitted from the file list');
  const fullSelection = { mode: 'full', scanId: full.scanId, sources: ['codex'], files: [screenshot.id] };
  const fullName = await reimport(await completeJob({ ...fullSelection, encrypted: false }));
  const verified = await post('view', { name: fullName });
  assert.equal(verified.manifest.mode, 'full');
  assert.equal(verified.manifest.encrypted, false);
  assert(verified.conversations.some(thread => thread.messages.some(message => message.text === transcript)));
  const restored = await post('restorefile', { name: fullName, fileId: screenshot.id });
  assert.match(restored.location, /^恢复文件\/[a-f0-9-]+\/[^/]+$/);
  assert.deepEqual(await readFile(path.join(archives, restored.location)), attachment);

  const passphrase = 'synthetic-release-smoke-password';
  const encryptedName = await reimport(await completeJob({ ...fullSelection, encrypted: true, passphrase }));
  await post('view', { name: encryptedName, passphrase: 'invalid-passphrase' }, 422);
  const encrypted = await post('view', { name: encryptedName, passphrase });
  assert.equal(encrypted.manifest.encrypted, true);
  assert(encrypted.conversations.some(thread => thread.messages.some(message => message.text === transcript)));

  console.log(`${process.platform}: launch, usage, lightweight backup, full backup, reimport, restore, and encrypted import passed`);
} catch (error) {
  if (serverLogs.length) console.error(serverLogs.join('').replaceAll(fixture, '<test-fixture>').trim());
  throw error;
} finally {
  if (child && child.exitCode === null && !child.signalCode) child.kill();
  if (childExit) await childExit;
  await rm(fixture, { recursive: true, force: true });
}
