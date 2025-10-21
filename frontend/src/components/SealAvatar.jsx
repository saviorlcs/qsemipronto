// frontend/src/components/SealAvatar.jsx
import React, { useMemo } from "react";

export default function SealAvatar({ user, item, size = 56, className = "", style = {} }) {
  const handle =
    (user?.nickname ? `${user.nickname}${user?.tag ? "#" + user.tag : ""}` : "") ||
    user?.name || "Aluno";

  const rarity = item?.rarity || "common";
  const fx = item?.effects?.avatar_style || {};

  const ICON_GLYPH = { 
    dot:"•", bolt:"⚡", star:"★", diamond:"◆", target:"◎", 
    flame:"🔥", leaf:"🍃", heart:"❤", clover:"☘", triangle:"▲" 
  };
  const glyph = ICON_GLYPH[fx.icon] || "SL";

  // Gera um hash simples baseado no nickname para criar avatares únicos
  const nicknameHash = useMemo(() => {
    let hash = 0;
    for (let i = 0; i < handle.length; i++) {
      hash = ((hash << 5) - hash) + handle.charCodeAt(i);
      hash = hash & hash;
    }
    return Math.abs(hash);
  }, [handle]);

  // Usa o hash para gerar cores únicas para cada usuário
  const uniqueHue = (nicknameHash % 360);
  const uniqueSat = 60 + (nicknameHash % 30);
  const uniqueLight = 45 + (nicknameHash % 20);
  
  const baseHex = fx.static_color || `hsl(${uniqueHue}, ${uniqueSat}%, ${uniqueLight}%)`;
  
  function shade(hex, p = -20) {
    // Se for HSL, converte para hex primeiro
    if (hex.startsWith('hsl')) {
      // Extrai valores HSL
      const match = hex.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
      if (match) {
        const h = parseInt(match[1]);
        const s = parseInt(match[2]) / 100;
        const l = Math.max(0, Math.min(100, parseInt(match[3]) + p/5)) / 100;
        return `hsl(${h}, ${s*100}%, ${l*100}%)`;
      }
    }
    const n = parseInt(hex.slice(1), 16);
    let r=(n>>16)+p, g=((n>>8)&255)+p, b=(n&255)+p;
    r=Math.max(0,Math.min(255,r)); g=Math.max(0,Math.min(255,g)); b=Math.max(0,Math.min(255,b));
    return `#${(r<<16|g<<8|b).toString(16).padStart(6,"0")}`;
  }
  
  const angle = Number.isFinite(fx.angle) ? fx.angle : (nicknameHash % 360);
  const c1 = baseHex;
  const c2 = shade(baseHex, -30);
  const c3 = shade(baseHex, -50);
  
  // Background mais complexo baseado no padrão
  const getBackground = () => {
    const pattern = fx.pattern || "geometric";
    switch(pattern) {
      case "geometric":
        return `conic-gradient(from ${angle}deg, ${c1} 0deg, ${c2} 140deg, ${c1} 320deg)`;
      case "organic":
        return `radial-gradient(circle at 30% 30%, ${c1}, ${c2} 60%, ${c3})`;
      case "crystalline":
        return `linear-gradient(${angle}deg, ${c1}, ${c2}), linear-gradient(${angle + 90}deg, ${c2} 20%, transparent 80%)`;
      case "nebula":
        return `radial-gradient(ellipse at 50% 0%, ${c1}, transparent 70%), radial-gradient(ellipse at 100% 100%, ${c2}, transparent 70%), ${c3}`;
      case "fractal":
        return `repeating-conic-gradient(from ${angle}deg, ${c1} 0deg 30deg, ${c2} 30deg 60deg)`;
      case "waves":
        return `repeating-linear-gradient(${angle}deg, ${c1}, ${c2} 10%, ${c1} 20%)`;
      default:
        return `conic-gradient(from ${angle}deg, ${c1} 0deg, ${c2} 140deg, ${c1} 320deg)`;
    }
  };

  const bg = getBackground();

  const initials = useMemo(() => {
    const clean = handle.replace(/[^a-zA-Z0-9#]/g," ").trim();
    const parts = clean.split(/[\s#]+/).filter(Boolean);
    if (!parts.length) return "S";
    if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }, [handle]);

  // Sombras progressivas por raridade
  const getShadow = () => {
    const baseGlow = `0 0 14px ${c1}`;
    switch(rarity) {
      case "common":
        return `0 0 0 2px rgba(255,255,255,.05), ${baseGlow}33`;
      case "rare":
        return `0 0 0 2px rgba(255,255,255,.08), ${baseGlow}66, 0 0 28px ${c1}44`;
      case "epic":
        return `0 0 0 3px rgba(255,255,255,.12), ${baseGlow}88, 0 0 35px ${c1}66, 0 0 50px ${c2}33`;
      case "legendary":
        return `0 0 0 4px rgba(255,255,255,.18), ${baseGlow}99, 0 0 40px ${c1}88, 0 0 60px ${c2}66, 0 0 80px ${c3}44`;
      default:
        return `0 0 0 2px rgba(255,255,255,.05), ${baseGlow}33`;
    }
  };

  const outer = {
    width: size, 
    height: size, 
    borderRadius: size, 
    position: "relative", 
    overflow: fx.pattern === "nebula" || fx.pattern === "fractal" ? "visible" : "hidden",
    background: bg,
    boxShadow: getShadow(),
    filter: fx.holographic ? "brightness(1.1) contrast(1.05)" : "none",
    ...style,
  };

  // Classes CSS dinâmicas baseadas em efeitos
  const wrapperClasses = `seal-avatar ${className} ${fx.shimmer ? 'seal-shimmer' : ''}`;

  return (
    <div 
      className={wrapperClasses}
      style={outer} 
      aria-label={`Selo ${handle}`}
      data-rarity={rarity}
      data-orbit={fx.orbit||"none"} 
      data-particles={fx.particles||"none"}
      data-trail={fx.trail?"on":"off"} 
      data-pattern={fx.pattern||"none"}
      data-glow={fx.glow||"soft"}
      data-aura={fx.aura||"none"}
    >
      {/* Aura externa (rare+) */}
      {(fx.aura === "radiant" || fx.aura === "cosmic") && (
        <div className="seal-aura" style={{
          position:"absolute", 
          inset: fx.aura === "cosmic" ? "-16px" : "-12px", 
          borderRadius:"50%",
          background: fx.aura === "cosmic" 
            ? `conic-gradient(from 0deg, ${c1}33, transparent 40%, ${c2}33 60%, transparent)`
            : `conic-gradient(from 0deg, ${c1}22, transparent 70%)`,
          filter: "blur(8px)", 
          zIndex:-1,
          opacity: fx.aura === "cosmic" ? 0.9 : 0.6
        }} />
      )}

      {/* Trail (epic+) */}
      {fx.trail && fx.trail !== "off" && (
        <div className="seal-trail" style={{
          position:"absolute", 
          right: fx.trail === "comet" ? "-20px" : "-12px",
          top:"50%", 
          width: fx.trail === "comet" ? "30px" : "18px",
          height: fx.trail === "comet" ? "8px" : "6px",
          background: fx.trail === "comet" 
            ? `linear-gradient(90deg, ${c1}, ${c2}88, transparent)`
            : `linear-gradient(90deg, ${c1}cc, transparent)`,
          borderRadius:"999px", 
          transform: "translateY(-50%)",
          filter: fx.trail === "comet" ? "blur(1px)" : "blur(0.5px)"
        }} />
      )}

      {/* Padrão overlay para legendary (anéis, etc) */}
      {fx.pattern_overlay === "rings" && (
        <div style={{
          position:"absolute", 
          inset:0,
          background: `radial-gradient(circle, transparent 30%, ${c1}11 35%, transparent 40%, ${c2}11 48%, transparent 52%)`,
          pointerEvents:"none"
        }} />
      )}

      {/* Marca d'água do ícone */}
      <div style={{
        position:"absolute", 
        inset:0, 
        display:"grid", 
        placeItems:"center",
        fontSize: Math.max(10, Math.floor(size*0.7)), 
        color: rarity === "legendary" ? c1 : "#000",
        opacity: rarity === "common" ? 0.1 : rarity === "legendary" ? 0.25 : 0.18,
        userSelect:"none",
        filter: rarity === "legendary" ? "blur(1px)" : "none"
      }}>
        {glyph}
      </div>

      {/* Gloss e pulse (epic+) */}
      <div style={{
        position:"absolute", 
        inset:0, 
        background:
          rarity === "legendary"
            ? "radial-gradient(130% 130% at 75% 10%, rgba(255,255,255,.22) 0%, rgba(255,255,255,.11) 20%, rgba(0,0,0,.15) 60%, rgba(0,0,0,.35) 100%)"
            : "radial-gradient(120% 120% at 80% 15%, rgba(255,255,255,.16) 0%, rgba(255,255,255,.08) 26%, rgba(0,0,0,.18) 70%, rgba(0,0,0,.38) 100%)",
        pointerEvents:"none",
        animation: fx.pulse ? "seal-pulse 2.6s ease-in-out infinite" : "none"
      }} />

      {/* Inner glow para epic/legendary */}
      {fx.inner_glow && (
        <div style={{
          position:"absolute",
          inset:"15%",
          borderRadius:"50%",
          background: `radial-gradient(circle, ${c1}44, transparent 70%)`,
          filter:"blur(4px)",
          pointerEvents:"none"
        }} />
      )}

      {/* Iniciais do usuário */}
      <div style={{
        position:"absolute", 
        inset:0, 
        display:"grid", 
        placeItems:"center",
        color: rarity === "legendary" ? "#fff" : "white", 
        fontWeight: rarity === "legendary" ? 900 : 800, 
        letterSpacing: rarity === "legendary" ? "1px" : "0.5px",
        fontSize: Math.max(12, Math.floor(size*0.36)),
        textShadow: rarity === "legendary" 
          ? `0 2px 4px rgba(0,0,0,.5), 0 0 20px ${c1}66`
          : "0 1px 2px rgba(0,0,0,.35)",
        userSelect:"none"
      }}>
        {initials}
      </div>

      {/* Animações CSS inline */}
      <style>{`
        @keyframes seal-pulse{
          0%,100%{filter:brightness(1)}
          50%{filter:brightness(${rarity === "legendary" ? "1.12" : "1.06"})}
        }
        .seal-shimmer {
          animation: shimmer 3s ease-in-out infinite;
        }
        @keyframes shimmer {
          0%, 100% { filter: brightness(1) saturate(1); }
          50% { filter: brightness(1.15) saturate(1.2); }
        }
      `}</style>
    </div>
  );
}
