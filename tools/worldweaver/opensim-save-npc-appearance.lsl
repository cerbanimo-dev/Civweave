// Temporary setup helper for Civweave OpenSim NPCs.
// Drop alongside the controller script inside your private prim,
// touch the prim while wearing the appearance to copy,
// then REMOVE THIS SCRIPT after "CivweaveAppearance" is created.
//
// Owner only; function osAgentSaveAppearance must be allowed for your estate.
default {
    touch_start(integer count){
        if(llDetectedKey(0) != llGetOwner())return;
        key owner = llGetOwner();
        osAgentSaveAppearance(owner,"CivweaveAppearance");
        llOwnerSay("Saved owner appearance as CivweaveAppearance in this prim. Remove this capture script now.");
    }
}
