var GifFav = GifFav || {};

GifFav.store = (function () {
  'use strict';

  var STORAGE_KEY = 'teams_gif_favorites';
  var MEDIA_INDEX_KEY = 'teams_gif_favorite_media_index';
  var MEDIA_KEY_PREFIX = 'teams_gif_favorite_media_';
  var MEDIA_CACHE_LIMIT = 50;
  var MEDIA_CACHE_MAX_CHARS = 140 * 1024;
  var GIF_CACHE_MAX_BYTES = 2 * 1024 * 1024;
  var changeListeners = [];
  var storageAreaName = 'sync';

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

  function mediaTypeForUrl(url) {
    if (!url) return 'image';
    var lower = String(url).toLowerCase();
    if (lower.indexOf('giphy.com') !== -1 ||
        lower.indexOf('tenor.com') !== -1 ||
        lower.indexOf('tenor.co') !== -1 ||
        /\.gif(\?|#|$)/i.test(lower)) {
      return 'gif';
    }
    return 'image';
  }

  function isStableGifProviderUrl(url) {
    if (!url) return false;
    try {
      var u = new URL(normalizeMediaUrl(url));
      return u.hostname.includes('giphy.com') ||
        u.hostname.includes('tenor.com') ||
        u.hostname.includes('tenor.co') ||
        u.hostname.includes('media.tenor');
    } catch (_) {
      return false;
    }
  }

  // Strip session/tracking params and unwrap Teams/Skype image proxy URLs so
  // stored media URLs are stable. GIPHY's newer media URLs can put tracking data
  // in the path (/media/v1.../{id}/giphy.gif), so we rebuild them from the GIF ID.
  function normalizeMediaUrl(url) {
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
      u.hash = '';
      return u.toString();
    } catch (_) { /* keep original if URL is malformed */ }
    return url;
  }

  function normalizeGifUrl(url) {
    return normalizeMediaUrl(url);
  }

  function normalizeEntry(fav) {
    var cleanUrl = normalizeMediaUrl(fav.url || fav.previewUrl || '');
    var cleanPreviewUrl = normalizeMediaUrl(fav.previewUrl || cleanUrl);
    var mediaType = fav.mediaType || mediaTypeForUrl(cleanUrl);
    return Object.assign({}, fav, {
      url: cleanUrl,
      previewUrl: cleanPreviewUrl,
      mediaType: mediaType,
    });
  }

  function entriesEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function mediaKey(id) {
    return MEDIA_KEY_PREFIX + id;
  }

  function readLocal(keys) {
    return new Promise(function (resolve, reject) {
      chrome.storage.local.get(keys, function (result) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result || {});
      });
    });
  }

  function writeLocal(obj) {
    return new Promise(function (resolve, reject) {
      chrome.storage.local.set(obj, function () {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  function removeLocal(keys) {
    return new Promise(function (resolve, reject) {
      chrome.storage.local.remove(keys, function () {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  function blobToDataUrl(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error || new Error('FileReader failed')); };
      reader.readAsDataURL(blob);
    });
  }

  async function dataUrlToBlob(dataUrl) {
    var resp = await fetch(dataUrl);
    return resp.blob();
  }

  function canvasToBlob(canvas, type, quality) {
    return new Promise(function (resolve) {
      canvas.toBlob(resolve, type, quality);
    });
  }

  function closeBitmap(bitmap) {
    if (bitmap && bitmap.close) bitmap.close();
  }

  async function loadBitmap(blob) {
    if (window.createImageBitmap) return createImageBitmap(blob);

    return new Promise(function (resolve, reject) {
      var img = new Image();
      var objectUrl = URL.createObjectURL(blob);
      img.onload = function () {
        URL.revokeObjectURL(objectUrl);
        resolve(img);
      };
      img.onerror = function () {
        URL.revokeObjectURL(objectUrl);
        reject(new Error('image decode failed'));
      };
      img.src = objectUrl;
    });
  }

  async function compressImageBlob(blob) {
    var bitmap = await loadBitmap(blob);
    var sourceWidth = bitmap.width || bitmap.naturalWidth;
    var sourceHeight = bitmap.height || bitmap.naturalHeight;
    var attempts = [
      { maxEdge: 768, quality: 0.72 },
      { maxEdge: 640, quality: 0.68 },
      { maxEdge: 512, quality: 0.64 },
      { maxEdge: 480, quality: 0.60 },
    ];
    var bestBlob = null;

    try {
      for (var i = 0; i < attempts.length; i++) {
        var scale = Math.min(1, attempts[i].maxEdge / Math.max(sourceWidth, sourceHeight));
        var width = Math.max(1, Math.round(sourceWidth * scale));
        var height = Math.max(1, Math.round(sourceHeight * scale));
        var canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(bitmap, 0, 0, width, height);

        var compressed = await canvasToBlob(canvas, 'image/webp', attempts[i].quality);
        if (!compressed) compressed = await canvasToBlob(canvas, 'image/jpeg', attempts[i].quality);
        if (!compressed) throw new Error('canvas compression failed');

        bestBlob = compressed;
        if ((await blobToDataUrl(compressed)).length <= MEDIA_CACHE_MAX_CHARS) return compressed;
      }
    } finally {
      closeBitmap(bitmap);
    }

    return bestBlob;
  }

  function isCacheableEntry(entry) {
    if (!entry || !entry.url ||
        entry.url.startsWith('data:') ||
        entry.url.startsWith('chrome-extension:')) return false;
    if (entry.mediaType === 'image') return true;
    return entry.mediaType === 'gif' && !isStableGifProviderUrl(entry.url);
  }

  async function readMediaIndex() {
    var result = await readLocal([MEDIA_INDEX_KEY]);
    return Array.isArray(result[MEDIA_INDEX_KEY]) ? result[MEDIA_INDEX_KEY] : [];
  }

  async function writeMediaIndex(index) {
    var obj = {};
    obj[MEDIA_INDEX_KEY] = index;
    await writeLocal(obj);
  }

  async function pruneMediaCache(index, keepIds, extraCount) {
    var keep = {};
    keepIds.forEach(function (id) { keep[id] = true; });
    index = index.slice().sort(function (a, b) { return (b.cachedAt || 0) - (a.cachedAt || 0); });

    var kept = [];
    var removeIds = [];
    for (var i = 0; i < index.length; i++) {
      var item = index[i];
      if (!keep[item.id] || kept.length >= MEDIA_CACHE_LIMIT - (extraCount || 0)) {
        removeIds.push(item.id);
      } else {
        kept.push(item);
      }
    }

    if (removeIds.length > 0) {
      await removeLocal(removeIds.map(mediaKey));
      await writeMediaIndex(kept);
    }
    return kept;
  }

  async function cacheEntryMedia(entry, knownItems) {
    if (!isCacheableEntry(entry)) return entry;

    try {
      var existing = await getCachedMediaDataUrl(entry);
      if (existing) return Object.assign({}, entry, { localCache: true });

      var resp = await fetch(entry.url, { mode: 'cors', credentials: 'omit' });
      if (!resp.ok) throw new Error('fetch ' + resp.status);
      var blob = await resp.blob();
      if (!blob.type || !blob.type.startsWith('image/')) return entry;

      var cacheBlob = null;
      var cacheType = '';
      var cachedEntry = entry;
      if (blob.type === 'image/gif' || (entry.mediaType === 'gif' && !isStableGifProviderUrl(entry.url))) {
        if (blob.size > GIF_CACHE_MAX_BYTES) {
          console.warn('[GifFav] GIF too large for local cache:', blob.size);
          return entry;
        }
        cacheBlob = blob;
        cacheType = blob.type || 'image/gif';
        cachedEntry = Object.assign({}, entry, { mediaType: 'gif' });
      } else {
        var compressedBlob = await compressImageBlob(blob);
        if (!compressedBlob) return entry;
        var compressedDataUrl = await blobToDataUrl(compressedBlob);
        if (compressedDataUrl.length > MEDIA_CACHE_MAX_CHARS) {
          console.warn('[GifFav] compressed image still too large for local cache:', compressedDataUrl.length);
          return entry;
        }
        cacheBlob = compressedBlob;
        cacheType = compressedBlob.type || 'image/webp';
      }

      var dataUrl = await blobToDataUrl(cacheBlob);

      var index = await readMediaIndex();
      var keepIds = (knownItems || []).map(function (item) { return item.id; }).concat(entry.id);
      index = await pruneMediaCache(index, keepIds, 1);

      var obj = {};
      obj[mediaKey(entry.id)] = dataUrl;
      try {
        await writeLocal(obj);
      } catch (quotaError) {
        index = await pruneMediaCache(index, keepIds, 10);
        await writeLocal(obj);
      }

      index = index.filter(function (item) { return item.id !== entry.id; });
      index.unshift({
        id: entry.id,
        cachedAt: Date.now(),
        size: dataUrl.length,
        type: cacheType,
      });
      await writeMediaIndex(index.slice(0, MEDIA_CACHE_LIMIT));
      return Object.assign({}, cachedEntry, { localCache: true });
    } catch (e) {
      console.warn('[GifFav] local media cache failed:', e);
      return entry;
    }
  }

  async function migrateItems(items) {
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

    return { items: migrated, changed: changed };
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

  function getArea(areaName) {
    return chrome.storage[areaName] || chrome.storage.local;
  }

  function readStorageArea(areaName) {
    return new Promise(function (resolve, reject) {
      getArea(areaName).get([STORAGE_KEY], function (result) {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(result[STORAGE_KEY] || []);
      });
    });
  }

  function writeStorageArea(areaName, items) {
    return new Promise(function (resolve, reject) {
      var obj = {};
      obj[STORAGE_KEY] = items;
      getArea(areaName).set(obj, function () {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve();
      });
    });
  }

  async function writeStorage(items) {
    try {
      await writeStorageArea('sync', items);
      storageAreaName = 'sync';
    } catch (syncError) {
      console.warn('[GifFav] sync storage write failed; falling back to local:', syncError);
      await writeStorageArea('local', items);
      storageAreaName = 'local';
    }
  }

  async function readStorage() {
    var syncItems = [];
    var localItems = [];
    try {
      syncItems = await readStorageArea('sync');
    } catch (syncError) {
      console.warn('[GifFav] sync storage read failed; using local:', syncError);
      storageAreaName = 'local';
      return readStorageArea('local');
    }

    try {
      localItems = await readStorageArea('local');
    } catch (_) {
      localItems = [];
    }

    if (localItems.length > 0) {
      storageAreaName = 'sync';
      var merged = await migrateItems(syncItems.concat(localItems));
      if (merged.changed || syncItems.length !== merged.items.length) await writeStorage(merged.items);
      return merged.items;
    }

    storageAreaName = 'sync';
    return syncItems;
  }

  async function migrateStorage(items) {
    var migrated = await migrateItems(items);
    if (migrated.changed) await writeStorage(migrated.items);
    return migrated.items;
  }

  async function list() {
    var items = await readStorage();
    return migrateStorage(items);
  }

  async function has(url) {
    var id = await hashUrl(normalizeMediaUrl(url));
    var items = await migrateStorage(await readStorage());
    return items.some(function (f) { return f.id === id; });
  }

  async function add(fav) {
    // Normalize URL before storing so provider session params never expire
    var normalisedFav = normalizeEntry(fav);
    var cleanUrl = normalisedFav.url;
    var id = await hashUrl(cleanUrl);
    var items = await migrateStorage(await readStorage());
    if (items.some(function (f) { return f.id === id; })) return; // duplicate
    var entry = Object.assign({}, normalisedFav, { id: id, addedAt: Date.now() });
    entry = await cacheEntryMedia(entry, items);
    await writeStorage([entry].concat(items)); // newest first (Discord-style)
  }

  async function remove(url) {
    var id = await hashUrl(normalizeMediaUrl(url));
    var items = await migrateStorage(await readStorage());
    await writeStorage(items.filter(function (f) { return f.id !== id; }));
    await removeLocal([mediaKey(id)]);
    var index = await readMediaIndex();
    await writeMediaIndex(index.filter(function (item) { return item.id !== id; }));
  }

  async function clearAll() {
    var index = await readMediaIndex();
    var keys = index.map(function (item) { return mediaKey(item.id); });
    keys.push(MEDIA_INDEX_KEY);
    await removeLocal(keys);
    await writeStorageArea('local', []);
    try {
      await writeStorageArea('sync', []);
      storageAreaName = 'sync';
    } catch (syncError) {
      console.warn('[GifFav] sync storage clear failed; local storage was cleared:', syncError);
      storageAreaName = 'local';
    }
  }

  async function getCachedMediaDataUrl(favOrId) {
    var id = typeof favOrId === 'string'
      ? favOrId
      : (favOrId && (favOrId.id || await hashUrl(normalizeMediaUrl(favOrId.url || ''))));
    if (!id) return null;
    var result = await readLocal([mediaKey(id)]);
    return result[mediaKey(id)] || null;
  }

  async function getCachedMediaBlob(favOrId) {
    var dataUrl = await getCachedMediaDataUrl(favOrId);
    if (!dataUrl) return null;
    return dataUrlToBlob(dataUrl);
  }

  async function ensureCachedMedia(fav) {
    var entry = normalizeEntry(fav);
    entry.id = entry.id || await hashUrl(entry.url);
    var items = await migrateStorage(await readStorage());
    var cachedEntry = await cacheEntryMedia(entry, items);
    if (cachedEntry.localCache && !fav.localCache) {
      var changed = false;
      items = items.map(function (item) {
        if (item.id !== cachedEntry.id) return item;
        changed = true;
        return Object.assign({}, item, {
          localCache: true,
          mediaType: cachedEntry.mediaType || item.mediaType,
        });
      });
      if (changed) await writeStorage(items);
    }
    return cachedEntry;
  }

  async function toggle(fav) {
    var alreadyFav = await has(normalizeMediaUrl(fav.url));
    if (alreadyFav) {
      await remove(fav.url);
      return { added: false };
    } else {
      await add(fav);
      return { added: true };
    }
  }

  // Notify listeners when storage changes (cross-tab/device sync via chrome.storage event)
  chrome.storage.onChanged.addListener(function (changes, area) {
    if ((area === 'sync' || area === 'local') && changes[STORAGE_KEY]) {
      storageAreaName = area;
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
    clearAll: clearAll,
    toggle: toggle,
    onChange: onChange,
    getCachedMediaDataUrl: getCachedMediaDataUrl,
    getCachedMediaBlob: getCachedMediaBlob,
    ensureCachedMedia: ensureCachedMedia,
    isStableGifProviderUrl: isStableGifProviderUrl,
    normalizeGifUrl: normalizeGifUrl,
    normalizeMediaUrl: normalizeMediaUrl,
  };
})();
