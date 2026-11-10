// Aplica o tema antes de desenhar a página (evita "piscar" ao abrir no escuro).
(function () {
  var t = null;
  try { t = localStorage.getItem('theme'); } catch (e) { /* sem acesso */ }
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
})();
