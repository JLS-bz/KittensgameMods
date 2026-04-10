---
layout: page
title: Automation Panel
description: Adds a third panel tab called "Automation". Must be loaded first before other automation script mods that depend on it.
img: assets/img/AutomationPanel.png
importance: 1
version: 1.0
last_updated: 2026-04-09
install_url: https://raw.githubusercontent.com/JLS-bz/KittensgameMods/main/_scripts/automation-panel.user.js
download_url: https://raw.githubusercontent.com/JLS-bz/KittensgameMods/main/_scripts/automation-panel.user.js
---


## Usage for Other Mod Developers

Once installed, other mods can interact with this panel:

```javascript
// Add content to the automation panel
AutomationPanel.addSection('<div id="myControl">My Automation</div>');

// Update status text
AutomationPanel.setStatus('myControl', 'Status Updated');

// Control panel visibility
AutomationPanel.showPanel();
AutomationPanel.hidePanel();

// Get reference to panel element
const panel = AutomationPanel.getPanel();
```


This mod is designed to be a prerequisite for future automation mods that build on the Automation Panel interface.
