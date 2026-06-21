# PantryAgent 2-Minute Demo Video Script

Target length: 1:58-2:02  
Format: 1920x1080, 16:9, 30 fps  
Language: English  
Primary story: Reduce household food waste by reconnecting inventory, expiry, trusted recipes, meal planning, and shopping.

## Creative Direction

This should feel like a social-impact launch film, not a screen-recording tutorial. Open with tension, move quickly into proof, reveal the technical depth, and finish with a credible but ambitious future.

Editing rhythm:

- First 20 seconds: a visual change every 1-2 seconds.
- Demo sections: punch in on the exact UI state being discussed. Do not show long cursor travel or loading.
- Avatar sections: clean medium close-up, direct eye contact, warm kitchen-tech environment.
- Captions: always on. Animate only the key phrases: `30-40%`, `expires first`, `only what is missing`, `traceable`, and `waste less`.
- Music: begin with fridge hum and a ticking clock, hit a restrained bass impact on the statistic, then move into an optimistic 105-115 BPM electronic track. Duck music 8-10 dB under speech.
- Use real PantryAgent recordings for every product screen. Never generate fake product UI with AI.

## Master Timeline And Final Script

### 0:00-0:06 - Pika Video 1: Cold Open B-Roll

Visual: A refrigerator opens in a dark kitchen. Fresh groceries rapidly become forgotten duplicates: two milk cartons, wilted spinach, soft tomatoes, and a long receipt. A subtle clock reflection moves across the shelves. Hard cut before anything becomes visually disgusting.

Member 1 voice-over:

> Open your fridge. How much money in here is already on a countdown?

On-screen text in post:

`YOUR GROCERIES ARE ON A CLOCK.`

Audio direction: Whisper the first three words with curiosity, then land firmly on `countdown`. Fridge hum, two clock ticks, then a bass hit.

### 0:06-0:21 - Pika Video 2: Member 1 Avatar

Member 1 on camera:

> The USDA estimates that 30 to 40 percent of America's food supply is wasted. Often, the problem is not apathy. It is disconnected decisions: what we bought, what expires next, what we cook, and what we buy again.

Performance: Urgent but controlled. Brief pause after `wasted`. Soften on `not apathy`, then accelerate slightly through the four disconnected decisions.

On-screen source in post:

`Source: USDA, Food Loss and Waste`

### 0:21-0:36 - Real Product Demo A: Receipt To Pantry

Screen actions:

1. Show a grocery receipt photo on `/scan`.
2. Click `Scan with Claude`.
3. Show the editable extracted food items, quantities, and shelf-life estimates.
4. Untick or edit one item to make the human review step visible.
5. Save, then cut to `/inventory`, already sorted by expiry.

Member 2 voice-over:

> PantryAgent starts where household food decisions start: the receipt. Claude turns one photo into editable pantry items, quantities, and estimated shelf lives. Nothing is saved until the user reviews it.

On-screen callouts:

`ONE PHOTO -> EDITABLE INVENTORY`  
`HUMAN REVIEW BEFORE SAVE`

### 0:36-0:48 - Pika Video 3: Member 2 Avatar

Member 2 on camera:

> Then we sort by urgency, not alphabetically. Recipes are ranked by the expiring ingredients they rescue, so dinner becomes a waste-prevention decision before that bag of spinach becomes trash.

Performance: Practical and upbeat. Emphasize `urgency`, `rescue`, and `before`. End with a knowing half-smile, not comedy.

On-screen text in post:

`EXPIRY-FIRST, NOT ALPHABETICAL.`

### 0:48-1:04 - Real Product Demo B: Trusted Recipe Import

Screen actions:

1. Paste a tested recipe-blog URL into `/import`.
2. Jump to a prepared successful result instead of waiting on camera.
3. Show the normalized title, ingredients, steps, and `Save to Recipes`.
4. Scroll the Browserbase Web Agent Console: extraction mode and action log.
5. Briefly show nutrition evidence, source URL, and confidence if available.

