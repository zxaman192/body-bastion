# Balance report

Run `python tools/balance.py` after any change to numbers in `shared/gamedata.json`; it exits with
code 1 if an expectation fails, then re-run the parity check (`python tools/parity_gen.py` and
`node tools/parity_check.mjs`).

## What the tool checks

- **Campaign (10 cases)**: a scripted *best practice* defence (what the case teaches) must earn all
  3 stars; each *naive* defence and *doing nothing* must earn fewer than 3.
- **Defence Trials (3)**: best practice must survive and outscore both a sloppy defence and doing nothing.
- **Tournament (10 bases)**: four scripted attackers (toxin flood, tank first, waves, rush). T1 must be
  a 3-star base, T10 must still give at least 1 star to the best heuristic but never 3, and difficulty
  must not jump by more than one star between neighbours. A naive two-germ attack must never win.

## Final results (v1.2)

| Case | Best practice | Wrong approaches (stars) |
|---|---|---|
| 1 Rotavirus (child) | 3 (ORS + IgA, no antibiotic) | towers without ORS 2, antibiotic 0 (collapse), nothing 0 |
| 2 ETEC traveller | 3 (ORS, no antibiotic) | antibiotic 2, nothing 2 |
| 3 Cholera outbreak | 3 (IV + doxycycline + vaccine) | no IV + wrong drug 1, nothing 0 (collapse) |
| 4 Shigella dysentery | 3 (azithromycin + neutrophils) | ciprofloxacin + loperamide 0, nothing 0 |
| 5 Typhoid | 3 (ceftriaxone/azithro + vaccine) | ciprofloxacin only 2, nothing 2 |
| 6 Amoebic liver abscess | 3 (metronidazole + luminal agent) | metronidazole only 2, nothing 2 |
| 7 H. pylori ulcer | 3 (combination regimen) | single antibiotics 1, nothing 2 |
| 8 C. difficile | 3 (stop culprits + oral vanco/fidaxo) | keep broad-spectrum 1, nothing 2 |
| 9 Ascaris | 3 (albendazole) | wrong drugs 1, nothing 1 |
| 10 Hostel outbreak | 3 (right drug for each germ) | broad-spectrum everything 1, nothing 2 |

| Trial | Best | Sloppy | Nothing |
|---|---|---|---|
| D1 Monsoon clinic | 2078 | 0 (collapse) | 0 (collapse) |
| D2 Dysentery ward | 2250 | 1941 | 2100 |
| D3 Fever clinic | 2098 | 1650 | 1950 |

| Base | Best heuristic | Base | Best heuristic |
|---|---|---|---|
| T1 Clean Canteen | 3 stars | T6 District Hospital Ward | 1 star (54%) |
| T2 Roadside Chaat Stall | 3 stars | T7 Pilgrimage Fairground | 1 star (54%) |
| T3 Village Well | 3 stars | T8 Metro Food Court | 1 star (51%) |
| T4 Hostel Mess | 1 star (66%) | T9 Teaching Hospital | 1 star (55%) |
| T5 Flooded Relief Camp | 1 star (61%) | T10 AIIMS Grand Bastion | 1 star (53%) |

Human players who time tactics (biofilm dome over batteries, immune evasion at the Kupffer gate,
quorum sensing on a raider pack) do better than these heuristics.

## Key tuning decisions

- Acid Moat: 2 damage every 14 ticks (x germ acid tolerance). At the plan's implied strength it
  killed every cholera bacterium in the stomach and made the watery-diarrhoea cases impossible to lose.
- Watery-diarrhoea waves (cases 1-3, trial D1) are heavy enough that towers alone cannot keep
  hydration up: ORS (and IV fluids in cholera) is required, as in real life.
- Amoeba cysts are untouched by immune cells (they sit in the lumen behind a cyst wall), so only a
  luminal agent clears them.
- Building levels scale stats by 100/120/140/160/180%. Raiding germs hit harder (Shigella 30, worm
  55) so that a skilled 3-minute attack can still reach the core of the hardest bases.
- Tournament army (fixed for everyone): 10 cholera, 4 rotavirus, 4 ETEC, 8 Shigella, 3 typhoid,
  2 amoeba, 1 H. pylori, 2 worms, plus one of each tactic.
- Battery reload has a seeded jitter (0-2 ticks around the base interval) so that a command sequence
  optimised offline for one battle seed is not optimal for another.

The Python simulation takes about 90 ms per full battle on a laptop (verification runs on the server
in a worker thread).
