# Runtime Recovery Audit · v1.0.10

## Reproduced failures
- Living School visual binder was out of scope.
- Cerbanimo's main inline script was terminated by nested closing script tags.
- An absolute Living School logo path failed below `/app/services/`.
- Existing clients sent heartbeat requests without checking host capabilities.
- FellowFare hotspot percentages were mapped to the viewport instead of the cropped source image.
- Civweave could reveal its conventional substrate before the visual world formed.
- Antigravity permission failures blocked background workflows.

## Repairs verified
- Every standalone JavaScript and module file passes `node --check`.
- Executable inline scripts in Civweave, Living School, and Cerbanimo pass syntax checks.
- All five service-worker precache arrays contain no duplicate request and no missing local file.
- Root and realm HTML/CSS asset references resolve to existing files.
- Host health, configuration, registration, heartbeat, release, broadcast, seed, install-kit, and critical visual-image routes return successfully.
- The `.cwseed` and mobile install kit pass archive integrity tests.
- Shared hotspot calibration now maps source-image coordinates through `object-fit` cropping on resize and orientation changes.

## Browser-test limitation
The build environment's Chromium policy blocks navigation to local and file URLs, so automated pixel-level browser execution could not run here. Static runtime checks, local HTTP route checks, archive checks, and source-image calibration checks were completed instead.
