import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getCompletionScript, SUPPORTED_SHELLS } from "../completions";
import { detectShell } from "../utils";

export function cmdGenerate(shell: string): void {
  const script = getCompletionScript(shell);
  if (!script) {
    console.log(`❌ Unknown shell: ${shell}`);
    console.log(`   Supported: ${SUPPORTED_SHELLS.join(", ")}`);
    process.exit(1);
  }
  console.log(script);
}

export function cmdSetup(): void {
  const shell = process.env.SHELL || "";
  const shellName = detectShell(shell);

  console.log(`🐚 Detected shell: ${shellName} (${shell})`);

  const compScript = getCompletionScript(shellName)!;

  if (shellName === "fish") {
    const completionsDir = join(homedir(), ".config", "fish", "completions");
    const targetPath = join(completionsDir, "crctl.fish");

    try {
      mkdirSync(completionsDir, { recursive: true });
      writeFileSync(targetPath, compScript);
      console.log(`✅ Auto-completion installed: ${targetPath}`);
      console.log("");
      console.log("   Restart your terminal or run:");
      console.log(`   fish_update_completions`);
    } catch {
      console.log("❌ Failed to install automatically.");
      console.log("");
      console.log("   Install manually:");
      console.log(`   mkdir -p ${completionsDir}`);
      console.log(`   crctl generate fish > ${targetPath}`);
    }
  } else if (shellName === "bash") {
    const targetPath = join(homedir(), ".bash_completion_crctl");

    try {
      writeFileSync(targetPath, compScript);
      console.log(`✅ Auto-completion script: ${targetPath}`);
      console.log("");
      console.log("   Add to ~/.bashrc:");
      console.log(`   source ${targetPath}`);
    } catch {
      console.log("❌ Failed to install.");
      console.log("");
      console.log("   Install manually:");
      console.log(`   crctl generate bash > ${targetPath}`);
      console.log(`   echo 'source ${targetPath}' >> ~/.bashrc`);
    }
  } else {
    const zshDir = join(homedir(), ".oh-my-zsh", "custom", "plugins", "crctl");
    const targetPath = join(zshDir, "_crctl");

    try {
      mkdirSync(zshDir, { recursive: true });
      writeFileSync(targetPath, compScript);
      console.log(`✅ Auto-completion script: ${targetPath}`);
      console.log("");
      console.log("   Add 'crctl' to plugins in ~/.zshrc");
    } catch {
      console.log("❌ Failed to install.");
      console.log("");
      console.log("   Install manually:");
      console.log(
        `   crctl generate zsh > /usr/local/share/zsh/site-functions/_crctl`
      );
    }
  }
}
