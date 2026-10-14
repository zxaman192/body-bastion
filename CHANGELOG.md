# Body Bastion releases

Every release keeps its number and an anatomical name. Each one is tagged in git (`v1.4.0` and so on),
and each Android build is kept as `dist/BodyBastion-<version>-<name>.apk`.

## 1.5.0 "Pylorus" (2026-10-14)

The first five minutes, rebuilt so a new player understands the game at once.

- **Welcome screen**: the goal in one sentence ("Keep your patient alive by stopping germs before they
  reach the Bone Marrow Core, using the right defence for each germ"), three pillars (Defend, Learn,
  Survive) and one button, Play now, which starts a guest game inside the training mission.
- **Interactive tutorial**: a coach highlights one control at a time and waits for the player to use
  it: the goal bar, the mouth, the build site, the defence, its range, Start, then the first kill and
  the hydration bar. Every step has Skip tutorial; the ? menu and the profile have Replay the tutorial.
- **Missions reordered from basic to advanced**, each with one learning goal, one new mechanic, a
  learning summary, three hints that never cost stars and a Learn why panel: Training (build a
  defence), rotavirus (hydration and ORS), cholera (the Drug Battery: the right drug), ETEC
  (stewardship: no antibiotic), Shigella (resistance), typhoid (vaccination), worms (drug class
  matches the kind of germ), amoebiasis (two-step treatment), H. pylori (combination therapy),
  C. difficile (collateral damage to the microbiome), mixed outbreak. The first four missions offer
  two or three building choices. A new objective type rewards giving ORS.
- **The goal is always on screen** in battle, with live status for every star (on track, done,
  missed), plus Core health next to hydration.
- **Simpler home screen that grows with the player**: at first only the goal, the next mission and
  the guide; research, your own base, raids, the defence log, the league, cohorts and ranks appear
  (with a NEW badge and a pointer) as missions are won. A grid button lists everything, with when
  it opens. Skipping the tutorial, or Show every feature now in the profile, shows everything at once.
- **Clear labels and numbers**: building cards show cost, attack, range in words, what they are strong
  and weak against; choosing a defence previews its range as a bright band on the gut before you
  build. Drugs show their class, cost per shot, harm to the good gut bacteria and local resistance.
  Tapping ATP, nutrients, budget or drug ATP explains how each is earned and spent.
- **Enemy behaviour you can see**: a germ panel shows each germ's kind (bacterium, virus, fungus,
  single-celled parasite, worm), how it moves and attacks, and the wave timeline; waves are announced
  three seconds early; a new germ is labelled the first time it appears; scouting a raid target
  shades every defence's reach.
- **Cause and effect**: shots that do nothing say so on the spot ("no effect", "resisted"); the result
  screen explains what happened and why (collapse, a fallen Core, wasted or unnecessary shots,
  resistance, Stop-Flow trapping, flora loss, cysts left behind) with a "Try" tip for each, then
  What you learned. Retrying is one tap. Raids explain why the defence held.
- **Plain language**: the first time a medical term appears it is followed by a short explanation;
  after that it is underlined and a tap shows the definition (36 terms).
- **Fewer interruptions**: at most three messages on screen, the most serious kept longest, all of
  them in a message list; tips can be switched off. No pre-battle quiz or checkpoint questions in the
  four training missions; checkpoint questions can be switched off and skipped.
- **How it works** cards (three steps, dismissible) for raids, the league, cohorts, research, your base
  and classroom sessions; a free practice raid on the Raid screen.
- **Phones**: a compact two-row battle bar, a right-docked build sheet on wide screens, larger tap
  targets and no overlapping home buttons.
- **Organisers**: a Learning tab and CSV showing, for every mission, players, attempts, first-try
  success, three-star players and how often each star (learning goal) was met.
- **Clinical review** of all medical text and treatment logic (docs/CLINICAL-REVIEW.md): ceftriaxone
  against cholera is now "active but not indicated" rather than "no activity"; the cholera patient now
  has normal gut flora, so the correct drug no longer causes C. difficile; ORS advice after vomiting
  corrected.
- **New logo** everywhere: Android launcher icon (adaptive, all mask shapes), Android splash and
  offline page, the intro title card, favicons, the installable web app and the top bar.
- Android app 1.5.0 (version code 150), signed with the same key as 1.3.0 and 1.4.0.

## 1.4.0 "Laparotomy" (2026-10-10)

- The base is now a real human body on the operating table, opened from neck to pubis, with every
  organ in its true place, shape and colour (anterior view, patient's right on the left): lungs with
  their fissures, heart with coronary vessels and epicardial fat, aortic arch, pulmonary trunk,
  superior vena cava, trachea, thyroid, clavicles, diaphragm, liver, gallbladder, spleen, pancreas,
  kidneys, aorta and inferior vena cava, mesentery, small bowel, the whole colon with haustra and
  taeniae, appendix, bladder and pelvic brim. Tissues are textured (fat globules, liver lobules, lung,
  muscle, mucosa).
- The germs' route follows the real digestive tract: mouth, oesophagus, stomach, duodenum and
  small-bowel coils, caecum and ascending colon, then the portal vein into the liver and a vein through
  the diaphragm to the red marrow of the right ribs, where the Bone Marrow Core stands. The battle
  rules are unchanged: game positions along the gut are mapped onto the body.
- Checkpoint questions: when the first germ crosses into the small intestine, colon, liver or core,
  the battle pauses for one question on the germs found there. A correct, on-time answer (checked by
  the server) unlocks one booster: Rapid Replication, Quorum Surge or Capsule Cloak when attacking;
  ORS Bolus, Complement Cascade or Secretory IgA Flood when defending.
- Original names throughout: Cohort and Cohort Challenge, Merit points, Tactics, Recovery, Neutrophil
  Reserve.
- Much louder sound (with a limiter) and a volume slider on the profile.
- Guests who register from the profile keep their base and progress.

## 1.3.0 "Villus" (2026-10-09)

- Full-screen base with a game HUD, game-style art and buttons.
- Opening animation, optional guided tour with a neutrophil guide, coaching in Case 1.
- Guests can create an account and keep their progress.
- Android app (WebView shell with splash, offline page and adaptive icon).

## 1.2.0 "Lumen" (2026-10-06)

- First public release: 10-case campaign, multiplayer, league with tournament bases and Defence
  Trials, cohorts and challenges with herd immunity, classroom mode with QR join and projector view,
  organiser console, server-verified deterministic battles. Deployed on Render.
