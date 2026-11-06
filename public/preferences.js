// Applies this phone's reading preferences before first paint, so nothing flashes. A file rather
// than an inline script so the Content-Security-Policy can refuse every inline script.
try {
  var p = JSON.parse(localStorage.getItem('cuisine.preferences') || '{}');
  var d = document.documentElement;
  d.dataset.theme = p.theme || 'auto';
  d.dataset.font = p.font || 'serif';
  d.dataset.size = p.size || 'm';
} catch {}
