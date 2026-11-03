<img width="180" height="180" alt="icon-180" src="https://github.com/user-attachments/assets/ab0d6bac-8529-4470-8d3c-ca763b5c4df6" />

# Power Close

A browser extension, for the tab addict, that closes every tab whose address
contains a keyword or a domain name. Many Facebook tabs open, scattered across
windows? Type `facebook.com`, press Enter, and they're all closed.

## How it looks in action

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://power-close.com/screenshots/demo-dark.gif">
  <img src="https://power-close.com/screenshots/demo-light.gif" alt="The Power Close popup in use: github.com is typed in, “Closes 4 of 12 open tabs.” appears above the Close 4 tabs button, and Enter closes them: “Closed 4 tabs.”" width="320">
</picture>

## Install

- [Chrome Web Store](https://chrome.google.com/webstore/detail/power-close/jjpmcpmmajigbkjchbkoclipomlmpaaj)
- [Firefox Add-ons](https://addons.mozilla.org/firefox/addon/firefox-power-close/)
- Safari, on the Mac, iPhone and iPad: coming to the App Store

It runs on Chrome (Manifest V3), Firefox 140 and later, Firefox for Android
142 and later, and Safari 17 and later on macOS, iOS and iPadOS.

In Safari, after turning Power Close on in Safari's Settings, under
Extensions, allow it on every website (**Edit Websites…**, then **Other
Websites: Allow**). Safari only shows an extension the addresses of tabs on
sites it's allowed on, so without that it can't match your tabs; the popup
says so when it can't.

## Usage

Press the Power Close button in the toolbar and type a keyword or domain name.
As you type, the popup counts the tabs that match, so you can see what will
close before anything does. Press <kbd>Enter</kbd>, or the button that names
the count, to close them; <kbd>Esc</kbd> closes the popup and leaves your tabs
alone.

<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd> opens the popup from the keyboard
(change it in your browser's extension shortcuts). As you type, the domains of
your open tabs that start with what you've typed are suggested under the
field: <kbd>↓</kbd> and <kbd>Enter</kbd> take one.

You can also right-click a page, anywhere on it (an image or selected text
too), and choose **Close all tabs from this domain**. It can be on the tab's
own menu as well, in Firefox and recent versions of Chrome. (Safari on the
iPhone and iPad has no right-click menu, and Safari doesn't let you change
the shortcut.)

### What matches

- **The popup** matches what you type anywhere in a tab's full address,
ignoring case, across every window. So `github.com` also closes
`gist.github.com`, and a search results page whose address contains
"github.com". Domains and addresses in other scripts match as you'd read them:
`مثال.مصر` finds the tabs on that domain.

- **The right-click option** matches the page's exact hostname, so it closes
that site's tabs only: not its subdomains, and `www.github.com` and
`github.com` count as different sites. A setting widens it to the site's
subdomains.

### Settings

Open them from the popup's settings button, or from your browser's extensions
page. Each applies as soon as you change it, and they sync with your browser
where it syncs extensions' settings.

| Setting | Default |
|---|---|
| Close pinned tabs too | On |
| Match tabs' titles | Off |
| Match the text on the page (asks your browser for access to read pages) | Off |
| Regular expressions, typed as `/pattern/` | Off |
| Suggest domains as you type | On |
| Right-click option on pages | On |
| Right-click option on tabs (where the browser has a tab menu) | Off |
| Which tabs the right-click option closes: the exact domain, or its subdomains too | Exact |

<img src="https://power-close.com/screenshots/settings-light.png" alt="The settings page" width="640">

Closed too many? Your browser's Reopen Closed Tab
(<kbd>Ctrl</kbd>/<kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd>) brings them back.

## Privacy

Power Close reads your tabs' addresses (and titles) to match and close them,
and nothing else. If you turn on matching the text on the page, it asks your
browser for access to read pages, reads them only when you open the popup, and
keeps what it reads in the popup until it closes; turn the setting off and the
access is given back. (In Safari, the access to websites it needs to see your
tabs' addresses at all already covers this, so there's nothing more to ask
for or give back.) It has NO network code, collects NO data, and needs NO
account.

## Development

You'll need `make` and `zip`, and for Safari, a Mac with Xcode.

```
make            # build all three: dist/chrome/, dist/firefox/ and dist/safari/
make chrome     # build Chrome only
make firefox    # build Firefox only
make safari     # build Safari only: dist/safari/, and its unsigned Mac app
make validate   # check the manifests are valid JSON
```

The Chrome and Firefox folders in `dist/` hold the unpacked extension and a
`power-close.zip` of it for the stores. Safari's extensions come inside an
app: the Xcode project in `safari/Power Close/` builds one for macOS and one
for iOS and iPadOS, with `dist/safari/`'s files in them, so run
`make safari-files` (just those files) or `make` before building it in
Xcode, every time `src/` changes.

To try a build:

- **Chrome:** open `chrome://extensions`, turn on Developer mode, choose **Load
unpacked** and pick `dist/chrome/`.

- **Firefox:** open `about:debugging#/runtime/this-firefox`, choose **Load
Temporary Add-on…** and pick `dist/firefox/manifest.json`.

- **Safari (Mac):** run `make safari`, and open the app it builds in
`dist/safari-build/Build/Products/Debug/` once. In Safari, turn on **Show
features for web developers** in Settings, under Advanced, then **Allow
Unsigned Extensions** in the Develop menu (it's needed again each time Safari
restarts), and turn Power Close on in Settings, under Extensions. Or open
`safari/Power Close/Power Close.xcodeproj` and run the **Power Close (macOS)**
scheme, signed with your team.

- **Safari (iPhone, iPad):** open the Xcode project and run the **Power Close
(iOS)** scheme on a simulator or your device, then turn Power Close on in
Settings > Apps > Safari > Extensions.

The source is in `src/`: the popup in `src/popup/`, the settings page in
`src/options/`, the right-click option in `src/background.js`, and what they
share (the settings and the matching rules) in `src/lib/`, as ES modules. The
three browsers share everything except their manifests
(`src/manifest-chrome.json`, `src/manifest-firefox.json` and
`src/manifest-safari.json`), so change all three when you change one. Two
things differ for Safari:

- Safari won't run a background service worker that's an ES module, so
`make` joins `src/lib/settings.js`, `src/lib/match.js` and `src/background.js`
into one plain script for it. Keep the names those three declare at the top
level distinct, and their `import`s and `export`s at the start of a line.

- Safari shows an extension the addresses of tabs only on sites it's allowed on, so
its manifest asks for every site up front (`host_permissions`), where Chrome
and Firefox ask only when matching the text on pages is turned on
(`optional_host_permissions`). `SAFARI` in `src/lib/settings.js` tells the
pages which they're in.

The Xcode project was made by Apple's `safari-web-extension-packager` and
refers to the files in `dist/safari/` rather than copying them; it holds only
the app around the extension (its icons, from `src/icons/mark.svg`, and the
window that says how to turn the extension on). If you add a file or folder at
the top of `dist/safari/`, add it to the project's **Shared (Extension)**
group too, for both extension targets.

### Releasing

Change the version in the three manifests, and in Xcode (each target's
**Version**, `MARKETING_VERSION`, and a higher **Build**,
`CURRENT_PROJECT_VERSION`). Then:

- **Chrome and Firefox:** `make`, and upload each `dist/*/power-close.zip`.

- **Safari:** `make safari-files`, open the Xcode project, choose **Any Mac** for
the macOS scheme and **Product > Archive**, then **Distribute App > App Store
Connect** from the Organizer; and the same for the iOS scheme with **Any iOS
Device**. The app's bundle identifier is `com.arabesquelabs.PowerClose` (the
extension's, `com.arabesquelabs.PowerClose.Extension`); create the app in App
Store Connect with it, as one app for macOS and iOS, before the first upload.

`make screenshots` retakes the popup's screenshots, the GIF above and the
settings page's screenshot, in `dist/screenshots/` (copy them to
`sites/power-close.com/public/screenshots/` in
[the websites repository](https://github.com/ArabesqueLabs/websites), which
serves them at power-close.com), and makes the stores' screenshots: five at
1280x800 for the Chrome Web Store in `dist/screenshots/chrome/`, the same
five at 2400x1800 for addons.mozilla.org in `dist/screenshots/firefox/`,
and the same five at 2880x1800 for the Mac App Store in
`dist/screenshots/safari/`, with its app preview, `preview.mp4` (1920x1080,
about 21 seconds: the popup closing GitHub's tabs, then Google's, beside the
list of open tabs). It needs Node 22+, Chrome and ffmpeg. The App Store wants
the iPhone's and iPad's own screenshots, taken in the simulator.

## Design

The popup is built on the [Arabesque Labs design
system](https://design.arabesquelabs.com/), vendored into
`src/vendor/arabesque/`.

## Credits

- [Mosab Ibrahim](https://mosab.co.uk) wrote Power Close for Firefox in 2014
- [Mina Asham](https://github.com/mina-asham) ported it to Chrome
- and it's now maintained by [Mosab Ibrahim](https://mosab.co.uk) at [Arabesque Labs](https://arabesquelabs.com/)

Bug reports and contributions are welcome in [the
issues](https://github.com/ArabesqueLabs/power-close/issues).

## License

Copyright © 2014–2026 Mosab Ibrahim. Free software under the GNU General Public
License, version 2 or (at your option) any later version: see
[LICENSE](LICENSE).
