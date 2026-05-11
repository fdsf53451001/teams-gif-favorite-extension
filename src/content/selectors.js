var GifFav = GifFav || {};

GifFav.selectors = (function () {
  // Teams uses Fluent UI with Griffel — class names are hashed and unstable.
  // We rely on data-tid attributes and role/aria attributes instead.
  // Each lookup tries multiple selectors in order; first match wins.

  function find(selectors, context) {
    context = context || document;
    var list = Array.isArray(selectors) ? selectors : [selectors];
    for (var i = 0; i < list.length; i++) {
      var el = context.querySelector(list[i]);
      if (el) return el;
    }
    return null;
  }

  function findAll(selectors, context) {
    context = context || document;
    var list = Array.isArray(selectors) ? selectors : [selectors];
    for (var i = 0; i < list.length; i++) {
      var els = context.querySelectorAll(list[i]);
      if (els.length > 0) return Array.from(els);
    }
    return [];
  }

  // Message compose input box
  var COMPOSER = [
    'div[contenteditable="true"][role="textbox"]',
    'div[role="textbox"][contenteditable]',
    'div[contenteditable="true"][aria-label]',
    'div[data-tid="ckeditor"]',
  ];

  function isUsableMediaUrl(src) {
    return src &&
      !src.startsWith('data:') &&
      !src.startsWith('chrome-extension:');
  }

  // Returns true if an <img> element is a GIF (from GIPHY, Tenor, or .gif URL)
  function isGifImg(img) {
    if (!img || img.tagName !== 'IMG') return false;
    var src = img.currentSrc || img.src || img.getAttribute('src') || '';
    if (!isUsableMediaUrl(src)) return false;
    return (
      /\.gif(\?|$)/i.test(src) ||
      src.includes('giphy.com') ||
      src.includes('tenor.com') ||
      src.includes('tenor.co') ||
      src.includes('media.giphy') ||
      src.includes('media.tenor')
    );
  }

  function isImageImg(img) {
    if (!img || img.tagName !== 'IMG') return false;
    var src = img.currentSrc || img.src || img.getAttribute('src') || img.getAttribute('srcset') || '';
    if (!isUsableMediaUrl(src)) return false;

    var rect = img.getBoundingClientRect();
    var width = img.naturalWidth || img.width || rect.width || 0;
    var height = img.naturalHeight || img.height || rect.height || 0;
    if (width < 32 || height < 32) return false;

    if (img.closest('[role="button"], button, a') && width < 96 && height < 96) return false;
    if (img.closest('[data-gif-fav-tab], .gif-fav-tab-panel, [data-tid="unified-picker-content"]')) return false;

    return (
      isGifImg(img) ||
      /\.(png|jpe?g|webp|bmp|avif)(\?|#|$)/i.test(src) ||
      img.closest('[data-tid*="message"], [id*="message"], [role="listitem"]') ||
      src.includes('urlp.asm.skype.com') ||
      src.includes('api.asm.skype.com') ||
      src.includes('static2.sharepointonline.com') ||
      src.includes('public.dm.files.1drv.com') ||
      src.includes('attachments.office.net') ||
      src.includes('teams.microsoft.com/api/')
    );
  }

  function explainImage(img) {
    if (!img || img.tagName !== 'IMG') return { ok: false, reason: 'not-img' };
    var src = img.currentSrc || img.src || img.getAttribute('src') || img.getAttribute('srcset') || '';
    var rect = img.getBoundingClientRect();
    var width = img.naturalWidth || img.width || rect.width || 0;
    var height = img.naturalHeight || img.height || rect.height || 0;
    if (!isUsableMediaUrl(src)) return { ok: false, reason: 'unusable-src', src: src, width: width, height: height };
    if (width < 32 || height < 32) return { ok: false, reason: 'too-small', src: src, width: width, height: height };
    if (img.closest('[role="button"], button, a') && width < 96 && height < 96) {
      return { ok: false, reason: 'small-button-image', src: src, width: width, height: height };
    }
    if (img.closest('[data-gif-fav-tab], .gif-fav-tab-panel, [data-tid="unified-picker-content"]')) {
      return { ok: false, reason: 'extension-or-picker-image', src: src, width: width, height: height };
    }
    return { ok: isImageImg(img), reason: isImageImg(img) ? 'supported' : 'unsupported-host', src: src, width: width, height: height };
  }

  // Returns true if a <video> element is a GIF (Teams plays animated GIFs as video)
  function isGifVideo(video) {
    if (!video || video.tagName !== 'VIDEO') return false;
    var src = video.getAttribute('src') || video.currentSrc || '';
    if (!isUsableMediaUrl(src)) return false;
    return (
      /\.gif(\?|$)/i.test(src) ||
      src.includes('giphy.com') ||
      src.includes('tenor.com') ||
      src.includes('tenor.co') ||
      src.includes('media.giphy') ||
      src.includes('media.tenor')
    );
  }

  // Locate the GIF picker flyout.
  // Teams' unified picker uses data-tid="sendMessageCommands-popup-UnifiedFunPicker-content".
  function findPickerFlyout() {
    var explicit = [
      '[data-tid="sendMessageCommands-popup-UnifiedFunPicker-content"]',
      '[data-tid="giphy-search-flyout"]',
      '[data-tid="gif-picker-flyout"]',
      '[data-tid="expression-panel"]',
      '[data-tid="message-extension-flyout"]',
    ];
    for (var i = 0; i < explicit.length; i++) {
      var el = document.querySelector(explicit[i]);
      if (el) return el;
    }

    // Heuristic: a visible dialog/region that contains a GIPHY search input
    var candidates = document.querySelectorAll('[role="dialog"], [role="region"]');
    for (var j = 0; j < candidates.length; j++) {
      var c = candidates[j];
      if (!c.offsetParent) continue;
      var rect = c.getBoundingClientRect();
      if (rect.width < 200 || rect.height < 100) continue;
      if (c.querySelector('input[data-tid="unified-picker-search-bar"], input[placeholder]') &&
          c.querySelectorAll('button[role="menuitem"]').length >= 2) return c;
    }
    return null;
  }

  // Find the GIF category grid container inside the picker flyout.
  // In Teams, this is: [data-tid="unified-picker-giphys-content"] > div[role="menu"]
  function findCategoryGrid(pickerRoot) {
    // Primary: stable data-tid path (Teams unified picker)
    var giphysContent = pickerRoot.querySelector('[data-tid="unified-picker-giphys-content"]');
    if (giphysContent) {
      var grid = giphysContent.querySelector('div[role="menu"]');
      if (grid && grid.querySelectorAll('button[role="menuitem"]').length >= 2) return grid;
    }

    // Fallback: any div[role="menu"] inside the picker that has multiple menuitem buttons
    var menus = pickerRoot.querySelectorAll('div[role="menu"]');
    for (var i = 0; i < menus.length; i++) {
      if (menus[i].querySelectorAll('button[role="menuitem"]').length >= 2) return menus[i];
    }

    // Wider fallback: a container whose direct children include buttons with images
    var containers = pickerRoot.querySelectorAll('ul, ol, div[role="list"], div[role="grid"]');
    for (var j = 0; j < containers.length; j++) {
      var c = containers[j];
      if (c.querySelectorAll(':scope > button[role="menuitem"]').length >= 2) return c;
      if (c.querySelectorAll(':scope > li').length >= 2) return c;
    }
    return null;
  }

  return {
    find: find,
    findAll: findAll,
    COMPOSER: COMPOSER,
    isGifImg: isGifImg,
    isImageImg: isImageImg,
    explainImage: explainImage,
    isGifVideo: isGifVideo,
    findPickerFlyout: findPickerFlyout,
    findCategoryGrid: findCategoryGrid,
  };
})();
