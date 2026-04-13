---
layout: page
title: Auto Build Documentation
permalink: /auto-build-docs/
description: 
nav: false
---

## Overview

**Auto Build** automatically constructs buildings in Kittens Game based on smart prioritization and resource saturation. 

---

## How It Works

Every 10 seconds the script runs through the following steps:

**1. Clear stuck queue items.** Any queued building shown in red (meaning it can no longer be built due to storage limits) is automatically removed to keep the queue moving.

**2. Check priority tiers.** Buildings are evaluated in priority order — higher priority tiers are always fully satisfied before lower tiers are considered. See [Priority Tiers](#priority-tiers) below.

**3. Check affordability.** For each candidate building, the script calculates the true scaled cost (base cost × price ratio ^ number built) and compares it against your current resources.

**4. Check reachability.** If a building is not yet affordable, the script checks whether it ever *could* be — meaning every resource it needs either has room to accumulate or is already sufficient. If a resource cost exceeds your current max storage, the building is considered unreachable and skipped.

**5. Queue candidates.** All affordable buildings in the highest active priority tier are queued, sorted by resource saturation (buildings whose required resources are closest to your storage cap go first). The script respects the 4-item queue limit and never queues a building that is already waiting in the queue.

**6. Wait if needed.** If no buildings are affordable right now but some are reachable (just need more time to accumulate resources), the script waits rather than falling through to a lower priority tier.


---

## Priority Tiers

Buildings are grouped into three tiers. The script will never build from a lower tier while a higher tier has any reachable buildings.

| Tier | Category | Buildings |
|------|----------|-----------|
| 1 (highest) | Food | Catnip Field, Pasture, Aqueduct |
| 2 | Resources | Mine, Quarry, Lumber Mill, Oil Well, Accelerator |
| 3 (lowest) | Everything else | All remaining enabled buildings |

**Example:** If an Aqueduct is reachable (minerals are accumulating and the cost fits within your storage cap), the script will wait for it rather than building a Library or Barn. Once all Food buildings are either built, blocked by storage, or have resources stuck at cap, it moves on to Tier 2, and then Tier 3.

A building is considered **blocked** (not reachable) when:
- A required resource is at its storage cap *and* you still don't have enough, or
- The required amount exceeds your maximum storage capacity entirely.

---

## Customizing Which Buildings Are Built

Click **Customize** to open the configuration window. Buildings are grouped by category with a checkbox for each one. Unchecking a building removes it from consideration entirely — it will never be queued by the script.

Your settings are saved automatically to `localStorage` and persist across sessions.

**Building categories:**

| Category | Buildings |
|----------|-----------|
| Food | field, pasture, aqueduct |
| Population | hut, logHouse, mansion |
| Science | library, academy, observatory, biolab |
| Storage | barn, warehouse, harbour |
| Resources | mine, quarry, lumberMill, oilWell, accelerator |
| Industry | steamworks, magneto, smelter, calciner, factory, reactor |
| Culture | amphitheatre, chapel, temple |
| Other | workshop, tradepost, mint, unicornPasture, brewery |
| MegaStructures | ziggurat, chronosphere, aiCore |
| Upgraded | solarFarm, hydroPlant, dataCenter, broadcastTower, spaceport |
| Zebras | zebraOutpost, zebraWorkshop, zebraForge, ivoryTemple |

---

## Modifying Priority Tiers

Priority tiers are defined near the top of the script:

```js
const BUILD_PRIORITY_TIERS = [
    BUILDING_CATEGORIES['Food'],       // Tier 0 - highest priority
    BUILDING_CATEGORIES['Resources'],  // Tier 1
    null                               // Tier 2 - everything else
];
```

To change priorities, reorder the entries or replace them with custom arrays of building names. `null` always means "all remaining enabled buildings not listed in a higher tier." For example, to add Population buildings as a third explicit tier before the catch-all:

```js
const BUILD_PRIORITY_TIERS = [
    BUILDING_CATEGORIES['Food'],
    BUILDING_CATEGORIES['Resources'],
    BUILDING_CATEGORIES['Population'],
    null
];
```

Or mix and match buildings from different categories into a single tier:

```js
const BUILD_PRIORITY_TIERS = [
    ['field', 'pasture', 'aqueduct', 'mine', 'lumberMill'],  // food + key resources together
    null
];
```

---

## Known Limitations

- The script only builds **Bonfire** (building) queue items. Techs, upgrades, policies, and religion are not supported.
- Staged buildings (e.g. Pasture → Solar Farm, Aqueduct → Hydro Plant) are only built at their **current stage**. The script does not handle stage upgrades.
- The check interval is fixed at 10 seconds. This can be changed by modifying `buildCheckInterval` in the `state` object near the top of the script.
- If you have another userscript that speeds up the game (e.g. KittenTurbo), resources may accumulate faster than the 10-second interval anticipates — you may want to lower `buildCheckInterval` accordingly.


---

## Manual Override

Auto Build won't interfere with manual builds. If you click "Build" on something manually while Auto Build is running, it works fine.

---

## Debug Console

Open the browser console (F12) to see detailed logs:

```
[AutoBuild] Initialized successfully
[AutoBuild] UI inserted into Queue panel
[AutoBuild] STARTED
[AutoBuild] Attempting to build: pasture
[AutoBuild] ✓ Built via queue: pasture
```

Prefix `[AutoBuild]` indicates the mod is working. Look for errors to diagnose issues.

