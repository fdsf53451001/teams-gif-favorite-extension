var GifFav = GifFav || {};

GifFav.inserter = (function () {
  'use strict';

  function findComposer() {
    var active = document.activeElement;
    if (active && active.matches && active.matches('[contenteditable="true"], [role="textbox"][contenteditable]')) {
      return active;
    }

    for (var i = 0; i < GifFav.selectors.COMPOSER.length; i++) {
      var el = document.querySelector(GifFav.selectors.COMPOSER[i]);
      if (!el) continue;
      if (el.matches && el.matches('[contenteditable="true"], [role="textbox"][contenteditable]')) return el;
      var editable = el.querySelector && el.querySelector('[contenteditable="true"], [role="textbox"][contenteditable]');
      return editable || el;
    }
    return null;
  }

  function showToast(message) {
    var existing = document.getElementById('gif-fav-toast');
    if (existing) existing.remove();
    var toast = document.createElement('div');
    toast.id = 'gif-fav-toast';
    toast.className = 'gif-fav-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () { if (toast.parentNode) toast.remove(); }, 3500);
  }

  function placeCaretAtEnd(el) {
    el.focus();
    if (!el.isContentEditable) return;
    var range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    var sel = window.getSelection();
    if (sel) { sel.removeAllRanges(); sel.addRange(range); }
  }

  function waitForComposerMutation(target, timeoutMs) {
    return new Promise(function (resolve) {
      var done = false;
      var timer = null;
      var observer = new MutationObserver(function () {
        if (done) return;
        done = true;
        clearTimeout(timer);
        observer.disconnect();
        resolve(true);
      });

      observer.observe(target, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });

      timer = setTimeout(function () {
        if (done) return;
        done = true;
        observer.disconnect();
        resolve(false);
      }, timeoutMs);
    });
  }

  function makeClipboardEvent(dt) {
    return new ClipboardEvent('paste', {
      clipboardData: dt,
      bubbles: true,
      cancelable: true,
      composed: true,
    });
  }

  function dispatchPaste(dt, composer, timeoutMs) {
    placeCaretAtEnd(composer);
    var mutationPromise = waitForComposerMutation(composer, timeoutMs || 1200);
    var event = makeClipboardEvent(dt);
    var accepted = composer.dispatchEvent(event);
    return mutationPromise.then(function (mutated) {
      if (accepted && !mutated) throw new Error('paste event not handled by Teams');
      return mutated;
    });
  }

  function buildReadonlyEl(fav, url) {
    var alt = fav.alt || 'GIF';
    var itemtype = (url.includes('giphy.com') || url.includes('media.giphy'))
      ? 'http://schema.skype.com/Giphy'
      : 'http://schema.skype.com/Tenor';
    var el = document.createElement('readonly');
    el.setAttribute('title', alt);
    el.setAttribute('itemtype', itemtype);
    el.setAttribute('contenteditable', 'false');
    el.setAttribute('aria-label', alt);
    var img = document.createElement('img');
    img.setAttribute('style', 'height:auto;margin-top:4px;max-width:100%;');
    img.alt = alt;
    if (fav.height) img.setAttribute('height', String(fav.height));
    if (fav.width) img.setAttribute('width', String(fav.width));
    img.src = url;
    el.appendChild(img);
    return el;
  }

  function gifFileName(fav, ext) {
    var source = fav.alt || '';
    try {
      var url = GifFav.store.normalizeGifUrl(fav.url);
      var parts = new URL(url).pathname.split('/').filter(Boolean);
      var mediaIndex = parts.indexOf('media');
      if (mediaIndex !== -1 && parts[mediaIndex + 1]) source = parts[mediaIndex + 1];
    } catch (_) { /* keep alt/default */ }

    var safeName = source
      .toLowerCase()
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 48);

    return (safeName || (fav.mediaType === 'image' ? 'teams-image' : 'teams-gif')) + '.' + ext;
  }

  function isGifFavorite(fav) {
    if (fav.mediaType === 'gif') return true;
    if (fav.mediaType === 'image') return false;
    var url = GifFav.store.normalizeMediaUrl(fav.url || '');
    return url.indexOf('giphy.com') !== -1 ||
      url.indexOf('tenor.com') !== -1 ||
      url.indexOf('tenor.co') !== -1 ||
      /\.gif(\?|#|$)/i.test(url);
  }

  // Strategy 1: insert <readonly> element directly into the composer DOM.
  // Bypasses CKEditor's paste handler (_handleGiphyOrExternalImages) which
  // validates URLs through urlp.asm.skype.com and rejects external GIF URLs.
  // CKEditor's MutationObserver upcasts the element to the model, preserving it.
  async function tryDirectInsert(fav, composer) {
    if (!isGifFavorite(fav)) throw new Error('direct insert is GIF-only');
    var url = GifFav.store.normalizeGifUrl(fav.url);
    var el = buildReadonlyEl(fav, url);

    placeCaretAtEnd(composer);

    // Insert before the trailing empty <p> CKEditor always maintains
    var lastP = null;
    for (var i = composer.children.length - 1; i >= 0; i--) {
      if (composer.children[i].tagName === 'P') { lastP = composer.children[i]; break; }
    }
    if (lastP) composer.insertBefore(el, lastP);
    else composer.appendChild(el);

    composer.dispatchEvent(new InputEvent('input', { bubbles: true, composed: true }));

    // Give CKEditor time to accept or revert the mutation
    await new Promise(function (r) { setTimeout(r, 400); });

    if (!composer.contains(el)) throw new Error('direct insert: CKEditor removed the element');
  }

  // Disabled fallback: paste GIF as Teams' native <readonly> card via ClipboardEvent.
  // CKEditor accepts the element but then _handleGiphyOrExternalImages validates
  // the URL via urlp proxy. Current Teams rejects media.giphy.com with 400 and
  // shows "unable to paste this image", so insert() no longer calls this path.
  async function tryUrlPaste(fav, composer) {
    var url = GifFav.store.normalizeGifUrl(fav.url);
    var el = buildReadonlyEl(fav, url);
    var dt = new DataTransfer();
    dt.setData('text/html', el.outerHTML);
    dt.setData('text/plain', url);
    var mutated = await dispatchPaste(dt, composer, 2000);
    if (!mutated) throw new Error('URL paste: no DOM response');
  }

  // Strategy 2: fetch blob and paste as a file. This avoids Teams'
  // _handleGiphyOrExternalImages URL-proxy validation entirely.
  async function tryPasteBlob(fav, composer) {
    var fetchUrl = GifFav.store.normalizeMediaUrl(fav.url);
    var resp = await fetch(fetchUrl, { mode: 'cors', credentials: 'omit' });
    if (!resp.ok) throw new Error('fetch ' + resp.status);
    var blob = await resp.blob();
    var fileType = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/gif';
    var ext = fileType === 'image/gif' ? 'gif' : fileType.split('/')[1] || 'gif';
    var file = new File([blob], gifFileName(fav, ext), { type: fileType });
    var dt = new DataTransfer();
    dt.items.add(file);

    if (dt.files.length === 0 || dt.items.length === 0) {
      throw new Error('DataTransfer is empty after adding GIF file');
    }

    // Verify the synthetic ClipboardEvent retains our DataTransfer payload.
    var testEvent = makeClipboardEvent(dt);
    if (!testEvent.clipboardData || testEvent.clipboardData.files.length === 0) {
      throw new Error('ClipboardEvent dropped DataTransfer payload');
    }

    await dispatchPaste(dt, composer, 1200);
  }

  // Fallback: copy GIF to system clipboard, show toast. A real user paste is
  // trusted by the browser, so Teams accepts it in more cases than a synthetic
  // ClipboardEvent.
  async function tryCopyClipboard(fav) {
    var fetchUrl = GifFav.store.normalizeMediaUrl(fav.url);
    try {
      var resp = await fetch(fetchUrl, { mode: 'cors', credentials: 'omit' });
      if (!resp.ok) throw new Error('fetch ' + resp.status);
      var blob = await resp.blob();
      var clipboardType = blob.type && blob.type.startsWith('image/') ? blob.type : 'image/gif';
      var clipboardBlob = blob.type === clipboardType ? blob : blob.slice(0, blob.size, clipboardType);
      await navigator.clipboard.write([new ClipboardItem({ [clipboardType]: clipboardBlob })]);
      showToast('已複製圖片！請按 Ctrl+V（Mac: Cmd+V）貼到訊息框');
    } catch (copyError) {
      console.error('[GifFav] clipboard image copy failed:', copyError);
      try {
        await navigator.clipboard.writeText(fetchUrl);
        showToast('已複製圖片網址！貼上後送出即可顯示');
      } catch (e) {
        console.error('[GifFav] clipboard URL copy failed:', e);
        showToast('無法插入圖片，請手動複製：' + fetchUrl);
      }
    }
  }

  async function insert(fav) {
    var composer = findComposer();
    if (!composer) {
      console.warn('[GifFav] Composer not found — clipboard fallback');
      await tryCopyClipboard(fav);
      return;
    }

    if (isGifFavorite(fav)) {
      // Strategy 1: direct DOM insertion — bypasses paste handler URL validation
      try {
        await tryDirectInsert(fav, composer);
        console.log('[GifFav] direct-insert succeeded');
        return;
      } catch (e) {
        console.warn('[GifFav] direct-insert failed:', e);
      }
    }

    // Strategy 2: paste as a file/blob so Teams does not validate the source URL
    try {
      await tryPasteBlob(fav, composer);
      console.log('[GifFav] blob-paste succeeded');
      return;
    } catch (e) {
      console.warn('[GifFav] blob-paste failed:', e);
    }

    await tryCopyClipboard(fav);
  }

  // ── Stage-1 diagnostic: capture Teams' native GIF DOM ──
  // Usage in DevTools: __gifFavStartCapture()  →  use Teams' own GIF picker  →  read logs
  function startCaptureProbe() {
    var composer = findComposer();
    if (!composer) { console.warn('[GifFav][capture] no composer found — focus a chat input first'); return; }
    var snapBefore = composer.innerHTML;
    var obs = new MutationObserver(function (records) {
      var added = [];
      records.forEach(function (r) {
        r.addedNodes.forEach(function (n) {
          if (n.nodeType === 1) added.push(n);
        });
      });
      if (added.length === 0) return;
      console.log('[GifFav][capture] ===== MUTATION DETECTED =====');
      added.forEach(function (n, i) {
        console.log('[GifFav][capture] added[' + i + '] tag=' + n.tagName + ' outerHTML:', n.outerHTML.slice(0, 1200));
      });
      var snapAfter = composer.innerHTML;
      if (snapAfter !== snapBefore) {
        console.log('[GifFav][capture] composer innerHTML BEFORE:', snapBefore.slice(0, 800));
        console.log('[GifFav][capture] composer innerHTML AFTER:', snapAfter.slice(0, 1200));
        snapBefore = snapAfter;
      }
    });
    obs.observe(composer, { childList: true, subtree: true });
    captureStop = function () { obs.disconnect(); console.log('[GifFav][capture] stopped'); captureStop = null; };
    console.log('[GifFav][capture] READY — now open Teams\' own GIF picker and pick a GIF. Run: document.dispatchEvent(new Event("gifFavCaptureStop")) when done.');
  }

  var captureStop = null;
  document.addEventListener('gifFavStartCapture', startCaptureProbe);
  document.addEventListener('gifFavCaptureStop', function () { if (captureStop) captureStop(); });

  return { insert: insert, showToast: showToast };
})();
