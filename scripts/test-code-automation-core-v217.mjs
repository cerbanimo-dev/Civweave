import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AI_VALIDATION_RECEIPT_SCHEMA,
  GITHUB_VALIDATION_RECEIPT_SCHEMA,
  analyzeCodeIntent,
  canonicalRepository,
  createCodeAutomationPlan,
  creatorProjectTasks,
  evaluateCodeAutomationMergeGate,
  recordAiValidationReceipt,
  recordGithubValidationReceipt
} from './lib/code-automation-core.mjs';

const settings = {enabled:true,repository:'cerbanimo-dev/Civweave',baseBranch:'main',token:'present-but-never-exported',validatorEndpoint:'https://validator.example.test',stepRequiredChecks:['local-first']};

const creatorPhrases = [
  'I want to make a game about time loops.',
  "I'd like to build a game about moss spirits.",
  'My goal is to develop a puzzle game.',
  'Help me create a game about labor history.',
  'Can you guide me through making a platformer?',
  "Let's build a game about mutual aid.",
  "I'm working on a game and need a plan.",
  'How do I make a game about weather?',
  'We plan to code an educational game.',
  'I want to fix the service worker myself.',
  'Could you help me redesign the settings screen?'
];
const delegatedPhrases = [
  'Make me a game about cooperatives.',
  'Build a game about ecology for me.',
  'Please create a puzzle game.',
  'Could you make me a game about local history?',
  'I want you to develop a browser game.',
  'I need a game built around community gardens.',
  'Have Jules implement a game prototype.',
  'Implement a React game loop.',
  'Fix the service worker.',
  "I'd like you to code a game."
];

test('creator-led software wording produces a user project plan across paraphrases', () => {
  for (const phrase of creatorPhrases) {
    const result = analyzeCodeIntent(phrase, phrase.includes('settings') ? 'anarchadia' : 'cerbanimo');
    assert.equal(result?.route, 'creator-plan', phrase);
    assert.equal(result?.agency, 'creator-led', phrase);
  }
});

test('delegated wording produces automation across paraphrases', () => {
  for (const phrase of delegatedPhrases) {
    const result = analyzeCodeIntent(phrase, 'cerbanimo');
    assert.equal(result?.route, 'automation', phrase);
    assert.equal(result?.agency, 'delegated', phrase);
  }
});

test('unclear ownership never defaults into automation', () => {
  for (const phrase of ['I want a game about X.','Could this idea become a game?','A game about X would be cool.']) {
    const result = analyzeCodeIntent(phrase, 'cerbanimo');
    if (result) assert.notEqual(result.route, 'automation', phrase);
  }
});

test('physical games do not become software jobs without a digital qualifier', () => {
  assert.equal(analyzeCodeIntent('Make me a card game.', 'cerbanimo'), null);
  assert.equal(analyzeCodeIntent('Build a tabletop game for me.', 'cerbanimo'), null);
  assert.equal(analyzeCodeIntent('Make me a card game in React.', 'cerbanimo')?.route, 'automation');
});

test('creator plans contain several user-owned phases and no automation plan', () => {
  const tasks = creatorProjectTasks('I want to make a game about time loops.');
  assert.ok(tasks.length >= 6);
  assert.match(tasks[0], /experience/i);
  assert.match(tasks.at(-1), /delegated/i);
  assert.equal(createCodeAutomationPlan({requestText:'I want to make a game about time loops.',systemId:'cerbanimo',settings}), null);
});

test('legacy repository settings migrate to Civweave', () => {
  const legacy = ['cerbanimo-dev', 'Com' + 'monweave'].join('/');
  assert.equal(canonicalRepository(legacy), 'cerbanimo-dev/Civweave');
});

test('creates an automation-only plan only for clearly delegated work', () => {
  const plan = createCodeAutomationPlan({requestText:'Make me a browser game about local history.',systemId:'cerbanimo',settings,now:new Date('2026-08-06T21:00:00Z')});
  assert.equal(plan.schema, 'civweave.code-automation-plan.v1');
  assert.equal(plan.automationOnly, true);
  assert.equal(plan.repository, 'cerbanimo-dev/Civweave');
  assert.equal(plan.steps.length, 6);
  assert.ok(plan.steps.every(step => step.aiValidation.required && step.githubValidation.required));
});

function fullyValidate(inputPlan, finalHead='sha-6') {
  let plan = inputPlan;
  for (const [index, snapshot] of plan.steps.entries()) {
    const step = plan.steps.find(item => item.id === snapshot.id);
    const sha = `sha-${index + 1}`;
    plan = recordAiValidationReceipt(plan,{schema:AI_VALIDATION_RECEIPT_SCHEMA,id:`ai-${step.id}`,planId:plan.id,stepId:step.id,verdict:'pass',reason:'The platform validator inspected the complete evidence and every criterion passed.',evidenceHash:`hash-${step.id}`,commitSha:sha,integrity:'verified-platform-signature',rubricScores:step.acceptanceCriteria.map(criterion=>({criterion,met:true}))});
    plan = recordGithubValidationReceipt(plan,{schema:GITHUB_VALIDATION_RECEIPT_SCHEMA,id:`gh-${step.id}`,planId:plan.id,stepId:step.id,state:'success',commitSha:sha,includedInHead:true,checks:step.id==='06-merge-readiness'?[{name:'local-first',conclusion:'success'},{name:'code-automation-control-plane',conclusion:'success'}]:[{name:'local-first',conclusion:'success'}]});
  }
  return evaluateCodeAutomationMergeGate(plan, finalHead);
}

test('merge remains blocked when either validation side is missing', () => {
  let plan=createCodeAutomationPlan({requestText:'Implement a Civweave service worker repair.',systemId:'cerbanimo',settings});
  plan.pullRequest={number:42,url:'https://github.com/cerbanimo-dev/Civweave/pull/42',headSha:'sha-6',mergeable:true,reviewState:'approved'};
  const step=plan.steps[0];
  plan=recordAiValidationReceipt(plan,{schema:AI_VALIDATION_RECEIPT_SCHEMA,id:'ai-1',planId:plan.id,stepId:step.id,verdict:'pass',reason:'The platform validator inspected the complete evidence and every criterion passed.',evidenceHash:'hash',commitSha:'sha-1',integrity:'verified-platform-signature',rubricScores:step.acceptanceCriteria.map(criterion=>({criterion,met:true}))});
  assert.equal(evaluateCodeAutomationMergeGate(plan,'sha-6').mergeGate.eligible,false);
});

test('merge opens only after complete matching dual validation', () => {
  let plan=createCodeAutomationPlan({requestText:'Implement a Civweave service worker repair.',systemId:'cerbanimo',settings});
  plan.pullRequest={number:43,url:'https://github.com/cerbanimo-dev/Civweave/pull/43',headSha:'sha-6',mergeable:true,reviewState:'approved'};
  assert.equal(fullyValidate(plan).mergeGate.eligible,true);
});

test('a changed final head invalidates prior validation', () => {
  let plan=createCodeAutomationPlan({requestText:'Fix the Civweave API integration.',systemId:'cerbanimo',settings});
  plan.pullRequest={number:44,url:'https://github.com/cerbanimo-dev/Civweave/pull/44',headSha:'sha-6',mergeable:true,reviewState:'approved'};
  const evaluated=fullyValidate(plan,'sha-7');
  assert.equal(evaluated.mergeGate.eligible,false);
  assert.ok(evaluated.mergeGate.reasons.includes('The pull request head changed after final validation.'));
});
