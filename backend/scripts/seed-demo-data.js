// Fills the account with realistic recent activity so the app screenshots as a
// lived-in one rather than an empty new install. Written for App Store and
// marketing captures.
//
//   node scripts/seed-demo-data.js            # dry run — prints what it would do
//   node scripts/seed-demo-data.js --apply    # writes
//   node scripts/seed-demo-data.js --undo     # removes exactly what it wrote
//
// Additive only. Every row it creates is recorded in scripts/.seed-manifest.json
// so --undo deletes precisely those and nothing else — it never touches data
// that was already there.

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();
const EMAIL = "avagoldstein03@gmail.com";
const MANIFEST = path.join(__dirname, ".seed-manifest.json");

const APPLY = process.argv.includes("--apply");
const UNDO = process.argv.includes("--undo");

const midnight = (daysAgo) => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - daysAgo);
  return d;
};
const at = (daysAgo, hour, min = 0) => {
  const d = midnight(daysAgo);
  d.setHours(hour, min, 0, 0);
  return d;
};
// Deterministic jitter, so repeated dry runs show the same numbers.
const vary = (base, spread, seed) => Math.round(base + Math.sin(seed * 12.9898) * spread);

// --- Meals -----------------------------------------------------------------
// Four rotating days that each land near 2,100 kcal and 160g protein, matching
// the recomposition targets on the account.
const MEAL_DAYS = [
  [
    { type: "breakfast", h: 8, name: "Greek yogurt, berries & granola", items: [
      ["Greek yogurt, 0% fat", 200, "g", 120, 20, 9, 0, 0],
      ["Blueberries", 80, "g", 45, 1, 11, 0, 2],
      ["Granola", 35, "g", 160, 4, 22, 6, 3],
    ]},
    { type: "lunch", h: 13, name: "Chicken & rice bowl", items: [
      ["Grilled chicken breast", 170, "g", 280, 52, 0, 6, 0],
      ["Jasmine rice, cooked", 180, "g", 234, 5, 51, 1, 1],
      ["Avocado", 60, "g", 96, 1, 5, 9, 4],
    ]},
    { type: "snack", h: 16, name: "Protein shake", items: [
      ["Whey protein, vanilla", 32, "g", 120, 25, 3, 1, 0],
      ["Banana", 110, "g", 98, 1, 25, 0, 3],
    ]},
    { type: "dinner", h: 20, name: "Salmon, potatoes & greens", items: [
      ["Baked salmon", 160, "g", 330, 40, 0, 19, 0],
      ["Roasted baby potatoes", 200, "g", 180, 4, 40, 0, 4],
      ["Steamed broccoli", 120, "g", 42, 3, 8, 0, 3],
    ]},

    { type: "snack", h: 21, name: "Popcorn & dark chocolate", items: [
      ["Popcorn, air popped", 40, "g", 160, 4, 32, 2, 6],
      ["Dark chocolate 70%", 40, "g", 230, 3, 18, 16, 4],
      ["Mandarin", 100, "g", 50, 1, 13, 0, 2],
    ]},  ],
  [
    { type: "breakfast", h: 7, name: "Egg white omelette & toast", items: [
      ["Egg whites", 200, "g", 104, 22, 1, 0, 0],
      ["Whole eggs", 100, "g", 143, 13, 1, 10, 0],
      ["Sourdough toast", 60, "g", 160, 6, 31, 1, 2],
    ]},
    { type: "lunch", h: 12, name: "Turkey wrap", items: [
      ["Sliced turkey breast", 140, "g", 158, 33, 2, 2, 0],
      ["Whole wheat wrap", 70, "g", 190, 7, 32, 4, 5],
      ["Hummus", 40, "g", 110, 3, 7, 8, 3],
    ]},
    { type: "snack", h: 16, name: "Cottage cheese & almonds", items: [
      ["Cottage cheese, low fat", 170, "g", 144, 24, 6, 2, 0],
      ["Almonds", 20, "g", 116, 4, 4, 10, 3],
    ]},
    { type: "dinner", h: 19, name: "Steak & sweet potato", items: [
      ["Sirloin steak", 170, "g", 340, 51, 0, 15, 0],
      ["Sweet potato, baked", 200, "g", 180, 4, 41, 0, 6],
      ["Green salad with olive oil", 100, "g", 120, 2, 5, 11, 2],
    ]},

    { type: "snack", h: 21, name: "Toast, honey & ice cream", items: [
      ["Sourdough toast", 60, "g", 160, 6, 31, 1, 2],
      ["Honey", 20, "g", 61, 0, 17, 0, 0],
      ["Vanilla ice cream", 100, "g", 207, 4, 24, 11, 1],
    ]},  ],
  [
    { type: "breakfast", h: 8, name: "Overnight oats", items: [
      ["Rolled oats", 60, "g", 228, 8, 40, 4, 6],
      ["Whey protein, chocolate", 32, "g", 120, 25, 3, 1, 1],
      ["Peanut butter", 16, "g", 95, 4, 3, 8, 1],
    ]},
    { type: "lunch", h: 13, name: "Tuna poke bowl", items: [
      ["Ahi tuna", 150, "g", 165, 37, 0, 1, 0],
      ["Sushi rice", 180, "g", 234, 4, 52, 0, 1],
      ["Edamame", 80, "g", 98, 9, 7, 4, 4],
    ]},
    { type: "snack", h: 15, name: "Rice cakes & turkey", items: [
      ["Rice cakes", 30, "g", 115, 2, 24, 1, 1],
      ["Sliced turkey breast", 80, "g", 90, 19, 1, 1, 0],
    ]},
    { type: "dinner", h: 20, name: "Chicken stir fry", items: [
      ["Chicken thigh, skinless", 180, "g", 318, 45, 0, 15, 0],
      ["Mixed stir fry vegetables", 200, "g", 80, 4, 14, 1, 5],
      ["Rice noodles, cooked", 150, "g", 192, 3, 44, 0, 2],
    ]},

    { type: "snack", h: 21, name: "Trail mix & apple", items: [
      ["Trail mix", 50, "g", 250, 7, 25, 14, 4],
      ["Apple", 180, "g", 94, 0, 25, 0, 4],
      ["Dark chocolate 70%", 30, "g", 172, 2, 13, 12, 3],
    ]},  ],
  [
    { type: "breakfast", h: 9, name: "Protein pancakes", items: [
      ["Protein pancake mix", 70, "g", 250, 22, 30, 4, 3],
      ["Blueberries", 70, "g", 40, 1, 10, 0, 2],
      ["Maple syrup", 20, "g", 52, 0, 13, 0, 0],
    ]},
    { type: "lunch", h: 13, name: "Burrito bowl", items: [
      ["Grilled chicken breast", 160, "g", 264, 49, 0, 6, 0],
      ["Brown rice, cooked", 160, "g", 176, 4, 37, 1, 3],
      ["Black beans", 100, "g", 132, 9, 24, 0, 9],
      ["Pico de gallo", 60, "g", 18, 1, 4, 0, 1],
    ]},
    { type: "snack", h: 17, name: "Protein bar", items: [
      ["Protein bar", 60, "g", 210, 20, 22, 7, 8],
    ]},
    { type: "dinner", h: 20, name: "Shrimp pasta", items: [
      ["Shrimp", 180, "g", 171, 36, 2, 2, 0],
      ["Pasta, cooked", 180, "g", 286, 10, 56, 2, 3],
      ["Marinara sauce", 120, "g", 70, 2, 12, 2, 3],
    ]},

    { type: "snack", h: 21, name: "Peanut butter toast & milk", items: [
      ["Sourdough toast", 60, "g", 160, 6, 31, 1, 2],
      ["Peanut butter", 24, "g", 142, 6, 5, 12, 2],
      ["Whole milk", 250, "ml", 155, 8, 12, 8, 0],
      ["Honey", 15, "g", 46, 0, 12, 0, 0],
    ]},  ],
];

