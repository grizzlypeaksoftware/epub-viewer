var dropZone = document.getElementById('drop-zone');
var fileInput = document.getElementById('file-input');
var progressEl = document.getElementById('upload-progress');
var errorEl = document.getElementById('upload-error');
var recentBooksEl = document.getElementById('recent-books');
var recentListEl = document.getElementById('recent-list');
var openLocalBtn = document.getElementById('open-local-btn');
var localFileInput = document.getElementById('local-file-input');

// Click to browse
dropZone.addEventListener('click', function () {
  fileInput.click();
});

fileInput.addEventListener('change', function () {
  if (fileInput.files.length > 0) {
    uploadFile(fileInput.files[0]);
  }
});

// Drag and drop
dropZone.addEventListener('dragenter', function (e) {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragover', function (e) {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', function () {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', function (e) {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length > 0) {
    uploadFile(e.dataTransfer.files[0]);
  }
});

// Upload file to server
function uploadFile(file) {
  if (!file.name.toLowerCase().endsWith('.epub')) {
    showError('Please select an .epub file');
    return;
  }

  errorEl.classList.add('d-none');
  progressEl.classList.remove('d-none');

  var formData = new FormData();
  formData.append('book', file);

  fetch('/api/upload', {
    method: 'POST',
    body: formData
  })
    .then(function (res) {
      if (!res.ok) return res.json().then(function (d) { throw new Error(d.error); });
      return res.json();
    })
    .then(function (data) {
      addToRecent(file.name, data.url);
      window.location.href = '/reader.html?url=' + encodeURIComponent(data.url);
    })
    .catch(function (err) {
      progressEl.classList.add('d-none');
      showError(err.message || 'Upload failed');
    });
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.classList.remove('d-none');
}

// Open locally without uploading
openLocalBtn.addEventListener('click', function () {
  localFileInput.click();
});

localFileInput.addEventListener('change', function () {
  if (localFileInput.files.length > 0) {
    var file = localFileInput.files[0];
    if (!file.name.toLowerCase().endsWith('.epub')) {
      showError('Please select an .epub file');
      return;
    }
    // Reader page will re-prompt for the file via its own file picker
    window.location.href = '/reader.html?local=1';
  }
});

// Recent books (localStorage)
function addToRecent(name, url) {
  var recent = JSON.parse(localStorage.getItem('recentBooks') || '[]');
  recent = recent.filter(function (b) { return b.url !== url; });
  recent.unshift({ name: name, url: url, date: new Date().toISOString() });
  if (recent.length > 10) recent = recent.slice(0, 10);
  localStorage.setItem('recentBooks', JSON.stringify(recent));
}

function loadRecent() {
  var recent = JSON.parse(localStorage.getItem('recentBooks') || '[]');
  if (recent.length === 0) return;

  recentBooksEl.classList.remove('d-none');
  recentListEl.innerHTML = '';

  recent.forEach(function (book) {
    var li = document.createElement('li');
    li.className = 'list-group-item d-flex justify-content-between align-items-center';

    var link = document.createElement('a');
    link.href = '/reader.html?url=' + encodeURIComponent(book.url);
    link.textContent = book.name;
    link.className = 'text-decoration-none';

    var date = document.createElement('small');
    date.className = 'text-muted';
    date.textContent = new Date(book.date).toLocaleDateString();

    li.appendChild(link);
    li.appendChild(date);
    recentListEl.appendChild(li);
  });
}

loadRecent();
