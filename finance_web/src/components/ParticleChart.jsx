import React, {
  forwardRef,
  useRef,
  useState,
  useMemo,
  useEffect,
  useLayoutEffect,
  useCallback,
  useImperativeHandle,
  useSyncExternalStore
} from "react";
import "./ParticleChart.css";

const FONT_SANS = "var(--font-sans, ui-sans-serif), ui-sans-serif, system-ui, -apple-system, \"Segoe UI\", sans-serif";
const SHADE_FACTORS = [-0.2, -0.07, 0.05, 0.18, 0.52];

const clamp = (val, min, max) => Math.min(max, Math.max(min, val));
const finiteNumber = (val, fallback) => (typeof val === "number" && Number.isFinite(val) ? val : fallback);
const pseudoRandom = (seed1, seed2) => {
  const n = 43758.5453 * Math.sin(127.1 * (seed1 || 0) + 311.7 * (seed2 || 0));
  return n - Math.floor(n);
};
const pickShade = (x, y) => {
  const p = pseudoRandom(x, y);
  const p2 = pseudoRandom(1.3 * (y || 0), 0.7 * (x || 0));
  if (0.06 > p) return SHADE_FACTORS.length - 1;
  return clamp(Math.floor(p2 * (SHADE_FACTORS.length - 1)), 0, SHADE_FACTORS.length - 1);
};

const listenReducedMotion = (cb) => {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", cb);
  return () => media.removeEventListener("change", cb);
};
const checkReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const parseColorToRgba = (color, ctx) => {
  if (!ctx) return null;
  ctx.fillStyle = "#010203";
  ctx.fillStyle = color;
  if ("#010203" === String(ctx.fillStyle) && "#010203" !== color.trim().toLowerCase()) return null;
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillRect(0, 0, 1, 1);
  const data = ctx.getImageData(0, 0, 1, 1).data;
  return [data[0], data[1], data[2], data[3] / 255];
};

const getLuminance = (rgba) => {
  if (!rgba || rgba[3] < 0.5) return -1;
  const channel = (val) => {
    const s = val / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgba[0]) + 0.7152 * channel(rgba[1]) + 0.0722 * channel(rgba[2]);
};

const tintRgba = (rgba, factor, alpha = 1) => {
  const target = 255 * (factor >= 0 ? 1 : 0);
  const absFactor = Math.abs(factor);
  const blend = (c) => Math.round(c + (target - c) * absFactor);
  return `rgba(${blend(rgba[0])}, ${blend(rgba[1])}, ${blend(rgba[2])}, ${alpha})`;
};

const cn = (...classes) => classes.filter(Boolean).join(" ");

