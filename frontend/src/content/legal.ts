// Plain-language policies. They describe what this app actually does; keep them in
// sync with the code (docs/RULES.md). Not legal advice.

export interface LegalSection { heading: string; body: string[] }
export interface LegalDoc { title: string; updated: string; lead: string; sections: LegalSection[] }

const UPDATED = "3 October 2026";

export const privacy: LegalDoc = {
  title: "Privacy",
  updated: UPDATED,
  lead: "Salt & Story is a small, open-source project for keeping family recipes. It collects only what you give it, does not track you, and does not sell anything.",
  sections: [
    {
      heading: "What you give us",
      body: [
        "Voice memos you record or upload, transcripts you paste, recipes you write or edit, photos you add, and the names you type for the people telling the recipes.",
        "We do not ask for an account, an email address or a phone number.",
      ],
    },
    {
      heading: "Where it is kept",
      body: [
        "Everything is stored on the server that runs this copy of Salt & Story: recipes in a small database, and audio, photos and narration as files.",
        "On the free hosting used for the public demo, the server can restart and lose its files. Use Back up recipes on the Recipes page to keep your own copy.",
        "Photos are re-saved when uploaded, which removes hidden details such as the camera's GPS location.",
      ],
    },
    {
      heading: "Who else sees it",
      body: [
        "ElevenLabs: when you upload or record a memo, the audio is sent to ElevenLabs to turn speech into text. When you press Listen, the recipe text is sent to ElevenLabs to read it aloud.",
        "Google: the transcript is sent to Google's Gemini API, which runs Gemma, the open-weight model that writes the recipe. On Google's free tier, Google's terms allow inputs and outputs to be used to improve its products and to be read by human reviewers. Please do not include anything you would not want shared, such as private health details.",
        "If you run Salt & Story yourself with a local model (Ollama), transcripts never leave your computer. Audio still goes to ElevenLabs unless you paste the words instead.",
        "We do not use advertising, analytics or tracking services.",
      ],
    },
    {
      heading: "Cookies and local storage",
      body: [
        "We do not set cookies. Your browser remembers a few preferences on your own device: light or dark mode, and the title, dedication and order of your book. Clearing your browser's site data removes them.",
      ],
    },
    {
      heading: "Your microphone",
      body: [
        "The microphone is used only while you are recording on the Add a memo page, and only after your browser asks for permission. Recording stops when you press Stop, leave the page, or after 20 minutes.",
      ],
    },
    {
      heading: "Deleting your data",
      body: [
        "Deleting a recipe removes it from the database together with its audio, photo and narration files. Backups you downloaded stay on your device until you delete them.",
        "Copies already sent to ElevenLabs or Google are handled under their own privacy policies.",
      ],
    },
    {
      heading: "Recording other people",
      body: [
        "Please ask before you record someone or upload their photo, and tell them where the recording will go. A recipe is a gift; so is their permission.",
      ],
    },
    {
      heading: "Questions",
      body: [
        "Salt & Story is built and maintained by Aditya Kumar. You can reach him through his GitHub profile, github.com/ADITYA-KUMAR-2358.",
      ],
    },
  ],
};

export const terms: LegalDoc = {
  title: "Terms of use",
  updated: UPDATED,
  lead: "Short and plain. By using Salt & Story you agree to the points below.",
  sections: [
    {
      heading: "What this is",
      body: [
        "Salt & Story is a free, open-source demo built for the DEV Hacktoberfest Weekend Challenge. It is offered as it is, without any warranty, and it may be slow, offline, changed or shut down at any time.",
      ],
    },
    {
      heading: "Your recipes stay yours",
      body: [
        "You keep every right to the recordings, words, recipes and photos you add. You let this copy of Salt & Story store and process them only to provide the features you use.",
      ],
    },
    {
      heading: "Only add what you may share",
      body: [
        "Only record or upload people who agreed to it, and only add photos you are allowed to use. Do not upload anything unlawful, hateful or harmful.",
      ],
    },
    {
      heading: "Check every recipe before you cook",
      body: [
        "Recipes are written by an AI model from what was said. It is told never to invent ingredients or amounts, but it can still mishear or make mistakes.",
        "Always read the recipe, the amounts and the original transcript yourself. Check cooking temperatures and times, and check for allergens before cooking for anyone. You are responsible for what you cook and serve.",
      ],
    },
    {
      heading: "Fair use of the free service",
      body: [
        "To keep the free model and transcription available for everyone, the demo limits how many memos each visitor can send in a short time and how many recipes it writes each day. Please do not try to get around these limits or overload the service.",
      ],
    },
    {
      heading: "Keep your own backup",
      body: [
        "Free hosting can lose data when the server restarts. Use Back up recipes regularly. We are not responsible for lost recipes, audio or photos.",
      ],
    },
    {
      heading: "Other services and licences",
      body: [
        "Transcription and narration are provided by ElevenLabs, and recipe writing by Google's Gemma model through the Gemini API; their own terms also apply. Gemma is provided under Google's Gemma Terms of Use.",
        "Food photos are from Wikimedia Commons under the licences listed on the Photo credits page. Sample families and voices on this site are invented; the recipes are well-known classics.",
      ],
    },
    {
      heading: "Changes",
      body: [
        "These terms may be updated. The date at the top shows the latest version.",
      ],
    },
  ],
};

export const accessibility: LegalDoc = {
  title: "Accessibility",
  updated: UPDATED,
  lead: "Salt & Story is made for older eyes and hands, and for cooks with flour on their fingers. We aim for WCAG 2.2 level AA and a little beyond.",
  sections: [
    {
      heading: "What we do",
      body: [
        "Larger text than most sites (17px base), high contrast in light and dark mode, and buttons at least 44 pixels tall.",
        "Everything works with a keyboard, with a visible focus outline. A Skip to content link is the first thing on every page.",
        "Forms have labels above each field and clear error messages next to the problem.",
        "If your device asks for reduced motion, animations and the moving photo deck stop.",
        "Cook mode shows one step at a time in very large type and keeps the screen awake.",
        "Recipes can be read aloud with the Listen button.",
      ],
    },
    {
      heading: "Known limits",
      body: [
        "The speaker's own words are shown in a handwriting-style font. It is set large, and the same words are available as plain text to screen readers.",
        "Downloaded PDF cookbooks are designed for printing and may not read well with every screen reader. The same recipes are fully accessible in the app.",
        "Transcription quality depends on the recording. Very noisy memos may need the words pasted in by hand.",
      ],
    },
    {
      heading: "Tell us what is hard to use",
      body: [
        "If something gets in your way, please tell Aditya Kumar through github.com/ADITYA-KUMAR-2358. Describe the page, what you were trying to do, and the device or assistive technology you use.",
      ],
    },
  ],
};
