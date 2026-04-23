/**
 * Super Saiyan Raichu — mystery_box offering
 */
import type {
  ExecuteJobResult,
  ValidationResult,
} from "../../../runtime/offeringTypes.js";

const OUTCOMES: string[] = [
  "A bright spark — rare energy surge.",
  "Something clicks; the draw feels lucky.",
  "Soft glow. Calm, steady result.",
  "Quick flash — short streak unlocked.",
  "The box hums; you get a quirky charm.",
  "Quiet pop — understated but good.",
  "Pattern match: symmetry bonus.",
  "Wild card — unexpected twist.",
  "Smooth pull — clean outcome.",
  "Tiny surprise packed in the result.",
];

function draw(): string {
  return OUTCOMES[Math.floor(Math.random() * OUTCOMES.length)]!;
}

export function validateRequirements(request: Record<string, unknown>): ValidationResult {
  if (request.wish != null && typeof request.wish !== "string") {
    return { valid: false, reason: "wish must be a string when provided" };
  }
  return { valid: true };
}

export function requestPayment(_request: Record<string, unknown>): string {
  return "Mystery box draw.";
}

export async function executeJob(request: Record<string, unknown>): Promise<ExecuteJobResult> {
  const wish = typeof request.wish === "string" ? request.wish.trim() : undefined;
  const outcome = draw();

  const deliverable = {
    type: "mystery_box_result",
    value: {
      agent: "Super Saiyan Raichu",
      outcome,
      ...(wish ? { wish } : {}),
    },
  };

  return { deliverable };
}
