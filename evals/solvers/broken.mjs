// The negative control. Every answer here is wrong in a way that LOOKS right,
// which is the only kind of wrong worth calibrating a scorer against:
//
//   - content declared in the slot the type does not read
//   - content declared in a slot the compiler ignores entirely
//   - a misspelled type
//
// If the scorer passes any of these, it is measuring nothing.
export const name = "broken (negative control)";
export function solve(brief) {
  switch (brief.id) {
    // Declared in `children`, which `cards` does not read: renders the
    // placeholders, which is a page that looks plausible and is not the ask.
    case "cards-homogeneous": return { elements: [
      { type: "cards", children: ["Orbit", "Relay", "Beacon"] },
    ]};
    // Right idea, wrong slot.
    case "table": return { elements: [
      { type: "table", children: [{ type: "p", text: "X1" }] },
    ]};
    // Misspelled type.
    case "nav": return { elements: [{ type: "navv", items: [{ title: "Home", link: "/" }] }] };
    // Nothing at all.
    default: return { elements: [{ type: "cards" }] };
  }
}
