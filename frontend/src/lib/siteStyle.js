// src/lib/siteStyle.js - SISTEMA DE EFEITOS VISUAIS INCRÍVEIS

let __injected = false;

function injectStylesOnce() {
  if (__injected) return;
  __injected = true;
  
  const css = `
/* ============================================ */
/*          AVATAR/SELO EFFECTS                */
/* ============================================ */

.seal-avatar { 
  isolation: isolate; 
  position: relative;
}

/* ÓRBITAS (Rare+) */
.seal-avatar[data-orbit="slow"]::after,
.seal-avatar[data-orbit="medium"]::after,
.seal-avatar[data-orbit="fast"]::after {
  content: ""; 
  position: absolute; 
  inset: -8px;
  border-radius: 50%;
  border: 2px dashed rgba(255,255,255,.3);
  animation: orbit 16s linear infinite;
  pointer-events: none;
}
.seal-avatar[data-orbit="medium"]::after { 
  animation-duration: 10s; 
  border-width: 2.5px;
  border-color: rgba(255,255,255,.4);
}
.seal-avatar[data-orbit="fast"]::after { 
  animation-duration: 6s;
  border-width: 3px;
  border-color: rgba(255,255,255,.5);
  box-shadow: 0 0 10px rgba(255,255,255,.3);
}
@keyframes orbit { 
  to { transform: rotate(360deg); } 
}

/* PARTÍCULAS (Rare+) */
.seal-avatar[data-particles="sparks"]::before {
  content: "";
  position: absolute;
  inset: -12%;
  background: 
    radial-gradient(circle, rgba(255,255,255,.7) 0 1.5px, transparent 2px) 0 0/18% 18%,
    radial-gradient(circle, rgba(255,200,100,.6) 0 1px, transparent 1.5px) 5% 5%/15% 15%;
  opacity: .5;
  filter: blur(0.3px);
  animation: drift-sparks 10s linear infinite;
  pointer-events: none;
}

.seal-avatar[data-particles="stardust"]::before {
  content: "";
  position: absolute;
  inset: -15%;
  background:
    radial-gradient(circle, rgba(255,255,255,.9) 0 2px, transparent 3px) 0 0/12% 12%,
    radial-gradient(circle, rgba(200,220,255,.7) 0 1.5px, transparent 2.5px) 3% 3%/10% 10%,
    radial-gradient(circle, rgba(255,255,200,.6) 0 1px, transparent 2px) 7% 7%/15% 15%;
  opacity: .7;
  filter: blur(0.4px);
  animation: drift-stardust 12s linear infinite;
  pointer-events: none;
}

.seal-avatar[data-particles="galaxy"]::before {
  content: "";
  position: absolute;
  inset: -20%;
  background:
    radial-gradient(circle, rgba(255,255,255,.95) 0 2.5px, transparent 3.5px) 0 0/8% 8%,
    radial-gradient(circle, rgba(150,200,255,.8) 0 2px, transparent 3px) 2% 2%/10% 10%,
    radial-gradient(circle, rgba(255,200,255,.7) 0 1.5px, transparent 2.5px) 5% 5%/12% 12%,
    radial-gradient(circle, rgba(255,255,150,.6) 0 1px, transparent 2px) 8% 8%/15% 15%;
  opacity: .85;
  filter: blur(0.5px);
  animation: drift-galaxy 8s linear infinite, twinkle 3s ease-in-out infinite;
  pointer-events: none;
}

@keyframes drift-sparks { 
  to { transform: translate3d(6%, -6%, 0); } 
}
@keyframes drift-stardust { 
  to { transform: translate3d(8%, -8%, 0) rotate(5deg); } 
}
@keyframes drift-galaxy { 
  to { transform: translate3d(10%, -10%, 0) rotate(10deg); } 
}
@keyframes twinkle {
  0%, 100% { opacity: .85; }
  50% { opacity: .95; }
}

/* TRAILS (Epic+) */
.seal-trail {
  position: absolute;
  pointer-events: none;
  animation: trail-flow 1.8s ease-in-out infinite;
}
@keyframes trail-flow {
  0% { opacity: 0; transform: translate(-12px, -50%); }
  40% { opacity: 1; }
  100% { opacity: 0; transform: translate(10px, -50%); }
}

/* ============================================ */
/*          BORDER EFFECTS (GLOBAL)            */
/* ============================================ */

:root { 
  --border-thickness: 2px; 
  --border-glow-color: rgba(59, 130, 246, 0.5);
}

/* Bordas Animadas - RAINBOW (Rare) */
html[data-border-anim="rainbow"] .app-surface,
html[data-border-anim="pulse-rainbow"] .app-surface,
html[data-border-anim="prismatic"] .app-surface {
  position: relative;
}

html[data-border-anim="rainbow"] .app-surface::before {
  content: "";
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  background: conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  z-index: -1;
  filter: blur(1px);
  animation: spin-rainbow 12s linear infinite;
  opacity: 0.7;
}

/* Pulse Rainbow (Epic) */
html[data-border-anim="pulse-rainbow"] .app-surface::before {
  content: "";
  position: absolute;
  inset: -3px;
  border-radius: inherit;
  background: conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00);
  z-index: -1;
  filter: blur(2px);
  animation: spin-rainbow 10s linear infinite, pulse-border 2s ease-in-out infinite;
  opacity: 0.8;
}

/* Prismatic (Legendary) */
html[data-border-anim="prismatic"] .app-surface::before {
  content: "";
  position: absolute;
  inset: -4px;
  border-radius: inherit;
  background: 
    conic-gradient(from 0deg, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00),
    conic-gradient(from 90deg, transparent 40%, rgba(255,255,255,.3) 50%, transparent 60%);
  z-index: -1;
  filter: blur(3px);
  animation: spin-rainbow 8s linear infinite, pulse-border 1.5s ease-in-out infinite, shimmer-border 3s ease-in-out infinite;
  opacity: 0.9;
  box-shadow: 0 0 20px rgba(255,255,255,.4);
}

/* Camada interna da borda (Epic+) */
html[data-border-anim="pulse-rainbow"] .app-surface::after,
html[data-border-anim="prismatic"] .app-surface::after {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: inherit;
  background: linear-gradient(45deg, rgba(255,255,255,.2), rgba(255,255,255,.05));
  z-index: -1;
  pointer-events: none;
}

@keyframes spin-rainbow { 
  to { transform: rotate(360deg); } 
}

@keyframes pulse-border {
  0%, 100% { filter: blur(2px) brightness(1); }
  50% { filter: blur(3px) brightness(1.2); }
}

@keyframes shimmer-border {
  0%, 100% { opacity: 0.9; }
  50% { opacity: 1; }
}

/* Hover Effects para bordas (Epic+) */
html[data-border-anim="pulse-rainbow"] .app-surface:hover,
html[data-border-anim="prismatic"] .app-surface:hover {
  transform: scale(1.02);
  transition: transform 0.3s ease;
}

html[data-border-anim="prismatic"] .app-surface:hover {
  transform: scale(1.03) rotate(0.5deg);
  transition: transform 0.3s ease, filter 0.3s ease;
  filter: brightness(1.05);
}

/* Corner Sparkles (Legendary) */
html[data-border-anim="prismatic"] .app-surface {
  position: relative;
  overflow: visible;
}

html[data-border-anim="prismatic"] .app-surface::after {
  content: "✨";
  position: absolute;
  top: -8px;
  right: -8px;
  font-size: 12px;
  animation: sparkle-corner 2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes sparkle-corner {
  0%, 100% { opacity: 0.6; transform: scale(0.8) rotate(0deg); }
  50% { opacity: 1; transform: scale(1.2) rotate(180deg); }
}

/* ============================================ */
/*          THEME EFFECTS (BACKGROUNDS)        */
/* ============================================ */

:root {
  --accent-0: #00b4d8;
  --accent-1: #111827;
  --theme-transition: 0.5s ease;
}

/* Backgrounds por tipo */

/* Solid (Common) - background padrão */
html[data-theme-mode="solid"] {
  background: var(--accent-1);
  transition: background var(--theme-transition);
}

/* Gradient Animated (Rare) */
html[data-theme-mode="gradient-animated"] {
  background: linear-gradient(135deg, var(--accent-1), color-mix(in srgb, var(--accent-0) 20%, var(--accent-1)));
  animation: gradient-shift 10s ease infinite;
}

@keyframes gradient-shift {
  0%, 100% { filter: hue-rotate(0deg) brightness(1); }
  50% { filter: hue-rotate(10deg) brightness(1.05); }
}

/* Cycle Reactive (Epic) - Reage a focus/break */
html[data-theme-mode="cycle-reactive"] {
  background: 
    radial-gradient(60% 100% at 50% 0%, color-mix(in srgb, var(--accent-0) 30%, transparent) 0%, transparent 60%),
    linear-gradient(180deg, color-mix(in srgb, var(--accent-1) 40%, #000) 0%, #000 100%);
  transition: filter var(--theme-transition);
}

html[data-theme-mode="cycle-reactive"][data-cycle="focus"] {
  filter: saturate(1.15) brightness(1.05) contrast(1.02);
}

html[data-theme-mode="cycle-reactive"][data-cycle="break"] {
  filter: saturate(0.85) brightness(0.95) sepia(0.1);
}

/* Cosmic Parallax (Legendary) */
html[data-theme-mode="cosmic-parallax"] {
  background: 
    radial-gradient(ellipse at 20% 30%, color-mix(in srgb, var(--accent-0) 15%, transparent) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 70%, color-mix(in srgb, var(--accent-0) 20%, transparent) 0%, transparent 60%),
    radial-gradient(circle at 50% 50%, color-mix(in srgb, var(--accent-1) 60%, #000) 0%, #000 100%);
  animation: cosmic-drift 30s ease-in-out infinite;
  position: relative;
}

@keyframes cosmic-drift {
  0%, 100% { 
    background-position: 0% 0%, 100% 100%, 50% 50%;
  }
  50% { 
    background-position: 10% 5%, 90% 95%, 50% 50%;
  }
}

/* Nebula overlay para legendary */
html[data-theme-mode="cosmic-parallax"]::before {
  content: "";
  position: fixed;
  inset: 0;
  background: 
    radial-gradient(circle at 30% 40%, rgba(138, 43, 226, 0.1) 0%, transparent 40%),
    radial-gradient(circle at 70% 60%, rgba(30, 144, 255, 0.08) 0%, transparent 40%);
  pointer-events: none;
  z-index: 0;
  animation: nebula-flow 20s ease-in-out infinite;
}

@keyframes nebula-flow {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 0.8; transform: scale(1.05); }
}

/* Starfield para legendary */
html[data-theme-mode="cosmic-parallax"]::after {
  content: "";
  position: fixed;
  inset: 0;
  background-image:
    radial-gradient(circle, rgba(255,255,255,.8) 0 1px, transparent 1px),
    radial-gradient(circle, rgba(255,255,255,.6) 0 0.5px, transparent 1px);
  background-size: 50px 50px, 30px 30px;
  background-position: 0 0, 25px 25px;
  opacity: 0.3;
  pointer-events: none;
  z-index: 0;
  animation: starfield-drift 60s linear infinite;
}

@keyframes starfield-drift {
  to { background-position: 50px 50px, 75px 75px; }
}

/* ============================================ */
/*          CELEBRATION EFFECTS                */
/* ============================================ */

/* Celebração de milestones (Legendary) */
html[data-celebrate="on"] .celebration-trigger {
  animation: celebration-burst 1s ease-out;
}

@keyframes celebration-burst {
  0% { transform: scale(1); filter: brightness(1); }
  50% { transform: scale(1.1); filter: brightness(1.3) saturate(1.5); }
  100% { transform: scale(1); filter: brightness(1); }
}

/* Partículas de celebração */
.celebration-particles {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 9999;
}

.celebration-particles::before,
.celebration-particles::after {
  content: "🎉";
  position: absolute;
  font-size: 24px;
  animation: particle-rise 2s ease-out forwards;
}

.celebration-particles::before {
  left: 20%;
  animation-delay: 0.1s;
}

.celebration-particles::after {
  right: 20%;
  animation-delay: 0.3s;
}

@keyframes particle-rise {
  0% { 
    bottom: -50px; 
    opacity: 0; 
    transform: translateY(0) rotate(0deg); 
  }
  50% { 
    opacity: 1; 
  }
  100% { 
    bottom: 100vh; 
    opacity: 0; 
    transform: translateY(-100px) rotate(360deg); 
  }
}

/* ============================================ */
/*          UTILITY CLASSES                    */
/* ============================================ */

.bordered { 
  border: var(--border-thickness) solid rgba(255,255,255,.12); 
}

.cycle-bg {
  transition: filter var(--theme-transition);
}

/* Breathing effect para temas (Rare+) */
.breathing-effect {
  animation: breathe 4s ease-in-out infinite;
}

@keyframes breathe {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.01); opacity: 0.95; }
}

/* Holographic UI (Legendary) */
.holographic {
  background: linear-gradient(135deg, 
    rgba(255,255,255,.05) 0%, 
    transparent 40%, 
    rgba(255,255,255,.03) 50%, 
    transparent 60%,
    rgba(255,255,255,.05) 100%);
  background-size: 200% 200%;
  animation: holographic-shift 3s ease-in-out infinite;
}

@keyframes holographic-shift {
  0%, 100% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
}
  `.trim();

  const el = document.createElement('style');
  el.id = 'pomociclo-efx';
  el.textContent = css;
  document.head.appendChild(el);
}

