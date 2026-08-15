import { applyPatch, gitDiff, gitStatus, readRepoFile, runNpmScript, searchRepo } from './repo-tools.mjs';
import { clip, JSON_OBJECT, textResult } from './tool-utils.mjs';

export function registerRepoTools(add, config) {
  const { repoRoot } = config;

  add({ name:'repo.read_file', title:'Read repository file', description:'Read a UTF-8 file inside the configured Civweave git worktree. Paths are constrained to the worktree.', inputSchema:{...JSON_OBJECT,properties:{path:{type:'string'},maxBytes:{type:'integer',minimum:1,maximum:256000}},required:['path']}, annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
    async (args) => textResult({path:args.path,content:clip(await readRepoFile(repoRoot,args.path,{maxBytes:args.maxBytes ?? 256000}))}));

  add({ name:'repo.search', title:'Search repository text', description:'Search text files in the configured Civweave worktree without shell execution.', inputSchema:{...JSON_OBJECT,properties:{query:{type:'string'},isRegex:{type:'boolean'},maxResults:{type:'integer',minimum:1,maximum:200}},required:['query']}, annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
    async (args) => textResult({results:await searchRepo(repoRoot,args.query,{isRegex:Boolean(args.isRegex),maxResults:args.maxResults ?? 50})}));

  add({ name:'repo.status', title:'Read git status', description:'Read branch and worktree status for the configured Civweave repository.', inputSchema:{...JSON_OBJECT,properties:{}}, annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
    async () => textResult({status:await gitStatus(repoRoot)}));

  add({ name:'repo.diff', title:'Read working diff', description:'Read the current unstaged git diff for source review.', inputSchema:{...JSON_OBJECT,properties:{}}, annotations:{readOnlyHint:true,destructiveHint:false,idempotentHint:true,openWorldHint:false}},
    async () => textResult({diff:clip(await gitDiff(repoRoot),500000)}));

  add({ name:'repo.apply_patch', title:'Apply source patch', description:'Apply a unified git patch to the configured Civweave worktree after git apply --check. This is the canonical source-edit path; never use browser/runtime injection to implement fixes.', inputSchema:{...JSON_OBJECT,properties:{patch:{type:'string'}},required:['patch']}, annotations:{readOnlyHint:false,destructiveHint:true,idempotentHint:false,openWorldHint:false}},
    async (args) => textResult({applied:true,diff:clip(await applyPatch(repoRoot,args.patch),500000)}));

  add({ name:'repo.run_npm_script', title:'Run verification script', description:'Run an allowlisted npm check/test/lint/audit or build:install script in the Civweave worktree. Deploy, publish, start, and release-mutation scripts are rejected.', inputSchema:{...JSON_OBJECT,properties:{script:{type:'string'},timeoutMs:{type:'integer',minimum:1000,maximum:600000}},required:['script']}, annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:false,openWorldHint:false}},
    async (args) => textResult(await runNpmScript(repoRoot,args.script,{timeoutMs:args.timeoutMs ?? 120000})));
}
