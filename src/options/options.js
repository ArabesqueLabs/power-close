import { PAGE_ACCESS, load, onChange, save } from '../lib/settings.js';

const form = document.getElementById('settings');
const saveState = document.getElementById('save-state');
const pageTextError = document.getElementById('page-text-error');
const shortcut = document.getElementById('shortcut');

// Not every browser has a menu on the tabs themselves: the setting for it
// is shown only where there is one.
if (Object.values(chrome.contextMenus.ContextType || {}).includes('tab')) {
    document.getElementById('menu-on-tab').hidden = false;
}

// The form, as the settings stand.
function show(settings) {
    for (const field of form.elements) {
        if (!(field.name in settings)) {
            continue;
        }
        if (field.type === 'radio') {
            field.checked = settings[field.name] === field.value;
        } else if (field.type === 'checkbox') {
            field.checked = settings[field.name];
        }
    }
}

// Each change is saved as it's made, and the save state says so.
function store(changes) {
    saveState.dataset.state = 'saving';
    saveState.textContent = 'Saving…';
    return save(changes).then(function () {
        saveState.dataset.state = 'saved';
        saveState.textContent = 'Saved';
    }, function () {
        saveState.dataset.state = 'failed';
        saveState.textContent = 'Couldn’t save that. Try again.';
    });
}

// Reading pages needs the browser's say-so, asked for as the switch is
// turned on (it has to be asked then, in answer to the click), and given
// back as it's turned off.
function setPageText(field) {
    pageTextError.hidden = true;
    if (!field.checked) {
        store({ matchPageText: false });
        chrome.permissions.remove(PAGE_ACCESS);
        return;
    }
    chrome.permissions.request(PAGE_ACCESS, function (granted) {
        if (granted) {
            store({ matchPageText: true });
        } else {
            field.checked = false;
            pageTextError.textContent = 'Power Close wasn’t allowed to read pages, so this is still off.';
            pageTextError.hidden = false;
        }
    });
}

form.addEventListener('change', function (event) {
    const field = event.target;
    if (field.name === 'matchPageText') {
        setPageText(field);
    } else if (field.type === 'radio') {
        store({ [field.name]: field.value });
    } else if (field.type === 'checkbox') {
        store({ [field.name]: field.checked });
    }
});

form.addEventListener('submit', function (event) {
    event.preventDefault();
});

// ---- the keyboard shortcut ------------------------------------------------

// Set in the browser's own settings, not here: shown as it stands, with the
// way there. Chrome writes it with +s (Alt+Shift+P), or with symbols on a
// Mac (⌥⇧P).
function showShortcut() {
    chrome.commands.getAll(function (commands) {
        const command = commands.find(function (c) {
            return c.name === '_execute_action';
        });
        const keys = command && command.shortcut;
        if (!keys) {
            shortcut.textContent = 'none set';
            return;
        }
        shortcut.replaceChildren.apply(shortcut, keys.split('+').map(function (key) {
            const kbd = document.createElement('kbd');
            kbd.className = 'al-kbd';
            kbd.textContent = key;
            return kbd;
        }));
    });
}

document.getElementById('change-shortcut').addEventListener('click', function () {
    if (chrome.commands.openShortcutSettings) {
        chrome.commands.openShortcutSettings();
    } else {
        chrome.tabs.create({ url: 'chrome://extensions/shortcuts' });
    }
});

// Back from changing it: show what it is now.
window.addEventListener('focus', showShortcut);

// ---- opening --------------------------------------------------------------

load().then(function (settings) {
    if (!settings.matchPageText) {
        show(settings);
        return;
    }
    // On, but the access it needs taken back in the browser since: off.
    chrome.permissions.contains(PAGE_ACCESS, function (granted) {
        if (!granted) {
            settings.matchPageText = false;
            save({ matchPageText: false });
        }
        show(settings);
    });
});
onChange(show);
showShortcut();
