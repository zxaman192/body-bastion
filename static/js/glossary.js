// Plain-language glossary. The first time a player meets a medical term it is followed by a short
// explanation in brackets; after that the term is underlined and a tap shows the full definition.
import { pref, setPref } from './store.js';

export const TERMS = [
  { k: 'ORS', re: /\bORS\b/, short: 'oral rehydration salts: a drink of water, salt and sugar', long: 'Oral rehydration salts: clean water with exact amounts of salt and glucose. The gut can still absorb them during diarrhoea, and water follows them back into the body.' },
  { k: 'zinc', re: /\bzinc\b/i, short: 'a mineral that shortens diarrhoea in young children', long: 'Zinc given for 10-14 days to children under 5 with diarrhoea makes the illness shorter and milder and lowers the chance of another bout.' },
  { k: 'dehydration', re: /\bdehydrat(ion|ed)\b/i, short: 'losing more water and salt than the body takes in', long: 'Dehydration means the body has lost more water and salt than it has taken in. Sunken eyes, thirst and a slow skin pinch are signs; severe dehydration causes shock and death, especially in young children.' },
  { k: 'hydration', re: /\bhydration\b/i, short: 'how much water the body holds', long: 'Hydration is how much water and salt the body holds. Diarrhoea and vomiting drain it; severe dehydration causes shock and death.' },
  { k: 'IV', re: /\bIV\b|\bintravenous/i, short: 'fluid given straight into a vein', long: 'Intravenous (IV) fluid such as Ringer\'s lactate goes straight into a vein. It is needed when a patient is too dehydrated or drowsy to drink enough ORS.' },
  { k: 'antibiotic', re: /\bantibiotics?\b/i, short: 'a medicine that kills bacteria, and does nothing to viruses', long: 'Antibiotics kill bacteria or stop them growing. They have no effect on viruses, and every course also harms the good bacteria in the gut and breeds resistance.' },
  { k: 'broad', re: /\bbroad-spectrum\b/i, short: 'kills many kinds of bacteria, including the good ones', long: 'A broad-spectrum antibiotic kills many kinds of bacteria at once, including the helpful gut flora. That collateral damage can let C. difficile or Candida take over.' },
  { k: 'resistance', re: /\b(antibiotic |antimicrobial |drug )?resistance\b/i, short: 'germs no longer killed by a drug', long: 'Resistance is when germs change so a drug no longer kills them. Every use of a drug favours the resistant survivors, which then spread.' },
  { k: 'flora', re: /\b(gut flora|microbiome|microbiota)\b/i, short: 'the harmless bacteria that normally live in the gut', long: 'The gut flora (microbiome) is the trillions of harmless bacteria living in the gut. They crowd out harmful germs, which is called colonisation resistance.' },
  { k: 'virus', re: /\bvirus(es)?\b/i, short: 'a tiny germ that can only multiply inside our cells', long: 'A virus is a packet of genes in a protein coat. It can only multiply inside our cells, so antibiotics have nothing to act on.' },
  { k: 'bacterium', re: /\bbacteri(um|a)\b/i, short: 'single-celled living germs', long: 'Bacteria are single living cells with their own machinery. Most are harmless or helpful; some cause disease and can be killed by the right antibiotic.' },
  { k: 'Paneth', re: /\bPaneth cells?\b/i, short: 'gut-lining cells that release natural antibiotics', long: 'Paneth cells sit deep in the crypts of the small intestine and release defensins and lysozyme, the body\'s own antimicrobial proteins.' },
  { k: 'defensin', re: /\bdefensins?\b/i, short: 'the body\'s own germ-killing proteins', long: 'Defensins are small proteins made by Paneth cells and white cells that punch holes in bacteria.' },
  { k: 'IgA', re: /\bIgA\b/, short: 'the antibody that guards the gut surface', long: 'Secretory IgA is the antibody made for the gut surface. It sticks to germs and toxins and stops them attaching to the gut wall.' },
  { k: 'antibody', re: /\bantibod(y|ies)\b/i, short: 'a protein that locks onto one particular germ', long: 'Antibodies are Y-shaped proteins made by B cells. Each one locks onto one particular germ or toxin and marks it for destruction or blocks it.' },
  { k: 'macrophage', re: /\bmacrophages?\b/i, short: 'a large immune cell that swallows germs', long: 'Macrophages are large immune cells that swallow and digest germs. Some germs, such as typhoid, can survive inside them until T cells activate them.' },
  { k: 'neutrophil', re: /\bneutrophils?\b/i, short: 'the commonest white cell; pus is mostly neutrophils', long: 'Neutrophils are the commonest white blood cells. They rush to infection sites and kill bacteria; pus is mostly dead neutrophils.' },
  { k: 'Kupffer', re: /\bKupffer cells?\b/i, short: 'the liver\'s own germ-eating cells', long: 'Kupffer cells are macrophages that line the liver\'s blood channels and filter germs out of the blood arriving from the gut.' },
  { k: 'peristalsis', re: /\bperistalsis\b/i, short: 'waves of muscle that push gut contents along', long: 'Peristalsis is the wave of muscle contractions that moves food, and germs, along the gut. Diarrhoea is partly the body flushing germs out.' },
  { k: 'loperamide', re: /\bloperamide\b/i, short: 'an anti-diarrhoea drug that slows the gut', long: 'Loperamide slows the gut. It is dangerous in dysentery and C. difficile infection because it traps invasive germs inside, and it is never given to young children with diarrhoea.' },
  { k: 'dysentery', re: /\bdysentery\b/i, short: 'diarrhoea with blood and mucus from germs invading the gut wall', long: 'Dysentery is diarrhoea with blood and mucus, usually with fever and cramps, caused by germs such as Shigella or amoebae invading the colon wall.' },
  { k: 'toxin', re: /\b(entero)?toxins?\b/i, short: 'a poison made by a germ', long: 'A toxin is a poison made by a germ. Gut toxins such as cholera toxin make the intestine pour out water and salt.' },
  { k: 'vaccine', re: /\bvaccin(e|es|ate|ated|ation)\b/i, short: 'trains the immune system before the real infection', long: 'A vaccine shows the immune system a harmless form or part of a germ so it is ready when the real germ arrives. It lowers the risk but rarely to zero.' },
  { k: 'luminal', re: /\bluminal (agent|amoebicide)s?\b/i, short: 'a drug that stays inside the gut to kill cysts there', long: 'A luminal agent (paromomycin or diloxanide furoate) is barely absorbed, so it stays inside the gut (the lumen) and kills the amoebic cysts that tissue drugs miss.' },
  { k: 'cyst', re: /\bcysts?\b/i, short: 'a parasite\'s tough resting form', long: 'A cyst is the tough resting form of a parasite. It survives outside the body and spreads the infection to the next person.' },
  { k: 'urease', re: /\burease\b/i, short: 'an enzyme that neutralises stomach acid', long: 'Urease turns urea into ammonia. H. pylori uses it to neutralise the stomach acid around itself.' },
  { k: 'PPI', re: /\bPPIs?\b|\bproton pump inhibitors?\b/i, short: 'a medicine that lowers stomach acid', long: 'A proton pump inhibitor (PPI) such as omeprazole switches off acid production in the stomach. It helps H. pylori antibiotics work, but it also weakens the acid barrier against swallowed germs.' },
  { k: 'anthelmintic', re: /\banthelmintics?\b/i, short: 'a medicine that kills worms', long: 'Anthelmintics such as albendazole kill parasitic worms. Antibiotics do not work on worms.' },
  { k: 'marrow', re: /\bbone marrow\b/i, short: 'the tissue inside bones that makes blood and immune cells', long: 'Bone marrow is the soft tissue inside bones that makes red cells, platelets and every immune cell.' },
  { k: 'lumen', re: /\blumen\b/i, short: 'the hollow inside of the gut', long: 'The lumen is the hollow inside of the gut, where food and germs travel.' },
  { k: 'villi', re: /\bvill(i|us)\b/i, short: 'tiny finger-like folds that absorb food and water', long: 'Villi are tiny finger-like folds lining the small intestine. They give it a huge surface for absorbing food, water and salts.' },
  { k: 'mucus', re: /\bmucus\b/i, short: 'a slimy layer that keeps germs off the gut wall', long: 'Mucus from goblet cells forms a slimy layer that keeps bacteria away from the gut wall.' },
  { k: 'combination', re: /\bcombination therapy\b/i, short: 'several drugs given together', long: 'Combination therapy gives several drugs together so that germs resistant to one drug are still killed by another.' },
  { k: 'portal', re: /\bportal vein\b/i, short: 'the vein carrying blood from the gut to the liver', long: 'The portal vein carries blood from the gut to the liver, which is how gut germs such as amoebae and typhoid reach it.' },
  { k: 'colonisation', re: /\bcolonisation resistance\b/i, short: 'good bacteria crowding out bad ones', long: 'Colonisation resistance is the protection the normal gut flora gives by using up food and space and making substances that keep harmful germs out.' },
  { k: 'anaemia', re: /\banaemi(a|c)\b/i, short: 'too little haemoglobin in the blood', long: 'Anaemia means too little haemoglobin in the blood, so less oxygen reaches the body. In children it causes tiredness and poor growth.' },
];

