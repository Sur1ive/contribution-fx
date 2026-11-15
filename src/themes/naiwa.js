import { PITCH, n, rect } from '../core/svg.js';
import {
  DOWN, INK, UP, armsDown, armsOnBelly, belly, closedEyes, eye, gradient, laughMouth, line, pose, timeline, torso,
} from './naiwa-art.js';

// 奶蛙 (Naiwa), the laughing frog-dragon meme. It hops in along the top of the
// graph, trips and faceplants, gets back up and laughs so hard that every active
// day catches it and laughs along, then hops away. The character is a stack of
// groups (x, y, roll, squash) so each motion keeps its own easing.

const CYCLE = 12; // seconds
const SKY = 66;
const HOP = 16;
const IN = [-0.07, 0.06, 0.15, 0.24, 0.33]; // landing spots before the trip (fraction of width)
const TRIP = 0.43;
const OUT = [0.6, 0.76, 0.92, 1.1];
const T_IN = 0.8;
const STEP_IN = 0.72;
const AIR_IN = 0.6;
const T_TRIP = T_IN + (IN.length - 1) * STEP_IN;
const T_CRASH = T_TRIP + 0.6;
const T_UP = 5.3;
const T_STAND = 5.85;
const LAUGH = [5.95, 9.35];
const BOUNCE = 0.24;
const T_OUT = 9.45;
const STEP_OUT = 0.55;
const AIR_OUT = 0.45;
const SPREAD = 650; // px per second, how fast the laughter catches on
const HEAD_IN = 6.0;
const HEAD_OUT = 9.0;
const HAHA = ['哈哈哈', '哈哈哈哈', '哈哈', '哈哈哈哈哈', '哈哈哈'];

const { frames, shown, p } = timeline(CYCLE);

function character() {
  return (
    torso('fx-naiwa-b') +
    belly() +
    // Arms hanging, then arms clutching the belly.
    armsDown('a0') +
    armsOnBelly('a1') +
    // Faces: blank stare, dizzy, belly laugh.
    `<g class="f0">${eye(-6.5)}${eye(6.5)}<path d="M-4.5-44.5H4.5" ${line} stroke-width=".7"/></g>` +
    `<g class="f1"><path d="M-8-52l4 4m0-4l-4 4M4-52l4 4m0-4l-4 4M-4-44q1-1 2 0t2 0 2 0 2 0" ${line} stroke-width=".8"/></g>` +
    `<g class="f2">${closedEyes}${laughMouth}</g>`
  );
}

