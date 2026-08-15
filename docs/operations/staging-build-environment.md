# Civweave staging build environment

## Purpose

`staging` is the long-lived nonproduction integration lane for Civweave. It exists so unstable development can be built, deployed, and exercised without using the canonical production Pages project or `civweave.cc` as the test bench.

## Environment contract

- `main` remains the production branch.
- `staging` is the nonproduction integration branch.
- The staging Cloudflare Pages project is `civweave-staging`.
- The stable staging origin is `https://civweave-staging.pages.dev`.
- The staging deployment workflow must never target the canonical `civweave` Pages project or production custom domains.
- Every staging deployment writes `/app/staging-deployment-v1.json` and verifies that the stable staging origin serves the exact Git commit that triggered the deployment.
- Pull requests targeting `staging` build the Pages package but do not deploy it. Pushes and merges to `staging` build and deploy automatically.

## Normal development flow

1. Develop on a feature/fix branch.
2. Open the pull request against `staging`, not `main`.
3. Let the staging workflow prove that the Cloudflare Pages package builds.
4. Merge into `staging` when ready for integrated testing.
5. Test the resulting deployment at `https://civweave-staging.pages.dev`.
6. Keep iterating in staging until the integrated state is stable.
7. Promote the tested staging state to `main` only as an explicit production action after verification.

This keeps ordinary development from touching production simply because somebody wanted to see whether a button worked. Civilization may yet recover.

## Isolation boundary

The current staging lane isolates the deployable Pages application from production by using a separate Cloudflare Pages project. It deliberately does **not** create staging copies of Civweave's backend Workers yet.

The existing `civweave-node-cloud`, `civweave-host-edge`, and `civweave-core` configurations contain production-facing service bindings, Durable Objects, D1/R2 resources, canonical origins, and/or money infrastructure. A backend staging lane must therefore provision separate resources and service names before those Workers can safely be attached to staging.

Do not point a staging Worker at production D1, R2, Durable Objects, mail, recovery, money, account-directory, or node-fabric services merely to make staging functional. That would be a second production environment wearing a fake moustache.

## Backend staging expansion

When backend integration is needed, provision it as a separate stack with staging-specific names and data:

- staging core Worker and staging D1 database
- staging distribution R2 bucket
- staging node-cloud Worker and Durable Object namespaces
- staging host/account-edge Worker and Durable Object namespaces
- staging mail sink or explicitly non-delivering mail Worker
- staging recovery/account-directory services
- test-mode payment wiring only, with live-money gates disabled
- staging-only service bindings between those resources

Only after those resources exist should the Pages staging app be configured to use them.

## Recovery rule

When production becomes unstable, stop using production as the debugging surface. Continue development and verification on `staging`. Production should receive a commit only after that exact integrated state has been exercised successfully in the staging lane.