// ---- helpers antigos (compat) ----
const pick = (id, list) => list[(Number(String(id).split('_')[1] || 0) || 0) % list.length];

/** Aplica um tema animado no site */
export function applyThemeById(itemId) {
  injectStylesOnce();
  const key = pick(itemId, ['aurora','nebula','sunset','matrix','holo']);
  document.documentElement.setAttribute('data-theme', key);
}

/** Aplica um estilo de borda global */
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

/**
 * Aplica os efeitos de um "tema" equipado.
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
  // aceita sinônimos do backend
  const modeMap = {
    parallax: 'cosmic-parallax',
    'cosmic-parallax': 'cosmic-parallax',
    'cycle-reactive': 'cycle-reactive',
    solid: 'solid',
  };
  if (effects.bg) {
    root.setAttribute('data-theme-mode', modeMap[effects.bg] ?? effects.bg);
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
  
  if (eff.glow_intensity) {
    root.style.setProperty('--border-glow-intensity', eff.glow_intensity);
  }
}

/**
 * Controla o estado do ciclo para temas "cycle-reactive".
 */
export function setCycleState(state) {
  injectStylesOnce();
  const root = document.documentElement;
  if (state === 'focus' || state === 'break') root.setAttribute('data-cycle', state);
  else root.removeAttribute('data-cycle');
}

/**
 * Trigger celebration effect (Legendary themes)
 */
export function triggerCelebration() {
  const root = document.documentElement;
  if (root.getAttribute('data-celebrate') === 'on') {
    // Add celebration particles temporarily
    const particles = document.createElement('div');
    particles.className = 'celebration-particles';
    document.body.appendChild(particles);
    
    setTimeout(() => {
      particles.remove();
    }, 2000);
  }
}