export default {
  name: 'naiwa',
  description: 'Naiwa (奶蛙) hops across your graph, faceplants, then laughs so hard that every busy day starts laughing too.',
  extraTop: SKY,

  render(ctx) {
    const { cal, colors, rng, origin } = ctx;
    const W = ctx.width;
    const dur = n(ctx.duration(CYCLE));
    const anim = (cls, name = cls) => `.${cls}{animation:${name} ${dur}s linear infinite}`;
    const X = (f) => f * W;
    const base = origin.y - 1;

    // Hops: [start, from, to, air].
    const hops = [];
    for (let i = 0; i < IN.length - 1; i++) hops.push([T_IN + i * STEP_IN, X(IN[i]), X(IN[i + 1]), AIR_IN]);
    const tripX = X(TRIP);
    const outs = [tripX, ...OUT.map(X)];
    const hopsOut = [];
    for (let i = 0; i < OUT.length; i++) hopsOut.push([T_OUT + i * STEP_OUT, outs[i], outs[i + 1], AIR_OUT]);
    const allHops = [...hops, ...hopsOut];

    const xs = [];
    const ys = [];
    const sq = [];
    const sh = [];
    const tx = (x) => `transform:translateX(${n(x)}px);opacity:1`;
    const ty = (y) => `transform:translateY(${n(y)}px)`;
    const sc = (s, x = 0) => `transform:translateX(${n(x)}px) scale(${n(s)})`;
    const hopFrames = ([s, from, to, air]) => {
      xs.push([s, tx(from), 'linear'], [s + air, tx(to)]);
      ys.push([s, ty(0), UP], [s + air / 2, ty(-HOP), DOWN], [s + air, ty(0)]);
      sh.push([s, sc(1), UP], [s + air / 2, sc(0.55), DOWN], [s + air, sc(1)]);
      sq.push([s, pose(0, 1, 1)], [s + 0.06, pose(0, 0.9, 1.1)], [s + air / 2, pose(0, 1, 1)],
        [s + air, pose(0, 1.16, 0.84)], [s + air + 0.08, pose(0, 1, 1)]);
    };
    hops.forEach(hopFrames);

    // The trip: a low hop that ends flat on its face, lifted so it lies on the ground.
    xs.push([T_TRIP, tx(X(IN[IN.length - 1])), 'linear'], [T_CRASH, tx(tripX)]);
    ys.push([T_TRIP, ty(0), UP], [T_TRIP + 0.25, ty(-10), DOWN], [T_CRASH, ty(-22)], [T_CRASH + 0.08, ty(-25)],
      [T_CRASH + 0.16, ty(-22)], [T_UP, ty(-22), 'cubic-bezier(.3,0,.3,1)'], [T_UP + 0.4, ty(0)]);
    sh.push([T_TRIP, sc(1), UP], [T_TRIP + 0.25, sc(0.7), DOWN], [T_CRASH, sc(1.5, 30)], [T_UP, sc(1.5, 30)], [T_UP + 0.4, sc(1)]);
    sq.push([T_TRIP, pose(0, 1, 1)], [T_TRIP + 0.06, pose(0, 0.9, 1.1)], [T_TRIP + 0.3, pose(0, 1, 1)]);
    const roll = [[0, 'transform:rotate(0deg)'], [T_TRIP + 0.08, 'transform:rotate(0deg)', 'cubic-bezier(.5,0,.9,.5)'],
      [T_CRASH, 'transform:rotate(90deg)'], [T_CRASH + 0.08, 'transform:rotate(84deg)'], [T_CRASH + 0.16, 'transform:rotate(90deg)'],
      [T_UP, 'transform:rotate(90deg)', 'cubic-bezier(.3,0,.3,1)'], [T_UP + 0.4, 'transform:rotate(-8deg)'], [T_STAND, 'transform:rotate(0deg)']];

    // The laugh: lean back and bounce on the spot.
    ys.push([LAUGH[0], ty(0)]);
    sq.push([LAUGH[0], pose(0, 1, 1)]);
    for (let t = LAUGH[0] + 0.1, k = 0; t + BOUNCE <= LAUGH[1]; t += BOUNCE, k++) {
      const lean = -7 + (k % 2) * 2;
      ys.push([t, ty(0), UP], [t + BOUNCE / 2, ty(-3), DOWN]);
      sq.push([t, pose(lean, 1.05, 0.93)], [t + BOUNCE / 2, pose(lean + 1, 0.97, 1.04)]);
    }
    ys.push([LAUGH[1], ty(0)]);
    sq.push([LAUGH[1], pose(0, 1, 1)]);
    hopsOut.forEach(hopFrames);

    // Cells sink a little under every landing; the faceplant flattens a wider patch.
    const colOf = (x) => Math.floor((x - origin.x) / PITCH);
    const dips = new Map();
    const landings = [...hops.map(([s, , to, air]) => [s + air, to - 9, to + 9, 2.5]),
      [T_CRASH, tripX - 12, tripX + 64, 4],
      ...hopsOut.map(([s, , to, air]) => [s + air, to - 9, to + 9, 2.5])];
    let style = '';
    landings.forEach(([t, x0, x1, depth], j) => {
      let used = false;
      for (let c = colOf(x0); c <= colOf(x1); c++) {
        if (c < 0 || c >= cal.cols || dips.has(c)) continue;
        dips.set(c, j);
        used = true;
      }
      if (!used) return;
      style += frames(`d${j}`, [[t - 0.01, ty(0), 'cubic-bezier(.2,.8,.4,1)'], [t + 0.06, ty(depth), 'cubic-bezier(.4,0,.4,1)'], [t + 0.3, ty(0)]]) +
        anim(`d${j}`);
    });

    const cells = cal.days.map((d) => {
      const p = ctx.pos(d.x, d.y);
      const dip = dips.get(d.x);
      return rect(p.x, p.y, `class="l${d.level}${dip === undefined ? '' : ` d${dip}`}"`);
    });

    // Laughter spreads outward from Naiwa: every active day turns into a tiny laughing face.
    const cx = tripX;
    const cy = base - 25;
    const heads = cal.days.filter((d) => d.level > 0).map((d) => {
      const p = ctx.pos(d.x, d.y);
      const delay = Math.hypot(p.x + 5.5 - cx, p.y + 5.5 - cy) / SPREAD;
      return `<g transform="translate(${n(p.x)} ${n(p.y)})"><g class="mh" style="animation-delay:${n(ctx.duration(delay))}s"><use href="#fx-naiwa-m" class="mb" style="animation-delay:${n(-ctx.duration(rng() * 0.3))}s"/></g></g>`;
    });

    const haha = HAHA.map((txt, i) => {
      const side = i % 2 ? -1 : 1;
      const x = cx + side * (34 + (i % 3) * 6);
      const y = base - 46 - (i % 3) * 7;
      return `<g transform="rotate(${side * (8 + i * 2)} ${n(x)} ${n(y)})"><text class="ht" x="${n(x)}" y="${n(y)}" style="animation-delay:${n(ctx.duration(i * 0.7))}s">${txt}</text></g>`;
    }).join('');

    const dust = Array.from({ length: 7 }, (_, i) => {
      const a = -168 + i * 26 + (rng() - 0.5) * 10;
      return `<g transform="translate(${n(tripX + 26 + (rng() - 0.5) * 40)} ${n(base)}) rotate(${n(a)})"><circle class="du" r="${n(2 + rng() * 1.5)}"/></g>`;
    }).join('');

    const starAt = (a) => `<path transform="rotate(${a}) translate(9 0)" d="M0-3.6L1.1-1.1 3.6 0 1.1 1.1 0 3.6-1.1 1.1-3.6 0-1.1-1.1Z" fill="#ffd84a" stroke="#b07a00" stroke-width=".4"/>`;
    const dizzy = `<g class="zz" transform="translate(${n(tripX + 50)} ${n(base - 38)}) scale(1 .45)"><g class="zs">${starAt(0)}${starAt(120)}${starAt(240)}</g></g>`;

    const shake = [[T_CRASH - 0.01, 'transform:translate(0,0)'], [T_CRASH + 0.03, 'transform:translate(0,3px)'],
      [T_CRASH + 0.09, 'transform:translate(-2px,-1.5px)'], [T_CRASH + 0.17, 'transform:translate(1.5px,1px)'],
      [T_CRASH + 0.27, 'transform:translate(-.8px,0)'], [T_CRASH + 0.42, 'transform:translate(0,0)']];
    for (let t = HEAD_IN + 0.3, k = 0; t < HEAD_OUT; t += 0.11, k++) {
      shake.push([t, `transform:translate(${k % 2 ? -0.5 : 0.5}px,${k % 3 ? 0.4 : -0.4}px)`]);
    }
    shake.push([HEAD_OUT + 0.11, 'transform:translate(0,0)']);

    style +=
      `.nx,.mh,.ht,.du,.zz{opacity:0}` +
      `.nr,.nq{transform-origin:0 0}` +
      `.sh,.mh,.mb,.ht,.du{transform-box:fill-box;transform-origin:center}` +
      frames('nx', xs) + anim('nx') +
      frames('ny', ys) + anim('ny') +
      frames('nr', roll) + anim('nr') +
      frames('nq', sq) + anim('nq') +
      frames('sh', sh) + anim('sh') +
      shown('f0', T_TRIP + 0.12, LAUGH[1] + 0.05, false) + anim('f0') +
      shown('f1', T_TRIP + 0.12, T_STAND - 0.1) + anim('f1') +
      shown('f2', T_STAND - 0.1, LAUGH[1] + 0.05) + anim('f2') + anim('a1', 'f2') +
      shown('a0', T_STAND - 0.1, LAUGH[1] + 0.05, false) + anim('a0') +
      frames('gg', shake) + anim('gg') +
      `@keyframes mh{0%,${p(HEAD_IN)}{opacity:0;transform:scale(0)}${p(HEAD_IN + 0.12)}{opacity:1;transform:scale(1.3)}` +
      `${p(HEAD_IN + 0.22)},${p(HEAD_OUT)}{opacity:1;transform:scale(1)}${p(HEAD_OUT + 0.14)},100%{opacity:0;transform:scale(0)}}` + anim('mh') +
      `@keyframes mb{0%,100%{transform:translateY(0) rotate(-7deg)}50%{transform:translateY(-1.8px) rotate(7deg)}}` +
      `.mb{animation:mb ${n(ctx.duration(0.3))}s ease-in-out infinite}` +
      `@keyframes ht{0%,${p(HEAD_IN)}{opacity:0;transform:translateY(4px) scale(.5)}${p(HEAD_IN + 0.14)}{opacity:1;transform:translateY(0) scale(1.15)}` +
      `${p(HEAD_IN + 0.28)}{opacity:1;transform:translateY(-2px) scale(1)}${p(HEAD_IN + 1.1)}{opacity:1;transform:translateY(-10px) scale(1)}` +
      `${p(HEAD_IN + 1.4)},100%{opacity:0;transform:translateY(-14px) scale(1)}}` + anim('ht') +
      `.ht{font:900 14px "PingFang SC","Microsoft YaHei","Noto Sans CJK SC","Noto Sans SC",sans-serif;fill:#ffd23f;stroke:#7a4b00;stroke-width:2.6px;stroke-linejoin:round;paint-order:stroke;text-anchor:middle}` +
      `@keyframes du{0%,${p(T_CRASH - 0.01)}{opacity:0;transform:translateX(0) scale(.4)}${p(T_CRASH + 0.03)}{opacity:.7;transform:translateX(3px) scale(.8)}` +
      `${p(T_CRASH + 0.5)},100%{opacity:0;transform:translateX(18px) scale(1.5)}}` + anim('du') +
      `.du{fill:${colors.text}}` +
      shown('zz', T_CRASH + 0.15, T_UP + 0.1) + anim('zz') +
      `@keyframes zs{to{transform:rotate(360deg)}}.zs{animation:zs ${n(ctx.duration(0.8))}s linear infinite}`;

    const defs =
      `<defs>${gradient('fx-naiwa-b')}` +
      `<g id="fx-naiwa-m"><ellipse cx="5.5" cy="6" rx="5.6" ry="5.1" fill="url(#fx-naiwa-b)" stroke="#c48a12" stroke-width=".4"/>` +
      `<path d="M2.6 6.2Q5.5 5.4 8.4 6.2Q8 10.3 5.5 10.4Q3 10.3 2.6 6.2Z" fill="#5a1c17"/>` +
      `<path d="M2.9 6.3Q5.5 5.6 8.1 6.3L8 7Q5.5 6.4 3 7Z" fill="#fff"/>` +
      `<path d="M2.2 4Q3.2 2.8 4.2 4M6.8 4Q7.8 2.8 8.8 4" fill="none" stroke="${INK}" stroke-width=".6" stroke-linecap="round"/></g></defs>`;

    const body =
      defs +
      `<g class="gg">${cells.join('')}</g>` +
      `<g>${heads.join('')}</g>` +
      dust +
      `<g transform="translate(0 ${n(base)})"><g class="nx"><ellipse class="sh" cx="0" cy=".5" rx="17" ry="2.6" fill="${colors.text}" fill-opacity=".14"/>` +
      `<g class="ny"><g class="nr"><g class="nq">${character()}</g></g></g></g></g>` +
      dizzy +
      haha;

    return { style, body };
  },
};
