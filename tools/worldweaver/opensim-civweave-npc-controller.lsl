// Civweave OpenSimulator NPC controller — LSL + OpenSim OSSL
// Place this OWNER-ONLY script in a non-public, nontransferable in-world prim.
// Requires YEngine, OSSL NPC permissions for this owner, local HTTP permissions,
// and an appearance notecard named exactly "CivweaveAppearance" in the prim.
//
// Change the endpoint, region ID and CONTROLLER TOKEN shown by the Node bridge.
// NEVER paste the browser token here; this token can only poll and report outcomes.
string ENDPOINT = "http://127.0.0.1:8769";
string REGION_ID = "civweave-region";
string CONTROLLER_TOKEN = "REPLACE_WITH_IN_WORLD_SCRIPT_TOKEN";

list PERSONAS = ["aphra","jae","anthony","rosa","sana","kit","farah","kami"];
list NPC_KEYS = [NULL_KEY,NULL_KEY,NULL_KEY,NULL_KEY,NULL_KEY,NULL_KEY,NULL_KEY,NULL_KEY];
key pollRequest = NULL_KEY;
key resultRequest = NULL_KEY;
string movingId = "";
key movingNpc = NULL_KEY;
vector target = ZERO_VECTOR;
integer moveStarted = 0;

key ensureNpc(string persona){
    integer idx = llListFindList(PERSONAS,[persona]);
    if(idx == -1) return NULL_KEY;
    key npc = llList2Key(NPC_KEYS,idx);
    if(npc != NULL_KEY && osIsNpc(npc)) return npc;
    if(llGetInventoryType("CivweaveAppearance") != INVENTORY_NOTECARD)
        return NULL_KEY;
    // Each synthetic actor is explicitly created by the trusted prim owner.
    npc = osNpcCreate(persona,"Collective",llGetPos()+<0.0,0.0,2.0>,"CivweaveAppearance");
    if(npc != NULL_KEY)NPC_KEYS = llListReplaceList(NPC_KEYS,[npc],idx,idx);
    return npc;
}
sendResult(string id, string outcome, string summary, vector position){
    string body = llList2Json(JSON_OBJECT,[
        "requestId",id,
        "outcome",outcome,
        "summary",llGetSubString(summary,0,250)
    ]);
    // Completed moves report observed coordinates, not merely accepted commands.
    if(outcome == "completed"){
        body = llJsonSetValue(body,["position","x"],(string)position.x);
        body = llJsonSetValue(body,["position","y"],(string)position.y);
        body = llJsonSetValue(body,["position","z"],(string)position.z);
    }
    resultRequest = llHTTPRequest(ENDPOINT+"/result",[
        HTTP_METHOD,"POST",
        HTTP_MIMETYPE,"application/json",
        HTTP_CUSTOM_HEADER,"X-Civweave-Controller",CONTROLLER_TOKEN
    ],body);
}
executeCommand(string json){
    string id = llJsonGetValue(json,["requestId"]);
    string region = llJsonGetValue(json,["regionId"]);
    string persona = llJsonGetValue(json,["personaId"]);
    string tool = llJsonGetValue(json,["tool"]);
    if(id == JSON_INVALID || id == "" || region != REGION_ID){
        if(id != JSON_INVALID && id != "")
            sendResult(id,"failed","Wrong OpenSim controller region.",ZERO_VECTOR);
        return;
    }
    key npc = ensureNpc(persona);
    if(npc == NULL_KEY){
        sendResult(id,"failed","NPC could not be created. Install appearance notecard and enable owner-only OSSL NPC functions.",ZERO_VECTOR);
        return;
    }
    if(tool == "move"){
        vector location = <
            (float)llJsonGetValue(json,["args","x"]),
            (float)llJsonGetValue(json,["args","y"]),
            (float)llJsonGetValue(json,["args","z"])
        >;
        if(location.x < 0 || location.x > 256 || location.y < 0 || location.y > 256 ||
           location.z < 0 || location.z > 4096){
            sendResult(id,"failed","Invalid local region coordinates.",ZERO_VECTOR);
            return;
        }
        movingId = id;
        movingNpc = npc;
        target = location;
        moveStarted = llGetUnixTime();
        osNpcMoveTo(npc,location);
    }else if(tool == "speak"){
        string message = llJsonGetValue(json,["args","text"]);
        if(llStringLength(message)>300 || message == "" || message == JSON_INVALID){
            sendResult(id,"failed","Invalid NPC speech.",ZERO_VECTOR);
            return;
        }
        osNpcSay(npc,message);
        sendResult(id,"completed","OpenSimulator NPC speech command was issued.",ZERO_VECTOR);
    }else{
        sendResult(id,"failed","Unsupported NPC tool.",ZERO_VECTOR);
    }
}
default {
    state_entry(){
        llOwnerSay("Civweave NPC controller initializing. Do not expose this object or its script token.");
        if(CONTROLLER_TOKEN == "REPLACE_WITH_IN_WORLD_SCRIPT_TOKEN"){
            llOwnerSay("Set the in-world controller token from your local Civweave bridge before running.");
            return;
        }
        llSetTimerEvent(2.0);
    }
    on_rez(integer start){llResetScript();}
    changed(integer change){
        if(change & CHANGED_OWNER)llResetScript();
    }
    timer(){
        if(movingId != ""){
            vector actual = osNpcGetPos(movingNpc);
            if(llVecDist(actual,target)<=1.75){
                string id = movingId; movingId = "";
                sendResult(id,"completed","NPC arrived within 1.75 meters of requested target.",actual);
            }else if(llGetUnixTime()-moveStarted >= 30){
                string expired = movingId;movingId = "";
                sendResult(expired,"failed","NPC did not reach target within 30 seconds.",actual);
            }
            return;
        }
        if(pollRequest != NULL_KEY || resultRequest != NULL_KEY)return;
        pollRequest = llHTTPRequest(ENDPOINT+"/next",[
            HTTP_METHOD,"GET",
            HTTP_CUSTOM_HEADER,"X-Civweave-Controller",CONTROLLER_TOKEN
        ],"");
    }
    http_response(key request_id, integer status, list metadata, string body){
        if(request_id == resultRequest){
            resultRequest = NULL_KEY;
            if(status != 200)llOwnerSay("Civweave receipt failed: HTTP "+(string)status);
            return;
        }
        if(request_id != pollRequest)return;
        pollRequest = NULL_KEY;
        if(status != 200){
            llOwnerSay("Civweave bridge unavailable (HTTP "+(string)status+"). Check OpenSim local HTTP permissions and bridge status.");
            return;
        }
        if(llJsonGetValue(body,["command"]) == JSON_NULL)return;
        string command = llJsonGetValue(body,["command"]);
        if(command == JSON_INVALID)return;
        executeCommand(command);
    }
}
