// src/lib/siteStyle.js
const pick = (id, list) => list[(Number(String(id).split('_')[1] || 0) || 0) % list.length];

/** Aplica um tema animado no site (Aurora, Nebula, Sunset, Matrix, Holo) */
export function applyThemeById(itemId) {
  const key = pick(itemId, ['aurora','nebula','sunset','matrix','holo']);
  document.documentElement.setAttribute('data-theme', key);
}

/** Aplica um estilo de borda global (Neon, Circuit, Auric, Glass, Prism) */
export function applyBorderById(itemId) {
  const key = pick(itemId, ['neon','circuit','auric','glass','prism']);
  document.documentElement.setAttribute('data-border', key);
}

/** Use quando entrar no app (pra reaplicar o equipado do usuário) */
export function bootApply({ themeId, borderId }) {
  if (themeId)  applyThemeById(themeId);
  if (borderId) applyBorderById(borderId);
}
