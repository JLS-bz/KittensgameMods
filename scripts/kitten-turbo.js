// Kitten Turbo - Speed Multiplier for Kittens Game
// Copy and paste this into the browser console (F12 -> Console tab)

(function() {
    'use strict';

    const KittenTurbo = (function() {
        const state = {
            enabled: true,
            interval: null,
            multiplier: 1
        };

        const SPEEDS = [1, 25, 50, 75, 100];

        const HTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px; background:#f5f5f5; padding:8px; border-radius:4px;">
                <span style="font-weight:bold; font-size:14px;">Speed Multiplier:</span>
                <span style="display:flex; gap:12px;">
                    ${SPEEDS.map(speed => 
                        `<a href="#" class="kitten-turbo-btn" data-val="${speed}" style="text-decoration:underline; font-weight:bold; font-size:14px; color:#5d8aa8; cursor:pointer;">${speed}x</a>`
                    ).join('')}
                </span>
            </div>
            <hr>
        `;

        function apply() {
            if (state.interval) clearInterval(state.interval);
            state.interval = null;
            
            if (!state.enabled || state.multiplier <= 1) return;
            
            state.interval = setInterval(function() {
                if (typeof gamePage !== 'undefined' && gamePage.tick) {
                    gamePage.tick();
                }
            }, Math.round(1000 / state.multiplier));
        }

        function updateButtonStyles() {
            document.querySelectorAll('.kitten-turbo-btn').forEach(btn => {
                const btnSpeed = parseInt(btn.getAttribute('data-val'));
                if (btnSpeed === state.multiplier) {
                    btn.style.color = '#d9534f';
                    btn.style.fontWeight = 'bold';
                } else {
                    btn.style.color = '#5d8aa8';
                    btn.style.fontWeight = 'bold';
                }
            });
        }

        function init() {
            // Find the sidebar or appropriate location to inject UI
            const sidebar = document.querySelector('.sidebar') || document.querySelector('body');
            
            // Check if already initialized
            if (document.getElementById('kitten-turbo-container')) {
                console.log('Kitten Turbo is already running!');
                return;
            }
            
            const container = document.createElement('div');
            container.id = 'kitten-turbo-container';
            container.innerHTML = HTML;
            sidebar.insertBefore(container, sidebar.firstChild);

            // Attach click handlers
            container.querySelectorAll('.kitten-turbo-btn').forEach(btn => {
                btn.addEventListener('click', function(e) {
                    e.preventDefault();
                    state.multiplier = parseInt(this.getAttribute('data-val'));
                    apply();
                    updateButtonStyles();
                });
            });

            // Set initial state and style
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
            getSpeed: function() {
                return state.multiplier;
            }
        };
    })();

    // Initialize when page loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', KittenTurbo.init);
    } else {
        KittenTurbo.init();
    }

    // Expose to window for manual control
    window.KittenTurbo = KittenTurbo;
})();
