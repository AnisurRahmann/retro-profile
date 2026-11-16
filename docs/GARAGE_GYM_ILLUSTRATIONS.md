# Garage Gym: illustration prompts and animation spec

Home page concept: one illustrated garage gym. Every object is a section entry point. Style: flat vector, bold outline. All text on the site stays live HTML, so no image may contain text.

Drop finished files in `assets/illustrations/raw/` using the file names below.

---

## 1. Why the prompts are shaped this way

Gemini returns flat raster PNGs with no alpha channel and no layers. To animate them, each moving part has to exist as its own shape. So:

1. **Magenta key background.** Every asset sits on flat `#FF00FF`. The iron outline separates fill from background, so the key leaves no colour fringe.
2. **Parts sheets, not finished scenes.** One generation per object, drawn exploded: parts apart, nothing touching, hidden areas drawn complete. Sliced by connected components after keying.
3. **Orthographic front elevation only.** Objects generated in separate runs only compose into one room if none of them carries perspective.
4. **Locked 8-colour palette.** After keying, each part is traced to SVG and its fills are snapped to the palette, then mapped to CSS variables. That gives a lights-off theme for free and keeps the full set of illustrations small.
5. **No text in images.** Whiteboard numbers, calendar dates, laptop code and the timer are rendered as HTML on top of blank surfaces.

## 2. Gemini workflow

- Use one chat thread for the whole set, highest quality image model available, one image per request.
- Message 1: paste the STYLE LOCK plus prompt A00. Regenerate until the anchor is right. Everything inherits from it.
- Every later message: attach the accepted A00 image, then paste the asset prompt.
- If you start a new chat: paste STYLE LOCK again and attach A00.
- For A01, also attach a photo of yourself so the character reads as you.

Reject and regenerate when any of these is true:
- Background is not one flat magenta (gradient, floor line, ground shadow, vignette).
- Any text, digit, logo or brand mark appears.
- Two parts touch or overlap.
- Outline weight differs visibly from A00, or the view has perspective.
- A colour outside the palette dominates a part.

Small palette drift is fine. It gets snapped during tracing.

## 3. STYLE LOCK (paste once per chat)

```
LOCKED STYLE for every image in this chat. Do not deviate.

- Flat vector illustration with a sticker feel. Thick uniform outline in near-black #17181A, identical weight on every object, rounded joins and corners. Every shape is fully closed by its outline.
- Flat solid fills only. At most one flat, hard-edged darker tone per colour for shading. No gradients, textures, grain, glow, blur, soft shadows, drop shadows or glossy highlights.
- Palette, only these colours: chalk white #F4F1EA, iron black #17181A, concrete grey #B9B4A8, plywood tan #C89B6D, plate red #D62828, plate blue #1D4E89, plate yellow #F2B705, plate green #2A9D5C. Skin, when a person appears: warm brown #B9794F.
- View: straight-on orthographic front elevation. Side elevation for vehicles. No perspective, no three-quarter angle, no tilt, no foreshortening.
- No text, letters, numbers, logos or brand marks anywhere. Screens, boards, pages, labels and dials stay blank.
- Background: one flat solid magenta #FF00FF filling the canvas edge to edge. No floor, ground shadow or vignette. Magenta never appears inside an object.
- Parts sheets: each part is drawn complete, including areas normally hidden behind another part, upright, and separated from every other part by a wide clear magenta gap. Nothing overlaps or touches. No labels, arrows or callouts.
- Output one PNG at the largest available size.
```

## 4. Asset prompts

### A00. Style anchor, the whole room
File: `a00-anchor-room.png`. Reference only, plus a candidate for the social preview image. This is the single asset that has a real background.

