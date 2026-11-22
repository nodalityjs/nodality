import { applyMotion } from "./motion.js";
import { applyInteraction } from "./interaction.js";
export function applyBehaviours(component, obj) { applyMotion(component, obj); applyInteraction(component, obj); }
