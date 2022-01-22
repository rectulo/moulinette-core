
import { Moulinette } from "./modules/moulinette.js"
import { MoulinetteLayer } from "./modules/moulinette-layer.js"
import { MoulinetteCache } from "./modules/moulinette-cache.js"
import { MoulinetteFileUtil } from "./modules/moulinette-file-util.js"
import { MoulinetteFilePicker } from "./modules/moulinette-filepicker.js"
import { MoulinetteClient } from "./modules/moulinette-client.js"
import { MoulinetteForgeModule } from "./modules/moulinette-forge-module.js"
import { MoulinettePatreon } from "./modules/moulinette-patreon.js"

/**
 * Init: define global game settings & helpers
 */
Hooks.once("init", async function () {
  console.log("Moulinette Core| Init")
  
  game.settings.register("moulinette", "userId", { scope: "world", config: false, type: String, default: "anonymous" });
  game.settings.register("moulinette", "currentTab", { scope: "world", config: false, type: String, default: "scenes" })
  game.settings.register("moulinette", "displayMode", { scope: "world", config: false, type: String, default: "list" })
  game.settings.register("moulinette", "winPosForge", { scope: "world", config: false, type: Object })
  game.settings.register("moulinette", "favorites", { scope: "world", config: false, type: Object, default: { default: { icon: "fas fa-heart", list: [] }} })
  game.settings.register("moulinette", "currentFav", { scope: "world", config: false, type: String, default: "history" })
  
  game.settings.register("moulinette-core", "customPath", {
    name: game.i18n.localize("mtte.configCustomPath"), 
    hint: game.i18n.localize("mtte.configCustomPathHint"), 
    scope: "world",
    config: true,
    default: "",
    type: String
  });
  
  game.settings.register("moulinette-core", "debugScanAssets", {
    name: game.i18n.localize("mtte.configDebugScanAssets"), 
    hint: game.i18n.localize("mtte.configDebugScanAssetsHint"), 
    scope: "world",
    config: true,
    default: false,
    type: Boolean
  });
  
  game.settings.register("moulinette-core", "showCaseContent", {
    name: game.i18n.localize("mtte.configShowCase"), 
    hint: game.i18n.localize("mtte.configShowCaseHint"), 
    scope: "world",
    config: true,
    default: true,
    type: Boolean
  });
  
  game.settings.register("moulinette-core", "enableMoulinetteCloud", {
    name: game.i18n.localize("mtte.configEnableMoulinetteCloud"), 
    hint: game.i18n.localize("mtte.configEnableMoulinetteCloudHint"), 
    scope: "world",
    config: true,
    default: true,
    type: Boolean,
    onChange: () => game.moulinette.user = {}
  });
  
  game.settings.register("moulinette-core", "s3Bucket", {
    name: game.i18n.localize("mtte.configS3"), 
    hint: game.i18n.localize("mtte.configS3Hint"), 
    scope: "world",
    config: true,
    default: "",
    type: String
  });
  
  game.settings.register("moulinette-core", "browseMode", {
    name: game.i18n.localize("mtte.configBrowseMode"), 
    hint: game.i18n.localize("mtte.configBrowseModeHint"), 
    scope: "world",
    config: true,
    default: "",
    choices: { byPack: game.i18n.localize("mtte.browseByPack"), byPub: game.i18n.localize("mtte.browseByPublisher") },
    type: String
  });
  
  game.settings.register("moulinette-core", "filepicker", {
    name: game.i18n.localize("mtte.configFilepicker"), 
    hint: game.i18n.localize("mtte.configFilepickerHint"), 
    scope: "world",
    config: true,
    default: false,
    type: Boolean,
    onChange: () => window.location.reload()
  });
  
  game.settings.register("moulinette-core", "uiMode", {
    name: game.i18n.localize("mtte.configUIMode"), 
    hint: game.i18n.localize("mtte.configUIModeHint"), 
    scope: "world",
    config: true,
    default: "default",
    choices: { compact: game.i18n.localize("mtte.uiModeCompact"), default: game.i18n.localize("mtte.uiModeDefault") },
    type: String
  });

  game.keybindings.register("moulinette-core", "favoriteKey", {
    name: game.i18n.localize("mtte.configFavoriteKey"),
    hint: game.i18n.localize("mtte.configFavoriteKeyHint"),
    editable: [{ key: "KeyM", modifiers: [ "Control" ]}],
    onDown: () => {
      if(game.moulinette.applications.MoulinetteTilesFavorites) {
        (new game.moulinette.applications.MoulinetteTilesFavorites()).render(true)
      } else {
        console.warn("Moulinette Tiles not enabled (or not up-to-date?)")
      }
    },
    onUp: () => {},
    restricted: true,  // Restrict this Keybinding to gamemaster only?
    reservedModifiers: [],
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  })
  
  game.moulinette = {
    user: { hasEarlyAccess: function() { return false } },
    modules: [],
    applications: {
      Moulinette,
      MoulinetteClient,
      MoulinetteForgeModule,
      MoulinetteFileUtil,
      MoulinetteFilePicker
    },
    cache: new MoulinetteCache(),
    forge: [],
    macros: [],
    sources: [
      { type: "images", publisher: "Foundry VTT", pack: "Core Data Icons", source: "public", path: "icons" }
    ],
    toggles: {}
  }
  game.moulinette.toggles.patreon = true

  Handlebars.registerHelper('pretty', function(value) {
    return isNaN(value) ? Moulinette.prettyText(value) : Moulinette.prettyNumber(value)
  });

  const layers = { moulinette: { layerClass: MoulinetteLayer, group: "primary" } }
  CONFIG.Canvas.layers = foundry.utils.mergeObject(Canvas.layers, layers);

});


