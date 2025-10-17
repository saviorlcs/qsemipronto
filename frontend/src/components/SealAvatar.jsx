// frontend/src/components/SealAvatar.jsx
import React from 'react';

const gradFor = (n = 0) => {
  const h = (Number(n) * 37) % 360;
  return {
    from: `hsl(${h} 70% 60%)`,
    to:   `hsl(${(h + 40) % 360} 70% 45%)`,
  };
};

const getInitials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map(p => p[0]?.toUpperCase() ?? '').join('') || 'U';
};

export default function SealAvatar({ seed, size = 64, label, name }) {
  const { from, to } = gradFor(String(seed).length);
  const initials = getInitials(name || label || 'User');

  return (
    <div
      className="relative rounded-full overflow-hidden"
      style={{
        width: size,
        height: size,
        background: `radial-gradient(circle at 30% 30%, ${from}, ${to})`,
        boxShadow: '0 0 24px rgba(0,0,0,.25), inset 0 0 20px rgba(255,255,255,.15)',
        border: '1px solid rgba(255,255,255,.1)',
      }}
      title={label || name}
    >
      {/* anel sutil */}
      <div className="absolute inset-0 rounded-full"
           style={{ boxShadow: 'inset 0 0 0 2px rgba(255,255,255,.06)' }} />
      {/* letra/monograma */}
      <div className="absolute inset-0 flex items-center justify-center text-white/95 font-bold">
        {initials}
      </div>
    </div>
  );
}
