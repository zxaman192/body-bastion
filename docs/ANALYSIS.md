# Body Bastion - analysis of the development plan (v1.1) and corrections (v1.2)

Source: `Body_Bastion_Development_Plan.docx` (version 1.1, 30 September 2026), Department of Pharmacology, MAMC, with the MAMC Gaming Society.
This report was produced by reading the whole plan (text, tables and the concept sketch), an independent three-lens review (medical/pharmacology, design consistency, technical/legal), adversarial verification of every finding, and then building and play-testing the game.

## 1. What the plan describes

Body Bastion is a "build - defend - attack" base-building strategy game whose first base is the **gut** (stomach, small intestine, colon, liver gate, Bone Marrow Core). Players build real defences (acid, mucus and villi walls, gut flora, Paneth cells, IgA, Peyer's patches, macrophages, neutrophils, Kupffer cells, ORS + zinc, antibiotic batteries, labs and resource buildings) and attack other players' guts with armies of real enteric germs (Typhoid, Cholera, Shigella, ETEC, H. pylori, Amoeba, Rotavirus, Ascaris, plus C. difficile and Candida). A hydration meter makes dehydration - not tower damage - the main way a base dies, mirroring real diarrhoeal disease.

Eleven "medical rules" make knowledge an advantage: hydration first, spectrum matching, antibiotics not always needed, a resistance meter, collateral damage to the flora (C. difficile/Candida), combination therapy for H. pylori, the loperamide "Stop-Flow" trap, vaccination and herd immunity, deworming day, immune memory and a 20-second knowledge boost. Modes: a 10-case clinical campaign (also the tutorial), asynchronous multiplayer, Clan Wars (college teams), a fair Tournament mode and a Classroom mode with QR codes. The competition runs practice week -> league round -> Clan Wars -> live final, with awards for Champion, Best Clan, Best Steward and Best Defender. Battles are re-checked by a deterministic server simulation. Technology: Godot 4 client and Python FastAPI server; about 5 months of solo work with AI assistants; first-year cost Rs 20,000-60,000.

## 2. Strengths

- A genuinely original teaching mechanic: the hydration meter makes "ORS first" the winning strategy, which is the single most important lesson in diarrhoeal disease.
- Stewardship is built into the rules (wasted shots, resistance, flora collateral, C. difficile), so good prescribing is rewarded by the game itself, not by a quiz.
- A strong competition design (identical tournament bases, server re-check, replays, clan herd immunity) suited to an all-India event.
- Realistic scope control (one organ first; prototype with 6 buildings and 5 germs) and a sensible plan for faculty review.
- Correct attention to Indian context (FQ-resistant typhoid, National Deworming Day, DPDP Act) and to intellectual property.

## 3. Summary of the most important errors

- **Vaccines "protect for good" / rotavirus vaccine gives "permanent protection"** - false. Indian rotavirus vaccines prevent roughly half of severe disease, typhoid conjugate vaccine ~80% for several years, oral cholera vaccine ~65% for 3-5 years. Corrected to partial, waning protection.
- **"Only ORS refills hydration"** - teaches a dangerous error: severe dehydration and shock need IV Ringer's lactate (WHO Plan C). Added an IV Ringer's Lactate Stand; ORS works at only 20% below 25% hydration.
- **H. pylori matrix**: the footnote about clarithromycin sits on the azithromycin column; azithromycin is not part of any H. pylori regimen. Corrected, with triple vs bismuth-quadruple therapy explained.
- **Shigella "weak against macrophages"** - backwards: Shigella kills macrophages (pyroptosis); neutrophils are the key defence. Typhoid survives inside resting macrophages until T cells activate them; amoebae lyse neutrophils.
- **Peristalsis "pushes germs back"** - anatomically wrong (peristalsis is aboral). Re-modelled as a flush that clears free-floating germs.
- **Amoebiasis treated with metronidazole alone** - misses the luminal amoebicide needed to clear cysts; added cysts and a luminal-agent battery.
- **Loperamide allowed in children / dysentery** - antimotility drugs are never given to children with acute diarrhoea and are contraindicated in dysentery, C. difficile and STEC. Stop-Flow is locked for child patients; the Shigella case patient is now an adult.
- **Zinc for everyone** - zinc is recommended for children under 5 only; it has no effect in adult cases in the game.
- **Metronidazole for C. difficile** - no longer recommended when oral vancomycin or fidaxomicin is available (IDSA/SHEA 2021); coded "active but not indicated".
- **Undefined rules**: the plan never says how batteries choose targets, what "P" means numerically, how dehydration collapse is scored, or how Best Steward can be measured when league players only attack. All defined (prescriptions, per-cell percentages, collapse = 3 stars, scored Defence Trials).
- **Two simulations that must agree** (Godot client, Python server) with no plan for determinism, plus several inputs (base layouts, knowledge answers, resources) that a modified client could fake. Solved with integer-only twin simulations proven identical by automated parity tests, and full server authority.
- **Cost and hosting**: totals understate/overstate the line items (Rs 15,000-65,000 is the realistic range); Render has no India region (Singapore is used and disclosed in the privacy notice).

## 4. Every verified finding

Status: **ADOPTED** = implemented as recommended; **ADAPTED** = fixed in a different way (explained); **NOT ADOPTED** = deliberately kept as in the plan (reason given); **PLAN-ONLY** = a correction to the plan document (timeline/scope), not to the software.

| Status | Count |
|---|---|
| ADOPTED | 38 |
| ADAPTED | 7 |
| NOT ADOPTED | 4 |
| PLAN-ONLY | 4 |

### Medical and pharmacology errors

#### 1. [critical] 1. Summary - **ADOPTED**

> ORS saves the base from dehydration, most diarrhoea does not need antibiotics, broad-spectrum antibiotics destroy the good bacteria and invite C. difficile, H. pylori needs combination therapy, and vaccines protect for good.

**Problem.** "vaccines protect for good" is false for every enteric vaccine in the game. Rotavirus, typhoid conjugate and oral cholera vaccines all give partial, waning protection, and none prevents all infection. A game that teaches lifelong sterilising immunity will produce students who believe a vaccinated patient cannot have typhoid or cholera.

**Correction.** Replace with 'and vaccines give strong but partial, time-limited protection'. Model vaccines as damage/drain reduction, never immunity: Rotavirus ~55% in year 1 waning to ~45-50% in year 2 (Rotavac: 56.4% year 1, 48.9% in the second year, ~55% cumulative to 2 years; Rotasiil ~36% in India), Typhoid conjugate ~80% with slow decay over 4 seasons, oral cholera ~65% decaying over 5 seasons. Breakthrough attacks must remain possible.

**Evidence.** Rotavac (116E) efficacy vs severe RVGE in India 56.4% in year 1, 48.9% over 2 years (Bhandari et al., Lancet 2014); Rotasiil ~36% vs severe RVGE (Kulkarni/Isanaka trials). Typbar-TCV 81.6% (Nepal, Shakya NEJM 2019), 79-85% at 2 years (Malawi, Bangladesh TyVAC trials). Shanchol OCV ~65% cumulative over 5 years (Bhattacharya, Lancet ID 2013).

#### 2. [critical] 4. The germ army, Rotavirus Wave row - **ADOPTED**

> | Rotavirus Wave | Rotavirus | Fast wave that drains hydration; antibiotics useless | ORS and zinc; rotavirus vaccine gives permanent protection |

**Problem.** "permanent protection" is factually wrong and is the single most misleading line in the plan. Indian rotavirus vaccines have moderate efficacy against severe disease and no efficacy claim against all infection; protection is highest in the first year of life and wanes. Both licensed Indian vaccines (Rotavac, Rotasiil) are well below 60%.

**Correction.** Cell: 'ORS and zinc; rotavirus vaccine (Rotavac/Rotasiil) roughly halves severe attacks but does not stop all attacks'. Implement as ~55% less Rotavirus hydration drain in year 1, ~45% thereafter (Rotavac second-year efficacy 48.9%); Rotavirus can still win if no ORS station is present.

**Evidence.** Rotavac 56.4% efficacy vs severe rotavirus gastroenteritis in year 1 and 48.9% over 2 years (Lancet 2014); Rotasiil ~36% vs severe RVGE in the Indian trial; WHO position paper on rotavirus vaccines notes lower efficacy in high-mortality settings and waning in year 2.

#### 3. [critical] 5. Medical rules, "Hydration first" row (and 3. The gut base) - **ADOPTED**

> | Hydration first | Toxin germs drain the hydration meter; only ORS refills it. A base with strong towers but no ORS still collapses. | Dehydration kills in diarrhoea; ORS + zinc save lives |

**Problem.** "only ORS refills it" teaches that oral rehydration is sufficient for all dehydration. WHO Plan C requires intravenous Ringer's lactate for severe dehydration/shock, and ORS is also unusable with persistent vomiting, ileus or altered consciousness. A cholera level in which the correct answer is always ORS would teach a lethal error.

**Correction.** Add an "IV Fluid Bay (Ringer's lactate)" building/power-up. Rule: when the hydration meter falls below 25% (severe dehydration), the ORS station refills at only 20% rate and an alert fires - only the IV Fluid Bay restores the meter above 25%, after which ORS resumes. WHO Plan C numbers for the card: 100 ml/kg Ringer's lactate; infants <12 months 30 ml/kg in 1 hour then 70 ml/kg over 5 hours; children/adults 30 ml/kg in 30 minutes then 70 ml/kg over 2.5 hours. Teaching point text: "ORS for mild/moderate dehydration; IV Ringer's lactate for severe dehydration and shock."

**Evidence.** WHO/UNICEF The Treatment of Diarrhoea manual, Treatment Plan C; WHO cholera outbreak guidance (rapid IV Ringer's lactate for severe dehydration, ORS once the patient can drink).

#### 4. [critical] 5.1 matrix, H. pylori row + footnote *** - **ADOPTED**

> | H. pylori | - | N | N*** | N | N | N*** | N | Y | N | N |

**Problem.** The macrolide column is azithromycin, but the footnote that qualifies this cell says "clarithromycin or metronidazole work only as part of the combination". Azithromycin is not a component of any standard H. pylori regimen; clarithromycin is. Marking the azithromycin cell N*** tells a student that azithromycin is an H. pylori drug that only works in combination, which is wrong twice over, and the footnote names a drug that has no column in the matrix.

**Correction.** Split the column: keep "Azithromycin" and set the H. pylori cell to a plain N with no footnote; add a separate "Clarithromycin" column (H. pylori = P, high resistance in India) and an "Amoxicillin" column (H. pylori = P, only in combination; N for everything else in the game). Rewrite footnote *** as: "Clarithromycin, amoxicillin, tetracycline and metronidazole work against H. pylori only inside a full regimen (PPI-based triple or bismuth quadruple); any one of them alone fails and selects resistance."

**Evidence.** Maastricht VI/Florence consensus (Gut 2022) and ACG clinical guideline on H. pylori (2024): regimens are clarithromycin triple (PPI+clarithromycin+amoxicillin or metronidazole), bismuth quadruple (PPI+bismuth+tetracycline+metronidazole), levofloxacin triple as salvage. Azithromycin is not a recommended component.

#### 5. [major] 4. Germ army, H. pylori Driller row; 5. "Combination therapy" rule; 5.2 level 7 - **ADAPTED**

> | H. pylori Driller | Helicobacter pylori | Survives the acid moat (urease); damages the stomach wall slowly | Combination therapy only (PPI + two antibiotics) |

**Problem.** "PPI + two antibiotics" hard-codes clarithromycin triple therapy, which is no longer first-line where clarithromycin resistance exceeds 15-20%. Indian clarithromycin resistance is high (reported ~20-60% in several Indian series) and metronidazole resistance is very high (>70%), so bismuth quadruple therapy (four components: PPI + bismuth + tetracycline + metronidazole) is the appropriate Indian first-line. The plan also has no bismuth, no amoxicillin and no tetracycline, and sets the fluoroquinolone cell for H. pylori to N although levofloxacin triple therapy is a standard salvage regimen. Two implementers would build different win conditions (3 slots vs 4 slots).

**Correction.** Define the H. pylori win condition explicitly as either: (a) PPI + amoxicillin + clarithromycin, 14 days, which fails ~30-40% of the time in the Indian map and leaves a clarithromycin-resistant strain; or (b) PPI + bismuth + tetracycline + metronidazole, 14 days = the reliable Indian first-line (4 battery slots must fire together); salvage after failure = PPI + amoxicillin + levofloxacin. Add Bismuth, Amoxicillin and Tetracycline batteries; set the fluoroquinolone/H. pylori cell to P (salvage only, after a failed first regimen). Note in the card that tetracycline, not doxycycline, is the quadruple-therapy component.

**What this build does.** One "H. pylori regimen" battery: levels 1-2 = PPI + clarithromycin + amoxicillin; level 3+ = bismuth quadruple therapy, which halves resistance effects. Separate bismuth/tetracycline batteries were not added, to keep the battery list playable.

**Evidence.** Maastricht VI/Florence consensus 2022 (bismuth quadruple as first-line in high clarithromycin resistance areas; 14 days; levofloxacin-containing regimen as rescue); ACG 2024 H. pylori guideline (optimised bismuth quadruple preferred empiric therapy); Indian Society of Gastroenterology consensus on H. pylori.

#### 6. [critical] 5.1 matrix, C. difficile row (metronidazole cell) - **ADOPTED**

> | C. difficile | S | N | N | N | N | P | Y | - | N | N |

**Problem.** Metronidazole is scored P (partly effective) for C. difficile, and the campaign reinforces vancomycin/fidaxomicin only. Since IDSA/SHEA 2017 and the 2021 focused update, metronidazole is no longer recommended for any episode of CDI when vancomycin or fidaxomicin is available, because of clearly inferior clinical cure and higher recurrence; it is reserved only for settings where neither is obtainable. Scoring it P invites players to treat CDI with metronidazole and be rewarded. The matrix also fails to distinguish fidaxomicin from vancomycin although they differ in exactly the way the game is about (flora sparing and recurrence).

**Correction.** Do not set metronidazole to N, because that would teach 'metronidazole has no activity against C. difficile' (the same works-vs-indicated conflation as #8). Keep a low efficacy (e.g. 0.5, higher recurrence) and flag it as inappropriate: a stewardship penalty applies unless oral vancomycin and fidaxomicin are unavailable. Footnote: 'Metronidazole is no longer recommended for C. difficile; use only if oral vancomycin and fidaxomicin are unavailable.' Split vancomycin (cures, damages flora, ~20-25% recurrence) from fidaxomicin (preferred, spares flora, lower recurrence); FMT for multiply recurrent disease.

**Evidence.** IDSA/SHEA 2021 focused update on C. difficile in adults: fidaxomicin preferred over vancomycin for initial and recurrent episodes; metronidazole only when neither agent is available. ACG 2021 CDI guideline concurs; FMT recommended for multiply recurrent CDI.

#### 7. [critical] 4. Germ army, Shigella Raider row + 3.1 Macrophage Tower / Neutrophil Barracks row - **ADOPTED**

> | Shigella Raider | Shigella | Invades the villi wall; bloody-diarrhoea attack | Azithromycin, ceftriaxone, macrophages |

**Problem.** Shigella is not killed by macrophages - it escapes the phagosome and kills the macrophage by pyroptosis, which is what releases IL-1beta and drives the massive neutrophil influx that defines bacillary dysentery (faecal leucocytes). Listing macrophages as what Shigella is weak against teaches the immunology backwards. The same building row is also internally inconsistent with the Typhoid unit, which is explicitly defined as hiding inside macrophages yet is listed as vulnerable to the Macrophage Tower.

**Correction.** Shigella row "Weak against" becomes "Azithromycin, ceftriaxone, Neutrophil Barracks"; give Shigella an ability that destroys/disables a Macrophage Tower it touches (pyroptosis). Change the building row to two separate buildings: "Neutrophil Barracks - strong vs Shigella and invasive E. coli; weak vs Typhoid (relative neutropenia in enteric fever) and vs Amoeba (trophozoites lyse neutrophils)" and "Macrophage Tower - strong vs Amoeba when activated; by itself ineffective vs Typhoid, which survives inside it. Typhoid is cleared only when the Peyer's Patch T-cell/IFN-gamma upgrade activates the macrophages."

**Evidence.** Shigella escapes the phagolysosome, induces macrophage pyroptosis via caspase-1 and drives PMN transmigration (standard microbiology; Shigella pathogenesis literature). S. Typhi survives in macrophages and requires cell-mediated Th1/IFN-gamma activation for clearance; enteric fever classically shows leucopenia, not neutrophilia.

#### 8. [critical] 4. Germ army, Candida Creeper row; 5.1 Candida row; 3.1 colon "C. diff / Candida risk zone" (concept sketch) - **ADAPTED**

> | Candida Creeper | Candida albicans | Grows where the gut flora was damaged | Antifungal |

**Problem.** Candida is presented as an enteric pathogen whose correct management is an antifungal. Candida in stool after antibiotics is overwhelmingly colonisation; "intestinal candidiasis"/"candida overgrowth" as a cause of diarrhoea in immunocompetent people is not an evidence-based entity, and no guideline recommends treating stool Candida with an antifungal. Rewarding players for firing an antifungal at gut Candida teaches a real, common prescribing error and also wastes the stewardship lesson the game is built around.

**Correction.** Keep the unit but invert the lesson: Candida Creeper appears after flora damage and does cosmetic damage only; firing the antifungal battery at it costs ATP, raises the resistance meter and does NOT remove it - it is removed only by rebuilding the Gut Flora Garden and stopping the culprit antibiotic. Set the Candida/antifungal matrix cell to N with a footnote "Candida in stool after antibiotics is colonisation, not infection - no antifungal." Reserve a true antifungal (fluconazole) target for an optional oropharyngeal/oesophageal candidiasis sub-objective in an immunocompromised scenario, which is the real indication.

**What this build does.** Candida is no longer deployable; it appears only when antibiotics destroy the gut flora, a healthy flora kills it (colonisation resistance), and the antifungal is coded "X" (active but not indicated) with a note that stool Candida after antibiotics is colonisation.

**Evidence.** IDSA 2016 candidiasis guideline treats oropharyngeal, oesophageal and invasive candidiasis; there is no recommendation for treating gastrointestinal Candida colonisation. Antibiotic-associated diarrhoea attributable to Candida is not an accepted diagnosis.

#### 10. [major] 3.1 Buildings, Acid Moat row - **ADOPTED**

> | Acid Moat (stomach) | Gastric acid kills most swallowed germs | First damage zone; weak vs H. pylori (urease). Acid-suppressing drugs weaken it |

**Problem.** The Acid Moat is specified as uniformly effective except against H. pylori. That is microbiologically wrong and wastes the best teaching mechanic in the game: infectious dose is largely determined by acid tolerance. Vibrio cholerae is acid-sensitive with a very high infectious dose (~10^8, falling sharply with achlorhydria or antacids), whereas Shigella has a well-described acid tolerance response and an infectious dose of 10-100 organisms, and the spores/cysts/eggs of C. difficile, E. histolytica and Ascaris pass the stomach essentially untouched. Two implementers will otherwise build completely different damage tables.

**Correction.** Define the value unambiguously as the Acid Moat damage multiplier (higher means more killed): Cholera 1.0, ETEC 0.7, Rotavirus 0.6, Typhoid 0.5, Candida 0.2, Shigella 0.1, H. pylori 0, C. difficile spores 0, Amoeba cysts 0, Ascaris eggs 0. Acid suppression reduces the moat's damage.

**Evidence.** Classic infectious-dose data: V. cholerae ~10^8 organisms, reduced by orders of magnitude with gastric acid neutralisation; Shigella 10-100 organisms with a documented acid tolerance response; C. difficile spores, E. histolytica cysts and helminth ova are acid-resistant transmissible forms.

#### 11. [major] 3.1 Acid Moat row + 5. "Combination therapy" rule - **ADOPTED**

> | Combination therapy | H. pylori is defeated only when the PPI and two antibiotic batteries fire together; one drug alone makes it resistant. | Why H. pylori needs triple / quadruple therapy |

**Problem.** The PPI is required to beat H. pylori, and the Acid Moat row says acid-suppressing drugs weaken the moat, but nothing in the rules connects the two. The real, examinable pharmacology is the trade-off: PPIs raise gastric pH, which both allows the antibiotics to work against H. pylori and measurably increases susceptibility to Salmonella, Vibrio cholerae, Campylobacter and C. difficile. Left unmodelled, the plan silently drops its best drug-adverse-effect lesson and leaves the PPI as a free action.

**Correction.** Add an explicit rule: "PPI side effect - while the PPI battery is active, the Acid Moat deals 70% less damage; incoming Cholera, Typhoid and ETEC waves hit 2x harder and the chance of a C. difficile Phantom spawning rises by 50%. The PPI must be active for the H. pylori regimen but should be switched off afterwards." Add a 'Why did this happen?' card: "Acid suppression lowers the infectious dose needed by swallowed pathogens and is an independent risk factor for C. difficile infection."

**Evidence.** FDA and multiple meta-analyses link PPI use to increased C. difficile infection risk; PPI use is an established risk factor for Salmonella, Campylobacter and cholera acquisition; Maastricht VI notes high-dose/potent acid suppression improves H. pylori eradication rates.

#### 12. [major] 5.1 matrix, Typhoid row + 4. Typhoid Stalker row + footnote * - **ADAPTED**

> | Typhoid | S | Y | Y | P* | N | N | N | - | N | N |

**Problem.** Two errors. (1) Fluoroquinolone is scored P with the footnote "fluoroquinolone resistance is common in India" - in India fluoroquinolone non-susceptibility in S. Typhi now exceeds 90% in ICMR AMR surveillance, so ciprofloxacin is not an empiric option at all; P teaches that it is a reasonable gamble. (2) Ceftriaxone is a flat Y, which ignores XDR S. Typhi (H58 lineage, ceftriaxone-resistant), the single most important recent development in enteric fever and the reason azithromycin and carbapenems matter.

**Correction.** Set Typhoid/fluoroquinolone to N with the footnote '>90% of S. Typhi in India is fluoroquinolone non-susceptible; ciprofloxacin must not be used empirically'. Keep ceftriaxone Y, since it remains first-line in ICMR guidance and Indian ceftriaxone resistance is still low. Add a resistance-meter path: ceftriaxone overuse spawns a ceftriaxone-resistant/XDR Typhoid variant that only azithromycin or an unlockable meropenem battery can kill.

**What this build does.** Typhoid vs ciprofloxacin is "P" at 10% effectiveness (most Indian S. Typhi are fluoroquinolone non-susceptible) rather than a flat N, so the matrix still shows that the drug has activity but fails in practice.

**Evidence.** ICMR AMR Surveillance Network annual reports (fluoroquinolone non-susceptibility >90% in S. Typhi); XDR S. Typhi (H58, resistant to chloramphenicol, ampicillin, co-trimoxazole, fluoroquinolones and third-generation cephalosporins) first reported from Sindh, Pakistan 2016 with cases exported to and reported from India; WHO guidance recommends azithromycin or carbapenems for XDR enteric fever.

#### 13. [major] 3.1 ORS + Zinc Station; 5.2 level 1 - **ADOPTED**

> | ORS + Zinc Station | Oral rehydration salts and zinc | Refills the hydration meter; the most important building against watery diarrhoea |

**Problem.** Zinc is bundled with ORS for every base and every case, implying it is given to all patients with diarrhoea. Zinc is recommended only for children under 5 years; there is no recommendation for zinc in adult diarrhoea, and the campaign contains explicitly adult cases (traveller's diarrhoea, cholera in adults, H. pylori, C. difficile). The plan also never specifies the ORS formulation, and old high-osmolarity ORS vs low-osmolarity ORS is a genuine examinable distinction.

**Correction.** Split into two upgrades on the same station. ORS (all ages): low-osmolarity ORS, 245 mOsm/L - Na 75, glucose 75, K 20, citrate 10 mmol/L. Zinc (paediatric cases only): 20 mg elemental zinc daily for 14 days for children 6 months to 5 years, 10 mg daily for infants under 6 months. In adult levels the zinc upgrade is greyed out with the tooltip "Zinc is for children under 5 - no proven benefit in adult diarrhoea." Zinc effect in-game: reduces duration of the Rotavirus/ETEC wave by ~25% and reduces the chance of a repeat attack for the next 2-3 turns.

**Evidence.** WHO/UNICEF joint statement on the clinical management of acute diarrhoea: low-osmolarity ORS (245 mOsm/L) plus zinc 20 mg/day for 10-14 days in children under 5 (10 mg in infants <6 months); zinc reduces duration and severity and the incidence of diarrhoea in the following 2-3 months. No zinc recommendation exists for adults.

#### 14. [major] 5. Medical rules, "Stop-Flow trap" row; 3.1 Peristalsis Conveyor - **ADOPTED**

> | Stop-Flow trap | The loperamide power-up stops fluid loss, but with Shigella, Amoeba or C. difficile it traps them inside and they grow stronger. | Avoid antimotility drugs in dysentery and C. difficile |

**Problem.** The contraindication list is incomplete in the two ways most likely to harm patients. Loperamide should not be used in children under 5 years at all (WHO explicitly states antimotility drugs must never be given to children with acute diarrhoea - deaths from ileus and sedation), and campaign level 1 is a child. It is also contraindicated in Shiga-toxin-producing E. coli (O157:H7/EHEC) where it raises the risk of haemolytic uraemic syndrome, and in any patient with high fever or bloody stools.

**Correction.** Rewrite the rule as: "Stop-Flow (loperamide) is locked out entirely in any paediatric level - antimotility drugs are never given to children with acute diarrhoea. In adult levels it is allowed only for non-bloody, afebrile watery diarrhoea (ETEC); using it against Shigella, Amoeba, C. difficile or Shiga-toxin E. coli traps the germ, triggers a toxic megacolon event (instant Villi Wall breach) and, for Shiga-toxin E. coli, a haemolytic uraemic syndrome event that damages the Core." Add a Shiga-toxin E. coli (EHEC) unit, or at minimum name the contraindication on the card. Also note on the card that antibiotics themselves are contraindicated in STEC for the same HUS reason.

**Evidence.** WHO Treatment of Diarrhoea manual: antidiarrhoeal and antiemetic drugs have no practical benefit and are never indicated in children. Loperamide and antibiotics in STEC/E. coli O157:H7 are associated with increased risk of HUS (Wong et al., NEJM 2000; CDC guidance). Toxic megacolon is a recognised complication of antimotility use in Shigella and C. difficile colitis.

#### 15. [major] 5.1 matrix, Amoeba row (vs 4. Amoeba Blob and 5.2 level 6) - **ADAPTED**

> | Amoeba | S | N | N | N | N | Y | N | - | N | N |

**Problem.** The matrix scores metronidazole as a flat Y for amoeba, which directly contradicts the unit row ("Metronidazole (plus a luminal agent)") and campaign level 6 ("Metronidazole plus luminal agent"). There is no luminal amoebicide column anywhere in the matrix, so an implementer building from the matrix alone will ship a game where metronidazole alone cures amoebiasis. It does not: tissue amoebicides fail to clear luminal cysts in roughly 40-60% of cases, which is why relapse occurs and why a luminal agent always follows.

**Correction.** Set the metronidazole/Amoeba cell to P and add a "Luminal amoebicide" column (diloxanide furoate 500 mg tds x 10 days, or paromomycin, or nitazoxanide) with Amoeba = Y and N/- for every other row. Game rule: metronidazole alone kills the visible Amoeba Blob but leaves a hidden cyst marker; if the luminal agent battery is not fired within 2 turns, the Amoeba Blob respawns at full strength. Keep the liver-gate (amoebic liver abscess) objective tied to the tissue agent.

**What this build does.** Metronidazole kills the invasive Amoeba Blob, but every dead blob leaves an Amoeba Cyst that immune cells and tissue drugs barely touch; a new luminal amoebicide battery (diloxanide furoate / paromomycin) clears cysts.

**Evidence.** Standard antiparasitic therapy for invasive amoebiasis: metronidazole or tinidazole for the tissue phase followed by a luminal agent (diloxanide furoate or paromomycin) to eradicate intraluminal cysts and prevent relapse; nitroimidazoles alone eradicate luminal infection in only a minority of patients.

#### 16. [major] 4. Cholera Flood row; 5. "Knowledge boost" row; 5.2 level 3 - **ADOPTED**

> | Knowledge boost | Optional 20-second question before a battle (e.g. 'Drug of choice for cholera in adults?'). A correct answer gives a small boost. | Recall under pressure; gives medical students their edge |

**Problem.** The plan poses the question but never fixes the answer, and the unit row lists "doxycycline, azithromycin" as interchangeable. They are not: single-dose doxycycline 300 mg is the drug of choice for adults, while azithromycin 1 g single dose is the preferred agent for children and pregnant women. Without a defined answer key, the quiz will be implemented with whichever answer the coder guesses, and the level 3 instruction "doxycycline / azithromycin" will teach the two as equivalent in all patients. Level 3 also omits that antibiotics in cholera are indicated only for moderate-to-severe dehydration, not for every case.

**Correction.** Answer key: 'Drug of choice for cholera in adults' = doxycycline 300 mg single oral dose (distractors: azithromycin, ciprofloxacin, ORS alone). Do not teach azithromycin as the required choice for children and pregnancy as fact: GTFCC (2018) recommends doxycycline first-line for all ages, including children and pregnant women, with azithromycin (20 mg/kg, max 1 g) as the alternative; some Indian texts prefer azithromycin in these groups. Unit row: 'ORS/IV fluids first; single-dose doxycycline (azithromycin alternative) only for moderate-to-severe dehydration.' Level 3: 'IV Ringer's lactate if severe, then ORS; single-dose antibiotic for moderate/severe cases; OCV 2 doses for outbreak control.'

**Evidence.** WHO cholera treatment guidance: rehydration is the mainstay; antibiotics are reserved for severely dehydrated patients and shorten illness and shedding; doxycycline single dose is first-line including, per WHO, in children, with azithromycin as the alternative, and azithromycin preferred in pregnancy. Note the game must not imply antibiotics substitute for fluids.

#### 18. [major] 5. Medical rules, "Vaccination" row; 3.1 Pharmacy Lab / Vaccine Lab - **ADOPTED**

> | Vaccination | Vaccine Lab gives lasting antibody boost vs Rotavirus, Typhoid or Cholera; clan-wide vaccination weakens that germ for the whole clan. | Immunisation and herd immunity |

**Problem.** "Lasting antibody boost" carries no number, no schedule and no age restriction, so the implementer cannot build it and the student learns nothing checkable. The three vaccines differ sharply in schedule, age window and duration, and the typhoid vaccine type matters: the old Vi polysaccharide vaccine is ~55-65% effective, does not work under 2 years and is not boostable, whereas the typhoid conjugate vaccine works from 6 months with a single dose.

**Correction.** Specify each vaccine as a researchable upgrade with real parameters. Rotavirus (Rotavac/Rotasiil): 3 oral doses at 6, 10, 14 weeks, only usable in the paediatric base, ~55% reduction in severe Rotavirus damage, waning. Typhoid conjugate vaccine (Typbar-TCV): single dose from 6 months, ~80% reduction in Typhoid damage, protection at least 4 years - explicitly label it conjugate, not Vi polysaccharide. Oral cholera vaccine (Shanchol/Euvichol): 2 oral doses 14 days apart, ~65% reduction over 5 years, used for outbreak control. State in the card that none of the three prevents all infection.

**Evidence.** Typbar-TCV efficacy 81.6% (Nepal, NEJM 2019) and ~80% in Malawi/Bangladesh TyVAC trials, WHO prequalified, single dose from 6 months; Vi polysaccharide ~55-65%, not immunogenic under 2 years. Shanchol ~65% cumulative protection over 5 years (Lancet ID 2013). Rotavac 56.4% vs severe RVGE (Lancet 2014). Indian national immunisation schedule gives rotavirus vaccine at 6, 10 and 14 weeks.

#### 33. [major] 3.1 Peristalsis Conveyor - **ADAPTED**

> Pushes germs back; the 'Stop-Flow' (loperamide) power-up turns it off - risky with invasive germs

**Problem.** Peristalsis moves contents aborally, toward the colon and anus. In the game, germs already travel in that direction, toward the Core. 'Pushes germs back' (toward the mouth) teaches the reverse of the real physiology. But simply pushing germs forward would speed them toward the target. The mechanic cannot be built both accurately and usefully as written.

**Correction.** Make the conveyor a flush. Every 6 s, each germ in its small-intestine segment that is not attached is carried 3 tiles distally. Any germ carried past the Exit (end of colon) is expelled: removed with no damage. Because the Core is reached only by the ileal and colonic portal branches, flushing luminal germs out weakens the attack. Attached germs are immune: a germ attacking a wall, Typhoid entering the Peyer's Patch, or Amoeba. Building text: 'Gut movement flushes germs out of the body; diarrhoea is partly a defence.'

**What this build does.** Peristalsis no longer "pushes germs back" towards the mouth; it is a flush that damages free-floating germs in the small intestine (germs attached to the wall take half).

**Evidence.** Normal intestinal propulsion is aboral, and diarrhoeal flushing is a host defence. This is why antimotility drugs prolong invasive and toxin-mediated infections.

### Internal inconsistencies and design gaps

#### 9. [critical] 5.1 matrix key and ETEC row (footnote **) - **ADOPTED**

> | ETEC (E. coli) | Y | N** | P | P | N | N | N | - | N | N |

**Problem.** The key defines N as "not effective", but the ETEC/ceftriaxone cell is marked N with footnote "antibiotics are generally not needed". Ceftriaxone is microbiologically active against ETEC; it is simply not indicated. Conflating "does not work" with "not indicated" destroys the game's own stewardship lesson - a student learns the false fact that cephalosporins do not kill E. coli instead of the true lesson that antibiotics are unnecessary in acute watery diarrhoea. The same conflation makes the ORS column inconsistent: ORS is coded Y for Cholera, ETEC and Rotavirus but S for Typhoid, Shigella, C. difficile and Amoeba although it is supportive in every one of them.

**Correction.** Add a code to the key: "X = active against the germ but NOT indicated - firing it wastes ATP, damages the Gut Flora Garden and raises the resistance meter." Set ETEC: ceftriaxone X, fluoroquinolone X, azithromycin X (azithromycin becomes Y only in the severe traveller's-diarrhoea sub-case). Standardise the ORS column to S for every diarrhoeal germ, and add a separate bold rule that for Cholera, ETEC and Rotavirus, ORS is the definitive treatment while an antibiotic is optional or useless.

**Evidence.** WHO/ICMR guidance: acute watery diarrhoea requires rehydration, not antibiotics; antibiotics for traveller's diarrhoea are reserved for moderate-severe disease, with azithromycin preferred in South Asia because of fluoroquinolone-resistant Campylobacter. ETEC is not intrinsically resistant to third-generation cephalosporins.

#### 17. [major] 5. Medical rules, "Collateral damage" row + 4. C. diff Phantom row - **ADOPTED**

> | Collateral damage | Broad-spectrum batteries harm the Gut Flora Garden; if it falls, C. difficile and Candida appear. | Microbiome, antibiotic-associated diarrhoea, superinfection |

**Problem.** "Broad-spectrum" is never defined, so every drug in the matrix either is or is not broad-spectrum depending on the implementer, and the most examinable fact - that C. difficile risk differs enormously between agents - is lost. Clindamycin, fluoroquinolones, third-generation cephalosporins and carbapenems carry the highest risk; doxycycline carries notably low risk; and the plan contains no clindamycin at all despite it being the classic culprit.

**Correction.** Give each battery an explicit flora-damage/CDI-risk weight used by the C. difficile spawn check: clindamycin 1.0 (add this battery - it is the textbook culprit), ceftriaxone 0.9, fluoroquinolone 0.8, carbapenem 0.8 (if added), amoxicillin/ampicillin 0.6, azithromycin 0.4, metronidazole 0.3, doxycycline/tetracycline 0.15, oral vancomycin 0.5 (damages flora but treats CDI), fidaxomicin 0.1 (narrow spectrum, spares flora), albendazole 0, antifungal 0, ORS/zinc 0. Spawn a C. diff Phantom when cumulative weight on a base crosses a threshold. Display the weight on each battery's tooltip so players learn the ranking.

**Evidence.** IDSA/SHEA C. difficile guidelines and antimicrobial stewardship literature identify clindamycin, fluoroquinolones, third/fourth-generation cephalosporins and carbapenems as the highest-risk agents; fidaxomicin's narrow spectrum and microbiota sparing underlie its lower recurrence rate versus vancomycin.

#### 20. [critical] 3. The gut base (path topology) / 6.1 / concept sketch - **NOT ADOPTED**

> Germs enter at the mouth and try to pass the stomach, small intestine and colon, reach the liver gate and destroy the Bone Marrow Core (headquarters).

**Problem.** The plan never says what kind of map this is. It could be a fixed-lane map (every unit enters at the mouth and follows the gut), or a free-placement base where units are dropped anywhere on the edge. Section 6.1 says the client sends 'which unit, where, when', which suggests free placement. Section 3 and the sketch show a single mouth entry, which suggests a lane. Two implementers would build different games. The route from the colon to the liver gate and then to the Core is also undefined: the sketch arrows stop at the colon and show no path to the Liver Gate or the Core. Anatomically, the portal route leaves the ileum and colon; it does not come after the colon. The plan also never says which germs may leave the lumen. Cholera, ETEC and Rotavirus are non-invasive and could never reach the Core.

**Correction.** Build a fixed-path lane map. Main path: Mouth -> Stomach -> Small intestine (jejunum, then ileum) -> Colon -> Exit. The Exit is the anus; a germ carried past it is removed with no damage done. Add two portal branches: Ileum -> Liver Gate and Colon -> Liver Gate. Then Liver Gate -> Bone Marrow Core. The lumen has 3 parallel lanes. The attacker deploys units only at the Mouth, choosing the unit, the lane (1-3) and the tick; this is what 'where' means in 6.1. Spells can be cast anywhere on the map. Only invasive germs may take a portal branch: Typhoid from the ileum and Amoeba from the colon. The Kupffer Cell Gate must be destroyed before the Core can be attacked; hidden Typhoid can slip past it, see the macrophage finding. All other germs stay in the lumen: Cholera, ETEC, Rotavirus, Shigella (which attacks the colon wall but does not enter the portal branch), H. pylori, Ascaris, C. difficile and Candida. They attack buildings in their own zone and win through destruction % or hydration collapse. Walls are lane obstacles with HP that block their lane until breached.

**What this build does.** Kept the plan's single gut path (mouth -> stomach -> small intestine -> colon -> liver gate -> core); the colon-to-liver segment is labelled the portal route.

**Evidence.** Plan Section 3 vs Section 6.1 ('which unit, where, when') vs the concept sketch, where the arrows stop at the colon. Pathophysiology: S. Typhi invades through ileal M cells and Peyer's patches. E. histolytica reaches the liver through the portal vein from the colon. V. cholerae, ETEC and rotavirus are non-invasive luminal or epithelial pathogens.

#### 21. [critical] 2.1 Core loop (Defend) / 3.1 Antibiotic batteries / 5 rules - **ADOPTED**

> Other players' germ armies attack while the player is offline; the defence runs automatically

**Problem.** Defence is automatic, yet nothing says how an antibiotic battery chooses its target. As written, the defender's knowledge of which drug suits which germ has no way to affect the battle. Several rules depend on that missing control: 'Firing antibiotic batteries at Rotavirus or ETEC wastes ATP'; the Stop-Flow power-up (who triggers it while the defender is offline?); 'PPI and two antibiotic batteries fire together'; and Level 8 'Stop the culprit'. Who uses antibiotics is also never stated. Attackers have no drugs, and the campaign implies live control, but neither point is written down. The ATP cost of a shot is not defined either.

**Correction.** 1) Prescription. In build mode, each battery gets a checklist of germ types it may fire at. The default is nothing ticked, so the battery is idle and the tutorial prompts the player to fill it in. 2) Targeting. Each tick, a ready battery chooses among germs in range whose type is ticked. It takes the one with the lowest remaining HP, then the one nearest the Core, then the lowest unit id (this keeps the result deterministic). Cooldown is 1.5 s. 3) Cost. Each shot costs 2 ATP from the defender's storage, and batteries stop when ATP reaches 0. 4) Damage = base damage x efficacy(germ, drug) from the matrix. The stewardship and resistance penalties are applied per shot (see the appropriateness finding). 5) Stop-Flow. The defender sets an auto-trigger, either Off or 'when hydration < 40%', with one use per battle. 6) Attackers never use drugs; their only tools are units and spells. 7) In the campaign and Defence Trials (live defence), the player may also pause, toggle batteries on and off, edit prescriptions mid-battle, and trigger Stop-Flow and IV fluids by hand.

**Evidence.** Plan 2.1 (automatic defence), 5 rules 'Antibiotics not always needed', 'Combination therapy' and 'Stop-Flow trap', and 5.2 Level 8 'Stop the culprit'. Each of these needs a defender-controlled firing decision that the plan never defines.

#### 22. [critical] 6. Competition format, item 3 (score) / 3 hydration meter - **ADOPTED**

> Score = stars (destroyed 50% / Bone Marrow Core / 100%) + % destroyed + time left + knowledge boosts.

**Problem.** The formula adds quantities with different units: stars (0-3), a percentage (0-100), seconds and boosts, with no weights. Section 3 says that 'if it reaches zero the base collapses even if the towers are still standing', but no star or score value is given for a hydration collapse. The denominator of '% destroyed' is undefined (do walls count? does the Flora Garden?). 'Time left' only means something if a battle can end early, and the end conditions are never defined. '(e.g. 10)' attacks leaves the number of league attacks open.

**Correction.** Battle end: the first of the 180 s timer, 100% destruction, hydration = 0, or the attacker having no living units and nothing left to deploy. Destruction % = destroyed buildings / total buildings x 100, excluding Mucus, Villi and Epithelial walls. The Acid Moat, Kupffer Gate and Gut Flora Garden all count. Stars: 1 star for destruction >= 50%, 1 for the Bone Marrow Core destroyed, 1 for destruction = 100%. Hydration collapse ends the battle at once, counts the Core as destroyed and sets destruction to 100%, so it scores 3 stars. Balance check (by simulation): a base with a Level-1 ORS Station must not collapse to a full Cholera-only army without spells. Battle score = 1000 x stars + 10 x destruction% + 2 x whole seconds remaining (only if the battle ended by 100% destruction or collapse) + 100 for a correct knowledge answer. League: exactly 10 attacks, one on each Tournament Base 1-10, no retries. League score = sum of the 10 battle scores. Tie-breaks: total stars, then lower total battle time, then the earlier final submission.

**Evidence.** Internal: Section 3 (collapse rule), Section 6 item 3, Section 7 ('3-minute battles'). Summing unweighted stars, percent and seconds gives different rankings depending on how each implementer scales them.

#### 23. [critical] 6. Competition format, items 3 and 6 (Awards) / 2.2 Tournament mode - **ADOPTED**

> Best Steward (won with the least antibiotic use / lowest resistance meter), Best Defender.

**Problem.** In the league, every player only attacks the standard Tournament Bases. Attackers never fire antibiotics, so antibiotic use and the resistance meter are zero for everyone, and Best Steward cannot be computed. Best Defender has no data source either: nobody defends in the league, and Clan Wars defence is never scored. The skills the game is built to teach (ORS first, the right drug, stewardship) are all defender skills, and none of them is scored in the competition. Only the optional knowledge question rewards medical knowledge.

**Correction.** Add a scored Defence Trial component to the League week. There are 5 fixed scripted waves on a standard base with a fixed budget. The player sets prescriptions, the ORS station and power-ups, and may act live. Trial score = 1000 if the Core is intact and hydration stayed above 0, + 5 x minimum hydration % reached, + 300, - 30 per inappropriate antibiotic shot, - 10 per resistance-meter point gained. League total = attack total + Defence Trial total. Best Steward = highest Defence Trial total among players who won all 5 trials; tie-break fewest antibiotic shots. Best Defender = the Clan Wars player whose base conceded the fewest total stars, with at least 3 defences received; tie-breaks are lowest mean destruction %, then highest mean hydration at battle end.

**Evidence.** Plan 2.2: Tournament mode means 'Everyone attacks the same standard bases'. Plan 6 item 3 makes the league attack-only. Plan 1 says the game's purpose is that knowledge of treatment wins.

#### 24. [major] 5.1 Drug-versus-germ matrix (legend and ORS column) - **ADOPTED**

> Y = effective, N = not effective, P = partly / depends on local resistance, S = supportive (always helps), - = not relevant.

**Problem.** None of these symbols has a numeric meaning, so damage cannot be implemented. The ORS + zinc column mixes Y, S and '-', but ORS never damages germs. It refills hydration whatever the germ, so a damage matrix is the wrong place for it. The difference between '-' and N is undefined: does the battery fire at the germ at all? Typhoid and Shigella fluoroquinolone cells carry 'P*' (resistance common in India), but Cholera and ETEC fluoroquinolone cells carry plain 'P'. An implementer has no way to make them differ.

**Correction.** Use deterministic damage multipliers, with no random numbers, so server replays match. Y = 1.0. N = 0, and the battery may fire and take the stewardship penalty. '-' = the battery can never target that germ: it is treated as unticked and carries no penalty. P uses a value per cell: Typhoid-FQ 0.1, Shigella-FQ 0.3, Cholera-FQ 0.5, ETEC-Azithromycin 0.6, ETEC-FQ 0.4, C. difficile-Metronidazole 0.5. Take the ORS + zinc column out of the damage matrix. The ORS Station's effect is the same for every germ (hydration refill, see the hydration finding). Keep the ORS column's Y and S only as tooltip text: 'main treatment' and 'supportive'.

**Evidence.** Internal: Section 5 says 'only ORS refills it', so ORS has no germ-killing role. Indian surveillance shows most S. Typhi isolates have reduced fluoroquinolone susceptibility and Shigella fluoroquinolone resistance is high; ICMR treatment guidelines advise against empirical fluoroquinolones for enteric fever.

#### 25. [major] 4 C. diff row / 5 rule 'Collateral damage' / 1 Summary / 4 Candida row - **ADOPTED**

> Cannot be deployed normally - appears when the defender's Gut Flora Garden is destroyed by broad-spectrum antibiotics

**Problem.** Three statements conflict. The unit table says C. diff spawns only when antibiotics destroy the Garden. Rule 5 says 'if it falls, C. difficile and Candida appear', whatever the cause. The Summary lists 'C. difficile ... and Candida' among the armies players attack with. The Candida row never says whether Candida can be deployed. Also undefined: which batteries count as broad-spectrum and how much collateral damage each does; how many C. diff or Candida appear, where, and under whose control; whether they count toward the attacker's stars; and how the flora is 'rebuilt' (the stated weakness).

**Correction.** Neither unit is deployable. Remove both from the attacker's army list and change the Summary to: '...Amoeba, Rotavirus and worms - and, if the defender over-uses broad-spectrum drugs, C. difficile and Candida.' Every antibiotic shot, anywhere on the map, does collateral damage to the Gut Flora Garden: Ceftriaxone 6, Fluoroquinolone 6, Azithromycin 3, Metronidazole 3, H. pylori combo 3, Doxycycline 2, Oral vancomycin 1 (0 with the fidaxomicin upgrade), Albendazole 0, Antifungal 0. When the Garden reaches 0 HP and took at least 1 antibiotic collateral damage this battle, spawn 3 C. diff Phantoms and 2 Candida Creepers on the Garden tile at that tick. They are owned and AI-controlled by the attacker, and count toward the attacker's destruction % and stars. A Garden destroyed only by germs spawns nothing. Rebuilding: the Garden regrows 1% HP per second while no flora-damaging battery has fired in the last 15 s. While the Garden is above 50% HP, C. diff in the colon takes 3 damage per second (colonisation resistance).

**Evidence.** IDSA/SHEA C. difficile guidelines (2017; 2021 focused update, Johnson et al., Clin Infect Dis 2021): the highest-risk agents are clindamycin, fluoroquinolones and cephalosporins; fidaxomicin is preferred partly because it spares the microbiota.

#### 26. [major] 2.1 Attack / 4 spells / 3.1 resource buildings - **NOT ADOPTED**

> Choose a germ army and deploy it against another player's gut

**Problem.** No building trains germs. ATP and nutrients are described only for building and research. Army size, unit costs, refill time, spell charges ('limited use'), what the attacker gains from a win, and what 'steals nutrients' (Worm Titan) transfers are all undefined. The attacker's side of the economy does not exist.

**Correction.** Army capacity = 20 + 5 x Core level, counted in housing points. Housing per unit: Cholera 2, ETEC swarm (4 mini-units) 2, Rotavirus 2, Shigella 3, H. pylori 3, Typhoid 4, Amoeba 5, Worm Titan 8. Armies cost no resources and refill 10 minutes after an attack. Spells give 1 charge of each per battle. Contaminated Water: immediately spawns 3 extra copies of the last deployed unit type at the Mouth. Quorum Sensing: +40% speed for 10 s within radius 3. Immune Evasion: units within radius 2 cannot be targeted for 4 s. Biofilm Dome: units within radius 2 take 50% less damage for 8 s. Loot: attacker gains ATP and nutrients = destruction% x 10% of the defender's stored amounts. Worm Titan transfers 5 nutrients per second from the defender to the attacker. ATP pays for buildings, upgrades and battery shots; nutrients pay for research (drugs and vaccines). In Tournament mode the army and spells are fixed per base and there is no loot.

**What this build does.** Kept our own army sizes, housing and nutrient training cost.

**Evidence.** Internal: Sections 2.1, 3.1 and 4 describe only defender resource buildings and research spending. No source of attack units is defined.

#### 27. [major] 9 Phase 0 / whole plan (no numbers) - **NOT ADOPTED**

> This plan refined; full unit/building table with numbers

**Problem.** The plan contains no numeric values for any building or unit: HP, damage, range, speed, cost, hydration drain or tower target choice. A faithful implementation needs them, and two implementers would otherwise produce different balance and different medical emphasis.

**Correction.** Use these starting values. They assume a 10 Hz tick, distances in tiles, hydration 0-1000 and a 180 s battle, and will be tuned by simulation as Section 13 plans. Buildings (HP; attack): Bone Marrow Core 2000; none. Acid Moat 800; 4 damage/s to every germ in the stomach x that germ's acid multiplier; only H. pylori can damage it. Mucus Wall 400 and Villi/Epithelial Wall 800; block the lane. Gut Flora Garden 600; blocks the colon lane, 2 damage/s on contact to bacteria and Candida, +2 nutrients/min. Paneth Cell Tower 300; 6 damage per 0.5 s, range 3, bacteria only. IgA Cannon 350; 15 damage per 1.5 s, range 6, targets toxin germs first, and a hit halves that germ's hydration drain for 5 s. Macrophage Tower 400; 12 damage/s, range 1.5. Neutrophil Barracks 350; keeps 3 neutrophils (60 HP, 8 damage/s). Kupffer Cell Gate 1200; 15 damage/s, range 2. ORS + Zinc Station 400; +10 hydration/s. Antibiotic battery 300; 25 damage x efficacy per shot, every 1.5 s, systemic range, 2 ATP per shot. Mitochondria Plant 250; +10 ATP/min. Nutrient Absorber 250; +5 nutrients/min. Peyer's Patch, Pharmacy Lab and Vaccine Lab 400 each. Germs (HP / speed / building damage per s / hydration drain per s / target): Cholera 60/1.2/2/3/stays in the small intestine. ETEC 4x20/1.4/1/0.75 each/small intestine. Rotavirus 40/1.6/1/2/Villi Wall. Shigella 120/1.0/10 (x2 vs walls)/0.5/colon walls. Typhoid 150/0.9/8/0.25/Peyer's Patch, then portal route, then Core. H. pylori 200/0.6/4/0/stomach buildings only. Amoeba 220/0.5/12/0.5/colon wall, then portal route, then Core. Worm Titan 600/0.4/15/0/Nutrient Absorbers. C. diff 150/1.0/6/1.5/colon buildings. Candida 100/0.6/5/0/Flora Garden. Non-battery towers target the nearest germ in range (tie: lowest unit id).

**What this build does.** The game uses its own numbers, tuned by the automated balance tool (docs/BALANCE.md).

**Evidence.** Plan Section 9 defers all numbers to Phase 0; Section 13 promises balancing by simulation. The build needs concrete starting values first.

#### 28. [major] 2.1 Build / 3.1 Buildings / concept sketch zones - **NOT ADOPTED**

> Place walls, immune-cell towers, the ORS station, antibiotic batteries and resource buildings along the gut map

**Problem.** No rule says where each building may go. The concept sketch assigns zones that conflict with the mechanics. Antibiotic batteries sit only in the Liver Gate zone, out of reach of Cholera, Rotavirus or C. diff in the lumen. The Macrophage Tower and Neutrophil Barracks sit only in the colon, although Typhoid invades through the ileum (small intestine). The Vaccine Lab is placed in the stomach. Battery range is never defined, and oral vancomycin and albendazole act only inside the gut lumen.

**Correction.** Placement table. Stomach: Acid Moat (fixed, exactly 1), Mucus Wall. Small intestine: Villi/Epithelial Wall, Paneth Cell Tower, IgA Cannon, Peyer's Patch (ileum segment only), Peristalsis Conveyor, Nutrient Absorber, Macrophage Tower. Colon: Epithelial Wall, Mucus Wall, Gut Flora Garden, Neutrophil Barracks, Macrophage Tower, IgA Cannon. Liver Gate: Kupffer Cell Gate (fixed). Core zone: Bone Marrow Core, Mitochondria Plants, Pharmacy Lab, Vaccine Lab, ORS + Zinc Station, all antibiotic, antiparasitic and antifungal batteries. Batteries are systemic and reach every zone, with two exceptions. The Oral vancomycin/fidaxomicin and Albendazole batteries are poorly absorbed and target only germs in the small-intestine and colon lumen; they cannot hit germs in the portal branch or Liver Gate. Update the sketch to match: Vaccine Lab and batteries move to the Core zone, and a Macrophage Tower is added to the small intestine.

**What this build does.** Zone limits are applied only where anatomy demands: Peyer's patch (small intestine), flora garden (colon), villi wall (small intestine), acid moat (stomach), Kupffer gate (liver).

**Evidence.** Pharmacology: oral vancomycin is not absorbed and acts only in the gut lumen; albendazole's action against Ascaris is luminal; ceftriaxone, azithromycin, fluoroquinolones and metronidazole act systemically. Pathology: S. Typhi enters through ileal Peyer's patches.

#### 29. [major] 2.2 Case campaign / 5.2 Case campaign - **ADOPTED**

> Win each case with the best treatment - fewest unnecessary drugs, least resistance.

**Problem.** The campaign has no win, lose or star criteria. The plan never says that a campaign level is a live defence (the player is the doctor), whereas multiplayer is attack. The Phase 1 prototype is 'attack an AI base'. Level-specific best-treatment requirements (luminal agent, combination therapy, stopping the culprit drug, 'antibiotics only if severe') cannot be checked without defined criteria.

**Correction.** Each campaign level is a live defence of a pre-built base against scripted waves of that case's germs. The player can pause, edit prescriptions, toggle batteries, and trigger Stop-Flow and IV fluids. The level is lost if hydration reaches 0 or the Core is destroyed. Stars: 1 star for surviving the waves. 2 stars for also firing no inappropriate antibiotic shots and not using Stop-Flow while a Shigella, Amoeba or C. difficile unit is alive. 3 stars for also keeping hydration at or above 50% throughout, gaining no more than 5 resistance-meter points in total, and meeting the level's requirement. Level requirements: L1 and L2, no antibiotic shot (L2 allows azithromycin only while hydration is below 30%). L3, use IV fluids if hydration drops below 30%, then doxycycline. L6, the luminal-agent upgrade is active. L7, the bismuth quadruple regimen. L8, every flora-damaging battery is switched off within 10 s of the first C. diff spawn and the oral vancomycin/fidaxomicin battery is used. L8 starts with the Gut Flora Garden at 0 HP and a ceftriaxone battery firing.

**Evidence.** Internal: Sections 2.2, 5.2 and 9 (Phase 1). The plan's teaching goals are stated, but no testable condition is defined for any of them.

#### 30. [major] 2.2 Tournament mode / 6.1 Fairness - **ADOPTED**

> Everyone attacks the same standard bases with the same starting army - pure skill, fully fair for competitions.

**Problem.** Several systems carry state from one battle to the next: the resistance meter, immune memory, vaccines and clan herd immunity, research levels, Deworming bonuses, loot, and the Worm Titan's nutrient theft. If any of these touch Tournament Bases, the bases are no longer identical for everyone. The plan does not say they are frozen. It is also unclear whether 'the same starting army' means one army for all 10 bases or one army per base.

**Correction.** Each Tournament Base file fully specifies layout, building levels, battery prescriptions, resistance meters, vaccines, memory flags and Stop-Flow setting, plus that base's fixed army and spells. Armies may differ between bases but are identical for every player. Battles in Tournament mode ignore all persistent player state and award no loot. Nothing in them changes the base. The only per-player variable is the knowledge boost, using the same question for every player for a given base index (see the knowledge boost finding).

**Evidence.** Plan 5 defines persistent systems (resistance meter, memory, vaccination, deworming) and 6.1 promises identical bases. The two conflict unless Tournament mode is isolated from persistent state.

#### 31. [major] 2.2 Clan Wars / 6 item 4 / 6 item 5 - **ADOPTED**

> Teams (e.g. one team per college, 5-10 players) attack each other's bases over 1-2 days.

**Problem.** Section 6 says 'the top colleges enter teams of 5; two days of attacks', which conflicts with 5-10 players over 1-2 days. Also undefined: what 'top' is measured by, how clans are paired, how many attacks each member gets, how a war is won (needed for Best Clan), and the live-final format ('top players or clans').

**Correction.** A clan is exactly 5 players from one college. College ranking = sum of that college's 5 best League scores. The top 8 colleges qualify and are paired 1v8, 2v7, 3v6, 4v5 for a 48-hour war. Each member makes 2 attacks on any of the 5 enemy bases, using their own saved bases and armies. Clan war score = sum, over the 5 enemy bases, of the best stars any member achieved on that base (maximum 15). Tie-breaks: total destruction % of those best attacks, then lower total battle time. The 4 winners play the live final on stage: semi-finals and a final, each a mirrored attack on one Tournament Base by every clan member, projected. Best Clan = the live-final winner. The individual live final is separate: the top 8 League players each attack the same 3 new Tournament Bases, highest summed battle score wins, and that is the Champion.

**Evidence.** Internal contradiction between Section 2.2 ('5-10 players', '1-2 days') and Section 6 item 4 ('teams of 5', 'two days').

#### 32. [major] 14 Next steps item 3 / 9 Phase 1 / 13 Risks - **PLAN-ONLY**

> gut base, 6 buildings (Acid Moat, Mucus Wall, Gut Flora Garden, IgA Cannon, ORS Station, one antibiotic battery), 5 germs (Cholera, Shigella, Typhoid, Rotavirus, H. pylori)

**Problem.** The prototype has no Bone Marrow Core, which is the victory target and unlocks other buildings, so an 'attack an AI base' cannot be won by the star rules. It has no resource generator, so batteries cannot pay ATP per shot. It includes H. pylori, which by rule can only be defeated by PPI plus two antibiotics; with one battery H. pylori is unbeatable. It has no Villi Wall for Shigella to 'invade'.

**Correction.** Prototype buildings: Bone Marrow Core (always present, not counted in the 6) plus Acid Moat, Mucus Wall, Gut Flora Garden, IgA Cannon, ORS + Zinc Station and an Azithromycin battery (Y against Typhoid, Cholera and Shigella), with a fixed ATP pool of 200 for the prototype. Prototype germs: Cholera, Shigella, Typhoid, Rotavirus and ETEC. ETEC replaces H. pylori and tests the 'antibiotics not needed' rule. Add H. pylori together with the H. pylori Combo Battery in Phase 3. In the prototype, Shigella targets the Mucus Wall.

**Evidence.** Internal: Section 3.1 says 'Destroying it = main victory' (Core); Section 5 'Combination therapy' rule; Section 14 building list.

#### 34. [minor] 5 rule 'Stop-Flow trap' vs 3.1 Peristalsis row - **ADOPTED**

> The loperamide power-up stops fluid loss, but with Shigella, Amoeba or C. difficile it traps them inside and they grow stronger.

**Problem.** The two sections name different germ sets. The building row says the penalty is 'risky with invasive germs', which would cover Typhoid (invasive) but not C. difficile (non-invasive, toxin-mediated). The rule names Shigella, Amoeba and C. difficile. 'Stops fluid loss' also suggests loperamide replaces rehydration. In reality it reduces stool output but does not correct dehydration, and WHO does not recommend antimotility drugs for children.

**Correction.** Give units an explicit flag, stopFlowPenalty, set on Shigella, Amoeba and C. difficile. Change the building text to 'risky with dysentery germs and C. difficile'. Stop-Flow effect: conveyor off and hydration drain reduced by 40% for 20 s. It never refills hydration. Flagged germs alive during that time get +50% damage and regenerate 2% HP per second. Card: 'Loperamide is avoided in bloody diarrhoea and C. difficile, and is not used in young children - rehydrate instead.'

**Evidence.** WHO, The Treatment of Diarrhoea (2005): antimotility drugs are not recommended for children and are contraindicated in dysentery. IDSA/SHEA C. difficile guidance: avoid antiperistaltic agents.

#### 35. [minor] 4 Shigella row / 3.1 Villi Wall / concept sketch - **ADOPTED**

> Invades the villi wall; bloody-diarrhoea attack

**Problem.** Shigella is a colonic pathogen, and the colon has no villi. The sketch places the Villi Wall only in the small intestine, so Shigella's signature ability has nothing to act on in the zone where it attacks. Students would be taught that dysentery is a small-intestinal villus disease.

**Correction.** Rename the wall 'Epithelial Wall (tight junctions)'. It appears as villi in the small intestine and as crypt epithelium in the colon. Shigella's ability: 'Invades the colon epithelial wall (x2 damage to colonic walls); bloody-diarrhoea attack'. Teaching card: 'Bacillary dysentery is a colitis.'

**Evidence.** Shigella invades colonic M cells and colonocytes and causes colitis. Villi exist only in the small intestine.

#### 36. [minor] 5 rule 'Immune memory' / 3.1 Peyer's Patch - **ADOPTED**

> After defeating a germ, its next attack is recognised faster (Peyer's patch memory).

**Problem.** 'Recognised faster' has no game effect. 'Defeating a germ' could mean one kill or a won defence. How long memory lasts and whether it needs a Peyer's Patch are undefined. Persistent memory also breaks identical Tournament bases (see the Tournament finding).

**Correction.** Memory needs a Peyer's Patch. A germ type is remembered once the base kills at least 5 units of it in one defence. For the base's next 3 defences, every tower does +25% damage against that type and targets it first, and the IgA Cannon's first shot against it fires at once (no wind-up). Memory is ignored in Tournament mode.

**Evidence.** Internal: the mechanic is named but has no parameters. Secondary immune responses are faster and stronger, which is what a damage and priority bonus models.

#### 37. [minor] 5 rule 'Knowledge boost' / 6 item 3 - **ADOPTED**

> Optional 20-second question before a battle (e.g. 'Drug of choice for cholera in adults?'). A correct answer gives a small boost.

**Problem.** The size of the 'small boost' is undefined. So is whether the 20 s counts against the 3-minute battle, whether all tournament players get the same question, whether a wrong answer is penalised, and how the server checks the answer, given that it replays battles deterministically and the boost changes the result.

**Correction.** Same mechanics. The sample answer key should read 'Doxycycline 300 mg single dose (azithromycin as alternative)', not state that children and pregnant women need azithromycin, since GTFCC recommends doxycycline for all ages.

**Evidence.** WHO cholera treatment guidance: a single dose of doxycycline for adults; azithromycin for children and pregnant women. Internal: Section 6.1 server-replay requirement.

#### 38. [minor] 7 Look - Colour code - **ADOPTED**

> germs red/green/purple by group (gram-positive, gram-negative, virus, fungus)

**Problem.** There are three colours for four groups. The roster also has a protozoon (Entamoeba) and a helminth (Ascaris), which fit none of the four groups. Red/green coding is also unreadable for many colour-blind players.

**Correction.** Use six groups, each with a colour from the colour-blind-safe Okabe-Ito palette and a shape glyph. Gram-negative bacteria (Typhoid, Cholera, Shigella, ETEC, H. pylori): vermillion #D55E00, rod glyph. Gram-positive bacteria (C. difficile): reddish purple #CC79A7, rod-with-spore glyph. Virus (Rotavirus): bluish green #009E73, wheel glyph. Fungus (Candida): yellow #F0E442, budding glyph. Protozoa (Amoeba): orange #E69F00, blob glyph. Helminth (Ascaris): brown #8B5A2B, worm glyph. Immune buildings stay blue/white. Battery colours by class: beta-lactam dark blue, macrolide teal, fluoroquinolone grey, tetracycline olive, nitroimidazole pink, glycopeptide/fidaxomicin indigo, anthelmintic brown, antifungal gold, H. pylori combo black.

**Evidence.** Internal: the colour key does not cover the unit roster (Section 4). The Okabe-Ito palette is the standard colour-blind-safe categorical palette.

#### 39. [minor] 2.2 Clan Wars / 5 rule 'Vaccination' - **ADOPTED**

> Clan vaccination level gives 'herd immunity'.

**Problem.** No coverage threshold or effect size is given, and it is unclear whether unvaccinated members are protected (that is the meaning of herd immunity) or which modes use it.

**Correction.** For each vaccine, clan coverage c = members with that vaccine active / clan size. Every clan base, vaccinated or not, gets an extra (indirect) reduction against that germ = vaccine efficacy x min(1, c / 0.6) x 0.5, multiplied with any direct vaccine effect. It applies only in Clan Wars and multiplayer, never in the Tournament. Card: 'High coverage protects even the unvaccinated.'

**Evidence.** The Kolkata oral cholera vaccine trial showed indirect (herd) protection that rose with coverage. Herd effects are also reported for typhoid conjugate and rotavirus vaccines.

#### 43. [minor] 6.1 Fairness - **ADOPTED**

> paid items are never allowed in competition

**Problem.** This implies paid items exist in other modes, but no store, in-app purchases or monetisation appear anywhere else in the plan (costs, timeline, modes). Implementers cannot tell whether to build a store.

**Correction.** Replace with: 'Body Bastion has no paid items or in-app purchases in any mode; all content unlocks through play.'

**Evidence.** Internal: Sections 2, 9 and 11 contain no monetisation features or revenue items.

#### 46. [major] 2.2 Tournament mode; 6 League round - **ADAPTED**

> Everyone attacks the same standard bases with the same starting army - pure skill, fully fair for competitions.

**Problem.** The bases are identical and public, the army is fixed, and the simulation is fully deterministic with its code shipped to the browser. A player can therefore run the client simulation offline with a script, search thousands of command sequences and submit the best one. That sequence can then be shared across a whole college. The server re-check cannot detect this because the submitted commands are legal. The league becomes a scripting contest, not 'pure skill'.

**Correction.** (1) Issue a per-attack seed that is revealed only when the battle token is issued. It drives small, bounded variance (germ entry jitter of ±1 tile, target tie-breaks, ±5% damage rolls), so a precomputed sequence is no longer optimal. (2) Stream commands over WebSocket as the player makes them. Reject any battle whose commands arrive (by server clock) more than 1 s before their tick time, or that finishes in less wall-clock time than its tick count, so every battle has to be played in real time. (3) Make 3-5 variants of each tournament base per difficulty level and assign one at random to each player. (4) Observers review statistical outliers, such as top-1% scores with near-identical command lists. (5) Change the wording to 'identical conditions for everyone'.

**What this build does.** A secret per-battle seed jitters every tower's reload (same average rate), and battles finished faster than real time are flagged "too_fast" (score 0 in the league). Tournament-base variants and WebSocket streaming were not built.

**Evidence.** Deterministic puzzles with full information are routinely solved by automated search (tool-assisted play). A server replay proves only that the commands are legal, not that a human produced them in real time.

#### 48. [major] 9 Development timeline, Phase 5 - **PLAN-ONLY**

> Balancing, load test, Android app, web version, guide document

**Problem.** Weeks 21-22 cannot hold an Android launch. A new personal Play account must keep at least 12 opted-in testers in a closed test for 14 continuous days before it can even apply for production access, and Google's review follows, so at least 3 weeks are needed. A load test in the last fortnight leaves no time to fix what it finds. A 100-student beta, balancing and launch in 2 weeks is also unrealistic. The phase arithmetic itself is right (2+6+5+4+3+2 = 22 weeks, about 5.1 months, ending about early March 2027 from 1 Oct 2026); the critical path is the problem.

**Correction.** Start the Android build (Trusted Web Activity) and the closed test in week 18, using the 20 Phase-2 testers plus Gaming Society members so that at least 12 stay opted in throughout. Run the load test at the end of Phase 4 (week 20) on the event-size plan. Phase 5 becomes the 100-student beta and balancing only. The web version is the primary launch and does not depend on Play approval. Alternatively, register a Play organisation account for MAMC (needs a D-U-N-S number), which is exempt from the closed-test rule.

**Evidence.** Google Play Console Help, 'App testing requirements for new personal developer accounts': applies to accounts created after 13 Nov 2023; 12 testers since Dec 2024; 14 continuous days; organisation accounts are exempt.

#### 49. [major] 9 Development timeline, Phase 3 - **PLAN-ONLY**

> Final art and sound, tutorial, 10 campaign cases, 'Why did this happen?' cards, resistance, flora and vaccine systems

**Problem.** The resistance meter, flora collateral damage with C. difficile/Candida spawning, and vaccination are core simulation rules (section 5). They are scheduled after the server battle check (Phase 2, weeks 9-13). Adding them later forces re-implementation in both the client and server simulations, invalidates the golden tests and replays, and means the Phase 2 online test validates a different game.

**Correction.** Phase 1 delivers the complete Simulation Spec v1. It includes the resistance, flora/C. difficile/Candida spawn, vaccination, Stop-Flow and hydration rules (placeholder numbers allowed), implemented in the Python reference simulation with golden tests. Phase 2 ports them to the client and verifies them. Phase 3 is limited to art, sound, tutorial, campaign content, cards and numeric tuning; each tuning change bumps sim_version and regenerates the test vectors.

**Evidence.** Section 5 calls these rules 'the heart of the game'. Section 6.1 requires the server to replay every rule deterministically.

#### 50. [minor] 14 Next steps vs 9 Timeline - **PLAN-ONLY**

> Next steps (next 2 weeks)

**Problem.** Item 3 ('I build a first playable prototype') is scheduled for the next 2 weeks. Section 9 assigns weeks 1-2 to Phase 0 (design and faculty sign-off) and puts the prototype in Phase 1, weeks 3-8.

**Correction.** Item 3 becomes: 'Weeks 1-2: write Simulation Spec v1 and the numeric unit/building table, and get faculty sign-off on the matrix. Weeks 3-8: build the prototype.'

**Evidence.** Section 9, Phases 0 and 1, compared with section 14.

#### 53. [minor] 6 Competition format, step 5 (Live final) - **ADOPTED**

> Live final: top players or clans play on stage at the fest, projected, with commentary - the Classroom/projector view is reused.

**Problem.** The final depends on venue internet and a remote server in Singapore, with possible cold starts and Wi-Fi captive portals, and there is no fallback.

**Correction.** Package the server and client as one Docker image that runs on a laptop with a local Postgres. Run the final on a local LAN or hotspot with the tournament bases pre-loaded, and upload the results afterwards. Use Render on the Standard plan (no spin-down) as the primary path on final day.

**Evidence.** Render free services spin down and take about 1 minute to wake (render.com/docs/free). Fest-venue connectivity is often unreliable.

### Technical, hosting and anti-cheat

#### 40. [major] 8 Technology - Battle check / 6.1 - **ADAPTED**

> Deterministic battle simulation in Python on the server

**Problem.** The client runs the battle in Godot/GDScript and the server re-simulates in Python. Two separate implementations in different languages will drift apart, through floating-point differences, iteration order and timing, so honest battles will be scored as mismatches. The plan defines no tick rate, number format, random seed or command format.

**Correction.** Write the battle simulation once, as a pure, dependency-free JavaScript module, and run the same file in the browser and on the server. The server can be a Node web service on Render, or FastAPI calling a Node subprocess. Rules: fixed 10 Hz tick; integer or fixed-point arithmetic only (HP and damage x100); a seeded PRNG (e.g. mulberry32) seeded from the battle id, used only if randomness is ever added; units processed in id order. A command is {tick, unitType, lane} or {tick, spell, x, y}. The server simulation is authoritative, and the client result is only a preview. All rule values (the matrix, stats, appropriateness) come from one shared JSON file. Add golden-replay tests to CI.

**What this build does.** Kept the plan's Python server as the authority, with an exact JavaScript mirror for the browser. Both use integer-only maths and identical iteration order; 1,526 randomised battles plus 382 live step-by-step replays give 0 mismatches.

**Evidence.** Deterministic lockstep simulation needs bit-identical arithmetic and update order. Independent float-based implementations in GDScript and Python do not provide this.

#### 42. [minor] 8 Technology - Hosting / Database - **ADOPTED**

> Low delay for Indian players; data stays in India

**Problem.** The build will be hosted on Render, which has no Indian region (regions: Oregon, Ohio, Virginia, Frankfurt, Singapore), so 'data stays in India' cannot hold. On Render's free tier, web services spin down after 15 minutes idle (cold start of about a minute) and the filesystem is ephemeral, so 'SQLite for tests' data is lost on every redeploy or restart. Free Render PostgreSQL databases expire after 30 days.

**Correction.** Deploy to Render's Singapore region. Use Render PostgreSQL (a paid instance for the event), or SQLite only on a paid persistent disk. Use a paid, always-on instance during competition weeks. In the consent notice, state that data is processed in Singapore. DPDP s.16 allows transfer abroad unless the country is restricted by government notification. Keep 'institution server in India' as the option if data localisation is required.

**Evidence.** Render documentation: regions; free instance spin-down after 15 minutes of inactivity; ephemeral filesystem; free Postgres expiry. DPDP Act 2023 s.16.

#### 45. [critical] 6.1 Fairness and cheating (server authority scope); 5 Resistance meter - **ADOPTED**

> The server stores every base and army; the game on the phone sends only the player's commands (which unit, where, when).

**Problem.** Checking the attack commands is not enough. Every input to a battle and every economy action must be server-authoritative, and the plan does not say so. Unprotected inputs: (a) Base layouts. A modified client can save an illegal base: more or higher-level towers than the Core level allows, overlapping buildings, walls that block the whole lane, or upgrades never paid for. (b) The defender editing the base mid-attack, and two attacks hitting one base at the same time. (c) ATP and nutrient production, research and training timers, and army composition. (d) Persistent state carried between battles: resistance meter, Gut Flora health, vaccine level, immune memory and clan herd immunity. These are never defined as server state, and the resistance meter's scope is ambiguous ('Repeated use of the same battery gives attackers resistant variants' does not say whose meter, whether it is per base or global, or whether it decays). (e) The commands themselves: more units than the army, deployment outside the entry zone, ticks out of range, spells over the limit. (f) Opponent choice and attack counting. If an attack only counts when submitted, a player can close the tab on a losing attack and retry. (g) Resubmitting a previously winning command list.

**Correction.** Make the following server-authoritative. (1) Base save: the server validates building caps per Core level, footprint and zone legality, and lane connectivity (a mouth-to-exit path must exist), deducts the cost, and rejects anything else. (2) Attacks: each attack is a single-use, server-issued battle token bound to {attacker, immutable defender snapshot_id, seed, sim_version, expiry of 3 min + 60 s}. Defender edits create a new snapshot and never affect a battle in progress. Casual multiplayer allows one attack at a time per base and a 2-hour shield after each attack. (3) Resources are computed lazily on the server from server timestamps, and all timers run on the server. (4) Persistent state is stored per defender base and copied into the snapshot when a token is issued. Resistance meter: one per drug class, 0-100; +5 for each battle in which that battery fired; -10 per real day unused; at 50 or above, matching germs spawn as a resistant variant with probability equal to the meter %, rolled with the battle seed. Also store Flora health 0-100, vaccine levels and the immune-memory list. Clan herd immunity is computed at the start of each war. (5) Command validation: total units no more than the army, deployment only on entry tiles, 0 <\= tick < 1800, ticks non-decreasing, spells within limits. (6) Matchmaking runs on the server. Tournament attacks are counted when the token is issued; a token not submitted by expiry auto-resolves with the commands received so far. (7) Rate-limit the save and attack endpoints and log IP and device for observers.

**Evidence.** Basic server-authoritative multiplayer principle: never trust the client. Asynchronous base-builders validate layouts and use a snapshot-plus-shield model to avoid race conditions between concurrent attacks. The plan's own claim that 'a modified phone app cannot fake a win' fails if base saves or the economy are trusted from the client.

#### 47. [major] 8 Technology, Battle check row - **ADOPTED**

> Deterministic battle simulation in Python on the server

**Problem.** The CPU cost is not planned. A 3-minute battle at 20-30 ticks/s, with about 50 germs, about 40 buildings and naive all-pairs targeting, is millions of Python operations, or seconds of CPU per battle. Render Free gives 0.1 CPU and Starter gives 0.5 CPU. A CPU-bound simulation inside an async FastAPI endpoint blocks the single event loop, so every other player's request stalls. League deadlines will also pack thousands of verifications into a few hours.

**Correction.** Run at a fixed 10 ticks/s and use a uniform-grid spatial index for targeting. Cap each battle at 60 germs and 50 buildings. Never verify inside the request handler. Run verification in a separate process, either a ProcessPoolExecutor or a worker that polls a pending_battles Postgres table. The client polls and shows 'Verifying...'. Budget at most 300 ms CPU per battle and measure it in the Phase 2 test with 50 simulated players. Use Render Starter during development and Standard (1 CPU, 2 GB) during league week.

**Evidence.** Render: Free 0.1 CPU/512 MB; Starter 0.5 CPU/512 MB at US$7/month; Standard 1 CPU/2 GB at US$25/month. FastAPI docs: CPU-bound work inside async def blocks the event loop.

#### 51. [minor] 1 Summary table, Platforms row - **ADOPTED**

> Android phones, Windows/Mac/Chromebook (web browser); iPhone later

**Problem.** The HTML5 build runs in iPhone and iPad Safari from day one; 'iPhone later' applies only to a native App Store app, which costs US$99/year and risks rejection under Guideline 4.2 as a mere website wrapper. The Android 'app' for a web game is a Trusted Web Activity or PWA, not a separate build.

**Correction.** 'Any modern browser on Android, iPhone/iPad, Windows, Mac and Chromebook, installable as a PWA. Optional Play Store listing via a Trusted Web Activity (Bubblewrap) with Digital Asset Links. No native iPhone app planned.' In Phase 2, test iOS Safari: WebGL2, touch input, and audio unlock on the first tap.

**Evidence.** Apple App Store Review Guideline 4.2 (minimum functionality). Android Trusted Web Activity documentation.

### Legal, cost and timeline

#### 19. [minor] 5. Medical rules, "Deworming day" row; 5.2 level 9 - **ADOPTED**

> | Deworming day | A periodic event: bases that use albendazole on time get a nutrient bonus. | School deworming programmes |

**Problem.** "On time" and "albendazole" are unspecified, so the event teaches nothing concrete about the programme it is named after. India's National Deworming Day has a fixed schedule, age range and dose that are directly examinable, and the dose differs for children aged 1-2 years.

**Correction.** Define the event as National Deworming Day: twice yearly (10 February and 10 August, with mop-up a week later) for all children and adolescents aged 1-19 years; albendazole 400 mg single chewable dose for ages 2-19, 200 mg (half tablet) for ages 1-2. Firing the albendazole battery within the event window gives the nutrient bonus; firing it outside the window gives no bonus and a small resistance-meter tick. Add a card noting that deworming is given to whole age cohorts without stool testing, which is what makes it a mass programme rather than individual treatment.

**Evidence.** Ministry of Health and Family Welfare, Government of India - National Deworming Day operational guidelines (biannual 10 February / 10 August rounds, ages 1-19, albendazole 400 mg, 200 mg for 1-2 years); WHO preventive chemotherapy recommendations for soil-transmitted helminths.

#### 41. [major] 6 item 1 Registration / 12 Students' data - **ADOPTED**

> register, organisers approve, login ID and password, consent (DPDP Act)

**Problem.** The NEET-UG minimum age is 17, so some first-year MBBS students are minors, and the plan mentions a later school version. DPDP Act 2023 section 9 requires verifiable parental consent for anyone under 18 and prohibits tracking or behavioural monitoring of children. Section 12's 'deletion after the event if promised' is weaker than section 8(7), which requires erasure once the purpose is served.

**Correction.** Registration collects date of birth. Under-18s need verifiable parent or guardian consent (DPDP Act s.9 and DPDP Rules 2025), and their public leaderboard entries show only a handle. Collect the minimum data: name, college, email, handle. Passwords are stored hashed (bcrypt or argon2). Personal data is erased 90 days after the event results unless the user opts to keep their account; consent can be withdrawn at any time, with deletion on withdrawal. Replace 'deletion after the event if promised' with 'deletion when no longer needed for the event (s.8(7)), and on request'.

**Evidence.** Digital Personal Data Protection Act 2023, ss. 8(7) and 9; DPDP Rules 2025. NEET-UG eligibility: minimum age 17.

#### 44. [minor] 11 Costs / 1 Summary table - **ADOPTED**

> About Rs 20,000 - 60,000

**Problem.** The itemised lines do not add up to this range. Minimum: server Rs 1,000 x 12 = 12,000, art 0, free sub-domain 0, Play fee US$25 (about Rs 2,200), giving about Rs 14,200. Maximum: server 36,000 + art 15,000 + domain 1,500 + Play about 2,200 + optional Apple US$99 (about Rs 8,700), giving about Rs 63,400.

**Correction.** Change to 'About Rs 15,000 - 65,000 (most of it server time)'. On Render, a Starter web service plus a basic Postgres currently costs roughly US$14-20 per month (about Rs 1,200-1,700), within the stated server line.

**Evidence.** Arithmetic over the plan's own Section 11 line items.

#### 52. [major] 12 Copyright - **ADOPTED**

> Copyright: our code, art, text and sounds are protected automatically

**Problem.** Ownership is never addressed. (1) Under Copyright Act s.17, an employee's work made in the course of employment belongs to the employer, and a 'government work' belongs to the Government by default. This matters for a faculty member at a Government of NCT of Delhi college. (2) Student artists own their work unless they sign a written assignment (ss.18-19). (3) Much of the code and art will be AI-generated, and protection for purely AI-generated works in India is unsettled; the Copyright Office issued a withdrawal notice for the 'Suryast' registration that named an AI as co-author. (4) Third-party assets carry conditions. CC-BY requires attribution, and some itch.io licences forbid redistributing raw assets, which a web game exposes to anyone.

**Correction.** (1) Confirm ownership in writing with MAMC, and register the software copyright in the owner's name (Rs 500). (2) Every student contributor signs an assignment or exclusive licence, with credit. (3) Keep an asset register (source, licence, author) and add an in-game Credits/Licences screen. Use only CC0, CC-BY or licensed assets that permit web distribution. (4) Document human selection and editing of AI output, and do not rely on copyright in purely AI-generated assets.

**Evidence.** Copyright Act 1957 ss.2(k), 17(c), 17(dd), 18 and 19. Copyright Office withdrawal notice on the 'Suryast' registration. Creative Commons licence terms.

## 5. Problems found while building and play-testing

- The plan gives no numbers, so a first balance pass made the Acid Moat kill every cholera bacterium in the stomach - making the cholera, rotavirus and ETEC cases unwinnable to lose. The automated balance tool (`tools/balance.py`) now checks that the best-practice treatment earns all 3 stars in every case while doing nothing, giving antibiotics for viral diarrhoea, skipping ORS/IV fluids, using fluoroquinolones for typhoid, single drugs for H. pylori or loperamide in dysentery all lose stars.
- Case 8 (C. difficile after antibiotics) could not be won as written: if the player correctly stops the culprit antibiotics, no C. difficile ever appears to be treated. The case now starts with C. difficile already present, and the stars reward oral vancomycin/fidaxomicin and keeping antibiotic damage to the flora low.
- A Defence Trial score that rewards "no unnecessary antibiotics" also rewards doing nothing. Trials now have case-specific objectives (worth points), so inaction scores less than correct treatment.
- The anti-precomputation seed only changed towers' initial reload, which finishes before any germ arrives - so it had no effect. It now jitters every reload (same average rate) and is covered by a test.
- Battles that are sped up in the campaign would have been flagged as cheating; the real-time check now applies only to competitive modes.

## 6. Technology adaptation

- **Client**: the plan's Godot 4 client is replaced by an HTML5 canvas + vanilla JavaScript progressive web app. It runs in every browser the plan lists (Android, Windows, Mac, Chromebook - and iPhone), installs to the home screen, needs no app store, and can be hosted on Render from the same service as the API. All art is drawn in code and all sound is synthesised, so there are no third-party assets to license.
- **Server**: Python FastAPI as planned, with SQLAlchemy (SQLite locally, PostgreSQL on Render), server-authoritative economy, layouts, matchmaking, knowledge answers, scoring and awards.
- **Fair play**: the Python simulation is authoritative; the browser runs an exact JavaScript mirror so play is smooth and replays are exact. `tools/parity_gen.py` + `tools/parity_check.mjs` prove the two agree on 1,526 random battles (0 mismatches).

## 7. Recommendations for the team

- Faculty sign-off on `shared/gamedata.json` (matrix, vaccine efficacies, case texts), `shared/questions.json` (136 knowledge-boost questions) and `shared/cards.json` (33 "Why did this happen?" cards) before release; the in-game Guide marks everything as "simplified for the game".
- Use a paid always-on Render plan (Starter or Standard) and a paid PostgreSQL instance for the league week and the live final; the free web service sleeps after 15 minutes and free PostgreSQL expires after 30 days. Keep the Docker/LAN fallback (`docker-compose.yml`) ready for the final.
- Set the grievance contact in the privacy notice, decide the data-retention date, and run "Delete all player data" in the admin console after results are published (DPDP Act 2023).
- Search the IP India trademark registry (classes 9 and 41) and the Play Store for "Body Bastion"; register software copyright; get written assignments from student contributors.
- For a Play Store listing, wrap the PWA in a Trusted Web Activity; start the 12-tester, 14-day closed test early (or use an organisation account).
- Plan v1.2 timeline notes: write the simulation spec first (done: `docs/SPEC.md`), start the Play closed test by week 18, and run the load test (`tools/load_test.py`) on the event-size plan before the league.
