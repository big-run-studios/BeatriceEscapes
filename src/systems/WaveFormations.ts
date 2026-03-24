/**
 * Path-based formation spawning for enemy waves.
 * Inspired by starshake's FoeGenerator using Phaser.Curves.Path.
 * Enemies follow entry paths before engaging in combat.
 */

import Phaser from "phaser";

export type FormationId =
  | "line-left"
  | "line-right"
  | "pincer"
  | "surround"
  | "drop-in"
  | "v-formation"
  | "random";

export interface SpawnPoint {
  x: number;
  y: number;
  delay: number;
  path?: Phaser.Curves.Path;
}

export function generateFormation(
  id: FormationId,
  count: number,
  arenaWidth: number,
  arenaMinY: number,
  arenaMaxY: number,
): SpawnPoint[] {
  const centerX = arenaWidth / 2;
  const centerY = (arenaMinY + arenaMaxY) / 2;
  const spanY = arenaMaxY - arenaMinY;
  const points: SpawnPoint[] = [];

  switch (id) {
    case "line-left":
      for (let i = 0; i < count; i++) {
        const y = arenaMinY + (spanY / (count + 1)) * (i + 1);
        const path = new Phaser.Curves.Path(-40, y);
        path.lineTo(80 + Math.random() * 60, y);
        points.push({ x: -40, y, delay: i * 120, path });
      }
      break;

    case "line-right":
      for (let i = 0; i < count; i++) {
        const y = arenaMinY + (spanY / (count + 1)) * (i + 1);
        const path = new Phaser.Curves.Path(arenaWidth + 40, y);
        path.lineTo(arenaWidth - 80 - Math.random() * 60, y);
        points.push({ x: arenaWidth + 40, y, delay: i * 120, path });
      }
      break;

    case "pincer": {
      const half = Math.ceil(count / 2);
      for (let i = 0; i < half; i++) {
        const y = arenaMinY + (spanY / (half + 1)) * (i + 1);
        const path = new Phaser.Curves.Path(-40, y);
        path.lineTo(100 + Math.random() * 40, y);
        points.push({ x: -40, y, delay: i * 100, path });
      }
      for (let i = 0; i < count - half; i++) {
        const y = arenaMinY + (spanY / (count - half + 1)) * (i + 1);
        const path = new Phaser.Curves.Path(arenaWidth + 40, y);
        path.lineTo(arenaWidth - 100 - Math.random() * 40, y);
        points.push({ x: arenaWidth + 40, y, delay: i * 100 + 50, path });
      }
      break;
    }

    case "surround":
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const radius = Math.max(arenaWidth, spanY) * 0.6;
        const startX = centerX + Math.cos(angle) * radius;
        const startY = centerY + Math.sin(angle) * (spanY * 0.5);
        const endX = centerX + Math.cos(angle) * 120;
        const endY = Phaser.Math.Clamp(
          centerY + Math.sin(angle) * (spanY * 0.35),
          arenaMinY + 20, arenaMaxY - 20,
        );
        const path = new Phaser.Curves.Path(startX, startY);
        path.lineTo(endX, endY);
        points.push({ x: startX, y: startY, delay: i * 80, path });
      }
      break;

    case "drop-in":
      for (let i = 0; i < count; i++) {
        const x = arenaWidth * 0.15 + Math.random() * arenaWidth * 0.7;
        const endY = arenaMinY + Math.random() * spanY;
        const path = new Phaser.Curves.Path(x, arenaMinY - 60);
        path.splineTo([
          new Phaser.Math.Vector2(x + (Math.random() - 0.5) * 40, arenaMinY),
          new Phaser.Math.Vector2(x, endY),
        ]);
        points.push({ x, y: arenaMinY - 60, delay: i * 150 + Math.random() * 100, path });
      }
      break;

    case "v-formation": {
      const tipX = Math.random() > 0.5 ? -40 : arenaWidth + 40;
      const inward = tipX < 0 ? 1 : -1;
      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / 2);
        const side = i % 2 === 0 ? 1 : -1;
        const sx = tipX + inward * row * 30;
        const sy = centerY + side * (row + 1) * 25;
        const ex = centerX + inward * (80 + row * 20);
        const ey = Phaser.Math.Clamp(sy, arenaMinY + 20, arenaMaxY - 20);
        const path = new Phaser.Curves.Path(sx, sy);
        path.lineTo(ex, ey);
        points.push({ x: sx, y: sy, delay: row * 100, path });
      }
      break;
    }

    case "random":
    default:
      for (let i = 0; i < count; i++) {
        const x = 60 + Math.random() * (arenaWidth - 120);
        const y = arenaMinY + 20 + Math.random() * (spanY - 40);
        points.push({ x, y, delay: i * 50 });
      }
      break;
  }

  return points;
}

const ALL_FORMATIONS: FormationId[] = [
  "line-left", "line-right", "pincer", "surround", "drop-in", "v-formation",
];

export function randomFormation(): FormationId {
  return ALL_FORMATIONS[Math.floor(Math.random() * ALL_FORMATIONS.length)];
}
