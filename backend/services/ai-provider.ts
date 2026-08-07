export interface DetectedFoodItem {
  name: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  x: number; // normalized 0-1 horizontal center
  y: number; // normalized 0-1 vertical center
}

export interface FoodAnalysisResult {
  foodName: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  confidenceScore: number;
  items: DetectedFoodItem[];
}

export interface BodyAnalysisInput {
  userId: string;
  frontImageUrl: string;
  sideImageUrl: string;
  backImageUrl: string;
  userHeight?: number;
  userWeight?: number;
  userAge?: number;
  userSex?: string;
}

export interface BodyFocusArea {
  label: string;
  x: number; // normalized 0-1 on front photo
  y: number; // normalized 0-1 on front photo
  type: 'strength' | 'improvement';
}

export interface BodyAnalysisResult {
  bodyComposition: Record<string, string>;
  posture: Record<string, string>;
  strengths: string[];
  areasForImprovement: string[];
  recommendations: {
    exercise: string[];
    nutrition: string[];
    recovery: string[];
  };
  summary: string;
  focusAreas: BodyFocusArea[];
}

export interface WorkoutPlanExercise {
  exerciseName: string;
  sets: number;
  reps: string;
  restSeconds: number;
  notes?: string;
}

export interface WorkoutPlanDay {
  dayOfWeek: number; // 0-6
  exercises: WorkoutPlanExercise[];
}

export interface WorkoutPlanWeek {
  weekNumber: number;
  progressionStrategy: string;
  days: WorkoutPlanDay[];
}

export interface WorkoutPlanResult {
  coachNote: string;
  weeks: WorkoutPlanWeek[];
}

// Abstract AI Provider interface
export interface AIProvider {
  analyzeFood(imageUrl: string): Promise<FoodAnalysisResult>;
  analyzeBody(input: BodyAnalysisInput): Promise<BodyAnalysisResult>;
  generateWorkout(userProfile: WorkoutGenerationInput): Promise<WorkoutPlanResult>;
  generateMealPlan(userProfile: NutritionGenerationInput): Promise<MealPlanResult>;
  generateProgressReview(userProfile: ProgressReviewInput): Promise<ProgressReviewResult>;
  analyzeForm(input: FormCheckInput): Promise<FormCheckResult>;
  chat(userMessage: string, context: ChatContext): Promise<string>;
  generateCrossDomainInsights(signals: CrossDomainSignal[]): Promise<string[]>;
}

export interface CrossDomainSignal {
  description: string;
}

export interface WorkoutGenerationInput {
  goal: string;
  experience: string;
  equipment: string[];
  durationWeeks: number;
  daysPerWeek: number;
  sex?: string;
  bodyGoalFocus?: string;
  specificFocus?: string;
  assessmentSummary?: string;
}

export interface MealPlanMeal {
  name: string; // "Breakfast" | "Lunch" | "Dinner" | "Snack"
  foods: string[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface MealPlanDay {
  day: string; // "Monday", "Tuesday", ...
  meals: MealPlanMeal[];
}

export interface MealPlanResult {
  days: MealPlanDay[];
}

export interface NutritionGenerationInput {
  goal: string;
  weight: number;
  activityLevel: string;
  dietPreferences: string[];
  foodAllergies: string[];
  tier: string; // "starter" | "pro" | "elite" — pro/elite get exact gram measurements per food
}

export interface ProgressReviewInput {
  userId: string;
  mealsLogged: number;
  workoutsCompleted: number;
  weightChange: number;
  bodyMetrics: Record<string, number>;
  period: string; // "weekly" | "monthly"
  tier: string; // "pro" | "elite" — elite gets a deeper review with more specific fixes
}

export interface ProgressReviewResult {
  wins: string[]; // 1-3 short positive callouts — always present, always rendered first
  insight?: string; // a behavioral pattern worth noting, omitted if nothing stands out
  adjustments?: string[]; // specific, actionable fixes — 1 for Pro, up to 3 for Elite
  closing: string; // one short motivating closing line
}

export interface ChatMessageTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatContext {
  userId: string;
  isPremium: boolean;
  tier: "free" | "starter" | "pro" | "elite";
  userProfile: Record<string, any>;
  recentMeals: any[];
  recentWorkouts: any[];
  goals: any[];
  conversationHistory: ChatMessageTurn[];
  trendsSummary?: string;
  coachingDirective?: string;
  healthSummary?: string;
}

// Caps history to a token-safe window and enforces the strict user/assistant
// alternation Anthropic requires (and OpenAI tolerates fine): drops a leading
// assistant turn, and a trailing user turn (which could otherwise happen if a
// prior request saved the user's message but crashed before the reply saved,
// producing two consecutive user turns once the new message is appended).
export function sanitizeConversationHistory(
  messages: Array<{ role: string; content: string }>,
  maxMessages: number
): ChatMessageTurn[] {
  let trimmed = messages.slice(-maxMessages);

  if (trimmed.length && trimmed[0].role === "assistant") {
    trimmed = trimmed.slice(1);
  }
  if (trimmed.length && trimmed[trimmed.length - 1].role === "user") {
    trimmed = trimmed.slice(0, -1);
  }

  return trimmed.map((m) => ({
    role: m.role === "assistant" ? "assistant" : "user",
    content: m.content,
  }));
}

export interface FormCheckInput {
  exerciseName: string;
  images: Array<{ base64: string; mimeType: string }>;
  userNotes?: string;
}

export interface FormCheckResult {
  exerciseName: string;
  overallScore: number;
  muscles: string[];
  positives: string[];
  corrections: string[];
  cues: string[];
  safetyWarnings: string[];
  summary: string;
}
