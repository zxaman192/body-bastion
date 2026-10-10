# Body Bastion releases

Every release keeps its number and an anatomical name. Each one is tagged in git (`v1.4.0` and so on),
and each Android build is kept as `dist/BodyBastion-<version>-<name>.apk`.

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
