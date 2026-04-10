// ==UserScript==
// @name         Kitten Turbo
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Speed multiplier for Kittens Game (1x, 25x, 50x, 75x, 100x)
// @author       JLS-bz
// @match        https://kittensgame.com/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    const KittenTurbo = (function() {
        const state = {
            enabled: true,
            interval: null,
            multiplier: 1
        };

        const SPEEDS = [1, 25, 50, 75, 100];
        const NATIVE_TICK_MS = 185;

        const HTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#f5f5f5; padding:8px; border-radius:4px;">
                <span style="font-weight:bold; font-size:14px;">Speed Multiplier:</span>
                <span style="display:flex; gap:12px;">
                    ${SPEEDS.map(speed => 
                        `<a href="#" class="kitten-turbo-btn" data-val="${speed}" style="text-decoration:underline; font-weight:bold; font-size:14px; color:#5d8aa8; cursor:pointer;">${speed}x</a>`
                    ).join('')}
                </span>
            </div>
        `;

        function apply() {
            if (state.interval) clearInterval(state.interval);
            state.interval = null;

            if (!state.enabled || state.multiplier <= 1) return;

            const INTERVAL = 100;
            const firesPerSec = 1000 / INTERVAL;
            const nativeTicksPerSec = 1000 / NATIVE_TICK_MS;
            const targetTicksPerSec = state.multiplier * nativeTicksPerSec;
            const extraTicksPerSec = targetTicksPerSec - nativeTicksPerSec;
            const ticksPerInterval = Math.round(extraTicksPerSec / firesPerSec);

            console.log(`[KittenTurbo] ${state.multiplier}x → ${ticksPerInterval} ticks per ${INTERVAL}ms interval`);

            state.interval = setInterval(function() {
                if (typeof gamePage !== 'undefined' && gamePage.tick) {
                    for (let i = 0; i < ticksPerInterval; i++) {
                        gamePage.tick();
                    }
                }
            }, INTERVAL);
        }

        function updateButtonStyles() {
            document.querySelectorAll('.kitten-turbo-btn').forEach(btn => {
                const btnSpeed = parseInt(btn.getAttribute('data-val'));
                if (btnSpeed === state.multiplier) {
                    btn.style.color = '#2c5aa0';
                    btn.style.fontWeight = 'bold';
                } else {
                    btn.style.color = '#000000';
                    btn.style.fontWeight = 'normal';
                }
            });
        }

        function init() {
            if (document.getElementById('kitten-turbo-container')) {
                console.log('Kitten Turbo is already running!');
                return;
            }

            const container = document.createElement('div');
            container.id = 'kitten-turbo-container';
            container.style.cssText = 'padding:6px 4px; margin:6px 0 10px 0; box-sizing:border-box; width:100%;';
            container.innerHTML = HTML;

            const tabHeader = document.querySelector('.right-tab-header');
            document.querySelector('#rightColumn').style.minWidth = '337px';
            tabHeader.parentElement.insertBefore(container, tabHeader);

            container.querySelectorAll('.kitten-turbo-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    state.multiplier = parseInt(this.getAttribute('data-val'));
                    apply();
                    updateButtonStyles();
                });
            });

            updateButtonStyles();
            apply();

            console.log('Kitten Turbo initialized! Current speed: 1x');
        }

        return {
            init: init,
            setSpeed: function(speed) {
                state.multiplier = speed;
                apply();
                updateButtonStyles();
                console.log(`Kitten Turbo speed set to ${speed}x`);
            },
            getSpeed: function() { return state.multiplier; }
        };
    })();

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', KittenTurbo.init);
    } else {
        KittenTurbo.init();
    }

    window.KittenTurbo = KittenTurbo;
})();