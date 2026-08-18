import assert from 'node:assert/strict';

const fallback='https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const lookup={
  schema:'civweave.video-learning-atlas.lookup.v1',
  records:[
    {video_id:'deadVID1234',url:'https://www.youtube.com/watch?v=deadVID1234',title:'Algebra Equations Variables Complete Guide',creator:'Unavailable Math',catalog_description:'Algebra equations variables linear equations worked examples.',school_slug:'mathematics',source_datasets:['common-pile-youtube']},
    {video_id:'abcDEF12345',url:'https://www.youtube.com/watch?v=abcDEF12345',title:'Introduction to Algebra and Linear Equations',creator:'Open Math',catalog_description:'Learn variables, equations, slopes, and worked algebra examples.',school_slug:'mathematics',source_datasets:['common-pile-youtube']},
    {video_id:'XYZ987abcde',url:'https://www.youtube.com/watch?v=XYZ987abcde',title:'Basic Electronics and Circuit Design',creator:'Open Engineering',catalog_description:'Resistors, voltage, current, breadboards, and practical circuits.',school_slug:'technology',source_datasets:['massive-yt-edu-queue']},
    {video_id:'wikiCRIT001',url:'https://www.youtube.com/watch?v=wikiCRIT001',title:'Teaching Research and Critical Thinking Skills Through Wikipedia',creator:'Open Conference',catalog_description:'A conference talk about research, source evaluation, Wikipedia, and critical thinking.',school_slug:'philosophy-and-religion',source_datasets:['youtube-commons']},
  ],
};
const availability={
  schema:'civweave.youtube-availability-index.v1',
  status:'current',
  expires_at:'2099-09-07T22:17:28Z',
  eligible_video_ids:['abcDEF12345','XYZ987abcde','wikiCRIT001'],
  ineligible_video_ids:['deadVID1234'],
};

globalThis.fetch=async input=>{
  const url=String(input);
  const body=url.includes('youtube-availability-current.json')?availability:lookup;
  return new Response(JSON.stringify(body),{status:200,headers:{'content-type':'application/json'}});
};
const contract=await import(`../public/app/video-learning-contract-v1.mjs?behavior-test=${Date.now()}`);

const algebra=await contract.resolveRelevantVideo('How do I solve algebra equations with variables?',{schoolSlug:'mathematics'});
assert.equal(algebra.url,'https://www.youtube.com/watch?v=abcDEF12345');
assert.equal(algebra.source,'civweave-video-atlas');
assert(algebra.score>=6);
assert(algebra.reason.includes('embeddability verified'));

const unmatched=await contract.resolveRelevantVideo('interdimensional snail choreography on Europa');
assert.equal(unmatched.url,fallback);
assert.equal(unmatched.source,'required-fallback');

const school={modules:[
  {id:'m1',title:'Linear equations',objective:'Solve algebra equations',learningObjectives:['isolate variables'],concepts:['algebra','variables'],video:{url:'https://www.youtube.com/watch?v=deadVID1234',title:'Old atlas choice',source:'civweave-video-atlas'}},
  {id:'m2',title:'Uncatalogued speculative topic',objective:'interdimensional snail choreography on Europa',learningObjectives:[],concepts:[]},
]};
await contract.ensureLivingSchool(school,{schoolSlug:'mathematics'});
assert.equal(school.modules[0].video.url,'https://www.youtube.com/watch?v=abcDEF12345');
assert.equal(school.modules[1].video.url,fallback);
assert.equal(school.videoContract.requiredPerModule,1);
assert.equal(school.videoContract.availabilityIndex,'/downloads/knowledge-schools/video-atlases/youtube-availability-current.json');

const tarotSchool={
  title:'Tarot Foundations',
  capability:'Read and interpret tarot cards',
  modules:[{
    id:'tarot-1',
    title:'Foundations and vocabulary',
    summary:'A practical module for using foundations and vocabulary to advance the stated capability.',
    objective:'Use foundations and vocabulary to advance the capability.',
    learningObjectives:['Recognize the core vocabulary.'],
    concepts:['Foundations','Vocabulary'],
    video:{
      kind:'open-media',
      url:'https://example.org/wiki-critical-thinking.webm',
      title:'Teaching Research & Critical Thinking Skills Through Wikipedia',
      creator:'US National Archives',
      description:'A conference presentation about teaching research and critical thinking with Wikipedia.',
      source:'civweave-open-learning-media',
      score:34,
      license:{spdx:'CC-BY'}
    }
  }]
};
await contract.ensureLivingSchool(tarotSchool,{schoolSlug:'philosophy-and-religion'});
assert.equal(tarotSchool.modules[0].video.url,fallback);
assert.equal(tarotSchool.modules[0].video.source,'required-fallback');
assert.equal(tarotSchool.modules[0].video.score,0);

const electronicsAction={system:'cerbanimo',title:'Build an electronics demonstrator',fields:{objective:'Learn basic circuits'},checkpoints:['Wire a resistor and LED circuit']};
await contract.ensureCerbanimoAction(electronicsAction);
assert.equal(electronicsAction.checkpointVideos.length,1);
assert.equal(electronicsAction.checkpointVideos[0].url,'https://www.youtube.com/watch?v=XYZ987abcde');
assert.equal(electronicsAction.videoContract.requiredPerTask,1);

const unmatchedAction={system:'cerbanimo',title:'Europa snail choreography',fields:{objective:'interdimensional mollusk dance notation'},checkpoints:['Map the speculative choreography']};
await contract.ensureCerbanimoAction(unmatchedAction);
assert.equal(unmatchedAction.checkpointVideos.length,1);
assert.equal(unmatchedAction.checkpointVideos[0].url,fallback);
assert.equal(unmatchedAction.checkpointVideos[0].source,'required-fallback');

assert.equal(contract.youtubeEmbedUrl(fallback),'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
console.log('Video Learning Contract behavior verified: current embeddability filtering, subject relevance, exact fallback, Living School modules, Cerbanimo tasks, and embed URL.');
