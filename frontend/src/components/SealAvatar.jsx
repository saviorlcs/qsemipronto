// frontend/src/components/SealAvatar.jsx
import React, { useMemo } from "react";

export default function SealAvatar({ user, item, size = 56, className = "", style = {} }) {
  const handle =
    (user?.nickname ? `${user.nickname}${user?.tag ? "#" + user.tag : ""}` : "") ||
    user?.name || "Aluno";

  const rarity = item?.rarity || "common";
  const fx = item?.effects?.avatar_style || {};

  const ICON_GLYPH = { dot:"•", bolt:"⚡", star:"★", diamond:"◆", target:"◎", flame:"🔥", leaf:"🍃", heart:"❤", clover:"☘", triangle:"▲" };
  const glyph = ICON_GLYPH[fx.icon] || "SL";

  const baseHex = fx.static_color || "#3b82f6";
  function shade(hex, p = -20) {
    const n = parseInt(hex.slice(1), 16);
    let r=(n>>16)+p, g=((n>>8)&255)+p, b=(n&255)+p;
    r=Math.max(0,Math.min(255,r)); g=Math.max(0,Math.min(255,g)); b=Math.max(0,Math.min(255,b));
    return `#${(r<<16|g<<8|b).toString(16).padStart(6,"0")}`;
  }
  const angle = Number.isFinite(fx.angle) ? fx.angle : 0;
  const c1 = baseHex, c2 = shade(baseHex, -30);
  const bg = `conic-gradient(from ${angle}deg, ${c1} 0deg, ${c2} 140deg, ${c1} 320deg)`;

  const initials = useMemo(() => {
    const clean = handle.replace(/[^a-zA-Z0-9#]/g," ").trim();
    const parts = clean.split(/[\s#]+/).filter(Boolean);
    if (!parts.length) return "S";
    if (parts.length === 1) return parts[0].slice(0,2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }, [handle]);

  const outer = {
    width: size, height: size, borderRadius: size, position: "relative", overflow: "hidden",
    background: bg,
    boxShadow:
      rarity === "common" ? `0 0 0 2px rgba(255,255,255,.05), 0 0 14px ${c1}33` :
      rarity === "epic" ? `0 0 0 2px rgba(255,255,255,.06), 0 0 18px ${c1}55` :
      `0 0 0 2px rgba(255,255,255,.08), 0 0 22px ${c1}77`,
    ...style,
  };

  return (
    <div className={className} style={outer} aria-label={`Selo ${handle}`}
         data-orbit={fx.orbit||"none"} data-particles={fx.particles||"none"}
         data-trail={fx.trail?"on":"off"} data-pattern={fx.pattern||"none"}>
      {/* marca d’água do ícone (sutil nos comuns) */}
      <div style={{
        position:"absolute", inset:0, display:"grid", placeItems:"center",
        fontSize: Math.max(10, Math.floor(size*0.7)), color:"#000",
        opacity: rarity==="common" ? .12 : .18, userSelect:"none"
      }}>{glyph}</div>

      {/* gloss e pulse (épico+) */}
      <div style={{
        position:"absolute", inset:0, background:
          "radial-gradient(120% 120% at 80% 15%, rgba(255,255,255,.16) 0%, rgba(255,255,255,.08) 26%, rgba(0,0,0,.18) 70%, rgba(0,0,0,.38) 100%)",
        pointerEvents:"none",
        animation: fx.pulse ? "seal-pulse 2.6s ease-in-out infinite" : "none"
      }} />
      <style>{`@keyframes seal-pulse{0%,100%{filter:brightness(1)}50%{filter:brightness(1.06)}}`}</style>

      {/* iniciais */}
      <div style={{
        position:"absolute", inset:0, display:"grid", placeItems:"center",
        color:"white", fontWeight:800, letterSpacing:"0.5px",
        fontSize: Math.max(12, Math.floor(size*0.36)),
        textShadow:"0 1px 2px rgba(0,0,0,.35)", userSelect:"none"
      }}>{initials}</div>
    </div>
  );
}
