// ==UserScript==
// @name         Kittens Game - Automation Panel
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds third panel tab for automation scripts (prerequisite mod)
// @author       JLS-bz
// @match        https://kittensgame.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const AutomationPanel = (function() {
        const state = {
            panel: null,
            automationLink: null,
            initialized: false
        };

        /**
         * Initialize the automation panel tab
         */
        function init() {
            if (state.initialized) return;
            
            try {
                buildTab();
                attachListeners();
                state.initialized = true;
                console.log('[AutomationPanel] Initialized successfully');
            } catch (e) {
                console.error('[AutomationPanel] Failed to initialize:', e);
            }
        }

        /**
         * Build the automation tab link and panel
         */
        function buildTab() {
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
        }

        /**
         * Attach event listeners to tab switching
         */
        function attachListeners() {
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
            if (!state.panel) return;
            state.panel.insertAdjacentHTML('beforeend', html);
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
            hidePanel: hidePanel
        };
    })();

    // Make AutomationPanel available globally for other mods
    window.AutomationPanel = AutomationPanel;
})();
