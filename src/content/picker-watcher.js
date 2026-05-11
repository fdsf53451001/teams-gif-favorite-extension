var GifFav = GifFav || {};

GifFav.pickerWatcher = (function () {
  'use strict';

  var observer = null;

  function i18nLabel() {
    var lang = (document.documentElement.lang || navigator.language || 'en').toLowerCase();
    if (lang.startsWith('zh-tw') || lang.startsWith('zh-hk') || lang === 'zh') return '我的最愛';
    if (lang.startsWith('zh-cn')) return '我的收藏';
    if (lang.startsWith('ja')) return 'お気に入り';
    if (lang.startsWith('ko')) return '즐겨찾기';
    return 'Favorites';
  }

  function closePicker(pickerRoot) {
    ['keydown', 'keyup'].forEach(function (type) {
      pickerRoot.dispatchEvent(new KeyboardEvent(type, {
        key: 'Escape', code: 'Escape', keyCode: 27,
        bubbles: true, cancelable: true,
      }));
    });
  }

  function hideEl(el) {
    if (!el.dataset.gifFavHidden) {
      el.dataset.gifFavHidden = '1';
      el.classList.add('gif-fav-content-hidden');
    }
  }

  function showEl(el) {
    if (el.dataset.gifFavHidden) {
      delete el.dataset.gifFavHidden;
      el.classList.remove('gif-fav-content-hidden');
    }
  }

  function hidePickerContent(pickerRoot, pickerContent) {
    Array.from(pickerContent.children).forEach(function (child) {
      if (child.getAttribute('role') === 'tablist') return;
      if (child.dataset.gifFavPanel) return;
      hideEl(child);
    });
    // Also hide any sibling grids Teams renders directly in the dialog
    Array.from(pickerRoot.children).forEach(function (child) {
      if (child === pickerContent) return;
      if (child.tagName === 'I') return; // tabster sentinel
      hideEl(child);
    });
  }

  function showPickerContent(pickerRoot, pickerContent) {
    Array.from(pickerContent.children).forEach(showEl);
    Array.from(pickerRoot.children).forEach(showEl);
  }

  function renderFavGrid(grid, favorites, pickerRoot) {
    grid.innerHTML = '';
    if (favorites.length === 0) {
      var empty = document.createElement('div');
      empty.className = 'gif-fav-empty';
      empty.textContent = 'Hover 到聊天訊息的 GIF，點星星即可收藏';
      grid.appendChild(empty);
      return;
    }
    favorites.forEach(function (fav) {
      var item = document.createElement('button');
      item.type = 'button';
      item.className = 'gif-fav-item';
      item.title = fav.alt || 'GIF';
      var img = document.createElement('img');
      img.src = fav.previewUrl || fav.url;
      img.alt = fav.alt || 'GIF';
      img.loading = 'lazy';
      img.addEventListener('error', function () {
        img.style.display = 'none';
        var placeholder = document.createElement('div');
        placeholder.className = 'gif-fav-broken';
        placeholder.textContent = '?';
        item.appendChild(placeholder);
      });
      item.appendChild(img);
      item.addEventListener('click', async function () {
        if (item.dataset.gifFavBusy) return;
        item.dataset.gifFavBusy = '1';
        item.style.opacity = '0.5';
        // Close picker first so the compose box can receive focus before insertion
        closePicker(pickerRoot);
        try {
          await GifFav.inserter.insert(fav);
        } catch (e) {
          console.error('[GifFav] favorite insert failed:', e);
          GifFav.inserter.showToast('無法插入 GIF');
        }
      });
      grid.appendChild(item);
    });
  }

  async function activateFavTab(favTab, pickerContent, pickerRoot) {
    // Record current height BEFORE hiding so the panel inherits the same size.
    // This prevents the picker window from collapsing when Teams' content is hidden.
    var tablist = pickerRoot.querySelector('[role="tablist"]');
    var savedContentHeight = pickerContent.offsetHeight;
    var tablistHeight = tablist ? tablist.offsetHeight : 44;

    // Apply CSS class to pickerRoot — this drives the indicator override and tab color.
    // We deliberately do NOT set aria-selected="true" on our tab because Teams' React
    // would respond to that and fight us. The CSS class is enough for visuals.
    pickerRoot.classList.add('gif-fav-picker-active');

    hidePickerContent(pickerRoot, pickerContent);

    // Build or reveal the favorites panel
    var panel = pickerContent.querySelector('.gif-fav-tab-panel');
    if (!panel) {
      panel = document.createElement('div');
      panel.className = 'gif-fav-tab-panel';
      panel.dataset.gifFavPanel = '1';

      var grid = document.createElement('div');
      grid.className = 'gif-fav-grid';
      panel.appendChild(grid);
      pickerContent.appendChild(panel);

      var favorites = await GifFav.store.list();
      renderFavGrid(grid, favorites, pickerRoot);

      GifFav.store.onChange(function (newFavs) {
        if (panel.isConnected) renderFavGrid(grid, newFavs, pickerRoot);
      });
    } else {
      panel.style.display = '';
    }

    // Explicitly size the panel to fill the space that the hidden content occupied.
    panel.style.minHeight = Math.max(savedContentHeight - tablistHeight, 200) + 'px';
    panel.style.overflowY = 'auto';
  }

  function deactivateFavTab(pickerRoot, pickerContent) {
    pickerRoot.classList.remove('gif-fav-picker-active');

    var panel = pickerContent.querySelector('.gif-fav-tab-panel');
    if (panel) {
      panel.style.display = 'none';
      panel.style.minHeight = '';
    }

    showPickerContent(pickerRoot, pickerContent);
  }

  function injectFavTab(pickerRoot) {
    var tablist = pickerRoot.querySelector('[role="tablist"]');
    if (!tablist) return;
    if (tablist.querySelector('[data-gif-fav-tab]')) return; // already injected

    var templateTab = tablist.querySelector('button[role="tab"][aria-selected="false"]') ||
                      tablist.querySelector('button[role="tab"]');
    if (!templateTab) return;

    var pickerContent = pickerRoot.querySelector('[data-tid="unified-picker-content"]') || pickerRoot;
    var label = i18nLabel();

    var favTab = templateTab.cloneNode(true);
    favTab.setAttribute('value', 'GifFavorites');
    favTab.setAttribute('aria-selected', 'false');
    favTab.setAttribute('aria-label', label);
    favTab.removeAttribute('id');
    favTab.removeAttribute('data-tid');
    favTab.removeAttribute('data-tabster');
    favTab.dataset.gifFavTab = '1';
    favTab.tabIndex = 0;

    favTab.querySelectorAll('span').forEach(function (sp) { sp.textContent = label; });

    // Use capture phase so our handler fires before Teams' React delegation.
    // stopImmediatePropagation prevents other capture-phase listeners on this element;
    // stopPropagation prevents React's bubble-phase root listener from seeing the click.
    favTab.addEventListener('click', function (e) {
      e.stopImmediatePropagation();
      e.stopPropagation();
      if (pickerRoot.classList.contains('gif-fav-picker-active')) return;
      activateFavTab(favTab, pickerContent, pickerRoot).catch(function (err) {
        console.error('[GifFav] activating favorites tab failed:', err);
      });
    }, true);

    // When any real Teams tab is clicked, hide our panel
    tablist.querySelectorAll('button[role="tab"]').forEach(function (tab) {
      tab.addEventListener('click', function () {
        if (pickerRoot.classList.contains('gif-fav-picker-active')) {
          deactivateFavTab(pickerRoot, pickerContent);
        }
      });
    });

    var trailingDummy = tablist.querySelector('i[data-tabster-dummy]:last-child');
    if (trailingDummy) tablist.insertBefore(favTab, trailingDummy);
    else tablist.appendChild(favTab);
  }

  function injectWithRetry(pickerRoot, attemptsLeft) {
    if (!document.contains(pickerRoot)) return;
    if (attemptsLeft <= 0) {
      console.warn('[GifFav] Picker tablist never appeared — giving up');
      return;
    }
    var tablist = pickerRoot.querySelector('[role="tablist"]');
    var hasTabs = tablist && tablist.querySelector('button[role="tab"]');
    if (!hasTabs) {
      setTimeout(function () { injectWithRetry(pickerRoot, attemptsLeft - 1); }, 150);
      return;
    }
    injectFavTab(pickerRoot);
  }

  function tryInjectPicker() {
    var pickerRoot = GifFav.selectors.findPickerFlyout();
    if (!pickerRoot || pickerRoot.dataset.gifFavInjected) return;
    pickerRoot.dataset.gifFavInjected = '1';
    setTimeout(function () { injectWithRetry(pickerRoot, 10); }, 150);
  }

  function handleMutations(records) {
    for (var i = 0; i < records.length; i++) {
      if (records[i].addedNodes.length > 0) { tryInjectPicker(); return; }
    }
  }

  function init() {
    tryInjectPicker();
    observer = new MutationObserver(handleMutations);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function destroy() {
    if (observer) { observer.disconnect(); observer = null; }
  }

  return { init: init, destroy: destroy };
})();
