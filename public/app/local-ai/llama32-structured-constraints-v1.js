// JSON Schema subset verifier; never substitutes for token-level constrained decoding.
// The sampled tokens are masked by the independent Hugging Face processor; this
// parser rejects incomplete output, trailing prose, missing fields, and type errors.
export const LEARNING_TRIAL_SCHEMA=Object.freeze({
  type:'object',
  properties:{
    title:{type:'string',minLength:3},
    capability:{type:'string',minLength:5},
    modules:{type:'array',minItems:3,maxItems:4,items:{
      type:'object',properties:{title:{type:'string',minLength:3},outcome:{type:'string',minLength:5}},
      required:['title','outcome'],additionalProperties:false
    }},
    assumptions:{type:'array',maxItems:4,items:{type:'string'}}
  },
  required:['title','capability','modules','assumptions'],
  additionalProperties:false
});
function check(value,schema,path,errors,depth=0){
  if(depth>24){errors.push(path+': maximum nesting exceeded');return}
  if(schema.enum&&!schema.enum.some(x=>x===value))errors.push(path+': outside allowed enum');
  if(schema.type==='object'){
    if(!value||typeof value!=='object'||Array.isArray(value)){errors.push(path+': expected object');return}
    for(const field of schema.required||[])if(!Object.hasOwn(value,field))errors.push(path+'.'+field+': required');
    if(schema.additionalProperties===false)for(const field of Object.keys(value))if(!Object.hasOwn(schema.properties||{},field))errors.push(path+'.'+field+': extra property');
    for(const [key,next] of Object.entries(schema.properties||{}))if(Object.hasOwn(value,key))check(value[key],next,path+'.'+key,errors,depth+1);
  }else if(schema.type==='array'){
    if(!Array.isArray(value)){errors.push(path+': expected array');return}
    if(Number.isInteger(schema.minItems)&&value.length<schema.minItems)errors.push(path+': too few items');
    if(Number.isInteger(schema.maxItems)&&value.length>schema.maxItems)errors.push(path+': too many items');
    if(schema.items)for(let i=0;i<value.length;i++)check(value[i],schema.items,path+'['+i+']',errors,depth+1);
  }else if(schema.type==='string'){
    if(typeof value!=='string'){errors.push(path+': expected string');return}
    if(Number.isInteger(schema.minLength)&&[...value].length<schema.minLength)errors.push(path+': too short');
  }else if(schema.type==='number'||schema.type==='integer'){
    if(typeof value!=='number'||!Number.isFinite(value)||(schema.type==='integer'&&!Number.isInteger(value)))errors.push(path+': expected '+schema.type);
  }else if(schema.type==='boolean'&&typeof value!=='boolean')errors.push(path+': expected boolean');
}
export function validateStrictJson(raw,schema=LEARNING_TRIAL_SCHEMA){
  if(typeof raw!=='string'||raw.length>100_000)return{ok:false,value:null,errors:['output must be a bounded JSON string']};
  let value;
  try{value=JSON.parse(raw)}catch(error){return{ok:false,value:null,errors:['JSON.parse: '+String(error?.message||error)]}}
  if(!schema||schema.type!=='object')return{ok:false,value:null,errors:['unsupported root schema']};
  const errors=[];check(value,schema,'$',errors);
  return{ok:errors.length===0,value:errors.length?null:value,errors};
}