/**
 * Setup: defines add a default module (Forge)
 */
Hooks.once("ready", async function () {
  // load one default module (Forge)
  game.moulinette.modules.push({
    id: "forge",
    name: game.i18n.localize("mtte.moulinetteForge"),
    descr: game.i18n.localize("mtte.moulinetteForgeHelp"), 
    icon: "modules/moulinette-core/img/moulinette.png",
    class: (await import("./modules/moulinette-forge.js")).MoulinetteForge
  })
  // Add asset packs from the Forge's Bazaar if running on the Forge
  if (typeof ForgeVTT != "undefined" && ForgeVTT.usingTheForge) {
    const result = await FilePicker.browse("forge-bazaar", "assets");
    for (const dir of result.dirs) {
        game.moulinette.sources.push({type: "tiles", "publisher": "Bazaar", pack: dir.slice("assets/".length), source: "forge-bazaar", path: dir});
        game.moulinette.sources.push({type: "sounds", "publisher": "Bazaar", pack: dir.slice("assets/".length), source: "forge-bazaar", path: dir});
    }
  }
  
  if( game.settings.get("moulinette-core", "filepicker") ) {
    FilePicker = game.moulinette.applications.MoulinetteFilePicker
  }

  // clear any existing favorite settings
  const favs = game.settings.get("moulinette", "favorites");
  if (favs.constructor != Object) {
    game.settings.set("moulinette", "favorites", { default: { icon: "fas fa-heart", list: [] }});
  }

  // backwards compatibility (0.7.x and 0.8.x)
  if(!SceneNavigation._onLoadProgress) {
    SceneNavigation._onLoadProgress = function(message, progress) {
      SceneNavigation.displayProgressBar({label: message, pct: progress});
    }
  }
});

/**
 * Ready: defines a shortcut to open Moulinette Interface
 */
Hooks.once("ready", async function () {
  if (game.user.isGM) {
    await MoulinetteFileUtil.createFolderRecursive("moulinette");
  }
});

/**
 * Controls: adds a new Moulinette control
 */
Hooks.on('getSceneControlButtons', (buttons) => {

  if(game.user.isGM) {
    const moulinetteTool = {
      activeTool: "select",
      icon: "fas fa-hammer",
      layer: "moulinette",
      name: "moulinette",
      title: game.i18n.localize("mtte.moulinette"),
      tools: [{ name: "select", icon: "fas fa-expand", title: "Select" }],
      visible: true
    }
    // patreon integration
    moulinetteTool.tools.push({
      name: "patreon",
      icon: "fab fa-patreon",
      title: game.i18n.localize("mtte.patreon"),
      button: true,
      onClick: () => { new MoulinettePatreon().render(true) }
    })

    // all moulinette modules
    const modules = game.moulinette.forge.sort((a,b) => a.name < b.name ? -1 : 1)
    for(const m of modules) {
      moulinetteTool.tools.push({
        name: m.id,
        icon: m.icon,
        title: `${game.i18n.localize("mtte.moulinette")} - ${m.name}`,
        button: true,
        onClick: () => {
          const forgeClass = game.moulinette.modules.find(m => m.id == "forge").class
          new forgeClass(m.id).render(true)
        }
      })

      // additional specific controls
      const shortcuts = []
      if(m.shortcuts) {
        for(const s of m.shortcuts) {
          shortcuts.push({
            name: s.id,
            icon: s.icon,
            title: `${game.i18n.localize("mtte.moulinette")} - ${s.name}`,
            button: true,
            onClick: () => { m.instance.onShortcut(s.id) }
          })
        }
      }
      moulinetteTool.tools.push.apply(moulinetteTool.tools, shortcuts)

      // insert into existing control lists
      if(m.layer) {
        const button = buttons.find(b => b.name == m.layer)
        if(button) {
          button.tools.push({
            name: m.id,
            icon: "fas fa-hammer",
            title: `${game.i18n.localize("mtte.moulinette")} - ${m.name}`,
            button: true,
            onClick: () => {
              const forgeClass = game.moulinette.modules.find(m => m.id == "forge").class
              new forgeClass(m.id).render(true)
            }
          })
          button.tools.push.apply(button.tools, shortcuts)
        }
      }
    }

    buttons.push(moulinetteTool)
  }
})
