'use strict';
const CLEANUP='living-school-retired-scope-cleanup-v218';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const name of await caches.keys())if(/living.?school/i.test(name))await caches.delete(name);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{const url=new URL(event.request.url);if(event.request.mode==='navigate'&&url.pathname.startsWith('/app/services/living-school/'))event.respondWith(Response.redirect(new URL('/app/cabinets/living-school/index.html',self.location.origin),302))});
self.LivingSchoolRetiredScopeCleanup=CLEANUP;
