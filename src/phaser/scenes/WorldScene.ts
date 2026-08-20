import Phaser from "phaser";
import {
  CHARACTER_COLUMNS, CHARACTER_ROWS, PLACEHOLDER_ROOT, REAL_ROOT, WALK_FPS,
  characterSheet, monsterOverworld, tilemapKey, tilesetImage,
} from "../assets";
import type { GameStore } from "../../runtime/GameStore";
import type { Direction } from "../../content/schemas";

const TILE = 32;
const PATROL_INTERVAL_MS = 900;
const MOVE_REPEAT_MS = 140;
/** How much the world is magnified. 32px tiles read as a postage stamp at 1x. */
const CAMERA_ZOOM = 1.75;

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up", ArrowDown: "down", ArrowLeft: "left", ArrowRight: "right",
  KeyW: "up", KeyS: "down", KeyA: "left", KeyD: "right",
};

/**
 * The overworld (FR-030 … FR-033).
 *
 * Draws the map and everything standing on it, reads input, and sends `move` intents. It owns no
 * rules: collision, encounters, transitions, and patrol bounds are all decided in
 * `src/core/world` and this scene renders the answer.
 *
 * NO TEXT — React draws every word the player reads (research R-014).
 */
export class WorldScene extends Phaser.Scene {
  private store!: GameStore;
  private player!: Phaser.GameObjects.Sprite;
  private sprites = new Map<string, Phaser.GameObjects.Sprite>();
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: Record<Direction, Phaser.Input.Keyboard.Key>;
  private lastMoveAt = 0;
  private mapId = "";

  constructor() {
    super("World");
  }

  preload(): void {
    this.store = this.registry.get("store") as GameStore;
    const world = this.store.getSnapshot().world;
    if (!world) return;
    this.mapId = world.map.id;

    // Same real-then-placeholder fallback as the battle preloader, so dropping in real art needs
    // no code change (asset contract § 11).
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, (file: Phaser.Loader.File) => {
      const url = typeof file.url === "string" ? file.url : "";
      if (url.startsWith(PLACEHOLDER_ROOT)) return;
      const fallback = url.replace(REAL_ROOT, PLACEHOLDER_ROOT);
      if (file.type === "spritesheet") {
        this.load.spritesheet(file.key, fallback, { frameWidth: 32, frameHeight: file.key.startsWith("char:") ? 48 : 32 });
      } else if (file.type === "image") {
        this.load.image(file.key, fallback);
      } else if (file.type === "tilemapJSON") {
        this.load.tilemapTiledJSON(file.key, fallback);
      }
    });

    this.load.tilemapTiledJSON(tilemapKey(this.mapId), `${REAL_ROOT}/maps/${this.mapId}.tmj`);
    const tiles = tilesetImage(this.mapId);
    this.load.image(tiles.key, `${REAL_ROOT}/${tiles.path}`);

    const character = characterSheet("player");
    this.load.spritesheet(character.key, `${REAL_ROOT}/${character.path}`,
      { frameWidth: character.frameWidth, frameHeight: character.frameHeight });

