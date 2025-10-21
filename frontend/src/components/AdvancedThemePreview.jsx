// Advanced Theme Preview Component
import React, { useEffect, useRef } from 'react';

const AdvancedThemePreview = ({ effects = {}, size = 120 }) => {
  const canvasRef = useRef(null);
  
  const {
    palette = ['#0ea5e9', '#0b1020'],
    bg_effect = 'solid',
    timer_reactive = false,
    ambient_particles = false
  } = effects;

  const [primary, secondary, tertiary] = palette;

  // Animação de partículas ambiente
  useEffect(() => {
    if (!ambient_particles || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    canvas.width = size;
    canvas.height = size * 0.7;

    const particlesArray = [];
    const particleCount = 15;

    class AmbientParticle {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = Math.random() * canvas.width;
        this.y = Math.random() * canvas.height;
        this.size = Math.random() * 2 + 0.5;
        this.speedX = (Math.random() - 0.5) * 0.3;
        this.speedY = (Math.random() - 0.5) * 0.3;
        this.opacity = Math.random() * 0.3 + 0.1;
      }

      update() {
        this.x += this.speedX;
        this.y += this.speedY;

        if (this.x < 0 || this.x > canvas.width) this.speedX *= -1;
        if (this.y < 0 || this.y > canvas.height) this.speedY *= -1;
        
        this.opacity = Math.sin(Date.now() * 0.001 + this.x * 0.01) * 0.2 + 0.2;
      }

      draw() {
        ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    for (let i = 0; i < particleCount; i++) {
      particlesArray.push(new AmbientParticle());
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
  }, [ambient_particles, size]);

  const getBackground = () => {
    switch (bg_effect) {
      case 'animated-gradient':
        return `linear-gradient(45deg, ${primary}, ${secondary})`;
      case 'dynamic-gradient':
        return `linear-gradient(135deg, ${primary}, ${secondary}, ${tertiary || primary})`;
      case 'parallax-nebula':
        return `radial-gradient(ellipse at 30% 40%, ${primary}60, transparent 50%),
                radial-gradient(ellipse at 70% 60%, ${secondary}40, transparent 50%),
                linear-gradient(180deg, ${secondary}, ${tertiary || '#000'})`;
      default:
        return `linear-gradient(135deg, ${secondary}, ${tertiary || '#0a0a0a'})`;
    }
  };

  const animationClass = {
    'animated-gradient': 'theme-animated',
    'dynamic-gradient': 'theme-dynamic',
    'parallax-nebula': 'theme-parallax'
  }[bg_effect] || '';

  return (
    <>
      <style>{`
        @keyframes themeAnimated {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        
        @keyframes themeDynamic {
          0%, 100% {
            background-position: 0% 50%;
            filter: hue-rotate(0deg);
          }
          50% {
            background-position: 100% 50%;
            filter: hue-rotate(30deg);
          }
        }
        
        @keyframes themeParallax {
          0%, 100% {
            background-position: 0% 0%, 100% 100%, 50% 50%;
          }
          50% {
            background-position: 100% 100%, 0% 0%, 50% 50%;
          }
        }
        
        .theme-animated {
          background-size: 200% 200%;
          animation: themeAnimated 4s ease infinite;
        }
        
        .theme-dynamic {
          background-size: 200% 200%;
          animation: themeDynamic 5s ease infinite;
        }
        
        .theme-parallax {
          background-size: 300% 300%, 300% 300%, 100% 100%;
          animation: themeParallax 8s ease-in-out infinite;
        }
        
        .theme-reactive-indicator {
          animation: reactiveGlow 3s ease-in-out infinite;
        }
        
        @keyframes reactiveGlow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.05); }
        }
      `}</style>
      
      <div
        className={animationClass}
        style={{
          width: size,
          height: size * 0.7,
          borderRadius: '12px',
          background: getBackground(),
          border: '1px solid rgba(255, 255, 255, 0.1)',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: `0 4px 20px ${primary}30, 0 0 40px ${primary}20`
        }}
      >
        {/* Canvas para partículas */}
        {ambient_particles && (
          <canvas
            ref={canvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              pointerEvents: 'none'
            }}
          />
        )}
        
        {/* Header mockup */}
        <div style={{
          height: '24px',
          background: primary,
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          gap: '4px'
        }}>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.7)'
          }}/>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.7)'
          }}/>
          <div style={{
            width: '6px',
            height: '6px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.7)'
          }}/>
        </div>
        
        {/* Content mockup */}
        <div style={{
          padding: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{
            height: '20px',
            borderRadius: '6px',
            background: 'rgba(255, 255, 255, 0.08)',
            width: '80%'
          }}/>
          <div style={{
            display: 'flex',
            gap: '4px',
            marginTop: '4px'
          }}>
            <div style={{
              flex: 1,
              height: '14px',
              borderRadius: '4px',
              background: primary,
              opacity: 0.8
            }}/>
            <div style={{
              width: '32px',
              height: '14px',
              borderRadius: '4px',
              background: primary,
              opacity: 0.8
            }}/>
          </div>
        </div>
        
        {/* Timer reactive indicator */}
        {timer_reactive && (
          <div
            className="theme-reactive-indicator"
            style={{
              position: 'absolute',
              bottom: '6px',
              right: '6px',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${primary}, transparent)`,
              border: `2px solid ${primary}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: primary
            }}/>
          </div>
        )}
        
        {/* Parallax layers */}
        {bg_effect === 'parallax-nebula' && (
          <>
            <div style={{
              position: 'absolute',
              top: '10%',
              left: '20%',
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${primary}40, transparent)`,
              filter: 'blur(8px)',
              animation: 'themeParallax 6s ease-in-out infinite'
            }}/>
            <div style={{
              position: 'absolute',
              bottom: '20%',
              right: '15%',
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${secondary}30, transparent)`,
              filter: 'blur(10px)',
              animation: 'themeParallax 8s ease-in-out infinite reverse'
            }}/>
          </>
        )}
      </div>
    </>
  );
};

export default AdvancedThemePreview;
