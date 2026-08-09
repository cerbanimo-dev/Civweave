import assert from 'node:assert/strict';

const fallback='https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const lookup={
  schema:'civweave.video-learning-atlas.lookup.v1',
  records:[
    {video_id:'abcDEF12345',url:'https://www.youtube.com/watch?v=abcDEF12345',title:'Introduction to Algebra and Linear Equations',creator:'Open Math',catalog_description:'Learn variables, equations, slopes, and worked algebra examples.',school_slug:'mathematics',source_datasets:['common-pile-youtube']},
    {video_id:'XYZ987abcde',url:'https://www.youtube.com/watch?v=XYZ987abcde',title:'Basic Electronics and Circuit Design',creator:'Open Engineering',catalog_description:'Resistors, voltage, current, breadboards, and practical circuits.',school_slug:'technology',source_datasets:['massive-yt-edu-queue']},
  ],
};

globalThis.fetch=async()=>new Response(JSON.stringify(lookup),{status:200,headers:{'content-type':'application/json'}});
const contract=await import(`../public/app/video-learning-contract-v1.mjs?behavior-test=${Date.now()}`);

const algebra=await contract.resolveRelevantVideo('How do I solve algebra equations with variables?',{schoolSlug:'mathematics'});
assert.equal(algebra.url,'https://www.youtube.com/watch?v=abcDEF12345');
assert.equal(algebra.source,'civweave-video-atlas');
assert(algebra.score>=6);

const unmatched=await contract.resolveRelevantVideo('interdimensional snail choreography on Europa');
assert.equal(unmatched.url,fallback);
assert.equal(unmatched.source,'required-fallback');

const school={modules:[
  {id:'m1',title:'Linear equations',objective:'Solve algebra equations',learningObjectives:['isolate variables'],concepts:['algebra','variables']},
  {id:'m2',title:'Uncatalogued speculative topic',objective:'interdimensional snail choreography on Europa',learningObjectives:[],concepts:[]},
]};
await contract.ensureLivingSchool(school,{schoolSlug:'mathematics'});
assert.equal(school.modules[0].video.url,'https://www.youtube.com/watch?v=abcDEF12345');
assert.equal(school.modules[1].video.url,fallback);
assert.equal(school.videoContract.requiredPerModule,1);

const action={system:'cerbanimo',title:'Build an electronics demonstrator',fields:{objective:'Learn basic circuits'},checkpoints:['Wire a resistor and LED circuit','interdimensional snail choreography on Europa']};
await contract.ensureCerbanimoAction(action);
assert.equal(action.checkpointVideos.length,2);
assert.equal(action.checkpointVideos[0].url,'https://www.youtube.com/watch?v=XYZ987abcde');
assert.equal(action.checkpointVideos[1].url,fallback);
assert.equal(action.videoContract.requiredPerTask,1);

assert.equal(contract.youtubeEmbedUrl(fallback),'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ');
console.log('Video Learning Contract behavior verified: relevant selection, exact fallback, Living School modules, Cerbanimo checkpoints, and embed URL.');
