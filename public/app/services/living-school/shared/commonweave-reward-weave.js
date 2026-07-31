/* Commonweave Reward Weave browser runtime v1.1. Generated from app/reward-weave.ts. */
(()=>{const exports={};
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEGACY_REWARD_STORAGE_KEYS = exports.REWARD_STORAGE_KEYS = exports.THRESHOLD_PROTOCOL = exports.LEGACY_VALIDATION_PROTOCOL = exports.VALIDATION_PROTOCOL = exports.LEGACY_REWARD_PROTOCOL = exports.REWARD_PROTOCOL = void 0;
exports.rewardId = rewardId;
exports.skillSlug = skillSlug;
exports.canonicalSkillSlug = canonicalSkillSlug;
exports.levelForXp = levelForXp;
exports.xpForLevel = xpForLevel;
exports.levelUpCoinAmount = levelUpCoinAmount;
exports.calculateEffortEstimate = calculateEffortEstimate;
exports.mossTagTask = mossTagTask;
exports.emptyRewardState = emptyRewardState;
exports.registerQuestRewards = registerQuestRewards;
exports.submitRewardAchievement = submitRewardAchievement;
exports.requestFreshValidation = requestFreshValidation;
exports.recordValidationReceipt = recordValidationReceipt;
exports.recordThresholdReceipt = recordThresholdReceipt;
exports.forceThresholdReceipt = forceThresholdReceipt;
exports.mergeSkills = mergeSkills;
exports.rebuildCanonicalLedgers = rebuildCanonicalLedgers;
exports.migrateRewardWeaveState = migrateRewardWeaveState;
exports.mergeRewardWeaveStates = mergeRewardWeaveStates;
exports.ownershipProjection = ownershipProjection;
exports.rewardSummary = rewardSummary;
exports.recordExternalCoinReward = recordExternalCoinReward;
exports.REWARD_PROTOCOL = "commonweave.reward-weave.v1.1";
exports.LEGACY_REWARD_PROTOCOL = "commonweave.reward-weave.v1";
exports.VALIDATION_PROTOCOL = "commonweave.validation-packet.v1.1";
exports.LEGACY_VALIDATION_PROTOCOL = "commonweave.validation-packet.v1";
exports.THRESHOLD_PROTOCOL = "commonweave.validation-threshold.v1";
const DIFFICULTY_MULTIPLIERS = {
    introductory: 0.85,
    developing: 1,
    capable: 1.2,
    advanced: 1.45,
    expert: 1.8,
};
exports.REWARD_STORAGE_KEYS = {
    living: "living-school.reward-ledger.v1.1",
    fellowfare: "fellowfare.reward-ledger.v1.1",
    co: "cerbanimo.co-ledger.v1",
    validation: "commonweave.validation-ledger.v1.1",
    chronicle: "commonweave.chronicle-ledger.v1.1",
};
exports.LEGACY_REWARD_STORAGE_KEYS = {
    living: "living-school.reward-ledger.v1",
    fellowfare: "fellowfare.reward-ledger.v1",
    co: "co.ownership-ledger.v1",
    validation: "commonweave.validation-ledger.v1",
    chronicle: "commonweave.chronicle-ledger.v1",
};
function now() { return new Date().toISOString(); }
function rewardId(prefix) {
    const random = globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2);
    return `${prefix}:${random}`;
}
function skillSlug(value) {
    return String(value || "general-practice")
        .trim().toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "general-practice";
}
const SKILL_EQUIVALENTS = {
    "basic-carpentry": "carpentry",
    "beginner-carpentry": "carpentry",
    woodworking: "carpentry",
    "wood-construction": "carpentry",
    "repair-documentation": "technical-documentation",
    documentation: "technical-documentation",
    "governance-practice": "governance",
    "software-development": "software-making",
    coding: "software-making",
};
function canonicalSkillSlug(value) {
    const candidate = skillSlug(value);
    return SKILL_EQUIVALENTS[candidate] || candidate;
}
function levelForXp(xp) { return Math.floor(Math.sqrt(Math.max(0, Number(xp || 0)) / 40)) + 1; }
function xpForLevel(level) { const normalized = Math.max(1, Math.floor(level)); return Math.pow(normalized, 2) * 40; }
function levelUpCoinAmount(level) { if (level >= 10)
    return 5; if (level >= 7)
    return 4; if (level >= 4)
    return 3; return 2; }
function calculateEffortEstimate(input) {
    const difficulty = input.difficulty || inferDifficulty(input.taskText || "");
    const estimatedHours = Math.max(0.25, Math.min(500, Number(input.estimatedHours || inferHours(input.taskText || ""))));
    const automatability = Math.max(0, Math.min(0.95, Number(input.automatability ?? inferAutomatability(input.taskText || ""))));
    const difficultyMultiplier = DIFFICULTY_MULTIPLIERS[difficulty];
    const humanDependenceMultiplier = Math.max(0.2, 1 - automatability);
    const score = Number((estimatedHours * difficultyMultiplier * humanDependenceMultiplier).toFixed(2));
    return { estimatedHours, difficulty, difficultyMultiplier, automatability, humanDependenceMultiplier: Number(humanDependenceMultiplier.toFixed(2)), score,
        proposedCoCredits: Math.max(1, Math.round(score * 10)), rationale: `${estimatedHours}h × ${difficultyMultiplier.toFixed(2)} difficulty × ${humanDependenceMultiplier.toFixed(2)} human dependence` };
}
function inferHours(text) {
    const match = String(text).match(/(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)/i);
    if (match)
        return Number(match[1]);
    if (/publish|deploy|build|repair|facilitat|organize|interview/i.test(text))
        return 6;
    if (/research|design|draft|test|review/i.test(text))
        return 3;
    return 2;
}
function inferDifficulty(text) {
    if (/expert|regulated|safety-critical|structural|legal|medical|production/i.test(text))
        return "expert";
    if (/advanced|architecture|multi-device|federat|complex|migration/i.test(text))
        return "advanced";
    if (/build|repair|facilitat|coordinate|integrate|validate/i.test(text))
        return "capable";
    if (/research|practice|draft|plan|learn/i.test(text))
        return "developing";
    return "introductory";
}
function inferAutomatability(text) {
    if (/generate|format|convert|summari[sz]e|compile|transcribe|automate/i.test(text))
        return 0.75;
    if (/research|draft|code|design|analy[sz]e/i.test(text))
        return 0.5;
    if (/repair|deliver|interview|meet|facilitat|build physical|field/i.test(text))
        return 0.15;
    return 0.35;
}
const SKILL_RULES = [
    { pattern: /research|source|investigat|evidence/i, name: "Research", parent: "Inquiry", definition: "Find, compare, preserve, and responsibly apply useful evidence." },
    { pattern: /write|document|publish|story|explain/i, name: "Technical Documentation", parent: "Communication", definition: "Shape practical information into clear, testable, reusable documentation." },
    { pattern: /code|software|debug|program|api|database/i, name: "Software Making", parent: "Making", definition: "Design, build, test, and maintain working software systems." },
    { pattern: /build|make|prototype|repair|fabricat|construct/i, name: "Practical Making", parent: "Making", definition: "Turn plans and materials into inspectable practical results." },
    { pattern: /coordinate|community|facilitat|teach|steward|organize/i, name: "Stewardship", parent: "Cooperation", definition: "Coordinate people, responsibilities, and shared resources without obscuring consent." },
    { pattern: /test|verify|audit|proof|review|quality/i, name: "Verification", parent: "Judgment", definition: "Evaluate evidence against explicit criteria and communicate a defensible verdict." },
    { pattern: /trade|market|exchange|inventory|budget|resource|price/i, name: "Exchange Design", parent: "Mutual Provision", definition: "Design consent-based exchanges, terms, conditional issuance, settlement, and repair." },
    { pattern: /vote|govern|proposal|policy|charter|rights|dissent/i, name: "Governance", parent: "Collective Decision", definition: "Make collective authority, limits, rights, dissent, and outcomes inspectable." },
];
function mossTagTask(input) {
    const text = `${input.title} ${input.description || ""} ${input.proof || ""}`;
    const explicitSkillRewards = Boolean(input.skillRewards?.length);
    const raw = explicitSkillRewards ? (input.skillRewards ?? []) : (input.skillTags ?? []);
    const proposed = raw.map((item) => typeof item === "string" ? { name: item } : item).filter((item) => String(item.name || item.slug || "").trim());
    if (!explicitSkillRewards)
        for (const rule of SKILL_RULES) {
            if (rule.pattern.test(text) && !proposed.some((item) => canonicalSkillSlug(String(item.name || item.slug)) === canonicalSkillSlug(rule.name))) {
                proposed.push({ name: rule.name, parent: rule.parent, definition: rule.definition, confidence: 0.9, rationale: `Moss matched the task language to ${rule.name}.` });
            }
        }
    if (!proposed.length)
        proposed.push({ name: "General Practice", parent: "Practice", definition: "Carry a bounded task through action, evidence, and reflection.", confidence: 0.62 });
    const totalXp = Math.max(10, Number(input.rewardXp || 40));
    const explicit = proposed.map((item) => Math.max(0, Number(item.xp ?? item.baseXp ?? 0)));
    const explicitTotal = explicit.reduce((sum, value) => sum + value, 0);
    const weights = proposed.map((item, index) => explicitTotal ? explicit[index] : Math.max(0.25, Number(item.confidence || 0.75)));
    const weightTotal = weights.reduce((sum, value) => sum + value, 0) || proposed.length;
    let remaining = totalXp;
    const xpAmounts = proposed.map((_, index) => {
        if (index === proposed.length - 1)
            return Math.max(1, remaining);
        const amount = Math.max(1, Math.round(totalXp * weights[index] / weightTotal));
        remaining -= amount;
        return amount;
    });
    const difficulty = inferDifficulty(text);
    const seen = new Set();
    return proposed.slice(0, 8).map((item, index) => {
        const name = String(item.name || item.slug || "General Practice");
        let slug = canonicalSkillSlug(String(item.slug || name));
        if (seen.has(slug))
            slug = `${slug}-${index + 1}`;
        seen.add(slug);
        const aliases = [...new Set([...(Array.isArray(item.aliases) ? item.aliases.map(String) : []), ...(canonicalSkillSlug(name) !== skillSlug(name) ? [name] : [])])];
        return {
            slug, name, parent: String(item.parent || "Practice"), aliases,
            definition: String(item.definition || `Demonstrated capability related to ${name}.`), status: "provisional", confidence: Math.max(0, Math.min(1, Number(item.confidence || 0.78))),
            difficulty, baseXp: xpAmounts[index], xpRationale: String(item.rationale || `Moss allocated ${xpAmounts[index]} of ${totalXp} task XP to ${name}.`), registryMatch: canonicalSkillSlug(name),
            evidenceRubric: (Array.isArray(item.evidenceRubric) ? item.evidenceRubric : Array.isArray(item.rubric) ? item.rubric : [
                `The result for ${input.title} can be inspected.`, "The submission addresses the task's proof requirement.", "The contributor identifies what changed, what was tested, and any remaining limits.",
            ]).map(String).slice(0, 8),
        };
    });
}
function emptyLiving(updatedAt) { return { schema: "living-school.skill-ledger.v1.1", skills: {}, xpReceipts: [], levelRewardKeys: [], mergedSkillSlugs: {}, updatedAt }; }
function emptyFellowfare(updatedAt) { return { schema: "fellowfare.coin-ledger.v1.1", balances: {}, receipts: [], escrows: [], processedKeys: [], issuancePolicy: { mode: "proof-of-human-labor", description: "Coins are conditionally minted after validated human labor or useful validation service.", validatorBounty: 2, version: 1 }, updatedAt }; }
function emptyRewardState() {
    const updatedAt = now();
    return { living: emptyLiving(updatedAt), fellowfare: emptyFellowfare(updatedAt), co: { schema: "cerbanimo.co-ledger.v1", credits: [], updatedAt },
        validation: { schema: "commonweave.validation-ledger.v1.1", submissions: [], packets: [], receipts: [], thresholdReceipts: [], completedSubmissionIds: [], processedExchangeIds: [], updatedAt },
        chronicle: { schema: "commonweave.chronicle-ledger.v1.1", entries: [], updatedAt } };
}
function cloneState(state) { return JSON.parse(JSON.stringify(state)); }
function normalizedShares(submission) {
    const shares = submission.contributors?.filter((item) => item.contributorId && item.shareBps > 0) || [];
    if (!shares.length)
        return [{ contributorId: submission.contributorId, contributorName: submission.contributorName, shareBps: 10000 }];
    const total = shares.reduce((sum, item) => sum + Number(item.shareBps || 0), 0) || 1;
    let remaining = 10000;
    return shares.map((item, index) => {
        const shareBps = index === shares.length - 1 ? remaining : Math.max(1, Math.round(Number(item.shareBps || 0) / total * 10000));
        remaining -= shareBps;
        return { ...item, shareBps };
    });
}
function normalizeArtifact(value, fallbackIndex = 0) {
    if (!value || typeof value !== "object")
        return null;
    const raw = value;
    const inlineText = String(raw.inlineText || raw.text || "").slice(0, 50000);
    const sourceRef = String(raw.sourceRef || raw.url || raw.ref || "").slice(0, 2000);
    const contentHash = String(raw.contentHash || raw.sha256 || simpleHash(inlineText || sourceRef || JSON.stringify(raw))).slice(0, 180);
    if (!contentHash)
        return null;
    return { id: String(raw.id || `evidence:${contentHash}:${fallbackIndex}`).slice(0, 240), name: String(raw.name || `Evidence ${fallbackIndex + 1}`).slice(0, 240), mimeType: String(raw.mimeType || (inlineText ? "text/plain" : "application/octet-stream")).slice(0, 120),
        bytes: Math.max(0, Number(raw.bytes || inlineText.length || 0)), sha256: raw.sha256 ? String(raw.sha256).slice(0, 180) : undefined, contentHash, inlineText: inlineText || undefined, sourceRef: sourceRef || undefined,
        availability: inlineText ? "inline" : raw.sha256 ? "content-addressed" : sourceRef ? "reference-only" : "unavailable", createdAt: String(raw.createdAt || now()).slice(0, 80) };
}
function simpleHash(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}
function submissionArtifacts(submission) {
    const explicit = (submission.evidenceArtifacts || []).map(normalizeArtifact).filter(Boolean);
    if (explicit.length)
        return explicit.slice(0, 20);
    const fromRefs = submission.evidenceRefs.map((ref, index) => normalizeArtifact({ name: `Evidence reference ${index + 1}`, sourceRef: ref, contentHash: simpleHash(ref) }, index)).filter(Boolean);
    if (submission.evidenceSummary.trim())
        fromRefs.unshift(normalizeArtifact({ name: "Contributor evidence record", inlineText: submission.evidenceSummary, contentHash: simpleHash(submission.evidenceSummary) }, 0));
    return fromRefs.slice(0, 20);
}
function registerQuestRewards(state, input) {
    const next = cloneState(state);
    for (const task of input.tasks) {
        const submissionId = `cerbanimo:${input.questId}:${task.id}`;
        const skills = mossTagTask(task);
        for (const skill of skills)
            ensureSkill(next, skill);
        if (!next.fellowfare.escrows.some((record) => record.submissionId === submissionId))
            next.fellowfare.escrows.unshift({ id: rewardId("labor-mint"), submissionId, questId: input.questId, subjectId: task.id, beneficiaryId: input.contributorId,
                amount: Math.max(0, Number(task.rewardCoins || 0)), fundingMode: "conditional-labor-mint", mintPolicyId: "fellowfare.proof-of-human-labor.v1", status: "proposed", threshold: 2, validationReceiptIds: [], createdAt: now() });
        if (!next.co.credits.some((credit) => credit.submissionId === submissionId)) {
            const effort = calculateEffortEstimate({ estimatedHours: task.estimatedHours, difficulty: task.difficulty, automatability: task.automatability, taskText: `${task.title} ${task.description || ""}` });
            const shares = task.contributors?.length ? task.contributors : [{ contributorId: input.contributorId, contributorName: input.contributorName || input.contributorId, shareBps: 10000 }];
            for (const share of normalizedShares({ id: submissionId, contributorId: input.contributorId, contributorName: input.contributorName || input.contributorId, contributors: shares })) {
                next.co.credits.unshift({ id: rewardId("cerbanimo-co"), endeavorId: input.questId, submissionId, subjectId: task.id, contributorId: share.contributorId, contributorName: share.contributorName, shareBps: share.shareBps,
                    amount: Math.max(1, Math.round(effort.proposedCoCredits * share.shareBps / 10000)), status: "proposed", effort, createdAt: now() });
            }
        }
    }
    return rebuildCanonicalLedgers(next);
}
function createPacket(submission, input) {
    return { schema: exports.VALIDATION_PROTOCOL, id: rewardId("validation-packet"), requestId: rewardId("validation-request"), submissionId: submission.id, source: submission.source,
        subjectId: submission.subjectId, subjectTitle: submission.subjectTitle, contributorId: submission.contributorId, contributorIdentityId: input?.contributorIdentityId,
        contributorDeviceId: input?.contributorDeviceId, rubric: [...new Set(submission.skills.flatMap((skill) => skill.evidenceRubric))].slice(0, 16), evidenceSummary: submission.evidenceSummary,
        evidenceRefs: submission.evidenceRefs, evidenceArtifacts: submissionArtifacts(submission), skillClaims: submission.skills.map((skill) => ({ slug: skill.slug, name: skill.name, xp: skill.baseXp, rationale: skill.xpRationale })),
        threshold: Math.max(1, submission.validationThreshold), attempt: Math.max(1, Number(submission.attempt || 1)), requestMode: input?.mode || "automatic", status: "open", supersedesPacketId: input?.supersedesPacketId,
        nonce: rewardId("nonce"), createdAt: now(), expiresAt: new Date(Date.now() + 14 * 86400000).toISOString() };
}
function submitRewardAchievement(state, submission, identity) {
    const next = cloneState(state);
    const normalizedSubmission = { ...submission, schema: exports.REWARD_PROTOCOL, skills: submission.skills.map((skill) => ({ ...skill, slug: canonicalSkillSlug(skill.slug || skill.name) })), evidenceArtifacts: submissionArtifacts(submission), attempt: Math.max(1, Number(submission.attempt || 1)) };
    if (!next.validation.submissions.some((item) => item.id === normalizedSubmission.id))
        next.validation.submissions.unshift(normalizedSubmission);
    if (!next.validation.packets.some((item) => item.submissionId === normalizedSubmission.id && item.status === "open"))
        next.validation.packets.unshift(createPacket(normalizedSubmission, { contributorIdentityId: identity?.identityId, contributorDeviceId: identity?.deviceId }));
    for (const skill of normalizedSubmission.skills)
        ensureSkill(next, skill);
    const mint = next.fellowfare.escrows.find((item) => item.submissionId === normalizedSubmission.id);
    if (mint)
        mint.status = "pending-validation";
    else if (normalizedSubmission.escrowCoins > 0)
        next.fellowfare.escrows.unshift({ id: rewardId("labor-mint"), submissionId: normalizedSubmission.id, questId: normalizedSubmission.questId, subjectId: normalizedSubmission.subjectId,
            beneficiaryId: normalizedSubmission.contributorId, amount: normalizedSubmission.escrowCoins, fundingMode: "conditional-labor-mint", mintPolicyId: "fellowfare.proof-of-human-labor.v1", status: "pending-validation", threshold: normalizedSubmission.validationThreshold, validationReceiptIds: [], createdAt: now() });
    if (normalizedSubmission.kind === "task" && !next.co.credits.some((item) => item.submissionId === normalizedSubmission.id)) {
        for (const share of normalizedShares(normalizedSubmission))
            next.co.credits.unshift({ id: rewardId("cerbanimo-co"), endeavorId: normalizedSubmission.questId || normalizedSubmission.journeyId || "personal-endeavor", submissionId: normalizedSubmission.id,
                subjectId: normalizedSubmission.subjectId, contributorId: share.contributorId, contributorName: share.contributorName, shareBps: share.shareBps, amount: Math.max(1, Math.round(normalizedSubmission.effort.proposedCoCredits * share.shareBps / 10000)),
                status: "proposed", effort: normalizedSubmission.effort, createdAt: now() });
    }
    return rebuildCanonicalLedgers(next);
}
function requestFreshValidation(state, submissionId, mode = "fresh-review") {
    const next = cloneState(state);
    const submission = next.validation.submissions.find((item) => item.id === submissionId);
    if (!submission)
        return next;
    const current = next.validation.packets.find((item) => item.submissionId === submissionId && item.status === "open");
    if (current)
        current.status = "superseded";
    const updated = { ...submission, attempt: Math.max(1, Number(submission.attempt || 1)) + 1 };
    next.validation.submissions = [updated, ...next.validation.submissions.filter((item) => item.id !== submissionId)];
    next.validation.packets.unshift(createPacket(updated, { mode, supersedesPacketId: current?.id, contributorIdentityId: current?.contributorIdentityId, contributorDeviceId: current?.contributorDeviceId }));
    next.validation.completedSubmissionIds = next.validation.completedSubmissionIds.filter((id) => id !== submissionId);
    next.validation.thresholdReceipts = next.validation.thresholdReceipts.filter((item) => item.submissionId !== submissionId);
    return rebuildCanonicalLedgers(next);
}
function validatorPrincipal(receipt) { return receipt.signature?.identityId || receipt.validatorId; }
function receiptCoversRubric(receipt, packet) {
    if (receipt.verdict !== "pass")
        return true;
    return packet.rubric.every((criterion) => receipt.rubricScores.some((score) => score.criterion === criterion && score.met));
}
function receiptInspectedEvidence(receipt, packet) {
    if (receipt.verdict !== "pass")
        return true;
    const checks = receipt.evidenceChecks || [];
    if (!packet.evidenceArtifacts.length)
        return false;
    return packet.evidenceArtifacts.every((artifact) => checks.some((check) => check.contentHash === artifact.contentHash && check.inspected));
}
function recordValidationReceipt(state, receipt) {
    const next = cloneState(state);
    if (next.validation.receipts.some((item) => item.id === receipt.id))
        return next;
    const packet = next.validation.packets.find((item) => item.id === receipt.packetId);
    if (!packet)
        throw new Error("Validation packet not found.");
    const principal = validatorPrincipal(receipt);
    const duplicateValidator = next.validation.receipts.some((item) => item.packetId === receipt.packetId && validatorPrincipal(item) === principal);
    const selfIdentity = Boolean(packet.contributorIdentityId && packet.contributorIdentityId === principal);
    const selfAccount = packet.contributorId === receipt.validatorId;
    const verified = receipt.integrity === "verified" && Boolean(receipt.signature?.identityId && receipt.signature?.deviceId && receipt.signature?.value);
    const complete = receipt.reason.trim().length >= 24 && receiptCoversRubric(receipt, packet) && receiptInspectedEvidence(receipt, packet);
    const accepted = !duplicateValidator && !selfIdentity && !selfAccount && receipt.relationship === "independent" && receipt.verdict === "pass" && verified && complete && packet.status === "open";
    next.validation.receipts.unshift({ ...receipt, acceptedForQuorum: accepted });
    return rebuildCanonicalLedgers(next);
}
function recordThresholdReceipt(state, threshold) {
    const next = cloneState(state);
    if (next.validation.thresholdReceipts.some((item) => item.id === threshold.id))
        return next;
    const packet = next.validation.packets.find((item) => item.id === threshold.packetId && item.requestId === threshold.requestId && item.submissionId === threshold.submissionId);
    if (!packet)
        throw new Error("Threshold packet not found.");
    const accepted = next.validation.receipts.filter((item) => threshold.verdictReceiptIds.includes(item.id) && item.packetId === packet.id && item.acceptedForQuorum && item.verdict === "pass");
    if (threshold.outcome === "pass" && accepted.length < packet.threshold)
        throw new Error("Threshold receipt does not reference enough accepted verdicts.");
    next.validation.thresholdReceipts.unshift({ ...threshold, verdictReceiptIds: [...new Set(accepted.map((item) => item.id))], integrity: "derived-from-verified-verdicts" });
    return rebuildCanonicalLedgers(next);
}
/** Legacy bridge retained without synthetic validators. It settles only when real accepted receipts already exist. */
function forceThresholdReceipt(state, submissionId, externalReceiptId) {
    const packet = state.validation.packets.find((item) => item.submissionId === submissionId && item.status === "open");
    if (!packet)
        return cloneState(state);
    const accepted = state.validation.receipts.filter((item) => item.packetId === packet.id && item.acceptedForQuorum && item.verdict === "pass");
    if (accepted.length < packet.threshold)
        return cloneState(state);
    return recordThresholdReceipt(state, { schema: exports.THRESHOLD_PROTOCOL, id: externalReceiptId, packetId: packet.id, requestId: packet.requestId, submissionId, verdictReceiptIds: accepted.map((item) => item.id), threshold: packet.threshold, outcome: "pass", integrity: "derived-from-verified-verdicts", createdAt: now() });
}
function ensureSkill(state, skill) {
    const slug = canonicalSkillSlug(skill.slug || skill.name);
    const current = state.living.skills[slug];
    if (!current)
        state.living.skills[slug] = { ...skill, slug, registryMatch: slug, xp: 0, level: 1, nextLevelXp: xpForLevel(2), sourceReceipts: [], updatedAt: now() };
    else {
        current.aliases = [...new Set([...current.aliases, ...skill.aliases, ...(skill.slug !== slug ? [skill.slug] : [])])];
        if (skill.confidence > current.confidence) {
            current.definition = skill.definition;
            current.confidence = skill.confidence;
        }
    }
}
function mergeSkills(state, sourceSlug, targetSlug) {
    const next = cloneState(state);
    const source = canonicalSkillSlug(sourceSlug);
    const target = canonicalSkillSlug(targetSlug);
    if (source === target || !next.living.skills[source])
        return next;
    if (!next.living.skills[target])
        next.living.skills[target] = { ...next.living.skills[source], slug: target, name: targetSlug, status: "canonical" };
    next.living.mergedSkillSlugs[source] = target;
    next.living.skills[source].status = "merged";
    next.living.skills[target].aliases = [...new Set([...next.living.skills[target].aliases, next.living.skills[source].name, ...next.living.skills[source].aliases])];
    for (const receipt of next.living.xpReceipts)
        if (receipt.skillSlug === source)
            receipt.skillSlug = target;
    return rebuildCanonicalLedgers(next);
}
function authority(authorityName, eventKey, derivedFrom) { return { authority: authorityName, eventKey, derivedFrom: [...new Set(derivedFrom)] }; }
function awardXp(state, submission, kind, reason, derivedFrom) {
    for (const rawSkill of submission.skills) {
        const skill = { ...rawSkill, slug: state.living.mergedSkillSlugs[canonicalSkillSlug(rawSkill.slug)] || canonicalSkillSlug(rawSkill.slug) };
        ensureSkill(state, skill);
        const key = `${submission.id}:${skill.slug}:${kind}`;
        if (state.living.xpReceipts.some((item) => item.id === key))
            continue;
        const progress = state.living.skills[skill.slug];
        const priorLevel = progress.level;
        const amount = Math.max(0, Number(skill.baseXp || 0));
        progress.xp += amount;
        progress.level = levelForXp(progress.xp);
        progress.nextLevelXp = xpForLevel(progress.level + 1);
        progress.sourceReceipts = [...new Set([...progress.sourceReceipts, key])];
        progress.updatedAt = now();
        state.living.xpReceipts.push({ id: key, source: submission.source, submissionId: submission.id, skillSlug: skill.slug, amount, kind, reason, authority: authority("living-school", key, derivedFrom), createdAt: submission.createdAt || now() });
        for (let level = priorLevel + 1; level <= progress.level; level += 1) {
            const levelKey = `${skill.slug}:level:${level}`;
            if (state.living.levelRewardKeys.includes(levelKey))
                continue;
            state.living.levelRewardKeys.push(levelKey);
            payCoin(state, { accountId: submission.contributorId, amount: levelUpCoinAmount(level), kind: "level-up", sourceReceiptId: levelKey, reason: `${skill.name} reached level ${level}`, derivedFrom: [key] });
        }
    }
}
function payCoin(state, input) {
    const key = `${input.kind}:${input.sourceReceiptId}:${input.accountId}`;
    if (state.fellowfare.processedKeys.includes(key))
        return;
    state.fellowfare.processedKeys.push(key);
    state.fellowfare.balances[input.accountId] = Number(state.fellowfare.balances[input.accountId] || 0) + Math.max(0, input.amount);
    state.fellowfare.receipts.push({ id: `coin:${key}`, accountId: input.accountId, amount: Math.max(0, input.amount), kind: input.kind, sourceReceiptId: input.sourceReceiptId, reason: input.reason,
        authority: authority("fellowfare", key, input.derivedFrom || [input.sourceReceiptId]), createdAt: now() });
}
function thresholdForPacket(state, packet) {
    const accepted = state.validation.receipts.filter((item) => item.packetId === packet.id && item.acceptedForQuorum && item.verdict === "pass");
    const blocking = state.validation.receipts.some((item) => item.packetId === packet.id && item.relationship === "independent" && item.verdict === "fail" && item.confidence >= 0.8);
    if (blocking || accepted.length < packet.threshold)
        return null;
    let receipt = state.validation.thresholdReceipts.find((item) => item.packetId === packet.id && item.outcome === "pass");
    if (!receipt) {
        receipt = { schema: exports.THRESHOLD_PROTOCOL, id: `threshold:${packet.requestId}`, packetId: packet.id, requestId: packet.requestId, submissionId: packet.submissionId,
            verdictReceiptIds: accepted.slice(0, packet.threshold).map((item) => item.id), threshold: packet.threshold, outcome: "pass", integrity: "derived-from-verified-verdicts", createdAt: now() };
        state.validation.thresholdReceipts.push(receipt);
    }
    return receipt;
}
/** Rebuilds every canonical balance from submissions plus accepted signed verdicts. Imported totals never outrank their source receipts. */
function rebuildCanonicalLedgers(state) {
    const next = cloneState(state);
    const skillDefinitions = Object.fromEntries(Object.entries(next.living.skills || {}).map(([slug, skill]) => [slug, { ...skill, xp: 0, level: 1, nextLevelXp: xpForLevel(2), sourceReceipts: [], updatedAt: now() }]));
    next.living = { ...emptyLiving(next.living.updatedAt || now()), skills: skillDefinitions, mergedSkillSlugs: { ...(next.living.mergedSkillSlugs || {}) } };
    const mintProposals = (next.fellowfare.escrows || []).map((item) => ({ ...item, fundingMode: "conditional-labor-mint", mintPolicyId: item.mintPolicyId || "fellowfare.proof-of-human-labor.v1", status: item.status === "released" ? "minted" : item.status === "locked" ? "pending-validation" : item.status }));
    next.fellowfare = { ...emptyFellowfare(next.fellowfare.updatedAt || now()), escrows: mintProposals };
    next.chronicle.entries = [];
    next.validation.completedSubmissionIds = [];
    next.validation.thresholdReceipts = next.validation.thresholdReceipts || [];
    next.validation.processedExchangeIds = next.validation.processedExchangeIds || [];
    for (const credit of next.co.credits) {
        if (credit.status === "vested")
            credit.status = "proposed";
        delete credit.vestedAt;
        credit.shareBps = Math.max(1, Number(credit.shareBps || 10000));
    }
    const submissions = [...next.validation.submissions].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const submission of submissions)
        awardXp(next, submission, "base", `Completed ${submission.subjectTitle}`, [submission.id]);
    for (const packet of next.validation.packets.filter((item) => item.status === "open" || item.status === "settled")) {
        if (packet.status === "open" && Date.parse(packet.expiresAt) <= Date.now()) {
            packet.status = "expired";
            continue;
        }
        const threshold = thresholdForPacket(next, packet);
        if (!threshold)
            continue;
        packet.status = "settled";
        if (!next.validation.completedSubmissionIds.includes(packet.submissionId))
            next.validation.completedSubmissionIds.push(packet.submissionId);
        const submission = next.validation.submissions.find((item) => item.id === packet.submissionId);
        if (!submission)
            continue;
        awardXp(next, submission, "validation-bonus", `Validated ${submission.subjectTitle}`, [threshold.id, ...threshold.verdictReceiptIds]);
        const mint = next.fellowfare.escrows.find((item) => item.submissionId === submission.id);
        if (mint) {
            mint.status = "minted";
            mint.validationReceiptIds = threshold.verdictReceiptIds;
            mint.releasedAt = threshold.createdAt;
            if (mint.amount > 0)
                payCoin(next, { accountId: mint.beneficiaryId, amount: mint.amount, kind: "labor-mint", sourceReceiptId: mint.id, reason: `Proof-of-human-labor mint for ${submission.subjectTitle}`, derivedFrom: [threshold.id, ...threshold.verdictReceiptIds] });
        }
        const credits = next.co.credits.filter((item) => item.submissionId === submission.id);
        const shares = normalizedShares(submission);
        const collaborative = shares.length > 1;
        for (const credit of credits) {
            const share = shares.find((item) => item.contributorId === credit.contributorId);
            const allocationSigned = !collaborative || Boolean(share?.signedAt && share?.signatureRef);
            credit.status = allocationSigned ? "vested" : "disputed";
            if (allocationSigned)
                credit.vestedAt = threshold.createdAt;
            else
                delete credit.vestedAt;
        }
        const xp = submission.skills.reduce((sum, skill) => sum + Number(skill.baseXp || 0), 0);
        const coinAmount = mint?.amount || 0;
        const coAmount = credits.filter((credit) => credit.status === "vested").reduce((sum, credit) => sum + credit.amount, 0);
        next.chronicle.entries.push({ id: `chronicle:${submission.id}`, submissionId: submission.id, title: `${submission.subjectTitle} validated`,
            story: `${submission.contributorName} completed ${submission.subjectTitle}, earned ${xp} canonical base XP plus ${xp} validation XP in Living School${coinAmount ? `, triggered a ${coinAmount}-coin proof-of-human-labor mint in Fellowfare` : ""}${coAmount ? `, and vested ${coAmount} Cerbanimo Co effort credits` : ""}${credits.some((credit) => credit.status === "disputed") ? ", while unsigned collaborative Co allocations remain disputed" : ""}.`,
            receiptRefs: [threshold.id, ...threshold.verdictReceiptIds, ...(mint ? [mint.id] : []), ...credits.map((item) => item.id)], authority: authority("commonweave", `chronicle:${submission.id}`, [threshold.id]), createdAt: threshold.createdAt });
    }
    for (const receipt of next.validation.receipts.filter((item) => item.acceptedForQuorum))
        payCoin(next, { accountId: validatorPrincipal(receipt), amount: receipt.relationship === "reciprocal" ? 1 : next.fellowfare.issuancePolicy.validatorBounty,
            kind: "validator-bounty", sourceReceiptId: receipt.id, reason: `Useful independent validation labor`, derivedFrom: [receipt.id] });
    touch(next);
    return next;
}
function touch(state) { const updatedAt = now(); state.living.updatedAt = updatedAt; state.fellowfare.updatedAt = updatedAt; state.co.updatedAt = updatedAt; state.validation.updatedAt = updatedAt; state.chronicle.updatedAt = updatedAt; }
function uniqueBy(items, key) { const map = new Map(); for (const item of items)
    if (!map.has(key(item)))
        map.set(key(item), item); return [...map.values()]; }
