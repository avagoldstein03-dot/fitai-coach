// Sends the account back through the onboarding flow, for screenshots or for
// checking changes to it. RootNavigator reads onboardingCompleted from
// /api/auth/profile at launch, so the app shows onboarding again after a reload.
//
//   node scripts/replay-onboarding.js            # replay onboarding
//   node scripts/replay-onboarding.js --restore  # put the profile back
//
// Walking onboarding again overwrites profile answers (age, weight, goal, life
// stage and so on), so the current values are saved first and --restore puts
// them back exactly. Nothing else on the account is touched — meals, workouts
// and history are untouched either way.

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const EMAIL = "avagoldstein03@gmail.com";
const SNAPSHOT = path.join(__dirname, ".onboarding-snapshot.json");
const RESTORE = process.argv.includes("--restore");

// The fields the onboarding flow writes, and therefore the ones that can be lost.
const FIELDS = {
  onboardingCompleted: true, onboardingStep: true,
  name: true, age: true, sex: true, height: true, weight: true,
  activityLevel: true, fitnessExperience: true, dietPreferences: true,
  foodAllergies: true, injuryHistory: true, lifeStage: true,
};

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, ...FIELDS } });
  if (!user) { console.log("User not found:", EMAIL); return; }
  const { id, ...profile } = user;

  if (RESTORE) {
    if (!fs.existsSync(SNAPSHOT)) { console.log("No snapshot to restore from."); return; }
    const saved = JSON.parse(fs.readFileSync(SNAPSHOT, "utf8"));
    await prisma.user.update({ where: { id }, data: saved });
    fs.unlinkSync(SNAPSHOT);
    console.log("Profile restored:");
    console.log(`  ${saved.name}, ${saved.age}, ${saved.sex}, ${saved.weight}kg, ${saved.activityLevel}`);
    console.log("  onboardingCompleted back to", saved.onboardingCompleted);
    return;
  }

  fs.writeFileSync(SNAPSHOT, JSON.stringify(profile, null, 2));
  await prisma.user.update({
    where: { id },
    data: { onboardingCompleted: false, onboardingStep: 0 },
  });

  console.log("Onboarding will replay on next app launch.\n");
  console.log("Saved first, so nothing is lost:");
  console.log(`  ${profile.name}, age ${profile.age}, ${profile.sex}, ${profile.weight}kg, ${profile.height}cm`);
  console.log(`  activity ${profile.activityLevel}, experience ${profile.fitnessExperience}, life stage ${profile.lifeStage ?? "not set"}`);
  console.log("\nReload the app (Cmd+R in the Simulator) to see it.");
  console.log("Put the profile back with:  node scripts/replay-onboarding.js --restore");
}

main().catch((e) => console.error(e)).finally(() => prisma.$disconnect());
