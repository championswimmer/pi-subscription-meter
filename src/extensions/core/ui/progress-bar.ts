import type { Theme } from "@earendil-works/pi-coding-agent";

type ThemeColorName = Parameters<Theme["fg"]>[0];

export interface ProgressBarOptions {
  width: number;
  usedPercent: number;
  notches?: number[];
  markerNotches?: number[];
  filledChar?: string;
  emptyChar?: string;
  filledNotchChar?: string;
  emptyNotchChar?: string;
  filledMarkerChar?: string;
  emptyMarkerChar?: string;
  filledColor?: ThemeColorName;
  emptyColor?: ThemeColorName;
  notchColor?: ThemeColorName;
  markerColor?: ThemeColorName;
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function toNotchIndexes(width: number, notches: number[] | undefined): Set<number> {
  const indexes = new Set<number>();
  if (!notches?.length) return indexes;

  for (const notch of notches) {
    if (!Number.isFinite(notch) || notch <= 0 || notch >= 100) {
      continue;
    }

    const index = Math.min(width - 1, Math.max(0, Math.ceil((notch / 100) * width) - 1));
    indexes.add(index);
  }

  return indexes;
}

export function renderProgressBar(theme: Theme, options: ProgressBarOptions): string {
  const width = Math.max(1, Math.floor(options.width));
  const usedPercent = clampPercent(options.usedPercent);
  const filledCells = Math.max(0, Math.min(width, Math.round((usedPercent / 100) * width)));
  const notchIndexes = toNotchIndexes(width, options.notches);
  const markerIndexes = toNotchIndexes(width, options.markerNotches);

  const filledChar = options.filledChar ?? "█";
  const emptyChar = options.emptyChar ?? "░";
  const filledNotchChar = options.filledNotchChar ?? "┆";
  const emptyNotchChar = options.emptyNotchChar ?? "┆";
  const filledMarkerChar = options.filledMarkerChar ?? "•";
  const emptyMarkerChar = options.emptyMarkerChar ?? "◦";
  const filledColor = options.filledColor ?? "accent";
  const emptyColor = options.emptyColor ?? "dim";
  const notchColor = options.notchColor ?? "muted";
  const markerColor = options.markerColor ?? "accent";

  return Array.from({ length: width }, (_, index) => {
    const isFilled = index < filledCells;
    const isMarker = markerIndexes.has(index);
    const isNotch = notchIndexes.has(index);

    if (isMarker) {
      return theme.fg(markerColor, isFilled ? filledMarkerChar : emptyMarkerChar);
    }

    if (isNotch) {
      return theme.fg(notchColor, isFilled ? filledNotchChar : emptyNotchChar);
    }

    return theme.fg(isFilled ? filledColor : emptyColor, isFilled ? filledChar : emptyChar);
  }).join("");
}
