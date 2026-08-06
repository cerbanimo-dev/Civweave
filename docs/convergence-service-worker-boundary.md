# Service worker convergence boundary

The converged service worker owns only:

- installation of generated core package entries
- optional package caching on explicit request
- supported compatibility route aliases
- deterministic cache upgrade and eviction
- package status reporting
- offline fallback and recovery

It must not own:

- handwritten realm package maps
- realm-specific application state
- arbitrary HTML script injection
- duplicated navigation or guide behavior
- source-of-truth release metadata
- package discovery through JavaScript source parsing

The application manifest generates package inputs. The service worker consumes those generated inputs.
