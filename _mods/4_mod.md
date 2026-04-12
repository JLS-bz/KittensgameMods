---
layout: page
title: Auto Build
description: Automatically builds buildings based on smart prioritization and resource saturation. Works on any game tab thanks to queue system integration. Standalone - no dependencies!
img: /assets/img/4.jpg
importance: 3
version: 1.2
last_updated: 2026-04-12
install_url: https://raw.githubusercontent.com/JLS-bz/KittensgameMods/main/_scripts/auto-build.user.js
download_url: https://raw.githubusercontent.com/JLS-bz/KittensgameMods/main/_scripts/auto-build.user.js
---


## Settings

Click **Customize** to open the configuration window where you can toggle auto-building for:
- **Food**: Catnip Field, Pasture, Aqueduct
- **Population**: Hut, Log House, Mansion
- **Science**: Library, Academy, Observatory, Bio Lab
- **Storage**: Barn, Warehouse, Harbour
- **Resources**: Mine, Quarry, Lumber Mill, Oil Well, Accelerator
- **Industry**: Steamworks, Magneto, Smelter, Calciner, Factory, Reactor
- **Culture**: Amphitheatre, Chapel, Temple
- **Other**: Workshop, Tradepost, Mint, Unicorn Pasture, Brewery
- **Mega Structures**: Ziggurat, Chronosphere, AI Core
- **Upgraded**: Solar Farm, Hydro Plant, Data Center, Broadcast Tower, Spaceport
- **Zebras**: Zebra Outpost, Zebra Workshop, Zebra Forge, Ivory Temple

## Usage

1. Install the mod directly (no dependencies required)
2. Go to **Kittens Game → Queue tab**
3. You'll see **Auto Build** section above the queue controls
4. Click **Customize** to select which buildings to auto-build
5. Click **Start** to begin automation
6. Buildings are selected intelligently based on:
   - **Priority tiers**: Food production → Resources → Everything else
   - **Resource saturation**: Builds when resources are close to max
   - **Storage awareness**: Skips buildings when resources are stalled at max capacity
7. Works on any tab - automation continues while on Log, Profile, or any other tab!
8. Click **Stop** to pause
