// get the ninja-keys element
const ninja = document.querySelector('ninja-keys');

// add the home and posts menu items
ninja.data = [{
    id: "nav-about",
    title: "about",
    section: "Navigation",
    handler: () => {
      window.location.href = "/KittensgameMods/";
    },
  },{id: "nav-mods",
          title: "mods",
          description: "A growing collection of quality-of-life and automation scripts for Kittens Game.",
          section: "Navigation",
          handler: () => {
            window.location.href = "/KittensgameMods/mods/";
          },
        },{id: "mods-kitten-turbo-speed",
          title: 'Kitten Turbo Speed',
          description: "Set custom game speed multipliers (1x, 25x, 50x, 75x, 100x) to accelerate your gameplay",section: "Mods",handler: () => {
              window.location.href = "/KittensgameMods/mods/1_mod/";
            },},{id: "mods-automation-panel",
          title: 'Automation Panel',
          description: "Adds a third panel tab called &quot;Automation&quot;, to the right of Log and Queue. Must be loaded first before other automation script mods that depend on it.",section: "Mods",handler: () => {
              window.location.href = "/KittensgameMods/mods/2_mod/";
            },},];
