const PopoutModule = {
  _openWindows: [],

  onRenderJournalSheet(obj, html, data) {
    let element = html.find(".window-header .window-title");
    PopoutModule.addPopout(
      element,
      `game.journal.get("${obj.entity.id}").sheet`
    );
  },
  onRenderActorSheet(obj, html, data) {
    let element = html.find(".window-header .window-title");
    PopoutModule.addPopout(
      element,
      `game.actors.get("${obj.entity.id}").sheet`
    );
  },
  addPopout(element, sheet) {
    // Can't find it?
    if (element.length !== 1) {
      return;
    }
    let popout = $(
      '<a class="popout" style><i class="fas fa-external-link-alt"></i>PopOut!</a>'
    );
    popout.on("click", event => PopoutModule.onPopoutClicked(event, sheet));
    element.after(popout);
  },
  onPopoutClicked(event, sheet) {
    // Lazy way of finding sheet to close
    const sheetToClose = eval(sheet);
    if (sheetToClose != null) sheetToClose.close();

    let div = $(event.target).closest("div");
    let window_title = div
      .find(".window-title")
      .text()
      .trim();

    // Create a new html document
    let html = $("<html>");
    let head = $("<head>");
    let body = $("<body>");

    // Copy classes from html/head/body tags and add title
    html.attr("class", $("html").attr("class"));
    head.attr("class", $("head").attr("class"));
    head.append($("<title>" + window_title + "</title>"));
    body.attr("class", $("body").attr("class"));
    /*
		// Clone the journal sheet so we can modify it safely
		div = div.clone()
		// Avoid other apps with the same id from destroying this div
		div.attr("id", "popout-main-div")
		// Remove the buttons and forms because there are no JS hooks into them.
		div.find("header a,form button,form .form-group,.window-resizable-handle").remove()
		// Make sure any newly opened item doesn't get hidden behind it and set the size to the full window - padding.
		div.css({
			"z-index": "0",
			"width": "100%",
			"height": "100%",
			"top": "0",
			"left": "0",
			"padding": "15px",
		})
		body.append(div)*/
    html.append(head);
    html.append(body);

    // Copy the scripts and css so the sheet appears correctly
    for (let link of $("head link")) {
      let new_link = $(link).clone();
      // Replace the href with the full URL
      if (new_link.href !== "") new_link.attr("href", link.href);
      head.append(new_link);
    }
    for (let script of $("head script,body script")) {
      let new_script = $(script).clone();
      // Replace the src with the full URL
      if (script.src !== "") new_script.attr("src", script.src);
      head.append(new_script);
    }
    head.append($("<script>canvas = {};</script>"));
    // Avoid having the UI initialized which renders the chatlog and all sorts
    // of other things behind the sheet
    body.append(
      $(`<script>
                      Game.isPopout = true;
		      Game.prototype.initializeUI = function() {
				ui.nav = new SceneNavigation();
				ui.controls = new SceneControls();
				ui.notifications = new Notifications().render();
				ui.sidebar = new Sidebar();
				// sidebar elements only get created on the render
				// but we don't want to render them
                                ui.webrtc = new CameraViews(this.webrtc);
				ui.chat = new ChatLog({ tabName: "chat" });
				ui.combat = new CombatTracker({ tabName: "combat" });
				ui.scenes = new SceneDirectory({ tabName: "scenes" });
				ui.actors = new ActorDirectory({ tabName: "actors" });
				ui.items = new ItemDirectory({ tabName: "items" });
				ui.journal = new JournalDirectory({ tabName: "journal" });
				ui.tables = new RollTableDirectory({ tabName: "tables" });
                                ui.playlists = new PlaylistDirectory({ tabName: "playlists" });
				ui.compendium = new CompendiumDirectory({ tabName: "compendium" });
				ui.settings = new Settings({ tabName: "settings" });
					}

                                        KeyboardManager.prototype._onEscape = function(event, up, modifiers) {
                                          if (up || modifiers.return) return;

                                          // Case 1 - dismiss an open context menu
                                          if ( ui.context && ui.context.menu.length ) ui.context.close();
                                          // Case 2 - close open UI windows
                                          else if ( Object.keys(ui.windows).length ) {
                                                  Object.values(ui.windows).filter(w => w.id !== ${sheet}.id).forEach(app => app.close());
                                          }
                                          // Flag the keydown workflow as handled
                                          this._handled.add(event.keyCode);
                                        }

					Hooks.once('ready', async () => {
						let forceProceed = false;
						setTimeout(() => { forceProceed = true; }, 2000);
						while (${sheet}.template === "templates/sheets/actor-sheet.html" && !forceProceed) await (() => { return new Promise(resolve => { setTimeout(() => resolve(), 10); }); })();
						PopoutModule.renderPopout(${sheet});
					});
		      window.dispatchEvent(new Event('load'));
					</script>`)
    );
    // Open new window and write the new html document into it
    // We need to open it to the same url because some images use relative paths
    let win = window.open(window.location.toString());
    this._openWindows.push(win);
    win.addEventListener("close", () => {
      this._openWindows.splice(this._openWindows.indexOf(win), 1);
    });
    // console.log(win, window.location)
    // This is for electron which doesn't have a Window but a BrowserWindowProxy
    if (win.document === undefined) {
      win.eval(
        `document.write(\`<!doctype html>${html[0].outerHTML}\`); document.close();`
      );
    } else {
      win.document.write(`<!doctype html>${html[0].outerHTML}`);
      // After doing a write, we need to do a document.close() so it finishes
      // loading and emits the load event.
      win.document.close();
    }
  },

  renderPopout(sheet) {
    sheet._original_popout_render = sheet._render;
    sheet.options.minimizable = false;
    sheet.options.resizable = false;
    sheet.options.id = "popout-" + sheet.id;
    sheet.options.closeOnSubmit = false;
    Object.defineProperty(sheet, "id", {
      value: sheet.options.id,
      writable: true,
      configurable: true
    });
    // Replace the render function so if it gets re-rendered (such as switching journal view mode), we can
    // re-maximize it.
    sheet._render = async function(force, options) {
      await this._original_popout_render(true, options);
      // Maximize it
      sheet.element.css({
        width: "100%",
        height: "100%",
        top: "0px",
        left: "0px"
      });
      // Remove the close and popout buttons
      sheet.element.find("header .close, header .popout").remove();
    };
    sheet.render(true);
  },

  closeAllWindows() {
    while (this._openWindows.length > 0) {
      const win = this._openWindows.shift();
      win.close();
    }
  },
}

window.addEventListener("beforeunload", () => { PopoutModule.closeAllWindows(); });

Hooks.on("ready", () => {
  Hooks.on("renderJournalSheet", PopoutModule.onRenderJournalSheet);
  Hooks.on("renderActorSheet", PopoutModule.onRenderActorSheet);
});

// Overwrite Playlist function, so as to not play music in popout menus
const Playlist_playSound = Playlist.prototype.playSound;
Playlist.prototype.playSound = function(...args) {
  if (Game.isPopout) return;

  Playlist_playSound.call(this, ...args);
};
