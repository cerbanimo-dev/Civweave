# Mobile chat + layout repair v248

This release repairs two Android regressions reported against Civweave v1.0.40.

## Mobile containment

- Working Campus controls no longer force Guided/Free roam, Map, and AI settings into one narrow row.
- Realm cards use a contained two-column grid on normal phones and one column on very narrow phones.
- The Working Campus brand image uses the known-good cache-safe PWA icon.
- Horizontal overflow is clipped at the Civweave app boundary without disabling vertical document scrolling.

## Shared guide interaction

- Persona switching is owned on pointerdown with the following compatibility click swallowed, without synthetic click relays.
- Full-chat and inline composers share one window-capture submit owner.
- The inline thread is repainted immediately after submission, before the model response completes.
- If the structured assistant route returns a local-recovery error, the turn is retried through the shared model runtime and finally a deterministic local guide response.
- FellowFare's native Rook chat remains untouched.

## Installed-client recovery

The v248 service-worker repair evicts stale chat, topbar, and Working Campus assets by pathname with `ignoreSearch`, because older installed workers cache `/app/*` independently of query-string cache busts.