```
Using the LOCKED STYLE, but with a real background instead of magenta for this one image only.

A wide 16:9 front elevation of a small garage gym that doubles as a software workshop. Back wall in chalk white with a concrete grey lower band, floor in concrete grey with a plywood tan lifting platform in the centre.

Left to right: a wall-mounted retro telephone; a desk with an open laptop, a desk microphone on a short arm, a mug, and a small friendly box-shaped robot sitting on the desk; a large blank whiteboard on the wall above the desk; in the centre, a black steel power rack holding a barbell loaded with one red, one blue, one yellow and one green plate per side; a man in a black t-shirt and grey joggers standing beside the rack with chalked hands; a wooden stool with a chalk bowl and an open blank logbook; a blank tear-off wall calendar; two kettlebells and a gym bag on the floor; a metal bin holding a bent barbell and crumpled paper; on the far right a bike leaning on its stand. A single pendant lamp with a pull cord hangs from the ceiling. A pegboard with a few hand tools sits high on the right wall.

Calm, tidy, generous empty wall space between objects. No text anywhere.
```

### A01. Character parts sheet (you)
File: `a01-character-sheet.png`. Attach A00 and a photo of yourself.

```
Same locked style and outline weight as the attached room image. The man is based on the attached photo: keep his hair, facial hair, face shape and build, simplified into the flat style. Black t-shirt, grey joggers, flat black lifting shoes, a little chalk white on both palms.

Square canvas, magenta background. A puppet parts sheet in front view, neutral standing pose, parts laid out exploded with wide gaps:
- head with neck, neutral friendly expression, eyes open
- a second head, identical but eyes closed in a blink
- a third head, identical but smiling with mouth open
- torso with hips, shoulder sockets drawn as complete rounded shapes
- left upper arm, left forearm, left hand open with palm facing forward
- right upper arm, right forearm, right hand open with palm facing forward
- one extra hand closed as a fist gripping, one extra hand giving a thumbs up
- left thigh, left shin with shoe
- right thigh, right shin with shoe

Every limb segment ends in a full rounded cap at each joint so segments can overlap and rotate. All parts at the same scale.
```

Fallback if the puppet sheet keeps failing, file `a01b-character-poses.png`:

```
Same locked style as the attached room image, same man as the attached photo. Wide canvas, magenta background. Four full-body front-view poses of the identical character, identical size and proportions, feet on the same baseline, wide gaps between them:
1. standing relaxed, arms at his sides
2. waving with his right hand raised
3. clapping chalk off his hands, small chalk puffs drawn as separate chalk white shapes
4. arms locked out overhead as if holding a barbell, with no barbell drawn
```

### A02. Power rack, barbell and plates
File: `a02-rack-sheet.png`. Maps to Projects.

```
Same locked style and outline weight as the attached room image. Wide canvas, magenta background. A parts sheet in front elevation, exploded with wide gaps:
- one black steel power rack, empty, with two J-hooks and safety bars
- one bare Olympic barbell, perfectly straight and horizontal, with knurling shown as simple flat bands
- a second barbell identical to the first but bowed slightly downward at both ends
- six bumper plates seen face-on as complete discs with a centre hole and a blank inner ring: one red, one blue, one yellow, one green, one chalk white, one iron black
- the same six colours again as thin side-on plates, seen edge-on as tall narrow rounded rectangles
- two spring collars, side-on
No markings or numbers on any plate.
```

### A03. Whiteboard
File: `a03-whiteboard-sheet.png`. Maps to Metrics.

```
Same locked style and outline weight as the attached room image. Wide canvas, magenta background. A parts sheet, exploded with wide gaps:
- one large landscape whiteboard with a thin iron frame and a marker tray, board surface completely blank chalk white
- three marker pens lying horizontal: red, blue, iron black, each with a cap on
- one marker pen held at a writing angle with its cap off
- one felt eraser
- two round magnets, yellow and green
- one short hand-drawn underline stroke and one hand-drawn tick mark in red marker, as loose shapes
```

### A04. Desk
File: `a04-desk-sheet.png`. Maps to Work history.

