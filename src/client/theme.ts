import * as Phaser from 'phaser';

export const THEME = {
  bgDark: 0x140811,
  bg: 0x210b18,
  berry: 0x42112e,
  berrySoft: 0x58173d,
  plum: 0x2f0e33,
  panel: 0x321022,
  panelSoft: 0x4a1734,
  accent: 0xff4fa3,
  accentGlow: 0xff88c6,
  accentWarm: 0xffaa61,
  text: '#fff4f8',
  textSoft: '#ffd3e4',
  textMuted: '#f1a9c7',
  stroke: '#7d1750',
  reward: '#ffe7a6',
  success: '#fff0b5',
  danger: '#ffb3ce',
} as const;

export type Theme = typeof THEME;

/** Convert a hex number or CSS hex string to a Phaser-compatible integer. */
export const colorValue = (value: number | string): number =>
  typeof value === 'number' ? value : Phaser.Display.Color.HexStringToColor(value).color;

/** Convert a hex number to a CSS colour string (#rrggbb). */
export const cssColor = (value: number): string =>
  `#${value.toString(16).padStart(6, '0')}`;
