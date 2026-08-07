import { expandDaysWithRotation } from "./meal-plan-rotation";
import type { MealPlanDay } from "@/services/ai-provider";

const templateDays: MealPlanDay[] = [
  {
    day: "Day 1",
    meals: [{ name: "Breakfast", foods: ["3 eggs"], calories: 300, protein: 24, carbs: 2, fat: 20 }],
  },
  {
    day: "Day 2",
    meals: [{ name: "Breakfast", foods: ["oatmeal"], calories: 350, protein: 12, carbs: 60, fat: 6 }],
  },
  {
    day: "Day 3",
    meals: [{ name: "Breakfast", foods: ["yogurt"], calories: 250, protein: 20, carbs: 30, fat: 4 }],
  },
];

describe("expandDaysWithRotation", () => {
  it("returns an empty array when given no template days", () => {
    expect(expandDaysWithRotation([], 7)).toEqual([]);
  });

  it("expands 3 template days to a full 7-day week by rotating", () => {
    const week = expandDaysWithRotation(templateDays, 7);
    expect(week).toHaveLength(7);
    expect(week.map((d) => d.day)).toEqual([
      "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
    ]);
  });

  it("rotates template content across the week (Monday and Thursday reuse Day 1's meals)", () => {
    const week = expandDaysWithRotation(templateDays, 7);
    expect(week[0].meals).toEqual(templateDays[0].meals); // Monday <- Day 1
    expect(week[1].meals).toEqual(templateDays[1].meals); // Tuesday <- Day 2
    expect(week[2].meals).toEqual(templateDays[2].meals); // Wednesday <- Day 3
    expect(week[3].meals).toEqual(templateDays[0].meals); // Thursday <- Day 1 again
  });

  it("works with a single template day, repeating it every day", () => {
    const week = expandDaysWithRotation([templateDays[0]], 7);
    expect(week).toHaveLength(7);
    week.forEach((d) => expect(d.meals).toEqual(templateDays[0].meals));
  });

  it("supports a target day count other than 7", () => {
    const days = expandDaysWithRotation(templateDays, 3);
    expect(days).toHaveLength(3);
    expect(days.map((d) => d.day)).toEqual(["Monday", "Tuesday", "Wednesday"]);
  });
});
