// Long-form copy for the landing page. Kept here so it can be translated with strings.ts.

export const landing = {
  hero: {
    title: ["Because Every", "Recipe Has", "A Story"],
    lead: "Record a grandparent cooking out loud. Get a clean recipe with their words kept, and a cookbook to print.",
    primary: "Add a memo",
    secondary: "See how it works",
    photoAlt: "Hands kneading bread dough on a floured table",
    cards: [
      { quote: "My mother said a sauce should blink, not boil.", who: "Nonna Rosa" },
      { quote: "Mama made these before church every Sunday and the whole street knew.", who: "Aunt Loretta" },
    ],
  },
  demo: {
    title: "What was said becomes what you cook",
    lead: "Vague amounts get a measurement, and the original words stay right next to it. Hover or tap a phrase to see where it went.",
    said: "What Grandma Ruth said",
    cooked: "What goes in the book",
    quoteLabel: "Kept word for word",
  },
  how: {
    title: "How it works",
    steps: [
      { title: "Record it", body: "Press record while they cook, upload a voice memo, or paste what they said. Rambling is welcome." },
      { title: "Read it back", body: "An open-weight model writes it up as a clean recipe. You check it, fix anything, add a photo." },
      { title: "Print the book", body: "Pick recipes, add a dedication, and download a cookbook PDF that looks like a gift." },
    ],
    cta: "Read the full guide",
  },
  features: {
    title: "Made for the way families actually cook",
    voice: { title: "Their words, kept", body: "Every recipe carries one line exactly as it was said, checked against the recording. It is never rewritten." },
    honest: { title: "Nothing invented", body: "If they did not say it, it is not in the recipe. Unclear amounts stay blank instead of being guessed.", from: "a pinch of turmeric", to: "1/4 tsp turmeric", note: "(a pinch)" },
    cook: { title: "Cook mode", body: "One step at a time, in big type, with the screen kept awake.", sample: "Pour in the wine and let it cook away.", step: "Step 3 of 6" },
    book: { title: "A book to print and give", body: "Cover, contents, one page per recipe, and their words on every page.", alt: "A plate of tagliatelle with ragù" },
    listen: { title: "Hear it read aloud", body: "Natural narration of any recipe, for when hands are covered in flour." },
    open: { title: "Your model, your recipes", body: "Gemma does the writing, on your own machine or any host you choose. Family audio is not handed to a closed AI." },
  },
  story: {
    line: "Most family recipes were never written down. They were said out loud, over a stove.",
    caption: "Paris, Chandeleur, 1930s. Agence Mondial Photo-Presse, public domain.",
    alt: "Children in 1930s Paris eating crêpes at a Chandeleur stall",
  },
  classics: {
    title: "Classic family recipes",
    lead: "American and European favourites, told the way a grandparent might. Add any of them to your book and make it yours.",
    all: "All",
    filter: "Filter by region",
  },
  close: {
    title: "The next time they cook, press record.",
    body: "It takes one memo to start. The book grows one recipe at a time.",
    primary: "Add a memo",
    secondary: "Read the guide",
  },
};

/**
 * The interactive demo: Grandma Ruth's complete apple pie transcript (fictional, from
 * /samples), every phrase linked to where it lands in the finished recipe. The recipe
 * side is the real classic from classics.ts, so the two can never drift apart.
 * Link ids: "ing-<index>", "step-<index>", "tip-<index>", "quote".
 */
export type DemoPiece = string | { id: string; text: string };
export const demoSaid: DemoPiece[] = [
  "Now, the pie. Everybody wants to rush the crust and you can't. ",
  { id: "ing-0", text: "Two and a half cups of flour" }, ", ",
  { id: "ing-1", text: "a teaspoon of salt" }, ", ",
  { id: "ing-2", text: "a cup of cold butter cut in small" }, ", and ",
  { id: "ing-3", text: "cold water, maybe six or seven spoons, a little at a time" },
  " ",
  { id: "step-0", text: "till it just holds together" },
  ". ",
  { id: "step-1", text: "Rest it in the icebox an hour." },
  " Peel ",
  { id: "ing-4", text: "six big apples, Granny Smiths, and slice them thin" },
  ", ",
  { id: "step-2", text: "toss them with" },
  " ",
  { id: "ing-5", text: "three quarters of a cup of sugar" }, ", ",
  { id: "ing-6", text: "a spoon of cinnamon" }, ", ",
  { id: "ing-7", text: "a little nutmeg" }, " and ",
  { id: "ing-8", text: "a squeeze of lemon" }, ". ",
  { id: "step-3", text: "Roll out the bottom, pile the apples high, dot with butter, put the lid on top" },
  ", ",
  { id: "step-4", text: "crimp it, and cut little slits so it can breathe" }, ". ",
  { id: "step-5", text: "Bake at four hundred for fifteen minutes, then drop to three fifty for forty-five more, till the juice bubbles through" },
  ". ",
  { id: "quote", text: "The whole house smelled like this pie every Thanksgiving" },
  ", and your grandfather would sneak a corner before dinner. ",
  { id: "tip-0", text: "Let it cool. I know it's hard, but let it cool." },
];
