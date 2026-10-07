/* Donde va la tarjeta del tour respecto al elemento destacado. Aparte de demo.js
   para poder probarlo en node (js/demo.test.js): entra el hueco del foco, el
   tamano del marco, el lado pedido y el tamano de la tarjeta; sale donde pintarla
   y hacia donde mira la flecha. Script clasico: `const` de arriba compartido con
   demo.js, que se carga despues. */
const OPUESTO = { top: "bottom", bottom: "top", left: "right", right: "left" };
const acota = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));
// Dónde va la tarjeta: en el lado pedido si cabe, si no en el opuesto, y siempre dentro del marco (js/demo.test.js)
const colocaTarjeta = (foco, cuadro, lado, tam, hueco = 14, margen = 12) => {
  const sitio = { top: foco.y, bottom: cuadro.height - (foco.y + foco.height), left: foco.x, right: cuadro.width - (foco.x + foco.width) };
  const pide = (l) => (l === "top" || l === "bottom" ? tam.height : tam.width) + hueco + margen;
  if (sitio[lado] < pide(lado)) lado = sitio[OPUESTO[lado]] >= pide(OPUESTO[lado]) ? OPUESTO[lado] : Object.keys(sitio).reduce((a, b) => (sitio[a] - pide(a) >= sitio[b] - pide(b) ? a : b));
  const cx = foco.x + foco.width / 2, cy = foco.y + foco.height / 2;
  let x, y;
  if (lado === "top" || lado === "bottom") { x = cx - tam.width / 2; y = lado === "top" ? foco.y - hueco - tam.height : foco.y + foco.height + hueco; }
  else { y = cy - tam.height / 2; x = lado === "left" ? foco.x - hueco - tam.width : foco.x + foco.width + hueco; }
  x = acota(x, margen, cuadro.width - tam.width - margen); y = acota(y, margen, cuadro.height - tam.height - margen);
  const flecha = lado === "top" || lado === "bottom" ? acota(cx - x, 18, tam.width - 18) : acota(cy - y, 18, tam.height - 18);
  return { x, y, lado, flecha };
};