Member 3 voice-over:

> Families already trust recipes scattered across the web. Browserbase first tries low-cost structured Fetch. If a page needs JavaScript, a popup, a jump-to-recipe button, or scrolling, Stagehand opens a real browser and escalates.

On-screen diagram:

`FETCH -> VALIDATE -> STAGEHAND FALLBACK`  
`SOURCE + ACTION LOG + REPLAY`

### 1:04-1:16 - Pika Video 4: Member 3 Avatar

Member 3 on camera:

> That escalation is deliberate engineering, not a black-box wrapper. The app exposes the extraction mode, sources, confidence, and web actions, making recommendations traceable and much easier to debug.

Performance: Confident and technically precise. Build energy through the list, then slow down on `traceable`.

On-screen text in post:

`AI YOU CAN INSPECT.`

### 1:16-1:34 - Real Product Demo C: Plan, Shop, Eat, Update

Screen actions:

1. On `/planner`, click `Auto-fill empty slots`.
2. Show a recommendation using an expiring item and its reason.
3. Show a shortage warning and `Add all to Shopping List`.
4. On `/shopping`, mark one missing item bought; show that it is added to pantry.
5. Return to the plan, click `Ate this`, and reveal `inventory updated`.

Member 4 voice-over:

> Claude fills the week around what expires first, preserves meals people choose themselves, and flags likely shortages. PantryAgent adds only missing ingredients to shopping. Bought items return to inventory, and eaten meals automatically update what remains.

On-screen loop animation:

`PANTRY -> PLAN -> SHOP -> EAT -> UPDATED PANTRY`

### 1:34-1:49 - Pika Video 5: Member 4 Avatar

Member 4 on camera:

> We treat AI as an assistant, not an authority. Users confirm receipt data, nutrition stays labeled as estimated with evidence and confidence, and no purchase happens automatically. Helpful automation should never hide uncertainty or remove agency.

Performance: Sincere, grounded, and slightly slower than the other speakers. Pause after `authority` and emphasize `never`.

On-screen ethics strip:

`USER CONFIRMATION | EVIDENCE + CONFIDENCE | NO AUTO-CHECKOUT`

Small prototype disclosure:

`Prototype today: demo user. Production requires account isolation, least-privilege access, and image-retention controls.`

### 1:49-1:56 - Pika Video 6: Future Impact Montage

Visual: Fast, hopeful montage of a shared family pantry, a household waste dashboard trending down, surplus food being routed to a community fridge, then many small kitchens lighting up across a city map. Do not show invented PantryAgent UI.

Member 4 voice-over:

> Next: shared family pantries, waste dashboards, donation routing, and community insights that turn small kitchen decisions into measurable climate impact.

On-screen label:

`ROADMAP`

### 1:56-2:00 - End Card

Visual: PantryAgent logo on cream, then the loop resolves into a green check.

Member 1 voice-over:

> PantryAgent. Cook what you have. Waste less. Start at home.

On-screen text:

`COOK WHAT YOU HAVE. WASTE LESS.`

## Pika Generation Prompts

Use one authorized portrait and voice reference per member. Do not mix identities. Every member already explicitly consent to use of their face and cloned voice.

### Shared Avatar Prompt

Use this as the base prompt for Pika Videos 2-5, then add the member-specific performance direction:

```text
16:9 cinematic medium close-up of the exact person in the supplied reference portrait,
speaking directly to camera in a modern warm kitchen-tech studio. Cream, soft green, and
natural wood palette, subtle practical lighting, realistic skin texture, natural blinking,
small purposeful hand gestures, steady eye contact, gentle camera push-in. Preserve the
person's identity exactly. Mouth shapes, jaw motion, facial expression, breath, and pauses
must match the supplied cloned English voice audio precisely. Engaging hackathon product
pitch delivery, natural energy changes, no monotone reading. Locked composition, no cuts,
no extra people, no background speech, no on-screen text, no subtitles, no logos, no warped
hands, no beauty-filter look, no exaggerated head motion.
```