// --- Training --------------------------------------------------------------
// Weights that creep up week to week, so the progress screens show a real trend.
const SESSION_DAYS = [0, 2, 4, 6]; // matches the active program's training days

async function buildPlan(user) {
  const program = await prisma.workoutProgram.findFirst({
    where: { userId: user.id, isActive: true },
    orderBy: { createdAt: "desc" },
    include: {
      weeks: { take: 1, orderBy: { weekNumber: "asc" },
        include: { days: { orderBy: { dayOfWeek: "asc" },
          include: { exercises: { orderBy: { position: "asc" } } } } } },
    },
  });

  const health = [];
  for (let d = 0; d < 14; d++) {
    health.push({
      date: midnight(d),
      steps: vary(8600, 2600, d + 1),
      activeEnergyKcal: vary(430, 140, d + 7),
      sleepMinutes: vary(437, 52, d + 3),      // ~7h15m, ±52min
      restingHeartRate: vary(60, 4, d + 11),
    });
  }

  const meals = [];
  // Ten days back through today. Today stops after lunch, so the dashboard reads
  // as mid-day rather than a finished day.
  for (let d = 9; d >= 0; d--) {
    const day = MEAL_DAYS[d % MEAL_DAYS.length];
    for (const m of day) {
      // Today only includes meals whose time has already passed, so the
      // dashboard reads as a day in progress rather than a finished one.
      if (d === 0 && m.h > new Date().getHours()) continue;
      meals.push({ daysAgo: d, ...m });
    }
  }

  const sessions = [];
  if (program?.weeks?.[0]) {
    const byDow = new Map(program.weeks[0].days.map((x) => [x.dayOfWeek, x]));
    for (let d = 13; d >= 1; d--) {
      const dow = (midnight(d).getDay() + 6) % 7; // Monday = 0
      if (!SESSION_DAYS.includes(dow)) continue;
      const planDay = byDow.get(dow);
      if (!planDay) continue;
      const weekIndex = Math.floor(d / 7); // 1 = older week, 0 = this week
      for (const [i, ex] of planDay.exercises.filter((e) => e.category !== "core").entries()) {
        const base = 20 + i * 12;
        sessions.push({
          daysAgo: d,
          exerciseName: ex.exerciseName,
          plannedSets: ex.sets,
          plannedReps: ex.reps,
          completedSets: ex.sets,
          completedReps: ex.reps,
          // Heavier in the more recent week — progressive overload made visible.
          weight: base + (weekIndex === 0 ? 2.5 : 0),
          durationMinutes: null,
        });
      }
    }
  }

  const weights = [
    { daysAgo: 21, weight: 68.4 },
    { daysAgo: 14, weight: 68.0 },
    { daysAgo: 9, weight: 67.6 },
    { daysAgo: 4, weight: 67.3 },
    { daysAgo: 1, weight: 67.1 },
  ];

  return { program, health, meals, sessions, weights };
}

