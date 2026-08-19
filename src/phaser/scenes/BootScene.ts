import Phaser from "phaser";

/** Idle scene. The world map replaces this in US2 (T059). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor("#14101f");
    this.add
      .text(width / 2, height / 2, "Vocab Krub", { fontFamily: "monospace", fontSize: "20px", color: "#a99ec2" })
      .setOrigin(0.5);
  }
}
