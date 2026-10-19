// SENTINEL - DOM Utilities & Zero-XSS Sanitization
// Blindaje de inyección DOM y escape seguro de caracteres

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function setSafeHtml(element, htmlContent) {
  if (!element) return;
  element.replaceChildren();
  if (!htmlContent) return;
  if (typeof DOMParser !== 'undefined') {
    const parsed = new DOMParser().parseFromString(htmlContent, 'text/html');
    while (parsed.body.firstChild) {
      element.appendChild(parsed.body.firstChild);
    }
  } else {
    element.innerHTML = htmlContent;
  }
}

function appendSafeHtml(element, htmlContent) {
  if (!element || !htmlContent) return;
  if (typeof DOMParser !== 'undefined') {
    const parsed = new DOMParser().parseFromString(htmlContent, 'text/html');
    while (parsed.body.firstChild) {
      element.appendChild(parsed.body.firstChild);
    }
  } else {
    element.innerHTML += htmlContent;
  }
}

// Exportación universal (Browser window + Node.js para testing)
if (typeof window !== 'undefined') {
  window.escapeHtml = escapeHtml;
  window.setSafeHtml = setSafeHtml;
  window.appendSafeHtml = appendSafeHtml;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    escapeHtml,
    setSafeHtml,
    appendSafeHtml
  };
}
