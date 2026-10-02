// Long-form copy for the How to use guide. Kept here so it can be translated.

export interface GuideSection { id: string; title: string; intro?: string; steps?: string[]; tips?: string[]; }

export const guide = {
  title: "How to use Salt & Story",
  lead: "Everything you need to turn a relative's cooking into a printed family cookbook. It takes about ten minutes to make your first recipe.",
  toc: "On this page",
  sections: [
    {
      id: "before",
      title: "Before you start",
      intro: "You need very little.",
      tips: [
        "A phone or laptop with a microphone, or voice memos you already have (mp3, m4a, wav, webm or ogg).",
        "The person who cooks, and a dish they make without a recipe.",
        "Ten quiet minutes. Background music makes transcription worse; a running tap is fine.",
      ],
    },
    {
      id: "record",
      title: "Record a good memo",
      intro: "Let them talk the way they normally would. The rambling is the point.",
      tips: [
        "Ask them to say the name of the dish first, then cook or describe it from start to finish.",
        "Ask follow-ups out loud: “How much is a handful?”, “How do you know it is done?”. Their answers end up in the recipe.",
        "Stories and asides are welcome. They become the story at the top of the recipe and the tips at the bottom.",
        "Keep the phone about an arm's length away, pointing at them, not at the stove.",
        "One dish per memo works best. Recordings stop automatically after 20 minutes.",
      ],
    },
    {
      id: "add",
      title: "Add a memo",
      steps: [
        "Press Add a memo in the top bar.",
        "Type who is telling the recipe. Their name is printed next to their words.",
        "Choose Record now, Upload a memo, or Paste words. Pasting works even when transcription is not set up.",
        "Press Make the recipe. Listening and writing take one to three minutes on the free model, and you can leave the page while it works.",
      ],
    },
    {
      id: "check",
      title: "Check and edit the recipe",
      intro: "The recipe writer never invents ingredients or steps. When something was unclear, it leaves it blank for you.",
      steps: [
        "Read the recipe through. Amounts like “a pinch” get a rough measurement, with their exact words in brackets.",
        "Press Edit to fix anything: titles, amounts, steps, tips. Use the arrows to reorder steps.",
        "Keep the line under In their words exactly as they said it. It is checked against the recording.",
        "Add a photo of the dish or the cook. It is printed in the book.",
        "Press Save changes. If you try to leave with unsaved edits, Salt & Story will ask first.",
      ],
    },
    {
      id: "cook",
      title: "Cook from it",
      tips: [
        "Press Start cooking for cook mode: one step at a time in large type, and the screen stays on.",
        "Use the arrow keys or the big buttons. The ingredients button opens the list without losing your place.",
        "On the recipe page, tick ingredients as you gather them and tap steps as you finish them.",
        "Press Listen to hear the whole recipe read aloud (needs narration to be set up).",
      ],
    },
    {
      id: "book",
      title: "Make the book",
      steps: [
        "Open Make the book.",
        "Tick the recipes you want. Drag them, or use the arrows, to set the order.",
        "Give the book a title and a dedication. The cover preview updates as you type.",
        "Press Build the book, check the preview, then Download PDF.",
        "Print it at A5 size, or two pages per A4 sheet, and give it away.",
      ],
    },
    {
      id: "backup",
      title: "Keep a backup",
      intro: "The free hosting plan can lose data when the server restarts. Back up after every few recipes.",
      steps: [
        "Open Recipes and scroll to the bottom.",
        "Press Back up recipes. A .json file downloads.",
        "To bring recipes back, press Restore a backup and choose that file.",
      ],
    },
  ] as GuideSection[],
  faqTitle: "When something goes wrong",
  faq: [
    { q: "It says “Waking up the kitchen”.", a: "The free server sleeps when nobody uses it. The first visit wakes it, which can take up to a minute. After that it is fast." },
    { q: "Record and Upload are greyed out.", a: "Transcription is not set up on this server yet. Use Paste words instead, or ask whoever runs Salt & Story to add an ElevenLabs key." },
    { q: "The recipe says Needs attention.", a: "Open it and read the message. Usually the recipe writer was busy or hit its free usage limit. Wait a minute and press Try again, or press Open and write it by hand." },
    { q: "Some amounts or steps are missing.", a: "That is on purpose: if it was not said clearly, it is left blank rather than guessed. Press Edit and fill it in, or ask the cook." },
    { q: "The PDF will not build.", a: "Only recipes marked Ready can go in the book. If the error says PDF export needs the Pango libraries, follow the fix it names (on Windows, run scripts/setup-pdf-windows.ps1 once), or run Salt & Story with Docker." },
    { q: "My recipes disappeared.", a: "The free server restarted and lost its files. Use Restore a backup with your latest backup file." },
  ],
};