const sum = (items, i) => items.reduce((a, x) => a + x[i], 0);

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL }, select: { id: true, name: true } });
  if (!user) { console.log("User not found:", EMAIL); return; }

  if (UNDO) {
    if (!fs.existsSync(MANIFEST)) { console.log("No manifest — nothing was seeded by this script."); return; }
    const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
    const r1 = await prisma.foodItem.deleteMany({ where: { mealId: { in: m.mealIds ?? [] } } });
    const r2 = await prisma.meal.deleteMany({ where: { id: { in: m.mealIds ?? [] } } });
    const r3 = await prisma.workoutSession.deleteMany({ where: { id: { in: m.sessionIds ?? [] } } });
    const r4 = await prisma.weightLog.deleteMany({ where: { id: { in: m.weightIds ?? [] } } });
    const r5 = await prisma.healthMetric.deleteMany({ where: { id: { in: m.healthIds ?? [] } } });
    console.log(`Removed — foods ${r1.count}, meals ${r2.count}, sessions ${r3.count}, weights ${r4.count}, health ${r5.count}`);
    fs.unlinkSync(MANIFEST);
    return;
  }

  const plan = await buildPlan(user);

  console.log(`\nAccount: ${user.name} (${EMAIL})`);
  console.log(`Program: ${plan.program?.name ?? "none — sessions will be skipped"}\n`);
  console.log("Would create:");
  console.log(`  ${plan.health.length} days of health metrics (sleep, steps, resting HR, active energy)`);
  console.log(`  ${plan.meals.length} meals across 10 days, ${plan.meals.reduce((a, m) => a + m.items.length, 0)} food items`);
  console.log(`  ${plan.sessions.length} logged workout sets across 2 weeks`);
  console.log(`  ${plan.weights.length} weight entries over 3 weeks\n`);

  const todays = plan.meals.filter((m) => m.daysAgo === 0);
  console.log("Today would show:");
  todays.forEach((m) => console.log(`  ${m.type.padEnd(10)} ${m.name} — ${sum(m.items, 3)} kcal, ${sum(m.items, 4)}g protein`));
  console.log(`  TOTAL      ${todays.reduce((a, m) => a + sum(m.items, 3), 0)} kcal, ${todays.reduce((a, m) => a + sum(m.items, 4), 0)}g protein`);
  const yday = plan.meals.filter((m) => m.daysAgo === 1);
  console.log(`  (yesterday, complete: ${yday.reduce((a, m) => a + sum(m.items, 3), 0)} kcal, ${yday.reduce((a, m) => a + sum(m.items, 4), 0)}g protein)`);
  console.log(`\nLast night's sleep: ${Math.floor(plan.health[0].sleepMinutes / 60)}h ${plan.health[0].sleepMinutes % 60}m` +
    `, resting HR ${plan.health[0].restingHeartRate}, steps ${plan.health[0].steps}`);

  if (!APPLY) {
    console.log("\nDRY RUN — nothing written. Re-run with --apply to write it.");
    return;
  }

  const manifest = { createdAt: new Date().toISOString(), mealIds: [], sessionIds: [], weightIds: [], healthIds: [] };

  for (const h of plan.health) {
    // Upsert: (userId, date) is unique, and real HealthKit rows may already exist.
    const row = await prisma.healthMetric.upsert({
      where: { userId_date: { userId: user.id, date: h.date } },
      update: { steps: h.steps, activeEnergyKcal: h.activeEnergyKcal, sleepMinutes: h.sleepMinutes, restingHeartRate: h.restingHeartRate },
      create: { userId: user.id, ...h, source: "healthkit" },
    });
    manifest.healthIds.push(row.id);
  }

  for (const m of plan.meals) {
    const when = at(m.daysAgo, m.h, 0);
    const row = await prisma.meal.create({
      data: {
        userId: user.id, mealType: m.type, notes: m.name,
        totalCalories: sum(m.items, 3), totalProtein: sum(m.items, 4),
        totalCarbs: sum(m.items, 5), totalFat: sum(m.items, 6), totalFiber: sum(m.items, 7),
        createdAt: when, updatedAt: when,
        foods: { create: m.items.map(([foodName, quantity, unit, calories, protein, carbs, fat, fiber]) => ({
          foodName, quantity, unit, calories, protein, carbs, fat, fiber,
        })) },
      },
    });
    manifest.mealIds.push(row.id);
  }

  for (const s of plan.sessions) {
    const when = at(s.daysAgo, 18, 30);
    const { daysAgo, ...rest } = s;
    const row = await prisma.workoutSession.create({
      data: { userId: user.id, ...rest, isCompleted: true, createdAt: when, updatedAt: when },
    });
    manifest.sessionIds.push(row.id);
  }

  for (const w of plan.weights) {
    const row = await prisma.weightLog.create({
      data: { userId: user.id, weight: w.weight, loggedAt: at(w.daysAgo, 7, 30), source: "manual" },
    });
    manifest.weightIds.push(row.id);
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`\nWritten. Manifest at scripts/.seed-manifest.json`);
  console.log(`Undo any time with:  node scripts/seed-demo-data.js --undo`);
}

main().catch((e) => console.error(e)).finally(() => prisma.$disconnect());
