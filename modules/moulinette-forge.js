import { MoulinetteForgeModule } from "./moulinette-forge-module.js"

/*************************
 * Moulinette Forge
 *************************/
export class MoulinetteForge extends FormApplication {
  
  static MAX_ASSETS = 100
  
  static get TABS() { return game.moulinette.forge.map( f => f.id ) }
  
  constructor(tab) {
    super()
    const curTab = tab ? tab : game.settings.get("moulinette", "currentTab")
    this.tab = MoulinetteForge.TABS.includes(curTab) ? curTab : null
    
    // clear all caches
    for(const f of game.moulinette.forge) {
      f.instance.clearCache()
    }
  }
  
  static get defaultOptions() {
    return mergeObject(super.defaultOptions, {
      id: "moulinette",
      classes: ["mtte", "forge"],
      title: game.i18n.localize("mtte.moulinetteForge"),
      template: "modules/moulinette-core/templates/forge.hbs",
      width: 880,
      height: "auto",
      resizable: true,
      dragDrop: [{dragSelector: ".draggable"}],
      closeOnSubmit: false,
      submitOnClose: false,
    });
  }
  
  async getData() {
    if(!game.user.isGM) {
      return { error: game.i18n.localize("mtte.errorGMOnly") }
    }
    
    // no module available
    if(game.moulinette.forge.length == 0) {
      return { error: game.i18n.localize("mtte.errorNoModule") }
    }
    
    // highlight selected tab
    for(const f of game.moulinette.forge) {
      f.active = this.tab == f.id
      if(f.active) {
        this.activeModule = f
      }
    }
    
    // no active module => select first
    if(!this.activeModule) {
      this.activeModule = game.moulinette.forge[0]
      this.activeModule.active = true
    }
    
    // fetch available packs
    let packs = await this.activeModule.instance.getPackList()
    packs = packs.sort((a, b) => (a.publisher == b.publisher) ? (a.name > b.name ? 1 : -1) : (a.publisher > b.publisher ? 1 : -1)) // sort by 1) publisher and 2) name
    let assetsCount = 0
    let special = false
    packs.forEach(p => { 
      if(p.special) special = true
      else assetsCount += p.count
    })
    
    // fetch initial asset list
    const assets = await this.activeModule.instance.getAssetList()
      
    return { 
      user: await game.moulinette.applications.Moulinette.getUser(),
      modules: game.moulinette.forge.sort((a,b) => a.name < b.name ? -1 : 1), 
      activeModule: this.activeModule,
      packs: packs.filter(p => p.count > 0 || p.special),
      assetsCount: `${assetsCount.toLocaleString()}${special ? "+" : ""}`,
      assets: assets,
      footer: await this.activeModule.instance.getFooter()
    }
  }

  activateListeners(html) {
    super.activateListeners(html);
    
    // make sure window is on top of others
    this.bringToTop()
    
    // give focus to input text
    html.find("#search").focus();
    
    // module navigation
    html.find(".tabs a").click(this._onNavigate.bind(this));
    
    // buttons
    html.find("button").click(this._onClickButton.bind(this))
   
    // display mode
    html.find(".display-modes a").click(this._onChangeDisplayMode.bind(this))
    
    // highlight current displayMode
    const dMode = game.settings.get("moulinette", "displayMode")
    html.find(`.display-modes .mode-${dMode}`).addClass("active")
    
    // asset search (filter on pack)
    const parent = this
    html.find("select.packlist").on('change', this._onPackSelected.bind(this));
    
    // delegate activation to module
    if(this.activeModule) {
      this.activeModule.instance.activateListeners(html)
    }
    
    // autoload on scroll
    html.find(".list").on('scroll', this._onScroll.bind(this))
    
    this.html = html
  }
  
  /**
   * User clicked on another tab (i.e. module)
   */
  _onNavigate(event) {
    event.preventDefault();
    const source = event.currentTarget;
    const tab = source.dataset.tab;
    if(MoulinetteForge.TABS.includes(tab)) {
      this.assets = [] // clean search list
      this.tab = tab
      game.settings.set("moulinette", "currentTab", tab)
      this.render();
    }
  }
  
  /**
   * User selected a pack
   */
  async _onPackSelected(event) {
    this.html.find("#search").val("")
    await this._searchAssets()
  }
  
  /**
   * User clicked on button (or ENTER on search)
   */
  async _onClickButton(event) {
    event.preventDefault();

    // delegate activation to module
    if(this.activeModule) {

      const source = event.currentTarget;
      // search
      if(source.classList.contains("search")) {
        await this._searchAssets()
      } 
      // any other action
      else {
        const refresh = await this.activeModule.instance.onAction(source.classList)
        if(refresh) {
          this.render()
        }
      }
    }
  }
  
  /**
   * Refresh the list based on the new search
   */
  async _searchAssets() {
    const searchTerms = this.html.find("#search").val().toLowerCase()
    const selectedPack = this.html.find(".packlist").children("option:selected").val()
    this.assets = await this.activeModule.instance.getAssetList(searchTerms, selectedPack)
    
    if(this.assets.length == 0 && searchTerms.length == 0) {
      this.html.find('.list').html(`<div class="error">${game.i18n.localize("mtte.specialSearch")}</div>`)
    }
    else if(this.assets.length == 0) {
      this.html.find('.list').html(`<div class="error">${game.i18n.localize("mtte.noResult")}</div>`)
    }
    else {
      this.assetInc = 0
      this.html.find('.list').html(this.assets.slice(0, MoulinetteForge.MAX_ASSETS).join(""))
    }
    
    // re-enable listeners
    this.html.find("*").off()
    this.activateListeners(this.html)
    
    // re-enable core   listeners (for drag & drop)
    if(!game.data.version.startsWith("0.7")) {
      this._activateCoreListeners(this.html)
    }
    
    // force resize window
    this.setPosition()
  }
  
  /**
   * Dragging event
   */
  _onDragStart(event) {
    super._onDragStart(event)
    
    // delegate activation to module
    if(this.activeModule) {
      this.activeModule.instance.onDragStart(event)
    }
  }
  
  /**
   * Scroll event
   */
  async _onScroll(event) {
    if(this.ignoreScroll) return;
    const bottom = $(event.currentTarget).prop("scrollHeight") - $(event.currentTarget).scrollTop()
    const height = $(event.currentTarget).height();
    if(!this.assets) return;
    if(bottom - 20 < height) {
      this.ignoreScroll = true // avoid multiple events to occur while scrolling
      if(this.assetInc * MoulinetteForge.MAX_ASSETS < this.assets.length) {
        this.assetInc++
        this.html.find('.list').append(this.assets.slice(this.assetInc * MoulinetteForge.MAX_ASSETS, (this.assetInc+1) * MoulinetteForge.MAX_ASSETS))
        
        // re-enable listeners
        this.html.find("*").off()
        this.activateListeners(this.html)
      }
      this.ignoreScroll = false
    }
  }
  
  /**
   * User chose display mode
   */
  async _onChangeDisplayMode(event) {
    event.preventDefault();
    let mode = "tiles"
    const source = event.currentTarget
    if(source.classList.contains("mode-list")) {
      mode = "list"
    }
    await game.settings.set("moulinette", "displayMode", mode == "tiles" ? "tiles" : "list")
    this.html.find(".display-modes a").toggleClass("active")
    this._searchAssets()
  }
  
}
