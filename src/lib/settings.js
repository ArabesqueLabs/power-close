// The extension's settings: what they are, what each starts as, and where
// they're kept. They're in the browser's synced storage, so they follow the
// person between their devices (or stay on this one, if they don't sync).
// The defaults are how Power Close behaved before it had settings.

export const DEFAULTS = {
  // Which tabs match
  closePinned: true,      // pinned tabs that match close too
  matchTitles: false,     // what's typed is looked for in tabs' titles too
  matchPageText: false,   // ...and in their pages' text (needs a permission)
  regex: false,           // /pattern/ is read as a regular expression

  // The popup
  suggest: true,          // the open tabs' domains, suggested as you type

  // The right-click option
  menuOnPage: true,       // on the page's own menu
  menuOnTab: false,       // on the tab's menu, in the tab strip, where there is one
  menuScope: 'exact',     // 'exact': only this domain; 'subdomains': and its subdomains
};

// Reading every page's text needs access to every site, which is asked for
// only when that setting is turned on, and given back when it's turned off.
export const PAGE_ACCESS = { origins: ['<all_urls>'] };

export function load() {
  return new Promise(function (resolve) {
    chrome.storage.sync.get(DEFAULTS, resolve);
  });
}

export function save(changes) {
  return new Promise(function (resolve, reject) {
    chrome.storage.sync.set(changes, function () {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
      } else {
        resolve();
      }
    });
  });
}

// Calls back with all the settings whenever any of them changes, here or on
// another of the person's devices.
export function onChange(callback) {
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'sync') {
      load().then(callback);
    }
  });
}
