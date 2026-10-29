# Guide review sprite generation record — October 28, 2026

Generated with the built-in `image_gen.imagegen` tool in transparent-background mode. No CLI fallback and no raster editing outside the image-generation tool were used. The final PNGs were copied byte-for-byte into the repository. This record documents assets and prompts; it does not confer review, reward, Quest or Guild authority.

## Final assets

All four are 1536 × 1024 RGBA PNGs: three columns and two rows, six square 512px cells. Cell order is ready, brace, cast; leap, victory, constructive retry. The existing Kamiya sheet supplies the illustration finish; official guide atlases supply identity. Kamiya and Lari are unchanged. Existing guide atlases remain active references for other avatar surfaces; these assets replace their use in the shared outcome presenter.

Alpha inspection found transparent pixel values of zero and a maximum alpha of 254. Every cell contains one complete separated silhouette. The visible alpha >127 bounds listed below use cell-local coordinates and exclusive right/bottom edges. The minimum visible cell padding is 57px (Rook leap right edge), so the generation's requested 60px target was not met by exactly 3px in that one edge; no silhouette touches or crosses a cell boundary. No cropping or rescaling was applied outside imagegen. Displayed generation previews may show RGB colour under fully transparent pixels; the PNG alpha is authoritative.

| Guide | Workspace asset | SHA-256 | Fully transparent pixels |
| --- | --- | --- | --- |
| Weaveling | `public/app/assets/ai/weaveling-review-sprites-v1.png` | `ef8e17fd8fc719b8ce230350bb098edcddbc335c86c9577e68f8b162d87a1c0b` | 1138113 |
| Moss | `public/app/assets/ai/moss-review-sprites-v1.png` | `c2a5b8f226faf80b677136675c97c8d924fd18d2ba161200b87a9ed33490ac2f` | 1194584 |
| Rook | `public/app/assets/ai/rook-review-sprites-v1.png` | `cc31505c8ec51897cdc26843430434b83ea2d24ef763525d420699907ff7b167` | 1127337 |
| Merlin | `public/app/assets/ai/merlin-review-sprites-v1.png` | `bff30b328d66d2614ea61c76bf7661b2eb7a525c620287492d751ae45161819f` | 1158393 |

## References and identity checks

- `public/app/assets/ai/kamiya-review-sprites-v1.png`: crisp, detailed chibi RPG illustration style and six-pose layout, without borrowing fox anatomy.
- `public/Civweave-weaveling-sprites.png`: charcoal humanoid face and hands, amber eyes, colourful braided yarn hood and cloak, star clasp and satchel. The first draft accidentally inherited a fox tail; a targeted imagegen correction removed it before final layout generation.
- `public/Living-School-moss-sprites.png`: brown owl, cream facial discs, green leaf cloak, turquoise clasp, satchel and small smiling acorn companion. Companion appears in all six final cells.
- `public/FellowFare-rook-sprites.png`: charcoal crow, warm eyes, blue scarf, gold button token, brass compass and trade pouches.
- `public/Anarchadia-merlin-sprites.png`: brass clockwork robot, cyan lens eyes, compass-rose chest, purple star hat and cape.

All references and final outputs were inspected visually. First generation layouts were rejected for insufficient spacing; Rook touched a cell boundary. A targeted imagegen layout pass produced the final separated cells.

## Alpha bounds

- Weaveling: `[[121,137,404,406],[78,138,419,407],[78,148,426,405],[106,109,431,402],[99,96,412,402],[106,106,390,400]]`.
- Moss: `[[126,127,390,424],[94,128,418,424],[83,129,408,424],[106,91,412,369],[98,88,397,395],[114,104,390,393]]`.
- Rook: `[[102,152,426,421],[94,152,424,419],[60,139,435,421],[80,99,455,389],[95,82,425,411],[87,114,407,411]]`.
- Merlin: `[[100,129,414,425],[92,139,419,425],[71,139,447,426],[99,98,433,395],[104,103,417,405],[109,113,402,406]]`.

## Complete final prompt set

The reference files are identity/style inputs only. Prompts use the built-in referenced-image workflow after viewing those local references. The common layout-correction prompt was applied to each guide's generated atlas, preserving its corrected identity.

### Weaveling

Use case: identity-preserve. Edit this six-pose Weaveling sprite atlas. Preserve its polished illustration style, six expressions, yarn hood and cloak, skin, eyes, satchel, and exact 3-column 2-row 1536x1024 layout. Critical identity correction: Weaveling is a small humanoid yarn guardian and has NO FOX TAIL, NO FUR TAIL and no animal ears. Remove the orange white fox tails from top middle, top right and bottom left, replacing only with the natural fall of the multicoloured yarn cloak, consistent with identity reference image 2. Critical usable atlas correction: shrink and recenter each complete sprite and spell as one group in its own 512x512 cell, so every painted pixel stays inside the central 392x392 area (60px empty transparent margin on all four edges). Top left ready, top middle brace, top right cast, bottom left leap, bottom middle victory, bottom right constructive thoughtful retry. No texture, background, shadow plate, labels or grid. Genuinely transparent RGBA outside the sprites and tiny spell. Keep complete feet and yarn within each cell. Do not add anything else.

Final generated source basename: `exec-48d1ef21-7e69-4af3-a25f-aab6417903ef.png`.

### Moss

