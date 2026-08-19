import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');
const mobileCreate=read('public/app/mobile-guild-create-v1.mjs');
const mobileEdge=read('cloudflare/mobile-guild-edge/src/index.mjs');
const desktopSetup=read('public/host-setup.html');
const guildMap=read('public/app/civweave-hub-map-v1.js');
const mobileTest=read('scripts/test-mobile-guild-create-v1.mjs');
const createStart=mobileCreate.indexOf('export async function createMobileGuild');
const createLocation=mobileCreate.indexOf('const location=await captureGuildLocation({precise:false})',createStart);
const createOnboarding=mobileCreate.indexOf('const onboarding=await completeGuildHostOnboarding',createStart);

const checks=[
  [mobileCreate.includes("MOBILE_GUILD_CREATE_SCHEMA='civweave.mobile-guild-create.v3'")&&createLocation>=0, 'mobile Guild creation captures a location as part of the v3 setup contract'],
  [createStart>=0&&createLocation>createStart&&createOnboarding>createLocation, 'mobile location permission and capture happen before the Guild identity is created'],
  [mobileCreate.includes('updateMobileGuildLocation')&&mobileCreate.includes("new URL('/api/fabric/location',current.primaryOrigin)")&&mobileCreate.includes("'authorization':`Bearer ${current.membershipKey}`"), 'mobile Guild location updates use the founding Guildkeeper membership credential'],
  [mobileCreate.includes("publicPrecision:precise?'precise':'rounded'")&&mobileCreate.includes('coordinateDecimals=precise?6:3'), 'mobile Guild placement remains rounded by default with explicit precise support in the shared updater'],
  [mobileEdge.includes("url.pathname==='/api/fabric/location'")&&mobileEdge.includes('await authenticate(request,guildState)')&&mobileEdge.includes('normalizeHubLocation'), 'mobile Cloudflare Guild edge authenticates and persists location updates'],
  [mobileEdge.includes("if(!input.location)throw")&&mobileEdge.includes('A Guild Map location is required before the public edge can be paired.'), 'mobile public edge pairing rejects Guilds that skipped location setup'],
  [mobileEdge.includes("'guild-map-location'")&&mobileEdge.includes('location:this.meta(\'location\')'), 'mobile starter-node manifests publish their Guild Map location'],
  [desktopSetup.includes('id="open-civweave"')&&desktopSetup.includes('aria-disabled="true"')&&desktopSetup.includes('Place this Guild on the Guild Map before entering Civweave'), 'desktop Guildkeeper setup cannot be completed before a Guild location is published'],
  [desktopSetup.includes("LOCATION_KEY='civweave.hub-location-claim.v1'")&&desktopSetup.includes('workerOrigin:locationTarget.workerOrigin')&&desktopSetup.includes('nodeIds:Array.isArray(result.nodeIds)'), 'desktop setup retains the Guildkeeper claim key target needed for later map moves'],
  [guildMap.includes("MOBILE_GUILD_KEY='civweave.mobile-guild.v1'")&&guildMap.includes("LOCATION_KEY='civweave.hub-location-claim.v1'")&&guildMap.includes("STEWARD_KEY='civweave.host-steward.v1'"), 'Guild Map recognizes both mobile and desktop Guildkeeper credentials'],
  [guildMap.includes('ownedGuildkeeperForNode')&&guildMap.includes('Update Guild location')&&guildMap.includes('data-hub-update-location'), 'Guild Map exposes location movement only through its owned-Guild action path'],
  [guildMap.includes("import('/app/mobile-guild-create-v1.mjs?v=guild-map-location-v1')")&&guildMap.includes("'x-civweave-location-key':key"), 'Guild Map routes mobile and desktop moves through their respective Guildkeeper credentials'],
  [guildMap.includes('mergeOwnedLocations')&&guildMap.includes('localOwnedMobile:true'), 'a mobile-created Guild is immediately visible on its founding Guildkeeper device even before global directory registration'],
  [mobileTest.includes('geolocation')&&mobileTest.includes('updateMobileGuildLocation')&&mobileTest.includes("headers.get('authorization')")&&mobileTest.includes('guildMapLocationUpdates:true'), 'mobile regression test covers required setup location and authenticated later movement'],
];

const failed=checks.filter(([ok])=>!ok).map(([,label])=>label);
if(failed.length){
  console.error('Guild location parity verification failed:');
  failed.forEach(label=>console.error(` - ${label}`));
  process.exitCode=1;
}else{
  console.log(`Guild location parity verification passed (${checks.length} checks).`);
}
