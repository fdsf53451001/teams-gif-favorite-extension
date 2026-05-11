var GifFav = GifFav || {};

(function () {
  'use strict';

  // Only activate on Teams web domains
  var host = window.location.hostname;
  if (
    host !== 'teams.microsoft.com' &&
    host !== 'teams.live.com' &&
    !host.endsWith('.teams.microsoft.com') &&
    !host.endsWith('.teams.live.com')
  ) {
    return;
  }

  function start() {
    GifFav.chatWatcher.init();
    GifFav.pickerWatcher.init();
    console.log('[GifFav] Teams GIF 我的最愛 已啟動');
  }

  // Teams is a SPA — by the time this content script runs, the DOM exists
  // but Teams' React app may still be mounting. A 1s delay lets the initial
  // render settle so our observers start after the message pane exists.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(start, 1000);
    });
  } else {
    setTimeout(start, 1000);
  }
})();
