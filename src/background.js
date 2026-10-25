// The right-click option, "Close all tabs from this domain": on the page's
// menu, and on the tab's own menu where the browser has one (Firefox, and
// recent Chrome), as the settings say.
import { load, onChange } from './lib/settings.js';
import { onSite, hostnameOf } from './lib/match.js';

const MENU_PAGE = 'close-tabs-by-domain';
const MENU_TAB = 'close-tabs-by-domain-tab';
const TITLE = 'Close all tabs from this domain';

// Wherever on the page it's right-clicked: 'page' alone is only the page's
// bare background, not an image or a selection on it. Not links, where
// "this domain" could as well be the link's as the page's.
const PAGE_CONTEXTS = ['page', 'frame', 'selection', 'image', 'video', 'audio'];

// Not every browser has a menu on the tabs themselves (older Chrome doesn't,
// and refuses the context): asked of the browser, not assumed.
const TAB_MENU = Object.values(chrome.contextMenus.ContextType || {}).includes('tab');

function buildMenus(settings) {
  chrome.contextMenus.removeAll(function () {
    if (settings.menuOnPage) {
      chrome.contextMenus.create({ id: MENU_PAGE, title: TITLE, contexts: PAGE_CONTEXTS });
    }
    if (settings.menuOnTab && TAB_MENU) {
      chrome.contextMenus.create({ id: MENU_TAB, title: TITLE, contexts: ['tab'] });
    }
  });
}

chrome.runtime.onInstalled.addListener(function () {
  load().then(buildMenus);
});
onChange(buildMenus);

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId !== MENU_PAGE && info.menuItemId !== MENU_TAB) {
    return;
  }
  // From the tab's menu, the tab right-clicked; from the page's, the page.
  const hostname = hostnameOf((tab && tab.url) || info.pageUrl);
  if (!hostname) {
    return;
  }
  load().then(function (settings) {
    chrome.tabs.query({}, function (tabs) {
      const ids = tabs.filter(function (t) {
        return onSite(t, hostname, settings);
      }).map(function (t) {
        return t.id;
      });
      if (ids.length) {
        chrome.tabs.remove(ids);
      }
    });
  });
});
