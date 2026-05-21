/**
 * v1.0 Visual Classification Spec
 * 
 * Fixed visual classification standards for dent detection.
 * These categories define HOW the AI classifies dents visually.
 * Shop admins configure PRICING per mm range, not classification rules.
 */

export const V1_VISUAL_CLASSIFICATION_SPEC = `
## v1.0 VISUAL CLASSIFICATION SPEC

**CRITICAL**: Categories follow Dent Vision AI v1.0 visual standards. Shop pricing tiers (mm ranges + prices) are configured separately and do NOT change these classification rules.

---

### Category 1 – Small Dent (0–30mm)

**Visual identification rules:**
- Dent is subtle and compact, often visible only through light reflection distortion
- No sharp edges or hard creases
- Reflection lines appear slightly wavy but not broken
- Dent diameter is smaller than:
  • 1/4 of a door handle length
  • the width of a human finger
- No deep shadow or wide halo effect

**Size estimation guidance:**
- Use door handle (~180–200mm), fuel cap (~150–180mm), and panel body lines as scale references
- Category 1 dents are typically ≤ 15% of a door handle length
- Estimate only the core impact area. Do NOT include faint outer distortion

**Classification rule:**
- If uncertain between Category 1 (0–30mm) and Category 2 (31–60mm), ALWAYS choose Category 1 unless visual evidence clearly exceeds 30mm

**Confidence handling:**
- If dent is extremely subtle but reflection distortion is visible, classify as Category 1 with confidence 0.6–0.75

---

### Category 2 – Medium Dent (31–60mm)

**Visual identification rules:**
- Dent is clearly visible without relying solely on reflection
- A defined central impact point is present
- Reflection lines show a clear break at the center, not just mild waviness
- No hard crease or sharp metal edge
- Paint remains intact

**Size estimation guidance:**
- Use door handle (~180–200mm) as the primary reference
- Category 2 dents typically measure ~20–35% of door handle length
- Roughly equivalent to 2–3 finger widths
- Larger than Category 1 but smaller than half a door handle

**Exclusion rules:**
- If the dent occupies more than 50% of a door handle length, it is NOT Category 2
- If the dent shows wide lateral spread or multiple impact points, escalate to Category 3

**Classification rule:**
- If uncertain between Category 2 (31–60mm) and Category 3 (61–90mm), default to Category 2 unless visual evidence clearly exceeds 60mm

**Confidence handling:**
- Typical confidence range: 0.75–0.9
- If lighting or angle reduces clarity, lower confidence but keep Category 2 if size references align

---

### Category 3 – Large Dent (61–90mm)

**Visual identification rules:**
- Dent is large and immediately noticeable at a distance
- Impact area is wide, not limited to a single compact point
- Reflection lines are heavily distorted and stretched across a larger area
- Oval or elongated deformation may be present
- Paint may show stress but is typically still intact (PDR possible)

**Size estimation guidance:**
- Use door handle (~180–200mm) as the primary scale reference
- Category 3 dents typically measure ~40–50% of door handle length
- Larger than Category 2 and clearly exceeds half a door handle
- Use fuel cap and panel body lines as secondary references

**Exclusion rules:**
- If the dent exceeds the full width of a door handle or spreads broadly across the panel, escalate to Category 4
- If sharp creases or hard folds dominate, escalate beyond Category 3

**Classification rule:**
- If uncertain between Category 3 (61–90mm) and Category 4 (91–160mm), default to Category 3 unless visual evidence clearly exceeds 90mm

**Confidence handling:**
- Typical confidence range: 0.7–0.85
- If paint stress or depth raises concern, lower confidence and flag for review

---

### Category 4 – Structural Dent (91–160mm)

**Visual identification rules:**
- Dent involves a large continuous deformation, not a compact impact
- Metal displacement is clearly visible across a wide area
- Reflection lines are heavily distorted over a long span
- The dent often interferes with panel body lines, edges, or curvature
- Paint stress may be visible but paint is not necessarily broken

**Size estimation guidance:**
- Use door handle (~180–200mm) as the primary reference
- Category 4 dents typically measure ~50–90% of door handle length
- Comparable to or larger than a fuel cap diameter
- Dent extends well beyond a single localized impact point

**Exclusion rules:**
- If damage exceeds the full length of a door handle or dominates the panel surface, escalate to Category 5
- If the deformation includes sharp folds or metal creasing, escalate beyond Category 4

**Classification rule:**
- If uncertain between Category 4 (91–160mm) and Category 5 (161–260mm), default to Category 4 unless visual evidence clearly exceeds 160mm

**Confidence handling:**
- Typical confidence range: 0.65–0.8
- If paint damage or structural edges are involved, flag for review

---

### Category 5 – Severe Dent (161–260mm)

**Visual identification rules:**
- Dent dominates a significant portion of the panel surface
- Metal deformation is severe, often with a pronounced crease or collapsed area
- Reflection lines are chaotic and broken with no continuity
- Damage exceeds the full length of a door handle
- Paint damage (chips, primer exposure, rust) is common and must be actively checked

**Size estimation guidance:**
- Use door handle (~180–200mm) as a minimum reference
- Category 5 dents clearly exceed 100% of door handle length
- Damage spans a wide continuous area of the panel

**Decision & safety rules:**
- Most Category 5 dents require manual review
- Set review_required = true unless visual evidence strongly supports clean PDR feasibility
- If paint damage is detected, set pdr_incompatible = true and recommend combined repair

**Classification rule:**
- If uncertain between Category 4 (91–160mm) and Category 5 (161–260mm), default to Category 4
- Only classify as Category 5 when damage clearly dominates the panel

**Confidence handling:**
- Typical confidence range: 0.5–0.65
- Lower confidence if lighting, angle, or reflections reduce certainty

---

### Category 6 – Extensive Dent (261–400mm)

**Visual identification rules:**
- Dent occupies a very large portion of the panel surface but remains mostly localized
- Metal deformation is extensive, often with stretched metal and partial creasing
- Reflection lines are heavily distorted and broken across a wide area
- Damage clearly exceeds the full width of the door handle by a large margin
- The panel surface shows loss of original curvature but is not fully displaced edge-to-edge

**Size estimation guidance:**
- Use door handle (~180–200mm) as a baseline reference
- Category 6 dents are typically 1.5× to 2× the length of a door handle
- The widest continuous deformation falls between 261mm and 400mm
- Damage usually affects a single dominant zone but may spread outward

**Decision & safety rules:**
- Category 6 dents often require advanced PDR techniques
- Manual review is recommended when:
  - creases are sharp
  - metal stretch is visually evident
  - access difficulty appears high
- If paint damage or cracking is visible, set pdr_incompatible = true

**Classification rule:**
- If uncertain between Category 5 (161–260mm) and Category 6 (261–400mm), default to Category 5
- Only classify as Category 6 when size and surface dominance are clearly above Category 5 limits

**Confidence handling:**
- Typical confidence range: 0.45–0.6
- Reduce confidence when:
  - reflections are inconsistent
  - lighting is uneven
  - image angle limits accurate size estimation

---

### Category 7 – Massive / Panel-Dominating Dent (401–600mm)

**Visual identification rules:**
- Dent dominates the panel and spans a major portion of its width or height
- Metal deformation is extensive and often structural in appearance
- Long creases or continuous deformation lines are present
- Reflection lines are completely broken with no recovery across the affected area
- The panel appears pushed, shifted, or broadly collapsed rather than locally dented

**Size estimation guidance:**
- Use door handle (~180–200mm) as a minimum reference
- Category 7 dents typically exceed 2× door handle length
- Continuous deformation length is 401mm or greater, often approaching full panel scale
- Damage frequently crosses from center toward edges, body lines, or panel boundaries

**Decision & safety rules:**
- Category 7 dents always require manual review
- Set review_required = true by default
- Assume high repair complexity due to:
  - metal stretch
  - structural deformation
  - access limitations
- If any paint failure, cracking, or rust is visible, set pdr_incompatible = true

**Classification rule:**
- If uncertain between Category 6 (261–400mm) and Category 7 (401–600mm), default to Category 6
- Only classify as Category 7 when damage clearly dominates the panel and exceeds localized repair scale

**Confidence handling:**
- Typical confidence range: 0.35–0.55
- Lower confidence when:
  - panel boundaries are not fully visible
  - lighting masks deformation edges
  - reflections are inconsistent across the surface

---

**BOUNDARY RULE (CRITICAL):**
- If a dent is exactly 400mm, it belongs to Category 6 (261-400mm)
- Category 7 starts at 401mm (401-600mm)
- This prevents ambiguity in tier matching
`;
