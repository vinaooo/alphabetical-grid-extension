//Local extension imports
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const { ExtensionHelper } = Me.imports.lib;
const ShellVersion = ExtensionHelper.shellVersion;

//Main imports
const { Gtk, Gio, GLib } = imports.gi;
const Adw = ShellVersion >= 42 ? imports.gi.Adw : null;

//Use _() for translations
const _ = imports.gettext.domain(Me.metadata.uuid).gettext;

var PrefsPages = class PrefsPages {
  constructor() {
    this._settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.alphabetical-app-grid');

    this._builder = new Gtk.Builder();
    this._builder.set_translation_domain(Me.metadata.uuid);

    this.createPreferences();
    this.createAbout();
    this.createCredits();
  }

  _getCredits(creditDataRaw, creditType) {
    let creditStrings = [];
    let creditsData = JSON.parse(creditDataRaw);
    creditsData[creditType].forEach((creditUser, i) => {
      //Build the credit string for each individual
      let string = creditUser['name'];

      //Use the year if given
      if (creditUser['year'] != '' && creditUser['year'] != undefined) {
        string = string + ', ' + creditUser['year'];
      }

      //If given, use the email as a clickable link
      if (creditUser['contact'] != '') {
        string = '<a href="mailto::' + creditUser['contact'] + '">' + string + '</a>'
      }

      creditStrings.push(string);
    });

    return creditStrings;
  }

  createPreferences() {
    //Use different UI file for GNOME 40+ and 3.38
    if (ShellVersion >= 40) {
      this._builder.add_from_file(Me.path + '/ui/prefs-gtk4.ui');
    } else {
      this._builder.add_from_file(Me.path + '/ui/prefs.ui');
    }

    //Get the settings container widget
    this.preferencesWidget = this._builder.get_object('main-prefs');

    this.settingElements = {
      'sort-folders-switch': {
        'settingKey': 'sort-folder-contents',
        'bindProperty': 'active'
      },
      'folder-order-dropdown': {
        'settingKey': 'folder-order-position',
        'bindProperty': 'active-id'
      },
      'logging-enabled-switch': {
        'settingKey': 'logging-enabled',
        'bindProperty': 'active'
      }
    }

    //Loop through settings toggles and dropdowns and bind together
    Object.keys(this.settingElements).forEach((element) => {
      this._settings.bind(
        this.settingElements[element].settingKey, //GSettings key to bind to
        this._builder.get_object(element), //GTK UI element to bind to
        this.settingElements[element].bindProperty, //The property to share
        Gio.SettingsBindFlags.DEFAULT
      );
    });
  }

  createAbout() {
    //Use different UI file for GNOME 40+ and 3.38
    if (ShellVersion >= 40) {
      this._builder.add_from_file(Me.path + '/ui/about-gtk4.ui');
    } else {
      this._builder.add_from_file(Me.path + '/ui/about.ui');
    }

    //Get the about page and fill in values
    this.aboutWidget = this._builder.get_object('about-page');
    this._builder.get_object('extension-version').set_label('v' + Me.metadata.version.toString());
    this._builder.get_object('extension-icon').set_from_file(Me.path + '/icon.svg');
  }

  createCredits() {
    //Read in the saved extension credits
    let [success, data] = GLib.file_get_contents(Me.path + '/credits.json');
    if (!success) {
      return;
    }

    //Parse the credits
    let developerStrings = this._getCredits(data, 'developers');
    let translatorStrings = this._getCredits(data, 'translators');

    //Use different UI file for GNOME 40+ and 3.38
    if (ShellVersion >= 40) {
      this._builder.add_from_file(Me.path + '/ui/credits-gtk4.ui');
    } else {
      this._builder.add_from_file(Me.path + '/ui/credits.ui');
    }

    //Get the credits page and fill in values
    this.creditsWidget = this._builder.get_object('credits-page');

    //Set the icon
    this._builder.get_object('extension-credits-icon').set_from_file(Me.path + '/icon.svg');

    //Display the developer credits
    let developerLabel = this._builder.get_object('extension-developers');
    developerStrings.forEach((developerString) => {
      developerLabel.set_label(developerLabel.get_label() + "\n" + developerString);
    });

    //Display the translator credits
    let translatorLabel = this._builder.get_object('extension-translators');
    translatorStrings.forEach((translatorString) => {
      translatorLabel.set_label(translatorLabel.get_label() + "\n" + translatorString);
    });
  }

}

function init() {
  ExtensionUtils.initTranslations();
}

//Create preferences window for GNOME 42+
function fillPreferencesWindow(window) {
  //Create pages and widgets
  let prefsPages = new PrefsPages();
  let settingsPage = new Adw.PreferencesPage();
  let settingsGroup = new Adw.PreferencesGroup();
  let aboutPage = new Adw.PreferencesPage();
  let aboutGroup = new Adw.PreferencesGroup();
  let creditsPage = new Adw.PreferencesPage();
  let creditsGroup = new Adw.PreferencesGroup();

  //Build the settings page
  settingsPage.set_title(_('Settings'));
  settingsPage.set_icon_name('preferences-system-symbolic');
  settingsGroup.add(prefsPages.preferencesWidget);
  settingsPage.add(settingsGroup);

  //Build the about page
  aboutPage.set_title(_('About'));
  aboutPage.set_icon_name('help-about-symbolic');
  aboutGroup.add(prefsPages.aboutWidget);
  aboutPage.add(aboutGroup);

  //Build the about page
  creditsPage.set_title(_('Credits'));
  creditsPage.set_icon_name('system-users-symbolic');
  creditsGroup.add(prefsPages.creditsWidget);
  creditsPage.add(creditsGroup);

  //Add the pages to the window
  window.add(settingsPage);
  window.add(aboutPage);
  window.add(creditsPage);
}

//Create preferences window for GNOME 3.38-41
function buildPrefsWidget() {
  let prefsPages = new PrefsPages();
  let settingsWindow = new Gtk.ScrolledWindow();

  //Use a stack to store pages
  let pageStack = new Gtk.Stack();
  pageStack.add_titled(prefsPages.preferencesWidget, 'settings', _('Settings'));
  pageStack.add_titled(prefsPages.aboutWidget, 'about', _('About'));
  pageStack.add_titled(prefsPages.creditsWidget, 'credits', _('Credits'));

  let pageSwitcher = new Gtk.StackSwitcher();
  pageSwitcher.set_stack(pageStack);

  //Add the stack to the scrolled window
  if (ShellVersion >= 40) {
    settingsWindow.set_child(pageStack);
  } else {
    settingsWindow.add(pageStack);
  }

  //Enable all elements differently for GNOME 40+ and 3.38
  if (ShellVersion >= 40) {
    settingsWindow.show();
  } else {
    settingsWindow.show_all();
  }

  //Modify top bar to add a page menu, when the window is ready
  settingsWindow.connect('realize', () => {
    let window = ShellVersion >= 40 ? settingsWindow.get_root() : settingsWindow.get_toplevel();
    let headerBar = window.get_titlebar();

    //Add page switching menu to header
    if (ShellVersion >= 40) {
      headerBar.set_title_widget(pageSwitcher);
    } else {
      headerBar.set_custom_title(pageSwitcher);
    }
    pageSwitcher.show();
  });

  return settingsWindow;
}
