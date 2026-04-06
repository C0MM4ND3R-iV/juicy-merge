import { Scene } from 'phaser';
import * as Phaser from 'phaser';
import { THEME, colorValue, cssColor } from '../theme';
import { EVENT_ID, LOCAL_BEST_KEY, SCORE_THRESHOLD, REWARD_CODE } from '../config';

type FruitDef = {
  id: number;
  name: string;
  radius: number;
  color: number;
  score: number;
  nextId?: number;
  artScale?: number;
};

type FruitGO = Phaser.GameObjects.Image & {
  fruitId?: number;
  internalId?: number;
  spawnAt?: number;
};

type HudToggleButton = Phaser.GameObjects.Container & {
  redraw: () => void;
  setActiveState: (active: boolean) => void;
  activeState: boolean;
};

type MatterCollisionPair = {
  bodyA: {
    gameObject?: Phaser.GameObjects.GameObject;
  };
  bodyB: {
    gameObject?: Phaser.GameObjects.GameObject;
  };
};

type MatterCollisionEvent = {
  pairs: MatterCollisionPair[];
};

const FIXED_TOP_WIDTH = 355;
const FIXED_BOTTOM_WIDTH = 275;
const MIN_TOP_WIDTH = 286;
const SIDE_MARGIN = 18;

const GLASS_TEXTURE_W = 459;
const GLASS_INNER_TOP_X = 70;
const GLASS_INNER_TOP_Y = 100;
const GLASS_INNER_BOTTOM_X = 180;
const GLASS_INNER_BOTTOM_Y = 1111;

const FRUITS: FruitDef[] = [
  { id: 0, name: 'Blueberry', radius: 20, color: 0xff456f, nextId: 1, score: 5, artScale: 2.38 },
  { id: 1, name: 'Strawberry', radius: 24, color: 0xff5a7a, nextId: 2, score: 12, artScale: 2.8 },
  { id: 2, name: 'Orange', radius: 34, color: 0xff9149, nextId: 3, score: 24, artScale: 2.47 },
  { id: 3, name: 'Apple', radius: 42, color: 0xff6974, nextId: 4, score: 45, artScale: 2.5 },
  { id: 4, name: 'Pear', radius: 50, color: 0x82dd7b, nextId: 5, score: 80, artScale: 2.65 },
  { id: 5, name: 'Peach', radius: 60, color: 0xffa0c1, nextId: 6, score: 140, artScale: 2.2 },
  { id: 6, name: 'Melon', radius: 76, color: 0x59d7be, nextId: 7, score: 230, artScale: 2.48 },
  { id: 7, name: 'Watermelon', radius: 90, color: 0x58b6ff, score: 380, artScale: 2.35 },
];

export class Game extends Scene {

  private camera!: Phaser.Cameras.Scene2D.Camera;
  private fruits!: Phaser.GameObjects.Group;

  private score = 0;
  private best = 0;
  private rewardUnlockedAtRunStart = false;

  private playCenterX = 0;
  private playTopLeft = 0;
  private playTopRight = 0;
  private playBottomLeft = 0;
  private playBottomRight = 0;
  private playTop = 0;
  private playBottom = 0;
  private loseY = 0;

  private dropX = 0;
  private dropY = 0;
  private nextFruitId = 0;
  private queuedFruitId = 0;
  private fruitScale = 1;

  private scoreValueText?: Phaser.GameObjects.Text | undefined;
  private bestValueText?: Phaser.GameObjects.Text | undefined;
  private nextValueText?: Phaser.GameObjects.Text | undefined;
  private nextFruitPreview?: Phaser.GameObjects.Image | undefined;
  private rewardText?: Phaser.GameObjects.Text | undefined;
  private rewardBadgeBg?: Phaser.GameObjects.Graphics | undefined;
  private dropPreview?: Phaser.GameObjects.Image | undefined;

  private sfxEnabled = true;
  private musicEnabled = true;
  private musicInstance?: Phaser.Sound.BaseSound | undefined;
  private sfxToggleButton?: HudToggleButton;
  private musicToggleButton?: HudToggleButton;

  private glassLeft?: Phaser.GameObjects.Image;
  private glassRight?: Phaser.GameObjects.Image;

  private bgFx?: Phaser.GameObjects.Container;
  private loseLine?: Phaser.GameObjects.Graphics;
  private playfieldMaskShape?: Phaser.GameObjects.Graphics;
  private playfieldMask?: Phaser.Display.Masks.GeometryMask;

  private lastDropAt = 0;
  private readonly dropCooldownMs = 220;
  private readonly freshMs = 250;          // merge-collision immunity after spawn
  private readonly loseCheckFreshMs = 700; // game-over detection immunity after spawn

