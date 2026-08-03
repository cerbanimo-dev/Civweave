(()=>{
'use strict';
const KEY='commonweave.cabinet-calibration.v144';
const DEFAULTS={
  schema:'commonweave.cabinet-calibration.v1',
  version:'1.0.31',
  revision:'source-svg-r24',
  sourceSize:{width:941,height:1672},
  systems:{
    commonweave:{sourceSize:{width:941,height:1672},hotspots:[
      {system:'anarchadia',shape:'circle',cx:236.19,cy:1524.86,r:45.17},
      {system:'fellowfare',shape:'circle',cx:329.54,cy:1524.86,r:42.34},
      {system:'commonweave',shape:'circle',cx:467.68,cy:1518.18,r:65.87},
      {system:'living-school',shape:'circle',cx:598.38,cy:1524.86,r:42.82},
      {system:'cerbanimo',shape:'circle',cx:701.04,cy:1524.86,r:42.82}
    ]},
    'living-school':{sourceSize:{width:941,height:1672},hotspots:[
      {system:'anarchadia',shape:'circle',cx:228.85,cy:1498.11,r:42.34},
      {system:'fellowfare',shape:'circle',cx:334.9,cy:1498.11,r:38.58},
      {system:'commonweave',shape:'circle',cx:490.17,cy:1498.11,r:64.93},
      {system:'living-school',shape:'circle',cx:643.36,cy:1498.11,r:38.58},
      {system:'cerbanimo',shape:'circle',cx:755.34,cy:1498.11,r:38.58}
    ]},
    cerbanimo:{sourceSize:{width:941,height:1672},hotspots:[
      {system:'anarchadia',shape:'circle',cx:249.18,cy:1462,r:38.11},
      {system:'fellowfare',shape:'circle',cx:355.04,cy:1462,r:36.23},
      {system:'commonweave',shape:'circle',cx:476.24,cy:1462,r:55.52},
      {system:'living-school',shape:'circle',cx:591.7,cy:1462,r:39.99},
      {system:'cerbanimo',shape:'circle',cx:697.56,cy:1462,r:38.11}
    ]},
    fellowfare:{sourceSize:{width:941,height:1672},hotspots:[
      {system:'anarchadia',shape:'circle',cx:214.17,cy:1524.03,r:42.34},
      {system:'fellowfare',shape:'circle',cx:321.63,cy:1524.03,r:39.52},
      {system:'commonweave',shape:'circle',cx:471.44,cy:1518.18,r:58.34},
      {system:'living-school',shape:'circle',cx:619.37,cy:1524.03,r:40.46},
      {system:'cerbanimo',shape:'circle',cx:745.46,cy:1524.03,r:39.52}
    ]},
    anarchadia:{sourceSize:{width:941,height:1672},hotspots:[
      {system:'anarchadia',shape:'circle',cx:219.06,cy:1539.91,r:50.81},
      {system:'fellowfare',shape:'circle',cx:357.58,cy:1539.91,r:51.76},
      {system:'commonweave',shape:'circle',cx:525.92,cy:1539.91,r:87.04},
      {system:'living-school',shape:'circle',cx:685.14,cy:1539.91,r:51.76},
      {system:'cerbanimo',shape:'circle',cx:818.86,cy:1539.91,r:58.81}
    ],referencePanel:{width:351,height:120,detectedCenters:[[44.5,65.5],[104.5,66.5],[177.5,66.5],[246.5,64.5],[304.5,63.5]]}}
  }
};
const parse=value=>{try{return JSON.parse(value)||{}}catch{return{}}};
const saved=parse(localStorage.getItem(KEY));
const merged={...DEFAULTS,...saved,sourceSize:{...DEFAULTS.sourceSize,...saved.sourceSize},systems:{}};
for(const [id,defaults] of Object.entries(DEFAULTS.systems)){
  const custom=saved.systems?.[id];
  merged.systems[id]=custom?{...defaults,...custom,sourceSize:{...defaults.sourceSize,...custom.sourceSize},hotspots:Array.isArray(custom.hotspots)?custom.hotspots:defaults.hotspots}:defaults;
}
for(const [id,custom] of Object.entries(saved.systems||{}))if(!merged.systems[id])merged.systems[id]=custom;
localStorage.setItem(KEY,JSON.stringify(merged));
globalThis.CommonweaveCabinetCalibrationV144={key:KEY,defaults:DEFAULTS,current:merged};
})();
