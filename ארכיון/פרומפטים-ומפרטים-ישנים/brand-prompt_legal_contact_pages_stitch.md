# Design System Strategy: The Architectural Balance

## 1. Overview & Creative North Star
### The Creative North Star: "The Architectural Ledger"
In the world of high-end real estate investment, trust is built through clarity and permanence. This design system moves away from the "startup" aesthetic of flashy shadows and loud colors, moving instead toward an **Editorial Modernism** approach. 

We treat the screen like a physical ledger or an architectural blueprint. The system utilizes **Sophisticated Asymmetry** and **Tonal Layering** to create a sense of bespoke craftsmanship. Rather than containing elements in rigid boxes, we allow white space and shifts in paper-like textures to guide the eye. It is sharp, authoritative, and intentionally quiet.

---

## 2. Colors: Tonal Depth & Texture
The palette is rooted in a "Cream and Navy" foundation, reflecting heritage and stability.

### The "No-Line" Rule
**Explicit Instruction:** Do not use 1px solid borders (`#E8E4E0`) for sectioning or layout containment. Structural boundaries are defined exclusively by background color shifts. A section using `surface-container-low` (#f5f3f0) sitting on a `background` (#fbf9f6) provides all the separation necessary. Lines should be reserved only for data-heavy tables or minimal typographic accents.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked, fine paper sheets. 
- **Base Level:** `background` (#fbf9f6)
- **Secondary Level:** `surface-container-low` (#f5f3f0) for large content blocks.
- **Elevation Level:** `surface-container-lowest` (#ffffff) for primary interactive cards.

### The "Glass & Gradient" Rule
To elevate the experience from "flat" to "premium," main CTAs and Hero sections may use a subtle **Signature Gradient**. 
- **Primary Gradient:** `primary` (#022445) to `primary_container` (#1e3a5c) at a 135-degree angle.
- **Glassmorphism:** For floating navigation or modal overlays, use `surface` (#fbf9f6) at 80% opacity with a `20px` backdrop-blur.

---

## 3. Typography: The Editorial Voice
We utilize a dual-language typographic strategy that balances the geometric strength of **Heebo** with the classic precision of **Inter**.

- **Display & Headline (Heebo 700/800):** These are your architectural anchors. Use `primary` (#022445) for all high-level headings. The heavy weight conveys the "Safe" aspect of the brand.
- **Titles & Accents (Inter/Montserrat):** Numbers, financial metrics, and English labels should be set in Inter. Use `secondary` (#984349) for key numbers to create a high-contrast focal point.
- **Body Text (Heebo 300/Inter):** Light and airy. Body text should be set in `on_surface_variant` (#43474e) to reduce visual noise and improve long-form readability.

---

## 4. Elevation & Depth
Depth in this system is achieved through **Tonal Layering**, not structural artifice.

### The Layering Principle
Hierarchy is established by nesting. A white card (`surface-container-lowest`) placed on a cream section (`surface-container-low`) creates a natural lift that feels integrated into the architecture of the page.

### Ambient Shadows
Shadows must be invisible until noticed.
- **Values:** `Blur: 24px`, `Y: 8px`, `Opacity: 4%`.
- **Shadow Tint:** Use a tinted version of `on_surface` (#1b1c1a) rather than pure black. This mimics natural light reflecting off the cream background.

### The "Ghost Border" Fallback
If a border is required for accessibility (e.g., in a high-density data grid), use a **Ghost Border**: `outline_variant` (#c4c6cf) at **15% opacity**. High-contrast, 100% opaque borders are strictly forbidden.

---

## 5. Components: Sharp & Intentional
All components support **RTL (Right-to-Left)** layout as a default, ensuring the Hebrew-first experience feels native and balanced.

### Buttons (Roundedness: `md` 0.75rem)
- **Primary:** Gradient fill (Navy) with white text. No shadow.
- **Secondary:** Transparent with a `secondary` (#984349) label. Used for secondary financial actions.
- **States:** On hover, primary buttons should subtly shift to `primary_container`.

### Cards (Roundedness: `lg` 1rem)
- **Structure:** No borders. Background `surface-container-lowest` (#ffffff).
- **Spacing:** Minimum `8` (2.75rem) internal padding. 
- **Style:** Use vertical white space rather than horizontal lines to separate card headers from body content.

### Input Fields
- **Design:** Soft-filled backgrounds using `surface_variant` (#e4e2df). 
- **Focus State:** A 2px bottom-only border in `primary` (#022445). Avoid full-box focus rings to maintain the editorial look.

### Key Numbers (The Investment Widget)
A signature component for Safe Capital. Large display font for percentages or currency, utilizing `secondary` (#984349) with a `label-sm` subtitle in `on_surface_variant`.

---

## 6. Do's and Don'ts

### Do:
- **Use Asymmetric Grids:** Align text to the right (RTL), but allow images or secondary cards to "bleed" off the grid or overlap container edges.
- **Embrace White Space:** Use the high end of the spacing scale (`16` to `24`) for section margins to convey luxury.
- **Tonal Transitions:** Use background color shifts to indicate a change in content context.

### Don'ts:
- **Don't use 1px Dividers:** They clutter the sharp, minimalist aesthetic. Use white space or a subtle background tint change instead.
- **Don't use High-Opacity Shadows:** If the shadow looks "gray," it is too dark. It should look like a soft glow.
- **Don't Center-Align Everything:** High-end editorial design is usually flush-right (for Hebrew) or flush-left (for English). Center alignment should be reserved for high-level hero titles only.