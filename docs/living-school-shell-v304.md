# Living School shell v304

Release 1.0.117 hardens the installed Living School shell around the failure modes found during the launch visual pass.

- Living School opens independently of local/shared AI runtime startup. AI-backed generation still requires the generation, quiz, and video guards before it runs.
- The workbench startup has a bounded failure state with an in-place retry instead of an indefinite opening screen.
- Installed-app chrome reserves Windows titlebar controls and bottom safe-area space.
- The five-system dock, floating guide controls, and Living School inline Moss surface no longer compete for the same viewport edges.
- The Living School startup surface and inline guide are more compact and readable.
