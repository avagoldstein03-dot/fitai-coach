export interface CoachingProfile {
  age?: number | null;
  fitnessExperience?: string | null;
  injuryHistory?: string | null;
}

const OLDER_AGE_THRESHOLD = 55;
const MAX_INJURY_LENGTH = 300;

// Turns profile signals into explicit behavioral instructions for the AI,
// rather than hoping the model infers them from raw age/experience numbers.
export function buildCoachingDirective(profile: CoachingProfile): string {
  const directives: string[] = [];

  if (profile.fitnessExperience === "beginner") {
    directives.push(
      "This user is a beginner. Prioritize proper form, technique confidence, and building a consistent habit over intensity or fast progression. Use simple, encouraging language and avoid advanced jargon."
    );
  } else if (profile.fitnessExperience === "advanced") {
    directives.push(
      "This user is experienced. You can use more technical language (periodization, RPE, progressive overload) and suggest more advanced programming without over-explaining basics."
    );
  }

  if (profile.age != null && profile.age >= OLDER_AGE_THRESHOLD) {
    directives.push(
      "This user is over 55. Favor joint-friendly exercise modifications, emphasize recovery and gradual progression, and avoid recommending maximal-effort or high-impact movements without a base-building period. This is general guidance, not medical advice — recommend consulting a doctor before starting new high-intensity activity."
    );
  }

  if (profile.injuryHistory && profile.injuryHistory.trim()) {
    const truncated = profile.injuryHistory.trim().slice(0, MAX_INJURY_LENGTH);
    directives.push(
      `This user has reported the following injury or mobility limitation: "${truncated}". Avoid recommending exercises that would aggravate this, suggest safe modifications or alternatives, and remind them this is general guidance, not medical advice — they should consult a doctor or physical therapist for anything related to this condition.`
    );
  }

  if (!directives.length) {
    return "No special coaching adaptations needed based on the profile provided — coach normally, evidence-based and encouraging.";
  }

  return directives.join("\n");
}
