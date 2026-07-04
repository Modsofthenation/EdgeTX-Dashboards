export interface ChatModel {
  id: string;
  label: string;
  description: string;
}

export const CHAT_MODELS: ChatModel[] = [
  {
    id: "composer-2.5",
    label: "Composer 2.5",
    description: "Fast, recommended for widget generation",
  },
  {
    id: "composer-2",
    label: "Composer 2",
    description: "Balanced speed and quality",
  },
  {
    id: "gpt-5.3-codex",
    label: "GPT-5.3 Codex",
    description: "Strong coding model",
  },
];

export const DEFAULT_CHAT_MODEL = CHAT_MODELS[0].id;

export const SUGGESTED_PROMPTS = [
  "Clean Betaflight dashboard: link bar, battery card, GPS strip, flight mode footer",
  "Rotorflight heli dashboard with headspeed, voltage, and ESC temperature cards",
  "Minimal CRSF link + battery widget with large voltage readout",
];
