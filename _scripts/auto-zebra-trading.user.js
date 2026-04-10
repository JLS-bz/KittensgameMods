// ==UserScript==
// @name         Auto Zebra Trading
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Automate gold trading with zebras based on customizable threshold
// @author       JLS-bz
// @match        https://kittensgame.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Wait for Automation Panel to be available
    // Register with Automation Panel to ensure controlled initialization order
    function waitForPanel(callback, maxAttempts = 100) {
        let attempts = 0;
        const checkInterval = setInterval(() => {
            attempts++;
            if (window.AutomationPanel && typeof window.AutomationPanel.registerMod === 'function') {
                clearInterval(checkInterval);
                // Register Zebra Trading with priority 1 (runs after Auto Build)
                window.AutomationPanel.registerMod('zebratrade', callback, 1);
                console.log('[AutoZebraTrade] Registered with Automation Panel');
            } else if (attempts >= maxAttempts) {
                clearInterval(checkInterval);
                console.error('[AutoZebraTrade] Automation Panel not found, initializing standalone');
                callback();
            }
        }, 100);
    }

    const AutoZebraTrade = (function() {
        const SEASON_NAMES = ['spring', 'summer', 'autumn', 'winter'];

        const state = {
            enabled: false,
            interval: null,
            goldCapThreshold: 0.99,
            goldReservePct: 0.25,
            goldCostPerTrade: 15,
            seasons: {
                spring: true,
                summer: true,
                autumn: true,
                winter: true
            }
        };

        const HTML = `
            <table style="width:100%; margin-bottom:8px;">
                <tr>
                    <td><b style="font-size:14px;">Auto Zebra Trading 🦓</b></td>
                    <td style="width:80px; text-align:right;">
                        <button id="toggleAutoTrade" style="width:70px; cursor:pointer;">Start</button>
                    </td>
                </tr>
            </table>
            <div style="display:flex; gap:8px; margin-bottom:8px; align-items:center;">
                <label style="font-size:12px;">Gold Threshold %:</label>
                <input type="number" id="goldThresholdInput" min="1" max="100" value="99" 
                    style="width:50px; padding:2px; font-size:12px;">
            </div>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-bottom:8px;">
                <label style="font-size:12px;">
                    <input type="checkbox" id="tr_spring" checked> Spring
                </label>
                <label style="font-size:12px;">
                    <input type="checkbox" id="tr_summer" checked> Summer
                </label>
                <label style="font-size:12px;">
                    <input type="checkbox" id="tr_autumn" checked> Autumn
                </label>
                <label style="font-size:12px;">
                    <input type="checkbox" id="tr_winter" checked> Winter
                </label>
            </div>
            <div id="tradeStatus" style="margin-top:6px; color:#888; font-size:11px;">Idle</div>
        `;

        /**
         * Sync UI checkboxes to state
         */
        function syncSettings() {
            state.seasons.spring = document.getElementById('tr_spring').checked;
            state.seasons.summer = document.getElementById('tr_summer').checked;
            state.seasons.autumn = document.getElementById('tr_autumn').checked;
            state.seasons.winter = document.getElementById('tr_winter').checked;

            // Get threshold from input (convert percentage to decimal)
            const thresholdInput = document.getElementById('goldThresholdInput');
            if (thresholdInput) {
                state.goldCapThreshold = parseInt(thresholdInput.value) / 100;
            }
        }

        /**
         * Execute one trade cycle
         */
        function run() {
            syncSettings();

            // Get current season
            const seasonName = SEASON_NAMES[gamePage.calendar.season];

            // Check if season is enabled
            if (!state.seasons[seasonName]) {
                window.AutomationPanel.setStatus('tradeStatus', 'Season: ' + seasonName + ' (skipping)');
                return;
            }

            // Get zebras diplomat
            const zebras = gamePage.diplomacy.get('zebras');
            if (!zebras || !zebras.unlocked) {
                window.AutomationPanel.setStatus('tradeStatus', 'Zebras not unlocked');
                return;
            }

            // Get gold resource
            const gold = window.gamePage.bld.get('library').meta[3]; // Try to get gold resource
            if (!gold || !gold.value || gold.maxValue <= 0) {
                window.AutomationPanel.setStatus('tradeStatus', 'No gold storage');
                return;
            }

            // Check if gold is at or above threshold
            const goldRatio = gold.value / gold.maxValue;
            if (goldRatio < state.goldCapThreshold) {
                window.AutomationPanel.setStatus('tradeStatus',
                    'Gold: ' + Math.floor(goldRatio * 100) + '% — waiting for ' + Math.floor(state.goldCapThreshold * 100) + '%'
                );
                return;
            }

            // Calculate spendable gold after reserve
            const goldSpendable = gold.value - (gold.maxValue * state.goldReservePct);
            const maxByGold = Math.floor(goldSpendable / state.goldCostPerTrade);

            if (maxByGold < 1) {
                window.AutomationPanel.setStatus('tradeStatus', 'Gold capped but spendable amount below reserve floor');
                return;
            }

            // Get max trades by catpower/slab availability
            const maxByCatpower = gamePage.diplomacy.getMaxTradeAmt(zebras);
            if (maxByCatpower < 1) {
                window.AutomationPanel.setStatus('tradeStatus', 'Season: ' + seasonName + ' — catpower/slab too low');
                return;
            }

            // Execute trades
            const tradesToDo = Math.min(maxByGold, maxByCatpower);
            const goldBefore = gold.value;
            gamePage.diplomacy.tradeMultiple(zebras, tradesToDo);

            window.AutomationPanel.setStatus('tradeStatus',
                'Season: ' + seasonName +
                ' — traded x' + tradesToDo +
                ' | Gold spent: ' + Math.floor(goldBefore - gold.value) +
                ' | Gold left: ' + Math.floor(gold.value) +
                ' (' + Math.floor((gold.value / gold.maxValue) * 100) + '%)'
            );
        }

        /**
         * Initialize the Auto Zebra Trade panel
         */
        function init() {
            // Wait for AutomationPanel to be available
            if (!window.AutomationPanel) {
                console.error('[AutoZebraTrade] AutomationPanel not found. Make sure Automation Panel mod is installed first.');
                return;
            }

            window.AutomationPanel.addSection(HTML);

            // Start auto-running if enabled
            if (state.enabled) {
                state.interval = setInterval(run, 2000);
            }

            // Expose toggleState globally for Automation Panel
            window.AutoZebraTrade = {
                toggleState: function() {
                    state.enabled = !state.enabled;
                    const toggleBtn = document.getElementById('toggleAutoTrade');
                    if (toggleBtn) {
                        toggleBtn.innerText = state.enabled ? 'Stop' : 'Start';
                    }
                    if (state.enabled) {
                        state.interval = setInterval(run, 2000);
                        window.AutomationPanel.setStatus('tradeStatus', 'Running...');
                    } else {
                        clearInterval(state.interval);
                        window.AutomationPanel.setStatus('tradeStatus', 'Idle');
                    }
                }
            };

            console.log('[AutoZebraTrade] Initialized successfully');
        }

        // Register with AutomationPanel when ready
        waitForPanel(init);

        return { init };
    })();

    // Make available globally
    window.AutoZebraTrade = AutoZebraTrade;
})();
