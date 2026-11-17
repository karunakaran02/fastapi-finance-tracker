import React, { memo } from 'react';
import { useTheme } from '../context/ThemeContext';
import ReflectiveCard from './ReflectiveCard';

export const KpiCard = memo(function KpiCard({
  children,
  className = '',
  variant,
  theme: propTheme,
  width = '100%',
  height = '100%',
  radius = 24,
  bevel = 2.5,
  metalness,
  roughness,
  blurStrength,
  shine,
  glare,
  grayscale = 1,
  warp = 0.15,
  warpScale = 1,
  tiltStrength = 7,
  enableTilt = true,
  intro = false,
  tint = '#ffffff',
  ...rest
}) {
  const themeContext = useTheme();
  const activeTheme = propTheme || themeContext?.theme || 'dark';
  const isLight = activeTheme === 'light';

  const resolvedMetalness = metalness ?? (isLight ? 0.7 : 0.4);
  const resolvedRoughness = roughness ?? (isLight ? 0.28 : 0.45);
  const resolvedBlurStrength = blurStrength ?? (isLight ? 8 : 12);
  const resolvedShine = shine ?? (isLight ? 0.45 : 0.15);
  const resolvedGlare = glare ?? (isLight ? 0.55 : 0.2);

  const combinedClasses = Array.from(
    new Set(
      ['dashboard-kpi-card', variant ? `dashboard-kpi-${variant}` : '', className]
        .filter(Boolean)
        .join(' ')
        .split(/\s+/)
        .filter(Boolean)
    )
  ).join(' ');

  return (
    <ReflectiveCard
      theme={activeTheme}
      width={width}
      height={height}
      radius={radius}
      bevel={bevel}
      metalness={resolvedMetalness}
      roughness={resolvedRoughness}
      blurStrength={resolvedBlurStrength}
      shine={resolvedShine}
      glare={resolvedGlare}
      grayscale={grayscale}
      warp={warp}
      warpScale={warpScale}
      tiltStrength={tiltStrength}
      enableTilt={enableTilt}
      intro={intro}
      tint={tint}
      className={combinedClasses}
      {...rest}
    >
      {children}
    </ReflectiveCard>
  );
});

export default KpiCard;