export const ParticleChart = forwardRef(function ParticleChart(
  {
    series = [],
    data,
    defaultSeries = 0,
    switcher,
    autoplay = false,
    interval = 5200,
    height = 240,
    barWidth = 72,
    grain = 2.2,
    spacing = 2.8,
    jitter = 0.35,
    mound = 0.6,
    shape = "circle",
    pour = "stream",
    arc = 0.5,
    speed = 1,
    gravity = 1,
    max: maxValue,
    prefix = "",
    suffix = "k",
    decimals,
    summary = true,
    summaryLabel = "Total visits",
    values = true,
    labels = true,
    track = true,
    baseline = false,
    surface = true,
    radius = 20,
    interactive = true,
    theme = "auto",
    accentColor,
    textColor,
    surfaceColor,
    onSeriesChange,
    className,
    style
  },
  ref
) {
  const rootRef = useRef(null);
  const innerRef = useRef(null);
  const plotRef = useRef(null);
  const canvasRef = useRef(null);
  const trackCanvasRef = useRef(null);
  const valLabelsRef = useRef([]);
  const summaryValRef = useRef(null);
  const tabsListRef = useRef(null);
  const tabButtonsRef = useRef([]);
  const sweepBarRef = useRef(null);
  const simRef = useRef({
    now: 0,
    columns: [],
    dust: [],
    started: false,
    revealed: [],
    tops: [],
    totalFrom: 0,
    totalTo: 0,
    totalAt: 0,
    totalSpan: 1,
    pointer: { x: 0, y: 0, vx: 0, vy: 0, t: 0 }
  });
  const wakeLoopRef = useRef(() => {});
  const lastValRef = useRef([]);
  const lastTotalRef = useRef(null);
  const physicsParamsRef = useRef({ speed, arc, pour, gravity });
  const onSeriesChangeRef = useRef(onSeriesChange);
  const reducedMotion = useSyncExternalStore(listenReducedMotion, checkReducedMotion, () => false);

  const [containerWidth, setContainerWidth] = useState(0);
  const [isAutoDark, setIsAutoDark] = useState(false);
  const [parsedAccent, setParsedAccent] = useState(null);
  const [activeSeriesIdx, setActiveSeriesIdx] = useState(() => Math.max(0, Math.round(finiteNumber(defaultSeries, 0))));
  const [hoveredBarIdx, setHoveredBarIdx] = useState(-1);
  const [isHovered, setIsHovered] = useState(false);
  const [inView, setInView] = useState(false);
  const [pillRect, setPillRect] = useState({ left: 0, width: 0 });

  const isDarkMode = theme === "auto" ? isAutoDark : theme === "dark";

  const palette = useMemo(() => {
    const baseAccent = parsedAccent ?? (isDarkMode ? [169, 155, 255, 1] : [82, 39, 255, 1]);
    const shift = isDarkMode ? 0 : -0.04;
    return {
      text: textColor || (isDarkMode ? "#EDEDEF" : "#18181B"),
      muted: isDarkMode ? "#8C8C95" : "#71717A",
      line: isDarkMode ? "rgba(255,255,255,0.14)" : "rgba(0,0,0,0.12)",
      panel: surfaceColor || (isDarkMode ? "rgba(255,255,255,0.035)" : "rgba(0,0,0,0.028)"),
      ghost: isDarkMode ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.065)",
      pill: isDarkMode ? "rgba(255,255,255,0.075)" : "rgba(0,0,0,0.05)",
      sweep: isDarkMode
        ? parsedAccent
          ? tintRgba(parsedAccent, 0, 0.25)
          : "rgba(255,255,255,0.055)"
        : parsedAccent
        ? tintRgba(parsedAccent, 0, 0.2)
        : "rgba(0,0,0,0.045)",
      rise: isDarkMode ? "#5EDB8A" : "#15803D",
      shades: SHADE_FACTORS.map((f) => tintRgba(baseAccent, f + shift)),
      bright: SHADE_FACTORS.map((f) => tintRgba(baseAccent, (isDarkMode ? 0.26 : 0.12) + 0.55 * f))
    };
  }, [parsedAccent, isDarkMode, surfaceColor, textColor]);

  const rawSeriesJson = JSON.stringify(data ? [{ name: "", data }] : series);
  const normalizedSeries = useMemo(
    () => JSON.parse(rawSeriesJson).filter((s) => s && Array.isArray(s.data) && s.data.length > 0),
    [rawSeriesJson]
  );
  const currentSeriesIdx = normalizedSeries.length ? clamp(activeSeriesIdx, 0, normalizedSeries.length - 1) : 0;
  const currentData = useMemo(() => normalizedSeries[currentSeriesIdx]?.data ?? [], [normalizedSeries, currentSeriesIdx]);
  const barCount = currentData.length;
  const showTabs = (switcher ?? true) && normalizedSeries.length > 1;

  const computedMaxVal = useMemo(() => {
    if (typeof maxValue === "number" && Number.isFinite(maxValue) && maxValue > 0) return maxValue;
    let peak = 0;
    normalizedSeries.forEach((s) => s.data.forEach((d) => (peak = Math.max(peak, finiteNumber(d.value, 0)))));
    return peak > 0 ? 1.16 * peak : 1;
  }, [normalizedSeries, maxValue]);

  const computedDecimals = useMemo(() => {
    if (typeof decimals === "number") return clamp(Math.round(decimals), 0, 4);
    let dec = 0;
    normalizedSeries.forEach((s) =>
      s.data.forEach((d) => {
        const str = String(d.value);
        const idx = str.indexOf(".");
        if (idx >= 0) dec = Math.max(dec, Math.min(3, str.length - idx - 1));
      })
    );
    return dec;
  }, [decimals, normalizedSeries]);

  const numFormatter = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: computedDecimals,
        maximumFractionDigits: computedDecimals
      }),
    [computedDecimals]
  );

  const seriesTotals = useMemo(
    () => normalizedSeries.map((s) => s.data.reduce((acc, d) => acc + finiteNumber(d.value, 0), 0)),
    [normalizedSeries]
  );
  const activeTotal = seriesTotals[currentSeriesIdx] ?? 0;
  const previousTotal = currentSeriesIdx > 0 ? seriesTotals[currentSeriesIdx - 1] : null;
  const changePercent = previousTotal ? ((activeTotal - previousTotal) / previousTotal) * 100 : null;

  const plotHeight = clamp(finiteNumber(height, 240), 80, 900);
  const grainSpacing = clamp(finiteNumber(spacing, 2.8), 1.5, 12);
  const grainRadius = clamp(finiteNumber(grain, 2.2), 0.6, grainSpacing);
  const colSlotWidth = barCount > 0 && containerWidth > 0 ? containerWidth / barCount : 0;
  const actualBarWidth = Math.max(2 * grainSpacing, Math.min(clamp(finiteNumber(barWidth, 72), 6, 400), 0.66 * colSlotWidth));
  const fullCanvasHeight = 44 + plotHeight;
  const topOffset = summary || showTabs ? 64 : 0;

  useEffect(() => {
    physicsParamsRef.current = { speed, arc, pour, gravity };
    onSeriesChangeRef.current = onSeriesChange;
  });

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setContainerWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const doc = root.ownerDocument;
    const win = doc.defaultView ?? window;
    const canvas = doc.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    const evaluateTheme = () => {
      const activeSeries = normalizedSeries[currentSeriesIdx];
      const activeColor =
        typeof accentColor === "function"
          ? accentColor(currentSeriesIdx, activeSeries)
          : activeSeries?.color || activeSeries?.accentColor || accentColor;
      if (activeColor) {
        setParsedAccent(parseColorToRgba(activeColor, ctx));
      } else {
        setParsedAccent(null);
      }
      if (theme === "auto") {
        let parent = root.parentElement;
        let view = root.ownerDocument.defaultView;
        let detectedDark = false;
        for (let step = 0; step < 4 && view; step += 1) {
          while (parent) {
            const bg = view.getComputedStyle(parent).backgroundColor;
            const lum = getLuminance(parseColorToRgba(bg, ctx));
            if (lum >= 0) {
              setIsAutoDark(lum < 0.35);
              return;
            }
            parent = parent.parentElement;
          }
          break;
        }
        const docElem = doc.documentElement;
        if (docElem.classList.contains("dark") || docElem.getAttribute("data-theme") === "dark") {
          setIsAutoDark(true);
          return;
        }
        if (docElem.classList.contains("light") || docElem.getAttribute("data-theme") === "light") {
          setIsAutoDark(false);
          return;
        }
        setIsAutoDark(win.matchMedia("(prefers-color-scheme: dark)").matches);
      }
    };
    evaluateTheme();
    const mo = new MutationObserver(evaluateTheme);
    mo.observe(doc.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    if (doc.body) mo.observe(doc.body, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    return () => mo.disconnect();
  }, [theme, accentColor, currentSeriesIdx, normalizedSeries]);

  useEffect(() => {
    wakeLoopRef.current();
  }, [palette]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);

  const getBarSlots = useCallback(
    (barIdx) => {
      const left = colSlotWidth * (barIdx + 0.5) - actualBarWidth / 2;
      const numCols = Math.max(2, Math.floor(actualBarWidth / grainSpacing));
      const marginX = (actualBarWidth - (numCols - 1) * grainSpacing) / 2;
      const stepY = 0.88 * grainSpacing;
      const numRows = Math.ceil(plotHeight / stepY) + 6;
      const baseY = 44 + plotHeight - grainRadius / 2 - 0.5;
      const jitterAmp = clamp(finiteNumber(jitter, 0.35), 0, 1) * grainSpacing * 0.32;
      const moundAmp = 5 * clamp(finiteNumber(mound, 0.6), 0, 1);
      const slots = [];
      for (let r = 0; r < numRows; r += 1) {
        const offsetX = r % 2 ? grainSpacing / 2 : 0;
        const colsInRow = r % 2 ? numCols - 1 : numCols;
        for (let c = 0; c < colsInRow; c += 1) {
          const posX = left + marginX + c * grainSpacing + offsetX;
          const distNorm = Math.pow((posX - (left + actualBarWidth / 2)) / (actualBarWidth / 2), 2);
          const jX = (pseudoRandom(97 * barIdx + r, c) - 0.5) * 2 * jitterAmp;
          const jY = (pseudoRandom(53 * c + barIdx, r) - 0.5) * 2 * jitterAmp;
          slots.push({
            x: posX + jX,
            y: baseY - r * stepY + jY,
            priority: r + moundAmp * distNorm + 0.35 * pseudoRandom(r, 7 * c + barIdx)
          });
        }
      }
      slots.sort((a, b) => a.priority - b.priority);
      return {
        slots: slots.map(({ x, y }) => ({ x, y })),
        cols: numCols - 0.5,
        left,
        width: actualBarWidth
      };
    },
    [actualBarWidth, grainRadius, jitter, mound, grainSpacing, plotHeight, colSlotWidth]
  );

  const getGrainTarget = useCallback(
    (val, cols) => {
      const stepY = 0.88 * grainSpacing;
      return Math.max(0, Math.round((clamp(val, 0, computedMaxVal) / computedMaxVal) * plotHeight * (cols / stepY)));
    },
    [computedMaxVal, grainSpacing, plotHeight]
  );

  useLayoutEffect(() => {
    const sim = simRef.current;
    if (!colSlotWidth || !barCount) return;
    const newColumns = [];
    for (let i = 0; i < barCount; i += 1) {
      const barGeom = getBarSlots(i);
      const prevCol = sim.columns[i];
      const grains = prevCol ? prevCol.grains : [];
      grains.forEach((g, idx) => {
        const slot = barGeom.slots[Math.min(idx, barGeom.slots.length - 1)];
        if (g.mode === 0 || g.mode === 3) {
          g.x = slot.x;
          g.y = slot.y;
        }
        g.bar = i;
      });
      const cellSize = clamp(2.2 * grainSpacing, 5, 9);
      const nx = Math.ceil(barGeom.width / cellSize) + 3;
      const ny = Math.ceil(plotHeight / cellSize) + 3;
      const gridLen = nx * ny;
      const field = {
        nx,
        ny,
        left: barGeom.left - cellSize,
        top: 44 - cellSize,
        cell: cellSize,
        u: new Float32Array(gridLen),
        w: new Float32Array(gridLen),
        vu: new Float32Array(gridLen),
        vw: new Float32Array(gridLen),
        active: false
      };
      newColumns.push({
        slots: barGeom.slots,
        grains,
        cols: barGeom.cols,
        left: barGeom.left,
        width: barGeom.width,
        field
      });
    }
    sim.columns = newColumns;
    wakeLoopRef.current();
  }, [barCount, getBarSlots, grainSpacing, plotHeight, colSlotWidth]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const sim = simRef.current;
    if (!canvas || !containerWidth || !sim.columns.length) return;
    const doc = canvas.ownerDocument;
    const dpr = Math.min(2, (doc.defaultView ?? window).devicePixelRatio || 1);
    const trackCanvas = trackCanvasRef.current ?? doc.createElement("canvas");
    trackCanvasRef.current = trackCanvas;
    trackCanvas.width = Math.max(1, Math.round(containerWidth * dpr));
    trackCanvas.height = Math.max(1, Math.round(fullCanvasHeight * dpr));
    const ctx = trackCanvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, containerWidth, fullCanvasHeight);
    if (!track) {
      wakeLoopRef.current();
      return;
    }
    const radius = grainRadius / 2;
    const minY = 44 + radius + 1;
    ctx.beginPath();
    sim.columns.forEach((col) => {
      const maxCorner = Math.min(col.width / 2, 14);
      col.slots.forEach((s) => {
        if (s.y < minY) return;
        const dy = minY + maxCorner - s.y;
        if (dy > 0) {
          const dx = Math.max(col.left + maxCorner - s.x, s.x - (col.left + col.width - maxCorner), 0);
          if (dx * dx + dy * dy > maxCorner * maxCorner) return;
        }
        if (shape === "square") {
          ctx.rect(s.x - radius, s.y - radius, 2 * radius, 2 * radius);
        } else {
          ctx.moveTo(s.x + radius, s.y);
          ctx.arc(s.x, s.y, radius, 0, 2 * Math.PI);
        }
      });
    });
    ctx.fillStyle = palette.ghost;
    ctx.fill();
    wakeLoopRef.current();
  }, [fullCanvasHeight, grainRadius, getBarSlots, palette.ghost, shape, track, containerWidth, barCount, colSlotWidth]);

  const scheduleTransition = useCallback(() => {
    const sim = simRef.current;
    if (!sim.columns.length) return;
    const { arc: arcFactor, pour: pourStyle } = physicsParamsRef.current;
    const now = sim.now;
    const targetCounts = sim.columns.map((col, idx) =>
      Math.min(col.slots.length, getGrainTarget(finiteNumber(currentData[idx]?.value, 0), col.cols))
    );
    const newTotal = currentData.reduce((acc, d) => acc + finiteNumber(d.value, 0), 0);
    const prevTotalVal = lastTotalRef.current ?? 0;
    sim.totalFrom = sim.started ? prevTotalVal : 0;
    sim.totalTo = newTotal;
    sim.totalAt = now;
    sim.totalSpan = sim.started ? 1100 : 1700;

    if (reducedMotion) {
      sim.columns.forEach((col, idx) => {
        col.grains = col.grains.slice(0, targetCounts[idx]);
        while (col.grains.length < targetCounts[idx]) {
          const gIdx = col.grains.length;
          col.grains.push({
            bar: idx,
            from: idx,
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            t0: 0,
            lvx: 0,
            lvy: 0,
            mode: 0,
            ballistic: false,
            kicked: false,
            shade: pickShade(31 * idx + gIdx, 0.37 * gIdx),
            alpha: 1,
            life: 0
          });
        }
        col.grains.forEach((g, gIdx) => {
          g.mode = 0;
          g.x = col.slots[gIdx].x;
          g.y = col.slots[gIdx].y;
          g.alpha = 1;
        });
      });
      sim.dust = [];
      sim.totalFrom = newTotal;
      sim.started = true;
      return;
    }

    const gAcc = 2200 * clamp(finiteNumber(physicsParamsRef.current.gravity, 1), 0.2, 3);
    const surplusGrains = [];
    sim.columns.forEach((col, idx) => {
      if (col.grains.length > targetCounts[idx]) {
        col.grains
          .splice(targetCounts[idx])
          .reverse()
          .forEach((g, lifeIdx) => {
            g.from = idx;
            g.life = lifeIdx;
            surplusGrains.push(g);
          });
      }
    });

    const deficitGrains = [];
    sim.columns.forEach((col, idx) => {
      for (let gIdx = col.grains.length; gIdx < targetCounts[idx]; gIdx += 1) {
        deficitGrains.push({ bar: idx, index: gIdx });
      }
    });

    surplusGrains.sort((a, b) => a.from - b.from || a.life - b.life);
    const transferCount = Math.min(surplusGrains.length, deficitGrains.length);
    const targetMap = new Map();
    const addTransfer = (barIdx, item) => {
      const arr = targetMap.get(barIdx);
      if (arr) arr.push(item);
      else targetMap.set(barIdx, [item]);
    };

    const fromCounts = new Map();
    for (let i = 0; i < transferCount; i += 1) {
      const grain = surplusGrains[i];
      const targetBar = deficitGrains[i].bar;
      const fCount = fromCounts.get(grain.from) ?? 0;
      fromCounts.set(grain.from, fCount + 1);
      const targetX = colSlotWidth * (targetBar + 0.5);
      const targetCol = sim.columns[targetBar];
      const targetSlotIdx = targetCol?.slots?.length ? Math.max(0, Math.min(targetCol.slots.length - 1, targetCol.grains?.length || 0)) : 0;
      const targetSlotY = targetCol?.slots?.[targetSlotIdx]?.y ?? (44 + plotHeight);
      const flightDuration = Math.max(
        0.22,
        Math.min(
          Math.sqrt((8 * Math.max(10, Math.min(grain.y || 0, targetSlotY) - (-topOffset + 18) - Math.abs(targetSlotY - (grain.y || 0)) / 2)) / gAcc),
          (0.36 + 0.32 * clamp(finiteNumber(arcFactor, 0.5), 0, 2)) *
            (1 + (Math.abs(targetX - (grain.x || 0)) / Math.max(1, containerWidth)) * 0.7) *
            (0.9 + 0.2 * pseudoRandom(i, 5.3))
        )
      );
      grain.t0 = now + 2.4 * fCount + 70 * pseudoRandom(i, 1.7);
      grain.mode = 3;
      grain.ballistic = true;
      grain.kicked = false;
      addTransfer(targetBar, {
        grain,
        land: grain.t0 + 1000 * flightDuration,
        flight: flightDuration,
        drop: false
      });
    }

    for (let i = transferCount; i < surplusGrains.length; i += 1) {
      const g = surplusGrains[i];
      g.mode = 2;
      g.t0 = now + (i - transferCount) * 1.4;
      g.vx = (pseudoRandom(i, 2.2) - 0.5) * 60;
      g.vy = -(50 + 90 * pseudoRandom(i, 3.3));
      g.life = 0;
      sim.dust.push(g);
    }

    const deficitBarCounts = new Map();
    for (let i = transferCount; i < deficitGrains.length; i += 1) {
      const bar = deficitGrains[i].bar;
      deficitBarCounts.set(bar, (deficitBarCounts.get(bar) ?? 0) + 1);
    }

    const pouredBarCounts = new Map();
    for (let i = transferCount; i < deficitGrains.length; i += 1) {
      const bar = deficitGrains[i].bar;
      const col = sim.columns[bar];
      const pCount = pouredBarCounts.get(bar) ?? 0;
      pouredBarCounts.set(bar, pCount + 1);
      const isStream = pourStyle !== "rain";
      const startX = isStream
        ? colSlotWidth * (bar + 0.5) + (pseudoRandom(i, 4.4) - 0.5) * 3
        : (col?.left || 0) + pseudoRandom(i, 9.9) * (col?.width || 10);
      const startY = isStream ? -6 - 8 * pseudoRandom(i, 6.6) : -8 - 150 * pseudoRandom(i, 6.6);
      const frac = pCount / Math.max(1, deficitBarCounts.get(bar) ?? 1);
      const startTime = now + (sim.started ? 1.5 * pCount : 1150 * frac + 70 * bar) + 24 * pseudoRandom(i, 7.7);
      const initialVy = 40 * (isStream ? 1 : 0);
      const landingSlotIdx = col?.slots?.length ? Math.max(0, Math.min(col.slots.length - 1, col.grains?.length || 0)) : 0;
      const landingSlotY = col?.slots?.[landingSlotIdx]?.y ?? (44 + plotHeight);
      const dropDuration =
        (-initialVy + Math.sqrt(initialVy * initialVy + 2 * gAcc * Math.max(1, landingSlotY - startY))) / gAcc;
      const newGrain = {
        bar,
        from: bar,
        x: startX,
        y: startY,
        vx: 0,
        vy: 0,
        t0: startTime,
        lvx: 0,
        lvy: initialVy,
        mode: 4,
        ballistic: false,
        kicked: false,
        shade: pickShade(131 * bar + i, 0.71 * i),
        alpha: 0,
        life: 0
      };
      addTransfer(bar, {
        grain: newGrain,
        land: startTime + 1000 * dropDuration,
        flight: dropDuration,
        drop: true
      });
    }

    targetMap.forEach((transfers, bar) => {
      const col = sim.columns[bar];
      if (!col || !col.grains) return;
      transfers.sort((a, b) => a.land - b.land);
      transfers.forEach((item) => {
        const slotIdx = col.grains.length;
        const slot = col.slots ? col.slots[slotIdx] || col.slots[col.slots.length - 1] : null;
        const g = item.grain;
        if (!g) return;
        g.bar = bar;
        if (!item.drop && slot && item.flight > 0) {
          g.lvx = (slot.x - g.x) / item.flight;
          g.lvy = (slot.y - g.y - 0.5 * gAcc * item.flight * item.flight) / item.flight;
        }
        col.grains.push(g);
      });
    });

    sim.started = true;
  }, [topOffset, currentData, reducedMotion, colSlotWidth, getGrainTarget, containerWidth]);

  useEffect(() => {
    if ((inView || reducedMotion) && colSlotWidth && barCount) {
      scheduleTransition();
      wakeLoopRef.current();
    }
  }, [scheduleTransition, inView, reducedMotion, colSlotWidth, barCount]);

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const sim = simRef.current;
    if (!canvas || !containerWidth) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, (canvas.ownerDocument.defaultView ?? window).devicePixelRatio || 1);
    const canvasW = Math.round(containerWidth * dpr);
    const canvasH = Math.round((fullCanvasHeight + topOffset) * dpr);
    if (canvas.width !== canvasW || canvas.height !== canvasH) {
      canvas.width = canvasW;
      canvas.height = canvasH;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, containerWidth, fullCanvasHeight + topOffset);
    ctx.save();
    ctx.translate(0, topOffset);

    if (track && trackCanvasRef.current) {
      ctx.drawImage(trackCanvasRef.current, 0, 0, containerWidth, fullCanvasHeight);
    }

    const radius = grainRadius / 2;
    const isCircle = shape !== "square";
    const shadeCount = SHADE_FACTORS.length;
    const colCount = sim.columns.length;
    const paths = Array.from({ length: colCount }, () =>
      Array.from({ length: shadeCount }, () => new Path2D())
    );
    const transGrains = [];
    const colTops = Array(colCount).fill(44 + plotHeight);
    const stationaryCount = Array(colCount).fill(0);
    const activeMovingCount = Array(colCount).fill(0);

    sim.columns.forEach((col, colIdx) => {
      const topCount = col.grains.length - Math.max(1, Math.round(1.5 * col.cols));
      const field = col.field;
      col.grains.forEach((grain, gIdx) => {
        const sourceBar = grain.mode === 0 ? colIdx : grain.mode === 3 && sim.now < grain.t0 ? grain.from : -1;
        if (sourceBar >= 0 && sourceBar < colCount) {
          stationaryCount[sourceBar] += 1;
          if (grain.y < colTops[sourceBar]) colTops[sourceBar] = grain.y;
        } else if (grain.kicked) {
          stationaryCount[colIdx] += 1;
          const s = col.slots[gIdx];
          if (s && s.y < colTops[colIdx]) colTops[colIdx] = s.y;
        }
        if (grain.mode !== 0 && !grain.kicked) {
          activeMovingCount[colIdx] += 1;
        }
        if (grain.alpha <= 0) return;
        const barAffinity = clamp(sourceBar >= 0 && sourceBar < colCount ? sourceBar : colIdx, 0, Math.max(0, colCount - 1));
        const rawShade =
          sourceBar < 0
            ? grain.shade + 2
            : grain.mode === 0 && gIdx >= topCount
            ? grain.shade + 1
            : grain.shade;
        const shadeIdx = clamp(finiteNumber(rawShade, 0), 0, shadeCount - 1);

        let disp = null;
        if (field.active && grain.mode === 0) {
          const fx = (grain.x - field.left) / field.cell;
          const fy = (grain.y - field.top) / field.cell;
          const gx = Math.floor(fx);
          const gy = Math.floor(fy);
          if (gx >= 0 && gy >= 0 && gx < field.nx - 1 && gy < field.ny - 1) {
            const rx = fx - gx;
            const ry = fy - gy;
            const idx = gy * field.nx + gx;
            const w00 = (1 - rx) * (1 - ry);
            const w10 = rx * (1 - ry);
            const w01 = (1 - rx) * ry;
            const w11 = rx * ry;
            let mu = field.u[idx] * w00 + field.u[idx + 1] * w10 + field.u[idx + field.nx] * w01 + field.u[idx + field.nx + 1] * w11;
            let mw = field.w[idx] * w00 + field.w[idx + 1] * w10 + field.w[idx + field.nx] * w01 + field.w[idx + field.nx + 1] * w11;
            const len = Math.hypot(mu, mw);
            if (len > 11) {
              mu = (mu / len) * 11;
              mw = (mw / len) * 11;
            }
            const minX = col.left + grainRadius / 2;
            const maxX = col.left + col.width - grainRadius / 2;
            const maxY = 44 + plotHeight - grainRadius / 2;
            mu = mu > 0 ? Math.min(mu, 0.85 * Math.max(0, maxX - grain.x)) : Math.max(mu, -(0.85 * Math.max(0, grain.x - minX)));
            if (mw > 0) mw = Math.min(mw, 0.85 * Math.max(0, maxY - grain.y));
            disp = [mu, mw];
          }
        }

        const renderX = disp ? grain.x + disp[0] : grain.x;
        const renderY = disp ? grain.y + disp[1] : grain.y;
        const enterFade = clamp((renderY - radius) / 26, 0, 1);
        const finalAlpha = grain.alpha * enterFade;
        if (finalAlpha <= 0.01) return;
        if (finalAlpha < 0.98) {
          transGrains.push({ x: renderX, y: renderY, a: finalAlpha, bar: barAffinity, shade: shadeIdx });
        } else {
          const path = paths[barAffinity]?.[shadeIdx];
          if (path) {
            if (isCircle) {
              path.moveTo(renderX + radius, renderY);
              path.arc(renderX, renderY, radius, 0, 2 * Math.PI);
            } else {
              path.rect(renderX - radius, renderY - radius, 2 * radius, 2 * radius);
            }
          }
        }
      });
    });

    sim.tops = colTops;

    const getBarColor = (barIdx, shadeIdx) =>
      hoveredBarIdx === barIdx ? palette.bright[shadeIdx] : palette.shades[shadeIdx];
    const getBarAlpha = (barIdx) => (hoveredBarIdx >= 0 && hoveredBarIdx !== barIdx ? 0.5 : 1);

    for (let b = 0; b < colCount; b += 1) {
      ctx.globalAlpha = getBarAlpha(b);
      for (let s = 0; s < shadeCount; s += 1) {
        ctx.fillStyle = getBarColor(b, s);
        if (paths[b]?.[s]) {
          ctx.fill(paths[b][s]);
        }
      }
    }

    transGrains.forEach((tg) => {
      const sIdx = clamp(finiteNumber(tg.shade, 0), 0, shadeCount - 1);
      ctx.globalAlpha = tg.a * getBarAlpha(tg.bar);
      ctx.fillStyle = getBarColor(tg.bar, sIdx);
      ctx.beginPath();
      if (isCircle) ctx.arc(tg.x, tg.y, radius, 0, 2 * Math.PI);
      else ctx.rect(tg.x - radius, tg.y - radius, 2 * radius, 2 * radius);
      ctx.fill();
    });

    sim.dust.forEach((d) => {
      const enterFade = clamp((d.y - radius) / 26, 0, 1);
      const alpha = d.alpha * enterFade;
      if (alpha <= 0.01) return;
      const sIdx = clamp(finiteNumber(d.shade, 0) + 1, 0, shadeCount - 1);
      ctx.globalAlpha = alpha * getBarAlpha(d.from);
      ctx.fillStyle = getBarColor(d.from, sIdx);
      ctx.beginPath();
      if (isCircle) ctx.arc(d.x, d.y, radius, 0, 2 * Math.PI);
      else ctx.rect(d.x - radius, d.y - radius, 2 * radius, 2 * radius);
      ctx.fill();
    });

    ctx.globalAlpha = 1;

    sim.columns.forEach((col, idx) => {
      const lblEl = valLabelsRef.current[idx];
      if (!lblEl) return;
      const targetVal = finiteNumber(currentData[idx]?.value, 0);
      const totalG = col.grains.length;
      const countVal =
        stationaryCount[idx] === totalG && activeMovingCount[idx] === 0
          ? targetVal
          : totalG > 0
          ? stationaryCount[idx] * (targetVal / totalG)
          : 0;
      const barTopY = stationaryCount[idx] > 0 ? colTops[idx] : 44 + plotHeight;
      lblEl.style.transform = `translate(-50%, ${Math.round(barTopY - 44 - 24)}px)`;
      if (sim.started && activeMovingCount[idx] === 0) {
        sim.revealed[idx] = true;
      }
      lblEl.style.opacity = sim.revealed[idx] ? "1" : "0";
      if (lastValRef.current[idx] !== countVal) {
        lastValRef.current[idx] = countVal;
        lblEl.textContent = `${prefix}${numFormatter.format(countVal)}${suffix}`;
      }
    });

    const sumEl = summaryValRef.current;
    if (sumEl) {
      const progress = clamp((sim.now - sim.totalAt) / sim.totalSpan, 0, 1);
      const easeVal = 1 - Math.pow(1 - progress, 3);
      const currentInterp = sim.started ? sim.totalFrom + (sim.totalTo - sim.totalFrom) * easeVal : 0;
      const finalVal = progress >= 1 ? sim.totalTo : currentInterp;
      if (lastTotalRef.current !== finalVal) {
        lastTotalRef.current = finalVal;
        sumEl.textContent = `${prefix}${numFormatter.format(finalVal)}${suffix}`;
      }
    }
    ctx.restore();
  }, [topOffset, fullCanvasHeight, currentData, grainRadius, numFormatter, hoveredBarIdx, palette, plotHeight, prefix, shape, suffix, track, containerWidth]);

  const updatePhysics = useCallback((dt) => {
    const sim = simRef.current;
    const { speed: spd, gravity: grav } = physicsParamsRef.current;
    const speedMult = clamp(finiteNumber(spd, 1), 0.2, 4);
    const gAcc = 2200 * clamp(finiteNumber(grav, 1), 0.2, 3);
    sim.now += dt * speedMult;
    const now = sim.now;
    const stepSeconds = (dt / 1000) * speedMult;
    let keepAnimating = now < sim.totalAt + sim.totalSpan;

    sim.columns.forEach((col) => {
      const field = col.field;
      if (!field.active) return;
      const { nx, ny, u, w, vu, vw } = field;
      const invH2 = 1 / (field.cell * field.cell);
      let rem = stepSeconds;
      let maxDelta = 0;
      while (rem > 0) {
        const subDt = Math.min(rem, 1 / 120);
        rem -= subDt;
        for (let y = 1; y < ny - 1; y += 1) {
          for (let x = 1; x < nx - 1; x += 1) {
            const idx = y * nx + x;
            const lapU = (u[idx - 1] + u[idx + 1] + u[idx - nx] + u[idx + nx] - 4 * u[idx]) * invH2;
            const lapW = (w[idx - 1] + w[idx + 1] + w[idx - nx] + w[idx + nx] - 4 * w[idx]) * invH2;
            vu[idx] += (57600 * lapU - 3 * vu[idx] - 26 * u[idx]) * subDt;
            vw[idx] += (57600 * lapW - 3 * vw[idx] - 26 * w[idx]) * subDt;
          }
        }
        for (let i = 0; i < u.length; i += 1) {
          u[i] += vu[i] * subDt;
          w[i] += vw[i] * subDt;
        }
      }
      for (let i = 0; i < u.length; i += 1) {
        maxDelta = Math.max(maxDelta, Math.abs(u[i]), Math.abs(w[i]), 0.05 * Math.abs(vu[i]), 0.05 * Math.abs(vw[i]));
      }
      if (maxDelta < 0.03) {
        u.fill(0);
        w.fill(0);
        vu.fill(0);
        vw.fill(0);
        field.active = false;
      } else {
        keepAnimating = true;
      }
    });

    sim.columns.forEach((col, colIdx) => {
      col.grains.forEach((grain, gIdx) => {
        if (grain.mode === 0) return;
        const targetSlot = col.slots[gIdx];
        if (!targetSlot) return;
        keepAnimating = true;
        if (grain.mode === 3 || grain.mode === 4) {
          if (now < grain.t0) return;
          grain.vx = grain.lvx;
          grain.vy = grain.lvy;
          grain.mode = 1;
        }
        let rem = stepSeconds;
        while (rem > 0) {
          const subDt = Math.min(rem, 1 / 120);
          rem -= subDt;
          grain.vy += gAcc * subDt;
          if (!grain.ballistic) {
            const pull = clamp(1 - (targetSlot.y - grain.y) / 90, 0, 1);
            const spring = 24 + 160 * pull * pull;
            grain.vx += (spring * (targetSlot.x - grain.x) - 2 * Math.sqrt(spring) * grain.vx) * subDt;
          }
          grain.x += grain.vx * subDt;
          grain.y += grain.vy * subDt;
          if (grain.vy > 0 && grain.y >= targetSlot.y) {
            grain.x = targetSlot.x;
            grain.y = targetSlot.y;
            grain.vx = 0;
            grain.vy = 0;
            grain.mode = 0;
            grain.alpha = 1;
            grain.kicked = false;
            break;
          }
        }
        if (grain.mode === 1) {
          grain.alpha = clamp(grain.alpha + 7 * stepSeconds, 0, 1);
        }
        grain.bar = colIdx;
      });
    });

    sim.dust = sim.dust.filter((d) => {
      if (now < d.t0) {
        keepAnimating = true;
        return true;
      }
      d.life += stepSeconds;
      d.vy -= 60 * stepSeconds;
      d.x += d.vx * stepSeconds;
      d.y += d.vy * stepSeconds;
      d.alpha = clamp(1 - d.life / 0.9, 0, 1);
      if (d.alpha > 0) keepAnimating = true;
      return d.alpha > 0;
    });

    return keepAnimating;
  }, []);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const doc = root.ownerDocument;
    const win = doc.defaultView ?? window;
    let isTicking = false;
    let animId = 0;
    let lastTime = 0;
    let isVisible = true;

    const tick = (time) => {
      animId = 0;
      isTicking = true;
      const dt = lastTime ? Math.min(40, time - lastTime) : 16;
      lastTime = time;
      const keepGoing = updatePhysics(dt);
      renderFrame();
      isTicking = false;
      if (keepGoing && isVisible && !doc.hidden) {
        animId = win.requestAnimationFrame(tick);
      }
    };

    const wakeLoop = () => {
      if (!animId && !isTicking && !doc.hidden) {
        lastTime = 0;
        animId = win.requestAnimationFrame(tick);
      }
    };
    wakeLoopRef.current = wakeLoop;

    const io = new IntersectionObserver((entries) => {
      isVisible = entries.some((e) => e.isIntersecting);
      if (isVisible) wakeLoop();
    });
    io.observe(root);

    const onVisChange = () => wakeLoop();
    doc.addEventListener("visibilitychange", onVisChange);
    wakeLoop();

    return () => {
      wakeLoopRef.current = () => {};
      io.disconnect();
      doc.removeEventListener("visibilitychange", onVisChange);
      win.cancelAnimationFrame(animId);
    };
  }, [renderFrame, updatePhysics]);

  const scheduleTransitionRef = useRef(scheduleTransition);
  scheduleTransitionRef.current = scheduleTransition;

  const selectSeries = useCallback(
    (idx) => {
      if (!normalizedSeries.length) return;
      const clampedIdx = ((idx % normalizedSeries.length) + normalizedSeries.length) % normalizedSeries.length;
      if (clampedIdx === currentSeriesIdx) {
        scheduleTransitionRef.current?.();
      } else {
        setActiveSeriesIdx(clampedIdx);
      }
      onSeriesChangeRef.current?.(clampedIdx);
      wakeLoopRef.current();
    },
    [normalizedSeries.length, currentSeriesIdx]
  );

  useImperativeHandle(
    ref,
    () => ({
      next: () => selectSeries(currentSeriesIdx + 1),
      prev: () => selectSeries(currentSeriesIdx - 1),
      goTo: (idx) => selectSeries(idx)
    }),
    [currentSeriesIdx, selectSeries]
  );

  const shouldAutoplay = autoplay && normalizedSeries.length > 1 && inView && !isHovered && !reducedMotion;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    if (!shouldAutoplay) {
      if (sweepBarRef.current) sweepBarRef.current.style.transform = "scaleX(0)";
      return;
    }
    const win = root.ownerDocument.defaultView ?? window;
    const duration = Math.max(1500, finiteNumber(interval, 5200));
    let start = 0;
    let raf = 0;
    const onTick = (now) => {
      if (!start) start = now;
      const progress = clamp((now - start) / duration, 0, 1);
      if (sweepBarRef.current) {
        sweepBarRef.current.style.transform = `scaleX(${progress})`;
      }
      if (progress >= 1) {
        selectSeries(currentSeriesIdx + 1);
      } else {
        raf = win.requestAnimationFrame(onTick);
      }
    };
    raf = win.requestAnimationFrame(onTick);
    return () => win.cancelAnimationFrame(raf);
  }, [currentSeriesIdx, interval, shouldAutoplay, selectSeries]);

  useLayoutEffect(() => {
    const tabsList = tabsListRef.current;
    const activeBtn = tabButtonsRef.current[currentSeriesIdx];
    if (!tabsList || !activeBtn) return;
    const rect = { left: activeBtn.offsetLeft, width: activeBtn.offsetWidth };
    setPillRect((prev) => (prev.left === rect.left && prev.width === rect.width ? prev : rect));
  }, [currentSeriesIdx, normalizedSeries, containerWidth, showTabs, summary]);

  const getCanvasCoords = (e) => {
    const plot = plotRef.current;
    if (!plot) return null;
    const rect = plot.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / Math.max(1, rect.width)) * containerWidth,
      y: ((e.clientY - rect.top) / Math.max(1, rect.height)) * fullCanvasHeight
    };
  };

  const ariaLabel = currentData.map((d) => `${d.label} ${prefix}${numFormatter.format(finiteNumber(d.value, 0))}${suffix}`).join(", ");
  const panelRadius = clamp(finiteNumber(radius, 20), 0, 48);
  const showHeader = summary || showTabs;

  return (
    <div
      ref={rootRef}
      className={cn("particle-chart-root", surface && "particle-chart-surface", className)}
      style={{
        "--pc-text": palette.text,
        "--pc-muted": palette.muted,
        "--pc-surface": palette.panel,
        "--pc-radius": `${panelRadius}px`,
        "--pc-accent-sweep": palette.sweep,
        ...style
      }}
      onPointerEnter={() => setIsHovered(true)}
      onPointerLeave={() => {
        setIsHovered(false);
        setHoveredBarIdx(-1);
        simRef.current.pointer.t = 0;
      }}
    >
      <div ref={innerRef} className="particle-chart-inner">
        {showHeader ? (
          <div className={cn("particle-chart-header", summary && "has-between")}>
            {summary ? (
              <div className="particle-chart-summary">
                <div className="particle-chart-summary-row">
                  <span ref={summaryValRef} className="particle-chart-big-number">
                    {prefix}
                    {numFormatter.format(reducedMotion ? activeTotal : 0)}
                    {suffix}
                  </span>
                  {changePercent !== null ? (
                    <span className={cn("particle-chart-badge", changePercent >= 0 ? "positive" : "negative")}>
                      {changePercent >= 0 ? "+" : "−"}
                      {Math.abs(changePercent).toFixed(1)}%
                    </span>
                  ) : null}
                </div>
                <div className="particle-chart-summary-label">{summaryLabel}</div>
              </div>
            ) : null}

            {showTabs ? (
              <div
                ref={tabsListRef}
                className="particle-chart-tabs"
                role="tablist"
                aria-label="Series"
                onKeyDown={(e) => {
                  if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
                  e.preventDefault();
                  const nextIdx =
                    ((currentSeriesIdx + (e.key === "ArrowRight" ? 1 : -1)) % normalizedSeries.length +
                      normalizedSeries.length) %
                    normalizedSeries.length;
                  selectSeries(nextIdx);
                  tabButtonsRef.current[nextIdx]?.focus();
                }}
              >
                <div
                  aria-hidden="true"
                  className="particle-chart-tab-indicator"
                  style={{
                    left: `${pillRect.left}px`,
                    width: `${pillRect.width}px`,
                    opacity: pillRect.width > 0 ? 1 : 0
                  }}
                >
                  <div ref={sweepBarRef} className="particle-chart-tab-sweep" />
                </div>
                {normalizedSeries.map((s, idx) => (
                  <button
                    key={`${s.name}-${idx}`}
                    ref={(el) => {
                      tabButtonsRef.current[idx] = el;
                    }}
                    type="button"
                    role="tab"
                    aria-selected={idx === currentSeriesIdx}
                    tabIndex={idx === currentSeriesIdx ? 0 : -1}
                    onClick={() => selectSeries(idx)}
                    className={cn("particle-chart-tab-btn", idx === currentSeriesIdx && "active")}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div
          ref={plotRef}
          role="img"
          aria-label={ariaLabel}
          className="particle-chart-plot"
          style={{ height: `${fullCanvasHeight}px` }}
          onPointerMove={(e) => {
            const coords = getCanvasCoords(e);
            if (!coords) return;
            const ptr = simRef.current.pointer;
            const ts = e.timeStamp;
            if (ptr.t && ts > ptr.t) {
              const dt = Math.max(8, ts - ptr.t) / 1000;
              ptr.vx = 0.4 * ptr.vx + (((coords.x - ptr.x) / dt) * 0.6);
              ptr.vy = 0.4 * ptr.vy + (((coords.y - ptr.y) / dt) * 0.6);
            }
            ptr.x = coords.x;
            ptr.y = coords.y;
            ptr.t = ts;
            if (e.pointerType !== "mouse") return;
            const bar = colSlotWidth > 0 ? Math.floor(coords.x / colSlotWidth) : -1;
            const validBar = bar >= 0 && bar < barCount ? bar : -1;
            if (validBar !== hoveredBarIdx) setHoveredBarIdx(validBar);

            if (interactive) {
              const sim = simRef.current;
              if (reducedMotion || !sim.started) return;
              const speedMag = clamp(Math.hypot(ptr.vx, ptr.vy) / 1100, 0, 1);
              if (speedMag < 0.02) return;
              const radiusInfluence = Math.max(24, 0.48 * actualBarWidth);
              let changed = false;
              sim.columns.forEach((col) => {
                const f = col.field;
                if (
                  coords.x < col.left - radiusInfluence ||
                  coords.x > col.left + col.width + radiusInfluence ||
                  coords.y < 44 - radiusInfluence ||
                  coords.y > 44 + plotHeight + radiusInfluence
                )
                  return;
                const minGx = Math.max(1, Math.floor((coords.x - radiusInfluence - f.left) / f.cell));
                const maxGx = Math.min(f.nx - 2, Math.ceil((coords.x + radiusInfluence - f.left) / f.cell));
                const minGy = Math.max(1, Math.floor((coords.y - radiusInfluence - f.top) / f.cell));
                const maxGy = Math.min(f.ny - 2, Math.ceil((coords.y + radiusInfluence - f.top) / f.cell));
                for (let gy = minGy; gy <= maxGy; gy += 1) {
                  for (let gx = minGx; gx <= maxGx; gx += 1) {
                    const cx = f.left + gx * f.cell;
                    const cy = f.top + gy * f.cell;
                    const dx = cx - coords.x;
                    const dy = cy - coords.y;
                    const d = Math.hypot(dx, dy);
                    if (d > radiusInfluence) continue;
                    const w = Math.pow(1 - Math.pow(d / radiusInfluence, 2), 2);
                    const nxNorm = d > 0.001 ? dx / d : 0;
                    const nyNorm = d > 0.001 ? dy / d : 0;
                    const idx = gy * f.nx + gx;
                    f.vu[idx] = clamp(f.vu[idx] + (0.15 * ptr.vx + 100 * nxNorm * speedMag) * w, -480, 480);
                    f.vw[idx] = clamp(f.vw[idx] + (0.15 * ptr.vy + 100 * nyNorm * speedMag) * w, -480, 480);
                  }
                }
                f.active = true;
                changed = true;
              });
              if (changed) wakeLoopRef.current();
            }
          }}
          onPointerDown={(e) => {
            if (!interactive) return;
            const coords = getCanvasCoords(e);
            if (!coords) return;
            const sim = simRef.current;
            if (reducedMotion || !sim.started) return;
            const clickBar = colSlotWidth > 0 ? Math.floor(coords.x / colSlotWidth) : -1;
            let kickedAny = false;
            sim.columns.forEach((col, idx) => {
              if (idx !== clickBar) return;
              const gLen = col.grains.length;
              if (!gLen) return;
              const topDist = Math.max(0, Math.abs(coords.y - (sim.tops[idx] ?? 44 + plotHeight)) - 14);
              const curve = Math.exp(-Math.pow(topDist / 400, 2));
              if (curve < 0.04) return;
              const blastCount = Math.max(1, Math.round(col.cols * 9));
              for (let i = Math.max(0, gLen - blastCount); i < gLen; i += 1) {
                const g = col.grains[i];
                if (g.mode !== 0) continue;
                const relX = g.x - (col.left + col.width / 2);
                if (Math.abs(relX) > actualBarWidth) continue;
                const factor =
                  (1 - Math.pow(relX / actualBarWidth, 2) * 0.5) *
                  curve *
                  (1 - ((gLen - 1 - i) / blastCount) * 0.65);
                if (factor < 0.05) continue;
                g.vy = -(260 + 520 * pseudoRandom(i, coords.x)) * factor * (0.75 + 0.5 * pseudoRandom(1.7 * i, idx));
                g.vx = (pseudoRandom(idx, 0.3 * i) - 0.5) * 220 * factor + 34 * Math.sign(relX || 1) * factor;
                g.mode = 1;
                g.ballistic = false;
                g.kicked = true;
                kickedAny = true;
              }
            });
            if (kickedAny) wakeLoopRef.current();
          }}
        >
          <canvas ref={canvasRef} aria-hidden="true" className="particle-chart-canvas" />

          {values
            ? currentData.map((d, idx) => (
                <div
                  key={`v-${d.label}-${idx}`}
                  ref={(el) => {
                    valLabelsRef.current[idx] = el;
                  }}
                  aria-hidden="true"
                  className="particle-chart-bar-value"
                  style={{
                    left: `${colSlotWidth * (idx + 0.5)}px`,
                    top: "44px",
                    color: hoveredBarIdx === idx || hoveredBarIdx < 0 ? palette.text : palette.muted
                  }}
                />
              ))
            : null}
        </div>

        {baseline ? <div aria-hidden="true" className="particle-chart-baseline" /> : null}

        {labels ? (
          <div aria-hidden="true" className="particle-chart-labels">
            {currentData.map((d, idx) => (
              <div
                key={`l-${d.label}-${idx}`}
                className={cn("particle-chart-label-cell", hoveredBarIdx === idx && "active")}
              >
                {d.label}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
});

export default ParticleChart;
