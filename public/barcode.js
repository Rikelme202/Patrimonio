// Gerador de Code 128 (subconjunto B) em SVG — sem dependências.
(function () {
  const P = ["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232"];
  const STOP = "2331112";

  function code128(text) {
    const codes = [104]; // Start B
    let sum = 104;
    [...text].forEach((ch, i) => {
      const v = ch.charCodeAt(0) - 32;
      if (v < 0 || v > 94) throw new Error('Caractere não suportado: ' + ch);
      codes.push(v); sum += v * (i + 1);
    });
    codes.push(sum % 103);
    return codes.map(c => P[c]).join('') + STOP;
  }

  // Retorna string SVG (largura adaptável via viewBox).
  window.barcodeSVG = function (text) {
    let pat;
    try { pat = code128(text); } catch { return '<svg xmlns="http://www.w3.org/2000/svg"></svg>'; }
    const quiet = 10; let x = quiet, bars = '';
    [...pat].forEach((w, i) => {
      const n = Number(w);
      if (i % 2 === 0) bars += `<rect x="${x}" y="0" width="${n}" height="60"/>`;
      x += n;
    });
    const W = x + quiet;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} 60" preserveAspectRatio="none" shape-rendering="crispEdges"><rect width="${W}" height="60" fill="#fff"/><g fill="#000">${bars}</g></svg>`;
  };
  window.__code128 = code128;
})();
