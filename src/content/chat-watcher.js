var GifFav = GifFav || {};

GifFav.chatWatcher = (function () {
  'use strict';

  var observer = null;

  function starSVG(filled) {
    return filled
      ? '<svg viewBox="0 0 24 24" width="16" height="16" fill="#FFD700" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' +
        '</svg>'
      : '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="white" stroke-width="1.8" xmlns="http://www.w3.org/2000/svg">' +
          '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>' +
        '</svg>';
  }

  function setStarState(btn, isFav) {
    btn.className = 'gif-fav-star' + (isFav ? ' is-fav' : '');
    btn.setAttribute('aria-label', isFav ? '取消最愛' : '加入最愛');
    btn.setAttribute('title', isFav ? '取消最愛' : '加入最愛');
    btn.innerHTML = starSVG(isFav);
  }

  function isInComposer(img) {
    for (var i = 0; i < GifFav.selectors.COMPOSER.length; i++) {
      var el = document.querySelector(GifFav.selectors.COMPOSER[i]);
      if (el && el.contains(img)) return true;
    }
    return false;
  }

  async function attachStar(el) {
    var isVideo = el.tagName === 'VIDEO';

    // If already injected, re-inject only if the star button was removed (Teams re-render)
    if (el.dataset.gifFavInjected) {
      if (el.parentNode && el.parentNode.querySelector('.gif-fav-star')) return;
    }
    el.dataset.gifFavInjected = '1';

    var elSrc = el.src || el.getAttribute('src') || '';
    var isFav = await GifFav.store.has(elSrc);
    if (!el.parentNode) return;

    var container = el.parentNode;

    // Mark container for CSS hover targeting without wrapping the element.
    // Wrapping changes parentNode which breaks Teams' GIF player component.
    if (!container.dataset.gifFavContainer) {
      container.dataset.gifFavContainer = '1';
      // Ensure container is positioned so the absolute star button renders correctly.
      if (window.getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
      }
    }

    var btn = document.createElement('button');
    btn.type = 'button';
    setStarState(btn, isFav);
    container.appendChild(btn);

    btn.addEventListener('click', async function (e) {
      e.preventDefault();
      e.stopPropagation();
      var src = el.src || el.getAttribute('src') || '';
      var fav = {
        url: src,
        previewUrl: src,
        width: (isVideo ? el.videoWidth : el.naturalWidth) || el.width || 0,
        height: (isVideo ? el.videoHeight : el.naturalHeight) || el.height || 0,
        alt: el.alt || 'GIF',
      };
      var result = await GifFav.store.toggle(fav);
      setStarState(btn, result.added);
    });
  }

  function tryAttach(el) {
    if (el.dataset.gifFavInjected && el.parentNode && el.parentNode.querySelector('.gif-fav-star')) return;
    if (!isInComposer(el)) {
      attachStar(el).catch(function (e) { console.warn('[GifFav] attachStar:', e); });
    }
  }

  function processNode(node) {
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    if (node.tagName === 'IMG' && GifFav.selectors.isGifImg(node)) {
      tryAttach(node);
    }
    if (node.tagName === 'VIDEO' && GifFav.selectors.isGifVideo(node)) {
      tryAttach(node);
    }
    node.querySelectorAll('img, video').forEach(function (el) {
      if (el.tagName === 'IMG' && GifFav.selectors.isGifImg(el)) tryAttach(el);
      if (el.tagName === 'VIDEO' && GifFav.selectors.isGifVideo(el)) tryAttach(el);
    });
  }

  function handleMutations(records) {
    for (var i = 0; i < records.length; i++) {
      var record = records[i];
      if (record.type === 'childList') {
        for (var j = 0; j < record.addedNodes.length; j++) {
          processNode(record.addedNodes[j]);
        }
      } else if (record.type === 'attributes') {
        // Teams lazy-loads GIF src — img/video added with empty src then src is set later.
        // Watch attribute changes so the star appears as soon as the real URL is set.
        var target = record.target;
        if (target.tagName === 'IMG' && GifFav.selectors.isGifImg(target)) tryAttach(target);
        if (target.tagName === 'VIDEO' && GifFav.selectors.isGifVideo(target)) tryAttach(target);
      }
    }
  }

  function init() {
    document.querySelectorAll('img, video').forEach(function (el) {
      if (el.tagName === 'IMG' && GifFav.selectors.isGifImg(el)) tryAttach(el);
      if (el.tagName === 'VIDEO' && GifFav.selectors.isGifVideo(el)) tryAttach(el);
    });

    observer = new MutationObserver(handleMutations);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['src'],
    });
  }

  function destroy() {
    if (observer) { observer.disconnect(); observer = null; }
  }

  return { init: init, destroy: destroy };
})();
