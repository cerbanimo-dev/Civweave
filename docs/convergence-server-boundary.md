# Server convergence boundary

The converged host has two direct entrypoints:

- one local companion server
- one public gateway server

Each entrypoint imports normal shared modules. Neither may read another server's source, replace an exact source string, write a temporary patched module, or import generated startup surgery.

Versioned server files may remain only during a declared route-compatibility window. Once direct route-contract tests pass, retired server variants are deleted.
