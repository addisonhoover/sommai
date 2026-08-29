// Cycling sommelier lines — shuffled per think-cycle so analyze and refine
// never feel like the same four phrases on a loop.

export const THINKING_LINES = [
  "Reading the list…",
  "Decoding terroir & structure…",
  "Weighing each palate…",
  "Composing pairings…",
  "Checking the vintage's reputation…",
  "Listening for a hollow mid-palate…",
  "Asking whether the oak is French or just loud…",
  "Holding it up to Erin’s mid-palate test…",
  "Giving Addison’s Old World lean a vote…",
  "Setting aside anything thin or green…",
  "Looking for fruit that’s present, not jammy…",
  "Walking the Right Bank in my head…",
  "Considering Brunello’s leaner modern lane…",
  "Skipping the cheap stuff on principle…",
  "Matching structure to the table…",
  "Recalling what you both loved last time…",
  "Weighing Napa 2021 against the heat of 2022…",
  "Letting the tannins introduce themselves…",
  "Finding the bottle that finishes complete…",
  "Checking the house against smoke-year caution…",
  "Deciding who this wine is actually for…",
  "Looking for polish, not just power…",
  "Tracing Cab Franc’s herbal edge…",
  "Asking if this belongs on a weeknight or a celebration…",
  "Choosing three that would not embarrass the table…",
  "Letting the list settle, then choosing…",
  "Reading between the producers…",
  "Testing for a complete middle…",
  "Finding the quiet best bottle, not the loudest…",
  "One more pass for honesty…",
  "Seeing if the French oak is a welcome guest…",
  "Giving Syrah a chance if the fruit is savory…",
];

export function shuffleLines(lines: string[] = THINKING_LINES): string[] {
  const a = [...lines];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
