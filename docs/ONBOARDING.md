# The first five minutes (1.5.0 "Pylorus")

How Body Bastion teaches itself, which part of the code does what, how it was checked, and how to
test it with real first-time players.

## The goal, in one sentence

> Keep your patient alive by stopping germs before they reach the Bone Marrow Core, using the right
> defence for each germ.

The same sentence opens the welcome screen, sits at the top of the home screen and is repeated in the
help menu (`OBJECTIVE` in `static/js/progress.js`). Inside every battle a goal bar shows the mission's
main aim and the live status of each star.

## What a new player sees

| Minute | Screen | What happens |
|---|---|---|
| 0:00 | Welcome (`#/welcome`) | Logo, the goal, three pillars (Defend, Learn, Survive), one button: **Play now**. No sign-up. |
| 0:05 | Training mission | A guest account is created and the training mission opens directly in its preparation phase. |
| 0:05-1:30 | Coach | One step at a time, each waiting for the player: the goal bar, the mouth, tap the glowing site, choose the Paneth Cell Tower, look at its range (bright band), Build, Start. |
| 1:30-2:30 | First battle | Stomach acid and the tower kill the germs; the coach points at the first kill and at the hydration bar. Waves are announced three seconds early; new germs are labelled. |
| 2:30 | Result | "The patient survived", what happened (kills by tower and acid), what you learned (three sentences), stars, one-tap Play again or **Next: Mission 2**. |
| 3:00-5:00 | Mission 2 | One new mechanic: hydration. The coach points at the hydration bar and the IgA cannon already defending, then asks for an ORS + Zinc Station. |

Every coach bubble has **Skip tutorial** (also in the profile). Skipping marks the tutorial done and
shows the whole game at once. **Replay the tutorial** (help menu and profile) resets the coaching,
the plain-language glossary and the feature reveals, then starts the training mission again.

## Missions: one idea and one mechanic each

`shared/gamedata.json` → `campaign` is played in list order (ids are stable keys for stars, unlocks
and research). Each mission has `chapter`, `lo` (the learning objective), `mechanic` (name and text),
`summary` (learning summary), `hints` (three, increasingly specific, never costing stars) and `why`
(the Learn why panel). `training: true` missions are optional: they never lock later missions.

| # | Mission | Learning objective | New mechanic | Choices |
|---|---|---|---|---|
| 1 | Training: hold the line | The gut's own defences kill bacteria | Building a defence | 2 buildings |
| 2 | Rotavirus (child) | Diarrhoea kills by dehydration; ORS is the treatment | Hydration | 3 buildings |
| 3 | Cholera | Choose the drug that works on the germ | Drug Battery and prescription | 3 buildings, 3 drugs |
| 4 | ETEC | Most watery diarrhoea needs no antibiotic | Antibiotic stewardship | 3 buildings, 3 drugs |
| 5 | Shigella | Resistance: pick the drug that still works locally | Antibiotic resistance | 4 buildings, 3 drugs |
| 6 | Typhoid | Vaccination prevents disease | Vaccination | 4 buildings |
| 7 | Ascaris | Worms need an anthelmintic | Matching the drug to the kind of germ | 4 buildings |
| 8 | Amoebiasis | Some infections need two drugs in turn | Two-step treatment | 4 buildings |
| 9 | H. pylori | Combination therapy prevents resistance | Combination regimen | 4 buildings |
| 10 | C. difficile | Broad-spectrum antibiotics destroy the microbiome | Collateral damage to the gut flora | 4 buildings |
| 11 | Hostel outbreak | Right treatment for each germ in an outbreak | Putting it all together | 9 buildings |

`tools/balance.py` checks that the intended treatment earns three stars in every mission and that
doing nothing or the classic mistakes do not. Stop-Flow (loperamide) appears only from mission 5,
where not using it is part of the lesson. The pre-battle quiz and checkpoint questions are off for
the first four missions, so the first experience teaches through play rather than quizzes.

## What opens when (`FEATURES` in `static/js/progress.js`)

| Feature | Opens after |
|---|---|
| Missions, Guide | from the start |
| Research | Mission 3 (first antibiotic) |
| Build your base, Raid, Defence log | Mission 4 |
| League, Cohort, Ranks | Mission 6 |

A grid button on the home screen lists every feature with when it opens. Teachers, admins and
observers, players who skipped the tutorial, and anyone who turns on **Show every feature now** in the
profile see everything. Every route also still works by link, so nothing is removed.

## Where it lives in the code

| File | Role |
|---|---|
| `static/js/screens/welcome.js` | Welcome screen and the guest start straight into training |
| `static/js/coach.js` | The interactive coach and the per-mission scripts (`missionSteps`) |
| `static/js/progress.js` | Mission order, tutorial preferences, progressive features |
| `static/js/glossary.js` | Plain-language terms: an explanation in brackets on first use, a tap-for-definition button after |
| `static/js/explain.js` | Building and drug facts, germ profiles and waves, live star status, result analysis |
| `static/js/onboard.js` | "How it works" cards for raids, the league, cohorts, research, your base and classroom sessions |
| `static/js/battle.js` | Goal bar, Core health, build sheet with range preview, germ, case and hint panels, message list |
| `static/js/screens/result.js` | What happened and why, Try tips, What you learned, Learn why, one-tap retry |
| `app/routes/admin.py` `learning_report` | Learning outcomes per mission for organisers (Admin, Learning tab and CSV) |

## Checks done for this release

- `pytest`: 43 tests, including mission order and unlocks, the optional training mission, the guided
  build earning three stars, every mission having one idea and few choices, and the learning report.
- `tools/balance.py`: no failures across all missions, trials and tournament bases.
- `tools/parity_gen.py` + `tools/parity_check.mjs`: 1,562 battles, 391 step-by-step replays and 516
  star-scoring checks, 0 mismatches between the server and the browser.
- A scripted first-time walkthrough in a browser at desktop and phone sizes: welcome, Play now,
  training with every coach step, result, missions 2 to 4, home reveals, skip and replay, the feature
  drawer, the help menu, a practice raid and its explanation.

These checks show the game works as designed. They do not show that students learn from it: that
needs real players.

## Play-test protocol (first-time players)

Run with 6 to 10 students who have never seen the game, one at a time, on their own phones.

1. Give no instructions beyond "Open this link and play for ten minutes. Think aloud."
2. Note the time to: pressing Play now, the first defence built, the first battle started, the first
   mission won, Mission 2 started. Target: first defence in under 2 minutes; Mission 1 won in under 4.
3. Note every point where the player hesitates for more than 10 seconds, taps something that does
   nothing, or asks a question. Each is a usability problem to fix.
4. After ten minutes ask, without the game in front of them:
   - In one sentence, what is the goal of the game?
   - Why did the patient lose water, and what put it back?
   - Would you give an antibiotic to a child with rotavirus? Why?
5. Score the three answers (0, 1 or 2 each). Repeat the same three questions with a comparable group
   who have not played, to see what the game itself taught.
6. Ask them to rate on a 1 to 5 scale: "I knew what to do next" and "The explanations were clear".
7. Afterwards, the Admin, Learning tab shows for every mission the players, attempts, first-try
   success, three-star players and how often each star was earned. A mission most players fail first
   time, or a star few players earn, is where teaching or difficulty needs work.

Change one thing at a time between rounds and keep the notes with the release they tested.
