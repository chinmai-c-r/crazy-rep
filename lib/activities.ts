/**
 * MET values from the 2024 Adult Compendium of Physical Activities
 * (https://pacompendium.com). Calories burned = MET × body weight (kg) × hours.
 */
export const INTENSITIES = ["light", "moderate", "vigorous"] as const;
export type Intensity = (typeof INTENSITIES)[number];

export type ActivityDef = { label: string; icon: string; met: Record<Intensity, number>; distance?: boolean };

export const ACTIVITIES = {
  walking: { label: "Walking", icon: "🚶", met: { light: 2.8, moderate: 3.5, vigorous: 5.0 }, distance: true },
  running: { label: "Running", icon: "🏃", met: { light: 7.0, moderate: 9.8, vigorous: 11.5 }, distance: true },
  cycling: { label: "Cycling", icon: "🚴", met: { light: 4.0, moderate: 6.8, vigorous: 10.0 }, distance: true },
  strength: { label: "Strength training", icon: "🏋️", met: { light: 3.5, moderate: 5.0, vigorous: 6.0 } },
  hiit: { label: "HIIT", icon: "🔥", met: { light: 6.0, moderate: 8.0, vigorous: 10.0 } },
  yoga: { label: "Yoga", icon: "🧘", met: { light: 2.5, moderate: 3.0, vigorous: 4.0 } },
  swimming: { label: "Swimming", icon: "🏊", met: { light: 5.8, moderate: 7.0, vigorous: 9.8 }, distance: true },
  hiking: { label: "Hiking", icon: "🥾", met: { light: 5.3, moderate: 6.0, vigorous: 7.8 }, distance: true },
  sports: { label: "Sports", icon: "⚽", met: { light: 4.5, moderate: 7.0, vigorous: 9.0 } },
  dancing: { label: "Dancing", icon: "💃", met: { light: 3.0, moderate: 5.0, vigorous: 7.3 } },
  other: { label: "Other", icon: "✨", met: { light: 3.0, moderate: 4.5, vigorous: 6.0 } },
} satisfies Record<string, ActivityDef>;

export type ActivityId = keyof typeof ACTIVITIES;

export const activityDef = (id: ActivityId): ActivityDef => ACTIVITIES[id];
export const ACTIVITY_IDS = Object.keys(ACTIVITIES) as [ActivityId, ...ActivityId[]];

/** Used when the user hasn't entered a weight yet. */
export const DEFAULT_WEIGHT_KG = 70;

export function caloriesBurned(activity: ActivityId, intensity: Intensity, minutes: number, weightKg?: number | null) {
  const met = ACTIVITIES[activity]?.met[intensity] ?? 4;
  return Math.round(met * (weightKg || DEFAULT_WEIGHT_KG) * (minutes / 60));
}

export const activityLabel = (id: string) => (ACTIVITIES as Record<string, ActivityDef>)[id]?.label ?? id;
export const activityIcon = (id: string) => (ACTIVITIES as Record<string, ActivityDef>)[id]?.icon ?? "✨";
