// Types for API requests and responses

export interface RegisterRequest {
  email: string;
  name: string;
  password: string;
}

export interface OnboardingStep1Request {
  name: string;
  age: number;
  sex: "male" | "female" | "other";
  height: number; // cm
  weight: number; // kg
  language?: string;
  unitSystem?: "imperial" | "metric";
}

export interface OnboardingStep2Request {
  primaryGoal: "fat_loss" | "muscle_gain" | "recomposition" | "athletic_performance" | "general_health";
  targetWeight?: number;
  timeline?: number;
}

export interface OnboardingStep3Request {
  activityLevel: "sedentary" | "lightly_active" | "moderately_active" | "very_active";
}

export interface OnboardingStep4Request {
  fitnessExperience: "beginner" | "intermediate" | "advanced";
  injuryHistory?: string;
}

export interface OnboardingStep5Request {
  dietPreferences: string[]; // ["omnivore", "vegetarian", "vegan", "keto", "paleo", "mediterranean"]
}

export interface OnboardingStep6Request {
  foodAllergies: string[];
}

export interface OnboardingStep7Request {
  supplementHistory: string[];
}

export interface OnboardingStep8Request {
  assessmentMethod: "photo" | "manual";
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  age?: number;
  sex?: string;
  height?: number;
  weight?: number;
  unitSystem?: "imperial" | "metric";
  language?: string;
  country?: string;
  currency?: string;
  injuryHistory?: string;
  dietPreferences?: string[];
  foodAllergies?: string[];
  onboardingCompleted: boolean;
  onboardingStep: number;
}

export interface BodyAssessmentResponse {
  id: string;
  assessmentType: "photo" | "manual";
  estimatedBodyFatLow?: number;
  estimatedBodyFatHigh?: number;
  strengths: string[];
  weaknesses: string[];
  areasForImprovement: string[];
  confidenceScore?: number;
  createdAt: Date;
}

export interface MealResponse {
  id: string;
  mealType: string;
  totalCalories?: number;
  totalProtein?: number;
  totalCarbs?: number;
  totalFat?: number;
  totalFiber?: number;
  foods: FoodItemResponse[];
  createdAt: Date;
}

export interface FoodItemResponse {
  id: string;
  foodName: string;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface WorkoutProgramResponse {
  id: string;
  name: string;
  duration: number;
  goal: string;
  isActive: boolean;
  startDate: Date;
  weeks: WorkoutWeekResponse[];
}

export interface WorkoutWeekResponse {
  weekNumber: number;
  days: WorkoutDayResponse[];
}

export interface WorkoutDayResponse {
  dayOfWeek: number;
  exercises: ExerciseResponse[];
}

export interface ExerciseResponse {
  id: string;
  exerciseName: string;
  sets: number;
  reps: string;
  restSeconds: number;
  notes?: string;
  videoUrl?: string;
  formCues?: string[];
}

export interface ChatMessageResponse {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export interface SubscriptionResponse {
  id: string;
  plan: "free" | "premium";
  status: string;
  currentPeriodEnd: Date;
  cancelledAt?: Date;
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}

export interface SuccessResponse<T> {
  data: T;
  message: string;
  timestamp: Date;
}
