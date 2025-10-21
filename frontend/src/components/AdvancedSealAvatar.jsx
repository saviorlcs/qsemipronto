// Advanced Seal Avatar with incredible visual effects
import React, { useEffect, useRef, useMemo } from 'react';

// Gera hash estável a partir do nickname
const hashString = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
};

// Gera gradiente único baseado no usuário
const generateGradient = (nickname, baseColor, accentColor) => {
  const hash = hashString(nickname || 'User');
  const angle = (hash % 360);
  
  if (baseColor && accentColor) {
    return `linear-gradient(${angle}deg, ${baseColor}, ${accentColor})`;
  }
  
  const hue1 = (hash * 37) % 360;
  const hue2 = (hash * 73 + 120) % 360;
  return `linear-gradient(${angle}deg, hsl(${hue1}, 75%, 55%), hsl(${hue2}, 75%, 45%))`;
};

// Componente de ícone SVG
const SealIcon = ({ icon, size }) => {
  const iconSize = size * 0.4;
  
  const icons = {
    star: (
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" 
            fill="currentColor" opacity="0.9"/>
    ),
    sparkle: (
      <>
        <circle cx="12" cy="12" r="2" fill="currentColor" opacity="0.9"/>
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" 
              stroke="currentColor" strokeWidth="2" opacity="0.7"/>
      </>
    ),
    bolt: (
      <path d="M13 2L3 14h8l-1 8 10-12h-8l1-8z" fill="currentColor" opacity="0.85"/>
    ),
    flame: (
      <path d="M12 2c-1.5 4-4 6-4 10a4 4 0 008 0c0-4-2.5-6-4-10zM10.5 18a2 2 0 003 0" 
            fill="currentColor" opacity="0.9"/>
    ),
    crystal: (
      <path d="M12 2l-8 6v8l8 6 8-6V8l-8-6zm0 4l4 3v6l-4 3-4-3v-6l4-3z" 
            fill="currentColor" opacity="0.85"/>
    ),
    nova: (
      <>
        <circle cx="12" cy="12" r="3" fill="currentColor" opacity="1"/>
        <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.6"/>
        <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.3"/>
      </>
    ),
    aurora: (
      <path d="M2 12c0 3 1.5 5 3.5 6.5S10 20 12 20s5.5-.5 7.5-2 3.5-3.5 3.5-6.5M2 12c0-3 1.5-5 3.5-6.5S10 4 12 4s5.5.5 7.5 2 3.5 3.5 3.5 6.5M2 12h20" 
            stroke="currentColor" strokeWidth="2" fill="none" opacity="0.8"/>
    ),
    phoenix: (
      <path d="M12 2l-2 4-4 2 4 2 2 4 2-4 4-2-4-2-2-4zM8 16l-2 2 2 2 2-2-2-2zM16 16l2 2-2 2-2-2 2-2z" 
            fill="currentColor" opacity="0.85"/>
    ),
    cosmos: (
      <>
        <circle cx="12" cy="12" r="2" fill="currentColor" opacity="1"/>
        <circle cx="6" cy="6" r="1" fill="currentColor" opacity="0.7"/>
        <circle cx="18" cy="6" r="1" fill="currentColor" opacity="0.7"/>
        <circle cx="6" cy="18" r="1" fill="currentColor" opacity="0.7"/>
        <circle cx="18" cy="18" r="1" fill="currentColor" opacity="0.7"/>
        <ellipse cx="12" cy="12" rx="8" ry="4" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
        <ellipse cx="12" cy="12" rx="4" ry="8" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
      </>
    )
  };
  
  return (
    <svg 
      width={iconSize} 
      height={iconSize} 
      viewBox="0 0 24 24" 
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        filter: 'drop-shadow(0 0 3px rgba(255,255,255,0.5))'
      }}
    >
      {icons[icon] || icons.star}
    </svg>
  );
};