    for (const npc of world.npcs) {
      const sheet = characterSheet(npc.npcId);
      this.load.spritesheet(sheet.key, `${REAL_ROOT}/${sheet.path}`,
        { frameWidth: sheet.frameWidth, frameHeight: sheet.frameHeight });
    }
    for (const monster of world.monsters) {
      const sprite = monsterOverworld(monster.monsterId);
      this.load.image(sprite.key, `${REAL_ROOT}/${sprite.path}`);
    }
  }

  create(): void {
    const world = this.store.getSnapshot().world;
    if (!world) return;

    const map = this.make.tilemap({ key: tilemapKey(this.mapId) });
    const tileset = map.addTilesetImage(this.mapId, tilesetImage(this.mapId).key);
    if (tileset) {
      // Contracted draw order: ground, decoration, [entities], above.
      map.createLayer("ground", tileset, 0, 0)?.setDepth(0);
      map.createLayer("decoration", tileset, 0, 0)?.setDepth(1);
      map.createLayer("above", tileset, 0, 0)?.setDepth(30);
    }

    this.createAnimations("player");
    for (const npc of world.npcs) this.createAnimations(npc.npcId);

    for (const npc of world.npcs) {
      this.sprites.set(`npc:${npc.npcId}`, this.placeCharacter(characterSheet(npc.npcId).key, npc.x, npc.y, npc.facing));
    }
    for (const monster of world.monsters) {
      const sprite = this.add
        .sprite(monster.x * TILE + TILE / 2, monster.y * TILE + TILE / 2, monsterOverworld(monster.monsterId).key)
        .setDepth(10);
      this.sprites.set(`monster:${monster.monsterId}`, sprite);
    }

    const location = this.store.getSnapshot().player.location;
    this.player = this.placeCharacter(characterSheet("player").key, location.x, location.y, location.facing);

    this.cameras.main.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
    this.cameras.main.setZoom(CAMERA_ZOOM);
    this.cameras.main.startFollow(this.player, true, 0.12, 0.12);
    this.cameras.main.setBackgroundColor("#14101f");

    const keyboard = this.input.keyboard;
    if (keyboard) {
      this.cursors = keyboard.createCursorKeys();
      this.wasd = {
        up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };

      // Polling held keys in update() alone drops quick taps: a key pressed and released
      // between two frames is never seen as `isDown`. Tapping a direction and having nothing
      // happen is the single most frustrating thing a grid RPG can do, so a keydown EVENT
      // moves immediately and update() only handles the repeat while a key stays held.
      keyboard.on("keydown", (event: KeyboardEvent) => {
        const direction = KEY_DIRECTIONS[event.code];
        if (direction) {
          this.tryMove(direction, this.time.now);
          return;
        }
        // Talk to whoever you are FACING (FR-034). Core decides whether anyone is there; a
        // blocked step still turns the player, which is what makes this feel natural.
        if (event.code === "KeyE" || event.code === "Enter" || event.code === "Space") {
          this.store.dispatch({ type: "interact" });
        }
      });
    }

    const patrol = this.time.addEvent({
      delay: PATROL_INTERVAL_MS,
      loop: true,
      callback: () => this.store.dispatch({ type: "step-world" }),
    });

    const unsubscribe = this.store.subscribe(() => this.syncFromState());
    // Unsubscribing on shutdown is mandatory: a listener that outlives its scene eventually
    // updates destroyed sprites.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unsubscribe();
      patrol.remove();
      this.sprites.clear();
    });
  }

  private placeCharacter(key: string, tileX: number, tileY: number, facing: Direction): Phaser.GameObjects.Sprite {
    // Origin bottom-centre: feet stand on the tile the character occupies (asset contract § 2).
    return this.add
      .sprite(tileX * TILE + TILE / 2, tileY * TILE + TILE, key, CHARACTER_ROWS[facing] * CHARACTER_COLUMNS)
      .setOrigin(0.5, 1)
      .setDepth(10);
  }

  private createAnimations(id: string): void {
    const key = characterSheet(id).key;
    for (const [facing, row] of Object.entries(CHARACTER_ROWS)) {
      const name = `${id}:walk:${facing}`;
      if (this.anims.exists(name)) continue;
      this.anims.create({
        key: name,
        // Columns 0-3: idle, step A, idle, step B — reads as step-return-step-return.
        frames: this.anims.generateFrameNumbers(key, {
          start: row * CHARACTER_COLUMNS,
          end: row * CHARACTER_COLUMNS + CHARACTER_COLUMNS - 1,
        }),
        frameRate: WALK_FPS,
        repeat: -1,
      });
    }
  }

  private syncFromState(): void {
    const state = this.store.getSnapshot();
    if (!state.world) return;

    // A map change means new tiles and new art — restart so preload runs again.
    if (state.world.map.id !== this.mapId) {
      this.scene.restart();
      return;
    }

    for (const monster of state.world.monsters) {
      const sprite = this.sprites.get(`monster:${monster.monsterId}`);
      if (!sprite) continue;
      this.tweens.add({
        targets: sprite,
        x: monster.x * TILE + TILE / 2,
        y: monster.y * TILE + TILE / 2,
        duration: 260,
        ease: "Sine.easeInOut",
      });
    }

    // A restored word is gone from the map immediately (FR-033).
    for (const [key, sprite] of this.sprites) {
      if (!key.startsWith("monster:")) continue;
      const id = key.slice("monster:".length);
      if (!state.world.monsters.some((m) => m.monsterId === id)) {
        sprite.destroy();
        this.sprites.delete(key);
      }
    }

    const { x, y, facing } = state.player.location;
    const targetX = x * TILE + TILE / 2;
    const targetY = y * TILE + TILE;
    if (this.player.x !== targetX || this.player.y !== targetY) {
      this.player.anims.play(`player:walk:${facing}`, true);
      this.tweens.add({
        targets: this.player,
        x: targetX,
        y: targetY,
        duration: MOVE_REPEAT_MS,
        ease: "Linear",
        onComplete: () => {
          this.player.anims.stop();
          this.player.setFrame(CHARACTER_ROWS[facing] * CHARACTER_COLUMNS);
        },
      });
    } else {
      this.player.setFrame(CHARACTER_ROWS[facing] * CHARACTER_COLUMNS);
    }
  }

  /** Single throttle for both tap and hold, so the two input paths cannot double-step. */
  private tryMove(direction: Direction, time: number): void {
    if (time - this.lastMoveAt < MOVE_REPEAT_MS) return;
    this.lastMoveAt = time;
    this.store.dispatch({ type: "move", direction });
  }

  override update(time: number): void {
    if (!this.cursors) return;

    const pressed: Direction[] = [];
    if (this.cursors.up.isDown || this.wasd.up.isDown) pressed.push("up");
    if (this.cursors.down.isDown || this.wasd.down.isDown) pressed.push("down");
    if (this.cursors.left.isDown || this.wasd.left.isDown) pressed.push("left");
    if (this.cursors.right.isDown || this.wasd.right.isDown) pressed.push("right");
    if (pressed.length === 0) return;

    // Vertical wins a tie — core owns that rule, this just forwards the first resolved axis.
    const direction = pressed.find((d) => d === "up" || d === "down") ?? pressed[0];
    if (direction) this.tryMove(direction, time);
  }
}