Member-specific additions:

- Video 2, Member 1: concerned opening, credible urgency, eyebrow lift on `30 to 40 percent`, decisive finish.
- Video 3, Member 2: warm problem-solver energy, brighter expression on `rescue`, subtle forward gesture on `before`.
- Video 4, Member 3: composed technical confidence, measured list delivery, slight lean forward on `traceable`.
- Video 5, Member 4: sincere ethical leadership, slower pace, open-palm gesture, optimistic but grounded close.

### Video 1 B-Roll Prompt

```text
16:9 cinematic social-impact cold open, inside a real middle-class household refrigerator
at night, door opens toward camera, beautiful fresh groceries visible, then a rapid visual
passage of time reveals duplicate milk cartons, forgotten spinach beginning to wilt,
softening tomatoes, and a long grocery receipt curling across the shelf. A subtle clock
reflection sweeps over the food. Emotional tension without horror or rot, premium commercial
lighting, fast macro inserts, realistic physics, green and cream color accents, no people,
no logos, no readable generated text, no fake app interface. Six seconds, strong final hard cut.
```

### Video 6 Future Montage Prompt

```text
16:9 hopeful near-future social-impact montage grounded in real households: family members
checking a shared pantry together, a clean abstract waste trend moving downward, sealed
surplus groceries delivered to a neighborhood community fridge, then an aerial evening city
where individual kitchen windows illuminate one by one and connect with subtle green lines.
Human, attainable, diverse, optimistic climate-tech visual language, quick elegant match cuts,
no dystopia, no invented app UI, no logos, no readable generated text. Seven seconds.
```

## Recording Checklist

Prepare these states before recording so the edit never waits on a live service:

- A clear receipt photo with 5-8 edible items and one item worth correcting manually.
- Seed inventory with spinach, ground beef, and cream expiring in 1-2 days.
- One tested recipe-blog URL plus a saved successful import result.
- A Stagehand result or replay with visible popup/jump-to-recipe/scroll actions if available.
- A meal plan with one strong expiry-first reason and one believable shortage.
- A shopping item that can visibly move into pantry.
- A planned meal that can be marked eaten so inventory visibly changes.

Capture rules:

- Record each product flow as a separate clean take at 1920x1080 or higher.
- Keep the browser at a consistent zoom; enlarge the mobile app frame in the final edit.
- Hide secrets, environment variables, session tokens, and private account information.
- Use a prepared successful import in the final cut. Keep the live run only as optional evidence.
- Add captions and all typography in the editor, not inside Pika generations.

## Judge Alignment

| Criterion | Evidence in the video |
| --- | --- |
| Application | Receipt ingestion, expiry-sorted pantry, plan, shopping, and inventory update form a usable household loop. |
| Functionality / Quality | Three short real product demos prove the core workflow with a polished, understandable interface. |
| Creativity | PantryAgent connects decisions that other tools leave as separate lists and optimizes them around waste prevention. |
| Technical Complexity | Claude Vision, Supabase state, deterministic matching, Browserbase Fetch, Stagehand fallback, nutrition evidence, and auditable action logs. |
| Ethical Considerations | Human review, explicit uncertainty, source evidence, confidence labels, no auto-checkout, and an honest prototype disclosure. |
| Brainstorming / Process | The Fetch-first escalation strategy and closed-loop product design show deliberate tradeoffs, iteration, and cost-aware engineering. |

## Claim Discipline

- Use `USDA estimates 30-40% of the U.S. food supply is wasted`, not `one-third of all food produced in the United States`.
- Say `estimated shelf life` and `estimated nutrition`; never present either as medical or safety advice.
- Say the app `prioritizes` or `helps reduce` waste. Do not claim a measured waste reduction until a real study exists.
- Label the future montage `Roadmap` so judges can distinguish implemented functionality from ambition.
- Demo recipe-blog import. Do not claim a completed YouTube transcript workflow in the current build.

Official statistic reference: https://www.usda.gov/about-food/food-safety/food-loss-and-waste
