<div align="center">

# contribution-fx

**Your contribution graph, but alive.**

Turn your GitHub contribution graph into animated SVG art for your profile README.<br>
Five effects · five palettes · light & dark · one GitHub Action · zero dependencies.

<a href="https://sur1ive.github.io/contribution-fx/"><b>▶ Try it with your username</b></a> ·
<a href="#quick-start">Quick start</a> ·
<a href="#themes">Themes</a> ·
<a href="#options">Options</a> ·
<a href="README.zh-CN.md">中文</a>

<br><br>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="examples/gravity-dark.svg">
  <img alt="contribution-fx gravity theme" src="examples/gravity-light.svg">
</picture>

[![CI](https://github.com/Sur1ive/contribution-fx/actions/workflows/ci.yml/badge.svg)](https://github.com/Sur1ive/contribution-fx/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
![Dependencies: 0](https://img.shields.io/badge/dependencies-0-brightgreen.svg)
[![Stars](https://img.shields.io/github/stars/Sur1ive/contribution-fx?style=social)](https://github.com/Sur1ive/contribution-fx/stargazers)

</div>

## Themes

All examples below are real output of this action (rendered from demo data). Every theme loops forever, respects `prefers-reduced-motion`, and falls back to your normal graph when animations are off.

### `gravity`
Every active day drops to the bottom of its week, bounces, rests, then floats back into place.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="examples/gravity-dark.svg">
  <img alt="gravity" src="examples/gravity-light.svg">
</picture>

### `life`
Your graph seeds [Conway's Game of Life](https://en.wikipedia.org/wiki/Conway%27s_Game_of_Life). Watch a year of commits evolve, generation by generation.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="examples/life-dark.svg">
  <img alt="life" src="examples/life-light.svg">
</picture>

### `sort`
Every day travels to its sorted position until the year becomes a perfect gradient — then everything flies home.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="examples/sort-dark.svg">
  <img alt="sort" src="examples/sort-light.svg">
</picture>

### `ripple`  <sub>shown with `palette=ocean`</sub>
Your busiest days hit the graph like raindrops on water and send shockwaves across the year.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="examples/ripple-dark.svg">
  <img alt="ripple" src="examples/ripple-light.svg">
</picture>

### `fireworks`  <sub>shown with `palette=sunset`</sub>
Your best days launch fireworks. Because shipping deserves a celebration.

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="examples/fireworks-dark.svg">
  <img alt="fireworks" src="examples/fireworks-light.svg">
</picture>

## Quick start

It takes about two minutes. You need a [profile repository](https://docs.github.com/en/account-and-profile/setting-up-and-managing-your-github-profile/customizing-your-profile/managing-your-profile-readme) (a public repo named exactly like your username).

**1. Add a workflow** to your profile repo as `.github/workflows/contribution-fx.yml`:

```yaml
name: contribution-fx

on:
  schedule:
    - cron: "0 0 * * *" # refresh daily
  workflow_dispatch:

permissions:
  contents: write

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: Sur1ive/contribution-fx@v1
        with:
          github_user_name: ${{ github.repository_owner }}
          outputs: |
            dist/contribution-fx.svg?theme=gravity
            dist/contribution-fx-dark.svg?theme=gravity&mode=dark

      - uses: crazy-max/ghaction-github-pages@v5
        with:
          target_branch: output
          build_dir: dist
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**2. Run it once** from the *Actions* tab (*contribution-fx → Run workflow*). It creates an `output` branch with your SVGs.

**3. Paste this into your `README.md`** (replace `USERNAME`):

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/USERNAME/USERNAME/output/contribution-fx-dark.svg" />
  <img alt="contribution-fx" src="https://raw.githubusercontent.com/USERNAME/USERNAME/output/contribution-fx.svg" />
</picture>
```

Done. The workflow refreshes your art every day.

> [!TIP]
> Not sure which theme to pick? The [playground](https://sur1ive.github.io/contribution-fx/) previews every theme and palette with **your** graph and generates both snippets for you.

## Options

Each line of `outputs` is a file path followed by options in query-string form. Generate as many files as you like in one run:

```yaml
outputs: |
  dist/life.svg?theme=life&palette=ocean
  dist/life-dark.svg?theme=life&palette=ocean&mode=dark
  dist/party.svg?theme=fireworks&palette=sunset&mode=dark&speed=1.5&label=true
```

| Option       | Values                                              | Default       |
| ------------ | --------------------------------------------------- | ------------- |
| `theme`      | `gravity` `life` `sort` `ripple` `fireworks`        | `gravity`     |
| `palette`    | `github` `ocean` `sunset` `purple` `halloween`      | `github`      |
| `mode`       | `light` `dark`                                      | `light`       |
| `speed`      | any positive number (`2` = twice as fast)           | `1`           |
| `background` | any CSS color, e.g. `#0d1117`                       | transparent   |
| `label`      | `true` adds “@you · N contributions in the last year” | `false`     |

Action inputs:

| Input              | Description                                                   | Default                       |
| ------------------ | ------------------------------------------------------------- | ----------------------------- |
| `github_user_name` | Whose graph to render                                         | the repository owner          |
| `github_token`     | Token for the GraphQL API (the built-in one is enough)        | `${{ github.token }}`         |
| `outputs`          | Files to generate, one per line (see above)                   | `dist/contribution-fx.svg`    |

## CLI & library

No install needed — Node 20+ is enough:

```bash
git clone https://github.com/Sur1ive/contribution-fx && cd contribution-fx
node bin/cli.js --user torvalds --theme life --mode dark -o life.svg
node bin/cli.js --demo --theme fireworks -o fireworks.svg   # offline, demo data
node bin/cli.js --help
```

Without `GITHUB_TOKEN` the CLI uses the token-free [github-contributions-api](https://github.com/grubersjoe/github-contributions-api).

The renderer is plain ESM with no Node APIs, so it runs in the browser too (that is how the playground works):

```js
import { render, fetchPublic } from './src/index.js';

const calendar = await fetchPublic('octocat');
const svg = render(calendar, { theme: 'ripple', palette: 'purple', mode: 'dark' });
```

## How it works

1. The action reads your contribution calendar from the GitHub GraphQL API.
2. A theme turns the 53 × 7 grid into SVG plus pure CSS `@keyframes` — no JavaScript, so it plays inside GitHub's image proxy.
3. Output is deterministic: same graph, same bytes, so the daily job only commits when your graph changed.

## Add your own theme

A theme is a single file in [`src/themes/`](src/themes) exporting `render(ctx) → { style, body }`. [`gravity.js`](src/themes/gravity.js) is about 70 lines and a good template. Run `npm test` and `npm run examples`, open `examples/preview.html`, and send a PR — new effects are very welcome!

Ideas looking for an author: *snake*, *tetris*, *matrix rain*, *starfield*, *pixel-art text*, *seasons*.

## FAQ

<details>
<summary><b>The image does not update / shows an old version.</b></summary>

GitHub caches images through its camo proxy for a few minutes. Also check the workflow run succeeded and that the `output` branch exists.
</details>

<details>
<summary><b>Are private contributions included?</b></summary>

The graph matches what your public profile shows. Enable *Include private contributions on my profile* in your GitHub profile settings to include private activity counts (no repository details are exposed).
</details>

<details>
<summary><b>The animation does not play.</b></summary>

Your OS or browser may have *reduce motion* enabled; in that case the SVG intentionally shows your normal, static graph.
</details>

## Credits

Inspired by [Platane/snk](https://github.com/Platane/snk), the snake that started it all. Playground data via [grubersjoe/github-contributions-api](https://github.com/grubersjoe/github-contributions-api).

If contribution-fx made your profile a little more alive, a ⭐ helps others find it!

## License

[MIT](LICENSE)