  private merging = new Set<number>();
  private idSeq = 1;

  private gameOverTriggered = false;
  private overSince = 0;
  private readonly overConfirmMs = 500;

  private glassDepth = 30;
  private glassAlpha = 1;
  
  private pointerIsAiming = false;

  constructor() {
    super('Game');
  }
  
  init(): void {
    this.dropPreview = undefined;
    this.nextFruitPreview = undefined;
    this.nextValueText = undefined;
    this.scoreValueText = undefined;
    this.bestValueText = undefined;
    this.rewardText = undefined;
    this.rewardBadgeBg = undefined;
    this.pointerIsAiming = false;
    this.rewardUnlockedAtRunStart = false;
  }

  create() {
    this.camera = this.cameras.main;
    this.camera.setBackgroundColor(THEME.bgDark);
    
    this.pointerIsAiming = false;

    this.resetRunState();
    this.best = Math.max(
      0,
      Number(this.registry.get('bestScore') ?? 0),
      this.loadLocalBestScore()
    );
    this.rewardUnlockedAtRunStart = this.best >= SCORE_THRESHOLD;
    this.registry.set('bestScore', this.best);
    this.sfxEnabled = this.registry.get('sfxEnabled') !== false;
    this.musicEnabled = this.registry.get('musicEnabled') !== false;

    this.fruits = this.add.group();

    this.recomputeLayout(this.scale.width, this.scale.height);
    this.createBackdrop();
    this.createHUD();
    this.startMusic();
    this.createBounds();
    this.registerCollisionHandlers();
    this.createGlassOverlay();
    this.createDropPreview();
    this.registerInput();

    this.scale.on('resize', this.handleResize, this);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.handleResize, this);

