# Body Bastion releases

Every release keeps its number and an anatomical name. Each one is tagged in git (`v1.4.0` and so on),
and each Android build is kept as `dist/BodyBastion-<version>-<name>.apk`.

## 1.4.2 "Duodenum" (2026-10-15)

Built on 1.4.0 "Laparotomy", made simpler, with one new decision at the heart of every case.

- **Choose the treatment when germs attack.** Each time a wave of germs attacks the patient, the
  battle pauses and offers ORS plus the case's drugs. The right drug acts on the germs for 12 seconds
  and clears them; a partly effective drug (resistance) does less; a wrong drug does nothing, counts
  as an unnecessary antibiotic, breeds resistance and harms the good gut bacteria (enough of it brings
  C. difficile). ORS refills hydration. Feedback says at once whether the choice was right and what
  the best treatment is; the result screen lists every treatment with the reason.
- The server re-checks every treatment like every other command (new `treat` command in both
  simulations; parity: 0 mismatches).
- **Simpler cases:** no knowledge question before a case, no checkpoint questions during a case (they
  stay in raids), and no prescription batteries to set up: you build defences (walls, immune towers,
  ORS, IV fluids), vaccinate where offered, press Start and treat. Drug ATP only appears when a case
  has batteries.
- Star goals updated so the treatment matters: rotavirus and ETEC reward giving ORS (and no
  antibiotic), typhoid rewards killing it with ceftriaxone or azithromycin, and the outbreak allows at
  most one unnecessary antibiotic.
- Android app 1.4.2 (version code 152, so it installs over both 1.4.0 and 1.5.0).

## 1.5.0 "Pylorus" (2026-10-14, withdrawn)

An onboarding redesign (welcome screen, interactive tutorial, reordered missions, new logo). It was
rolled back to 1.4.0 at the owner's request on 2026-10-15. The code stays available under the git tag
`v1.5.0` and in `D:\Calude\MedGame\backups\v1.5.0-Pylorus`.

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
