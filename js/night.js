import { mulberry32 } from './noise.js';

// Every watch is a different night. One seed (random, or `?night=N` to replay one) decides which repairs the gale has
// left, where the keeper's things have been put away, which panes are salted, which ship calls in, and what goes
// wrong while she is passing. Everything else in the game reads it from NIGHT; config.js and tower.js read it at import
// time, so this module must not depend on any other game module.
const param = parseInt(new URLSearchParams(location.search).get('night'), 10);
const no = Number.isFinite(param) && param > 0 ? param % 10000 || 1 : 1 + Math.floor(Math.random() * 9999);
const rnd = mulberry32(no * 7919 + 17);
const pick = (list) => list[Math.floor(rnd() * list.length)];
const shuffle = (list) => { const a = [...list]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

// the repairs: at least two of the three each night
let repairs = { window: rnd() < 0.7, belt: rnd() < 0.6, boat: rnd() < 0.5 };
while (Object.values(repairs).filter(Boolean).length < 2) repairs[pick(['window', 'belt', 'boat'])] = true;

// which casement has torn loose: [floor id, window index on that floor, how the room is named in the tasks]
const BROKEN = [['bedroom', 0, 'bedroom'], ['bedroom', 0, 'bedroom'], ['guest', 0, "assistant's room"], ['parlour', 0, 'parlour'], ['library', 1, 'library'], ['workshop', 0, 'lamp workshop']];
const broken = repairs.window ? (([floor, index, room]) => ({ floor, index, room }))(pick(BROKEN)) : null;

// salt on the lantern glass: four to six of the sixteen sides (13 is the gallery door)
const sides = shuffle([...Array(16).keys()].filter(i => i !== 13));
const dirtyPanes = sides.slice(0, 4 + Math.floor(rnd() * 3)).sort((a, b) => a - b);

const SHIPS = [
  { name: 'SS Aurora', short: 'Aurora', trouble: "We've lost our bearings in this muck and our compass is playing up." },
  { name: 'SS Corrievale', short: 'Corrievale', trouble: 'A sea has stove in the wheelhouse windows and our compass with them. We are steering by guesswork.' },
  { name: 'SS Morven', short: 'Morven', trouble: 'Our steering gear has jammed and we are steering on the engines alone.' },
  { name: 'SS Elspeth Grant', short: 'Elspeth Grant', trouble: 'The chart room is flooded and we have not had a sight of anything since noon.' },
  { name: 'SS Thistle', short: 'Thistle', trouble: 'Our port engine is out and we are being set down toward the reef.' },
];

const WEATHER = [
  { baro: '28.3', wind: 'NW, whole gale, veering' },
  { baro: '28.1', wind: 'W by S, storm force' },
  { baro: '28.4', wind: 'SW, whole gale, backing NW' },
  { baro: '28.6', wind: 'NNW, strong gale, squally' },
];

export const NIGHT = {
  no, rnd,
  repairs, broken, dirtyPanes,
  // where things were put away: the room modules build each item only at tonight's spot
  matches: pick(['dresser', 'range', 'mantel']),
  rag: pick(['bench', 'lantern', 'workshop']),
  belt: repairs.belt ? pick(['crate', 'shed', 'workshop']) : null,
  ship: { ...pick(SHIPS), dir: rnd() < 0.5 ? 1 : -1, passage: 130 + rnd() * 50 },
  callDelay: 20 + rnd() * 25,
  // one or two mishaps while the ship is passing, seconds after the wireless is answered
  incidents: shuffle(['squall', 'leak', 'stall']).slice(0, 1 + (rnd() < 0.5 ? 1 : 0)).map((kind, i) => ({ kind, at: 25 + i * 45 + rnd() * 25 })),
  weather: pick(WEATHER),
};

// where each item can be found, for the hints
export const PLACES = {
  matches: { dresser: 'on the <b>kitchen dresser</b>', range: 'on the shelf over the <b>kitchen range</b>', mantel: 'on the <b>parlour mantelpiece</b>' },
  rag: { bench: 'on the cleaning bench in the <b>watch room</b>', lantern: 'on the shelf in the <b>lantern room</b>', workshop: 'on the polishing table in the <b>lamp workshop</b>' },
  belt: { crate: 'in a crate in the <b>store room</b>', shed: 'on the workbench in the <b>oil store</b>', workshop: 'on the parts drawers in the <b>lamp workshop</b>' },
};
export const placeOf = (item) => PLACES[item][NIGHT[item]];

// a URL that replays this night (the quality setting reloads the page through it)
export const nightURL = (n = no) => { const u = new URL(location.href); u.searchParams.set('night', n); return u.href; };