```
Same locked style and outline weight as the attached room image. Wide canvas, magenta background. A parts sheet in front elevation, exploded with wide gaps:
- one plain plywood tan desk with iron black legs
- one laptop base seen from the front, and separately its open lid with a completely blank chalk white screen
- one desk microphone on a short boom arm, the mic head and the arm drawn as two separate parts
- one pair of over-ear headphones
- one mug in plate yellow, and separately three small steam wisps in chalk white
- five vertical rounded bars of different heights in plate red, as a loose audio waveform
- one small potted plant
```

### A05. Agent bot
File: `a05-bot-sheet.png`. Stands for the agents and voice systems. It is the tooltip narrator.

```
Same locked style and outline weight as the attached room image. Square canvas, magenta background. A small friendly desk robot, original design, box-shaped body in chalk white with plate blue accents, about the height of a mug. Parts sheet in front view, exploded with wide gaps:
- body with a blank speaker grille made of simple horizontal slots
- head with two round eyes open
- a second head with eyes closed
- a third head with eyes as happy upward arcs
- one antenna with a small yellow tip
- left arm and right arm, simple rounded tubes with mitten hands
- three curved sound arcs in plate blue, small, medium, large
```

### A06. Bike
File: `a06-bike-sheet.png`. Maps to About. Pick one of the two bracketed options before pasting.

```
Same locked style and outline weight as the attached room image. Wide canvas, magenta background. A [commuter motorcycle | road bicycle] in strict side elevation facing right, generic original design with no brand marks. Parts sheet, exploded with wide gaps:
- the complete frame and body without wheels, wheel axle points clearly visible
- front wheel as a complete circle with spokes
- rear wheel as a complete circle with spokes
- kickstand
- one helmet in plate red
- three short horizontal speed lines in concrete grey
Main body colour plate green with iron black details.
```

### A07. Chalk stool and logbook
File: `a07-chalk-logbook-sheet.png`. Maps to Principles and Notes.

```
Same locked style and outline weight as the attached room image. Wide canvas, magenta background. A parts sheet in front elevation, exploded with wide gaps:
- one three-legged wooden stool in plywood tan
- one chalk bowl in concrete grey, filled with chalk white
- one loose block of chalk
- five small chalk dust puffs of different sizes in chalk white with the iron outline
- one open hardback logbook lying flat, both pages completely blank
- one single blank page drawn mid-turn, curved
- one closed logbook with a plate red cover and a blank label
- one pencil
```

### A08. Calendar
File: `a08-calendar-sheet.png`. Maps to Goals.

```
Same locked style and outline weight as the attached room image. Square canvas, magenta background. A parts sheet in front elevation, exploded with wide gaps:
- one tear-off wall calendar pad with a plate red header strip and a completely blank chalk white page, hung on a single nail
- one loose blank calendar page, flat
- one loose blank calendar page curling as if falling
- one pushpin in plate yellow
- one small flag on a short pole in plate green
```

### A09. Miss bin
File: `a09-miss-bin-sheet.png`. Maps to Misses.

```
Same locked style and outline weight as the attached room image. Square canvas, magenta background. A parts sheet in front elevation, exploded with wide gaps:
- one cylindrical metal bin in concrete grey, empty
- one barbell bent into a shallow V
- three crumpled paper balls of different sizes in chalk white
- one bumper plate in iron black with a crack across it, face-on
- one sticking plaster in plywood tan
```

### A10. Wall phone
File: `a10-phone-sheet.png`. Maps to Contact.

```
Same locked style and outline weight as the attached room image. Tall canvas, magenta background. A retro wall-mounted telephone, original design, body in plate red. Parts sheet in front elevation, exploded with wide gaps:
- the phone body with an empty cradle and a blank dial area
- the handset as a separate part, horizontal
- one coiled cord as a separate part
- four short curved ring lines in iron black
- one blank paper note with a strip of tape
```

### A11. Kettlebells, bag and timer
File: `a11-gym-kit-sheet.png`. Maps to the gym routine page.