const NAME_TAIL = /^(\s+(\+\s+)?[A-Z][\w'-]*){0,2}\s+(Tower|Station|Cannon|Reserve|Gate|Wall|Garden|Lab|Battery|Patch|Moat|Conveyor|Stand|Plant|Absorber)(?![a-z])/;

let seen = null;
function loadSeen() {
  if (!seen) seen = new Set(pref('glossary.seen', []) || []);
  return seen;
}

function saveSeen() {
  setPref('glossary.seen', [...loadSeen()]);
}

export function resetGlossary() {
  seen = new Set();
  saveSeen();
}

export function term(key) {
  return TERMS.find((t) => t.k === key) || null;
}

let tip = null;
function closeTip() {
  if (tip) { tip.remove(); tip = null; }
  document.removeEventListener('pointerdown', onDoc, true);
  document.removeEventListener('keydown', onEsc, true);
}
function onDoc(e) { if (tip && !tip.contains(e.target)) closeTip(); }
function onEsc(e) { if (e.key === 'Escape') closeTip(); }

export function showTerm(btn, t) {
  closeTip();
  tip = document.createElement('div');
  tip.className = 'gloss-tip';
  tip.setAttribute('role', 'tooltip');
  const strong = document.createElement('strong');
  strong.textContent = btn.textContent;
  const p = document.createElement('span');
  p.textContent = ` ${t.long}`;
  tip.append(strong, p);
  document.body.append(tip);
  const r = btn.getBoundingClientRect();
  const w = Math.min(300, window.innerWidth - 24);
  tip.style.width = `${w}px`;
  const left = Math.max(12, Math.min(window.innerWidth - w - 12, r.left + r.width / 2 - w / 2));
  let top = r.bottom + 8;
  if (top + tip.offsetHeight > window.innerHeight - 8) top = Math.max(8, r.top - tip.offsetHeight - 8);
  tip.style.left = `${left}px`;
  tip.style.top = `${top}px`;
  setTimeout(() => {
    document.addEventListener('pointerdown', onDoc, true);
    document.addEventListener('keydown', onEsc, true);
  }, 0);
}

// Turns a plain string into text and term buttons. `inline: false` never adds bracketed explanations
// (used for long reference text such as "Learn why" panels).
export function termify(text, { inline = true, mark = true, maxInline = 1 } = {}) {
  const frag = document.createDocumentFragment();
  const s = String(text || '');
  const hits = [];
  for (const t of TERMS) {
    // skip a term that is part of a building's name ("Paneth Cell Tower", "ORS + Zinc Station")
    const re = new RegExp(t.re.source, t.re.flags.includes('i') ? 'gi' : 'g');
    let m;
    while ((m = re.exec(s))) {
      const end = m.index + m[0].length;
      if (!NAME_TAIL.test(s.slice(end))) {
        hits.push({ t, i: m.index, j: end, text: m[0] });
        break;
      }
    }
  }
  hits.sort((a, b) => a.i - b.i);
  const kept = [];
  let end = -1;
  for (const hit of hits) {
    if (hit.i >= end) { kept.push(hit); end = hit.j; }
  }
  const known = loadSeen();
  let pos = 0;
  let changed = false;
  for (const hit of kept) {
    if (hit.i > pos) frag.append(document.createTextNode(s.slice(pos, hit.i)));
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'gloss-term';
    btn.textContent = hit.text;
    btn.setAttribute('aria-label', `${hit.text}: ${hit.t.short}. Tap for more.`);
    btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); showTerm(btn, hit.t); });
    frag.append(btn);
    if (inline && maxInline > 0 && !known.has(hit.t.k)) {
      maxInline -= 1;
      const small = document.createElement('span');
      small.className = 'gloss-inline';
      small.textContent = ` (${hit.t.short})`;
      frag.append(small);
      if (mark) { known.add(hit.t.k); changed = true; }
    }
    pos = hit.j;
  }
  if (pos < s.length) frag.append(document.createTextNode(s.slice(pos)));
  if (changed) saveSeen();
  return frag;
}

export function termPara(text, opts, cls) {
  const p = document.createElement('p');
  if (cls) p.className = cls;
  p.append(termify(text, opts));
  return p;
}
