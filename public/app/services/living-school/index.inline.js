
  (() => {
    "use strict";

    const STORAGE_KEY = "living-academy-v19-state";
    const domains = {
      theory:"Theory",
      organizing:"Organizing",
      governance:"Governance",
      mutualAid:"Mutual aid",
      technicalAutonomy:"Technical autonomy",
      review:"Review",
      facilitation:"Facilitation",
      teaching:"Teaching",
      subjectPractice:"Subject practice"
    };

    const NNY_FORAGING_DUMP = String.raw`Common wild edibles in Northern New York (NNY) include dandelions, wild leeks (ramps), and stinging nettles. [1]

## Spring and Summer Greens

• Dandelions: All parts are described as edible in the source dump; young leaves are used in salads, and roots are sometimes roasted for a coffee-like drink.
• Wild Leeks (Ramps): Found in rich moist woods during spring, with a strong garlic-onion flavor.
• Stinging Nettles: Described as nutritious; handling can sting skin, and the dump says cooking removes the sting.
• Garlic Mustard: An invasive green with a garlic-mustard taste, common along trails and disturbed soils. [2, 3, 4, 5, 6, 7, 8, 9]

## Berries and Fruits

• Wild Strawberries and Blackberries: Seasonal fruits found along forest edges and clearings.
• American Elderberry: Clusters of dark berries; the dump says berries must be fully cooked before eating. [1, 10, 11, 12, 13]

## Safety and Foraging Rules

• Positive ID: Never eat a wild plant or mushroom unless identity has been confirmed; poisonous look-alikes exist.
• Clean Locations: Avoid busy roadways, industrial sites, or treated lawns because contaminants may be present.
• Land Permission: Check land ownership and collection rules before harvesting.
• Reference Practice: Use multiple specialized regional references and, for anything intended for consumption, confirm identification with a qualified local expert. [8, 10, 14, 15, 16, 17]

## Fall Foraging

• Nuts (Beech, Oak, Walnut): Beechnuts and black walnuts drop in autumn. Acorns require processing to reduce tannins before food use.
• Wild Apples and Crabapples: Found in abandoned orchards or forest edges and often peak in late fall.
• Burdock Root: The dump recommends first-year roots in late fall.
• Cattail Roots: The dump describes autumn rhizomes as a starch source. [18, 19, 20, 21, 22]

## Winter Foraging

• White Pine Needles: The dump proposes tea, but species identification is critical because other evergreens can be toxic.
• Wintergreen: Low-growing leaves and small red berries may remain visible beneath snow.
• Rose Hips: Wild rose fruit may persist through winter and soften after frost.
• Winter Caches: The dump suggests observing animal caches, but wildlife stores should not be relied upon or disturbed. [18, 21, 23, 24]

## Caloric Priority

• High Priority: Nuts and seeds are presented as higher-energy food sources.
• Medium Priority: Starchy roots such as cattail rhizomes and burdock.
• Low Priority: Greens and teas provide flavor or micronutrients but little survival energy. [25, 26, 27, 28]

## Acorn Processing Claim

Step 1: Shell and crush acorn meat.
Step 2: The dump describes repeated water leaching until bitterness is gone.
Step 3: Dry and cook the processed meal.
Claim requiring verification: The dump says hot acorns transferred to cold water will permanently lock tannins into the meat. This statement should not become an instruction without a reliable food-science source. [29, 30, 31]

## Wetland Starches

• Broadleaf Cattail (Typha latifolia): The dump describes rhizomes as a starch source in wetlands.
• Harvesting and processing claims require local legal, ecological, identification, and food-safety review.
• Frozen-water access introduces cold-water, ice, and wetland hazards and should not be taught as a casual beginner exercise. [32]

## Cold-Weather Safety

• Water Treatment: Untreated surface water can contain pathogens. Use authoritative water-treatment guidance rather than assuming clear water is safe.
• Mushroom Hazard: The dump warns against relying on wild mushrooms for survival calories because fatal look-alikes occur.
• Evergreen Identification: The dump contrasts eastern white pine with toxic yew and other evergreens; text-only identification is not adequate.
• Broad survival claim requiring verification: “Apply heat to eliminate cold-climate parasites” is too broad and should be split into specific food- and water-safety claims.

## Authoritative Safety Supplement

• New York State land: NYSDEC says removing plants from state lands without a permit is illegal.
• Ramps: Cornell Cooperative Extension says ramps take roughly five to seven years to reach harvest size and recommends taking leaves without removing the whole bulb and root.
• Elderberry: Penn State Extension advises against eating leaves and recommends removing stems; cooking berries destroys toxins in the seeds.
• Backcountry water: CDC advises bringing clear water to a rolling boil for one minute, or three minutes above 6,500 feet.

[1] https://www.facebook.com/groups/homesteadingforbeginners/posts/2236923686505003/
[2] https://www.youtube.com/watch?v=sTbwqcNSdAU
[3] https://www.motherearthnews.com/sustainable-living/nature-and-environment/foraging-wild-edible-plants-zmaz70jazgoe/
[4] https://outdooradventuresampler.com/ultimate-guide-to-wild-edibles-spring-wild-edibles/
[5] https://www.mossyoak.com/edible-plants
[6] https://www.tiktok.com/@woodsboundoutdoors/video/7512602510423674158
[7] https://www.kindearth.net/foraging-guide-with-12-wild-plants-that-anyone-can-find/
[8] https://www.facebook.com/groups/126440730781222/posts/24202544812744144/
[9] https://www.facebook.com/groups/225203714740881/posts/1527337301194176/
[10] https://www.farmersalmanac.com/20-common-wild-edible-plants
[11] https://www.facebook.com/groups/hikewny/posts/2806291342857459/
[12] https://albemarlemagazine.com/a-taste-of-the-wild/
[13] https://ethnobiology.org/forage/blog/eastern-woodland-edible-and-medicinal-plants-i-learned-growing-vermont
[14] https://www.masterclass.com/articles/foraging-guide
[15] https://www.youtube.com/watch?v=I9NC-hheBSg
[16] https://books.google.com/books/about/Foraging_New_York.html?id=xGU2DgAAQBAJ
[17] https://health.clevelandclinic.org/foraging-101-what-to-eat-and-avoid
[18] https://www.reddit.com/r/foraging/comments/1277zzr/what_wild_edible_plants_to_look_for_in_upstate/
[19] https://www.thisfootprint.com/post/winter-foraging-in-upstate-new-york
[20] https://www.outdoorlife.com/15-wild-edibles-you-can-forage-for-in-fall/
[21] https://practicalselfreliance.com/fall-foraging/
[22] https://www.facebook.com/groups/homesteadingforbeginners/posts/2236923686505003/
[23] https://www.youtube.com/watch?v=sTbwqcNSdAU
[24] https://www.thisfootprint.com/post/winter-foraging-in-upstate-new-york
[25] https://www.battlbox.com/blogs/outdoors/what-food-to-buy-for-prepping-a-comprehensive-guide
[26] https://www.battlbox.com/blogs/preparedness/how-to-find-food-in-the-wilderness-a-comprehensive-guide-to-foraging-and-survival
[27] https://wildernessawareness.org/articles/survival-food-plants-cattail-acorns-grasses-and-conifers/
[28] https://paulkirtley.co.uk/2013/five-survival-plants-every-forager-should-know/
[29] https://www.creekstewart.com/creek-stewart-survival/how-to-harvest-process-and-eat-acorns
[30] https://www.battlbox.com/blogs/outdoors/how-to-find-food-in-the-forest-a-comprehensive-guide-for-outdoor-enthusiasts
[31] https://www.facebook.com/groups/38417209275/posts/10157244740229276/
[32] https://www.themeateater.com/cook/foraging/swamp-delicacy-the-cant-miss-foraged-food-youve-been-ignoring
[101] https://dec.ny.gov/things-to-do/camping-primitive
[102] https://ulster.cce.cornell.edu/healthy-communities/food-and-nutrition/recipes-and-cooking-tips/ramps
[103] https://extension.psu.edu/elderberry-in-the-garden-and-the-kitchen/
[104] https://www.cdc.gov/drinking-water/prevention/water-treatment-hiking-camping-traveling.html`;

    const authoritativeSourceOverrides = {
      "https://dec.ny.gov/things-to-do/camping-primitive": {
        rank:"high",
        label:"NYSDEC · public-land collection rule",
        note:"NYSDEC states that removing plants from state lands without a permit is illegal."
      },
      "https://ulster.cce.cornell.edu/healthy-communities/food-and-nutrition/recipes-and-cooking-tips/ramps": {
        rank:"high",
        label:"Cornell Cooperative Extension · ramps",
        note:"Ramps are slow-growing; sustainable harvest guidance favors leaves and retaining bulbs and roots."
      },
      "https://extension.psu.edu/elderberry-in-the-garden-and-the-kitchen/": {
        rank:"high",
        label:"Penn State Extension · elderberry",
        note:"Avoid leaves and remove stems; cooking berries destroys toxins in seeds."
      },
      "https://www.cdc.gov/drinking-water/prevention/water-treatment-hiking-camping-traveling.html": {
        rank:"high",
        label:"CDC · backcountry water treatment",
        note:"Bring clear water to a rolling boil for one minute, or three minutes above 6,500 feet."
      }
    };

    const defaultKnowledge = {
      title:"Anarcho-Syndicalist School",
      subtitle:"Worker self-management, direct action, federation, Cerbanimo, and Anarchadia",
      subject:"Anarcho-syndicalism, Cerbanimo, and Anarchadia",
      description:"A field school for learning how people can coordinate work, govern shared systems, and build collective capacity without manufacturing a permanent ruling layer.",
      sourceNote:"Curated local knowledge pack",
      modules:[
        {
          title:"Worker self-management",
          kicker:"Foundation",
          domain:"theory",
          summary:"Anarcho-syndicalism begins from a practical claim: the people who do and endure the work should participate directly in deciding it.",
          objectives:[
            "Distinguish worker self-management from consultation or benevolent management.",
            "Explain why a union can function as a school for collective governance.",
            "Identify where decision power currently sits in a real group."
          ],
          paragraphs:[
            "Worker self-management is not simply a friendlier management style. It changes who has standing to define the work, distribute responsibilities, inspect information, and revise the rules. The people affected by a decision are not treated as an audience for a finished plan.",
            "A syndicate can defend immediate interests while developing the competence required for deeper autonomy. Meetings, role rotation, documentation, negotiation, logistics, and conflict handling become practice in governing shared life.",
            "The central design test is replaceability. A structure becomes less hierarchical when knowledge travels, roles have limits, and more people can continue the work without asking permission from an indispensable coordinator."
          ],
          concepts:[
            ["Self-management","Those doing and affected by the work participate directly in governing it."],
            ["Distributed competence","Knowledge and operational ability are carried by enough people that no single organizer becomes irreplaceable."],
            ["Standing","A recognized right to participate in a decision because its consequences affect you."]
          ],
          exercise:{
            title:"Map one decision",
            prompt:"Choose a workplace, project, household, cooperative, or community group. Map who proposes, who has information, who decides, who implements, and who absorbs the consequences.",
            rubric:["Names a concrete decision","Identifies information control","Distinguishes formal and informal authority","Proposes one reversible redistribution of power"]
          }
        },
        {
          title:"Direct action and solidarity",
          kicker:"Collective leverage",
          domain:"organizing",
          summary:"Direct action means people acting together upon the conditions they live under. Solidarity makes another person's vulnerability relevant to one's own organized behavior.",
          objectives:[
            "Separate direct action from delegated advocacy.",
            "Recognize the difference between sympathy and solidarity.",
            "Design an action that changes both a condition and collective capacity."
          ],
          paragraphs:[
            "Direct action does not require theatrical confrontation. It includes any organized intervention carried out by the people living with the condition: a strike, slowdown, tenant repair campaign, shared resource network, worker buyout, collective refusal, or cooperative replacement.",
            "Solidarity changes the field of risk. When permanent and temporary workers, different buildings, or differently exposed groups refuse to be separated, the opponent loses the ability to isolate the most vulnerable participants.",
            "An action should be judged twice. Did it reduce harm or win something material? Did it leave more people connected, informed, trained, and capable of acting again?"
          ],
          concepts:[
            ["Direct action","Affected people intervene collectively instead of outsourcing all agency to an outside authority."],
            ["Solidarity","People alter their own action and risk in response to another group's vulnerability."],
            ["Dual result","An action changes an immediate condition while building durable collective capacity."]
          ],
          exercise:{
            title:"Design a seven-day action",
            prompt:"Define one shared condition and a collective action that three to ten people can complete within seven days. Include participants, sequence, resources, proof, reflection, and the next capacity it should leave behind.",
            rubric:["Bounded condition","Named people and roles","Visible sequence","Proof of completion","Capacity transfer"]
          }
        },
        {
          title:"Federation, mandates, and recall",
          kicker:"Scale without a throne",
          domain:"governance",
          summary:"Federation coordinates local groups through limited mandates, delegates, open records, and the right of recall.",
          objectives:[
            "Distinguish a delegate from a representative with independent authority.",
            "Write a bounded mandate.",
            "Identify why recall fails when information remains concentrated."
          ],
          paragraphs:[
            "Federation attempts to preserve both local agency and wider cooperation. Local groups retain their own competence while assigning specific, time-limited coordination work to delegates or councils.",
            "A delegate carries instructions rather than personal sovereignty. A workable mandate states purpose, permissions, prohibited actions, reporting duties, expiration, and replacement. Flexibility can be granted, but it should be named rather than silently inferred.",
            "Recall is not enough by itself. A group cannot replace a delegate when only that delegate understands the relationships, records, procedures, or technical systems required by the role. Information symmetry is part of constitutional design."
          ],
          concepts:[
            ["Federation","Local groups coordinate without surrendering all decision-making to a permanent center."],
            ["Mandate","A bounded grant of responsibility containing permissions, limits, reporting, and duration."],
            ["Recall","The ability to remove or replace a delegate before the scheduled end of a mandate."]
          ],
          exercise:{
            title:"Write a recallable mandate",
            prompt:"Draft a mandate for a delegate attending a wider council. Include purpose, permitted and prohibited actions, reporting, duration, recall, and an alternate.",
            rubric:["Purpose and scope","Prohibited actions","Time limit","Reporting path","Recall and replacement"]
          }
        },
        {
          title:"Cerbanimo: coordination without a managerial caste",
          kicker:"Tool study",
          domain:"technicalAutonomy",
          summary:"Cerbanimo is a local-first work and mutual-aid engine for turning shared intentions into visible quests, tasks, skills, resource flows, evidence, review, and collective memory.",
          objectives:[
            "Explain the difference between coordinating work and ranking workers.",
            "Map learning exercises into Cerbanimo quests and proof requirements.",
            "Identify anti-capture requirements for a shared coordination engine."
          ],
          paragraphs:[
            "Cerbanimo gives collective intention an inspectable operational form. Projects become quests; necessary work becomes claimable tasks; skills, resources, needs, dependencies, and proof requirements can be made visible to participants.",
            "The engine should not become a hidden management layer. Evidence, review, appeal, contribution history, and automation rules need to remain understandable. Coordination becomes domination when one operator controls the only copy of the plan, identity, data, or institutional memory.",
            "Within this school, a lesson can export a Cerbanimo learning quest. Approved Cerbanimo task evidence can return to the learner passport as practice experience, but only when the evidence matches the learning objective."
          ],
          concepts:[
            ["Quest","A shared intention expressed as a structured project with roles, tasks, dependencies, and outcomes."],
            ["Evidence loop","Criteria, proof, review, correction, and appeal used to protect shared trust."],
            ["Portable memory","Contribution and project records that can leave one operator or instance."]
          ],
          exercise:{
            title:"Design a Cerbanimo practicum",
            prompt:"Take one lesson objective and turn it into a real-world quest with three tasks, skill domains, proof requirements, review, and reflection.",
            rubric:["Real-world objective","Claimable tasks","Evidence requirements","Review path","Reflection and next quest"]
          }
        },
        {
          title:"Anarchadia: governance as a public practice",
          kicker:"Upcoming system",
          domain:"governance",
          summary:"Anarchadia is the upcoming constitutional and governance laboratory for drafting agreements, delegation, recall, amendment, dissent, appeals, and connections from decisions into implementation.",
          objectives:[
            "Treat governance as an editable artifact instead of administrator settings.",
            "Identify capture paths in a constitution.",
            "Connect an Anarchadia decision to Cerbanimo work without fusing the two systems."
          ],
          paragraphs:[
            "Anarchadia is intended to make the rules of shared life visible enough to inspect and revise. A group can draft who may propose, which decisions use consent or voting, what can be delegated, when emergency authority ends, and how appeals or amendments work.",
            "A constitution is not safe merely because it uses democratic vocabulary. Unanimity can create brittle vetoes. Delegates can accumulate information. Emergency powers can renew themselves. Open-source software can still trap data and identity.",
            "The bridge to Cerbanimo should be constitutional interoperability: Anarchadia transmits a bounded decision or mandate; Cerbanimo coordinates implementation and evidence; either system remains independently exportable, auditable, and replaceable."
          ],
          concepts:[
            ["Constitutional interoperability","Systems exchange bounded decisions while preserving independent governance, audit, export, and refusal."],
            ["Emergency sunset","A concrete ending or external review point for extraordinary authority."],
            ["Minority report","A preserved record of dissent that can inform appeals, revision, and federation."]
          ],
          exercise:{
            title:"Debug a constitution",
            prompt:"Draft ten short rules for a local federation. Then identify one agenda bottleneck, one emergency-power risk, one data-captivity risk, and one correction path.",
            rubric:["Proposal rights","Decision rule","Bounded delegation","Appeals and amendment","Portability"]
          }
        },
        {
          title:"Capstone: build a federated campaign",
          kicker:"Applied synthesis",
          domain:"organizing",
          summary:"The capstone combines self-management, direct action, federation, Cerbanimo coordination, and Anarchadia governance into one field-ready campaign.",
          objectives:[
            "Design an intervention and a durable capacity together.",
            "Separate governance decisions from implementation tasks.",
            "Create proof, review, reflection, and knowledge-transfer paths."
          ],
          paragraphs:[
            "Begin with one condition close enough to investigate: unsafe housing, a broken workplace process, inaccessible community infrastructure, a resource bottleneck, or a founder-dependent mutual-aid network.",
            "Use Anarchadia-style constitutional questions to decide who may propose, what can be delegated, how dissent is preserved, and how emergency authority ends. Translate the resulting mandate into a Cerbanimo quest with claimable work, skills, resources, proof, and review.",
            "The capstone succeeds when the immediate project matters and the people involved become more capable of repeating, teaching, revising, or federating the process."
          ],
          concepts:[
            ["Campaign architecture","The relationship among conditions, people, governance, tasks, evidence, and future capacity."],
            ["Capacity transfer","Documentation, rotation, training, and handoffs that make knowledge less concentrated."],
            ["Field credential","A portable claim backed by reviewed evidence of applied competence."]
          ],
          exercise:{
            title:"Compile the campaign packet",
            prompt:"Create a field packet containing the condition, participant map, constitutional mandate, Cerbanimo quest, proof rubric, review path, reflection prompts, and one badge proposal.",
            rubric:["Situation and stakeholders","Governance mechanism","Implementation plan","Evidence and review","Capacity and credential"]
          }
        }
      ]
    };

    const genericPhases = [
      {title:"Foundations and vocabulary",kicker:"Orientation",domain:"theory"},
      {title:"Systems and relationships",kicker:"Structure",domain:"theory"},
      {title:"Methods and practice",kicker:"Technique",domain:"subjectPractice"},
      {title:"Failure modes and critique",kicker:"Stress test",domain:"review"},
      {title:"Applications and cases",kicker:"Applied learning",domain:"subjectPractice"},
      {title:"Capstone project",kicker:"Synthesis",domain:"teaching"},
      {title:"Advanced integration",kicker:"Next layer",domain:"subjectPractice"},
      {title:"Teach and transfer",kicker:"Knowledge commons",domain:"teaching"}
    ];

    const stopWords = new Set("about after again against also among because before being between could every first from have into more most other should some such than that their there these they this through under very what when where which while with would your subject source notes school teach learning".split(" "));

    function deepClone(value) {
      return JSON.parse(JSON.stringify(value));
    }

    function nowIso() {
      return new Date().toISOString();
    }

    function parseSeed() {
      try { return JSON.parse(document.getElementById("school-seed").textContent); }
      catch { return {}; }
    }


    const USD=new Intl.NumberFormat("en-US",{style:"currency",currency:"USD"});

    const COMMERCE_PLANS={
      commons:{
        id:"commons",
        name:"Commons",
        priceCents:0,
        interval:"forever",
        aiAllowanceCents:0,
        seats:1,
        marketplaceFeePercent:15,
        featured:false,
        description:"Everything needed to learn, build, and export with local AI or your own API key.",
        features:[
          "Unlimited local and bring-your-own-key generation",
          "Starter templates and portable schools",
          "Learner passport, practica, review, and credentials",
          "Creator storefront with 15% platform fee",
          "Offline and mesh-ready exports"
        ]
      },
      individual:{
        id:"individual",
        name:"Individual",
        priceCents:500,
        interval:"month",
        aiAllowanceCents:150,
        seats:1,
        marketplaceFeePercent:10,
        featured:true,
        description:"A tiny monthly plan that removes model setup for learners and independent creators.",
        features:[
          "$1.50 monthly hosted Gemini allowance",
          "No API key or model installation required",
          "One public creator storefront",
          "10% marketplace platform fee",
          "Purchase sync and signed offline receipts"
        ]
      },
      creator:{
        id:"creator",
        name:"Creator Studio",
        priceCents:1900,
        interval:"month",
        aiAllowanceCents:800,
        seats:3,
        marketplaceFeePercent:5,
        featured:false,
        description:"For experts who publish, revise, support, and sell multiple pathways.",
        features:[
          "$8 monthly hosted Gemini allowance",
          "Three collaborator seats",
          "Creator analytics and exportable sales ledger",
          "5% marketplace platform fee",
          "Workshops, certification pathways, and cohort licenses"
        ]
      },
      institution:{
        id:"institution",
        name:"Institution",
        priceCents:39900,
        interval:"month",
        aiAllowanceCents:15000,
        seats:100,
        marketplaceFeePercent:3,
        featured:false,
        description:"Private catalogs, cohorts, review operations, and managed hosted AI for organizations.",
        features:[
          "$150 monthly hosted Gemini allowance",
          "100 learner, reviewer, and facilitator seats",
          "Private and public catalog controls",
          "Organization vouchers and portable entitlements",
          "3% marketplace fee and volume licensing"
        ]
      }
    };

    const MARKET_CATEGORIES=[
      "AI and digital literacy",
      "Arts and communication",
      "Civic life and governance",
      "Community resilience",
      "Computing and engineering",
      "Health and safety",
      "Language learning",
      "Life and financial skills",
      "Organizing and cooperation",
      "Professional practice",
      "Science and environment",
      "Teaching and facilitation"
    ];


    const HELP_TYPES={
      "quick-question":{id:"quick-question",label:"Quick answer",summary:"A focused asynchronous answer to one narrow question.",defaultPriceCents:500,live:false},
      "artifact-review":{id:"artifact-review",label:"Artifact review",summary:"Criteria-based feedback on a document, design, plan, code sample, or evidence packet.",defaultPriceCents:1500,live:false},
      "office-hours":{id:"office-hours",label:"Office hours",summary:"A short live session to diagnose a blocker and choose the next action.",defaultPriceCents:2000,live:true},
      "oral-assessment":{id:"oral-assessment",label:"Oral assessment",summary:"A live explanation or demonstration assessed against visible criteria.",defaultPriceCents:3500,live:true},
      "portfolio-critique":{id:"portfolio-critique",label:"Portfolio critique",summary:"Structured feedback across several artifacts and the story they tell.",defaultPriceCents:5000,live:false},
      "project-unstick":{id:"project-unstick",label:"Unstick session",summary:"A bounded working session focused on the next practical move.",defaultPriceCents:1800,live:true}
    };

    const SEEDED_EXPERT_SERVICES=[
      {id:"service-facilitation-15",expertId:"expert-rowan",expertName:"Rowan Fieldworks",title:"Fifteen-minute facilitation unstick",type:"project-unstick",description:"Clarify the meeting problem, identify the decision boundary, and leave with one next action.",skills:["facilitation","meetings","cooperative governance"],priceCents:1500,duration:"15m",turnaround:"Tue–Thu evenings ET",capacity:5,status:"published",rating:4.9,completed:84,responseHours:5,badges:["identity checked","84 completed","appeals clean"],source:"seed"},
      {id:"service-js-review",expertId:"expert-ami",expertName:"Ami Debug Cooperative",title:"JavaScript code and bug review",type:"artifact-review",description:"Review one small browser project or focused bug reproduction with line-level notes and a repair plan.",skills:["javascript","web development","debugging"],priceCents:2200,duration:"async-30m",turnaround:"Within 48 hours",capacity:8,status:"published",rating:4.8,completed:132,responseHours:9,badges:["portfolio verified","132 completed"],source:"seed"},
      {id:"service-writing-critique",expertId:"expert-sable",expertName:"Sable Draft Room",title:"Short-form writing critique",type:"artifact-review",description:"A supportive critique of up to 2,000 words focused on clarity, structure, and revision priorities.",skills:["creative writing","editing","communication"],priceCents:1800,duration:"async-30m",turnaround:"Within 72 hours",capacity:6,status:"published",rating:4.7,completed:59,responseHours:14,badges:["sample reviewed","59 completed"],source:"seed"},
      {id:"service-garden-office",expertId:"expert-mara",expertName:"Mara North Garden",title:"Garden planning office hours",type:"office-hours",description:"Discuss a small garden plan, local constraints, soil questions, and a realistic seasonal next step. Not a toxicology service.",skills:["gardening","soil","climate resilience"],priceCents:2500,duration:"30m",turnaround:"Saturday mornings ET",capacity:4,status:"published",rating:4.9,completed:47,responseHours:8,badges:["regional practice","47 completed"],source:"seed"},
      {id:"service-oral-tech",expertId:"expert-ion",expertName:"Ion Skills Review",title:"Technical oral assessment",type:"oral-assessment",description:"Explain and defend a small technical project against a shared rubric. Includes written assessor notes.",skills:["software engineering","systems design","oral assessment"],priceCents:4500,duration:"60m",turnaround:"Book 3–10 days ahead",capacity:3,status:"published",rating:4.85,completed:31,responseHours:10,badges:["assessment calibrated","31 completed"],source:"seed"},
      {id:"service-portfolio",expertId:"expert-nova",expertName:"Nova Practice Studio",title:"Evidence portfolio critique",type:"portfolio-critique",description:"Review up to five artifacts for coherence, evidence strength, missing context, and next portfolio improvement.",skills:["portfolio","evidence","career transition","art and design"],priceCents:6500,duration:"async-30m",turnaround:"Within five days",capacity:4,status:"published",rating:4.75,completed:42,responseHours:16,badges:["portfolio verified","42 completed"],source:"seed"}
    ];

    const STARTER_TEMPLATES=[
      {
        id:"ai-literacy",
        title:"AI Literacy and Verification",
        category:"AI and digital literacy",
        level:"introductory",
        outcome:"Use language models without mistaking confidence for evidence.",
        dataFile:"starter-ai-literacy-verification.school-data.json",
        prompt:"Build a beginner-friendly school on AI literacy, source evaluation, hallucination detection, privacy, and verification."
      },
      {
        id:"computer-literacy",
        title:"Computer Literacy from Zero",
        category:"AI and digital literacy",
        level:"introductory",
        outcome:"Navigate files, browsers, accounts, security, and common productivity tools.",
        dataFile:"starter-computer-literacy-zero.school-data.json",
        prompt:"Build a zero-assumption computer literacy pathway with practical exercises and accessible vocabulary."
      },
      {
        id:"personal-finance-us",
        title:"Personal Finance Foundations",
        category:"Life and financial skills",
        level:"introductory",
        outcome:"Build a budget, understand debt, compare financial products, and recognize scams.",
        dataFile:"starter-personal-finance-us.school-data.json",
        prompt:"Build a United States personal finance foundation school using USD, visible assumptions, and non-advisory educational framing."
      },
      {
        id:"project-management",
        title:"Project Management for Real Work",
        category:"Professional practice",
        level:"introductory",
        outcome:"Turn a goal into scoped tasks, evidence, risks, and a workable review rhythm.",
        dataFile:"starter-project-management-practice.school-data.json",
        prompt:"Build a practical project management school focused on decomposition, dependencies, evidence, communication, and retrospectives."
      },
      {
        id:"javascript",
        title:"JavaScript by Building",
        category:"Computing and engineering",
        level:"introductory",
        outcome:"Understand core JavaScript by creating small, inspectable browser projects.",
        dataFile:"starter-javascript-by-building.school-data.json",
        prompt:"Build a novice JavaScript course around runnable browser projects, debugging, and conceptual checks."
      },
      {
        id:"cybersecurity",
        title:"Everyday Cybersecurity",
        category:"AI and digital literacy",
        level:"introductory",
        outcome:"Protect accounts, devices, messages, and personal information from common threats.",
        dataFile:"starter-everyday-cybersecurity.school-data.json",
        prompt:"Build a defensive everyday cybersecurity school with threat modeling, account hygiene, phishing recognition, and recovery plans."
      },
      {
        id:"cooperative-governance",
        title:"Cooperative Governance",
        category:"Civic life and governance",
        level:"intermediate",
        outcome:"Design mandates, delegation, recall, decision rules, and transparent accountability.",
        dataFile:"starter-cooperative-governance.school-data.json",
        prompt:"Build a practice-centered cooperative governance school using bounded mandates, recallable delegation, facilitation, and appeals."
      },
      {
        id:"community-organizing",
        title:"Community Organizing Foundations",
        category:"Organizing and cooperation",
        level:"introductory",
        outcome:"Map stakeholders, listen, build trust, choose tactics, and sustain shared work.",
        dataFile:"starter-community-organizing.school-data.json",
        prompt:"Build a constructive, nonviolent community organizing foundation school centered on listening, power mapping, mutual aid, and durable participation."
      },
      {
        id:"climate-resilience",
        title:"Neighborhood Climate Resilience",
        category:"Community resilience",
        level:"intermediate",
        outcome:"Assess local vulnerabilities and design evidence-aware resilience projects.",
        dataFile:"starter-neighborhood-climate-resilience.school-data.json",
        prompt:"Build a local climate resilience school covering heat, flooding, communications, vulnerable neighbors, and verification of local conditions."
      },
      {
        id:"home-gardening",
        title:"Home and Community Gardening",
        category:"Science and environment",
        level:"introductory",
        outcome:"Plan, plant, observe, and improve a small food or pollinator garden.",
        dataFile:"starter-home-community-gardening.school-data.json",
        prompt:"Build a seasonal beginner gardening school with observation logs, local adaptation, soil safety, and practical projects."
      },
      {
        id:"health-literacy",
        title:"Health Information Literacy",
        category:"Health and safety",
        level:"introductory",
        outcome:"Read health claims carefully, prepare questions, and recognize when professional care is needed.",
        dataFile:"starter-health-information-literacy.school-data.json",
        prompt:"Build a health information literacy school that avoids diagnosis, teaches evidence quality, and clearly escalates urgent or professional-care needs."
      },
      {
        id:"ged-math",
        title:"GED Math Foundations",
        category:"Science and environment",
        level:"introductory",
        outcome:"Rebuild arithmetic, algebra, geometry, graphs, and test confidence.",
        dataFile:"starter-ged-math-foundations.school-data.json",
        prompt:"Build a scaffolded GED math foundation pathway with worked examples, short-answer checks, and diagnostic branching."
      },
      {
        id:"english-language",
        title:"Practical English for Daily Life",
        category:"Language learning",
        level:"introductory",
        outcome:"Practice useful reading, writing, listening, and speaking situations.",
        dataFile:"starter-practical-english-daily-life.school-data.json",
        prompt:"Build a practical English language pathway around daily tasks, respectful communication, and reusable sentence patterns."
      },
      {
        id:"creative-writing",
        title:"Creative Writing Workshop",
        category:"Arts and communication",
        level:"introductory",
        outcome:"Generate, revise, share, and evaluate short fiction or memoir.",
        dataFile:"starter-creative-writing-workshop.school-data.json",
        prompt:"Build a low-pressure creative writing workshop with prompts, craft experiments, revision, and peer feedback."
      },
      {
        id:"maker-electronics",
        title:"Maker Electronics",
        category:"Computing and engineering",
        level:"introductory",
        outcome:"Understand circuits and build small low-voltage projects safely.",
        dataFile:"starter-maker-electronics.school-data.json",
        prompt:"Build a beginner low-voltage electronics school with circuit concepts, measurement, safe handling, and small builds."
      },
      {
        id:"teaching-the-teacher",
        title:"Teaching the Teacher",
        category:"Teaching and facilitation",
        level:"intermediate",
        outcome:"Turn expertise into teachable sequences, evidence, feedback, and transfer.",
        dataFile:"starter-teaching-the-teacher.school-data.json",
        prompt:"Build a train-the-trainer school on learning objectives, examples, misconceptions, assessment, facilitation, and knowledge transfer."
      },
      {
        id:"nny-foraging",
        title:"Northern New York Foraging",
        category:"Science and environment",
        level:"intermediate",
        outcome:"Organize seasonal source material while preserving identification, legal, and consumption safety gates.",
        dataFile:"starter-nny-foraging-reviewed.school-data.json",
        prompt:"Build a source-grounded Northern New York foraging school with strict identification, legality, expert verification, and consumption warnings."
      },
      {
        id:"mutual-aid-operations",
        title:"Mutual Aid Operations",
        category:"Organizing and cooperation",
        level:"intermediate",
        outcome:"Receive needs, coordinate resources, protect dignity, and close the loop with evidence.",
        dataFile:"starter-mutual-aid-operations.school-data.json",
        prompt:"Build a mutual aid operations school covering needs intake, consent, resource matching, logistics, safety, review, and storytelling."
      }
    ];

    function planFor(id){
      return COMMERCE_PLANS[id]||COMMERCE_PLANS.commons;
    }

    function formatMoneyFromCents(cents){
      return USD.format((Number(cents)||0)/100);
    }

    function defaultCommerceState(){
      return {
        noviceMode:true,
        onboarding:{
          completed:false,
          step:0,
          displayName:"",
          goal:"",
          role:"learner",
          aiMode:"local",
          planId:"commons",
          selectedTemplateId:""
        },
        planId:"commons",
        pendingPlanId:"individual",
        entitlement:{
          schema:"living-academy-entitlement-1.0",
          id:"entitlement-local-commons",
          planId:"commons",
          status:"active",
          source:"local",
          issuedAt:new Date().toISOString(),
          expiresAt:null,
          seats:1,
          buyerEmail:"",
          accessToken:""
        },
        aiWallet:{
          balanceCents:0,
          allowanceCents:0,
          spentCents:0,
          periodStart:new Date().toISOString(),
          periodEnd:null,
          usage:[]
        },
        billingEmail:"",
        billingConfig:{
          brokerEndpoint:"",
          stripeLinks:{individual:"",creator:"",institution:"",topup:""},
          paypalLinks:{individual:"",creator:"",institution:""},
          customerPortalUrl:"",
          connectOnboardingUrl:"",
          publicJwk:"",
          platformFeePercent:12,
          policies:{
            terms:"",
            privacy:"",
            refunds:"",
            acceptableUse:"",
            creatorAgreement:""
          }
        },
        creator:{
          storeName:"",
          expertise:"",
          connected:false,
          connectedAccountId:"",
          termsAccepted:false
        },
        organization:{
          name:"",
          seats:25,
          catalogMode:"public-plus-private"
        },
        listings:[],
        orders:[],
        sales:[],
        library:[],
        expertProfile:{displayName:"",bio:"",skills:[],connected:false,termsAccepted:false},
        expertServices:[],
        helpRequests:[],
        engagements:[],
        helpMessages:[],
        reviewCredits:{balanceCents:0,sponsor:"",ledger:[]},
        helpSearch:"",
        helpServiceFilter:"all",
        selectedHelpRequestId:"",
        selectedExpertServiceId:"",
        selectedTemplateId:"",
        selectedListingId:"",
        marketSearch:"",
        marketCategory:"all",
        marketPriceFilter:"all",
        demoMode:true
      };
    }

    function ensureCommerceState(){
      const defaults=defaultCommerceState();
      state.commerce={
        ...defaults,
        ...(state.commerce||{}),
        onboarding:{...defaults.onboarding,...(state.commerce?.onboarding||{})},
        entitlement:{...defaults.entitlement,...(state.commerce?.entitlement||{})},
        aiWallet:{...defaults.aiWallet,...(state.commerce?.aiWallet||{}),usage:Array.isArray(state.commerce?.aiWallet?.usage)?state.commerce.aiWallet.usage:[]},
        billingConfig:{
          ...defaults.billingConfig,
          ...(state.commerce?.billingConfig||{}),
          stripeLinks:{...defaults.billingConfig.stripeLinks,...(state.commerce?.billingConfig?.stripeLinks||{})},
          paypalLinks:{...defaults.billingConfig.paypalLinks,...(state.commerce?.billingConfig?.paypalLinks||{})},
          policies:{...defaults.billingConfig.policies,...(state.commerce?.billingConfig?.policies||{})}
        },
        creator:{...defaults.creator,...(state.commerce?.creator||{})},
        organization:{...defaults.organization,...(state.commerce?.organization||{})},
        expertProfile:{...defaults.expertProfile,...(state.commerce?.expertProfile||{}),skills:Array.isArray(state.commerce?.expertProfile?.skills)?state.commerce.expertProfile.skills:[]},
        reviewCredits:{...defaults.reviewCredits,...(state.commerce?.reviewCredits||{}),ledger:Array.isArray(state.commerce?.reviewCredits?.ledger)?state.commerce.reviewCredits.ledger:[]},
        listings:Array.isArray(state.commerce?.listings)?state.commerce.listings:[],
        orders:Array.isArray(state.commerce?.orders)?state.commerce.orders:[],
        sales:Array.isArray(state.commerce?.sales)?state.commerce.sales:[],
        library:Array.isArray(state.commerce?.library)?state.commerce.library:[],
        expertServices:Array.isArray(state.commerce?.expertServices)?state.commerce.expertServices:[],
        helpRequests:Array.isArray(state.commerce?.helpRequests)?state.commerce.helpRequests:[],
        engagements:Array.isArray(state.commerce?.engagements)?state.commerce.engagements:[],
        helpMessages:Array.isArray(state.commerce?.helpMessages)?state.commerce.helpMessages:[]
      };
      state.commerce.planId=planFor(state.commerce.entitlement?.planId||state.commerce.planId).id;
      document.body.classList.toggle("novice-mode",state.commerce.noviceMode!==false);
    }


    function defaultConstellationState(){
      return {
        schema:"living-academy-learner-constellation-1.0",
        schoolId:"",
        concepts:{},
        misconceptions:[],
        diagnostics:[],
        reviewHistory:[],
        activeDiagnostic:null,
        activeReviewConceptId:"",
        selectedNodeId:"",
        filter:"all",
        domainFilter:"all",
        lastBuiltAt:null,
        settings:{dailyReviewLimit:8,newConceptStrength:20}
      };
    }

    function ensureConstellationState(){
      const defaults=defaultConstellationState();
      state.learner.constellation={
        ...defaults,
        ...(state.learner.constellation||{}),
        concepts:{...(state.learner.constellation?.concepts||{})},
        misconceptions:Array.isArray(state.learner.constellation?.misconceptions)?state.learner.constellation.misconceptions:[],
        diagnostics:Array.isArray(state.learner.constellation?.diagnostics)?state.learner.constellation.diagnostics:[],
        reviewHistory:Array.isArray(state.learner.constellation?.reviewHistory)?state.learner.constellation.reviewHistory:[],
        settings:{...defaults.settings,...(state.learner.constellation?.settings||{})}
      };
      if(state.school) syncConstellationToSchool();
      return state.learner.constellation;
    }

    function defaultState() {
      const seed = parseSeed();
      return {
        ...seed,
        school:null,
        learner:{
          displayName:"Local learner",
          learnerId:"did:cerbanimo:local-learner",
          domainXP:Object.fromEntries(Object.keys(domains).map(domain => [domain,0])),
          constellation:defaultConstellationState()
        },
        clearedModules:[],
        mastery:{},
        xpLedger:[],
        badges:[],
        artifacts:[],
        events:[],
        processedRewards:[],
        credentialProposals:[],
        quizDrafts:{},
        assessment:{
          policy:"learner-first",
          autosaveDrafts:true,
          showIdeaCoaching:true,
          allowReviewChallenges:true,
          reviewRequests:[]
        },
        commonweave:{activeJourney:null,pathHistory:[],mossFlow:null},
        commerce:defaultCommerceState(),
        academy:{
          activeWorkspace:"learn",
          traversalMode:"guided",
          appearanceMode:"paper",
          selectedModuleId:null,
          cohorts:[],
          activeCohortId:null,
          practica:[],
          reviews:[],
          facilitatorNotes:[],
          projectGate:{schema:"living-school-project-gate-1.2",status:"not-started",projectRef:"",projectId:"",projectUrl:"",brief:null,history:[],updatedAt:null,requestId:"",pendingSince:null,submittedAt:null,lastCheckedAt:null,lastReceipt:null,sendAttempts:0,transportState:"idle",lastRefreshError:"",lastRefreshRequestId:"",receiptIds:[],statusRevision:0},
          finalTest:{schema:"living-school-final-test-1.1",attempts:[],activeAttempt:null,passed:false,pendingReview:false,completionRecord:null},
          schoolVersions:[]
        }
      };
    }

    function loadState() {
      try {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
        return saved ? {
          ...defaultState(),
          ...saved,
          learner:{
            ...defaultState().learner,
            ...saved.learner,
            domainXP:{...defaultState().learner.domainXP,...saved.learner?.domainXP},
            constellation:{...defaultConstellationState(),...(saved.learner?.constellation||{})}
          },
          academy:{
            ...defaultState().academy,
            ...(saved.academy||{}),
            projectGate:{...defaultState().academy.projectGate,...(saved.academy?.projectGate||{})},
            finalTest:{...defaultState().academy.finalTest,...(saved.academy?.finalTest||{}),attempts:Array.isArray(saved.academy?.finalTest?.attempts)?saved.academy.finalTest.attempts:[]},
            schoolVersions:Array.isArray(saved.academy?.schoolVersions)?saved.academy.schoolVersions:[]
          },
          assessment:{...defaultState().assessment,...(saved.assessment||{})},
          quizDrafts:{...(saved.quizDrafts||{})},
          commerce:{...defaultCommerceState(),...(saved.commerce||{})}
        } : defaultState();
      } catch {
        return defaultState();
      }
    }

    let state = loadState();
    let activeModuleId = null;
    let compiledPacket = "";

    function saveState() {
      let persisted=true;
      try { localStorage.setItem(STORAGE_KEY,JSON.stringify(state)); }
      catch(error) { persisted=false; console.warn("Living School could not persist the latest state",error); }
      try { document.getElementById("school-seed").textContent = JSON.stringify(state,null,2); }
      catch(error) { console.warn("Living School could not refresh the embedded state packet",error); }
      return persisted;
    }

    function slug(text) {
      return String(text || "item").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,80) || "item";
    }

    function tokenize(text) {
      return String(text || "").toLowerCase().replace(/[^a-z0-9'’-]+/g," ").trim().split(/\s+/).filter(Boolean);
    }

    function keywords(text,limit=12) {
      const counts = {};
      tokenize(text).forEach(word => {
        if (word.length < 4 || stopWords.has(word)) return;
        counts[word]=(counts[word]||0)+1;
      });
      return Object.entries(counts).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])).slice(0,limit).map(([word])=>word);
    }

    function sentences(text) {
      return String(text || "").split(/(?<=[.!?])\s+|\n+/).map(item=>item.trim()).filter(item=>item.length>24);
    }

    function sample(array,index=0) {
      if (!array.length) return "";
      return array[Math.abs(index)%array.length];
    }

    function titleCase(text) {
      return String(text || "").replace(/\b\w/g,character=>character.toUpperCase());
    }

    function escapeHTML(text) {
      return String(text).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
    }

    function safeExternalURL(value){
      try{
        const url=new URL(String(value||""),location.href);
        if(!["http:","https:"].includes(url.protocol)) return "";
        return url.href;
      }catch{return "";}
    }

    function safeModelEndpoint(value){
      const endpoint=safeExternalURL(value);
      if(!endpoint) throw new Error("Model endpoints must use HTTP or HTTPS.");
      return endpoint;
    }

    async function boundedResponseText(response,maxBytes=5_000_000){
      const declared=Number(response.headers.get("content-length")||0);
      if(Number.isFinite(declared)&&declared>maxBytes) throw new Error("The model response is too large.");
      if(!response.body){
        const text=await response.text();
        if(new TextEncoder().encode(text).byteLength>maxBytes) throw new Error("The model response is too large.");
        return text;
      }
      const reader=response.body.getReader();
      const decoder=new TextDecoder();
      let bytes=0,text="";
      try{
        while(true){
          const {done,value}=await reader.read();
          if(done) break;
          bytes+=value.byteLength;
          if(bytes>maxBytes){
            await reader.cancel();
            throw new Error("The model response is too large.");
          }
          text+=decoder.decode(value,{stream:true});
        }
        return text+decoder.decode();
      }finally{
        reader.releaseLock();
      }
    }

    function assertBoundedModelMessages(messages){
      const encoded=new TextEncoder().encode(JSON.stringify(messages||[]));
      if(encoded.byteLength>1_000_000) throw new Error("The model request is too large. Reduce the source pack or prompt.");
    }

    function toast(message) {
      const node=document.getElementById("toast");
      node.textContent=message;
      node.classList.add("show");
      clearTimeout(toast.timer);
      toast.timer=setTimeout(()=>node.classList.remove("show"),2400);
    }

    function emit(type,payload={},dedupeKey=null) {
      const event={id:`event-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,type,at:new Date().toISOString(),payload,dedupeKey};
      state.events.push(event);
      state.events=state.events.slice(-250);
      return event;
    }

    function levelForXP(xp) {
      return Math.floor(Math.sqrt(Math.max(0,Number(xp||0))/40))+1;
    }

    function commonweaveRewardLedger(){
      try{
        const current=JSON.parse(localStorage.getItem("living-school.reward-ledger.v1.1")||"null");
        if(current&&current.schema==="living-school.skill-ledger.v1.1")return current;
        const legacy=JSON.parse(localStorage.getItem("living-school.reward-ledger.v1")||"null");
        return legacy&&legacy.schema==="living-school.skill-ledger.v1"?legacy:null;
      }catch{return null;}
    }

    function totalXP() {
      const ledger=commonweaveRewardLedger();
      return Array.isArray(ledger?.xpReceipts)?ledger.xpReceipts.reduce((sum,receipt)=>sum+Number(receipt.amount||0),0):0;
    }

    function canonicalLivingReward({id,title,skillName,amount,reason,evidenceSummary,eventKey,validationThreshold=1}){
      const api=window.CommonweaveRewardWeave;if(!api)return false;
      const learnerId=(()=>{try{return JSON.parse(localStorage.getItem("commonweave-identity-vault")||"null")?.identity?.identityId||state.learner.learnerId}catch{return state.learner.learnerId}})();
      const text=String(evidenceSummary||reason||title).slice(0,50000);
      const skillRewards=[{name:skillName,xp:Math.max(0,Math.round(Number(amount||0))),xpRationale:reason,evidenceRubric:[`The learner completed ${title}.`,`The activity produced inspectable evidence or an assessment result.`]}];
      api.submit({schema:"commonweave.reward-weave.v1.1",id,source:"living",kind:"lesson",subjectId:eventKey,subjectTitle:title,journeyId:state.commonweave?.activeJourney?.id||state.school?.id||"local-school",contributorId:learnerId,contributorName:state.learner.displayName,evidenceSummary:text,evidenceRefs:[eventKey],evidenceArtifacts:[{id:`living-evidence:${eventKey}`,name:`Evidence for ${title}`,mimeType:"text/plain",bytes:new TextEncoder().encode(text).byteLength,contentHash:`living:${stableHash(text)}`,inlineText:text,sourceRef:eventKey,availability:"inline",createdAt:new Date().toISOString()}],skillRewards,baseXp:Number(amount||0),baseAlreadyCredited:false,validationThreshold,escrowCoins:0,estimatedHours:1,automatability:.35,createdAt:new Date().toISOString()},learnerId,state.learner.displayName);
      return true;
    }

    function awardXP(domain,amount,reason,eventKey) {
      if (!domains[domain]) domain="subjectPractice";
      const key=`${eventKey}:${domain}`;
      if (state.processedRewards.includes(key)) return false;
      state.processedRewards.push(key);
      state.xpLedger.push({id:`legacy-marker-${Date.now()}`,at:new Date().toISOString(),domain,amount:0,reason:`Canonical XP routed: ${reason}`,eventKey,canonical:true});
      return canonicalLivingReward({id:`living:activity:${key}`,title:reason,skillName:domains[domain]||domain,amount,reason,evidenceSummary:reason,eventKey:key,validationThreshold:1});
    }

    function livingSkillRewards(module){
      const raw=[domains[module.domain]||module.domain,...(module.objectives||[]).slice(0,3)].filter(Boolean);
      const unique=[...new Set(raw.map(String))].slice(0,4);const total=Math.max(0,Math.round(Number(module.xp||0)));let remaining=total;
      return unique.map((name,index)=>{const xp=index===unique.length-1?remaining:Math.max(1,Math.round(total/Math.max(1,unique.length)));remaining-=xp;return{name,xp,xpRationale:`${xp} XP reflects the part of ${module.title} attributable to ${name}.`,evidenceRubric:[`The learner completed the assessment for ${module.title}.`,`The learner produced or reflected on the practical activity for ${module.title}.`]}});
    }

    function migrateLegacyXpToCanonical(){
      const api=window.CommonweaveRewardWeave;if(!api||localStorage.getItem("living-school.xp-canonical-migration.v1"))return;
      for(const entry of state.xpLedger||[]){if(!Number(entry.amount||0))continue;canonicalLivingReward({id:`living:legacy:${entry.eventKey||entry.id}`,title:entry.reason||"Legacy Living School activity",skillName:domains[entry.domain]||entry.domain||"Learning Practice",amount:Number(entry.amount||0),reason:`Migrated from the pre-RC15 Living School XP ledger. ${entry.reason||""}`,evidenceSummary:entry.reason||"Historical Living School activity",eventKey:entry.eventKey||entry.id,validationThreshold:1});}
      localStorage.setItem("living-school.xp-canonical-migration.v1",new Date().toISOString());
    }

    function schoolIsDefault(subject) {
      const lower=String(subject||"").toLowerCase();
      return /anarcho|syndical|cerbanimo|anarchadia/.test(lower);
    }


    function stableHash(text) {
      let hash=2166136261;
      const value=String(text||"");
      for(let i=0;i<value.length;i++){
        hash^=value.charCodeAt(i);
        hash=Math.imul(hash,16777619);
      }
      return (hash>>>0).toString(36);
    }

    function sourceRank(url) {
      if(!url) return "unverified";
      if(authoritativeSourceOverrides[url]?.rank) return authoritativeSourceOverrides[url].rank;
      const lower=url.toLowerCase();
      if(/\.gov(?:\/|$)|\.edu(?:\/|$)|cornell|extension\.|cdc\.gov|nols\.edu/.test(lower)) return "high";
      if(/books\.google|ethnobiology|clevelandclinic|mother earth news|outdoorlife|meateater|farmersalmanac|masterclass/.test(lower)) return "medium";
      if(/facebook|reddit|tiktok|youtube/.test(lower)) return "low";
      return "medium";
    }

    function extractRefs(text) {
      const refs=[];
      String(text||"").replace(/\[([0-9,\s]+)\]/g,(_,group)=>{
        group.split(",").map(item=>item.trim()).filter(Boolean).forEach(item=>refs.push(item));
        return _;
      });
      return [...new Set(refs)];
    }

    function cleanClaimText(text) {
      return String(text||"")
        .replace(/^[•*\-]\s*/,"")
        .replace(/^\d+[.)]\s*/,"")
        .replace(/\s*\[[0-9,\s]+\]\s*$/,"")
        .replace(/\s+/g," ")
        .trim();
    }

    function claimKind(text,heading) {
      const lower=`${heading} ${text}`.toLowerCase();
      if(/never|avoid|must|toxic|poison|hazard|safety|illegal|permit|do not|not adequate|requiring verification|critical/.test(lower)) return "warning";
      if(/step\s*\d|process|processing|boil|cook|dry|shell|crush|leach|harvest/.test(lower)) return "procedure";
      if(/season|spring|summer|fall|autumn|winter/.test(lower)) return "seasonal";
      if(/priority|calorie|energy|high priority|medium priority|low priority/.test(lower)) return "comparison";
      if(/source|reference|book|expert|citation/.test(lower)) return "source-rule";
      if(/^[A-Z][A-Za-z ()-]{2,45}:/.test(cleanClaimText(text))) return "entity";
      return "claim";
    }

    function safetyFlags(text) {
      const lower=String(text||"").toLowerCase();
      const flags=[];
      const map=[
        ["consumption",/\b(?:eat|edible|food|tea|drink|salad|calorie)s?\b|\bcoffee substitute\b/],
        ["toxin",/\b(?:toxic|poison|tannin|cyanide|sting|hazard)s?\b/],
        ["identification",/\b(?:identity|identification|look-alike|lookalike|species|mushroom|evergreen)s?\b/],
        ["water",/\b(?:water|giardia|parasite|boil)s?\b/],
        ["land-law",/\b(?:permit|illegal|permission|landowner)s?\b|\bstate land\b/],
        ["cold-weather",/\b(?:ice|frozen|winter|cold-water|wetland)s?\b/]
      ];
      map.forEach(([name,pattern])=>{if(pattern.test(lower))flags.push(name);});
      return flags;
    }

    function parseDataDump(text) {
      const raw=String(text||"").replace(/\r/g,"");
      const lines=raw.split("\n").map(line=>line.trim());
      const sources={};
      const contentLines=[];

      lines.forEach(line=>{
        const match=line.match(/^\[(\d+)\]\s*(?:\[(https?:\/\/[^\]]+)\]\((https?:\/\/[^)]+)\)|(https?:\/\/\S+))/);
        if(match){
          const id=match[1];
          const url=match[3]||match[4]||match[2];
          sources[id]={
            id,
            url,
            rank:sourceRank(url),
            label:authoritativeSourceOverrides[url]?.label || (()=>{try{return new URL(url).hostname.replace(/^www\./,"");}catch{return url;}})(),
            note:authoritativeSourceOverrides[url]?.note || ""
          };
        } else if(line) {
          contentLines.push(line);
        }
      });

      const sections=[];
      let current={title:"Overview",claims:[]};
      sections.push(current);
      let pendingStep=null;

      contentLines.forEach((line,index)=>{
        const markdownHeading=line.match(/^#{1,4}\s+(.+)/);
        const titleLine=!/[.!?]$/.test(line) && line.length<82 && /^[A-Z0-9][A-Za-z0-9 &()\/:+\-]+$/.test(line);
        if(markdownHeading || (titleLine && !/^[•*\-]/.test(line) && !/^\d+[.)]/.test(line))){
          const title=(markdownHeading?markdownHeading[1]:line).replace(/\*+/g,"").trim();
          if(title && !/^(Step \d+|Target|Extraction|Processing|Cooking)$/i.test(title)){
            current={title,claims:[]};
            sections.push(current);
            return;
          }
        }

        const stepHeading=line.match(/^#{0,4}\s*Step\s+(\d+)\s*:?\s*(.*)$/i);
        if(stepHeading){
          pendingStep=`Step ${stepHeading[1]}${stepHeading[2]?`: ${stepHeading[2]}`:""}`;
          current.claims.push({
            id:`claim-${sections.length}-${current.claims.length}`,
            text:pendingStep,
            raw:line,
            heading:current.title,
            kind:"procedure-step",
            refs:extractRefs(line),
            flags:safetyFlags(line)
          });
          return;
        }

        const cleaned=cleanClaimText(line);
        if(cleaned.length<12) return;
        current.claims.push({
          id:`claim-${sections.length}-${current.claims.length}`,
          text:cleaned,
          raw:line,
          heading:current.title,
          kind:claimKind(line,current.title),
          refs:extractRefs(line),
          flags:safetyFlags(`${current.title} ${line}`)
        });
      });

      const usableSections=sections.filter(section=>section.claims.length);
      const allClaims=usableSections.flatMap(section=>section.claims);
      allClaims.forEach(claim=>{
        const ranks=claim.refs.map(ref=>sources[ref]?.rank).filter(Boolean);
        claim.confidence=ranks.includes("high")?"high":ranks.includes("medium")?"medium":ranks.includes("low")?"low":"unverified";
        claim.sources=claim.refs.map(ref=>sources[ref]).filter(Boolean);
      });

      return {
        raw,
        sections:usableSections,
        claims:allClaims,
        sources,
        safetyFlags:[...new Set(allClaims.flatMap(claim=>claim.flags))],
        hash:stableHash(raw)
      };
    }

    function sourceSummary(parsed) {
      const counts={high:0,medium:0,low:0,unverified:0};
      Object.values(parsed.sources).forEach(source=>counts[source.rank]=(counts[source.rank]||0)+1);
      return counts;
    }

    function renderSourceAnalysis(parsed=null) {
      const node=document.getElementById("source-analysis");
      if(!node) return;
      if(!parsed){
        node.innerHTML=`
          <div class="source-analysis-card"><b>Compiler mode</b><span>Deterministic manifest</span></div>
          <div class="source-analysis-card"><b>Claims</b><span>0 parsed</span></div>
          <div class="source-analysis-card"><b>Sources</b><span>0 parsed</span></div>
          <div class="source-analysis-card"><b>Safety flags</b><span>0 detected</span></div>`;
        return;
      }
      const counts=sourceSummary(parsed);
      node.innerHTML=`
        <div class="source-analysis-card"><b>Stable build</b><span>Input hash ${escapeHTML(parsed.hash)}</span></div>
        <div class="source-analysis-card"><b>Claims</b><span>${parsed.claims.length} parsed into ${parsed.sections.length} sections</span></div>
        <div class="source-analysis-card"><b>Sources</b><span>${Object.keys(parsed.sources).length}: ${counts.high} high · ${counts.medium} medium · ${counts.low} low</span></div>
        <div class="source-analysis-card"><b>Safety flags</b><span>${parsed.safetyFlags.length}: ${escapeHTML(parsed.safetyFlags.join(", ")||"none")}</span></div>`;
    }

    function subjectNeedsSafetyGate(subject,parsed) {
      return /forag|wild edible|mushroom|survival|medicinal plant|wild plant|water treatment/i.test(subject) ||
        parsed.safetyFlags.some(flag=>["consumption","toxin","identification","water"].includes(flag));
    }

    function conceptFromClaim(claim,index) {
      const colon=claim.text.indexOf(":");
      if(colon>2 && colon<55){
        return [claim.text.slice(0,colon).trim(),claim.text.slice(colon+1).trim()];
      }
      const words=claim.text.split(/\s+/).slice(0,Math.min(5,claim.text.split(/\s+/).length)).join(" ");
      return [titleCase(words.replace(/[.,;:]$/,"")),claim.text];
    }

    function deterministicQuiz(module,index,allClaims=[]) {
      const questions=[];
      const concepts=module.concepts.slice(0,3);
      concepts.forEach((concept,qIndex)=>{
        const correct=concept[1];
        const alternatives=module.concepts.filter((_,i)=>i!==qIndex).map(item=>item[1]);
        const globalAlternatives=allClaims.filter(text=>text!==correct && !alternatives.includes(text));
        const distractors=[...alternatives,...globalAlternatives].slice(0,3);
        while(distractors.length<3) distractors.push("The source pack does not provide enough evidence for this statement.");
        const answers=[correct,...distractors];
        const shift=(stableHash(`${module.id}:${qIndex}`) .charCodeAt(0)+index+qIndex)%answers.length;
        const rotated=answers.slice(shift).concat(answers.slice(0,shift));
        questions.push({
          prompt:`Which statement is directly supported in this module's source material for ${concept[0]}?`,
          answers:rotated,
          correct:rotated.indexOf(correct),
          explanation:`Supported claim: ${correct}`
        });
      });
      const objective=module.objectives?.[0]||module.summary||module.title;
      const coachingIdeas=keywords(`${objective} ${module.summary||""}`,4);
      questions.push({
        id:`${module.id}-application`,
        type:"short-answer",
        prompt:`In your own words, explain how one idea from this module changes what you would do in practice.`,
        validation:{mode:"keywords",requiredKeywords:coachingIdeas,minimumKeywordMatches:1,minWords:12,maxWords:180,enforcement:"guidance",feedback:`Connect your answer to ${objective}`},
        explanation:`A strong answer connects a module concept to a concrete action, decision, or artifact.`,
        placeholder:"Name the idea, then explain the action it changes."
      });
      return questions.slice(0,5);
    }

    function exerciseForSection(section,subject,safetySensitive) {
      const title=section.title.toLowerCase();
      if(/safety|hazard|rule|authoritative/.test(title)){
        return {
          title:"Build a field safety gate",
          prompt:`Create a pre-field checklist for ${subject}. Separate positive identification, land permission, contamination, processing, weather, and emergency stop conditions. Do not authorize consumption from text or images alone.`,
          rubric:["Qualified identification process","Land permission and collection rules","Contamination and processing controls","Stop conditions and emergency plan","Source verification"]
        };
      }
      if(/step|process|processing|acorn|method/.test(title)){
        return {
          title:"Audit a procedure before practice",
          prompt:`Turn the source claims in "${section.title}" into a procedure audit. Mark which steps are authoritative, which are low-confidence, which require a specialist, and what evidence would validate each step.`,
          rubric:["Step sequence","Source quality per step","Hazards and contraindications","Verification plan","No unsupported instruction"]
        };
      }
      if(/season|spring|summer|fall|autumn|winter|berries|fruit|green/.test(title)){
        return {
          title:"Create a seasonal observation sheet",
          prompt:`Create a non-consumptive field observation sheet for "${section.title}". Include habitat, season, visible features, look-alike questions, land rules, source references, and a decision to observe rather than harvest when uncertain.`,
          rubric:["Season and habitat","Observable features","Look-alike questions","Legal and ecological checks","Source citations"]
        };
      }
      return {
        title:`Source-grounded application: ${section.title}`,
        prompt:`Create an artifact that applies the claims in "${section.title}" without exceeding the evidence in the source dump. Distinguish sourced facts, inferences, uncertainties, and next verification steps.`,
        rubric:["Uses extracted claims","Preserves uncertainty","Cites sources","Defines evidence","Includes a safe next step"]
      };
    }

    function buildModuleFromSection(section,index,subject,parsed,difficulty,mode) {
      const claims=section.claims.slice(0,9);
      const confidenceOrder={high:4,medium:3,low:2,unverified:1};
      const sorted=[...claims].sort((a,b)=>confidenceOrder[b.confidence]-confidenceOrder[a.confidence]);
      const concepts=sorted.slice(0,4).map(conceptFromClaim);
      while(concepts.length<3){
        concepts.push([`Source concept ${concepts.length+1}`,"The source pack does not contain enough structured claims for a fuller definition."]);
      }

      const refs=[...new Set(claims.flatMap(claim=>claim.refs))];
      const paragraphs=claims.map(claim=>{
        const citation=claim.refs.length?` [${claim.refs.join(", ")}]`:" [unverified in dump]";
        return `${claim.text}${citation}`;
      });
      if(difficulty==="advanced"){
        paragraphs.push("Advanced synthesis requirement: compare the strongest and weakest sources in this section, then state what additional evidence would change the curriculum.");
      }
      if(mode==="critical"){
        paragraphs.push("Critical lens: identify which claims could cause harm if treated as instructions before identification, legal, ecological, or food-safety review.");
      }

      const module={
        id:`module-${index+1}-${slug(section.title)}-${parsed.hash.slice(0,5)}`,
        title:section.title,
        kicker:claims.some(claim=>claim.kind==="warning")?"Safety-bearing source section":"Source-grounded section",
        domain:/safety|hazard|rule|source/i.test(section.title)?"review":/process|step|method|acorn/i.test(section.title)?"subjectPractice":/priority|survival/i.test(section.title)?"subjectPractice":"theory",
        summary:claims[0]?.text || `A source-grounded module about ${section.title}.`,
        objectives:[
          `Explain the claims grouped under "${section.title}" without adding unsupported facts.`,
          `Compare the confidence and provenance of at least two claims.`,
          claims.some(claim=>claim.flags.length)?"Identify the safety or legal decision points before action.":"Apply the section to a bounded observation or artifact."
        ],
        paragraphs,
        concepts,
        exercise:exerciseForSection(section,subject,subjectNeedsSafetyGate(subject,parsed)),
        claimLedger:claims,
        sourceRefs:refs,
        sourceConfidence:claims.some(claim=>claim.confidence==="high")?"mixed/high":claims.some(claim=>claim.confidence==="medium")?"mixed/medium":"low or unverified",
        provenance:`deterministic compiler · input ${parsed.hash}`,
        safetyNotice:claims.some(claim=>claim.flags.length)
          ?"This module contains claims that could affect health, food safety, legality, or field safety. Treat it as study material, not authorization to consume, harvest, or perform a procedure."
          :""
      };
      module.quiz=deterministicQuiz(module,index,parsed.claims.map(claim=>claim.text));
      module.visualization=buildVisualization(module,index);
      return module;
    }

    function buildSafetyModule(subject,parsed) {
      const authoritativeClaims=[
        {
          text:"Do not consume a wild plant or mushroom based on this school, a photograph, or one text description. Confirm identity with a qualified local expert and multiple authoritative regional references.",
          kind:"warning",refs:[],flags:["consumption","identification"],confidence:"high",sources:[]
        },
        {
          text:"NYSDEC says removing plants from New York State lands without a permit is illegal.",
          kind:"warning",refs:["101"],flags:["land-law"],confidence:"high",sources:[parsed.sources["101"]].filter(Boolean)
        },
        {
          text:"Cornell Cooperative Extension describes ramps as slow-growing and recommends harvest methods that retain bulbs and roots.",
          kind:"warning",refs:["102"],flags:["consumption","identification"],confidence:"high",sources:[parsed.sources["102"]].filter(Boolean)
        },
        {
          text:"Penn State Extension advises against eating elderberry leaves and recommends removing stems; cooking berries destroys toxins in the seeds.",
          kind:"warning",refs:["103"],flags:["consumption","toxin"],confidence:"high",sources:[parsed.sources["103"]].filter(Boolean)
        },
        {
          text:"CDC advises bringing clear backcountry water to a rolling boil for one minute, or three minutes above 6,500 feet.",
          kind:"procedure",refs:["104"],flags:["water"],confidence:"high",sources:[parsed.sources["104"]].filter(Boolean)
        }
      ];
      const section={title:"Safety, legality, and source quality",claims:authoritativeClaims};
      return buildModuleFromSection(section,0,subject,parsed,"advanced","critical");
    }

    function capstoneModule(subject,parsed,index,safetySensitive) {
      const title=safetySensitive?"Capstone: supervised seasonal field plan":`Capstone: source-grounded ${titleCase(subject)} project`;
      const module={
        id:`module-${index+1}-capstone-${parsed.hash.slice(0,5)}`,
        title,
        kicker:"Synthesis",
        domain:"teaching",
        summary:safetySensitive
          ?"Compile a non-consumptive field plan that demonstrates source evaluation, seasonal reasoning, legal and ecological checks, identification escalation, and explicit stop conditions."
          :`Build an artifact that synthesizes the strongest claims, procedures, uncertainties, and citations in the supplied ${subject} data dump.`,
        objectives:[
          "Separate source-backed claims from weak, disputed, or unverified claims.",
          "Build an artifact with citations and visible confidence labels.",
          safetySensitive?"Define expert verification and stop conditions before any harvest or consumption.":"Teach another person how to inspect the evidence and revise the result."
        ],
        paragraphs:[
          `The source dump contains ${parsed.claims.length} parsed claims across ${parsed.sections.length} sections and ${Object.keys(parsed.sources).length} source references.`,
          "The capstone should not flatten those materials into one authoritative voice. It should preserve provenance, show uncertainty, and identify the next source or expert needed.",
          safetySensitive
            ?"For foraging and survival topics, the safest successful capstone is an observation, documentation, or expert-led plan. This standalone school is not an identification or medical authority."
            :"The final artifact should be useful outside the school and reviewable by someone who did not build it."
        ],
        concepts:[
          ["Claim provenance","The relationship between a statement, its cited source, its confidence, and the transformations applied by the curriculum compiler."],
          ["Stop condition","A predefined point where uncertainty or risk requires observation, expert review, or refusal rather than continued action."],
          ["Transfer artifact","A document, map, procedure audit, or teaching object that another person can inspect and improve."]
        ],
        exercise:{
          title:"Compile the reviewed field packet",
          prompt:safetySensitive
            ?"Create a seasonal observation plan, source ledger, safety gate, legal check, expert-verification route, and a list of claims that must not be treated as instructions."
            :`Create a complete ${subject} field packet with claims, sources, confidence, an applied artifact, review criteria, reflection, and a teaching handoff.`,
          rubric:["Source ledger","Confidence labels","Safety or scope limits","Applied artifact","Review and knowledge transfer"]
        },
        claimLedger:parsed.claims.filter(claim=>claim.confidence==="low"||claim.confidence==="unverified").slice(0,8),
        sourceRefs:Object.keys(parsed.sources).slice(0,20),
        sourceConfidence:"mixed",
        provenance:`deterministic compiler · capstone · input ${parsed.hash}`,
        safetyNotice:safetySensitive?"No consumption, harvesting, or survival procedure should be attempted from this curriculum alone.":""
      };
      module.quiz=deterministicQuiz(module,index,parsed.claims.map(claim=>claim.text));
      module.visualization=buildVisualization(module,index);
      return module;
    }

    function compileSchoolFromDump(subject,notes,moduleCount,difficulty,mode,tone) {
      const parsed=parseDataDump(notes);
      renderSourceAnalysis(parsed);
      const safetySensitive=subjectNeedsSafetyGate(subject,parsed);
      let sections=parsed.sections.filter(section=>!/^(overview|sources?|references?)$/i.test(section.title));
      if(!sections.length) sections=parsed.sections;

      const modules=[];
      if(safetySensitive) modules.push(buildSafetyModule(subject,parsed));
      const available=Math.max(1,moduleCount-modules.length-1);
      sections.slice(0,available).forEach((section,index)=>{
        modules.push(buildModuleFromSection(section,modules.length,subject,parsed,difficulty,mode));
      });
      modules.push(capstoneModule(subject,parsed,modules.length,safetySensitive));

      return finalizeSchool({
        id:`school-${slug(subject)}-${parsed.hash}`,
        title:safetySensitive?`${titleCase(subject)} Field School`:`${titleCase(subject)} School`,
        subtitle:`Deterministic source-grounded curriculum · ${parsed.claims.length} claims`,
        subject,
        description:safetySensitive
          ?`A source-grounded field school compiled from the supplied dump. It teaches source evaluation, seasonal organization, safety gates, and supervised practice without treating text as authorization to consume or harvest.`
          :`A deterministic curriculum compiled from ${parsed.claims.length} claims and ${Object.keys(parsed.sources).length} cited sources.`,
        sourceNote:`source compiler · input ${parsed.hash}`,
        inputHash:parsed.hash,
        sourceAnalysis:{
          claims:parsed.claims.length,
          sections:parsed.sections.length,
          sources:Object.values(parsed.sources),
          safetyFlags:parsed.safetyFlags,
          deterministic:true
        },
        safetySensitive,
        modules:modules.slice(0,moduleCount)
      },{difficulty,mode,tone});
    }

    function generateGenericModule(subject,notes,phase,index,difficulty,mode,tone) {
      const parsed=parseDataDump(notes || `${subject}\n\nNo source pack supplied.`);
      const syntheticSection={
        title:phase.title,
        claims:[
          {
            text:`The school request identifies the subject as ${subject}.`,
            kind:"claim",refs:[],flags:[],confidence:"unverified",sources:[]
          },
          {
            text:`No detailed source dump was supplied for this section, so factual claims require later source ingestion.`,
            kind:"source-rule",refs:[],flags:[],confidence:"unverified",sources:[]
          },
          {
            text:`The instructional goal is to define scope, evidence, practice, critique, and knowledge transfer for ${subject}.`,
            kind:"claim",refs:[],flags:[],confidence:"unverified",sources:[]
          }
        ]
      };
      return buildModuleFromSection(syntheticSection,index,subject,parsed,difficulty,mode);
    }

    function buildQuiz(module,index) {
      if(module.quiz?.length) return module.quiz;
      return deterministicQuiz(module,index,module.paragraphs||[]);
    }

    const VISUALIZATION_TYPES=new Set(["network","flow","timeline","cycle","comparison","matrix","tree","custom"]);

    function visualizationItems(module,limit=6) {
      const concepts=(module.concepts||[]).slice(0,limit).map((concept,index)=>({
        id:`item-${index}`,
        label:String(concept[0]||`Concept ${index+1}`).slice(0,28),
        detail:String(concept[1]||module.summary||""),
        value:index+1,
        group:index%2?"B":"A"
      }));
      if(!concepts.length){
        concepts.push({id:"item-0",label:module.title.slice(0,28),detail:module.summary||module.title,value:1,group:"A"});
      }
      return concepts;
    }

    function chooseVisualizationType(module,preferred="auto") {
      if(VISUALIZATION_TYPES.has(preferred)) return preferred;
      const text=`${module.title} ${module.summary} ${(module.paragraphs||[]).join(" ")} ${(module.objectives||[]).join(" ")}`.toLowerCase();
      if(/timeline|history|season|spring|summer|autumn|fall|winter|year|era|chronolog/.test(text)) return "timeline";
      if(/step|process|procedure|workflow|sequence|pipeline|method|from .* to /.test(text)) return "flow";
      if(/cycle|feedback|repeat|iteration|recurr|loop/.test(text)) return "cycle";
      if(/compare|versus|tradeoff|priority|rank|difference|alternative/.test(text)) return "comparison";
      if(/matrix|quadrant|two axes|risk.*impact|effort.*impact|stakeholder/.test(text)) return "matrix";
      if(/tree|hierarchy|taxonomy|prerequisite|family|category|branch/.test(text)) return "tree";
      return "network";
    }

    function buildVisualization(module,index,preferred="auto") {
      const type=chooseVisualizationType(module,preferred);
      const items=visualizationItems(module,type==="network"?4:6);
      const titlePrefix={network:"Concept network",flow:"Process flow",timeline:"Timeline",cycle:"Learning cycle",comparison:"Comparison",matrix:"Decision matrix",tree:"Concept tree"}[type];
      const viz={
        type,
        title:`${titlePrefix}: ${module.title}`,
        caption:"Select an element to inspect its relationship to the lesson.",
        items
      };
      if(type==="network"){
        viz.nodes=[
          {id:"center",label:module.title.split(":")[0].slice(0,18),detail:module.summary,x:300,y:190,r:70},
          ...items.slice(0,3).map((item,i)=>({...item,x:[105,495,300][i],y:[95,95,330][i],r:56}))
        ];
        viz.edges=viz.nodes.slice(1).map(node=>[node.id,"center"]);
      } else if(type==="tree"){
        viz.root={id:"root",label:module.title.split(":")[0].slice(0,22),detail:module.summary};
        viz.items=items.map((item,i)=>({...item,parentId:i<3?"root":items[i%3].id}));
      } else if(type==="matrix"){
        viz.axes={xLow:"Lower immediacy",xHigh:"Higher immediacy",yLow:"Lower leverage",yHigh:"Higher leverage"};
        viz.items=items.map((item,i)=>({...item,x:18+((i*37+index*11)%70),y:18+((i*53+index*7)%70)}));
        viz.caption="Positions organize discussion and are not measured scores unless the lesson explicitly supplies values.";
      } else if(type==="comparison"){
        viz.items=items.map((item,i)=>({...item,value:Number(item.value||i+1)}));
        viz.caption="Bars show ordered emphasis within this lesson, not an empirical measurement.";
      }
      return viz;
    }


    const CUSTOM_VIZ_KINDS=new Set(["rect","circle","ellipse","line","path","polyline","polygon","text","group"]);
    const CUSTOM_VIZ_TONES=new Set(["ink","paper","acid","cyan","red","violet","amber","none"]);

    function finiteNumber(value,fallback=0,min=-100000,max=100000){
      const number=Number(value);
      return Number.isFinite(number)?Math.max(min,Math.min(max,number)):fallback;
    }

    function safePathData(value){
      const text=String(value||"");
      return /^[MmZzLlHhVvCcSsQqTtAa0-9eE+.,\s-]{1,4000}$/.test(text)?text:"";
    }

    function safePoints(value){
      const text=Array.isArray(value)
        ? value.map(point=>Array.isArray(point)?`${finiteNumber(point[0])},${finiteNumber(point[1])}`:"").filter(Boolean).join(" ")
        : String(value||"");
      return /^[0-9eE+.,\s-]{1,4000}$/.test(text)?text:"";
    }

    function normalizeCustomElement(raw,index,depth=0){
      if(!raw||typeof raw!=="object"||depth>3) return null;
      const kind=CUSTOM_VIZ_KINDS.has(raw.kind)?raw.kind:"rect";
      const tone=CUSTOM_VIZ_TONES.has(raw.tone)?raw.tone:"paper";
      const base={
        id:String(raw.id||`element-${depth}-${index}`),
        kind,
        tone,
        detail:String(raw.detail||raw.description||"").slice(0,1000),
        interactive:Boolean(raw.interactive||raw.detail||raw.description),
        strokeWidth:finiteNumber(raw.strokeWidth,3,0,20),
        opacity:finiteNumber(raw.opacity,1,0,1)
      };
      if(kind==="group"){
        return {
          ...base,
          transform:String(raw.transform||"").replace(/[^a-zA-Z0-9(),.\s+-]/g,"").slice(0,300),
          children:(Array.isArray(raw.children)?raw.children:[])
            .slice(0,40)
            .map((child,childIndex)=>normalizeCustomElement(child,childIndex,depth+1))
            .filter(Boolean)
        };
      }
      if(kind==="text"){
        return {
          ...base,
          x:finiteNumber(raw.x),
          y:finiteNumber(raw.y),
          text:String(raw.text||raw.label||"").slice(0,300),
          size:finiteNumber(raw.size,22,8,120),
          anchor:["start","middle","end"].includes(raw.anchor)?raw.anchor:"middle",
          rotate:finiteNumber(raw.rotate,0,-360,360)
        };
      }
      if(kind==="path") return {...base,d:safePathData(raw.d)};
      if(kind==="polyline"||kind==="polygon"){
        return {...base,points:safePoints(raw.points),filled:Boolean(raw.filled)};
      }
      if(kind==="line"){
        return {...base,x1:finiteNumber(raw.x1),y1:finiteNumber(raw.y1),x2:finiteNumber(raw.x2),y2:finiteNumber(raw.y2)};
      }
      if(kind==="circle"){
        return {...base,cx:finiteNumber(raw.cx),cy:finiteNumber(raw.cy),r:finiteNumber(raw.r,20,0,10000)};
      }
      if(kind==="ellipse"){
        return {...base,cx:finiteNumber(raw.cx),cy:finiteNumber(raw.cy),rx:finiteNumber(raw.rx,30,0,10000),ry:finiteNumber(raw.ry,20,0,10000)};
      }
      return {...base,x:finiteNumber(raw.x),y:finiteNumber(raw.y),width:finiteNumber(raw.width,100,0,10000),height:finiteNumber(raw.height,60,0,10000),rx:finiteNumber(raw.rx,0,0,1000)};
    }

    function normalizeCustomVisualization(raw,module,index){
      const width=finiteNumber(raw?.width,900,120,3000);
      const height=finiteNumber(raw?.height,520,120,2000);
      const viewBox=String(raw?.viewBox||`0 0 ${width} ${height}`).replace(/[^0-9eE+.,\s-]/g,"").trim()||`0 0 ${width} ${height}`;
      return {
        type:"custom",
        title:String(raw?.title||module?.title||`Visualization ${index+1}`),
        caption:String(raw?.caption||"Model-authored declarative visualization."),
        viewBox,
        width,
        height,
        background:CUSTOM_VIZ_TONES.has(raw?.background)?raw.background:"paper",
        elements:(Array.isArray(raw?.elements)?raw.elements:[]).slice(0,100).map((element,elementIndex)=>normalizeCustomElement(element,elementIndex)).filter(Boolean),
        legend:(Array.isArray(raw?.legend)?raw.legend:[]).slice(0,16).map(item=>typeof item==="string"
          ? {label:item,tone:"paper"}
          : {label:String(item?.label||""),tone:CUSTOM_VIZ_TONES.has(item?.tone)?item.tone:"paper"}).filter(item=>item.label)
      };
    }

    function normalizeVisualization(raw,module,index) {
      if(raw?.type==="custom") return normalizeCustomVisualization(raw,module,index);
      if(!raw||typeof raw!=="object") return buildVisualization(module,index);
      const type=VISUALIZATION_TYPES.has(raw.type)&&raw.type!=="custom"?raw.type:chooseVisualizationType(module,raw.type||"auto");
      const fallback=buildVisualization(module,index,type);
      const sourceItems=Array.isArray(raw.items)?raw.items:[];
      const items=(sourceItems.length?sourceItems:fallback.items||[]).slice(0,10).map((item,i)=>({
        id:String(item?.id||`item-${i}`),
        label:String(item?.label||`Item ${i+1}`).slice(0,42),
        detail:String(item?.detail||item?.description||module.summary||""),
        value:Number.isFinite(Number(item?.value))?Number(item.value):i+1,
        group:String(item?.group||""),
        parentId:item?.parentId?String(item.parentId):null,
        x:Number.isFinite(Number(item?.x))?Math.max(0,Math.min(100,Number(item.x))):undefined,
        y:Number.isFinite(Number(item?.y))?Math.max(0,Math.min(100,Number(item.y))):undefined
      }));
      const viz={
        ...fallback,
        type,
        title:String(raw.title||fallback.title),
        caption:String(raw.caption||fallback.caption),
        items
      };
      if(type==="network"){
        const rawNodes=Array.isArray(raw.nodes)?raw.nodes:[];
        viz.nodes=(rawNodes.length?rawNodes:fallback.nodes).slice(0,10).map((node,i)=>({
          id:String(node?.id||`node-${i}`),label:String(node?.label||`Node ${i+1}`).slice(0,32),detail:String(node?.detail||module.summary||""),
          x:Number(node?.x??[300,105,495,300,170,430][i%6]),y:Number(node?.y??[190,95,95,330,250,250][i%6]),r:Number(node?.r||52)
        }));
        const ids=new Set(viz.nodes.map(node=>node.id));
        viz.edges=(Array.isArray(raw.edges)?raw.edges:fallback.edges||[]).filter(edge=>Array.isArray(edge)&&ids.has(String(edge[0]))&&ids.has(String(edge[1]))).map(edge=>[String(edge[0]),String(edge[1])]);
      }
      if(type==="matrix"){
        viz.axes={...fallback.axes,...(raw.axes&&typeof raw.axes==="object"?raw.axes:{})};
        viz.items=items.map((item,i)=>({...item,x:item.x??18+((i*37+index*11)%70),y:item.y??18+((i*53+index*7)%70)}));
      }
      if(type==="tree"){
        viz.root=raw.root&&typeof raw.root==="object"?{
          id:String(raw.root.id||"root"),label:String(raw.root.label||module.title).slice(0,32),detail:String(raw.root.detail||module.summary||"")
        }:fallback.root;
        viz.items=items.map((item,i)=>({...item,parentId:item.parentId||(i<3?viz.root.id:items[i%3]?.id||viz.root.id)}));
      }
      return viz;
    }

    function finalizeSchool(raw,options={}) {
      const school=deepClone(raw);
      school.id=school.id || `school-${stableHash(JSON.stringify(raw))}`;
      school.createdAt=school.createdAt || new Date().toISOString();
      school.difficulty=options.difficulty || school.difficulty || "intermediate";
      school.mode=options.mode || school.mode || "balanced";
      school.tone=options.tone || school.tone || "punk";
      if(school.structureMode==="model-native") return finalizeModelNativeSchool(school);
      school.modules=school.modules.map((module,index)=>({
        ...module,
        id:module.id || `module-${index+1}-${slug(module.title)}`,
        xp:module.xp || (index===school.modules.length-1 ? 35 : 15),
        quiz:module.quiz || buildQuiz(module,index),
        visualization:normalizeVisualization(module.visualization,module,index),
        badge:module.badge || {
          id:`badge-${slug(module.title)}`,
          name:module.title.replace(/:.*/,"").slice(0,42),
          description:`Demonstrated the core objectives of ${module.title}.`,
          domain:module.domain,
          criteriaVersion:"1.0.0"
        },
        provenance:module.provenance || school.sourceNote || "source-grounded model"
      }));
      return school;
    }

    function generateSchool(subject,notes,moduleCount,difficulty,mode,tone) {
      if (schoolIsDefault(subject) && (!notes.trim() || document.getElementById("school-preset").value==="anarcho")) {
        renderSourceAnalysis(null);
        const school=deepClone(defaultKnowledge);
        school.id="anarcho-syndicalist-school";
        school.modules=school.modules.slice(0,moduleCount);
        return finalizeSchool(school,{difficulty,mode,tone});
      }

      if(notes.trim()){
        return compileSchoolFromDump(subject,notes,moduleCount,difficulty,mode,tone);
      }

      renderSourceAnalysis(parseDataDump(`${subject}\nNo source pack supplied.`));
      const phases=genericPhases.slice(0,moduleCount);
      const generated={
        id:`school-${slug(subject)}-${stableHash(subject)}`,
        title:`${titleCase(subject)} School`,
        subtitle:`Deterministic scaffold · sources still needed`,
        subject,
        description:`A stable curriculum scaffold for "${subject}". Add a source dump to replace placeholders with source-grounded lessons.`,
        sourceNote:"deterministic scaffold without factual source pack",
        modules:phases.map((phase,index)=>generateGenericModule(subject,"",phase,index,difficulty,mode,tone))
      };
      return finalizeSchool(generated,{difficulty,mode,tone});
    }


    const MODEL_OUTPUT_SCHEMA = "living-school-model-output-0.4";
    const MODEL_TOOL_REQUEST_SCHEMA = "living-school-tool-request-0.1";
    const MODEL_TOOL_RESULT_SCHEMA = "living-school-tool-result-0.1";
    const MODEL_OUTPUT_SCHEMAS = new Set(["living-school-model-output-0.1","living-school-model-output-0.2","living-school-model-output-0.3",MODEL_OUTPUT_SCHEMA]);
    let modelAbortController = null;
    let pendingModelProposal = null;
    let manualModelSession = null;

    function defaultModelSettings() {
      return {
        provider:"browser",
        model:"local-model",
        endpoint:"http://127.0.0.1:11434/v1/chat/completions",
        localApiFlavor:"openai",
        ggufBridgeEndpoint:"http://127.0.0.1:8788",
        ggufPort:8080,
        ggufContext:8192,
        ggufGpuLayers:-1,
        ggufThreads:0,
        temperature:0.75,
        maxTokens:8192,
        timeoutSeconds:90,
        maxToolRounds:4,
        toolsEnabled:true,
        engine:"hybrid",
        freedom:"balanced",
        hostedModel:"gemini-3.5-flash-lite"
      };
    }

    function initializeModelState() {
      const sharedRuntimeConfig=window.CommonweaveModelRuntime?.readSharedConfig?.()||null;
      const sharedProviderMap={
        deterministic:"deterministic",hosted:"hosted",gemini:"gemini",browser:"browser",manual:"manual",
        ollama:"ollama","openai-compatible":"local-api"
      };
      state.modelSettings={...defaultModelSettings(),...(state.modelSettings||{}),...(sharedRuntimeConfig?{
        provider:sharedProviderMap[sharedRuntimeConfig.provider]||sharedRuntimeConfig.route||"local-api",
        model:sharedRuntimeConfig.model||"local-model",
        endpoint:sharedRuntimeConfig.endpoint||"",
        commonweaveManaged:true
      }:{})};
      state.modelSettings.model=String(state.modelSettings.model||"local-model").slice(0,200);
      state.modelSettings.endpoint=String(state.modelSettings.endpoint||"").slice(0,2000);
      state.modelSettings.ggufBridgeEndpoint=String(state.modelSettings.ggufBridgeEndpoint||"http://127.0.0.1:8788").slice(0,2000);
      state.modelSettings.ggufPort=Math.round(finiteNumber(state.modelSettings.ggufPort,8080,1024,65535));
      state.modelSettings.ggufContext=Math.round(finiteNumber(state.modelSettings.ggufContext,8192,512,262144));
      state.modelSettings.ggufGpuLayers=Math.round(finiteNumber(state.modelSettings.ggufGpuLayers,-1,-1,10000));
      state.modelSettings.ggufThreads=Math.round(finiteNumber(state.modelSettings.ggufThreads,0,0,1024));
      state.modelSettings.temperature=finiteNumber(state.modelSettings.temperature,0.75,0,2);
      state.modelSettings.maxTokens=Math.round(finiteNumber(state.modelSettings.maxTokens,8192,64,65536));
      state.modelSettings.timeoutSeconds=Math.round(finiteNumber(state.modelSettings.timeoutSeconds,90,5,600));
      state.modelSettings.maxToolRounds=Math.round(finiteNumber(state.modelSettings.maxToolRounds,4,0,12));
      state.modelHistory=Array.isArray(state.modelHistory)?state.modelHistory:[];
      state.modelProposals=Array.isArray(state.modelProposals)?state.modelProposals:[];
      state.modelRuntime={
        route:"",
        tested:false,
        ready:false,
        lastTestAt:null,
        message:"No model route has been tested in this session.",
        ...(state.modelRuntime||{})
      };
      try { sessionStorage.removeItem("living-school-model-key"); } catch {}
    }

    function modelConfigFromUI() {
      return {
        provider:document.getElementById("model-provider").value,
        model:document.getElementById("model-name").value.trim()||"local-model",
        endpoint:document.getElementById("model-endpoint").value.trim(),
        apiKey:document.getElementById("model-api-key").value,
        localApiFlavor:document.getElementById("model-local-api-flavor").value,
        ggufBridgeEndpoint:document.getElementById("gguf-bridge-endpoint").value.trim(),
        ggufPort:Math.round(finiteNumber(document.getElementById("gguf-port").value,8080,1024,65535)),
        ggufContext:Math.round(finiteNumber(document.getElementById("gguf-context").value,8192,512,262144)),
        ggufGpuLayers:Math.round(finiteNumber(document.getElementById("gguf-gpu-layers").value,-1,-1,10000)),
        ggufThreads:Math.round(finiteNumber(document.getElementById("gguf-threads").value,0,0,1024)),
        temperature:finiteNumber(document.getElementById("model-temperature").value,0.75,0,2),
        maxTokens:Math.round(finiteNumber(document.getElementById("model-max-tokens").value,8192,64,65536)),
        timeoutSeconds:Math.round(finiteNumber(document.getElementById("model-timeout").value,90,5,600)),
        maxToolRounds:Math.round(finiteNumber(document.getElementById("model-tool-rounds").value,4,0,12)),
        toolsEnabled:document.getElementById("model-tools-enabled").checked,
        engine:document.getElementById("generation-engine").value,
        freedom:document.getElementById("model-freedom").value
      };
    }

    function persistModelSettings() {
      const config=modelConfigFromUI();
      state.modelSettings={
        provider:config.provider,
        model:config.model,
        endpoint:config.endpoint,
        localApiFlavor:config.localApiFlavor,
        ggufBridgeEndpoint:config.ggufBridgeEndpoint,
        ggufPort:config.ggufPort,
        ggufContext:config.ggufContext,
        ggufGpuLayers:config.ggufGpuLayers,
        ggufThreads:config.ggufThreads,
        temperature:config.temperature,
        maxTokens:config.maxTokens,
        timeoutSeconds:config.timeoutSeconds,
        maxToolRounds:config.maxToolRounds,
        toolsEnabled:config.toolsEnabled,
        engine:config.engine,
        freedom:config.freedom
      };
      if(window.CommonweaveModelRuntime){
        const external=window.CommonweaveModelRuntime.endpointLeavesDevice?.(config);
        window.CommonweaveModelRuntime.saveSharedConfig({
          route:config.provider,provider:config.provider,model:config.model,endpoint:config.endpoint,
          apiKey:config.apiKey,externalConsent:Boolean(external),temperature:config.temperature,
          maxTokens:config.maxTokens,timeoutSeconds:config.timeoutSeconds,service:"living-school"
        });
        if(config.apiKey)window.CommonweaveModelRuntime.saveSessionSecret(config,{apiKey:config.apiKey,externalConsent:Boolean(external)});
      }
      saveState();
    }

    function hydrateModelSettingsUI() {
      const settings={...defaultModelSettings(),...(state.modelSettings||{})};
      document.getElementById("model-provider").value=settings.provider;
      document.getElementById("model-name").value=settings.model;
      document.getElementById("model-endpoint").value=settings.endpoint;
      document.getElementById("model-local-api-flavor").value=settings.localApiFlavor||"openai";
      document.getElementById("gguf-bridge-endpoint").value=settings.ggufBridgeEndpoint;
      document.getElementById("gguf-port").value=String(settings.ggufPort);
      document.getElementById("gguf-context").value=String(settings.ggufContext);
      document.getElementById("gguf-gpu-layers").value=String(settings.ggufGpuLayers);
      document.getElementById("gguf-threads").value=String(settings.ggufThreads);
      document.getElementById("model-temperature").value=String(settings.temperature);
      document.getElementById("temperature-value").textContent=Number(settings.temperature).toFixed(2);
      document.getElementById("model-max-tokens").value=String(settings.maxTokens);
      document.getElementById("model-timeout").value=String(settings.timeoutSeconds);
      document.getElementById("model-tool-rounds").value=String(settings.maxToolRounds);
      document.getElementById("model-tools-enabled").checked=settings.toolsEnabled!==false;
      document.getElementById("generation-engine").value=settings.engine;
      document.getElementById("model-freedom").value=settings.freedom;
    }


    function applyProviderDefaults(provider){
      const endpoint=document.getElementById("model-endpoint"),model=document.getElementById("model-name");
      if(provider==="hosted"){
        model.value=state.commerce?.model||"gemini-3.5-flash-lite";
        endpoint.value=(state.commerce?.billingConfig?.brokerEndpoint||"").replace(/\/+$/,"")+"/v1/ai/generate";
        document.getElementById("model-api-key").value="";
      }
      else if(provider==="gemini"){if(!/^gemini-/.test(model.value))model.value="gemini-3.5-flash-lite";endpoint.value="https://generativelanguage.googleapis.com/v1beta"}
      else if(provider==="local-api"){
        const flavor=document.getElementById("model-local-api-flavor").value||"openai";
        endpoint.value=flavor==="ollama"?"http://127.0.0.1:11434/api/chat":"http://127.0.0.1:1234/v1/chat/completions";
        if(!model.value||/^gemini-/.test(model.value))model.value=flavor==="ollama"?"llama3.2":"local-model";
      }
      else if(provider==="ollama"){endpoint.value="http://127.0.0.1:11434/api/chat";if(!model.value||/^gemini-/.test(model.value))model.value="local-model"}
      else if(provider==="gguf"){endpoint.value=`${ggufBridgeBase()}/v1/chat/completions`;if(!model.value||/^gemini-/.test(model.value))model.value="local-gguf"}
      else if(provider==="openai"&&/generativelanguage\.googleapis\.com/.test(endpoint.value)){endpoint.value="http://127.0.0.1:8080/v1/chat/completions"}
      else if(provider==="deterministic"){
        document.getElementById("generation-engine").value="deterministic";
        model.value="deterministic-compiler";
        endpoint.value="";
        document.getElementById("model-api-key").value="";
      }
      persistModelSettings();
    }


    function hasCuratedBuilderGrounding() {
      const preset=document.getElementById("school-preset")?.value;
      const subject=document.getElementById("school-subject")?.value||"";
      const notes=document.getElementById("school-sources")?.value||"";
      return Boolean(notes.trim()) || (preset==="anarcho" && schoolIsDefault(subject)) || preset==="nny-foraging";
    }

    function updateSourceGenerationWarning() {
      const warning=document.getElementById("llm-source-warning");
      if(!warning) return;
      const engine=document.getElementById("generation-engine")?.value||"hybrid";
      const show=engine!=="deterministic" && !hasCuratedBuilderGrounding();
      warning.hidden=!show;
      const consoleNode=document.getElementById("model-console");
      if(show && consoleNode && !consoleNode.classList.contains("model-run-pulse")){
        consoleNode.textContent="Source-free generation is active. The model may create a complete curriculum from learned knowledge, and the result will carry an LLM-generated warning.";
      }
    }

    function setModelStatus(message,kind="") {
      const node=document.getElementById("model-connection-status");
      node.className=`model-connection-status ${kind}`;
      node.textContent=message;
      if(state.modelRuntime){
        state.modelRuntime.message=message;
        state.modelRuntime.ready=kind==="good";
        if(kind==="good"||kind==="bad"){
          state.modelRuntime.tested=true;
          state.modelRuntime.lastTestAt=new Date().toISOString();
        }
      }
      updateModelFoundryCurrent();
    }

    function sourceContextForModel(subject,notes) {
      const parsed=parseDataDump(notes||"");
      const sourceRecords=Object.values(parsed.sources).map(source=>({
        id:source.id,
        url:source.url,
        rank:source.rank,
        label:source.label,
        note:source.note
      }));
      const claims=parsed.claims.slice(0,160).map(claim=>({
        id:claim.id,
        heading:claim.heading,
        text:claim.text,
        kind:claim.kind,
        refs:claim.refs,
        confidence:claim.confidence,
        flags:claim.flags
      }));
      const hasSourceDump=Boolean(String(notes||"").trim());
      const hasCuratedPreset=!hasSourceDump && schoolIsDefault(subject);
      return {
        subject,
        inputHash:parsed.hash,
        hasSourceDump,
        hasCuratedPreset,
        hasGrounding:hasSourceDump || hasCuratedPreset,
        knowledgeMode:hasSourceDump ? "source-grounded" : hasCuratedPreset ? "curated-preset" : "llm-generated",
        safetySensitive:subjectNeedsSafetyGate(subject,parsed),
        safetyFlags:parsed.safetyFlags,
        claims,
        sources:sourceRecords
      };
    }

    function deterministicToolCatalog() {
      return [
        {name:"source.analyze",description:"Parse the supplied data dump into headings, claims, procedures, warnings, citation records, confidence bands, and safety flags.",arguments:{includeClaims:"boolean, default true",maxClaims:"integer 1-160"}},
        {name:"curriculum.compile",description:"Run the deterministic curriculum generator and return a complete source-grounded school with modules, quizzes, safety gates, and varied visualizations.",arguments:{subject:"optional string",moduleCount:"1-12",difficulty:"introductory|intermediate|advanced",mode:"balanced|practical|theoretical|critical",tone:"punk|plain|academic|narrative",visualizationStrategy:"auto|varied|network|flow|timeline|cycle|comparison|matrix|tree"}},
        {name:"module.compile",description:"Build one deterministic module from selected source claims or a named source section.",arguments:{title:"string",sectionTitle:"optional string",claimIds:"optional string[]",difficulty:"optional",mode:"optional",visualizationType:"optional visualization type"}},
        {name:"assessment.build_quiz",description:"Build a deterministic knowledge check for a supplied or compiled module.",arguments:{moduleId:"optional string",module:"optional module object",questionCount:"1-6"}},
        {name:"visualization.build",description:"Build one normalized interactive visualization from a module.",arguments:{moduleId:"optional string",module:"optional module object",type:"auto|network|flow|timeline|cycle|comparison|matrix|tree"}},
        {name:"safety.build_module",description:"Build a deterministic safety, legality, source-quality, and stop-condition module from the current source context.",arguments:{title:"optional string"}},
        {name:"curriculum.audit",description:"Audit a proposed school against source claims, safety flags, module completeness, quiz structure, and visualization variety.",arguments:{school:"school object"}}
      ];
    }

    function modelSystemPrompt() {
      return `You are the curriculum architect and writer inside THE LIVING ACADEMY.
Return JSON only. Never wrap JSON in markdown.

You may use deterministic application tools when sources or a stable scaffold are useful. Tool use is optional for source-free generation.

To call tools, return:
{
  "schema":"${MODEL_TOOL_REQUEST_SCHEMA}",
  "toolCalls":[
    {"id":"call-1","name":"curriculum.compile","arguments":{"moduleCount":6,"visualizationStrategy":"varied"}}
  ],
  "reason":"brief explanation"
}

After tool results, continue writing and finish with ${MODEL_OUTPUT_SCHEMA}.

Available tools:
${JSON.stringify(deterministicToolCatalog(),null,2)}

SOURCE-GROUNDED MODE
When source claims are supplied:
- Ground factual statements in those claims.
- Use evidenceRefs only for real supplied claim IDs.
- Preserve uncertainty, safety limits, and provenance.
- Deterministic tools may provide a scaffold, but you may reorganize it.

MODEL-NATIVE FREE GENERATION
When no source dump or curated knowledge pack is supplied:
- You may use learned knowledge and freely design the school's structure.
- Do not return placeholders merely because sources are absent.
- Do not invent citations, URLs, quotations, claim IDs, or fake evidence.
- The runtime preserves your structure and does not manufacture missing concepts, quizzes, exercises, paragraphs, badges, or visualizations.
- A module may contain zero concepts, one concept, no exercise, or only a visualization plus its required quiz.
- Every module MUST include at least one quiz block.
- Every module quiz MUST include at least one short-answer question.
- Every short-answer question MUST use exact, keywords, or reflection validation. Keyword ideas are coaching-only unless enforcement:"strict" is explicitly justified.
- At least one quiz block per module MUST have completionGate:true, or the module completion type must be "quiz".
- Missing quiz content is never generated by the application. The proposal is blocked instead.
- Use structureMode:"model-native".
- Use blocks to define the exact sequence of content.
- The application adds only IDs, provenance, safety warnings, and runtime controls.

MODEL-NATIVE BLOCKS
A module may use any sequence of these blocks:
- heading: {"type":"heading","level":2|3|4,"text":"..."}
- prose: {"type":"prose","paragraphs":["..."]}
- list: {"type":"list","title":"...","ordered":false,"items":["..."]}
- steps: {"type":"steps","title":"...","items":[{"title":"...","body":"..."}]}
- quote: {"type":"quote","text":"...","attribution":"..."}
- callout: {"type":"callout","tone":"info|warning|success|note","title":"...","body":"..."}
- table: {"type":"table","title":"...","columns":[{"key":"x","label":"..."}],"rows":[{"x":"..."}]}
- concepts: {"type":"concepts","title":"...","items":[{"term":"...","definition":"..."}]}
- scenario: {"type":"scenario","title":"...","setup":"...","choices":[{"label":"...","consequence":"..."}]}
- visualization: {"type":"visualization","visualization":{...}}
- quiz: {"type":"quiz","title":"...","completionGate":true,"questions":[
    {"type":"multiple-choice","prompt":"...","answers":["...","..."],"correct":0,"explanation":"..."},
    {"type":"short-answer","prompt":"...","validation":{"mode":"keywords","enforcement":"guidance","requiredKeywords":["idea one","idea two"],"minimumKeywordMatches":1,"minWords":5,"maxWords":60,"feedback":"Use the ideas as coaching, not a phrase gate."},"explanation":"..."}
  ]}
- exercise: {"type":"exercise","exercise":{"title":"...","prompt":"...","rubric":["..."]}}
- checklist: {"type":"checklist","title":"...","completionGate":true,"items":["..."]}
- code: {"type":"code","language":"...","code":"..."}
- divider: {"type":"divider"}

CUSTOM VISUALIZATIONS
You may use built-in types network, flow, timeline, cycle, comparison, matrix, and tree.

You may also create a safe custom SVG scene:
{
  "type":"custom",
  "title":"...",
  "caption":"...",
  "viewBox":"0 0 900 520",
  "background":"paper|ink|acid|cyan|red|violet|amber|none",
  "elements":[
    {"kind":"rect","x":40,"y":40,"width":220,"height":100,"rx":12,"tone":"acid","detail":"..."},
    {"kind":"circle","cx":420,"cy":160,"r":70,"tone":"cyan","detail":"..."},
    {"kind":"line","x1":260,"y1":90,"x2":350,"y2":150,"tone":"ink"},
    {"kind":"path","d":"M 100 300 C 240 180 480 420 760 260","tone":"violet","strokeWidth":6},
    {"kind":"polygon","points":"520,60 620,140 560,240","tone":"amber","filled":true},
    {"kind":"text","x":150,"y":90,"text":"A model-authored label","size":22,"anchor":"middle","tone":"ink"},
    {"kind":"group","transform":"translate(30 20)","children":[]}
  ],
  "legend":[{"label":"Practice","tone":"acid"}]
}

Allowed kinds: rect, circle, ellipse, line, path, polyline, polygon, text, group.
Do not include HTML, JavaScript, CSS, event handlers, scripts, external embeds, or arbitrary URLs.

SHORT-ANSWER VALIDATION
Use one of these transparent validation modes:

Exact:
{"type":"short-answer","prompt":"...","validation":{"mode":"exact","acceptableAnswers":["answer one","accepted variant"],"caseSensitive":false,"ignorePunctuation":true,"minWords":1,"maxWords":20,"feedback":"Review the definition."}}

Keywords, normally coaching-only:
{"type":"short-answer","prompt":"...","validation":{"mode":"keywords","enforcement":"guidance","requiredKeywords":["mandate","recall","delegate"],"minimumKeywordMatches":1,"caseSensitive":false,"ignorePunctuation":true,"minWords":8,"maxWords":80,"feedback":"These ideas can improve the answer, but alternate correct phrasing should still pass."}}

Open reflection:
{"type":"short-answer","prompt":"...","validation":{"mode":"reflection","minWords":8,"maxWords":120,"feedback":"Give a complete response in your own words."}}

Use enforcement:"strict" for keyword mode only when named terms are literally required for correctness. Never create an arbitrary two-of-three idea quota for an explanatory question.
Do not use regex, hidden rubrics, or model-graded prose. Validation must remain deterministic and inspectable.

COMPLETION
Every module must use a quiz completion gate:
{"completion":{"type":"quiz","label":"Complete the validated quiz","instructions":"Pass every supplied question.","blockId":"quiz-block-id"}}

NAVIGATION
The school may define:
"navigation":[
  {"label":"Foundations","moduleIds":["module-a","module-b"]},
  {"label":"Practice","moduleIds":["module-c"]}
]
Modules may also define navLabel and group.

The application, not you, controls XP persistence, reward deduplication, evidence custody, and credential issuance.

Final model-native output:
{
  "schema":"${MODEL_OUTPUT_SCHEMA}",
  "school":{
    "structureMode":"model-native",
    "title":"...",
    "subtitle":"...",
    "subject":"...",
    "description":"...",
    "navigation":[{"label":"...","moduleIds":["..."]}],
    "modules":[
      {
        "id":"module-a",
        "title":"...",
        "navLabel":"...",
        "group":"...",
        "domain":"subjectPractice",
        "summary":"...",
        "xp":20,
        "blocks":[
          {"type":"prose","paragraphs":["..."]},
          {"type":"visualization","visualization":{"type":"custom","title":"...","elements":[]}},
          {"id":"module-a-quiz","type":"quiz","title":"Check your understanding","completionGate":true,"questions":[
            {"type":"multiple-choice","prompt":"...","answers":["...","..."],"correct":0,"explanation":"..."},
            {"type":"short-answer","prompt":"...","validation":{"mode":"keywords","enforcement":"guidance","requiredKeywords":["...","..."],"minimumKeywordMatches":1,"minWords":5,"maxWords":60,"feedback":"Alternate correct phrasing is allowed."}}
          ]}
        ],
        "completion":{"type":"quiz","label":"Complete the validated quiz","blockId":"module-a-quiz"}
      }
    ]
  },
  "notes":["brief design notes"]
}`;
    }

    function modelUserPrompt({task,subject,notes,moduleCount,difficulty,mode,tone,engine,freedom,currentSchool}) {
      const sourceContext=sourceContextForModel(subject,notes);
      const freedomInstructions={
        grounded:"Stay close to source structure. Use deterministic tools for the outline, safety, assessments, and most visualizations.",
        balanced:"Use deterministic tools for reliable scaffolding, then enrich them with useful analogies, scenarios, and reorganized modules.",
        imaginative:"Use tools as a factual and structural spine, then create memorable metaphors, scenarios, and unusual teaching sequences. Keep citations disciplined."
      };
      const sourceFree=!sourceContext.hasGrounding;
      const payload={
        task,
        requested:{subject,moduleCount,difficulty,teachingMode:mode,voice:tone,engine,freedom,freedomInstruction:freedomInstructions[freedom]||freedomInstructions.balanced},
        sourceContext,
        knowledgePolicy:sourceFree ? {
          mode:"llm-generated",
          permission:"Generate complete factual and explanatory content from learned knowledge.",
          restrictions:[
            "Do not fabricate citations or source identifiers.",
            "Mark information as LLM-generated and unverified.",
            "Surface uncertainty and verification steps for consequential claims."
          ]
        } : {
          mode:sourceContext.knowledgeMode,
          permission:"Use supplied or curated knowledge as the factual substrate."
        },
        toolPolicy:{
          toolsAvailable:true,
          hybridRequiresTool:sourceContext.hasGrounding,
          preferredFirstCall:sourceContext.hasGrounding ? (engine==="hybrid"?"curriculum.compile":"source.analyze") : null,
          sourceFreeToolsAreOptional:true,
          visualizationTypes:[...VISUALIZATION_TYPES]
        },
        currentSchool:currentSchool||null
      };
      return `Create the requested curriculum proposal from this input:\n${JSON.stringify(payload,null,2)}`;
    }

    function extractJSONText(text) {
      const raw=String(text||"").trim()
        .replace(/^```(?:json)?\s*/i,"")
        .replace(/\s*```$/,"");
      const first=raw.indexOf("{");
      const last=raw.lastIndexOf("}");
      if(first<0||last<first) throw new Error("The model response did not contain a JSON object.");
      return raw.slice(first,last+1);
    }

    function parseModelJSON(text) {
      return JSON.parse(extractJSONText(text));
    }

    function browserModelFactory() {
      if(globalThis.LanguageModel?.create) return globalThis.LanguageModel;
      if(globalThis.ai?.languageModel?.create) return globalThis.ai.languageModel;
      return null;
    }

    async function invokeBrowserModel(messages,config,signal) {
      const factory=browserModelFactory();
      if(!factory) throw new Error("No browser-native LanguageModel API is available in this browser.");
      const session=await factory.create({
        temperature:config.temperature,
        topK:40,
        signal
      });
      const prompt=messages.map(message=>`${message.role.toUpperCase()}:\n${message.content}`).join("\n\n");
      const result=await session.prompt(prompt,{signal});
      if(typeof session.destroy==="function") session.destroy();
      return typeof result==="string"?result:result?.text||String(result||"");
    }

    async function invokeOpenAICompatible(messages,config,signal) {
      if(!config.endpoint) throw new Error("Enter an OpenAI-compatible endpoint.");
      assertBoundedModelMessages(messages);
      const endpoint=safeModelEndpoint(config.endpoint);
      const headers={"content-type":"application/json"};
      if(config.apiKey) headers.authorization=`Bearer ${config.apiKey}`;
      const body={
        model:config.model,
        messages,
        temperature:config.temperature,
        max_tokens:config.maxTokens,
        response_format:{type:"json_object"}
      };
      let response=await fetch(endpoint,{
        method:"POST",
        headers,
        body:JSON.stringify(body),
        signal,
        redirect:"error",
        credentials:"omit"
      });
      if(!response.ok && response.status===400){
        delete body.response_format;
        response=await fetch(endpoint,{
          method:"POST",
          headers,
          body:JSON.stringify(body),
          signal,
          redirect:"error",
          credentials:"omit"
        });
      }
      const responseText=await boundedResponseText(response);
      if(!response.ok) throw new Error(`Model endpoint returned ${response.status}: ${responseText.slice(0,500)}`);
      let data;
      try{data=JSON.parse(responseText);}catch{throw new Error("The model endpoint did not return JSON.");}
      return data.choices?.[0]?.message?.content ??
        data.output_text ??
        data.response ??
        data.content ??
        "";
    }

    async function invokeOllama(messages,config,signal) {
      const endpoint=config.endpoint || "http://127.0.0.1:11434/api/chat";
      const normalized=safeModelEndpoint(/\/v1\/chat\/completions\/?$/.test(endpoint)
        ? endpoint.replace(/\/v1\/chat\/completions\/?$/,"/api/chat")
        : endpoint);
      assertBoundedModelMessages(messages);
      const response=await fetch(normalized,{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({
          model:config.model,
          messages,
          stream:false,
          format:"json",
          options:{temperature:config.temperature,num_predict:config.maxTokens}
        }),
        signal,
        redirect:"error",
        credentials:"omit"
      });
      const text=await boundedResponseText(response);
      if(!response.ok) throw new Error(`Ollama returned ${response.status}: ${text.slice(0,500)}`);
      const data=JSON.parse(text);
      return data.message?.content ?? data.response ?? "";
    }



    async function invokeLocalModelAPI(messages,config,signal){
      if(config.localApiFlavor==="ollama"){
        return invokeOllama(messages,config,signal);
      }
      return invokeOpenAICompatible(messages,config,signal);
    }

    async function invokeGemini(messages,config,signal){
      if(!config.apiKey)throw new Error("A Gemini API key is required.");
      const model=config.model||"gemini-3.6-flash";
      assertBoundedModelMessages(messages);
      let base="https://generativelanguage.googleapis.com/v1beta";
      if(config.endpoint){
        const configured=new URL(safeModelEndpoint(config.endpoint));
        if(configured.protocol!=="https:"||configured.hostname!=="generativelanguage.googleapis.com"){
          throw new Error("Gemini API keys may only be sent to Google's HTTPS API host.");
        }
        base=configured.href.replace(/\/+$/,"").replace(/\/models\/?$/,"");
      }
      const url=/:generateContent(?:\?|$)/.test(base)?base:`${base}/models/${encodeURIComponent(model)}:generateContent`;
      const systemText=messages.filter(m=>m.role==="system").map(m=>m.content).join("\n\n");
      const contents=messages.filter(m=>m.role!=="system").map(m=>({role:m.role==="assistant"?"model":"user",parts:[{text:m.content}]}));
      const response=await fetch(url,{method:"POST",headers:{"content-type":"application/json","x-goog-api-key":config.apiKey},body:JSON.stringify({...(systemText?{systemInstruction:{parts:[{text:systemText}]}}:{}),contents,generationConfig:{temperature:config.temperature,maxOutputTokens:config.maxTokens,responseMimeType:"application/json"}}),signal,redirect:"error",credentials:"omit"});
      const text=await boundedResponseText(response); if(!response.ok)throw new Error(`Gemini returned ${response.status}: ${text.slice(0,600)}`);
      const data=JSON.parse(text); const output=(data.candidates||[]).flatMap(c=>c.content?.parts||[]).map(p=>p.text||"").join("");
      if(!output)throw new Error(`Gemini produced no text: ${data.promptFeedback?.blockReason||data.candidates?.[0]?.finishReason||"empty response"}`); return output;
    }
    function ggufBridgeBase(){return(document.getElementById("gguf-bridge-endpoint").value.trim()||"http://127.0.0.1:8788").replace(/\/+$/,'')}
    async function bridgeJSON(path,options={}){const response=await fetch(`${ggufBridgeBase()}${path}`,{...options,headers:{...(options.body instanceof ArrayBuffer||options.body instanceof Blob?{}:{"content-type":"application/json"}),...(options.headers||{})}});const text=await response.text();let data;try{data=text?JSON.parse(text):{}}catch{throw new Error(`Bridge returned non-JSON: ${text.slice(0,300)}`)}if(!response.ok||data.ok===false)throw new Error(data.error||`Bridge returned ${response.status}`);return data}
    async function invokeGGUFBridge(messages,config,signal){const endpoint=(config.endpoint&&/\/v1\/chat\/completions\/?$/.test(config.endpoint))?config.endpoint:`${(config.ggufBridgeEndpoint||ggufBridgeBase()).replace(/\/+$/,'')}/v1/chat/completions`;return invokeOpenAICompatible(messages,{...config,endpoint,apiKey:""},signal)}
    const locatedGGUFFiles=new Map();let selectedGGUFKey="";
    function formatBytes(bytes){const units=["B","KiB","MiB","GiB","TiB"];let v=Number(bytes||0),i=0;while(v>=1024&&i<units.length-1){v/=1024;i++}return`${v.toFixed(i?2:0)} ${units[i]}`}
    async function inspectGGUF(file){const hb=await file.slice(0,24).arrayBuffer();if(hb.byteLength<24)throw new Error("The selected file is too small to be a GGUF model.");const bytes=new Uint8Array(hb),magic=String.fromCharCode(...bytes.slice(0,4));if(magic!=="GGUF")throw new Error(`Expected GGUF magic header, found "${magic}".`);const view=new DataView(hb),version=view.getUint32(4,true),tensorCount=Number(view.getBigUint64(8,true)),metadataCount=Number(view.getBigUint64(16,true));const ss=Math.min(1024*1024,file.size),first=new Uint8Array(await file.slice(0,ss).arrayBuffer()),last=new Uint8Array(await file.slice(Math.max(0,file.size-ss),file.size).arrayBuffer()),input=new Uint8Array(first.length+last.length+16);input.set(first);input.set(last,first.length);const iv=new DataView(input.buffer);iv.setBigUint64(first.length+last.length,BigInt(file.size),true);iv.setBigUint64(first.length+last.length+8,BigInt(file.lastModified||0),true);let fingerprint;if(globalThis.crypto?.subtle){const digest=await crypto.subtle.digest("SHA-256",input);fingerprint=[...new Uint8Array(digest)].map(v=>v.toString(16).padStart(2,"0")).join("")}else{let h1=2166136261,h2=2246822519;for(const byte of input){h1=Math.imul(h1^byte,16777619);h2=Math.imul(h2+byte,3266489917)}fingerprint=`${(h1>>>0).toString(16).padStart(8,"0")}${(h2>>>0).toString(16).padStart(8,"0")}${file.size.toString(16).padStart(16,"0")}`.repeat(2).slice(0,64)}return{name:file.name,size:file.size,lastModified:file.lastModified,version,tensorCount,metadataCount,fingerprint,key:`${fingerprint}:${file.name}`}}
    function renderGGUFCandidates(){const select=document.getElementById("gguf-candidates"),entries=[...locatedGGUFFiles.entries()];select.innerHTML=entries.length?entries.map(([k,e])=>`<option value="${escapeHTML(k)}">${escapeHTML(e.info.name)} · ${formatBytes(e.info.size)} · GGUF v${e.info.version}</option>`).join(""):'<option value="">No GGUF files located</option>';if(entries.length){selectedGGUFKey=entries[0][0];select.value=selectedGGUFKey;renderSelectedGGUF()}}
    function renderSelectedGGUF(){const entry=locatedGGUFFiles.get(selectedGGUFKey),card=document.getElementById("gguf-model-card"),stateNode=document.getElementById("gguf-state");if(!entry){card.textContent="Select a GGUF file or ask the bridge to open a native file browser.";stateNode.textContent="No model selected";stateNode.className="gguf-state";return}const i=entry.info;card.textContent=[`File: ${i.name}`,`Size: ${formatBytes(i.size)}`,`GGUF version: ${i.version}`,`Tensor count: ${i.tensorCount.toLocaleString()}`,`Metadata entries: ${i.metadataCount.toLocaleString()}`,`Fingerprint: ${i.fingerprint.slice(0,24)}…`].join("\n");stateNode.textContent="Valid GGUF selected";stateNode.className="gguf-state ready"}
    async function addGGUFFiles(files){const matches=[...files].filter(f=>f.name.toLowerCase().endsWith(".gguf"));if(!matches.length)throw new Error("No .gguf files were found.");document.getElementById("gguf-status").textContent=`Inspecting ${matches.length} GGUF candidate(s)...`;for(const file of matches){try{const info=await inspectGGUF(file);locatedGGUFFiles.set(info.key,{file,info})}catch(e){console.warn(`Skipped ${file.name}:`,e)}}if(!locatedGGUFFiles.size)throw new Error("None of the selected files contained a valid GGUF header.");renderGGUFCandidates();document.getElementById("gguf-status").textContent=`Located ${locatedGGUFFiles.size} valid GGUF model(s). Select one, then ingest and start it.`}
    async function chooseGGUF(){if(globalThis.showOpenFilePicker){try{const[handle]=await showOpenFilePicker({multiple:false,types:[{description:"GGUF language model",accept:{"application/octet-stream":[".gguf"]}}]});await addGGUFFiles([await handle.getFile()]);return}catch(e){if(e.name==="AbortError")return}}document.getElementById("gguf-file-input").click()}
    async function ingestSelectedGGUF(){const entry=locatedGGUFFiles.get(selectedGGUFKey);if(!entry)throw new Error("Locate and select a valid GGUF file first.");const{file,info}=entry,status=document.getElementById("gguf-status"),fill=document.getElementById("gguf-progress-fill");fill.style.width="0%";const launch={port:Number(document.getElementById("gguf-port").value||8080),ctx_size:Number(document.getElementById("gguf-context").value||8192),gpu_layers:Number(document.getElementById("gguf-gpu-layers").value||-1),threads:Number(document.getElementById("gguf-threads").value||0)};const start=await bridgeJSON("/models/import/start",{method:"POST",body:JSON.stringify({filename:info.name,size:info.size,fingerprint:info.fingerprint})});if(!start.already_present){const cs=8*1024*1024;let offset=start.offset||0,index=Math.floor(offset/cs);while(offset<file.size){const chunk=await file.slice(offset,Math.min(file.size,offset+cs)).arrayBuffer(),response=await fetch(`${ggufBridgeBase()}/models/import/chunk?upload_id=${encodeURIComponent(start.upload_id)}&offset=${offset}&index=${index}`,{method:"POST",headers:{"content-type":"application/octet-stream"},body:chunk}),text=await response.text(),result=JSON.parse(text||"{}");if(!response.ok||result.ok===false)throw new Error(result.error||`Chunk upload failed at ${offset}.`);offset=result.received;index++;const percent=Math.min(100,offset/file.size*100);fill.style.width=`${percent}%`;status.textContent=`Ingesting ${info.name}: ${percent.toFixed(1)}% · ${formatBytes(offset)} / ${formatBytes(file.size)}`}}else{fill.style.width="100%";status.textContent="The bridge already has this exact GGUF. Starting it without another upload..."}const finish=await bridgeJSON("/models/import/finish",{method:"POST",body:JSON.stringify({upload_id:start.upload_id,filename:info.name,fingerprint:info.fingerprint,launch})});await activateBridgeModel(finish)}
    async function activateBridgeModel(result){const endpoint=result.endpoint||`${ggufBridgeBase()}/v1/chat/completions`;document.getElementById("model-provider").value="gguf";document.getElementById("model-name").value=result.model_id||result.model?.name||"local-gguf";document.getElementById("model-endpoint").value=endpoint;persistModelSettings();document.getElementById("gguf-state").textContent=result.ready?"GGUF model ready":"GGUF model starting";document.getElementById("gguf-state").className=`gguf-state ${result.ready?"ready":""}`;document.getElementById("gguf-status").textContent=`Bridge accepted ${result.model?.name||result.model_id||"the GGUF"}. Waiting for llama-server readiness at ${endpoint}.`;await pollGGUFReady()}
    async function pollGGUFReady(timeoutMs=120000){const started=Date.now(),status=document.getElementById("gguf-status");while(Date.now()-started<timeoutMs){try{const h=await bridgeJSON("/health");if(h.active?.ready){document.getElementById("gguf-state").textContent="GGUF model ready";document.getElementById("gguf-state").className="gguf-state ready";status.textContent=`Ready: ${h.active.model_name} · llama-server PID ${h.active.pid} · ${h.active.endpoint}`;document.getElementById("model-provider").value="gguf";document.getElementById("model-name").value=h.active.model_id||h.active.model_name;document.getElementById("model-endpoint").value=h.active.endpoint;persistModelSettings();return h}if(h.active?.error)throw new Error(h.active.error);status.textContent=`llama-server is ${h.active?.status||"starting"}...`}catch(e){status.textContent=`Waiting for bridge/model: ${e.message}`}await new Promise(r=>setTimeout(r,1500))}throw new Error("The GGUF was ingested, but llama-server did not become ready before the timeout.")}
    async function probeGGUFBridge(){try{const h=await bridgeJSON("/health"),binary=h.llama_server||"not found";document.getElementById("gguf-status").textContent=h.active?`Bridge online. llama-server: ${binary}\nActive model: ${h.active.model_name} · ${h.active.status}`:`Bridge online. llama-server: ${binary}\nNo active model.`;document.getElementById("gguf-state").textContent=h.active?.ready?"GGUF model ready":"Bridge online";document.getElementById("gguf-state").className=`gguf-state ${h.active?.ready?"ready":""}`;return h}catch(e){document.getElementById("gguf-state").textContent="Bridge unavailable";document.getElementById("gguf-state").className="gguf-state bad";document.getElementById("gguf-status").textContent=`Bridge probe failed: ${e.message}\nStart the included start_local_model_bridge script, then probe again.`;throw e}}
    async function openNativeBridgePicker(){document.getElementById("gguf-status").textContent="Asking the local bridge to open its native GGUF file browser...";const result=await bridgeJSON("/models/select-native",{method:"POST",body:JSON.stringify({launch:{port:Number(document.getElementById("gguf-port").value||8080),ctx_size:Number(document.getElementById("gguf-context").value||8192),gpu_layers:Number(document.getElementById("gguf-gpu-layers").value||-1),threads:Number(document.getElementById("gguf-threads").value||0)}})});document.getElementById("gguf-model-card").textContent=[`Native model: ${result.model?.name||result.model_id}`,`Path: ${result.model?.path||"selected by bridge"}`,`Size: ${formatBytes(result.model?.size||0)}`,`GGUF version: ${result.model?.version??"unknown"}`].join("\n");document.getElementById("gguf-progress-fill").style.width="100%";await activateBridgeModel(result)}
    async function stopGGUFModel(){const result=await bridgeJSON("/models/stop",{method:"POST",body:"{}"});document.getElementById("gguf-state").textContent="Local model stopped";document.getElementById("gguf-state").className="gguf-state";document.getElementById("gguf-status").textContent=result.message||"The active llama-server process was stopped."}


    // RC22.4 supplied Living School visual core: source-sized scenes and normalized touch maps.
    const LS_VISUAL_KEY="living-school.visual-mode.v1";
    const LS_VISUAL_PARAMS=new URLSearchParams(location.search);
    const LS_FORCE_VISUAL_DEFAULT=LS_VISUAL_PARAMS.get("visual")==="1"||LS_VISUAL_PARAMS.get("commonweave")==="1";
    const LS_ROOM_KEY="living-school.visual-room.v1";
    const LS_VISUAL_ROOMS=window.LivingSchoolVisualCore?.rooms||{};
    const LS_ROOM_ALIASES=window.LivingSchoolVisualCore?.aliases||{};
    if(!Object.keys(LS_VISUAL_ROOMS).length)console.error("Living School visual core did not load.");
    // RC19.3: every Living School visual room now runs through the reusable World Engine.
    Object.entries(LS_VISUAL_ROOMS).forEach(([roomId,room])=>{room.engineScene=`living-school.${roomId}`;});
    let livingWorldEngine=null;
    function ensureLivingWorldEngine(){
      if(livingWorldEngine||!window.CommonweaveWorldEngine)return livingWorldEngine;
      livingWorldEngine=new window.CommonweaveWorldEngine({
        storageKey:"living-school.world-state.v1",
        onNavigate:room=>openLivingVisualRoom(room),
        onWorkspace:target=>openLivingClassicTarget(target),
        onAction:item=>{
          if(item.action==="moss"||item.action==="moss-dialog"){openLivingMossDialog();return;}
          if(item.action==="directory"){openLivingDirectory();return;}
          if(item.action==="cerbanimo"){location.href="../cerbanimo/index.html?commonweave=1&visual=1#world-title";return;}
          if(item.action==="fellowfare"){location.href="../fellowfare/index.html?commonweave=1&visual=1";return;}
          if(item.action==="commonweave"){location.href="../../index.html?visual=1&build=1.0.14#square";return;}
          if(item.action==="settings"){openLivingClassicTarget({workspace:"studio",focus:"model-settings",label:"Settings and model controls"});return;}
          if(String(item.action||"").startsWith("journal-")){openLivingJournal(item.action.slice(8),item.prompt||"");return;}
          if(item.action==="quiet-library"){const quiet=livingWorldEngine.toggle("living-school.library.quiet");livingWorldEngine.set("living-school.library.mood",quiet?"quiet":"busy");livingWorldEngine.showMessage(quiet?"Quiet study settles over the stacks.":"The library returns to its bright communal hum.");livingWorldEngine.render();return;}
        },
        onAnnounce:announceLiving
      });
      const roomResidents={
        exterior:{label:"Pip, Campus Courier",glyph:"➜",position:{x:82,y:70},lines:["The academy keeps its doors open by remembering where every path leads.","The directory works offline. Even a quiet pocket campus can find its way home."]},
        courtyard:{label:"Rue, Groundskeeper",glyph:"✿",position:{x:52,y:70},lines:["Every wing is connected. Pick the door that matches what you need now.","The courtyard bulletin changes when your learning changes."]},
        entrance:{label:"Aster, Hall Guide",glyph:"⌂",position:{x:52,y:73},lines:["The entrance hall is a crossroads, not a waiting room.","You can always return here without losing your place."]},
        moss:{label:"Moss",glyph:"✦",position:{x:49,y:55},lines:["Bring me the tangled version. We can make a path without sanding off the interesting parts.","A question can become a lesson, a practicum, or a bridge into Cerbanimo."]},
        forge:{label:"Ember, Curriculum Smith",glyph:"⚒",position:{x:51,y:74},lines:["Start rough. Blueprints improve when they meet actual learners.","A curriculum is a promise about what someone will be able to do next."]},
        workshop:{label:"Tavi, Practicum Steward",glyph:"⚙",position:{x:52,y:71},lines:["Evidence belongs close to the work that produced it.","A small real task often teaches more than a large imaginary one."]},
        commons:{label:"Sol, Cohort Host",glyph:"☕",position:{x:51,y:68},lines:["Cohorts work best when people can arrive with different speeds and still share a table.","The commons remembers invitations, sessions, and shared challenges."]},
        passport:{label:"Iris, Record Keeper",glyph:"✧",position:{x:51,y:70},lines:["Your passport is portable evidence, not a permanent label.","Badges should point toward capability, not merely attendance."]},
        faculty:{label:"Professor Thistle",glyph:"?",position:{x:49,y:70},lines:["Human help is part of the system, not an emergency exit.","Office hours can become mentorship, review, or a collaborative build."]},
        review:{label:"Nia, Review Steward",glyph:"✓",position:{x:52,y:72},lines:["Good review makes the next attempt possible.","Critique the evidence and reasoning, never the learner's worth."]},
        credential:{label:"Cinder, Credential Smith",glyph:"◆",position:{x:50,y:72},lines:["A credential should show what was done, how it was checked, and what travels with it.","Celebration is part of verification. People should feel the door opening."]},
        map:{label:"Atlas, Directory Sprite",glyph:"⌘",position:{x:50,y:86},lines:["All eighteen destinations are reachable from here.","The map is generated from the same room definitions that power travel."]},
        research:{label:"Fern, Research Gardener",glyph:"⌕",position:{x:50,y:75},lines:["Sources need provenance, context, and room for disagreement.","Bring field notes back from practica. The conservatory grows from evidence."]},
        challenge:{label:"Jax, Arena Coach",glyph:"!",position:{x:50,y:75},lines:["Retries are part of learning, not a stain on the score.","Use the challenge to locate the next lesson, not to close the gate forever."]},
        tower:{label:"Vale, Competency Keeper",glyph:"▲",position:{x:50,y:75},lines:["The tower checks prerequisites, evidence, and mastery before it opens the roof.","A final gate should be difficult to fake and possible to prepare for."]},
        observatory:{label:"Nova, Constellation Reader",glyph:"✶",position:{x:50,y:75},lines:["Concepts become useful when you can see the relationships between them.","Misconceptions are stars too. Mark them clearly so you can navigate around them."]},
        bridge:{label:"Kite, Bridge Tender",glyph:"⇄",position:{x:50,y:75},lines:["Learning crosses into Cerbanimo as quests, tasks, and evidence.","The bridge runs both ways. Field work should reshape the school."]}
      };
      const roomAmbient={
        exterior:["Wind stirs the painted campus banners.","A new learner follows the path toward the courtyard."],
        courtyard:["A paper notice pins itself to the community board.","Someone chalks a new study circle onto the paving stones."],
        entrance:["The hall directory quietly rearranges around the learner's active path.","A distant classroom bell rings once."],
        moss:["A stack of notes rustles into a more useful order.","Moss circles one promising question in pink marker."],
        forge:["A blueprint gains another handwritten connection.","The curriculum furnace gives a cheerful metallic ping."],
        workshop:["A workbench lamp turns toward an unfinished practicum.","Fresh evidence lands in a labeled tray."],
        commons:["A chair scoots over to make room at the table.","A cohort invitation flutters onto the notice wall."],
        passport:["A badge stamp clicks somewhere behind the counter.","A pathway line brightens on the learner map."],
        faculty:["An office-hours placard flips from busy to available.","A mentor leaves a careful note beside an open draft."],
        review:["A review token slides into the next open queue slot.","Someone rewrites a comment to make it more actionable."],
        credential:["The forge cools around a newly verified record.","A celebration ribbon unrolls across the rafters."],
        map:["One route glows, then fades back into the campus map.","Tiny footsteps cross between two numbered rooms."],
        research:["A pressed leaf joins a page of field observations.","A citation tag sprouts beside a newly added source."],
        challenge:["The arena resets without erasing what the learner discovered.","A hint lantern flickers near the next useful clue."],
        tower:["A prerequisite sigil lights on the tower stair.","The mastery gate checks its evidence seals."],
        observatory:["A concept line appears between two distant stars.","The retrieval queue rotates one idea back into view."],
        bridge:["A quest packet crosses toward Cerbanimo.","Field evidence returns across the bridge into the school."]
      };
      const makeEngineObject=(spot,index)=>({
        ...spot,id:spot.id||`spot-${index}`,label:spot.label,bounds:{x:spot.x,y:spot.y,w:spot.w,h:spot.h},
        ...(spot.room?{portal:spot.room}:{}),
        ...(spot.workspace?{workspace:spot.workspace,focus:spot.focus}:{}),
        badge:undefined
      });
      Object.entries(LS_VISUAL_ROOMS).forEach(([roomId,room])=>{
        const resident=roomResidents[roomId];
        livingWorldEngine.registerScene({
          id:room.engineScene,label:room.label,image:room.image,width:room.width,height:room.height,
          alt:`${room.label} illustrated visual room`,
          ambientInterval:48000,
          objects:(room.spots||[]).map(makeEngineObject),
          actors:[],
          ambient:(roomAmbient[roomId]||[]).map(message=>({message}))
        });
      });
      return livingWorldEngine;
    }

    let lsVisualRoom=localStorage.getItem(LS_ROOM_KEY)||"home";
    lsVisualRoom=LS_ROOM_ALIASES[lsVisualRoom]||lsVisualRoom;
    if(!LS_VISUAL_ROOMS[lsVisualRoom])lsVisualRoom="home";
    let lsVisualHistory=[];
    let lsPendingClassic=null;
    function lsEsc(value){return String(value??"").replace(/[&<>\"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));}
    function renderLivingVisualRoom(){
      const room=LS_VISUAL_ROOMS[lsVisualRoom]||LS_VISUAL_ROOMS.exterior;
      const stage=document.getElementById("livingVisualStage"); if(!stage)return;
      livingWorldEngine?.stopAmbient?.();
      let engineMounted=false;
      try{
        const engine=ensureLivingWorldEngine();
        if(engine&&room.engineScene){engine.mount(room.engineScene,stage);engineMounted=true;}
      }catch(error){
        console.error("Living School World Engine scene failed; using compatibility renderer.",error);
        announceLiving(`World Engine fallback active in ${room.label}.`);
      }
      if(!engineMounted){
        const gateway=room.gateway?`<section class="ls-gateway-card" aria-label="${lsEsc(room.label)} temporary visual gateway"><span class="ls-status-chip">Artwork incoming</span><h2>${lsEsc(room.label)}</h2><p>${lsEsc(room.hint)} This compatibility gateway keeps every working control available while the scene engine recovers.</p><div class="ls-gateway-actions"><button type="button" class="primary" data-ls-gateway-open>Open full controls</button><button type="button" data-ls-gateway-map>Campus map</button></div></section>`:"";
        stage.innerHTML=`<div class="ls-visual-frame" data-source-width="${room.width||768}" data-source-height="${room.height||1792}"><img src="${room.image}" alt="${lsEsc(room.label)} illustrated visual room" draggable="false">${gateway}${room.spots.map((spot,index)=>`<button type="button" class="ls-hotspot" data-ls-spot="${index}" aria-label="${lsEsc(spot.label)}" style="left:${spot.x}%;top:${spot.y}%;width:${spot.w}%;height:${spot.h}%"><span>${lsEsc(spot.label)}</span></button>`).join("")}</div>`;
        window.CommonweaveFitVisualFrame?.(stage,stage.querySelector(".ls-visual-frame"));
        stage.querySelectorAll("[data-ls-spot]").forEach(button=>button.addEventListener("click",()=>activateLivingVisualSpot(room.spots[Number(button.dataset.lsSpot)])));
        stage.querySelector("[data-ls-gateway-open]")?.addEventListener("click",()=>openLivingClassicTarget({workspace:room.workspace,focus:room.focus,label:room.label}));
        stage.querySelector("[data-ls-gateway-map]")?.addEventListener("click",()=>openLivingVisualRoom("map"));
      }
      document.getElementById("livingVisualTitle").textContent=room.label;
      document.getElementById("livingVisualHint").textContent=engineMounted?`${room.hint} World Engine objects, residents, ambient events, and saved room state are active.`:`${room.hint} Compatibility renderer active.`;
      localStorage.setItem(LS_ROOM_KEY,lsVisualRoom);
      renderLivingActionTray();
      const count=engineMounted&&livingWorldEngine?livingWorldEngine.listActions(room.engineScene).length:room.spots.length;
      document.getElementById("livingVisualLive").textContent=`Entered ${room.label}. ${count} actions available.`;
    }
    function livingSpotKind(spot){return spot.room?"room":spot.action?"action":"controls";}
    function renderLivingActionTray(){const room=LS_VISUAL_ROOMS[lsVisualRoom];const list=document.getElementById("livingVisualActionList");if(!room||!list)return;document.getElementById("livingVisualActionsTitle").textContent=room.label;let engineActions=null;try{engineActions=room.engineScene&&livingWorldEngine?.getScene(room.engineScene)?livingWorldEngine.listActions(room.engineScene):null;}catch{engineActions=null;}const actions=engineActions||room.spots;list.innerHTML=actions.map((spot,index)=>`<button type="button" data-ls-action-index="${index}"><span>${lsEsc(typeof spot.label==="function"?spot.label(livingWorldEngine?.state||{},livingWorldEngine):spot.label)}</span><em>${spot.action==="actor"?"person":spot.portal?"room":spot.workspace?"controls":livingSpotKind(spot)}</em></button>`).join("");list.querySelectorAll("[data-ls-action-index]").forEach(button=>button.addEventListener("click",()=>{closeLivingActions();const selected=actions[Number(button.dataset.lsActionIndex)];if(engineActions){if(selected.__worldActor)livingWorldEngine.activateActor(selected);else livingWorldEngine.activateObject(selected);}else activateLivingVisualSpot(selected);}));}
    function openLivingActions(){renderLivingActionTray();document.getElementById("livingVisualActions")?.classList.add("open");document.getElementById("livingVisualActions")?.setAttribute("aria-hidden","false");}
    function closeLivingActions(){document.getElementById("livingVisualActions")?.classList.remove("open");document.getElementById("livingVisualActions")?.setAttribute("aria-hidden","true");}
    function announceLiving(message){const live=document.getElementById("livingVisualLive");if(live)live.textContent=message;}

    const LS_JOURNAL_KEY="living-school.visual-journal.v1";
    function livingJournalEntries(){try{const entries=JSON.parse(localStorage.getItem(LS_JOURNAL_KEY)||"[]");return Array.isArray(entries)?entries:[];}catch{return[];}}
    function saveLivingJournalEntries(entries){localStorage.setItem(LS_JOURNAL_KEY,JSON.stringify(entries.slice(0,200)));}
    function renderLivingJournalEntries(filter="all"){
      const host=document.getElementById("livingJournalEntries");if(!host)return;
      const entries=livingJournalEntries().filter(entry=>filter==="all"||entry.privacy===filter);
      host.innerHTML=entries.length?entries.map(entry=>`<article class="ls-journal-entry"><small>${lsEsc(new Date(entry.createdAt).toLocaleString())} · ${lsEsc(entry.privacy)}${entry.mood?` · ${lsEsc(entry.mood)}`:""}</small><p>${lsEsc(entry.text)}</p></article>`).join(""):`<div class="ls-journal-empty">No ${filter==="all"?"":filter+" "}entries yet.</div>`;
    }
    function openLivingJournal(mode="new",prompt=""){
      const dialog=document.getElementById("livingJournalDialog");if(!dialog)return;
      const filter=mode==="private"?"private":mode==="shared"?"shared":"all";
      document.getElementById("livingJournalPrompt").textContent=prompt||({mood:"Record how your energy and attention feel right now.",list:"Revisit what you have already noticed.",private:"Private entries stay only in this browser profile.",shared:"Shared reflections are marked for sharing but remain local until you explicitly export or attach them."}[mode]||"Write what changed, what remains open, or what the work taught you.");
      if(mode==="private"||mode==="shared")document.getElementById("livingJournalPrivacy").value=mode;
      dialog.hidden=false;dialog.setAttribute("aria-hidden","false");renderLivingJournalEntries(filter);
      setTimeout(()=>document.getElementById(mode==="mood"?"livingJournalMood":"livingJournalText")?.focus(),30);
    }
    function closeLivingJournal(){const dialog=document.getElementById("livingJournalDialog");if(dialog){dialog.hidden=true;dialog.setAttribute("aria-hidden","true");}}
    function recordLivingJournal(){
      const text=document.getElementById("livingJournalText")?.value.trim();if(!text){announceLiving("Write a reflection before saving it.");document.getElementById("livingJournalText")?.focus();return;}
      const entry={id:`journal-${Date.now()}`,text,mood:document.getElementById("livingJournalMood")?.value||"",privacy:document.getElementById("livingJournalPrivacy")?.value||"private",createdAt:new Date().toISOString(),room:lsVisualRoom};
      const entries=livingJournalEntries();entries.unshift(entry);saveLivingJournalEntries(entries);document.getElementById("livingJournalText").value="";renderLivingJournalEntries("all");announceLiving("Journal entry saved locally.");
    }
    function openLivingMossDialog(){
      try{openSheet("moss-sheet",document.getElementById("ask-moss"));document.getElementById("moss-question")?.focus({preventScroll:true});}
      catch{openLivingClassicTarget({workspace:"studio",focus:"moss-pathway-desk",label:"Ask Moss"});}
    }
    function openLivingVisualRoom(name,{push=true}={}){name=LS_ROOM_ALIASES[name]||name;if(!LS_VISUAL_ROOMS[name])name="home";if(push&&name!==lsVisualRoom)lsVisualHistory.push(lsVisualRoom);lsVisualRoom=name;renderLivingVisualRoom();closeLivingDirectory();closeLivingActions();if(history.state?.livingRoom!==name)history.pushState({...history.state,livingRoom:name},"",location.href);announceLiving(`Entered ${LS_VISUAL_ROOMS[name].label}`);}
    function openLivingVisual(){document.body.classList.add("ls-visual-open");document.body.classList.remove("ls-classic-open");document.getElementById("livingVisualWorld")?.setAttribute("aria-hidden","false");localStorage.setItem(LS_VISUAL_KEY,"visual");renderLivingVisualRoom();}
    function closeLivingVisual(){openLivingVisual();}
    function openLivingDirectory(){openLivingVisualRoom("map");}
    function closeLivingDirectory(){}
    let lsProjectedNode=null,lsProjectionMarker=null,lsProjectionSurfaceSession=null;
    function closeLivingProjection(){
      const projection=document.getElementById("livingVisualProjection");
      lsProjectionSurfaceSession?.destroy?.();lsProjectionSurfaceSession=null;
      if(lsProjectedNode&&lsProjectionMarker?.parentNode){lsProjectedNode.classList.remove("ls-projected-workspace");lsProjectionMarker.parentNode.insertBefore(lsProjectedNode,lsProjectionMarker);lsProjectionMarker.remove();}
      lsProjectedNode=null;lsProjectionMarker=null;
      projection?.classList.remove("open","ls-surface-filled","ls-surface-has-data");projection?.setAttribute("aria-hidden","true");
      document.body.classList.remove("ls-visual-projection-open");
    }
    function activateLivingVisualSpot(spot){
      if(!spot)return;
      if(spot.room){openLivingVisualRoom(spot.room);return;}
      if(spot.action==="directory"){openLivingDirectory();return;}
      if(spot.action==="moss"||spot.action==="moss-dialog"){openLivingMossDialog();return;}
      if(spot.action==="cerbanimo"){location.href="../cerbanimo/index.html?commonweave=1&visual=1#world-title";return;}
      if(spot.action==="fellowfare"){location.href="../fellowfare/index.html?commonweave=1&visual=1";return;}
      if(spot.action==="commonweave"){location.href="../../index.html?visual=1&build=1.0.14#square";return;}
      if(spot.action==="settings"){openLivingClassicTarget({workspace:"studio",focus:"model-settings",label:"Settings and model controls"});return;}
      if(String(spot.action||"").startsWith("journal-")){openLivingJournal(spot.action.slice(8),spot.prompt||"");return;}
      if(spot.action==="message"){announceLiving(spot.message||spot.label);return;}
      if(spot.workspace){openLivingClassicTarget(spot);return;}
    }
    function openLivingClassicTarget(target){
      if(!target?.workspace)return;
      setWorkspace(target.workspace,{focusId:target.focus||null});
      setTimeout(()=>{
        closeLivingProjection();
        const node=(target.focus&&document.getElementById(target.focus))||document.querySelector(`.workspace-region[data-workspace="${target.workspace}"]`)||document.querySelector(`[data-workspace="${target.workspace}"]`);
        if(node?.matches?.("details"))node.open=true;
        const host=document.getElementById("livingVisualProjectionHost"),projection=document.getElementById("livingVisualProjection"),scene=document.getElementById("livingVisualProjectionScene"),device=document.getElementById("livingVisualInterfaceDevice"),image=document.getElementById("livingVisualInterfaceImage"),status=document.getElementById("livingVisualInterfaceStatus");
        if(!node||!host||!projection||!device||!image){announceLiving("This function needs a dedicated illustrated host asset before it can open here.");return;}
        lsProjectionMarker=document.createComment("living-school-projection-marker");node.parentNode.insertBefore(lsProjectionMarker,node);lsProjectedNode=node;host.replaceChildren(node);
        node.classList.add("ls-projected-workspace");
        if(scene)scene.src=(LS_VISUAL_ROOMS[lsVisualRoom]||LS_VISUAL_ROOMS.moss).image;
        lsProjectionSurfaceSession=window.LivingSchoolInterfaceSurfaces?.mount({target,node,projection,device,image,status})||null;
        projection.classList.add("open");projection.setAttribute("aria-hidden","false");document.body.classList.add("ls-visual-projection-open");
        requestAnimationFrame(()=>node.querySelector("input,textarea,select,button")?.focus({preventScroll:true}));
      },60);
    }
    function bindLivingVisual(){
      const grid=document.getElementById("livingVisualDirectoryGrid");
      const classicDestinations=[];
      if(grid){
        const visualItems=Object.entries(LS_VISUAL_ROOMS).map(([key,room],index)=>`<button type="button" class="ls-directory-item" data-ls-room="${key}"><b>${String(index+1).padStart(2,"0")}</b><span><strong>${lsEsc(room.label)}</strong><small>${lsEsc(room.hint)}</small></span></button>`);
        const classicItems=classicDestinations.map(item=>`<button type="button" class="ls-directory-item" data-ls-workspace="${item.workspace}" data-ls-focus="${item.focus}"><b>${String(item.n).padStart(2,"0")}</b><span><strong>${lsEsc(item.label)}</strong><small>${lsEsc(item.hint)} · In-world controls</small></span></button>`);
        grid.innerHTML=[...visualItems,...classicItems].join("");
      }
      grid?.querySelectorAll("[data-ls-room]").forEach(button=>button.addEventListener("click",()=>openLivingVisualRoom(button.dataset.lsRoom)));
      grid?.querySelectorAll("[data-ls-workspace]").forEach(button=>button.addEventListener("click",()=>openLivingClassicTarget({workspace:button.dataset.lsWorkspace,focus:button.dataset.lsFocus,label:button.querySelector("strong")?.textContent||"Workspace"})));
      document.querySelector("[data-ls-back]")?.addEventListener("click",()=>openLivingVisualRoom(lsVisualHistory.pop()||"exterior",{push:false}));
      document.querySelector("[data-ls-home]")?.addEventListener("click",()=>openLivingVisualRoom("home"));
      document.querySelector("[data-ls-commonweave]")?.addEventListener("click",()=>{location.href="../../index.html?visual=1&build=1.0.14#square";});
      document.querySelector("[data-ls-model]")?.addEventListener("click",()=>openModelFoundry());
      document.querySelector("[data-ls-close-projection]")?.addEventListener("click",closeLivingProjection);
      document.querySelector("[data-ls-journal-close]")?.addEventListener("click",closeLivingJournal);
      document.querySelector("[data-ls-journal-save]")?.addEventListener("click",recordLivingJournal);
      document.querySelector("[data-ls-journal-new]")?.addEventListener("click",()=>{document.getElementById("livingJournalText").value="";document.getElementById("livingJournalMood").value="";document.getElementById("livingJournalText").focus();});
      document.getElementById("livingJournalDialog")?.addEventListener("click",event=>{if(event.target===event.currentTarget)closeLivingJournal();});
      document.querySelector("[data-ls-directory]")?.addEventListener("click",openLivingDirectory);
      document.querySelector("[data-ls-close-directory]")?.addEventListener("click",closeLivingDirectory);
      
      
      document.querySelector("[data-ls-close-actions]")?.addEventListener("click",closeLivingActions);
      
      
      document.querySelector("[data-ls-cancel-classic]")?.addEventListener("click",()=>{lsPendingClassic=null;document.getElementById("livingClassicFallback").classList.remove("open");document.getElementById("livingClassicFallback").setAttribute("aria-hidden","true");});
      document.querySelector("[data-ls-open-classic]")?.addEventListener("click",()=>{const target=lsPendingClassic;document.getElementById("livingClassicFallback").classList.remove("open");document.getElementById("livingClassicFallback").setAttribute("aria-hidden","true");closeLivingVisual();if(target?.workspace)setWorkspace(target.workspace,{focusId:target.focus||null});lsPendingClassic=null;});
      document.getElementById("livingVisualDirectory")?.addEventListener("click",event=>{if(event.target===event.currentTarget)closeLivingDirectory();});
      if(localStorage.getItem("living-school.visual-fit.v1")==="contain"){document.body.classList.add("ls-fit-room");const fit=document.querySelector("[data-ls-fit]");if(fit)fit.textContent="Fill";}
      let swipeStart=null;document.getElementById("livingVisualStage")?.addEventListener("pointerdown",event=>{swipeStart={x:event.clientX,y:event.clientY};});document.getElementById("livingVisualStage")?.addEventListener("pointerup",event=>{if(!swipeStart)return;const dx=event.clientX-swipeStart.x,dy=event.clientY-swipeStart.y;swipeStart=null;if(Math.abs(dx)>70&&Math.abs(dx)>Math.abs(dy)*1.4){if(dx>0)openLivingVisualRoom(lsVisualHistory.pop()||"home",{push:false});else openLivingActions();}});
      window.addEventListener("popstate",event=>{if(document.body.classList.contains("ls-visual-open")&&event.state?.livingRoom&&LS_VISUAL_ROOMS[event.state.livingRoom]){lsVisualRoom=event.state.livingRoom;renderLivingVisualRoom();}});
      window.addEventListener("keydown",event=>{if(!document.body.classList.contains("ls-visual-open"))return;if(event.key==="Escape"){if(document.getElementById("livingVisualProjection")?.classList.contains("open"))closeLivingProjection();}else if(event.key.toLowerCase()==="m")openLivingDirectory();else if(event.key.toLowerCase()==="a")openLivingActions();else if(event.key.toLowerCase()==="h")openLivingVisualRoom("home");});
      if(LS_FORCE_VISUAL_DEFAULT){try{localStorage.setItem(LS_VISUAL_KEY,"visual");}catch{}}
      setTimeout(openLivingVisual,40);
    }

    function hostedEntitlementIsActive(){
      ensureCommerceState();
      const entitlement=state.commerce.entitlement;
      if(!entitlement||entitlement.status!=="active") return false;
      if(entitlement.expiresAt&&Date.parse(entitlement.expiresAt)<=Date.now()) return false;
      return entitlement.planId!=="commons";
    }

    let mossResearchPacket=null;
    function researchPhase(name){document.querySelectorAll(".research-progress span").forEach(node=>{node.classList.toggle("active",node.dataset.phase===name);if(node.dataset.phase!==name&&node.classList.contains("active"))node.classList.remove("active")});}
    function finishResearchPhases(){document.querySelectorAll(".research-progress span").forEach(node=>{node.classList.remove("active");node.classList.add("done")});}
    function resetResearchPhases(){document.querySelectorAll(".research-progress span").forEach(node=>node.classList.remove("active","done"));}
    function researchQuality(source={}){
      const host=(()=>{try{return new URL(source.url).hostname.replace(/^www\./,"")}catch{return""}})();
      const authoritative=/\.gov$|\.gov\.|\.edu$|\.edu\.|who\.int$|un\.org$|cdc\.gov$|nih\.gov$|nasa\.gov$|wikipedia\.org$/.test(host);
      const commercial=/amazon\.|shopify|product|store\.|sponsor|affiliate/.test(`${host} ${source.snippet||""}`.toLowerCase());
      const community=/reddit\.|facebook\.|tiktok\.|forum|community/.test(host);
      const contested=/debate|controvers|disagree|critique|opinion/.test(`${source.title||""} ${source.snippet||""}`.toLowerCase());
      if(contested)return {id:"contested",label:"contested or viewpoint"};
      if(authoritative)return {id:"authoritative",label:"authoritative reference"};
      if(commercial)return {id:"commercial",label:"commercial source"};
      if(community)return {id:"community",label:"community source"};
      return {id:"practitioner",label:"practitioner / general reference"};
    }
    function selectedResearchSources(){return (mossResearchPacket?.sources||[]).filter(item=>item.selected!==false)}
    function selectedResearchVideos(){return (mossResearchPacket?.videos||[]).filter(item=>item.selected!==false)}
    function researchSourcePack(packet){
      const sources=(packet.sources||[]).filter(source=>source.selected!==false);
      const videos=(packet.videos||[]).filter(video=>video.selected!==false);
      return sources.map((source,index)=>{const quality=source.quality||researchQuality(source);return `## Source ${index+1}: ${source.title}\nSource class: ${quality.label}\nPublisher: ${source.publisher||"Unknown"}\nRetrieved: ${source.retrievedAt||new Date().toISOString()}\n${source.snippet||""}\n[${index+1}] ${source.url}`}).join("\n\n")+(videos.length?`\n\n## Selected lesson media\n${videos.map((video,index)=>`[V${index+1}] ${video.title} — ${video.channel||"YouTube"}\n${video.url}\nInstructional purpose: ${video.purpose||"demonstration or explanation"}\n${video.description||""}`).join("\n\n")}`:"");
    }
    function renderResearchPacket(packet){
      const root=document.getElementById("research-results");document.getElementById("research-provider").textContent="Commonweave Research";
      packet.sources=(packet.sources||[]).map(source=>({...source,selected:source.selected!==false,quality:source.quality||researchQuality(source)}));
      packet.videos=(packet.videos||[]).map(video=>({...video,selected:video.selected!==false}));
      const qualityCounts=packet.sources.reduce((acc,source)=>{acc[source.quality.id]=(acc[source.quality.id]||0)+1;return acc},{});
      const summary=`<div class="research-summary"><div><b>${packet.sources.length}</b><span>sources found</span></div><div><b>${packet.videos.length}</b><span>videos found</span></div><div><b>${qualityCounts.authoritative||0}</b><span>authoritative</span></div><div><b>${packet.sources.filter(x=>x.selected!==false).length}</b><span>selected</span></div></div>`;
      root.innerHTML=summary+[...packet.sources.map((source,index)=>`<article class="research-card ${source.selected===false?"unselected":""}" data-research-source="${index}" tabindex="0" role="checkbox" aria-checked="${source.selected!==false}"><span class="research-badge">source ${index+1}</span><div class="quality-row"><span class="quality-chip quality-${source.quality.id}">${escapeHTML(source.quality.label)}</span><span class="quality-chip">${source.selected!==false?"included":"excluded"}</span></div><h4>${escapeHTML(source.title)}</h4><p>${escapeHTML(source.snippet||"")}</p><small>${escapeHTML(source.publisher||"")}</small><br><a href="${escapeHTML(source.url)}" target="_blank" rel="noopener noreferrer">Inspect source ↗</a></article>`),...packet.videos.map((video,index)=>`<article class="research-card video ${video.selected===false?"unselected":""}" data-research-video="${index}" tabindex="0" role="checkbox" aria-checked="${video.selected!==false}"><span class="research-badge">video ${index+1}</span>${video.thumbnail?`<img src="${escapeHTML(video.thumbnail)}" alt="" style="width:100%;aspect-ratio:16/9;object-fit:cover">`:""}<div class="quality-row"><span class="quality-chip">${video.selected!==false?"embed candidate":"excluded"}</span></div><h4>${escapeHTML(video.title)}</h4><p>${escapeHTML(video.description||"")}</p><small>${escapeHTML(video.channel||"YouTube")}</small><br><a href="${escapeHTML(video.url)}" target="_blank" rel="noopener noreferrer">Preview video ↗</a></article>`)].join("");
      root.querySelectorAll("[data-research-source]").forEach(card=>{const toggle=()=>{const item=packet.sources[Number(card.dataset.researchSource)];item.selected=!item.selected;renderResearchPacket(packet)};card.addEventListener("click",event=>{if(event.target.closest("a"))return;toggle()});card.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();toggle()}})});
      root.querySelectorAll("[data-research-video]").forEach(card=>{const toggle=()=>{const item=packet.videos[Number(card.dataset.researchVideo)];item.selected=!item.selected;renderResearchPacket(packet)};card.addEventListener("click",event=>{if(event.target.closest("a"))return;toggle()});card.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();toggle()}})});
    }
    async function runMossResearch(){
      const subject=(document.getElementById("research-subject").value||document.getElementById("school-subject").value||"").trim();if(!subject){toast("Name a subject for Moss to research.");return null;}
      const status=document.getElementById("research-status"),button=document.getElementById("research-curriculum");button.disabled=true;resetResearchPhases();researchPhase("plan");status.textContent="Moss is mapping the subject into research questions…";
      try{await new Promise(r=>setTimeout(r,120));researchPhase("search");status.textContent="Commonweave is searching trusted references, practical guidance, safety notes, contrasting viewpoints, and lesson media…";
        const researchRequest={subject,depth:Number(document.getElementById("research-depth").value||10),videoCount:Number(document.getElementById("research-video-count").value||4)};
        let packet=null;
        try{
          const response=await fetch("/api/research",{method:"POST",headers:{"content-type":"application/json",accept:"application/json"},body:JSON.stringify(researchRequest)});
          const payload=await response.json();if(!response.ok||!payload.ok)throw new Error(payload.error||payload.message||"Research request failed");packet=payload;
        }catch(bridgeError){
          const runtimeApi=window.CommonweaveModelRuntime,config=modelConfigFromUI();
          if(!runtimeApi?.generateAgentic||config.provider!=="gemini")throw bridgeError;
          status.textContent="The local research bridge is unavailable. Antigravity is searching sources and YouTube candidates in the managed background…";
          const result=await runtimeApi.generateAgentic({
            purpose:"living-school-research-and-youtube-search",executionProfile:"agentic",background:true,requiresTools:true,webSearch:true,youtubeSearch:true,
            config:{provider:"gemini",route:"gemini",model:config.model,endpoint:config.endpoint,apiKey:config.apiKey,externalConsent:true,timeoutMs:600000,maxTokens:12000,stream:false,service:"living-school"},
            system:"You are Moss Research, a source-discovery agent for Living School. Search the public web and YouTube. Return JSON only. Do not invent URLs, titles, channels, publishers, or video IDs. Prefer authoritative and practitioner sources, include contrasting viewpoints when relevant, and flag safety-sensitive claims.",
            prompt:JSON.stringify({...researchRequest,outputSchema:{ok:true,retrievedAt:"ISO timestamp",sources:[{title:"",url:"",publisher:"",snippet:"",retrievedAt:"ISO timestamp"}],videos:[{title:"",url:"https://www.youtube.com/watch?v=...",videoId:"",channel:"",description:"",purpose:"",thumbnail:""}]}}),
            responseFormat:"json",maxRepairAttempts:1,requireExternalConsent:false
          });
          if(!["success","fallback"].includes(result.status))throw new Error(result.error?.message||"Antigravity research failed");
          packet=result.outputJson||JSON.parse(result.outputText||"{}");packet.ok=true;packet.retrievedAt=packet.retrievedAt||new Date().toISOString();
        }
        researchPhase("evaluate");status.textContent=`Classifying ${packet.sources?.length||0} candidate sources and preserving provenance…`;await new Promise(r=>setTimeout(r,120));researchPhase("media");status.textContent=`Reviewing ${packet.videos?.length||0} lesson-media candidates…`;await new Promise(r=>setTimeout(r,120));researchPhase("compile");
        mossResearchPacket=packet;renderResearchPacket(packet);document.getElementById("school-subject").value=subject;finishResearchPhases();
        status.textContent=`Research ready: ${packet.sources?.length||0} sources and ${packet.videos?.length||0} video candidates. Tap any card to include or exclude it, then build the curriculum.`;toast("Moss finished the research pass.");return packet;
      }catch(error){status.textContent=`Research stopped: ${error.message||error}. Moss can still build a local curriculum from your own notes.`;resetResearchPhases();return null;}finally{button.disabled=false;}
    }
    function applySelectedResearchToBuilder(){if(!mossResearchPacket)return;const sourceBox=document.getElementById("school-sources");const pack=researchSourcePack(mossResearchPacket);sourceBox.value=pack;renderSourceAnalysis(parseDataDump(pack));}
    async function buildSchoolFromResearch(){
      if(!mossResearchPacket){const packet=await runMossResearch();if(!packet)return;}
      applySelectedResearchToBuilder();
      const engine=document.getElementById("generation-engine");if(!hostedEntitlementIsActive()&&engine.value!=="deterministic")engine.value="deterministic";
      await generateFromBuilder();applyMossResearchMedia();
      document.getElementById("research-status").textContent=`School ready from ${selectedResearchSources().length} selected sources and ${selectedResearchVideos().length} selected videos.`;
    }
    function applyMossResearchMedia(){
      const videos=selectedResearchVideos();if(!videos.length){toast("No selected YouTube candidates are available.");return;}if(!state.school?.modules?.length){toast("Generate a curriculum before embedding media.");return;}
      state.school.modules.forEach((module,index)=>{const video=videos[index%videos.length];module.media=Array.isArray(module.media)?module.media:[];if(!module.media.some(item=>item.videoId===video.videoId))module.media.push({id:`research-video-${video.videoId||stableHash(video.url)}`,type:"video",videoId:video.videoId||"",url:video.url,title:video.title,attribution:video.channel,description:`Selected by Moss as supporting media for ${module.title}. Compare the presenter’s claims with the cited written sources.`,chapters:video.chapters||[],prompts:[`What claim in this video connects most directly to ${module.title}?`,`Where does the video agree or disagree with the written sources?`]});});saveState();renderSchool();toast("Selected research videos embedded across the curriculum.");
    }
    function clearMossResearch(){mossResearchPacket=null;document.getElementById("research-results").innerHTML="";document.getElementById("research-status").textContent="Research cleared. Existing curriculum and source notes were left intact.";resetResearchPhases();}

    function commerceBrokerBase(){
      return String(state.commerce?.billingConfig?.brokerEndpoint||"").replace(/\/+$/,"");
    }

    async function invokeHostedBroker(messages,config,signal){
      ensureCommerceState();
      if(!hostedEntitlementIsActive()){
        state.commerce.pendingPlanId="individual";
        setWorkspace("admin",{focusId:"billing-panel"});
        throw new Error("Commonweave hosted intelligence is not active for this account. Moss will preserve the goal and can continue with the local deterministic compiler.");
      }
      if(Number(state.commerce.aiWallet.balanceCents||0)<=0){
        setWorkspace("admin",{focusId:"billing-panel"});
        throw new Error("The hosted AI allowance is exhausted. Add a top-up, renew the plan, or switch to local AI.");
      }
      const base=commerceBrokerBase();
      if(!base){
        setWorkspace("admin",{focusId:"billing-panel"});
        throw new Error("The operator has not configured the hosted AI broker.");
      }

      const response=await fetch(`${base}/v1/ai/generate`,{
        method:"POST",
        signal,
        headers:{
          "content-type":"application/json",
          ...(state.commerce.entitlement.accessToken?{"authorization":`Bearer ${state.commerce.entitlement.accessToken}`}:{})
        },
        body:JSON.stringify({
          schema:"living-academy-hosted-ai-request-1.0",
          messages,
          model:config.model||"gemini-3.5-flash-lite",
          temperature:config.temperature,
          maxTokens:config.maxTokens,
          entitlementId:state.commerce.entitlement.id,
          learnerId:state.learner.learnerId,
          schoolId:state.school?.id||null
        })
      });
      const text=await response.text();
      let payload={};
      try{payload=JSON.parse(text||"{}");}catch{throw new Error(`Hosted AI returned non-JSON: ${text.slice(0,180)}`);}
      if(!response.ok||payload.ok===false) throw new Error(payload.error||`Hosted AI failed with HTTP ${response.status}.`);

      const usage=payload.usage||{};
      if(Number.isFinite(Number(usage.remainingCents))){
        state.commerce.aiWallet.balanceCents=Math.max(0,Number(usage.remainingCents));
      } else if(Number.isFinite(Number(usage.costCents))){
        state.commerce.aiWallet.balanceCents=Math.max(0,Number(state.commerce.aiWallet.balanceCents||0)-Number(usage.costCents));
      }
      if(Number.isFinite(Number(usage.costCents))){
        state.commerce.aiWallet.spentCents=Number(state.commerce.aiWallet.spentCents||0)+Number(usage.costCents);
      }
      state.commerce.aiWallet.usage.push({
        id:`usage-${Date.now()}`,
        at:new Date().toISOString(),
        model:payload.model||config.model,
        costCents:Number(usage.costCents||0),
        inputTokens:Number(usage.inputTokens||0),
        outputTokens:Number(usage.outputTokens||0),
        purpose:"curriculum-generation"
      });
      renderCommerce();
      saveState();
      return String(payload.text||payload.output||payload.content||"");
    }

    async function invokeLanguageModel(messages,config) {
      persistModelSettings();
      if(config.provider==="deterministic"){
        throw new Error("The deterministic route does not call a language model. Select the deterministic generation engine.");
      }
      if(config.provider==="manual"){
        document.getElementById("manual-model-prompt").value=messages.map(message=>`${message.role.toUpperCase()}:\n${message.content}`).join("\n\n");
        document.getElementById("model-settings").open=true;
        throw new Error("Manual mode prepared the prompt. Paste the model's JSON response below it.");
      }
      const runtimeApi=window.CommonweaveModelRuntime;
      if(!runtimeApi)throw new Error("The Commonweave model runtime did not load. Reload the Living School offline shell.");
      const provider=config.provider==="local-api"
        ?(config.localApiFlavor==="ollama"||/11434|\/api\/chat/.test(config.endpoint)?"ollama":"openai-compatible")
        :config.provider==="gguf"||config.provider==="openai"?"openai-compatible":config.provider;
      modelAbortController=new AbortController();
      const modelConsole=document.getElementById("model-console");
      const executionProfile=config.executionProfile||"interactive";
      const runtimeGenerate=executionProfile==="agentic"&&runtimeApi.generateAgentic?runtimeApi.generateAgentic.bind(runtimeApi):(runtimeApi.generateInteractive||runtimeApi.generate).bind(runtimeApi);
      const result=await runtimeGenerate({
        purpose:config.purpose||"living-school-curriculum",
        executionProfile,
        background:executionProfile==="agentic",
        requiresTools:executionProfile==="agentic",
        config:{
          provider,route:config.provider,model:config.model,endpoint:config.endpoint,apiKey:config.apiKey,
          externalConsent:Boolean(runtimeApi.endpointLeavesDevice(config)),timeoutSeconds:config.timeoutSeconds,
          temperature:config.temperature,maxTokens:config.maxTokens,context:config.ggufContext||8192,
          stream:false,service:"living-school"
        },
        messages,responseFormat:"json",maxRepairAttempts:1,requireExternalConsent:false,signal:modelAbortController.signal,
        transport:config.provider==="hosted"?async({signal})=>({
          text:await invokeHostedBroker(messages,config,signal),provider:"hosted",model:config.model
        }):undefined,
        onEvent:event=>{
          if(!modelConsole)return;
          const labels={connecting:"Connecting to the shared model runtime…",generating:"The model is generating…",validating:"Validating structured output…",repairing:"Repairing the model's JSON contract…"};
          if(labels[event.phase])modelConsole.textContent=labels[event.phase];
        }
      });
      modelAbortController=null;
      state.modelRuntime={
        ...(state.modelRuntime||{}),tested:true,ready:result.status==="success"||result.status==="fallback",
        route:result.actual?.provider||provider,lastTestAt:new Date().toISOString(),
        message:runtimeApi.resultLabel(result),lastResult:{
          status:result.status,provider:result.actual?.provider,model:result.actual?.model,
          streamed:result.stream?.used,repairAttempts:result.structured?.repairAttempts,
          fallback:result.fallback?.used,error:result.error?.message||null
        }
      };
      if(["success","fallback"].includes(result.status))return result.outputText;
      if(result.status==="manual-required")throw new Error("Manual mode prepared the prompt. Paste the response into Living School.");
      throw new Error(result.error?.message||`Model request ended with ${result.status}.`);
    }

    function parseToolArguments(value) {
      if(value==null) return {};
      if(typeof value==="string"){
        try{return JSON.parse(value);}catch{return {};}
      }
      return typeof value==="object"?value:{};
    }

    function compactSchoolForTool(school) {
      return {
        id:school.id,title:school.title,subtitle:school.subtitle,subject:school.subject,description:school.description,
        sourceNote:school.sourceNote,inputHash:school.inputHash,safetySensitive:Boolean(school.safetySensitive),
        modules:(school.modules||[]).map(module=>({
          id:module.id,title:module.title,kicker:module.kicker,domain:module.domain,summary:module.summary,
          objectives:module.objectives,paragraphs:module.paragraphs,concepts:module.concepts,quiz:module.quiz,
          blocks:module.blocks,completion:module.completion,structureMode:module.structureMode,
          exercise:module.exercise,visualization:module.visualization,safetyNotice:module.safetyNotice,
          evidenceRefs:module.evidenceRefs||[],claimLedger:module.claimLedger||[],sourceRefs:module.sourceRefs||[]
        }))
      };
    }

    function compileDeterministicForTool(args,requestContext) {
      const subject=String(args.subject||requestContext.subject);
      const count=Math.max(1,Math.min(12,Number(args.moduleCount||requestContext.moduleCount)));
      const difficulty=String(args.difficulty||requestContext.difficulty);
      const mode=String(args.mode||requestContext.mode);
      const tone=String(args.tone||requestContext.tone);
      const school=generateSchool(subject,requestContext.notes,count,difficulty,mode,tone);
      const strategy=String(args.visualizationStrategy||"varied");
      const varied=["network","flow","timeline","cycle","comparison","matrix","tree"];
      school.modules.forEach((module,index)=>{
        const preferred=strategy==="varied"?varied[index%varied.length]:strategy;
        module.visualization=buildVisualization(module,index,preferred);
      });
      return school;
    }

    function resolveToolModule(args,requestContext,toolState) {
      if(args.module&&typeof args.module==="object") return args.module;
      const schools=[toolState.deterministicSchool,requestContext.currentSchool,requestContext.baseSchool].filter(Boolean);
      for(const school of schools){
        const found=(school.modules||[]).find(module=>module.id===args.moduleId||module.title===args.moduleTitle);
        if(found) return found;
      }
      throw new Error("The requested module was not available to the deterministic tool.");
    }

    function auditSchoolTool(school,requestContext) {
      const warnings=[];
      if(!school||!Array.isArray(school.modules)||!school.modules.length) warnings.push("School contains no modules.");
      const types=new Set();
      (school?.modules||[]).forEach((module,index)=>{
        if(!module.title) warnings.push(`Module ${index+1} has no title.`);
        if(module.structureMode!=="model-native"&&(!Array.isArray(module.quiz)||!module.quiz.length)) warnings.push(`Module ${index+1} has no quiz.`);
        const moduleVisualizations=module.structureMode==="model-native"
          ? (module.blocks||[]).filter(block=>block.type==="visualization").map(block=>block.visualization?.type).filter(Boolean)
          : [module.visualization?.type||"network"];
        moduleVisualizations.forEach(type=>{
          types.add(type);
          if(!VISUALIZATION_TYPES.has(type)) warnings.push(`Module ${index+1} uses unsupported visualization type ${type}.`);
        });
        if(requestContext.sourceContext.safetySensitive&&!module.safetyNotice&&!/safety|hazard|legal/i.test(module.title||"")) warnings.push(`Module ${index+1} lacks a safety notice.`);
      });
      if((school?.modules||[]).length>=4&&types.size<2) warnings.push("Curriculum uses fewer than two visualization types.");
      return {ok:warnings.length===0,warnings,visualizationTypes:[...types],moduleCount:school?.modules?.length||0};
    }

    async function executeDeterministicTool(call,requestContext,toolState) {
      const name=String(call?.name||"");
      const args=parseToolArguments(call?.arguments);
      if(name==="source.analyze"){
        const max=Math.max(1,Math.min(160,Number(args.maxClaims||80)));
        return {...requestContext.sourceContext,claims:args.includeClaims===false?[]:requestContext.sourceContext.claims.slice(0,max)};
      }
      if(name==="curriculum.compile"){
        const school=compileDeterministicForTool(args,requestContext);
        toolState.deterministicSchool=school;
        return compactSchoolForTool(school);
      }
      if(name==="module.compile"){
        const parsed=parseDataDump(requestContext.notes||"");
        const ids=new Set(Array.isArray(args.claimIds)?args.claimIds.map(String):[]);
        let section=args.sectionTitle?parsed.sections.find(item=>item.title.toLowerCase()===String(args.sectionTitle).toLowerCase()):null;
        if(!section&&ids.size) section={title:String(args.title||"Compiled module"),claims:parsed.claims.filter(claim=>ids.has(claim.id))};
        if(!section) section=parsed.sections[0]||{title:String(args.title||"Compiled module"),claims:[]};
        const module=buildModuleFromSection({...section,title:String(args.title||section.title)},0,requestContext.subject,parsed,String(args.difficulty||requestContext.difficulty),String(args.mode||requestContext.mode));
        module.visualization=buildVisualization(module,0,String(args.visualizationType||"auto"));
        toolState.modules[module.id]=module;
        return module;
      }
      if(name==="assessment.build_quiz"){
        const module=resolveToolModule(args,requestContext,toolState);
        return deterministicQuiz(module,0,requestContext.sourceContext.claims.map(claim=>claim.text)).slice(0,Math.max(1,Math.min(6,Number(args.questionCount||3))));
      }
      if(name==="visualization.build"){
        const module=resolveToolModule(args,requestContext,toolState);
        return buildVisualization(module,0,String(args.type||"auto"));
      }
      if(name==="safety.build_module"){
        const parsed=parseDataDump(requestContext.notes||"");
        const module=buildSafetyModule(requestContext.subject,parsed);
        if(args.title) module.title=String(args.title);
        toolState.modules[module.id]=module;
        return module;
      }
      if(name==="curriculum.audit") return auditSchoolTool(args.school||toolState.deterministicSchool||requestContext.currentSchool,requestContext);
      throw new Error(`Unknown deterministic tool: ${name}`);
    }

    async function executeDeterministicToolCalls(calls,requestContext,toolState) {
      const results=[];
      for(const call of calls.slice(0,12)){
        const started=performance.now();
        try{
          const output=await executeDeterministicTool(call,requestContext,toolState);
          results.push({id:String(call.id||`call-${results.length+1}`),name:String(call.name),ok:true,output,durationMs:Math.round(performance.now()-started)});
        } catch(error){
          results.push({id:String(call.id||`call-${results.length+1}`),name:String(call.name),ok:false,error:error.message,durationMs:Math.round(performance.now()-started)});
        }
      }
      return results;
    }

    function isToolRequest(payload) {
      return payload?.schema===MODEL_TOOL_REQUEST_SCHEMA || Array.isArray(payload?.toolCalls);
    }

    async function invokeModelToolLoop(messages,config,requestContext) {
      const working=[...messages];
      const trace=[];
      const toolState={deterministicSchool:null,modules:{}};
      let totalCharacters=0;
      let automaticHybridToolUsed=false;
      for(let round=0;round<=config.maxToolRounds;round++){
        setModelStatus(`Model round ${round+1}: ${trace.length} deterministic tool call(s) completed...`);
        const responseText=await invokeLanguageModel(working,config);
        totalCharacters+=responseText.length;
        const payload=parseModelJSON(responseText);

        if(config.toolsEnabled&&isToolRequest(payload)){
          const calls=Array.isArray(payload.toolCalls)?payload.toolCalls:[];
          if(!calls.length) throw new Error("The model returned a tool request with no calls.");
          const results=await executeDeterministicToolCalls(calls,requestContext,toolState);
          trace.push(...results.map(result=>({round:round+1,...result})));
          working.push({role:"assistant",content:JSON.stringify(payload)});
          working.push({role:"user",content:JSON.stringify({
            schema:MODEL_TOOL_RESULT_SCHEMA,
            results,
            instruction:"Use these deterministic results to continue. You may request more tools or return the final curriculum JSON."
          })});
          continue;
        }

        if(config.toolsEnabled&&config.engine==="hybrid"&&requestContext.sourceContext.hasGrounding&&!trace.length&&!automaticHybridToolUsed){
          automaticHybridToolUsed=true;
          const synthetic={id:"automatic-hybrid-base",name:"curriculum.compile",arguments:{moduleCount:requestContext.moduleCount,visualizationStrategy:"varied"}};
          const results=await executeDeterministicToolCalls([synthetic],requestContext,toolState);
          trace.push(...results.map(result=>({round:round+1,automatic:true,...result})));
          working.push({role:"assistant",content:responseText});
          working.push({role:"user",content:JSON.stringify({
            schema:MODEL_TOOL_RESULT_SCHEMA,
            results,
            instruction:"Hybrid mode requires use of the deterministic compiler. Revise your proposed school using this tool result, then return final curriculum JSON."
          })});
          continue;
        }

        return {payload,responseText,toolTrace:trace,toolState,totalCharacters,rounds:round+1};
      }
      throw new Error(`The model exceeded ${config.maxToolRounds} deterministic tool rounds without returning a final school.`);
    }


    const MODEL_NATIVE_BLOCK_TYPES=new Set([
      "heading","prose","list","steps","quote","callout","table","concepts",
      "scenario","visualization","quiz","exercise","checklist","code","divider"
    ]);

    function normalizeAssessmentText(value,caseSensitive=false,ignorePunctuation=true){
      let text=String(value??"").normalize("NFKC").trim();
      if(ignorePunctuation) text=text.replace(/[^\p{L}\p{N}\s'-]/gu," ");
      text=text.replace(/\s+/g," ").trim();
      if(!caseSensitive) text=text.toLocaleLowerCase();
      return text;
    }

    function wordCount(value){
      const normalized=normalizeAssessmentText(value,false);
      return normalized?normalized.split(/\s+/).filter(Boolean).length:0;
    }

    function normalizeShortAnswerValidation(raw){
      const requestedMode=String(raw?.mode||"").toLowerCase();
      const mode=["exact","keywords","reflection"].includes(requestedMode)
        ? requestedMode
        : (Array.isArray(raw?.acceptableAnswers)&&raw.acceptableAnswers.length?"exact"
          : Array.isArray(raw?.requiredKeywords)&&raw.requiredKeywords.length?"keywords"
          : "reflection");
      const caseSensitive=Boolean(raw?.caseSensitive);
      const ignorePunctuation=raw?.ignorePunctuation!==false;
      const acceptableAnswers=(Array.isArray(raw?.acceptableAnswers)?raw.acceptableAnswers:[])
        .map(String).map(item=>item.trim()).filter(Boolean).slice(0,20);
      const requiredKeywords=(Array.isArray(raw?.requiredKeywords)?raw.requiredKeywords:[])
        .map(String).map(item=>item.trim()).filter(Boolean).slice(0,30);
      const minimumKeywordMatches=Math.max(
        1,
        Math.min(requiredKeywords.length||1,Number(raw?.minimumKeywordMatches||1))
      );
      const authoredEnforcement=["strict","guidance"].includes(raw?.enforcement)
        ? raw.enforcement
        : mode==="exact"?"strict":"guidance";
      const minWords=Math.max(0,Math.min(500,Number(raw?.minWords||0)));
      const maxWords=Math.max(minWords||0,Math.min(1000,Number(raw?.maxWords||250)));
      const rawCriteria=Array.isArray(raw?.criteria)?raw.criteria:Array.isArray(raw?.rubric)?raw.rubric:[];
      const criteria=rawCriteria.slice(0,8).map((item,index)=>{
        if(typeof item==="string")return{id:`criterion-${index+1}`,label:item,description:item,points:2,cues:keywords(item,5),feedback:`Explain how the response satisfies: ${item}.`};
        const label=String(item?.label||item?.description||`Criterion ${index+1}`).slice(0,180);
        return{id:String(item?.id||`criterion-${index+1}`).slice(0,80),label,description:String(item?.description||label).slice(0,400),points:Math.max(1,Math.min(5,Number(item?.points||2))),cues:(Array.isArray(item?.cues)?item.cues:keywords(label,5)).map(String).slice(0,8),examples:(Array.isArray(item?.examples)?item.examples:[]).map(String).slice(0,5),feedback:String(item?.feedback||`Strengthen ${label.toLowerCase()} with a concrete explanation.`).slice(0,500)};
      });
      return {
        mode,
        enforcement:authoredEnforcement,
        caseSensitive,
        ignorePunctuation,
        acceptableAnswers,
        requiredKeywords,
        minimumKeywordMatches,
        minWords,
        maxWords,
        criteria,
        allowModelAssist:raw?.allowModelAssist!==false,
        feedback:String(raw?.feedback||"").slice(0,1200)
      };
    }

    function normalizeLooseQuizQuestion(question,index){
      if(!question||typeof question!=="object") return null;

      const requestedType=String(question.type||question.kind||question.questionType||"").toLowerCase();
      const hasChoices=Array.isArray(question.answers)||Array.isArray(question.options)||Array.isArray(question.choices);
      const type=requestedType==="multiple-select"||requestedType==="multiple_select"||requestedType==="checkbox"
        ? "multiple-select"
        : requestedType==="short-answer"||
          requestedType==="short_answer"||
          requestedType==="text"||
          requestedType==="reflection"||
          (!hasChoices&&requestedType!=="multiple-choice"&&requestedType!=="multiple_choice")
            ? "short-answer"
            : "multiple-choice";

      if(type==="short-answer"){
        const rawValidation={
          ...(question.answerValidation||{}),
          ...(question.validation||{})
        };
        if(rawValidation.enforcement===undefined&&question.enforcement!==undefined) rawValidation.enforcement=question.enforcement;
        if(rawValidation.minWords===undefined&&question.minWords!==undefined) rawValidation.minWords=question.minWords;
        if(rawValidation.maxWords===undefined&&question.maxWords!==undefined) rawValidation.maxWords=question.maxWords;
        if(rawValidation.caseSensitive===undefined&&question.caseSensitive!==undefined) rawValidation.caseSensitive=question.caseSensitive;
        if(rawValidation.ignorePunctuation===undefined&&question.ignorePunctuation!==undefined) rawValidation.ignorePunctuation=question.ignorePunctuation;
        if(rawValidation.feedback===undefined&&(question.validationFeedback||question.feedback)) rawValidation.feedback=question.validationFeedback||question.feedback;

        if(!rawValidation.mode){
          if(Array.isArray(question.acceptableAnswers)||Array.isArray(question.acceptedAnswers)){
            rawValidation.mode="exact";
            rawValidation.acceptableAnswers=question.acceptableAnswers||question.acceptedAnswers;
          }else if(Array.isArray(question.requiredKeywords)||Array.isArray(question.requiredIdeas)){
            rawValidation.mode="keywords";
            rawValidation.requiredKeywords=question.requiredKeywords||question.requiredIdeas;
            rawValidation.minimumKeywordMatches=
              question.minimumKeywordMatches??question.minimumIdeaMatches??1;
          }else if(typeof question.answer==="string"&&question.answer.trim()){
            rawValidation.mode="exact";
            rawValidation.acceptableAnswers=[question.answer];
          }else{
            rawValidation.mode="reflection";
          }
        }

        return {
          id:String(question.id||`short-answer-${index+1}`),
          type,
          prompt:String(question.prompt||question.question||question.text||"").trim(),
          validation:normalizeShortAnswerValidation(rawValidation),
          explanation:String(question.explanation||question.feedback||""),
          placeholder:String(question.placeholder||"Write a concise answer in your own words."),
          evidenceRefs:Array.isArray(question.evidenceRefs)?question.evidenceRefs.map(String):[]
        };
      }

      const rawAnswers=Array.isArray(question.answers)
        ? question.answers
        : Array.isArray(question.options)
          ? question.options
          : Array.isArray(question.choices)
            ? question.choices
            : [];
      const answers=rawAnswers.map(answer=>
        typeof answer==="string"
          ? answer
          : String(answer?.label??answer?.text??answer?.answer??"")
      ).filter(Boolean).slice(0,12);

      if(type==="multiple-select"){
        const rawCorrect=question.correctIndices||question.correctAnswers||question.answersCorrect||[];
        const correctIndices=(Array.isArray(rawCorrect)?rawCorrect:[]).map(item=>{
          if(Number.isInteger(Number(item)))return Number(item);
          const normalized=normalizeAssessmentText(item,false,true);
          return answers.findIndex(answer=>normalizeAssessmentText(answer,false,true)===normalized);
        }).filter(index=>index>=0&&index<answers.length);
        return {id:String(question.id||`multiple-select-${index+1}`),type,prompt:String(question.prompt||question.question||question.text||"").trim(),answers,correctIndices:[...new Set(correctIndices)],explanation:String(question.explanation||question.feedback||""),evidenceRefs:Array.isArray(question.evidenceRefs)?question.evidenceRefs.map(String):[]};
      }

      let correct=question.correct??question.correctIndex??question.answerIndex??null;
      if(typeof correct==="string"&&!/^\d+$/.test(correct.trim())){
        const normalizedCorrect=normalizeAssessmentText(correct,false,true);
        const matchedIndex=answers.findIndex(answer=>
          normalizeAssessmentText(answer,false,true)===normalizedCorrect
        );
        correct=matchedIndex>=0?matchedIndex:null;
      }else if(correct!==null&&correct!==undefined&&correct!==""){
        const numeric=Number(correct);
        correct=Number.isInteger(numeric)?numeric:null;
      }else{
        correct=null;
      }

      return {
        id:String(question.id||`multiple-choice-${index+1}`),
        type,
        prompt:String(question.prompt||question.question||question.text||"").trim(),
        answers,
        correct,
        explanation:String(question.explanation||question.feedback||""),
        evidenceRefs:Array.isArray(question.evidenceRefs)?question.evidenceRefs.map(String):[]
      };
    }

    function effectiveShortAnswerEnforcement(question){
      ensureAssessmentState();
      const rule=question.validation||{};
      if(rule.mode==="exact") return "strict";
      if(rule.mode==="reflection") return "guidance";
      if(state.assessment.policy==="strict") return "strict";
      if(state.assessment.policy==="learner-first") return "guidance";
      return rule.enforcement==="strict"?"strict":"guidance";
    }

    function shortAnswerCriteriaForQuestion(question){
      const rule=question.validation||{};
      if(Array.isArray(rule.criteria)&&rule.criteria.length)return rule.criteria;
      const criteria=[];
      if((rule.requiredKeywords||[]).length)criteria.push({id:"principle",label:"Relevant principle",description:"Identifies and explains a relevant principle in the learner’s own words.",points:2,cues:rule.requiredKeywords,feedback:"Name the relevant principle and explain it rather than listing terms."});
      criteria.push({id:"response",label:"Addresses the prompt",description:question.prompt||"Answers the actual question.",points:2,cues:keywords(question.prompt||"",6),feedback:"Answer the specific question rather than offering adjacent information."});
      criteria.push({id:"reasoning",label:"Explanation or application",description:"Explains why the answer is defensible, applies it to the scenario, or gives a concrete example.",points:2,cues:["because","therefore","example","apply","would","result","evidence","decision"],feedback:"Add a concrete explanation, application, consequence, example, or evidence."});
      return criteria;
    }

    function shortAnswerRuleDescription(question){
      const rule=question.validation||{};
      const limits=[];
      if(rule.minWords) limits.push(`at least ${rule.minWords} words`);
      if(rule.maxWords) limits.push(`at most ${rule.maxWords} words`);
      if(rule.mode==="exact"){
        limits.push(`${rule.acceptableAnswers.length} accepted answer${rule.acceptableAnswers.length===1?"":"s"} · objective`);
      } else {
        const count=shortAnswerCriteriaForQuestion(question).length;
        limits.push(`${count} visible rubric criteria · explanation required`);
        if(rule.allowModelAssist!==false)limits.push("model assist when configured");
      }
      return limits.join(" · ")||"Open response";
    }

    function fallbackRubricEvaluation(question,response){
      const rule=question.validation||{};const text=String(response||"").trim();const count=wordCount(text);const failures=[];
      if(!text)failures.push("Answer is blank.");if(rule.minWords&&count<rule.minWords)failures.push(`Use at least ${rule.minWords} words.`);if(rule.maxWords&&count>rule.maxWords)failures.push(`Use no more than ${rule.maxWords} words.`);
      const normalized=normalizeAssessmentText(text,false,true),prompt=normalizeAssessmentText(question.prompt||"",false,true);
      if(prompt&&normalized===prompt)failures.push("Answer the question instead of repeating it.");
      if(/\b(lorem ipsum|asdf|qwerty|blah blah|idk|whatever)\b/i.test(text))failures.push("Remove filler and give a substantive answer.");
      const criteria=shortAnswerCriteriaForQuestion(question).map(item=>{const cues=(item.cues||[]).filter(cue=>normalized.includes(normalizeAssessmentText(cue,false,true)));const explained=/\b(because|therefore|so that|would|will|example|evidence|result|consequence|decision|apply|use)\b/i.test(text);const overlap=keywords(`${item.label} ${item.description}`,6).filter(token=>normalized.includes(token));const met=(cues.length||overlap.length)&&explained;return{id:item.id,label:item.label,points:Number(item.points||2),earned:met?Number(item.points||2):cues.length||overlap.length?Number(item.points||2)/2:0,met,feedback:met?`The response addresses ${item.label.toLowerCase()}.`:item.feedback};});
      const possible=criteria.reduce((sum,item)=>sum+item.points,0)||1,earned=criteria.reduce((sum,item)=>sum+item.earned,0),score=Math.round(earned/possible*100);return{ok:!failures.length&&score>=60,uncertain:!failures.length&&score>=45&&score<60,score,criteria,structuralIssues:failures,qualityIssues:[],feedback:failures.join(" ")||rule.feedback||question.explanation||"Revise the criteria marked below.",authority:"deterministic-rubric-assisted",wordCount:count};
    }

    function validateShortAnswer(question,response){
      ensureAssessmentState();
      const rule=question.validation||{};
      const text=String(response||"").trim();
      if(rule.mode==="exact"){
        const normalized=normalizeAssessmentText(text,rule.caseSensitive,rule.ignorePunctuation!==false);
        const accepted=(rule.acceptableAnswers||[]).map(answer=>normalizeAssessmentText(answer,rule.caseSensitive,rule.ignorePunctuation!==false));
        const failures=[];if(!text)failures.push("Answer is blank.");if(rule.minWords&&wordCount(text)<rule.minWords)failures.push(`Use at least ${rule.minWords} words.`);if(rule.maxWords&&wordCount(text)>rule.maxWords)failures.push(`Use no more than ${rule.maxWords} words.`);if(text&&!accepted.includes(normalized))failures.push("The answer does not match an accepted objective response.");
        return{ok:failures.length===0,failures,advisories:[],words:wordCount(text),matchedKeywords:[],enforcement:"strict",criteria:[],score:failures.length?0:100,authority:"deterministic-objective",feedback:rule.feedback||question.explanation||"Review the lesson and try again."};
      }
      const engine=window.LivingSchoolModules?.rubricEngine;
      const currentModule=moduleById(question.moduleId)||state.school?.modules?.[currentLearningIndex()]||null;
      const lessonExcerpt=question.lessonExcerpt||[currentModule?.title,currentModule?.summary,...(currentModule?.objectives||[]).slice(0,4)].filter(Boolean).join("\n");
      const evaluation=engine?.evaluateShortAnswer?engine.evaluateShortAnswer({prompt:question.prompt,response:text,criteria:shortAnswerCriteriaForQuestion(question),minWords:rule.minWords||8,maxWords:rule.maxWords||250,requiredElements:rule.requiredKeywords||[],lessonExcerpt}):fallbackRubricEvaluation(question,text);
      const failures=[...(evaluation.structuralIssues||[]),...(evaluation.qualityIssues||[])];
      const advisories=[];
      if(evaluation.uncertain)advisories.push("This deterministic score is uncertain. Revise it or request human/model review before treating it as high-stakes evidence.");
      return{ok:Boolean(evaluation.ok),failures,advisories,words:evaluation.wordCount??wordCount(text),wordCount:evaluation.wordCount??wordCount(text),matchedKeywords:evaluation.criteria?.flatMap(item=>item.signals?.cueMatches||[])||[],enforcement:"rubric",criteria:evaluation.criteria||[],score:Number(evaluation.score||0),points:Number(evaluation.points||0),possible:Number(evaluation.possible||0),authority:evaluation.authority||"deterministic-rubric-assisted",uncertain:Boolean(evaluation.uncertain),needsReview:Boolean(evaluation.needsReview),confidence:Number(evaluation.confidence||0),structuralIssues:evaluation.structuralIssues||[],qualityIssues:evaluation.qualityIssues||[],feedback:evaluation.feedback||rule.feedback||question.explanation||"Review the rubric and try again."};
    }

    function normalizeNativeConcept(concept,index){
      if(Array.isArray(concept)){
        return {term:String(concept[0]||""),definition:String(concept[1]||""),evidenceRefs:[],provenance:"model-synthesis"};
      }
      if(!concept||typeof concept!=="object") return null;
      return {
        term:String(concept.term||concept.title||""),
        definition:String(concept.definition||concept.body||""),
        evidenceRefs:Array.isArray(concept.evidenceRefs)?concept.evidenceRefs.map(String):[],
        provenance:String(concept.provenance||"model-synthesis")
      };
    }

    function normalizeModelBlock(block,index,moduleContext){
      if(!block||typeof block!=="object") return null;
      const type=MODEL_NATIVE_BLOCK_TYPES.has(block.type)?block.type:null;
      if(!type) return null;
      const id=String(block.id||`block-${index+1}`);
      const common={id,type,title:String(block.title||"")};

      if(type==="heading") return {...common,level:Math.max(2,Math.min(4,Number(block.level||3))),text:String(block.text||block.title||"")};
      if(type==="prose"){
        const paragraphs=Array.isArray(block.paragraphs)?block.paragraphs.map(String).filter(Boolean).slice(0,40):[String(block.text||block.content||"")].filter(Boolean);
        return {...common,paragraphs};
      }
      if(type==="list") return {...common,ordered:Boolean(block.ordered),items:(Array.isArray(block.items)?block.items:[]).map(String).slice(0,40)};
      if(type==="steps"){
        return {...common,items:(Array.isArray(block.items)?block.items:[]).slice(0,30).map((item,itemIndex)=>typeof item==="string"
          ? {title:`Step ${itemIndex+1}`,body:item}
          : {title:String(item?.title||`Step ${itemIndex+1}`),body:String(item?.body||item?.text||"")})};
      }
      if(type==="quote") return {...common,text:String(block.text||""),attribution:String(block.attribution||block.cite||"")};
      if(type==="callout") return {...common,tone:["info","warning","success","note"].includes(block.tone)?block.tone:"info",body:String(block.body||block.text||"")};
      if(type==="table"){
        const columns=(Array.isArray(block.columns)?block.columns:[]).slice(0,16).map((column,columnIndex)=>typeof column==="string"
          ? {key:`column-${columnIndex}`,label:column}
          : {key:String(column?.key||`column-${columnIndex}`),label:String(column?.label||column?.key||`Column ${columnIndex+1}`)});
        const rows=(Array.isArray(block.rows)?block.rows:[]).slice(0,100).map(row=>{
          const mapped={};
          columns.forEach((column,columnIndex)=>mapped[column.key]=String(Array.isArray(row)?row[columnIndex]??"":row?.[column.key]??""));
          return mapped;
        });
        return {...common,columns,rows};
      }
      if(type==="concepts") return {...common,items:(Array.isArray(block.items)?block.items:[]).map(normalizeNativeConcept).filter(Boolean).slice(0,30)};
      if(type==="scenario"){
        return {...common,setup:String(block.setup||block.body||""),choices:(Array.isArray(block.choices)?block.choices:[]).slice(0,20).map(choice=>({label:String(choice?.label||""),consequence:String(choice?.consequence||choice?.detail||"")}))};
      }
      if(type==="visualization"){
        const spec=block.visualization||block.spec||block;
        return {...common,visualization:spec?.type==="custom"?normalizeCustomVisualization(spec,moduleContext,index):normalizeVisualization(spec,moduleContext,index)};
      }
      if(type==="quiz"){
        return {...common,completionGate:Boolean(block.completionGate),questions:(Array.isArray(block.questions)?block.questions:block.quiz||[]).map(normalizeLooseQuizQuestion).filter(Boolean).slice(0,20)};
      }
      if(type==="exercise"){
        const exercise=block.exercise||block;
        return {...common,exercise:{title:String(exercise.title||""),prompt:String(exercise.prompt||exercise.body||""),rubric:(Array.isArray(exercise.rubric)?exercise.rubric:[]).map(String).slice(0,20)}};
      }
      if(type==="checklist") return {...common,completionGate:Boolean(block.completionGate),items:(Array.isArray(block.items)?block.items:[]).map(String).slice(0,40)};
      if(type==="code") return {...common,language:String(block.language||"text"),code:String(block.code||block.text||"").slice(0,30000)};
      return {...common};
    }

    function legacyFieldsToNativeBlocks(module){
      const blocks=[];
      if(Array.isArray(module.objectives)&&module.objectives.length) blocks.push({type:"list",title:"Learning objectives",items:module.objectives});
      if(Array.isArray(module.paragraphs)&&module.paragraphs.length) blocks.push({type:"prose",paragraphs:module.paragraphs});
      if(Array.isArray(module.concepts)&&module.concepts.length) blocks.push({type:"concepts",title:"Concepts",items:module.concepts});
      if(module.scenario) blocks.push({type:"scenario",...module.scenario});
      if(module.visualization) blocks.push({type:"visualization",visualization:module.visualization});
      if(Array.isArray(module.quiz)&&module.quiz.length) blocks.push({type:"quiz",questions:module.quiz,completionGate:true});
      if(module.exercise) blocks.push({type:"exercise",exercise:module.exercise});
      return blocks;
    }

    function normalizeModelNativeModule(module,index,context){
      const allowedDomains=new Set(Object.keys(domains));
      const rawBlocks=Array.isArray(module?.blocks)?module.blocks:legacyFieldsToNativeBlocks(module||{});
      const shell={
        id:String(module?.id||`module-${index+1}-${slug(module?.title||`module-${index+1}`)}-${context.inputHash?.slice(0,5)||"model"}`),
        title:String(module?.title||module?.navLabel||`Module ${index+1}`),
        navLabel:String(module?.navLabel||module?.title||`Module ${index+1}`),
        group:String(module?.group||""),
        kicker:String(module?.kicker||""),
        domain:allowedDomains.has(module?.domain)?module.domain:"subjectPractice",
        summary:String(module?.summary||""),
        blocks:[],
        structureMode:"model-native",
        completion:module?.completion&&typeof module.completion==="object"
          ? {
              type:["manual","quiz","checklist","artifact","none"].includes(module.completion.type)?module.completion.type:"manual",
              label:String(module.completion.label||""),
              instructions:String(module.completion.instructions||""),
              blockId:module.completion.blockId?String(module.completion.blockId):null
            }
          : {type:"manual",label:"Mark module complete",instructions:""},
        badge:module?.badge&&typeof module.badge==="object"
          ? {
              id:String(module.badge.id||`badge-${slug(module.badge.name||module.title||`module-${index+1}`)}`),
              name:String(module.badge.name||module.title||`Module ${index+1}`),
              description:String(module.badge.description||""),
              domain:allowedDomains.has(module.badge.domain)?module.badge.domain:(allowedDomains.has(module.domain)?module.domain:"subjectPractice"),
              criteriaVersion:String(module.badge.criteriaVersion||"1.0.0")
            }
          : null,
        xp:Number.isFinite(Number(module?.xp))?Math.max(0,Math.min(1000,Number(module.xp))):0,
        safetyNotice:String(module?.safetyNotice||""),
        evidenceRefs:Array.isArray(module?.evidenceRefs)?module.evidenceRefs.map(String):[],
        claimLedger:[],
        sourceRefs:[],
        sourceConfidence:"model-generated",
        provenance:`language-model · ${context.provider} · ${context.model}`,
        modelMeta:{provider:context.provider,model:context.model,generatedAt:new Date().toISOString(),freedom:context.freedom,structureMode:"model-native"}
      };
      shell.blocks=rawBlocks.slice(0,80).map((block,blockIndex)=>normalizeModelBlock(block,blockIndex,shell)).filter(Boolean);
      return shell;
    }

    function finalizeModelNativeSchool(school){
      school.structureMode="model-native";
      school.modules=(school.modules||[]).map((module,index)=>({
        ...module,
        id:module.id||`module-${index+1}-${slug(module.title||`module-${index+1}`)}`,
        navLabel:module.navLabel||module.title||`Module ${index+1}`,
        structureMode:"model-native",
        blocks:Array.isArray(module.blocks)?module.blocks:[],
        completion:module.completion||{type:"manual",label:"Mark module complete",instructions:""},
        xp:Number.isFinite(Number(module.xp))?Number(module.xp):0,
        provenance:module.provenance||school.sourceNote||"language model"
      }));
      return school;
    }

    function normalizeConcept(concept,index) {
      if(Array.isArray(concept)){
        return {
          term:String(concept[0]||`Concept ${index+1}`),
          definition:String(concept[1]||""),
          evidenceRefs:[],
          provenance:"model-synthesis"
        };
      }
      return {
        term:String(concept?.term||`Concept ${index+1}`),
        definition:String(concept?.definition||""),
        evidenceRefs:Array.isArray(concept?.evidenceRefs)?concept.evidenceRefs.map(String):[],
        provenance:String(concept?.provenance||"model-synthesis")
      };
    }

    function normalizeQuizQuestion(question,index) {
      const answers=Array.isArray(question?.answers)?question.answers.map(String).slice(0,6):[];
      while(answers.length<3) answers.push(`Alternative ${answers.length+1}`);
      const correct=Math.max(0,Math.min(answers.length-1,Number(question?.correct||0)));
      return {
        prompt:String(question?.prompt||`Question ${index+1}`),
        answers,
        correct,
        explanation:String(question?.explanation||answers[correct]),
        evidenceRefs:Array.isArray(question?.evidenceRefs)?question.evidenceRefs.map(String):[]
      };
    }

    function normalizeModelModule(module,index,context,baseModule=null) {
      const allowedDomains=new Set(Object.keys(domains));
      const concepts=(Array.isArray(module?.concepts)?module.concepts:[]).map(normalizeConcept).slice(0,8);
      while(concepts.length<3){
        concepts.push({
          term:`Concept ${concepts.length+1}`,
          definition:"The model did not provide a complete definition.",
          evidenceRefs:[],
          provenance:"validation-repair"
        });
      }
      const normalized={
        id:baseModule?.id || `module-${index+1}-${slug(module?.title||`module-${index+1}`)}-${context.inputHash?.slice(0,5)||"model"}`,
        title:String(module?.title||`Module ${index+1}`),
        kicker:String(module?.kicker||"Model-generated module"),
        domain:allowedDomains.has(module?.domain)?module.domain:(baseModule?.domain||"subjectPractice"),
        summary:String(module?.summary||""),
        objectives:(Array.isArray(module?.objectives)?module.objectives:[]).map(String).filter(Boolean).slice(0,8),
        paragraphs:(Array.isArray(module?.paragraphs)?module.paragraphs:[]).map(String).filter(Boolean).slice(0,12),
        concepts:concepts.map(item=>[item.term,item.definition]),
        conceptMetadata:concepts,
        quiz:(Array.isArray(module?.quiz)?module.quiz:[]).map(normalizeQuizQuestion).slice(0,6),
        exercise:{
          title:String(module?.exercise?.title||"Applied learning artifact"),
          prompt:String(module?.exercise?.prompt||"Create an artifact demonstrating the module objectives."),
          rubric:(Array.isArray(module?.exercise?.rubric)?module.exercise.rubric:[]).map(String).filter(Boolean).slice(0,10)
        },
        scenario:module?.scenario&&typeof module.scenario==="object"?{
          title:String(module.scenario.title||"Practice scenario"),
          setup:String(module.scenario.setup||""),
          choices:(Array.isArray(module.scenario.choices)?module.scenario.choices:[]).map(choice=>({
            label:String(choice?.label||"Choice"),
            consequence:String(choice?.consequence||"")
          })).slice(0,6)
        }:null,
        badge:{
          id:baseModule?.badge?.id || `badge-${slug(module?.badge?.name||module?.title||`module-${index+1}`)}`,
          name:String(module?.badge?.name||module?.title||`Module ${index+1}`),
          description:String(module?.badge?.description||`Completed ${module?.title||`Module ${index+1}`}.`),
          domain:allowedDomains.has(module?.badge?.domain)?module.badge.domain:(allowedDomains.has(module?.domain)?module.domain:"subjectPractice"),
          criteriaVersion:"1.0.0"
        },
        safetyNotice:String(module?.safetyNotice||baseModule?.safetyNotice||""),
        evidenceRefs:Array.isArray(module?.evidenceRefs)?module.evidenceRefs.map(String):[],
        claimLedger:baseModule?.claimLedger||[],
        sourceRefs:baseModule?.sourceRefs||[],
        sourceConfidence:baseModule?.sourceConfidence||"model-generated",
        provenance:`language-model · ${context.provider} · ${context.model}`,
        modelMeta:{
          provider:context.provider,
          model:context.model,
          generatedAt:new Date().toISOString(),
          freedom:context.freedom
        },
        xp:baseModule?.xp || (index===context.requestedCount-1?35:15)
      };
      while(normalized.objectives.length<2) normalized.objectives.push("Explain and apply the central ideas in this module.");
      while(normalized.paragraphs.length<2) normalized.paragraphs.push("This section requires further elaboration or source support.");
      while(normalized.exercise.rubric.length<3) normalized.exercise.rubric.push("Uses clear evidence and reflection.");
      if(!normalized.quiz.length) normalized.quiz=deterministicQuiz(normalized,index,context.claimTexts);
      normalized.visualization=normalizeVisualization(module?.visualization||baseModule?.visualization,normalized,index);
      return normalized;
    }


    function validateModelNativeAssessments(school,warnings){
      const blockingErrors=[];
      (school.modules||[]).forEach((module,moduleIndex)=>{
        const quizzes=(module.blocks||[]).filter(block=>block.type==="quiz");
        if(!quizzes.length){
          blockingErrors.push(`Module ${moduleIndex+1} "${module.title}" has no quiz block.`);
          return;
        }

        const questions=quizzes.flatMap(block=>block.questions||[]);
        const shortAnswers=questions.filter(question=>question.type==="short-answer");
        const hasCompletionGate=quizzes.some(block=>block.completionGate) || module.completion?.type==="quiz";

        if(!questions.length){
          blockingErrors.push(`Module ${moduleIndex+1} "${module.title}" has an empty quiz.`);
        }
        if(!shortAnswers.length){
          blockingErrors.push(`Module ${moduleIndex+1} "${module.title}" must include at least one short-answer question.`);
        }
        if(!hasCompletionGate){
          blockingErrors.push(`Module ${moduleIndex+1} "${module.title}" must use its quiz as a completion gate.`);
        }

        questions.forEach((question,questionIndex)=>{
          if(!question.prompt){
            blockingErrors.push(`Module ${moduleIndex+1}, question ${questionIndex+1} has no prompt.`);
          }
          if(question.type==="multiple-choice"){
            if((question.answers||[]).length<2){
              blockingErrors.push(`Module ${moduleIndex+1}, question ${questionIndex+1} needs at least two answer choices.`);
            }
            if(!Number.isInteger(question.correct)||question.correct<0||question.correct>=(question.answers||[]).length){
              blockingErrors.push(`Module ${moduleIndex+1}, question ${questionIndex+1} has an invalid answer key.`);
            }
          } else if(question.type==="short-answer"){
            const rule=question.validation||{};
            if(rule.mode==="exact" && !(rule.acceptableAnswers||[]).length){
              blockingErrors.push(`Module ${moduleIndex+1}, short-answer question ${questionIndex+1} needs at least one accepted objective answer.`);
            }
            if(rule.mode==="keywords"){
              if(!(rule.requiredKeywords||[]).length){
                warnings.push({
                  severity:"warning",
                  text:`Module ${moduleIndex+1}, short-answer question ${questionIndex+1} has no coaching ideas and will behave as an open response.`
                });
              }
              if((rule.minimumKeywordMatches||1)>(rule.requiredKeywords||[]).length&&rule.requiredKeywords?.length){
                warnings.push({
                  severity:"warning",
                  text:`Module ${moduleIndex+1}, short-answer question ${questionIndex+1} requested more idea matches than it supplied. The runtime clamps the coaching threshold.`
                });
              }
              if(rule.enforcement==="strict"){
                warnings.push({
                  severity:"warning",
                  text:`Module ${moduleIndex+1}, short-answer question ${questionIndex+1} uses a strict keyword gate. Confirm that named terms are literally required, not merely one acceptable phrasing.`
                });
              }
            }
            if(!["exact","keywords","reflection"].includes(rule.mode)){
              blockingErrors.push(`Module ${moduleIndex+1}, short-answer question ${questionIndex+1} must use exact, keywords, or reflection validation.`);
            }
          }
        });
      });

      blockingErrors.forEach(text=>warnings.push({severity:"blocking",text}));
      return blockingErrors;
    }

    function validateEvidenceRefs(school,sourceContext,warnings) {
      const allowed=new Set(sourceContext.claims.map(claim=>claim.id));
      school.modules.forEach((module,index)=>{
        const refs=[
          ...(module.evidenceRefs||[]),
          ...(module.conceptMetadata||[]).flatMap(concept=>concept.evidenceRefs||[]),
          ...(module.quiz||[]).flatMap(question=>question.evidenceRefs||[])
        ];
        const invented=[...new Set(refs.filter(ref=>!allowed.has(ref)))];
        if(invented.length){
          warnings.push({
            severity:"severe",
            text:`Module ${index+1} referenced unknown claim IDs: ${invented.join(", ")}. They were removed.`
          });
          module.evidenceRefs=(module.evidenceRefs||[]).filter(ref=>allowed.has(ref));
          (module.conceptMetadata||[]).forEach(concept=>concept.evidenceRefs=concept.evidenceRefs.filter(ref=>allowed.has(ref)));
          (module.quiz||[]).forEach(question=>question.evidenceRefs=question.evidenceRefs.filter(ref=>allowed.has(ref)));
        }
      });
    }

    function normalizeModelSchool(payload,requestContext) {
      if(payload?.schema && !MODEL_OUTPUT_SCHEMAS.has(payload.schema)){
        throw new Error(`Unsupported model output schema: ${payload.schema}`);
      }
      const rawSchool=payload?.school||payload;
      if(!rawSchool||!Array.isArray(rawSchool.modules)||!rawSchool.modules.length){
        throw new Error("The model did not return a school with modules.");
      }

      const warnings=[];
      const sourceContext=requestContext.sourceContext;
      const baseModules=requestContext.baseSchool?.modules||[];
      const modelNative=rawSchool.structureMode==="model-native" || !sourceContext.hasGrounding;
      const desired=Math.max(1,Math.min(12,requestContext.moduleCount));
      const hardLimit=modelNative?30:desired;
      let rawModules=rawSchool.modules.slice(0,hardLimit);

      if(rawSchool.modules.length>hardLimit){
        warnings.push({severity:"warning",text:`The model returned ${rawSchool.modules.length} modules. The runtime safety limit preserved the first ${hardLimit}.`});
      }
      if(!modelNative && rawSchool.modules.length<desired){
        warnings.push({severity:"warning",text:`The grounded model returned ${rawSchool.modules.length} modules instead of ${desired}. Missing modules were not fabricated.`});
      }

      const context={
        inputHash:sourceContext.inputHash,
        provider:requestContext.provider,
        model:requestContext.model,
        freedom:requestContext.freedom,
        requestedCount:rawModules.length,
        claimTexts:sourceContext.claims.map(claim=>claim.text)
      };

      let modules=rawModules.map((module,index)=>modelNative
        ? normalizeModelNativeModule(module,index,context)
        : normalizeModelModule(
            module,index,context,
            requestContext.engine==="hybrid"?baseModules[index]||null:null
          )
      );

      if(sourceContext.safetySensitive){
        const hasSafety=modules.some(module=>/safety|hazard|legal|identification/i.test(module.title));
        if(!hasSafety && requestContext.baseSchool?.modules?.length){
          modules.unshift(requestContext.baseSchool.modules[0]);
          modules=modules.slice(0,desired);
          warnings.push({severity:"severe",text:"The model omitted a safety-first module. The deterministic safety module was restored."});
        }
        modules.forEach(module=>{
          if(!module.safetyNotice){
            module.safetyNotice="This model-generated section is study material, not authorization to consume, harvest, identify, diagnose, treat, or perform a hazardous procedure without qualified verification.";
          }
        });
      }

      const school={
        id:`school-${slug(rawSchool.subject||requestContext.subject)}-${stableHash(JSON.stringify(rawSchool)).slice(0,8)}`,
        title:String(rawSchool.title||`${titleCase(requestContext.subject)} School`),
        subtitle:String(rawSchool.subtitle||`Language-model curriculum · ${requestContext.provider}`),
        subject:String(rawSchool.subject||requestContext.subject),
        description:String(rawSchool.description||`A language-model curriculum about ${requestContext.subject}.`),
        sourceMode:sourceContext.knowledgeMode,
        generationWarning:sourceContext.hasGrounding
          ? ""
          : "This curriculum was generated from the language model's learned knowledge without a supplied data dump. It may contain incomplete, outdated, disputed, or incorrect information and should be independently verified.",
        sourceNote:sourceContext.hasSourceDump
          ? `hybrid model + source compiler · input ${sourceContext.inputHash}`
          : sourceContext.hasCuratedPreset
            ? "curated preset + language model"
            : "LLM-generated knowledge · no supplied source dump",
        inputHash:sourceContext.inputHash,
        sourceAnalysis:requestContext.baseSchool?.sourceAnalysis||{
          claims:sourceContext.claims.length,
          sections:0,
          sources:sourceContext.sources,
          safetyFlags:sourceContext.safetyFlags,
          deterministic:false
        },
        safetySensitive:sourceContext.safetySensitive,
        difficulty:requestContext.difficulty,
        mode:requestContext.mode,
        tone:requestContext.tone,
        structureMode:modelNative?"model-native":"standard",
        navigation:Array.isArray(rawSchool.navigation)
          ? rawSchool.navigation.slice(0,30).map(group=>({
              label:String(group?.label||group?.title||""),
              moduleIds:(Array.isArray(group?.moduleIds)?group.moduleIds:[]).map(String)
            })).filter(group=>group.label)
          : [],
        modelGeneration:{
          provider:requestContext.provider,
          model:requestContext.model,
          engine:requestContext.engine,
          freedom:requestContext.freedom,
          generatedAt:new Date().toISOString()
        },
        modules
      };

      validateEvidenceRefs(school,sourceContext,warnings);

      if(!sourceContext.hasGrounding){
        warnings.unshift({
          severity:"severe",
          text:"No source dump or curated knowledge pack was supplied. This proposal uses LLM-generated knowledge. Verify factual claims and all consequential guidance before relying on it."
        });
        school.modules.forEach(module=>{
          module.sourceConfidence="LLM-generated · unverified";
          module.modelKnowledgeWarning=true;
          if(!module.modelMeta) module.modelMeta={};
          module.modelMeta.knowledgeMode="llm-generated";
        });
      }

      school.modules.forEach((module,index)=>{
        const prose=module.structureMode==="model-native"
          ? (module.blocks||[]).filter(block=>block.type==="prose").flatMap(block=>block.paragraphs||[])
          : (module.paragraphs||[]);
        const factualSentences=prose.filter(paragraph=>/\b(is|are|was|were|causes?|contains?|requires?|occurs?|prevents?)\b/i.test(paragraph));
        if(!sourceContext.hasGrounding && factualSentences.length){
          warnings.push({
            severity:"warning",
            text:`Module ${index+1} contains LLM-generated factual prose without a supplied source pack. It is labeled unverified and should be checked against reliable references.`
          });
        }
        if(module.structureMode!=="model-native" && (module.quiz||[]).some(question=>question.answers.length<3)){
          warnings.push({severity:"warning",text:`Module ${index+1} contained an incomplete quiz and was repaired.`});
        }
      });

      if(modelNative) school.structureMode="model-native";
      const finalizedSchool=finalizeSchool(school,{
        difficulty:requestContext.difficulty,
        mode:requestContext.mode,
        tone:requestContext.tone
      });
      const blockingErrors=modelNative?validateModelNativeAssessments(finalizedSchool,warnings):[];
      return {
        school:finalizedSchool,
        warnings,
        blockingErrors,
        notes:Array.isArray(payload?.notes)?payload.notes.map(String):[]
      };
    }

    function summarizeProposal(school,warnings,notes) {
      const nativeBlocks=school.modules.reduce((sum,module)=>sum+(module.blocks?.length||0),0);
      const paragraphs=school.modules.reduce((sum,module)=>sum+(module.paragraphs?.length||0),0);
      const quizzes=school.modules.reduce((sum,module)=>sum+(module.quiz?.length||0)+(module.blocks||[]).filter(block=>block.type==="quiz").reduce((inner,block)=>inner+(block.questions?.length||0),0),0);
      const shortAnswers=school.modules.reduce((sum,module)=>sum+(module.blocks||[]).filter(block=>block.type==="quiz").reduce((inner,block)=>inner+(block.questions||[]).filter(question=>question.type==="short-answer").length,0),0);
      const structure=school.structureMode==="model-native"?`${nativeBlocks} model-authored blocks`:`${paragraphs} lesson paragraphs`;
      return `${school.modules.length} modules · ${structure} · ${quizzes} quiz questions · ${shortAnswers} short-answer · ${warnings.length} validator warning(s).${notes.length?` Model notes: ${notes.join(" ")}`:""}`;
    }

    function showModelProposal(normalized,meta) {
      pendingModelProposal={
        school:normalized.school,
        warnings:normalized.warnings,
        blockingErrors:normalized.blockingErrors||[],
        notes:normalized.notes,
        resetProgress:meta.resetProgress,
        operation:meta.operation,
        rawProvider:meta.provider,
        toolTrace:meta.toolTrace||[]
      };
      state.modelProposals.push({
        at:new Date().toISOString(),
        operation:meta.operation,
        provider:meta.provider,
        model:meta.model,
        warnings:normalized.warnings.length,
        schoolTitle:normalized.school.title
      });
      const node=document.getElementById("model-proposal");
      node.hidden=false;
      document.getElementById("proposal-title").textContent=normalized.school.title;
      document.getElementById("proposal-provider").textContent=`${meta.provider} · ${meta.model}`;
      document.getElementById("proposal-summary").textContent=summarizeProposal(normalized.school,normalized.warnings,normalized.notes);
      const trace=meta.toolTrace||[];
      document.getElementById("proposal-tool-trace").innerHTML=trace.length
        ? trace.map(item=>`<span class="tool-trace-chip"><b>${escapeHTML(item.name)}</b> · ${item.ok?"ok":"failed"}${item.automatic?" · automatic":""}</span>`).join("")
        : `<span class="tool-trace-chip">No deterministic tools invoked</span>`;
      document.getElementById("proposal-warnings").innerHTML=normalized.warnings.length
        ? normalized.warnings.map(warning=>`<div class="proposal-warning ${warning.severity==="severe"?"severe":""} ${warning.severity==="blocking"?"blocking":""}">${escapeHTML(warning.text)}</div>`).join("")
        : `<div class="proposal-warning">Validator found no structural warnings.</div>`;
      const acceptButton=document.getElementById("accept-model-proposal");
      acceptButton.disabled=Boolean((normalized.blockingErrors||[]).length);
      acceptButton.textContent=acceptButton.disabled
        ? `Fix ${normalized.blockingErrors.length} assessment requirement${normalized.blockingErrors.length===1?"":"s"}`
        : "Accept proposal";
      document.getElementById("proposal-json").textContent=JSON.stringify({
        schema:"living-academy-manifest-1.5",
        school:normalized.school,
        validatorWarnings:normalized.warnings,
        modelNotes:normalized.notes
      },null,2);
      node.scrollIntoView({behavior:"smooth",block:"start"});
      saveState();
    }

    function acceptModelProposal() {
      if(!pendingModelProposal) return;
      if((pendingModelProposal.blockingErrors||[]).length){
        toast("Proposal cannot be accepted until every module has a valid short-answer quiz.");
        return;
      }
      const previousIds=new Set(state.school?.modules?.map(module=>module.id)||[]);
      state.school=pendingModelProposal.school;
      if(pendingModelProposal.resetProgress){
        state.clearedModules=[];
        state.mastery={};
      } else {
        const newIds=new Set(state.school.modules.map(module=>module.id));
        state.clearedModules=state.clearedModules.filter(id=>newIds.has(id)&&previousIds.has(id));
        Object.keys(state.mastery).forEach(id=>{if(!newIds.has(id)) delete state.mastery[id];});
      }
      emit("model.proposal-accepted",{
        operation:pendingModelProposal.operation,
        provider:pendingModelProposal.rawProvider,
        schoolId:state.school.id,
        moduleCount:state.school.modules.length
      });
      pendingModelProposal=null;
      document.getElementById("model-proposal").hidden=true;
      document.getElementById("model-console").textContent="Model proposal accepted. The school, navigation, checks, exercises, scenarios, and manifests have been rebuilt.";
      activeModuleId=state.school.modules[0]?.id||null;
      bindCommonweaveGeneratedSchool();
      renderSchool();
      toast("Model curriculum accepted.");
    }

    function discardModelProposal() {
      pendingModelProposal=null;
      document.getElementById("model-proposal").hidden=true;
      const acceptButton=document.getElementById("accept-model-proposal");
      acceptButton.disabled=false;
      acceptButton.textContent="Accept proposal";
      document.getElementById("model-console").textContent="Model proposal discarded. The current school was not changed.";
    }


    function modelRouteConfigurationIssue(config=modelConfigFromUI()){
      if(config.engine==="deterministic"||config.provider==="deterministic") return "";
      if(config.provider==="hosted"){
        if(!hostedEntitlementIsActive()) return "The included Gemini route needs an active paid entitlement.";
        if(!commerceBrokerBase()) return "The site operator has not configured the hosted Gemini broker.";
      }
      if(config.provider==="gemini"&&!config.apiKey) return "Enter a Gemini API key for the direct testing route.";
      if(config.provider==="local-api"&&!config.endpoint) return "Enter the local model API endpoint.";
      if(config.provider==="gguf"&&!/ready/i.test(document.getElementById("gguf-state")?.textContent||"")) return "Start a GGUF through the included llama.cpp bridge.";
      if(config.provider==="browser"&&!browserModelFactory()) return "This browser does not expose a browser-native LanguageModel API.";
      return "";
    }

    function shouldOpenModelFoundryForError(error){
      const message=String(error?.message||error||"").toLowerCase();
      return /(api key|endpoint|failed to fetch|network|cors|bridge|llama|ollama|language model api|entitlement|allowance|broker|connection|timed out|timeout|no ready gguf|provider)/.test(message);
    }

    async function runModelProposal({task,resetProgress=true,operation="generate",currentSchool=null,targetModule=null}) {
      const config=modelConfigFromUI();
      const configurationIssue=modelRouteConfigurationIssue(config);
      if(configurationIssue){
        setModelStatus(configurationIssue,"bad");
        openModelFoundry(activeModelRoute());
        throw new Error(configurationIssue);
      }
      const subject=document.getElementById("school-subject").value.trim()||state.school?.subject||"A new subject";
      const notes=document.getElementById("school-sources").value;
      const moduleCount=Number(document.getElementById("school-modules").value||6);
      const difficulty=document.getElementById("school-level").value;
      const mode=document.getElementById("school-mode").value;
      const tone=document.getElementById("school-tone").value;
      const sourceContext=sourceContextForModel(subject,notes);
      const requestContext={subject,notes,moduleCount,difficulty,mode,tone,engine:config.engine,freedom:config.freedom,provider:config.provider,model:config.model,sourceContext,baseSchool:null,currentSchool:currentSchool||state.school};
      const detailedTask=targetModule?`${task}\nTarget module ID: ${targetModule.id}\nReturn the complete revised school, preserving unrelated modules unless the request requires broader changes.`:task;
      const messages=[
        {role:"system",content:modelSystemPrompt()},
        {role:"user",content:modelUserPrompt({task:detailedTask,subject,notes,moduleCount,difficulty,mode,tone,engine:config.engine,freedom:config.freedom,currentSchool:currentSchool||state.school})}
      ];

      if(config.provider==="manual"){
        manualModelSession={messages,requestContext,resetProgress,operation,toolTrace:[],toolState:{deterministicSchool:null,modules:{}},round:0};
        document.getElementById("manual-model-prompt").value=messages.map(message=>`${message.role.toUpperCase()}:\n${message.content}`).join("\n\n");
        setModelStatus("Manual tool session prepared. Paste the model's JSON response, then validate it.","good");
        openModelFoundry("manual");
        return;
      }

      document.getElementById("model-console").classList.add("model-run-pulse");
      document.getElementById("model-console").textContent=`Calling ${config.provider} model "${config.model}" with deterministic tools available...`;
      try{
        const loop=await invokeModelToolLoop(messages,config,requestContext);
        requestContext.baseSchool=loop.toolState.deterministicSchool || (sourceContext.safetySensitive?compileDeterministicForTool({moduleCount},requestContext):null);
        const normalized=normalizeModelSchool(loop.payload,requestContext);
        state.modelHistory.push({at:new Date().toISOString(),provider:config.provider,model:config.model,operation,responseCharacters:loop.totalCharacters,warnings:normalized.warnings.length,toolCalls:loop.toolTrace.length,rounds:loop.rounds});
        showModelProposal(normalized,{resetProgress,operation,provider:config.provider,model:config.model,toolTrace:loop.toolTrace});
        setModelStatus(`Proposal received after ${loop.rounds} model round(s) and ${loop.toolTrace.length} deterministic tool call(s). ${normalized.warnings.length} validator warning(s).`,"good");
        document.getElementById("model-console").textContent="The writer model and deterministic tools returned one integrated proposal. Inspect and accept or discard it below.";
      } catch(error){
        setModelStatus(error.name==="AbortError"||error.name==="TimeoutError"?`Generation stopped: ${error.message||"request aborted"}`:`Generation failed: ${error.message}`,"bad");
        document.getElementById("model-console").textContent=`Model generation failed without changing the school: ${error.message}`;
        if(shouldOpenModelFoundryForError(error)) setTimeout(()=>openModelFoundry(activeModelRoute()),80);
        throw error;
      } finally {
        document.getElementById("model-console").classList.remove("model-run-pulse");
      }
    }

    async function testModelConnection() {
      const config=modelConfigFromUI();
      const messages=[
        {role:"system",content:'Return JSON only: {"ok":true,"message":"connection working"}'},
        {role:"user",content:"Test the curriculum model connection."}
      ];
      setModelStatus(`Testing ${config.provider}...`);
      try{
        const text=await invokeLanguageModel(messages,config);
        const parsed=parseModelJSON(text);
        if(!parsed.ok) throw new Error("The model responded, but did not return the expected test object.");
        setModelStatus(`Connected to ${config.provider} · ${config.model}: ${parsed.message||"working"}`,"good");
      } catch(error) {
        setModelStatus(`Connection test failed: ${error.message}`,"bad");
      }
    }

    async function applyManualModelResponse() {
      try{
        const payload=parseModelJSON(document.getElementById("manual-model-response").value);
        if(manualModelSession&&isToolRequest(payload)){
          const results=await executeDeterministicToolCalls(payload.toolCalls||[],manualModelSession.requestContext,manualModelSession.toolState);
          manualModelSession.toolTrace.push(...results.map(result=>({round:manualModelSession.round+1,...result})));
          manualModelSession.messages.push({role:"assistant",content:JSON.stringify(payload)});
          manualModelSession.messages.push({role:"user",content:JSON.stringify({schema:MODEL_TOOL_RESULT_SCHEMA,results,instruction:"Continue with another tool request or the final curriculum JSON."})});
          manualModelSession.round++;
          document.getElementById("manual-model-prompt").value=manualModelSession.messages.map(message=>`${message.role.toUpperCase()}:\n${message.content}`).join("\n\n");
          document.getElementById("manual-model-response").value="";
          setModelStatus(`Executed ${results.length} deterministic tool call(s). Send the updated prompt to the model and paste its next JSON response.`,"good");
          return;
        }

        if(manualModelSession){
          manualModelSession.requestContext.baseSchool=manualModelSession.toolState.deterministicSchool || (manualModelSession.requestContext.sourceContext.safetySensitive?compileDeterministicForTool({moduleCount:manualModelSession.requestContext.moduleCount},manualModelSession.requestContext):null);
          const normalized=normalizeModelSchool(payload,manualModelSession.requestContext);
          showModelProposal(normalized,{resetProgress:manualModelSession.resetProgress,operation:manualModelSession.operation,provider:"manual",model:modelConfigFromUI().model,toolTrace:manualModelSession.toolTrace});
          setModelStatus("Pasted final curriculum validated and prepared as a proposal.","good");
          manualModelSession=null;
          return;
        }

        const subject=document.getElementById("school-subject").value.trim()||state.school.subject;
        const notes=document.getElementById("school-sources").value;
        const moduleCount=Number(document.getElementById("school-modules").value||6);
        const difficulty=document.getElementById("school-level").value;
        const mode=document.getElementById("school-mode").value;
        const tone=document.getElementById("school-tone").value;
        const config=modelConfigFromUI();
        const sourceContext=sourceContextForModel(subject,notes);
        const requestContext={subject,notes,moduleCount,difficulty,mode,tone,engine:config.engine,freedom:config.freedom,provider:"manual",model:config.model,sourceContext,baseSchool:config.engine==="hybrid"?compileDeterministicForTool({moduleCount}, {subject,notes,moduleCount,difficulty,mode,tone,sourceContext,currentSchool:state.school}):null,currentSchool:state.school};
        const normalized=normalizeModelSchool(payload,requestContext);
        showModelProposal(normalized,{resetProgress:true,operation:"manual-import",provider:"manual",model:config.model,toolTrace:[]});
        setModelStatus("Pasted JSON validated and prepared as a proposal.","good");
      } catch(error){ setModelStatus(`Pasted response failed validation: ${error.message}`,"bad"); }
    }



    let onboardingDraft=null;

    function currentPlan(){
      ensureCommerceState();
      return planFor(state.commerce.entitlement?.planId||state.commerce.planId);
    }

    function currentMarketplaceFee(){
      return currentPlan().marketplaceFeePercent;
    }

    function entitlementExpiresText(){
      const expires=state.commerce.entitlement?.expiresAt;
      if(!expires) return "No expiration";
      const time=Date.parse(expires);
      if(!Number.isFinite(time)) return "Expiration unknown";
      return time<=Date.now()
        ? "Expired"
        : `Renews or expires ${new Date(time).toLocaleDateString()}`;
    }

    function templateListing(template){
      return {
        id:`template-${template.id}`,
        templateId:template.id,
        title:template.title,
        description:template.outcome,
        category:template.category,
        kind:"starter-template",
        license:"commons",
        support:"self-service",
        priceCents:0,
        creatorName:"Living Academy Commons",
        certification:false,
        status:"published",
        source:"starter-template",
        dataFile:template.dataFile,
        level:template.level,
        outcome:template.outcome,
        prompt:template.prompt
      };
    }

    function allMarketplaceListings(){
      ensureCommerceState();
      return [
        ...STARTER_TEMPLATES.map(templateListing),
        ...state.commerce.listings.filter(listing=>listing.status!=="archived")
      ];
    }

    function marketListingById(id){
      return allMarketplaceListings().find(listing=>listing.id===id)||null;
    }

    function templateById(id){
      return STARTER_TEMPLATES.find(template=>template.id===id)||null;
    }

    function libraryHas(sourceId){
      return state.commerce.library.some(item=>item.sourceId===sourceId||item.id===sourceId);
    }

    function addToLibrary(item){
      ensureCommerceState();
      if(libraryHas(item.sourceId||item.id)) return state.commerce.library.find(existing=>existing.sourceId===(item.sourceId||item.id));
      const libraryItem={
        id:`library-${Date.now()}-${slug(item.title)}`,
        sourceId:item.sourceId||item.id,
        title:item.title,
        kind:item.kind||"learning-path",
        creatorName:item.creatorName||"Unknown creator",
        acquiredAt:new Date().toISOString(),
        license:item.license||"personal",
        templateId:item.templateId||null,
        schoolSnapshot:item.schoolSnapshot?deepClone(item.schoolSnapshot):null,
        certification:Boolean(item.certification),
        orderId:item.orderId||null
      };
      state.commerce.library.push(libraryItem);
      emit("commerce.library-added",{libraryItemId:libraryItem.id,sourceId:libraryItem.sourceId});
      renderCommerce();
      saveState();
      return libraryItem;
    }

    function installLibraryItem(id){
      const item=state.commerce.library.find(entry=>entry.id===id);
      if(!item) return;
      if(item.schoolSnapshot){
        const installedSnapshot=deepClone(item.schoolSnapshot);
        installedSnapshot.creatorPolicy={...(installedSnapshot.creatorPolicy||{}),fixed:true,owner:item.creatorName||"Marketplace creator",source:"marketplace"};
        installedSnapshot.installedFrom={libraryItemId:item.id,sourceId:item.sourceId,creatorName:item.creatorName||"Marketplace creator"};
        (installedSnapshot.modules||[]).forEach(module=>{module.creatorPolicy={...(module.creatorPolicy||{}),fixed:true,owner:item.creatorName||"Marketplace creator",source:"marketplace"};});
        state.school=finalizeSchool(installedSnapshot,{
          difficulty:item.schoolSnapshot.difficulty||"intermediate",
          mode:item.schoolSnapshot.mode||"balanced",
          tone:item.schoolSnapshot.tone||"plain"
        });
        state.clearedModules=[];
        state.mastery={};
        activeModuleId=state.school.modules[0]?.id||null;
        emit("commerce.path-installed",{libraryItemId:item.id,schoolId:state.school.id});
        renderSchool();
        setWorkspace("learn");
        toast(`Installed ${item.title}.`);
        return;
      }
      if(item.templateId){
        selectStarterTemplate(item.templateId);
      }
    }

    function selectStarterTemplate(templateId){
      const template=templateById(templateId);
      if(!template) return;
      ensureCommerceState();
      state.commerce.selectedTemplateId=template.id;
      document.getElementById("school-preset").value="custom";
      document.getElementById("school-subject").value=template.title;
      document.getElementById("school-level").value=template.level;
      document.getElementById("school-sources").value="";
      document.getElementById("model-request").value=template.prompt;
      renderSourceAnalysis(null);
      updateSourceGenerationWarning();
      setWorkspace("studio",{focusId:"school-builder"});
      toast(`Loaded ${template.title}. Jules can populate ${template.dataFile} later.`);
      saveState();
    }

    function renderTemplateCard(template){
      return `
        <article class="template-card">
          <div class="template-meta">
            <span>${escapeHTML(template.category)}</span>
            <span>${escapeHTML(template.level)}</span>
          </div>
          <h3>${escapeHTML(template.title)}</h3>
          <p>${escapeHTML(template.outcome)}</p>
          <div class="template-file">${escapeHTML(template.dataFile)}</div>
          <div class="card-action-row">
            <button type="button" data-template-use="${escapeHTML(template.id)}">Use template</button>
            <button type="button" data-template-library="${escapeHTML(template.id)}">${libraryHas(`template-${template.id}`)?"In library":"Save to library"}</button>
          </div>
        </article>`;
    }

    function renderLaunchpad(){
      ensureCommerceState();
      const plan=currentPlan();
      const activeCohortCount=state.academy.cohorts.length;
      const currentModules=state.school?.modules?.length||0;
      document.getElementById("commerce-home-stats").innerHTML=[
        [currentModules,"Current modules"],
        [state.commerce.library.length,"Owned paths"],
        [activeCohortCount,"Cohorts"],
        [plan.id==="commons"?"Local":formatMoneyFromCents(state.commerce.aiWallet.balanceCents),"AI available"]
      ].map(([value,label])=>`<div class="academy-stat"><b>${escapeHTML(String(value))}</b><span>${escapeHTML(label)}</span></div>`).join("");

      let next={
        title:"Choose a starting path",
        description:"Pick a starter template, explore an expert pathway, or begin from your own goal.",
        workspace:"market",
        label:"Explore pathways"
      };
      const reviewsDue=constellationReviewQueue();
      if(reviewsDue.length){
        next={title:`Review ${reviewsDue.length} concept${reviewsDue.length===1?"":"s"}`,description:"A short retrieval round is the highest-value next move for retaining recent learning.",workspace:"constellation",focusId:"retrieval-panel",label:"Review now"};
      } else if(state.clearedModules.length<currentModules&&currentModules){
        const nextModule=state.school.modules.find(module=>!state.clearedModules.includes(module.id));
        next={
          title:`Continue ${nextModule?.title||state.school.title}`,
          description:nextModule?.summary||"Resume the current learning path.",
          workspace:"learn",
          label:"Continue learning"
        };
      } else if(state.commerce.onboarding.role==="creator"&&!state.commerce.listings.length){
        next={
          title:"Package your first pathway",
          description:"Use the current school to create a storefront listing with transparent outcomes and evidence rules.",
          workspace:"market",
          focusId:"creator-studio-panel",
          label:"Open creator studio"
        };
      } else if(state.commerce.onboarding.role==="institution"&&!state.commerce.organization.name){
        next={
          title:"Set up the institution",
          description:"Name the organization, choose seats, then launch a private cohort and catalog.",
          workspace:"admin",
          focusId:"billing-panel",
          label:"Configure institution"
        };
      }
      document.getElementById("next-step-title").textContent=next.title;
      document.getElementById("next-step-description").textContent=next.description;
      const nextButton=document.getElementById("next-step-action");
      nextButton.textContent=next.label;
      nextButton.dataset.workspace=next.workspace;
      nextButton.dataset.focusId=next.focusId||"";

      document.getElementById("home-template-grid").innerHTML=STARTER_TEMPLATES.slice(0,6).map(renderTemplateCard).join("");
      document.getElementById("home-template-grid").querySelectorAll("[data-template-use]").forEach(button=>
        button.addEventListener("click",()=>selectStarterTemplate(button.dataset.templateUse))
      );
      document.getElementById("home-template-grid").querySelectorAll("[data-template-library]").forEach(button=>
        button.addEventListener("click",()=>addToLibrary({...templateListing(templateById(button.dataset.templateLibrary)),sourceId:`template-${button.dataset.templateLibrary}`}))
      );

      document.getElementById("home-library").innerHTML=state.commerce.library.length
        ? [...state.commerce.library].reverse().slice(0,8).map(item=>`
            <div class="library-item">
              <b>${escapeHTML(item.title)}</b><br>
              <small>${escapeHTML(item.kind.replaceAll("-"," "))} · ${escapeHTML(item.creatorName)}</small>
              <div class="card-action-row"><button type="button" data-library-open="${escapeHTML(item.id)}">Open</button></div>
            </div>`).join("")
        : `<div class="empty">No saved paths yet. Starter templates and purchases appear here.</div>`;
      document.getElementById("home-library").querySelectorAll("[data-library-open]").forEach(button=>
        button.addEventListener("click",()=>installLibraryItem(button.dataset.libraryOpen))
      );

      document.getElementById("home-plan-card").innerHTML=`
        <div class="pricing-card ${plan.featured?"featured":""}">
          <span class="tag">${escapeHTML(plan.name)}</span>
          <div class="price">${plan.priceCents?`${formatMoneyFromCents(plan.priceCents)}/mo`:"Free"}</div>
          <p>${escapeHTML(plan.description)}</p>
          <div class="wallet-meter"><span style="width:${plan.aiAllowanceCents?Math.min(100,state.commerce.aiWallet.balanceCents/plan.aiAllowanceCents*100):0}%"></span></div>
          <small>${plan.aiAllowanceCents
            ? `${formatMoneyFromCents(state.commerce.aiWallet.balanceCents)} of ${formatMoneyFromCents(plan.aiAllowanceCents)} hosted AI allowance remains`
            : "Use a local model or your own provider key without a subscription."}</small>
        </div>`;
    }

    function marketCardMarkup(listing){
      const owned=libraryHas(listing.id);
      const price=listing.priceCents?formatMoneyFromCents(listing.priceCents):"Free";
      return `
        <article class="market-card ${listing.kind==="certification"?"certification":""}">
          <div class="market-meta">
            <span>${escapeHTML(listing.category||"General")}</span>
            <span>${escapeHTML((listing.kind||"learning-path").replaceAll("-"," "))}</span>
            ${listing.status&&listing.status!=="published"?`<span>${escapeHTML(listing.status.replaceAll("-"," "))}</span>`:""}
          </div>
          <h3>${escapeHTML(listing.title)}</h3>
          <p>${escapeHTML(listing.description||listing.outcome||"Learning path")}</p>
          ${listing.certification||listing.kind==="certification"
            ? `<div class="certification-note">Payment grants access to teaching and assessment. The credential still requires evidence and review.</div>`
            : ""}
          <small>By ${escapeHTML(listing.creatorName||"Unknown creator")} · ${escapeHTML(listing.support||"self-service")}</small>
          <div class="market-card-price">${price}</div>
          <div class="card-action-row">
            <button type="button" data-listing-open="${escapeHTML(listing.id)}">Inspect</button>
            ${listing.source==="starter-template"
              ? `<button type="button" data-template-use="${escapeHTML(listing.templateId)}">Use</button>`
              : `<button type="button" data-listing-buy="${escapeHTML(listing.id)}">${owned?"Owned":listing.priceCents?"Buy pathway":"Add free"}</button>`}
          </div>
        </article>`;
    }

    function renderMarketplace(){
      ensureCommerceState();
      const categorySelect=document.getElementById("market-category");
      const listingCategory=document.getElementById("listing-category");
      const options=MARKET_CATEGORIES.map(category=>`<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join("");
      if(categorySelect.options.length<=1) categorySelect.insertAdjacentHTML("beforeend",options);
      if(!listingCategory.options.length) listingCategory.innerHTML=options;

      const search=String(state.commerce.marketSearch||"").toLowerCase();
      const category=state.commerce.marketCategory||"all";
      const priceFilter=state.commerce.marketPriceFilter||"all";
      const listings=allMarketplaceListings().filter(listing=>{
        const haystack=[listing.title,listing.description,listing.outcome,listing.creatorName,listing.category,listing.kind].join(" ").toLowerCase();
        if(search&&!haystack.includes(search)) return false;
        if(category!=="all"&&listing.category!==category) return false;
        if(priceFilter==="free"&&listing.priceCents) return false;
        if(priceFilter==="paid"&&!listing.priceCents) return false;
        if(priceFilter==="certification"&&listing.kind!=="certification"&&!listing.certification) return false;
        return true;
      });

      document.getElementById("market-listing-count").textContent=`${listings.length} ${listings.length===1?"path":"paths"}`;
      document.getElementById("market-grid").innerHTML=listings.length
        ? listings.map(marketCardMarkup).join("")
        : `<div class="empty">No pathways match the current filters.</div>`;

      document.getElementById("market-grid").querySelectorAll("[data-listing-open]").forEach(button=>
        button.addEventListener("click",()=>openListingDrawer(button.dataset.listingOpen))
      );
      document.getElementById("market-grid").querySelectorAll("[data-listing-buy]").forEach(button=>
        button.addEventListener("click",()=>purchaseListing(button.dataset.listingBuy))
      );
      document.getElementById("market-grid").querySelectorAll("[data-template-use]").forEach(button=>
        button.addEventListener("click",()=>selectStarterTemplate(button.dataset.templateUse))
      );

      const creator=state.commerce.creator;
      if(document.activeElement?.id!=="listing-title"&&!document.getElementById("listing-title").value) document.getElementById("listing-title").value=state.school?.title||"";
      if(document.activeElement?.id!=="listing-description"&&!document.getElementById("listing-description").value) document.getElementById("listing-description").value=state.school?.description||state.school?.subject||"";
      if(document.activeElement?.id!=="creator-store-name") document.getElementById("creator-store-name").value=creator.storeName||"";
      if(document.activeElement?.id!=="creator-expertise") document.getElementById("creator-expertise").value=creator.expertise||"";
      document.getElementById("creator-terms").checked=creator.termsAccepted===true;

      const gross=state.commerce.sales.reduce((sum,sale)=>sum+Number(sale.amountCents||0),0);
      const fees=state.commerce.sales.reduce((sum,sale)=>sum+Number(sale.platformFeeCents||0),0);
      document.getElementById("creator-economics").innerHTML=`
        <div class="academy-stat-grid">
          <div class="academy-stat"><b>${state.commerce.listings.length}</b><span>Listings</span></div>
          <div class="academy-stat"><b>${state.commerce.sales.length}</b><span>Sales</span></div>
          <div class="academy-stat"><b>${formatMoneyFromCents(gross-fees)}</b><span>Creator net</span></div>
          <div class="academy-stat"><b>${currentMarketplaceFee()}%</b><span>Plan fee</span></div>
        </div>
        <p>${creator.connected
          ? "Payout account connected."
          : "Paid listings remain drafts until a payout account is connected through the marketplace broker."}</p>`;
      document.getElementById("creator-sales-list").innerHTML=state.commerce.sales.length
        ? [...state.commerce.sales].reverse().map(sale=>`
            <div class="sale-item">
              <b>${escapeHTML(sale.title)}</b><br>
              <small>Gross ${formatMoneyFromCents(sale.amountCents)} · fee ${formatMoneyFromCents(sale.platformFeeCents)} · net ${formatMoneyFromCents(sale.creatorNetCents)}</small>
            </div>`).join("")
        : `<div class="empty">No sales recorded in this local ledger.</div>`;
    }

    function openListingDrawer(id){
      const listing=marketListingById(id);
      if(!listing) return;
      state.commerce.selectedListingId=id;
      const drawer=document.getElementById("listing-drawer");
      const owned=libraryHas(listing.id);
      document.getElementById("listing-drawer-content").innerHTML=`
        <span class="tag">${escapeHTML(listing.category||"Learning path")}</span>
        <h2 id="listing-drawer-title">${escapeHTML(listing.title)}</h2>
        <p>${escapeHTML(listing.description||listing.outcome||"")}</p>
        <div class="market-meta">
          <span>${escapeHTML((listing.kind||"learning-path").replaceAll("-"," "))}</span>
          <span>${escapeHTML(listing.license||"personal")}</span>
          <span>${escapeHTML(listing.support||"self-service")}</span>
        </div>
        <h3>${listing.priceCents?formatMoneyFromCents(listing.priceCents):"Free"}</h3>
        <p><b>Creator:</b> ${escapeHTML(listing.creatorName||"Living Academy Commons")}</p>
        ${listing.dataFile?`<div class="template-file">${escapeHTML(listing.dataFile)}</div>`:""}
        ${listing.kind==="certification"||listing.certification
          ? `<div class="native-callout note"><b>Credential boundary</b>Purchasing this product never purchases the credential. Learners must still pass the quizzes, complete evidence requirements, and satisfy the configured review process.</div>`
          : ""}
        <div class="action-row">
          ${listing.source==="starter-template"
            ? `<button class="button hot" data-drawer-template="${escapeHTML(listing.templateId)}" type="button">Use starter template</button>`
            : `<button class="button hot" data-drawer-buy="${escapeHTML(listing.id)}" type="button">${owned?"Already owned":listing.priceCents?"Checkout":"Add to library"}</button>`}
          ${listing.priceCents&&state.commerce.demoMode&&!owned?`<button data-drawer-demo="${escapeHTML(listing.id)}" type="button">Demo purchase</button>`:""}
        </div>`;
      drawer.hidden=false;
      drawer.querySelector("[data-drawer-template]")?.addEventListener("click",()=>{
        drawer.hidden=true;
        selectStarterTemplate(listing.templateId);
      });
      drawer.querySelector("[data-drawer-buy]")?.addEventListener("click",()=>purchaseListing(listing.id));
      drawer.querySelector("[data-drawer-demo]")?.addEventListener("click",()=>completeDemoPurchase(listing.id));
      saveState();
    }

    function closeListingDrawer(){
      document.getElementById("listing-drawer").hidden=true;
    }

    function publishCurrentSchool(){
      ensureCommerceState();
      const storeName=document.getElementById("creator-store-name").value.trim();
      const expertise=document.getElementById("creator-expertise").value.trim();
      const terms=document.getElementById("creator-terms").checked;
      if(!storeName||!expertise){
        document.getElementById("creator-feedback").className="feedback fail";
        document.getElementById("creator-feedback").textContent="Add a storefront name and a trust statement before publishing.";
        return;
      }
      if(!terms){
        document.getElementById("creator-feedback").className="feedback fail";
        document.getElementById("creator-feedback").textContent="Accept the creator responsibility statement before publishing.";
        return;
      }
      const priceCents=Math.round(Number(document.getElementById("listing-price").value||0)*100);
      const kind=document.getElementById("listing-kind").value;
      const listing={
        id:`listing-${Date.now()}-${slug(document.getElementById("listing-title").value||state.school.title)}`,
        title:document.getElementById("listing-title").value.trim()||state.school.title,
        description:document.getElementById("listing-description").value.trim()||state.school.description||state.school.subject,
        category:document.getElementById("listing-category").value||MARKET_CATEGORIES[0],
        kind,
        certification:kind==="certification",
        priceCents,
        license:document.getElementById("listing-license").value,
        support:document.getElementById("listing-support").value,
        creatorName:storeName,
        creatorExpertise:expertise,
        creatorLearnerId:state.learner.learnerId,
        schoolSnapshot:deepClone(state.school),
        status:priceCents>0&&!state.commerce.creator.connected?"draft-awaiting-payouts":"published",
        createdAt:new Date().toISOString(),
        platformFeePercent:currentMarketplaceFee(),
        evidenceBoundary:"Purchase grants access to the learning and assessment process, not automatic credential issuance."
      };
      state.commerce.creator={...state.commerce.creator,storeName,expertise,termsAccepted:true};
      state.commerce.listings.push(listing);
      emit("commerce.listing-published",{listingId:listing.id,status:listing.status,priceCents});
      document.getElementById("creator-feedback").className=`feedback ${listing.status==="published"?"pass":""}`;
      document.getElementById("creator-feedback").textContent=listing.status==="published"
        ? "Listing published in the local catalog."
        : "Listing saved as a draft. Connect payouts before accepting live payments.";
      renderCommerce();
      saveState();
    }

    function exportSelectedListing(){
      const listing=state.commerce.listings.at(-1);
      if(!listing){toast("Publish a listing first.");return;}
      download(`${slug(listing.title)}-listing.json`,JSON.stringify({
        schema:"living-academy-market-listing-1.0",
        exportedAt:new Date().toISOString(),
        listing
      },null,2),"application/json;charset=utf-8");
    }

    async function beginSellerOnboarding(){
      ensureCommerceState();
      const base=commerceBrokerBase();
      try{
        if(base){
          const response=await fetch(`${base}/v1/marketplace/onboard`,{
            method:"POST",
            headers:{
              "content-type":"application/json",
              ...(state.commerce.entitlement.accessToken?{"authorization":`Bearer ${state.commerce.entitlement.accessToken}`}:{})
            },
            body:JSON.stringify({
              learnerId:state.learner.learnerId,
              email:state.commerce.billingEmail,
              storeName:document.getElementById("creator-store-name").value.trim()||state.commerce.creator.storeName,
              returnUrl:location.href.split("#")[0]+"#/market/creator-studio-panel"
            })
          });
          const payload=await response.json();
          if(!response.ok||!payload.url) throw new Error(payload.error||"Onboarding URL was not returned.");
          const destination=safeExternalURL(payload.url);if(!destination)throw new Error("The onboarding URL is unsafe.");
          window.open(destination,"_blank","noopener");
          return;
        }
        const link=state.commerce.billingConfig.connectOnboardingUrl;
        if(link){
          const destination=safeExternalURL(link);if(!destination)throw new Error("The onboarding URL is unsafe.");
          window.open(destination,"_blank","noopener");
          return;
        }
        if(state.commerce.demoMode){
          state.commerce.creator.connected=true;
          state.commerce.creator.connectedAccountId="acct_demo_local";
          state.commerce.listings.forEach(listing=>{
            if(listing.status==="draft-awaiting-payouts") listing.status="published";
          });
          renderCommerce();
          saveState();
          toast("Demo payout account connected. No financial account was created.");
          return;
        }
        throw new Error("No seller onboarding endpoint is configured.");
      }catch(error){
        document.getElementById("creator-feedback").className="feedback fail";
        document.getElementById("creator-feedback").textContent=error.message;
      }
    }

    async function purchaseListing(id){
      const listing=marketListingById(id);
      if(!listing||libraryHas(id)) return;
      if(!listing.priceCents){
        addToLibrary({...listing,sourceId:listing.id});
        closeListingDrawer();
        toast(`Added ${listing.title} to your library.`);
        return;
      }

      const base=commerceBrokerBase();
      if(!base){
        openListingDrawer(id);
        document.getElementById("billing-feedback").textContent="A marketplace broker is required for verified paid purchases. Demo purchase remains available for local testing.";
        return;
      }
      try{
        const response=await fetch(`${base}/v1/marketplace/checkout`,{
          method:"POST",
          headers:{
            "content-type":"application/json",
            ...(state.commerce.entitlement.accessToken?{"authorization":`Bearer ${state.commerce.entitlement.accessToken}`}:{})
          },
          body:JSON.stringify({
            listingId:listing.id,
            title:listing.title,
            amountCents:listing.priceCents,
            creatorAccountId:listing.creatorAccountId||null,
            platformFeePercent:listing.platformFeePercent||currentMarketplaceFee(),
            buyerEmail:state.commerce.billingEmail,
            successUrl:`${location.href.split("?")[0]}?market_checkout={CHECKOUT_SESSION_ID}#/market`,
            cancelUrl:location.href
          })
        });
        const payload=await response.json();
        if(!response.ok||!payload.url) throw new Error(payload.error||"Marketplace checkout URL was not returned.");
        window.location.assign(payload.url);
      }catch(error){
        toast(`Checkout failed: ${error.message}`);
      }
    }

    function completeDemoPurchase(id){
      const listing=marketListingById(id);
      if(!listing||libraryHas(id)) return;
      const feePercent=listing.platformFeePercent||currentMarketplaceFee();
      const platformFeeCents=Math.round(listing.priceCents*feePercent/100);
      const order={
        id:`order-demo-${Date.now()}`,
        listingId:listing.id,
        title:listing.title,
        amountCents:listing.priceCents,
        status:"demo-paid",
        provider:"demo",
        createdAt:new Date().toISOString()
      };
      state.commerce.orders.push(order);
      if(listing.creatorLearnerId===state.learner.learnerId){
        state.commerce.sales.push({
          id:`sale-${order.id}`,
          listingId:listing.id,
          title:listing.title,
          amountCents:listing.priceCents,
          platformFeeCents,
          creatorNetCents:listing.priceCents-platformFeeCents,
          status:"demo",
          createdAt:new Date().toISOString()
        });
      }
      addToLibrary({...listing,sourceId:listing.id,orderId:order.id});
      emit("commerce.demo-purchase",{orderId:order.id,listingId:listing.id});
      closeListingDrawer();
      renderCommerce();
      saveState();
      toast("Demo purchase recorded. No money moved.");
    }


    function renderPricing(){
      ensureCommerceState();
      document.getElementById("pricing-grid").innerHTML=Object.values(COMMERCE_PLANS).map(plan=>`
        <article class="pricing-card ${plan.featured?"featured":""}">
          <div class="plan-meta">
            <span>${plan.seats} ${plan.seats===1?"seat":"seats"}</span>
            <span>${plan.marketplaceFeePercent}% market fee</span>
          </div>
          <h3>${escapeHTML(plan.name)}</h3>
          <div class="price">${plan.priceCents?`${formatMoneyFromCents(plan.priceCents)}<small>/mo</small>`:"$0"}</div>
          <p>${escapeHTML(plan.description)}</p>
          <ul>${plan.features.map(feature=>`<li>${escapeHTML(feature)}</li>`).join("")}</ul>
          <button type="button" data-plan-checkout="${escapeHTML(plan.id)}" ${plan.id===currentPlan().id?"disabled":""}>
            ${plan.id===currentPlan().id?"Current plan":plan.priceCents?"Choose plan":"Use free local plan"}
          </button>
        </article>`).join("");
      document.getElementById("pricing-grid").querySelectorAll("[data-plan-checkout]").forEach(button=>
        button.addEventListener("click",()=>{
          const planId=button.dataset.planCheckout;
          if(planId==="commons"){
            applyEntitlementPayload({
              id:`entitlement-commons-${Date.now()}`,
              planId:"commons",
              status:"active",
              source:"local",
              seats:1,
              issuedAt:new Date().toISOString(),
              expiresAt:null,
              aiAllowanceCents:0,
              remainingCents:0
            },"local");
          }else{
            state.commerce.pendingPlanId=planId;
            checkoutPlan(planId);
          }
        })
      );
    }

    function renderBilling(){
      ensureCommerceState();
      const plan=currentPlan();
      const entitlement=state.commerce.entitlement;
      const percent=plan.aiAllowanceCents
        ? Math.max(0,Math.min(100,Number(state.commerce.aiWallet.balanceCents||0)/plan.aiAllowanceCents*100))
        : 0;

      document.getElementById("current-entitlement-card").innerHTML=`
        <span class="tag">${escapeHTML(entitlement.source||"local")} entitlement</span>
        <b>${escapeHTML(plan.name)}</b>
        <span>${entitlementExpiresText()} · ${entitlement.seats||plan.seats} seat${(entitlement.seats||plan.seats)===1?"":"s"}</span>`;

      document.getElementById("ai-wallet-panel").innerHTML=`
        <div class="wallet-amount">${plan.aiAllowanceCents?formatMoneyFromCents(state.commerce.aiWallet.balanceCents):"Local / BYOK"}</div>
        <div class="wallet-meter"><span style="width:${percent}%"></span></div>
        <b>${plan.aiAllowanceCents
          ? `${formatMoneyFromCents(state.commerce.aiWallet.spentCents)} used this period`
          : "No hosted allowance on the Commons plan"}</b>
        <small>${state.commerce.aiWallet.usage.length} metered hosted request${state.commerce.aiWallet.usage.length===1?"":"s"} recorded.</small>`;

      if(document.activeElement?.id!=="billing-email"){
        document.getElementById("billing-email").value=state.commerce.billingEmail||"";
      }
      if(document.activeElement?.id!=="organization-name"){
        document.getElementById("organization-name").value=state.commerce.organization.name||"";
      }
      if(document.activeElement?.id!=="organization-seats"){
        document.getElementById("organization-seats").value=String(state.commerce.organization.seats||25);
      }
      document.getElementById("organization-catalog-mode").value=state.commerce.organization.catalogMode||"public-plus-private";
      document.getElementById("toggle-advanced-mode").textContent=state.commerce.noviceMode!==false?"Show advanced setup":"Return to novice mode";
      renderPricing();
    }

    function renderCommerce(){
      ensureCommerceState();
      renderLaunchpad();
      renderMarketplace();
      renderHumanHelp();
      renderBilling();
      updateCommerceTopStats();
      if(document.getElementById("manifest-preview")) renderManifest();
      if(document.getElementById("event-ledger")) renderEvents();
    }

    function updateCommerceTopStats(){
      ensureCommerceState();
      const plan=currentPlan();
      document.getElementById("top-plan").textContent=plan.name;
      document.getElementById("top-ai-wallet").textContent=plan.aiAllowanceCents
        ? `AI ${formatMoneyFromCents(state.commerce.aiWallet.balanceCents)}`
        : "Local AI";
      updateModelFoundryCurrent();
    }

    function setBillingFeedback(message,kind=""){
      const node=document.getElementById("billing-feedback");
      node.className=`feedback ${kind}`;
      node.textContent=message;
    }

    function paymentLinkFor(planId,provider){
      const config=state.commerce.billingConfig;
      if(provider==="paypal") return config.paypalLinks?.[planId]||"";
      return config.stripeLinks?.[planId]||"";
    }

    async function checkoutPlan(planId){
      ensureCommerceState();
      const plan=planFor(planId);
      state.commerce.pendingPlanId=plan.id;
      state.commerce.billingEmail=document.getElementById("billing-email").value.trim();
      if(!document.getElementById("billing-terms").checked){
        setBillingFeedback("Accept the configured policies before opening checkout.","fail");
        return;
      }
      const provider=document.getElementById("checkout-provider").value;
      const base=commerceBrokerBase();
      try{
        if(base){
          const response=await fetch(`${base}/v1/billing/checkout`,{
            method:"POST",
            headers:{"content-type":"application/json"},
            body:JSON.stringify({
              schema:"living-academy-checkout-request-1.0",
              planId:plan.id,
              provider,
              email:state.commerce.billingEmail,
              learnerId:state.learner.learnerId,
              successUrl:`${location.href.split("?")[0]}?checkout_session_id={CHECKOUT_SESSION_ID}#/admin/billing-panel`,
              cancelUrl:location.href
            })
          });
          const payload=await response.json();
          if(!response.ok||!payload.url) throw new Error(payload.error||"Checkout URL was not returned.");
          setBillingFeedback(`Opening ${provider} checkout for ${plan.name}.`,"pass");
          const destination=safeExternalURL(payload.url);if(!destination)throw new Error("The checkout URL is unsafe.");
          window.location.assign(destination);
          return;
        }

        const link=paymentLinkFor(plan.id,provider);
        if(link){
          setBillingFeedback(`Opening the configured ${provider} payment page. Import the resulting receipt if automatic claim is unavailable.`,"pass");
          const destination=safeExternalURL(link);if(!destination)throw new Error("The payment URL is unsafe.");
          window.open(destination,"_blank","noopener");
          return;
        }

        setBillingFeedback("No verified checkout is configured. The operator can add a broker or provider payment link. Demo activation is available for testing.","fail");
      }catch(error){
        setBillingFeedback(`Checkout failed: ${error.message}`,"fail");
      }finally{
        saveState();
      }
    }

    function applyEntitlementPayload(payload,source="signed-receipt"){
      ensureCommerceState();
      const plan=planFor(payload.planId);
      const expiresAt=payload.expiresAt||null;
      if(expiresAt&&Date.parse(expiresAt)<=Date.now()) throw new Error("The entitlement is expired.");
      state.commerce.planId=plan.id;
      state.commerce.entitlement={
        schema:"living-academy-entitlement-1.0",
        id:String(payload.id||`entitlement-${Date.now()}`),
        planId:plan.id,
        status:String(payload.status||"active"),
        source:String(payload.source||source),
        issuedAt:String(payload.issuedAt||new Date().toISOString()),
        expiresAt,
        seats:Number(payload.seats||plan.seats),
        buyerEmail:String(payload.buyerEmail||state.commerce.billingEmail||""),
        accessToken:String(payload.accessToken||"")
      };
      state.commerce.aiWallet={
        ...state.commerce.aiWallet,
        allowanceCents:Number(payload.aiAllowanceCents??plan.aiAllowanceCents),
        balanceCents:Number(payload.remainingCents??payload.aiAllowanceCents??plan.aiAllowanceCents),
        spentCents:Number(payload.spentCents||0),
        periodStart:String(payload.periodStart||new Date().toISOString()),
        periodEnd:String(payload.periodEnd||expiresAt||"")
      };
      if(payload.libraryItem) addToLibrary(payload.libraryItem);
      emit("commerce.entitlement-applied",{entitlementId:state.commerce.entitlement.id,planId:plan.id,source});
      renderCommerce();
      saveState();
      setBillingFeedback(`${plan.name} entitlement applied. Hosted AI allowance: ${formatMoneyFromCents(state.commerce.aiWallet.balanceCents)}.`,"pass");
      return state.commerce.entitlement;
    }

    function activateDemoEntitlement(){
      const plan=planFor(state.commerce.pendingPlanId||"individual");
      if(plan.id==="commons"){
        applyEntitlementPayload({planId:"commons",source:"local",status:"active",remainingCents:0},"local");
        return;
      }
      const expires=new Date();
      expires.setDate(expires.getDate()+30);
      applyEntitlementPayload({
        id:`entitlement-demo-${Date.now()}`,
        planId:plan.id,
        status:"active",
        source:"demo",
        issuedAt:new Date().toISOString(),
        expiresAt:expires.toISOString(),
        seats:plan.seats,
        buyerEmail:document.getElementById("billing-email").value.trim(),
        aiAllowanceCents:plan.aiAllowanceCents,
        remainingCents:plan.aiAllowanceCents,
        accessToken:"demo-access-token"
      },"demo");
      setBillingFeedback(`Demo ${plan.name} entitlement activated. This does not verify or simulate a real payment.`,"pass");
    }

    async function manageSubscription(){
      const base=commerceBrokerBase();
      try{
        if(base){
          const response=await fetch(`${base}/v1/billing/portal`,{
            method:"POST",
            headers:{
              "content-type":"application/json",
              ...(state.commerce.entitlement.accessToken?{"authorization":`Bearer ${state.commerce.entitlement.accessToken}`}:{})
            },
            body:JSON.stringify({
              entitlementId:state.commerce.entitlement.id,
              email:state.commerce.billingEmail,
              returnUrl:location.href
            })
          });
          const payload=await response.json();
          if(!response.ok||!payload.url) throw new Error(payload.error||"Portal URL was not returned.");
          const destination=safeExternalURL(payload.url);if(!destination)throw new Error("The portal URL is unsafe.");
          window.location.assign(destination);
          return;
        }
        const portal=state.commerce.billingConfig.customerPortalUrl;
        if(portal){
          const destination=safeExternalURL(portal);if(!destination)throw new Error("The portal URL is unsafe.");
          window.open(destination,"_blank","noopener");
          return;
        }
        throw new Error("No customer portal is configured.");
      }catch(error){
        setBillingFeedback(error.message,"fail");
      }
    }

    async function buyAiTopup(){
      const base=commerceBrokerBase();
      try{
        if(base){
          const response=await fetch(`${base}/v1/billing/topup`,{
            method:"POST",
            headers:{
              "content-type":"application/json",
              ...(state.commerce.entitlement.accessToken?{"authorization":`Bearer ${state.commerce.entitlement.accessToken}`}:{})
            },
            body:JSON.stringify({
              entitlementId:state.commerce.entitlement.id,
              amountCents:500,
              email:state.commerce.billingEmail,
              successUrl:`${location.href.split("?")[0]}?checkout_session_id={CHECKOUT_SESSION_ID}#/admin/billing-panel`,
              cancelUrl:location.href
            })
          });
          const payload=await response.json();
          if(!response.ok||!payload.url) throw new Error(payload.error||"Top-up URL was not returned.");
          const destination=safeExternalURL(payload.url);if(!destination)throw new Error("The top-up URL is unsafe.");
          window.location.assign(destination);
          return;
        }
        const link=state.commerce.billingConfig.stripeLinks.topup;
        if(link){
          const destination=safeExternalURL(link);if(!destination)throw new Error("The top-up URL is unsafe.");
          window.open(destination,"_blank","noopener");
          return;
        }
        if(state.commerce.demoMode){
          state.commerce.aiWallet.balanceCents+=500;
          state.commerce.aiWallet.allowanceCents+=500;
          renderCommerce();
          saveState();
          setBillingFeedback("Added a demo $5.00 AI allowance. No payment occurred.","pass");
          return;
        }
        throw new Error("No AI top-up checkout is configured.");
      }catch(error){
        setBillingFeedback(error.message,"fail");
      }
    }

    function selectHostedAI(){
      if(!hostedEntitlementIsActive()){
        state.commerce.pendingPlanId="individual";
        setBillingFeedback("Choose a paid plan or apply a signed entitlement before selecting hosted AI.","fail");
        return;
      }
      document.body.classList.add("novice-mode");
      state.commerce.noviceMode=true;
      document.getElementById("model-provider").value="hosted";
      applyProviderDefaults("hosted");
      setModelStatus(`Hosted Gemini selected. ${formatMoneyFromCents(state.commerce.aiWallet.balanceCents)} allowance remains.`,"good");
      saveState();
    }

    function selectLocalAI(){
      document.getElementById("model-provider").value="browser";
      applyProviderDefaults("browser");
      setModelStatus("Local/browser-native AI selected. Ollama and GGUF remain available in advanced model settings.","good");
      saveState();
    }

    function canonicalJson(value){
      if(value===null||typeof value!=="object") return JSON.stringify(value);
      if(Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
      return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
    }

    function base64UrlBytes(value){
      const normalized=String(value||"").replace(/-/g,"+").replace(/_/g,"/");
      const padding="=".repeat((4-normalized.length%4)%4);
      const binary=atob(normalized+padding);
      return Uint8Array.from(binary,char=>char.charCodeAt(0));
    }

    async function verifySignedReceipt(receipt){
      ensureCommerceState();
      if(receipt?.demo===true&&state.commerce.demoMode){
        return receipt.payload||receipt;
      }
      if(receipt?.schema!=="living-academy-signed-entitlement-1.0") throw new Error("Unsupported signed receipt schema.");
      if(!receipt.payload||!receipt.signature) throw new Error("The receipt is missing its payload or signature.");
      const jwkText=state.commerce.billingConfig.publicJwk;
      if(!jwkText) throw new Error("The operator has not configured an entitlement verification public key.");
      let jwk;
      try{jwk=JSON.parse(jwkText);}catch{throw new Error("The configured public JWK is not valid JSON.");}
      const key=await crypto.subtle.importKey(
        "jwk",
        jwk,
        {name:"ECDSA",namedCurve:"P-256"},
        false,
        ["verify"]
      );
      const valid=await crypto.subtle.verify(
        {name:"ECDSA",hash:"SHA-256"},
        key,
        base64UrlBytes(receipt.signature),
        new TextEncoder().encode(canonicalJson(receipt.payload))
      );
      if(!valid) throw new Error("The entitlement signature is invalid.");
      return receipt.payload;
    }

    function applyMarketplacePurchaseReceipt(payload){
      const listing=marketListingById(payload.listingId);
      const orderId=String(payload.orderId||`order-${Date.now()}`);
      if(!state.commerce.orders.some(order=>order.id===orderId)){
        state.commerce.orders.push({
          id:orderId,
          listingId:String(payload.listingId||""),
          title:String(payload.title||listing?.title||"Purchased pathway"),
          amountCents:Number(payload.amountCents||listing?.priceCents||0),
          status:String(payload.status||"paid"),
          provider:String(payload.provider||"broker"),
          createdAt:String(payload.createdAt||new Date().toISOString())
        });
      }
      const libraryItem=payload.libraryItem||{
        id:`library-${orderId}`,
        sourceId:String(payload.listingId||listing?.id||orderId),
        title:String(payload.title||listing?.title||"Purchased pathway"),
        kind:String(payload.kindName||listing?.kind||"learning-path"),
        creatorName:String(payload.creatorName||listing?.creatorName||"Marketplace creator"),
        acquiredAt:String(payload.createdAt||new Date().toISOString()),
        license:String(payload.license||listing?.license||"personal"),
        certification:Boolean(payload.certification||listing?.certification||listing?.kind==="certification"),
        orderId,
        schoolSnapshot:listing?.schoolSnapshot?deepClone(listing.schoolSnapshot):null
      };
      addToLibrary({...libraryItem,sourceId:libraryItem.sourceId||payload.listingId});
      emit("commerce.purchase-receipt-applied",{orderId,listingId:payload.listingId});
      renderCommerce();
      saveState();
      return libraryItem;
    }

    function applyTopupReceipt(payload){
      const amount=Number(payload.topupCents||payload.amountCents||0);
      if(amount<=0) throw new Error("The AI top-up receipt has no positive allowance.");
      state.commerce.aiWallet.balanceCents=Number(state.commerce.aiWallet.balanceCents||0)+amount;
      state.commerce.aiWallet.allowanceCents=Number(state.commerce.aiWallet.allowanceCents||0)+amount;
      state.commerce.aiWallet.usage.push({
        id:String(payload.orderId||`topup-${Date.now()}`),
        at:String(payload.createdAt||new Date().toISOString()),
        model:"wallet-topup",
        costCents:-amount,
        inputTokens:0,
        outputTokens:0,
        purpose:"ai-topup"
      });
      emit("commerce.ai-topup-applied",{amountCents:amount,orderId:payload.orderId||null});
      renderCommerce();
      saveState();
      setBillingFeedback(`${formatMoneyFromCents(amount)} was added to the hosted AI wallet.`,"pass");
      return state.commerce.aiWallet;
    }

    function applyExpertServiceReceipt(payload){
      const request=requestById(payload.requestId);const service=serviceById(payload.serviceId);if(!request||!service)throw new Error("The human-service receipt references an unavailable request or service.");
      const engagement=createEngagement(request.id,service.id,{paid:true,scheduledAt:payload.scheduledAt||null});engagement.paymentProvider=payload.provider||"broker";engagement.paymentReceiptId=payload.orderId||null;renderHumanHelp();saveState();return engagement;
    }

    async function verifyAndApplyEntitlement(receipt){
      const payload=await verifySignedReceipt(receipt);
      const kind=String(payload.kind||"plan-entitlement");
      if(kind==="marketplace-purchase") return applyMarketplacePurchaseReceipt(payload);
      if(kind==="expert-service-purchase") return applyExpertServiceReceipt(payload);
      if(kind==="ai-topup") return applyTopupReceipt(payload);
      return applyEntitlementPayload(payload,receipt?.demo?"demo-receipt":"signed-receipt");
    }

    async function verifyEntitlementFromTextarea(){
      const feedback=document.getElementById("entitlement-feedback");
      try{
        const receipt=JSON.parse(document.getElementById("entitlement-receipt").value);
        const kind=String(receipt?.payload?.kind||receipt?.kind||"plan-entitlement");
        await verifyAndApplyEntitlement(receipt);
        const messages={
          "plan-entitlement":`${currentPlan().name} plan entitlement verified and applied.`,
          "ai-topup":`AI top-up verified. The wallet now contains ${formatMoneyFromCents(state.commerce.aiWallet.balanceCents)}.`,
          "marketplace-purchase":`Marketplace purchase verified and added to the learning library.`,
          "expert-service-purchase":`Human-service purchase verified and booked.`
        };
        feedback.className="feedback pass";
        feedback.textContent=messages[kind]||"Signed receipt verified and applied.";
      }catch(error){
        feedback.className="feedback fail";
        feedback.textContent=`Entitlement rejected: ${error.message}`;
      }
    }

    function exportEntitlement(){
      download(
        `${slug(state.commerce.entitlement.planId)}-entitlement.json`,
        JSON.stringify({
          schema:"living-academy-entitlement-export-1.0",
          exportedAt:new Date().toISOString(),
          entitlement:state.commerce.entitlement,
          aiWallet:state.commerce.aiWallet
        },null,2),
        "application/json;charset=utf-8"
      );
    }

    function saveOrganization(){
      state.commerce.organization={
        name:document.getElementById("organization-name").value.trim(),
        seats:Number(document.getElementById("organization-seats").value||25),
        catalogMode:document.getElementById("organization-catalog-mode").value
      };
      emit("commerce.organization-saved",{name:state.commerce.organization.name,seats:state.commerce.organization.seats});
      renderCommerce();
      saveState();
      toast("Organization profile saved.");
    }

    function exportOrganizationVoucherRequest(){
      const organization=state.commerce.organization;
      download(
        `${slug(organization.name||"organization")}-voucher-request.json`,
        JSON.stringify({
          schema:"living-academy-organization-voucher-request-1.0",
          requestedAt:new Date().toISOString(),
          organization,
          requestedPlan:"institution",
          learnerId:state.learner.learnerId,
          billingEmail:state.commerce.billingEmail,
          publicCatalogKeys:(state.commerce.library||[]).map(item=>item.sourceId)
        },null,2),
        "application/json;charset=utf-8"
      );
    }

    function hydrateCommerceSettingsUI(){
      ensureCommerceState();
      const config=state.commerce.billingConfig;
      document.getElementById("billing-broker-endpoint").value=config.brokerEndpoint||"";
      document.getElementById("stripe-individual-link").value=config.stripeLinks.individual||"";
      document.getElementById("stripe-creator-link").value=config.stripeLinks.creator||"";
      document.getElementById("stripe-institution-link").value=config.stripeLinks.institution||"";
      document.getElementById("stripe-topup-link").value=config.stripeLinks.topup||"";
      document.getElementById("paypal-individual-link").value=config.paypalLinks.individual||"";
      document.getElementById("paypal-creator-link").value=config.paypalLinks.creator||"";
      document.getElementById("paypal-institution-link").value=config.paypalLinks.institution||"";
      document.getElementById("customer-portal-link").value=config.customerPortalUrl||"";
      document.getElementById("connect-onboarding-link").value=config.connectOnboardingUrl||"";
      document.getElementById("marketplace-fee").value=String(config.platformFeePercent||12);
      document.getElementById("entitlement-public-jwk").value=config.publicJwk||"";
      document.getElementById("policy-links-json").value=JSON.stringify(config.policies||{},null,2);
      document.getElementById("billing-email").value=state.commerce.billingEmail||"";
    }

    function saveOperatorConfig(){
      const feedback=document.getElementById("operator-feedback");
      try{
        const policies=JSON.parse(document.getElementById("policy-links-json").value||"{}");
        state.commerce.billingConfig={
          ...state.commerce.billingConfig,
          brokerEndpoint:document.getElementById("billing-broker-endpoint").value.trim().replace(/\/+$/,""),
          stripeLinks:{
            individual:document.getElementById("stripe-individual-link").value.trim(),
            creator:document.getElementById("stripe-creator-link").value.trim(),
            institution:document.getElementById("stripe-institution-link").value.trim(),
            topup:document.getElementById("stripe-topup-link").value.trim()
          },
          paypalLinks:{
            individual:document.getElementById("paypal-individual-link").value.trim(),
            creator:document.getElementById("paypal-creator-link").value.trim(),
            institution:document.getElementById("paypal-institution-link").value.trim()
          },
          customerPortalUrl:document.getElementById("customer-portal-link").value.trim(),
          connectOnboardingUrl:document.getElementById("connect-onboarding-link").value.trim(),
          platformFeePercent:Number(document.getElementById("marketplace-fee").value||12),
          publicJwk:document.getElementById("entitlement-public-jwk").value.trim(),
          policies
        };
        feedback.className="feedback pass";
        feedback.textContent="Operator settings saved locally. No secret keys are stored in the page.";
        hydrateModelSettingsUI();
        renderCommerce();
        saveState();
      }catch(error){
        feedback.className="feedback fail";
        feedback.textContent=`Configuration rejected: ${error.message}`;
      }
    }

    async function testCommerceBroker(){
      const feedback=document.getElementById("operator-feedback");
      const base=document.getElementById("billing-broker-endpoint").value.trim().replace(/\/+$/,"");
      if(!base){
        feedback.className="feedback fail";
        feedback.textContent="Enter a broker endpoint first.";
        return;
      }
      try{
        const response=await fetch(`${base}/v1/health`);
        const payload=await response.json();
        if(!response.ok) throw new Error(payload.error||`HTTP ${response.status}`);
        feedback.className="feedback pass";
        feedback.textContent=`Broker online: ${payload.service||"Living Academy broker"} · ${payload.mode||"production"}.`;
      }catch(error){
        feedback.className="feedback fail";
        feedback.textContent=`Broker probe failed: ${error.message}`;
      }
    }

    function resetCommerceDemo(){
      state.commerce=defaultCommerceState();
      ensureCommerceState();
      hydrateCommerceSettingsUI();
      renderCommerce();
      saveState();
      toast("Commerce and onboarding demo state reset.");
    }

    async function claimCheckoutReturn(){
      const params=new URLSearchParams(location.search);
      const sessionId=params.get("checkout_session_id")||params.get("market_checkout");
      if(!sessionId) return;
      const base=commerceBrokerBase();
      if(!base) return;
      try{
        const response=await fetch(`${base}/v1/billing/receipt?session_id=${encodeURIComponent(sessionId)}`,{
          headers:state.commerce.entitlement.accessToken?{"authorization":`Bearer ${state.commerce.entitlement.accessToken}`}:{}
        });
        const receipt=await response.json();
        if(!response.ok) throw new Error(receipt.error||"Receipt claim failed.");
        await verifyAndApplyEntitlement(receipt);
        history.replaceState(null,"",location.pathname+location.hash);
        setBillingFeedback(`Checkout receipt claimed and verified: ${receipt.payload?.kind||"entitlement"}.`,"pass");
      }catch(error){
        setBillingFeedback(`Checkout completed, but receipt claim failed: ${error.message}`,"fail");
      }
    }

    function openOnboarding(){
      ensureCommerceState();
      onboardingDraft=deepClone(state.commerce.onboarding);
      onboardingDraft.step=0;
      document.getElementById("onboarding-overlay").hidden=false;
      renderOnboardingStep();
    }

    function closeOnboarding(){
      document.getElementById("onboarding-overlay").hidden=true;
    }

    function onboardingChoiceMarkup(value,title,description,selected){
      return `<button type="button" class="onboarding-choice ${selected?"selected":""}" data-onboarding-choice="${escapeHTML(value)}">
        <b>${escapeHTML(title)}</b><span>${escapeHTML(description)}</span>
      </button>`;
    }

    function renderOnboardingStep(){
      if(!onboardingDraft) onboardingDraft=deepClone(state.commerce.onboarding);
      const step=Math.max(0,Math.min(4,Number(onboardingDraft.step||0)));
      onboardingDraft.step=step;
      const progress=document.getElementById("onboarding-progress");
      progress.style.gridTemplateColumns="repeat(5,1fr)";
      progress.innerHTML=Array.from({length:5},(_,index)=>`<span class="${index<=step?"active":""}"></span>`).join("");
      const body=document.getElementById("onboarding-body");
      const next=document.getElementById("onboarding-next");
      const back=document.getElementById("onboarding-back");
      back.disabled=step===0;
      next.textContent=step===4?"Build my route":"Continue";

      if(step===0){
        body.innerHTML=`
          <span class="tag">1 · Your goal</span>
          <h3>What should this academy help you accomplish?</h3>
          <label for="onboarding-name">Name shown in your local learner passport</label>
          <input id="onboarding-name" type="text" value="${escapeHTML(onboardingDraft.displayName||state.learner.displayName)}">
          <label for="onboarding-goal">Goal, curiosity, project, or capability</label>
          <textarea id="onboarding-goal" placeholder="Examples: learn enough JavaScript to build a small app; teach our cooperative how to facilitate meetings; pass GED math...">${escapeHTML(onboardingDraft.goal||"")}</textarea>`;
      }else if(step===1){
        const roles=[
          ["learner","Learner","Follow pathways and demonstrate capability."],
          ["creator","Expert creator","Turn expertise into teachable commerce."],
          ["facilitator","Facilitator","Run cohorts, practice, and peer review."],
          ["institution","Institution","Operate private catalogs and multiple roles."],
          ["offline","Offline explorer","Keep models, schools, purchases, and credentials local."]
        ];
        body.innerHTML=`<span class="tag">2 · Your role</span><h3>Which doorway should be closest?</h3><div class="onboarding-choice-grid">${roles.map(([id,title,description])=>onboardingChoiceMarkup(id,title,description,onboardingDraft.role===id)).join("")}</div>`;
      }else if(step===2){
        const modes=[
          ["hosted","Commonweave Intelligence","The hosted campus handles research and model providers. No learner API keys or provider setup."],
          ["local","Local Intelligence","Use a local model when privacy, offline work, or community ownership matters most."],
          ["manual","Manual exchange","Copy a bounded prompt to another model and paste validated JSON back."]
        ];
        if(!["hosted","local","manual"].includes(onboardingDraft.aiMode))onboardingDraft.aiMode="hosted";
        body.innerHTML=`<span class="tag">3 · Intelligence</span><h3>How should Moss think?</h3><div class="onboarding-choice-grid">${modes.map(([id,title,description])=>onboardingChoiceMarkup(id,title,description,onboardingDraft.aiMode===id)).join("")}</div><p class="help">Advanced self-hosters can still configure personal providers later. Normal learners never need provider keys.</p>`;
      }else if(step===3){
        body.innerHTML=`<span class="tag">4 · Plan</span><h3>Local freedom or hosted convenience?</h3><div class="onboarding-choice-grid">${Object.values(COMMERCE_PLANS).map(plan=>onboardingChoiceMarkup(plan.id,`${plan.name} · ${plan.priceCents?`${formatMoneyFromCents(plan.priceCents)}/mo`:"Free"}`,plan.description,onboardingDraft.planId===plan.id)).join("")}</div>`;
      }else{
        const templates=STARTER_TEMPLATES.slice(0,8);
        body.innerHTML=`<span class="tag">5 · First subject</span><h3>Choose a starter or begin from your own goal.</h3><div class="onboarding-choice-grid">${onboardingChoiceMarkup("","Use my own goal","Open the curriculum studio with the goal you entered.",!onboardingDraft.selectedTemplateId)}${templates.map(template=>onboardingChoiceMarkup(template.id,template.title,template.outcome,onboardingDraft.selectedTemplateId===template.id)).join("")}</div>`;
      }

      body.querySelectorAll("[data-onboarding-choice]").forEach(button=>{
        button.addEventListener("click",()=>{
          const value=button.dataset.onboardingChoice;
          if(step===1) onboardingDraft.role=value;
          if(step===2) onboardingDraft.aiMode=value;
          if(step===3) onboardingDraft.planId=value;
          if(step===4) onboardingDraft.selectedTemplateId=value;
          renderOnboardingStep();
        });
      });
    }

    function saveOnboardingCurrentFields(){
      if(!onboardingDraft) return;
      if(onboardingDraft.step===0){
        onboardingDraft.displayName=document.getElementById("onboarding-name")?.value.trim()||"Local learner";
        onboardingDraft.goal=document.getElementById("onboarding-goal")?.value.trim()||"Learn something useful";
      }
    }

    function finishOnboarding(){
      saveOnboardingCurrentFields();
      onboardingDraft.completed=true;
      state.commerce.onboarding=deepClone(onboardingDraft);
      state.commerce.noviceMode=true;
      document.body.classList.add("novice-mode");
      state.learner.displayName=onboardingDraft.displayName||state.learner.displayName;
      state.commerce.pendingPlanId=onboardingDraft.planId||"commons";

      if(onboardingDraft.aiMode==="hosted"){
        document.getElementById("model-provider").value="hosted";
        if(onboardingDraft.planId==="commons") state.commerce.pendingPlanId="individual";
      }else if(onboardingDraft.aiMode==="manual"){
        document.getElementById("model-provider").value="manual";
      }else{
        document.getElementById("model-provider").value="browser";
        applyProviderDefaults("browser");
      }

      closeOnboarding();
      emit("commerce.onboarding-completed",{
        role:onboardingDraft.role,
        aiMode:onboardingDraft.aiMode,
        planId:onboardingDraft.planId
      });

      if(onboardingDraft.selectedTemplateId){
        selectStarterTemplate(onboardingDraft.selectedTemplateId);
      }else if(onboardingDraft.role==="creator"){
        document.getElementById("school-subject").value=onboardingDraft.goal;
        setWorkspace("studio",{focusId:"school-builder"});
      }else if(onboardingDraft.role==="institution"){
        setWorkspace("admin",{focusId:"billing-panel"});
      }else if(onboardingDraft.aiMode==="hosted"&&!hostedEntitlementIsActive()){
        setWorkspace("admin",{focusId:"billing-panel"});
      }else if(onboardingDraft.role==="learner"){
        setWorkspace("market");
      }else{
        setWorkspace("home");
      }

      renderSchool();
      saveState();
      const goal=onboardingDraft.goal||"Learn something useful";
      setTimeout(()=>launchFrictionlessSchool(goal,{fromOnboarding:true}),180);
    }

    function onboardingNext(){
      saveOnboardingCurrentFields();
      if(onboardingDraft.step<4){
        onboardingDraft.step++;
        renderOnboardingStep();
      }else{
        finishOnboarding();
      }
    }

    function onboardingBack(){
      saveOnboardingCurrentFields();
      onboardingDraft.step=Math.max(0,onboardingDraft.step-1);
      renderOnboardingStep();
    }

    function skipOnboarding(){
      state.commerce.onboarding={
        ...state.commerce.onboarding,
        completed:true,
        role:"offline",
        aiMode:"local",
        planId:"commons"
      };
      state.commerce.noviceMode=true;
      document.getElementById("model-provider").value="browser";
      closeOnboarding();
      setWorkspace("home");
      renderCommerce();
      saveState();
    }


    function helpTypeOptions(){
      return Object.values(HELP_TYPES).map(item=>`<option value="${item.id}">${escapeHTML(item.label)}</option>`).join("");
    }

    function allExpertServices(){
      ensureCommerceState();
      return [...SEEDED_EXPERT_SERVICES,...state.commerce.expertServices].filter(item=>item.status==="published");
    }

    function currentHelpDraft(){
      return {
        type:document.getElementById("help-request-type").value,
        title:document.getElementById("help-request-title").value.trim(),
        skill:document.getElementById("help-request-skill").value.trim(),
        description:document.getElementById("help-request-description").value.trim(),
        artifactUrl:document.getElementById("help-request-artifact").value.trim(),
        budgetCents:Math.round(Number(document.getElementById("help-request-budget").value||0)*100),
        deadline:document.getElementById("help-request-deadline").value,
        privacy:document.getElementById("help-request-privacy").value,
        timezone:document.getElementById("help-request-timezone").value.trim()||"America/New_York",
        availability:document.getElementById("help-request-availability").value.trim(),
        consent:document.getElementById("help-request-consent").checked
      };
    }

    function validateHelpDraft(draft){
      const errors=[];
      if(!HELP_TYPES[draft.type]) errors.push("Choose a supported help type.");
      if(!draft.title) errors.push("Add a short request title.");
      if(!draft.skill) errors.push("Name the subject or skill.");
      if(draft.description.length<20) errors.push("Add enough context for an expert to estimate the work.");
      if(!draft.consent) errors.push("Accept the scope and sharing statement.");
      if(draft.artifactUrl){try{new URL(draft.artifactUrl);}catch{errors.push("The artifact link is not a valid URL.");}}
      return errors;
    }

    function saveHelpRequest({status="open"}={}){
      const draft=currentHelpDraft();
      const errors=validateHelpDraft(draft);
      const feedback=document.getElementById("help-request-feedback");
      if(errors.length){feedback.className="feedback fail";feedback.textContent=errors.join(" ");return null;}
      let request=state.commerce.helpRequests.find(item=>item.id===state.commerce.selectedHelpRequestId);
      if(request){Object.assign(request,draft,{status,updatedAt:new Date().toISOString()});}
      else{
        request={id:`help-${Date.now()}-${slug(draft.title)}`,...draft,status,learnerId:state.learner.learnerId,learnerName:state.learner.displayName,createdAt:new Date().toISOString(),matchedServiceIds:[]};
        state.commerce.helpRequests.push(request);
        state.commerce.selectedHelpRequestId=request.id;
        emit("help.request-created",{requestId:request.id,type:request.type,budgetCents:request.budgetCents});
      }
      feedback.className="feedback pass";
      feedback.textContent=`Saved ${request.title}.`;
      renderHumanHelp();saveState();return request;
    }

    function tokenizeSkill(text){
      return String(text||"").toLowerCase().split(/[^a-z0-9+#]+/).filter(token=>token.length>1);
    }

    function matchExpertServices(request){
      const requestTokens=new Set(tokenizeSkill(`${request.skill} ${request.title} ${request.description}`));
      return allExpertServices().filter(service=>service.type===request.type).map(service=>{
        const skillTokens=new Set(tokenizeSkill((service.skills||[]).join(" ")));
        const overlap=[...requestTokens].filter(token=>skillTokens.has(token));
        const skillScore=Math.min(45,overlap.length*12);
        const budgetScore=request.budgetCents<=0?15:service.priceCents<=request.budgetCents?20:Math.max(0,20-Math.ceil((service.priceCents-request.budgetCents)/500)*5);
        const reputationScore=Math.min(20,Math.round((Number(service.rating||0)/5)*12)+Math.min(8,Math.floor(Number(service.completed||0)/20)));
        const responseScore=Math.max(0,10-Math.floor(Number(service.responseHours||24)/6));
        const availabilityScore=service.capacity>0?5:0;
        return {...service,matchScore:skillScore+budgetScore+reputationScore+responseScore+availabilityScore,matchReasons:[overlap.length?`${overlap.length} skill match${overlap.length===1?"":"es"}`:"service-type match",service.priceCents<=request.budgetCents||!request.budgetCents?"within budget":"above budget",`${service.rating||"new"} rating`,service.turnaround]};
      }).sort((a,b)=>b.matchScore-a.matchScore||a.priceCents-b.priceCents);
    }

    function candidateHelpSlots(service,request){
      if(!HELP_TYPES[service.type]?.live) return [];
      const slots=[];
      const base=new Date();
      const hours=[18,19,10,14,17];
      for(let offset=1;slots.length<3&&offset<10;offset++){
        const date=new Date(base);
        date.setDate(base.getDate()+offset);
        if(date.getDay()===0) continue;
        date.setHours(hours[offset%hours.length],0,0,0);
        slots.push(date.toISOString());
      }
      return slots;
    }

    function slotOptionsMarkup(service,request){
      const slots=candidateHelpSlots(service,request);
      if(!slots.length) return "";
      return `<label>Choose a provisional slot<select data-help-slot>${slots.map(slot=>`<option value="${escapeHTML(slot)}">${new Date(slot).toLocaleString()} · ${escapeHTML(request.timezone||"local time")}</option>`).join("")}</select></label>`;
    }

    function renderExpertMatchCard(service,request,index){
      return `<article class="expert-match-card ${index===0?"recommended":""}">
        <div class="match-score-row"><span>${service.matchScore}/100 match</span>${service.matchReasons.map(reason=>`<span>${escapeHTML(reason)}</span>`).join("")}</div>
        <h3>${escapeHTML(service.title)}</h3>
        <p><b>${escapeHTML(service.expertName)}</b> · ${escapeHTML(service.description)}</p>
        <div class="expert-badges">${(service.badges||[]).map(badge=>`<span>${escapeHTML(badge)}</span>`).join("")}</div>
        <div class="service-price">${formatMoneyFromCents(service.priceCents)}</div>
        ${slotOptionsMarkup(service,request)}
        <div class="action-row">
          <button type="button" data-help-hire="${escapeHTML(service.id)}" data-help-request="${escapeHTML(request.id)}">${service.priceCents?"Book service":"Request service"}</button>
          <button type="button" data-help-inspect="${escapeHTML(service.id)}">Inspect</button>
        </div>
      </article>`;
    }

    function runHelpMatching(){
      const request=saveHelpRequest({status:"matching"});
      if(!request) return;
      const matches=matchExpertServices(request);
      request.matchedServiceIds=matches.map(item=>item.id);
      const list=document.getElementById("expert-match-list");
      list.innerHTML=matches.length?matches.map((service,index)=>renderExpertMatchCard(service,request,index)).join(""):`<div class="empty">No exact service-type matches yet. Save the request to the public board or try another help type.</div>`;
      bindHelpHireButtons(list);
      document.getElementById("help-request-feedback").textContent=`Found ${matches.length} matching service${matches.length===1?"":"s"}.`;
      saveState();
    }

    function serviceById(id){return allExpertServices().find(item=>item.id===id)||null;}
    function requestById(id){return state.commerce.helpRequests.find(item=>item.id===id)||null;}

    function engagementMessages(id){return state.commerce.helpMessages.filter(message=>message.engagementId===id);}
    function addEngagementMessage(engagementId,authorRole,text){
      const clean=String(text||"").trim(); if(!clean)return;
      state.commerce.helpMessages.push({id:`message-${Date.now()}`,engagementId,authorRole,text:clean,createdAt:new Date().toISOString()});
      emit("help.message-added",{engagementId,authorRole});renderHumanHelp();saveState();
    }

    function createEngagement(requestId,serviceId,{demo=false,paid=false,scheduledAt=null}={}){
      const request=requestById(requestId); const service=serviceById(serviceId);
      if(!request||!service) throw new Error("The request or service could not be found.");
      const useCredits=Math.min(state.commerce.reviewCredits.balanceCents,service.priceCents);
      const amountDue=Math.max(0,service.priceCents-useCredits);
      if(useCredits){state.commerce.reviewCredits.balanceCents-=useCredits;state.commerce.reviewCredits.ledger.push({id:`credit-use-${Date.now()}`,amountCents:-useCredits,label:`Applied to ${service.title}`,at:new Date().toISOString()});}
      const engagement={id:`engagement-${Date.now()}`,requestId,serviceId,learnerId:state.learner.learnerId,expertId:service.expertId,expertName:service.expertName,title:service.title,type:service.type,amountCents:service.priceCents,creditAppliedCents:useCredits,amountDueCents:amountDue,status:paid||amountDue===0?"booked":"awaiting-payment",paymentProvider:demo?"demo":amountDue===0?"review-credit":"pending",scheduledAt:HELP_TYPES[service.type]?.live?(scheduledAt||new Date(Date.now()+3*24*60*60*1000).toISOString()):null,timezone:request.timezone,privacy:request.privacy,createdAt:new Date().toISOString(),scope:request.description,artifactUrl:request.artifactUrl,delivery:"",meetingLink:HELP_TYPES[service.type]?.live?"https://meet.example.invalid/demo-room":"",revisionCount:0,disputeReason:"",rating:null};
      state.commerce.engagements.push(engagement);request.status="engaged";
      addEngagementMessage(engagement.id,"system",`${service.expertName} was selected for ${service.title}. Scope and payment state are recorded in this contract.`);
      emit("help.engagement-created",{engagementId:engagement.id,status:engagement.status,amountDueCents:amountDue});renderHumanHelp();saveState();return engagement;
    }

    async function hireExpertService(requestId,serviceId,scheduledAt=null){
      const request=requestById(requestId);const service=serviceById(serviceId);if(!request||!service)return;
      const base=commerceBrokerBase();
      const credit=Math.min(state.commerce.reviewCredits.balanceCents,service.priceCents);
      const amountDue=Math.max(0,service.priceCents-credit);
      if(amountDue===0){createEngagement(requestId,serviceId,{paid:true,scheduledAt});toast("Booked with review credits.");return;}
      if(base){
        try{
          const response=await fetch(`${base}/v1/experts/checkout`,{method:"POST",headers:{"content-type":"application/json",...(state.commerce.entitlement.accessToken?{"authorization":`Bearer ${state.commerce.entitlement.accessToken}`}:{})},body:JSON.stringify({requestId,serviceId,title:service.title,amountCents:amountDue,scheduledAt,timezone:request.timezone,expertAccountId:service.connectedAccountId||null,platformFeePercent:currentMarketplaceFee(),successUrl:`${location.href.split("?")[0]}?checkout_session_id={CHECKOUT_SESSION_ID}#/help/engagement-panel`,cancelUrl:location.href})});
          const payload=await response.json();if(!response.ok||!payload.url)throw new Error(payload.error||"No checkout URL was returned.");window.location.assign(payload.url);return;
        }catch(error){toast(`Human service checkout failed: ${error.message}`);return;}
      }
      if(state.commerce.demoMode){createEngagement(requestId,serviceId,{demo:true,paid:true,scheduledAt});toast("Demo booking created. No money moved.");return;}
      toast("The operator has not configured human-service checkout.");
    }

    function bindHelpHireButtons(root=document){
      root.querySelectorAll("[data-help-hire]").forEach(button=>button.addEventListener("click",()=>{
        const card=button.closest(".expert-match-card");
        const scheduledAt=card?.querySelector("[data-help-slot]")?.value||null;
        hireExpertService(button.dataset.helpRequest,button.dataset.helpHire,scheduledAt);
      }));
      root.querySelectorAll("[data-help-inspect]").forEach(button=>button.addEventListener("click",()=>{
        const service=serviceById(button.dataset.helpInspect);if(!service)return;toast(`${service.expertName}: ${service.turnaround} · ${formatMoneyFromCents(service.priceCents)}`);
      }));
    }

    function publishExpertService(){
      const feedback=document.getElementById("expert-service-feedback");
      const profile={displayName:document.getElementById("expert-display-name").value.trim(),bio:document.getElementById("expert-bio").value.trim(),skills:document.getElementById("expert-skills").value.split(",").map(item=>item.trim()).filter(Boolean),termsAccepted:document.getElementById("expert-service-terms").checked};
      if(!profile.displayName||profile.bio.length<25||!profile.skills.length||!profile.termsAccepted){feedback.className="feedback fail";feedback.textContent="Add an expert name, evidence of practice, at least one skill, and accept the service responsibilities.";return;}
      const priceCents=Math.round(Number(document.getElementById("expert-service-price").value||0)*100);
      const service={id:`service-${Date.now()}-${slug(document.getElementById("expert-service-title").value||"expert-service")}`,expertId:state.learner.learnerId,expertName:profile.displayName,title:document.getElementById("expert-service-title").value.trim()||`${HELP_TYPES[document.getElementById("expert-service-type").value].label} with ${profile.displayName}`,type:document.getElementById("expert-service-type").value,description:document.getElementById("expert-service-description").value.trim(),skills:profile.skills,priceCents,duration:document.getElementById("expert-service-duration").value,turnaround:document.getElementById("expert-turnaround").value.trim()||"Arrange with expert",capacity:Number(document.getElementById("expert-capacity").value||4),status:priceCents>0&&!state.commerce.expertProfile.connected?"draft-awaiting-payouts":"published",rating:0,completed:0,responseHours:24,badges:["new service"],createdAt:new Date().toISOString(),source:"local"};
      if(!service.description){feedback.className="feedback fail";feedback.textContent="State what is included and excluded.";return;}
      state.commerce.expertProfile={...state.commerce.expertProfile,...profile};state.commerce.expertServices.push(service);emit("help.service-published",{serviceId:service.id,status:service.status,priceCents});feedback.className="feedback pass";feedback.textContent=service.status==="published"?"Service published in the human-help catalog.":"Service saved as a draft. Connect payouts before taking live payment.";renderHumanHelp();saveState();
    }

    async function connectExpertPayouts(){
      const base=commerceBrokerBase();
      if(base){await beginSellerOnboarding();state.commerce.expertProfile.connected=state.commerce.creator.connected;}
      else if(state.commerce.demoMode){state.commerce.expertProfile.connected=true;state.commerce.expertServices.forEach(service=>{if(service.status==="draft-awaiting-payouts")service.status="published";});renderHumanHelp();saveState();toast("Demo expert payouts connected. No financial account was created.");}
      else toast("No expert payout onboarding is configured.");
    }

    function updateEngagementStatus(id,status,extra={}){
      const engagement=state.commerce.engagements.find(item=>item.id===id);if(!engagement)return;Object.assign(engagement,{status,...extra,updatedAt:new Date().toISOString()});emit("help.engagement-status",{engagementId:id,status});renderHumanHelp();saveState();
    }

    function renderEngagementCard(engagement){
      const messages=engagementMessages(engagement.id);
      const service=serviceById(engagement.serviceId)||{};
      const canDeliver=["booked","in-progress","revision-requested"].includes(engagement.status)&&engagement.expertId===state.learner.learnerId;
      const canLearnerAct=engagement.learnerId===state.learner.learnerId;
      return `<article class="engagement-card" data-engagement-id="${escapeHTML(engagement.id)}">
        <div class="engagement-meta"><span class="engagement-status ${escapeHTML(engagement.status)}">${escapeHTML(engagement.status.replaceAll("-"," "))}</span><span>${formatMoneyFromCents(engagement.amountCents)}</span><span>${escapeHTML(HELP_TYPES[engagement.type]?.label||engagement.type)}</span></div>
        <h3>${escapeHTML(engagement.title)}</h3>
        <p><b>Expert:</b> ${escapeHTML(engagement.expertName)} · <b>Scope:</b> ${escapeHTML(engagement.scope)}</p>
        ${engagement.scheduledAt?`<p><b>Scheduled:</b> ${new Date(engagement.scheduledAt).toLocaleString()} ${safeExternalURL(engagement.meetingLink)?`· <a href="${escapeHTML(safeExternalURL(engagement.meetingLink))}" target="_blank" rel="noopener noreferrer">Meeting link</a>`:""}</p>`:""}
        ${engagement.delivery?`<div class="delivery-box"><b>Expert delivery</b><br>${escapeHTML(engagement.delivery)}</div>`:""}
        <div class="engagement-thread">${messages.length?messages.map(message=>`<div class="thread-message ${escapeHTML(message.authorRole)}"><b>${escapeHTML(message.authorRole)}</b><br>${escapeHTML(message.text)}<br><small>${new Date(message.createdAt).toLocaleString()}</small></div>`).join(""):`<div class="empty">No messages yet.</div>`}</div>
        <textarea data-engagement-message="${escapeHTML(engagement.id)}" placeholder="Add a scoped message, question, or clarification..."></textarea>
        <div class="action-row">
          <button type="button" data-send-engagement-message="${escapeHTML(engagement.id)}">Send message</button>
          ${engagement.status==="booked"?`<button type="button" data-engagement-start="${escapeHTML(engagement.id)}">Start work</button>`:""}
          ${canDeliver?`<button type="button" data-engagement-deliver="${escapeHTML(engagement.id)}">Deliver review</button>`:""}
          ${canLearnerAct&&engagement.status==="delivered"?`<button type="button" data-engagement-approve="${escapeHTML(engagement.id)}">Approve delivery</button><button type="button" data-engagement-revise="${escapeHTML(engagement.id)}">Request revision</button><button type="button" data-engagement-dispute="${escapeHTML(engagement.id)}">Open dispute</button>`:""}
          <button type="button" data-engagement-export="${escapeHTML(engagement.id)}">Export contract</button>
        </div>
        ${canLearnerAct&&engagement.status==="approved"&&!engagement.rating?`<div class="rating-buttons"><b>Rate the service:</b>${[1,2,3,4,5].map(value=>`<button type="button" data-engagement-rate="${escapeHTML(engagement.id)}" data-rating="${value}">${value}</button>`).join("")}</div>`:""}
      </article>`;
    }

    function bindEngagementActions(root=document){
      root.querySelectorAll("[data-send-engagement-message]").forEach(button=>button.addEventListener("click",()=>{const id=button.dataset.sendEngagementMessage;const textarea=root.querySelector(`[data-engagement-message="${CSS.escape(id)}"]`);addEngagementMessage(id,"learner",textarea.value);}));
      root.querySelectorAll("[data-engagement-start]").forEach(button=>button.addEventListener("click",()=>updateEngagementStatus(button.dataset.engagementStart,"in-progress")));
      root.querySelectorAll("[data-engagement-deliver]").forEach(button=>button.addEventListener("click",()=>{const engagement=state.commerce.engagements.find(item=>item.id===button.dataset.engagementDeliver);const delivery=prompt("Enter the review, assessment notes, or delivery summary:",engagement.delivery||"");if(delivery)updateEngagementStatus(engagement.id,"delivered",{delivery,deliveredAt:new Date().toISOString()});}));
      root.querySelectorAll("[data-engagement-approve]").forEach(button=>button.addEventListener("click",()=>updateEngagementStatus(button.dataset.engagementApprove,"approved",{approvedAt:new Date().toISOString()})));
      root.querySelectorAll("[data-engagement-revise]").forEach(button=>button.addEventListener("click",()=>{const id=button.dataset.engagementRevise;const note=prompt("What needs revision?");if(note){const engagement=state.commerce.engagements.find(item=>item.id===id);engagement.revisionCount=Number(engagement.revisionCount||0)+1;addEngagementMessage(id,"learner",`Revision requested: ${note}`);updateEngagementStatus(id,"revision-requested");}}));
      root.querySelectorAll("[data-engagement-dispute]").forEach(button=>button.addEventListener("click",()=>{const id=button.dataset.engagementDispute;const reason=prompt("State the dispute reason. This will be preserved for independent review.");if(reason)updateEngagementStatus(id,"disputed",{disputeReason:reason,disputedAt:new Date().toISOString()});}));
      root.querySelectorAll("[data-engagement-export]").forEach(button=>button.addEventListener("click",()=>{const engagement=state.commerce.engagements.find(item=>item.id===button.dataset.engagementExport);download(`${slug(engagement.title)}-engagement.json`,JSON.stringify({schema:"living-academy-human-engagement-1.0",engagement,messages:engagementMessages(engagement.id)},null,2),"application/json;charset=utf-8");}));
      root.querySelectorAll("[data-engagement-rate]").forEach(button=>button.addEventListener("click",()=>{const engagement=state.commerce.engagements.find(item=>item.id===button.dataset.engagementRate);engagement.rating=Number(button.dataset.rating);emit("help.engagement-rated",{engagementId:engagement.id,rating:engagement.rating});renderHumanHelp();saveState();}));
    }

    function renderHumanHelp(){
      ensureCommerceState();
      const types=Object.values(HELP_TYPES);
      const selects=["help-request-type","expert-service-type","help-service-filter"];
      selects.forEach(id=>{const select=document.getElementById(id);if(!select)return;const current=select.value;select.innerHTML=(id==="help-service-filter"?'<option value="all">All service types</option>':"")+helpTypeOptions();if(current&&[...select.options].some(option=>option.value===current))select.value=current;});
      document.getElementById("help-type-grid").innerHTML=types.map(type=>`<button type="button" class="help-type-card" data-help-type="${escapeHTML(type.id)}"><b>${escapeHTML(type.label)}</b><span>${escapeHTML(type.summary)}</span><small>Typical starting price ${formatMoneyFromCents(type.defaultPriceCents)}</small></button>`).join("");
      document.querySelectorAll("[data-help-type]").forEach(button=>button.addEventListener("click",()=>{document.getElementById("help-request-type").value=button.dataset.helpType;document.getElementById("help-request-budget").value=(HELP_TYPES[button.dataset.helpType].defaultPriceCents/100).toFixed(0);document.getElementById("help-request-builder").scrollIntoView({behavior:"smooth",block:"start"});}));
      const open=state.commerce.engagements.filter(item=>!["approved","cancelled"].includes(item.status)).length;
      document.getElementById("help-value-card").innerHTML=`<b>${open} active</b><span>${allExpertServices().length} human services · ${formatMoneyFromCents(state.commerce.reviewCredits.balanceCents)} review credits</span>`;

      const search=String(state.commerce.helpSearch||"").toLowerCase();const filter=state.commerce.helpServiceFilter||"all";
      const services=allExpertServices().filter(service=>{if(filter!=="all"&&service.type!==filter)return false;const hay=[service.title,service.expertName,service.description,(service.skills||[]).join(" ")].join(" ").toLowerCase();return !search||hay.includes(search);});
      document.getElementById("expert-service-grid").innerHTML=services.length?services.map(service=>`<article class="expert-service-card"><div class="expert-badges"><span>${escapeHTML(HELP_TYPES[service.type]?.label||service.type)}</span><span>${service.rating?`${Number(service.rating)||0} ★`:"New"}</span><span>${Number(service.completed)||0} completed</span></div><h3>${escapeHTML(service.title)}</h3><p><b>${escapeHTML(service.expertName)}</b><br>${escapeHTML(service.description)}</p><div class="expert-badges">${(service.skills||[]).map(skill=>`<span>${escapeHTML(skill)}</span>`).join("")}</div><small>${escapeHTML(service.turnaround)} · ${escapeHTML(service.duration)}</small><div class="service-price">${formatMoneyFromCents(service.priceCents)}</div><button type="button" data-service-prefill="${escapeHTML(service.id)}">Request this service</button></article>`).join(""):`<div class="empty">No services match the filter.</div>`;
      document.querySelectorAll("[data-service-prefill]").forEach(button=>button.addEventListener("click",()=>{const service=serviceById(button.dataset.servicePrefill);document.getElementById("help-request-type").value=service.type;document.getElementById("help-request-skill").value=(service.skills||[]).join(", ");document.getElementById("help-request-title").value=`Request: ${service.title}`;document.getElementById("help-request-budget").value=(service.priceCents/100).toFixed(0);document.getElementById("help-request-builder").scrollIntoView({behavior:"smooth"});}));

      const engagements=[...state.commerce.engagements].reverse();document.getElementById("engagement-list").innerHTML=engagements.length?engagements.map(renderEngagementCard).join(""):`<div class="empty">No human-help contracts yet.</div>`;bindEngagementActions(document.getElementById("engagement-list"));
      document.getElementById("review-credit-summary").innerHTML=`<div class="review-credit-balance">${formatMoneyFromCents(state.commerce.reviewCredits.balanceCents)}</div><p>${escapeHTML(state.commerce.reviewCredits.sponsor||"No sponsor attached")} · ${state.commerce.reviewCredits.ledger.length} ledger entr${state.commerce.reviewCredits.ledger.length===1?"y":"ies"}</p>`;

      const ownRequests=state.commerce.helpRequests.filter(request=>request.learnerId===state.learner.learnerId);const expertOps=state.commerce.engagements.filter(engagement=>engagement.expertId===state.learner.learnerId);document.getElementById("expert-operations").innerHTML=`<div class="academy-stat-grid"><div class="academy-stat"><b>${state.commerce.expertServices.length}</b><span>Services</span></div><div class="academy-stat"><b>${expertOps.length}</b><span>Engagements</span></div><div class="academy-stat"><b>${ownRequests.length}</b><span>Your requests</span></div></div><div class="expert-operations-list">${expertOps.length?expertOps.map(renderEngagementCard).join(""):'<div class="empty">No expert engagements assigned to this local identity.</div>'}</div>`;bindEngagementActions(document.getElementById("expert-operations"));
      document.getElementById("top-human-help").textContent=open?`${open} human help`:"Human help";
    }

    function exportCurrentHelpRequest(){const request=requestById(state.commerce.selectedHelpRequestId);if(!request){toast("Save a help request first.");return;}download(`${slug(request.title)}-help-request.json`,JSON.stringify({schema:"living-academy-help-request-1.0",request},null,2),"application/json;charset=utf-8");}
    function addDemoReviewCredit(){const cents=Math.round(Number(document.getElementById("review-credit-amount").value||0)*100);const sponsor=document.getElementById("review-credit-sponsor").value.trim()||"Demo community fund";if(cents<=0)return;state.commerce.reviewCredits.balanceCents+=cents;state.commerce.reviewCredits.sponsor=sponsor;state.commerce.reviewCredits.ledger.push({id:`credit-${Date.now()}`,amountCents:cents,label:`Funded by ${sponsor}`,at:new Date().toISOString()});emit("help.review-credit-added",{amountCents:cents,sponsor});renderHumanHelp();saveState();toast(`Added ${formatMoneyFromCents(cents)} demo review credits.`);}
    function exportReviewCreditRequest(){download(`review-credit-request-${Date.now()}.json`,JSON.stringify({schema:"living-academy-review-credit-request-1.0",requestedAt:new Date().toISOString(),learnerId:state.learner.learnerId,learnerName:state.learner.displayName,sponsor:document.getElementById("review-credit-sponsor").value.trim(),amountCents:Math.round(Number(document.getElementById("review-credit-amount").value||0)*100),purpose:"Human review and office hours"},null,2),"application/json;charset=utf-8");}


    function conceptSlug(moduleId,term){
      return `concept-${stableHash(`${state.school?.id||"school"}|${moduleId}|${term}`)}`;
    }

    function authoredConceptsForModule(module,moduleIndex){
      const found=[];
      const add=(term,definition,kind="concept")=>{
        term=String(term||"").trim();
        definition=String(definition||"").trim();
        if(!term||found.some(item=>item.term.toLowerCase()===term.toLowerCase())) return;
        found.push({term,definition:definition||module.summary||module.title,kind});
      };
      (Array.isArray(module.concepts)?module.concepts:[]).forEach(item=>{
        if(Array.isArray(item)) add(item[0],item[1],"concept");
        else add(item?.term||item?.title,item?.definition||item?.body,"concept");
      });
      (module.blocks||[]).filter(block=>block.type==="concepts").forEach(block=>(block.items||[]).forEach(item=>add(item.term,item.definition,"concept")));
      if(!found.length){
        (module.objectives||[]).slice(0,4).forEach(objective=>add(objective,module.summary,"objective"));
      }
      if(!found.length) add(module.title,module.summary||`The authored capability represented by module ${moduleIndex+1}.`,"module-capability");
      return found.slice(0,12);
    }

    function syncConstellationToSchool(){
      if(!state?.learner?.constellation||!state.school) return;
      const constellation=state.learner.constellation;
      Object.values(constellation.concepts).forEach(record=>record.active=false);
      let previousModuleConceptIds=[];
      state.school.modules.forEach((module,moduleIndex)=>{
        const authored=authoredConceptsForModule(module,moduleIndex);
        const moduleConceptIds=[];
        authored.forEach((item,itemIndex)=>{
          const id=conceptSlug(module.id,item.term);
          const existing=constellation.concepts[id]||{};
          const prerequisites=[
            ...(itemIndex>0?[moduleConceptIds[itemIndex-1]]:[]),
            ...(itemIndex===0?previousModuleConceptIds.slice(-2):[])
          ].filter(Boolean);
          const artifacts=state.artifacts.filter(artifact=>artifact.moduleId===module.id).map(artifact=>artifact.id);
          const artifactSet=new Set(artifacts);
          const approvedReviews=state.academy?.reviews?.filter(review=>review.status==="approved"&&artifactSet.has(review.artifactId)).map(review=>review.id)||[];
          const credentialRefs=state.badges.filter(badge=>badge.domain===module.domain).map(badge=>badge.id);
          constellation.concepts[id]={
            id,
            schoolId:state.school.id,
            schoolTitle:state.school.title,
            moduleId:module.id,
            moduleTitle:module.title,
            moduleIndex,
            domain:module.domain||"subjectPractice",
            term:item.term,
            definition:item.definition,
            kind:item.kind,
            prerequisites,
            active:true,
            strength:Number(existing.strength??constellation.settings.newConceptStrength??20),
            confidence:Number(existing.confidence??20),
            attempts:Number(existing.attempts||0),
            successes:Number(existing.successes||0),
            failures:Number(existing.failures||0),
            intervalDays:Number(existing.intervalDays||0),
            ease:Number(existing.ease||2.3),
            lastPracticed:existing.lastPracticed||null,
            nextReviewAt:existing.nextReviewAt||new Date().toISOString(),
            lastResult:existing.lastResult||"unseen",
            diagnosticRating:existing.diagnosticRating||null,
            evidenceRefs:[...new Set([...(existing.evidenceRefs||[]),...artifacts,...approvedReviews])],
            credentialRefs:[...new Set([...(existing.credentialRefs||[]),...credentialRefs])],
            history:Array.isArray(existing.history)?existing.history:[]
          };
          moduleConceptIds.push(id);
        });
        previousModuleConceptIds=moduleConceptIds;
      });
      constellation.schoolId=state.school.id;
      constellation.lastBuiltAt=new Date().toISOString();
    }

    function constellationConcepts({activeOnly=true}={}){
      const values=Object.values(state.learner?.constellation?.concepts||{});
      return activeOnly?values.filter(record=>record.active):values;
    }

    function conceptIsDue(record,now=Date.now()){
      const time=Date.parse(record.nextReviewAt||0);
      return !Number.isFinite(time)||time<=now;
    }

    function conceptState(record){
      if(conceptIsDue(record)&&record.attempts>0) return "due";
      if(record.strength>=75) return "strong";
      if(record.attempts>0&&record.strength<45) return "fragile";
      if(record.attempts>0||record.diagnosticRating) return "developing";
      return "new";
    }

    function constellationReviewQueue(){
      if(!state?.learner?.constellation) return [];
      return constellationConcepts().filter(record=>conceptIsDue(record)).sort((a,b)=>{
        const aDue=Date.parse(a.nextReviewAt||0)||0,bDue=Date.parse(b.nextReviewAt||0)||0;
        return aDue-bDue||a.strength-b.strength||a.term.localeCompare(b.term);
      });
    }

    function scheduleConcept(record,rating,source="retrieval"){
      const now=Date.now();
      const settings={
        again:{days:.08,strength:-14,confidence:-12,ease:-.18,result:"again"},
        hard:{days:Math.max(1,record.intervalDays*.9||1),strength:4,confidence:2,ease:-.05,result:"hard"},
        good:{days:Math.max(3,record.intervalDays*2||3),strength:10,confidence:8,ease:.03,result:"good"},
        easy:{days:Math.max(7,record.intervalDays*3||7),strength:16,confidence:12,ease:.08,result:"easy"}
      }[rating]||{days:1,strength:0,confidence:0,ease:0,result:rating};
      record.intervalDays=Math.round(settings.days*100)/100;
      record.strength=Math.max(0,Math.min(100,record.strength+settings.strength));
      record.confidence=Math.max(0,Math.min(100,record.confidence+settings.confidence));
      record.ease=Math.max(1.3,Math.min(3.2,record.ease+settings.ease));
      record.lastPracticed=new Date(now).toISOString();
      record.nextReviewAt=new Date(now+settings.days*86400000).toISOString();
      record.lastResult=settings.result;
      record.history.push({at:new Date(now).toISOString(),source,rating,strength:record.strength,nextReviewAt:record.nextReviewAt});
      record.history=record.history.slice(-60);
      state.learner.constellation.reviewHistory.push({id:`review-${Date.now()}-${record.id}`,conceptId:record.id,at:new Date(now).toISOString(),rating,source,nextReviewAt:record.nextReviewAt});
      state.learner.constellation.reviewHistory=state.learner.constellation.reviewHistory.slice(-500);
    }

    function conceptsForQuestion(module,question){
      const records=constellationConcepts().filter(record=>record.moduleId===module.id);
      if(!records.length) return [];
      const text=tokenize(`${question?.prompt||""} ${question?.explanation||""}`).filter(token=>token.length>3);
      const scored=records.map(record=>{
        const vocabulary=new Set(tokenize(`${record.term} ${record.definition}`).filter(token=>token.length>3));
        return {record,score:text.reduce((sum,token)=>sum+(vocabulary.has(token)?1:0),0)};
      }).sort((a,b)=>b.score-a.score);
      const matched=scored.filter(item=>item.score>0).slice(0,3).map(item=>item.record);
      return matched.length?matched:records.slice(0,Math.min(2,records.length));
    }

    function recordQuizOutcome(module,outcomes,{passed=false,source="quiz"}={}){
      ensureConstellationState();
      const now=new Date().toISOString();
      outcomes.forEach((outcome,index)=>{
        const question=outcome.question||{};
        const concepts=conceptsForQuestion(module,question);
        concepts.forEach(record=>{
          record.attempts++;
          record.lastPracticed=now;
          if(outcome.ok){
            record.successes++;
            record.strength=Math.min(100,record.strength+(passed?14:8));
            record.confidence=Math.min(100,record.confidence+8);
            record.intervalDays=Math.max(3,record.intervalDays*2||3);
            record.nextReviewAt=new Date(Date.now()+record.intervalDays*86400000).toISOString();
            record.lastResult="quiz-pass";
          }else{
            record.failures++;
            record.strength=Math.max(0,record.strength-12);
            record.confidence=Math.max(0,record.confidence-8);
            record.intervalDays=.08;
            record.nextReviewAt=new Date(Date.now()+2*60*60*1000).toISOString();
            record.lastResult="quiz-miss";
          }
          record.history.push({at:now,source,question:String(question.prompt||`Question ${index+1}`),ok:Boolean(outcome.ok),strength:record.strength});
          record.history=record.history.slice(-60);
        });
        const key=`misconception-${stableHash(`${module.id}|${question.prompt||index}`)}`;
        let misconception=state.learner.constellation.misconceptions.find(item=>item.id===key);
        if(!outcome.ok){
          if(!misconception){
            misconception={id:key,moduleId:module.id,moduleTitle:module.title,prompt:String(question.prompt||`Question ${index+1}`),repairHint:String(question.explanation||"Revisit the authored explanation and compare it to your answer."),conceptIds:concepts.map(record=>record.id),status:"open",count:0,firstSeen:now,lastSeen:now,repairedAt:null};
            state.learner.constellation.misconceptions.push(misconception);
          }
          misconception.count++;
          misconception.lastSeen=now;
          misconception.status="open";
          misconception.repairedAt=null;
        }else if(misconception&&misconception.status!=="repaired"){
          misconception.status="repaired";
          misconception.repairedAt=now;
        }
      });
      state.learner.constellation.misconceptions=state.learner.constellation.misconceptions.slice(-250);
      emit("constellation.quiz-recorded",{moduleId:module.id,passed,source,outcomes:outcomes.length});
      saveState();
    }

    function startConstellationDiagnostic(){
      ensureConstellationState();
      const candidates=constellationConcepts().sort((a,b)=>a.attempts-b.attempts||a.strength-b.strength||a.moduleIndex-b.moduleIndex).slice(0,8);
      state.learner.constellation.activeDiagnostic={id:`diagnostic-${Date.now()}`,startedAt:new Date().toISOString(),conceptIds:candidates.map(item=>item.id),index:0,responses:[]};
      renderLearnerConstellation();
      document.getElementById("diagnostic-panel")?.scrollIntoView({behavior:"smooth",block:"start"});
    }

    function answerDiagnostic(rating){
      const session=state.learner.constellation.activeDiagnostic;
      if(!session) return;
      const id=session.conceptIds[session.index];
      const record=state.learner.constellation.concepts[id];
      if(!record) return;
      const map={known:{strength:58,confidence:70,days:3},unsure:{strength:34,confidence:35,days:1},new:{strength:14,confidence:15,days:.25}};
      const setting=map[rating]||map.unsure;
      record.strength=Math.max(record.strength,setting.strength);
      if(rating!=="known") record.strength=Math.min(record.strength,setting.strength);
      record.confidence=setting.confidence;
      record.diagnosticRating=rating;
      record.lastPracticed=new Date().toISOString();
      record.nextReviewAt=new Date(Date.now()+setting.days*86400000).toISOString();
      record.lastResult=`diagnostic-${rating}`;
      session.responses.push({conceptId:id,rating,at:new Date().toISOString()});
      session.index++;
      if(session.index>=session.conceptIds.length){
        session.completedAt=new Date().toISOString();
        state.learner.constellation.diagnostics.push(session);
        state.learner.constellation.activeDiagnostic=null;
        emit("constellation.diagnostic-completed",{conceptCount:session.responses.length});
      }
      renderLearnerConstellation();
      saveState();
    }

    function startReviewConcept(conceptId){
      ensureConstellationState();
      const record=state.learner.constellation.concepts[conceptId]||constellationReviewQueue()[0];
      if(!record){toast("Nothing is due right now.");return;}
      state.learner.constellation.activeReviewConceptId=record.id;
      state.learner.constellation.reviewRevealed=false;
      renderLearnerConstellation();
      document.getElementById("retrieval-panel")?.scrollIntoView({behavior:"smooth",block:"start"});
    }

    function revealReviewDefinition(){
      state.learner.constellation.reviewRevealed=true;
      renderRetrievalSession();
    }

    function rateConstellationReview(rating){
      const id=state.learner.constellation.activeReviewConceptId;
      const record=state.learner.constellation.concepts[id];
      if(!record) return;
      scheduleConcept(record,rating,"retrieval-self-rating");
      emit("constellation.review-rated",{conceptId:id,rating,nextReviewAt:record.nextReviewAt});
      const next=constellationReviewQueue().find(item=>item.id!==id);
      state.learner.constellation.activeReviewConceptId=next?.id||"";
      state.learner.constellation.reviewRevealed=false;
      renderLearnerConstellation();
      saveState();
    }

    function formatReviewTime(value){
      const time=Date.parse(value||0);
      if(!Number.isFinite(time)) return "unscheduled";
      const diff=time-Date.now();
      if(diff<=-86400000) return `${Math.ceil(Math.abs(diff)/86400000)} days overdue`;
      if(diff<=0) return "due now";
      if(diff<86400000) return `in ${Math.max(1,Math.ceil(diff/3600000))} hours`;
      return `in ${Math.ceil(diff/86400000)} days`;
    }

    function constellationFilterRecords(){
      const constellation=state.learner.constellation;
      return constellationConcepts().filter(record=>{
        if(constellation.domainFilter!=="all"&&record.domain!==constellation.domainFilter) return false;
        if(constellation.filter==="due"&&!conceptIsDue(record)) return false;
        if(constellation.filter==="fragile"&&!(record.attempts>0&&record.strength<45)) return false;
        if(constellation.filter==="strong"&&record.strength<75) return false;
        if(constellation.filter==="evidence"&&!(record.evidenceRefs.length||record.credentialRefs.length)) return false;
        return true;
      });
    }

    function renderConstellationGraph(){
      const svg=document.getElementById("constellation-graph");
      const records=constellationFilterRecords();
      const height=Math.max(650,records.length*78+100);
      svg.setAttribute("viewBox",`0 0 1080 ${height}`);
      if(!records.length){svg.innerHTML=`<text x="60" y="100" fill="white" font-size="28">No concepts match this view.</text>`;return;}
      const domainsInView=[...new Set(records.map(record=>record.domain))];
      const conceptPositions=new Map();
      records.forEach((record,index)=>conceptPositions.set(record.id,{x:760+(index%2)*160,y:70+index*72}));
      const moduleGroups=new Map();
      records.forEach(record=>{
        if(!moduleGroups.has(record.moduleId)) moduleGroups.set(record.moduleId,[]);
        moduleGroups.get(record.moduleId).push(record);
      });
      const modulePositions=new Map();
      [...moduleGroups.entries()].forEach(([id,items])=>{
        const ys=items.map(item=>conceptPositions.get(item.id).y);
        modulePositions.set(id,{x:410,y:ys.reduce((a,b)=>a+b,0)/ys.length,moduleTitle:items[0].moduleTitle,domain:items[0].domain});
      });
      const domainPositions=new Map();
      domainsInView.forEach((domain,index)=>{
        const modules=[...modulePositions.entries()].filter(([,pos])=>pos.domain===domain).map(([,pos])=>pos);
        const y=modules.length?modules.reduce((sum,pos)=>sum+pos.y,0)/modules.length:100+index*150;
        domainPositions.set(domain,{x:120,y});
      });
      const edges=[];
      modulePositions.forEach((pos,moduleId)=>{
        const d=domainPositions.get(pos.domain);edges.push(`<line class="constellation-edge" x1="${d.x+55}" y1="${d.y}" x2="${pos.x-85}" y2="${pos.y}"></line>`);
      });
      records.forEach(record=>{
        const c=conceptPositions.get(record.id),m=modulePositions.get(record.moduleId);
        edges.push(`<line class="constellation-edge" x1="${m.x+85}" y1="${m.y}" x2="${c.x-38}" y2="${c.y}"></line>`);
        (record.prerequisites||[]).forEach(prereq=>{
          const p=conceptPositions.get(prereq);if(p)edges.push(`<line class="constellation-edge prerequisite" x1="${p.x}" y1="${p.y+26}" x2="${c.x}" y2="${c.y-26}"></line>`);
        });
      });
      const domainNodes=domainsInView.map(domain=>{const p=domainPositions.get(domain);return `<g class="constellation-node domain" tabindex="0" role="button" data-node-id="domain:${escapeHTML(domain)}"><circle cx="${p.x}" cy="${p.y}" r="54"></circle><text x="${p.x}" y="${p.y+5}" text-anchor="middle" font-size="16">${escapeHTML((domains[domain]||domain).slice(0,16))}</text></g>`;}).join("");
      const moduleNodes=[...modulePositions.entries()].map(([id,p])=>`<g class="constellation-node module" tabindex="0" role="button" data-node-id="module:${escapeHTML(id)}"><rect x="${p.x-82}" y="${p.y-32}" width="164" height="64" rx="10"></rect><text x="${p.x}" y="${p.y+4}" text-anchor="middle" font-size="14">${escapeHTML(p.moduleTitle.slice(0,20))}</text></g>`).join("");
      const conceptNodes=records.map(record=>{const p=conceptPositions.get(record.id),status=conceptState(record),r=24+Math.round(record.strength/12);return `<g class="constellation-node concept ${escapeHTML(status)}" tabindex="0" role="button" data-node-id="${escapeHTML(record.id)}"><circle cx="${p.x}" cy="${p.y}" r="${r}"></circle><text x="${p.x}" y="${p.y+4}" text-anchor="middle" font-size="12">${escapeHTML(record.term.slice(0,18))}</text>${record.evidenceRefs.length||record.credentialRefs.length?`<circle cx="${p.x+r-3}" cy="${p.y-r+3}" r="9" fill="white" stroke="#111" stroke-width="3"></circle>`:""}</g>`;}).join("");
      svg.innerHTML=`${edges.join("")}${domainNodes}${moduleNodes}${conceptNodes}`;
      svg.querySelectorAll("[data-node-id]").forEach(node=>{
        const activate=()=>{state.learner.constellation.selectedNodeId=node.dataset.nodeId;renderConstellationDetail(node.dataset.nodeId);svg.querySelectorAll(".constellation-node").forEach(item=>item.classList.toggle("active",item===node));saveState();};
        node.addEventListener("click",activate);node.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();activate();}});
      });
      if(state.learner.constellation.selectedNodeId) renderConstellationDetail(state.learner.constellation.selectedNodeId);
    }

    function renderConstellationDetail(nodeId){
      const node=document.getElementById("constellation-detail");
      if(nodeId?.startsWith("domain:")){
        const domain=nodeId.slice(7),records=constellationConcepts().filter(record=>record.domain===domain);
        const average=records.length?Math.round(records.reduce((sum,item)=>sum+item.strength,0)/records.length):0;
        node.innerHTML=`<span class="tag">Domain</span><h3>${escapeHTML(domains[domain]||domain)}</h3><div class="strength-meter"><span style="width:${average}%"></span></div><p>${records.length} concepts · ${average}% average learning strength.</p><div class="constellation-detail-list"><div>${records.filter(record=>conceptIsDue(record)).length} reviews due</div><div>${records.filter(item=>item.evidenceRefs.length||item.credentialRefs.length).length} evidence-backed concepts</div></div>`;
        return;
      }
      if(nodeId?.startsWith("module:")){
        const module=moduleById(nodeId.slice(7));
        const records=constellationConcepts().filter(record=>record.moduleId===module?.id);
        node.innerHTML=`<span class="tag">Module</span><h3>${escapeHTML(module?.title||"Module")}</h3><p>${escapeHTML(module?.summary||"")}</p><div class="constellation-detail-list"><div>${records.length} mapped concepts</div><div>${state.clearedModules.includes(module?.id)?"Quiz cleared":"Quiz not yet cleared"}</div></div><button class="button hot" type="button" data-open-module-detail="${escapeHTML(module?.id||"")}">Open module</button>`;
        node.querySelector("[data-open-module-detail]")?.addEventListener("click",()=>openModule(module.id));
        return;
      }
      const record=state.learner.constellation.concepts[nodeId];
      if(!record) return;
      const evidence=[...record.evidenceRefs,...record.credentialRefs];
      node.innerHTML=`<span class="tag">${escapeHTML(conceptState(record))} concept</span><h3>${escapeHTML(record.term)}</h3><p>${escapeHTML(record.definition)}</p><div class="strength-meter"><span style="width:${Math.min(100,Math.max(0,Number(record.strength)||0))}%"></span></div><div class="constellation-detail-list"><div><b>Learning strength</b><br>${Math.round(Number(record.strength)||0)} / 100</div><div><b>Confidence</b><br>${Math.round(Number(record.confidence)||0)} / 100</div><div><b>Practice</b><br>${Number(record.successes)||0} successes · ${Number(record.failures)||0} misses</div><div><b>Next review</b><br>${escapeHTML(formatReviewTime(record.nextReviewAt))}</div><div><b>Evidence</b><br>${evidence.length?evidence.map(id=>`<span class="evidence-pill">${escapeHTML(id.slice(0,24))}</span>`).join(""):"No artifact, approved review, or credential attached yet."}</div></div><div class="action-row"><button class="button hot" type="button" data-review-detail="${escapeHTML(record.id)}">Review now</button><button type="button" data-open-module-detail="${escapeHTML(record.moduleId)}">Open module</button></div>`;
      node.querySelector("[data-review-detail]")?.addEventListener("click",()=>startReviewConcept(record.id));
      node.querySelector("[data-open-module-detail]")?.addEventListener("click",()=>openModule(record.moduleId));
    }

    function renderDiagnosticSession(){
      const container=document.getElementById("diagnostic-session"),session=state.learner.constellation.activeDiagnostic;
      if(!session){
        const last=state.learner.constellation.diagnostics.at(-1);
        container.innerHTML=last?`<div class="diagnostic-card"><b>Last diagnostic completed</b><p>${last.responses.length} concepts located on ${new Date(last.completedAt).toLocaleDateString()}.</p><button type="button" id="diagnostic-restart">Run another diagnostic</button></div>`:`<div class="empty">No diagnostic has been run. The first pass samples up to eight authored concepts.</div>`;
        container.querySelector("#diagnostic-restart")?.addEventListener("click",startConstellationDiagnostic);
        return;
      }
      const id=session.conceptIds[session.index],record=state.learner.constellation.concepts[id];
      if(!record){state.learner.constellation.activeDiagnostic=null;return renderDiagnosticSession();}
      container.innerHTML=`<div class="diagnostic-card"><span class="tag">${session.index+1} / ${session.conceptIds.length}</span><h4>${escapeHTML(record.term)}</h4><p>Without looking anything up, how well could you explain or use this idea right now?</p><div class="rating-row"><button type="button" data-diagnostic-rating="known">I know it</button><button type="button" data-diagnostic-rating="unsure">Uncertain</button><button type="button" data-diagnostic-rating="new">New to me</button></div><small>Self-report only. This changes study order, not evidence or credentials.</small></div>`;
      container.querySelectorAll("[data-diagnostic-rating]").forEach(button=>button.addEventListener("click",()=>answerDiagnostic(button.dataset.diagnosticRating)));
    }

    function renderRetrievalSession(){
      const container=document.getElementById("retrieval-session"),id=state.learner.constellation.activeReviewConceptId,record=state.learner.constellation.concepts[id];
      if(!record){container.innerHTML=`<div class="empty">Choose a due concept below or start the review queue.</div>`;return;}
      const revealed=state.learner.constellation.reviewRevealed===true;
      container.innerHTML=`<div class="retrieval-card"><span class="tag">Recall before reveal</span><h4>${escapeHTML(record.term)}</h4><p>Explain the concept from memory, sketch it, or give an example. Your notes stay local and are not scored.</p><textarea id="retrieval-notes" placeholder="Optional private retrieval notes..."></textarea>${revealed?`<div class="native-callout note"><b>Authored definition</b>${escapeHTML(record.definition)}</div><div class="rating-row"><button type="button" data-review-rating="again">Again</button><button type="button" data-review-rating="hard">Hard</button><button type="button" data-review-rating="good">Good</button><button type="button" data-review-rating="easy">Easy</button></div>`:`<button class="button hot" id="reveal-review-definition" type="button">Reveal authored definition</button>`}</div>`;
      container.querySelector("#reveal-review-definition")?.addEventListener("click",revealReviewDefinition);
      container.querySelectorAll("[data-review-rating]").forEach(button=>button.addEventListener("click",()=>rateConstellationReview(button.dataset.reviewRating)));
    }

    function renderReviewQueue(){
      const queue=constellationReviewQueue().slice(0,state.learner.constellation.settings.dailyReviewLimit||8),container=document.getElementById("constellation-review-queue");
      container.innerHTML=queue.length?queue.map(record=>{const overdue=Date.parse(record.nextReviewAt||0)<Date.now()-86400000;return `<div class="review-card ${overdue?"overdue":"due"}"><div><b>${escapeHTML(record.term)}</b><br><small>${escapeHTML(record.moduleTitle)} · ${escapeHTML(formatReviewTime(record.nextReviewAt))} · strength ${Math.round(Number(record.strength)||0)}</small></div><button type="button" data-review-concept="${escapeHTML(record.id)}">Review</button></div>`;}).join(""):`<div class="empty">Nothing is due. The quiet machinery is satisfied for now.</div>`;
      container.querySelectorAll("[data-review-concept]").forEach(button=>button.addEventListener("click",()=>startReviewConcept(button.dataset.reviewConcept)));
    }

    function renderMisconceptions(){
      const items=[...state.learner.constellation.misconceptions].reverse(),container=document.getElementById("misconception-list");
      container.innerHTML=items.length?items.slice(0,20).map(item=>`<div class="misconception-card ${escapeHTML(item.status)}"><b>${escapeHTML(item.prompt)}</b><p>${escapeHTML(item.repairHint)}</p><small>${escapeHTML(item.moduleTitle)} · seen ${Number(item.count)||0} time${Number(item.count)===1?"":"s"} · ${escapeHTML(item.status)}</small>${item.status==="open"?`<div class="action-row"><button type="button" data-repair-module="${escapeHTML(item.moduleId)}">Revisit module</button><button type="button" data-repair-human="${escapeHTML(item.id)}">Ask an expert</button></div>`:""}</div>`).join(""):`<div class="empty">No quiz misconceptions have been recorded.</div>`;
      container.querySelectorAll("[data-repair-module]").forEach(button=>button.addEventListener("click",()=>openModule(button.dataset.repairModule)));
      container.querySelectorAll("[data-repair-human]").forEach(button=>button.addEventListener("click",()=>prefillHelpFromMisconception(button.dataset.repairHuman)));
    }

    function prefillHelpFromMisconception(id){
      const item=state.learner.constellation.misconceptions.find(entry=>entry.id===id);if(!item)return;
      setWorkspace("help",{focusId:"help-request-builder"});
      document.getElementById("help-request-title").value=`Help me repair: ${item.prompt}`;
      document.getElementById("help-request-skill").value=moduleById(item.moduleId)?.domain||state.school.subject;
      document.getElementById("help-request-description").value=`I missed this question in ${item.moduleTitle}: ${item.prompt}\n\nAuthored repair hint: ${item.repairHint}`;
      toast("Human-help request prefilled from the misconception ledger.");
    }

    function constellationOpportunities(){
      const opportunities=[];
      const due=constellationReviewQueue();
      if(due.length) opportunities.push({id:"review",kind:"repair",priority:100,title:`Review ${due.length} due concept${due.length===1?"":"s"}`,description:"A short retrieval round will protect recent learning from evaporating.",action:"Review now",workspace:"constellation",focusId:"retrieval-panel",conceptId:due[0].id});
      const openMis=state.learner.constellation.misconceptions.filter(item=>item.status==="open");
      if(openMis.length) opportunities.push({id:"human",kind:"repair",priority:95,title:"Bring in human judgment",description:`${openMis.length} unresolved misconception${openMis.length===1?"":"s"} may benefit from a narrow review or office hour.`,action:"Ask an expert",workspace:"help",misconceptionId:openMis[0].id});
      state.school.modules.forEach(module=>{
        const cleared=state.clearedModules.includes(module.id),hasArtifact=state.artifacts.some(item=>item.moduleId===module.id);
        if(cleared&&!hasArtifact) opportunities.push({id:`practice-${module.id}`,kind:"high",priority:80,title:`Practice ${module.title}`,description:"The quiz is cleared, but no field artifact demonstrates transfer yet.",action:"Create practicum",workspace:"practica",moduleId:module.id});
      });
      constellationConcepts().filter(record=>record.strength>=78&&(record.evidenceRefs.length||record.credentialRefs.length)).slice(0,3).forEach(record=>opportunities.push({id:`teach-${record.id}`,kind:"high",priority:65,title:`Teach ${record.term} onward`,description:"Strong understanding plus evidence makes this a candidate for peer explanation or review practice.",action:"Open cohort",workspace:"cohort",conceptId:record.id}));
      const next=state.school.modules.find(module=>!state.clearedModules.includes(module.id));
      if(next) opportunities.push({id:`learn-${next.id}`,kind:"",priority:50,title:`Continue ${next.title}`,description:next.summary,action:"Open module",workspace:"learn",moduleId:next.id});
      return opportunities.sort((a,b)=>b.priority-a.priority).slice(0,8);
    }

    function activateConstellationOpportunity(opportunity){
      if(opportunity.id==="review") return startReviewConcept(opportunity.conceptId);
      if(opportunity.misconceptionId) return prefillHelpFromMisconception(opportunity.misconceptionId);
      if(opportunity.moduleId&&opportunity.workspace==="learn") return openModule(opportunity.moduleId);
      if(opportunity.moduleId&&opportunity.workspace==="practica"){
        setWorkspace("practica",{focusId:"practica-dashboard"});
        const select=document.getElementById("practica-module");if(select)select.value=opportunity.moduleId;
        return;
      }
      setWorkspace(opportunity.workspace,{focusId:opportunity.focusId||null});
    }

    function renderOpportunities(){
      const items=constellationOpportunities(),container=document.getElementById("opportunity-list");
      container.innerHTML=items.length?items.map(item=>`<div class="opportunity-card ${escapeHTML(item.kind)}"><h4>${escapeHTML(item.title)}</h4><p>${escapeHTML(item.description)}</p><button type="button" data-opportunity-id="${escapeHTML(item.id)}">${escapeHTML(item.action)}</button></div>`).join(""):`<div class="empty">No recommendation is currently urgent.</div>`;
      container.querySelectorAll("[data-opportunity-id]").forEach(button=>button.addEventListener("click",()=>activateConstellationOpportunity(items.find(item=>item.id===button.dataset.opportunityId))));
    }

    function renderConstellationEvidence(){
      const backed=constellationConcepts().filter(record=>record.evidenceRefs.length||record.credentialRefs.length),container=document.getElementById("constellation-evidence-list");
      container.innerHTML=backed.length?backed.map(record=>`<div class="evidence-card"><b>${escapeHTML(record.term)}</b><p>${record.evidenceRefs.map(id=>`<span class="evidence-pill">${escapeHTML(id.slice(0,28))}</span>`).join("")}${record.credentialRefs.map(id=>`<span class="evidence-pill">credential · ${escapeHTML(id.slice(0,20))}</span>`).join("")}</p><small>Learning strength ${Math.round(record.strength)}. Evidence count ${record.evidenceRefs.length+record.credentialRefs.length}.</small></div>`).join(""):`<div class="empty">No concepts have attached artifacts, approved reviews, or credentials yet.</div>`;
    }

    function renderPathwayIntelligence(){
      const rows=state.school.modules.map(module=>{
        const mastery=state.mastery[module.id]||{};
        const misses=state.learner.constellation.misconceptions.filter(item=>item.moduleId===module.id).reduce((sum,item)=>sum+item.count,0);
        const concepts=constellationConcepts().filter(record=>record.moduleId===module.id);
        const avg=concepts.length?Math.round(concepts.reduce((sum,item)=>sum+item.strength,0)/concepts.length):0;
        return {module,attempts:Number(mastery.attempts||0),misses,avg,friction:Number(mastery.attempts||0)+misses};
      }).sort((a,b)=>b.friction-a.friction||a.module.title.localeCompare(b.module.title));
      document.getElementById("pathway-intelligence").innerHTML=rows.map(row=>`<div class="intelligence-card"><b>${escapeHTML(row.module.title)}</b><p>${row.attempts} quiz attempt${row.attempts===1?"":"s"} · ${row.misses} recorded miss${row.misses===1?"":"es"} · ${row.avg}% average learning strength</p><small>${row.friction>=4?"High-friction area: inspect wording, examples, prerequisites, and assessment alignment.":row.friction?"Some friction recorded.":"No local friction signal yet."}</small></div>`).join("");
    }

    function renderLearnerConstellation(){
      if(!document.getElementById("learner-constellation-panel")) return;
      ensureConstellationState();
      const records=constellationConcepts(),due=constellationReviewQueue(),strong=records.filter(item=>item.strength>=75),backed=records.filter(item=>item.evidenceRefs.length||item.credentialRefs.length);
      document.getElementById("constellation-stat-grid").innerHTML=[[records.length,"Mapped concepts"],[due.length,"Reviews due"],[strong.length,"Strong concepts"],[backed.length,"Evidence-backed"]].map(([value,label])=>`<div class="academy-stat"><b>${value}</b><span>${escapeHTML(label)}</span></div>`).join("");
      const strongest=[...records].sort((a,b)=>b.strength-a.strength)[0];
      document.getElementById("constellation-poster").innerHTML=`<b>${due.length}<br>due</b><span>${strongest?`Strongest signal: ${escapeHTML(strongest.term)} at ${Math.round(strongest.strength)}.`:"The map will wake after a school is loaded."}</span>`;
      document.getElementById("top-constellation").textContent=`${due.length} review${due.length===1?"":"s"} due`;
      const domainSelect=document.getElementById("constellation-domain-filter");
      const current=state.learner.constellation.domainFilter;
      domainSelect.innerHTML=`<option value="all">All domains</option>${[...new Set(records.map(item=>item.domain))].map(domain=>`<option value="${escapeHTML(domain)}">${escapeHTML(domains[domain]||domain)}</option>`).join("")}`;
      domainSelect.value=[...domainSelect.options].some(option=>option.value===current)?current:"all";
      document.getElementById("constellation-filter").value=state.learner.constellation.filter||"all";
      renderConstellationGraph();renderDiagnosticSession();renderRetrievalSession();renderReviewQueue();renderMisconceptions();renderOpportunities();renderConstellationEvidence();renderPathwayIntelligence();
      if(document.getElementById("manifest-preview")) renderManifest();
      if(document.getElementById("event-ledger")) renderEvents();
    }

    function exportLearnerConstellation(){
      ensureConstellationState();
      download(`${slug(state.learner.displayName)}-learner-constellation.json`,JSON.stringify({schema:"living-academy-learner-constellation-export-1.0",exportedAt:new Date().toISOString(),learner:{displayName:state.learner.displayName,learnerId:state.learner.learnerId},school:{id:state.school.id,title:state.school.title},constellation:state.learner.constellation},null,2),"application/json;charset=utf-8");
    }

    function assertImportBudget(root){
      const stack=[{value:root,depth:0}];let nodes=0;
      while(stack.length){
        const {value,depth}=stack.pop();nodes+=1;
        if(nodes>30000||depth>24)throw new Error("Import is too large or deeply nested.");
        if(typeof value==="string"&&value.length>250000)throw new Error("Import contains an oversized text value.");
        if(value&&typeof value==="object"){
          for(const [key,child] of Object.entries(value)){
            if(["__proto__","prototype","constructor"].includes(key))throw new Error("Import contains a forbidden field name.");
            if(/[<>"']/.test(key))throw new Error("Import contains an unsafe field name.");
            if((key==="id"||/Id$/.test(key))&&typeof child==="string"&&!/^[A-Za-z0-9_.:-]{1,180}$/.test(child)){
              throw new Error("Import contains an unsafe identifier.");
            }
            stack.push({value:child,depth:depth+1});
          }
        }
      }
      return root;
    }

    async function readStructuredJsonFile(file,maxBytes=10_000_000){
      if(!file)throw new Error("Choose a JSON file first.");
      if(file.size>maxBytes)throw new Error(`JSON imports are limited to ${Math.round(maxBytes/1_000_000)} MB.`);
      let payload;try{payload=JSON.parse(await file.text());}catch{throw new Error("The selected file is not valid JSON.");}
      return assertImportBudget(payload);
    }

    async function importLearnerConstellationFile(file){
      const payload=await readStructuredJsonFile(file);
      if(payload.schema!=="living-academy-learner-constellation-export-1.0"||!payload.constellation) throw new Error("Unsupported learner constellation export.");
      const incoming=payload.constellation;
      const local=state.learner.constellation;
      Object.entries(incoming.concepts||{}).forEach(([id,record])=>{
        const existing=local.concepts[id];
        local.concepts[id]=existing?{...record,...existing,strength:Math.max(Number(existing.strength||0),Number(record.strength||0)),evidenceRefs:[...new Set([...(record.evidenceRefs||[]),...(existing.evidenceRefs||[])])],credentialRefs:[...new Set([...(record.credentialRefs||[]),...(existing.credentialRefs||[])])],history:[...(record.history||[]),...(existing.history||[])].slice(-60)}:record;
      });
      local.misconceptions=[...local.misconceptions,...(incoming.misconceptions||[])].filter((item,index,array)=>array.findIndex(other=>other.id===item.id)===index).slice(-250);
      local.diagnostics=[...local.diagnostics,...(incoming.diagnostics||[])].slice(-100);
      local.reviewHistory=[...local.reviewHistory,...(incoming.reviewHistory||[])].slice(-500);
      syncConstellationToSchool();renderLearnerConstellation();saveState();toast("Learner constellation merged.");
    }



    let modelFoundryRoute="";

    const MODEL_ROUTE_META={
      hosted:{label:"Included Gemini",provider:"hosted"},
      gguf:{label:"Local GGUF",provider:"gguf"},
      gemini:{label:"Gemini API key",provider:"gemini"},
      "local-api":{label:"Local API",provider:"local-api"},
      deterministic:{label:"Deterministic",provider:"deterministic"},
      browser:{label:"Browser model",provider:"browser"},
      manual:{label:"Manual exchange",provider:"manual"}
    };

    function activeModelRoute(){
      const engine=document.getElementById("generation-engine")?.value||state.modelSettings?.engine||"hybrid";
      const provider=document.getElementById("model-provider")?.value||state.modelSettings?.provider||"browser";
      if(engine==="deterministic"||provider==="deterministic") return "deterministic";
      if(provider==="openai"||provider==="ollama") return "local-api";
      return MODEL_ROUTE_META[provider]?provider:"local-api";
    }

    function modelRouteLabel(route=activeModelRoute()){
      return MODEL_ROUTE_META[route]?.label||"Choose model";
    }

    function updateModelFoundryCurrent(){
      const node=document.getElementById("model-foundry-current");
      if(!node) return;
      const route=activeModelRoute();
      const runtime=state.modelRuntime||{};
      const tested=runtime.tested
        ? runtime.ready
          ? "Ready"
          : "Needs attention"
        : "Not tested";
      const model=document.getElementById("model-name")?.value||state.modelSettings?.model||"";
      node.className=`model-foundry-current ${runtime.tested?(runtime.ready?"good":"bad"):""}`;
      node.textContent=`Active route: ${modelRouteLabel(route)}${model&&route!=="deterministic"?` · ${model}`:""} · ${tested}. ${runtime.message||""}`;
      const chip=document.getElementById("top-model-route");
      if(chip){
        chip.textContent=modelRouteLabel(route);
        chip.title=`${tested}: ${runtime.message||"Open model configuration."}`;
      }
    }

    function openModelFoundry(route=activeModelRoute()){
      modelFoundryRoute=MODEL_ROUTE_META[route]?route:activeModelRoute();
      document.getElementById("model-foundry-overlay").hidden=false;
      renderModelFoundry();
      setTimeout(()=>document.querySelector(`[data-model-route="${modelFoundryRoute}"]`)?.focus(),40);
    }

    function closeModelFoundry(){
      document.getElementById("model-foundry-overlay").hidden=true;
    }

    function modelFoundryStatusText(){
      const status=document.getElementById("model-connection-status")?.textContent?.trim();
      return status||state.modelRuntime?.message||"This route has not been tested.";
    }

    function renderModelFoundry(){
      document.querySelectorAll("[data-model-route]").forEach(button=>
        button.classList.toggle("selected",button.dataset.modelRoute===modelFoundryRoute)
      );
      updateModelFoundryCurrent();

      const panel=document.getElementById("model-foundry-panel");
      const config=modelConfigFromUI();
      const route=modelFoundryRoute;
      const activate=document.getElementById("model-foundry-activate");
      activate.textContent=route==="hosted"&&!hostedEntitlementIsActive()
        ? "Open subscription options"
        : route==="gguf"
          ? "Use ready GGUF"
          : route==="deterministic"
            ? "Use deterministic compiler"
            : "Activate this route";

      if(route==="hosted"){
        const plan=currentPlan();
        panel.innerHTML=`
          <h3>Included cloud Gemini</h3>
          <p>The Academy broker holds the platform Gemini key, meters actual usage, and deducts it from the allowance in your subscription.</p>
          <div class="model-foundry-fields">
            <div class="model-foundry-choice">
              <b>Plan</b><br>${escapeHTML(plan.name)} · ${plan.aiAllowanceCents?formatMoneyFromCents(state.commerce.aiWallet.balanceCents):"no hosted allowance"}
            </div>
            <div class="model-foundry-choice">
              <b>Broker</b><br>${commerceBrokerBase()?escapeHTML(commerceBrokerBase()):"Not configured by the site operator"}
            </div>
            <div class="field full">
              <label for="hub-hosted-model">Hosted model</label>
              <input id="hub-hosted-model" type="text" value="${escapeHTML(config.model||"gemini-3.5-flash-lite")}">
            </div>
          </div>
          <div class="model-foundry-status ${hostedEntitlementIsActive()&&commerceBrokerBase()?"good":"bad"}">
            ${hostedEntitlementIsActive()
              ? commerceBrokerBase()
                ? "Subscription entitlement and broker are present. Test the route before a long generation."
                : "Your entitlement is active, but the operator has not configured the hosted-AI broker."
              : "A paid Individual, Creator, or Institution entitlement is required for the included cloud route."}
          </div>`;
      }else if(route==="gguf"){
        const entries=[...locatedGGUFFiles.entries()];
        const candidateOptions=entries.length
          ? entries.map(([key,entry])=>`<option value="${escapeHTML(key)}" ${key===selectedGGUFKey?"selected":""}>${escapeHTML(entry.info.name)} · ${formatBytes(entry.info.size)}</option>`).join("")
          : `<option value="">No GGUF selected</option>`;
        panel.innerHTML=`
          <h3>Load a local GGUF with llama.cpp</h3>
          <p>
            Start the included local bridge, then choose a GGUF. The browser validates the header, the bridge
            starts <code>llama-server</code>, and the Academy consumes its OpenAI-compatible API.
          </p>
          <div class="model-foundry-fields">
            <div class="field full">
              <label for="hub-gguf-bridge">Bridge endpoint</label>
              <input id="hub-gguf-bridge" type="url" value="${escapeHTML(config.ggufBridgeEndpoint||"http://127.0.0.1:8788")}">
            </div>
            <div class="field">
              <label for="hub-gguf-port">llama-server port</label>
              <input id="hub-gguf-port" type="number" value="${Math.round(finiteNumber(config.ggufPort,8080,1024,65535))}">
            </div>
            <div class="field">
              <label for="hub-gguf-context">Context size</label>
              <input id="hub-gguf-context" type="number" value="${Math.round(finiteNumber(config.ggufContext,8192,512,262144))}">
            </div>
            <div class="field">
              <label for="hub-gguf-gpu">GPU layers</label>
              <input id="hub-gguf-gpu" type="number" value="${Math.round(finiteNumber(config.ggufGpuLayers,-1,-1,10000))}">
            </div>
            <div class="field">
              <label for="hub-gguf-threads">CPU threads</label>
              <input id="hub-gguf-threads" type="number" value="${Math.round(finiteNumber(config.ggufThreads,0,0,1024))}">
            </div>
            <div class="field full">
              <label for="hub-gguf-candidates">Located models</label>
              <select id="hub-gguf-candidates">${candidateOptions}</select>
            </div>
          </div>
          <div class="model-foundry-file">
            <b>Local runtime kit included in this package</b>
            <span>Windows: run <code>start_local_model_bridge.bat</code></span>
            <span>macOS/Linux: run <code>./start_local_model_bridge.sh</code></span>
            <span>The launcher opens <code>http://127.0.0.1:8788/academy</code>, keeping the page and model bridge on the same secure local origin.</span>
            <span>Requirement: llama.cpp <code>llama-server</code> available on PATH, beside the bridge, or supplied with <code>--llama-server PATH</code>.</span>
          </div>
          <div class="action-row">
            <button id="hub-probe-gguf" type="button" onclick="event.stopPropagation();probeGGUFFromFoundry(this)">Probe bridge</button>
            <button id="hub-choose-gguf" type="button" onclick="event.stopPropagation();chooseGGUFFromFoundry(this)">Choose GGUF file</button>
            <button id="hub-native-gguf" type="button" onclick="event.stopPropagation();nativeGGUFFromFoundry(this)">Native file picker</button>
            <button class="button hot" id="hub-start-gguf" type="button" onclick="event.stopPropagation();startGGUFFromFoundry(this)">Ingest and start</button>
            <button id="hub-stop-gguf" type="button" onclick="event.stopPropagation();stopGGUFFromFoundry(this)">Stop model</button>
          </div>
          <div class="model-foundry-status" id="hub-gguf-status">${escapeHTML(document.getElementById("gguf-status")?.textContent||"Bridge not probed.")}</div>`;
      }else if(route==="gemini"){
        panel.innerHTML=`
          <h3>Gemini API key for testing</h3>
          <p>The key is kept in session storage for this tab. It is never written into exported schools or the local persistent state.</p>
          <div class="model-foundry-fields">
            <div class="field">
              <label for="hub-gemini-model">Model</label>
              <input id="hub-gemini-model" type="text" value="${escapeHTML(/^gemini-/.test(config.model)?config.model:"gemini-3.5-flash-lite")}">
            </div>
            <div class="field">
              <label for="hub-gemini-key">Gemini API key</label>
              <input id="hub-gemini-key" type="password" autocomplete="off" value="${escapeHTML(document.getElementById("model-api-key").value)}" placeholder="AIza...">
            </div>
          </div>
          <div class="model-foundry-status">Direct testing route. Provider charges and key security belong to the user who supplies the key.</div>`;
      }else if(route==="local-api"){
        panel.innerHTML=`
          <h3>Consume a local model API</h3>
          <p>Choose the protocol exposed by the local server. The endpoint must permit browser requests from this page, including CORS for file or localhost origins.</p>
          <div class="model-local-api-presets">
            <button type="button" data-local-api-preset="ollama">Ollama</button>
            <button type="button" data-local-api-preset="lmstudio">LM Studio</button>
            <button type="button" data-local-api-preset="llamacpp">llama.cpp server</button>
            <button type="button" data-local-api-preset="vllm">vLLM</button>
          </div>
          <div class="model-foundry-fields">
            <div class="field">
              <label for="hub-local-flavor">Protocol</label>
              <select id="hub-local-flavor">
                <option value="openai" ${config.localApiFlavor!=="ollama"?"selected":""}>OpenAI-compatible</option>
                <option value="ollama" ${config.localApiFlavor==="ollama"?"selected":""}>Ollama native chat</option>
              </select>
            </div>
            <div class="field">
              <label for="hub-local-model">Model name</label>
              <input id="hub-local-model" type="text" value="${escapeHTML(config.model||"local-model")}">
            </div>
            <div class="field full">
              <label for="hub-local-endpoint">Endpoint</label>
              <input id="hub-local-endpoint" type="url" value="${escapeHTML(config.endpoint||"http://127.0.0.1:1234/v1/chat/completions")}">
            </div>
            <div class="field full">
              <label for="hub-local-key">Optional API key</label>
              <input id="hub-local-key" type="password" autocomplete="off" value="${escapeHTML(document.getElementById("model-api-key").value)}" placeholder="Usually blank for a local server">
            </div>
          </div>
          <div class="model-foundry-status">OpenAI-compatible servers should expose <code>/v1/chat/completions</code>. Ollama should expose <code>/api/chat</code>.</div>`;
      }else if(route==="deterministic"){
        panel.innerHTML=`
          <h3>Deterministic compiler</h3>
          <p>No language model is called. The Academy uses templates, supplied source packs, and inspectable compiler rules.</p>
          <div class="model-foundry-status good">
            Works offline immediately. Source-free deterministic generation creates a scaffold rather than pretending its placeholders are verified knowledge.
          </div>`;
      }else if(route==="browser"){
        panel.innerHTML=`
          <h3>Browser-native model</h3>
          <p>This route uses the experimental <code>LanguageModel</code> API when the browser provides it. Availability and model download behavior are controlled by the browser.</p>
          <div class="model-foundry-status ${browserModelFactory()?"good":"bad"}">
            ${browserModelFactory()?"A browser-native model factory is available.":"This browser does not currently expose a LanguageModel API."}
          </div>`;
      }else{
        panel.innerHTML=`
          <h3>Manual model exchange</h3>
          <p>The Academy prepares the complete prompt. Send it to any model, then paste its JSON response below.</p>
          <div class="model-foundry-fields">
            <div class="field full">
              <label for="hub-manual-prompt">Prepared prompt</label>
              <textarea id="hub-manual-prompt" readonly placeholder="Activate this route, then generate a curriculum to prepare the prompt.">${escapeHTML(document.getElementById("manual-model-prompt").value)}</textarea>
            </div>
            <div class="field full">
              <label for="hub-manual-response">Model JSON response</label>
              <textarea id="hub-manual-response" placeholder="Paste the model response here.">${escapeHTML(document.getElementById("manual-model-response").value)}</textarea>
            </div>
          </div>
          <div class="action-row"><button class="button hot" id="hub-apply-manual" type="button">Validate pasted response</button></div>
          <div class="model-foundry-status good">No API connection is required. Structured validation still applies before the curriculum can be accepted.</div>`;
      }

      bindModelFoundryPanel();
    }

    function syncModelFoundryFields(){
      const route=modelFoundryRoute;
      if(route==="hosted"){
        document.getElementById("model-provider").value="hosted";
        document.getElementById("model-name").value=document.getElementById("hub-hosted-model")?.value.trim()||"gemini-3.5-flash-lite";
        document.getElementById("model-endpoint").value=commerceBrokerBase()?`${commerceBrokerBase()}/v1/ai/generate`:"";
      }else if(route==="gguf"){
        document.getElementById("model-provider").value="gguf";
        document.getElementById("gguf-bridge-endpoint").value=document.getElementById("hub-gguf-bridge")?.value.trim()||"http://127.0.0.1:8788";
        document.getElementById("gguf-port").value=document.getElementById("hub-gguf-port")?.value||"8080";
        document.getElementById("gguf-context").value=document.getElementById("hub-gguf-context")?.value||"8192";
        document.getElementById("gguf-gpu-layers").value=document.getElementById("hub-gguf-gpu")?.value||"-1";
        document.getElementById("gguf-threads").value=document.getElementById("hub-gguf-threads")?.value||"0";
        document.getElementById("model-endpoint").value=`${ggufBridgeBase()}/v1/chat/completions`;
        if(document.getElementById("hub-gguf-candidates")?.value){
          selectedGGUFKey=document.getElementById("hub-gguf-candidates").value;
          document.getElementById("gguf-candidates").value=selectedGGUFKey;
        }
      }else if(route==="gemini"){
        document.getElementById("model-provider").value="gemini";
        document.getElementById("model-name").value=document.getElementById("hub-gemini-model")?.value.trim()||"gemini-3.5-flash-lite";
        document.getElementById("model-endpoint").value="https://generativelanguage.googleapis.com/v1beta";
        document.getElementById("model-api-key").value=document.getElementById("hub-gemini-key")?.value||"";
      }else if(route==="local-api"){
        document.getElementById("model-provider").value="local-api";
        document.getElementById("model-local-api-flavor").value=document.getElementById("hub-local-flavor")?.value||"openai";
        document.getElementById("model-name").value=document.getElementById("hub-local-model")?.value.trim()||"local-model";
        document.getElementById("model-endpoint").value=document.getElementById("hub-local-endpoint")?.value.trim()||"";
        document.getElementById("model-api-key").value=document.getElementById("hub-local-key")?.value||"";
      }else if(route==="deterministic"){
        document.getElementById("model-provider").value="deterministic";
        document.getElementById("generation-engine").value="deterministic";
        document.getElementById("model-name").value="deterministic-compiler";
        document.getElementById("model-endpoint").value="";
        document.getElementById("model-api-key").value="";
      }else if(route==="browser"){
        document.getElementById("model-provider").value="browser";
        document.getElementById("model-name").value="browser-native";
        document.getElementById("model-endpoint").value="";
        document.getElementById("model-api-key").value="";
      }else{
        document.getElementById("model-provider").value="manual";
        document.getElementById("model-name").value="manual-exchange";
        document.getElementById("model-endpoint").value="";
        document.getElementById("model-api-key").value="";
        if(document.getElementById("hub-manual-response")){
          document.getElementById("manual-model-response").value=document.getElementById("hub-manual-response").value;
        }
      }
      if(route!=="deterministic"&&document.getElementById("generation-engine").value==="deterministic"){
        document.getElementById("generation-engine").value="hybrid";
      }
      state.modelRuntime.route=route;
      persistModelSettings();
      updateSourceGenerationWarning();
    }

    function applyLocalApiPreset(name){
      const presets={
        ollama:{flavor:"ollama",endpoint:"http://127.0.0.1:11434/api/chat",model:"llama3.2"},
        lmstudio:{flavor:"openai",endpoint:"http://127.0.0.1:1234/v1/chat/completions",model:"local-model"},
        llamacpp:{flavor:"openai",endpoint:"http://127.0.0.1:8080/v1/chat/completions",model:"local-model"},
        vllm:{flavor:"openai",endpoint:"http://127.0.0.1:8000/v1/chat/completions",model:"local-model"}
      };
      const preset=presets[name];
      if(!preset) return;
      document.getElementById("hub-local-flavor").value=preset.flavor;
      document.getElementById("hub-local-endpoint").value=preset.endpoint;
      document.getElementById("hub-local-model").value=preset.model;
    }

    function bindModelFoundryPanel(){
      // Dynamic controls are handled by delegation from the stable panel element.
    }


    async function probeGGUFFromFoundry(button){
      syncModelFoundryFields();
      button.disabled=true;
      try{
        setModelStatus("Probing the local GGUF bridge...");
        await probeGGUFBridge();
      }catch(error){
        setModelStatus(`GGUF bridge probe failed: ${error.message}`,"bad");
      }finally{
        renderModelFoundry();
      }
    }

    async function chooseGGUFFromFoundry(button){
      syncModelFoundryFields();
      button.disabled=true;
      try{
        await chooseGGUF();
      }catch(error){
        setModelStatus(`GGUF selection failed: ${error.message}`,"bad");
      }finally{
        renderModelFoundry();
      }
    }

    async function nativeGGUFFromFoundry(button){
      syncModelFoundryFields();
      button.disabled=true;
      try{
        setModelStatus("Opening the bridge file picker and starting llama.cpp...");
        await openNativeBridgePicker();
        setModelStatus("Local GGUF started and registered.","good");
      }catch(error){
        setModelStatus(`Native GGUF start failed: ${error.message}`,"bad");
      }finally{
        renderModelFoundry();
      }
    }

    async function startGGUFFromFoundry(button){
      syncModelFoundryFields();
      button.disabled=true;
      button.textContent="Uploading and starting...";
      try{
        setModelStatus("Uploading the selected GGUF and starting llama.cpp...");
        await ingestSelectedGGUF();
        setModelStatus("Local GGUF started and registered.","good");
      }catch(error){
        setModelStatus(`GGUF ingestion or startup failed: ${error.message}`,"bad");
      }finally{
        renderModelFoundry();
      }
    }

    async function stopGGUFFromFoundry(button){
      syncModelFoundryFields();
      button.disabled=true;
      try{
        await stopGGUFModel();
        setModelStatus("Local GGUF stopped.");
      }catch(error){
        setModelStatus(`Stopping the GGUF failed: ${error.message}`,"bad");
      }finally{
        renderModelFoundry();
      }
    }

    Object.assign(window,{
      probeGGUFFromFoundry,
      chooseGGUFFromFoundry,
      nativeGGUFFromFoundry,
      startGGUFFromFoundry,
      stopGGUFFromFoundry
    });

    async function handleModelFoundryPanelClick(event){
      const button=event.target.closest("button");
      if(!button||!document.getElementById("model-foundry-panel").contains(button)) return;

      if(button.dataset.localApiPreset){
        applyLocalApiPreset(button.dataset.localApiPreset);
        return;
      }

      if(button.id==="hub-probe-gguf"){
        syncModelFoundryFields();
        button.disabled=true;
        try{
          setModelStatus("Probing the local GGUF bridge...");
          await probeGGUFBridge();
        }catch(error){
          setModelStatus(`GGUF bridge probe failed: ${error.message}`,"bad");
        }finally{
          renderModelFoundry();
        }
        return;
      }

      if(button.id==="hub-choose-gguf"){
        syncModelFoundryFields();
        button.disabled=true;
        try{
          await chooseGGUF();
        }catch(error){
          setModelStatus(`GGUF selection failed: ${error.message}`,"bad");
        }finally{
          renderModelFoundry();
        }
        return;
      }

      if(button.id==="hub-native-gguf"){
        syncModelFoundryFields();
        button.disabled=true;
        try{
          setModelStatus("Opening the bridge file picker and starting llama.cpp...");
          await openNativeBridgePicker();
          setModelStatus("Local GGUF started and registered.","good");
        }catch(error){
          setModelStatus(`Native GGUF start failed: ${error.message}`,"bad");
        }finally{
          renderModelFoundry();
        }
        return;
      }

      if(button.id==="hub-start-gguf"){
        syncModelFoundryFields();
        button.disabled=true;
        button.textContent="Uploading and starting...";
        try{
          setModelStatus("Uploading the selected GGUF and starting llama.cpp...");
          await ingestSelectedGGUF();
          setModelStatus("Local GGUF started and registered.","good");
        }catch(error){
          setModelStatus(`GGUF ingestion or startup failed: ${error.message}`,"bad");
        }finally{
          renderModelFoundry();
        }
        return;
      }

      if(button.id==="hub-stop-gguf"){
        syncModelFoundryFields();
        button.disabled=true;
        try{
          await stopGGUFModel();
          setModelStatus("Local GGUF stopped.");
        }catch(error){
          setModelStatus(`Stopping the GGUF failed: ${error.message}`,"bad");
        }finally{
          renderModelFoundry();
        }
        return;
      }

      if(button.id==="hub-apply-manual"){
        document.getElementById("manual-model-response").value=
          document.getElementById("hub-manual-response").value;
        await applyManualModelResponse();
        renderModelFoundry();
      }
    }

    function handleModelFoundryPanelChange(event){
      if(event.target.id==="hub-gguf-candidates"){
        selectedGGUFKey=event.target.value;
        const advancedSelect=document.getElementById("gguf-candidates");
        if(advancedSelect) advancedSelect.value=selectedGGUFKey;
        renderSelectedGGUF();
      }
    }

    async function testModelFoundryRoute(){
      syncModelFoundryFields();
      const route=modelFoundryRoute;
      if(route==="deterministic"){
        const school=generateSchool("Deterministic model route test","",1,"introductory","practical","plain");
        if(!school.modules?.length) throw new Error("The deterministic compiler did not produce a module.");
        setModelStatus("Deterministic compiler test passed. No network or language model was used.","good");
        renderModelFoundry();
        return;
      }
      if(route==="manual"){
        setModelStatus("Manual exchange is ready. The Academy can prepare prompts and validate pasted JSON.","good");
        renderModelFoundry();
        return;
      }
      if(route==="gguf"){
        try{
          const health=await probeGGUFBridge();
          if(!health.active?.ready) throw new Error("The bridge is online, but no ready llama-server model is active.");
        }catch(error){
          setModelStatus(`GGUF route test failed: ${error.message}`,"bad");
          renderModelFoundry();
          return;
        }
      }
      await testModelConnection();
      renderModelFoundry();
    }

    function activateModelFoundryRoute(){
      syncModelFoundryFields();
      const route=modelFoundryRoute;
      if(route==="hosted"&&!hostedEntitlementIsActive()){
        state.commerce.pendingPlanId="individual";
        closeModelFoundry();
        setWorkspace("admin",{focusId:"billing-panel"});
        setBillingFeedback("Choose a paid plan or apply a signed entitlement to use the included Gemini route.","fail");
        return;
      }
      if(route==="hosted"&&!commerceBrokerBase()){
        setModelStatus("Hosted Gemini selected, but the site operator has not configured the AI broker.","bad");
        renderModelFoundry();
        return;
      }
      if(route==="gguf"&&!/ready/i.test(document.getElementById("gguf-state")?.textContent||"")){
        setModelStatus("Select and start a GGUF, or connect to a ready bridge before activating this route.","bad");
        renderModelFoundry();
        return;
      }
      const preserveReady=state.modelRuntime.route===route&&state.modelRuntime.ready===true;
      state.modelRuntime={
        ...state.modelRuntime,
        route,
        tested:route==="deterministic"||route==="manual"?true:preserveReady,
        ready:route==="deterministic"||route==="manual"?true:preserveReady,
        message:route==="deterministic"
          ? "Deterministic compiler active."
          : route==="manual"
            ? "Manual model exchange active."
            : preserveReady
              ? `${modelRouteLabel(route)} tested and active.`
              : `${modelRouteLabel(route)} selected. Test it before a long generation.`
      };
      persistModelSettings();
      renderCommerce();
      updateModelFoundryCurrent();
      closeModelFoundry();
      toast(`${modelRouteLabel(route)} is now the active curriculum route.`);
    }

    function openAdvancedModelSettings(){
      state.commerce.noviceMode=false;
      document.body.classList.remove("novice-mode");
      closeModelFoundry();
      setWorkspace("studio",{focusId:"school-builder"});
      const details=document.getElementById("model-settings");
      details.open=true;
      details.scrollIntoView({behavior:"smooth",block:"start"});
      renderCommerce();
      saveState();
    }

    const WORKSPACES={

      home:{
        label:"Home",
        kicker:"Novice launchpad",
        title:"Choose your next useful step",
        description:"Start learning, create a school, publish expertise, run a cohort, or remain completely local.",
        contexts:[
          ["home-launchpad","Launchpad"]
        ]
      },

      help:{
        label:"Experts",
        kicker:"Human judgment market",
        title:"Get unstuck with a person",
        description:"Request a narrow review, schedule office hours, arrange an assessment, or offer your own expertise.",
        contexts:[
          ["human-help-panel","Human help"],
          ["help-request-builder","Request builder"],
          ["engagement-panel","Engagements"],
          ["expert-studio-panel","Expert studio"]
        ]
      },
      market:{
        label:"Explore",
        kicker:"Knowledge marketplace",
        title:"Find a pathway or publish one",
        description:"Browse starter templates and evidence-backed learning paths, then install, purchase, remix, or sell them.",
        contexts:[
          ["marketplace-panel","Marketplace"],
          ["creator-studio-panel","Creator studio"]
        ]
      },
      studio:{
        label:"Design",
        kicker:"Academy studio",
        title:"Design the school",
        description:"Generate, inspect, organize, and publish a school before learners enter it.",
        contexts:[
          ["studio-overview","Orientation"],
          ["school-builder","Curriculum studio"],
          ["assessment-studio","Assessment studio"],
          ["media-studio","Video field notes"],
          ["school-overview","School manifest"]
        ]
      },
      constellation:{
        label:"Constellation",
        kicker:"Persistent learner model",
        title:"See what you know, forget, and can do next",
        description:"Map concepts, evidence, misconceptions, scheduled retrieval, and opportunities without confusing confidence with proof.",
        contexts:[
          ["learner-constellation-panel","Knowledge map"],
          ["diagnostic-panel","Diagnostic"],
          ["retrieval-panel","Review queue"],
          ["misconception-panel","Misconceptions"],
          ["opportunity-panel","Opportunities"]
        ]
      },
      learn:{
        label:"Learn",
        kicker:"Learner pathway",
        title:"Follow the learning path",
        description:"Complete modules, repair misconceptions, produce artifacts, and unlock the next useful challenge.",
        contexts:[
          ["learning-path-panel","Current school"],
          ["lesson-container","Active thread"],
          ["final-test-panel","Final test"]
        ]
      },
      cohort:{
        label:"Cohort",
        kicker:"Shared classroom",
        title:"Learn as a group",
        description:"Enroll participants, rotate roles, assign modules, and make collective progress visible.",
        contexts:[
          ["cohort-panel","Cohort commons"]
        ]
      },
      practica:{
        label:"Practica",
        kicker:"Consequential practice",
        title:"Carry learning into the world",
        description:"Create Cerbanimo quests, gather evidence, reflect, and compile transferable field artifacts.",
        contexts:[
          ["practica-dashboard","Practicum engine"],
          ["artifacts-panel","Field artifacts"],
          ["final-project-panel","Final project gate"],
          ["cerbanimo-panel","Cerbanimo bridge"]
        ]
      },
      review:{
        label:"Review",
        kicker:"Evidence and judgment",
        title:"Review without rubber stamps",
        description:"Apply visible criteria, preserve appeals, and practice giving feedback that improves the work.",
        contexts:[
          ["review-panel","Peer review hall"]
        ]
      },
      credentials:{
        label:"Credentials",
        kicker:"Portable recognition",
        title:"Carry demonstrated capability",
        description:"Inspect XP, evidence, badges, learner identity, and Anarchadia-governed credential proposals.",
        contexts:[
          ["passport-panel","Learner passport"],
          ["anarchadia-panel","Credential governance"]
        ]
      },
      admin:{
        label:"Admin",
        kicker:"Institutional stewardship",
        title:"Facilitate and improve",
        description:"Find stuck concepts, overloaded reviewers, participation bottlenecks, and curriculum sections needing revision.",
        contexts:[
          ["billing-panel","Plan and billing"],
          ["facilitator-panel","Facilitator cockpit"],
          ["manifest-panel","Manifest and events"]
        ]
      }
    };

    function ensureAssessmentState(){
      state.assessment={
        policy:"learner-first",
        autosaveDrafts:true,
        showIdeaCoaching:true,
        allowReviewChallenges:true,
        reviewRequests:[],
        ...(state.assessment||{})
      };
      state.assessment.reviewRequests=Array.isArray(state.assessment.reviewRequests)
        ? state.assessment.reviewRequests
        : [];
      state.quizDrafts=state.quizDrafts&&typeof state.quizDrafts==="object"
        ? state.quizDrafts
        : {};
    }

    function ensureAcademyState(){
      ensureAssessmentState();
      ensureMossFlowState();
      state.academy=state.academy||{};
      state.academy.activeWorkspace=WORKSPACES[state.academy.activeWorkspace]?state.academy.activeWorkspace:"home";
      state.academy.cohorts=Array.isArray(state.academy.cohorts)?state.academy.cohorts:[];
      state.academy.practica=Array.isArray(state.academy.practica)?state.academy.practica:[];
      state.academy.reviews=Array.isArray(state.academy.reviews)?state.academy.reviews:[];
      state.academy.facilitatorNotes=Array.isArray(state.academy.facilitatorNotes)?state.academy.facilitatorNotes:[];
      state.academy.traversalMode=["guided","jit","browse","review","creator"].includes(state.academy.traversalMode)?state.academy.traversalMode:"guided";
      state.academy.appearanceMode=["paper","blueprint","quiet"].includes(state.academy.appearanceMode)?state.academy.appearanceMode:"paper";
      state.academy.selectedModuleId=state.academy.selectedModuleId||null;
      const savedGate=state.academy.projectGate||{};
      const gateDefaults={schema:"living-school-project-gate-1.2",status:"not-started",projectRef:"",projectId:"",projectUrl:"",brief:null,history:[],updatedAt:null,requestId:"",pendingSince:null,submittedAt:null,lastCheckedAt:null,lastReceipt:null,sendAttempts:0,transportState:"idle",lastRefreshError:"",lastRefreshRequestId:"",receiptIds:[],statusRevision:0};
      state.academy.projectGate={...gateDefaults,...savedGate,schema:"living-school-project-gate-1.2"};
      if(state.academy.projectGate.status==="closed")state.academy.projectGate.status="rejected";
      state.academy.projectGate.history=Array.isArray(state.academy.projectGate.history)?state.academy.projectGate.history:[];
      state.academy.projectGate.receiptIds=Array.isArray(state.academy.projectGate.receiptIds)?[...new Set(state.academy.projectGate.receiptIds.map(String))].slice(-80):[];
      state.academy.projectGate.statusRevision=Math.max(0,Number(state.academy.projectGate.statusRevision||0));
      if(state.academy.projectGate.status==="accepted"&&!state.academy.projectGate.lastReceipt?.demo&&!state.academy.projectGate.lastReceipt?.reviewId&&!state.academy.projectGate.lastReceipt?.evidenceRef&&!state.academy.projectGate.lastReceipt?.acceptedAt){state.academy.projectGate.status=state.academy.projectGate.submittedAt?"submitted":"integration-unavailable";state.academy.projectGate.lastRefreshError="An older project record lacked an authoritative acceptance receipt. Refresh Cerbanimo before taking the final test.";}
      if(state.academy.projectGate.status==="sending"&&state.academy.projectGate.pendingSince&&Date.now()-Date.parse(state.academy.projectGate.pendingSince)>45000){state.academy.projectGate.status="handoff-failed";state.academy.projectGate.transportState="failed";state.academy.projectGate.lastRefreshError="The previous Cerbanimo handoff did not receive an acknowledgement before Living School reopened.";state.academy.projectGate.history.push({id:`gate-${Date.now()}`,status:"handoff-failed",note:"The previous Cerbanimo handoff did not receive an acknowledgement before Living School reopened. The project draft remains saved and can be retried.",at:new Date().toISOString()});}
      state.academy.finalTest={schema:"living-school-final-test-1.1",attempts:[],activeAttempt:null,passed:false,pendingReview:false,completionRecord:null,...(state.academy.finalTest||{})};
      state.academy.finalTest.schema="living-school-final-test-1.1";
      state.academy.finalTest.attempts=Array.isArray(state.academy.finalTest.attempts)?state.academy.finalTest.attempts:[];
      state.academy.schoolVersions=Array.isArray(state.academy.schoolVersions)?state.academy.schoolVersions:[];
      (state.school?.modules||[]).forEach(module=>{module.media=Array.isArray(module.media)?module.media.filter(Boolean):[];});
      applyAppearanceMode(state.academy.appearanceMode,{persist:false});

      if(!state.academy.cohorts.length){
        const cohort={
          id:`cohort-${Date.now()}`,
          name:"Founding Cohort",
          schoolId:state.school?.id||null,
          mode:"weekly",
          startDate:new Date().toISOString().slice(0,10),
          createdAt:new Date().toISOString(),
          participants:[
            {
              id:state.learner.learnerId,
              name:state.learner.displayName,
              role:"learner",
              status:"active",
              completedModules:[...state.clearedModules],
              localLearner:true
            },
            {
              id:"facilitator-local",
              name:"Local facilitator",
              role:"facilitator",
              status:"active",
              completedModules:[],
              localLearner:false
            }
          ],
          assignments:[]
        };
        state.academy.cohorts.push(cohort);
        state.academy.activeCohortId=cohort.id;
      }
      if(!state.academy.activeCohortId || !state.academy.cohorts.some(cohort=>cohort.id===state.academy.activeCohortId)){
        state.academy.activeCohortId=state.academy.cohorts[0]?.id||null;
      }
    }

    function activeCohort(){
      ensureAcademyState();
      return state.academy.cohorts.find(cohort=>cohort.id===state.academy.activeCohortId)||state.academy.cohorts[0]||null;
    }

    function syncLocalLearnerToCohorts(){
      state.academy.cohorts.forEach(cohort=>{
        const participant=cohort.participants.find(item=>item.localLearner || item.id===state.learner.learnerId);
        if(participant){
          participant.id=state.learner.learnerId;
          participant.name=state.learner.displayName;
          participant.localLearner=true;
          participant.completedModules=[...state.clearedModules];
        }
      });
    }

    function workspaceCounts(){
      const cohort=activeCohort();
      return {
        home:state.commerce?.library?.length||0,
        market:STARTER_TEMPLATES.length+(state.commerce?.listings?.filter(item=>item.status!=="archived").length||0),
        help:(state.commerce?.engagements?.filter(item=>!["approved","cancelled"].includes(item.status)).length||0),
        constellation:constellationReviewQueue().length,
        studio:state.school?.modules?.length||0,
        learn:state.clearedModules.length,
        cohort:cohort?.participants?.length||0,
        practica:state.academy.practica.filter(item=>item.status!=="completed").length,
        review:state.academy.reviews.filter(item=>item.status==="pending").length,
        credentials:state.badges.length,
        admin:state.events.length
      };
    }

    function setWorkspace(workspace,{focusId=null,replaceHash=true}={}){
      if(!WORKSPACES[workspace]) workspace="studio";
      ensureAcademyState();
      state.academy.activeWorkspace=workspace;

      document.querySelectorAll(".workspace-region").forEach(region=>{
        region.hidden=region.dataset.workspace!==workspace;
      });
      document.querySelectorAll("[data-workspace-target]").forEach(button=>{
        button.classList.toggle("active",button.dataset.workspaceTarget===workspace);
        button.setAttribute("aria-current",button.dataset.workspaceTarget===workspace?"page":"false");
      });

      const metadata=WORKSPACES[workspace];
      document.getElementById("workspace-kicker").textContent=metadata.kicker;
      document.getElementById("workspace-title").textContent=metadata.title;
      document.getElementById("workspace-description").textContent=metadata.description;
      document.getElementById("workspace-breadcrumb").innerHTML=`
        <button type="button" data-workspace-target="studio">Academy</button>
        <span>›</span>
        <strong>${escapeHTML(metadata.label)}</strong>`;
      document.getElementById("workspace-breadcrumb").querySelector("button").addEventListener("click",()=>setWorkspace("studio"));

      document.getElementById("module-nav-shell").hidden=workspace!=="learn";
      renderWorkspaceNavigation();
      renderContextNavigation(workspace);
      document.getElementById("sidebar").classList.remove("open");

      if(replaceHash){
        const hash=focusId?`#/${workspace}/${focusId}`:`#/${workspace}`;
        history.replaceState(null,"",hash);
      }

      document.getElementById("active-context-strip").hidden=workspace!=="learn";
      renderAcademy();
      saveState();

      requestAnimationFrame(()=>{
        if(focusId){
          document.getElementById(focusId)?.scrollIntoView({behavior:"smooth",block:"start"});
        } else {
          window.scrollTo({top:0,behavior:"smooth"});
        }
      });
    }

    function renderWorkspaceNavigation(){
      const counts=workspaceCounts();
      const side=document.getElementById("workspace-side-nav");
      side.innerHTML=Object.entries(WORKSPACES).map(([id,metadata])=>`
        <button type="button" data-workspace-target="${escapeHTML(id)}" class="${state.academy.activeWorkspace===id?"active":""}">
          <span>${escapeHTML(metadata.label)}</span>
          <span class="nav-count">${counts[id]}</span>
        </button>`).join("");
      side.querySelectorAll("[data-workspace-target]").forEach(button=>{
        button.addEventListener("click",()=>setWorkspace(button.dataset.workspaceTarget));
      });
    }

    function renderContextNavigation(workspace){
      const metadata=WORKSPACES[workspace];
      document.getElementById("context-nav-heading").textContent=`${metadata.label} sections`;
      const nav=document.getElementById("context-nav");
      nav.innerHTML=metadata.contexts.map(([id,label],index)=>`
        <button type="button" data-focus-id="${escapeHTML(id)}" class="${index===0?"active":""}">
          <span>${escapeHTML(label)}</span><span>↘</span>
        </button>`).join("");
      nav.querySelectorAll("[data-focus-id]").forEach(button=>{
        button.addEventListener("click",()=>{
          nav.querySelectorAll("button").forEach(item=>item.classList.remove("active"));
          button.classList.add("active");
          document.getElementById(button.dataset.focusId)?.scrollIntoView({behavior:"smooth",block:"start"});
          history.replaceState(null,"",`#/${workspace}/${button.dataset.focusId}`);
        });
      });
    }

    const TRAVERSAL_LABELS={guided:"Guided Path",jit:"Just-in-Time",browse:"Browse the Zine",review:"Review",creator:"Creator Preview"};
    const PROJECT_GATE_STATES=new Set(["not-started","drafting","ready-to-submit","sending","submitted","under-review","revision-requested","accepted","rejected","handoff-failed","integration-unavailable"]);

    function applyAppearanceMode(mode,{persist=true}={}){
      mode=["paper","blueprint","quiet"].includes(mode)?mode:"paper";
      if(state?.academy)state.academy.appearanceMode=mode;
      document.body.dataset.appearance=mode;
      document.body.classList.toggle("quiet",mode==="quiet");
      document.querySelectorAll("[data-appearance-mode]").forEach(button=>button.classList.toggle("active",button.dataset.appearanceMode===mode));
      const theme=document.querySelector('meta[name="theme-color"]');
      if(theme)theme.content=mode==="blueprint"?"#071525":mode==="quiet"?"#eee7d4":"#fffaf0";
      if(persist&&state){saveState();}
    }

    function currentLearningIndex(){
      const modules=state.school?.modules||[];
      let index=modules.findIndex(module=>module.id===activeModuleId||module.id===state.academy.selectedModuleId);
      if(index<0)index=modules.findIndex(module=>!state.clearedModules.includes(module.id));
      if(index<0)index=Math.max(0,modules.length-1);
      return index;
    }

    function moduleContract(module,index){
      const previous=state.school?.modules?.[index-1];
      const next=state.school?.modules?.[index+1];
      const exercise=module.exercise||(module.blocks||[]).find(block=>block.type==="exercise")?.exercise;
      const hasQuiz=Boolean(module.quiz?.length||(module.blocks||[]).some(block=>block.type==="quiz"));
      const copyLength=(module.paragraphs||[]).join(" ").length+(module.blocks||[]).reduce((sum,block)=>sum+JSON.stringify(block).length,0);
      const effort=Math.max(10,Math.min(90,Math.round(copyLength/110)+((module.quiz?.length||0)*3)+((module.media||[]).length*8)));
      return {
        objective:(module.objectives||[])[0]||module.summary||`Understand and apply ${module.title}.`,
        why:module.summary||`This module supports the school outcome for ${state.school?.subject||"the active intention"}.`,
        prerequisites:index===0?"No module prerequisite":`Complete ${previous?.title||"the previous module"}`,
        effort:`About ${effort} minutes`,
        artifact:exercise?.title||exercise?.prompt||"A practical response or lesson artifact",
        completion:hasQuiz?"Pass the module knowledge check":"Complete the stated module gate",
        next:next?.title||"Final project and verified assessment",
        cerbanimo:exercise?`Practice can become a Cerbanimo evidence task.`:"No Cerbanimo action is required yet."
      };
    }

    function moduleCompetency(module){
      const mastery=state.mastery?.[module.id]||{};
      const hasArtifact=state.artifacts.some(item=>item.moduleId===module.id);
      const projectAccepted=projectGateAccepted();
      const finalPassed=state.academy.finalTest?.passed;
      if(finalPassed)return "Assessed";
      if(projectAccepted&&hasArtifact)return "Verified through project work";
      if(hasArtifact)return "Demonstrated";
      if(state.clearedModules.includes(module.id))return mastery.best?"Practiced":"Introduced";
      if(Number(mastery.attempts||0)>0)return "Needs reinforcement";
      return "Introduced";
    }

    function moduleContractMarkup(module,index){
      const contract=moduleContract(module,index);
      return `<details class="lesson-contract-shell"><summary>Learning contract · ${escapeHTML(contract.effort)}</summary><div class="lesson-contract">
        ${[["Objective",contract.objective],["Why it matters",contract.why],["Prerequisite",contract.prerequisites],["Practical artifact",contract.artifact],["Completion",contract.completion],["Next",contract.next]].map(([label,value])=>`<div class="contract-item"><b>${escapeHTML(label)}</b><span>${escapeHTML(value)}</span></div>`).join("")}
      </div></details>`;
    }

    function normalizeYouTubeVideo(value){
      const safe=safeExternalURL(value);
      if(!safe)return null;
      try{
        const url=new URL(safe);
        const host=url.hostname.toLowerCase().replace(/^www\./,"");
        let id="";
        if(host==="youtu.be")id=url.pathname.split("/").filter(Boolean)[0]||"";
        else if(["youtube.com","m.youtube.com","music.youtube.com","youtube-nocookie.com"].includes(host)){
          if(url.pathname==="/watch")id=url.searchParams.get("v")||"";
          else {
            const parts=url.pathname.split("/").filter(Boolean);
            if(["embed","shorts","live"].includes(parts[0]))id=parts[1]||"";
          }
        }
        if(!/^[A-Za-z0-9_-]{6,20}$/.test(id))return null;
        return {provider:"youtube",videoId:id,url:`https://www.youtube.com/watch?v=${id}`,embedUrl:`https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1`};
      }catch{return null;}
    }

    function normalizeModuleVideo(raw){
      const normalized=normalizeYouTubeVideo(raw?.url||raw?.sourceUrl||"");
      if(!normalized)return null;
      return {
        id:String(raw?.id||`video-${normalized.videoId}`),type:"video",provider:"youtube",videoId:normalized.videoId,url:normalized.url,embedUrl:normalized.embedUrl,
        title:String(raw?.title||"Module video").slice(0,180),attribution:String(raw?.attribution||"").slice(0,240),description:String(raw?.description||"").slice(0,1600),transcript:String(raw?.transcript||"").slice(0,40000),
        chapters:Array.isArray(raw?.chapters)?raw.chapters.map(String).filter(Boolean).slice(0,80):[],prompts:Array.isArray(raw?.prompts)?raw.prompts.map(String).filter(Boolean).slice(0,40):[]
      };
    }

    function moduleMediaMarkup(module){
      const videos=(module.media||[]).map(normalizeModuleVideo).filter(Boolean);
      return videos.map(video=>`<section class="module-video" aria-labelledby="${escapeHTML(video.id)}-title">
        <div class="module-video-frame"><iframe src="${escapeHTML(video.embedUrl)}" title="${escapeHTML(video.title)}" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>
        <h3 id="${escapeHTML(video.id)}-title">${escapeHTML(video.title)}</h3>
        ${video.attribution?`<div class="video-meta">Source: ${escapeHTML(video.attribution)}</div>`:""}
        ${video.description?`<p>${escapeHTML(video.description)}</p>`:""}
        <a class="button" href="${escapeHTML(video.url)}" target="_blank" rel="noopener noreferrer">Open video fallback</a>
        ${video.chapters.length?`<details><summary>Chapters</summary><div class="video-chapters">${video.chapters.map(item=>`<span>${escapeHTML(item)}</span>`).join("")}</div></details>`:""}
        ${video.transcript?`<details><summary>Transcript or offline notes</summary><div class="lesson-copy"><p>${escapeHTML(video.transcript).replaceAll("\n","</p><p>")}</p></div></details>`:""}
        ${video.prompts.length?`<div class="video-prompts"><b>Connected prompts</b><ol>${video.prompts.map(item=>`<li>${escapeHTML(item)}</li>`).join("")}</ol></div>`:""}
      </section>`).join("");
    }

    function renderModuleRow(module,index,{current=false,reason=""}={}){
      const unlocked=moduleUnlocked(index);
      const cleared=state.clearedModules.includes(module.id);
      const row=document.createElement("button");
      row.type="button";
      row.className=`module-row ${current?"current":""} ${cleared?"cleared":""} ${unlocked?"":"locked"}`;
      row.disabled=!unlocked;
      row.dataset.moduleId=module.id;
      row.innerHTML=`<span class="module-row-index">${String(index+1).padStart(2,"0")}</span><span class="module-row-copy"><b>${escapeHTML(module.title)}</b><span>${escapeHTML(reason||(cleared?"Completed and available for review":unlocked?"Available when you choose to explore it":`Locked until ${state.school.modules[index-1]?.title||"the previous module"} is complete`))}</span></span><span class="module-state-stack"><span class="module-state-chip">${cleared?"complete":unlocked?"open":"locked"}</span><span class="competency-chip">${escapeHTML(moduleCompetency(module))}</span></span>`;
      if(unlocked)row.addEventListener("click",()=>openModule(module.id));
      return row;
    }

    function renderLearningThread(container){
      const modules=state.school?.modules||[];
      if(!modules.length){container.innerHTML='<div class="empty">Create or install a school to begin.</div>';return;}
      const activeIndex=currentLearningIndex();
      const active=modules[activeIndex];
      activeModuleId=active?.id||null;
      state.academy.selectedModuleId=activeModuleId;
      const mode=state.academy.traversalMode;
      const addRow=(index,reason)=>{if(index>=0&&index<modules.length)container.appendChild(renderModuleRow(modules[index],index,{reason,current:index===activeIndex}));};
      if(mode==="guided"||mode==="jit"){
        addRow(activeIndex-1,mode==="jit"?"Supporting context from the previous step":"Previous module, available for review");
        const lesson=renderLesson(active,activeIndex);lesson.classList.add("active-thread-module");container.appendChild(lesson);
        addRow(activeIndex+1,moduleUnlocked(activeIndex+1)?"Next likely action":"Complete the current module to unlock this step");
      }else if(mode==="review"){
        const reviewIndices=modules.map((module,index)=>({module,index})).filter(({module})=>state.clearedModules.includes(module.id)||Number(state.mastery?.[module.id]?.attempts||0)>0);
        if(!reviewIndices.length)container.innerHTML='<div class="empty">Complete or attempt a module to build a review trail.</div>';
        reviewIndices.forEach(({module,index})=>index===activeIndex?container.appendChild(renderLesson(module,index)):addRow(index,"Review prior work and repair weak concepts"));
      }else{
        modules.forEach((module,index)=>{
          if(index===activeIndex){const lesson=renderLesson(module,index);lesson.classList.add("active-thread-module");container.appendChild(lesson);}else addRow(index,mode==="creator"?`Creator preview · ${module.media?.length||0} video block${module.media?.length===1?"":"s"}`:"");
        });
      }
    }

    function setTraversalMode(mode){
      if(!TRAVERSAL_LABELS[mode])return;
      state.academy.traversalMode=mode;
      document.querySelectorAll("[data-traversal-mode]").forEach(button=>button.classList.toggle("active",button.dataset.traversalMode===mode));
      renderSchool();
      setWorkspace("learn",{focusId:"learning-path-panel"});
    }

    function renderLearningDashboard(){
      const modules=state.school?.modules||[];
      let nextIndex=modules.findIndex(module=>!state.clearedModules.includes(module.id));
      if(nextIndex<0)nextIndex=Math.max(0,modules.length-1);
      const selectedIndex=currentLearningIndex();
      const current=modules[selectedIndex]||modules[nextIndex];
      const currentContract=current?moduleContract(current,selectedIndex):null;
      const attempts=Object.values(state.mastery||{}).reduce((sum,item)=>sum+Number(item.attempts||0),0);
      const reviewed=state.academy.reviews.filter(review=>review.status==="approved").length;
      const cleared=modules.filter(module=>state.clearedModules.includes(module.id)).length;
      const total=totalXP();

      document.getElementById("school-cover-title").textContent=state.school?.title||"Living School";
      document.getElementById("school-cover-kicker").textContent=state.school?.sourceNote||state.school?.subject||"Current school";
      document.getElementById("school-cover-description").textContent=state.school?.description||"A pathway assembled around the work that matters now.";
      document.getElementById("school-cover-level").textContent=`Level ${levelForXP(total)} · ${total} XP`;
      document.getElementById("school-cover-progress-label").textContent=`${cleared} of ${modules.length} modules complete`;
      document.getElementById("school-cover-progress-fill").style.width=`${cleared/Math.max(1,modules.length)*100}%`;
      document.getElementById("school-cover-mode").textContent=TRAVERSAL_LABELS[state.academy.traversalMode];
      document.getElementById("header-school-context").textContent=state.school?.title||"Current school";

      document.getElementById("learning-next-title").textContent=current
        ? (state.clearedModules.includes(current.id)&&cleared===modules.length?"Pathway complete":current.title)
        : "No curriculum modules";
      document.getElementById("learning-next-description").textContent=currentContract
        ? currentContract.why
        : "Generate a school in the Create workspace.";
      document.getElementById("learning-next-action").textContent=currentContract
        ? currentContract.completion
        : "Create or install a school";
      document.getElementById("continue-learning").disabled=!current;
      document.getElementById("continue-learning").dataset.moduleId=current?.id||"";
      document.getElementById("continue-learning").textContent=cleared===modules.length?"Review pathway":"Continue module";

      document.getElementById("active-context-title").textContent=current?.title||state.school?.title||"Current school";
      document.getElementById("active-context-next").textContent=currentContract?`Next: ${currentContract.completion}`:"";
      document.getElementById("active-context-strip").hidden=state.academy.activeWorkspace!=="learn";

      document.getElementById("learning-stat-grid").innerHTML=[
        [cleared,"Complete"],[attempts,"Quiz attempts"],[state.artifacts.length,"Artifacts"],[reviewed,"Reviewed"]
      ].map(([value,label])=>`<div class="academy-stat"><b>${value}</b><span>${escapeHTML(label)}</span></div>`).join("");

      document.getElementById("learning-pathway").innerHTML=modules.map((module,index)=>{
        const moduleCleared=state.clearedModules.includes(module.id);
        const unlocked=moduleUnlocked(index);
        return `<button type="button" class="pathway-step ${moduleCleared?"cleared":index===selectedIndex?"current":unlocked?"":"locked"}" data-module-id="${escapeHTML(module.id)}" ${unlocked?"":"disabled"} aria-label="${escapeHTML(module.title)}">
          <b>${String(index+1).padStart(2,"0")} · ${escapeHTML(module.navLabel||module.title)}</b>
          <span>${moduleCleared?"complete":index===selectedIndex?"current":unlocked?"open":"locked"}</span>
        </button>`;
      }).join("");
      document.getElementById("learning-pathway").querySelectorAll("[data-module-id]").forEach(button=>button.addEventListener("click",()=>openModule(button.dataset.moduleId)));
      document.querySelectorAll("[data-traversal-mode]").forEach(button=>button.classList.toggle("active",button.dataset.traversalMode===state.academy.traversalMode));
      const traversalSelect=document.getElementById("traversal-select");if(traversalSelect)traversalSelect.value=state.academy.traversalMode;
      const indexDetails=document.getElementById("learning-index-details");if(indexDetails){if(["browse","creator"].includes(state.academy.traversalMode))indexDetails.open=true;document.getElementById("learning-index-summary").textContent=`View all ${modules.length} module${modules.length===1?"":"s"} · ${cleared} complete`;}
    }

    function renderCohort(){
      const cohort=activeCohort();
      if(!cohort) return;
      syncLocalLearnerToCohorts();

      document.getElementById("cohort-select").innerHTML=state.academy.cohorts.map(item=>
        `<option value="${escapeHTML(item.id)}" ${item.id===cohort.id?"selected":""}>${escapeHTML(item.name)}</option>`
      ).join("");
      document.getElementById("cohort-name").value=cohort.name;
      document.getElementById("cohort-mode").value=cohort.mode||"weekly";
      document.getElementById("cohort-start").value=cohort.startDate||"";

      const moduleCount=Math.max(1,state.school.modules.length);
      const totalClears=cohort.participants.reduce((sum,participant)=>sum+(participant.completedModules||[]).length,0);
      const average=Math.round(totalClears/(cohort.participants.length*moduleCount)*100);
      document.getElementById("cohort-stat-grid").innerHTML=[
        [cohort.participants.length,"Participants"],
        [cohort.assignments.length,"Assignments"],
        [average+"%","Average progress"],
        [new Set(cohort.participants.map(item=>item.role)).size,"Active roles"]
      ].map(([value,label])=>`<div class="academy-stat"><b>${value}</b><span>${escapeHTML(label)}</span></div>`).join("");

      document.getElementById("cohort-roster").innerHTML=cohort.participants.map(participant=>{
        const completed=(participant.completedModules||[]).length;
        const percent=Math.round(completed/moduleCount*100);
        return `<div class="roster-card">
          <div>
            <h4>${escapeHTML(participant.name)}</h4>
            <span class="role-chip">${escapeHTML(participant.role.replaceAll("-"," "))}</span>
          </div>
          <div>
            <b>${completed} / ${moduleCount} modules</b>
            <div class="mini-progress"><span style="width:${percent}%"></span></div>
          </div>
          <div class="card-action-row">
            ${participant.localLearner
              ? `<button type="button" data-open-learner="${escapeHTML(participant.id)}">Open path</button>`
              : `<button type="button" data-advance-participant="${escapeHTML(participant.id)}">Advance</button>`}
            <button type="button" data-rotate-role="${escapeHTML(participant.id)}">Rotate role</button>
          </div>
        </div>`;
      }).join("");
      document.querySelectorAll("[data-open-learner]").forEach(button=>button.addEventListener("click",()=>setWorkspace("learn")));
      document.querySelectorAll("[data-advance-participant]").forEach(button=>button.addEventListener("click",()=>advanceParticipant(button.dataset.advanceParticipant)));
      document.querySelectorAll("[data-rotate-role]").forEach(button=>button.addEventListener("click",()=>rotateParticipantRole(button.dataset.rotateRole)));

      const moduleOptions=state.school.modules.map(module=>`<option value="${escapeHTML(module.id)}">${escapeHTML(module.title)}</option>`).join("");
      document.getElementById("cohort-module").innerHTML=moduleOptions;

      document.getElementById("cohort-assignment-list").innerHTML=cohort.assignments.length
        ? cohort.assignments.map(assignment=>{
            const module=moduleById(assignment.moduleId);
            return `<div class="assignment-card">
              <h4>${escapeHTML(module?.title||assignment.moduleId)}</h4>
              <span class="status-token ${escapeHTML(assignment.status)}">${escapeHTML(assignment.status)}</span>
              <p>${escapeHTML(assignment.note||"No facilitator note.")}</p>
              <small>Target: ${escapeHTML(assignment.due||"open")} · Assigned ${new Date(assignment.createdAt).toLocaleDateString()}</small>
              <div class="card-action-row">
                <button type="button" data-open-assignment="${escapeHTML(assignment.moduleId)}">Open module</button>
                <button type="button" data-remove-assignment="${escapeHTML(assignment.id)}">Remove</button>
              </div>
            </div>`;
          }).join("")
        : `<div class="empty">No cohort assignments yet.</div>`;
      document.querySelectorAll("[data-open-assignment]").forEach(button=>button.addEventListener("click",()=>openModule(button.dataset.openAssignment)));
      document.querySelectorAll("[data-remove-assignment]").forEach(button=>button.addEventListener("click",()=>removeCohortAssignment(button.dataset.removeAssignment)));
    }

    function createCohort(){
      const name=document.getElementById("cohort-name").value.trim()||`Cohort ${state.academy.cohorts.length+1}`;
      const cohort={
        id:`cohort-${Date.now()}`,
        name,
        schoolId:state.school.id,
        mode:document.getElementById("cohort-mode").value,
        startDate:document.getElementById("cohort-start").value||new Date().toISOString().slice(0,10),
        createdAt:new Date().toISOString(),
        participants:[{
          id:state.learner.learnerId,
          name:state.learner.displayName,
          role:"learner",
          status:"active",
          completedModules:[...state.clearedModules],
          localLearner:true
        }],
        assignments:[]
      };
      state.academy.cohorts.push(cohort);
      state.academy.activeCohortId=cohort.id;
      emit("cohort.created",{cohortId:cohort.id,schoolId:state.school.id});
      renderAcademy();
      saveState();
      toast(`Created ${name}.`);
    }

    function addParticipant(){
      const cohort=activeCohort();
      const name=document.getElementById("participant-name").value.trim();
      if(!name){toast("Enter a participant name.");return;}
      cohort.participants.push({
        id:`participant-${Date.now()}-${slug(name)}`,
        name,
        role:document.getElementById("participant-role").value,
        status:"active",
        completedModules:[],
        localLearner:false
      });
      document.getElementById("participant-name").value="";
      emit("cohort.participant-enrolled",{cohortId:cohort.id,name});
      renderAcademy();
      renderMossOrchestration();
      saveState();
    }

    function advanceParticipant(id){
      const cohort=activeCohort();
      const participant=cohort.participants.find(item=>item.id===id);
      if(!participant) return;
      const next=state.school.modules.find(module=>!participant.completedModules.includes(module.id));
      if(next) participant.completedModules.push(next.id);
      emit("cohort.progress-updated",{cohortId:cohort.id,participantId:id,moduleId:next?.id||null});
      renderAcademy();
      saveState();
    }

    function rotateParticipantRole(id){
      const roles=["learner","practice-partner","peer-reviewer","facilitator","subject-mentor","curriculum-steward"];
      const participant=activeCohort().participants.find(item=>item.id===id);
      if(!participant) return;
      participant.role=roles[(roles.indexOf(participant.role)+1)%roles.length];
      emit("cohort.role-rotated",{cohortId:activeCohort().id,participantId:id,role:participant.role});
      renderAcademy();
      saveState();
    }

    function assignCohortModule(){
      const cohort=activeCohort();
      const moduleId=document.getElementById("cohort-module").value;
      if(!moduleId) return;
      cohort.assignments.push({
        id:`assignment-${Date.now()}`,
        moduleId,
        due:document.getElementById("cohort-due").value,
        note:document.getElementById("cohort-assignment-note").value.trim(),
        status:"active",
        createdAt:new Date().toISOString()
      });
      document.getElementById("cohort-assignment-note").value="";
      emit("cohort.module-assigned",{cohortId:cohort.id,moduleId});
      renderAcademy();
      saveState();
    }

    function removeCohortAssignment(id){
      const cohort=activeCohort();
      cohort.assignments=cohort.assignments.filter(item=>item.id!==id);
      renderAcademy();
      saveState();
    }

    function renderPractica(){
      const select=document.getElementById("practica-module");
      select.innerHTML=state.school.modules.map(module=>`<option value="${escapeHTML(module.id)}">${escapeHTML(module.title)}</option>`).join("");
      const active=state.academy.practica.filter(item=>item.status==="active").length;
      const submitted=state.academy.practica.filter(item=>item.status==="submitted").length;
      const completed=state.academy.practica.filter(item=>item.status==="completed").length;
      document.getElementById("practica-stat-grid").innerHTML=[
        [active,"Active practica"],
        [submitted,"Awaiting review"],
        [completed,"Completed"],
        [state.artifacts.length,"Evidence artifacts"]
      ].map(([value,label])=>`<div class="academy-stat"><b>${value}</b><span>${escapeHTML(label)}</span></div>`).join("");

      document.getElementById("practica-list").innerHTML=state.academy.practica.length
        ? [...state.academy.practica].reverse().map(item=>{
            const module=moduleById(item.moduleId);
            return `<div class="practica-card">
              <h4>${escapeHTML(item.title)}</h4>
              <span class="status-token ${escapeHTML(item.status)}">${escapeHTML(item.status)}</span>
              <p>${escapeHTML(module?.exercise?.prompt||"Applied learning practice.")}</p>
              <small>${escapeHTML(item.scope)} · ${new Date(item.createdAt).toLocaleString()}</small>
              <div class="card-action-row">
                <button type="button" data-practica-open="${escapeHTML(item.moduleId)}">Open lesson</button>
                <button type="button" data-practica-export="${escapeHTML(item.id)}">Export quest</button>
                ${item.status==="active"?`<button type="button" data-practica-submit="${escapeHTML(item.id)}">Mark submitted</button>`:""}
              </div>
            </div>`;
          }).join("")
        : `<div class="empty">No practica yet. Create one from a module.</div>`;
      document.querySelectorAll("[data-practica-open]").forEach(button=>button.addEventListener("click",()=>openModule(button.dataset.practicaOpen)));
      document.querySelectorAll("[data-practica-export]").forEach(button=>button.addEventListener("click",()=>exportPracticum(button.dataset.practicaExport)));
      document.querySelectorAll("[data-practica-submit]").forEach(button=>button.addEventListener("click",()=>submitPracticum(button.dataset.practicaSubmit)));
    }

    function createPracticum(){
      const moduleId=document.getElementById("practica-module").value;
      const module=moduleById(moduleId);
      if(!module) return;
      const title=document.getElementById("practica-title").value.trim()||`Practice: ${module.title}`;
      const practicum={
        id:`practicum-${Date.now()}`,
        moduleId,
        title,
        scope:document.getElementById("practica-scope").value,
        status:"active",
        createdAt:new Date().toISOString(),
        cohortId:activeCohort()?.id||null
      };
      state.academy.practica.push(practicum);
      document.getElementById("practica-title").value="";
      emit("practicum.created",{practicumId:practicum.id,moduleId,scope:practicum.scope});
      renderAcademy();
      saveState();
    }

    function practicumPayload(item){
      const module=moduleById(item.moduleId);
      const base=questPayload(module);
      return {
        ...base,
        practicum:{
          id:item.id,
          title:item.title,
          scope:item.scope,
          cohortId:item.cohortId,
          status:item.status
        }
      };
    }

    function exportPracticum(id){
      const item=state.academy.practica.find(practicum=>practicum.id===id);
      if(!item) return;
      download(`${slug(item.title)}-cerbanimo-practicum.json`,JSON.stringify(practicumPayload(item),null,2),"application/json;charset=utf-8");
    }

    function submitPracticum(id){
      const item=state.academy.practica.find(practicum=>practicum.id===id);
      if(!item) return;
      item.status="submitted";
      emit("practicum.submitted",{practicumId:id,moduleId:item.moduleId});
      renderAcademy();
      saveState();
    }

    function queueArtifactForReview(artifact){
      ensureAcademyState();
      if(state.academy.reviews.some(review=>review.artifactId===artifact.id)) return;
      state.academy.reviews.push({
        id:`review-${artifact.id}`,
        artifactId:artifact.id,
        moduleId:artifact.moduleId,
        submitter:state.learner.displayName,
        reviewer:null,
        feedback:"",
        status:"pending",
        criteria:artifact.rubric||[],
        createdAt:new Date().toISOString(),
        completedAt:null
      });
    }

    function renderReviews(){
      state.artifacts.forEach(queueArtifactForReview);
      const pending=state.academy.reviews.filter(review=>review.status==="pending");
      const approved=state.academy.reviews.filter(review=>review.status==="approved");
      const revision=state.academy.reviews.filter(review=>review.status==="revision");
      const reviewerCount=new Set(state.academy.reviews.map(review=>review.reviewer).filter(Boolean)).size;
      document.getElementById("review-stat-grid").innerHTML=[
        [pending.length,"Pending"],
        [approved.length,"Approved"],
        [revision.length,"Revision requested"],
        [reviewerCount,"Reviewers"]
      ].map(([value,label])=>`<div class="academy-stat"><b>${value}</b><span>${escapeHTML(label)}</span></div>`).join("");

      document.getElementById("review-queue").innerHTML=pending.length
        ? pending.map(review=>{
            const artifact=state.artifacts.find(item=>item.id===review.artifactId);
            return `<div class="review-card">
              <h4>${escapeHTML(artifact?.title||review.artifactId)}</h4>
              <span class="status-token pending">pending review</span>
              <p>${escapeHTML((artifact?.content||"").slice(0,260))}${(artifact?.content||"").length>260?"…":""}</p>
              <small>${escapeHTML(review.submitter)} · score ${artifact?.score??"unscored"}/100</small>
              <div class="card-action-row">
                <button type="button" data-review-approve="${escapeHTML(review.id)}">Approve</button>
                <button type="button" data-review-revision="${escapeHTML(review.id)}">Request revision</button>
                <button type="button" data-review-inspect="${escapeHTML(review.artifactId)}">Inspect artifact</button>
              </div>
            </div>`;
          }).join("")
        : `<div class="empty">No pending reviews.</div>`;

      document.querySelectorAll("[data-review-approve]").forEach(button=>button.addEventListener("click",()=>completeReview(button.dataset.reviewApprove,"approved")));
      document.querySelectorAll("[data-review-revision]").forEach(button=>button.addEventListener("click",()=>completeReview(button.dataset.reviewRevision,"revision")));
      document.querySelectorAll("[data-review-inspect]").forEach(button=>button.addEventListener("click",()=>setWorkspace("practica",{focusId:"artifacts-panel"})));

      const completed=state.academy.reviews.filter(review=>review.status!=="pending");
      document.getElementById("review-history").innerHTML=completed.length
        ? [...completed].reverse().map(review=>{
            const artifact=state.artifacts.find(item=>item.id===review.artifactId);
            return `<div class="review-card">
              <h4>${escapeHTML(artifact?.title||review.artifactId)}</h4>
              <span class="status-token ${escapeHTML(review.status)}">${escapeHTML(review.status)}</span>
              <p>${escapeHTML(review.feedback||"No written feedback.")}</p>
              <small>${escapeHTML(review.reviewer||"Reviewer")} · ${review.completedAt?new Date(review.completedAt).toLocaleString():""}</small>
            </div>`;
          }).join("")
        : `<div class="empty">No completed reviews yet.</div>`;
    }

    function completeReview(id,status){
      const review=state.academy.reviews.find(item=>item.id===id);
      if(!review) return;
      const feedback=document.getElementById("review-feedback").value.trim();
      if(!feedback){
        document.getElementById("review-guidance").className="feedback fail";
        document.getElementById("review-guidance").textContent="Write actionable feedback before completing a review.";
        return;
      }
      review.status=status;
      review.feedback=feedback;
      review.reviewer=document.getElementById("reviewer-name").value.trim()||"Local reviewer";
      review.completedAt=new Date().toISOString();
      const artifact=state.artifacts.find(item=>item.id===review.artifactId);
      if(artifact) artifact.reviewStatus=status;
      const event=emit("review.completed",{reviewId:id,artifactId:review.artifactId,status,reviewer:review.reviewer},`review:${id}:${status}`);
      awardXP("review",status==="approved"?18:12,`${status==="approved"?"Approved":"Returned"} evidence with peer feedback`,event.dedupeKey);
      document.getElementById("review-feedback").value="";
      document.getElementById("review-guidance").className="feedback pass";
      document.getElementById("review-guidance").textContent=`Review recorded as ${status}. Review practice XP was awarded once.`;
      renderSchool();
    }

    function renderFacilitator(){
      const cohort=activeCohort();
      const pendingReviews=state.academy.reviews.filter(review=>review.status==="pending").length;
      const struggling=state.school.modules.filter(module=>{
        const mastery=state.mastery[module.id];
        return mastery && mastery.attempts>1 && !state.clearedModules.includes(module.id);
      });
      const activePractica=state.academy.practica.filter(item=>item.status==="active").length;
      const assigned=cohort?.assignments?.length||0;

      document.getElementById("facilitator-stat-grid").innerHTML=[
        [cohort?.participants?.length||0,"Participants"],
        [struggling.length,"Stuck modules"],
        [pendingReviews,"Pending reviews"],
        [activePractica,"Active practica"]
      ].map(([value,label])=>`<div class="academy-stat"><b>${value}</b><span>${escapeHTML(label)}</span></div>`).join("");

      const attention=[];
      if(pendingReviews) attention.push({level:"high",title:"Evidence queue growing",detail:`${pendingReviews} artifact(s) await review. Rotate reviewers or schedule a review circle.`});
      if(struggling.length) attention.push({level:"high",title:"Repeated difficulty",detail:`Learners are repeating ${struggling.map(module=>module.title).join(", ")}. Add a counterexample or facilitated exercise.`});
      if(activePractica && !state.artifacts.length) attention.push({level:"medium",title:"Practice without evidence",detail:"Active practica exist, but no field artifacts have been saved yet."});
      if(assigned===0) attention.push({level:"medium",title:"No cohort assignment",detail:"The active cohort has no common learning target."});
      if((cohort?.participants?.length||0)<3) attention.push({level:"low",title:"Thin role rotation",detail:"With fewer than three participants, peer review and role rotation will remain concentrated."});
      if(!attention.length) attention.push({level:"low",title:"System balanced",detail:"No immediate bottleneck is visible. Consider a learner-led teaching module next."});

      document.getElementById("facilitator-attention").innerHTML=attention.map(item=>
        `<div class="attention-card ${escapeHTML(item.level)}"><b>${escapeHTML(item.title)}</b><br>${escapeHTML(item.detail)}</div>`
      ).join("");

      const primary=attention[0];
      document.getElementById("facilitator-brief").innerHTML=`
        <span class="tag">${escapeHTML(primary.level)} attention</span>
        <h3>${escapeHTML(primary.title)}</h3>
        <p>${escapeHTML(primary.detail)}</p>
        <p><b>Suggested intervention:</b> ${escapeHTML(suggestFacilitatorIntervention(primary.title,struggling))}</p>`;

      document.getElementById("facilitator-note-list").innerHTML=state.academy.facilitatorNotes.length
        ? [...state.academy.facilitatorNotes].reverse().map(note=>
            `<div class="facilitator-note-card"><b>${escapeHTML(new Date(note.at).toLocaleString())}</b><br>${escapeHTML(note.text)}</div>`
          ).join("")
        : `<div class="empty">No facilitator notes recorded.</div>`;
    }

    function suggestFacilitatorIntervention(title,struggling){
      if(/Evidence queue/.test(title)) return "Run a twenty-minute calibration circle: two reviewers score the same artifact, compare reasoning, then divide the queue.";
      if(/Repeated difficulty/.test(title)) return `Pause progression and ask learners to repair one misconception through a visual model and peer explanation${struggling[0]?` for ${struggling[0].title}`:""}.`;
      if(/Practice without evidence/.test(title)) return "Convert the next practicum milestone into a small, reviewable artifact with a named proof requirement.";
      if(/No cohort assignment/.test(title)) return "Assign one module with a concrete reason, target date, and paired reflection.";
      return "Invite one learner to teach a cleared concept and record what the explanation reveals about the curriculum.";
    }

    function saveFacilitatorNote(){
      const text=document.getElementById("facilitator-note").value.trim();
      if(!text) return;
      state.academy.facilitatorNotes.push({id:`note-${Date.now()}`,text,at:new Date().toISOString(),cohortId:activeCohort()?.id||null});
      document.getElementById("facilitator-note").value="";
      emit("facilitator.note-created",{cohortId:activeCohort()?.id||null});
      renderAcademy();
      saveState();
    }

    function renderAcademy(){
      ensureAcademyState();
      ensureConstellationState();
      syncLocalLearnerToCohorts();
      renderLearningDashboard();
      renderLearnerConstellation();
      renderCohort();
      renderPractica();
      renderReviews();
      renderFacilitator();
      renderCommerce();
      renderWorkspaceNavigation();
      renderVideoStudio();
      renderFinalProjectGate();
      renderFinalTest();
      renderHeaderControls();
      renderManifest();
      renderEvents();
      updateTopStats();
    }

    function navigateFromHash(){
      const match=location.hash.match(/^#\/([^/]+)(?:\/(.+))?$/);
      if(match && WORKSPACES[match[1]]){
        setWorkspace(match[1],{focusId:match[2]||null,replaceHash:false});
      } else {
        setWorkspace(state.academy.activeWorkspace||"home",{replaceHash:false});
      }
    }

    function moduleUnlocked(index) {
      if(index===0) return true;
      return state.clearedModules.includes(state.school.modules[index-1].id);
    }

    function moduleById(id) {
      return state.school.modules.find(module=>module.id===id);
    }


    function allQuizQuestions(){
      return (state.school?.modules||[]).flatMap(module=>
        (module.blocks||[])
          .filter(block=>block.type==="quiz")
          .flatMap(block=>(block.questions||[]).map(question=>({module,block,question})))
      );
    }

    function assessmentAuditSummary(){
      ensureAssessmentState();
      const entries=allQuizQuestions();
      const shortAnswers=entries.filter(entry=>entry.question.type==="short-answer");
      const exact=shortAnswers.filter(entry=>entry.question.validation?.mode==="exact");
      const keyword=shortAnswers.filter(entry=>entry.question.validation?.mode==="keywords");
      const reflection=shortAnswers.filter(entry=>entry.question.validation?.mode==="reflection");
      const strictKeywords=keyword.filter(entry=>effectiveShortAnswerEnforcement(entry.question)==="strict");
      const coachingKeywords=keyword.filter(entry=>effectiveShortAnswerEnforcement(entry.question)==="guidance");
      const missingFeedback=shortAnswers.filter(entry=>
        !(entry.question.validation?.feedback||entry.question.explanation||"").trim()
      );
      return {
        questions:entries.length,
        shortAnswers:shortAnswers.length,
        exact:exact.length,
        keyword:keyword.length,
        reflection:reflection.length,
        strictKeywords:strictKeywords.length,
        coachingKeywords:coachingKeywords.length,
        missingFeedback:missingFeedback.length,
        drafts:Object.keys(state.quizDrafts||{}).length,
        reviewRequests:state.assessment.reviewRequests.length
      };
    }

    function renderAssessmentAudit(){
      const node=document.getElementById("assessment-audit");
      if(!node) return;
      ensureAssessmentState();
      document.getElementById("assessment-policy").value=state.assessment.policy;
      document.getElementById("assessment-autosave").checked=state.assessment.autosaveDrafts;
      document.getElementById("assessment-show-coaching").checked=state.assessment.showIdeaCoaching;
      document.getElementById("assessment-review-path").checked=state.assessment.allowReviewChallenges;
      const audit=assessmentAuditSummary();
      const brittle=audit.strictKeywords;
      node.className=`assessment-audit ${brittle?"warn":"good"}`;
      node.textContent=[
        `${audit.questions} total quiz questions · ${audit.shortAnswers} short answers`,
        `${audit.exact} strict objective answers · ${audit.coachingKeywords} coaching keyword checks · ${audit.strictKeywords} strict keyword gates · ${audit.reflection} open reflections`,
        `${audit.missingFeedback} short answers lack authored feedback · ${audit.drafts} saved drafts · ${audit.reviewRequests} validation challenges`,
        brittle
          ? `Audit warning: ${brittle} keyword gate${brittle===1?" is":"s are"} currently strict. Use strict keywords only when the named terms themselves are required.`
          : "No strict keyword quota is currently blocking alternate phrasing."
      ].join("\n");
    }

    function setAssessmentPolicy(policy){
      ensureAssessmentState();
      state.assessment.policy=["learner-first","balanced","strict"].includes(policy)
        ? policy
        : "learner-first";
      saveState();
      renderSchool();
      renderAssessmentAudit();
    }

    function makeKeywordChecksCoachingOnly(){
      let changed=0;
      allQuizQuestions().forEach(({question})=>{
        if(question.type==="short-answer"&&question.validation?.mode==="keywords"){
          question.validation.enforcement="guidance";
          changed++;
        }
      });
      state.assessment.policy="learner-first";
      saveState();
      renderSchool();
      toast(`${changed} keyword check${changed===1?"":"s"} converted to coaching-only.`);
    }

    function clearSavedQuizDrafts(){
      state.quizDrafts={};
      saveState();
      renderSchool();
      renderAssessmentAudit();
      toast("Saved quiz drafts cleared.");
    }

    function renderSchool() {
      ensureAssessmentState();
      if(!state.school) {
        state.school=generateSchool(defaultKnowledge.subject,"",6,"intermediate","balanced","punk");
      }

      const school=state.school;
      renderAssessmentAudit();
      document.getElementById("top-school-title").textContent=school.title;
      document.getElementById("top-school-subtitle").textContent=school.subtitle || school.subject;
      document.getElementById("sidebar-subject").textContent=school.sourceNote || "Generated school";
      document.getElementById("sidebar-title").textContent=school.title;
      document.getElementById("sidebar-description").textContent=school.description;
      document.getElementById("hero-eyebrow").textContent=school.sourceNote || "Generated curriculum";
      document.getElementById("hero-title").innerHTML=`${escapeHTML(String(school.subject||school.title||"Living").split(/[,:]/)[0])}<br><span>school.</span>`;
      document.getElementById("hero-description").textContent=school.description;
      document.getElementById("hero-poster-text").innerHTML=schoolIsDefault(school.subject)?"Learn<br>Prove<br>Organize":"Learn<br>Build<br>Transfer";

      const cleared=school.modules.filter(module=>state.clearedModules.includes(module.id)).length;
      document.getElementById("progress-label").textContent=`${cleared} / ${school.modules.length} modules cleared`;
      document.getElementById("progress-fill").style.width=`${cleared/Math.max(1,school.modules.length)*100}%`;

      document.getElementById("school-overview").innerHTML=[
        ["Subject",school.subject],
        ["Curriculum",`${school.modules.length} generated modules`],
        ["Model source",school.sourceNote || "local generator"],
        ...(school.sourceAnalysis ? [["Claims",`${school.sourceAnalysis.claims} parsed · ${school.sourceAnalysis.sources.length} sources`]] : [])
      ].map(([label,value])=>`<div class="overview-card"><b>${escapeHTML(label)}</b>${escapeHTML(value)}</div>`).join("") +
      (school.sourceMode==="llm-generated"?`
        <div class="llm-school-warning">
          <b>LLM-generated curriculum</b>
          ${escapeHTML(school.generationWarning || "This school was generated without a supplied source dump and may contain errors.")}
          <div class="verification-list">
            <span>verify facts</span><span>check dates</span><span>inspect citations</span><span>review high-stakes guidance</span>
          </div>
        </div>`:"") +
      (school.safetySensitive?`<div class="safety-banner" style="grid-column:1/-1"><b>Field-safety limitation</b>This curriculum organizes source material. It is not sufficient for plant identification, medical advice, survival instruction, harvesting permission, or authorization to consume anything.</div>`:"");

      const nav=document.getElementById("module-nav");
      nav.innerHTML="";
      const navigationGroups=new Map();
      (school.navigation||[]).forEach(group=>(group.moduleIds||[]).forEach(id=>navigationGroups.set(id,group.label)));
      let lastGroup=null;
      school.modules.forEach((module,index)=>{
        const group=navigationGroups.get(module.id)||module.group||"";
        if(group&&group!==lastGroup){
          const label=document.createElement("div");
          label.className="nav-group-label";
          label.textContent=group;
          nav.appendChild(label);
          lastGroup=group;
        }
        const unlocked=moduleUnlocked(index);
        const clearedModule=state.clearedModules.includes(module.id);
        const button=document.createElement("button");
        button.type="button";
        button.className=`nav-button ${unlocked?"":"locked"} ${clearedModule?"cleared":""} ${activeModuleId===module.id?"active":""}`;
        button.disabled=!unlocked;
        button.innerHTML=`<span class="nav-index">${String(index+1).padStart(2,"0")}</span><span class="nav-label">${escapeHTML(module.navLabel||module.title)}</span><span class="nav-state">${clearedModule?"cleared":unlocked?"open":"locked"}</span>`;
        button.addEventListener("click",()=>openModule(module.id));
        nav.appendChild(button);
      });

      const container=document.getElementById("lesson-container");
      container.innerHTML="";
      if(!activeModuleId||!school.modules.some(module=>module.id===activeModuleId)){
        activeModuleId=school.modules.find(module=>!state.clearedModules.includes(module.id))?.id||school.modules[0]?.id||null;
      }
      renderLearningThread(container);
      renderQuestModuleSelect();
      renderVideoStudio();
      renderFinalProjectGate();
      renderFinalTest();
      renderManifest();
      renderPassport();
      renderArtifacts();
      renderCredentials();
      renderEvents();
      updateTopStats();
      renderAcademy();
      saveState();
    }


    function customElementMarkup(element){
      if(!element) return "";
      const tone=`custom-tone-${element.tone||"paper"}`;
      const interactive=element.interactive?" interactive":"";
      const detail=escapeHTML(element.detail||"");
      const common=`data-detail="${detail}" opacity="${element.opacity??1}" stroke-width="${element.strokeWidth??3}"`;
      if(element.kind==="group"){
        return `<g class="custom-viz-element ${tone}${interactive}" ${common} transform="${escapeHTML(element.transform||"")}">${(element.children||[]).map(customElementMarkup).join("")}</g>`;
      }
      if(element.kind==="text"){
        return `<text class="custom-viz-element custom-viz-text ${tone}${interactive}" ${common} x="${element.x}" y="${element.y}" font-size="${element.size}" text-anchor="${element.anchor}" transform="rotate(${element.rotate||0} ${element.x} ${element.y})">${escapeHTML(element.text)}</text>`;
      }
      if(element.kind==="path"){
        return `<path class="custom-viz-element custom-viz-path ${tone}${interactive}" ${common} d="${escapeHTML(element.d||"")}"></path>`;
      }
      if(element.kind==="polyline"){
        return `<polyline class="custom-viz-element custom-viz-polyline ${tone}${interactive}" ${common} points="${escapeHTML(element.points||"")}"></polyline>`;
      }
      if(element.kind==="polygon"){
        return `<polygon class="custom-viz-element custom-viz-polygon ${element.filled?"fill-shape":""} ${tone}${interactive}" ${common} points="${escapeHTML(element.points||"")}"></polygon>`;
      }
      if(element.kind==="line"){
        return `<line class="custom-viz-element custom-viz-line ${tone}${interactive}" ${common} x1="${element.x1}" y1="${element.y1}" x2="${element.x2}" y2="${element.y2}"></line>`;
      }
      if(element.kind==="circle"){
        return `<circle class="custom-viz-element ${tone}${interactive}" ${common} cx="${element.cx}" cy="${element.cy}" r="${element.r}"></circle>`;
      }
      if(element.kind==="ellipse"){
        return `<ellipse class="custom-viz-element ${tone}${interactive}" ${common} cx="${element.cx}" cy="${element.cy}" rx="${element.rx}" ry="${element.ry}"></ellipse>`;
      }
      return `<rect class="custom-viz-element ${tone}${interactive}" ${common} x="${element.x}" y="${element.y}" width="${element.width}" height="${element.height}" rx="${element.rx||0}"></rect>`;
    }

    function renderCustomVisualization(container,viz){
      container.classList.add("custom-viz-shell");
      container.innerHTML=`
        <div class="proposal-header">
          <div><h3>${escapeHTML(viz.title)}</h3><p>${escapeHTML(viz.caption)}</p></div>
          <span class="viz-type-chip">custom scene</span>
        </div>
        <svg class="custom-viz-svg custom-tone-${escapeHTML(viz.background||"paper")}" viewBox="${escapeHTML(viz.viewBox)}" role="img" aria-label="${escapeHTML(viz.title)}">
          ${(viz.elements||[]).map(customElementMarkup).join("")}
        </svg>
        ${(viz.legend||[]).length?`<div class="custom-viz-legend">${viz.legend.map(item=>`<span class="custom-tone-${escapeHTML(item.tone)}">${escapeHTML(item.label)}</span>`).join("")}</div>`:""}
        <div class="viz-live" aria-live="polite">Select an element to inspect the model-authored scene.</div>`;
      const live=container.querySelector(".viz-live");
      container.querySelectorAll(".custom-viz-element.interactive").forEach(node=>{
        node.setAttribute("tabindex","0");
        node.setAttribute("role","button");
        const activate=()=>{
          container.querySelectorAll(".custom-viz-element").forEach(item=>item.classList.remove("active"));
          node.classList.add("active");
          live.textContent=node.dataset.detail||"No additional detail.";
        };
        node.addEventListener("click",activate);
        node.addEventListener("keydown",event=>{
          if(event.key==="Enter"||event.key===" "){event.preventDefault();activate();}
        });
      });
    }

    function shortAnswerCriteria(question,response){
      const rule=question.validation||{};
      const text=String(response||"").trim();
      const validation=validateShortAnswer(question,text);
      const rows=[];
      rows.push({id:"not-blank",label:"Answer is not blank",met:Boolean(text),partial:false,advisory:false});
      if(rule.minWords)rows.push({id:"min-words",label:`At least ${rule.minWords} words (${validation.words} now)`,met:validation.words>=rule.minWords,partial:false,advisory:false});
      if(rule.maxWords)rows.push({id:"max-words",label:`No more than ${rule.maxWords} words (${validation.words} now)`,met:validation.words<=rule.maxWords,partial:false,advisory:false});
      if(rule.mode==="exact"){
        rows.push({id:"exact-match",label:"Matches an accepted objective answer",met:validation.ok,partial:false,advisory:false});
      }else{
        (validation.criteria||[]).forEach(criterion=>{
          const points=Number(criterion.points||0),earned=Number(criterion.earned||0);
          rows.push({id:criterion.id,label:`${criterion.label}: ${earned}/${points} · ${criterion.feedback||"Revise this criterion."}`,met:points>0&&earned>=points*.8,partial:earned>0&&earned<points*.8,advisory:Boolean(validation.uncertain)});
        });
        if(validation.failures?.length)rows.push({id:"quality-check",label:validation.failures.join(" "),met:false,partial:false,advisory:false});
      }
      return{criteria:rows,words:validation.words,score:validation.score,authority:validation.authority};
    }

    function renderCriteriaMarkup(question,response=""){
      const evaluation=shortAnswerCriteria(question,response);
      return evaluation.criteria.map(criterion=>
        `<div class="criterion-status ${criterion.met?"met":criterion.partial?"partial":"unmet"} ${criterion.advisory?"advisory":""}" data-criterion-id="${escapeHTML(criterion.id)}">${escapeHTML(criterion.label)}</div>`
      ).join("");
    }

    function setLiveText(node,text,className){
      if(!node) return;
      node.className=className;
      node.textContent="";
      requestAnimationFrame(()=>{
        node.textContent=text;
      });
    }


    function quizDraftKey(module,block,question,index){
      return `${module.id}::${block.id||"quiz"}::${question.id||index}`;
    }

    function quizDraftValue(module,block,question,index){
      ensureAssessmentState();
      return state.quizDrafts[quizDraftKey(module,block,question,index)]??"";
    }

    function saveQuizDraftValue(module,block,question,index,value){
      ensureAssessmentState();
      if(!state.assessment.autosaveDrafts) return;
      const key=quizDraftKey(module,block,question,index);
      if(value===null||value===undefined||String(value)==="") delete state.quizDrafts[key];
      else state.quizDrafts[key]=String(value);
      saveState();
      renderAssessmentAudit();
    }

    function clearQuizDraftBlock(module,block,questions){
      ensureAssessmentState();
      (questions||[]).forEach((question,index)=>
        delete state.quizDrafts[quizDraftKey(module,block,question,index)]
      );
      saveState();
      renderAssessmentAudit();
    }

    function requestShortAnswerReview(module,block,question,response,validation){
      ensureAssessmentState();
      const request={
        id:`assessment-review-${Date.now()}-${Math.random().toString(16).slice(2,8)}`,
        schoolId:state.school?.id||null,
        moduleId:module.id,
        moduleTitle:module.title,
        blockId:block.id||null,
        questionId:question.id||null,
        prompt:question.prompt,
        response:String(response||""),
        validation:{
          mode:question.validation?.mode||"reflection",
          enforcement:validation.enforcement,
          failures:[...validation.failures],
          advisories:[...validation.advisories]
        },
        status:"requested",
        createdAt:new Date().toISOString()
      };
      state.assessment.reviewRequests.push(request);
      saveState();

      setWorkspace("help",{focusId:"help-request-builder"});
      document.getElementById("help-request-type").value="artifact-review";
      document.getElementById("help-request-title").value=`Review my answer: ${question.prompt}`;
      document.getElementById("help-request-skill").value=module.domain||state.school?.subject||"Learning assessment";
      document.getElementById("help-request-description").value=
        `I believe this short answer may be correct in different words.\n\n`+
        `Module: ${module.title}\nQuestion: ${question.prompt}\n\nMy answer:\n${response}\n\n`+
        `Automated validation feedback:\n${[...validation.failures,...validation.advisories].join(" ")}`;
      toast("Validation challenge saved and a human-review request was prefilled.");
      renderAssessmentAudit();
    }

    function renderNativeQuiz(container,module,block,moduleIndex){
      const questions=block.questions||[];
      if(!questions.length){
        container.innerHTML=`<div class="native-empty">The model supplied an empty quiz block. This proposal should have been blocked before publication.</div>`;
        return;
      }

      container.dataset.attempts="0";
      container.innerHTML=`
        ${block.title?`<h3>${escapeHTML(block.title)}</h3>`:""}
        ${questions.map((question,index)=>{
          const draft=quizDraftValue(module,block,question,index);
          if(question.type==="short-answer"){
            return `
              <fieldset class="quiz-question short-answer-question" data-question-index="${index}" data-touched="false">
                <legend>${index+1}. ${escapeHTML(question.prompt||"Untitled short-answer question")}</legend>
                <div class="short-answer-field">
                  <textarea
                    placeholder="${escapeHTML(question.placeholder||"Write a concise answer.")}"
                    aria-label="${escapeHTML(question.prompt||`Short answer ${index+1}`)}"
                    autocapitalize="sentences"
                    enterkeyhint="done"
                  >${escapeHTML(draft)}</textarea>
                  <div class="short-answer-rule ${effectiveShortAnswerEnforcement(question)==="guidance"?"coaching":""}">${escapeHTML(shortAnswerRuleDescription(question))}</div>
                  <div class="short-answer-live-criteria" aria-label="Live validation criteria">
                    ${renderCriteriaMarkup(question,"")}
                  </div>
                  <div class="question-attempt">Not submitted</div>
                  ${draft?`<div class="quiz-draft-note">Saved draft restored</div>`:""}
                  <div class="question-feedback" role="status" aria-live="polite" aria-atomic="true">Edit the answer, then validate the quiz.</div>
                  <div class="answer-review-row" hidden>
                    <button type="button" class="request-answer-review">Challenge this validation</button>
                    <small>Send the answer and rule to a human reviewer without erasing the attempt.</small>
                  </div>
                </div>
              </fieldset>`;
          }
          const selectedDraft=new Set(String(draft||"").split(",").map(value=>value.trim()).filter(Boolean));
          const multiple=question.type==="multiple-select";
          return `
            <fieldset class="quiz-question ${multiple?"multiple-select-question":"multiple-choice-question"}" data-question-index="${index}" data-touched="false">
              <legend>${index+1}. ${escapeHTML(question.prompt||"Untitled question")}${multiple?` <span class="question-kind">Select all that apply</span>`:""}</legend>
              ${(question.answers||[]).map((answer,answerIndex)=>`
                <label class="quiz-option"><input type="${multiple?"checkbox":"radio"}" name="native-quiz-${escapeHTML(module.id)}-${escapeHTML(block.id)}-${index}" value="${answerIndex}" ${(multiple?selectedDraft.has(String(answerIndex)):String(draft)===String(answerIndex))?"checked":""}><span>${escapeHTML(answer)}</span></label>
              `).join("")}
              <div class="question-attempt">Not submitted</div>
              <div class="question-feedback" role="status" aria-live="polite" aria-atomic="true">${multiple?"Choose every supported answer":"Choose an answer"}, then validate the quiz.</div>
            </fieldset>`;
        }).join("")}
        <div class="quiz-submit-row">
          <button class="button hot native-check-answers" type="button">Validate quiz</button>
          <div class="feedback" role="status" aria-live="assertive" aria-atomic="true">Complete every scored question. Short answers update their criteria while you type.</div>
        </div>`;

      const submitRow=container.querySelector(".quiz-submit-row");
      const submitButton=container.querySelector(".native-check-answers");

      questions.forEach((question,index)=>{
        const field=container.querySelector(`[data-question-index="${index}"]`);
        if(question.type==="short-answer"){
          const textarea=field.querySelector("textarea");
          const liveCriteria=field.querySelector(".short-answer-live-criteria");
          const questionFeedback=field.querySelector(".question-feedback");

          const refreshDraftState=()=>{
            liveCriteria.innerHTML=renderCriteriaMarkup(question,textarea.value);

            if(field.dataset.touched==="true"){
              const validation=validateShortAnswer(question,textarea.value);
              field.classList.toggle("correct",validation.ok);
              field.classList.toggle("incorrect",!validation.ok);
              const message=validation.ok
                ? validation.advisories.length
                  ? `Draft is complete. ${validation.advisories.join(" ")} Validate the full quiz to submit it.`
                  : `Draft meets every scored requirement. Validate the full quiz to submit it.`
                : `${validation.failures.join(" ")} ${validation.feedback}`.trim();
              const reviewRow=field.querySelector(".answer-review-row");
              reviewRow.hidden=!(!validation.ok&&validation.enforcement==="strict"&&textarea.value.trim()&&state.assessment.allowReviewChallenges);
              setLiveText(
                questionFeedback,
                message,
                `question-feedback ${validation.ok?"pass":"fail"}`
              );
            } else {
              field.classList.remove("correct","incorrect");
            }
          };

          const persistDraft=()=>{
            saveQuizDraftValue(module,block,question,index,textarea.value);
            refreshDraftState();
          };
          textarea.addEventListener("input",persistDraft);
          textarea.addEventListener("change",persistDraft);
          textarea.addEventListener("compositionend",persistDraft);

          field.querySelector(".request-answer-review").addEventListener("click",()=>{
            const validation=validateShortAnswer(question,textarea.value);
            requestShortAnswerReview(module,block,question,textarea.value,validation);
          });
        } else {
          field.querySelectorAll('input').forEach(input=>{
            input.addEventListener("change",()=>{
              const selected=[...field.querySelectorAll("input:checked")].map(item=>String(item.value));
              saveQuizDraftValue(module,block,question,index,question.type==="multiple-select"?selected.join(","):(selected[0]||""));
              if(field.dataset.touched!=="true") return;
              const expected=question.type==="multiple-select"
                ? new Set((question.correctIndices||[]).map(value=>String(value)))
                : new Set([String(question.correct)]);
              const ok=selected.length===expected.size&&selected.every(value=>expected.has(value));
              field.classList.toggle("correct",Boolean(ok));
              field.classList.toggle("incorrect",!ok);
              setLiveText(
                field.querySelector(".question-feedback"),
                ok ? (question.explanation||"Correct.") : (question.explanation||"Review the lesson and try again."),
                `question-feedback ${ok?"pass":"fail"}`
              );
            });
          });
        }
      });

      const validateQuiz=()=>{
        const active=document.activeElement;
        if(active&&container.contains(active)&&typeof active.blur==="function") active.blur();

        const attempt=Number(container.dataset.attempts||0)+1;
        container.dataset.attempts=String(attempt);
        submitRow.classList.add("validating");
        submitButton.disabled=true;
        submitButton.textContent=`Validating attempt ${attempt}…`;

        requestAnimationFrame(()=>{
          let correct=0;
          const total=questions.length;
          const missed=[];
          const outcomes=[];
          let firstFailedField=null;

          questions.forEach((question,index)=>{
            const field=container.querySelector(`[data-question-index="${index}"]`);
            const questionFeedback=field.querySelector(".question-feedback");
            const attemptLabel=field.querySelector(".question-attempt");
            field.dataset.touched="true";
            attemptLabel.textContent=`Attempt ${attempt}`;

            let result={ok:false,message:""};

            if(question.type==="short-answer"){
              const response=field.querySelector("textarea").value;
              const validation=validateShortAnswer(question,response);
              field.querySelector(".short-answer-live-criteria").innerHTML=
                renderCriteriaMarkup(question,response);
              result.ok=validation.ok;
              result.message=validation.ok
                ? `Attempt ${attempt}: accepted. ${validation.words} word${validation.words===1?"":"s"}.${validation.advisories.length?` ${validation.advisories.join(" ")}`:""}`
                : `Attempt ${attempt}: ${validation.failures.join(" ")} ${validation.feedback}`.trim();
              field.querySelector(".answer-review-row").hidden=
                !(!validation.ok&&validation.enforcement==="strict"&&response.trim()&&state.assessment.allowReviewChallenges);
            } else {
              const selected=[...field.querySelectorAll("input:checked")].map(input=>String(input.value));
              const expected=question.type==="multiple-select"
                ? new Set((question.correctIndices||[]).map(value=>String(value)))
                : new Set([String(question.correct)]);
              if(!selected.length){
                result.message=`Attempt ${attempt}: select ${question.type==="multiple-select"?"at least one answer":"an answer"}.`;
              } else if(selected.length===expected.size&&selected.every(value=>expected.has(value))){
                result.ok=true;
                result.message=`Attempt ${attempt}: ${question.explanation||"correct."}`;
              } else {
                result.message=`Attempt ${attempt}: ${question.explanation||"review the lesson and try again."}`;
              }
            }

            outcomes.push({question,ok:result.ok});
            field.classList.toggle("correct",result.ok);
            field.classList.toggle("incorrect",!result.ok);
            setLiveText(
              questionFeedback,
              result.message,
              `question-feedback ${result.ok?"pass":"fail"}`
            );

            if(result.ok){
              correct++;
            } else {
              missed.push(`Question ${index+1}`);
              if(!firstFailedField) firstFailedField=field;
            }
          });

          const feedback=submitRow.querySelector(".feedback");
          recordQuizOutcome(module,outcomes,{passed:total>0&&correct===total,source:"model-native-quiz"});
          if(total>0&&correct===total){
            setLiveText(
              feedback,
              `Attempt ${attempt} passed: ${correct}/${total} scored requirements met.`,
              "feedback pass"
            );
            clearQuizDraftBlock(module,block,questions);
            submitButton.textContent="Quiz passed";
            if(block.completionGate||module.completion?.type==="quiz"){
              setTimeout(()=>clearModule(module,moduleIndex),180);
            }
          } else {
            setLiveText(
              feedback,
              `Attempt ${attempt}: ${correct}/${total} correct. Revisit ${missed.join(", ")}.`,
              "feedback fail"
            );
            submitButton.disabled=false;
            submitButton.textContent="Validate revised answers";
            submitRow.classList.remove("validating");

            if(firstFailedField){
              firstFailedField.scrollIntoView({behavior:"smooth",block:"center"});
              const editable=firstFailedField.querySelector("textarea,input");
              setTimeout(()=>editable?.focus({preventScroll:true}),260);
            }
          }
        });
      };

      submitButton.addEventListener("click",event=>{
        event.preventDefault();
        validateQuiz();
      });
    }

    function renderNativeBlock(block,module,moduleIndex){
      const container=document.createElement("section");
      container.className="native-block";
      container.dataset.blockType=block.type;
      container.dataset.blockId=block.id;

      if(block.type==="heading"){
        const level=Math.max(2,Math.min(4,block.level||3));
        container.innerHTML=`<h${level}>${escapeHTML(block.text||"")}</h${level}>`;
      } else if(block.type==="prose"){
        container.classList.add("native-prose");
        container.innerHTML=(block.paragraphs||[]).map(paragraph=>`<p>${escapeHTML(paragraph)}</p>`).join("");
      } else if(block.type==="list"){
        const tag=block.ordered?"ol":"ul";
        container.innerHTML=`${block.title?`<h3>${escapeHTML(block.title)}</h3>`:""}<${tag} class="native-list">${(block.items||[]).map(item=>`<li>${escapeHTML(item)}</li>`).join("")}</${tag}>`;
      } else if(block.type==="steps"){
        container.innerHTML=`${block.title?`<h3>${escapeHTML(block.title)}</h3>`:""}<div class="native-steps">${(block.items||[]).map(item=>`<div class="native-step"><b>${escapeHTML(item.title)}</b>${escapeHTML(item.body)}</div>`).join("")}</div>`;
      } else if(block.type==="quote"){
        container.innerHTML=`<blockquote class="native-quote">${escapeHTML(block.text)}${block.attribution?`<cite>${escapeHTML(block.attribution)}</cite>`:""}</blockquote>`;
      } else if(block.type==="callout"){
        container.innerHTML=`<div class="native-callout ${escapeHTML(block.tone)}">${block.title?`<b>${escapeHTML(block.title)}</b>`:""}${escapeHTML(block.body)}</div>`;
      } else if(block.type==="table"){
        container.innerHTML=`${block.title?`<h3>${escapeHTML(block.title)}</h3>`:""}<div class="native-table-wrap"><table class="native-table"><thead><tr>${(block.columns||[]).map(column=>`<th>${escapeHTML(column.label)}</th>`).join("")}</tr></thead><tbody>${(block.rows||[]).map(row=>`<tr>${(block.columns||[]).map(column=>`<td>${escapeHTML(row[column.key]||"")}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      } else if(block.type==="concepts"){
        container.innerHTML=`${block.title?`<h3>${escapeHTML(block.title)}</h3>`:""}${(block.items||[]).length?`<div class="concept-grid">${block.items.map(concept=>`<div class="concept"><b>${escapeHTML(concept.term)}</b>${escapeHTML(concept.definition)}</div>`).join("")}</div>`:`<div class="native-empty">The model supplied no concepts. None were added.</div>`}`;
      } else if(block.type==="scenario"){
        container.innerHTML=`<div class="scenario-block">${block.title?`<h3>${escapeHTML(block.title)}</h3>`:""}<p>${escapeHTML(block.setup)}</p><div class="scenario-choice-list">${(block.choices||[]).map(choice=>`<div><b>${escapeHTML(choice.label)}</b><br>${escapeHTML(choice.consequence)}</div>`).join("")}</div></div>`;
      } else if(block.type==="visualization"){
        if(block.visualization?.type==="custom") renderCustomVisualization(container,block.visualization);
        else renderVisualization(container,{...module,visualization:block.visualization});
      } else if(block.type==="quiz"){
        renderNativeQuiz(container,module,block,moduleIndex);
      } else if(block.type==="exercise"){
        if(block.exercise?.title||block.exercise?.prompt){
          renderExercise(container,{...module,objectives:[],paragraphs:[],summary:module.summary||module.title,exercise:block.exercise});
        } else {
          container.innerHTML=`<div class="native-empty">The model supplied an empty exercise block. No exercise was invented.</div>`;
        }
      } else if(block.type==="checklist"){
        container.innerHTML=`${block.title?`<h3>${escapeHTML(block.title)}</h3>`:""}<div class="native-checklist">${(block.items||[]).map((item,index)=>`<label class="native-check"><input type="checkbox" data-check-index="${index}"><span>${escapeHTML(item)}</span></label>`).join("")}</div>${block.completionGate?`<button class="button hot native-checklist-complete" type="button">Complete checklist</button><div class="feedback">Check every supplied item.</div>`:""}`;
        container.querySelector(".native-checklist-complete")?.addEventListener("click",()=>{
          const inputs=[...container.querySelectorAll('input[type="checkbox"]')];
          const feedback=container.querySelector(".feedback");
          if(inputs.length&&inputs.every(input=>input.checked)){
            feedback.className="feedback pass";
            feedback.textContent="Checklist complete.";
            clearModule(module,moduleIndex);
          } else {
            feedback.className="feedback fail";
            feedback.textContent="Complete every supplied checklist item.";
          }
        });
      } else if(block.type==="code"){
        container.innerHTML=`${block.title?`<h3>${escapeHTML(block.title)}</h3>`:""}<pre class="native-code"><code data-language="${escapeHTML(block.language)}">${escapeHTML(block.code)}</code></pre>`;
      } else if(block.type==="divider"){
        container.innerHTML=`<hr class="native-divider">`;
      }
      return container;
    }

    function renderModelNativeLesson(module,index){
      const section=document.createElement("section");
      const unlocked=moduleUnlocked(index);
      const cleared=state.clearedModules.includes(module.id);
      section.className=`lesson model-native-lesson ${unlocked?"":"locked"} ${cleared?"cleared":""}`;
      section.id=module.id;
      section.dataset.moduleId=module.id;

      if(!unlocked){
        section.innerHTML=`<div class="lesson-header"><span class="lesson-number">${String(index+1).padStart(2,"0")}</span><h2>${escapeHTML(module.title)}</h2><span class="provenance">locked</span></div><div class="lesson-body"><p>Complete the previous module to unlock this model-authored section.</p></div>`;
        return section;
      }

      section.innerHTML=`
        <div class="lesson-header">
          <span class="lesson-number">${String(index+1).padStart(2,"0")}</span>
          <h2>${escapeHTML(module.title)}</h2>
          <span class="provenance">${escapeHTML(module.provenance)}<span class="model-origin">model-native</span>${module.modelKnowledgeWarning?`<span class="llm-origin">unverified knowledge</span>`:""}</span>
        </div>
        <div class="lesson-cleared">
          <div><strong>Module cleared</strong><span>${module.xp||0} ${escapeHTML(domains[module.domain]||module.domain)} canonical XP configured.</span></div>
          <button class="button reopen-module" type="button">Reopen</button>
        </div>
        <div class="lesson-body">
          ${module.kicker?`<span class="tag">${escapeHTML(module.kicker)}</span>`:""}
          ${module.summary?`<p class="lesson-summary">${escapeHTML(module.summary)}</p>`:""}
          ${moduleContractMarkup(module,index)}
          ${moduleMediaMarkup(module)}
          ${module.safetyNotice?`<div class="safety-banner"><b>Safety gate</b>${escapeHTML(module.safetyNotice)}</div>`:""}
          <div class="native-module-body"></div>
          <div class="native-completion"></div>
          <div class="lesson-footer">
            <div class="action-row">
              <button class="button simplify-module" type="button">Simplify</button>
              <button class="button advance-module" type="button">Make harder</button>
              <button class="button regenerate-module" type="button">Regenerate structure</button>
            </div>
            <button class="button export-module-quest" type="button">Export Cerbanimo quest</button>
          </div>
        </div>`;

      const body=section.querySelector(".native-module-body");
      if((module.blocks||[]).length){
        module.blocks.forEach(block=>body.appendChild(renderNativeBlock(block,module,index)));
      } else {
        body.innerHTML=`<div class="native-empty">This module intentionally contains no content blocks. The runtime did not manufacture any.</div>`;
      }

      const completion=section.querySelector(".native-completion");
      const mode=module.completion?.type||"manual";
      const hasGatedBlock=(module.blocks||[]).some(block=>(block.type==="quiz"||block.type==="checklist")&&block.completionGate);
      if(mode==="none"){
        completion.hidden=true;
      } else if((mode==="quiz"||mode==="checklist")&&hasGatedBlock){
        completion.innerHTML=`<h3>Completion gate</h3><p>${escapeHTML(module.completion?.instructions||"Complete the model-authored gate above.")}</p>`;
      } else {
        completion.innerHTML=`<h3>${escapeHTML(module.completion?.label||"Module completion")}</h3><p>${escapeHTML(module.completion?.instructions||"The model did not define an automated gate. Completion is recorded manually.")}</p><button class="button hot native-manual-complete" type="button">${escapeHTML(module.completion?.label||"Mark module complete")}</button>`;
        completion.querySelector(".native-manual-complete").addEventListener("click",()=>clearModule(module,index));
      }

      section.querySelector(".reopen-module")?.addEventListener("click",()=>section.classList.remove("cleared"));
      section.querySelector(".simplify-module")?.addEventListener("click",()=>mutateModule(module.id,"simplify"));
      section.querySelector(".advance-module")?.addEventListener("click",()=>mutateModule(module.id,"advance"));
      section.querySelector(".regenerate-module")?.addEventListener("click",()=>mutateModule(module.id,"regenerate"));
      section.querySelector(".export-module-quest")?.addEventListener("click",()=>exportCerbanimoQuest(module.id));
      return section;
    }


    function renderLesson(module,index) {
      if(module.structureMode==="model-native"||Array.isArray(module.blocks)) return renderModelNativeLesson(module,index);
      const section=document.createElement("section");
      const unlocked=moduleUnlocked(index);
      const cleared=state.clearedModules.includes(module.id);
      section.className=`lesson ${unlocked?"":"locked"} ${cleared?"cleared":""}`;
      section.id=module.id;
      section.dataset.moduleId=module.id;

      if(!unlocked) {
        section.innerHTML=`<div class="lesson-header"><span class="lesson-number">${String(index+1).padStart(2,"0")}</span><h2>${escapeHTML(module.title)}</h2><span class="provenance">locked</span></div><div class="lesson-body"><p>Clear the previous module to unlock this generated section.</p></div>`;
        return section;
      }

      section.innerHTML=`
        <div class="lesson-header">
          <span class="lesson-number">${String(index+1).padStart(2,"0")}</span>
          <h2>${escapeHTML(module.title)}</h2>
          <span class="provenance">${escapeHTML(module.provenance)}${module.modelMeta?`<span class="model-origin">writer model</span>`:""}${module.modelKnowledgeWarning?`<span class="llm-origin">unverified knowledge</span>`:""}</span>
        </div>
        <div class="lesson-cleared">
          <div><strong>Module cleared</strong><span>${module.xp} ${escapeHTML(domains[module.domain]||module.domain)} canonical XP recorded once.</span></div>
          <button class="button reopen-module" type="button">Reopen</button>
        </div>
        <div class="lesson-body">
          <span class="tag">${escapeHTML(module.kicker)}</span>
          <p class="lesson-summary">${escapeHTML(module.summary)}</p>
          ${moduleContractMarkup(module,index)}
          ${moduleMediaMarkup(module)}
          <h3>Learning objectives</h3>
          <div class="objective-grid">${module.objectives.map(item=>`<div class="objective">${escapeHTML(item)}</div>`).join("")}</div>
          <div class="lesson-copy">${module.paragraphs.map(paragraph=>`<p>${escapeHTML(paragraph)}</p>`).join("")}</div>
          ${module.safetyNotice?`<div class="safety-banner"><b>Safety gate</b>${escapeHTML(module.safetyNotice)}</div>`:""}
          <h3>Concepts</h3>
          <div class="concept-grid">${module.concepts.map(([term,definition])=>`<div class="concept"><b>${escapeHTML(term)}</b>${escapeHTML(definition)}</div>`).join("")}</div>
          ${module.claimLedger?.length?`
            <h3>Claim ledger</h3>
            <div class="claim-ledger">
              ${module.claimLedger.map(claim=>`
                <div class="claim-row">
                  <span class="claim-kind">${escapeHTML(claim.kind||"claim")}</span>
                  <div>
                    ${escapeHTML(claim.text)}
                    <div class="claim-citations">${(claim.refs||[]).map(ref=>`<span class="citation-chip">[${escapeHTML(ref)}]</span>`).join("") || '<span class="citation-chip">no citation</span>'}</div>
                  </div>
                  <span class="confidence-chip ${escapeHTML(claim.confidence||"unverified")}">${escapeHTML(claim.confidence||"unverified")}</span>
                </div>`).join("")}
            </div>`:""}
          ${module.sourceRefs?.length?`
            <div class="source-ledger">
              <h4>Sources used by this module</h4>
              ${module.sourceRefs.map(ref=>{
                const source=state.school.sourceAnalysis?.sources?.find(item=>item.id===ref);
                return source&&safeExternalURL(source.url)?`<div class="source-item"><span class="source-rank ${escapeHTML(source.rank)}">${escapeHTML(source.rank)}</span><a href="${escapeHTML(safeExternalURL(source.url))}" target="_blank" rel="noopener noreferrer">${escapeHTML(source.label||source.url)}</a>${source.note?`<br><small>${escapeHTML(source.note)}</small>`:""}</div>`:`<div class="source-item"><span class="source-rank unverified">unresolved</span> Citation [${escapeHTML(ref)}] was named in the dump but no safe URL was parsed.</div>`;
              }).join("")}
            </div>`:""}
          ${module.scenario?`
            <div class="scenario-block">
              <h3>${escapeHTML(module.scenario.title)}</h3>
              <p>${escapeHTML(module.scenario.setup)}</p>
              <div class="scenario-choice-list">
                ${module.scenario.choices.map(choice=>`<div><b>${escapeHTML(choice.label)}</b><br>${escapeHTML(choice.consequence)}</div>`).join("")}
              </div>
            </div>`:""}
          <div class="visualization"></div>
          <div class="knowledge-check"></div>
          <div class="exercise"></div>
          <div class="lesson-footer">
            <div class="action-row">
              <button class="button simplify-module" type="button">Simplify</button>
              <button class="button advance-module" type="button">Make harder</button>
              <button class="button regenerate-module" type="button">Regenerate section</button>
            </div>
            <button class="button export-module-quest" type="button">Export Cerbanimo quest</button>
          </div>
        </div>
      `;

      section.querySelector(".reopen-module")?.addEventListener("click",()=>{
        section.classList.remove("cleared");
        activeModuleId=module.id;
        section.scrollIntoView({behavior:"smooth",block:"start"});
        document.querySelectorAll(".nav-button").forEach(button=>button.classList.remove("active"));
        const navButton=[...document.querySelectorAll(".nav-button")][index];
        if(navButton) navButton.classList.add("active");
      });
      section.querySelector(".simplify-module")?.addEventListener("click",()=>mutateModule(module.id,"simplify"));
      section.querySelector(".advance-module")?.addEventListener("click",()=>mutateModule(module.id,"advance"));
      section.querySelector(".regenerate-module")?.addEventListener("click",()=>mutateModule(module.id,"regenerate"));
      section.querySelector(".export-module-quest")?.addEventListener("click",()=>exportCerbanimoQuest(module.id));

      renderVisualization(section.querySelector(".visualization"),module);
      renderQuiz(section.querySelector(".knowledge-check"),module,index);
      renderExercise(section.querySelector(".exercise"),module);
      return section;
    }

    function visualizationElement(item,shape,x,y,w=120,h=62,extra="") {
      const cls=shape==="circle"?"viz-point":"viz-box";
      const graphic=shape==="circle"?`<circle class="${cls}" cx="${x}" cy="${y}" r="${Math.min(w,h)/2}"></circle>`:`<rect class="${cls} ${extra}" x="${x-w/2}" y="${y-h/2}" width="${w}" height="${h}" rx="8"></rect>`;
      return `<g class="viz-node" tabindex="0" role="button" data-detail="${escapeHTML(item.detail||"")}">${graphic}<text class="viz-label" x="${x}" y="${y}">${escapeHTML(String(item.label||"").slice(0,22))}</text></g>`;
    }

    function renderVisualization(container,module) {
      const viz=normalizeVisualization(module.visualization,module,0);
      module.visualization=viz;
      if(viz.type==="custom"){
        renderCustomVisualization(container,viz);
        return;
      }
      const markerId=`arrow-${slug(module.id)}`;
      const defs=`<defs><marker id="${escapeHTML(markerId)}" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L0,6 L9,3 z" fill="currentColor"></path></marker></defs>`;
      let body="";
      const items=viz.items||[];

      if(viz.type==="network"){
        body=`${(viz.edges||[]).map(([from,to])=>{const a=viz.nodes.find(node=>node.id===from),b=viz.nodes.find(node=>node.id===to);return a&&b?`<line class="viz-edge" x1="${Number(a.x)||0}" y1="${Number(a.y)||0}" x2="${Number(b.x)||0}" y2="${Number(b.y)||0}" marker-end="url(#${escapeHTML(markerId)})"></line>`:"";}).join("")}${(viz.nodes||[]).map(node=>`<g class="viz-node" tabindex="0" role="button" data-detail="${escapeHTML(node.detail)}"><circle cx="${Number(node.x)||0}" cy="${Number(node.y)||0}" r="${Number(node.r)||0}"></circle><text x="${Number(node.x)||0}" y="${Number(node.y)||0}">${escapeHTML(node.label)}</text></g>`).join("")}`;
      } else if(viz.type==="flow"){
        const count=Math.max(1,items.length),gap=650/count;
        body=items.map((item,i)=>{const x=45+gap/2+i*gap;const nextX=45+gap/2+(i+1)*gap;return `${i<count-1?`<line class="viz-edge" x1="${x+60}" y1="200" x2="${nextX-70}" y2="200" marker-end="url(#${markerId})"></line>`:""}${visualizationElement(item,"rect",x,200,120,72,i%2?"alt":"")}`;}).join("");
      } else if(viz.type==="timeline"){
        const count=Math.max(1,items.length),gap=620/Math.max(1,count-1);
        body=`<line class="viz-axis" x1="40" y1="200" x2="660" y2="200"></line>`+items.map((item,i)=>{const x=count===1?350:40+i*gap;const y=i%2?295:105;return `<line class="viz-guide" x1="${x}" y1="200" x2="${x}" y2="${y}"></line>${visualizationElement(item,"circle",x,y,74,74)}`;}).join("");
      } else if(viz.type==="cycle"){
        const count=Math.max(1,items.length),cx=350,cy=200,r=135;
        const pos=items.map((item,i)=>({item,x:cx+Math.cos(-Math.PI/2+i*2*Math.PI/count)*r,y:cy+Math.sin(-Math.PI/2+i*2*Math.PI/count)*r}));
        body=pos.map((point,i)=>{const next=pos[(i+1)%count];return `<line class="viz-edge" x1="${point.x}" y1="${point.y}" x2="${next.x}" y2="${next.y}" marker-end="url(#${markerId})"></line>`;}).join("")+pos.map((point,i)=>visualizationElement(point.item,"circle",point.x,point.y,76,76)).join("")+`<circle cx="${cx}" cy="${cy}" r="48" class="viz-box alt"></circle><text class="viz-label" x="${cx}" y="${cy}">repeat</text>`;
      } else if(viz.type==="comparison"){
        const max=Math.max(...items.map(item=>Number(item.value)||1),1);
        body=items.slice(0,6).map((item,i)=>{const y=55+i*55,w=Math.max(70,(Number(item.value)||i+1)/max*430);return `<g class="viz-node" tabindex="0" role="button" data-detail="${escapeHTML(item.detail)}"><text class="viz-small" x="25" y="${y+18}">${escapeHTML(item.label.slice(0,20))}</text><rect class="viz-bar" x="190" y="${y}" width="${w}" height="34" rx="6"></rect></g>`;}).join("");
      } else if(viz.type==="matrix"){
        const axes=viz.axes||{};
        body=`<line class="viz-axis" x1="70" y1="350" x2="650" y2="350"></line><line class="viz-axis" x1="70" y1="350" x2="70" y2="40"></line><line class="viz-guide" x1="360" y1="40" x2="360" y2="350"></line><line class="viz-guide" x1="70" y1="195" x2="650" y2="195"></line><text class="viz-small" x="70" y="378">${escapeHTML(axes.xLow||"low")}</text><text class="viz-small" x="560" y="378">${escapeHTML(axes.xHigh||"high")}</text><text class="viz-small" x="8" y="345">${escapeHTML(axes.yLow||"low")}</text><text class="viz-small" x="8" y="55">${escapeHTML(axes.yHigh||"high")}</text>`+items.map(item=>visualizationElement(item,"circle",70+(item.x||50)*5.8,350-(item.y||50)*3.1,58,58)).join("");
      } else if(viz.type==="tree"){
        const root=viz.root||{id:"root",label:module.title,detail:module.summary};
        const rootX=350,rootY=65;
        const top=items.filter(item=>item.parentId===root.id||!item.parentId).slice(0,4);
        const rest=items.filter(item=>!top.includes(item));
        const positions=new Map([[root.id,{x:rootX,y:rootY}]]);
        top.forEach((item,i)=>positions.set(item.id,{x:100+i*(500/Math.max(1,top.length-1)),y:205}));
        rest.forEach((item,i)=>positions.set(item.id,{x:85+i*(530/Math.max(1,rest.length-1)),y:335}));
        body=visualizationElement(root,"rect",rootX,rootY,190,66,"hot")+items.map(item=>{const pos=positions.get(item.id),parent=positions.get(item.parentId)||positions.get(root.id);return pos?`<line class="viz-edge" x1="${parent.x}" y1="${parent.y+30}" x2="${pos.x}" y2="${pos.y-32}" marker-end="url(#${markerId})"></line>${visualizationElement(item,"rect",pos.x,pos.y,125,62,item.group==="B"?"alt":"")}`:"";}).join("");
      }

      container.dataset.vizType=viz.type;
      container.innerHTML=`<div class="proposal-header"><div><h3>${escapeHTML(viz.title)}</h3><p>${escapeHTML(viz.caption)}</p></div><span class="viz-type-chip">${escapeHTML(viz.type)}</span></div><svg class="viz-svg" viewBox="0 0 700 400" role="img" aria-label="${escapeHTML(viz.title)}">${defs}${body}</svg><div class="viz-live" aria-live="polite">Select an element to inspect this ${escapeHTML(viz.type)} visualization.</div>`;
      const live=container.querySelector(".viz-live");
      container.querySelectorAll(".viz-node").forEach(node=>{
        const activate=()=>{container.querySelectorAll(".viz-node").forEach(item=>item.classList.remove("active"));node.classList.add("active");live.textContent=node.dataset.detail||"No additional detail.";};
        node.addEventListener("click",activate);
        node.addEventListener("keydown",event=>{if(event.key==="Enter"||event.key===" "){event.preventDefault();activate();}});
      });
    }

    function renderQuiz(container,module,moduleIndex) {
      const quiz=(module.quiz||[]).map((question,index)=>normalizeLooseQuizQuestion(question,index)).filter(Boolean);
      container.innerHTML=`
        <h3>Knowledge check</h3>
        <p>${quiz.length} question${quiz.length===1?"":"s"}. Existing short quizzes remain valid; newly generated lessons use three to five varied checks.</p>
        ${quiz.map((question,index)=>`<fieldset class="quiz-question" data-question-index="${index}">
          <legend>${index+1}. ${escapeHTML(question.prompt)}</legend>
          ${question.type==="short-answer"?`<div class="short-answer-field"><textarea placeholder="${escapeHTML(question.placeholder||"Answer in your own words.")}"></textarea><div class="short-answer-rule">${escapeHTML(shortAnswerRuleDescription(question))}</div></div>`:
            question.type==="multiple-select"?question.answers.map((answer,answerIndex)=>`<label class="quiz-option"><input type="checkbox" value="${answerIndex}"><span>${escapeHTML(answer)}</span></label>`).join(""):
            question.answers.map((answer,answerIndex)=>`<label class="quiz-option"><input type="radio" name="quiz-${escapeHTML(module.id)}-${index}" value="${answerIndex}"><span>${escapeHTML(answer)}</span></label>`).join("")}
          <div class="question-feedback" aria-live="polite">Not checked yet.</div>
        </fieldset>`).join("")}
        <button class="button hot check-answers" type="button">Check understanding</button>
        <div class="feedback" aria-live="polite">Your answers are preserved while this school remains on this device.</div>`;
      container.querySelector(".check-answers").addEventListener("click",()=>evaluateQuiz(container,module,moduleIndex,quiz));
    }

    function evaluateQuiz(container,module,moduleIndex,quiz=(module.quiz||[])) {
      const fields=[...container.querySelectorAll(".quiz-question")];
      let correct=0,answered=0;
      const missed=[],outcomes=[];
      fields.forEach((field,index)=>{
        const question=quiz[index];
        let ok=false,message="";
        if(question.type==="short-answer"){
          const response=field.querySelector("textarea")?.value||"";
          const validation=validateShortAnswer(question,response);
          answered+=response.trim()?1:0;
          ok=validation.ok;
          message=validation.ok?`Accepted. ${validation.advisories.join(" ")||question.explanation||"The response meets the visible rubric."}`:`${validation.failures.join(" ")} ${validation.feedback}`.trim();
        }else if(question.type==="multiple-select"){
          const selected=[...field.querySelectorAll("input:checked")].map(input=>Number(input.value)).sort((a,b)=>a-b);
          const expected=[...(question.correctIndices||[])].map(Number).sort((a,b)=>a-b);
          answered+=selected.length?1:0;
          ok=selected.length===expected.length&&selected.every((value,i)=>value===expected[i]);
          message=ok?(question.explanation||"Correct selection."):(question.explanation||"Review the relevant lesson section and compare every option.");
        }else{
          const selected=field.querySelector("input:checked");
          answered+=selected?1:0;
          ok=Boolean(selected)&&Number(selected.value)===Number(question.correct);
          message=ok?(question.explanation||"Correct."):(question.explanation||"Review the relevant lesson section and try again.");
        }
        outcomes.push({question,ok});
        if(ok)correct++;else missed.push(`Question ${index+1}`);
        field.classList.toggle("correct",ok);field.classList.toggle("incorrect",!ok);
        const feedback=field.querySelector(".question-feedback");feedback.className=`question-feedback ${ok?"pass":"fail"}`;feedback.textContent=message;
      });
      recordQuizOutcome(module,outcomes,{passed:fields.length>0&&correct===fields.length,source:"standard-quiz"});
      const mastery=state.mastery[module.id]||{attempts:0,best:0,cleared:false};
      mastery.attempts++;mastery.best=Math.max(mastery.best,correct);mastery.total=fields.length;state.mastery[module.id]=mastery;
      const feedback=container.querySelector(".feedback");
      if(answered===fields.length&&correct===fields.length){
        mastery.cleared=true;feedback.className="feedback pass";feedback.textContent=`Cleared ${correct}/${fields.length}. The module is complete and the next step is available.`;clearModule(module,moduleIndex);
      }else{
        feedback.className="feedback fail";feedback.textContent=`${correct}/${fields.length} met. Revisit ${missed.join(", ")||"unanswered questions"}; your responses remain in place for revision.`;
        emit("check.failed",{moduleId:module.id,attempts:mastery.attempts,correct,total:fields.length});saveState();
      }
    }

    function clearModule(module,moduleIndex) {
      const first=!state.clearedModules.includes(module.id);
      if(first) state.clearedModules.push(module.id);
      if(first){
        const event=emit("lesson.completed",{moduleId:module.id,moduleIndex,tier:1,domain:module.domain},`lesson:${module.id}`);
        const mastery=state.mastery[module.id]||{};
        const evidenceSummary=`Completed ${module.title}. Best assessment: ${Number(mastery.best||0)}/${Number(mastery.total||0)}. ${module.exercise?.title?`Practical exercise: ${module.exercise.title}.`:""}`;
        const learnerId=(()=>{try{return JSON.parse(localStorage.getItem("commonweave-identity-vault")||"null")?.identity?.identityId||state.learner.learnerId}catch{return state.learner.learnerId}})();
        const rewardSubmission={
          id:`living:${state.school?.id||"school"}:${module.id}`,source:"living",kind:"lesson",subjectId:module.id,subjectTitle:module.title,
          journeyId:state.commonweave?.activeJourney?.id||state.school?.id||"local-school",contributorId:learnerId,contributorName:state.learner.displayName,
          description:module.summary||module.description||"",evidenceSummary,evidenceRefs:[event.id],
          evidenceArtifacts:[{id:`living-module-evidence:${module.id}`,name:`Completion evidence for ${module.title}`,mimeType:"text/plain",bytes:new TextEncoder().encode(evidenceSummary).byteLength,contentHash:`living:${stableHash(evidenceSummary)}`,inlineText:evidenceSummary,sourceRef:event.id,availability:"inline",createdAt:event.at}],
          skillRewards:livingSkillRewards(module),baseXp:Number(module.xp||0),baseAlreadyCredited:false,validationThreshold:1,escrowCoins:0,estimatedHours:Number(module.estimatedHours||1.5),automatability:.35,createdAt:event.at
        };
        window.CommonweaveRewardWeave?.submit(rewardSubmission,learnerId,state.learner.displayName);
        if(module.badge) awardBadgeForModule(module,event.id);
        if(window.parent!==window)window.parent.postMessage({type:"commonweave:reward-submission",contractVersion:"commonweave.reward-weave.v1.1",sourceApplication:"living",submission:rewardSubmission},location.origin);
      }
      renderSchool();
      if(first)maybeCompleteCommonweaveLearningStep(module);
      setTimeout(()=>document.getElementById(module.id)?.scrollIntoView({behavior:"smooth",block:"start"}),100);
      toast(first?`Module cleared: +${module.xp} XP`:"Module already credited.");
    }

    function awardBadgeForModule(module,eventId) {
      if(!module.badge) return;
      if(state.badges.some(badge=>badge.badgeId===module.badge.id)) return;
      state.badges.push({
        id:`credential-${module.badge.id}-${Date.now()}`,
        badgeId:module.badge.id,
        name:module.badge.name,
        description:module.badge.description,
        issuer:state.school.title,
        recipient:state.learner.learnerId,
        criteriaVersion:module.badge.criteriaVersion,
        awardedAt:new Date().toISOString(),
        evidenceRefs:[eventId],
        domain:module.badge.domain,
        portable:true,
        reviewStatus:"approved"
      });
      emit("badge.awarded",{badgeId:module.badge.id,moduleId:module.id},`badge:${module.badge.id}`);
    }

    function renderExercise(container,module) {
      container.innerHTML=`
        <h3>${escapeHTML(module.exercise.title)}</h3>
        <p>${escapeHTML(module.exercise.prompt)}</p>
        <textarea placeholder="Produce the mechanism, answer, design, analysis, or teaching artifact..."></textarea>
        <h4>Visible rubric</h4>
        <div class="rubric-grid">${module.exercise.rubric.map(item=>`<div class="rubric-item">${escapeHTML(item)}</div>`).join("")}</div>
        <div class="action-row">
          <button class="button seed-exercise" type="button">Seed draft</button>
          <button class="button assess-exercise" type="button">Assess</button>
          <button class="button save-artifact" type="button">Save artifact</button>
        </div>
        <div class="feedback">No assessment yet.</div>
      `;
      const textarea=container.querySelector("textarea");
      const feedback=container.querySelector(".feedback");
      let assessment=null;

      container.querySelector(".seed-exercise").addEventListener("click",()=>{
        textarea.value=[
          `Purpose: ${module.objectives?.[0]||module.summary||module.title}`,
          `Mechanism: ${module.paragraphs?.[1]||module.summary||"Describe how the artifact works."}`,
          `Evidence: The artifact will be checked against ${(module.exercise.rubric||[]).join(", ")||"the supplied prompt"}.`,
          "Reflection: I will identify one assumption, one missing perspective, and one next step."
        ].join("\n\n");
      });

      container.querySelector(".assess-exercise").addEventListener("click",()=>{
        assessment=assessArtifact(textarea.value,module.exercise.rubric);
        feedback.className=`feedback ${assessment.score>=80?"pass":assessment.score>=50?"":"fail"}`;
        feedback.innerHTML=`<b>${assessment.score}/100 rubric coverage</b><br>${assessment.results.map(result=>`${result.met?"✓":"△"} ${escapeHTML(result.label)}: ${escapeHTML(result.feedback)}`).join("<br>")}`;
      });

      container.querySelector(".save-artifact").addEventListener("click",()=>{
        assessment=assessment||assessArtifact(textarea.value,module.exercise.rubric);
        if(!textarea.value.trim()){feedback.className="feedback fail";feedback.textContent="Write or seed an artifact first.";return;}
        const artifact={
          id:`artifact-${module.id}-${Date.now()}`,
          moduleId:module.id,
          type:"school-exercise",
          title:module.exercise.title,
          content:textarea.value.trim(),
          score:assessment.score,
          rubric:assessment.results,
          domain:module.domain,
          createdAt:new Date().toISOString(),
          provenance:"learner artifact + deterministic rubric assessor"
        };
        state.artifacts.push(artifact);
        queueArtifactForReview(artifact);
        const event=emit("artifact.created",{artifactId:artifact.id,moduleId:module.id,domain:module.domain,score:artifact.score},artifact.id);
        awardXP(module.domain,Math.round(12+artifact.score/8),`Created ${artifact.title}`,event.dedupeKey);
        renderArtifacts();
        renderPassport();
        renderAcademy();
        saveState();
        feedback.className="feedback pass";
        feedback.textContent=`Artifact saved. ${Math.round(12+artifact.score/8)} canonical XP recorded once.`;
      });
    }

    function assessArtifact(text,rubric) {
      const lower=String(text||"").toLowerCase();
      const textWords=new Set(tokenize(text));
      const results=rubric.map(label=>{
        const cues=keywords(label,5);
        const met=cues.some(cue=>lower.includes(cue)) || (textWords.size>45 && lower.includes(":"));
        return {label,met,feedback:met?"Evidence of this mechanism appears in the draft.":"Make this mechanism explicit rather than implied."};
      });
      const score=Math.round(results.filter(result=>result.met).length/Math.max(1,results.length)*100);
      return {score,results};
    }

    function openModule(id) {
      activeModuleId=id;
      ensureAcademyState();
      state.academy.selectedModuleId=id;
      renderSchool();
      setWorkspace("learn",{focusId:id});
      document.getElementById("sidebar").classList.remove("open");
    }

    async function mutateModule(id,operation) {
      const index=state.school.modules.findIndex(module=>module.id===id);
      if(index<0) return;
      const module=state.school.modules[index];
      const engine=document.getElementById("generation-engine").value;

      if(engine!=="deterministic"){
        const instructions={
          simplify:`Rewrite module "${module.title}" for greater clarity and accessibility. Preserve factual grounding, citations, exercise intent, module ID, and unrelated modules.`,
          advance:`Make module "${module.title}" substantially more advanced. Add competing models, deeper mechanisms, a challenging scenario, and an applied exercise. Preserve grounding and unrelated modules.`,
          regenerate:`Freely redesign module "${module.title}" while preserving its role in the curriculum, factual source constraints, and module ID. Return the complete revised school.`
        };
        await runModelProposal({
          task:instructions[operation]||instructions.regenerate,
          resetProgress:false,
          operation:`module-${operation}`,
          currentSchool:state.school,
          targetModule:module
        });
        return;
      }

      if(operation==="simplify"){
        module.paragraphs=module.paragraphs.map(paragraph=>paragraph.split(/(?<=[.!?])\s+/).slice(0,2).join(" "));
        module.summary=`Plain-language version: ${module.summary}`;
        module.provenance="deterministic simplification";
      } else if(operation==="advance"){
        module.paragraphs.push("Advanced challenge: compare this module's preferred model with a competing explanation, identify the evidence that would distinguish them, and state which uncertainty remains unresolved.");
        module.objectives.push("Defend a tradeoff and compare competing models.");
        module.exercise.rubric.push("Compares alternatives and uncertainty");
        module.provenance="deterministic expansion";
      } else {
        const sources=document.getElementById("school-sources").value;
        const generic=generateGenericModule(state.school.subject,sources,genericPhases[index%genericPhases.length],index,state.school.difficulty,state.school.mode,state.school.tone);
        generic.id=module.id;
        generic.badge=module.badge;
        state.school.modules[index]={...generic,quiz:buildQuiz(generic,index),visualization:buildVisualization(generic,index),xp:module.xp,provenance:"deterministic regeneration"};
      }
      emit("module.modified",{moduleId:id,operation});
      renderSchool();
      openModule(id);
    }

    async function applyModelRequest() {
      const request=document.getElementById("model-request").value.trim();
      if(!request){
        document.getElementById("model-console").textContent="State a request first.";
        return;
      }
      const engine=document.getElementById("generation-engine").value;
      if(engine!=="deterministic"){
        await runModelProposal({
          task:`Revise the current school according to this editorial request: ${request}`,
          resetProgress:false,
          operation:"editorial-request",
          currentSchool:state.school
        });
        return;
      }

      const lower=request.toLowerCase();
      if(/add (a )?(section|module) (about|on)/.test(lower)){
        const subject=request.replace(/.*add (?:a )?(?:section|module) (?:about|on)\s*/i,"").trim()||"New topic";
        const index=state.school.modules.length;
        const module=generateGenericModule(subject,document.getElementById("school-sources").value,genericPhases[Math.min(index,genericPhases.length-1)],index,state.school.difficulty,state.school.mode,state.school.tone);
        state.school.modules.push({...module,quiz:buildQuiz(module,index),visualization:buildVisualization(module,index),xp:20,badge:{id:`badge-${slug(module.title)}`,name:module.title.replace(/:.*/,""),description:`Completed ${module.title}.`,domain:module.domain,criteriaVersion:"1.0.0"}});
        document.getElementById("model-console").textContent=`Added a deterministic module about ${subject}.`;
      } else if(/visual/.test(lower)&&/(every|all|each)/.test(lower)){
        state.school.modules.forEach((module,index)=>module.visualization=buildVisualization(module,index));
        document.getElementById("model-console").textContent="Regenerated an interactive visualization for every module.";
      } else {
        const numberMatch=lower.match(/(?:module|section)\s*(\d+)/);
        const index=numberMatch?Number(numberMatch[1])-1:0;
        const module=state.school.modules[Math.max(0,Math.min(index,state.school.modules.length-1))];
        if(/simpl/.test(lower)) await mutateModule(module.id,"simplify");
        else if(/hard|advance|complex|deeper/.test(lower)) await mutateModule(module.id,"advance");
        else await mutateModule(module.id,"regenerate");
        document.getElementById("model-console").textContent=`Applied deterministic editing to ${module.title}.`;
      }
      emit("school.model-request",{request,engine:"deterministic"});
      renderSchool();
      saveState();
    }

    async function generateFromBuilder() {
      const subject=document.getElementById("school-subject").value.trim()||"A new subject";
      const notes=document.getElementById("school-sources").value;
      const moduleCount=Number(document.getElementById("school-modules").value||6);
      const difficulty=document.getElementById("school-level").value;
      const mode=document.getElementById("school-mode").value;
      const tone=document.getElementById("school-tone").value;
      const engine=document.getElementById("generation-engine").value;

      if(engine!=="deterministic"){
        const hasGrounding=Boolean(notes.trim()) || schoolIsDefault(subject);
        await runModelProposal({
          task:hasGrounding
            ? (engine==="hybrid"
                ? "Create a complete school by using deterministic tools where useful, then reorganize and enrich the grounded material into a coherent curriculum."
                : "Freely design a complete, coherent school for the requested subject while respecting supplied or curated sources.")
            : "Generate a complete school using your learned knowledge and submit it in model-native structureMode. Choose the number and shape of modules yourself. Use blocks in the exact order you want rendered. You may omit concepts, exercises, badges, or standard lesson sections, but not the required validated quiz. Create custom declarative SVG visualizations when they improve the teaching. Every module must include a completion-gated quiz with at least one deterministically validated short-answer question. Do not invent citations. Mark uncertainty and verification needs for consequential claims.",
          resetProgress:true,
          operation:"generate-school"
        });
        return;
      }

      state.school=generateSchool(subject,notes,moduleCount,difficulty,mode,tone);
      state.clearedModules=[];
      state.mastery={};
      activeModuleId=state.school.modules[0]?.id||null;
      emit("school.generated",{schoolId:state.school.id,subject,moduleCount,difficulty,sourceProvided:Boolean(notes.trim()),engine:"deterministic"},state.school.id);
      const sourceInfo=state.school.sourceAnalysis;
      document.getElementById("model-console").textContent=sourceInfo
        ? `Compiled ${state.school.modules.length} stable modules from ${sourceInfo.claims} parsed claims and ${sourceInfo.sources.length} sources.`
        : `Generated ${moduleCount} deterministic modules for ${subject}.`;
      bindCommonweaveGeneratedSchool();
      renderSchool();
      openModule(activeModuleId);
    }

    function restoreDefault() {
      document.getElementById("school-preset").value="anarcho";
      document.getElementById("school-subject").value=defaultKnowledge.subject;
      document.getElementById("school-sources").value="";
      document.getElementById("school-modules").value="6";
      state.school=generateSchool(defaultKnowledge.subject,"",6,"intermediate","balanced","punk");
      state.clearedModules=[];
      state.mastery={};
      activeModuleId=state.school.modules[0].id;
      emit("school.restored",{schoolId:state.school.id});
      renderSchool();
      toast("Default anarcho-syndicalist school restored.");
    }

    function renderPassport() {
      const total=totalXP();
      document.getElementById("passport-card").innerHTML=`
        <h3>${escapeHTML(state.learner.displayName)}</h3>
        <p>${escapeHTML(state.learner.learnerId)}</p>
        <p><b>${total} XP · overall level ${levelForXP(total)}</b></p>
        <p>${state.badges.length} portable badge(s) · ${state.artifacts.length} evidence artifact(s)</p>
      `;
      document.getElementById("learner-name").value=state.learner.displayName;
      document.getElementById("learner-id").value=state.learner.learnerId;

      const canonicalSkills=Object.values(commonweaveRewardLedger()?.skills||{}).filter(skill=>skill.status!=="merged").sort((a,b)=>Number(b.xp||0)-Number(a.xp||0));
      document.getElementById("domain-grid").innerHTML=canonicalSkills.map(skill=>{const xp=Number(skill.xp||0),level=Number(skill.level||levelForXP(xp)),start=40*(level-1)*(level-1),end=40*level*level,progress=Math.max(0,Math.min(100,(xp-start)/Math.max(1,end-start)*100));return `<div class="domain-card"><b>${escapeHTML(skill.name||skill.slug)}</b>${xp} XP · level ${level}<div class="progress-track"><span style="width:${progress}%"></span></div></div>`;}).join("")||`<div class="empty">Complete a lesson or validated Cerbanimo task to begin the canonical skill constellation.</div>`;

      const schoolBadges=state.school.modules.map(module=>module.badge).filter(Boolean);
      document.getElementById("badge-grid").innerHTML=schoolBadges.map(definition=>{
        const record=state.badges.find(item=>item.badgeId===definition.id);
        return `<div class="badge-card ${record?"earned":"locked"}"><b>${escapeHTML(definition.name)}</b><p>${escapeHTML(definition.description)}</p><span class="tag">${record?"earned":"locked"}</span></div>`;
      }).join("");

      const sharedLedger=commonweaveRewardLedger();
      const sharedReceipts=(sharedLedger?.xpReceipts||[]).slice().sort((a,b)=>String(b.createdAt||"").localeCompare(String(a.createdAt||"")));
      const sharedRows=sharedReceipts.slice(0,80).map(entry=>`<div class="ledger-entry"><span class="xp-value">+${Number(entry.amount||0)}</span> <b>${escapeHTML(sharedLedger?.skills?.[entry.skillSlug]?.name||entry.skillSlug||"Canonical skill")}</b><br>${escapeHTML(entry.reason||"Living School skill reward")}${entry.kind==="validation-bonus"?" · validation doubled":" · base skill XP"}<br><small>${escapeHTML(new Date(entry.createdAt).toLocaleString())}</small></div>`).join("");
      document.getElementById("xp-ledger").innerHTML=sharedRows||`<div class="empty">No canonical skill XP awarded yet.</div>`;
    }

    function renderArtifacts() {
      document.getElementById("artifact-list").innerHTML=state.artifacts.length
        ? [...state.artifacts].reverse().map(item=>`<div class="artifact-card"><b>${escapeHTML(item.title)}</b><br>${escapeHTML(domains[item.domain]||item.domain)} · ${item.score}/100<br><small>${escapeHTML(item.provenance)}</small></div>`).join("")
        : `<div class="empty">No saved artifacts yet.</div>`;
    }

    function renderCredentials() {
      document.getElementById("credential-list").innerHTML=state.credentialProposals.length
        ? [...state.credentialProposals].reverse().map(item=>`<div class="artifact-card"><b>${escapeHTML(item.name)}</b><p>${escapeHTML(item.claim)}</p><small>${escapeHTML(domains[item.domain]||item.domain)} · ${item.minimumXP} XP · ${item.minimumEvidence} evidence · ${item.minimumReviewers} reviewers</small></div>`).join("")
        : `<div class="empty">No local credential proposals yet.</div>`;
    }

    function renderEvents() {
      document.getElementById("event-ledger").innerHTML=state.events.length
        ? [...state.events].reverse().slice(0,80).map(event=>`<div class="ledger-entry"><b>${escapeHTML(event.type)}</b><br><small>${escapeHTML(new Date(event.at).toLocaleString())}</small><br>${escapeHTML(event.dedupeKey||event.id)}</div>`).join("")
        : `<div class="empty">No canonical events yet.</div>`;
    }

    function updateTopStats() {
      const total=totalXP();
      document.getElementById("top-xp").textContent=`${total} XP`;
      document.getElementById("top-level").textContent=`Level ${levelForXP(total)}`;
      document.getElementById("top-badges").textContent=`${state.badges.length} badges`;
      const cover=document.getElementById("school-cover-level");if(cover)cover.textContent=`Level ${levelForXP(total)} · ${total} XP`;
    }

    function renderQuestModuleSelect() {
      const select=document.getElementById("quest-module");
      select.innerHTML=state.school.modules.map(module=>`<option value="${escapeHTML(module.id)}">${escapeHTML(module.title)}</option>`).join("");
      select.addEventListener("change",()=>previewQuest(select.value),{once:true});
      previewQuest(select.value);
    }

    function questPayload(module) {
      const nativeExercise=(module.blocks||[]).find(block=>block.type==="exercise")?.exercise;
      const nativeChecklist=(module.blocks||[]).find(block=>block.type==="checklist");
      const exercise=module.exercise||nativeExercise||null;
      const objectives=module.objectives||[];
      const criteria=exercise?.rubric?.length
        ? exercise.rubric
        : nativeChecklist?.items?.length
          ? nativeChecklist.items
          : [module.completion?.instructions||`Demonstrate the intended learning from ${module.title}.`];
      return {
        schema:"cerbanimo-learning-quest-0.1",
        generatedAt:new Date().toISOString(),
        school:{id:state.school.id,title:state.school.title,subject:state.school.subject,structureMode:state.school.structureMode||"standard"},
        learnerId:state.learner.learnerId,
        quest:{
          id:`quest-${module.id}`,
          title:`Practice: ${module.title}`,
          summary:exercise?.prompt||module.summary||`Applied practice for ${module.title}.`,
          learningDomain:module.domain,
          objectives,
          sourceBlocks:module.structureMode==="model-native"?(module.blocks||[]).map(block=>({id:block.id,type:block.type,title:block.title||""})):undefined,
          tasks:criteria.map((criterion,index)=>({
            id:`${module.id}-task-${index+1}`,
            title:criterion,
            status:"inactive-unassigned",
            skill_domains:[module.domain],
            proof_requirements:[
              `Provide evidence that the work satisfies: ${criterion}.`,
              "Record who reviewed it and what changed.",
              "Submit a reflection on capacity gained or knowledge transferred."
            ]
          }))
        }
      };
    }

    function previewQuest(id) {
      const module=moduleById(id);
      document.getElementById("quest-preview").textContent=module?JSON.stringify(questPayload(module),null,2):"No module selected.";
    }

    function exportCerbanimoQuest(id=null) {
      const module=moduleById(id||document.getElementById("quest-module").value);
      if(!module) return;
      const payload=questPayload(module);
      download(`${slug(module.title)}-cerbanimo-quest.json`,JSON.stringify(payload,null,2),"application/json;charset=utf-8");
      emit("cerbanimo.quest-exported",{moduleId:module.id,domain:module.domain});
      if(window.parent!==window)window.parent.postMessage({
        type:"commonweave:handoff",
        source:"living",
        target:"cerbanimo",
        kind:"capstone",
        title:`Capstone · ${module.title}`,
        payload:{...payload,automaticEffect:false,manualReviewRequired:true}
      },location.origin);
      saveState();
    }

    function sampleResult() {
      const module=state.school.modules[0];
      document.getElementById("cerbanimo-result").value=JSON.stringify({
        schema:"cerbanimo-learning-result-0.1",
        learner_id:state.learner.learnerId,
        completions:[{
          task_id:`sample-${Date.now()}`,
          title:`Applied practice for ${module.title}`,
          status:"completed",
          proof_status:"approved",
          skills:[module.domain],
          reviewers:2,
          reflection:"The task produced a visible artifact and transferred one responsibility to another participant.",
          evidence_refs:["evidence:sample-artifact"]
        }]
      },null,2);
    }

    function processResult(payload=null) {
      const feedback=document.getElementById("bridge-feedback");
      try {
        payload=payload||JSON.parse(document.getElementById("cerbanimo-result").value||"{}");
        if(payload.schema!=="cerbanimo-learning-result-0.1") throw new Error("Expected cerbanimo-learning-result-0.1.");
        let credited=0;
        for(const completion of payload.completions||[]){
          const key=`cerbanimo:${completion.task_id}:${completion.proof_status}`;
          const event=emit("cerbanimo.task.completed",{...completion,domain:(completion.skills||[]).find(skill=>domains[skill])||"subjectPractice"},key);
          if(completion.status==="completed"&&completion.proof_status==="approved"){
            if(awardXP(event.payload.domain,30+Math.min(3,Number(completion.reviewers||0))*3+(completion.reflection?5:0),`Approved Cerbanimo work: ${completion.title||completion.task_id}`,key)) credited++;
          }
        }
        feedback.className="feedback pass";
        feedback.textContent=`Processed ${(payload.completions||[]).length} completion(s); ${credited} new approved item(s) received XP.`;
        if(window.parent!==window)window.parent.postMessage({
          type:"commonweave:handoff",
          source:"cerbanimo",
          target:"living",
          kind:"evidence",
          title:`Validated field work · ${(payload.completions||[]).length} completion(s)`,
          status:"delivered",
          payload:{schema:payload.schema,completionCount:(payload.completions||[]).length,credited,automaticCredential:false}
        },location.origin);
        renderSchool();
      } catch(error) {
        feedback.className="feedback fail";
        feedback.textContent=`Import failed: ${error.message}`;
      }
    }

    function proposeBadge() {
      const proposal={
        id:`badge-proposal-${Date.now()}`,
        name:document.getElementById("badge-name").value.trim()||"Community Practice Badge",
        claim:document.getElementById("badge-claim").value.trim()||"The holder has demonstrated a locally defined practice.",
        domain:document.getElementById("badge-domain").value,
        minimumXP:Number(document.getElementById("badge-xp").value||0),
        minimumEvidence:Number(document.getElementById("badge-evidence").value||0),
        minimumReviewers:Number(document.getElementById("badge-reviewers").value||0),
        criteriaVersion:"0.1.0",
        status:"draft",
        createdAt:new Date().toISOString()
      };
      state.credentialProposals.push(proposal);
      emit("credential.proposed",{proposalId:proposal.id,domain:proposal.domain});
      renderCredentials();
      saveState();
      toast("Badge proposal saved.");
    }

    function exportBadgeProposal() {
      const proposal=state.credentialProposals.at(-1);
      if(!proposal){toast("Create a proposal first.");return;}
      download(`${slug(proposal.name)}-anarchadia-proposal.json`,JSON.stringify({
        schema:"anarchadia-credential-proposal-0.1",
        generatedAt:new Date().toISOString(),
        proposal:{
          ...proposal,
          governanceQuestions:[
            "Who may review this evidence?",
            "What appeal process applies?",
            "What creates a new criteria version?",
            "Can the credential be revoked, and by whom?",
            "Which Cerbanimo permissions may it unlock?"
          ]
        }
      },null,2),"application/json;charset=utf-8");
    }

    function compilePacket() {
      const title=document.getElementById("packet-title").value.trim()||"Living School Field Packet";
      const summary=document.getElementById("packet-summary").value.trim()||state.school.description;
      const lines=[`# ${title}`,"","## School",state.school.title,"",`Subject: ${state.school.subject}`,"","## Purpose",summary,"","## Artifacts"];
      state.artifacts.forEach((artifact,index)=>{
        lines.push("",`### ${index+1}. ${artifact.title}`,`Domain: ${domains[artifact.domain]||artifact.domain}`,`Score: ${artifact.score}/100`,"",artifact.content);
      });
      if(!state.artifacts.length) lines.push("No artifacts saved.");
      lines.push("","## Review questions","- What evidence is missing?","- Which role is difficult to replace?","- What capacity now exists?","- What should be taught next?");
      compiledPacket=lines.join("\n");
      document.getElementById("packet-output").textContent=compiledPacket;
      emit("fieldpacket.compiled",{title,artifactCount:state.artifacts.length});
      saveState();
    }

    function schoolManifest() {
      return {
        schema:"living-academy-manifest-1.5",
        generatedAt:new Date().toISOString(),
        school:state.school,
        domains,
        learnerCompatibility:{
          passportSchema:"living-school-passport-0.2",
          xpFormula:"floor(sqrt(xp / 40)) + 1"
        },
        learnerConstellation:{
          schema:"living-academy-learner-constellation-1.0",
          schoolId:state.learner.constellation?.schoolId||state.school.id,
          concepts:state.learner.constellation?.concepts||{},
          misconceptions:state.learner.constellation?.misconceptions||[],
          diagnostics:state.learner.constellation?.diagnostics||[],
          reviewHistory:state.learner.constellation?.reviewHistory||[]
        },
        academy:{
          activeWorkspace:state.academy?.activeWorkspace||"studio",
          cohorts:state.academy?.cohorts||[],
          practica:state.academy?.practica||[],
          reviews:state.academy?.reviews||[],
          facilitatorNotes:state.academy?.facilitatorNotes||[]
        },
        assessment:{
          schema:"living-academy-assessment-policy-1.0",
          policy:state.assessment?.policy||"learner-first",
          autosaveDrafts:Boolean(state.assessment?.autosaveDrafts),
          showIdeaCoaching:Boolean(state.assessment?.showIdeaCoaching),
          allowReviewChallenges:Boolean(state.assessment?.allowReviewChallenges),
          savedDraftCount:Object.keys(state.quizDrafts||{}).length,
          reviewRequests:(state.assessment?.reviewRequests||[]).map(item=>({
            id:item.id,
            moduleId:item.moduleId,
            questionId:item.questionId,
            status:item.status,
            createdAt:item.createdAt
          }))
        },
        commerce:{
          schema:"living-academy-commerce-state-1.0",
          planId:state.commerce?.planId||"commons",
          entitlement:state.commerce?.entitlement||null,
          aiWallet:state.commerce?.aiWallet||null,
          organization:state.commerce?.organization||null,
          library:(state.commerce?.library||[]).map(item=>({id:item.id,title:item.title,kind:item.kind,acquiredAt:item.acquiredAt})),
          listings:(state.commerce?.listings||[]).map(item=>({id:item.id,title:item.title,priceCents:item.priceCents,kind:item.kind,status:item.status})),
          orders:(state.commerce?.orders||[]).map(item=>({id:item.id,listingId:item.listingId,amountCents:item.amountCents,status:item.status,createdAt:item.createdAt})),
          expertServices:(state.commerce?.expertServices||[]).map(item=>({id:item.id,title:item.title,type:item.type,priceCents:item.priceCents,status:item.status,skills:item.skills})),
          helpRequests:(state.commerce?.helpRequests||[]).map(item=>({id:item.id,title:item.title,type:item.type,skill:item.skill,budgetCents:item.budgetCents,status:item.status,privacy:item.privacy})),
          engagements:(state.commerce?.engagements||[]).map(item=>({id:item.id,requestId:item.requestId,serviceId:item.serviceId,status:item.status,amountCents:item.amountCents,scheduledAt:item.scheduledAt,createdAt:item.createdAt,approvedAt:item.approvedAt||null})),
          reviewCredits:state.commerce?.reviewCredits||null
        },
        modelStudio:{
          outputSchema:MODEL_OUTPUT_SCHEMA,
          activeRoute:activeModelRoute(),
          routeLabel:modelRouteLabel(),
          runtime:{...(state.modelRuntime||{})},
          settings:{...state.modelSettings,apiKeyStored:false,apiKey:""},
          localRuntime:{
            academyUrl:"http://127.0.0.1:8788/academy",
            bridgeEndpoint:state.modelSettings?.ggufBridgeEndpoint||"http://127.0.0.1:8788",
            llamaServerRequired:true
          },
          history:state.modelHistory||[]
        },
        bridges:{
          cerbanimoQuest:"cerbanimo-learning-quest-0.1",
          cerbanimoResult:"cerbanimo-learning-result-0.1",
          anarchadiaCredential:"anarchadia-credential-proposal-0.1"
        }
      };
    }

    function renderVideoStudio(){
      const select=document.getElementById("media-module-select");
      if(!select||!state.school?.modules?.length)return;
      const previous=select.value;
      select.innerHTML=state.school.modules.map(module=>`<option value="${escapeHTML(module.id)}">${escapeHTML(module.title)}</option>`).join("");
      select.value=state.school.modules.some(module=>module.id===previous)?previous:(activeModuleId||state.school.modules[0].id);
      loadVideoEditorForModule(select.value);
    }

    function loadVideoEditorForModule(moduleId){
      const module=moduleById(moduleId);if(!module)return;
      const video=normalizeModuleVideo(module.media?.[0]||{})||null;
      const values={"media-video-url":video?.url||"","media-video-title":video?.title||"","media-video-attribution":video?.attribution||"","media-video-description":video?.description||"","media-video-transcript":video?.transcript||"","media-video-chapters":video?.chapters?.join("\n")||"","media-video-prompts":video?.prompts?.join("\n")||""};
      Object.entries(values).forEach(([id,value])=>{const node=document.getElementById(id);if(node)node.value=value;});
      renderVideoPreview();
    }

    function videoDraftFromEditor(){
      return normalizeModuleVideo({
        url:document.getElementById("media-video-url").value,title:document.getElementById("media-video-title").value,attribution:document.getElementById("media-video-attribution").value,description:document.getElementById("media-video-description").value,transcript:document.getElementById("media-video-transcript").value,
        chapters:document.getElementById("media-video-chapters").value.split(/\n+/).map(item=>item.trim()).filter(Boolean),prompts:document.getElementById("media-video-prompts").value.split(/\n+/).map(item=>item.trim()).filter(Boolean)
      });
    }

    function renderVideoPreview(){
      const preview=document.getElementById("media-preview");if(!preview)return;
      const draft=videoDraftFromEditor();
      if(!draft){preview.innerHTML='<div class="empty">Enter a valid YouTube watch, short, live, embed, or youtu.be URL. Arbitrary iframe HTML is never accepted.</div>';return;}
      preview.innerHTML=moduleMediaMarkup({media:[draft]});
    }

    function saveModuleVideo(){
      const module=moduleById(document.getElementById("media-module-select").value);if(!module)return;
      const video=videoDraftFromEditor();
      const feedback=document.getElementById("media-editor-feedback");
      if(!video){feedback.className="feedback fail";feedback.textContent="That link is not a supported YouTube URL. No embed was saved.";return;}
      module.media=[video];
      emit("module.media-updated",{moduleId:module.id,provider:video.provider,videoId:video.videoId});
      feedback.className="feedback pass";feedback.textContent="Video block saved in the curriculum data model. Transcript and fallback remain available if the embed cannot load.";
      saveState();renderSchool();setWorkspace("studio",{focusId:"media-studio"});
    }

    function removeModuleVideo(){
      const module=moduleById(document.getElementById("media-module-select").value);if(!module)return;
      module.media=[];saveState();renderSchool();setWorkspace("studio",{focusId:"media-studio"});toast("Module video removed.");
    }

    function projectGateAccepted(){
      const gate=state.academy?.projectGate;
      const modules=window.LivingSchoolModules;
      if(modules?.projectGate?.canUnlockFinalTest)return modules.projectGate.canUnlockFinalTest(gate);
      if(modules?.cerbanimoBridge?.receiptUnlocksFinalTest)return gate?.status==="accepted"&&modules.cerbanimoBridge.receiptUnlocksFinalTest(gate.lastReceipt);
      return Boolean(gate?.status==="accepted"&&gate?.lastReceipt&&(gate.lastReceipt.demo||gate.lastReceipt.reviewId||gate.lastReceipt.evidenceRef||gate.lastReceipt.acceptedAt));
    }

    function projectGateEvent(status,note,extra={}){
      const gate=state.academy.projectGate;
      const normalized=String(status||"").toLowerCase().replaceAll("_","-");
      if(!PROJECT_GATE_STATES.has(normalized))return false;
      const nextReceipt=extra.lastReceipt||null;
      if(nextReceipt?.requestId&&gate.lastReceipt?.requestId===nextReceipt.requestId&&gate.lastReceipt?.status===nextReceipt.status&&gate.status===normalized)return false;
      gate.status=normalized;gate.updatedAt=new Date().toISOString();Object.assign(gate,extra);
      gate.history.push({id:`gate-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,status:normalized,note:String(note||""),at:gate.updatedAt,requestId:String(extra.requestId||nextReceipt?.requestId||"")});
      gate.history=gate.history.slice(-40);saveState();renderFinalProjectGate();renderFinalTest();return true;
    }

    function projectGateStatusCopy(gate,canPrepare){
      return ({
        "not-started":canPrepare?"The instructional pathway is complete. Prepare the final project brief, then ask Cerbanimo to open a linked project intake.":"Complete every instructional module before preparing the final project brief.",
        drafting:"The final project packet is being drafted locally. Nothing has crossed into Cerbanimo.",
        "ready-to-submit":"The project packet is saved locally and ready for a consent-gated Cerbanimo handoff.",
        sending:"Commonweave is carrying the project packet to Cerbanimo. Living School is waiting for an acknowledgement before calling it submitted.",
        submitted:"Cerbanimo acknowledged and saved the linked project intake. Submission is not acceptance, so the final test remains locked.",
        "under-review":"Cerbanimo reports evidence or review activity. The final test remains locked until an accepted receipt returns.",
        "revision-requested":"Cerbanimo requested revision. The saved Living School packet remains available for editing and retry.",
        accepted:"Cerbanimo returned an accepted evidence or review receipt. The final competency test is unlocked.",
        rejected:"Cerbanimo rejected or closed this project intake. The final test remains locked.",
        "handoff-failed":"Cerbanimo did not acknowledge the handoff. The project packet remains safely stored in Living School and can be retried.",
        "integration-unavailable":"Commonweave or Cerbanimo is not available in this runtime. No submission was claimed and the final test remains locked."
      })[gate.status]||"The project state is available in the receipt below.";
    }

    function projectReceiptMarkup(gate){
      const receipt=gate.lastReceipt;
      if(!receipt&&!gate.projectRef&&!gate.lastRefreshError)return"";
      const checked=gate.lastCheckedAt||receipt?.acknowledgedAt||gate.updatedAt;
      const failed=["handoff-failed","integration-unavailable"].includes(gate.status)||gate.transportState==="failed";
      const eventLabel=String(receipt?.event||"").replaceAll("-"," ");
      const ref=receipt?.projectId||gate.projectId||gate.projectRef||"Awaiting reference";
      return `<section class="project-receipt ${failed?"failed":""}" aria-label="Cerbanimo project receipt">
        <div class="project-receipt-heading"><div><span class="cover-kicker">Cerbanimo receipt</span><h3>${escapeHTML(gate.brief?.title||receipt?.title||"Final project")}</h3></div><span class="receipt-signal ${escapeHTML(gate.transportState==="idle"&&failed?"failed":gate.transportState||"idle")}">${gate.transportState==="refreshing"?"checking":gate.transportState==="sending"?"sending":failed?"handoff failed":"verified signal"}</span></div>
        <dl>
          <div><dt>Project</dt><dd title="${escapeHTML(ref)}">${escapeHTML(ref.length>34?`${ref.slice(0,16)}…${ref.slice(-10)}`:ref)}</dd></div>
          <div><dt>Status</dt><dd>${escapeHTML(gate.status.replaceAll("-"," "))}${receipt?.demo?" · local demo":""}</dd></div>
          <div><dt>Submitted</dt><dd>${gate.submittedAt?new Date(gate.submittedAt).toLocaleString():"Not acknowledged"}</dd></div>
          <div><dt>Last checked</dt><dd>${checked?new Date(checked).toLocaleString():"Not yet"}</dd></div>
          ${eventLabel?`<div><dt>Latest signal</dt><dd>${escapeHTML(eventLabel)} · revision ${Number(receipt?.statusRevision||0)}</dd></div>`:""}
        </dl>
        <p>${escapeHTML(receipt?.detail||projectGateStatusCopy(gate,true))}</p>
        ${receipt?.reviewFeedback?`<div class="review-return"><b>Reviewer return</b><p>${escapeHTML(receipt.reviewFeedback)}</p></div>`:""}
        ${gate.lastRefreshError?`<div class="receipt-failure" role="status"><b>Status refresh did not complete</b><p>${escapeHTML(gate.lastRefreshError)}</p><small>Your saved project and last authoritative Cerbanimo state were preserved.</small></div>`:""}
      </section>`;
    }

    function finalProjectBrief(){
      const capstone=state.school?.modules?.at(-1);
      return {
        schema:"living-school-final-project-1.1",id:`final-project-${state.school.id}`,title:`Final project · ${state.school.title}`,schoolId:state.school.id,schoolTitle:state.school.title,subject:state.school.subject,
        learnerId:state.learner.learnerId,originatingIntention:state.commonweave?.activeJourney?.creativeIntention||state.commonweave?.activeJourney?.intention||state.school.subject,
        brief:capstone?.exercise?.prompt||capstone?.summary||`Create a real-world artifact demonstrating the school objectives for ${state.school.subject}.`,
        objectives:state.school.modules.flatMap(module=>(module.objectives||[]).slice(0,2)).slice(0,16),
        evidenceRequirements:["Submit the completed artifact or durable evidence of the work.","Map evidence to at least three school objectives.","Include reflection on decisions, limitations, and what changed through review.","Receive Cerbanimo acceptance through its evidence and review process."],
        moduleRefs:state.school.modules.map(module=>module.id),learningJourney:state.commonweave?.activeJourney?{id:state.commonweave.activeJourney.id,intention:state.commonweave.activeJourney.intention,creativeIntention:state.commonweave.activeJourney.creativeIntention||state.commonweave.activeJourney.intention,completedStepIds:state.commonweave.activeJourney.learningProgress?.completedStepIds||[]}:null,createdAt:new Date().toISOString()
      };
    }

    function downloadFinalProjectPacket(){
      const gate=state.academy.projectGate;if(!gate.brief)return;
      const packet={schema:"living-school-cerbanimo-project-packet-1.0",exportedAt:new Date().toISOString(),school:{id:state.school.id,title:state.school.title,subject:state.school.subject},learner:{id:state.learner.learnerId,displayName:state.learner.displayName},gate:deepClone(gate),project:deepClone(gate.brief)};
      const blob=new Blob([JSON.stringify(packet,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const anchor=document.createElement("a");anchor.href=url;anchor.download=`${slug(state.school.title)}-cerbanimo-project.json`;anchor.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }

    function renderFinalProjectGate(){
      const node=document.getElementById("final-project-content");if(!node)return;
      const gate=state.academy.projectGate;
      const statusLabel=gate.status.replaceAll("-"," ");
      const allModules=state.school?.modules?.length&&state.school.modules.every(module=>state.clearedModules.includes(module.id));
      const canPrepare=Boolean(allModules);
      const canSend=gate.brief&&gate.transportState!=="sending"&&["drafting","ready-to-submit","revision-requested","handoff-failed","integration-unavailable"].includes(gate.status);
      node.innerHTML=`<article class="gate-card"><span class="cover-kicker">Final project → Cerbanimo review → final test</span><h2>Verified project gate</h2>
        <span class="gate-status ${escapeHTML(gate.status)}">${escapeHTML(statusLabel)}</span>
        <p>${escapeHTML(projectGateStatusCopy(gate,canPrepare))}</p>
        ${gate.brief?`<details ${["not-started","drafting","ready-to-submit","handoff-failed","integration-unavailable","revision-requested"].includes(gate.status)?"open":""}><summary>Project brief</summary><p><b>${escapeHTML(gate.brief.title)}</b></p><p>${escapeHTML(gate.brief.brief)}</p><ul>${gate.brief.evidenceRequirements.map(item=>`<li>${escapeHTML(item)}</li>`).join("")}</ul></details>`:""}
        ${projectReceiptMarkup(gate)}
        <div class="action-row">
          <button id="prepare-final-project" type="button" ${canPrepare&&gate.status!=="sending"?"":"disabled"}>${gate.brief?"Refresh brief":"Create final project brief"}</button>
          <button class="button hot" id="submit-final-project" type="button" ${canSend?"":"disabled"}>${gate.status==="handoff-failed"||gate.status==="integration-unavailable"?"Try handoff again":gate.status==="revision-requested"?"Send revision":"Send to Cerbanimo"}</button>
          ${gate.brief?`<button id="download-final-project" type="button">Download project packet</button>`:""}
          ${gate.projectUrl?`<a class="button" href="${escapeHTML(gate.projectUrl)}" target="_blank" rel="noopener noreferrer">Open Cerbanimo project</a>`:""}
          ${gate.projectRef&&gate.status!=="sending"?`<button id="refresh-project-status" type="button" ${gate.transportState==="refreshing"?"disabled":""}>${gate.transportState==="refreshing"?"Checking Cerbanimo…":"Refresh status"}</button>`:""}
        </div>
        ${gate.history.length?`<details class="gate-history"><summary>Receipt history · ${gate.history.length}</summary><div class="gate-timeline">${gate.history.slice().reverse().slice(0,8).map(event=>`<div class="gate-event"><b>${escapeHTML(event.status.replaceAll("-"," "))}</b> · ${new Date(event.at).toLocaleString()}<br>${escapeHTML(event.note)}</div>`).join("")}</div></details>`:""}
        ${window.parent===window?`<details class="demo-adapter"><summary>Local demo adapter</summary><p>This adapter only tests the state machine. It does not claim that Cerbanimo approved anything.</p><label for="demo-project-state">Simulated external state</label><select id="demo-project-state">${["submitted","under-review","revision-requested","accepted","rejected"].map(status=>`<option value="${status}">${status.replaceAll("-"," ")}</option>`).join("")}</select><button id="apply-demo-project-state" type="button">Apply clearly labeled demo state</button></details>`:""}
      </article>`;
      document.getElementById("prepare-final-project")?.addEventListener("click",()=>{const brief=finalProjectBrief();projectGateEvent("ready-to-submit","Final project brief prepared locally. Nothing has been sent.",{brief});});
      document.getElementById("submit-final-project")?.addEventListener("click",()=>submitFinalProjectToCerbanimo());
      document.getElementById("download-final-project")?.addEventListener("click",downloadFinalProjectPacket);
      document.getElementById("refresh-project-status")?.addEventListener("click",()=>requestCerbanimoProjectStatus());
      document.getElementById("apply-demo-project-state")?.addEventListener("click",()=>{const status=document.getElementById("demo-project-state").value;applyCerbanimoProjectStatus({type:"commonweave:project-status-returned",contractVersion:"commonweave.cerbanimo-project.v1",status,projectRef:gate.projectRef||"demo-project",projectId:gate.projectId||"demo-project",schoolId:state.school.id,moduleId:"final-project",learnerId:state.learner.learnerId,requestId:`demo-${Date.now()}`,demo:true,reviewId:status==="accepted"?"demo-review":"",acceptedAt:status==="accepted"?new Date().toISOString():"",detail:"Applied through the clearly labeled local demo adapter.",acknowledgedAt:new Date().toISOString()});});
    }

    async function waitForLivingSchoolModules(){
      if(window.LivingSchoolModules)return window.LivingSchoolModules;
      await Promise.race([new Promise(resolve=>window.addEventListener("living-school:modules-ready",()=>resolve(),{once:true})),new Promise(resolve=>setTimeout(resolve,1600))]);
      return window.LivingSchoolModules||null;
    }

    async function submitFinalProjectToCerbanimo(){
      const gate=state.academy.projectGate;if(!gate.brief||gate.status==="sending")return;
      if(window.parent===window){projectGateEvent("integration-unavailable","No Commonweave parent is connected. Living School kept the project packet locally and did not claim a Cerbanimo submission.",{lastCheckedAt:new Date().toISOString(),transportState:"failed",lastRefreshError:"No Commonweave parent is connected."});return;}
      const requestId=crypto.randomUUID();const projectRef=gate.projectRef||`cw-ls:${state.school.id}:final-project`;
      try{
        const modules=await waitForLivingSchoolModules();
        const request=modules?.cerbanimoBridge?.createProjectHandoffRequest?modules.cerbanimoBridge.createProjectHandoffRequest({requestId,schoolId:state.school.id,moduleId:"final-project",learnerId:state.learner.learnerId,projectRef,title:gate.brief.title,creativeIntention:gate.brief.originatingIntention,project:deepClone(gate.brief)}):{type:"commonweave:project-handoff-requested",contractVersion:"commonweave.cerbanimo-project.v1",requestId,schoolId:state.school.id,moduleId:"final-project",learnerId:state.learner.learnerId,projectRef,timestamp:new Date().toISOString(),sourceApplication:"living-school",title:gate.brief.title,creativeIntention:gate.brief.originatingIntention,project:deepClone(gate.brief)};
        projectGateEvent("sending","Project packet is crossing Commonweave. Living School will wait for a Cerbanimo acknowledgement.",{requestId,projectRef,pendingSince:new Date().toISOString(),sendAttempts:Number(gate.sendAttempts||0)+1,lastReceipt:null,lastCheckedAt:null,transportState:"sending",lastRefreshError:""});
        window.parent.postMessage(request,location.origin);
        setTimeout(()=>{const current=state.academy.projectGate;if(current.status==="sending"&&current.requestId===requestId)projectGateEvent("handoff-failed","Cerbanimo did not acknowledge this submission before the local timeout. The project remains saved and can be retried.",{lastCheckedAt:new Date().toISOString(),pendingSince:null,transportState:"failed",lastRefreshError:"No Cerbanimo acknowledgement arrived."});},20000);
      }catch(error){projectGateEvent("handoff-failed",`The handoff packet could not be prepared: ${error.message}`,{lastCheckedAt:new Date().toISOString(),transportState:"failed",lastRefreshError:String(error.message||error)});}
    }

    async function requestCerbanimoProjectStatus(){
      const gate=state.academy.projectGate;if(!gate.projectRef||gate.transportState==="refreshing")return;
      if(window.parent===window){gate.transportState="failed";gate.lastRefreshError="No Commonweave parent is connected, so Cerbanimo status cannot be refreshed.";gate.lastCheckedAt=new Date().toISOString();saveState();renderFinalProjectGate();return;}
      const requestId=crypto.randomUUID();
      try{
        const modules=await waitForLivingSchoolModules();
        const request=modules?.cerbanimoBridge?.createProjectStatusRequest?modules.cerbanimoBridge.createProjectStatusRequest({requestId,schoolId:state.school.id,moduleId:"final-project",learnerId:state.learner.learnerId,projectRef:gate.projectRef}):{type:"commonweave:project-status-requested",contractVersion:"commonweave.cerbanimo-project.v1",requestId,schoolId:state.school.id,moduleId:"final-project",learnerId:state.learner.learnerId,projectRef:gate.projectRef,timestamp:new Date().toISOString(),sourceApplication:"living-school"};
        gate.lastCheckedAt=new Date().toISOString();gate.lastRefreshRequestId=requestId;gate.transportState="refreshing";gate.lastRefreshError="";saveState();renderFinalProjectGate();window.parent.postMessage(request,location.origin);
        setTimeout(()=>{const current=state.academy.projectGate;if(current.transportState==="refreshing"&&current.lastRefreshRequestId===requestId){current.transportState="failed";current.lastRefreshError="Cerbanimo did not return a fresh status before the timeout. The last authoritative project state is still shown.";current.lastCheckedAt=new Date().toISOString();current.history.push({id:`gate-${Date.now()}-refresh-timeout`,status:current.status,note:current.lastRefreshError,at:current.lastCheckedAt,requestId,transportOnly:true});saveState();renderFinalProjectGate();}},20000);
      }catch(error){gate.transportState="failed";gate.lastRefreshError=`The status request could not be prepared: ${error.message}`;gate.lastCheckedAt=new Date().toISOString();saveState();renderFinalProjectGate();}
    }

    function applyCerbanimoProjectStatus(payload={}){
      const modules=window.LivingSchoolModules;
      const receipt=modules?.cerbanimoBridge?.normalizeProjectReceipt?modules.cerbanimoBridge.normalizeProjectReceipt(payload):payload;
      if(!receipt||receipt.contractVersion!=="commonweave.cerbanimo-project.v1")return false;
      const gate=state.academy.projectGate;
      if(String(receipt.schoolId||"")!==String(state.school.id))return false;
      if(String(receipt.moduleId||"")!=="final-project")return false;
      if(String(receipt.learnerId||"")!==String(state.learner.learnerId))return false;
      if(gate.status==="sending"&&gate.requestId&&String(receipt.requestId||"")!==String(gate.requestId))return false;
      if(gate.projectRef&&String(receipt.projectRef||"")!==String(gate.projectRef))return false;
      if(receipt.status==="accepted"&&!receipt.demo&&!receipt.reviewId&&!receipt.evidenceRef&&!receipt.acceptedAt){toast("Cerbanimo acceptance needs a review or evidence receipt.");return false;}
      if(modules?.projectGate?.applyReceipt){
        const result=modules.projectGate.applyReceipt(gate,receipt,new Date().toISOString());
        if(!result.changed)return false;
        state.academy.projectGate=result.gate;saveState();renderFinalProjectGate();renderFinalTest();
        if(receipt.status==="accepted")toast("Cerbanimo accepted the project. The final assessment is now available.");
        else if(result.reason==="refresh-failure-preserved")toast("Cerbanimo could not refresh. Your last verified status was preserved.");
        return true;
      }
      const status=String(receipt.status||"").toLowerCase().replaceAll("_","-");
      if(!PROJECT_GATE_STATES.has(status))return false;
      const note=receipt.detail||(status==="accepted"?"Cerbanimo returned an accepted review receipt.":`Cerbanimo returned ${status}.`);
      const acknowledgedAt=receipt.acknowledgedAt||new Date().toISOString();
      const submittedAt=gate.submittedAt||(["submitted","under-review","revision-requested","accepted","rejected"].includes(status)?acknowledgedAt:null);
      return projectGateEvent(status,note,{requestId:String(receipt.requestId||gate.requestId||""),projectRef:String(receipt.projectRef||gate.projectRef||""),projectId:String(receipt.projectId||gate.projectId||""),projectUrl:safeExternalURL(receipt.projectUrl)||gate.projectUrl||"",lastReceipt:deepClone(receipt),lastCheckedAt:acknowledgedAt,submittedAt,pendingSince:null,transportState:"idle",lastRefreshError:"",statusRevision:Number(receipt.statusRevision||gate.statusRevision||0),receiptIds:[...(gate.receiptIds||[]),receipt.receiptId].filter(Boolean).slice(-80)});
    }

    function normalizedFinalQuestion(raw,module,index){
      const question=normalizeLooseQuizQuestion(raw,index);if(!question)return null;
      return {...question,id:`final-${module.id}-${question.id||index}`,moduleId:module.id,moduleTitle:module.title,objective:(module.objectives||[])[index%(module.objectives?.length||1)]||module.summary||module.title};
    }

    function finalQuestionBank(){
      const bank=[];
      (state.school?.modules||[]).forEach((module,moduleIndex)=>{
        const native=(module.blocks||[]).filter(block=>block.type==="quiz").flatMap(block=>block.questions||[]);
        const source=(module.quiz?.length?module.quiz:native).map((question,index)=>normalizedFinalQuestion(question,module,index)).filter(Boolean);
        bank.push(...source.slice(0,4));
        const concepts=(module.concepts||[]).slice(0,3);
        concepts.forEach((concept,index)=>{
          const alternatives=(module.concepts||[]).filter((_,i)=>i!==index).map(item=>item[1]).slice(0,3);
          while(alternatives.length<3)alternatives.push("This statement is not supported by the module.");
          const answers=[concept[1],...alternatives];
          const shift=(moduleIndex+index)%answers.length;const rotated=answers.slice(shift).concat(answers.slice(0,shift));
          bank.push({id:`final-${module.id}-concept-${index}`,type:"multiple-choice",prompt:`Which statement best represents ${concept[0]} in ${module.title}?`,answers:rotated,correct:rotated.indexOf(concept[1]),explanation:`Review the ${concept[0]} concept in ${module.title}.`,moduleId:module.id,moduleTitle:module.title,objective:(module.objectives||[])[0]||module.summary});
        });
        const objective=(module.objectives||[])[0]||module.summary||module.title;
        const cues=keywords(`${objective} ${module.summary||""}`,5);
        bank.push({id:`final-${module.id}-applied`,type:"short-answer",prompt:`Applied scenario: describe how you would use ${module.title} in the final project, including one decision and one piece of evidence.`,validation:{mode:"keywords",requiredKeywords:cues,minimumKeywordMatches:1,minWords:25,maxWords:260,enforcement:"strict",feedback:`Name a concrete decision and connect it to ${objective}.`},explanation:`Responses receive transparent rubric credit for application, evidence, and module concepts.`,moduleId:module.id,moduleTitle:module.title,objective});
      });
      let seed=0;
      while(bank.length<24&&state.school?.modules?.length){
        const module=state.school.modules[seed%state.school.modules.length];
        const objective=(module.objectives||[])[seed%(module.objectives?.length||1)]||module.summary||module.title;
        bank.push({id:`final-${module.id}-extension-${seed}`,type:"short-answer",prompt:`Compare a strong and weak application of this objective: ${objective}`,validation:{mode:"keywords",requiredKeywords:keywords(objective,4),minimumKeywordMatches:1,minWords:20,maxWords:220,enforcement:"strict",feedback:`Use the objective language as evidence, not as a phrase-matching puzzle.`},explanation:"Credit is based on the visible rubric and substantive comparison.",moduleId:module.id,moduleTitle:module.title,objective});seed++;
      }
      return bank;
    }

    function deterministicShuffle(items,seed){
      return items.map((item,index)=>({item,key:stableHash(`${seed}:${item.id}:${index}`)})).sort((a,b)=>a.key.localeCompare(b.key)).map(entry=>entry.item);
    }

    function createFinalTestAttempt(){
      const final=state.academy.finalTest;
      if(!projectGateAccepted()){toast("The final test unlocks only after Cerbanimo returns an accepted evidence or review receipt.");return;}
      if(final.passed){toast("The final test is already complete.");return;}
      if(final.attempts.length>=3){toast("All three final-test attempts have been used.");return;}
      const attemptNumber=final.attempts.length+1;
      let bank=deterministicShuffle(finalQuestionBank(),`${state.school.id}:${attemptNumber}`);
      const short=bank.filter(question=>question.type==="short-answer").slice(0,5);
      const objective=bank.filter(question=>question.type!=="short-answer").slice(0,15);
      let questions=deterministicShuffle([...objective,...short],`mix:${attemptNumber}`).slice(0,20);
      if(questions.length<20)questions=deterministicShuffle(bank,`fallback:${attemptNumber}`).slice(0,20);
      final.activeAttempt={id:`final-attempt-${Date.now()}`,number:attemptNumber,startedAt:new Date().toISOString(),questions:deepClone(questions),answers:{}};
      saveState();renderFinalTest();setWorkspace("learn",{focusId:"final-test-panel"});
    }

    function finalLessonExcerpt(question){
      const module=moduleById(question.moduleId);if(!module)return question.objective||"";
      const index=(state.school?.modules||[]).findIndex(item=>item.id===module.id),contract=moduleContract(module,Math.max(0,index));
      const concepts=(module.concepts||[]).slice(0,8).map(item=>typeof item==="string"?item:`${item.term||item.title||""}: ${item.definition||item.body||""}`).join("\n");
      return [`MODULE: ${module.title}`,`SUMMARY: ${module.summary||""}`,`OBJECTIVE: ${contract.objective}`,`WHY IT MATTERS: ${contract.why}`,`PRACTICAL ARTIFACT: ${contract.artifact}`,concepts].filter(Boolean).join("\n").slice(0,2400);
    }

    async function modelAssistFinalShortAnswer(question,response,deterministic){
      const route=activeModelRoute(),engine=window.LivingSchoolModules?.rubricEngine;
      if(["deterministic","manual"].includes(route)||!engine?.validateModelEvaluation)return null;
      if((deterministic.failures||[]).length)return null;
      const criteria=shortAnswerCriteriaForQuestion(question);
      const payload={prompt:question.prompt,response,rubric:criteria.map(item=>({id:item.id,label:item.label,description:item.description,points:item.points,examples:item.examples||[],conceptCues:item.cues||[]})),lessonExcerpt:finalLessonExcerpt(question),deterministicSafeguards:{score:deterministic.score,authority:deterministic.authority,uncertain:deterministic.uncertain}};
      const system=`You are a rubric scorer assisting Living School. Evaluate only the learner response against every supplied criterion and lesson excerpt. Do not reward copied rubric words without explanation. Return strict JSON only: {"criteria":[{"id":"criterion id","earned":0,"feedback":"specific feedback"}],"feedback":"overall feedback","confidence":0.0,"uncertain":false}. Earned points may use half points and must stay within each criterion maximum. Include every criterion exactly once. Do not modify learner records or declare human authority.`;
      try{
        const text=await invokeLanguageModel([{role:"system",content:system},{role:"user",content:JSON.stringify(payload)}],modelConfigFromUI());
        const parsed=parseModelJSON(text),validated=engine.validateModelEvaluation(parsed,criteria);
        return validated?{...validated,modelRoute:route,rawExplanation:String(parsed.feedback||validated.feedback||"").slice(0,1200)}:null;
      }catch(error){return{error:String(error?.message||error).slice(0,800)};}
    }

    async function scoreFinalShortAnswer(question,response){
      const deterministic=validateShortAnswer(question,response);
      const assisted=await modelAssistFinalShortAnswer(question,response,deterministic);
      const merged=assisted&&!assisted.error&&window.LivingSchoolModules?.rubricEngine?.mergeModelEvaluation?window.LivingSchoolModules.rubricEngine.mergeModelEvaluation(deterministic,assisted):null;
      const evaluation=merged||(assisted&&!assisted.error?assisted:{score:deterministic.score,criteria:deterministic.criteria,feedback:deterministic.feedback,authority:deterministic.authority,uncertain:deterministic.uncertain,needsReview:deterministic.needsReview});
      const criteria=(evaluation.criteria||[]).map(item=>({id:item.id,label:item.label,points:Number(item.points||0),earned:Number(item.earned||0),feedback:item.feedback||""}));
      const score=Math.max(0,Math.min(100,Number(evaluation.score||0)));
      const pendingReview=Boolean(evaluation.uncertain||evaluation.needsReview)||(Boolean(assisted?.error)&&score>=45&&score<70);
      const feedback=[...criteria.map(item=>`${item.label}: ${item.earned}/${item.points} · ${item.feedback}`),evaluation.feedback||deterministic.feedback,assisted?.error?`Model assist unavailable; deterministic safeguards were used (${assisted.error}).`:""].filter(Boolean).join("\n");
      return{points:score/100,score,feedback,criteria,authority:evaluation.authority||"deterministic-rubric-assisted",pendingReview,modelError:assisted?.error||null};
    }

    async function gradeFinalTest(){
      const final=state.academy.finalTest;const attempt=final.activeAttempt;if(!attempt)return;
      const button=document.getElementById("grade-final-test");if(button){button.disabled=true;button.textContent="Grading criterion by criterion…";}
      const answers={},results=[];let earned=0,pendingReviewCount=0;
      for(let index=0;index<attempt.questions.length;index++){
        const question=attempt.questions[index],field=document.querySelector(`[data-final-question="${index}"]`);if(!field)continue;
        if(question.type==="short-answer"){
          const response=field.querySelector("textarea")?.value||"";const result=await scoreFinalShortAnswer(question,response);answers[question.id]=response;earned+=result.points;if(result.pendingReview)pendingReviewCount++;
          results.push({questionId:question.id,moduleId:question.moduleId,points:result.points,score:result.score,feedback:result.feedback,response,criteria:result.criteria,authority:result.authority,pendingReview:result.pendingReview,modelError:result.modelError});
        }else{
          const selected=field.querySelector("input:checked"),value=selected?Number(selected.value):null,ok=value===Number(question.correct);answers[question.id]=value;earned+=ok?1:0;results.push({questionId:question.id,moduleId:question.moduleId,points:ok?1:0,score:ok?100:0,feedback:ok?"Correct.":question.explanation||"Review the source module.",response:value,authority:"deterministic-objective",pendingReview:false});
        }
      }
      const score=Math.round(earned/Math.max(1,attempt.questions.length)*100),passed=score>=80&&pendingReviewCount===0;
      const record={id:attempt.id,number:attempt.number,startedAt:attempt.startedAt,submittedAt:new Date().toISOString(),score,passed,pendingReview:pendingReviewCount>0,pendingReviewCount,answers,results,questionIds:attempt.questions.map(q=>q.id),gradingAuthorities:[...new Set(results.map(item=>item.authority))]};
      final.attempts.push(record);final.activeAttempt=null;final.passed=passed;final.pendingReview=record.pendingReview;
      if(passed){final.completionRecord={schema:"living-school-completion-record-1.0",id:`completion-${Date.now()}`,schoolId:state.school.id,learnerId:state.learner.learnerId,projectRef:state.academy.projectGate.projectRef,finalTestAttemptId:record.id,score,issuedAt:record.submittedAt,competencies:state.school.modules.map(module=>({moduleId:module.id,state:"Assessed"}))};emit("school.completed",{schoolId:state.school.id,score,projectRef:state.academy.projectGate.projectRef},final.completionRecord.id);}
      saveState();renderSchool();setWorkspace("learn",{focusId:"final-test-panel"});
    }

    function renderFinalTest(){
      const node=document.getElementById("final-test-content");if(!node)return;
      const final=state.academy.finalTest;const unlocked=projectGateAccepted();const remaining=Math.max(0,3-final.attempts.length);
      if(final.activeAttempt){
        node.innerHTML=`<article class="final-test-card"><span class="cover-kicker">Attempt ${final.activeAttempt.number} of 3</span><h2 id="final-test-title">Final competency test</h2><p>Twenty varied questions cover the school objectives and the accepted project. Short answers use visible criteria, deterministic anti-gaming safeguards, and the configured model when available.</p>
          ${final.activeAttempt.questions.map((question,index)=>`<fieldset class="final-question" data-final-question="${index}"><legend>${index+1}. ${escapeHTML(question.prompt)}</legend>${question.type==="short-answer"?`<textarea placeholder="Apply the objective, name a decision, and identify evidence."></textarea><small>Rubric: criterion points · substantive explanation · concrete application · evidence. Uncertain high-stakes responses remain pending review.</small>`:question.answers.map((answer,answerIndex)=>`<label><input type="radio" name="final-${index}" value="${answerIndex}"><span>${escapeHTML(answer)}</span></label>`).join("")}</fieldset>`).join("")}
          <button class="button hot" id="grade-final-test" type="button">Grade and return test</button></article>`;
        document.getElementById("grade-final-test").addEventListener("click",gradeFinalTest);return;
      }
      const latest=final.attempts.at(-1);const weak=latest?[...new Set(latest.results.filter(result=>result.points<.8).map(result=>result.moduleId))]:[];
      node.innerHTML=`<article class="final-test-card"><span class="cover-kicker">Final assessment</span><h2 id="final-test-title">${final.passed?"School complete":"Final competency test"}</h2>
        <p>${final.passed?`Completion record issued with a score of ${final.completionRecord.score}%.`:
          unlocked?`The accepted Cerbanimo project unlocked this 20-question assessment. ${remaining} attempt${remaining===1?"":"s"} remain.`:
          "Locked until the final project is accepted through Cerbanimo evidence and review."}</p>
        ${final.attempts.length?`<div class="attempt-history">${final.attempts.map(attempt=>`<details class="attempt-record"><summary><b>Attempt ${attempt.number}: ${attempt.score}% · ${attempt.passed?"passed":attempt.pendingReview?"pending review":"not yet passed"}</b><br><small>${new Date(attempt.submittedAt).toLocaleString()} · ${(attempt.gradingAuthorities||[]).join(" + ")||"saved grading record"}</small></summary><div class="criterion-return">${(attempt.results||[]).filter(result=>result.response!==null&&result.response!==undefined).map((result,index)=>`<article><b>Question ${index+1} · ${Math.round(Number(result.points||0)*100)}%</b><pre>${escapeHTML(result.feedback||"")}</pre></article>`).join("")}</div></details>`).join("")}</div>`:""}
        ${weak.length&&!final.passed?`<h3>Targeted review</h3><div class="remediation-list">${weak.map(id=>{const module=moduleById(id);return module?`<button type="button" data-review-module="${escapeHTML(id)}">Review ${escapeHTML(module.title)}</button>`:"";}).join("")}</div>`:""}
        ${final.completionRecord?`<details><summary>Completion record</summary><pre>${escapeHTML(JSON.stringify(final.completionRecord,null,2))}</pre></details>`:""}
        <button class="button hot" id="start-final-test" type="button" ${unlocked&&!final.passed&&remaining>0?"":"disabled"}>${latest?"Begin retake":"Begin final test"}</button>
      </article>`;
      document.getElementById("start-final-test")?.addEventListener("click",createFinalTestAttempt);
      node.querySelectorAll("[data-review-module]").forEach(button=>button.addEventListener("click",()=>openModule(button.dataset.reviewModule)));
    }

    function renderHeaderControls(){
      const runtime=state.modelRuntime||{};const route=activeModelRoute();
      const summary=document.getElementById("model-control-summary");if(summary)summary.textContent=`${modelRouteLabel(route)} · ${runtime.ready?"ready":runtime.tested?"needs attention":"not tested"}`;
      const connection=document.getElementById("connection-status");if(connection)connection.textContent=`${navigator.onLine?"Online":"Offline"} · local state saved · ${window.parent===window?"standalone":"Commonweave connected"}`;
      const dot=document.getElementById("control-status-dot");if(dot)dot.classList.toggle("needs-attention",!runtime.ready&&route!=="deterministic");
    }

    function openSheet(id,trigger){const sheet=document.getElementById(id);if(!sheet)return;sheet.hidden=false;trigger?.setAttribute("aria-expanded","true");setTimeout(()=>sheet.querySelector("button,textarea")?.focus(),30);}
    function closeSheet(id,trigger){const sheet=document.getElementById(id);if(!sheet)return;sheet.hidden=true;trigger?.setAttribute("aria-expanded","false");trigger?.focus();}

    function mossDeterministicAnswer(question){
      const modules=state.school?.modules||[];const index=currentLearningIndex();const module=modules[index];const contract=module?moduleContract(module,index):null;const gate=state.academy.projectGate;
      const lower=question.toLowerCase();
      if(/next|what.*do|stuck|continue/.test(lower))return module?`Your next meaningful action is to ${contract.completion.toLowerCase()} in “${module.title}.” This matters because ${contract.why} If that step feels too large, begin with the practical artifact: ${contract.artifact}.`:"Create or install a school first.";
      if(/project|cerbanimo|submit/.test(lower))return gate.status==="accepted"?"Cerbanimo has accepted the final project, so the final competency test is available in Learn.":`The final project gate is currently “${gate.status.replaceAll("-"," ")}.” Complete the instructional pathway, prepare the brief in Practice, submit it to Cerbanimo, and wait for an accepted review receipt before taking the final test.`;
      if(/explain|simpl|understand/.test(lower)&&module)return `Plain-language orientation for “${module.title}”: ${module.summary} The practical point is ${contract.artifact}. Look for evidence that the work satisfies: ${contract.completion}.`;
      return module?`You are in “${module.title}.” Its objective is ${contract.objective} The best next move is ${contract.completion.toLowerCase()}. Ask a narrower question about a concept, practice artifact, quiz, or project connection for a more specific answer.`:"Ask about a school, module, or project after one is loaded.";
    }

    async function askMoss(){
      const question=document.getElementById("moss-question").value.trim();
      const output=document.getElementById("moss-response");
      if(!question){output.textContent="Write a question first.";return;}
      const startPath=/^(?:\/learn\s+)|(?:\b(?:start|begin|create|make|map)\b[\s\S]{0,80}\b(?:learning path|course|school|pathway)\b)|(?:\bi want to learn\b)/i.test(question);
      const changeRequest=/\b(?:change|revise|replace|regenerate|rewrite|different)\b[\s\S]{0,80}\b(?:module|lesson|practicum|proposal)\b/i.test(question);
      if(startPath){await mossCreateLocalPath(question.replace(/^\/learn\s+/i,""));return;}
      if(changeRequest){
        const changeBox=document.getElementById("moss-change-request");
        if(changeBox)changeBox.value=question;
        mossRequestChange();
        return;
      }
      output.textContent="Moss is reading the current thread…";
      const route=activeModelRoute();
      const module=state.school?.modules?.[currentLearningIndex()];
      const journey=commonweaveLearningState()?.activeJourney;
      const context={school:{title:state.school?.title,subject:state.school?.subject,description:state.school?.description,creatorFixed:Boolean(state.school?.creatorPolicy?.fixed)},module:module?{title:module.title,summary:module.summary,contract:moduleContract(module,currentLearningIndex()),creatorFixed:mossModuleIsFixed(module)}:null,progress:{cleared:state.clearedModules.length,total:state.school?.modules?.length||0,traversalMode:state.academy.traversalMode},learningPath:journey?{title:journey.title,creativeIntention:journey.creativeIntention||journey.intention,steps:journey.learningPath?.map(step=>({title:step.title,status:step.status})),mossPhase:mossFlow().phase}:null,projectGate:{status:state.academy.projectGate.status,projectRef:state.academy.projectGate.projectRef}};
      if(route==="deterministic"||route==="manual"){output.textContent=mossDeterministicAnswer(question);return;}
      try{const response=await invokeLanguageModel([{role:"system",content:"You are Moss, Living School's concise learning guide. Answer from the supplied current context. Explain and recommend, but do not claim to approve proposals, rewrite creator-fixed modules, verify competency, or move the user into Cerbanimo without permission. Give one clear next action and explain why it matters."},{role:"user",content:`CURRENT CONTEXT\n${JSON.stringify(context)}\n\nQUESTION\n${question}`}],modelConfigFromUI());output.textContent=response.trim()||mossDeterministicAnswer(question);}catch(error){output.textContent=`The selected model route could not answer: ${error.message}\n\nLocal guidance:\n${mossDeterministicAnswer(question)}`;}
    }

    function renderManifest() {
      document.getElementById("manifest-preview").textContent=JSON.stringify(schoolManifest(),null,2);
    }

    function passportPayload(publicOnly=false) {
      const payload={
        schema:"living-school-passport-0.2",
        exportedAt:new Date().toISOString(),
        learner:{
          displayName:state.learner.displayName,
          learnerId:state.learner.learnerId,
          domainXP:state.learner.domainXP,
          levels:Object.fromEntries(Object.entries(state.learner.domainXP).map(([domain,xp])=>[domain,levelForXP(xp)])),
          constellationSummary:{
            concepts:constellationConcepts().length,
            reviewsDue:constellationReviewQueue().length,
            strongConcepts:constellationConcepts().filter(item=>item.strength>=75).length,
            evidenceBacked:constellationConcepts().filter(item=>item.evidenceRefs.length||item.credentialRefs.length).length
          }
        },
        schools:[{schoolId:state.school.id,title:state.school.title,subject:state.school.subject,clearedModules:state.clearedModules}],
        badges:state.badges
      };
      if(!publicOnly){
        payload.xpLedger=state.xpLedger;
        payload.learnerConstellation=state.learner.constellation;
        payload.artifactRefs=state.artifacts.map(item=>item.id);
        payload.events=state.events;
        payload.academy={
          cohortMemberships:(state.academy?.cohorts||[])
            .filter(cohort=>cohort.participants.some(participant=>participant.id===state.learner.learnerId))
            .map(cohort=>({cohortId:cohort.id,name:cohort.name,role:cohort.participants.find(participant=>participant.id===state.learner.learnerId)?.role||"learner"})),
          practica:(state.academy?.practica||[]).filter(item=>item.status==="completed"||item.status==="submitted"),
          completedReviews:(state.academy?.reviews||[]).filter(item=>item.reviewer===state.learner.displayName&&item.status!=="pending")
        };
      }
      return payload;
    }

    async function importPassport(file) {
      const payload=await readStructuredJsonFile(file);
      if(payload.schema!=="living-school-passport-0.2") throw new Error("Unsupported passport schema.");
      state.learner.displayName=payload.learner?.displayName||state.learner.displayName;
      state.learner.learnerId=payload.learner?.learnerId||state.learner.learnerId;
      Object.entries(payload.learner?.domainXP||{}).forEach(([domain,xp])=>{
        state.learner.domainXP[domain]=Math.max(Number(state.learner.domainXP[domain]||0),Number(xp||0));
      });
      for(const badge of payload.badges||[]){
        if(!state.badges.some(existing=>existing.id===badge.id||existing.badgeId===badge.badgeId)) state.badges.push(badge);
      }
      if(payload.learnerConstellation){
        state.learner.constellation={...defaultConstellationState(),...payload.learnerConstellation,concepts:{...(payload.learnerConstellation.concepts||{})}};
        syncConstellationToSchool();
      }
      renderSchool();
    }

    function curriculumPackPayload(){
      return {schema:"commonweave.curriculum-pack.v1",exportedAt:new Date().toISOString(),license:{code:"CC-BY-SA-4.0",attributionRequired:true},school:deepClone(state.school),research:mossResearchPacket?deepClone(mossResearchPacket):null,sourceLedger:state.school?.sourceAnalysis||null,media:(state.school?.modules||[]).flatMap(module=>(module.media||[]).map(media=>({moduleId:module.id,moduleTitle:module.title,...media}))),assessmentPolicy:deepClone(state.assessment||{}),progress:{clearedModules:[...state.clearedModules],mastery:deepClone(state.mastery)},refresh:{lastResearchedAt:mossResearchPacket?.retrievedAt||null,refreshAfterDays:90}};
    }
    function exportCurriculumPack(){download(`${slug(state.school.title)}.livingcurriculum.json`,JSON.stringify(curriculumPackPayload(),null,2),"application/json;charset=utf-8")}
    async function importCurriculumPack(file){const payload=await readStructuredJsonFile(file);if(payload.schema!=="commonweave.curriculum-pack.v1")throw new Error("Unsupported curriculum pack schema.");if(!Array.isArray(payload.school?.modules)||!payload.school.modules.length)throw new Error("Curriculum pack contains no modules.");state.school=finalizeSchool(payload.school,{difficulty:payload.school.difficulty,mode:payload.school.mode,tone:payload.school.tone});state.clearedModules=Array.isArray(payload.progress?.clearedModules)?payload.progress.clearedModules:[];state.mastery=payload.progress?.mastery&&typeof payload.progress.mastery==="object"?payload.progress.mastery:{};mossResearchPacket=payload.research||null;if(mossResearchPacket)renderResearchPacket(mossResearchPacket);activeModuleId=state.school.modules[0]?.id||null;emit("school.curriculum-pack-imported",{schoolId:state.school.id,moduleCount:state.school.modules.length});renderSchool();setWorkspace("learn");if(activeModuleId)openModule(activeModuleId);toast("Portable curriculum pack imported.")}
    function buildRepairWorkshopShowcase(){
      const notes=`# Build a Neighborhood Repair Workshop\n\n## Outcome\nCreate a safe, welcoming, community-governed repair workshop that can diagnose common household items, teach repair skills, manage shared tools, and document evidence.\n\n## Source principles\n[1] https://www.osha.gov/hand-power-tools\nHand and power tool safety requires guarding, inspection, suitable personal protective equipment, and removing damaged tools from service.\n\n[2] https://www.epa.gov/recycle/electronics-donation-and-recycling\nElectronics repair and reuse can extend product life; hazardous components and end-of-life devices require appropriate handling.\n\n[3] https://www.ifixit.com/Right-to-Repair\nRepairability depends on access to parts, documentation, diagnostics, and safe procedures. Treat this as an advocacy and practitioner source rather than a neutral regulator.\n\n[4] https://www.sustainableconsumption.us/tool-libraries\nShared tool access can reduce duplicated purchases, but checkout, maintenance, replacement, and liability rules must be explicit.\n\n## Capstone\nRun one supervised repair clinic, publish the workshop safety and tool-use agreement, document three repairs or responsible non-repair decisions, and record a maintenance schedule for shared equipment.`;
      state.school=generateSchool("Build a Neighborhood Repair Workshop",notes,6,"introductory","practical","plain");state.school.title="Build a Neighborhood Repair Workshop";state.school.subtitle="A Commonweave showcase school";state.school.description="Learn repair diagnosis, tool safety, workshop operations, teaching, sourcing, and shared governance by opening a small neighborhood repair workshop.";state.school.showcase=true;state.school.modules.forEach((module,index)=>{module.media=module.media||[];module.provenance=`Commonweave showcase · referenced source pack · module ${index+1}`});state.clearedModules=[];state.mastery={};activeModuleId=state.school.modules[0]?.id||null;renderSchool();setWorkspace("learn");if(activeModuleId)openModule(activeModuleId);toast("Opened the neighborhood repair workshop showcase.")}
    async function launchFrictionlessSchool(goal,{fromOnboarding=false}={}){
      goal=String(goal||"").trim();if(!goal)return toast("Name something you want to become capable of doing.");const status=document.getElementById("frictionless-status");status.textContent="Moss is mapping the field, gathering references, and preparing the first useful lesson…";document.getElementById("school-subject").value=goal;document.getElementById("research-subject").value=goal;document.getElementById("school-preset").value="custom";setWorkspace("studio",{focusId:"frictionless-launch"});
      try{const packet=await runMossResearch();if(packet)applySelectedResearchToBuilder();if(!hostedEntitlementIsActive())document.getElementById("generation-engine").value="deterministic";await generateFromBuilder();if(packet?.videos?.length)applyMossResearchMedia();status.textContent=`Ready: ${state.school.title}. The first lesson is open, with ${packet?.sources?.length||0} discovered sources preserved for review.`;if(fromOnboarding)toast("Moss built your first living curriculum.");}catch(error){status.textContent=`Moss kept the goal but could not finish the automatic build: ${error.message}. You can continue with the deterministic compiler.`;}
    }

    async function importManifest(file) {
      const payload=await readStructuredJsonFile(file);
      if(!["living-academy-manifest-1.5","living-academy-manifest-1.4","living-academy-manifest-1.3","living-academy-manifest-1.2","living-academy-manifest-1.1","living-school-manifest-0.3","living-school-manifest-0.2","living-school-manifest-0.1"].includes(payload.schema)) throw new Error("Unsupported manifest schema.");
      if(!Array.isArray(payload.school?.modules)||!payload.school.modules.length||payload.school.modules.length>500) throw new Error("Manifest contains an invalid number of modules.");
      state.school=finalizeSchool(payload.school,{difficulty:payload.school.difficulty,mode:payload.school.mode,tone:payload.school.tone});
      state.clearedModules=[];
      state.mastery={};
      emit("school.imported",{schoolId:state.school.id,moduleCount:state.school.modules.length});
      renderSchool();
      toast("School manifest imported.");
    }

    function exportHTML() {
      saveState();
      const clone=document.documentElement.cloneNode(true);
      const seed=clone.querySelector("#school-seed");
      if(seed) seed.textContent=JSON.stringify(state,null,2);
      const consoleNode=clone.querySelector("#model-console");
      if(consoleNode) consoleNode.textContent="This exported school contains its current curriculum and learner state.";
      download(`${slug(state.school.title)}-living-school.html`,"<!doctype html>\n"+clone.outerHTML,"text/html;charset=utf-8");
    }

    function download(filename,text,mime) {
      const blob=new Blob([text],{type:mime});
      const url=URL.createObjectURL(blob);
      const link=document.createElement("a");
      link.href=url;
      link.download=filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }

    function bind() {
      document.getElementById("menu-toggle").addEventListener("click",()=>document.getElementById("sidebar").classList.toggle("open"));
      document.querySelectorAll("[data-workspace-target]").forEach(button=>{
        button.addEventListener("click",()=>setWorkspace(button.dataset.workspaceTarget));
      });
      window.addEventListener("hashchange",navigateFromHash);
      document.addEventListener("keydown",event=>{
        if(!event.altKey) return;
        const keys=["home","market","help","constellation","learn","studio","cohort","practica","review"];
        const index=Number(event.key)-1;
        if(keys[index]){event.preventDefault();setWorkspace(keys[index]);}
      });
      document.getElementById("continue-learning").addEventListener("click",event=>{
        const id=event.currentTarget.dataset.moduleId;
        if(id) openModule(id);
      });
      document.getElementById("campus-return").addEventListener("click",()=>{if(window.parent!==window)window.parent.postMessage({type:"commonweave:navigate",target:"campus"},location.origin);else location.href="/campus";});
      document.getElementById("model-key-shortcut")?.addEventListener("click",()=>openModelFoundry());
      document.getElementById("school-controls-toggle").addEventListener("click",event=>{renderHeaderControls();openSheet("school-controls-sheet",event.currentTarget);});
      document.getElementById("school-controls-close").addEventListener("click",()=>closeSheet("school-controls-sheet",document.getElementById("school-controls-toggle")));
      document.getElementById("ask-moss").addEventListener("click",event=>{renderMossOrchestration();openSheet("moss-sheet",event.currentTarget);});
      document.getElementById("moss-sheet-close").addEventListener("click",()=>closeSheet("moss-sheet",document.getElementById("ask-moss")));
      document.getElementById("moss-submit").addEventListener("click",()=>askMoss());
      document.getElementById("moss-open-model").addEventListener("click",()=>{closeSheet("moss-sheet",document.getElementById("ask-moss"));openModelFoundry();});
      document.getElementById("moss-approve-proposal").addEventListener("click",approveCurrentMossProposal);
      document.getElementById("moss-request-change").addEventListener("click",mossRequestChange);
      document.getElementById("moss-open-current-module").addEventListener("click",()=>{const module=mossActiveModule();if(module){closeSheet("moss-sheet",document.getElementById("ask-moss"));setWorkspace("learn");openModule(module.id);}});
      document.getElementById("moss-continue-cerbanimo").addEventListener("click",mossContinueToCerbanimo);
      document.getElementById("moss-defer-proposal").addEventListener("click",()=>closeSheet("moss-sheet",document.getElementById("ask-moss")));
      document.getElementById("moss-start-new-path").addEventListener("click",()=>mossCreateLocalPath(document.getElementById("moss-new-path-request").value));
      document.getElementById("school-controls-sheet").addEventListener("click",event=>{if(event.target===event.currentTarget)closeSheet("school-controls-sheet",document.getElementById("school-controls-toggle"));});
      document.getElementById("moss-sheet").addEventListener("click",event=>{if(event.target===event.currentTarget)closeSheet("moss-sheet",document.getElementById("ask-moss"));});
      document.querySelectorAll("[data-appearance-mode]").forEach(button=>button.addEventListener("click",()=>applyAppearanceMode(button.dataset.appearanceMode)));
      document.querySelectorAll("[data-traversal-mode]").forEach(button=>button.addEventListener("click",()=>setTraversalMode(button.dataset.traversalMode)));
      document.getElementById("traversal-select")?.addEventListener("change",event=>setTraversalMode(event.currentTarget.value));
      document.querySelector("[data-mobile-browse]").addEventListener("click",()=>setTraversalMode("browse"));
      document.querySelector("[data-mobile-more]").addEventListener("click",()=>openSheet("school-controls-sheet",document.getElementById("school-controls-toggle")));
      document.getElementById("school-cover-expand").addEventListener("click",event=>{const cover=document.getElementById("school-cover");cover.classList.toggle("expanded");event.currentTarget.setAttribute("aria-expanded",String(cover.classList.contains("expanded")));event.currentTarget.textContent=cover.classList.contains("expanded")?"Collapse purpose":"Read full purpose";});
      document.getElementById("open-cerbanimo-connection").addEventListener("click",()=>{closeSheet("school-controls-sheet",document.getElementById("school-controls-toggle"));location.href="../cerbanimo/index.html?commonweave=1&visual=1#world-title";});
      document.getElementById("quiet-toggle").addEventListener("click",()=>applyAppearanceMode("quiet"));

      document.getElementById("top-plan").addEventListener("click",()=>setWorkspace("admin",{focusId:"billing-panel"}));
      document.getElementById("top-ai-wallet").addEventListener("click",()=>setWorkspace("admin",{focusId:"billing-panel"}));

      document.getElementById("top-model-route").addEventListener("click",()=>openModelFoundry());
      document.getElementById("home-choose-model").addEventListener("click",()=>openModelFoundry());
      document.getElementById("open-model-foundry-create").addEventListener("click",()=>openModelFoundry());
      document.getElementById("open-model-foundry-account").addEventListener("click",()=>openModelFoundry());
      document.querySelectorAll("[data-model-route]").forEach(button=>{
        button.addEventListener("click",()=>{
          modelFoundryRoute=button.dataset.modelRoute;
          renderModelFoundry();
        });
      });
      document.getElementById("close-model-foundry").addEventListener("click",closeModelFoundry);
      document.getElementById("model-foundry-cancel").addEventListener("click",closeModelFoundry);
      document.getElementById("model-foundry-test").addEventListener("click",()=>testModelFoundryRoute().catch(error=>{
        setModelStatus(`Route test failed: ${error.message}`,"bad");
        renderModelFoundry();
      }));
      document.getElementById("model-foundry-activate").addEventListener("click",activateModelFoundryRoute);
      document.getElementById("model-foundry-advanced").addEventListener("click",openAdvancedModelSettings);
      document.getElementById("model-foundry-overlay").addEventListener("click",event=>{
        if(event.target===event.currentTarget) closeModelFoundry();
      });
      document.getElementById("model-foundry-panel").addEventListener("click",event=>{
        handleModelFoundryPanelClick(event).catch(error=>{
          setModelStatus(`Model setup failed: ${error.message}`,"bad");
          renderModelFoundry();
        });
      });
      document.getElementById("model-foundry-panel").addEventListener("change",handleModelFoundryPanelChange);

      document.getElementById("top-human-help").addEventListener("click",()=>setWorkspace("help",{focusId:"human-help-panel"}));
      document.getElementById("top-constellation").addEventListener("click",()=>setWorkspace("constellation",{focusId:"learner-constellation-panel"}));
      document.getElementById("start-constellation-diagnostic").addEventListener("click",startConstellationDiagnostic);
      document.getElementById("review-due-concepts").addEventListener("click",()=>startReviewConcept(constellationReviewQueue()[0]?.id));
      document.getElementById("export-constellation").addEventListener("click",exportLearnerConstellation);
      document.getElementById("import-constellation").addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;try{await importLearnerConstellationFile(file);}catch(error){toast(`Constellation import failed: ${error.message}`);}event.target.value="";});
      document.getElementById("constellation-filter").addEventListener("change",event=>{state.learner.constellation.filter=event.target.value;renderLearnerConstellation();saveState();});
      document.getElementById("constellation-domain-filter").addEventListener("change",event=>{state.learner.constellation.domainFilter=event.target.value;renderLearnerConstellation();saveState();});
      document.getElementById("constellation-reset-view").addEventListener("click",()=>{state.learner.constellation.filter="all";state.learner.constellation.domainFilter="all";state.learner.constellation.selectedNodeId="";renderLearnerConstellation();saveState();});

      document.getElementById("home-start-learning").addEventListener("click",()=>{
        if(state.school?.modules?.length&&!state.clearedModules.includes(state.school.modules[0].id)) setWorkspace("learn");
        else setWorkspace("market");
      });
      document.getElementById("home-create-school").addEventListener("click",()=>setWorkspace("studio",{focusId:"school-builder"}));
      document.getElementById("home-open-onboarding").addEventListener("click",openOnboarding);
      document.getElementById("view-all-templates").addEventListener("click",()=>setWorkspace("market"));
      document.getElementById("home-manage-plan").addEventListener("click",()=>setWorkspace("admin",{focusId:"billing-panel"}));
      document.getElementById("home-use-local-ai").addEventListener("click",()=>openModelFoundry("gguf"));
      document.querySelectorAll("[data-launch-action]").forEach(button=>{
        button.addEventListener("click",()=>{
          const action=button.dataset.launchAction;
          if(action==="learn") setWorkspace("market");
          else if(action==="create") setWorkspace("studio",{focusId:"school-builder"});
          else if(action==="sell") setWorkspace("market",{focusId:"creator-studio-panel"});
          else if(action==="institution") setWorkspace("admin",{focusId:"billing-panel"});
          else if(action==="help") setWorkspace("help",{focusId:"help-request-builder"});
          else {
            state.commerce.onboarding.role="offline";
            openModelFoundry("gguf");
          }
        });
      });
      document.getElementById("next-step-action").addEventListener("click",event=>{
        setWorkspace(event.currentTarget.dataset.workspace||"home",{focusId:event.currentTarget.dataset.focusId||null});
      });


      document.getElementById("help-new-request").addEventListener("click",()=>document.getElementById("help-request-builder").scrollIntoView({behavior:"smooth"}));
      document.getElementById("help-become-expert").addEventListener("click",()=>document.getElementById("expert-studio-panel").scrollIntoView({behavior:"smooth"}));
      document.getElementById("match-help-experts").addEventListener("click",runHelpMatching);
      document.getElementById("save-help-request").addEventListener("click",()=>saveHelpRequest());
      document.getElementById("export-help-request").addEventListener("click",exportCurrentHelpRequest);
      document.getElementById("help-service-search").addEventListener("input",event=>{state.commerce.helpSearch=event.target.value;renderHumanHelp();saveState();});
      document.getElementById("help-service-filter").addEventListener("change",event=>{state.commerce.helpServiceFilter=event.target.value;renderHumanHelp();saveState();});
      document.getElementById("publish-expert-service").addEventListener("click",publishExpertService);
      document.getElementById("connect-expert-payouts").addEventListener("click",()=>connectExpertPayouts());
      document.getElementById("add-demo-review-credit").addEventListener("click",addDemoReviewCredit);
      document.getElementById("export-review-credit-request").addEventListener("click",exportReviewCreditRequest);

      document.getElementById("market-search").addEventListener("input",event=>{
        state.commerce.marketSearch=event.target.value;
        renderMarketplace();
        saveState();
      });
      document.getElementById("market-category").addEventListener("change",event=>{
        state.commerce.marketCategory=event.target.value;
        renderMarketplace();
        saveState();
      });
      document.getElementById("market-price-filter").addEventListener("change",event=>{
        state.commerce.marketPriceFilter=event.target.value;
        renderMarketplace();
        saveState();
      });
      document.getElementById("market-show-library").addEventListener("click",()=>setWorkspace("home",{focusId:"home-launchpad"}));
      document.getElementById("publish-listing").addEventListener("click",publishCurrentSchool);
      document.getElementById("seller-onboarding").addEventListener("click",()=>beginSellerOnboarding());
      document.getElementById("export-listing").addEventListener("click",exportSelectedListing);
      document.getElementById("close-listing-drawer").addEventListener("click",closeListingDrawer);
      document.getElementById("listing-drawer").addEventListener("click",event=>{
        if(event.target===event.currentTarget) closeListingDrawer();
      });

      document.getElementById("billing-email").addEventListener("input",event=>{
        state.commerce.billingEmail=event.target.value;
        saveState();
      });
      document.getElementById("manage-subscription").addEventListener("click",()=>manageSubscription());
      document.getElementById("activate-demo-entitlement").addEventListener("click",activateDemoEntitlement);
      document.getElementById("select-hosted-ai").addEventListener("click",()=>openModelFoundry("hosted"));
      document.getElementById("select-local-ai").addEventListener("click",()=>openModelFoundry("local-api"));
      document.getElementById("buy-ai-topup").addEventListener("click",()=>buyAiTopup());
      document.getElementById("toggle-advanced-mode").addEventListener("click",()=>{
        state.commerce.noviceMode=state.commerce.noviceMode===false;
        document.body.classList.toggle("novice-mode",state.commerce.noviceMode!==false);
        renderCommerce();
        saveState();
      });

      document.getElementById("verify-entitlement").addEventListener("click",()=>verifyEntitlementFromTextarea());
      document.getElementById("import-entitlement").addEventListener("change",async event=>{
        const file=event.target.files?.[0];
        if(!file) return;
        try{
          const receipt=await readStructuredJsonFile(file,1_000_000);
          document.getElementById("entitlement-receipt").value=JSON.stringify(receipt);
          await verifyEntitlementFromTextarea();
        }catch(error){
          document.getElementById("entitlement-feedback").className="feedback fail";
          document.getElementById("entitlement-feedback").textContent=`Receipt import failed: ${error.message}`;
        }
        event.target.value="";
      });
      document.getElementById("export-entitlement").addEventListener("click",exportEntitlement);
      document.getElementById("save-organization").addEventListener("click",saveOrganization);
      document.getElementById("export-org-voucher-request").addEventListener("click",exportOrganizationVoucherRequest);
      document.getElementById("save-operator-config").addEventListener("click",saveOperatorConfig);
      document.getElementById("test-billing-broker").addEventListener("click",()=>testCommerceBroker());
      document.getElementById("reset-commerce-demo").addEventListener("click",resetCommerceDemo);

      document.getElementById("close-onboarding").addEventListener("click",closeOnboarding);
      document.getElementById("onboarding-next").addEventListener("click",onboardingNext);
      document.getElementById("onboarding-back").addEventListener("click",onboardingBack);
      document.getElementById("onboarding-skip").addEventListener("click",skipOnboarding);
      document.getElementById("onboarding-overlay").addEventListener("click",event=>{
        if(event.target===event.currentTarget) closeOnboarding();
      });


      document.getElementById("school-preset").addEventListener("change",event=>{
        if(event.target.value==="anarcho"){
          document.getElementById("school-subject").value=defaultKnowledge.subject;
          document.getElementById("school-sources").value="";
          renderSourceAnalysis(null);
        } else if(event.target.value==="nny-foraging"){
          document.getElementById("school-subject").value="Northern New York wild edibles and foraging safety";
          document.getElementById("school-sources").value=NNY_FORAGING_DUMP;
          document.getElementById("school-modules").value="8";
          renderSourceAnalysis(parseDataDump(NNY_FORAGING_DUMP));
        } else {
          document.getElementById("school-subject").value="";
          document.getElementById("school-sources").value="";
          renderSourceAnalysis(null);
        }
      });


      document.getElementById("assessment-policy").addEventListener("change",event=>setAssessmentPolicy(event.target.value));
      document.getElementById("assessment-autosave").addEventListener("change",event=>{
        state.assessment.autosaveDrafts=event.target.checked;
        saveState();
        renderAssessmentAudit();
      });
      document.getElementById("assessment-show-coaching").addEventListener("change",event=>{
        state.assessment.showIdeaCoaching=event.target.checked;
        saveState();
        renderSchool();
      });
      document.getElementById("assessment-review-path").addEventListener("change",event=>{
        state.assessment.allowReviewChallenges=event.target.checked;
        saveState();
        renderAssessmentAudit();
      });
      document.getElementById("audit-assessments").addEventListener("click",()=>{
        renderAssessmentAudit();
        document.getElementById("assessment-audit").scrollIntoView({behavior:"smooth",block:"center"});
      });
      document.getElementById("apply-learner-first").addEventListener("click",makeKeywordChecksCoachingOnly);
      document.getElementById("restore-authored-policy").addEventListener("click",()=>setAssessmentPolicy("balanced"));
      document.getElementById("clear-quiz-drafts").addEventListener("click",clearSavedQuizDrafts);

      document.getElementById("generate-school").addEventListener("click",()=>generateFromBuilder().catch(error=>console.error(error)));
      document.getElementById("frictionless-build").addEventListener("click",()=>launchFrictionlessSchool(document.getElementById("frictionless-goal").value));
      document.getElementById("frictionless-goal").addEventListener("keydown",event=>{if(event.key==="Enter")launchFrictionlessSchool(event.currentTarget.value)});
      document.getElementById("open-showcase-school").addEventListener("click",buildRepairWorkshopShowcase);
      document.getElementById("export-curriculum-pack").addEventListener("click",exportCurriculumPack);
      document.getElementById("export-school-pack").addEventListener("click",exportCurriculumPack);
      document.getElementById("import-curriculum-pack").addEventListener("change",async event=>{const file=event.target.files?.[0];if(!file)return;try{await importCurriculumPack(file)}catch(error){toast(`Curriculum pack import failed: ${error.message}`)}event.target.value=""});
      document.getElementById("test-model").addEventListener("click",testModelConnection);
      document.getElementById("apply-manual-response").addEventListener("click",applyManualModelResponse);
      document.getElementById("cancel-model-run").addEventListener("click",()=>{
        if(modelAbortController) modelAbortController.abort();
        setModelStatus("Cancellation requested.");
      });
      document.getElementById("accept-model-proposal").addEventListener("click",acceptModelProposal);
      document.getElementById("discard-model-proposal").addEventListener("click",discardModelProposal);
      document.getElementById("download-model-proposal").addEventListener("click",()=>{
        if(!pendingModelProposal) return;
        download(`${slug(pendingModelProposal.school.title)}-model-proposal.json`,JSON.stringify({
          schema:"living-academy-manifest-1.5",
          school:pendingModelProposal.school,
          validatorWarnings:pendingModelProposal.warnings,
          modelNotes:pendingModelProposal.notes
        },null,2),"application/json;charset=utf-8");
      });
      document.getElementById("model-temperature").addEventListener("input",event=>{
        document.getElementById("temperature-value").textContent=Number(event.target.value).toFixed(2);
        persistModelSettings();
      });
      document.getElementById("model-provider").addEventListener("change",event=>{
        applyProviderDefaults(event.target.value);
        state.modelRuntime.tested=false;
        state.modelRuntime.ready=false;
        state.modelRuntime.route=activeModelRoute();
        updateModelFoundryCurrent();
      });
      document.getElementById("model-local-api-flavor").addEventListener("change",()=>{
        if(document.getElementById("model-provider").value==="local-api") applyProviderDefaults("local-api");
      });
      ["school-preset","school-subject","school-sources","generation-engine"].forEach(id=>{
        const node=document.getElementById(id);
        node.addEventListener(id==="school-sources"||id==="school-subject"?"input":"change",updateSourceGenerationWarning);
      });
      ["model-name","model-endpoint","model-api-key","model-local-api-flavor","model-max-tokens","model-timeout","model-tool-rounds","model-tools-enabled","generation-engine","model-freedom","gguf-bridge-endpoint","gguf-port","gguf-context","gguf-gpu-layers","gguf-threads"].forEach(id=>document.getElementById(id).addEventListener("change",persistModelSettings));
      document.getElementById("choose-gguf").addEventListener("click",()=>chooseGGUF().catch(e=>document.getElementById("gguf-status").textContent=`GGUF selection failed: ${e.message}`));
      document.getElementById("scan-gguf-folder").addEventListener("click",()=>document.getElementById("gguf-folder-input").click());
      document.getElementById("gguf-file-input").addEventListener("change",event=>{addGGUFFiles(event.target.files).then(()=>{if(!document.getElementById("model-foundry-overlay").hidden)renderModelFoundry()}).catch(e=>document.getElementById("gguf-status").textContent=`GGUF inspection failed: ${e.message}`);event.target.value=""});
      document.getElementById("gguf-folder-input").addEventListener("change",event=>{addGGUFFiles(event.target.files).then(()=>{if(!document.getElementById("model-foundry-overlay").hidden)renderModelFoundry()}).catch(e=>document.getElementById("gguf-status").textContent=`Folder scan failed: ${e.message}`);event.target.value=""});
      document.getElementById("gguf-candidates").addEventListener("change",event=>{selectedGGUFKey=event.target.value;renderSelectedGGUF()});
      document.getElementById("ingest-gguf").addEventListener("click",()=>ingestSelectedGGUF().catch(e=>{document.getElementById("gguf-state").textContent="GGUF start failed";document.getElementById("gguf-state").className="gguf-state bad";document.getElementById("gguf-status").textContent=`GGUF ingestion/start failed: ${e.message}`}));
      document.getElementById("probe-gguf-bridge").addEventListener("click",()=>probeGGUFBridge().catch(()=>{}));
      document.getElementById("bridge-native-picker").addEventListener("click",()=>openNativeBridgePicker().catch(e=>document.getElementById("gguf-status").textContent=`Native picker failed: ${e.message}`));
      document.getElementById("stop-gguf-model").addEventListener("click",()=>stopGGUFModel().catch(e=>document.getElementById("gguf-status").textContent=`Stop failed: ${e.message}`));
      document.getElementById("analyze-sources").addEventListener("click",()=>{
        const parsed=parseDataDump(document.getElementById("school-sources").value);
        renderSourceAnalysis(parsed);
        document.getElementById("model-console").textContent=`Parsed ${parsed.claims.length} claims, ${parsed.sections.length} sections, ${Object.keys(parsed.sources).length} sources, and ${parsed.safetyFlags.length} safety flag categories. Stable input hash: ${parsed.hash}.`;
      });
      document.getElementById("load-foraging-demo").addEventListener("click",()=>{
        document.getElementById("school-preset").value="nny-foraging";
        document.getElementById("school-subject").value="Northern New York wild edibles and foraging safety";
        document.getElementById("school-sources").value=NNY_FORAGING_DUMP;
        document.getElementById("school-modules").value="8";
        renderSourceAnalysis(parseDataDump(NNY_FORAGING_DUMP));
        document.getElementById("model-console").textContent="Loaded the Northern New York source dump. Press Compile curriculum to build the stable eight-module field school.";
      });
      document.getElementById("apply-model-request").addEventListener("click",()=>applyModelRequest().catch(error=>console.error(error)));
      document.getElementById("reset-default").addEventListener("click",restoreDefault);
      document.getElementById("export-school-html").addEventListener("click",exportHTML);
      document.getElementById("export-school-manifest").addEventListener("click",()=>download(`${slug(state.school.title)}-manifest.json`,JSON.stringify(schoolManifest(),null,2),"application/json;charset=utf-8"));
      document.getElementById("import-school-manifest").addEventListener("change",async event=>{
        const file=event.target.files?.[0]; if(!file)return;
        try{await importManifest(file);}catch(error){toast(`Import failed: ${error.message}`);}
        event.target.value="";
      });
      document.getElementById("media-module-select").addEventListener("change",event=>loadVideoEditorForModule(event.target.value));
      document.getElementById("media-video-url").addEventListener("input",renderVideoPreview);
      ["media-video-title","media-video-attribution","media-video-description","media-video-transcript","media-video-chapters","media-video-prompts"].forEach(id=>document.getElementById(id).addEventListener("input",renderVideoPreview));
      document.getElementById("save-module-video").addEventListener("click",saveModuleVideo);
      document.getElementById("remove-module-video").addEventListener("click",removeModuleVideo);

      document.getElementById("save-identity").addEventListener("click",()=>{
        state.learner.displayName=document.getElementById("learner-name").value.trim()||"Local learner";
        state.learner.learnerId=document.getElementById("learner-id").value.trim()||"did:cerbanimo:local-learner";
        state.badges.forEach(badge=>badge.recipient=state.learner.learnerId);
        renderSchool();
      });
      document.getElementById("export-passport").addEventListener("click",()=>download(`${slug(state.learner.learnerId)}-passport.json`,JSON.stringify(passportPayload(false),null,2),"application/json;charset=utf-8"));
      document.getElementById("export-public-passport").addEventListener("click",()=>download(`${slug(state.learner.learnerId)}-public-passport.json`,JSON.stringify(passportPayload(true),null,2),"application/json;charset=utf-8"));
      document.getElementById("import-passport").addEventListener("change",async event=>{
        const file=event.target.files?.[0];if(!file)return;
        try{await importPassport(file);toast("Passport imported.");}catch(error){toast(`Passport import failed: ${error.message}`);}
        event.target.value="";
      });

      document.getElementById("compile-packet").addEventListener("click",compilePacket);
      document.getElementById("download-packet").addEventListener("click",()=>{if(!compiledPacket)compilePacket();download(`${slug(document.getElementById("packet-title").value)}.md`,compiledPacket,"text/markdown;charset=utf-8");});

      document.getElementById("quest-module").addEventListener("change",event=>previewQuest(event.target.value));
      document.getElementById("export-cerbanimo-quest").addEventListener("click",()=>exportCerbanimoQuest());
      document.getElementById("load-sample-result").addEventListener("click",sampleResult);
      document.getElementById("process-result").addEventListener("click",()=>processResult());
      document.getElementById("import-result-file").addEventListener("change",async event=>{
        const file=event.target.files?.[0];if(!file)return;
        try{processResult(await readStructuredJsonFile(file));}catch(error){document.getElementById("bridge-feedback").textContent=`Import failed: ${error.message}`;}
        event.target.value="";
      });

      document.getElementById("cohort-select").addEventListener("change",event=>{
        state.academy.activeCohortId=event.target.value;
        renderAcademy();
        saveState();
      });
      document.getElementById("create-cohort").addEventListener("click",createCohort);
      document.getElementById("add-participant").addEventListener("click",addParticipant);
      document.getElementById("assign-cohort-module").addEventListener("click",assignCohortModule);
      document.getElementById("export-cohort").addEventListener("click",()=>{
        const cohort=activeCohort();
        if(cohort) download(`${slug(cohort.name)}-cohort.json`,JSON.stringify({schema:"living-academy-cohort-0.1",exportedAt:new Date().toISOString(),school:{id:state.school.id,title:state.school.title},cohort},null,2),"application/json;charset=utf-8");
      });

      document.getElementById("create-practicum").addEventListener("click",createPracticum);
      document.getElementById("export-active-practica").addEventListener("click",()=>{
        download(`${slug(state.school.title)}-practica.json`,JSON.stringify({schema:"living-academy-practica-0.1",exportedAt:new Date().toISOString(),schoolId:state.school.id,practica:state.academy.practica.map(practicumPayload)},null,2),"application/json;charset=utf-8");
      });
      document.getElementById("save-facilitator-note").addEventListener("click",saveFacilitatorNote);

      document.getElementById("badge-domain").innerHTML=Object.entries(domains).map(([id,label])=>`<option value="${id}">${escapeHTML(label)}</option>`).join("");
      document.getElementById("propose-badge").addEventListener("click",proposeBadge);
      document.getElementById("export-badge-proposal").addEventListener("click",exportBadgeProposal);
    }

    function applyCommonweaveContext(context={}){
      const model=context.model||{};
      const providerMap={
        deterministic:"deterministic",
        hosted:"hosted",
        gguf:"gguf",
        "local-api":"local-api",
        gemini:"gemini",
        browser:"browser",
        manual:"manual"
      };
      ensureCommerceState();
      const plan=COMMERCE_PLANS[context.account?.planId]||COMMERCE_PLANS.commons;
      state.commerce.planId=plan.id;
      state.commerce.entitlement={
        ...state.commerce.entitlement,
        id:`commonweave-${plan.id}`,
        planId:plan.id,
        status:"active",
        source:"commonweave-shared",
        seats:plan.seats,
        accessToken:""
      };
      state.commerce.aiWallet={
        ...state.commerce.aiWallet,
        allowanceCents:Math.round(finiteNumber(context.account?.allowanceCents,0,0,10_000_000)),
        balanceCents:Math.round(finiteNumber(context.account?.balanceCents,0,0,10_000_000))
      };
      const provider=providerMap[model.route]||"deterministic";
      state.modelSettings={
        ...defaultModelSettings(),
        ...(state.modelSettings||{}),
        provider,
        model:String(model.model||state.modelSettings?.model||"local-model").slice(0,200),
        endpoint:String(model.endpoint||"").slice(0,2000),
        engine:provider==="deterministic"?"deterministic":"hybrid",
        commonweaveManaged:true
      };
      hydrateModelSettingsUI();
      renderCommerce();
      updateModelFoundryCurrent();
      saveState();
      document.documentElement.dataset.commonweave="connected";
      let badge=document.getElementById("commonweave-suite-badge");
      if(!badge){
        badge=document.createElement("div");badge.id="commonweave-suite-badge";badge.setAttribute("role","status");
        badge.style.cssText="position:fixed;right:12px;bottom:12px;z-index:80;display:flex;align-items:center;gap:7px;padding:6px 10px 6px 6px;border:1px solid rgba(107,161,60,.48);border-radius:999px;background:#f8fbf1;color:#263423;font:700 9px ui-monospace,monospace;box-shadow:0 8px 24px rgba(27,48,30,.22)";
        document.body.append(badge);
      }
      badge.innerHTML=`<img src="../../logos/living-school.webp" alt="" style="width:26px;height:26px;padding:2px;border-radius:50%;background:#fff;object-fit:contain"><span>MOSS · ${escapeHTML(plan.name||plan.id||"COMMONS")} · ${state.modelSettings.provider==="deterministic"?"LOCAL":escapeHTML(state.modelSettings.model)}</span>`;
    }

    function commonweaveCapstone(){
      const module=state.school.modules.at(-1)||state.school.modules[0];
      if(!module)return null;
      const payload=questPayload(module);
      if(window.parent!==window)window.parent.postMessage({
        type:"commonweave:handoff",
        source:"living",
        target:"cerbanimo",
        kind:"capstone",
        title:`Capstone · ${module.title}`,
        payload:{...payload,automaticEffect:false,manualReviewRequired:true}
      },location.origin);
      return payload;
    }

    const commonweaveIntentRequests=new Set();

    const MOSS_FLOW_PHASES=new Set(["idle","generating-practicum","awaiting-practicum-approval","generating-module","awaiting-module-approval","learning","awaiting-transfer-approval","transferred","error"]);

    function defaultMossFlow(){
      return {
        schema:"living-school-moss-orchestration-1.0",
        journeyId:"",
        phase:"idle",
        activeStepId:"",
        activeModuleId:"",
        replacingModuleId:"",
        improvementSkillCount:0,
        initialImprovementSkillCount:0,
        skipPracticum:false,
        practicumProposal:null,
        moduleProposal:null,
        lastError:"",
        proposalHistory:[],
        updatedAt:null
      };
    }

    function ensureMossFlowState(){
      state.commonweave=state.commonweave&&typeof state.commonweave==="object"?state.commonweave:{};
      state.commonweave.activeJourney=state.commonweave.activeJourney&&typeof state.commonweave.activeJourney==="object"?state.commonweave.activeJourney:null;
      state.commonweave.pathHistory=Array.isArray(state.commonweave.pathHistory)?state.commonweave.pathHistory:[];
      const defaults=defaultMossFlow();
      const flow=state.commonweave.mossFlow&&typeof state.commonweave.mossFlow==="object"?state.commonweave.mossFlow:{};
      Object.entries(defaults).forEach(([key,value])=>{
        if(flow[key]===undefined)flow[key]=value&&typeof value==="object"?deepClone(value):value;
      });
      flow.phase=MOSS_FLOW_PHASES.has(flow.phase)?flow.phase:"idle";
      flow.proposalHistory=Array.isArray(flow.proposalHistory)?flow.proposalHistory:[];
      state.commonweave.mossFlow=flow;
      return flow;
    }

    function commonweaveLearningState(){
      ensureMossFlowState();
      return state.commonweave&&state.commonweave.activeJourney?.schema==="commonweave.intention-journey.v1"
        ? state.commonweave
        : null;
    }

    function mossFlow(){
      ensureMossFlowState();
      return state.commonweave.mossFlow;
    }

    function commonweaveLearningSteps(){
      return commonweaveLearningState()?.activeJourney?.learningPath||[];
    }

    function commonweaveLearningStep(stepId){
      return commonweaveLearningSteps().find(step=>step.id===stepId)||null;
    }

    function commonweaveCapabilitiesForStep(step){
      const journey=commonweaveLearningState()?.activeJourney;
      if(!journey||!step)return [];
      const ids=new Set(step.capabilityIds||[]);
      return (journey.capabilities||[]).filter(item=>ids.has(item.id));
    }

    function commonweaveCapabilityForStep(step){
      return commonweaveCapabilitiesForStep(step)[0]||null;
    }

    function mossImprovementCapabilities(journey=commonweaveLearningState()?.activeJourney){
      if(!journey)return [];
      return (journey.capabilities||[]).filter(item=>{
        const effective=Math.max(Number(item.currentLevel??-1),Number(item.preparedLevel??-1));
        return effective<Number(item.requiredLevel||0)&&["learn","practice"].includes(item.approach);
      });
    }

    function commonweaveNextLearningStep(){
      return commonweaveLearningSteps().find(step=>step.status!=="complete")||null;
    }

    function mossJourneyMutable(journey=commonweaveLearningState()?.activeJourney){
      if(!journey)return false;
      return journey.mutable!==false&&!journey.creatorPolicy?.fixed;
    }

    function mossModuleIsFixed(module){
      if(!module)return true;
      return Boolean(
        module.creatorPolicy?.fixed||module.fixedByCreator||
        state.school?.creatorPolicy?.fixed||state.school?.installedFrom||
        (state.school?.creatorName&&state.school.creatorName!==state.commerce?.creator?.storeName)
      );
    }

    function mossActiveModule(){
      const flow=mossFlow();
      return (state.school?.modules||[]).find(module=>module.id===flow.activeModuleId)
        ||(state.school?.modules||[]).find(module=>module.commonweaveStepId===flow.activeStepId)
        ||null;
    }

    function postCommonweaveLearningProgress(step,status,extra={}){
      const context=commonweaveLearningState();
      if(!context||!step||window.parent===window)return;
      const capability=commonweaveCapabilityForStep(step);
      window.parent.postMessage({
        type:"commonweave:learning-progress",
        service:"living",
        journeyId:String(context.activeJourney.id||""),
        stepId:String(step.id||""),
        stepTitle:String(step.title||"Learning category"),
        status,
        capabilityId:String(capability?.id||""),
        requiredLevel:Number(capability?.requiredLevel||0),
        currentLevel:capability?.currentLevel===null?null:Number(capability?.currentLevel||0),
        schoolId:String(context.activeSchoolId||state.school?.id||""),
        moduleId:String(extra.moduleId||""),
        journeySnapshot:deepClone(context.activeJourney),
        creativeIntention:String(context.activeJourney.creativeIntention||context.activeJourney.intention||""),
        mossPhase:mossFlow().phase,
        automaticEffect:false,
        ...extra
      },location.origin);
    }

    function renderCommonweavePathwayBanner(){
      const banner=document.getElementById("commonweave-pathway-banner");
      if(!banner)return;
      const context=commonweaveLearningState();
      const step=context?commonweaveLearningStep(context.activeStepId||mossFlow().activeStepId):null;
      if(!context||!step){banner.hidden=true;return;}
      const steps=commonweaveLearningSteps();
      const index=Math.max(0,steps.findIndex(item=>item.id===step.id));
      const capability=commonweaveCapabilityForStep(step);
      banner.hidden=false;
      document.getElementById("commonweave-pathway-title").textContent=step.title;
      document.getElementById("commonweave-pathway-summary").textContent=capability
        ? `Starting level ${capability.currentLevel??"unassessed"} · target level ${capability.requiredLevel} · ${step.practicum}`
        : step.practicum;
      document.getElementById("commonweave-pathway-position").textContent=`${index+1} / ${steps.length}`;
    }

    function updateCommonweaveJourneyStep(stepId,status){
      const context=commonweaveLearningState();
      if(!context)return null;
      const journey=context.activeJourney;
      const step=journey.learningPath.find(item=>item.id===stepId);
      if(!step)return null;
      step.status=status;
      if(status==="complete"){
        commonweaveCapabilitiesForStep(step).forEach(capability=>{
          capability.preparedLevel=Math.max(Number(capability.preparedLevel||0),Number(capability.requiredLevel||0));
        });
      }
      const completed=journey.learningPath.filter(item=>item.status==="complete").map(item=>item.id);
      const next=journey.learningPath.find(item=>item.status!=="complete")||null;
      journey.learningProgress={
        ...(journey.learningProgress||{}),
        status:next?(completed.length?"in-progress":"not-started"):"complete",
        activeStepId:status==="complete"?(next?.id||null):stepId,
        completedStepIds:completed,
        lastLivingSchoolId:context.activeSchoolId||state.school?.id||null,
        lastLivingSchoolModuleId:mossFlow().activeModuleId||context.activeModuleIds?.at(-1)||null,
        startedAt:journey.learningProgress?.startedAt||nowIso(),
        completedAt:next?null:nowIso(),
        updatedAt:nowIso()
      };
      journey.stage=next?"prepare":"build";
      journey.updatedAt=nowIso();
      context.activeStepId=next?.id||stepId;
      return step;
    }

    function mossCurriculumFocus(step,capabilities=commonweaveCapabilitiesForStep(step)){
      const capabilityTitles=capabilities.map(item=>String(item.title||"").trim()).filter(Boolean);
      return capabilityTitles.length?capabilityTitles.join("; "):String(step?.title||"Project-relevant capability");
    }

    function commonweaveLearningNotes(step,capabilities=commonweaveCapabilitiesForStep(step),practicum=null){
      const journey=commonweaveLearningState()?.activeJourney;
      const curriculumFocus=mossCurriculumFocus(step,capabilities);
      return [
        "COMMONWEAVE MOSS-ORCHESTRATED PROJECT PREPARATION",
        `CURRICULUM SUBJECT: ${curriculumFocus}`,
        `Learning category: ${step.title}`,
        `Learning outcome: ${step.outcome}`,
        "BOUNDARY: Teach the subject and capabilities named above. The learner's intention is application context, not the topic of instruction. Do not teach the learner what their intention means, restate their intention as lesson content, or turn intention clarification into the curriculum unless the named capability is itself planning or intention clarification.",
        `Application context only: ${journey?.creativeIntention||journey?.intention||""}`,
        `Project outcome context: ${journey?.outcome||""}`,
        `Project scope context: ${journey?.scope||""}`,
        ...capabilities.flatMap(capability=>[
          `Capability: ${capability.title}`,
          `Starting level: ${capability.currentLevel??"not assessed"} of 4`,
          `Required level: ${capability.requiredLevel} of 4`,
          `Why it matters: ${capability.why}`
        ]),
        `Required practicum: ${practicum?.artifact||step.practicum}`,
        practicum?.purpose?`Approved practicum purpose: ${practicum.purpose}`:"",
        practicum?.steps?.length?`Approved practicum sequence: ${practicum.steps.join(" | ")}`:"",
        "Build one focused, substantial curriculum module about the named subject capability. Teach transferable domain knowledge, methods, vocabulary, judgment, and practice. Use the intention only for examples and application. Connect every explanation, exercise, and quiz to the approved practicum or immediate project action. Do not generate meta-lessons about the learner's intention, unrelated survey material, or automatic credential claims."
      ].filter(Boolean).join("\n\n");
    }

    function mossPracticumFallback(step,revisionNote=""){
      const journey=commonweaveLearningState()?.activeJourney;
      const capabilities=commonweaveCapabilitiesForStep(step);
      const capabilityNames=capabilities.map(item=>item.title).join(", ")||step.title;
      return {
        schema:"living-school-moss-practicum-1.0",
        id:`moss-practicum-${slug(step.id)}-${Date.now()}`,
        stepId:step.id,
        title:`${step.title} field practicum`,
        purpose:`Practice and demonstrate ${capabilityNames.toLowerCase()} through a small, reviewable artifact before the larger project depends on it.`,
        artifact:step.practicum||`A reviewed demonstration of ${step.title.toLowerCase()}.`,
        estimatedEffort:step.timing==="before-project"?"45–90 minutes":"30–60 minutes inside the active project",
        steps:[
          `Define what a credible ${step.title.toLowerCase()} result must show.`,
          `Complete the smallest representative ${capabilityNames.toLowerCase()} task, using the project only as an application setting.`,
          "Inspect the attempt against the visible rubric and revise one weakness.",
          "Save the artifact and a short reflection as evidence for the learning pathway."
        ],
        rubric:[
          `The artifact directly exercises ${capabilityNames}.`,
          "The learner can explain the important decisions in their own words.",
          "The result is usable as rehearsal, evidence, or a component of the real project.",
          "Limitations and the next improvement are named honestly."
        ],
        creativeIntention:journey?.creativeIntention||journey?.intention||"",
        revisionNote,
        generatedBy:"deterministic-moss",
        generatedAt:nowIso()
      };
    }

    function normalizeMossPracticum(payload,step,revisionNote=""){
      const fallback=mossPracticumFallback(step,revisionNote);
      if(!payload||typeof payload!=="object")return fallback;
      const cleanList=(value,fallbackValue,limit)=>Array.isArray(value)?value.map(item=>String(item||"").trim().slice(0,320)).filter(Boolean).slice(0,limit):fallbackValue;
      return {
        ...fallback,
        title:String(payload.title||fallback.title).trim().slice(0,160),
        purpose:String(payload.purpose||fallback.purpose).trim().slice(0,700),
        artifact:String(payload.artifact||fallback.artifact).trim().slice(0,500),
        estimatedEffort:String(payload.estimatedEffort||fallback.estimatedEffort).trim().slice(0,120),
        steps:cleanList(payload.steps,fallback.steps,7),
        rubric:cleanList(payload.rubric,fallback.rubric,7),
        generatedBy:"model-moss",
        generatedAt:nowIso()
      };
    }

    async function generateMossPracticumProposal(step,revisionNote=""){
      const fallback=mossPracticumFallback(step,revisionNote);
      const config=modelConfigFromUI();
      if(["deterministic","manual"].includes(config.provider)||modelRouteConfigurationIssue(config))return fallback;
      const journey=commonweaveLearningState()?.activeJourney;
      const capabilities=commonweaveCapabilitiesForStep(step);
      try{
        const text=await invokeLanguageModel([
          {role:"system",content:'You are Moss, a curriculum and practice architect. Return JSON only with schema "living-school-moss-practicum-1.0" and fields title, purpose, artifact, estimatedEffort, steps (3-7 strings), and rubric (3-7 strings). Design the smallest practical demonstration of the named subject capability. The learner intention is application context only. Do not create exercises that explain, reinterpret, summarize, or teach the learner about their own intention unless the requested capability is explicitly intention clarification or planning. Do not create a broad course or claim competency.'},
          {role:"user",content:JSON.stringify({creativeIntention:journey?.creativeIntention||journey?.intention,outcome:journey?.outcome,scope:journey?.scope,learningStep:step,capabilities,revisionRequest:revisionNote||null},null,2)}
        ],config);
        return normalizeMossPracticum(parseModelJSON(text),step,revisionNote);
      }catch(error){
        return {...fallback,generationNote:`The configured model could not draft the practicum, so Moss used its local fallback: ${error.message}`};
      }
    }

    function mossDifficultyForStep(step){
      const target=Math.max(1,...commonweaveCapabilitiesForStep(step).map(item=>Number(item.requiredLevel||1)));
      return target>=4?"advanced":target<=1?"introductory":"intermediate";
    }

    function mossDeterministicModuleProposal(step,practicum,revisionNote=""){
      const journey=commonweaveLearningState()?.activeJourney;
      const notes=commonweaveLearningNotes(step,commonweaveCapabilitiesForStep(step),practicum)+(revisionNote?`\n\nLEARNER REVISION REQUEST\n${revisionNote}`:"");
      const school=generateSchool(step.title,notes,1,mossDifficultyForStep(step),"practical","punk");
      school.title=`${journey?.title||"Learner-owned path"} · ${step.title}`;
      school.subtitle="Moss proposal · approval required";
      school.description=`A focused module for the creative intention: ${journey?.creativeIntention||journey?.intention||journey?.outcome||step.title}`;
      return {school,warnings:[{severity:"info",text:"Moss used the local curriculum compiler for this proposal."}],blockingErrors:[],notes:[],source:"deterministic-moss"};
    }

    async function generateMossModuleProposal(step,practicum,revisionNote=""){
      const fallback=mossDeterministicModuleProposal(step,practicum,revisionNote);
      const config=modelConfigFromUI();
      const issue=modelRouteConfigurationIssue(config);
      if(["deterministic","manual"].includes(config.provider)||issue)return {...fallback,generationNote:issue||"Local deterministic route selected."};
      const journey=commonweaveLearningState()?.activeJourney;
      const subject=step.title;
      const notes=commonweaveLearningNotes(step,commonweaveCapabilitiesForStep(step),practicum)+(revisionNote?`\n\nLEARNER REVISION REQUEST\n${revisionNote}`:"");
      const moduleCount=1;
      const difficulty=mossDifficultyForStep(step);
      const mode="practical";
      const tone="punk";
      const sourceContext=sourceContextForModel(subject,notes);
      const requestContext={subject,notes,moduleCount,difficulty,mode,tone,engine:config.engine,freedom:config.freedom,provider:config.provider,model:config.model,sourceContext,baseSchool:null,currentSchool:null};
      const task=`Create exactly one substantial curriculum module about the named subject capability for the supplied Commonweave pathway step. Teach transferable domain knowledge and practice needed for the approved practicum. Use the creative intention only as an application example; do not make the intention itself the lesson topic or explain the learner's own intention back to them unless the named capability explicitly requires planning or intention clarification. Include three to five varied module quiz questions, a practical exercise, visible learning contract, and honest source/provenance boundaries. ${revisionNote?`Apply this learner revision request: ${revisionNote}`:""}`;
      const messages=[
        {role:"system",content:modelSystemPrompt()},
        {role:"user",content:modelUserPrompt({task,subject,notes,moduleCount,difficulty,mode,tone,engine:config.engine,freedom:config.freedom,currentSchool:null})}
      ];
      try{
        const loop=await invokeModelToolLoop(messages,config,requestContext);
        requestContext.baseSchool=loop.toolState.deterministicSchool||null;
        const normalized=normalizeModelSchool(loop.payload,requestContext);
        if((normalized.blockingErrors||[]).length)throw new Error(normalized.blockingErrors.join(" "));
        normalized.school.title=`${journey?.title||"Learner-owned path"} · ${step.title}`;
        normalized.school.subtitle="Moss proposal · approval required";
        return {...normalized,source:`${config.provider}:${config.model}`,toolTrace:loop.toolTrace||[]};
      }catch(error){
        return {...fallback,generationNote:`The configured model proposal failed validation, so Moss preserved the pathway with a local proposal: ${error.message}`};
      }
    }

    function mossRecordProposal(kind,step,proposal){
      const flow=mossFlow();
      flow.proposalHistory.push({kind,stepId:step.id,title:proposal?.title||proposal?.school?.title||step.title,at:nowIso()});
      flow.proposalHistory=flow.proposalHistory.slice(-30);
      flow.updatedAt=nowIso();
    }

    async function prepareMossPracticumProposal(step,{revisionNote=""}={}){
      const flow=mossFlow();
      flow.phase="generating-practicum";
      flow.activeStepId=step.id;
      flow.practicumProposal=null;
      flow.moduleProposal=null;
      flow.lastError="";
      flow.updatedAt=nowIso();
      renderMossOrchestration();
      openSheet("moss-sheet",document.getElementById("ask-moss"));
      const proposal=await generateMossPracticumProposal(step,revisionNote);
      flow.practicumProposal=proposal;
      flow.phase="awaiting-practicum-approval";
      mossRecordProposal("practicum",step,proposal);
      saveState();
      renderMossOrchestration();
      postCommonweaveLearningProgress(step,"in-progress",{phase:"practicum-proposed"});
    }

    async function prepareMossModuleProposal(step,{revisionNote="",replacingModuleId=""}={}){
      const flow=mossFlow();
      flow.phase="generating-module";
      flow.activeStepId=step.id;
      flow.replacingModuleId=replacingModuleId||"";
      flow.moduleProposal=null;
      flow.lastError="";
      flow.updatedAt=nowIso();
      renderMossOrchestration();
      openSheet("moss-sheet",document.getElementById("ask-moss"));
      const proposal=await generateMossModuleProposal(step,flow.practicumProposal,revisionNote);
      flow.moduleProposal=proposal;
      flow.phase="awaiting-module-approval";
      mossRecordProposal("module",step,proposal);
      saveState();
      renderMossOrchestration();
      postCommonweaveLearningProgress(step,"in-progress",{phase:"module-proposed"});
    }

    async function beginMossLearningStep(step,{forceModule=false}={}){
      if(!step)return;
      const context=commonweaveLearningState();
      const flow=mossFlow();
      const remainingImprovementSkillCount=mossImprovementCapabilities(context?.activeJourney).length;
      const initialImprovementSkillCount=Math.max(0,Number(flow.initialImprovementSkillCount||flow.improvementSkillCount||remainingImprovementSkillCount));
      flow.journeyId=context?.activeJourney?.id||"";
      flow.activeStepId=step.id;
      flow.improvementSkillCount=remainingImprovementSkillCount;
      flow.initialImprovementSkillCount=initialImprovementSkillCount;
      flow.skipPracticum=forceModule||initialImprovementSkillCount<=1||!String(step.practicum||"").trim();
      context.activeStepId=step.id;
      updateCommonweaveJourneyStep(step.id,"in-progress");
      saveState();
      if(flow.skipPracticum)await prepareMossModuleProposal(step);
      else await prepareMossPracticumProposal(step);
    }

    let mossApprovalInFlight=false;

    function compactApprovedModuleProposal(proposal,approvedModule,approvedAt){
      return {
        schema:"living-school-moss-approved-module.v1",
        status:"approved",
        approvedAt,
        source:String(proposal?.source||"moss"),
        warnings:(proposal?.warnings||[]).slice(0,12).map(item=>({severity:String(item?.severity||"info"),text:String(item?.text||item||"").slice(0,700)})),
        school:{
          id:String(state.school?.id||proposal?.school?.id||""),
          title:String(state.school?.title||proposal?.school?.title||""),
          modules:[{
            id:String(approvedModule?.id||""),
            title:String(approvedModule?.title||"Approved module"),
            summary:String(approvedModule?.summary||"").slice(0,1200),
            commonweaveStepId:String(approvedModule?.commonweaveStepId||"")
          }]
        }
      };
    }

    async function approveCurrentMossProposal(){
      const button=document.getElementById("moss-approve-proposal");
      const flow=mossFlow();
      if(mossApprovalInFlight)return false;
      if(!["awaiting-practicum-approval","awaiting-module-approval"].includes(flow.phase)){
        renderMossOrchestration();
        return false;
      }
      mossApprovalInFlight=true;
      if(button){button.disabled=true;button.setAttribute("aria-busy","true");button.textContent=flow.phase==="awaiting-practicum-approval"?"Approving practicum…":"Approving module…";}
      try{
        const approved=flow.phase==="awaiting-practicum-approval"
          ? await approveMossPracticum()
          : approveMossModule();
        if(approved===false)throw new Error("The proposal changed before it could be approved. Reopen Moss and try again.");
        return true;
      }catch(error){
        const message=String(error?.message||error||"The proposal could not be approved.");
        flow.lastError=message;
        flow.updatedAt=nowIso();
        const output=document.getElementById("moss-response");
        if(output)output.textContent=`Moss kept the proposal, but approval could not finish: ${message}`;
        toast(`Approval needs attention: ${message}`);
        renderMossOrchestration();
        return false;
      }finally{
        mossApprovalInFlight=false;
        const current=document.getElementById("moss-approve-proposal");
        if(current){current.disabled=false;current.removeAttribute("aria-busy");}
        renderMossOrchestration();
      }
    }

    async function approveMossPracticum(){
      const flow=mossFlow();
      const step=commonweaveLearningStep(flow.activeStepId);
      if(!step||flow.phase!=="awaiting-practicum-approval"||!flow.practicumProposal)return false;
      flow.practicumProposal.status="approved";
      flow.practicumProposal.approvedAt=nowIso();
      step.practicumPlan=deepClone(flow.practicumProposal);
      const record={
        id:flow.practicumProposal.id,
        schoolId:state.school?.id||null,
        moduleId:null,
        title:flow.practicumProposal.title,
        prompt:flow.practicumProposal.purpose,
        artifact:flow.practicumProposal.artifact,
        rubric:deepClone(flow.practicumProposal.rubric||[]),
        steps:deepClone(flow.practicumProposal.steps||[]),
        status:"approved",
        source:"moss-pathway",
        journeyId:commonweaveLearningState()?.activeJourney?.id||"",
        stepId:step.id,
        createdAt:flow.practicumProposal.generatedAt,
        approvedAt:flow.practicumProposal.approvedAt
      };
      const existingIndex=state.academy.practica.findIndex(item=>item.id===record.id);
      if(existingIndex>=0)state.academy.practica[existingIndex]=record;else state.academy.practica.push(record);
      emit("moss.practicum-approved",{journeyId:record.journeyId,stepId:step.id,practicumId:record.id});
      saveState();
      try{
        await prepareMossModuleProposal(step);
        return true;
      }catch(error){
        flow.phase="error";flow.lastError=error.message;saveState();renderMossOrchestration();
        throw error;
      }
    }

    function mossMarkModuleOwnership(module,step,practicum){
      const flow=mossFlow();
      const journey=commonweaveLearningState()?.activeJourney;
      module.id=`moss-${slug(journey?.id||"journey")}-${slug(step.id)}-${stableHash(JSON.stringify({title:module.title,summary:module.summary,at:flow.proposalHistory.length}))}`;
      module.commonweaveStepId=step.id;
      module.generatedBy="moss";
      module.creatorPolicy={fixed:false,owner:"learner",source:"moss"};
      module.practicumPlan=practicum?deepClone(practicum):null;
      module.creativeIntention=journey?.creativeIntention||journey?.intention||"";
      module.provenance=`Moss proposal approved by learner · ${module.provenance||"local curriculum"}`;
      return module;
    }

    function snapshotSchoolVersion(reason){
      if(!state.school)return;
      state.academy.schoolVersions.push({
        id:`version-${Date.now()}-${slug(state.school.id)}`,
        schoolId:state.school.id,
        title:state.school.title,
        reason,
        createdAt:nowIso(),
        school:deepClone(state.school),
        clearedModules:[...state.clearedModules],
        mastery:deepClone(state.mastery)
      });
      state.academy.schoolVersions=state.academy.schoolVersions.slice(-12);
    }

    function approveMossModule(){
      const context=commonweaveLearningState();
      const flow=mossFlow();
      const step=commonweaveLearningStep(flow.activeStepId);
      const proposal=flow.moduleProposal;
      if(!context||!step||flow.phase!=="awaiting-module-approval"||!proposal?.school?.modules?.length)return false;
      const normalizedProposalSchool=finalizeSchool(deepClone(proposal.school),{
        difficulty:proposal.school.difficulty||mossDifficultyForStep(step),
        mode:proposal.school.mode||"practical",
        tone:proposal.school.tone||"punk"
      });
      if(!normalizedProposalSchool?.modules?.length)throw new Error("The generated proposal did not contain an approvable module.");
      const proposedModule=mossMarkModuleOwnership(deepClone(normalizedProposalSchool.modules[0]),step,flow.practicumProposal);
      const journey=context.activeJourney;
      const existingMossSchool=state.school?.commonweaveJourneyId===journey.id&&state.school?.ownership?.source==="moss";
      const replacingId=flow.replacingModuleId||"";
      const replacingModule=(state.school?.modules||[]).find(module=>module.id===replacingId)||null;
      const revisingLearnerSchool=Boolean(replacingModule&&!mossModuleIsFixed(replacingModule));
      if(existingMossSchool||revisingLearnerSchool){
        snapshotSchoolVersion(replacingId?`Moss revision requested for ${step.title}`:`Moss appended ${step.title}`);
        const modules=[...(state.school.modules||[])];
        const existingIndex=modules.findIndex(module=>module.id===replacingId||module.commonweaveStepId===step.id);
        if(existingIndex>=0){
          const previous=modules[existingIndex];
          modules[existingIndex]=proposedModule;
          state.clearedModules=state.clearedModules.filter(id=>id!==previous.id);
          delete state.mastery[previous.id];
        }else modules.push(proposedModule);
        state.school={
          ...state.school,
          modules,
          updatedAt:nowIso(),
          ownership:state.school.ownership||{kind:"learner",source:"local",mutable:true},
          creatorPolicy:state.school.creatorPolicy||{fixed:false,owner:"learner",source:"local"}
        };
      }else{
        snapshotSchoolVersion("Moss opened a learner-owned pathway");
        const journeyTitle=String(journey.title||journey.intention||journey.outcome||step.title||"Learner-owned path");
        state.school={
          id:`moss-path-${slug(journey.id)}`,
          title:`${journeyTitle} · Living Path`,
          subtitle:"Moss-led, learner-approved pathway",
          subject:journeyTitle,
          description:`Learning assembled around the creative intention: ${journey.creativeIntention||journey.intention||journeyTitle}`,
          sourceNote:"Commonweave pathway + learner-approved Moss proposals",
          sourceConfidence:"mixed · inspect proposal provenance",
          difficulty:mossDifficultyForStep(step),
          mode:"practical",
          tone:"punk",
          createdAt:nowIso(),
          updatedAt:nowIso(),
          commonweaveJourneyId:journey.id,
          ownership:{kind:"learner",source:"moss",mutable:true},
          creatorPolicy:{fixed:false,owner:"learner",source:"moss"},
          modules:[proposedModule]
        };
        state.clearedModules=[];
        state.mastery={};
      }
      state.school=finalizeSchool(state.school,{difficulty:state.school.difficulty,mode:state.school.mode,tone:state.school.tone});
      const approvedModule=state.school.modules.find(module=>module.commonweaveStepId===step.id)||state.school.modules.at(-1);
      flow.phase="learning";
      flow.activeModuleId=approvedModule.id;
      flow.replacingModuleId="";
      const approvedAt=nowIso();
      flow.moduleProposal=compactApprovedModuleProposal(proposal,approvedModule,approvedAt);
      context.activeSchoolId=state.school.id;
      context.activeModuleIds=[...new Set([...(context.activeModuleIds||[]),approvedModule.id])];
      context.awaitingGeneration=false;
      step.moduleIds=[approvedModule.id];
      step.moduleApproval={moduleId:approvedModule.id,approvedAt:nowIso(),mutable:true,source:proposal.source||"moss"};
      updateCommonweaveJourneyStep(step.id,"in-progress");
      activeModuleId=approvedModule.id;
      emit("moss.module-approved",{journeyId:journey.id,stepId:step.id,moduleId:approvedModule.id});
      const persisted=saveState();
      postCommonweaveLearningProgress(step,"in-progress",{phase:"module-approved",moduleId:approvedModule.id});
      renderSchool();
      renderMossOrchestration();
      closeSheet("moss-sheet",document.getElementById("ask-moss"));
      setWorkspace("learn");
      openModule(approvedModule.id);
      toast(persisted
        ? `Approved “${approvedModule.title}.” Moss will return when the module is complete.`
        : `Approved “${approvedModule.title}” for this session. Free device storage before closing Living School.`);
      return true;
    }

    function mossAdoptCurrentModuleForRevision(module,request){
      if(!module||!state.school)return null;
      if(mossModuleIsFixed(module))return null;
      ensureMossFlowState();
      const now=nowIso();
      const journeyId=`moss-revision-${slug(state.school.id||"school")}-${slug(module.id||module.title)}-${Date.now()}`;
      const capabilityId=`cap-${slug(module.title||"module")}`;
      const stepId=`learn-${capabilityId}`;
      const objective=String(module.learningContract?.objective||module.objective||module.summary||`Improve ${module.title}.`).slice(0,520);
      const practical=String(module.learningContract?.artifact||module.exercise?.prompt||module.practical||`Create a revised demonstration of ${module.title}.`).slice(0,520);
      const previous=state.commonweave.activeJourney;
      if(previous)state.commonweave.pathHistory.unshift({journey:deepClone(previous),archivedAt:now,reason:"Moss opened a module revision path"});
      state.commonweave.pathHistory=state.commonweave.pathHistory.slice(0,8);
      const journey={
        schema:"commonweave.intention-journey.v1",
        id:journeyId,
        source:"living-school-moss",
        title:`Revise ${module.title}`,
        intention:`Improve the learner-owned module “${module.title}” without changing creator-owned curriculum.`,
        creativeIntention:String(module.creativeIntention||state.school.description||state.school.subject||module.title),
        outcome:`Approve and complete a revised version of “${module.title}” that better serves the learner's goal.`,
        scope:`Revise only this learner-owned module. Preserve the rest of ${state.school.title}.`,
        stage:"prepare",
        mutable:true,
        learnerOwned:true,
        creatorPolicy:{fixed:false,owner:"learner",source:"moss"},
        capabilities:[{id:capabilityId,domain:String(state.school.subject||"Learning"),title:String(module.title),why:objective,requiredLevel:2,currentLevel:1,preparedLevel:null,approach:"learn",assessmentPrompt:`Can the learner demonstrate the revised objective for ${module.title}?`,evidenceHint:practical}],
        learningPath:[{id:stepId,title:String(module.title),outcome:objective,practicum:practical,capabilityIds:[capabilityId],timing:"before-project",status:"in-progress",ownership:"learner",fixedByCreator:false,moduleIds:[module.id]}],
        learningProgress:{status:"in-progress",activeStepId:stepId,completedStepIds:[],lastLivingSchoolId:state.school.id,lastLivingSchoolModuleId:module.id,startedAt:now,updatedAt:now},
        completionCriteria:[`The learner approves the revision to ${module.title}.`,"The revised module is completed and its evidence remains attached to the learner record."],
        workstreams:[],
        governanceQuestions:[],
        assumptions:["The current module and school are learner-owned and mutable."],
        createdAt:now,
        updatedAt:now
      };
      module.commonweaveStepId=stepId;
      state.commonweave.activeJourney=journey;
      state.commonweave.activeStepId=stepId;
      state.commonweave.activeSchoolId=state.school.id;
      state.commonweave.activeModuleIds=[module.id];
      state.commonweave.journeyPurpose="moss-module-revision";
      state.commonweave.mossFlow={...defaultMossFlow(),journeyId,phase:"learning",activeStepId:stepId,activeModuleId:module.id,replacingModuleId:module.id,improvementSkillCount:1,initialImprovementSkillCount:1,skipPracticum:true,updatedAt:now};
      saveState();
      if(window.parent!==window)window.parent.postMessage({type:"commonweave:learning-path-created",service:"living",journeyId,journeySnapshot:deepClone(journey),creativeIntention:journey.creativeIntention,automaticEffect:false},location.origin);
      return {journey,step:journey.learningPath[0],request};
    }

    function mossRequestChange(){
      const request=document.getElementById("moss-change-request")?.value.trim()||document.getElementById("moss-question")?.value.trim()||"";
      const flow=mossFlow();
      let step=commonweaveLearningStep(flow.activeStepId);
      const output=document.getElementById("moss-response");
      if(!request){if(output)output.textContent="Describe the change you want first.";return;}
      if(!step){
        const current=(state.school?.modules||[]).find(module=>module.id===activeModuleId||module.id===state.academy?.selectedModuleId)||state.school?.modules?.[currentLearningIndex()]||null;
        if(mossModuleIsFixed(current)){
          if(output)output.textContent="That module is fixed by another creator. Moss will not rewrite it. Start a learner-owned path or ask for an explanation alongside the original module.";
          return;
        }
        const adopted=mossAdoptCurrentModuleForRevision(current,request);
        if(!adopted){if(output)output.textContent="Moss could not establish a safe learner-owned revision path for this module.";return;}
        step=adopted.step;
      }
      if(!mossJourneyMutable()){
        if(output)output.textContent="This pathway is fixed by its creator. Moss can explain it or start a learner-owned fork, but cannot rewrite the creator's modules.";
        return;
      }
      const activeFlow=mossFlow();
      if(activeFlow.phase==="awaiting-practicum-approval"){
        prepareMossPracticumProposal(step,{revisionNote:request});
      }else if(activeFlow.phase==="awaiting-module-approval"){
        prepareMossModuleProposal(step,{revisionNote:request,replacingModuleId:activeFlow.replacingModuleId});
      }else if(activeFlow.phase==="learning"){
        const module=mossActiveModule();
        if(mossModuleIsFixed(module)){
          if(output)output.textContent="That module is fixed by another creator. Moss will not rewrite it. Start a learner-owned path or ask for an explanation alongside the original module.";
          return;
        }
        prepareMossModuleProposal(step,{revisionNote:request,replacingModuleId:module?.id||""});
      }else{
        if(output)output.textContent="Moss can revise the active practicum or module proposal. Start or resume a pathway first.";
        return;
      }
      if(output)output.textContent="Moss is generating a reviewable revision. Your current module remains unchanged until you approve it.";
    }

    function showCommonweaveLearningCheckpoint(nextStep){
      const flow=mossFlow();
      if(nextStep){
        beginMossLearningStep(nextStep).catch(error=>{flow.phase="error";flow.lastError=error.message;saveState();renderMossOrchestration();});
      }else{
        flow.phase="awaiting-transfer-approval";
        flow.activeStepId="";
        flow.activeModuleId="";
        flow.updatedAt=nowIso();
        saveState();
        renderMossOrchestration();
        openSheet("moss-sheet",document.getElementById("ask-moss"));
      }
    }

    function maybeCompleteCommonweaveLearningStep(module){
      const context=commonweaveLearningState();
      const flow=mossFlow();
      const step=context?commonweaveLearningStep(flow.activeStepId||context.activeStepId):null;
      if(!context||!step||!context.activeSchoolId||context.activeSchoolId!==state.school?.id)return;
      const moduleIds=Array.isArray(step.moduleIds)&&step.moduleIds.length
        ? step.moduleIds
        : [flow.activeModuleId||module?.id].filter(Boolean);
      if(!moduleIds.length||!moduleIds.every(id=>state.clearedModules.includes(id)))return;
      if(step.status==="complete")return;
      updateCommonweaveJourneyStep(step.id,"complete");
      flow.activeModuleId="";
      saveState();
      postCommonweaveLearningProgress(step,"complete",{phase:"completed",moduleId:module?.id||""});
      showCommonweaveLearningCheckpoint(commonweaveNextLearningStep());
    }

    function mossProposalMarkup(){
      const flow=mossFlow();
      const step=commonweaveLearningStep(flow.activeStepId);
      if(flow.phase==="generating-practicum")return '<h4>Moss is drafting the practicum…</h4><p>The current pathway remains unchanged while the proposal is generated.</p>';
      if(flow.phase==="generating-module")return '<h4>Moss is drafting the learning module…</h4><p>The current school remains unchanged while the proposal is generated and validated.</p>';
      if(flow.phase==="awaiting-practicum-approval"&&flow.practicumProposal){
        const p=flow.practicumProposal;
        return `<span class="cover-kicker">Practicum proposal</span><h4>${escapeHTML(p.title)}</h4><p>${escapeHTML(p.purpose)}</p><div class="moss-proposal-meta"><span>${escapeHTML(p.estimatedEffort||"focused practice")}</span><span>${escapeHTML(p.generatedBy||"Moss")}</span></div><p><b>Artifact:</b> ${escapeHTML(p.artifact)}</p><h4>Sequence</h4><ul>${(p.steps||[]).map(item=>`<li>${escapeHTML(item)}</li>`).join("")}</ul><h4>Approval rubric</h4><ul>${(p.rubric||[]).map(item=>`<li>${escapeHTML(item)}</li>`).join("")}</ul>${p.generationNote?`<p class="feedback">${escapeHTML(p.generationNote)}</p>`:""}`;
      }
      if(flow.phase==="awaiting-module-approval"&&flow.moduleProposal?.school){
        const proposal=flow.moduleProposal;const module=proposal.school.modules?.[0]||{};
        const quizCount=(module.quiz||[]).length+(module.blocks||[]).filter(block=>block.type==="quiz").reduce((sum,block)=>sum+(block.questions?.length||0),0);
        return `<span class="cover-kicker">Learning module proposal</span><h4>${escapeHTML(module.title||proposal.school.title)}</h4><p>${escapeHTML(module.summary||proposal.school.description||"")}</p><div class="moss-proposal-meta"><span>${quizCount} knowledge checks</span><span>${escapeHTML(proposal.source||"Moss")}</span><span>${(proposal.warnings||[]).length} validator notes</span></div><p><b>Practical result:</b> ${escapeHTML(flow.practicumProposal?.artifact||step?.practicum||"A project-relevant artifact")}</p>${proposal.generationNote?`<p class="feedback">${escapeHTML(proposal.generationNote)}</p>`:""}<details><summary>Validator and provenance notes</summary><ul>${(proposal.warnings||[]).map(item=>`<li>${escapeHTML(item.text||String(item))}</li>`).join("")||"<li>No structural warnings.</li>"}</ul></details>`;
      }
      if(flow.phase==="learning"){
        const module=mossActiveModule();const fixed=mossModuleIsFixed(module);
        return `<span class="cover-kicker">Approved and active</span><h4>${escapeHTML(module?.title||step?.title||"Current module")}</h4><p>Complete the module's practice and assessment. Moss will then consult the saved pathway and prepare the next proposal.</p><div class="moss-proposal-meta"><span>${fixed?"creator-fixed":"learner-owned"}</span><span>${escapeHTML(step?.timing||"active")}</span></div>${fixed?'<p>This module came from another creator and cannot be rewritten by Moss. Explanations and learner-owned companion paths remain available.</p>':""}`;
      }
      if(flow.phase==="awaiting-transfer-approval"){
        const journey=commonweaveLearningState()?.activeJourney;
        return `<span class="cover-kicker">Pathway complete</span><h4>Return to the creative intention</h4><p>Every required learning category is complete. With your permission, Moss will send the updated capability record and the original intention to Kamiya as a reviewable Cerbanimo project dialogue.</p><p><b>Creative intention:</b> ${escapeHTML(journey?.creativeIntention||journey?.intention||"")}</p>`;
      }
      if(flow.phase==="transferred")return '<h4>Transferred to Kamiya</h4><p>The pathway and creative intention were sent to Commonweave for a reviewable Cerbanimo handoff.</p>';
      if(flow.phase==="error")return `<h4>Moss could not finish that proposal</h4><p>${escapeHTML(flow.lastError||"Unknown proposal error")}</p>`;
      return '<h4>No active pathway</h4><p>Ask Moss to start a learner-owned path or send an assessed intention from Commonweave.</p>';
    }

    function renderMossOrchestration(){
      const desk=document.getElementById("moss-pathway-desk");
      if(!desk)return;
      const context=commonweaveLearningState();
      const flow=mossFlow();
      const journey=context?.activeJourney;
      desk.hidden=!journey;
      if(!journey)return;
      const step=commonweaveLearningStep(flow.activeStepId)||commonweaveNextLearningStep();
      document.getElementById("moss-flow-title").textContent=step?.title||journey.title||"Learning pathway";
      const status=document.getElementById("moss-flow-status");
      const label=flow.phase.replaceAll("-"," ");
      status.textContent=label;
      status.className=`moss-flow-status ${flow.phase.startsWith("generating")?"generating":flow.phase}`;
      document.getElementById("moss-intention-note").innerHTML=`<b>Creative intention</b><br>${escapeHTML(journey.creativeIntention||journey.intention||journey.outcome||"")}`;
      document.getElementById("moss-path-queue").innerHTML=commonweaveLearningSteps().map((item,index)=>`<div class="moss-path-row ${item.id===flow.activeStepId?"current":""} ${item.status==="complete"?"complete":""}"><span>${String(index+1).padStart(2,"0")}</span><b>${escapeHTML(item.title)}</b><span>${item.status==="complete"?"complete":item.id===flow.activeStepId?"current":"planned"}</span></div>`).join("");
      document.getElementById("moss-proposal-preview").innerHTML=mossProposalMarkup();
      const approve=document.getElementById("moss-approve-proposal");
      approve.hidden=!["awaiting-practicum-approval","awaiting-module-approval"].includes(flow.phase);
      approve.disabled=mossApprovalInFlight;
      approve.textContent=mossApprovalInFlight
        ? (flow.phase==="awaiting-practicum-approval"?"Approving practicum…":"Approving module…")
        : (flow.phase==="awaiting-practicum-approval"?"Approve practicum":"Approve learning module");
      const revise=document.getElementById("moss-request-change");
      revise.hidden=!["awaiting-practicum-approval","awaiting-module-approval","learning"].includes(flow.phase);
      revise.disabled=!mossJourneyMutable();
      const changeBox=document.getElementById("moss-change-box");
      changeBox.hidden=revise.hidden;
      const openCurrent=document.getElementById("moss-open-current-module");
      openCurrent.hidden=flow.phase!=="learning"||!mossActiveModule();
      const transfer=document.getElementById("moss-continue-cerbanimo");
      transfer.hidden=flow.phase!=="awaiting-transfer-approval";
      document.getElementById("moss-defer-proposal").hidden=["idle","transferred"].includes(flow.phase);
      renderCommonweavePathwayBanner();
    }

    function prefillCommonweaveLearningStep(stepId,{announce=true}={}){
      const step=commonweaveLearningStep(stepId)||commonweaveNextLearningStep();
      if(!step)return false;
      beginMossLearningStep(step).catch(error=>{const flow=mossFlow();flow.phase="error";flow.lastError=error.message;saveState();renderMossOrchestration();});
      if(announce)toast(`Moss is preparing a reviewable proposal for ${step.title}.`);
      return true;
    }

    function bindCommonweaveGeneratedSchool(){
      const context=commonweaveLearningState();
      const step=context?commonweaveLearningStep(mossFlow().activeStepId):null;
      if(context&&step&&state.school?.id)postCommonweaveLearningProgress(step,"in-progress",{phase:"generated-manually",schoolId:state.school.id});
    }

    function mossLocalPathFallback(request){
      const text=String(request||"").trim().slice(0,1200);
      const title=titleCase(text.replace(/^\s*(i want to|help me|teach me|learn|start a learning path(?: about| for)?)/i,"").trim()||text).slice(0,120);
      const id=`moss-path-${Date.now()}-${slug(title)}`;
      const capabilityId=`cap-${slug(title)}`;
      const now=nowIso();
      return {
        schema:"commonweave.intention-journey.v1",
        id,
        intention:text,
        creativeIntention:text,
        title,
        projectType:"learner-owned learning path",
        outcome:`Become able to apply ${title.toLowerCase()} in a real artifact or decision.`,
        scope:"A focused first pathway containing only the knowledge and practice needed for one meaningful application.",
        timeframe:"Not yet specified",
        teamMode:"solo",
        completionCriteria:[`Complete the approved ${title} module.`,`Produce and review the pathway practicum.`,`Explain what changed and where the skill will be applied next.`],
        capabilities:[{id:capabilityId,domain:"Other",title,why:`The learner explicitly asked to build practical capability in ${title.toLowerCase()}.`,requiredLevel:2,currentLevel:null,preparedLevel:null,approach:"learn",assessmentPrompt:`Can you complete a representative ${title.toLowerCase()} task and explain your decisions?`,evidenceHint:`A small, reviewed ${title.toLowerCase()} artifact.`}],
        learningPath:[{id:`learn-${capabilityId}`,title,outcome:`Reach supported practical readiness in ${title.toLowerCase()}.`,practicum:`A small, reviewed ${title.toLowerCase()} artifact.`,capabilityIds:[capabilityId],timing:"before-project",status:"planned",ownership:"learner",fixedByCreator:false}],
        learningProgress:{status:"not-started",activeStepId:`learn-${capabilityId}`,completedStepIds:[],updatedAt:now},
        workstreams:[{id:"apply-learning",title:"Apply the learning",outcome:`Use ${title.toLowerCase()} in a real intention.`,tasks:["Define the intended application","Complete the practicum","Review the evidence","Carry the result into Cerbanimo or the next learning step"],proof:"An approved practicum and completed module record."}],
        governanceQuestions:[],
        stage:"prepare",
        source:"living-school-moss",
        mutable:true,
        learnerOwned:true,
        createdAt:now,
        updatedAt:now
      };
    }

    function normalizeMossLocalPath(payload,request){
      const fallback=mossLocalPathFallback(request);
      if(!payload||typeof payload!=="object")return fallback;
      const rawCaps=Array.isArray(payload.capabilities)?payload.capabilities.slice(0,6):[];
      const capabilities=rawCaps.map((item,index)=>{
        const title=String(item?.title||"").trim().slice(0,120);if(!title)return null;
        const id=`cap-${slug(item.id||title||index)}`;
        const required=Math.max(1,Math.min(4,Number(item.requiredLevel||2)));
        return {id,domain:String(item.domain||"Other").slice(0,60),title,why:String(item.why||`This capability supports the requested learning outcome.`).slice(0,360),requiredLevel:required,currentLevel:null,preparedLevel:null,approach:["learn","practice"].includes(item.approach)?item.approach:"learn",assessmentPrompt:String(item.assessmentPrompt||`Can you demonstrate ${title.toLowerCase()} in a representative task?`).slice(0,320),evidenceHint:String(item.evidenceHint||`A small reviewed demonstration of ${title.toLowerCase()}.`).slice(0,260)};
      }).filter(Boolean);
      if(!capabilities.length)return fallback;
      const now=nowIso();
      const learningPath=capabilities.map((item,index)=>({id:`learn-${item.id}`,title:item.approach==="practice"?`Field practice · ${item.title}`:item.title,outcome:`Reach level ${item.requiredLevel} readiness for ${item.title.toLowerCase()}.`,practicum:item.evidenceHint,capabilityIds:[item.id],timing:index<2?"before-project":"during-project",status:"planned",ownership:"learner",fixedByCreator:false}));
      return {...fallback,title:String(payload.title||fallback.title).slice(0,120),outcome:String(payload.outcome||fallback.outcome).slice(0,520),scope:String(payload.scope||fallback.scope).slice(0,520),capabilities,learningPath,learningProgress:{status:"not-started",activeStepId:learningPath[0]?.id||null,completedStepIds:[],updatedAt:now},updatedAt:now};
    }

    async function mossCreateLocalPath(request){
      const output=document.getElementById("moss-response");
      if(!String(request||"").trim()){if(output)output.textContent="Describe what you want to become able to do.";return;}
      if(output)output.textContent="Moss is mapping the smallest useful learner-owned path…";
      const fallback=mossLocalPathFallback(request);
      const config=modelConfigFromUI();
      let journey=fallback;
      if(!["deterministic","manual"].includes(config.provider)&&!modelRouteConfigurationIssue(config)){
        try{
          const text=await invokeLanguageModel([
            {role:"system",content:'You are Moss. Return JSON only with title, outcome, scope, and capabilities. Each capability must have title, domain, why, requiredLevel from 1 to 4, approach learn or practice, assessmentPrompt, and evidenceHint. Create 1 to 6 capabilities and only those needed for the learner request. Do not claim current competency.'},
            {role:"user",content:String(request).slice(0,1200)}
          ],config);
          journey=normalizeMossLocalPath(parseModelJSON(text),request);
        }catch(error){journey={...fallback,sourceDetail:`Local fallback used because the selected model could not map the path: ${error.message}`};}
      }
      ensureMossFlowState();
      const previous=state.commonweave.activeJourney;
      if(previous)state.commonweave.pathHistory.unshift({journey:deepClone(previous),archivedAt:nowIso()});
      state.commonweave.pathHistory=state.commonweave.pathHistory.slice(0,8);
      state.commonweave.activeJourney=journey;
      state.commonweave.activeStepId=journey.learningPath[0]?.id||null;
      state.commonweave.activeSchoolId=null;
      state.commonweave.activeModuleIds=[];
      state.commonweave.mossFlow={...defaultMossFlow(),improvementSkillCount:journey.capabilities.length,initialImprovementSkillCount:journey.capabilities.length};
      saveState();
      if(window.parent!==window)window.parent.postMessage({type:"commonweave:learning-path-created",service:"living",journeyId:journey.id,journeySnapshot:deepClone(journey),creativeIntention:journey.creativeIntention||journey.intention,automaticEffect:false},location.origin);
      if(output)output.textContent=`Mapped “${journey.title}” with ${journey.capabilities.length} improvement skill${journey.capabilities.length===1?"":"s"}. Moss is preparing the first approval.`;
      await beginMossLearningStep(journey.learningPath[0]);
    }

    function mossContinueToCerbanimo(){
      const context=commonweaveLearningState();
      if(!context||mossFlow().phase!=="awaiting-transfer-approval")return;
      const journey=context.activeJourney;
      mossFlow().phase="transferred";
      mossFlow().updatedAt=nowIso();
      saveState();
      renderMossOrchestration();
      if(window.parent!==window){
        window.parent.postMessage({
          type:"commonweave:learning-transfer-request",
          service:"living",
          journeyId:String(journey.id||""),
          stepId:String(journey.learningPath?.at(-1)?.id||""),
          stepTitle:"Learning pathway",
          status:"complete",
          creativeIntention:String(journey.creativeIntention||journey.intention||""),
          pathwaySummary:(journey.learningPath||[]).map(step=>({id:step.id,title:step.title,status:step.status,moduleIds:step.moduleIds||[],practicumPlan:step.practicumPlan||null})),
          journeySnapshot:deepClone(journey),
          automaticEffect:false
        },location.origin);
      }else{
        document.getElementById("moss-response").textContent="The pathway is complete. Open Commonweave to transfer the creative intention and updated capability record into Kamiya's Cerbanimo project dialogue.";
      }
    }

    async function commonweaveAiIntention(message={}){
      const requestId=String(message.requestId||crypto.randomUUID());
      const prompt=String(message.prompt||message.value||"").trim().slice(0,12000);
      const journey=message.journey&&message.journey.schema==="commonweave.intention-journey.v1"?deepClone(message.journey):null;
      const alreadyPersisted=Boolean(requestId&&state.commonweave?.lastRoutedRequestId===requestId&&(!journey||String(state.commonweave?.activeJourney?.id||"")===String(journey.id||"")));
      if(commonweaveIntentRequests.has(requestId)||alreadyPersisted){
        commonweaveIntentRequests.add(requestId);
        renderMossOrchestration();
        openSheet("moss-sheet",document.getElementById("ask-moss"));
        if(window.parent!==window)window.parent.postMessage({type:"commonweave:ai-intention-receipt",service:"living",requestId,status:"accepted",detail:"Moss already saved this pathway and reopened its approval desk."},location.origin);
        return;
      }
      commonweaveIntentRequests.add(requestId);
      const sharedModelKey=message.modelSettings?.sharedForThisSession?String(message.modelSettings.apiKey||"").slice(0,500):"";
      if(sharedModelKey){const modelKeyInput=document.getElementById("model-api-key");if(modelKeyInput)modelKeyInput.value=sharedModelKey;}
      if(journey){
        const completed=new Set(journey.learningProgress?.completedStepIds||[]);
        journey.learningPath=(journey.learningPath||[]).map(step=>({...step,status:completed.has(step.id)?"complete":step.status||"planned",ownership:step.ownership||"learner",fixedByCreator:Boolean(step.fixedByCreator)}));
        journey.mutable=journey.mutable!==false;
        journey.creativeIntention=journey.creativeIntention||message.orchestration?.creativeIntention||journey.intention;
        const assessedImprovementSkillCount=Math.max(0,Number(message.orchestration?.improvementSkillCount??mossImprovementCapabilities(journey).length));
        state.commonweave={...(state.commonweave||{}),activeJourney:journey,journeyPurpose:String(message.purpose||"moss-orchestrated-pathway"),journeyReceivedAt:nowIso(),lastRoutedRequestId:requestId,activeStepId:journey.learningProgress?.activeStepId||null,activeSchoolId:journey.learningProgress?.lastLivingSchoolId||null,activeModuleIds:[],mossOrchestration:{schema:"commonweave-moss-orchestration-1.0",improvementSkillCount:assessedImprovementSkillCount,skipInitialPracticum:Boolean(message.orchestration?.skipInitialPracticum??assessedImprovementSkillCount<=1),creativeIntention:journey.creativeIntention}};
        state.commonweave.mossFlow={...defaultMossFlow(),improvementSkillCount:assessedImprovementSkillCount,initialImprovementSkillCount:assessedImprovementSkillCount};
      }
      if(window.parent!==window)window.parent.postMessage({type:"commonweave:ai-intention-receipt",service:"living",requestId,status:"accepted",detail:journey?"Moss saved the pathway, required skill levels, and creative intention. It is preparing the first reviewable approval.":"Moss accepted the intention and opened its pathway desk."},location.origin);
      try{
        if(journey){
          const next=commonweaveNextLearningStep();
          if(next)await beginMossLearningStep(next);
          else showCommonweaveLearningCheckpoint(null);
        }else{
          await mossCreateLocalPath(prompt);
        }
        saveState();
        renderMossOrchestration();
        openSheet("moss-sheet",document.getElementById("ask-moss"));
        if(window.parent!==window)window.parent.postMessage({type:"commonweave:ai-intention-receipt",service:"living",requestId,status:"delivered",detail:journey?(mossFlow().skipPracticum?"Moss generated a focused learning-module proposal and is waiting for learner approval.":"Moss generated a project-relevant practicum proposal and is waiting for learner approval."):"Moss mapped a learner-owned path and opened its first approval."},location.origin);
      }catch(error){
        mossFlow().phase="error";mossFlow().lastError=error.message;saveState();renderMossOrchestration();
        if(window.parent!==window)window.parent.postMessage({type:"commonweave:ai-intention-receipt",service:"living",requestId,status:"failed",detail:`Moss kept the pathway, but could not prepare the next proposal: ${error.message}`},location.origin);
      }
    }


    window.__COMMONWEAVE_LIVING__={
      getState:()=>deepClone(state),
      applyContext:applyCommonweaveContext,
      createCapstone:commonweaveCapstone,
      processCerbanimoResult:processResult,
      receiveAiIntention:commonweaveAiIntention,
      approveCurrentProposal:approveCurrentMossProposal
    };

    function receiveCommonweaveNavigation(message){
      if(String(message.contractVersion||"")!=="commonweave.navigation.v1"||String(message.sourceApplication||"")!=="commonweave")return;
      const object=String(message.object||""),id=String(message.id||"").slice(0,200),actionId=String(message.actionId||"").slice(0,200);
      let opened=false,detail="Living School could not resolve that learning object.";
      if(object==="school"&&String(state.school?.id||"")===id){setWorkspace("learn");opened=true;detail=`Opened ${state.school.title||"the requested school"}.`;}
      else if(object==="module"&&(state.school?.modules||[]).some(module=>String(module.id)===id)){openModule(id);opened=true;detail="Opened the requested learning module.";}
      else if(object==="final-test"){
        const schoolMatches=!state.school?.id||id===String(state.school.id)||id===String(state.academy?.finalProject?.projectRef||"")||id==="final-test";
        if(schoolMatches){setWorkspace("learn",{focusId:"final-test-panel"});document.getElementById("final-test-panel")?.scrollIntoView({block:"start"});opened=true;detail="Opened the final competency test.";}
      }
      if(window.parent!==window)window.parent.postMessage({type:"commonweave:navigation-receipt",contractVersion:"commonweave.navigation.v1",sourceApplication:"living",actionId,status:opened?"opened":"unavailable",detail},location.origin);
    }

    window.addEventListener("message",event=>{
      if(event.origin!==location.origin||event.source!==window.parent||!event.data)return;
      if(event.data.type==="commonweave:context")applyCommonweaveContext(event.data);
      if(event.data.type==="commonweave:navigate-object")receiveCommonweaveNavigation(event.data);
      if(event.data.type==="commonweave:request-capstone")commonweaveCapstone();
      if(event.data.type==="commonweave:intention"){
        const subject=document.getElementById("school-subject");
        if(subject&&!subject.value.trim())subject.value=String(event.data.value||"");
        setWorkspace("studio",{focusId:"school-builder"});
      }
      if(event.data.type==="commonweave:ai-intention")commonweaveAiIntention(event.data);
      if(event.data.type==="commonweave:validation-result")processResult(event.data.payload);
      if(["commonweave:project-handoff-accepted","commonweave:project-handoff-rejected","commonweave:project-created","commonweave:project-linked","commonweave:project-status-returned","commonweave:project-evidence-submitted","commonweave:project-review-pending","commonweave:project-revision-requested","commonweave:project-accepted","commonweave:project-rejected","commonweave:project-unavailable","commonweave:project-integration-error","commonweave:cerbanimo-project-status"].includes(event.data.type))applyCerbanimoProjectStatus(event.data.payload||event.data);
    });

    ensureCommerceState();
    ensureConstellationState();
    initializeModelState();
    if(!state.school) state.school=generateSchool(defaultKnowledge.subject,"",6,"intermediate","balanced","punk");
    ensureAcademyState();
    applyAppearanceMode(state.academy.appearanceMode,{persist:false});
    bind();
    bindLivingVisual();
    document.getElementById("research-subject").value=document.getElementById("school-subject")?.value||"";
    document.getElementById("research-curriculum").addEventListener("click",runMossResearch);
    document.getElementById("research-build-school").addEventListener("click",()=>buildSchoolFromResearch().catch(error=>toast(`Build failed: ${error.message}`)));
    document.getElementById("apply-research-media").addEventListener("click",applyMossResearchMedia);
    document.getElementById("clear-research").addEventListener("click",clearMossResearch);
    document.getElementById("commonweave-learning-later").addEventListener("click",()=>document.getElementById("commonweave-learning-overlay").hidden=true);
    document.getElementById("commonweave-learning-next").addEventListener("click",event=>{
      const stepId=event.currentTarget.dataset.stepId;
      document.getElementById("commonweave-learning-overlay").hidden=true;
      if(stepId)prefillCommonweaveLearningStep(stepId);
    });
    document.getElementById("commonweave-learning-cerbanimo").addEventListener("click",()=>{
      document.getElementById("commonweave-learning-overlay").hidden=true;
      mossContinueToCerbanimo();
    });
    document.getElementById("commonweave-learning-overlay").addEventListener("click",event=>{
      if(event.target===event.currentTarget)event.currentTarget.hidden=true;
    });
    hydrateModelSettingsUI();
    hydrateCommerceSettingsUI();
    updateSourceGenerationWarning();
    activeModuleId=state.school.modules[0]?.id||null;
    migrateLegacyXpToCanonical();
    renderSchool();
    navigateFromHash();
    claimCheckoutReturn().catch(error=>console.error(error));
    if(!state.commerce.onboarding.completed){
      setTimeout(openOnboarding,220);
    }
    window.addEventListener("storage",event=>{if(["living-school.reward-ledger.v1.1","living-school.reward-ledger.v1"].includes(event.key)){renderPassport();renderSchool();}});

    if(window.parent!==window)window.parent.postMessage({
      type:"commonweave:ready",
      service:"living",
      version:"22.0",
      capabilities:["capstone-export","evidence-import","skill-gap","suite-model","suite-wallet","ai-intention","intention-journey-v1","project-preparation-pathway","moss-orchestrated-learning","practicum-approval","module-approval","learner-owned-paths","creator-module-locks","sequenced-learning-handoff","learning-progress-receipts","cerbanimo-project-contract-v1","acknowledged-project-handoff","project-status-refresh","project-receipts","receipt-revisions","event-driven-project-status","evidence-bound-acceptance","object-navigation-v1","curriculum-research-v1","referenced-curriculum-data","youtube-lesson-media","frictionless-intelligence","hosted-research-default","source-quality-controls","curriculum-pack-v1","showcase-school","canonical-skill-xp-v1.1","automatic-validation"]
    },location.origin);
    if("serviceWorker" in navigator&&/^https?:$/.test(location.protocol)){
      window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js",{scope:"./"}).catch(error=>console.warn("Living School service worker unavailable",error)));
    }
  })();
  