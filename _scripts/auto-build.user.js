// ==UserScript==
// @name         Kittens Game - Auto Build
// @namespace    http://tampermonkey.net/
// @version      1.1
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
            'Housing': ['hut', 'mansion', 'hotel'],
            'Production': ['farm', 'pasture', 'aqueduct', 'mine', 'quarry', 'lumberMill', 'oilWell', 'smelter', 'brewery'],
            'Science': ['library', 'academy', 'observatory', 'biolab'],
            'Culture': ['amphitheatre', 'chapel', 'temple'],
            'Storage': ['barn', 'warehouse'],
            'Trade': ['harbor', 'tradepost', 'mint'],
            'Industry': ['workshop', 'factory', 'steamworks', 'magneto', 'calciner'],
            'Advanced': ['reactor', 'accelerator', 'chronosphere', 'aiCore'],
            'Unique': ['ziggurat', 'unicornPasture', 'zebraOutpost', 'zebraWorkshop', 'zebraForge', 'ivoryTemple']
        };

        // Priority tiers - higher tiers build first
        const BUILD_PRIORITY_TIERS = [
            ['field', 'pasture', 'aqueduct'],  // Tier 1 - food production
            ['lumberMill', 'mine'],             // Tier 2 - resource production
            null                                 // Tier 3 - everything else (null = no restriction)
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
            running: false,
            enabled: true,
            config: {},
            panel: null,
            configWindow: null,
            lastBuildTime: 0,
            buildCheckInterval: 10000 // Check every 10 seconds
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
                addToPanel();
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
            // Create the section HTML
            const sectionHTML = `
<div id="autobuild-section" style="padding:8px;">
  <b style="font-size:14px;">Auto Build</b>
  <div style="margin-top:5px; display:flex; gap:5px;">
    <button id="autobuild-customize" style="padding:3px 8px; font-size:11px; cursor:pointer;">Customize</button>
    <button id="autobuild-toggle" style="padding:3px 8px; font-size:11px; cursor:pointer; background-color:#006400; color:white; border:none; border-radius:3px;">Start</button>
    <span id="autobuild-status" style="font-size:11px; margin-left:5px; align-self:center;">● Idle</span>
  </div>
</div>
            `;

            // Add section to the automation panel
            window.AutomationPanel.addSection(sectionHTML);
        }

        function attachButtonListeners() {
            // This is now handled by Automation Panel's event delegation
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

        function isButtonClickable(btn) {
            // Check if button is disabled, has disabled class, or is hidden
            if (btn.disabled || btn.classList.contains('disabled')) {
                return false;
            }
            // Check computed style - button might be red/disabled via CSS
            const style = window.getComputedStyle(btn);
            if (style.opacity === '0.5' || style.color === 'rgb(128, 128, 128)') {
                return false;
            }
            return true;
        }

        function canBuildBuilding(building) {
            if (!building.prices || building.prices.length === 0) return false;

            // Also check if the button itself is clickable in the UI
            const buttons = Array.from(document.querySelectorAll('.btn.nosel.modern'));
            let buildButton = null;
            for (const btn of buttons) {
                if (btn.textContent.includes(building.label)) {
                    buildButton = btn;
                    break;
                }
            }
            
            // If button exists but is disabled, can't build
            if (buildButton && !isButtonClickable(buildButton)) {
                console.debug(`[AutoBuild] Button disabled: ${building.name}`);
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
                    console.debug(`[AutoBuild] Not enough ${resName}: have ${available}, need ${resAmount}`);
                    return false;
                }
            }

            return true;
        }

        function buildBuilding(building) {
            try {
                // Find the button element for this building by searching for the label
                const buttons = Array.from(document.querySelectorAll('.btn.nosel.modern'));
                let buildButton = null;
                
                // The building label is what appears on the button in the UI
                for (const btn of buttons) {
                    if (btn.textContent.includes(building.label)) {
                        buildButton = btn;
                        break;
                    }
                }
                
                if (buildButton) {
                    // Double-check button is clickable before clicking
                    if (!isButtonClickable(buildButton)) {
                        console.warn(`[AutoBuild] Button is disabled/unavailable: ${building.name}`);
                        return;
                    }
                    
                    buildButton.click();
                    console.log('[AutoBuild] ✓ Built via UI click:', building.name);
                    return;
                }
                console.warn('[AutoBuild] Could not find button for:', building.name);
            } catch (e) {
                console.error('[AutoBuild] Failed to build:', building.name, e);
            }
        }

        // Wait for Automation Panel to be ready
        function waitForPanel() {
            if (window.AutomationPanel && typeof window.AutomationPanel.registerMod === 'function') {
                // Register Auto Build with priority 0 (runs first)
                window.AutomationPanel.registerMod('autobuild', init, 0);
                console.log('[AutoBuild] Registered with Automation Panel');
            } else {
                setTimeout(waitForPanel, 100);
            }
        }

        waitForPanel();

        // Return public API (this is internal, AutoBuild is set in init())
        return {
            init: init
        };
    })();
})();
