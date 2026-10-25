// Which tabs match: what's typed in the popup, and the domain the
// right-click option closes. One file, so the popup and the right-click
// option can't drift apart.

// The most of a page's text that's kept to match against: enough for any
// page someone reads, and a cap on what a long one costs each keystroke.
export const PAGE_TEXT_LIMIT = 100000;

// What's typed, made into a test a tab's address, title or text passes or
// not. One of:
//   { kind: 'empty' }                     nothing typed
//   { kind: 'invalid', message }          a /regex/ that doesn't compile
//   { kind: 'text' | 'regex', test(s) }   something to match
export function parseQuery(text, settings) {
  const query = text.trim();
  if (!query) {
    return { kind: 'empty' };
  }

  // /pattern/flags. Without flags it ignores case, as a keyword does; g and
  // y are dropped, as they'd make test() remember where it last stopped.
  if (settings.regex) {
    const parts = query.match(/^\/(.+)\/([a-z]*)$/);
    if (parts) {
      let pattern;
      try {
        pattern = new RegExp(parts[1], parts[2].replace(/[gy]/g, '') || 'i');
      } catch (e) {
        // Chrome repeats the pattern before the reason; the reason will do.
        return { kind: 'invalid', message: e.message.replace(/^Invalid regular expression: \/.*\/[a-z]*: /, '') };
      }
      return {
        kind: 'regex',
        test: function (s) { return pattern.test(s); },
      };
    }
  }

  const needles = [query.toLowerCase()];
  const ascii = asciiForm(query);
  if (ascii && ascii !== needles[0]) {
    needles.push(ascii);
  }
  return {
    kind: 'text',
    needles: needles,
    test: function (s) {
      const haystack = s.toLowerCase();
      return needles.some(function (needle) {
        return haystack.indexOf(needle) !== -1;
      });
    },
  };
}

// A domain in another script, as the browser keeps it in a tab's address:
// مثال.مصر is xn--mgbh0fb.xn--wgbh1c there. Whatever comes before the first
// /, ? or # is taken for the domain (after a scheme, if one's typed); null
// if what's typed is all ASCII already, or has no domain to convert.
export function asciiForm(text) {
  if (!/[^\x00-\x7f]/.test(text)) {
    return null;
  }
  const parts = text.match(/^([a-z][a-z0-9+.-]*:\/\/)?([^/?#\s]+)(.*)$/i);
  if (!parts) {
    return null;
  }
  try {
    const host = new URL('http://' + parts[2]).hostname;
    return ((parts[1] || '') + host + parts[3]).toLowerCase();
  } catch (e) {
    return null;
  }
}

// A tab's address with its escapes undone, so a path in another script
// (/wiki/%D9%85%D8%AB%D8%A7%D9%84) matches as it's read (/wiki/مثال).
function decoded(url) {
  try {
    return decodeURI(url);
  } catch (e) {
    return url;
  }
}

// Whether a tab matches a parsed query. pageText is the tab's page text, if
// it's being matched and the page could be read.
export function tabMatches(tab, query, settings, pageText) {
  if (tab.pinned && !settings.closePinned) {
    return false;
  }
  const url = tab.url || '';
  const fields = [url];
  const readable = decoded(url);
  if (readable !== url) {
    fields.push(readable);
  }
  if (settings.matchTitles && tab.title) {
    fields.push(tab.title);
  }
  if (pageText) {
    fields.push(pageText);
  }
  return fields.some(query.test);
}

export function hostnameOf(url) {
  try {
    return new URL(url).hostname;
  } catch (e) {
    return '';
  }
}

// The right-click option's test: a tab on this exact hostname or, with
// scope 'subdomains', on the site's subdomains too (www. set aside, so
// www.github.com takes in github.com and gist.github.com).
export function onSite(tab, hostname, settings) {
  if (tab.pinned && !settings.closePinned) {
    return false;
  }
  const host = hostnameOf(tab.url);
  if (!host || !hostname) {
    return false;
  }
  if (settings.menuScope === 'subdomains') {
    const site = hostname.replace(/^www\./, '');
    return host === site || host.endsWith('.' + site);
  }
  return host === hostname;
}

// The domains of the open tabs that start with what's typed (or would,
// without their www.), most tabs first: the popup's suggestions.
export function suggestions(tabs, text, settings, limit) {
  const query = text.trim().toLowerCase();
  if (!query) {
    return [];
  }
  const prefixes = [query];
  const ascii = asciiForm(query);
  if (ascii) {
    prefixes.push(ascii);
  }

  const counts = new Map();
  for (const tab of tabs) {
    if (tab.pinned && !settings.closePinned) {
      continue;
    }
    const host = hostnameOf(tab.url);
    if (host) {
      counts.set(host, (counts.get(host) || 0) + 1);
    }
  }

  const found = [];
  for (const [host, count] of counts) {
    const bare = host.replace(/^www\./, '');
    const starts = prefixes.some(function (prefix) {
      return host.startsWith(prefix) || bare.startsWith(prefix);
    });
    // Already typed in full: nothing to suggest.
    if (starts && host !== query && bare !== query) {
      found.push({ host: host, count: count });
    }
  }
  found.sort(function (a, b) {
    return b.count - a.count || a.host.localeCompare(b.host);
  });
  return found.slice(0, limit);
}
