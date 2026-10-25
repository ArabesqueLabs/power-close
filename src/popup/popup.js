import { DEFAULTS, PAGE_ACCESS, load } from '../lib/settings.js';
import { PAGE_TEXT_LIMIT, parseQuery, suggestions, tabMatches } from '../lib/match.js';

const input = document.getElementById('keyword');
const hint = document.getElementById('keyword-hint');
const list = document.getElementById('suggestions');
const matches = document.getElementById('matches-text');
const closeButton = document.getElementById('close');
const done = document.getElementById('done');
const doneText = document.getElementById('done-text');

// The most domains suggested at once, and how long a page has to give up
// its text before it's left out (one that's hung shouldn't hold the rest).
const SUGGESTION_LIMIT = 5;
const READ_TIMEOUT = 1500;

let settings = DEFAULTS;

// The tabs the keyword currently matches. Counted as the keyword is typed,
// and closed when the action is taken, so the figure shown and the tabs
// closed are the same list.
let matching = [];

// The pages' text, by tab, when it's matched: read once, as the popup
// opens. unread counts the web pages that couldn't be (unloaded to save
// memory, or that wouldn't answer), which match on their address alone.
let pageTexts = null;
let reading = false;
let unread = 0;

// The suggestions showing, and the one the arrow keys are on (-1: none).
let offered = [];
let active = -1;

function tabs(count) {
    return count === 1 ? '1 tab' : count + ' tabs';
}

function pages(count) {
    return count === 1 ? '1 page' : count + ' pages';
}

// ['address', 'title', 'page text'] as "address, title or page text".
function either(words) {
    return words.length < 2 ? words.join('') :
        words.slice(0, -1).join(', ') + ' or ' + words[words.length - 1];
}

// The hint under the field, saying what's matched as the settings have it.
function describe() {
    const places = ['address'];
    if (settings.matchTitles) {
        places.push('title');
    }
    if (pageTexts) {
        places.push('page text');
    }
    let text = 'Matches anywhere in a tab’s ' + either(places) + ', in every window.';
    if (!settings.closePinned) {
        text += ' Pinned tabs stay open.';
    }
    if (settings.regex) {
        text += ' Type /…/ for a regular expression.';
    }
    hint.textContent = text;
}

function setAvailable(available) {
    closeButton.setAttribute('aria-disabled', available ? 'false' : 'true');
}

// ---- suggestions ----------------------------------------------------------

function showSuggestions(found) {
    offered = found;
    active = -1;
    list.replaceChildren.apply(list, found.map(function (suggestion, i) {
        const item = document.createElement('li');
        item.className = 'al-menu__item pc-suggestion';
        item.id = 'suggestion-' + i;
        item.setAttribute('role', 'option');
        item.setAttribute('aria-selected', 'false');
        const host = document.createElement('bdi');
        host.textContent = suggestion.host;
        const count = document.createElement('span');
        count.className = 'pc-suggestion__count';
        count.textContent = tabs(suggestion.count);
        item.append(host, count);
        // Taken on click, without the field losing the focus first.
        item.addEventListener('mousedown', function (event) {
            event.preventDefault();
        });
        item.addEventListener('click', function () {
            accept(i);
        });
        return item;
    }));
    const open = found.length > 0;
    list.hidden = !open;
    input.setAttribute('aria-expanded', open ? 'true' : 'false');
    input.removeAttribute('aria-activedescendant');
}

function hideSuggestions() {
    showSuggestions([]);
}

function highlight(i) {
    active = i;
    Array.from(list.children).forEach(function (item, j) {
        item.setAttribute('aria-selected', j === i ? 'true' : 'false');
    });
    input.setAttribute('aria-activedescendant', 'suggestion-' + i);
}

function accept(i) {
    input.value = offered[i].host;
    hideSuggestions();
    done.hidden = true;
    recount(false);
}

// ---- counting and closing -------------------------------------------------