const statusRank = { proposed: 0, "pending-validation": 1, locked: 1, disputed: 2, minted: 3, released: 3, void: 4 };
const coRank = { proposed: 0, disputed: 1, vested: 2, void: 3 };
function migrateRewardWeaveState(value) {
    const empty = emptyRewardState();
    const next = {
        living: { ...empty.living, ...(value.living || {}), schema: "living-school.skill-ledger.v1.1", mergedSkillSlugs: value.living?.mergedSkillSlugs || {} },
        fellowfare: { ...empty.fellowfare, ...(value.fellowfare || {}), schema: "fellowfare.coin-ledger.v1.1", issuancePolicy: value.fellowfare?.issuancePolicy || empty.fellowfare.issuancePolicy },
        co: { ...empty.co, ...(value.co || {}), schema: "cerbanimo.co-ledger.v1" },
        validation: { ...empty.validation, ...(value.validation || {}), schema: "commonweave.validation-ledger.v1.1", thresholdReceipts: value.validation?.thresholdReceipts || [], processedExchangeIds: value.validation?.processedExchangeIds || [] },
        chronicle: { ...empty.chronicle, ...(value.chronicle || {}), schema: "commonweave.chronicle-ledger.v1.1" },
    };
    next.validation.submissions = next.validation.submissions.map((submission) => ({ ...submission, schema: exports.REWARD_PROTOCOL, evidenceArtifacts: submissionArtifacts(submission), attempt: Math.max(1, Number(submission.attempt || 1)) }));
    next.validation.packets = next.validation.packets.map((packet) => ({ ...packet, schema: exports.VALIDATION_PROTOCOL, evidenceArtifacts: packet.evidenceArtifacts || [], attempt: Math.max(1, Number(packet.attempt || 1)), requestMode: packet.requestMode || "automatic", status: packet.status || (next.validation.completedSubmissionIds.includes(packet.submissionId) ? "settled" : "open") }));
    next.co.credits = next.co.credits.map((credit) => ({ ...credit, shareBps: Math.max(1, Number(credit.shareBps || 10000)) }));
    return rebuildCanonicalLedgers(next);
}
function mergeRewardWeaveStates(local, incoming) {
    const left = migrateRewardWeaveState(local);
    const right = migrateRewardWeaveState(incoming);
    const next = cloneState(left);
    next.validation.submissions = uniqueBy([...next.validation.submissions, ...right.validation.submissions], (item) => item.id);
    next.validation.packets = uniqueBy([...next.validation.packets, ...right.validation.packets].sort((a, b) => Number(b.attempt || 1) - Number(a.attempt || 1)), (item) => item.id);
    next.validation.receipts = uniqueBy([...next.validation.receipts, ...right.validation.receipts], (item) => item.id);
    next.validation.thresholdReceipts = uniqueBy([...next.validation.thresholdReceipts, ...right.validation.thresholdReceipts], (item) => item.id);
    next.validation.processedExchangeIds = [...new Set([...next.validation.processedExchangeIds, ...right.validation.processedExchangeIds])];
    next.living.skills = { ...right.living.skills, ...next.living.skills };
    next.living.mergedSkillSlugs = { ...right.living.mergedSkillSlugs, ...next.living.mergedSkillSlugs };
    next.fellowfare.escrows = uniqueBy([...next.fellowfare.escrows, ...right.fellowfare.escrows].sort((a, b) => (statusRank[b.status] || 0) - (statusRank[a.status] || 0)), (item) => item.submissionId);
    next.co.credits = uniqueBy([...next.co.credits, ...right.co.credits].sort((a, b) => (coRank[b.status] || 0) - (coRank[a.status] || 0)), (item) => `${item.submissionId}:${item.contributorId}`);
    return rebuildCanonicalLedgers(next);
}
function ownershipProjection(state, endeavorId) {
    const credits = state.co.credits.filter((item) => item.status === "vested" && (!endeavorId || item.endeavorId === endeavorId));
    const total = credits.reduce((sum, item) => sum + item.amount, 0);
    const byContributor = new Map();
    for (const credit of credits)
        byContributor.set(credit.contributorId, Number(byContributor.get(credit.contributorId) || 0) + credit.amount);
    return [...byContributor.entries()].map(([contributorId, amount]) => ({ contributorId, amount, percentage: total ? Number(((amount / total) * 100).toFixed(2)) : 0 })).sort((a, b) => b.amount - a.amount);
}
function rewardSummary(state, accountId = "local-user") {
    const pendingMint = state.fellowfare.escrows.filter((item) => ["pending-validation", "locked"].includes(item.status)).reduce((sum, item) => sum + item.amount, 0);
    return { totalXp: state.living.xpReceipts.reduce((sum, item) => sum + item.amount, 0), skillCount: Object.keys(state.living.skills).filter((slug) => state.living.skills[slug].status !== "merged").length,
        highestLevel: Math.max(1, ...Object.values(state.living.skills).map((skill) => skill.level)), coins: Number(state.fellowfare.balances[accountId] || 0),
        pendingValidations: state.validation.packets.filter((packet) => packet.status === "open").length, lockedEscrow: pendingMint, pendingMint,
        vestedCo: state.co.credits.filter((item) => item.status === "vested" && item.contributorId === accountId).reduce((sum, item) => sum + item.amount, 0) };
}
function recordExternalCoinReward(state, input) {
    const next = cloneState(state);
    payCoin(next, { accountId: input.accountId, amount: Math.max(0, Number(input.amount || 0)), kind: input.kind || "validator-bounty", sourceReceiptId: input.sourceReceiptId, reason: input.reason, derivedFrom: [input.sourceReceiptId] });
    touch(next);
    return next;
}


