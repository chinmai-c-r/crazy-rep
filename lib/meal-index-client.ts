/** Tells the server a meal was saved, so it can link it to its dish and make it searchable. Never throws; search catches up on any it misses. */
export async function indexMeal(mealId: string) {
  try {
    await fetch("/api/meals/index", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mealId }) });
  } catch {
    // offline or the server is busy: the next search links it
  }
}
