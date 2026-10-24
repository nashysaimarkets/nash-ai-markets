/** Data-only return path for one run-bound encrypted first-six input.
 * Only the deterministic run ref may be polled. Its first observed commit is
 * immutable for this receiver; no second envelope or alternative source exists.
 * This adapter never decrypts, executes, writes, logs or retries provider work.
 */
import {setTimeout as delay} from 'node:timers/promises';

const REPOSITORY = 'nashysaimarkets/nash-ai-markets';
const API = `https://api.github.com/repos/${REPOSITORY}`;
const MAX_REF_BYTES = 16384;
const MAX_ENVELOPE_BYTES = Math.ceil(64 * 1024 * 1024 * 1.4 + 4096);
export const RELAY_MAX_POLLS = 30;
export const RELAY_POLL_INTERVAL_MS = 10000;
const requireValue = condition => {if (!condition) throw Error('GITHUB_INPUT_RELAY_REFUSED');};
const isSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const isDigest = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);

function abortable(promise, signal) {
  return new Promise((resolve,reject) => {
    const abort = () => {cleanup(); reject(Error('GITHUB_INPUT_RELAY_REFUSED'));};
    const cleanup = () => signal.removeEventListener('abort',abort);
    if (signal.aborted) abort();
    else signal.addEventListener('abort',abort,{once:true});
    Promise.resolve(promise).then(value => {cleanup(); resolve(value);},error => {cleanup(); reject(error);});
  });
}

function cancelBody(response) {
  try { Promise.resolve(response?.body?.cancel()).catch(() => {}); } catch { /* No response contents are logged. */ }
}

function validateResponse(response, expectedUrl, raw) {
  requireValue(response?.url === expectedUrl && response.redirected === false
    && typeof response.headers?.get === 'function');
  const requestId = response.headers.get('x-github-request-id');
  const encoding = response.headers.get('content-encoding');
  const type = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase();
  const media = response.headers.get('x-github-media-type');
  requireValue(typeof requestId === 'string' && /^[A-Za-z0-9:-]{1,128}$/.test(requestId)
    && (encoding === null || encoding.toLowerCase() === 'identity'));
  if (raw) {
    requireValue(['application/octet-stream','application/json','text/plain','application/vnd.github.raw+json'].includes(type)
      && (media === null || /(?:^|;)\s*(?:param|format)=raw\s*(?:;|$)/i.test(media)));
  } else {
    requireValue(['application/json','application/vnd.github+json'].includes(type)
      && (media === null || /(?:^|;)\s*format=json\s*(?:;|$)/i.test(media)));
  }
}

async function readBounded(response, maximum, signal, assertDeadline) {
  let reader;
  try {
    const length = response.headers.get('content-length');
    requireValue(length === null || /^(0|[1-9][0-9]*)$/.test(length));
    const declared = length === null ? null : Number(length);
    requireValue(declared === null || Number.isSafeInteger(declared) && declared > 0 && declared <= maximum);
    requireValue(typeof response.body?.getReader === 'function');
    reader = response.body.getReader();
    const chunks = []; let size = 0;
    for (;;) {
      assertDeadline();
      const next = await abortable(reader.read(),signal);
      assertDeadline();
      if (next.done) break;
      requireValue(next.value instanceof Uint8Array);
      size += next.value.length;
      requireValue(size <= maximum);
      chunks.push(Buffer.from(next.value));
    }
    requireValue(size > 0 && (declared === null || declared === size));
    return Buffer.concat(chunks,size);
  } finally {
    if (reader) {try {Promise.resolve(reader.cancel()).catch(() => {});} catch { /* Discard only. */ }}
    else cancelBody(response);
  }
}

/** The token is only sent to the fixed api.github.com repository endpoint.
 * Injection is restricted to explicit offline tests; production uses native
 * fetch, a monotonic clock and abortable ten-second waits.
 */
