// ==UserScript==
// @name         Kittens Game - Auto Build
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Automatically builds buildings based on customizable settings
// @author       JLS-bz
// @match        https://kittensgame.com/*
// @require      https://raw.githubusercontent.com/JLS-bz/KittensgameMods/main/_scripts/automation-panel.user.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const AutoBuild = (function() {
        // Building categories
        const BUILDING_CATEGORIES = {
            'Housing': ['Hut', 'Dome', 'Log House', 'Mansion', 'Hotel'],
            'Production': ['Farm', 'Mine', 'Lumbermill', 'Aqueduct', 'Pasture', 'Smelter', 'Brewery'],
            'Science': ['Library', 'Academy', 'Observatory', 'Laboratory', 'Research Center'],
            'Culture': ['Amphitheater', 'Temple', 'Statue', 'Shrine', 'Cathedral'],
            'Management': ['Warehouse', 'Granary', 'Barracks', 'Market', 'Trade Post'],
            'Military': ['Watchtower', 'Wall', 'Garrison', 'Armory'],
            'Unique': ['Ziggurat', 'Pyramid', 'Sungate', 'Lighthouse', 'Hydro Plant']
        };

        const state = {
            running: false,
            enabled: true,
            config: {},
            panel: null,
            configWindow: null,
            lastBuildTime: 0,
            buildCheckInterval: 500 // Check every 500ms
        };

        // Initialize default config
        function initConfig() {
            const stored = localStorage.getItem('autobuild-config');
            if (stored) {
                state.config = JSON.parse(stored);
            } else {
                // Default: all buildings enabled
                state.config = {};
                for (const category in BUILDING_CATEGORIES) {
                    state.config[category] = {};
                    BUILDING_CATEGORIES[category].forEach(building => {
                        state.config[category][building] = true;
                    });
                }
                saveConfig();
            }
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
            } catch (e) {
                console.error('[AutoBuild] Failed to initialize:', e);
            }
        }

        function addToPanel() {
            // Create the section HTML
            const sectionHTML = `
<div id="autobuild-section" style="padding:8px; border-top:1px solid #ccc; margin-top:8px;">
  <b>Auto Build</b>
  <div style="margin-top:5px; display:flex; gap:5px;">
    <button id="autobuild-customize" style="padding:3px 8px; font-size:11px; cursor:pointer;">Customize</button>
    <button id="autobuild-toggle" style="padding:3px 8px; font-size:11px; cursor:pointer; background-color:#006400; color:white; border:none; border-radius:3px;">Start</button>
    <span id="autobuild-status" style="font-size:11px; margin-left:5px; align-self:center;">● Idle</span>
  </div>
</div>
            `;

            // Add section to the automation panel
            AutomationPanel.addSection(sectionHTML);

            // Attach event listeners after section is added
            setTimeout(function() {
                const customBtn = document.getElementById('autobuild-customize');
                const toggleBtn = document.getElementById('autobuild-toggle');
                if (customBtn) customBtn.addEventListener('click', openConfigWindow);
                if (toggleBtn) toggleBtn.addEventListener('click', function() {
                    state.running = !state.running;
                    updateToggleButton(toggleBtn);
                });
            }, 50);
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
            if (typeof gamePage === 'undefined') return;

            try {
                // Get list of buildable buildings
                const buildings = getAllBuildings();
                if (buildings.length === 0) return;

                // Find the cheapest buildable building that's enabled
                let cheapestBuilding = null;
                let cheapestCost = Infinity;

                buildings.forEach(building => {
                    if (!isBuildingEnabled(building)) return;

                    const cost = calculateBuildingCost(building);
                    if (cost > 0 && cost < cheapestCost && canBuildBuilding(building)) {
                        cheapestCost = cost;
                        cheapestBuilding = building;
                    }
                });

                // Build the cheapest buildable building
                if (cheapestBuilding) {
                    buildBuilding(cheapestBuilding);
                    state.lastBuildTime = Date.now();
                }
            } catch (e) {
                console.error('[AutoBuild] Build loop error:', e);
            }
        }

        function getAllBuildings() {
            if (typeof gamePage === 'undefined' || !gamePage.buildings) return [];
            return gamePage.buildings;
        }

        function isBuildingEnabled(building) {
            for (const category in BUILDING_CATEGORIES) {
                if (BUILDING_CATEGORIES[category].includes(building.name)) {
                    return state.config[category] && state.config[category][building.name];
                }
            }
            return false;
        }

        function calculateBuildingCost(building) {
            // Simple cost calculation - total of all required resources
            if (!building.cost) return 0;
            let total = 0;
            building.cost.forEach(resource => {
                total += resource.val;
            });
            return total;
        }

        function canBuildBuilding(building) {
            if (!building.cost) return false;

            // Check if we have enough resources
            for (const resource of building.cost) {
                const resName = resource.name;
                const resAmount = resource.val;

                // Find resource in game
                let available = 0;
                if (gamePage.resPool && gamePage.resPool.resources) {
                    const res = gamePage.resPool.resources.find(r => r.name === resName);
                    if (res) {
                        available = res.value;
                    }
                }

                if (available < resAmount) {
                    return false;
                }
            }

            return true;
        }

        function buildBuilding(building) {
            try {
                building.buildBuilding(1);
            } catch (e) {
                console.error('[AutoBuild] Failed to build:', building.name, e);
            }
        }

        // Wait for Automation Panel to be ready
        function waitForPanel() {
            if (typeof AutomationPanel !== 'undefined' && typeof AutomationPanel.addSection === 'function') {
                setTimeout(init, 100);
            } else {
                setTimeout(waitForPanel, 500);
            }
        }

        waitForPanel();

        return {
            toggle: function() {
                state.running = !state.running;
            },
            setEnabled: function(enabled) {
                state.enabled = enabled;
            }
        };
    })();

    window.AutoBuild = AutoBuild;
})();
