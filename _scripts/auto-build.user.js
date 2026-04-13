// ==UserScript==
// @name         Kittens Game - Auto Build
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Automatically builds buildings based on customizable settings
// @author       JLS-bz
// @match        https://kittensgame.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const AutoBuild = (function() {
        // Building categories (using actual game building names)
        const BUILDING_CATEGORIES = {
            'Food': ['field', 'pasture', 'aqueduct'],
            'Population': ['hut', 'logHouse', 'mansion'],
            'Science': ['library', 'academy', 'observatory', 'biolab'],
            'Storage': ['barn', 'warehouse', 'harbour'],
            'Resources': ['mine', 'quarry', 'lumberMill', 'oilWell', 'accelerator'],
            'Industry': ['steamworks', 'magneto', 'smelter', 'calciner', 'factory', 'reactor'],
            'Culture': ['amphitheatre', 'chapel', 'temple'],
            'Other': ['workshop', 'tradepost', 'mint', 'unicornPasture', 'brewery'],
            'MegaStructures': ['ziggurat', 'chronosphere', 'aiCore'],
            'Upgraded': ['solarFarm', 'hydroPlant', 'dataCenter', 'broadcastTower', 'spaceport'],
            'Zebras': ['zebraOutpost', 'zebraWorkshop', 'zebraForge', 'ivoryTemple']
        };

        // Priority tiers - lower index = higher priority.
        // Buildings in tier 0 will always be built before tier 1, etc.
        // null in a tier means "everything else not listed above".
        const BUILD_PRIORITY_TIERS = [
            BUILDING_CATEGORIES['Food'],       // Tier 0 - all food buildings (highest priority)
            BUILDING_CATEGORIES['Resources'],  // Tier 1 - all resource buildings
            null                               // Tier 2 - everything else
        ];

        // ─── Helper: get the active stage data for a building ───────────────────────
        function getBuildingStage(building) {
            if (building.stages && building.stages.length > 0) {
                return building.stages[building.stage || 0];
            }
            return null;
        }

        function getBuildingPrices(building) {
            const stage = getBuildingStage(building);
            return (stage ? stage.prices : building.prices) || [];
        }

        function getBuildingPriceRatio(building) {
            const stage = getBuildingStage(building);
            // priceRatio lives on the stage for some buildings, top-level for others.
            // Fall back through both before defaulting to 1.
            return (stage && stage.priceRatio) || building.priceRatio || 1;
        }

        function getBuildingLabel(building) {
            const stage = getBuildingStage(building);
            return (stage ? stage.label : building.label) || building.name;
        }

        // ─── Resource helpers ────────────────────────────────────────────────────────
        function getResource(name) {
            if (!gamePage.resPool || !gamePage.resPool.resources) return null;
            return gamePage.resPool.resources.find(r => r.name === name) || null;
        }

        function getResourceSaturation(resourceName) {
            const res = getResource(resourceName);
            if (!res || !res.maxValue) return 0;
            return res.value / res.maxValue;
        }

        function calculateBuildingSaturation(building) {
            const prices = getBuildingPrices(building);
            if (!prices.length) return 0;
            let max = 0;
            prices.forEach(p => {
                const s = getResourceSaturation(p.name);
                if (s > max) max = s;
            });
            return max;
        }

        // ─── Priority tier logic ─────────────────────────────────────────────────────
        function getHighestAvailablePriorityTier(buildings) {
            for (let i = 0; i < BUILD_PRIORITY_TIERS.length; i++) {
                const tier = BUILD_PRIORITY_TIERS[i];
                if (tier === null) return i; // unrestricted tier always qualifies

                for (const name of tier) {
                    const b = buildings.find(b => b.name === name);
                    if (b && b.unlocked && isBuildingEnabled(b) && canBuildBuilding(b)) {
                        return i;
                    }
                }
            }
            return BUILD_PRIORITY_TIERS.length - 1;
        }

        function isBuildingInPriorityTier(building, tierIndex) {
            const tier = BUILD_PRIORITY_TIERS[tierIndex];
            if (tier === null) return true;
            return tier.includes(building.name);
        }

        // ─── Queue length ────────────────────────────────────────────────────────────
        function getQueueLength() {
            // Each queue entry is a div with a span.queue-label and a sibling span
            // holding the repeat count (e.g. " 4"). We sum counts for the true total.
            const queueList = document.querySelector('#rightTabQueue .queue-container > div:last-child');
            if (!queueList) return 0;
            let total = 0;
            queueList.querySelectorAll('span.queue-label').forEach(label => {
                const countSpan = label.nextElementSibling;
                const countText = countSpan ? countSpan.textContent.trim() : '';
                const count = parseInt(countText, 10);
                total += (isNaN(count) || count < 1) ? 1 : count;
            });
            if (total > 0) console.debug(`[AutoBuild] Queue total: ${total}/4`);
            return total;
        }

        function getQueuedLabels() {
            // Returns a Set of building labels currently in the queue.
            const queueList = document.querySelector('#rightTabQueue .queue-container > div:last-child');
            if (!queueList) return new Set();
            return new Set(
                Array.from(queueList.querySelectorAll('span.queue-label'))
                    .map(s => s.textContent.trim())
            );
        }

        // ─── State ───────────────────────────────────────────────────────────────────
        const state = {
            running: false,
            enabled: true,
            config: {},
            panel: null,
            configWindow: null,
            lastBuildTime: 0,
            buildCheckInterval: 10000
        };

        // ─── Config ──────────────────────────────────────────────────────────────────
        function initConfig() {
            let loaded = false;
            const stored = localStorage.getItem('autobuild-config');
            if (stored) {
                try {
                    state.config = JSON.parse(stored);
                    let valid = true;
                    for (const cat in BUILDING_CATEGORIES) {
                        if (!state.config[cat]) { valid = false; break; }
                    }
                    if (valid) {
                        for (const cat in BUILDING_CATEGORIES) {
                            if (!state.config[cat]) state.config[cat] = {};
                            BUILDING_CATEGORIES[cat].forEach(b => {
                                if (state.config[cat][b] === undefined) state.config[cat][b] = true;
                            });
                        }
                        loaded = true;
                    } else {
                        console.warn('[AutoBuild] Stored config outdated, resetting...');
                    }
                } catch (e) {
                    console.warn('[AutoBuild] Failed to parse stored config:', e);
                }
            }
            if (!loaded) {
                state.config = {};
                for (const cat in BUILDING_CATEGORIES) {
                    state.config[cat] = {};
                    BUILDING_CATEGORIES[cat].forEach(b => { state.config[cat][b] = true; });
                }
            }
            saveConfig();
        }

        function saveConfig() {
            localStorage.setItem('autobuild-config', JSON.stringify(state.config));
        }

        // ─── Init ────────────────────────────────────────────────────────────────────
        function init() {
            try {
                initConfig();
                setTimeout(() => { addToPanel(); }, 100);
                startBuildLoop();
                console.log('[AutoBuild] Initialized successfully');
                window.AutoBuild = {
                    state,
                    openConfigWindow,
                    toggleState: function() {
                        state.running = !state.running;
                        const btn = document.getElementById('autobuild-toggle');
                        if (btn) updateToggleButton(btn);
                    }
                };
            } catch (e) {
                console.error('[AutoBuild] Failed to initialize:', e);
            }
        }

        // ─── UI ──────────────────────────────────────────────────────────────────────
        function addToPanel() {
            const queueContainer = document.querySelector('#rightTabQueue');
            if (queueContainer) {
                const section = document.createElement('div');
                section.id = 'autobuild-section';
                section.style.cssText = 'padding:8px; margin-bottom:8px; border-bottom:1px solid #666;';
                section.innerHTML = `
  <b style="font-size:16px; display:block; margin-bottom:6px; font-weight:normal;">⚙ Auto Build</b>
  <div style="display:flex; gap:5px; flex-wrap:wrap;">
    <button id="autobuild-toggle" style="padding:5px 12px; font-size:13px; cursor:pointer; background-color:#ECECEC; color:#000; border:1px solid #999; border-radius:2px; flex:1; min-width:60px; font-weight:normal;">Start</button>
    <button id="autobuild-customize" style="padding:5px 12px; font-size:13px; cursor:pointer; background:#ECECEC; color:#000; border:1px solid #999; border-radius:2px; flex:1; min-width:70px; font-weight:normal;">Customize</button>
  </div>
  <span id="autobuild-status" style="font-size:12px; color:#aaa; display:block; margin-top:5px;">● Status: Idle</span>`;
                queueContainer.insertBefore(section, queueContainer.firstChild);
                attachButtonListeners();
                console.log('[AutoBuild] UI inserted into Queue panel');
                return true;
            }

            // Fallback floating UI
            console.log('[AutoBuild] Queue panel not found, using floating UI');
            const ui = document.createElement('div');
            ui.id = 'autobuild-section';
            ui.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#1a1a1a; border:2px solid #999; padding:12px; border-radius:3px; z-index:9999; min-width:150px;';
            ui.innerHTML = `
  <b style="font-size:12px; color:#fff; display:block; margin-bottom:8px;">⚙ Auto Build</b>
  <div style="display:flex; gap:5px; flex-direction:column;">
    <button id="autobuild-toggle" style="padding:5px 10px; font-size:11px; cursor:pointer; background-color:#006400; color:white; border:none; border-radius:2px;">Start</button>
    <button id="autobuild-customize" style="padding:5px 10px; font-size:11px; cursor:pointer; background:#444; color:#fff; border:1px solid #666; border-radius:2px;">Customize</button>
  </div>
  <span id="autobuild-status" style="font-size:10px; color:#aaa; display:block; margin-top:5px;">● Status: Idle</span>`;
            document.body.appendChild(ui);
            attachButtonListeners();
            return false;
        }

        function attachButtonListeners() {
            const toggleBtn = document.getElementById('autobuild-toggle');
            const customizeBtn = document.getElementById('autobuild-customize');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    state.running = !state.running;
                    updateToggleButton(toggleBtn);
                    console.log('[AutoBuild]', state.running ? 'STARTED' : 'STOPPED');
                });
            }
            if (customizeBtn) {
                customizeBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openConfigWindow();
                });
            }
        }

        function updateToggleButton(btn) {
            btn.innerText = state.running ? 'Stop' : 'Start';
            btn.style.backgroundColor = '#ECECEC';
            const status = document.getElementById('autobuild-status');
            if (status) status.innerText = state.running ? '● Building' : '● Idle';
        }

        function openConfigWindow() {
            if (state.configWindow) { state.configWindow.focus(); return; }

            const win = document.createElement('div');
            win.id = 'autobuild-config-window';
            win.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); width:350px; max-height:80vh; overflow-y:auto; background:#2a2a2a; border:2px solid #666; border-radius:5px; box-shadow:0 0 10px rgba(0,0,0,.5); z-index:10000; font-family:Arial,sans-serif; font-size:12px; color:#fff;';

            const header = document.createElement('div');
            header.style.cssText = 'background:#1a1a1a; padding:8px; display:flex; justify-content:space-between; align-items:center; cursor:move; border-bottom:1px solid #666;';
            header.innerHTML = '<b>Auto Build Configuration</b>';

            const closeBtn = document.createElement('button');
            closeBtn.innerText = '✕';
            closeBtn.style.cssText = 'background:none; border:none; color:#fff; font-size:16px; cursor:pointer; padding:0; width:20px; height:20px;';
            closeBtn.addEventListener('click', () => { win.remove(); state.configWindow = null; });
            header.appendChild(closeBtn);
            win.appendChild(header);
            makeDraggable(win, header);

            const content = document.createElement('div');
            content.style.cssText = 'padding:10px; max-height:400px; overflow-y:auto;';

            for (const category in BUILDING_CATEGORIES) {
                const catDiv = document.createElement('div');
                catDiv.style.cssText = 'margin-bottom:10px;';
                const catTitle = document.createElement('b');
                catTitle.style.cssText = 'display:block; margin-bottom:5px; color:#aaa;';
                catTitle.innerText = category;
                catDiv.appendChild(catTitle);

                BUILDING_CATEGORIES[category].forEach(building => {
                    const row = document.createElement('div');
                    row.style.cssText = 'margin-left:10px; margin-bottom:3px; display:flex; align-items:center;';
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.id = 'autobuild-' + building;
                    cb.checked = state.config[category][building];
                    cb.addEventListener('change', function() {
                        state.config[category][building] = this.checked;
                        saveConfig();
                    });
                    cb.style.cssText = 'margin-right:5px; cursor:pointer;';
                    const lbl = document.createElement('label');
                    lbl.htmlFor = 'autobuild-' + building;
                    lbl.innerText = building;
                    lbl.style.cursor = 'pointer';
                    row.appendChild(cb);
                    row.appendChild(lbl);
                    catDiv.appendChild(row);
                });
                content.appendChild(catDiv);
            }
            win.appendChild(content);
            document.body.appendChild(win);
            state.configWindow = win;
        }

        function makeDraggable(element, handle) {
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
            handle.onmousedown = function(e) {
                e.preventDefault();
                pos3 = e.clientX; pos4 = e.clientY;
                document.onmouseup = () => { document.onmouseup = null; document.onmousemove = null; };
                document.onmousemove = function(e) {
                    e.preventDefault();
                    pos1 = pos3 - e.clientX; pos2 = pos4 - e.clientY;
                    pos3 = e.clientX; pos4 = e.clientY;
                    element.style.top = (element.offsetTop - pos2) + 'px';
                    element.style.left = (element.offsetLeft - pos1) + 'px';
                };
            };
        }

        // ─── Build loop ──────────────────────────────────────────────────────────────
        function startBuildLoop() {
            setInterval(function() {
                if (state.running && state.enabled) tryBuild();
            }, state.buildCheckInterval);
        }

        function isBuildingReachable(building) {
            // A building is reachable if every resource it needs either:
            //   (a) we already have enough, OR
            //   (b) the cost is within the resource's max storage capacity AND
            //       the resource is still accumulating (not at cap)
            // If cost exceeds max storage, we can never save up enough — blocked.
            // If resource is at cap and we don't have enough — blocked.
            const prices = getBuildingPrices(building);
            if (!prices.length) return false;
            const priceRatio = getBuildingPriceRatio(building);
            const built = building.val || 0;
            for (const resource of prices) {
                const actualCost = resource.val * Math.pow(priceRatio, built);
                const res = getResource(resource.name);
                const available = res ? res.value : 0;
                if (available >= actualCost) continue; // already have enough
                // Not enough — check if storage can even hold the required amount
                if (res && res.maxValue && actualCost > res.maxValue) {
                    console.debug(`[AutoBuild] ${building.name} blocked: ${resource.name} cost ${actualCost.toFixed(0)} exceeds max storage ${res.maxValue}`);
                    return false; // cost exceeds storage cap, impossible to accumulate
                }
                // Cost fits in storage — check if resource is stuck at cap
                const atCap = res && res.maxValue && res.value >= res.maxValue;
                if (atCap) {
                    console.debug(`[AutoBuild] ${building.name} blocked: ${resource.name} at cap (${available.toFixed(0)}/${res.maxValue}), need ${actualCost.toFixed(0)}`);
                    return false;
                }
            }
            return true; // all resources either sufficient or reachable within storage
        }

        function clearStuckQueueItems() {
            // Queue items with class "limited" are stuck (shown in red) because
            // resources exceed storage cap. Remove them so the queue doesn't block.
            const queueList = document.querySelector('#rightTabQueue .queue-container > div:last-child');
            if (!queueList) return;
            const stuck = queueList.querySelectorAll('div.limited');
            stuck.forEach(div => {
                const label = div.querySelector('span.queue-label');
                const cancelBtn = div.querySelectorAll('a')[1]; // [x] is the second link
                if (cancelBtn) {
                    console.log(`[AutoBuild] Removing stuck queue item: ${label ? label.textContent.trim() : '?'}`);
                    cancelBtn.click();
                }
            });
        }

        function tryBuild() {
            if (typeof gamePage === 'undefined') {
                console.debug('[AutoBuild] gamePage not available');
                return;
            }
            try {
                clearStuckQueueItems();
                const buildings = getAllBuildings();
                if (!buildings.length) { console.debug('[AutoBuild] No buildings available'); return; }

                for (let tierIndex = 0; tierIndex < BUILD_PRIORITY_TIERS.length; tierIndex++) {
                    const tier = BUILD_PRIORITY_TIERS[tierIndex];

                    // Gather affordable buildings for this tier
                    const candidates = buildings.filter(b => {
                        if (!b.unlocked) return false;
                        if (!isBuildingEnabled(b)) return false;
                        if (!isBuildingInPriorityTier(b, tierIndex)) return false;
                        if (!canBuildBuilding(b)) return false;
                        return true;
                    });

                    if (candidates.length === 0) {
                        // No affordable buildings right now — check if any are reachable
                        // (i.e. just need more time to accumulate resources).
                        // If so, wait — don't fall through to a lower priority tier.
                        const reachable = (tier === null)
                            ? [] // unrestricted tier: no point checking, just move on
                            : buildings.filter(b => {
                                if (!b.unlocked) return false;
                                if (!isBuildingEnabled(b)) return false;
                                if (!isBuildingInPriorityTier(b, tierIndex)) return false;
                                return isBuildingReachable(b);
                            });

                        if (reachable.length > 0) {
                            console.debug(`[AutoBuild] Tier ${tierIndex} has reachable buildings (${reachable.map(b => b.name).join(', ')}), waiting...`);
                            return; // wait for resources to accumulate
                        }

                        // Nothing reachable — fall through to next tier
                        console.debug(`[AutoBuild] No reachable buildings in tier ${tierIndex}, checking next tier`);
                        continue;
                    }

                    // We have affordable candidates — queue them all, highest saturation first
                    console.debug(`[AutoBuild] Active tier: ${tierIndex}, candidates: ${candidates.map(b => b.name).join(', ')}`);
                    candidates.sort((a, b) => calculateBuildingSaturation(b) - calculateBuildingSaturation(a));

                    let queued = 0;
                    const alreadyQueued = getQueuedLabels();
                    for (const building of candidates) {
                        const qLen = getQueueLength();
                        if (qLen >= 4) {
                            console.debug('[AutoBuild] Queue full, stopping for this tick');
                            return;
                        }
                        const label = getBuildingLabel(building);
                        if (alreadyQueued.has(label)) {
                            console.debug(`[AutoBuild] Already queued: ${building.name}, skipping`);
                            continue;
                        }
                        console.log(`[AutoBuild] Queuing: ${building.name} (tier ${tierIndex}, queue ${qLen}/4)`);
                        buildBuilding(building);
                        alreadyQueued.add(label); // prevent double-queuing within same tick
                        queued++;
                        state.lastBuildTime = Date.now();
                    }

                    if (queued > 0) return;
                }
            } catch (e) {
                console.error('[AutoBuild] Build loop error:', e);
            }
        }

        function getAllBuildings() {
            if (typeof gamePage === 'undefined' || !gamePage.bld || !gamePage.bld.buildingsData) return [];
            return gamePage.bld.buildingsData;
        }

        function isBuildingEnabled(building) {
            for (const category in BUILDING_CATEGORIES) {
                if (BUILDING_CATEGORIES[category].includes(building.name)) {
                    return state.config[category] && state.config[category][building.name];
                }
            }
            return false;
        }

        function canBuildBuilding(building) {
            const prices = getBuildingPrices(building);
            if (!prices.length) return false;

            const priceRatio = getBuildingPriceRatio(building);
            // Use building.val (total constructed) for cost scaling — not building.on
            const built = building.val || 0;

            for (const resource of prices) {
                const actualCost = resource.val * Math.pow(priceRatio, built);
                const res = getResource(resource.name);
                const available = res ? res.value : 0;

                if (available < actualCost) {
                    console.debug(`[AutoBuild] Not enough ${resource.name}: have ${available.toFixed(2)}, need ${actualCost.toFixed(2)}`);
                    return false;
                }
            }
            return true;
        }

        function buildBuilding(building) {
            try {
                const queueContainer = document.querySelector('#rightTabQueue');
                if (!queueContainer) { console.warn('[AutoBuild] Queue container not found'); return; }

                const selects = queueContainer.querySelectorAll('select');
                if (selects.length < 2) { console.warn('[AutoBuild] Queue selects not found'); return; }

                const buildingSelect = selects[1];
                const addButton = Array.from(queueContainer.querySelectorAll('button'))
                    .find(b => b.textContent.trim() === 'Add to queue');
                if (!addButton) { console.warn('[AutoBuild] "Add to queue" button not found'); return; }

                // Match by the building's current active label (handles staged buildings)
                const targetLabel = getBuildingLabel(building);
                let buildingIndex = -1;
                for (let i = 0; i < buildingSelect.options.length; i++) {
                    const opt = buildingSelect.options[i];
                    // Match against both data-label and option text
                    if (opt.getAttribute('data-label') === targetLabel || opt.text === targetLabel) {
                        buildingIndex = i;
                        break;
                    }
                }

                if (buildingIndex === -1) {
                    console.warn(`[AutoBuild] "${targetLabel}" not found in queue dropdown`);
                    return;
                }

                // Ensure the category dropdown is set to "buildings" (Bonfire tab)
                // so the building select is showing the right options
                const categorySelect = selects[0];
                if (categorySelect.value !== 'buildings') {
                    categorySelect.value = 'buildings';
                    categorySelect.dispatchEvent(new Event('change', { bubbles: true }));
                }

                buildingSelect.value = buildingIndex.toString();
                buildingSelect.dispatchEvent(new Event('change', { bubbles: true }));
                addButton.click();
                console.log(`[AutoBuild] ✓ Queued: ${building.name} ("${targetLabel}")`);
            } catch (e) {
                console.error('[AutoBuild] Failed to build:', building.name, e);
            }
        }

        // ─── Startup ─────────────────────────────────────────────────────────────────
        function start() {
            try {
                init();
                console.log('[AutoBuild] Started independently');
            } catch (e) {
                console.error('[AutoBuild] Startup failed:', e);
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start);
        } else {
            setTimeout(start, 500);
        }

        return { init };
    })();
})();