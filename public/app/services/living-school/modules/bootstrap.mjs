import * as cerbanimoBridge from "./cerbanimo-bridge.mjs";
import * as rubricEngine from "./rubric-engine.mjs";
import * as projectGate from "./project-gate.mjs";
window.LivingSchoolModules={cerbanimoBridge,rubricEngine,projectGate,version:"1.0.0-rc.4"};
window.dispatchEvent(new CustomEvent("living-school:modules-ready",{detail:{version:"1.0.0-rc.4"}}));
