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
  generateProgressReview(userProfile: ProgressReviewInput): Promise<string>;
  analyzeForm(input: FormCheckInput): Promise<FormCheckResult>;
  chat(userMessage: string, context: ChatContext): Promise<string>;
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
}

export interface ProgressReviewInput {
  userId: string;
  mealsLogged: number;
  workoutsCompleted: number;
  weightChange: number;
  bodyMetrics: Record<string, number>;
  period: string; // "weekly" | "monthly"
}

export interface ChatContext {
  userId: string;
  isPremium: boolean;
  tier: "free" | "starter" | "pro" | "elite";
  userProfile: Record<string, any>;
  recentMeals: any[];
  recentWorkouts: any[];
  goals: any[];
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
