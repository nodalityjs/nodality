/*!
 * nodality v1.5.8
 * (c) 2026 Filip Vabrousek
 * License: MIT
 */

import { applyMotion } from "./motion.js";
import { applyInteraction } from "./interaction.js";
export function applyBehaviours(component, obj) { applyMotion(component, obj); applyInteraction(component, obj); }
