/** A fitting emoji for a detected food, by keyword. */
const EMOJIS: [RegExp, string][] = [
  [/dosa|idli|uttapam|pancake|crepe/i, "🥞"],
  [/biryani|rice|pulao|khichdi|risotto/i, "🍚"],
  [/chicken|tandoori|wing/i, "🍗"],
  [/egg|omelette/i, "🍳"],
  [/salad|cucumber|lettuce/i, "🥗"],
  [/chutney|sambar|soup|rasam/i, "🥣"],
  [/paneer|dal|curry|subji|sabzi|masala|aloo|gravy|stew/i, "🍛"],
  [/roti|chapati|naan|paratha|bread|toast|bun/i, "🫓"],
  [/yogurt|curd|raita|milk|lassi|cheese/i, "🥛"],
  [/fish|prawn|shrimp|salmon|tuna/i, "🐟"],
  [/banana|apple|mango|fruit|berry|orange|papaya/i, "🍌"],
  [/coffee|tea|chai/i, "☕"],
  [/pizza/i, "🍕"],
  [/burger|sandwich/i, "🍔"],
  [/noodle|pasta|maggi|ramen/i, "🍜"],
  [/cake|sweet|gulab|jalebi|dessert|ice cream|chocolate/i, "🍰"],
  [/avocado/i, "🥑"],
  [/oats|cereal|granola/i, "🥣"],
];
export const foodEmoji = (name: string) => EMOJIS.find(([re]) => re.test(name))?.[1] ?? "🍽️";
