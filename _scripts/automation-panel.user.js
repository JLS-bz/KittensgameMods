// ==UserScript==
// @name         Kittens Game - Automation Panel
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Adds third panel tab for automation scripts (prerequisite mod)
// @author       JLS-bz
// @match        https://kittensgame.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // Triple-check to prevent any duplicate initialization
    if (window.AutomationPanel) {
        console.log('[AutomationPanel] Already loaded in window, skipping');
        return;
    }
    
    // Also check if tab already exists in DOM
    if (document.getElementById('automationLink')) {
        console.log('[AutomationPanel] Tab already exists in DOM, skipping');
        // Restore reference if missing
        if (!window.AutomationPanel) {
            window.AutomationPanel = { addSection: function() {} };
        }
        return;
    }

    const AutomationPanel = (function() {
        const state = {
            panel: null,
            automationLink: null,
            initialized: false,
            pendingSections: [],
            modRegistry: {}, // Track registered dependent mods
            initQueue: [] // Queue for initialization in order
        };

        /**
         * Register a dependent mod for controlled initialization
         * @param {string} modName - Name of the mod (e.g., 'autobuild', 'zebratrade')
         * @param {function} initFn - Initialization function to call
         * @param {number} priority - Lower number = earlier initialization (0 = first)
         */
        function registerMod(modName, initFn, priority = 999) {
            state.modRegistry[modName] = {
                name: modName,
                initFn: initFn,
                priority: priority,
                initialized: false
            };
            console.log(`[AutomationPanel] Registered mod: ${modName} (priority: ${priority})`);
        }

        /**
         * Initialize all registered mods in priority order
         */
        function initializeRegisteredMods() {
            const mods = Object.values(state.modRegistry)
                .filter(m => !m.initialized)
                .sort((a, b) => a.priority - b.priority);

            mods.forEach(function(mod) {
                try {
                    console.log(`[AutomationPanel] Initializing mod: ${mod.name}`);
                    mod.initFn();
                    mod.initialized = true;
                } catch (e) {
                    console.error(`[AutomationPanel] Failed to initialize ${mod.name}:`, e);
                }
            });
        }

        /**
         * Initialize the automation panel tab
         */
        function init() {
            if (state.initialized) {
                console.log('[AutomationPanel] Already initialized (state flag)');
                return;
            }
            
            // Additional check: mark on document to prevent race conditions
            if (document.body.getAttribute('data-automation-panel-init')) {
                console.log('[AutomationPanel] Already initialized (document flag)');
                return;
            }
            
            document.body.setAttribute('data-automation-panel-init', 'true');
            
            try {
                buildTab();
                attachListeners();
                attachPanelEventListener();
                state.initialized = true;
                
                // Initialize registered mods AFTER panel is built
                setTimeout(function() {
                    initializeRegisteredMods();
                }, 100);
                
                console.log('[AutomationPanel] Initialized successfully');
            } catch (e) {
                console.error('[AutomationPanel] Failed to initialize:', e);
            }
        }

        /**
         * Attach global event listener for panel buttons (event delegation)
         */
        function attachPanelEventListener() {
            if (!state.panel) return;
            
            state.panel.addEventListener('click', function(e) {
                const btn = e.target.closest('button');
                if (!btn) return;
                
                // Handle Auto Build buttons
                if (btn.id === 'autobuild-customize') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.AutoBuild && window.AutoBuild.openConfigWindow) {
                        window.AutoBuild.openConfigWindow();
                    }
                    return false;
                }
                
                if (btn.id === 'autobuild-toggle') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.AutoBuild && window.AutoBuild.toggleState) {
                        window.AutoBuild.toggleState();
                    }
                    return false;
                }
                
                // Handle Zebra Trading button
                if (btn.id === 'toggleAutoTrade') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.AutoZebraTrade && window.AutoZebraTrade.toggleState) {
                        window.AutoZebraTrade.toggleState();
                    }
                    return false;
                }
            }, true);
        }

        /**
         * Build the automation tab link and panel
         */
        function buildTab() {
            // Check if already built
            if (document.getElementById('automationLink')) {
                console.log('[AutomationPanel] Tab already exists, skipping build');
                state.automationLink = document.getElementById('automationLink');
                state.panel = document.getElementById('rightTabAutomation');
                return;
            }

            // Get the link parent (where Log and Queue buttons are)
            const linkParent = document.getElementById('logLink');
            if (!linkParent || !linkParent.parentElement) {
                throw new Error('Cannot find logLink element');
            }

            // Create the Automation tab link
            state.automationLink = document.createElement('a');
            state.automationLink.id = 'automationLink';
            state.automationLink.href = '#';
            state.automationLink.style.cssText = 'cursor:pointer; text-decoration:none; margin:0 8px;';
            state.automationLink.innerText = 'Automation';
            linkParent.parentElement.appendChild(state.automationLink);

            // Create the automation panel container
            const queuePanel = document.getElementById('rightTabQueue');
            if (!queuePanel || !queuePanel.parentElement) {
                throw new Error('Cannot find rightTabQueue element');
            }

            state.panel = document.createElement('div');
            state.panel.id = 'rightTabAutomation';
            state.panel.className = 'right-tab';
            state.panel.style.cssText = 'display:none; padding:5px; font-size:12px; overflow-y:auto;';
            queuePanel.parentElement.appendChild(state.panel);

            // Add any pending sections that were queued
            state.pendingSections.forEach(function(html) {
                state.panel.insertAdjacentHTML('beforeend', html);
            });
            state.pendingSections = [];
        }

        /**
         * Attach event listeners to tab switching
         */
        function attachListeners() {
            // Skip if already attached
            if (state.automationLink._listenersAttached) return;
            
            // Automation link click handler
            state.automationLink.addEventListener('click', function(e) {
                e.preventDefault();
                showPanel();
            });

            // Hide panel when switching to Log or Queue tabs
            ['logLink', 'queueLink'].forEach(function(id) {
                const link = document.getElementById(id);
                if (!link) return;

                const originalOnClick = link.onclick;
                link.onclick = function(e) {
                    hidePanel();
                    if (originalOnClick) {
                        return originalOnClick.call(this, e);
                    }
                };
            });

            // Mark listeners as attached
            state.automationLink._listenersAttached = true;
        }

        /**
         * Show the automation panel and hide others
         */
        function showPanel() {
            const logPanel = document.getElementById('rightTabLog');
            const queuePanel = document.getElementById('rightTabQueue');

            if (logPanel) logPanel.style.display = 'none';
            if (queuePanel) queuePanel.style.display = 'none';
            if (state.panel) state.panel.style.display = 'block';
        }

        /**
         * Hide the automation panel
         */
        function hidePanel() {
            if (state.panel) state.panel.style.display = 'none';
        }

        /**
         * Add HTML content to the panel
         * @param {string} html - HTML content to add
         */
        function addSection(html) {
            if (state.panel) {
                // Add top border if there's already content
                if (state.panel.children.length > 0) {
                    const borderDiv = document.createElement('div');
                    borderDiv.style.cssText = 'border-top:1px solid #ccc; margin:8px 0;';
                    state.panel.appendChild(borderDiv);
                }
                state.panel.insertAdjacentHTML('beforeend', html);
            } else {
                // Queue if panel not ready yet
                state.pendingSections.push(html);
            }
        }

        /**
         * Update status text in the panel
         * @param {string} id - Element ID
         * @param {string} text - Text content
         */
        function setStatus(id, text) {
            const el = document.getElementById(id);
            if (el) el.textContent = text;
        }

        /**
         * Get the panel element
         */
        function getPanel() {
            return state.panel;
        }

        // Auto-initialize when DOM is ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            // DOM is already loaded
            init();
        }

        // Public API
        return {
            addSection: addSection,
            setStatus: setStatus,
            getPanel: getPanel,
            showPanel: showPanel,
            hidePanel: hidePanel,
            registerMod: registerMod,
            initializeRegisteredMods: initializeRegisteredMods
        };
    })();

    // Make AutomationPanel available globally for other mods
    window.AutomationPanel = AutomationPanel;
})();