const AdvancedSealAvatar = ({ 
  user, 
  item, 
  size = 64,
  showInitials = true 
}) => {
  const canvasRef = useRef(null);
  const nickname = user?.nickname || user?.name || 'User';
  const initials = useMemo(() => {
    const parts = nickname.trim().split(/\s+/);
    return parts.slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('') || 'U';
  }, [nickname]);

  const effects = item?.effects || {};
  const {
    base_color,
    accent_color,
    icon = 'star',
    glow = 'subtle',
    particles = false,
    animation = 'none',
    interactive = false,
    holographic = false,
    pattern = 'none'
  } = effects;

  const gradient = useMemo(() => 
    generateGradient(nickname, base_color, accent_color),
    [nickname, base_color, accent_color]
  );

  // Canvas para partículas
  useEffect(() => {
    if (!particles || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = size;
    canvas.height = size;

    const particleCount = glow === 'prismatic' ? 20 : (glow === 'radiant' ? 12 : 8);
    const particlesArray = [];

    class Particle {
      constructor() {
        this.reset();
      }

      reset() {
        const angle = Math.random() * Math.PI * 2;
        const distance = size * 0.35;
        this.x = size / 2 + Math.cos(angle) * distance;
        this.y = size / 2 + Math.sin(angle) * distance;
        this.size = Math.random() * 2 + 1;
        this.speedX = (Math.random() - 0.5) * 0.5;
        this.speedY = (Math.random() - 0.5) * 0.5;
        this.opacity = Math.random() * 0.5 + 0.3;
        this.hue = Math.random() * 360;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;
        
        const dx = this.x - size / 2;
        const dy = this.y - size / 2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > size * 0.45 || dist < size * 0.25) {
          this.reset();
        }
        
        if (animation === 'orbit') {
          const angle = Math.atan2(dy, dx);
          this.x = size / 2 + Math.cos(angle + 0.02) * dist;
          this.y = size / 2 + Math.sin(angle + 0.02) * dist;
        }
      }

      draw() {
        ctx.fillStyle = holographic 
          ? `hsla(${this.hue}, 100%, 70%, ${this.opacity})`
          : `rgba(255, 255, 255, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particlesArray.push(new Particle());
    }

    let animationId;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      particlesArray.forEach(particle => {
        particle.update();
        particle.draw();
      });
      
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(animationId);
  }, [particles, size, animation, glow, holographic]);

  const containerStyle = {
    width: size,
    height: size,
    position: 'relative',
    borderRadius: '50%',
    overflow: 'visible',
    background: gradient,
  };

  const glowStyles = {
    subtle: '0 0 10px rgba(255, 255, 255, 0.2)',
    intense: '0 0 20px rgba(255, 255, 255, 0.4), 0 0 30px rgba(255, 255, 255, 0.2)',
    radiant: '0 0 25px rgba(255, 255, 255, 0.5), 0 0 40px rgba(255, 255, 255, 0.3), 0 0 60px rgba(255, 255, 255, 0.1)',
    prismatic: '0 0 30px rgba(255, 100, 255, 0.5), 0 0 50px rgba(100, 200, 255, 0.4), 0 0 70px rgba(255, 255, 100, 0.3)'
  };

  const animationStyles = {
    pulse: 'sealPulse 2s ease-in-out infinite',
    orbit: 'sealRotate 4s linear infinite',
    quantum: 'sealQuantum 3s ease-in-out infinite, sealRotate 8s linear infinite',
  };

  return (
    <>
      <style>{`
        @keyframes sealPulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.95; }
        }
        
        @keyframes sealRotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        @keyframes sealQuantum {
          0%, 100% { filter: hue-rotate(0deg) brightness(1); }
          50% { filter: hue-rotate(180deg) brightness(1.2); }
        }
        
        @keyframes holographicShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        .seal-interactive:hover {
          transform: scale(1.1) !important;
          transition: transform 0.3s ease;
        }
      `}</style>
      
      <div 
        style={{
          ...containerStyle,
          boxShadow: glowStyles[glow] || glowStyles.subtle,
          animation: animationStyles[animation] || 'none',
          ...(holographic && {
            background: `linear-gradient(45deg, 
              ${base_color || '#ff00ff'}, 
              ${accent_color || '#00ffff'}, 
              ${base_color || '#ffff00'})`,
            backgroundSize: '200% 200%',
            animation: `${animationStyles[animation] || ''}, holographicShift 3s ease infinite`
          })
        }}
        className={interactive ? 'seal-interactive' : ''}
      >
        {/* Canvas para partículas */}
        {particles && (
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: size,
              height: size,
              pointerEvents: 'none',
              borderRadius: '50%'
            }}
          />
        )}
        
        {/* Iniciais */}
        {showInitials && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: size * 0.35,
            fontWeight: 'bold',
            color: 'rgba(255, 255, 255, 0.95)',
            textShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
            fontFamily: 'Space Grotesk, sans-serif',
            zIndex: 2
          }}>
            {initials}
          </div>
        )}
        
        {/* Ícone */}
        {icon && icon !== 'none' && (
          <div style={{ position: 'relative', width: '100%', height: '100%', zIndex: 1 }}>
            <SealIcon icon={icon} size={size} />
          </div>
        )}
        
        {/* Padrão de fundo */}
        {pattern !== 'none' && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            opacity: 0.15,
            background: pattern === 'dots' 
              ? 'radial-gradient(circle, rgba(255,255,255,0.3) 1px, transparent 1px)'
              : pattern === 'waves'
              ? 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)'
              : 'none',
            backgroundSize: pattern === 'dots' ? '10px 10px' : 'auto',
            zIndex: 0
          }}/>
        )}
      </div>
    </>
  );
};

export default AdvancedSealAvatar;
