(() => {
  const SUITE_ORIGIN = location.origin;

  function host() {
    return window.__CERBANIMO_TEST__ || null;
  }

  async function waitForHost(timeoutMs = 15000) {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const api = host();
      if (api) return api;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    return null;
  }

  function post(message) {
    if (window.parent !== window) {
      window.parent.postMessage(message, SUITE_ORIGIN);
    }
  }

  function engineFor(model = {}) {
    if (model.route === "deterministic") {
      return { engine: "deterministic", endpoint: "", model: "" };
    }
    if (model.route === "gemini") {
      return {
        engine: "gemini",
        endpoint:
          model.endpoint || "https://generativelanguage.googleapis.com/v1beta",
        model: model.model || "gemini-3.5-flash-lite",
      };
    }
    if (model.route === "hosted") {
      return {
        engine: "compatible",
        endpoint: "/api/ai/v1",
        model: model.model || "gemini-3.5-flash-lite",
      };
    }
    if (model.route === "gguf") {
      return {
        engine: "compatible",
        endpoint:
          model.endpoint || "http://127.0.0.1:8788/v1/chat/completions",
        model: model.model || "local-gguf",
      };
    }
    if (model.route === "local-api") {
      const endpoint = model.endpoint || "http://127.0.0.1:11434";
      return {
        engine: endpoint.includes("11434") ? "ollama" : "compatible",
        endpoint,
        model: model.model || "local-model",
      };
    }
    return { engine: "deterministic", endpoint: "", model: "" };
  }

  function applyContext(context) {
    const api = host();
    if (!api) return;
    const state = api.getState();
    const selected = engineFor(context.model || {});
    state.civweave = {
      connected: true,
      version: context.version || "1.0",
      account: context.account || {},
      model: context.model || {},
      privacy: context.privacy || {},
      attention: context.attention && typeof context.attention === "object" ? {
        unreadCount: Math.max(0, Number(context.attention.unreadCount || 0)),
        openCount: Math.max(0, Number(context.attention.openCount || 0)),
        highestPriority: String(context.attention.highestPriority || "normal").slice(0, 20),
      } : { unreadCount: 0, openCount: 0, highestPriority: "normal" },
      updatedAt: new Date().toISOString(),
    };
    state.ai = {
      ...state.ai,
      ...selected,
      civweaveManaged: true,
    };
    if (
      context.modelSettings?.sharedForThisSession &&
      typeof api.configureCivweaveModelSession === "function"
    ) {
      api.configureCivweaveModelSession(
        String(
          context.modelSettings.apiKey ||
            context.modelSettings.bearerToken ||
            "",
        ).slice(0, 500),
      );
    }
    api.setState(state);
    if (typeof api.render === "function") api.render();
    let badge = document.getElementById("civweave-suite-badge");
    if (!badge) {
      badge = document.createElement("div");
      badge.id = "civweave-suite-badge";
      badge.setAttribute("role", "status");
    badge.style.cssText =
        "position:fixed;right:12px;bottom:72px;z-index:80;display:flex;align-items:center;gap:7px;padding:6px 10px 6px 6px;border:1px solid rgba(255,77,141,.5);border-radius:999px;background:#100b12;color:#ffd3e3;font:700 9px ui-monospace,monospace;box-shadow:0 8px 24px rgba(0,0,0,.35)";
      document.body.append(badge);
    }
    const plan = String(context.account?.planId || "commons")
      .replace(/-/g, " ")
      .toUpperCase();
    const balance = Number(context.account?.balanceCents || 0);
    badge.innerHTML = `<img src="assets/cerbanimo-mark.png" alt="" style="width:26px;height:26px;padding:2px;border-radius:50%;background:#fff;object-fit:contain"><span>KAMIYA · ${escapeHtml(plan)} · ${
      balance ? `$${(balance / 100).toFixed(2)} AI` : "LOCAL"
    }</span>`;
  }

  function escapeHtml(value) {
    return String(value || "").replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;",
        })[character],
    );
  }

  function renderQuestBoard(items = []) {
    let board = document.getElementById("civweave-quest-board");
    if (!items.length) {
      board?.remove();
      return;
    }
    if (!board) {
      board = document.createElement("section");
      board.id = "civweave-quest-board";
      board.setAttribute("aria-label", "Approved Anarchadia quest board");
      board.style.cssText =
        "position:fixed;left:12px;right:12px;bottom:68px;z-index:79;max-height:42vh;overflow:auto;padding:12px;border:1px solid rgba(184,255,106,.48);border-radius:14px;background:rgba(9,8,14,.96);color:#fff;box-shadow:0 18px 55px rgba(0,0,0,.48);font:12px/1.45 system-ui,sans-serif";
      document.body.append(board);
    }
    board.innerHTML = `<header style="display:flex;align-items:center;justify-content:space-between;gap:12px"><div><small style="color:#b8ff6a;font:700 9px ui-monospace,monospace;letter-spacing:.12em">ANARCHADIA · APPROVED QUEST BOARD</small><strong style="display:block;margin-top:3px">${items.length} community plan${items.length === 1 ? "" : "s"} ready for member review</strong></div><button type="button" data-close-civweave-board style="border:1px solid #ffffff42;border-radius:999px;background:transparent;color:#fff;padding:6px 10px">Hide</button></header><div style="display:grid;gap:8px;margin-top:10px">${items
      .slice(0, 12)
      .map(
        (item) =>
          `<article style="padding:10px;border:1px solid #ffffff20;border-radius:10px;background:#ffffff09"><b>${escapeHtml(item.title || "Approved plan")}</b><p style="margin:4px 0;color:#d9d3df">${escapeHtml(item.summary || item.payload?.plan?.description || "Approved through the connected Anarchadia workspace.")}</p><small style="color:#9ee7ff">Approved ${item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "by the community vote"} · review before importing</small></article>`,
      )
      .join("")}</div>`;
    board.querySelector("[data-close-civweave-board]")?.addEventListener(
      "click",
      () => board.remove(),
    );
  }

  function applyGovernanceSync(message = {}) {
    const api = host();
    if (!api) return;
    const items = Array.isArray(message.approved)
      ? message.approved.slice(0, 50)
      : [];
    const state = api.getState();
    state.civweave = {
      ...(state.civweave || {}),
      questBoard: items,
      governanceCommunityRef: String(message.communityRef || ""),
      governanceUpdatedAt: new Date().toISOString(),
    };
    api.setState(state);
    renderQuestBoard(items);
  }

  function selectedPlanPayload() {
    const api = host();
    if (!api) return null;
    const state = api.getState();
    const quest =
      state.quests.find((item) => item.id === state.ui.selectedQuestId) ||
      state.quests[0];
    if (!quest) return null;
    return {
      schema: "civweave.cerbanimo-plan.v1",
      generatedAt: new Date().toISOString(),
      plan: {
        id: quest.id,
        title: quest.title,
        description: quest.description,
        tasks: state.tasks
          .filter((task) => task.questId === quest.id)
          .map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            proof: task.proofRequirement,
            status: task.status,
          })),
      },
      policy: state.policy,
      automaticEffect: false,
      manualReviewRequired: true,
      authorityDisclaimer:
        "Cerbanimo supplies an operating plan, not community authorization.",
    };
  }

  const PROJECT_CONTRACT = "civweave.cerbanimo-project.v1";
  const PROJECT_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{2,159}$/;
  const PROJECT_STATES = new Set([
    "not-started","drafting","ready-to-submit","sending","submitted","under-review",
    "revision-requested","accepted","rejected","handoff-failed","integration-unavailable",
  ]);

  function projectText(value, limit = 1200) {
    return String(value || "").trim().slice(0, limit);
  }

  function projectId(value, fallback = "") {
    const text = projectText(value, 160);
    return PROJECT_ID.test(text) ? text : fallback;
  }

  function projectRequest(data, expectedType) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    if (data.type !== expectedType || data.contractVersion !== PROJECT_CONTRACT) return null;
    if (data.sourceApplication !== "civweave") return null;
    const requestId = projectId(data.requestId);
    const schoolId = projectId(data.schoolId);
    const projectRef = projectId(data.projectRef);
    if (!requestId || !schoolId || !projectRef) return null;
    if (
      expectedType === "civweave:project-handoff-request" &&
      (!data.project || typeof data.project !== "object" || Array.isArray(data.project))
    ) return null;
    return {
      requestId,schoolId,moduleId:projectId(data.moduleId,"final-project"),
      learnerId:projectId(data.learnerId,"local-learner"),projectRef,
      timestamp:projectText(data.timestamp,80)||new Date().toISOString(),
      title:projectText(data.title,220)||"Living School final project",
      creativeIntention:projectText(data.creativeIntention,4000),
      project:data.project&&typeof data.project==="object"&&!Array.isArray(data.project)?data.project:null,
    };
  }

  function ensureProjectLinks(state) {
    state.civweave = state.civweave || {};
    if (!Array.isArray(state.civweave.projectLinks)) state.civweave.projectLinks = [];
    return state.civweave.projectLinks;
  }

  function questForProjectLink(state, link) {
    if (link.questId) {
      const direct = state.quests.find((quest) => quest.id === link.questId);
      if (direct) return direct;
    }
    if (link.threadId) {
      const thread = state.threads.find((item) => item.id === link.threadId);
      if (thread?.questId) {
        link.questId = thread.questId;
        return state.quests.find((quest) => quest.id === thread.questId) || null;
      }
    }
    const proposal = link.proposalId ? state.proposals.find((item) => item.id === link.proposalId) : null;
    if (proposal?.threadId) {
      link.threadId = proposal.threadId;
      const thread = state.threads.find((item) => item.id === proposal.threadId);
      if (thread?.questId) {
        link.questId = thread.questId;
        return state.quests.find((quest) => quest.id === thread.questId) || null;
      }
    }
    return null;
  }

  function taskEvidenceState(state, task) {
    const submission = (state.submissions || []).find((item) => item.taskId === task.id) || null;
    const reviewId = submission?.primaryReviewId || task.primaryReviewId || "";
    const review = reviewId
      ? (state.primaryReviews || []).find((item) => item.id === reviewId) || null
      : (state.primaryReviews || []).find((item) => item.taskId === task.id) || null;
    const verdict = String(review?.verdict || "").toLowerCase();
    return { submission, review, verdict };
  }

  function projectStatusDescriptor(state, link) {
    const proposal = link.proposalId ? state.proposals.find((item) => item.id === link.proposalId) : null;
    if (proposal?.status === "cancelled" || proposal?.status === "rejected") {
      return {status:"rejected",event:"project-rejected",type:"civweave:project-rejected",detail:"The linked Cerbanimo proposal was rejected or closed."};
    }
    const quest = questForProjectLink(state, link);
    if (!quest) {
      return {status:"submitted",event:proposal?"project-linked":"handoff-accepted",type:proposal?"civweave:project-linked":"civweave:project-status-returned",detail:proposal?"Kamiya prepared a proposal linked to this Living School project. It still requires learner ratification.":"Cerbanimo has the saved project packet. A quest has not yet been ratified."};
    }
    const tasks = state.tasks.filter((task) => task.questId === quest.id);
    if (!tasks.length) return {status:"submitted",event:"project-created",type:"civweave:project-created",detail:"The linked Cerbanimo quest exists, but no project work units have been accepted yet.",quest};
    const evidence = tasks.map((task) => ({task,...taskEvidenceState(state,task)}));
    const revision = evidence.find(({task,verdict}) => task.status === "rejected" || ["repair","reject","rejected","fail"].includes(verdict));
    if (revision) {
      const instructions = Array.isArray(revision.review?.repairInstructions) ? revision.review.repairInstructions.join(" ") : "";
      return {status:"revision-requested",event:"revision-requested",type:"civweave:project-revision-requested",detail:"Cerbanimo returned at least one work unit for revision.",reviewFeedback:projectText([revision.review?.reason,instructions].filter(Boolean).join(" "),2400),reviewId:revision.review?.id,evidenceRef:revision.submission?.id,quest};
    }
    const everyAccepted = evidence.every(({task,submission,review,verdict}) =>
      ["completed","settled"].includes(task.status) && submission && review && verdict === "pass"
    );
    if (everyAccepted) {
      return {status:"accepted",event:"project-accepted",type:"civweave:project-accepted",detail:"Cerbanimo verified that every linked work unit has evidence and a passing selected-model review.",reviewId:evidence[0]?.review?.id,evidenceRef:evidence[0]?.submission?.id,quest};
    }
    const reviewed = evidence.find(({review}) => Boolean(review));
    const submitted = evidence.find(({submission,task}) => Boolean(submission) || ["submitted","evidence_closed","review_pending","completed_pending_coin","appeal_pending","coin_ready","audit_disputed","accepted_pending_settlement","completed","settled"].includes(task.status));
    if (reviewed) return {status:"under-review",event:"review-pending",type:"civweave:project-review-pending",detail:"Cerbanimo has review activity for the linked project. Acceptance still requires passing evidence review for every work unit.",reviewId:reviewed.review?.id,evidenceRef:reviewed.submission?.id,quest};
    if (submitted) return {status:"under-review",event:"evidence-submitted",type:"civweave:project-evidence-submitted",detail:"Project evidence has reached Cerbanimo and is waiting for review.",evidenceRef:submitted.submission?.id,quest};
    return {status:"submitted",event:"project-linked",type:"civweave:project-linked",detail:"The Cerbanimo project is linked and active. No accepted evidence receipt has returned yet.",quest};
  }

  function touchLinkStatus(link, descriptor) {
    const fingerprint = [descriptor.status,descriptor.event,descriptor.reviewId||"",descriptor.evidenceRef||"",descriptor.reviewFeedback||""].join("|");
    if (link.statusFingerprint !== fingerprint) {
      link.statusRevision = Math.max(0, Number(link.statusRevision || 0)) + 1;
      link.statusFingerprint = fingerprint;
      link.status = descriptor.status;
      link.updatedAt = new Date().toISOString();
      if (descriptor.status === "accepted") link.acceptedAt ||= link.updatedAt;
    }
    return fingerprint;
  }

  function projectReceipt(type, request, link, detail, status, options = {}) {
    const api = host();
    const state = api?.getState?.() || {tasks:[],quests:[],proposals:[],threads:[],submissions:[],primaryReviews:[]};
    const descriptor = link ? projectStatusDescriptor(state,link) : {status:status||"integration-unavailable",event:options.event||"integration-error",type};
    const resolvedStatus = PROJECT_STATES.has(status) ? status : descriptor.status;
    const event = options.event || descriptor.event || "status-returned";
    const receiptType = type || descriptor.type || "civweave:project-status-returned";
    if (link) touchLinkStatus(link,{...descriptor,status:resolvedStatus,event});
    const acknowledgedAt = new Date().toISOString();
    const revision = Math.max(0,Number(link?.statusRevision||0));
    const receiptId = projectId(`receipt:${request.projectRef}:${request.requestId}:${revision}:${event}`,`receipt:${request.projectRef}:${revision}`);
    return {
      type:receiptType,event,receiptId,statusRevision:revision,contractVersion:PROJECT_CONTRACT,
      requestId:request.requestId,schoolId:request.schoolId,moduleId:request.moduleId,learnerId:request.learnerId,
      projectRef:request.projectRef,timestamp:request.timestamp,sourceApplication:"cerbanimo",status:resolvedStatus,
      detail:projectText(detail||descriptor.detail,1800),projectId:link?.id,
      projectUrl:`/services/cerbanimo/index.html?civweave=1&projectRef=${encodeURIComponent(request.projectRef)}`,
      proposalId:link?.proposalId||undefined,questId:descriptor.quest?.id||link?.questId||undefined,
      reviewId:options.reviewId||descriptor.reviewId||undefined,evidenceRef:options.evidenceRef||descriptor.evidenceRef||undefined,
      reviewFeedback:options.reviewFeedback||descriptor.reviewFeedback||undefined,
      acceptedAt:resolvedStatus==="accepted"?(link?.acceptedAt||acknowledgedAt):undefined,
      acknowledgedAt,lastEventAt:link?.updatedAt||acknowledgedAt,demo:false,
    };
  }

  function postProjectError(request, detail, status = "integration-unavailable") {
    post(projectReceipt(status==="rejected"?"civweave:project-rejected":"civweave:project-unavailable",request,null,detail,status,{event:status==="rejected"?"project-rejected":"project-unavailable"}));
  }

  async function acceptProjectHandoff(data) {
    const request = projectRequest(data,"civweave:project-handoff-request");
    if (!request) return;
    const api = await waitForHost();
    if (!api) {postProjectError(request,"Cerbanimo did not finish initializing in time to accept the project packet.");return;}
    let state = api.getState();
    const links = ensureProjectLinks(state);
    let link = links.find((item) => item.handoffRequestId===request.requestId || item.projectRef===request.projectRef);
    if (!link) {
      link={id:`cw-project-${crypto.randomUUID()}`,schema:"civweave.cerbanimo-project-link.v1",handoffRequestId:request.requestId,projectRef:request.projectRef,schoolId:request.schoolId,moduleId:request.moduleId,learnerId:request.learnerId,title:request.title,creativeIntention:request.creativeIntention,project:request.project,status:"submitted",statusRevision:0,statusFingerprint:"",createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
      links.unshift(link);
    } else {
      link.project=request.project;link.title=request.title;link.creativeIntention=request.creativeIntention;link.handoffRequestId=request.requestId;link.updatedAt=new Date().toISOString();
    }
    link.lastRequestIdentity={...request};
    state.ui.view="kamiya";
    state.civweave.pendingProject={id:link.id,projectRef:link.projectRef,title:link.title,creativeIntention:link.creativeIntention,receivedAt:new Date().toISOString()};
    touchLinkStatus(link,{status:"submitted",event:"handoff-accepted"});
    api.setState(state);
    post(projectReceipt("civweave:project-handoff-accepted",request,link,"Cerbanimo acknowledged and saved the final-project packet. Kamiya is preparing a reviewable project proposal; no quest has been created without learner ratification.","submitted",{event:"handoff-accepted"}));

    if (link.proposalId) return;
    const before=new Set((api.getState().proposals||[]).map((item)=>item.id));
    const brief=JSON.stringify(request.project,null,2).slice(0,9000);
    const prompt=["A Living School pathway has reached its real-world final project.",`Creative intention: ${request.creativeIntention||request.title}`,`Final project: ${request.title}`,"Create a reviewable Cerbanimo quest proposal from the packet below.","Preserve the learning purpose, completion criteria, proof requirements, and originating intention.","Do not mutate the quest ledger. The learner must inspect and ratify the proposal.",brief].join("\n\n");
    try {
      await api.dispatchKamiya(prompt);
      state=api.getState();
      const updatedLink=ensureProjectLinks(state).find((item)=>item.id===link.id);
      const proposal=(state.proposals||[]).find((item)=>!before.has(item.id)&&item.status==="pending");
      if(updatedLink&&proposal){updatedLink.proposalId=proposal.id;updatedLink.threadId=proposal.threadId||state.ui.selectedThreadId;updatedLink.status="submitted";updatedLink.lastRequestIdentity={...request};updatedLink.updatedAt=new Date().toISOString();state.civweave.pendingProject.proposalId=proposal.id;api.setState(state);post(projectReceipt("civweave:project-linked",request,updatedLink,"Kamiya prepared and linked the project proposal. It is awaiting learner inspection and ratification in Cerbanimo.","submitted",{event:"project-linked"}));}
    } catch(error) {
      state=api.getState();const updatedLink=ensureProjectLinks(state).find((item)=>item.id===link.id);
      if(updatedLink){updatedLink.lastModelError=projectText(error?.message||error,900);updatedLink.updatedAt=new Date().toISOString();api.setState(state);}
      post(projectReceipt("civweave:project-status-returned",request,updatedLink||link,`Cerbanimo saved the project packet, but Kamiya's selected model needs attention before it can draft the proposal: ${projectText(error?.message||error,700)}`,"submitted",{event:"status-returned"}));
    }
  }

  async function returnProjectStatus(data) {
    const request=projectRequest(data,"civweave:project-status-request");
    if(!request)return;
    const api=await waitForHost();
    if(!api){postProjectError(request,"Cerbanimo did not finish initializing in time to return project status.");return;}
    const state=api.getState();
    const link=ensureProjectLinks(state).find((item)=>item.projectRef===request.projectRef||item.id===data.projectId);
    if(!link){postProjectError(request,"Cerbanimo has no project receipt matching this Living School reference.");return;}
    link.lastRequestIdentity={...request};
    const descriptor=projectStatusDescriptor(state,link);
    touchLinkStatus(link,descriptor);api.setState(state);
    post(projectReceipt(descriptor.type,request,link,descriptor.detail,descriptor.status,descriptor));
  }

  const ACTION_SIGNAL_CONTRACT = "civweave.action-signal.v1";
  const NAVIGATION_CONTRACT = "civweave.navigation.v1";
  const PARTY_DISCOVERY_CONTRACT = "civweave.party-discovery.v1";
  const PARTY_STATUS_CONTRACT = "civweave.party-status.v1";
  let lastPartyStatusFingerprint = "";

  function campusDeepLink(object, id) {
    return `/campus?app=cerbanimo&object=${encodeURIComponent(object)}&id=${encodeURIComponent(id)}`;
  }

  function attentionSignals(state) {
    const signals = [];
    for (const invite of (state.invites || []).filter((item) => item.direction === "incoming")) {
      const capsule = invite.capsule || {};
      const party = capsule.payload?.party || {};
      const title = party.questTitle || party.name || "Cerbanimo quest";
      const resolved = ["accepted", "rejected", "expired", "revoked"].includes(invite.status);
      signals.push({
        signalId: `invitation:${invite.id}`, kind: "invitation", subjectType: "invitation", subjectId: invite.id,
        title: resolved ? `Invitation ${invite.status}` : `Quest invitation · ${title}`,
        detail: resolved ? `Cerbanimo recorded this invitation as ${invite.status}.` : `${capsule.issuer?.alias || "A Cerbanimo steward"} offered the ${invite.roleName || "collaborator"} role. Review the signed capsule before accepting.`,
        priority: "high", state: resolved ? "resolved" : "human-action-required", deepLink: campusDeepLink("invitation", invite.id),
      });
    }
    for (const task of state.tasks || []) {
      const submission = (state.submissions || []).find((item) => item.taskId === task.id);
      const review = submission?.primaryReviewId ? (state.primaryReviews || []).find((item) => item.id === submission.primaryReviewId) : (state.primaryReviews || []).find((item) => item.taskId === task.id);
      const run = submission?.reviewRun || null;
      let signal = null;
      if (task.assignmentConflict) signal = { kind: "assignment-conflict", title: `Assignment conflict · ${task.title}`, detail: `${task.assignmentConflict.localOwner || "A local claimant"} and ${task.assignmentConflict.remoteOwner || "a remote claimant"} both claimed this work. Cerbanimo preserved both claims for a human choice.`, priority: "urgent" };
      else if (task.status === "submitted") signal = { kind: "evidence-ready", title: `Evidence ready · ${task.title}`, detail: "The saved evidence still needs to be frozen and sent through the selected-model review.", priority: "high" };
      else if (task.status === "evidence_closed" && (!review || ["failed","interrupted","cancelled","incomplete"].includes(run?.status))) signal = { kind: "review-incomplete", title: `Review needs attention · ${task.title}`, detail: run?.error || "The frozen evidence is waiting for a complete selected-model verdict.", priority: "high" };
      else if (task.status === "rejected" || review?.verdict === "repair" || review?.verdict === "reject") signal = { kind: "revision-requested", title: `Revision requested · ${task.title}`, detail: review?.reason || "Cerbanimo returned this work for repair and resubmission.", priority: "urgent" };
      else if (task.status === "audit_disputed") signal = { kind: "audit-disputed", title: `Audit disputed · ${task.title}`, detail: "The work remains recorded, but the coin escrow is disputed and an appeal is available.", priority: "high" };
      else if (task.status === "appeal_pending") signal = { kind: "appeal-pending", title: `Appeal pending · ${task.title}`, detail: "A fresh independent audit circle is reviewing the disputed escrow.", priority: "normal" };
      else if (["completed","settled"].includes(task.status)) signal = { kind: "task-accepted", title: `Accepted · ${task.title}`, detail: "Cerbanimo recorded accepted work and its durable receipt.", priority: "normal", state: "resolved" };
      if (signal) signals.push({
        signalId: `task:${task.id}:${signal.kind}`, kind: signal.kind, subjectType: "task", subjectId: task.id,
        title: signal.title, detail: signal.detail, priority: signal.priority, state: signal.state || "human-action-required",
        deepLink: campusDeepLink("task", task.id),
      });
    }
    for (const contract of (state.reviewContracts || []).filter((item) => item.status === "collecting")) {
      const task = (state.tasks || []).find((item) => item.id === contract.taskId);
      signals.push({ signalId: `audit:${contract.id}`, kind: "audit-available", subjectType: "audit", subjectId: contract.id,
        title: `Independent audit available · ${task?.title || "work claim"}`, detail: "Cerbanimo has an open evidence audit. Claim it only if you can review independently.",
        priority: "normal", state: "human-action-required", deepLink: campusDeepLink("audit", contract.id) });
    }
    return signals;
  }

  function broadcastAttentionChanges() {
    const api = host(); if (!api) return;
    const state = api.getState();
    state.civweave = state.civweave || {};
    const previous = state.civweave.attentionSignals && typeof state.civweave.attentionSignals === "object" ? state.civweave.attentionSignals : {};
    const current = {};
    for (const signal of attentionSignals(state)) {
      const fingerprint = JSON.stringify([signal.state, signal.title, signal.detail, signal.deepLink]);
      current[signal.signalId] = { ...signal, fingerprint };
      if (previous[signal.signalId]?.fingerprint === fingerprint) continue;
      post({ type: "civweave:action-signal", contractVersion: ACTION_SIGNAL_CONTRACT, sourceApplication: "cerbanimo", ...signal, timestamp: new Date().toISOString() });
    }
    for (const [signalId, prior] of Object.entries(previous)) {
      if (current[signalId] || !prior || prior.state === "resolved") continue;
      post({ type: "civweave:action-signal", contractVersion: ACTION_SIGNAL_CONTRACT, sourceApplication: "cerbanimo",
        signalId, kind: prior.kind || "attention", subjectType: prior.subjectType || "object", subjectId: prior.subjectId || signalId,
        title: prior.title || "Cerbanimo action resolved", detail: "The underlying Cerbanimo state no longer requires attention.",
        priority: "normal", state: "resolved", deepLink: prior.deepLink || null, timestamp: new Date().toISOString() });
    }
    state.civweave.attentionSignals = current;
    api.setState(state);
  }

  function partyStatusMessage() {
    const api = host(); if (!api) return null;
    const state = api.getState();
    const selectedQuestId = state.ui?.selectedQuestId;
    const party = (state.parties || []).find((item) => item.questId === selectedQuestId)
      || (state.parties || []).find((item) => (item.members || []).length > 1 || (state.invites || []).some((invite) => invite.partyId === item.id))
      || (state.parties || [])[0];
    if (!party) return { type: "civweave:party-status", contractVersion: PARTY_STATUS_CONTRACT, sourceApplication: "cerbanimo", status: "empty", updatedAt: "1970-01-01T00:00:00.000Z", revision: 0 };
    const quest = (state.quests || []).find((item) => item.id === party.questId || item.sourcePartyId === party.id);
    if (!quest) return { type: "civweave:party-status", contractVersion: PARTY_STATUS_CONTRACT, sourceApplication: "cerbanimo", status: "empty", updatedAt: "1970-01-01T00:00:00.000Z", revision: 0 };
    const localAlias = projectText(state.profile?.name || state.profile?.alias || "Local steward", 100);
    const partyInvites = (state.invites || []).filter((invite) => invite.partyId === party.id).slice(0, 24);
    const partyTasks = (state.tasks || []).filter((task) => task.questId === quest.id).slice(0, 80);
    const activity = (state.partyActivity || []).filter((item) => item.partyId === party.id || item.questId === quest.id).slice(0, 20);
    const candidateTimes = [party.updatedAt, quest.updatedAt, state.relay?.lastSyncAt, ...partyTasks.map((task) => task.updatedAt || task.createdAt), ...partyInvites.map((invite) => invite.revokedAt || invite.createdAt), ...activity.map((item) => item.createdAt)].filter(Boolean).map((value) => Date.parse(value)).filter(Number.isFinite);
    const revision = candidateTimes.length ? Math.max(...candidateTimes) : Date.now();
    const updatedAt = new Date(revision).toISOString();
    return {
      type: "civweave:party-status", contractVersion: PARTY_STATUS_CONTRACT, sourceApplication: "cerbanimo", status: "active",
      partyId: projectId(party.id), questId: projectId(quest.id), questTitle: projectText(quest.title, 220), partyName: projectText(party.name, 220), localAlias,
      members: (party.members || []).slice(0, 24).map((member) => ({
        fingerprint: projectId(member.fingerprint), alias: projectText(member.alias, 100),
        roleName: projectText(member.roleName || (party.roles || []).find((role) => role.id === member.roleId)?.name || member.roleId, 100),
        status: projectText(member.status || "active", 40), local: Boolean(member.local),
      })).filter((member) => member.fingerprint),
      invitations: partyInvites.map((invite) => ({
        id: projectId(invite.id), direction: invite.direction === "incoming" ? "incoming" : "outgoing",
        status: ["received","open","accepted","revoked","expired"].includes(invite.status) ? invite.status : "open",
        roleName: projectText(invite.roleName, 100), expiresAt: invite.expiresAt || invite.capsule?.payload?.expiresAt || null,
      })).filter((invite) => invite.id),
      tasks: partyTasks.map((task) => ({
        id: projectId(task.id), title: projectText(task.title, 180), status: projectText(task.status, 50), owner: projectText(task.owner || "Unassigned", 100),
        assignedToSelf: Boolean(task.owner && task.owner !== "Unassigned" && [state.profile?.name, state.profile?.alias].filter(Boolean).includes(task.owner)),
        dependencyCount: Array.isArray(task.dependencyIds) ? task.dependencyIds.length : 0,
        assignmentConflict: task.assignmentConflict ? { localOwner: projectText(task.assignmentConflict.localOwner, 100), remoteOwner: projectText(task.assignmentConflict.remoteOwner, 100), detectedAt: task.assignmentConflict.detectedAt } : null,
      })).filter((task) => task.id),
      relay: { enabled: Boolean(state.relay?.enabled), mode: projectText(state.relay?.mode || "stopped", 40), healthy: Boolean(state.relay?.enabled && !state.relay?.lastError), queued: (state.syncOutbox || []).filter((item) => item.partyId === party.id).length, unread: Number(state.ui?.unreadPartyUpdates || 0), lastSyncAt: state.relay?.lastSyncAt || null, lastError: projectText(state.relay?.lastError, 500) || null },
      recentActivity: activity.map((item) => ({ id: projectId(item.id), summary: projectText(item.summary, 360), actorAlias: projectText(item.actorAlias, 100), type: projectText(item.type, 80), remote: Boolean(item.remote), createdAt: item.createdAt })).filter((item) => item.id),
      updatedAt, revision,
    };
  }

  function broadcastPartyStatus(force = false) {
    const message = partyStatusMessage(); if (!message) return;
    const fingerprint = JSON.stringify(message);
    if (!force && fingerprint === lastPartyStatusFingerprint) return;
    lastPartyStatusFingerprint = fingerprint;
    post(message);
  }

  function decodeInvitationHash(value) {
    const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  async function receivePartyDiscovery(data) {
    const actionId = projectId(data.actionId, "");
    if (data.contractVersion !== PARTY_DISCOVERY_CONTRACT || data.sourceApplication !== "civweave" || data.authoritativeMembership !== false) return;
    const discoveryId = projectId(data.discoveryId), partyId = projectId(data.partyId);
    if (!discoveryId || !partyId || !discoveryId.startsWith("host-party:")) {
      post({ type: "civweave:navigation-receipt", contractVersion: NAVIGATION_CONTRACT, sourceApplication: "cerbanimo", actionId, status: "unavailable", detail: "The host-node party discovery record was malformed." }); return;
    }
    const api = await waitForHost();
    if (!api) { post({ type: "civweave:navigation-receipt", contractVersion: NAVIGATION_CONTRACT, sourceApplication: "cerbanimo", actionId, status: "unavailable", detail: "Cerbanimo did not finish initializing." }); return; }
    const state = api.getState();
    state.civweave = state.civweave || {};
    state.civweave.partyDiscoveries = Array.isArray(state.civweave.partyDiscoveries) ? state.civweave.partyDiscoveries : [];
    if (!state.civweave.partyDiscoveries.some((item) => item.discoveryId === discoveryId)) state.civweave.partyDiscoveries.unshift({ discoveryId, partyId, title: projectText(data.title, 220), purpose: projectText(data.purpose, 1200), expiresAt: projectText(data.expiresAt, 80), receivedAt: new Date().toISOString(), authoritativeMembership: false });
    api.setState(state);
    const rawRoute = projectText(data.invitationUrl, 16000);
    if (!rawRoute) {
      post({ type: "civweave:navigation-receipt", contractVersion: NAVIGATION_CONTRACT, sourceApplication: "cerbanimo", actionId, status: "unavailable", detail: "The beacon was discovered, but its owner did not attach a signed Cerbanimo invitation. No membership changed." }); return;
    }
    try {
      const route = new URL(rawRoute, location.href);
      const host = route.hostname.toLowerCase();
      const localHttp = route.protocol === "http:" && (host === "localhost" || host === "127.0.0.1" || host === "::1" || /^10\./.test(host) || /^192\.168\./.test(host) || /^172\.(1[6-9]|2\d|3[01])\./.test(host));
      if (!(route.protocol === "https:" || localHttp) || route.username || route.password) throw new Error("Invitation route is not trusted.");
      let capsule = null;
      const hashMatch = route.hash.match(/^#invite=([^&]+)/);
      if (hashMatch) capsule = decodeInvitationHash(decodeURIComponent(hashMatch[1]));
      else if (typeof api.fetchInviteCapsule === "function") capsule = await api.fetchInviteCapsule(route.toString());
      if (!capsule || typeof api.openReceivedInvite !== "function") throw new Error("Signed invitation could not be loaded.");
      await api.openReceivedInvite(capsule);
      post({ type: "civweave:navigation-receipt", contractVersion: NAVIGATION_CONTRACT, sourceApplication: "cerbanimo", actionId, status: "opened", detail: "Cerbanimo validated and opened the signed invitation for review. Membership has not been granted yet." });
      broadcastAttentionChanges();
    } catch (error) {
      post({ type: "civweave:navigation-receipt", contractVersion: NAVIGATION_CONTRACT, sourceApplication: "cerbanimo", actionId, status: "unavailable", detail: `The party beacon was found, but Cerbanimo could not validate its signed invitation: ${projectText(error?.message || error, 420)}` });
    }
  }

  async function navigateObject(data) {
    if (data.contractVersion !== NAVIGATION_CONTRACT || data.sourceApplication !== "civweave") return;
    const api = await waitForHost();
    const object = projectText(data.object, 40), id = projectId(data.id), actionId = projectId(data.actionId, "");
    if (!api || !id || !["project","quest","task","invitation","review","audit","appeal","receipt"].includes(object)) {
      post({ type: "civweave:navigation-receipt", contractVersion: NAVIGATION_CONTRACT, sourceApplication: "cerbanimo", actionId, status: "unavailable", detail: "Cerbanimo could not resolve that object." }); return;
    }
    const state = api.getState();
    try {
      if (object === "task") {
        if (!(state.tasks || []).some((item) => item.id === id)) throw new Error("Task not found.");
        if (typeof api.openTask === "function") api.openTask(id); else { state.ui.selectedTaskId = id; state.ui.view = "today"; api.setState(state); }
      } else if (object === "invitation") {
        const invite = (state.invites || []).find((item) => item.id === id);
        if (!invite?.capsule) throw new Error("Invitation not found.");
        await api.openReceivedInvite(invite.capsule);
      } else if (object === "quest" || object === "project") {
        const link = object === "project" ? ensureProjectLinks(state).find((item) => item.projectRef === id || item.id === id) : null;
        const questId = object === "quest" ? id : link?.questId;
        if (questId && !(state.quests || []).some((item) => item.id === questId)) throw new Error("Quest not found.");
        state.ui.selectedQuestId = questId || state.ui.selectedQuestId;
        state.ui.view = link?.proposalId ? "kamiya" : "today";
        api.setState(state);
      } else if (["review","audit","appeal"].includes(object)) {
        const record = object === "review" ? (state.primaryReviews || []).find((item) => item.id === id) : object === "audit" ? (state.reviewContracts || []).find((item) => item.id === id) : (state.appeals || []).find((item) => item.id === id);
        if (!record) throw new Error(`${object} not found.`);
        if (record.taskId && typeof api.openTask === "function") api.openTask(record.taskId); else { state.ui.view = "review"; api.setState(state); }
      } else {
        state.ui.view = "today"; api.setState(state);
      }
      post({ type: "civweave:navigation-receipt", contractVersion: NAVIGATION_CONTRACT, sourceApplication: "cerbanimo", actionId, status: "opened", detail: `Opened the requested ${object} in Cerbanimo.` });
    } catch (error) {
      post({ type: "civweave:navigation-receipt", contractVersion: NAVIGATION_CONTRACT, sourceApplication: "cerbanimo", actionId, status: "unavailable", detail: projectText(error?.message || error, 500) });
    }
  }

  function broadcastProjectChanges() {
    const api=host();if(!api)return;
    const state=api.getState();let changed=false;
    for(const link of ensureProjectLinks(state)){
      if(!link.lastRequestIdentity)continue;
      const descriptor=projectStatusDescriptor(state,link);
      const fingerprint=[descriptor.status,descriptor.event,descriptor.reviewId||"",descriptor.evidenceRef||"",descriptor.reviewFeedback||""].join("|");
      if(link.lastBroadcastFingerprint===fingerprint)continue;
      touchLinkStatus(link,descriptor);link.lastBroadcastFingerprint=fingerprint;changed=true;
      post(projectReceipt(descriptor.type,{...link.lastRequestIdentity,requestId:projectId(`signal:${link.id}:${link.statusRevision}`,link.lastRequestIdentity.requestId),timestamp:new Date().toISOString()},link,descriptor.detail,descriptor.status,descriptor));
    }
    if(changed)api.setState(state);
  }

  window.addEventListener("message", async (event) => {
    if (
      event.origin !== SUITE_ORIGIN ||
      event.source !== window.parent ||
      !event.data
    )
      return;
    if (event.data.type === "civweave:reward-settled") {
      const api=host();if(!api)return;const state=api.getState();const task=(state.tasks||[]).find(item=>item.id===event.data.taskId);if(!task)return;
      const existing=(state.settlements||[]).find(item=>item.taskId===task.id&&item.status==="released");
      if(!existing)(state.settlements||=[]).unshift({id:event.data.coinMint?.id||event.data.thresholdReceiptId||`reward-settlement:${task.id}`,taskId:task.id,questId:task.questId,status:"released",fundingMode:"conditional_labor_mint",coins:Number(event.data.coinMint?.amount||0),workTokens:0,thresholdReceiptId:event.data.thresholdReceiptId,verdictReceiptIds:event.data.verdictReceiptIds||[],coCredits:event.data.coCredits||[],createdAt:new Date().toISOString()});
      task.status="completed";task.updatedAt=new Date().toISOString();api.setState(state);
      post({type:"civweave:reward-settlement-ack",contractVersion:event.data.contractVersion,sourceApplication:"cerbanimo",submissionId:event.data.submissionId,taskId:task.id,status:"applied",detail:"Cerbanimo recorded the Fellowfare labor mint and vested Co credits without copying their balances."});
      return;
    }
    if (event.data.type === "civweave:party-discovery") {
      await receivePartyDiscovery(event.data);
      return;
    }
    if (event.data.type === "civweave:navigate-object") {
      await navigateObject(event.data);
      return;
    }
    if (event.data.type === "civweave:project-handoff-request") {
      await acceptProjectHandoff(event.data);
      return;
    }
    if (event.data.type === "civweave:project-status-request") {
      await returnProjectStatus(event.data);
      return;
    }
    if (event.data.type === "civweave:context") applyContext(event.data);
    if (event.data.type === "civweave:governance-sync") {
      applyGovernanceSync(event.data);
    }
    if (event.data.type === "civweave:intention") {
      const api = host();
      if (!api) return;
      const state = api.getState();
      state.ui.view = "kamiya";
      state.civweave = {
        ...(state.civweave || {}),
        pendingIntention: String(event.data.value || ""),
      };
      api.setState(state);
    }
    if (event.data.type === "civweave:ai-intention") {
      const api = host();
      if (!api) return;
      const requestId = String(event.data.requestId || "");
      const prompt = String(event.data.prompt || event.data.value || "")
        .trim()
        .slice(0, 12000);
      if (
        event.data.modelSettings?.sharedForThisSession &&
        typeof api.configureCivweaveModelSession === "function"
      ) {
        api.configureCivweaveModelSession(
          String(event.data.modelSettings.apiKey || ""),
        );
      }
      const journey =
        event.data.journey?.schema === "civweave.intention-journey.v1"
          ? event.data.journey
          : null;
      const state = api.getState();
      if (state.civweave?.lastRoutedRequestId === requestId) {
        post({
          type: "civweave:ai-intention-receipt",
          service: "cerbanimo",
          requestId,
          status: "accepted",
          detail: "Kamiya already accepted this routed intention.",
        });
        return;
      }
      state.ui.view = "kamiya";
      state.civweave = {
        ...(state.civweave || {}),
        pendingIntention: prompt,
        lastRoutedRequestId: requestId,
        routePlan: event.data.routePlan || null,
        routedModel: event.data.model || null,
        activeJourney: journey || state.civweave?.activeJourney || null,
        journeyPurpose: String(event.data.purpose || "open-project"),
        journeyReceivedAt: journey ? new Date().toISOString() : null,
        routedAt: new Date().toISOString(),
      };
      api.setState(state);
      post({
        type: "civweave:ai-intention-receipt",
        service: "cerbanimo",
        requestId,
        status: "accepted",
        detail: journey
          ? "Kamiya accepted the reviewed project blueprint as a proposal-ready planning turn."
          : "Kamiya accepted the routed intention as a reviewable turn.",
      });
      Promise.resolve(api.dispatchKamiya(prompt))
        .then(() =>
          post({
            type: "civweave:ai-intention-receipt",
            service: "cerbanimo",
            requestId,
            status: "delivered",
            detail: journey
              ? "Kamiya translated the intention journey into a reviewable project proposal. Cerbanimo changed no quest until you inspect and ratify it."
              : "Kamiya generated a draft or proposal. Cerbanimo changed no quest until you inspect and confirm it.",
          }),
        )
        .catch((error) =>
          post({
            type: "civweave:ai-intention-receipt",
            service: "cerbanimo",
            requestId,
            status: "failed",
            detail: `Kamiya kept the prompt, but its selected model needs attention: ${error.message}`,
          }),
        );
    }
    if (event.data.type === "civweave:request-plan") {
      const payload = selectedPlanPayload();
      if (payload) {
        post({
          type: "civweave:handoff",
          source: "cerbanimo",
          target: event.data.target || "anarchadia",
          kind: "proposal",
          title: `Community proposal · ${payload.plan.title}`,
          payload,
        });
      }
    }
    if (event.data.type === "civweave:governance-receipt") {
      const api = host();
      if (!api) return;
      const state = api.getState();
      state.civweave = {
        ...(state.civweave || {}),
        lastGovernanceReceipt: {
          id: String(event.data.id || ""),
          status: String(event.data.status || "voting"),
          detail: String(event.data.detail || ""),
          receivedAt: new Date().toISOString(),
        },
      };
      api.setState(state);
    }
    if (event.data.type === "civweave:import-capstone") {
      post({
        type: "civweave:handoff",
        source: "living",
        target: "cerbanimo",
        kind: "capstone-received",
        title: event.data.payload?.quest?.title || "Living School capstone",
        payload: event.data.payload || {},
      });
    }
  });

  document.addEventListener("click", (event) => {
    const button = event.target.closest("#exportAnarchadiaButton");
    if (!button) return;
    const payload = selectedPlanPayload();
    if (!payload) return;
    post({
      type: "civweave:handoff",
      source: "cerbanimo",
      target: "anarchadia",
      kind: "proposal",
      title: `Community proposal · ${payload.plan.title}`,
      payload,
    });
  });


  const rewardBroadcastState = {
    quests: new Map(),
    rewards: new Set(),
    settlements: new Set(),
    validatorRewards: new Set(),
  };

  function taskEffort(task = {}) {
    const text = `${task.title || ""} ${task.description || ""}`.toLowerCase();
    const estimatedHours = Number(task.estimatedHours || (/publish|deploy|build|repair|facilitat|organize|interview/.test(text) ? 6 : /research|design|draft|test|review/.test(text) ? 3 : 2));
    const difficulty = /expert|regulated|safety-critical|structural|legal|medical|production/.test(text) ? "expert" : /advanced|architecture|multi-device|federat|complex|migration/.test(text) ? "advanced" : /build|repair|facilitat|coordinate|integrate|validate/.test(text) ? "capable" : /research|practice|draft|plan|learn/.test(text) ? "developing" : "introductory";
    const difficultyMultiplier = { introductory:.85, developing:1, capable:1.2, advanced:1.45, expert:1.8 }[difficulty];
    const automatability = Number.isFinite(Number(task.automatability)) ? Math.max(0,Math.min(.95,Number(task.automatability))) : task.automation === "automated" ? .75 : task.automation === "human" ? .15 : .45;
    const humanDependenceMultiplier = Math.max(.2,1-automatability);
    const score = Number((estimatedHours*difficultyMultiplier*humanDependenceMultiplier).toFixed(2));
    return { estimatedHours, difficulty, difficultyMultiplier, automatability, humanDependenceMultiplier:Number(humanDependenceMultiplier.toFixed(2)), score, proposedCoCredits:Math.max(1,Math.round(score*10)), rationale:`${estimatedHours}h × ${difficultyMultiplier.toFixed(2)} difficulty × ${humanDependenceMultiplier.toFixed(2)} human dependence` };
  }

  async function broadcastRewardChanges() {
    const api = host();
    if (!api || window.parent === window) return;
    const state = api.getState();
    for (const quest of state.quests || []) {
      const tasks = (state.tasks || []).filter((task) => task.questId === quest.id);
      const signature = JSON.stringify(tasks.map((task) => [task.id,task.updatedAt,task.rewardXp,task.rewardCoins,task.rewardTokens,task.skillTags,task.skillRewards]));
      if (rewardBroadcastState.quests.get(quest.id) === signature) continue;
      rewardBroadcastState.quests.set(quest.id, signature);
      post({
        type:"civweave:quest-rewards-proposed",
        contractVersion:"civweave.reward-weave.v1.1",
        sourceApplication:"cerbanimo",
        quest:{ id:quest.id, title:quest.title, description:quest.description },
        tasks:tasks.map((task) => ({
          id:task.id,title:task.title,description:task.description,proofRequirement:task.proofRequirement,
          rewardXp:Number(task.rewardXp||0),rewardCoins:Number(task.rewardCoins||0),legacyRewardTokens:Number(task.rewardTokens||0),
          skillTags:[...(task.skillTags||[])],skillRewards:[...(task.skillRewards||[])],automation:task.automation,...taskEffort(task),
        })),
        automaticEffect:false,
      });
    }
    for (const reward of state.rewards || []) {
      if (reward.kind !== "xp" || rewardBroadcastState.rewards.has(reward.id)) continue;
      rewardBroadcastState.rewards.add(reward.id);
      const task=(state.tasks||[]).find((item)=>item.id===reward.taskId); if(!task)continue;
      const submission=(state.submissions||[]).find((item)=>item.taskId===task.id);
      const evidenceText=`${submission?.evidence||""}

Reflection: ${submission?.reflection||""}`.trim();
      const evidenceHash=await api.digestHex?.(evidenceText).catch?.(()=>null)||await crypto.subtle.digest("SHA-256",new TextEncoder().encode(evidenceText)).then(buffer=>[...new Uint8Array(buffer)].map(value=>value.toString(16).padStart(2,"0")).join(""));
      post({
        type:"civweave:reward-submission",
        contractVersion:"civweave.reward-weave.v1.1",
        sourceApplication:"cerbanimo",
        submission:{
          id:`cerbanimo:${task.questId}:${task.id}`,
          source:"cerbanimo",kind:"task",subjectId:task.id,subjectTitle:task.title,questId:task.questId,
          contributorId:(()=>{try{return JSON.parse(localStorage.getItem("civweave-identity-vault")||"null")?.identity?.identityId||state.identity?.fingerprint||state.profile?.alias||"local-contributor"}catch{return state.identity?.fingerprint||state.profile?.alias||"local-contributor"}})(),
          contributorName:state.profile?.name||state.profile?.alias||"Local contributor",
          contributors:[{contributorId:(()=>{try{return JSON.parse(localStorage.getItem("civweave-identity-vault")||"null")?.identity?.identityId||state.identity?.fingerprint||state.profile?.alias||"local-contributor"}catch{return state.identity?.fingerprint||state.profile?.alias||"local-contributor"}})(),contributorName:state.profile?.name||state.profile?.alias||"Local contributor",shareBps:10000}],
          description:task.description,evidenceSummary:evidenceText,
          evidenceRefs:[submission?.id,reward.reviewId].filter(Boolean),
          evidenceArtifacts:[{id:`cerbanimo-evidence:${submission?.id||task.id}`,name:`Evidence for ${task.title}`,mimeType:"text/plain",bytes:new TextEncoder().encode(evidenceText).byteLength,sha256:evidenceHash,contentHash:`sha256:${evidenceHash}`,inlineText:evidenceText,sourceRef:submission?.id||task.id,availability:"inline",createdAt:submission?.updatedAt||reward.createdAt||new Date().toISOString()}],
          skillTags:[...(task.skillTags||[])],skillRewards:[...(task.skillRewards||[])],
          baseXp:Number(task.rewardXp||reward.xp||0),baseAlreadyCredited:false,validationThreshold:Number(state.policy?.validationThreshold||2),
          escrowCoins:Number(task.rewardCoins||0),rewardCoins:Number(task.rewardCoins||0),fundingMode:"conditional-labor-mint",...taskEffort(task),createdAt:reward.createdAt||new Date().toISOString(),
        },
      });
    }
    for (const settlement of state.settlements || []) {
      if (settlement.status !== "released" || rewardBroadcastState.settlements.has(settlement.id)) continue;
      rewardBroadcastState.settlements.add(settlement.id);
      post({
        type:"civweave:reward-threshold-reached",
        contractVersion:"civweave.reward-weave.v1.1",
        sourceApplication:"cerbanimo",
        settlement:{ id:settlement.id, receiptId:settlement.ledgerEventHash||settlement.id, fundingMode:"conditional-labor-mint", submissionId:`cerbanimo:${settlement.questId}:${settlement.taskId}`, taskId:settlement.taskId, questId:settlement.questId, coins:Number(settlement.coins||0), legacyWorkTokens:Number(settlement.workTokens||0), createdAt:settlement.createdAt },
      });
    }
    for (const capsule of state.capsules || []) {
      if (capsule.kind !== "validator-reward" || rewardBroadcastState.validatorRewards.has(capsule.id)) continue;
      rewardBroadcastState.validatorRewards.add(capsule.id);
      post({
        type:"civweave:validator-reward",
        contractVersion:"civweave.reward-weave.v1.1",
        sourceApplication:"cerbanimo",
        reward:{ id:capsule.id, validatorId:capsule.issuer?.fingerprint||state.identity?.fingerprint||"local-validator", amount:Number(capsule.payload?.amount||0), validationId:capsule.payload?.validationId||capsule.payload?.claimId||capsule.id, reason:capsule.payload?.reason||"Independent proof-of-human-labor validation", createdAt:capsule.createdAt||new Date().toISOString() },
      });
    }
  }

  let attempts = 0;
  const readyTimer = setInterval(() => {
    attempts += 1;
    if (host()) {
      clearInterval(readyTimer);
      document.documentElement.dataset.civweave = "connected";
      window.setInterval(() => { broadcastProjectChanges(); broadcastAttentionChanges(); broadcastPartyStatus(); broadcastRewardChanges().catch(()=>undefined); }, 1500);
      broadcastAttentionChanges();
      broadcastPartyStatus(true);
      broadcastRewardChanges().catch(()=>undefined);
      post({
        type: "civweave:ready",
        service: "cerbanimo",
        version: "1.7.0-unbroken-thread",
        capabilities: [
          "capstone-import",
          "proof-validation",
          "proposal-export",
          "quest-board",
          "suite-model",
          "ai-intention",
          "intention-journey-v1",
          "project-blueprint",
          "cerbanimo-project-contract-v1",
          "acknowledged-project-handoff",
          "project-status-receipts",
          "project-receipt-revisions",
          "event-driven-project-status",
          "evidence-bound-project-acceptance",
          "action-signal-v1",
          "object-navigation-v1",
          "invitation-attention",
          "party-discovery-v1",
          "party-status-v1",
          "assignment-conflict-attention",
          "proof-attention",
          "reward-integrity-v1.1",
          "moss-skill-tagging",
          "effort-credit-proposals",
          "canonical-reward-receipts",
        ],
      });
    } else if (attempts > 100) {
      clearInterval(readyTimer);
    }
  }, 100);
})();
