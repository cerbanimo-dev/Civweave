// The Civweave Android Device Host runs a *loopback-only*, opt-in status API.
// This is not a general-purpose command shell or a native installation endpoint.
import {HOST_PACKAGE} from './device-host-updates.mjs';
export const HOST_API_ORIGIN = 'http://127.0.0.1:8792';
const PAIR_SCHEMA = 'civweave.device-host-pair.v1';
const STATUS_SCHEMA = 'civweave.device-host-status.v1';
const codePattern = /^[A-Z2-7]{10}$/;
const tokenPattern = /^[A-Za-z0-9_-]{32,128}$/;

function assertResponse(response, expectedUrl) {
  if (!response?.ok || response.url !== expectedUrl) throw Error('The local host did not return a trusted response.');
}

export async function pairHost(code, fetcher=fetch) {
  const normalized = String(code || '').trim().toUpperCase().replace(/[\s-]/g,'');
  if (!codePattern.test(normalized)) throw Error('Enter the ten-character code shown by the Android Host.');
  const url = HOST_API_ORIGIN + '/v1/pair';
  const result = await fetcher(url,{
    method:'POST', mode:'cors', credentials:'omit', cache:'no-store',
    redirect:'error', referrerPolicy:'no-referrer',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({code:normalized})
  });
  assertResponse(result,url);
  const body = await result.json();
  if (body?.schema !== PAIR_SCHEMA || !tokenPattern.test(body?.token||''))
    throw Error('The Android Host returned invalid pairing credentials.');
  return body.token;
}

export async function readHostStatus(token, fetcher=fetch) {
  if (!tokenPattern.test(token||'')) throw Error('Android Host pairing is required.');
  const url = HOST_API_ORIGIN + '/v1/status';
  const result = await fetcher(url,{
    method:'GET', mode:'cors', credentials:'omit', cache:'no-store',
    redirect:'error', referrerPolicy:'no-referrer',
    headers:{Authorization:'Bearer '+token}
  });
  assertResponse(result,url);
  const body = await result.json();
  if (body?.schema !== STATUS_SCHEMA || body.packageName !== HOST_PACKAGE ||
      !Number.isSafeInteger(body.versionCode) || body.versionCode < 1 ||
      !/^[0-9]+\.[0-9]+\.[0-9]+(?:[-.][a-zA-Z0-9]+)*$/.test(body.versionName||'') ||
      !Array.isArray(body.capabilities) || body.capabilities.length > 128 ||
      body.capabilities.some(x=>typeof x!=='string'||x.length>100))
    throw Error('The Android Host returned an incompatible status response.');
  return Object.freeze({schema:body.schema,packageName:body.packageName,versionCode:body.versionCode,
    versionName:body.versionName,capabilities:[...body.capabilities]});
}
