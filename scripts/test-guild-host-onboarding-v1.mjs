import assert from 'node:assert/strict';
import {classifyHostDevice,recommendedHostRoute,GUILD_HOST_ONBOARDING_SCHEMA} from '../public/app/guild-host-onboarding-v1.mjs';

assert.equal(GUILD_HOST_ONBOARDING_SCHEMA,'civweave.guild-host-onboarding.v1');
assert.equal(classifyHostDevice({userAgent:'Mozilla/5.0 (Linux; Android 15; Mobile)',maxTouchPoints:5,coarsePointer:true}),'mobile');
assert.equal(classifyHostDevice({userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',maxTouchPoints:5,coarsePointer:true}),'mobile');
assert.equal(classifyHostDevice({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',maxTouchPoints:0,coarsePointer:false}),'desktop');
assert.equal(recommendedHostRoute({deviceClass:'mobile',localMeshAvailable:true}),'pocket-node');
assert.equal(recommendedHostRoute({deviceClass:'mobile',localMeshAvailable:false}),'persistent-local-node');
assert.equal(recommendedHostRoute({deviceClass:'desktop',localMeshAvailable:true}),'persistent-local-node');
console.log(JSON.stringify({ok:true,schema:GUILD_HOST_ONBOARDING_SCHEMA,mobilePremierRoute:'pocket-node',desktopRoute:'persistent-local-node'}));
