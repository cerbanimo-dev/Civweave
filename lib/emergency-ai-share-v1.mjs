import {EMERGENCY_AI_HOST_POLICY,evaluateEmergencyAiEligibility} from '../public/app/shared/guild-host-resilience-v1.mjs';

export class EmergencyAiFifo {
  constructor({tierCatalog={},speedChecks={},optedIn=false,execute}={}){
    if(typeof execute!=='function')throw new TypeError('execute is required.');
    this.tierCatalog=tierCatalog;this.speedChecks=speedChecks;this.optedIn=optedIn===true;this.execute=execute;this.tail=Promise.resolve();this.depth=0;this.sequence=0;
  }
  configure({tierCatalog=this.tierCatalog,speedChecks=this.speedChecks,optedIn=this.optedIn}={}){this.tierCatalog=tierCatalog;this.speedChecks=speedChecks;this.optedIn=optedIn===true;return this.status()}
  eligibility(){return evaluateEmergencyAiEligibility({optedIn:this.optedIn,tierCatalog:this.tierCatalog,speedChecks:this.speedChecks})}
  status(){return Object.freeze({schema:'civweave.emergency-ai-share.v1',scheduler:EMERGENCY_AI_HOST_POLICY.scheduler,queueDepth:this.depth,...this.eligibility()})}
  submit(request={}){
    const eligibility=this.eligibility();if(!eligibility.eligible){const error=new Error(`Emergency AI sharing is unavailable: ${eligibility.failures.join(', ')}`);error.code='EMERGENCY_AI_HOST_INELIGIBLE';error.eligibility=eligibility;return Promise.reject(error)}
    const sequence=++this.sequence;this.depth+=1;
    const run=async()=>this.execute(request,{sequence,scheduler:'fifo',eligibility});
    const result=this.tail.then(run,run);this.tail=result.catch(()=>{});
    return result.finally(()=>{this.depth=Math.max(0,this.depth-1)});
  }
}

export function createEmergencyAiFifo(options){return new EmergencyAiFifo(options)}
