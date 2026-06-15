import {
  installService,
  serviceInstalled,
  serviceKind,
  uninstallService,
} from "../service";

export function cmdServiceInstall(): void {
  if (serviceKind() === "unsupported") {
    console.log(`❌ Autostart is not supported on "${process.platform}".`);
    process.exit(1);
  }

  console.log("⚙️  Installing crctl autostart service...");
  const result = installService();
  for (const step of result.steps) {
    console.log(`   ${step}`);
  }

  if (!result.ok) {
    console.log("");
    console.log("❌ Could not enable the service.");
    process.exit(1);
  }

  console.log("");
  console.log("✅ Done! Your sessions will be restored after each login.");
  console.log("   Restore now without rebooting: crctl restore");
}

export function cmdServiceUninstall(): void {
  if (serviceKind() === "unsupported") {
    console.log(`❌ Autostart is not supported on "${process.platform}".`);
    process.exit(1);
  }

  console.log("🗑️  Removing crctl autostart service...");
  const result = uninstallService();
  for (const step of result.steps) {
    console.log(`   ${step}`);
  }
  console.log("");
  console.log("✅ Autostart disabled.");
}

export function cmdServiceStatus(): void {
  const kind = serviceKind();
  if (kind === "unsupported") {
    console.log(`Autostart is not supported on "${process.platform}".`);
    return;
  }

  const installed = serviceInstalled();
  console.log(`Init system: ${kind}`);
  console.log(
    installed
      ? "Status: ✅ installed (sessions restore on login)"
      : "Status: ⚪ not installed — run: crctl service install"
  );
}
