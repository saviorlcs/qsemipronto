// src/lib/siteStyle.js

// ---- injeta CSS (uma única vez) ----
let __injected = false;
function injectStylesOnce() {
  if (__injected) return;
  __injected = true;
  const css = `
/* === Avatar EFX (usado pelo SealAvatar) === */
.seal-avatar { isolation:isolate; }
.seal-avatar[data-orbit="slow"]::after,
.seal-avatar[data-orbit="fast"]::after {
  content:""; position:absolute; inset:-6px;
  border-radius:50%;
  border:2px dashed rgba(255,255,255,.25);
  animation: orbit 12s linear infinite;
}
.seal-avatar[data-orbit="fast"]::after { animation-duration:6s; }
@keyframes orbit { to { transform: rotate(360deg); } }

.seal-avatar[data-particles="sparks"]::before,
.seal-avatar[data-particles="stardust"]::before {
  content:""; position:absolute; inset:-10%;
  background:
    radial-gradient(circle, rgba(255,255,255,.8) 0 2px, transparent 3px) 0 0/20% 20%;
  opacity:.4; filter: blur(0.3px);
  animation: drift 8s linear infinite;
}
.seal-avatar[data-particles="stardust"]::before { opacity:.6; }
@keyframes drift { to { transform: translate3d(5%, -5%, 0); } }

.seal-aura {
  position:absolute; inset:-12px; border-radius:50%;
  background: conic-gradient(from 0deg, rgba(255,255,255,.15), transparent 70%);
  filter: blur(6px); z-index:-1;
}
.seal-trail {
  position:absolute; right:-12px; top:50%; width:18px; height:6px;
  background: linear-gradient(90deg, rgba(255,255,255,.6), transparent);
  border-radius:999px; transform: translateY(-50%);
  animation: trail 1.6s ease-in-out infinite;
}
@keyframes trail {
  0% { opacity:0; transform: translate(-10px,-50%); }
  40%{ opacity:1; }
  100%{ opacity:0; transform: translate(8px,-50%); }
}

/* === Bordas globais (se quiser mostrar uma borda animada no site todo) === */
:root { --border-thickness: 2px; }

html[data-border-anim="rainbow"] .bordered,
[data-border*="rainbow"] {
  position:relative; border-radius:16px;
}
html[data-border-anim="rainbow"] .bordered::before,
[data-border*="rainbow"]::before {
  content:""; position:absolute; inset:-2px; border-radius:inherit;
  background: conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  z-index:-1; filter: blur(1px); animation: spin 12s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* espessura de borda global opcional */
.bordered { border: var(--border-thickness) solid rgba(255,255,255,.12); }

/* === Temas reativos ao ciclo (focus/break) === */
html[data-cycle="focus"] .cycle-bg { filter: saturate(1.05) brightness(1.03); }
html[data-cycle="break"] .cycle-bg { filter: saturate(.95) brightness(.97); }

/* usar variáveis de accent (de applyThemeEffects) */
:root {
  --accent-0: #00b4d8;
  --accent-1: #111827;
}
.cycle-bg {
  background: radial-gradient(60% 100% at 50% 0%,
    color-mix(in hsl, var(--accent-0) 70%, transparent) 0%,
    transparent 60%),
  linear-gradient(180deg, color-mix(in hsl, var(--accent-1) 30%, #000) 0%, #000 100%);
}
  `.trim();

  const el = document.createElement('style');
  el.id = 'pomociclo-efx';
  el.textContent = css;
  document.head.appendChild(el);
}

// ---- helpers antigos (compat) ----
const pick = (id, list) => list[(Number(String(id).split('_')[1] || 0) || 0) % list.length];

/** Aplica um tema animado no site (Aurora, Nebula, Sunset, Matrix, Holo) */
export function applyThemeById(itemId) {
  injectStylesOnce();
  const key = pick(itemId, ['aurora','nebula','sunset','matrix','holo']);
  document.documentElement.setAttribute('data-theme', key);
}

/** Aplica um estilo de borda global (Neon, Circuit, Auric, Glass, Prism) */
export function applyBorderById(itemId) {
  injectStylesOnce();
  const key = pick(itemId, ['neon','circuit','auric','glass','prism']);
  document.documentElement.setAttribute('data-border', key);
}

/** Use quando entrar no app (pra reaplicar o equipado do usuário) */
export function bootApply({ themeId, borderId, themeEffects, borderEffects } = {}) {
  injectStylesOnce();
  if (themeId)  applyThemeById(themeId);
  if (borderId) applyBorderById(borderId);
  if (themeEffects)  applyThemeEffects(themeEffects);
  if (borderEffects) applyBorderEffects(borderEffects);
}

// ---- NOVOS: efeitos vindos do item equipado (server -> client) ----

/**
 * Aplica os efeitos de um "tema" equipado.
 * Espera um objeto como veio do backend:
 *   { palette: [primary, bg?], bg: "cycle-reactive"|"parallax"|..., celebrate_milestones?: true }
 */
export function applyThemeEffects(effects) {
  injectStylesOnce();
  const root = document.documentElement;
  if (!effects) return;

  // Paleta → CSS vars
  if (Array.isArray(effects.palette) && effects.palette.length) {
    root.style.setProperty('--accent-0', effects.palette[0]);
    root.style.setProperty('--accent-1', effects.palette[1] || effects.palette[0]);
  }

  // Modo de fundo
  if (effects.bg) {
    root.setAttribute('data-theme-mode', effects.bg);
  } else {
    root.removeAttribute('data-theme-mode');
  }

  // Flags opcionais
  if (effects.celebrate_milestones) {
    root.setAttribute('data-celebrate', 'on');
  } else {
    root.removeAttribute('data-celebrate');
  }
}


/**
 * Aplica os efeitos de uma "borda" equipada.
 * Ex.: { animated: "rainbow"|"pulse", thickness: 3, accent_color_sync: true }
 */
export function applyBorderEffects(eff) {
  injectStylesOnce();
  const root = document.documentElement;
  if (!eff) {
    root.removeAttribute('data-border-anim');
    root.style.removeProperty('--border-thickness');
    return;
  }
  if (eff.animated) root.setAttribute('data-border-anim', eff.animated);
  else root.removeAttribute('data-border-anim');

  if (typeof eff.thickness === 'number') {
    root.style.setProperty('--border-thickness', `${eff.thickness}px`);
  }
}

/**
 * Controla o estado do ciclo para temas "cycle-reactive".
 * state: "focus" | "break" | null
 */
export function setCycleState(state) {
  injectStylesOnce();
  const root = document.documentElement;
  if (state === 'focus' || state === 'break') root.setAttribute('data-cycle', state);
  else root.removeAttribute('data-cycle');
}
