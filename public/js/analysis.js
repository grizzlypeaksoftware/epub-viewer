(function () {
  var runBtn = document.getElementById('run-analysis-btn');
  var contentEl = document.getElementById('analysis-content');
  var analyzeNavBtn = document.getElementById('analyze-btn');
  var analysisRan = false;

  if (!runBtn) return;

  runBtn.addEventListener('click', function () {
    if (!window._epubBook) return;
    runAnalysis(window._epubBook);
  });

  function runAnalysis(book) {
    analysisRan = true;
    analyzeNavBtn.classList.add('analyzing');

    contentEl.innerHTML =
      '<div class="analysis-loading">' +
        '<div class="spinner-border" role="status"><span class="visually-hidden">Analyzing...</span></div>' +
        '<p>Analyzing your book...</p>' +
      '</div>';

    var spineItems = book.spine.spineItems || book.spine.items || [];
    var chapters = [];
    var allText = '';
    var allSentences = [];
    var processed = 0;
    var total = spineItems.length;

    if (total === 0) {
      analyzeNavBtn.classList.remove('analyzing');
      contentEl.innerHTML = '<div class="analysis-placeholder"><i class="bi bi-exclamation-circle"></i><p>Could not read book content for analysis.</p></div>';
      return;
    }

    spineItems.forEach(function (section, idx) {
      section.load(book.load.bind(book)).then(function (contents) {
        // contents is documentElement (not a full Document)
        var text = '';
        if (contents) {
          text = contents.textContent || '';
        }
        var cleanText = text.replace(/\s+/g, ' ').trim();
        chapters.push({ index: idx, text: cleanText, label: 'Section ' + (idx + 1) });
        allText += ' ' + cleanText;

        // Extract sentences
        var sentences = cleanText.match(/[^.!?]+[.!?]+/g) || [];
        sentences.forEach(function (s) {
          allSentences.push({ text: s.trim(), chapter: idx });
        });

        processed++;
        if (processed === total) {
          chapters.sort(function (a, b) { return a.index - b.index; });
          performAnalysis(chapters, allText.trim(), allSentences, book);
        }
      }).catch(function (err) {
        console.warn('Analysis: failed to load section', idx, err);
        processed++;
        if (processed === total) {
          chapters.sort(function (a, b) { return a.index - b.index; });
          performAnalysis(chapters, allText.trim(), allSentences, book);
        }
      });
    });
  }

  function performAnalysis(chapters, fullText, sentences, book) {
    var words = fullText.split(/\s+/).filter(function (w) { return w.length > 0; });
    var wordCount = words.length;
    var sentenceCount = sentences.length;
    var avgWordsPerSentence = sentenceCount > 0 ? (wordCount / sentenceCount) : 0;

    // Paragraph estimation (split by double spaces or long gaps)
    var paragraphs = fullText.split(/\n\s*\n|\.\s{2,}/).filter(function (p) { return p.trim().length > 20; });
    var avgWordsPerParagraph = paragraphs.length > 0 ? Math.round(wordCount / paragraphs.length) : 0;

    // Readability: Flesch-Kincaid Grade Level
    var syllableCount = countSyllables(words);
    var fkGrade = fleschKincaidGrade(wordCount, sentenceCount, syllableCount);
    var fkEase = fleschReadingEase(wordCount, sentenceCount, syllableCount);
    var gunningFog = gunningFogIndex(words, sentenceCount);

    // Chapter word counts
    var chapterWordCounts = chapters.map(function (ch) {
      var w = ch.text.split(/\s+/).filter(function (w) { return w.length > 0; });
      return { label: ch.label, words: w.length };
    }).filter(function (ch) { return ch.words > 50; }); // filter out tiny front/back matter

    // Word frequency (excluding common stop words)
    var freqMap = getWordFrequency(words);
    var topWords = Object.keys(freqMap)
      .map(function (w) { return { word: w, count: freqMap[w] }; })
      .sort(function (a, b) { return b.count - a.count; })
      .slice(0, 20);

    // Long sentences (> 40 words)
    var longSentences = sentences
      .map(function (s) {
        var wc = s.text.split(/\s+/).length;
        return { text: s.text, words: wc, chapter: s.chapter };
      })
      .filter(function (s) { return s.words > 40; })
      .sort(function (a, b) { return b.words - a.words; })
      .slice(0, 10);

    // Dialogue ratio
    var dialogueMatches = fullText.match(/[""\u201C\u201D][^""\u201C\u201D]{5,}[""\u201C\u201D]/g) || [];
    var dialogueWords = dialogueMatches.join(' ').split(/\s+/).length;
    var dialoguePercent = wordCount > 0 ? Math.round((dialogueWords / wordCount) * 100) : 0;

    // Render results
    analyzeNavBtn.classList.remove('analyzing');
    renderResults({
      wordCount: wordCount,
      sentenceCount: sentenceCount,
      avgWordsPerSentence: avgWordsPerSentence,
      avgWordsPerParagraph: avgWordsPerParagraph,
      fkGrade: fkGrade,
      fkEase: fkEase,
      gunningFog: gunningFog,
      chapterWordCounts: chapterWordCounts,
      topWords: topWords,
      longSentences: longSentences,
      dialoguePercent: dialoguePercent,
      readingTime: Math.ceil(wordCount / 250)
    });
  }

  // Flesch-Kincaid Grade Level
  function fleschKincaidGrade(words, sentences, syllables) {
    if (sentences === 0 || words === 0) return 0;
    return (0.39 * (words / sentences)) + (11.8 * (syllables / words)) - 15.59;
  }

  // Flesch Reading Ease
  function fleschReadingEase(words, sentences, syllables) {
    if (sentences === 0 || words === 0) return 0;
    return 206.835 - (1.015 * (words / sentences)) - (84.6 * (syllables / words));
  }

  // Gunning Fog Index
  function gunningFogIndex(words, sentenceCount) {
    if (sentenceCount === 0) return 0;
    var complexWords = words.filter(function (w) { return countWordSyllables(w) >= 3; }).length;
    return 0.4 * ((words.length / sentenceCount) + 100 * (complexWords / words.length));
  }

  // Syllable counting
  function countSyllables(words) {
    var total = 0;
    words.forEach(function (w) { total += countWordSyllables(w); });
    return total;
  }

  function countWordSyllables(word) {
    word = word.toLowerCase().replace(/[^a-z]/g, '');
    if (word.length <= 3) return 1;
    word = word.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '');
    word = word.replace(/^y/, '');
    var matches = word.match(/[aeiouy]{1,2}/g);
    return matches ? matches.length : 1;
  }

  // Stop words for frequency analysis
  var STOP_WORDS = new Set([
    'the','be','to','of','and','a','in','that','have','i','it','for','not','on','with',
    'he','as','you','do','at','this','but','his','by','from','they','we','say','her',
    'she','or','an','will','my','one','all','would','there','their','what','so','up',
    'out','if','about','who','get','which','go','me','when','make','can','like','time',
    'no','just','him','know','take','people','into','year','your','good','some','could',
    'them','see','other','than','then','now','look','only','come','its','over','think',
    'also','back','after','use','two','how','our','work','first','well','way','even',
    'new','want','because','any','these','give','day','most','us','was','were','been',
    'had','has','are','is','am','did','does','done','said','very','much','more','own',
    'down','should','still','each','before','must','through','being','both','those',
    'same','where','while','such','here','between','may','many','too','without','man',
    'never','long','upon','every','made','around','another','away','again','off','went',
    'came','right','hand','old','going','thing','got','left','nothing','once'
  ]);

  function getWordFrequency(words) {
    var freq = {};
    words.forEach(function (w) {
      var clean = w.toLowerCase().replace(/[^a-z']/g, '');
      if (clean.length < 4 || STOP_WORDS.has(clean)) return;
      freq[clean] = (freq[clean] || 0) + 1;
    });
    return freq;
  }

  // Readability level description
  function easeDescription(score) {
    if (score >= 90) return 'Very Easy (5th grade)';
    if (score >= 80) return 'Easy (6th grade)';
    if (score >= 70) return 'Fairly Easy (7th grade)';
    if (score >= 60) return 'Standard (8th-9th grade)';
    if (score >= 50) return 'Fairly Difficult (10th-12th)';
    if (score >= 30) return 'Difficult (College)';
    return 'Very Difficult (Graduate)';
  }

  function easeColor(score) {
    if (score >= 70) return '#059669';
    if (score >= 50) return '#d97706';
    return '#dc2626';
  }

  // Render the analysis results
  function renderResults(data) {
    var html = '';

    // Readability Scores
    html += '<div class="analysis-section">';
    html += '<div class="analysis-section-title"><i class="bi bi-speedometer2"></i> Readability</div>';
    html += '<div class="score-grid">';
    html += scoreCard('Flesch Ease', Math.round(data.fkEase), easeDescription(data.fkEase), easeColor(data.fkEase));
    html += scoreCard('FK Grade', data.fkGrade.toFixed(1), 'Grade level', '#1e3a5f');
    html += scoreCard('Gunning Fog', data.gunningFog.toFixed(1), 'Years of education', '#1e3a5f');
    html += scoreCard('Dialogue', data.dialoguePercent + '%', 'of text is dialogue', '#1e3a5f');
    html += '</div>';
    html += '</div>';

    // Writing Stats
    html += '<div class="analysis-section">';
    html += '<div class="analysis-section-title"><i class="bi bi-pencil"></i> Writing Stats</div>';
    html += '<div class="score-grid">';
    html += scoreCard('Words', data.wordCount.toLocaleString(), data.readingTime + ' min read');
    html += scoreCard('Sentences', data.sentenceCount.toLocaleString(), 'Avg ' + data.avgWordsPerSentence.toFixed(1) + ' words each');
    html += '</div>';
    html += '</div>';

    // Chapter Balance
    if (data.chapterWordCounts.length > 1) {
      html += '<div class="analysis-section">';
      html += '<div class="analysis-section-title"><i class="bi bi-bar-chart-steps"></i> Chapter Length</div>';
      html += renderChapterBars(data.chapterWordCounts);
      html += '</div>';
    }

    // Top Words
    if (data.topWords.length > 0) {
      html += '<div class="analysis-section">';
      html += '<div class="analysis-section-title"><i class="bi bi-chat-quote"></i> Most Used Words</div>';
      html += renderWordFrequency(data.topWords);
      html += '</div>';
    }

    // Long Sentences
    if (data.longSentences.length > 0) {
      html += '<div class="analysis-section">';
      html += '<div class="analysis-section-title"><i class="bi bi-exclamation-triangle"></i> Long Sentences (' + data.longSentences.length + ')</div>';
      data.longSentences.forEach(function (s) {
        var preview = s.text.length > 120 ? s.text.substring(0, 120) + '...' : s.text;
        html += '<div class="long-sentence-item">';
        html += '<div class="sentence-meta">' + s.words + ' words &middot; Section ' + (s.chapter + 1) + '</div>';
        html += escapeHtml(preview);
        html += '</div>';
      });
      html += '</div>';
    }

    // Re-run button
    html += '<div class="mt-3">';
    html += '<button id="rerun-analysis-btn" class="btn-analyze"><i class="bi bi-arrow-clockwise"></i> Re-run Analysis</button>';
    html += '</div>';

    contentEl.innerHTML = html;

    // Bind rerun
    var rerunBtn = document.getElementById('rerun-analysis-btn');
    if (rerunBtn) {
      rerunBtn.addEventListener('click', function () {
        if (window._epubBook) runAnalysis(window._epubBook);
      });
    }
  }

  function scoreCard(label, value, desc, color) {
    var c = color || '#1e3a5f';
    return '<div class="score-card">' +
      '<div class="score-label">' + label + '</div>' +
      '<div class="score-value" style="color:' + c + '">' + value + '</div>' +
      (desc ? '<div class="score-desc">' + desc + '</div>' : '') +
      '</div>';
  }

  function renderChapterBars(chapters) {
    var max = Math.max.apply(null, chapters.map(function (c) { return c.words; }));
    var html = '<div class="chapter-bars">';
    chapters.forEach(function (ch) {
      var pct = max > 0 ? Math.max((ch.words / max) * 100, 4) : 4;
      html += '<div class="chapter-bar" style="height:' + pct + '%">';
      html += '<div class="chapter-bar-tooltip">' + ch.label + ': ' + ch.words.toLocaleString() + ' words</div>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  function renderWordFrequency(words) {
    var maxCount = words[0].count;
    var html = '<ul class="word-freq-list">';
    words.forEach(function (w) {
      var barWidth = Math.max((w.count / maxCount) * 100, 5);
      html += '<li class="word-freq-item">';
      html += '<div style="flex:1"><span class="word">' + escapeHtml(w.word) + '</span>';
      html += '<div class="word-freq-bar" style="width:' + barWidth + '%"></div></div>';
      html += '<span class="count">' + w.count + '</span>';
      html += '</li>';
    });
    html += '</ul>';
    return html;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
})();
