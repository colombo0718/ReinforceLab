# ReinforceLab / Rein Room project summary (2026-04-14)

This project builds and evaluates Rein Room (RR), a visual, web-based RL teaching platform, and compares it against a Gymnasium + Colab control condition in a quasi-experimental classroom study.

## Platform overview
- RR is a browser-based RL lab with UI-driven controls (sliders, buttons) and real-time visualizations (reward/steps curves, Q-table heatmaps, action-value bars).
- Core protocol: iframe game pages communicate via postMessage (`gameInfo`, `reward_state`, `action`, `endEpisode`).
- Key URL used in docs and tooling: https://reinroom.leaflune.org

## Teaching experiment (A/B)
- Two groups: RR (undergrads, international students) vs Gymnasium+Colab (grad students).
- Two sessions each (April 2026), with pre/post tests.
- Shared learning goals: SAR/episode concept, exploration vs exploitation (epsilon), curve reading, Q-table reading.
- RR tasks: MAB (epsilon), Maze1D (teacher demo for gamma), Maze2D (Q-table heatmap), CartPole (curve reading), heli (extension).
- Control tasks: Bandit in Colab, FrozenLake, CartPole with manual binning.

## Remote worker tooling
- Local scripts in `C:\Users\USER\remote_worker` send jobs to a remote Flask worker at https://worker.leaflune.org.
- Supports Playwright screenshots, data fetch (e.g., BTC), GPU status, and local LLM query via /llm (Ollama).

## Game environment notes
- Core games: MAB, Maze1D, Maze2D, heli, CartPole.
- New teaching-focused emoji game added: `games/fighter.html` (plane/meteor/bolt). 4D state (`playerX`, `rockDX`, `rockY`, `shotReady`).
- `docs/gamelist.html` updated to point to `/games/fighter.html`.
- `games/fighterPlane.html` original remains as legacy reference.
- `v0.5.0/` is archived and should not be modified.

## Recent code updates
- Added `games/fighter.html` (emoji teaching version).
- Updated `docs/gamelist.html` card to load `/games/fighter.html`.

