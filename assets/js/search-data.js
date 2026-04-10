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
          description: "",
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
          description: "Adds a third panel tab called &quot;Automation&quot;. Must be loaded first before other automation script mods that depend on it.",section: "Mods",handler: () => {
              window.location.href = "/KittensgameMods/mods/2_mod/";
            },},{id: "mods-auto-zebra-trading",
          title: 'Auto Zebra Trading',
          description: "Automatically trade gold with zebras based on a customizable gold cap threshold. Toggle auto-trading on/off for specific seasons (Spring, Summer, Autumn, Winter). Trades the maximum amount allowed by both gold and resources.",section: "Mods",handler: () => {
              window.location.href = "/KittensgameMods/mods/3_mod/";
            },},];
