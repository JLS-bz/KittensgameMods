// ==UserScript==
// @name         Kittens Game - Auto Build
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Automatically builds buildings based on customizable settings
// @author       JLS-bz
// @match        https://kittensgame.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const AutoBuild = (function() {
        // Building categories (using camelCase names as found in game)
        const BUILDING_CATEGORIES = {
            'Food': ['catnipField', 'pasture', 'aqueduct'],
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

        // Priority tiers - higher tiers build first
        const BUILD_PRIORITY_TIERS = [
            ['catnipField', 'pasture', 'aqueduct'],  // Tier 1 - food production
            ['lumberMill', 'mine', 'quarry'],        // Tier 2 - resource production
            null                                      // Tier 3 - everything else (null = no restriction)
        ];

        function getResourceSaturation(resourceName) {
            // Get how full a resource is relative to its max capacity
            if (!gamePage.resPool || !gamePage.resPool.resources) return 0;
            const res = gamePage.resPool.resources.find(r => r.name === resourceName);
            if (!res || !res.maxValue) return 0;
            return res.value / res.maxValue;
        }

        function calculateBuildingSaturation(building) {
            // Return the highest saturation ratio of all required resources
            // This represents how close the bottleneck resource is to being full
            if (!building.prices || building.prices.length === 0) return 0;
            
            let maxSaturation = 0;
            building.prices.forEach(resource => {
                const saturation = getResourceSaturation(resource.name);
                if (saturation > maxSaturation) {
                    maxSaturation = saturation;
                }
            });
            return maxSaturation;
        }

        function getHighestAvailablePriorityTier(buildings) {
            // Return the highest priority tier index that has buildable buildings
            for (let i = 0; i < BUILD_PRIORITY_TIERS.length; i++) {
                const tier = BUILD_PRIORITY_TIERS[i];
                if (tier === null) return i; // Unrestricted tier
                
                // Check if any building in this tier is buildable
                for (const buildingName of tier) {
                    const building = buildings.find(b => b.name === buildingName);
                    if (building && building.unlocked && isBuildingEnabled(building) && canBuildBuilding(building)) {
                        return i;
                    }
                }
            }
            return BUILD_PRIORITY_TIERS.length - 1; // Default to last tier
        }

        function isBuildingInPriorityTier(building, tierIndex) {
            // Check if building is in the specified priority tier
            const tier = BUILD_PRIORITY_TIERS[tierIndex];
            if (tier === null) return true; // Unrestricted tier includes everything
            return tier.includes(building.name);
        }

        function getQueueLength() {
            // Get current number of items in the build queue (max is 4)
            // Queue items appear as rows in #rightTabQueue
            const queueContainer = document.querySelector('#rightTabQueue');
            if (!queueContainer) return 0;
            
            // Count visible queue items (they usually have specific styling/structure)
            // Look for divs that represent queue entries - they typically contain building/tech names
            const queueRows = queueContainer.querySelectorAll('div');
            let count = 0;
            
            for (const row of queueRows) {
                const text = row.textContent || '';
                // Queue items contain progress info and item names
                // Look for indicators like "100%" or "50%" which appear in queue items
                if (text.match(/\d+%/) && (text.length < 100)) {
                    count++;
                }
            }
            
            // Cap result at 4 (queue max) and at least 0
            return Math.min(Math.max(0, count - 1), 4); // -1 to exclude container itself
        }

        function isResourceStalled(building) {
            // Check if resources required for this building are stuck at max capacity
            // This indicates storage needs upgrading before this building can be built
            if (!building.prices || building.prices.length === 0) return false;
            
            for (const resource of building.prices) {
                const res = gamePage.resPool?.resources?.find(r => r.name === resource.name);
                if (!res) continue;
                
                // Skip resources with no storage cap (maxValue <= 0 means not unlocked yet)
                if ((res.maxValue || 0) <= 0) continue;
                
                // Check if this resource is at or very near max (>99% full)
                // This indicates storage is full and blocking the build
                const saturation = res.value / res.maxValue;
                if (saturation > 0.99) {
                    console.debug(`[AutoBuild] Storage stalled - ${resource.name}: ${res.value.toFixed(0)}/${res.maxValue} (${(saturation*100).toFixed(1)}%)`);
                    // Mark this building as stalled
                    const key = building.name + '_' + resource.name;
                    if (!state.stalledBuildings[key]) {
                        state.stalledBuildings[key] = Date.now();
                    }
                    return true;
                }
            }
            return false;
        }

        const state = {
            running: false,
            enabled: true,
            config: {},
            panel: null,
            configWindow: null,
            lastBuildTime: 0,
            buildCheckInterval: 10000, // Check every 10 seconds
            stalledBuildings: {} // Track buildings that fail due to storage limits
        };

        // Initialize default config
        function initConfig() {
            let loaded = false;
            const stored = localStorage.getItem('autobuild-config');
            if (stored) {
                try {
                    state.config = JSON.parse(stored);
                    // Verify structure is correct
                    for (const category in BUILDING_CATEGORIES) {
                        if (!state.config[category]) {
                            state.config[category] = {};
                        }
                        BUILDING_CATEGORIES[category].forEach(building => {
                            if (state.config[category][building] === undefined) {
                                state.config[category][building] = true;
                            }
                        });
                    }
                    loaded = true;
                } catch (e) {
                    console.warn('[AutoBuild] Failed to parse stored config:', e);
                    loaded = false;
                }
            }
            if (!loaded) {
                // Default: all buildings enabled
                state.config = {};
                for (const category in BUILDING_CATEGORIES) {
                    state.config[category] = {};
                    BUILDING_CATEGORIES[category].forEach(building => {
                        state.config[category][building] = true;
                    });
                }
            }
            saveConfig();
        }

        function saveConfig() {
            localStorage.setItem('autobuild-config', JSON.stringify(state.config));
        }

        function init() {
            try {
                initConfig();
                // Wait a bit for queue panel to be ready
                setTimeout(() => { addToPanel(); }, 100);
                startBuildLoop();
                console.log('[AutoBuild] Initialized successfully');
                
                // Expose state and functions globally for Automation Panel
                window.AutoBuild = {
                    state: state,
                    openConfigWindow: openConfigWindow,
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

        function addToPanel() {
            // Try to add UI to the queue panel first (above add to queue controls)
            const queueContainer = document.querySelector('#rightTabQueue');
            if (queueContainer) {
                // Find where to insert - above the first select or at the top
                const firstSelect = queueContainer.querySelector('select');
                if (firstSelect) {
                    const sectionHTML = document.createElement('div');
                    sectionHTML.id = 'autobuild-section';
                    sectionHTML.style.cssText = 'padding:8px; margin-bottom:10px; border-bottom:1px solid #666;';
                    sectionHTML.innerHTML = `
  <b style="font-size:13px;">Auto Build</b>
  <div style="margin-top:5px; display:flex; gap:5px;">
    <button id="autobuild-customize" style="padding:3px 8px; font-size:11px; cursor:pointer;">Customize</button>
    <button id="autobuild-toggle" style="padding:3px 8px; font-size:11px; cursor:pointer; background-color:#006400; color:white; border:none; border-radius:3px;">Start</button>
    <span id="autobuild-status" style="font-size:11px; margin-left:5px; align-self:center;">● Idle</span>
  </div>
                    `;
                    firstSelect.parentElement.insertBefore(sectionHTML, firstSelect);
                    attachButtonListeners();
                    return;
                }
            }
            
            // Fallback: Create standalone floating UI if queue panel not available
            const standaloneUI = document.createElement('div');
            standaloneUI.id = 'autobuild-section';
            standaloneUI.style.cssText = 'position:fixed; bottom:20px; right:20px; background:#2a2a2a; border:1px solid #666; padding:8px; border-radius:3px; z-index:9999;';
            standaloneUI.innerHTML = `
  <b style="font-size:12px; color:#fff;">Auto Build</b>
  <div style="margin-top:5px; display:flex; gap:5px;">
    <button id="autobuild-customize" style="padding:3px 8px; font-size:11px; cursor:pointer;">Customize</button>
    <button id="autobuild-toggle" style="padding:3px 8px; font-size:11px; cursor:pointer; background-color:#006400; color:white; border:none; border-radius:3px;">Start</button>
    <span id="autobuild-status" style="font-size:11px; margin-left:5px; align-self:center; color:#fff;">● Idle</span>
  </div>
            `;
            document.body.appendChild(standaloneUI);
            attachButtonListeners();
        }

        function attachButtonListeners() {
            // Attach listeners to Auto Build buttons
            const toggleBtn = document.getElementById('autobuild-toggle');
            const customizeBtn = document.getElementById('autobuild-customize');
            
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    state.running = !state.running;
                    updateToggleButton(toggleBtn);
                    console.log('[AutoBuild]', state.running ? 'STARTED' : 'STOPPED');
                });
            }
            
            if (customizeBtn) {
                customizeBtn.addEventListener('click', () => {
                    openConfigWindow();
                });
            }
        }

        function updateToggleButton(btn) {
            btn.innerText = state.running ? 'Stop' : 'Start';
            btn.style.backgroundColor = state.running ? '#8b0000' : '#006400';
            const status = document.getElementById('autobuild-status');
            if (status) {
                status.innerText = state.running ? '● Building' : '● Idle';
            }
        }

        function openConfigWindow() {
            if (state.configWindow) {
                state.configWindow.focus();
                return;
            }

            const win = document.createElement('div');
            win.id = 'autobuild-config-window';
            win.style.cssText = 'position:fixed; top:100px; left:200px; width:350px; background:#2a2a2a; border:2px solid #666; border-radius:5px; box-shadow:0 0 10px rgba(0,0,0,0.5); z-index:10000; font-family:Arial, sans-serif; font-size:12px; color:#fff;';

            // Header with close button
            const header = document.createElement('div');
            header.style.cssText = 'background:#1a1a1a; padding:8px; display:flex; justify-content:space-between; align-items:center; cursor:move; border-bottom:1px solid #666;';
            header.innerHTML = '<b>Auto Build Configuration</b>';

            const closeBtn = document.createElement('button');
            closeBtn.innerText = '✕';
            closeBtn.style.cssText = 'background:none; border:none; color:#fff; font-size:16px; cursor:pointer; padding:0; width:20px; height:20px;';
            closeBtn.addEventListener('click', function() {
                win.remove();
                state.configWindow = null;
            });
            header.appendChild(closeBtn);
            win.appendChild(header);

            // Make window draggable
            makeDraggable(win, header);

            // Content
            const content = document.createElement('div');
            content.style.cssText = 'padding:10px; max-height:400px; overflow-y:auto;';

            // Build checkboxes by category
            for (const category in BUILDING_CATEGORIES) {
                const categoryDiv = document.createElement('div');
                categoryDiv.style.cssText = 'margin-bottom:10px;';

                const categoryTitle = document.createElement('b');
                categoryTitle.style.cssText = 'display:block; margin-bottom:5px; color:#aaa;';
                categoryTitle.innerText = category;
                categoryDiv.appendChild(categoryTitle);

                BUILDING_CATEGORIES[category].forEach(building => {
                    const checkboxDiv = document.createElement('div');
                    checkboxDiv.style.cssText = 'margin-left:10px; margin-bottom:3px; display:flex; align-items:center;';

                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.id = 'autobuild-' + building;
                    checkbox.checked = state.config[category][building];
                    checkbox.addEventListener('change', function() {
                        state.config[category][building] = this.checked;
                        saveConfig();
                    });
                    checkbox.style.cssText = 'margin-right:5px; cursor:pointer;';
                    checkboxDiv.appendChild(checkbox);

                    const label = document.createElement('label');
                    label.htmlFor = 'autobuild-' + building;
                    label.innerText = building;
                    label.style.cssText = 'cursor:pointer;';
                    checkboxDiv.appendChild(label);

                    categoryDiv.appendChild(checkboxDiv);
                });

                content.appendChild(categoryDiv);
            }

            win.appendChild(content);
            document.body.appendChild(win);
            state.configWindow = win;
        }

        function makeDraggable(element, handle) {
            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

            handle.onmousedown = dragMouseDown;

            function dragMouseDown(e) {
                e.preventDefault();
                pos3 = e.clientX;
                pos4 = e.clientY;
                document.onmouseup = closeDragElement;
                document.onmousemove = elementDrag;
            }

            function elementDrag(e) {
                e.preventDefault();
                pos1 = pos3 - e.clientX;
                pos2 = pos4 - e.clientY;
                pos3 = e.clientX;
                pos4 = e.clientY;
                element.style.top = (element.offsetTop - pos2) + 'px';
                element.style.left = (element.offsetLeft - pos1) + 'px';
            }

            function closeDragElement() {
                document.onmouseup = null;
                document.onmousemove = null;
            }
        }

        function startBuildLoop() {
            setInterval(function() {
                if (state.running && state.enabled) {
                    tryBuild();
                }
            }, state.buildCheckInterval);
        }

        function tryBuild() {
            // Check if game is loaded
            if (typeof gamePage === 'undefined') {
                console.debug('[AutoBuild] gamePage not available');
                return;
            }

            try {
                // Get list of buildable buildings
                const buildings = getAllBuildings();
                if (buildings.length === 0) {
                    console.debug('[AutoBuild] No buildings available');
                    return;
                }

                // Find buildable building using priority tiers and resource saturation
                let selectedBuilding = null;
                let highestSaturation = -1;
                const priorityTier = getHighestAvailablePriorityTier(buildings);

                buildings.forEach(building => {
                    // Skip buildings that aren't unlocked/visible yet
                    if (!building.unlocked) {
                        console.debug(`[AutoBuild] Skipping locked building: ${building.name}`);
                        return;
                    }
                    
                    if (!isBuildingEnabled(building)) {
                        console.debug(`[AutoBuild] Disabled: ${building.name}`);
                        return;
                    }

                    // Only consider buildings in the current priority tier
                    if (!isBuildingInPriorityTier(building, priorityTier)) {
                        console.debug(`[AutoBuild] Not in priority tier: ${building.name}`);
                        return;
                    }

                    if (!canBuildBuilding(building)) {
                        return;
                    }

                    // Pick building with highest resource saturation (closest to maxing out)
                    const saturation = calculateBuildingSaturation(building);
                    console.debug(`[AutoBuild] Candidate: ${building.name} saturation: ${(saturation * 100).toFixed(1)}%`);
                    
                    if (saturation > highestSaturation) {
                        highestSaturation = saturation;
                        selectedBuilding = building;
                    }
                });

                // Check if queue is full before building
                const queueLength = getQueueLength();
                if (queueLength >= 4) {
                    console.debug('[AutoBuild] Queue is full (4/4), waiting...');
                    return;
                }

                // Build the selected building
                if (selectedBuilding) {
                    console.log('[AutoBuild] Attempting to build:', selectedBuilding.name, 'saturation:', (highestSaturation * 100).toFixed(1) + '%');
                    buildBuilding(selectedBuilding);
                    state.lastBuildTime = Date.now();
                } else {
                    console.debug('[AutoBuild] No buildable buildings found');
                }
            } catch (e) {
                console.error('[AutoBuild] Build loop error:', e);
            }
        }

        function getAllBuildings() {
            if (typeof gamePage === 'undefined' || !gamePage.bld || !gamePage.bld.buildingsData) {
                return [];
            }
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
        
        function isBuildingUnlocked(building) {
            // Check if building is unlocked and visible in the game
            return building.unlocked === true || (building.prestige && building.prestige > 0);
        }

        function calculateBuildingCost(building) {
            // Sum total of all required resources
            if (!building.prices || building.prices.length === 0) return 0;
            let total = 0;
            building.prices.forEach(resource => {
                total += resource.val || 0;
            });
            return total;
        }

        function canBuildBuilding(building) {
            if (!building.prices || building.prices.length === 0) return false;

            // Check if this building is stalled due to storage limits
            if (isResourceStalled(building)) {
                console.debug(`[AutoBuild] Building stalled (storage limit): ${building.name}`);
                return false;
            }

            // Check if we have enough resources
            for (const resource of building.prices) {
                const resName = resource.name;
                const resAmount = resource.val;

                let available = 0;
                
                // Get resource amount from game
                if (gamePage.resPool && gamePage.resPool.resources) {
                    const res = gamePage.resPool.resources.find(r => r.name === resName);
                    if (res && res.value !== undefined) {
                        available = res.value;
                    }
                }

                if (available < resAmount) {
                    console.debug(`[AutoBuild] Not enough ${resName}: have ${available.toFixed(2)}/${resAmount.toFixed(2)}`);
                    return false;
                }
            }

            return true;
        }

        function buildBuilding(building) {
            try {
                // Use the Queue tab select + button method (works regardless of which tab user is viewing)
                const queueContainer = document.querySelector('#rightTabQueue');
                if (!queueContainer) {
                    console.warn('[AutoBuild] Queue tab not found');
                    return;
                }

                // Find the building select dropdown (2nd select in queue)
                const selects = queueContainer.querySelectorAll('select');
                if (selects.length < 2) {
                    console.warn('[AutoBuild] Queue selects not found');
                    return;
                }

                const buildingSelect = selects[1];
                const addButton = queueContainer.querySelector('button');

                if (!addButton) {
                    console.warn('[AutoBuild] Queue "Add to queue" button not found');
                    return;
                }

                // Find the building index in the select
                let buildingIndex = -1;
                for (let i = 0; i < buildingSelect.options.length; i++) {
                    const option = buildingSelect.options[i];
                    if (option.getAttribute('data-label') === building.label) {
                        buildingIndex = i;
                        break;
                    }
                }

                if (buildingIndex === -1) {
                    console.warn(`[AutoBuild] Building not found in queue select: ${building.name}`);
                    return;
                }

                // Set the select value and trigger click
                buildingSelect.value = buildingIndex.toString();
                buildingSelect.dispatchEvent(new Event('change', { bubbles: true }));
                addButton.click();

                console.log('[AutoBuild] ✓ Built via queue:', building.name);
            } catch (e) {
                console.error('[AutoBuild] Failed to build:', building.name, e);
            }
        }

        // Initialize Auto Build immediately (standalone, no panel dependency)
        function start() {
            try {
                init();
                console.log('[AutoBuild] Started independently');
            } catch (e) {
                console.error('[AutoBuild] Startup failed:', e);
            }
        }

        // Start immediately when script loads
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', start);
        } else {
            // Page already loaded
            setTimeout(start, 500);
        }

        // Return public API
        return {
    })();
})();