Use case: stylized-concept. Create a fresh six-pose Moss RPG mascot atlas. Image 1 Kamiya is illustration STYLE and 3x2 LAYOUT reference only: match crisp detailed polished chibi game art, expressive face, full body, lighting and texture quality; do not draw the fox or add its anatomy. Image 2 is Moss IDENTITY reference: warm brown owl with feather tufts, huge dark brown eyes and cream facial discs, green leaf-patterned cloak, turquoise gold clasp, little brown side satchel and a tiny smiling acorn companion with a seedling sprout and acorn-cap head. Keep the companion safe and visible in every pose. Moss has bird wings and talons, no humanoid hands and no fox tail or fur. Output 1536x1024 transparent RGBA, 3 columns 2 rows, six equal 512x512 square cells. All painted pixels including spell must stay inside each cell's central 392x392 area leaving at least 60px absolutely empty transparent margins on every side. Consistent scale. Top left friendly ready stance holding acorn; top middle steady defensive brace facing right, wing protective around acorn; top right casting small green leaf spark with one wing, companion held in other; bottom left small energetic leap toward right with companion; bottom middle joyful victory wing raised; bottom right thoughtful encouraging retry with head tilted, companion safe, never sad. One complete owl and one tiny companion per cell. No labels, borders, grid, backdrop, shadow plates, rectangular glow, text or watermarks.

Final generated source basename: `exec-6ff0eaf8-f288-44fa-b6bf-f36955aca891.png`.

### Rook

Use case: stylized-concept. Create a fresh six-pose Rook RPG mascot atlas. Reference 1 Kamiya sets polished crisp richly detailed chibi RPG illustration style and six-pose 3x2 layout only. Do not draw the fox or borrow its ears, paws or tail. Reference 2 sets exact Rook identity: charming black charcoal crow, large glossy warm dark eyes, black beak, dark feathered body and bird feet, blue scarf-cloak patterned with small gold stitching, brass brooch and little compass medallion, golden utility belt and brown trade pouches, round gold four-hole BUTTON token. Keep Rook recognisably the same crow in all poses, button token retained. No readable name badge needed and no text. Output exactly1536x1024 transparent RGBA 3 columns 2 rows with six512x512 cells. Character and tiny effects fully inside central392x392 area of each cell leaving60px entirely clear alpha margins on all sides. Consistent scale and facing toward right. Top left friendly ready holding button; top middle confident defensive wing brace; top right casting a small amber button sparkle from one wing; bottom left energetic little rightward leap; bottom middle joyful victory holding button high; bottom right thoughtful constructive retry with wing at chin, never defeated. One complete crow per cell, full feet and scarf contained. No fox tail, backdrop, floor shadow plates, grid, labels, rectangular haze or watermark.

Final generated source basename: `exec-693d6e5b-61d4-4c0d-9c32-e7f68b2daacb.png`.

### Merlin

Use case: stylized-concept. Create a fresh six-pose Merlin RPG mascot atlas. Reference1 Kamiya is only STYLE and 3x2 LAYOUT reference: polished crisp richly detailed friendly chibi RPG illustration, consistent finish and lighting. Never copy its fox anatomy, clothing or tail. Reference2 gives Merlin's actual identity: small round brass clockwork robot, huge luminous cyan blue lens eyes, articulated brass arms and short brass legs, large teal-and-gold eight-point compass rose chest, purple wizard hat and cape patterned with gold stars, cyan jewel hat band, small mechanical fittings. Keep Merlin clearly a brass compass robot in every cell. Output1536x1024 transparent RGBA, 3columns2rows six equal512px square cells. Every sprite including magic fits inside central392x392 area leaving60px completely empty alpha padding all four sides of each cell. Consistent full-body scale, oriented slightly right. Top left friendly ready stance; top middle steady defensive brace raising brass hand; top right casting a small cyan purple compass-star spark toward right; bottom left lively rightward small leap; bottom middle delighted victory arms up; bottom right thoughtful encouraging revision pose one finger at chin, never sad or humiliated. One complete robot per cell. Hat, feet, cape and spell not cropped. No fox, tail, labels, text, grid, background, floor shadow plates, rectangular glow or watermark.

Final generated source basename: `exec-a94cea46-78c6-4883-9a79-c4494adbb1fd.png`.

### Common final layout correction

Use case: precise-object-edit. Layout correction only to the supplied transparent six-pose sprite atlas. Keep the exact character identity, artwork style, materials, colours, six expressions and six poses unchanged. Keep canvas 1536x1024 and exact THREE COLUMNS by TWO ROWS of equal512x512cells. Current sprites are too large. SHRINK EACH ENTIRE SPRITE AND ITS EFFECT TO 65 PERCENT OF ITS CURRENT SIZE, centered separately within its own cell. Whole silhouette must fit within x=90..422 and y=90..422 relative to its own cell. This means generous entirely transparent space between sprites: at least180px transparent gap between neighbours, and at least90px clear transparent border at outer canvas edges. Top row centers(256,256),(768,256),(1280,256); bottom row centers(256,768),(768,768),(1280,768). No painted pixel may cross any cell boundary. No backdrop, shadow, haze, grid, label, additional object or new character. Do not add fox anatomy. Preserve true RGBA transparency outside each smaller sprite. This asset will be sliced into six equal square tiles, so clean empty margins are essential.

## Integration acceptance

The canonical shared outcome presenter selects these six pose coordinates: ready `0% 0%`, brace `50% 0%`, cast `100% 0%`, leap `0% 100%`, victory `50% 100%`, retry `100% 100%`; background size `300% 200%` and square aspect ratio. The four new padded atlases use 180px presentation boxes; Kamiya retains its existing 144px box, and Lari is unchanged. Text receipts, reduced motion, Lud mode, one-time playback and optional sound retain their existing behavior.

The strengthened atlas contracts first failed against the old guide references, then passed 25/25 focused presenter/Cerbanimo tests after implementation. An additional 34/34 lifecycle, canonical reward-notification and Weaveling outcome tests passed. Git diff whitespace verification passed for this bundle. Deployment pins, cache metadata and live browser verification remain coordinated by the integration task. This document does not claim a new real-model review or live browser completion.

