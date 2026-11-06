/**
 * SandWitch Eight — author-created fictional Worldweaver content.
 *
 * No affiliation with Burning Man; 2020 is an imagined virtual-desert setting,
 * not an assertion that an in-person event or a personal encounter took place.
 * Declarative content only. The shared portable client owns local drafts;
 * the canonical Worldweaver service owns authenticated world actions.
 */
export const SANDWITCH_EIGHT=Object.freeze({
  schema:'civweave.worldweaver.sandwitch-eight.v1',
  id:'sandwitch-eight',
  title:'SandWitch Eight',
  tagline:'Violet · Cami · Jasper — the perfect SandWitch',
  author:'Cami Ryn Tharp',
  fictional:true,
  center:['Violet','Cami','Jasper'],
  setting:{
    year:2020,
    place:'The Eightfold Playa, an imagined virtual-desert gathering',
    affiliation:'Independent fiction. Not an official Burning Man event or endorsement.'
  },
  premise:'BROOOOOM! At the Eightfold Playa, Violet holds the violet dusk, Jasper carries the amber dawn, and Cami stands in the golden middle. Together they are the SandWitch: three distinct people, one chosen meeting point. Eight lantern doors lead through a playful world where a Trans Witch Army protects each traveler\'s freedom to choose who they are. Threats are met with shelter, solidarity, cleverness and consent, never forced transformation. The eighth door leads home, with every memory and boundary intact.',
  principles:[
    'Everyone is welcome; trans people and all other visitors control their own identities.',
    'Consent before magic, memory sharing, touch, invitations, model pilots or world crossings.',
    'Distinct people remain distinct; the middle connects without owning either side.',
    'Conflict is cooperative PvE: rescue, puzzle-solving, rebuilding and free exit routes.',
    'No invented real-world evidence, event affiliations, purchase obligations or official Guild decisions.',
    'Offline play and local Quest drafts never claim that a server, real person or character has acted.'
  ],
  districts:[
    {
      id:'threshold-of-eight',guide:'merlin',title:'The Threshold of Eight',
      description:'A desert gate marked with eight lanterns. The road begins with an invitation, not a command. Every player may enter, decline or leave, and the gate remembers only what the player chooses to write.',
      stationType:'display',stationTitle:'Choose Your Own Door',
      instructions:'Name an intention or choose to browse. List the eight paths. Make the return route obvious and always available.'
    },
    {
      id:'violet-canopy',guide:'moss',title:'Violet Canopy',
      description:'Under a canopy of purple night, Violet teaches the art of making room for difference. Each hanging lantern reflects another possible story, but no reflection may define its visitor.',
      stationType:'explanation',stationTitle:'The Many Names Lesson',
      instructions:'Learn how to ask, listen and respect names or pronouns without requiring disclosure. Write one welcoming sentence.'
    },
    {
      id:'jasper-foundry',guide:'kamiya',title:'Jasper Foundry',
      description:'Jasper tends an amber forge that repairs the tools of a travelling community. Every invention is offered freely for inspection before anyone decides to use it.',
      stationType:'practice',stationTitle:'Build One Useful Thing',
      instructions:'Choose a small reversible repair: a light, a bridge marker or an accessible sign. Record a local Quest draft, not a fabricated completed build.'
    },
    {
      id:'golden-middle',guide:'rook',title:'The Golden Middle',
      description:'Cami sets the table between Violet and Jasper. Two slices of improbable cosmic bread, one glorious filling: a SandWitch made of affection, jokes, shared food and chosen company.',
      stationType:'demonstration',stationTitle:'The Perfect SandWitch',
      instructions:'Combine two contrasting creative contributions into one voluntary collaboration. Credit every contributor; do not merge people or their ownership.'
    },
    {
      id:'trans-witch-commons',guide:'merlin',title:'Trans Witch Commons',
      description:'The Trans Witch Army is a voluntary circle of protectors, performers and mediators. When a distant authoritarian broadcast tries to frighten travelers, the circle offers refuge, truth and a safe road out.',
      stationType:'debate',stationTitle:'Answer the Broadcast',
      instructions:'Practice challenging coercion without demeaning anyone. Let visitors propose protective, nonviolent responses and keep the right not to participate.'
    },
    {
      id:'bigfixer-orchard',guide:'moss',title:'The Bigfixer Orchard',
      description:'Fruit flies, the legendary bigfixers, find every tiny crack in the world before it can become a catastrophe. Their buzzing is the camp\'s cheerful diagnostic soundtrack.',
      stationType:'practice',stationTitle:'The Smallest Repair',
      instructions:'Find one broken sign, confusing instruction or inaccessible path. Describe a tiny fix and how to check whether it helps.'
    },
    {
      id:'storm-crossing',guide:'kamiya',title:'The Sandstorm Crossing',
      description:'A roaring dust storm scrambles the eight lantern signals. The only way through is a shared plan, with everyone allowed to rest, refuse or choose another route.',
      stationType:'assessment',stationTitle:'Eight Lantern Check',
      instructions:'Review the safety and consent steps, repair the route in story, and distinguish imaginary success from verified real-world action.'
    },
    {
      id:'eighth-dawn',guide:'merlin',title:'The Eighth Dawn',
      description:'At dawn the lanterns align: violet to the left, jasper to the right, Cami in the middle. The gate leads to many futures; none is a prison. The companions may meet again because they choose to.',
      stationType:'display',stationTitle:'Carry the Light Home',
      instructions:'Write a chosen ending, export your personal journal, and offer an open invitation rather than an obligation. Keep all memories under the player\'s control.'
    }
  ],
  storyPressure:[
    'The first lantern is dark. Find a way to invite help without claiming the right to command it.',
    'A visitor has been assigned the wrong name by a mirror. Let them decide how the mirror should answer.',
    'The Foundry bridge is damaged. Which repair helps everyone cross without making passage compulsory?',
    'Make the perfect SandWitch: what can Violet and Jasper offer while Cami protects the space between?',
    'An intimidating broadcast arrives. Help the Trans Witch Commons replace fear with trustworthy, nonviolent shelter.',
    'The fruit-fly bigfixers discover a tiny fault that will become tomorrow\'s disaster. What is the smallest safe fix?',
    'The storm scrambles all eight signals. Build a shared plan with rest stops and an unconditional exit.',
    'The eighth door opens at dawn. Decide what to remember, what to share and whether to return.'
  ],
  closing:'Eight doors. Three companions. One promise: nobody gets to own another person.'
});