const core=exports;
const EXCHANGE_PROTOCOL='commonweave.validation-exchange.v1.1';
const keys=core.REWARD_STORAGE_KEYS;
const legacyKeys=core.LEGACY_REWARD_STORAGE_KEYS;
const json=v=>JSON.parse(JSON.stringify(v));
function readJson(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function read(){
  const current={living:readJson(keys.living),fellowfare:readJson(keys.fellowfare),co:readJson(keys.co),validation:readJson(keys.validation),chronicle:readJson(keys.chronicle)};
  const legacy={living:readJson(legacyKeys.living),fellowfare:readJson(legacyKeys.fellowfare),co:readJson(legacyKeys.co),validation:readJson(legacyKeys.validation),chronicle:readJson(legacyKeys.chronicle)};
  return core.migrateRewardWeaveState({living:current.living||legacy.living||undefined,fellowfare:current.fellowfare||legacy.fellowfare||undefined,co:current.co||legacy.co||undefined,validation:current.validation||legacy.validation||undefined,chronicle:current.chronicle||legacy.chronicle||undefined});
}
function write(state){const next=core.migrateRewardWeaveState(state);for(const room of Object.keys(keys))localStorage.setItem(keys[room],JSON.stringify(next[room]));dispatchEvent(new CustomEvent('commonweave:reward-state-changed',{detail:next}));return next}
function vaultIdentity(){try{const vault=JSON.parse(localStorage.getItem('commonweave-identity-vault')||'null');return{identityId:vault?.identity?.identityId,deviceId:vault?.deviceId}}catch{return{}}}
function artifacts(value,summary=''){const input=Array.isArray(value)?value:[];const out=input.slice(0,20).map((item,index)=>{const raw=item&&typeof item==='object'?item:{};const inlineText=String(raw.inlineText||raw.text||'').slice(0,50000),sourceRef=String(raw.sourceRef||raw.url||'').slice(0,2000),contentHash=String(raw.contentHash||raw.sha256||('legacy:'+index+':'+inlineText.length+':'+sourceRef)).slice(0,180);return{id:String(raw.id||'evidence:'+index+':'+contentHash).slice(0,240),name:String(raw.name||'Evidence '+(index+1)).slice(0,240),mimeType:String(raw.mimeType||(inlineText?'text/plain':'application/octet-stream')).slice(0,120),bytes:Math.max(0,Number(raw.bytes||new TextEncoder().encode(inlineText).byteLength||0)),sha256:raw.sha256?String(raw.sha256).slice(0,180):undefined,contentHash,inlineText:inlineText||undefined,sourceRef:sourceRef||undefined,availability:['inline','content-addressed','reference-only','unavailable'].includes(String(raw.availability))?raw.availability:inlineText?'inline':raw.sha256?'content-addressed':sourceRef?'reference-only':'unavailable',createdAt:String(raw.createdAt||new Date().toISOString())}});
 if(!out.length&&String(summary).trim()){const text=String(summary).slice(0,50000);out.push({id:'evidence:summary:'+core.skillSlug(text.slice(0,80)),name:'Contributor evidence record',mimeType:'text/plain',bytes:new TextEncoder().encode(text).byteLength,contentHash:'summary:'+core.skillSlug(text.slice(0,120))+':'+text.length,inlineText:text,availability:'inline',createdAt:new Date().toISOString()})}return out}
function contributors(value,id,name){if(!Array.isArray(value)||!value.length)return[{contributorId:id,contributorName:name,shareBps:10000}];return value.slice(0,24).map(item=>({contributorId:String(item?.contributorId||item?.id||'').slice(0,180),contributorName:String(item?.contributorName||item?.name||item?.contributorId||'Contributor').slice(0,180),shareBps:Math.max(1,Number(item?.shareBps||item?.basisPoints||item?.share||0)),signedAt:item?.signedAt?String(item.signedAt):undefined,signatureRef:item?.signatureRef?String(item.signatureRef):undefined})).filter(x=>x.contributorId)}
function normalize(raw,accountId,name){raw=raw&&typeof raw==='object'?raw:{};const source=raw.source==='living'?'living':'cerbanimo',subjectId=String(raw.subjectId||raw.taskId||raw.moduleId||'').slice(0,180);if(!subjectId)return null;const title=String(raw.subjectTitle||raw.title||'Completed work').slice(0,240),baseXp=Math.max(0,Math.min(5000,Number(raw.baseXp||raw.rewardXp||40))),structured=Array.isArray(raw.skillRewards)?raw.skillRewards:Array.isArray(raw.skills)?raw.skills:Array.isArray(raw.skillTags)?raw.skillTags:[],identity=String(raw.contributorId||accountId||'local-user').slice(0,180),display=String(raw.contributorName||name||'Local weaver').slice(0,180),summary=String(raw.evidenceSummary||raw.proof||'Completion record for '+title).slice(0,50000);return{schema:core.REWARD_PROTOCOL,id:String(raw.id||source+':'+(raw.questId||'journey')+':'+subjectId).slice(0,260),source,kind:source==='living'?'lesson':'task',subjectId,subjectTitle:title,questId:raw.questId?String(raw.questId).slice(0,180):undefined,journeyId:raw.journeyId?String(raw.journeyId).slice(0,180):undefined,contributorId:identity,contributorName:display,contributors:contributors(raw.contributors,identity,display),evidenceSummary:summary,evidenceRefs:Array.isArray(raw.evidenceRefs)?raw.evidenceRefs.map(String).slice(0,20):[],evidenceArtifacts:artifacts(raw.evidenceArtifacts,summary),skills:core.mossTagTask({title,description:String(raw.description||''),proof:summary,rewardXp:baseXp,skillRewards:structured}),baseXp,baseAlreadyCredited:false,validationThreshold:Math.max(1,Math.min(5,Number(raw.validationThreshold||(source==='living'?1:2)))),escrowCoins:Math.max(0,Math.min(1000000,Number(raw.escrowCoins||raw.rewardCoins||0))),effort:core.calculateEffortEstimate({estimatedHours:Number(raw.estimatedHours||0)||undefined,difficulty:typeof raw.difficulty==='string'?raw.difficulty:undefined,automatability:Number.isFinite(Number(raw.automatability))?Number(raw.automatability):undefined,taskText:title+' '+String(raw.description||'')}),attempt:Math.max(1,Number(raw.attempt||1)),resubmissionOf:raw.resubmissionOf?String(raw.resubmissionOf):undefined,createdAt:String(raw.createdAt||new Date().toISOString())}}
function registerQuest(payload,accountId,name){const quest=payload?.quest||{},tasks=Array.isArray(payload?.tasks)?payload.tasks:[];return write(core.registerQuestRewards(read(),{questId:String(quest.id||'quest'),contributorId:String(accountId||'local-user'),contributorName:String(name||'Local contributor'),tasks:tasks.map(task=>({...task,proof:task?.proofRequirement?.summary||task?.proof,skillRewards:Array.isArray(task?.skillRewards)?task.skillRewards:task?.skillTags}))}))}
function submit(raw,accountId,name){const sub=normalize(raw,accountId,name);if(!sub)return read();return write(core.submitRewardAchievement(read(),sub,vaultIdentity()))}
function record(receipt){return write(core.recordValidationReceipt(read(),receipt))}
function requestFresh(submissionId,mode='fresh-review'){return write(core.requestFreshValidation(read(),submissionId,mode))}
async function exchange(kind,payload,vault){if(!vault?.identity||!vault?.deviceId)throw Error('Portable identity is required.');const device=vault.identity.devices?.find(x=>x.deviceId===vault.deviceId&&!x.revokedAt);if(!device)throw Error('This device is not authorized by the portable identity.');const unsigned={schema:EXCHANGE_PROTOCOL,exchangeId:core.rewardId('validation-exchange'),kind,signerIdentityId:vault.identity.identityId,signerDeviceId:vault.deviceId,signerIdentity:vault.identity,signerPublicKey:device.publicKey,createdAt:new Date().toISOString(),payload};return{...unsigned,signature:await CommonweaveIdentitySync.signValue(vault,unsigned)}}
function equal(a,b){return JSON.stringify(a)===JSON.stringify(b)}
async function verifyExchange(value){if(value?.schema!==EXCHANGE_PROTOCOL||!value.signature||!value.signerIdentity||!value.signerPublicKey)return false;if(value.signerIdentity.identityId!==value.signerIdentityId)return false;const device=value.signerIdentity.devices?.find(x=>x.deviceId===value.signerDeviceId&&!x.revokedAt);if(!device||!equal(device.publicKey,value.signerPublicKey))return false;const unsigned={...value};delete unsigned.signature;if(!await CommonweaveIdentitySync.verifyValue(device.publicKey,unsigned,value.signature))return false;if(value.kind==='packet')return !value.payload?.contributorIdentityId||value.payload.contributorIdentityId===value.signerIdentityId;const receipt=value.payload;if(receipt?.validatorId!==value.signerIdentityId||receipt?.signature?.identityId!==value.signerIdentityId||receipt?.signature?.deviceId!==value.signerDeviceId||!equal(receipt?.signature?.publicKey,value.signerPublicKey))return false;const unsignedReceipt={...receipt};delete unsignedReceipt.signature;return CommonweaveIdentitySync.verifyValue(value.signerPublicKey,unsignedReceipt,receipt.signature.value)}
async function applyExchange(value){if(!await verifyExchange(value))throw Error('The validation exchange signature or identity authorization is invalid.');let state=read();if(state.validation.processedExchangeIds?.includes(value.exchangeId))return state;if(value.kind==='receipt')state=core.recordValidationReceipt(state,{...value.payload,integrity:'verified'});else{const packet={...value.payload,schema:core.VALIDATION_PROTOCOL};if(!state.validation.packets.some(x=>x.id===packet.id))state.validation.packets.unshift(packet);state=core.rebuildCanonicalLedgers(state)}state.validation.processedExchangeIds=[...new Set([...(state.validation.processedExchangeIds||[]),value.exchangeId])];return write(state)}
function summary(accountId){const state=read(),base=core.rewardSummary(state,accountId),skills=Object.values(state.living.skills).filter(x=>x.status!=='merged').sort((a,b)=>Number(b.xp||0)-Number(a.xp||0)),pending=state.validation.packets.filter(x=>x.status==='open');return{state,totalXp:base.totalXp,skills,coins:base.coins,locked:base.pendingMint,vested:base.vestedCo,pending,stories:state.chronicle.entries}}
window.CommonweaveRewardWeave={protocol:core.REWARD_PROTOCOL,validationProtocol:core.VALIDATION_PROTOCOL,exchangeProtocol:EXCHANGE_PROTOCOL,keys,legacyKeys,empty:core.emptyRewardState,read,write,effort:core.calculateEffortEstimate,skills:core.mossTagTask,normalize,registerQuest,submit,record,requestFresh,exchange,verifyExchange,applyExchange,summary,merge:(incoming)=>write(core.mergeRewardWeaveStates(read(),incoming)),rebuild:()=>write(core.rebuildCanonicalLedgers(read())),ownership:(endeavorId)=>core.ownershipProjection(read(),endeavorId),core};

})();
