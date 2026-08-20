import Phaser from "phaser";
import { MONSTER_FRAMES, monsterSheet } from "../assets";
import type { GameStore } from "../../runtime/GameStore";

/**
 * T053 + T054. The monster, and what happens to it.
 *
 * NO TEXT. React renders every word the player reads (research R-014); this scene draws the
 * creature, the hits, and the restoration. If you find yourself reaching for `this.add.text`
 * for player-facing copy, it belongs in a React component.
 *
 * The scene owns no rules. It watches store state and animates the difference.
 */
export class BattleScene extends Phaser.Scene {
  private monster!: Phaser.GameObjects.Sprite;
  private store!: GameStore;
  private lastMonsterHp = Number.POSITIVE_INFINITY;
  private lastPlayerHp = Number.POSITIVE_INFINITY;
  private lastOutcome: string | null = null;

  constructor() {
    super("Battle");
  }

  create(): void {
    this.store = this.registry.get("store") as GameStore;
    const snapshot = this.store.getSnapshot();
    const battle = snapshot.battle;
    if (!battle) return;

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#1b1530");

    // A simple ground band so the monster reads as standing somewhere, not floating.
    this.add.rectangle(width / 2, height * 0.62, width, 4, 0x4b3d70, 0.6);

    this.monster = this.add
      .sprite(width / 2, height * 0.42, monsterSheet(battle.monsterId).key, MONSTER_FRAMES.idle)
      .setScale(2);

    this.tweens.add({
      targets: this.monster,
      y: this.monster.y - 8,
      duration: 1600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.lastMonsterHp = battle.monsterHp;
    this.lastPlayerHp = battle.player.hp;

    // MUST unsubscribe on shutdown, or the listener outlives the scene and eventually updates a
    // destroyed sprite. This is the most likely defect in this layer.
    const unsubscribe = this.store.subscribe(() => this.syncFromState());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
  }

  private syncFromState(): void {
    const battle = this.store.getSnapshot().battle;
    if (!battle || !this.monster.active) return;

    if (battle.monsterHp < this.lastMonsterHp) this.playHurt();
    if (battle.player.hp < this.lastPlayerHp) this.playAttack();

    if (battle.outcome && battle.outcome !== this.lastOutcome) {
      if (battle.outcome === "victory") this.playRestoration();
      if (battle.outcome === "defeat") this.playDefeat();
      this.lastOutcome = battle.outcome;
    }

    this.lastMonsterHp = battle.monsterHp;
    this.lastPlayerHp = battle.player.hp;
  }

  private playHurt(): void {
    this.monster.setFrame(MONSTER_FRAMES.hurt);
    this.cameras.main.shake(120, 0.006);
    this.tweens.add({
      targets: this.monster,
      alpha: 0.35,
      duration: 70,
      yoyo: true,
      repeat: 1,
      onComplete: () => {
        this.monster.setAlpha(1);
        this.monster.setFrame(MONSTER_FRAMES.idle);
      },
    });
  }

  private playAttack(): void {
    this.monster.setFrame(MONSTER_FRAMES.attack);
    this.tweens.add({
      targets: this.monster,
      y: this.monster.y + 26,
      duration: 110,
      yoyo: true,
      ease: "Quad.easeOut",
      onComplete: () => this.monster.setFrame(MONSTER_FRAMES.idle),
    });
    this.cameras.main.flash(140, 90, 20, 20);
  }

  /**
   * Victory is RESTORATION (Constitution Principle I).
   *
   * The word is not killed. It brightens, settles, and rises — freed from The Silence. Nothing
   * here may read as a death: no fade to nothing, no fall, no dark flash.
   */
  private playRestoration(): void {
    this.tweens.killTweensOf(this.monster);
    this.monster.setFrame(MONSTER_FRAMES.restored);
    this.cameras.main.flash(420, 240, 226, 190);
    this.tweens.add({
      targets: this.monster,
      y: this.monster.y - 24,
      scale: 2.25,
      duration: 900,
      ease: "Sine.easeOut",
    });
  }

  private playDefeat(): void {
    this.tweens.killTweensOf(this.monster);
    this.monster.setFrame(MONSTER_FRAMES.idle);
    this.cameras.main.fade(600, 10, 8, 18, false);
  }
}