```
Same locked style and outline weight as the attached room image. Wide canvas, magenta background. A parts sheet in front elevation, exploded with wide gaps:
- two kettlebells of different sizes, one plate blue, one plate yellow
- one duffel gym bag in iron black with a plate red strap
- one wall-mounted rectangular interval timer with a completely blank dark display
- one coiled jump rope
- one water bottle in plate green
- one folded towel in chalk white
```

### A12. Room fixtures
File: `a12-fixtures-sheet.png`. Lamp toggles the lights (theme switch).

```
Same locked style and outline weight as the attached room image. Wide canvas, magenta background. A parts sheet in front elevation, exploded with wide gaps:
- one pendant ceiling lamp with a wide metal shade in plate yellow on a straight cable
- one pull cord with a small wooden bead at the end, as a separate part
- one flat triangular light cone shape in chalk white
- one square pegboard panel in plywood tan with a regular grid of holes, empty
- four hand tools as separate parts: wrench, screwdriver, tape measure, hex key set
- one small square window frame with four blank panes
- one wall power socket with a cable plugged in
```

## 5. What each asset does on the page

| Asset | Section | Idle | On hover, focus or tap | On enter |
|---|---|---|---|---|
| A01 character | Intro | chest breathes (scaleY 1 to 1.015, 4 s), blink every 5 to 8 s | waves, head rotates up to 6 degrees toward the pointer | waves once, claps chalk |
| A02 rack | Projects | none | plates rattle 2 px, bar swaps to bent sprite | plates slide in from both sides and seat 90 ms apart, bar dips 4 px and settles |
| A03 whiteboard | Metrics | none | marker underlines the hovered number | six numbers revealed left to right with a clip-path wipe following the marker, each counts once |
| A04 desk | Work history | steam wisps rise and loop, waveform bars scale | laptop lid tilts open, typed lines appear on the screen | none |
| A05 bot | Agents, tooltips | antenna bobs, blink | eyes switch to happy, sound arcs pulse outward, speaks the label of the object in focus | none |
| A06 bike | About | none | wheels spin, speed lines slide, bike shifts 6 px | kickstand flicks up |
| A07 chalk, logbook | Principles, Notes | none | dust puffs burst and settle, page turns | none |
| A08 calendar | Goals | none | top page tears and falls with a rotate, next page shows the next goal | none |
| A09 miss bin | Misses | none | paper ball arcs into the bin | none |
| A10 phone | Contact | handset shakes for 400 ms every 9 s with ring lines | handset lifts off the cradle | none |
| A11 gym kit | Gym page | timer display shows live Dhaka time in HTML | kettlebell swings on its handle pivot | none |
| A12 fixtures | Theme | lamp sways 1.5 degrees | cord pulls down 10 px and springs back, lights switch | none |

## 6. Build rules for the animation layer

- Processing per sheet: key out magenta, split by connected components, trace each part to SVG, snap fills to the palette, optimise, name the groups. One inline SVG per object with a `transform-origin` set at each joint or pivot.
- Fills reference CSS variables, so lights-off is a variable swap with no second asset set.
- Motion uses `transform` and `opacity` only, driven by CSS keyframes and the Web Animations API. No animation library to start with.
- Entry animations fire once through `IntersectionObserver`. Nothing replays on scroll.
- `prefers-reduced-motion`: every object renders in its final pose, hover swaps state without tweening.
- The scene is decoration over real content. Name, role, the six metrics and the call button are server-rendered text above it, and every object is an `<a>` with a visible label and keyboard focus, backed by a plain section list below the scene.
- Phones: objects are separate, so the room restacks into one column of stations in section order. No horizontal panning.
- Budget: all illustration SVG for the home page under 250 kB gzipped, objects below the fold loaded lazily, largest paint stays the name in text.

## 7. Order of work

1. Generate A00, A01 and A02 first and drop them in `assets/illustrations/raw/`. These three prove keying, slicing, tracing and the two hardest animations (puppet and plate loading).
2. If A01 slices badly, switch to the A01b pose sheet and swap frames instead of rotating limbs.
3. Once those three are live on the new home page, generate A03 to A12 in one batch.
