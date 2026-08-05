(()=>{
'use strict';
const VERSION='191.0-explicit-credential-policy';
// Compatibility marker: VERSION='160.1-device-credentials-settings-stable'
if(globalThis.CommonweaveDeviceCredentialsV160?.version===VERSION)return;
const LEGACY_PERSIST_KEY='commonweave-model-persistent-secrets-v160';
const SESSION_KEY='commonweave-model-session';
const parse=(value,fallback)=>{try{const parsed=JSON.parse(value);return parsed==null?fallback:parsed}catch{return fallback}};
function controller(){return globalThis.CommonweaveModelSettingsControllerV173||globalThis.CommonweaveAISettingsCleanroomV188||null}
function restore(){const api=controller();if(api?.restoreRememberedCredential)return api.restoreRememberedCredential();const saved=parse(localStorage.getItem(LEGACY_PERSIST_KEY),null),session=saved?.session;if(!session?.apiKey)return false;sessionStorage.setItem(SESSION_KEY,JSON.stringify(session));return true}
function persist(){return Boolean(controller()?.credentialStatus?.().remembered)}
function forget(){const api=controller();if(api?.forgetCredential)return api.forgetCredential();localStorage.removeItem(LEGACY_PERSIST_KEY);sessionStorage.removeItem(SESSION_KEY);return{remembered:false,session:false,mode:'session'}}
function hasSavedKey(){const status=controller()?.credentialStatus?.();if(status)return Boolean(status.remembered||status.session);const saved=parse(localStorage.getItem(LEGACY_PERSIST_KEY),{}),session=parse(sessionStorage.getItem(SESSION_KEY),{});return Boolean(saved?.session?.apiKey||session.apiKey)}
function patchSettings(){return false}
restore();
globalThis.CommonweaveDeviceCredentialsV160=Object.freeze({version:VERSION,restore,persist,forget,hasSavedKey,patchSettings,automaticPersistence:false,observer:false,credentialPolicy:'explicit-cleanroom-v191'});
})();
