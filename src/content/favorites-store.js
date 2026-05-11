var GifFav = GifFav || {};

GifFav.store = (function () {
  'use strict';

  var STORAGE_KEY = 'teams_gif_favorites';
  var changeListeners = [];

  function decodeRepeated(value) {
    var result = value;
    for (var i = 0; i < 4; i++) {
      try {
        var decoded = decodeURIComponent(result);
        if (decoded === result) break;
        result = decoded;
      } catch (_) {
        break;
      }
    }
    return result;
  }

  function unwrapProxyUrl(url) {
    try {
      var u = new URL(url);
      if (u.hostname === 'urlp.asm.skype.com') {
        var proxiedUrl = u.searchParams.get('url');
        if (proxiedUrl) return decodeRepeated(proxiedUrl);
      }
    } catch (_) { /* keep original if URL is malformed */ }
    return decodeRepeated(url);
  }

  function normaliseGiphyPath(u) {
    var parts = u.pathname.split('/').filter(Boolean);
    if (parts[0] !== 'media' || parts.length < 3) return null;

    // Teams/GIPHY sometimes use /media/v1.{tracking-token}/{gif-id}/giphy.gif.
    // The v1 segment expires or fails when Teams validates it through Skype URLP.
    var id = parts[1] && parts[1].indexOf('v1.') === 0 ? parts[2] : parts[1];
    if (!id || id.indexOf('.') !== -1 || id.indexOf('/') !== -1) return null;
    return 'https://media.giphy.com/media/' + encodeURIComponent(id) + '/giphy.gif';
  }

  // Strip session/tracking params and unwrap Teams/Skype image proxy URLs so the
  // stored URL never expires. GIPHY's newer media URLs can put tracking data in
  // the path (/media/v1.../{id}/giphy.gif), so we rebuild them from the GIF ID.
  function normalizeGifUrl(url) {
    if (!url) return url;
    url = unwrapProxyUrl(url);
    try {
      var u = new URL(url);
      if (u.hostname.includes('giphy.com')) {
        var cleanGiphyUrl = normaliseGiphyPath(u);
        if (cleanGiphyUrl) return cleanGiphyUrl;
        return u.origin + u.pathname;
      }
      if (u.hostname.includes('tenor.com') ||
          u.hostname.includes('tenor.co') || u.hostname.includes('media.tenor')) {
        return u.origin + u.pathname; // strip all query params
      }
    } catch (_) { /* keep original if URL is malformed */ }
    return url;
  }

  function normalizeEntry(fav) {
    var cleanUrl = normalizeGifUrl(fav.url || fav.previewUrl || '');
    var cleanPreviewUrl = normalizeGifUrl(fav.previewUrl || cleanUrl);
    return Object.assign({}, fav, {
      url: cleanUrl,
      previewUrl: cleanPreviewUrl,
    });
  }

  function entriesEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  async function migrateStorage(items) {
    var changed = false;
    var seen = {};
    var migrated = [];

    for (var i = 0; i < items.length; i++) {
      var entry = normalizeEntry(items[i]);
      entry.id = await hashUrl(entry.url);
      if (seen[entry.id]) {
        changed = true;
        continue;
      }
      seen[entry.id] = true;
      if (!entriesEqual(entry, items[i])) changed = true;
      migrated.push(entry);
    }

    if (changed) await writeStorage(migrated);
    return migrated;
  }

  // Compute a 12-hex-char ID from a URL (strip query params to normalise).
  async function hashUrl(url) {
    try {
      var normalised = url.split('?')[0].split('#')[0];
      var data = new TextEncoder().encode(normalised);
      var buf = await crypto.subtle.digest('SHA-1', data);
      var hex = Array.from(new Uint8Array(buf))
        .map(function (b) { return b.toString(16).padStart(2, '0'); })
        .join('');
      return hex.slice(0, 12);
    } catch (_) {
      // Fallback: djb2-style hash
      var h = 5381;
      for (var i = 0; i < url.length; i++) {
        h = ((h << 5) + h) ^ url.charCodeAt(i);
      }
      return (h >>> 0).toString(16).padStart(12, '0');
    }
  }

  function readStorage() {
    return new Promise(function (resolve, reject) {
      chrome.storage.local.get([STORAGE_KEY], function (result) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result[STORAGE_KEY] || []);
      });
    });
  }

  function writeStorage(items) {
    return new Promise(function (resolve, reject) {
      var obj = {};
      obj[STORAGE_KEY] = items;
      chrome.storage.local.set(obj, function () {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  async function list() {
    var items = await readStorage();
    return migrateStorage(items);
  }

  async function has(url) {
    var id = await hashUrl(normalizeGifUrl(url));
    var items = await migrateStorage(await readStorage());
    return items.some(function (f) { return f.id === id; });
  }

  async function add(fav) {
    // Normalize URL before storing so GIPHY/Tenor session params never expire
    var normalisedFav = normalizeEntry(fav);
    var cleanUrl = normalisedFav.url;
    var id = await hashUrl(cleanUrl);
    var items = await migrateStorage(await readStorage());
    if (items.some(function (f) { return f.id === id; })) return; // duplicate
    var entry = Object.assign({}, normalisedFav, { id: id, addedAt: Date.now() });
    await writeStorage([entry].concat(items)); // newest first (Discord-style)
  }

  async function remove(url) {
    var id = await hashUrl(normalizeGifUrl(url));
    var items = await migrateStorage(await readStorage());
    await writeStorage(items.filter(function (f) { return f.id !== id; }));
  }

  async function toggle(fav) {
    var alreadyFav = await has(normalizeGifUrl(fav.url));
    if (alreadyFav) {
      await remove(fav.url);
      return { added: false };
    } else {
      await add(fav);
      return { added: true };
    }
  }

  // Notify listeners when storage changes (cross-tab sync via chrome.storage event)
  chrome.storage.onChanged.addListener(function (changes, area) {
    if (area === 'local' && changes[STORAGE_KEY]) {
      var newVal = changes[STORAGE_KEY].newValue || [];
      changeListeners.forEach(function (cb) {
        try {
          cb(newVal);
        } catch (e) {
          console.error('[GifFav] storage change listener failed:', e);
        }
      });
    }
  });

  function onChange(cb) {
    changeListeners.push(cb);
  }

  return {
    list: list,
    has: has,
    add: add,
    remove: remove,
    toggle: toggle,
    onChange: onChange,
    normalizeGifUrl: normalizeGifUrl,
  };
})();
