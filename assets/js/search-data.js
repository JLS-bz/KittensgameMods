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
            },},{id: "mods-project-2",
          title: 'project 2',
          description: "a project with a background image and giscus comments",section: "Mods",handler: () => {
              window.location.href = "/KittensgameMods/mods/2_mod/";
            },},];