export function createGitHubEnvelopeReceiver({token}, {
  fetchImpl = globalThis.fetch,
  sleepImpl = (ms,signal) => delay(ms,undefined,{signal}),
  now = () => performance.now()
} = {}) {
  requireValue(typeof token === 'string' && token.length > 0 && token.length <= 1024
    && !/[\s\x00-\x1f\x7f]/.test(token)
    && [fetchImpl,sleepImpl,now].every(fn => typeof fn === 'function'));
  let consumed = false;
  return async ({run,publicHandoff,expectedBundleSha256,timeoutMs,maxEnvelopeBytes,signal}) => {
    let timer, stop;
    const controller = new AbortController();
    try {
      requireValue(!consumed); consumed = true;
      requireValue(run?.repository === REPOSITORY && run.runAttempt === '1'
        && typeof run.runId === 'string' && /^[1-9][0-9]{0,19}$/.test(run.runId) && isSha(run.sourceSha)
        && isDigest(expectedBundleSha256)
        && publicHandoff?.kind === 'MONACO_FIRST_SIX_INPUT_HANDOFF_V1'
        && publicHandoff.bundleSha256 === expectedBundleSha256
        && ['repository','runId','runAttempt','sourceSha'].every(key => publicHandoff[key] === run[key])
        && Number.isSafeInteger(timeoutMs) && timeoutMs > 0 && timeoutMs <= 300000
        && Number.isSafeInteger(maxEnvelopeBytes) && maxEnvelopeBytes > 0 && maxEnvelopeBytes <= MAX_ENVELOPE_BYTES
        && typeof signal?.addEventListener === 'function' && !signal.aborted);
      const started = now(); requireValue(Number.isFinite(started));
      const deadline = started + timeoutMs;
      const assertDeadline = () => requireValue(!controller.signal.aborted && now() < deadline);
      stop = () => controller.abort();
      signal.addEventListener('abort',stop,{once:true});
      if (signal.aborted) stop();
      timer = setTimeout(stop,timeoutMs);
      const branch = `monaco-first-six-input-${run.runId}`;
      const refUrl = `${API}/git/ref/heads/${branch}`;
      const headers = {Authorization:`Bearer ${token}`,'X-GitHub-Api-Version':'2022-11-28',
        'User-Agent':'pocket-monaco-first-six-input','Accept-Encoding':'identity'};
      const request = async (url,raw) => {
        assertDeadline();
        let response;
        try {
          response = await abortable(fetchImpl(url,{method:'GET',redirect:'error',cache:'no-store',
            headers:{...headers,Accept:raw ? 'application/vnd.github.raw+json' : 'application/vnd.github+json'},
            signal:controller.signal}),controller.signal);
          assertDeadline(); validateResponse(response,url,raw);
          return response;
        } catch {cancelBody(response); throw Error('GITHUB_INPUT_RELAY_REFUSED');}
      };
      for (let poll = 0; poll < RELAY_MAX_POLLS; poll += 1) {
        const response = await request(refUrl,false);
        if (response.status === 404) {
          cancelBody(response);
          requireValue(poll + 1 < RELAY_MAX_POLLS && deadline - now() > RELAY_POLL_INTERVAL_MS);
          await abortable(sleepImpl(RELAY_POLL_INTERVAL_MS,controller.signal),controller.signal);
          continue;
        }
        if (response.status !== 200) {cancelBody(response); throw Error('GITHUB_INPUT_RELAY_REFUSED');}
        const reference = JSON.parse((await readBounded(response,MAX_REF_BYTES,controller.signal,assertDeadline)).toString('utf8'));
        requireValue(reference?.ref === `refs/heads/${branch}`
          && reference.url === `${API}/git/refs/heads/${branch}`
          && reference.object?.type === 'commit' && isSha(reference.object.sha)
          && reference.object.url === `${API}/git/commits/${reference.object.sha}`);
        // The branch is never consulted again. This URL is bound to its first
        // immutable commit, and only this one fixed data file can be returned.
        const contentUrl = `${API}/contents/input.envelope.json?ref=${reference.object.sha}`;
        const content = await request(contentUrl,true);
        if (content.status !== 200) {cancelBody(content); throw Error('GITHUB_INPUT_RELAY_REFUSED');}
        return await readBounded(content,maxEnvelopeBytes,controller.signal,assertDeadline);
      }
      throw Error('GITHUB_INPUT_RELAY_REFUSED');
    } catch {throw Error('GITHUB_INPUT_RELAY_REFUSED');}
    finally {
      clearTimeout(timer);
      if (stop) signal.removeEventListener('abort',stop);
      controller.abort();
    }
  };
}
