/**
 * Mirrors a meal to Google Health through the server. Never throws: sync is best
 * effort, so a failure must not block logging or editing a meal.
 */
export async function syncMeal(mealId: string, action: "upsert" | "delete") {
  try {
    const res = await fetch("/api/google-health/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mealId, action }),
    });
    return res.ok ? ((await res.json()) as { synced: boolean }).synced : false;
  } catch {
    return false;
  }
}
