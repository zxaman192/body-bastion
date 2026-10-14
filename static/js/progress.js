// Player progress through the missions, and which parts of the game are shown at each stage.
// Missions are played in gamedata list order; ids are stable keys used for stars, unlocks and research.
import { pref, setPref } from './store.js';
import { missionNumber, missionOpen } from './screens/logic.js';

export { missionById, missionNumber, missionLabel, prerequisite, missionOpen } from './screens/logic.js';

export const OBJECTIVE = 'Keep your patient alive by stopping germs before they reach the Bone Marrow Core, using the right defence for each germ.';

export function missions(gd) {
  return (gd && gd.campaign) || [];
}

function starsOf(stars, id) {
  return Number((stars || {})[String(id)] || 0);
}

export function nextMission(gd, stars) {
  for (const m of missions(gd)) {
    if (!missionOpen(gd, m, stars)) return null;
    if (starsOf(stars, m.id) < 1) {
      if (m.training && tutorialSkipped()) continue;
      return m;
    }
  }
  return null;
}

export function wonCount(gd, stars) {
  return missions(gd).filter((m) => starsOf(stars, m.id) >= 1).length;
}

// ------------------------------------------------------------------ tutorial preferences
export function tutorialSkipped() {
  return !!pref('tutorial.skipped', false);
}

export function skipTutorial() {
  setPref('tutorial.skipped', true);
}

export function resetTutorial() {
  setPref('tutorial.skipped', false);
  setPref('tutorial.seen', {});
  setPref('features.seen', {});
  setPref('home.tour.done', false);
}

export function coachSeen(key) {
  return !!(pref('tutorial.seen', {}) || {})[key];
}

export function markCoachSeen(key) {
  const seen = { ...(pref('tutorial.seen', {}) || {}) };
  seen[key] = true;
  setPref('tutorial.seen', seen);
}

// ------------------------------------------------------------------ progressive features
// `after` is the mission id whose first win reveals the feature on the home screen.
export const FEATURES = [
  { key: 'missions', name: 'Missions', href: '#/campaign', icon: 'campaign', after: null, text: 'Clinical cases, from the basics to advanced reasoning.' },
  { key: 'guide', name: 'Guide', href: '#/guide', icon: 'book', after: null, text: 'Every germ, defence and drug explained.' },
  { key: 'research', name: 'Research', href: '#/research', icon: 'flask', after: 3, text: 'Unlock new drugs and vaccines with ATP and nutrients.' },
  { key: 'build', name: 'Build', href: '#/edit', icon: 'build', after: 2, text: 'Design your own gut base. Other players will attack it.' },
  { key: 'attack', name: 'Raid', href: '#/attack', icon: 'germ', after: 2, text: 'Lead an army of germs against another player\'s base.' },
  { key: 'log', name: 'Defence log', href: '#/log', icon: 'shieldcheck', after: 2, text: 'See who attacked your base and why they won or lost.' },
  { key: 'league', name: 'League', href: '#/league', icon: 'trophy', after: 5, text: 'Identical bases for everyone: one scored attempt each.' },
  { key: 'clan', name: 'Cohort', href: '#/cohort', icon: 'clan', after: 5, text: 'Team up with classmates and take on other cohorts.' },
  { key: 'ranks', name: 'Ranks', href: '#/leaderboards', icon: 'bars', after: 5, text: 'Leaderboards for every mode.' },
];

export function allUnlocked(user) {
  if (tutorialSkipped() || pref('ui.everything', false)) return true;
  return !!(user && ['teacher', 'admin', 'observer'].includes(user.role));
}

export function featureStates(gd, stars, user) {
  const all = allUnlocked(user);
  const seen = pref('features.seen', {}) || {};
  const out = {};
  for (const f of FEATURES) {
    const open = all || f.after === null || starsOf(stars, f.after) >= 1;
    const n = f.after === null ? null : missionNumber(gd, f.after);
    out[f.key] = { ...f, open, isNew: open && f.after !== null && !all && !seen[f.key], afterNumber: n };
  }
  return out;
}

export function markFeaturesSeen(keys) {
  const seen = { ...(pref('features.seen', {}) || {}) };
  for (const k of keys) seen[k] = true;
  setPref('features.seen', seen);
}
