(function () {
  var params = new URLSearchParams(window.location.search);
  var bookUrl = params.get('url');
  var isLocal = params.get('local') === '1';
  var book = null;
  var rendition = null;
  var currentFontSize = parseInt(localStorage.getItem('epubFontSize') || '100', 10);
  var currentTheme = localStorage.getItem('epubTheme') || 'light';
  var currentFlow = localStorage.getItem('epubFlow') || 'paginated';

  // Elements
  var viewer = document.getElementById('viewer');
  var prevBtn = document.getElementById('prev-btn');
  var nextBtn = document.getElementById('next-btn');
  var locationInfo = document.getElementById('location-info');
  var bookTitleEl = document.getElementById('book-title');
  var loadingOverlay = document.getElementById('loading-overlay');
  var tocEl = document.getElementById('toc');
  var tocMobileEl = document.getElementById('toc-mobile');
  var fontDecreaseBtn = document.getElementById('font-decrease');
  var fontIncreaseBtn = document.getElementById('font-increase');
  var fontSizeDisplay = document.getElementById('font-size-display');
  var bookInfoEl = document.getElementById('book-info');
  var bookMetaEl = document.getElementById('book-meta');
  var bookStatsEl = document.getElementById('book-stats');
  var localFilePicker = document.getElementById('local-file-picker');

  // Initialize
  if (isLocal) {
    // Show a prompt overlay instead of relying on programmatic click
    loadingOverlay.innerHTML =
      '<div class="text-center">' +
        '<div class="loading-book"><div class="book-animation">' +
          '<div class="book-page"></div><div class="book-page"></div><div class="book-page"></div>' +
        '</div></div>' +
        '<p class="mt-4 loading-text">Select your EPUB file to begin</p>' +
        '<button id="pick-file-btn" style="margin-top:1rem;background:linear-gradient(135deg,#1e3a5f,#2d5a8e);' +
          'color:#fff;border:none;padding:0.6rem 1.5rem;border-radius:8px;font-size:0.9rem;font-weight:500;cursor:pointer;">' +
          '<i class="bi bi-folder2-open me-2"></i>Choose File</button>' +
      '</div>';
    document.getElementById('pick-file-btn').addEventListener('click', function () {
      localFilePicker.click();
    });
    localFilePicker.addEventListener('change', function () {
      if (localFilePicker.files.length > 0) {
        loadingOverlay.innerHTML =
          '<div class="text-center">' +
            '<div class="loading-book"><div class="book-animation">' +
              '<div class="book-page"></div><div class="book-page"></div><div class="book-page"></div>' +
            '</div></div>' +
            '<p class="mt-4 loading-text">Opening your book...</p>' +
          '</div>';
        var reader = new FileReader();
        reader.onload = function (e) {
          initBook(e.target.result);
        };
        reader.readAsArrayBuffer(localFilePicker.files[0]);
        bookTitleEl.textContent = localFilePicker.files[0].name.replace('.epub', '');
      } else {
        window.location.href = '/';
      }
    });
  } else if (bookUrl) {
    initBook(bookUrl);
  } else {
    window.location.href = '/';
  }

  // Get pixel dimensions for the viewer
  function getViewerSize() {
    var rect = viewer.getBoundingClientRect();
    return { width: Math.floor(rect.width), height: Math.floor(rect.height) };
  }

  function createRendition(flow) {
    var size = getViewerSize();
    var r = book.renderTo(viewer, {
      flow: flow,
      width: size.width,
      height: size.height,
      spread: 'none',
      allowScriptedContent: true
    });
    return r;
  }

  function setupRendition(r) {
    registerThemes(r);
    r.themes.fontSize(currentFontSize + '%');
    r.themes.select(currentTheme);

    r.on('relocated', function (location) {
      if (bookUrl && location.start && location.start.cfi) {
        localStorage.setItem('epub-loc-' + bookUrl, location.start.cfi);
      }
      updateLocationDisplay(location);
    });

    r.on('keydown', handleKeyboard);
  }

  function initBook(source) {
    book = ePub(source);
    window._epubBook = book; // expose for analysis
    rendition = createRendition(currentFlow);
    setupRendition(rendition);

    applyPageTheme(currentTheme);
    updateFontSizeDisplay();
    updateThemeButtons();
    updateFlowButtons();

    // Display
    var savedLocation = bookUrl ? localStorage.getItem('epub-loc-' + bookUrl) : null;
    if (savedLocation) {
      rendition.display(savedLocation);
    } else {
      rendition.display();
    }

    // Book ready
    book.ready.then(function () {
      loadingOverlay.style.display = 'none';
      return book.locations.generate(1024);
    }).then(function () {
      updateLocationDisplay(rendition.currentLocation());
      computeBookStats();
    });

    // Metadata
    book.loaded.metadata.then(function (meta) {
      if (meta.title) {
        bookTitleEl.textContent = meta.title;
        document.title = meta.title + ' - EPUB Viewer';
      }
      showBookInfo(meta);
    });

    // TOC
    book.loaded.navigation.then(function (nav) {
      buildToc(nav.toc, tocEl, 0);
      buildToc(nav.toc, tocMobileEl, 0);
    });

    // Handle window resize
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (rendition) {
          var size = getViewerSize();
          rendition.resize(size.width, size.height);
        }
      }, 250);
    });
  }

  // Location display
  function updateLocationDisplay(location) {
    if (!location || !location.start) {
      locationInfo.textContent = '-';
      return;
    }

    var parts = [];
    var percent = book.locations.percentageFromCfi(location.start.cfi);
    if (!isNaN(percent)) {
      parts.push(Math.round(percent * 100) + '%');
    }

    // Show page of total if locations are available
    var totalPages = book.locations.length();
    if (totalPages > 0) {
      var currentPage = book.locations.locationFromCfi(location.start.cfi);
      if (currentPage !== undefined && currentPage !== null) {
        parts.push('Page ' + (currentPage + 1) + ' of ' + totalPages);
      }
    }

    locationInfo.textContent = parts.join('  |  ') || '-';
  }

  // Book stats — word count, chapter count, estimated reading time
  function computeBookStats() {
    var spineItems = book.spine.spineItems || book.spine.items || [];
    var totalWords = 0;
    var sectionCount = spineItems.length;
    var processed = 0;

    if (sectionCount === 0) return;

    spineItems.forEach(function (section) {
      section.load(book.load.bind(book)).then(function (contents) {
        // contents is documentElement (not a full Document)
        var text = '';
        if (contents) {
          text = contents.textContent || '';
        }
        var words = text.trim().split(/\s+/).filter(function (w) { return w.length > 0; });
        totalWords += words.length;
        processed++;

        if (processed === sectionCount) {
          displayBookStats(totalWords, sectionCount);
        }
      }).catch(function (err) {
        console.warn('Failed to load section:', err);
        processed++;
        if (processed === sectionCount) {
          displayBookStats(totalWords, sectionCount);
        }
      });
    });
  }

  function displayBookStats(wordCount, sectionCount) {
    var readingMinutes = Math.ceil(wordCount / 250); // avg 250 wpm
    var hours = Math.floor(readingMinutes / 60);
    var mins = readingMinutes % 60;
    var readingTime = hours > 0 ? hours + 'h ' + mins + 'm' : mins + ' min';

    var totalPages = book.locations.length();

    var statsHtml = '';
    statsHtml += '<strong>Words:</strong> ' + wordCount.toLocaleString() + '<br>';
    if (totalPages > 0) {
      statsHtml += '<strong>Pages:</strong> ~' + totalPages + '<br>';
    }
    statsHtml += '<strong>Sections:</strong> ' + sectionCount + '<br>';
    statsHtml += '<strong>Est. Reading Time:</strong> ' + readingTime;

    bookStatsEl.innerHTML = statsHtml;
    bookStatsEl.parentElement.classList.remove('d-none');
  }

  // TOC builder
  function buildToc(items, container, level) {
    items.forEach(function (item) {
      var el = document.createElement('a');
      el.className = 'list-group-item list-group-item-action';
      el.textContent = item.label.trim();
      el.href = '#';
      if (level > 0) {
        el.style.paddingLeft = (1 + level) + 'rem';
        el.style.fontSize = '0.85rem';
      }
      el.addEventListener('click', function (e) {
        e.preventDefault();
        rendition.display(item.href);
        var offcanvasEl = document.getElementById('toc-offcanvas');
        var offcanvas = bootstrap.Offcanvas.getInstance(offcanvasEl);
        if (offcanvas) offcanvas.hide();
      });
      container.appendChild(el);

      if (item.subitems && item.subitems.length > 0) {
        buildToc(item.subitems, container, level + 1);
      }
    });
  }

  // Theme registration
  function registerThemes(r) {
    r.themes.register('light', {
      'body': { 'background': '#ffffff', 'color': '#212529' },
      'a': { 'color': '#0d6efd' }
    });
    r.themes.register('sepia', {
      'body': { 'background': '#f4ecd8', 'color': '#5b4636' },
      'a': { 'color': '#8b6914' }
    });
    r.themes.register('dark', {
      'body': { 'background': '#1a1a2e', 'color': '#e0e0e0' },
      'a': { 'color': '#6ea8fe' }
    });
  }

  function applyPageTheme(theme) {
    document.body.classList.remove('theme-light', 'theme-sepia', 'theme-dark');
    if (theme !== 'light') {
      document.body.classList.add('theme-' + theme);
    }
  }

  // Navigation
  prevBtn.addEventListener('click', function () {
    if (rendition) rendition.prev();
  });

  nextBtn.addEventListener('click', function () {
    if (rendition) rendition.next();
  });

  // Keyboard
  document.addEventListener('keydown', handleKeyboard);

  function handleKeyboard(e) {
    if (e.key === 'ArrowLeft') {
      if (rendition) rendition.prev();
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      if (rendition) rendition.next();
      e.preventDefault();
    }
  }

  // Font size
  fontDecreaseBtn.addEventListener('click', function () {
    if (currentFontSize > 60) {
      currentFontSize -= 10;
      applyFontSize();
    }
  });

  fontIncreaseBtn.addEventListener('click', function () {
    if (currentFontSize < 200) {
      currentFontSize += 10;
      applyFontSize();
    }
  });

  function applyFontSize() {
    if (rendition) rendition.themes.fontSize(currentFontSize + '%');
    localStorage.setItem('epubFontSize', currentFontSize);
    updateFontSizeDisplay();
  }

  function updateFontSizeDisplay() {
    fontSizeDisplay.textContent = currentFontSize + '%';
  }

  // Theme buttons
  document.querySelectorAll('.theme-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      currentTheme = btn.dataset.theme;
      if (rendition) rendition.themes.select(currentTheme);
      applyPageTheme(currentTheme);
      localStorage.setItem('epubTheme', currentTheme);
      updateThemeButtons();
    });
  });

  function updateThemeButtons() {
    document.querySelectorAll('.theme-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.theme === currentTheme);
    });
  }

  // Flow mode buttons
  document.querySelectorAll('.flow-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      currentFlow = btn.dataset.flow;
      localStorage.setItem('epubFlow', currentFlow);
      updateFlowButtons();
      if (book) {
        var currentLocation = rendition.currentLocation();
        var cfi = currentLocation && currentLocation.start ? currentLocation.start.cfi : null;
        rendition.destroy();
        rendition = createRendition(currentFlow);
        setupRendition(rendition);
        if (cfi) {
          rendition.display(cfi);
        } else {
          rendition.display();
        }
      }
    });
  });

  function updateFlowButtons() {
    document.querySelectorAll('.flow-btn').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.flow === currentFlow);
    });
  }

  // Book info
  function showBookInfo(meta) {
    var info = [];
    if (meta.title) info.push('<strong>Title:</strong> ' + escapeHtml(meta.title));
    if (meta.creator) info.push('<strong>Author:</strong> ' + escapeHtml(meta.creator));
    if (meta.publisher) info.push('<strong>Publisher:</strong> ' + escapeHtml(meta.publisher));
    if (meta.language) info.push('<strong>Language:</strong> ' + escapeHtml(meta.language));
    if (meta.pubdate) info.push('<strong>Published:</strong> ' + escapeHtml(meta.pubdate));

    if (info.length > 0) {
      bookInfoEl.classList.remove('d-none');
      bookMetaEl.innerHTML = info.join('<br>');
    }
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