      if (this.musicInstance) {
        this.musicInstance.stop();
        this.musicInstance.destroy();
        this.musicInstance = undefined;
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.musicInstance) {
        this.musicInstance.stop();
        this.musicInstance.destroy();
        this.musicInstance = undefined;
      }
    });
  }

  override update() {
    if (this.gameOverTriggered) return;

    const children = this.fruits.getChildren() as FruitGO[];
    let anyAbove = false;

    for (const go of children) {
      if (!go?.active) continue;
      const fruitId = go.fruitId;
      if (fruitId === undefined) continue;

      const def = FRUITS[fruitId];
      if (!def) continue; // was `return` — that exits update() entirely, masking all further checks

      // Skip fruits that are currently being absorbed into a merge
      const internalId = go.internalId;
      if (internalId !== undefined && this.merging.has(internalId)) continue;

      // Give each fruit time to settle before it can trigger game-over
      const spawnAt = go.spawnAt ?? 0;
      if (spawnAt && this.time.now - spawnAt < this.loseCheckFreshMs) continue;

      const r = Math.round(def.radius * this.fruitScale);
      const topOfFruit = go.y - r;

      if (topOfFruit <= this.loseY) {
        anyAbove = true;
        break;
      }
    }

    if (!anyAbove) {
      this.overSince = 0;
      return;
    }

    if (this.overSince === 0) this.overSince = this.time.now;

    if (this.time.now - this.overSince >= this.overConfirmMs) {
      this.triggerGameOver();
    }
  }

  private resetRunState() {
    this.score = 0;
    this.nextFruitId = Phaser.Math.Between(0, 2);
    this.queuedFruitId = Phaser.Math.Between(0, 2);
    this.lastDropAt = 0;
    this.merging.clear();
    this.idSeq = 1;
    this.gameOverTriggered = false;
    this.overSince = 0;
  }

  private recomputeLayout(width: number, height: number) {
    this.cameras.resize(width, height);

    const isPortrait = height >= width;
    const topWidth = Math.max(MIN_TOP_WIDTH, Math.min(FIXED_TOP_WIDTH, width - SIDE_MARGIN * 2));
    const bottomWidth = Math.max(208, Math.min(FIXED_BOTTOM_WIDTH, topWidth - 38));

    this.playCenterX = Math.floor(width / 2);
    this.playTopLeft = Math.floor(this.playCenterX - topWidth / 2);
    this.playTopRight = Math.floor(this.playCenterX + topWidth / 2);
    this.playBottomLeft = Math.floor(this.playCenterX - bottomWidth / 2);
    this.playBottomRight = Math.floor(this.playCenterX + bottomWidth / 2);

    const hudTop = 14;
    const hudHeight = isPortrait ? 84 : 86;
    const rewardHeight = 0;
    const rewardGap = 0;
    const topGap = 65;
    const bottomMargin = isPortrait ? 30 : 52;

    this.playTop = hudTop + hudHeight + rewardHeight + rewardGap + topGap;
    this.playBottom = height - bottomMargin;
    this.dropY = this.playTop - (isPortrait ? 32 : 34);
    this.loseY = this.playTop + 0;
    this.fruitScale = isPortrait ? 0.88 : 0.92;
    this.dropX = this.playCenterX;
  }

  private startMusic() {
    if (!this.musicEnabled) return;
    if (!this.cache.audio.exists('music_bgm')) return;
    if (this.musicInstance?.isPlaying) return;

    this.musicInstance = this.sound.add('music_bgm', {
      loop: true,
      volume: 0.22,
    });

    this.musicInstance.play();
  }

  private toggleSfx() {
    this.sfxEnabled = !this.sfxEnabled;
    this.registry.set('sfxEnabled', this.sfxEnabled);
    this.sfxToggleButton?.setActiveState(this.sfxEnabled);
  }

  private toggleMusic() {
    this.musicEnabled = !this.musicEnabled;
    this.registry.set('musicEnabled', this.musicEnabled);
    this.musicToggleButton?.setActiveState(this.musicEnabled);

    if (!this.musicEnabled) {
      this.musicInstance?.stop();
      this.musicInstance?.destroy();
      this.musicInstance = undefined;
      return;
    }

    this.startMusic();
  }

  private makeHudToggleButton(label: string, icon: string, isActive: boolean, onClick: () => void) {
    const width = 72;
    const height = 26;
    const bg = this.add.graphics();
    const iconText = this.add
      .text(-width / 2 + 14, 0, icon, {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '12px',
        color: THEME.text,
      })
      .setOrigin(0.5);

    const labelText = this.add
      .text(6, 0, label, {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '11px',
        color: THEME.text,
      })
      .setOrigin(0.5);

    const hit = this.add.rectangle(0, 0, width, height, 0xffffff, 0.001);
    const button = this.add.container(0, 0, [bg, hit, iconText, labelText]) as HudToggleButton;

    button.activeState = isActive;

    button.redraw = () => {
      const active = button.activeState;
      bg.clear();
      bg.fillStyle(active ? THEME.panelSoft : 0x28101c, active ? 0.96 : 0.9);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 13);
      bg.fillStyle(active ? THEME.accent : 0xffffff, active ? 0.16 : 0.04);
      bg.fillRoundedRect(-width / 2 + 3, -height / 2 + 3, width - 6, height * 0.44, 10);
      bg.lineStyle(2, active ? colorValue(THEME.accentGlow) : 0xffffff, active ? 0.5 : 0.12);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 13);
      iconText.setAlpha(active ? 1 : 0.55);
      labelText.setAlpha(active ? 1 : 0.55);
    };

    button.setActiveState = (active: boolean) => {
      button.activeState = active;
      button.redraw();
    };

    button.redraw();

    hit
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => {
        button.setScale(1.03);
      })
      .on('pointerout', () => {
        button.setScale(1);
      })
      .on(
        'pointerdown',
        (_pointer: Phaser.Input.Pointer, _lx: number, _ly: number, event: Phaser.Types.Input.EventData) => {
          event.stopPropagation();
          this.tweens.add({
            targets: button,
            scaleX: 0.97,
            scaleY: 0.97,
            yoyo: true,
            duration: 80,
            ease: 'Quad.easeOut',
          });
          onClick();
        }
      );

    return button;
  }

  private createBackdrop() {
    const { width, height } = this.scale;

    this.add.rectangle(0, 0, width, height, THEME.bgDark).setOrigin(0).setDepth(-120);
    this.add.ellipse(width * 0.18, height * 0.2, width * 0.72, 240, THEME.berrySoft, 0.22).setDepth(-118);
    this.add.ellipse(width * 0.82, height * 0.16, width * 0.56, 180, 0xff6aa9, 0.08).setDepth(-118);
    this.add.ellipse(width * 0.5, height * 0.72, width * 1.1, height * 0.86, THEME.bg, 0.84).setDepth(-119);
    this.add.ellipse(width * 0.5, height * 0.9, width * 0.94, 180, 0xffa457, 0.08).setDepth(-118);

    this.bgFx = this.add.container(0, 0).setDepth(-115);

    const fxLeft = this.playTopLeft - 18;
    const fxTop = this.playTop - 18;
    const fxWidth = this.playTopRight - this.playTopLeft + 36;
    const fxHeight = this.playBottom - this.playTop + 24;

    const stripes = this.add.graphics();

    const stripeCount = 7;
    const stripeSpacing = fxWidth / stripeCount;
    for (let i = -1; i <= stripeCount + 1; i += 1) {
      const startX = fxLeft + i * stripeSpacing;
      stripes.lineStyle(2, 0xffffff, 0.03);
      stripes.beginPath();
      stripes.moveTo(startX, fxTop);
      stripes.lineTo(startX + fxWidth * 0.22, fxTop + fxHeight);
      stripes.strokePath();
    }

    const bubbles = this.add.graphics();
    const bubbleData = [
      [0.10, 0.16, 18, 0.08],
      [0.22, 0.34, 10, 0.10],
      [0.14, 0.58, 13, 0.08],
      [0.28, 0.78, 9, 0.09],
      [0.46, 0.22, 22, 0.07],
      [0.54, 0.48, 12, 0.09],
      [0.62, 0.70, 16, 0.08],
      [0.76, 0.30, 14, 0.08],
      [0.84, 0.56, 11, 0.09],
      [0.72, 0.84, 18, 0.07],
    ] as const;

    for (const [rx, ry, r, alpha] of bubbleData) {
      const bx = fxLeft + fxWidth * rx;
      const by = fxTop + fxHeight * ry;

      bubbles.lineStyle(2, 0xffffff, alpha);
      bubbles.strokeCircle(bx, by, r);
      bubbles.fillStyle(0xffffff, alpha * 0.12);
      bubbles.fillCircle(bx, by, Math.max(4, r * 0.22));
    }

    const glow = this.add.graphics();
    glow.fillStyle(THEME.accent, 0.06);
    glow.fillRoundedRect(fxLeft, fxTop, fxWidth, fxHeight, 36);

    this.loseLine = this.add.graphics();

    this.bgFx.add([stripes, bubbles, glow, this.loseLine]);
    this.refreshPlayfieldMask();
    this.redrawLoseLine();
  }

  private refreshPlayfieldMask() {
    if (!this.playfieldMaskShape) {
      this.playfieldMaskShape = this.make.graphics({ x: 0, y: 0 });
      this.playfieldMask = this.playfieldMaskShape.createGeometryMask();
    }

    const topInset = 12;
    const bottomInset = 18;
    const topY = this.playTop;
    const bottomY = this.playBottom - 2;

    this.playfieldMaskShape.clear();
    this.playfieldMaskShape.fillStyle(0xffffff, 1);
    this.playfieldMaskShape.beginPath();
    this.playfieldMaskShape.moveTo(this.playTopLeft + topInset, topY);
    this.playfieldMaskShape.lineTo(this.playTopRight - topInset, topY);
    this.playfieldMaskShape.lineTo(this.playBottomRight - bottomInset, bottomY);
    this.playfieldMaskShape.lineTo(this.playBottomLeft + bottomInset, bottomY);
    this.playfieldMaskShape.closePath();
    this.playfieldMaskShape.fillPath();

    if (this.bgFx && this.playfieldMask) {
      this.bgFx.setMask(this.playfieldMask);
    }
  }

  private createHUD() {
    const { width, height } = this.scale;
    const panelW = Math.min(width - 24, 430);
    const panelH = 88;
    const panelX = Math.floor(width / 2 - panelW / 2);
    const panelY = 14;

    const hud = this.add.graphics().setDepth(2000);
    hud.fillStyle(THEME.panel, 0.92);
    hud.fillRoundedRect(panelX, panelY, panelW, panelH, 28);
    hud.fillStyle(0xffffff, 0.04);
    hud.fillRoundedRect(panelX + 8, panelY + 8, panelW - 16, panelH * 0.38, 22);
    hud.lineStyle(3, colorValue(THEME.accentGlow), 0.22);
    hud.strokeRoundedRect(panelX, panelY, panelW, panelH, 28);
    hud.lineStyle(1, 0xffffff, 0.08);
    hud.strokeRoundedRect(panelX + 8, panelY + 8, panelW - 16, panelH - 16, 22);

    const dividerX = width / 2;
    hud.lineStyle(2, colorValue(THEME.accentWarm), 0.18);
    hud.beginPath();
    hud.moveTo(dividerX, panelY + 16);
    hud.lineTo(dividerX, panelY + panelH - 16);
    hud.strokePath();

    const smallStyle: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '14px',
      color: THEME.textMuted,
    };

    this.add.text(panelX + 20, panelY + 14, 'Score', smallStyle).setDepth(2001);
    this.add.text(panelX + 20, panelY + 58, 'Best', smallStyle).setDepth(2001);
    this.add.text(panelX + panelW - 20, panelY + 14, 'Up Next', smallStyle).setDepth(2001).setOrigin(1, 0);

    this.scoreValueText = this.add
      .text(panelX + 20, panelY + 28, `${this.score}`, {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '24px',
        color: THEME.text,
        stroke: THEME.stroke,
        strokeThickness: 4,
      })
      .setDepth(2001)
      .setShadow(0, 0, cssColor(THEME.accent), 8, true, true);

    this.bestValueText = this.add
      .text(panelX + 74, panelY + 54, `${this.best}`, {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '18px',
        color: THEME.textSoft,
        stroke: THEME.stroke,
        strokeThickness: 2,
      })
      .setDepth(2001)
      .setOrigin(0, 0);

    this.nextValueText = this.add
      .text(panelX + panelW - 66, panelY + 30, FRUITS[this.queuedFruitId]!.name, {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '16px',
        color: THEME.text,
        align: 'right',
      })
      .setDepth(2001)
      .setOrigin(1, 0)
      .setShadow(0, 0, cssColor(THEME.accent), 6, true, true);

    this.nextFruitPreview = this.add
      .image(panelX + panelW - 28, panelY + 58, this.getFruitTextureKey(this.queuedFruitId))
      .setDepth(2002)
      .setAlpha(0.96);

    const toggleY = panelY + panelH - 20;
    this.sfxToggleButton = this.makeHudToggleButton('SFX', '♪', this.sfxEnabled, () => this.toggleSfx());
    this.sfxToggleButton.setDepth(2002).setPosition(dividerX + 46, toggleY);

    this.musicToggleButton = this.makeHudToggleButton('Music', '♫', this.musicEnabled, () => this.toggleMusic());
    this.musicToggleButton.setDepth(2002).setPosition(dividerX + 126, toggleY);

    // "End Blend" button — lets players go to the game-over screen voluntarily
    {
      const btnW = 72;
      const btnH = 26;
      const bg = this.add.graphics();
      const hit = this.add.rectangle(0, 0, btnW, btnH, 0xffffff, 0.001);
      const iconTxt = this.add.text(-btnW / 2 + 14, 0, '✕', {
        fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '12px', color: THEME.text,
      }).setOrigin(0.5);
      const labelTxt = this.add.text(6, 0, 'End', {
        fontFamily: 'Arial Black, Arial, sans-serif', fontSize: '11px', color: THEME.text,
      }).setOrigin(0.5);

      const redraw = (hovered: boolean) => {
        bg.clear();
        bg.fillStyle(hovered ? 0xff5522 : 0x7a1800, hovered ? 0.96 : 0.88);
        bg.fillRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 13);
        bg.fillStyle(0xffffff, hovered ? 0.14 : 0.06);
        bg.fillRoundedRect(-btnW / 2 + 3, -btnH / 2 + 3, btnW - 6, btnH * 0.44, 10);
        bg.lineStyle(2, hovered ? 0xff7755 : 0xff3311, hovered ? 0.7 : 0.4);
        bg.strokeRoundedRect(-btnW / 2, -btnH / 2, btnW, btnH, 13);
      };
      redraw(false);

      const endBtn = this.add.container(dividerX - 46, panelY + 18, [bg, hit, iconTxt, labelTxt]).setDepth(2002);
      hit.setInteractive({ useHandCursor: true })
        .on('pointerover', () => { endBtn.setScale(1.03); redraw(true); })
        .on('pointerout',  () => { endBtn.setScale(1);    redraw(false); })
        .on('pointerdown', (_p: Phaser.Input.Pointer, _lx: number, _ly: number, ev: Phaser.Types.Input.EventData) => {
          ev.stopPropagation();
          this.tweens.add({ targets: endBtn, scaleX: 0.97, scaleY: 0.97, yoyo: true, duration: 80, ease: 'Quad.easeOut' });
          this.triggerGameOver();
        });
    }

    const rewardBadgeW = Math.min(width - 40, 240);
    const rewardBadgeH = 34;
    const rewardBadgeX = Math.floor(width / 2 - rewardBadgeW / 2);
    const rewardBadgeY = height - rewardBadgeH - 26;

    this.rewardBadgeBg = this.add.graphics().setDepth(1999).setVisible(false).setAlpha(0);
    this.rewardBadgeBg.fillStyle(THEME.panelSoft, 0.96);
    this.rewardBadgeBg.fillRoundedRect(rewardBadgeX, rewardBadgeY, rewardBadgeW, rewardBadgeH, 17);
    this.rewardBadgeBg.lineStyle(2, colorValue(THEME.accentWarm), 0.42);
    this.rewardBadgeBg.strokeRoundedRect(rewardBadgeX, rewardBadgeY, rewardBadgeW, rewardBadgeH, 17);

    this.rewardText = this.add
      .text(width / 2, rewardBadgeY + rewardBadgeH / 2, '🎁 Reward unlocked!', {
        fontFamily: 'Arial Black, Arial, sans-serif',
        fontSize: '15px',
        color: THEME.reward,
        stroke: THEME.stroke,
        strokeThickness: 3,
      })
      .setDepth(2001)
      .setOrigin(0.5)
      .setVisible(false)
      .setAlpha(0);
  }

  private createDropPreview() {
    const textureKey = this.getFruitTextureKey(this.nextFruitId);
    this.dropPreview = this.add.image(this.dropX, this.dropY, textureKey).setDepth(1800).setAlpha(0.86);
    this.updateNextPreview();
  }

  private registerInput() {
    const updateAimFromPointer = (p: Phaser.Input.Pointer) => {
      const currentRadius = Math.round(FRUITS[this.nextFruitId]!.radius * this.fruitScale);
      const limitPad = currentRadius + 8;
      this.dropX = Phaser.Math.Clamp(p.x, this.playTopLeft + limitPad, this.playTopRight - limitPad);
      this.dropPreview?.setPosition(this.dropX, this.dropY);
    };

    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      updateAimFromPointer(p);
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      this.pointerIsAiming = true;
      updateAimFromPointer(p);

      if (this.musicEnabled && !this.musicInstance) {
        this.startMusic();
      }
    });

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (!this.pointerIsAiming) return;
      this.pointerIsAiming = false;

      updateAimFromPointer(p);

      const now = this.time.now;
      if (now - this.lastDropAt < this.dropCooldownMs) return;
      this.lastDropAt = now;

      if (this.sfxEnabled && this.cache.audio.exists('sfx_drop')) {
        this.sound.play('sfx_drop', { volume: 0.2 });
      }

      const fruitToDrop = this.nextFruitId;

      this.spawnFruit(fruitToDrop, this.dropX, this.dropY);
      this.nextFruitId = this.queuedFruitId;
      this.queuedFruitId = Phaser.Math.Between(0, 2);
      this.updateNextPreview();
    });
  }

  private registerCollisionHandlers() {
    this.matter.world.on('collisionstart', (event: MatterCollisionEvent) => this.handleCollisionEvent(event));
    this.matter.world.on('collisionactive', (event: MatterCollisionEvent) => this.handleCollisionEvent(event));
  }

  private handleCollisionEvent(event: MatterCollisionEvent) {
    for (const pair of event.pairs) {
      const a = pair.bodyA.gameObject as FruitGO | undefined;
      const b = pair.bodyB.gameObject as FruitGO | undefined;
      if (!a || !b) continue;
      this.tryMergePair(a, b);
    }
  }

  private tryMergePair(a: FruitGO, b: FruitGO) {
    const aFruit = a.fruitId;
    const bFruit = b.fruitId;
    if (aFruit === undefined || bFruit === undefined) return;
    if (aFruit !== bFruit) return;

    const def = FRUITS[aFruit];
    if (!def || def.nextId === undefined) return;

    const nextId = def.nextId;
    const score = def.score;

    const aId = a.internalId;
    const bId = b.internalId;
    if (!aId || !bId) return;
    if (this.merging.has(aId) || this.merging.has(bId)) return;

    const aSpawnAt = a.spawnAt ?? 0;
    const bSpawnAt = b.spawnAt ?? 0;
    if (aSpawnAt && this.time.now - aSpawnAt < this.freshMs) return;
    if (bSpawnAt && this.time.now - bSpawnAt < this.freshMs) return;

    this.merging.add(aId);
    this.merging.add(bId);

    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;

    this.time.delayedCall(0, () => {
      if (this.sfxEnabled && this.cache.audio.exists('sfx_merge')) {
        this.sound.play('sfx_merge', { volume: 0.35 });
      }

      this.pop(mx, my);
      a.destroy?.();
      b.destroy?.();

      this.spawnFruit(nextId, mx, my);
      this.addScore(score);

      this.time.delayedCall(120, () => {
        this.merging.delete(aId);
        this.merging.delete(bId);
      });
    });
  }

  private createBounds() {
    const wallThickness = 80;
    const wallHeight = this.playBottom - this.playTop + 400;
    const midY = (this.playTop + this.playBottom) / 2;

    const dxLeft = this.playTopLeft - this.playBottomLeft;
    const dxRight = this.playTopRight - this.playBottomRight;

    const angleLeft = Math.atan2(dxLeft, this.playBottom - this.playTop);
    const angleRight = Math.atan2(dxRight, this.playBottom - this.playTop);

    const leftMidX = (this.playTopLeft + this.playBottomLeft) / 2;
    const rightMidX = (this.playTopRight + this.playBottomRight) / 2;

    this.matter.add.rectangle(leftMidX - wallThickness / 2, midY, wallThickness, wallHeight, {
      isStatic: true,
      angle: angleLeft,
    });

    this.matter.add.rectangle(rightMidX + wallThickness / 2, midY, wallThickness, wallHeight, {
      isStatic: true,
      angle: angleRight,
    });

    this.matter.add.rectangle(
      this.scale.width / 2,
      this.playBottom + wallThickness / 2,
      this.scale.width + 400,
      wallThickness,
      { isStatic: true }
    );
  }

  private createGlassOverlay() {
    if (!this.textures.exists('glass_half')) return;

    this.glassLeft = this.add
      .image(0, 0, 'glass_half')
      .setOrigin(0, 0)
      .setAlpha(this.glassAlpha)
      .setDepth(this.glassDepth);

    this.glassRight = this.add
      .image(0, 0, 'glass_half')
      .setOrigin(0, 0)
      .setFlipX(true)
      .setAlpha(this.glassAlpha)
      .setDepth(this.glassDepth);

    this.updateGlassOverlay();
  }

  private updateGlassOverlay() {
    if (!this.glassLeft || !this.glassRight) return;

    const srcHeight = Math.max(1, GLASS_INNER_BOTTOM_Y - GLASS_INNER_TOP_Y);
    const srcWidthDelta = Math.max(1, GLASS_INNER_BOTTOM_X - GLASS_INNER_TOP_X);
    const targetHeight = Math.max(1, this.playBottom - this.playTop);
    const targetWidthDelta = Math.max(1, this.playBottomLeft - this.playTopLeft);

    const scaleY = targetHeight / srcHeight;
    const scaleX = targetWidthDelta / srcWidthDelta;

    const leftX = this.playTopLeft - GLASS_INNER_TOP_X * scaleX;
    const topY = this.playTop - GLASS_INNER_TOP_Y * scaleY;
    const rightX = this.playTopRight - (GLASS_TEXTURE_W - GLASS_INNER_TOP_X) * scaleX;

    this.glassLeft.setScale(scaleX, scaleY);
    this.glassRight.setScale(scaleX, scaleY);

    this.glassLeft.setPosition(leftX, topY);
    this.glassRight.setPosition(rightX, topY);
  }

  private getFruitTextureKey(fruitId: number) {
    return `fruits_${FRUITS[fruitId]!.name}`;
  }

  private getFruitDisplaySize(fruitId: number) {
    const def = FRUITS[fruitId];
    if (!def) return;
    
    const r = Math.max(10, Math.round(def.radius * this.fruitScale));
    const artScale = def.artScale ?? 2.14;
    return Math.round(r * artScale);
  }

  private updateNextPreview() {
    if (
      !this.nextValueText ||
      !this.dropPreview ||
      !this.nextFruitPreview ||
      !this.dropPreview.scene ||
      !this.nextFruitPreview.scene
    ) {
      return;
    }

    const currentDef = FRUITS[this.nextFruitId];
    const queuedDef = FRUITS[this.queuedFruitId];
    if (!currentDef || !queuedDef) return;
    
    const r = Math.round(currentDef.radius * this.fruitScale);

    this.nextValueText.setText(queuedDef.name);

    this.dropPreview.setTexture(this.getFruitTextureKey(this.nextFruitId));
    const currentDisplaySize = this.getFruitDisplaySize(this.nextFruitId);
    if (currentDisplaySize === undefined) return;
    this.dropPreview.setDisplaySize(currentDisplaySize, currentDisplaySize);

    this.nextFruitPreview.setTexture(this.getFruitTextureKey(this.queuedFruitId));
    const queuedBaseSize = this.getFruitDisplaySize(this.queuedFruitId);
    if (queuedBaseSize === undefined) return;

    const queuedDisplaySize = Math.round(Math.min(38, queuedBaseSize * 0.42));
    this.nextFruitPreview.setDisplaySize(queuedDisplaySize, queuedDisplaySize);

    const limitPad = r + 8;
    this.dropX = Phaser.Math.Clamp(this.dropX, this.playTopLeft + limitPad, this.playTopRight - limitPad);
    this.dropPreview.setPosition(this.dropX, this.dropY);
    
    const hideNextFruitPreview = this.scale.height >= this.scale.width || this.scale.width < 430;
    this.nextFruitPreview?.setVisible(!hideNextFruitPreview);
  }

  private spawnFruit(fruitId: number, x: number, y: number) {
    const def = FRUITS[fruitId];
    if (!def) return;
    
    const r = Math.max(10, Math.round(def.radius * this.fruitScale));
    const displaySize = this.getFruitDisplaySize(fruitId);
    if (displaySize === undefined) return;

    const image = this.add.image(x, y, this.getFruitTextureKey(fruitId)) as FruitGO;
    image.fruitId = fruitId;
    image.internalId = this.idSeq++;
    image.spawnAt = this.time.now;
    image.setDisplaySize(displaySize, displaySize);
    image.setDepth(120);

    this.fruits.add(image);

    return this.matter.add.gameObject(image, {
      shape: { type: 'circle', radius: r },
      restitution: 0.08,
      friction: 0.06,
      frictionAir: 0.002,
      density: 0.0015,
    });
  }

  private addScore(delta: number) {
    this.score += delta;
    if (this.score > this.best) {
      this.best = this.score;
      this.registry.set('bestScore', this.best);
      this.saveLocalBestScore(this.best);
    }

    this.scoreValueText?.setText(`${this.score}`);
    this.bestValueText?.setText(`${this.best}`);

    if (this.scoreValueText) {
      this.tweens.add({
        targets: this.scoreValueText,
        scaleX: 1.05,
        scaleY: 1.05,
        yoyo: true,
        duration: 100,
        ease: 'Quad.easeOut',
      });
    }

    if (this.score >= SCORE_THRESHOLD && this.rewardText && this.rewardBadgeBg && !this.rewardText.visible) {
      const finalY = this.rewardText.y;

      this.rewardBadgeBg.setVisible(true);
      this.rewardText.setVisible(true);
      this.rewardText.setAlpha(0);
      this.rewardText.setY(finalY + 8);

      this.tweens.add({
        targets: this.rewardBadgeBg,
        alpha: 1,
        duration: 220,
        ease: 'Quad.easeOut',
      });

      this.tweens.add({
        targets: this.rewardText,
        alpha: 1,
        y: finalY,
        duration: 220,
        ease: 'Quad.easeOut',
      });
    }
  }

  private pop(x: number, y: number) {
    const ring = this.add.circle(x, y, 6, THEME.accent, 0.9).setDepth(950);
    this.tweens.add({
      targets: ring,
      scale: 8,
      alpha: 0,
      duration: 180,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  private triggerGameOver() {
    if (this.gameOverTriggered) return;
    this.gameOverTriggered = true;

    if (this.sfxEnabled && this.cache.audio.exists('sfx_gameover')) {
      this.sound.play('sfx_gameover', { volume: 0.4 });
    }

    if (this.best > 0) {
      this.saveLocalBestScore(this.best);
    }

    this.time.delayedCall(900, () => {
      const rewardUnlockedThisRun = this.score >= SCORE_THRESHOLD && !this.rewardUnlockedAtRunStart;
      const rewardPreviouslyUnlocked = this.rewardUnlockedAtRunStart;
      const rewardUnlocked = rewardUnlockedThisRun || rewardPreviouslyUnlocked;

      this.scene.start('GameOver', {
        score: this.score,
        best: this.best,
        eventId: EVENT_ID,
        unlocked: rewardUnlocked,
        rewardCode: rewardUnlocked ? REWARD_CODE : undefined,
        rewardThreshold: SCORE_THRESHOLD,
        rewardUnlockedThisRun,
        rewardPreviouslyUnlocked,
      });
    });
  }

  private redrawLoseLine() {
    if (!this.loseLine) return;

    this.loseLine.clear();

    const startX = this.playTopLeft + 14;
    const endX = this.playTopRight - 14;
    const y = this.loseY;

    const dashLength = 10;
    const gapLength = 7;

    this.loseLine.lineStyle(2, 0xff79bd, 0.42);

    for (let x = startX; x < endX; x += dashLength + gapLength) {
      const x2 = Math.min(x + dashLength, endX);
      this.loseLine.beginPath();
      this.loseLine.moveTo(x, y);
      this.loseLine.lineTo(x2, y);
      this.loseLine.strokePath();
    }
  }
  private loadLocalBestScore() {
    try {
      const raw = window.localStorage.getItem(LOCAL_BEST_KEY);
      return Math.max(0, Number(raw ?? 0));
    } catch {
      return 0;
    }
  }

  private handleResize(): void {
    this.scene.restart();
  }

  private saveLocalBestScore(score: number) {
    try {
      window.localStorage.setItem(LOCAL_BEST_KEY, String(Math.max(0, Math.floor(score))));
    } catch {
      // localStorage kann in Sonderfällen blockiert sein
    }
  }
}
