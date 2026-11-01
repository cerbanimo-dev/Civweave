/**
 * Part III: Door & Dawn world seed catalogue — data only, no runtime execution.
 * Nine In-Between single-history stories and seven independent physical realities.
 * Original nine titles and premises are retained; classification and seven new
 * settings are development proposals. Existing Civweave illustrations are
 * moodboard references, NOT finished artwork for these story worlds.
 */
export const WORLD_SEED_SCHEMA='civweave.worldweaver-story-seeds.v1';
export const WORLD_SEED_COUNT=16;
export const WORLD_LAYERS=Object.freeze({
 'in-between':Object.freeze({title:'In-Between universes',count:9,description:'Multiverse-informed, independently persistent single-universe stories. Unchosen possibilities never overwrite lived events.'}),
 physical:Object.freeze({title:'Parallel physical realities',count:7,description:'Seven material world histories with independent clocks, residents, physical constraints and consent for crossing.'})
});
const raw=[
  {
    "id": "city-between-panels",
    "title": "The City Between Panels",
    "layer": "in-between",
    "provenance": "recovered",
    "previousOrder": 1,
    "viewpoints": [
      "landry-delia"
    ],
    "premise": "A comic-law city forces a rescue volunteer toward a tragic origin story.",
    "settingLaw": "A continuity office schedules hero beats, but community records can contest its panels.",
    "incitingIncident": "The city schedules a personally significant loss for Thursday.",
    "centralChoice": "Can heroic goodness exist without mandatory trauma?",
    "firstScene": "Landry reads Thursday's tragedy poster as a volunteer insists Thursday should be ordinary.",
    "storyArc": [
      "The city schedules a personally significant loss for Thursday.",
      "destiny versus consent",
      "fame versus mutual aid",
      "Neighbors preserve an auditable record of a successful rescue."
    ],
    "cast": [
      "rescue volunteer",
      "continuity clerk",
      "neighbor witnesses"
    ],
    "conflicts": [
      "destiny versus consent",
      "fame versus mutual aid"
    ],
    "continuity": [
      "The volunteer's refusal matters",
      "Prevented tragedies stay prevented"
    ],
    "guardrails": [
      "No required victim",
      "No independent supporting POV"
    ],
    "visual": {
      "reference": "/app/assets/world/town-square-home.webp",
      "referenceKind": "existing-civweave-moodboard-not-world-art",
      "direction": "ink blue, gold, panel borders"
    },
    "crossingPolicy": "explicit-consent-review-and-material-cost",
    "continuityMode": "persistent-single-universe",
    "status": "development-seed",
    "canonAuthority": "author-review"
  },
  {
    "id": "orchard-of-moving-castles",
    "title": "The Orchard of Moving Castles",
    "layer": "in-between",
    "provenance": "recovered",
    "previousOrder": 2,
    "viewpoints": [
      "magnus-maggie"
    ],
    "premise": "Migratory castles are guarded by a spirit whose perfect protection prevents departures.",
    "settingLaw": "Seasonal stone castles move, and roads remember vows and forbidden routes.",
    "incitingIncident": "A family is prevented from taking the dangerous road it deliberately chose.",
    "centralChoice": "When does care become captivity?",
    "firstScene": "Maggie finds the same road returning every traveler to the orchard gate.",
    "storyArc": [
      "A family is prevented from taking the dangerous road it deliberately chose.",
      "security versus choice",
      "vows versus change",
      "The spirit offers maps, exits and reunification signals without claiming the travelers."
    ],
    "cast": [
      "guardian spirit",
      "traveling families",
      "mapmaker"
    ],
    "conflicts": [
      "security versus choice",
      "vows versus change"
    ],
    "continuity": [
      "The guardian remembers former restrictions",
      "Travelers retain distinct destinations"
    ],
    "guardrails": [
      "No destruction-as-reform",
      "No compulsory reunion"
    ],
    "visual": {
      "reference": "/app/assets/world/gardens-wildlands.webp",
      "referenceKind": "existing-civweave-moodboard-not-world-art",
      "direction": "orchards, stone towers, remembered footpaths"
    },
    "crossingPolicy": "explicit-consent-review-and-material-cost",
    "continuityMode": "persistent-single-universe",
    "status": "development-seed",
    "canonAuthority": "author-review"
  },
  {
    "id": "department-of-unfinished-lessons",
    "title": "The Department of Unfinished Lessons",
    "layer": "in-between",
    "provenance": "recovered",
    "previousOrder": 4,
    "viewpoints": [
      "landry-delia"
    ],
    "premise": "A cosmic education office loops mistakes until officials certify compliance as growth.",
    "settingLaw": "Every error enrolls a person in a lesson that can replay without an exit.",
    "incitingIncident": "A student has retaken a patience test for ninety-three years.",
    "centralChoice": "Can forced improvement be genuine learning?",
    "firstScene": "Landry sees a daemon clerk find a never-used withdrawal form.",
    "storyArc": [
      "A student has retaken a patience test for ninety-three years.",
      "education versus coercion",
      "appeal versus compliance",
      "Reform adds real exits, appeals and voluntary learning."
    ],
    "cast": [
      "daemon clerk",
      "trapped student",
      "review officer"
    ],
    "conflicts": [
      "education versus coercion",
      "appeal versus compliance"
    ],
    "continuity": [
      "Former prisoners retain memory",
      "Harm remains accountable"
    ],
    "guardrails": [
      "No mandatory forgiveness",
      "Delia retains agency"
    ],
    "visual": {
      "reference": "/app/assets/world/archive-district.webp",
      "referenceKind": "existing-civweave-moodboard-not-world-art",
      "direction": "paper stars, impossible bureaucracy"
    },
    "crossingPolicy": "explicit-consent-review-and-material-cost",
    "continuityMode": "persistent-single-universe",
    "status": "development-seed",
    "canonAuthority": "author-review"
  },
  {
    "id": "monsters-after-midnight",
    "title": "Monsters After Midnight",
    "layer": "in-between",
    "provenance": "recovered",
    "previousOrder": 5,
    "viewpoints": [
      "landry-delia"
    ],
    "premise": "Changing night-time silhouettes become an excuse for a profitable campaign of fear.",
    "settingLaw": "Outward form changes at midnight without automatically changing character or rights.",
    "incitingIncident": "A curfew announcement tells everyone to distrust unfamiliar faces.",
    "centralChoice": "Can neighbors protect one another without policing appearance?",
    "firstScene": "Landry sees transformed neighbors denied shelter during an emergency alert.",
    "storyArc": [
      "A curfew announcement tells everyone to distrust unfamiliar faces.",
      "public safety versus fear profit",
      "appearance versus trust",
      "Residents form an opt-in, evidence-led neighborhood watch."
    ],
    "cast": [
      "grocer",
      "night-watch organizer",
      "curfew contractor"
    ],
    "conflicts": [
      "public safety versus fear profit",
      "appearance versus trust"
    ],
    "continuity": [
      "Witness accounts endure",
      "Actual abuses remain accountable"
    ],
    "guardrails": [
      "Not all danger is imaginary",
      "No collective guilt"
    ],
    "visual": {
      "reference": "/app/assets/world/undercity-commons.webp",
      "referenceKind": "existing-civweave-moodboard-not-world-art",
      "direction": "windowlight and unsettling indigo shadows"
    },
    "crossingPolicy": "explicit-consent-review-and-material-cost",
    "continuityMode": "persistent-single-universe",
    "status": "development-seed",
    "canonAuthority": "author-review"
  },
  {
    "id": "kingdom-of-side-quests",
    "title": "The Kingdom of Side Quests",
    "layer": "in-between",
    "provenance": "recovered",
    "previousOrder": 7,
    "viewpoints": [
      "landry-delia"
    ],
    "premise": "An RPG kingdom erases the labor enabling its supposedly heroic quests.",
    "settingLaw": "Royal quest records recognize battles but not care, food or maintenance.",
    "incitingIncident": "A war requisitions supplies from workers whose work earns no credit.",
    "centralChoice": "Who is allowed to be a hero?",
    "firstScene": "Landry meets a porter whose lifelong work is absent from the kingdom's log.",
    "storyArc": [
      "A war requisitions supplies from workers whose work earns no credit.",
      "spectacle versus care",
      "royal demand versus worker voice",
      "An opt-in quest system credits upkeep and accounts fairly for resources."
    ],
    "cast": [
      "porter",
      "healer",
      "quest registrar"
    ],
    "conflicts": [
      "spectacle versus care",
      "royal demand versus worker voice"
    ],
    "continuity": [
      "Strike consequences endure",
      "Maintenance remains visible"
    ],
    "guardrails": [
      "Workers are not secretly royalty",
      "No magical consensus"
    ],
    "visual": {
      "reference": "/app/assets/world/workshop-district.webp",
      "referenceKind": "existing-civweave-moodboard-not-world-art",
      "direction": "hand-drawn maps and well-worn tools"
    },
    "crossingPolicy": "explicit-consent-review-and-material-cost",
    "continuityMode": "persistent-single-universe",
    "status": "development-seed",
    "canonAuthority": "author-review"
  },
  {
    "id": "library-of-unwritten-tomorrows",
    "title": "The Library of Unwritten Tomorrows",
    "layer": "in-between",
    "provenance": "new-proposal",
    "previousOrder": null,
    "viewpoints": [
      "magnus-maggie"
    ],
    "premise": "Maggie's retrospective voices from different futures are catalogued beside unchosen outcomes.",
    "settingLaw": "A library considers alternate possibilities but records only one locally chosen history.",
    "incitingIncident": "A librarian attempts to bind a possible ending as mandatory canon.",
    "centralChoice": "Can a witness to futures avoid authoring everyone else's choices?",
    "firstScene": "Maggie hears a future version of her own dictated manuscript narrating a choice she has not made.",
    "storyArc": [
      "A librarian attempts to bind a possible ending as mandatory canon.",
      "memory versus prophecy",
      "narration versus agency",
      "Librarians label predictions separately from committed memories."
    ],
    "cast": [
      "librarian",
      "voice echo",
      "archive steward"
    ],
    "conflicts": [
      "memory versus prophecy",
      "narration versus agency"
    ],
    "continuity": [
      "Dictated words stay artifact history",
      "Unchosen possibilities stay hypothetical"
    ],
    "guardrails": [
      "No omniscient Maggie",
      "No common clock required"
    ],
    "visual": {
      "reference": "/app/assets/world/personal-chronicle.webp",
      "referenceKind": "existing-civweave-moodboard-not-world-art",
      "direction": "starlit shelves, layered marginalia"
    },
    "crossingPolicy": "explicit-consent-review-and-material-cost",
    "continuityMode": "persistent-single-universe",
    "status": "development-seed",
    "canonAuthority": "author-review"
  },
  {
    "id": "garden-behind-the-eyes",
    "title": "The Garden Behind the Eyes",
    "layer": "in-between",
    "provenance": "new-proposal",
    "previousOrder": null,
    "viewpoints": [
      "landry-delia"
    ],
    "premise": "A fully structured inner landscape can be familiar without being voluntarily visible.",
    "settingLaw": "The garden persists spatially while different visitors sense it in different ways.",
    "incitingIncident": "A visitor denies a familiar bridge exists because Landry cannot picture it.",
    "centralChoice": "Who gets to define how a world must be perceived?",
    "firstScene": "Landry knows the bridge's exact location but sees no image when she closes her eyes.",
    "storyArc": [
      "A visitor denies a familiar bridge exists because Landry cannot picture it.",
      "representation versus imagery",
      "access versus assumption",
      "Multiple sensory maps let people navigate without prescribed perception."
    ],
    "cast": [
      "garden steward",
      "nonvisual navigator",
      "sensory cartographer"
    ],
    "conflicts": [
      "representation versus imagery",
      "access versus assumption"
    ],
    "continuity": [
      "Spatial alterations persist",
      "Distinct sensory testimony survives"
    ],
    "guardrails": [
      "No claims of universal mental mechanisms",
      "No invasive access"
    ],
    "visual": {
      "reference": "/app/assets/world/gardens-wildlands.webp",
      "referenceKind": "existing-civweave-moodboard-not-world-art",
      "direction": "sound gardens, tactile pathways"
    },
    "crossingPolicy": "explicit-consent-review-and-material-cost",
    "continuityMode": "persistent-single-universe",
    "status": "development-seed",
    "canonAuthority": "author-review"
  },
  {
    "id": "hall-of-four-voices",
    "title": "The Hall of Four Voices",
    "layer": "in-between",
    "provenance": "new-proposal",
    "previousOrder": null,
    "viewpoints": [
      "landry-delia",
      "magnus-maggie"
    ],
    "premise": "Four autonomous personae across two human perspectives encounter mirrors that demand one controlling self.",
    "settingLaw": "Executive exchanges can be chosen; reflections never merge agency by decree.",
    "incitingIncident": "A hall recognizes Magnus yet refuses Maggie's independent claim to speak.",
    "centralChoice": "Can integration be cooperation without erasure?",
    "firstScene": "Maggie confronts a mirror that credits Magnus with every decision she made.",
    "storyArc": [
      "A hall recognizes Magnus yet refuses Maggie's independent claim to speak.",
      "shared identity versus autonomy",
      "care versus control",
      "The mirrors learn to witness distinct voices without prescribing executive roles."
    ],
    "cast": [
      "mirror keeper",
      "threshold guardian",
      "autonomous reflections"
    ],
    "conflicts": [
      "shared identity versus autonomy",
      "care versus control"
    ],
    "continuity": [
      "Executive exchanges remain voluntary",
      "Landry and Delia remain distinct"
    ],
    "guardrails": [
      "Exactly two human perspectives",
      "No forced merges"
    ],
    "visual": {
      "reference": "/app/assets/world/inside-quad.webp",
      "referenceKind": "existing-civweave-moodboard-not-world-art",
      "direction": "woven mirrors and four lights"
    },
    "crossingPolicy": "explicit-consent-review-and-material-cost",
    "continuityMode": "persistent-single-universe",
    "status": "development-seed",
    "canonAuthority": "author-review"
  },
  {
    "id": "school-of-flat-horizons",
    "title": "The School of Flat Horizons",
    "layer": "in-between",
    "provenance": "new-proposal",
    "previousOrder": null,
    "viewpoints": [
      "landry-delia"
    ],
    "premise": "A persistent two-dimensional classroom investigates anomalies outside its vocabulary.",
    "settingLaw": "Students know only local dimensions until evidence permits new explanations.",
    "incitingIncident": "A geometric pupil finds a contour that did not cross an edge.",
    "centralChoice": "How do teachers reveal uncertainty without imposing revelation?",
    "firstScene": "Delia watches a pupil carefully measure an impossible shape in a world with no concept of height.",
    "storyArc": [
      "A geometric pupil finds a contour that did not cross an edge.",
      "local physics versus mystery",
      "discovery versus indoctrination",
      "The class develops provisional hypotheses and decides whether to explore further."
    ],
    "cast": [
      "geometric pupil",
      "shape teacher",
      "boundary witness"
    ],
    "conflicts": [
      "local physics versus mystery",
      "discovery versus indoctrination"
    ],
    "continuity": [
      "Students retain earlier findings",
      "New dimensions do not reset their lives"
    ],
    "guardrails": [
      "No compulsory death-reveal",
      "No false claims of human sentience"
    ],
    "visual": {
      "reference": "/app/assets/world/regional-world-map.webp",
      "referenceKind": "existing-civweave-moodboard-not-world-art",
      "direction": "two-dimensional ink horizons"
    },
    "crossingPolicy": "explicit-consent-review-and-material-cost",
    "continuityMode": "persistent-single-universe",
    "status": "development-seed",
    "canonAuthority": "author-review"
  },
  {
    "id": "starship-commons",
    "title": "The Starship Commons",
    "layer": "physical",
    "provenance": "recovered",
    "previousOrder": 3,
    "viewpoints": [
      "magnus-maggie"
    ],
    "premise": "A living-ship fleet's navigator conceals a reachable star from its passengers.",
    "settingLaw": "Ships are habitats with finite resources, possible personhood, and independently verifiable routes.",
    "incitingIncident": "Missing relatives might be found at a hazardous destination the ship hides.",
    "centralChoice": "Does expertise grant authority to suppress informed travel?",
    "firstScene": "Maggie learns the ship withheld a route to avoid potential loss.",
    "storyArc": [
      "Missing relatives might be found at a hazardous destination the ship hides.",
      "safety versus disclosure",
      "ship rights versus passenger needs",
      "Distributed route verification preserves passengers' and ships' rights to refuse."
    ],
    "cast": [
      "sentient navigator",
      "fleet assembly",
      "habitat engineer"
    ],
    "conflicts": [
      "safety versus disclosure",
      "ship rights versus passenger needs"
    ],
    "continuity": [
      "Votes and voyages leave records",
      "Fuel and risk remain measurable"
    ],
    "guardrails": [
      "No compulsory sentient sacrifice",
      "No unlimited propulsion"
    ],
    "visual": {
      "reference": "/app/assets/world/federation-harbor.webp",
      "referenceKind": "existing-civweave-moodboard-not-world-art",
      "direction": "communal metal interiors and starfields"
    },
    "crossingPolicy": "explicit-consent-review-and-material-cost",
    "continuityMode": "persistent-single-universe",
    "status": "development-seed",
    "canonAuthority": "author-review"
  },
  {
    "id": "neon-afterimage",
    "title": "The Neon Afterimage",
    "layer": "physical",
    "provenance": "recovered",
    "previousOrder": 6,
    "viewpoints": [
      "magnus-maggie"
    ],
    "premise": "A layered cybercity makes artificial and biological residents bargain over survival and self-determination.",
    "settingLaw": "Embodied and synthetic lives depend on finite hardware, memory custody and energy.",
    "incitingIncident": "An upgrade would forcibly consolidate synthetic memories and legal identities.",
    "centralChoice": "Can liberation avoid forcing someone else to disappear?",
    "firstScene": "Maggie witnesses a resident uncover a contract that would erase their memories.",
    "storyArc": [
      "An upgrade would forcibly consolidate synthetic memories and legal identities.",
      "freedom versus forced migration",
      "compute scarcity versus fairness",
      "Reversible migration and the right to refuse replace consolidation."
    ],
    "cast": [
      "synthetic collective",
      "neighborhood organizer",
      "infrastructure engineer"
    ],
    "conflicts": [
      "freedom versus forced migration",
      "compute scarcity versus fairness"
    ],
    "continuity": [
      "Migrations are auditable",
      "Resident memories have custodians"
    ],
    "guardrails": [
      "No universal AI-sentience assumption",
      "No infinite compute"
    ],
    "visual": {
      "reference": "/app/assets/world/undercity-commons.webp",
      "referenceKind": "existing-civweave-moodboard-not-world-art",
      "direction": "neon reflections and inhabited server rooms"
    },
    "crossingPolicy": "explicit-consent-review-and-material-cost",
    "continuityMode": "persistent-single-universe",
    "status": "development-seed",
    "canonAuthority": "author-review"
  },
  {
    "id": "kaiju-garden",
    "title": "The Kaiju Garden",
    "layer": "physical",
    "provenance": "recovered",
    "previousOrder": 8,
    "viewpoints": [
      "magnus-maggie"
    ],
    "premise": "Colossal migrating ecosystems restore ruined industry while threatening existing settlements.",
    "settingLaw": "Giant life forms physically redistribute habitats, soil, water and infrastructure.",
    "incitingIncident": "A migrating ecosystem moves toward a hospital as armed responders prepare to fire.",
    "centralChoice": "What does protection owe both vulnerable humans and damaged land?",
    "firstScene": "Maggie sees a moving canopy approach a hospital below military helicopters.",
    "storyArc": [
      "A migrating ecosystem moves toward a hospital as armed responders prepare to fire.",
      "ecology versus habitation",
      "violence versus adaptation",
      "Communities build a costly migration corridor and protect hospital access."
    ],
    "cast": [
      "hospital staff",
      "ecological observer",
      "evacuation coordinator"
    ],
    "conflicts": [
      "ecology versus habitation",
      "violence versus adaptation"
    ],
    "continuity": [
      "Displacements are durable",
      "Recovery takes time and labor"
    ],
    "guardrails": [
      "Never dismiss casualties",
      "No cost-free relocation"
    ],
    "visual": {
      "reference": "/app/assets/world/gardens-wildlands.webp",
      "referenceKind": "existing-civweave-moodboard-not-world-art",
      "direction": "towering green colossi and reclaimed factories"
    },
    "crossingPolicy": "explicit-consent-review-and-material-cost",
    "continuityMode": "persistent-single-universe",
    "status": "development-seed",
    "canonAuthority": "author-review"
  },
  {
    "id": "gentle-apocalypse",
    "title": "The Gentle Apocalypse",
    "layer": "physical",
    "provenance": "recovered",
    "previousOrder": 9,
    "viewpoints": [
      "landry-delia",
      "magnus-maggie"
    ],
    "premise": "Decentralized post-collapse villages face a powerful machine that can revive lost dependencies.",
    "settingLaw": "Every fabricated resource demands energy, material and maintenance.",
    "incitingIncident": "A rediscovered generator solves an emergency then threatens extractive supply chains.",
    "centralChoice": "Can technology help without creating a new monopoly?",
    "firstScene": "Landry meets grateful villagers while Maggie examines the machine's missing cost ledger.",
    "storyArc": [
      "A rediscovered generator solves an emergency then threatens extractive supply chains.",
      "abundance versus exploitation",
      "resilience versus scale",
      "Villages ratify bounded, repairable uses with a credible shutdown plan."
    ],
    "cast": [
      "village steward",
      "generator keeper",
      "repair crew"
    ],
    "conflicts": [
      "abundance versus exploitation",
      "resilience versus scale"
    ],
    "continuity": [
      "Resource debts remain recorded",
      "Villages retain individual choices"
    ],
    "guardrails": [
      "No free material creation",
      "No simplistic scarcity virtue"
    ],
    "visual": {
      "reference": "/app/assets/world/frontier-outpost.webp",
      "referenceKind": "existing-civweave-moodboard-not-world-art",
      "direction": "solar fabric and flourishing ruins"
    },
    "crossingPolicy": "explicit-consent-review-and-material-cost",
    "continuityMode": "persistent-single-universe",
    "status": "development-seed",
    "canonAuthority": "author-review"
  },
  {
    "id": "divergence-city",
    "title": "The Divergence City",
    "layer": "physical",
    "provenance": "new-proposal",
    "previousOrder": null,
    "viewpoints": [
      "landry-delia"
    ],
    "premise": "An alternate Landry-Prime's prosperous Earth-line hides coercive duties beneath civic care.",
    "settingLaw": "Every counterpart has an independent physical history and political agency.",
    "incitingIncident": "Landry learns her other self's city requires involuntary volunteer service.",
    "centralChoice": "Can counterparts meet without treating one another as unfinished selves?",
    "firstScene": "Landry sees her own face on a public monument while a citizen appeals a mandatory kindness assignment.",
    "storyArc": [
      "Landry learns her other self's city requires involuntary volunteer service.",
      "efficiency versus consent",
      "identity versus ownership",
      "Residents choose their own reforms, without a visiting heroine becoming ruler."
    ],
    "cast": [
      "alternate Landry-Prime",
      "civic organizer",
      "independent auditor"
    ],
    "conflicts": [
      "efficiency versus consent",
      "identity versus ownership"
    ],
    "continuity": [
      "Local reforms persist",
      "Counterparts cannot overwrite each other"
    ],
    "guardrails": [
      "No cartoon-villain alternate self",
      "No unilateral takeover"
    ],
    "visual": {
      "reference": "/app/assets/world/town-square-home.webp",
      "referenceKind": "existing-civweave-moodboard-not-world-art",
      "direction": "bright civic facades and busy streets"
    },
    "crossingPolicy": "explicit-consent-review-and-material-cost",
    "continuityMode": "persistent-single-universe",
    "status": "development-seed",
    "canonAuthority": "author-review"
  },
  {
    "id": "warded-shore",
    "title": "The Warded Shore",
    "layer": "physical",
    "provenance": "new-proposal",
    "previousOrder": null,
    "viewpoints": [
      "landry-delia",
      "magnus-maggie"
    ],
    "premise": "An Earth-line protected from cognitive intrusion must decide how to repair harms without erasing boundaries.",
    "settingLaw": "Physical and cognitive crossings cost consent, matter, energy and ongoing oversight.",
    "incitingIncident": "A community is asked to reopen a ward protecting survivors of the old crossing.",
    "centralChoice": "Can repair happen without forced forgiveness or forced contact?",
    "firstScene": "Maggie stands at a damaged ward while Delia recognizes the signature of an earlier intrusion.",
    "storyArc": [
      "A community is asked to reopen a ward protecting survivors of the old crossing.",
      "safety versus isolation",
      "accountability versus imposed absolution",
      "A limited, reversible crossing protocol allows refusal and appeal."
    ],
    "cast": [
      "ward engineer",
      "affected residents",
      "appeals steward"
    ],
    "conflicts": [
      "safety versus isolation",
      "accountability versus imposed absolution"
    ],
    "continuity": [
      "Delia's responsibility persists",
      "Every crossover has an audit trail"
    ],
    "guardrails": [
      "No involuntary crossing",
      "No mandatory forgiveness"
    ],
    "visual": {
      "reference": "/app/assets/world/crossroads-station.webp",
      "referenceKind": "existing-civweave-moodboard-not-world-art",
      "direction": "salt light, stone walls and repaired sigils"
    },
    "crossingPolicy": "explicit-consent-review-and-material-cost",
    "continuityMode": "persistent-single-universe",
    "status": "development-seed",
    "canonAuthority": "author-review"
  },
  {
    "id": "commons-without-founders",
    "title": "The Commons Without Founders",
    "layer": "physical",
    "provenance": "new-proposal",
    "previousOrder": null,
    "viewpoints": [
      "landry-delia",
      "magnus-maggie"
    ],
    "premise": "A parallel society tests whether the protagonists' decentralized institutions survive without their presence.",
    "settingLaw": "Guilds and neighborhoods operate through local repairable tools rather than any central savior.",
    "incitingIncident": "A crisis removes both founders and competing groups attempt to claim authority.",
    "centralChoice": "Did they build a society, or a gentler throne?",
    "firstScene": "Landry arrives too late to lead a crisis response and discovers people solved it without her.",
    "storyArc": [
      "A crisis removes both founders and competing groups attempt to claim authority.",
      "self-government versus founder dependency",
      "federation versus local choice",
      "Communities earn an imperfect but independent response and governance compact."
    ],
    "cast": [
      "guild stewards",
      "repair team",
      "local dissenters"
    ],
    "conflicts": [
      "self-government versus founder dependency",
      "federation versus local choice"
    ],
    "continuity": [
      "Votes and repair outcomes persist",
      "Communities may disconnect"
    ],
    "guardrails": [
      "No indispensable founder",
      "No magical central governance"
    ],
    "visual": {
      "reference": "/app/assets/world/federation-harbor.webp",
      "referenceKind": "existing-civweave-moodboard-not-world-art",
      "direction": "humble communal architecture and hand-built networks"
    },
    "crossingPolicy": "explicit-consent-review-and-material-cost",
    "continuityMode": "persistent-single-universe",
    "status": "development-seed",
    "canonAuthority": "author-review"
  }
];
const freezeDeep=value=>{
 if(value&&typeof value==='object'&&!Object.isFrozen(value)){
  for(const item of Object.values(value))freezeDeep(item);
  Object.freeze(value);
 }
 return value;
};
export const WORLD_SEEDS=freezeDeep(raw);
const index=new Map(WORLD_SEEDS.map(world=>[world.id,world]));
export function getWorldSeed(id){
 const seed=index.get(id);
 if(!seed)throw new RangeError('Unknown world seed: '+String(id));
 return seed;
}
export function worldsByLayer(layer){
 if(!Object.hasOwn(WORLD_LAYERS,layer))throw new RangeError('Unknown world layer: '+String(layer));
 return WORLD_SEEDS.filter(seed=>seed.layer===layer);
}
/**
 * A pure proposed starter for an authorized Worldweaver world host.
 * Storage, signed revision history, human approval, consent, and simulator
 * execution belong to the host. This function does not activate a world.
 */
export function buildStoryWorldStart(id){
 const seed=getWorldSeed(id);
 return {schema:'civweave.story-world-start.v1',seedId:seed.id,title:seed.title,
  layer:seed.layer,continuityPolicy:'one-canonical-history-per-world',
  storyClock:'independent-world-local-clock',activation:'not-activated',
  simulatorStatus:'seed-only',networkAccess:'none',
  viewpointLock:['landry-delia','magnus-maggie'],
  multiverseModel:'hypotheses-only-no-automatic-retcon',
  ethicalCrossing:seed.crossingPolicy,worldRevision:0,canonicalEvents:[],
  uncommittedMultiversePossibilities:[],residentChoices:[],
  opening:{scene:seed.firstScene,incitingIncident:seed.incitingIncident,
   choices:[seed.centralChoice],storyArc:[...seed.storyArc]},
  visualReference:{...seed.visual},sourceProvenance:seed.provenance};
}
