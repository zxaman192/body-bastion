# Clinical accuracy review (1.5.0 "Pylorus", 14 October 2026)

All medical text and treatment logic in the game was checked against the sources below. This was a
desk review of the content as written. **Before the game is used for assessment, a member of the
Department of Pharmacology faculty should read and sign off this file and the texts it covers.**

## What was reviewed

| Content | Where |
|---|---|
| Germ descriptions, behaviour, "what works" | `shared/gamedata.json` → `units` (`ability`, `weak`, `how`) |
| Drug-bug matrix and its notes | `matrix`, `matrixPct`, `matrixNotes`, `matrixLegend` |
| Defences and what they model | `buildings` (`desc`) |
| Mission cases, best practice, learning objectives, summaries, hints, Learn why | `campaign` |
| Knowledge and checkpoint questions (136) with explanations | `shared/questions.json` |
| "Why did this happen?" cards | `shared/cards.json` |
| Guide: rules, germs, drugs, history notes | `shared/guide.json` |
| Plain-language glossary (36 terms) | `static/js/glossary.js` |
| Result explanations and tips | `static/js/explain.js` |

## Sources

- WHO. The treatment of diarrhoea: a manual for physicians and other senior health workers (2005):
  Plans A, B, C; low-osmolarity ORS (245 mOsm/L, sodium and glucose 75 mmol/L); zinc 20 mg (10 mg
  under 6 months) for 10-14 days; signs of severe dehydration; Ringer's lactate 100 ml/kg.
- Global Task Force on Cholera Control (GTFCC). Antibiotic treatment of cholera (2018, updated
  2019): single-dose doxycycline first line for all ages, azithromycin the alternative, for moderate or
  severe cholera alongside rehydration.
- Riddle MS et al. Guidelines for the prevention and treatment of travelers' diarrhea. J Travel Med
  (2017): antibiotics only for moderate to severe illness; azithromycin preferred in South Asia.
- IDSA clinical practice guidelines for infectious diarrhea (2017): avoid antimotility agents in
  bloody or febrile diarrhoea and in young children.
- ICMR Treatment Guidelines for Antimicrobial Use in Common Syndromes (2019, 2022): enteric fever
  (ceftriaxone for severe, azithromycin or cefixime for uncomplicated; no empirical fluoroquinolones),
  shigellosis (azithromycin or ceftriaxone given local fluoroquinolone resistance).
- IDSA/SHEA focused update on Clostridioides difficile infection (2021): fidaxomicin preferred, oral
  vancomycin acceptable, metronidazole only if neither is available.
- Malfertheiner P et al. Maastricht VI/Florence consensus (2022) and the ACG H. pylori guideline (2024):
  14-day bismuth quadruple therapy where clarithromycin resistance is high or unknown; no monotherapy.
- IDSA candidiasis guideline (2016): echinocandin first line for candidaemia; Candida in stool after
  antibiotics is usually colonisation.
- Ministry of Health and Family Welfare, India. National Deworming Day guidelines: albendazole 400 mg
  (200 mg at 1-2 years) for ages 1-19 on 10 February and 10 August.
- Bhandari N et al. Lancet (2014): Rotavac efficacy 56.4% against severe rotavirus gastroenteritis in
  the first year. Shakya M et al. NEJM (2019): typhoid conjugate vaccine 81.6% efficacy in Nepal.
  Bhattacharya SK et al. Lancet Infect Dis (2013): killed oral cholera vaccine 65% protection over
  5 years in Kolkata.
- WHO AWaRe classification (2023). National Action Plan on AMR, India (2017).

## Findings and changes

| # | Item | Finding | Change |
|---|---|---|---|
| 1 | Matrix: ceftriaxone against cholera | Marked "N" (no activity). Vibrio cholerae is usually susceptible to third-generation cephalosporins in the laboratory, but ceftriaxone is not a recommended cholera drug. | Now "X": active but not indicated. It does reduced damage and every shot counts as unnecessary. |
| 2 | Cholera mission | The patient had no gut-flora defence, so the correct drug (doxycycline, low C. difficile risk) still produced a C. difficile, contradicting the lesson. | The cholera patient now has a normal Gut Flora Garden. The C. difficile lesson stays in its own mission. |
| 3 | Question: child vomiting during ORS (Plan B) | The explanation said "a spoonful every 1-2 minutes" after a pause. WHO advises a 10-minute pause and then giving ORS more slowly, about a spoonful every 2-3 minutes. | Corrected. |
| 4 | Glossary: "dehydration" | The first version matched "dehydration" with the definition of hydration. | Separate, correct definitions. |
| 5 | Drug cards in battle | Every antibiotic showed the same "broad-spectrum" warning, which gave no guidance. | Each drug now shows its harm to the good gut bacteria (none, low, moderate, high), from its collateral value; ceftriaxone and ciprofloxacin are high, matching their C. difficile risk. |
| 6 | Rotavirus mission | It previously rewarded "no antibiotic" with no drug available, and ORS alone could not save the child. | The child's IgA response is already active, so ORS alone succeeds, and a star rewards giving ORS. Antibiotics are taught in missions 3 and 4. |
| 7 | New texts | All new learning objectives, summaries, hints, Learn why panels, germ behaviour texts, glossary entries and result tips were written for this release. | Checked against the sources above; no further errors found. |

No other errors were found in the 136 questions, the 33 explanation cards, the guide, the germ and
drug data or the mission cases.

## Simplifications that are deliberate

These are game abstractions, explained in the guide, not clinical claims:

- Drug effect is a percentage per germ (100% effective, partly effective because of resistance,
  active but not indicated, no effect). Real susceptibility varies between strains and places.
- Resistance rises per shot and fades over hours.
- The immune system is represented by towers. In real rotavirus infection, recovery comes from the
  immune response while ORS keeps the child alive, which is why the mission pre-places an IgA cannon.
- Zinc only acts in child patients, because its benefit is shown in children under 5.
- C. difficile appears after a set amount of antibiotic damage when no healthy flora is present.