// suggest: true to offer the domains that fit what's typed, false to put
// them away, or left out to leave them as they are.
function recount(suggest) {
    chrome.tabs.query({}, function (allTabs) {
        const openCount = allTabs.length;
        const query = parseQuery(input.value, settings);

        if (suggest && settings.suggest && query.kind === 'text') {
            showSuggestions(suggestions(allTabs, input.value, settings, SUGGESTION_LIMIT));
        } else if (suggest !== undefined) {
            hideSuggestions();
        }

        matching = query.kind === 'text' || query.kind === 'regex' ? allTabs.filter(function (tab) {
            return tabMatches(tab, query, settings, pageTexts && pageTexts.get(tab.id));
        }) : [];

        if (query.kind === 'empty') {
            matches.textContent = reading ? 'Reading your tabs’ pages…' :
                'Type to see how many tabs match.';
            closeButton.textContent = 'Close tabs';
            setAvailable(false);
            return;
        }

        if (query.kind === 'invalid') {
            matches.textContent = 'That regular expression doesn’t work: ' + query.message + '.';
            closeButton.textContent = 'Close tabs';
            setAvailable(false);
            return;
        }

        // What the count leaves out, if the pages' text is matched.
        let caveat = '';
        if (reading) {
            caveat = ' Still reading the pages…';
        } else if (pageTexts && unread) {
            caveat = ' ' + pages(unread) + ' couldn’t be read, so only ' +
                (unread === 1 ? 'its address counts.' : 'their addresses count.');
        }

        if (matching.length === 0) {
            matches.textContent = 'No open tabs match. Nothing will close.' + caveat;
            closeButton.textContent = 'Close tabs';
            setAvailable(false);
            return;
        }

        matches.textContent = 'Closes ' + matching.length + ' of ' +
            openCount + (openCount === 1 ? ' open tab.' : ' open tabs.') + caveat;
        closeButton.textContent = 'Close ' + tabs(matching.length);
        setAvailable(true);
    });
}

function closeMatching() {
    if (closeButton.getAttribute('aria-disabled') === 'true') {
        return;
    }

    const closing = matching.length;
    const tabIds = matching.map(function (tab) {
        return tab.id;
    });

    if (tabIds.length === 0) {
        return;
    }

    chrome.tabs.remove(tabIds, function () {
        if (chrome.runtime.lastError) {
            // Ignore errors if any tabs were already closed
        }
        doneText.textContent = 'Closed ' + tabs(closing) + '.';
        done.hidden = false;
        input.value = '';
        input.focus();
        recount(false);
    });
}

// ---- the pages' text ------------------------------------------------------

function readPage(tab) {
    const read = new Promise(function (resolve, reject) {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: function (limit) {
                return document.body ? document.body.innerText.slice(0, limit) : '';
            },
            args: [PAGE_TEXT_LIMIT],
        }, function (results) {
            if (chrome.runtime.lastError || !results || !results[0]) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(results[0].result || '');
            }
        });
    });
    const timeout = new Promise(function (resolve, reject) {
        setTimeout(reject, READ_TIMEOUT);
    });
    return Promise.race([read, timeout]);
}

// Only web pages (and files) have text to read; the browser's own pages,
// and the stores', refuse, and aren't counted as unread.
function readPages() {
    chrome.tabs.query({}, function (allTabs) {
        const web = allTabs.filter(function (tab) {
            return /^(https?|file):/.test(tab.url || '');
        });
        const loaded = web.filter(function (tab) {
            return !tab.discarded;
        });
        Promise.allSettled(loaded.map(readPage)).then(function (results) {
            results.forEach(function (result, i) {
                if (result.status === 'fulfilled') {
                    pageTexts.set(loaded[i].id, result.value);
                }
            });
            unread = web.length - pageTexts.size;
            reading = false;
            describe();
            recount();
        });
    });
}

// ---- wiring ---------------------------------------------------------------

input.addEventListener('input', function () {
    done.hidden = true;
    recount(true);
});

input.addEventListener('keydown', function (event) {
    const open = offered.length > 0;
    if (event.key === 'ArrowDown' && open) {
        event.preventDefault();
        highlight((active + 1) % offered.length);
    } else if (event.key === 'ArrowUp' && open) {
        event.preventDefault();
        highlight(active <= 0 ? offered.length - 1 : active - 1);
    } else if (event.key === 'Enter') {
        event.preventDefault();
        if (open && active >= 0) {
            accept(active);
        } else {
            closeMatching();
        }
    } else if (event.key === 'Escape' && open) {
        // The suggestions first; the popup on the next Escape.
        event.stopPropagation();
        hideSuggestions();
    }
});

input.addEventListener('blur', hideSuggestions);

window.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
        window.close();
    }
});

closeButton.addEventListener('click', closeMatching);

document.getElementById('settings').addEventListener('click', function () {
    chrome.runtime.openOptionsPage();
    window.close();
});

document.getElementById('dismiss').addEventListener('click', function () {
    window.close();
});

document.querySelectorAll('a[href]').forEach(function (link) {
    link.addEventListener('click', function (event) {
        event.preventDefault();
        chrome.tabs.create({ url: this.href });
    });
});

input.focus();
recount(false);

load().then(function (loaded) {
    settings = loaded;
    if (!settings.matchPageText) {
        describe();
        recount(true);
        return;
    }
    // The setting is on, but the access it needs may since have been taken
    // back in the browser's own settings.
    chrome.permissions.contains(PAGE_ACCESS, function (granted) {
        if (granted) {
            pageTexts = new Map();
            reading = true;
            readPages();
        }
        describe();
        recount(true);
    });
});
