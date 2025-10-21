// Advanced Border Preview Component with incredible effects
import React, { useEffect, useRef } from 'react';

const AdvancedBorderPreview = ({ effects = {}, size = 120 }) => {
  const canvasRef = useRef(null);
  const containerRef = useRef(null);
  
  const {
    thickness = 3,
    radius = 18,
    color = '#06b6d4',
    animation = 'static-glow',
    particles = false,
    interactive = false,
    glow_intensity = 'medium'
  } = effects;

  const glowShadows = {
    low: `0 0 8px ${color}40`,
    medium: `0 0 12px ${color}60, 0 0 20px ${color}30`,
    high: `0 0 16px ${color}80, 0 0 30px ${color}50, 0 0 45px ${color}20`,
    extreme: `0 0 20px ${color}90, 0 0 40px ${color}70, 0 0 60px ${color}40, 0 0 80px ${color}20`
  };

  // Animação de partículas
  useEffect(() => {
    if (!particles || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = size;
    canvas.height = size;

    const particlesArray = [];
    const particleCount = glow_intensity === 'extreme' ? 30 : 20;

    class BorderParticle {
      constructor() {
        this.reset();
      }

      reset() {
        // Partículas ao longo do perímetro
        const side = Math.floor(Math.random() * 4);
        const progress = Math.random();
        
        if (side === 0) { // top
          this.x = progress * size;
          this.y = 0;
        } else if (side === 1) { // right
          this.x = size;
          this.y = progress * size;
        } else if (side === 2) { // bottom
          this.x = (1 - progress) * size;
          this.y = size;
        } else { // left
          this.x = 0;
          this.y = (1 - progress) * size;
        }
        
        this.size = Math.random() * 2 + 1;
        this.opacity = Math.random() * 0.6 + 0.4;
        this.speed = Math.random() * 0.5 + 0.3;
        this.angle = Math.atan2(size / 2 - this.y, size / 2 - this.x);
      }

      update() {
        // Move along perimeter
        const dx = this.x - size / 2;
        const dy = this.y - size / 2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (animation === 'rotating-glow') {
          this.angle += 0.01;
          this.x = size / 2 + Math.cos(this.angle) * (size / 2);
          this.y = size / 2 + Math.sin(this.angle) * (size / 2);
        } else {
          this.angle += 0.02;
          this.x = size / 2 + Math.cos(this.angle) * (size / 2 - 3);
          this.y = size / 2 + Math.sin(this.angle) * (size / 2 - 3);
        }
        
        this.opacity = Math.sin(Date.now() * 0.001 + this.angle) * 0.3 + 0.5;
      }

      draw() {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        
        if (glow_intensity === 'extreme') {
          ctx.shadowBlur = 8;
          ctx.shadowColor = color;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particlesArray.push(new BorderParticle());
    }

    let animationId;
    const animate = () => {
      ctx.clearRect(0, 0, size, size);
      
      particlesArray.forEach(particle => {
        particle.update();
        particle.draw();
      });
      
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => cancelAnimationFrame(animationId);
  }, [particles, size, animation, color, glow_intensity]);

  const animationClasses = {
    'static-glow': '',
    'rotating-glow': 'border-rotating',
    'pulse-wave': 'border-pulse',
    'prismatic-rainbow': 'border-prismatic'
  };

  return (
    <>
      <style>{`
        @keyframes borderRotating {
          from { 
            filter: hue-rotate(0deg);
            box-shadow: ${glowShadows[glow_intensity]};
          }
          to { 
            filter: hue-rotate(360deg);
            box-shadow: ${glowShadows[glow_intensity]};
          }
        }
        
        @keyframes borderPulse {
          0%, 100% {
            box-shadow: ${glowShadows[glow_intensity]};
            border-width: ${thickness}px;
          }
          50% {
            box-shadow: ${glowShadows.extreme};
            border-width: ${thickness + 1}px;
          }
        }
        
        @keyframes borderPrismatic {
          0% {
            border-image: linear-gradient(0deg, 
              ${color}, 
              #ff00ff, 
              #00ffff, 
              ${color}) 1;
            box-shadow: 0 0 20px #ff00ff90, 0 0 40px #00ffff70;
          }
          33% {
            border-image: linear-gradient(120deg, 
              #00ffff, 
              #ffff00, 
              ${color}, 
              #00ffff) 1;
            box-shadow: 0 0 20px #00ffff90, 0 0 40px #ffff0070;
          }
          66% {
            border-image: linear-gradient(240deg, 
              #ffff00, 
              ${color}, 
              #ff00ff, 
              #ffff00) 1;
            box-shadow: 0 0 20px #ffff0090, 0 0 40px ${color}70;
          }
          100% {
            border-image: linear-gradient(360deg, 
              ${color}, 
              #ff00ff, 
              #00ffff, 
              ${color}) 1;
            box-shadow: 0 0 20px #ff00ff90, 0 0 40px #00ffff70;
          }
        }
        
        .border-rotating {
          animation: borderRotating 4s linear infinite;
        }
        
        .border-pulse {
          animation: borderPulse 2s ease-in-out infinite;
        }
        
        .border-prismatic {
          animation: borderPrismatic 6s ease infinite;
          border-style: solid;
        }
        
        .border-interactive:hover {
          transform: scale(1.05);
          transition: transform 0.3s ease;
        }
      `}</style>
      
      <div
        ref={containerRef}
        className={`${animationClasses[animation]} ${interactive ? 'border-interactive' : ''}`}
        style={{
          width: size,
          height: size * 0.7,
          borderRadius: `${radius}px`,
          border: animation === 'prismatic-rainbow' 
            ? `${thickness}px solid transparent`
            : `${thickness}px solid ${color}`,
          boxShadow: glowShadows[glow_intensity] || glowShadows.medium,
          background: 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(30,41,59,0.95))',
          position: 'relative',
          overflow: 'hidden',
          transition: 'transform 0.3s ease'
        }}
      >
        {/* Canvas para partículas */}
        {particles && (
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: -thickness,
              left: -thickness,
              width: size,
              height: size * 0.7,
              pointerEvents: 'none'
            }}
          />
        )}
        
        {/* Conteúdo mock */}
        <div style={{
          padding: '12px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          gap: '6px'
        }}>
          <div style={{
            height: '8px',
            borderRadius: '4px',
            background: 'rgba(255, 255, 255, 0.15)',
            width: '80%'
          }}/>
          <div style={{
            height: '8px',
            borderRadius: '4px',
            background: 'rgba(255, 255, 255, 0.10)',
            width: '60%'
          }}/>
          <div style={{
            height: '8px',
            borderRadius: '4px',
            background: 'rgba(255, 255, 255, 0.08)',
            width: '70%'
          }}/>
        </div>
        
        {/* Indicador de raridade */}
        {animation !== 'static-glow' && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            background: `radial-gradient(circle, ${color}40, transparent)`,
            pointerEvents: 'none'
          }}/>
        )}
      </div>
    </>
  );
};

export default AdvancedBorderPreview;
