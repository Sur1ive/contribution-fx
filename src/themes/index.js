import gravity from './gravity.js';
import life from './life.js';
import sort from './sort.js';
import ripple from './ripple.js';
import fireworks from './fireworks.js';
import equalizer from './equalizer.js';
import splitflap from './splitflap.js';
import warp from './warp.js';
import railgun from './railgun.js';
import neon from './neon.js';
import replay from './replay.js';
import constellation from './constellation.js';
import circuit from './circuit.js';
import naiwa from './naiwa.js';
import { fxBend, fxStack } from './fx.js';

// Display order for the playground and docs.
export const THEMES = {
  fx1: fxBend, fx2: fxStack,
  circuit, neon, life, replay, constellation, railgun, ripple, sort, splitflap, fireworks, naiwa, equalizer, warp, gravity,
};
