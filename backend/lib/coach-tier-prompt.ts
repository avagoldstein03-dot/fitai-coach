export type CoachTier = "free" | "starter" | "pro" | "elite";

export function buildTierGatingPrompt(tier: CoachTier): string {
  if (tier === "elite") return ""; // full access, no restrictions

  const TIERS: Record<string, { can: string[]; cannot: string[]; upgradeTo: string; upgradeTag: string }> = {
    free: {
      can: [
        "general nutrition tips and calorie/macro estimates",
        "hydration, sleep, and recovery advice",
        "motivation and mindset coaching",
        "explanations of how specific exercises work",
        "feedback on meals the user has already logged",
      ],
      cannot: [
        "personalized multi-week workout programs or training schedules",
        "detailed day-by-day meal plans",
        "progress reviews or trend analysis",
        "body scan or body composition coaching",
        "supplement recommendations",
        "AI form check coaching",
      ],
      upgradeTo: "Starter",
      upgradeTag: "[UPGRADE:starter]",
    },
    starter: {
      can: [
        "everything a free user can ask",
        "discussing the workout programs and meal plans generated in the app",
        "general exercise programming advice",
      ],
      cannot: [
        "detailed weekly/monthly progress reviews or trend analysis",
        "body scan or body composition coaching",
        "supplement recommendations",
        "AI form check technique analysis",
        "advanced performance analytics",
      ],
      upgradeTo: "Pro",
      upgradeTag: "[UPGRADE:pro]",
    },
    pro: {
      can: [
        "everything Starter users can ask",
        "discussing progress reviews, body scan results, and body composition",
        "supplement recommendations",
      ],
      cannot: [
        "AI form check video/photo technique analysis",
        "live body scan coaching",
        "advanced analytics and performance modeling",
      ],
      upgradeTo: "Elite",
      upgradeTag: "[UPGRADE:elite]",
    },
  };

  const cfg = TIERS[tier];
  return `
IMPORTANT — This user is on the ${tier.charAt(0).toUpperCase() + tier.slice(1)} plan. Follow these rules strictly:

You MAY freely discuss:
${cfg.can.map((c) => `- ${c}`).join("\n")}

You MUST NOT provide:
${cfg.cannot.map((c) => `- ${c}`).join("\n")}

When the user asks about something in the "MUST NOT" list:
- Give 1-2 sentences of genuine, relevant value so they feel heard.
- Warmly explain that this feature is available on the ${cfg.upgradeTo} plan.
- Do NOT be salesy or pushy — keep it encouraging and helpful.
- End your ENTIRE response with the exact token ${cfg.upgradeTag} on its own line and nothing after it.

For everything else, respond fully and helpfully as normal.`.trim();
}
