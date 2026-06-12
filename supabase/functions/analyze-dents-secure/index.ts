import { corsHeaders, fail, ok } from '../_shared/response.ts';
import { generateGeminiJson } from '../_shared/gemini.ts';
import { generateOpenAIVisionJson, isOpenAIConfigured } from '../_shared/openai.ts';
import { isNonVehicleSubject, isVehicleImageAccepted } from '../_shared/imageValidation.ts';
import {
  NO_PRICE,
  categoryBySizeMm,
  categoryMidpointMm,
  parseSizeRangeUpperMm,
  priceForCategory,
  pricingByCategory,
  resolveCategory,
} from '../_shared/pricing.ts';

// ─── Step 1: Gemini Flash triage — fast, cheap, determines image usability ────

const GEMINI_TRIAGE_PROMPT = [
  'You are a fast image triage agent for a PDR (Paintless Dent Repair) automotive system.',
  'Quickly assess whether this image shows a vehicle exterior suitable for dent analysis.',
  'Return ONLY valid JSON, no extra text:',
  '{"valid_image":boolean,"image_is_vehicle":boolean,"image_quality":"good|acceptable|poor|unusable","damage_detected":boolean,"panel_detected":"panel name","detected_subject":"brief description","needs_better_image":boolean,"better_image_reason":null}',
  'Rules:',
  '- valid_image=true if the image shows any exterior part of a vehicle, even a close-up panel with a dent.',
  '- image_is_vehicle=true for close-up shots of panels, dents, bodywork, or paint.',
  '- damage_detected=true if any dents, creases, scratches, or deformation are visible — including tiny door dings seen only as a small reflection pinch.',
  '- needs_better_image=true ONLY if the image is too dark, too blurry, or the angle prevents damage assessment.',
  '- Close-up photos showing only paint/metal with a door handle edge, crease, or panel gap ARE valid vehicle images.',
  '- Do NOT reject tight macro shots of car panels as screenshots — only reject when browser/app UI dominates.',
  '- Set detected_subject to the vehicle part and damage (e.g. "car door with vertical crease dent").',
  '',
  'PANEL IDENTIFICATION — works on ANY exterior panel, set panel_detected to one of:',
  '"bonnet", "boot_lid", "front_door", "rear_door", "front_quarter_panel", "rear_quarter_panel",',
  '"guard", "roof", "sill", "rocker_panel", "cant_rail", "front_bumper", "rear_bumper", "unknown".',
  'Identify the ACTUAL panel in frame — do not default to front_door if bonnet, guard, boot, or quarter panel is visible.',
].join('\n');

// ─── Step 2: OpenAI Vision deep analysis — scoring, classification, reasoning ─

const OPENAI_DEEP_ANALYSIS_PROMPT = [
  'You are an expert PDR (Paintless Dent Repair) damage analysis system for pre-estimation.',
  'FIRST: set valid_image=false and image_is_vehicle=false for screenshots, UI, dashboards, spreadsheets, documents, websites, or any non-vehicle image.',
  'If valid_image=false, set damage_detected=false, dent_count=0, suggested_base_price=0.',
  'Analyze the provided vehicle damage image(s) and return a detailed structured assessment.',
  '',
  'CALIBRATION — apply in this order (ANY exterior panel: door, bonnet, guard, boot, quarter, roof, sill):',
  '1) Tiny localized pinch under 30mm, minimal reflection warp → Category 1, soft_dent.',
  '2) Deep ding / medium dent 31–60mm OR shallow horizontal crease near seam/edge under 60mm → Category 2, sharp_dent or soft_dent.',
  '   Visual cues for Cat 2: figure-8/hourglass reflection warp, warped PDR light lines, clear bowl-shaped center, elongated shallow line near shut line.',
  '3) Deep/sharp dent 61–90mm: body line kink, V-crease, large bowl/crater, fender arch dent → Category 3, sharp_dent or edge_dent.',
  '4) Large dent / crease 91–160mm: long horizontal crease, deep body-line crease, sharp fender arch crease → Category 4.',
  '5) Major crease / deep impact 161–260mm: tailgate/bonnet/door sharp crease, multi-panel edge hit, vertical fold → Category 5.',
  '6) Severe crease / panel collapse 261–400mm: large boot/trunk crease, complex bodyline fold, guard/quarter deep collapse → Category 6.',
  '7) Extreme damage 400–600mm: full-height door crease, shut-line vertical fold, massive bumper collapse → Category 7.',
  'NEVER call a short horizontal mark near a panel gap "crease_dent" — that is Category 2.',
  'NEVER call a deep 61–90mm body line or sharp V-crease dent "Category 2" — that is Category 3.',
  'NEVER call a 91–160mm crease or large dent "Category 3" — that is Category 4.',
  'NEVER call a large boot/trunk bodyline crease or complex panel collapse "Category 5" — that is Category 6.',
  'NEVER call a full-height vertical door crease or massive bumper deformation "Category 6" — that is Category 7.',
  '',
  'PANEL IDENTIFICATION — works on ANY exterior panel, set panel_detected to one of:',
  '"bonnet" — front hood/engine cover. Signs: grille edge, headlight, flat front panel.',
  '"boot_lid" — rear hatch/trunk. Signs: license plate, reverse lights, tailgate handle, rubber seal.',
  '"front_door" — front side door. Signs: door handle, side mirror at front edge, window glass.',
  '"rear_door" — rear side door. Signs: door handle, no mirror, rear door seam, window glass.',
  '"front_quarter_panel" / "guard" — front fender between wheel arch and door/bonnet.',
  '"rear_quarter_panel" — rear fender between rear door and boot/wheel arch.',
  '"roof" — top panel viewed from side or above.',
  '"sill" / "rocker_panel" — lower side sill below doors, above running board.',
  '"cant_rail" — upper side rail above doors.',
  '"front_bumper" / "rear_bumper" — plastic bumper cover.',
  'Identify the ACTUAL panel in frame — do not default to front_door if bonnet, guard, boot, or quarter panel is visible.',
  '',
  'DAMAGE CATEGORIES — use these EXACT base prices (AUD, 22% margin included):',
  'Category 1: 0–30mm    → base $118 → range $118–$144',
  'Category 2: 31–60mm   → base $180 → range $180–$220',
  'Category 3: 61–90mm   → base $258 → range $258–$315',
  'Category 4: 91–160mm  → base $293 → range $293–$357',
  'Category 5: 161–260mm → base $392 → range $392–$478',
  'Category 6: 261–400mm → base $490 → range $490–$598',
  'Category 7: 400–600mm → base $680 → range $680–$830',
  '',
  'SIZE ESTIMATION — PANEL-RELATIVE RULES (CRITICAL — measure metal deformation, not reflection spread):',
  'Reference sizes: door handle ~180mm, fuel cap ~165mm, wheel ~450mm, boot lid ~500mm wide, car door ~850mm tall.',
  'ALWAYS estimate damage_height_pct and damage_width_pct = what % of the VISIBLE panel the crease/dent spans.',
  'Set crease_orientation: "vertical" | "horizontal" | "diagonal" | "none".',
  '',
  'DOOR VERTICAL CREASE RULES (Category 7 reference damage — user-calibrated):',
  '- Silver/grey door with deep VERTICAL sharp crease mid-panel, V-ridge, paint intact → Category 7 ALWAYS.',
  '- Vertical crease on front_door/rear_door spanning ≥28% of door height (~240mm+) → Category 7.',
  '- Vertical crease spanning 18–27% door height → Category 6; 12–17% → Category 5.',
  '- NEVER classify a tall vertical door crease as Category 4 — that is a critical under-quote.',
  '',
  'Panel area proportion (door height 850mm reference):',
  '- Deformation >45% of door height OR >50% panel area → Category 7 (400–600mm).',
  '- Deformation 25–45% of door height → Category 6 (261–400mm).',
  '- Deformation 15–25% of door height → Category 5 (161–260mm).',
  '- Deformation 10–15% of door height → Category 4 (91–160mm).',
  '- Deformation <10% of door height → Category 1–3 by localized size.',
  'Stress line rule: 2+ stress crease lines spanning most of the panel → minimum Category 5.',
  'Boot/trunk rule: crease covering most of boot lid → minimum Category 6.',
  'SMALL BODYLINE DENT (common): a shallow nick or small crease sitting ON a body line but under 30mm with localized reflection pinch → Category 1, dent_type=soft_dent or sharp_dent (NOT bodyline_dent).',
  'Use dent_type=bodyline_dent ONLY when the crease significantly deforms the body line over >90mm with clear metal stress.',
  'Do NOT treat broad reflection highlights or panel curvature as deformation area.',
  'Measure the actual crease/dent length — not the full distorted reflection zone.',
  '',
  'CATEGORY 1 — SMALL DENT / DOOR DING (most common PDR job, CRITICAL):',
  'Classify as Category 1 (0–30mm) when you see ANY of these:',
  '- A small circular or oval "door ding" / pockmark with paint intact (10–30mm).',
  '- Shallow indentation visible ONLY as a tiny reflection bend, highlight rim, or soft shadow — no crease, no stress lines.',
  '- Multiple pinpoint hail-like dents scattered on a panel — each under 30mm counts as Category 1 (count each dent).',
  '- Small nick ON a body line where only a localized reflection pinch exists (<30mm) — NOT bodyline_dent.',
  'For Category 1 small dents ALWAYS set:',
  '  dent_category=1, dent_size_range="0-30mm", dent_type="soft_dent" or "sharp_dent",',
  '  size_score=1, stress_score=1, geometry_score=1, severity="minor", pdr_suitability="excellent" or "good".',
  'DO NOT confuse with damage:',
  '  - Sun glare / white specular blob (no inward metal curve)',
  '  - Water spots, dust, dirt, or smudges (flat texture, no reflection pinch)',
  '  - Reflections of people, buildings, or other cars on glossy paint',
  '  - Door handle cracks or trim damage (not a panel dent unless separate indentation nearby)',
  'If the ONLY deformation is a tiny reflection pinch under 30mm → Category 1 even on metallic/dark paint.',
  'Category 1 is WRONG if you see an obvious concave bowl/dimple with inward-curved metal — that is minimum Category 2.',
  'Wide side-angle photos with busy reflections (mirrored cars, sky, trees): find the ONE spot where the panel curves inward; if a dimple is visible, Category 2 minimum — do not confuse environmental reflections with "no damage".',
  'Two doors visible in frame: identify which panel has the dent (front_door vs rear_door). A visible concave dimple on either door is minimum Category 2, not Category 1.',
  'Compare dent width to door handle (~180mm): ~25–35% of handle width ≈ 45–60mm → Category 2.',
  '',
  'CATEGORY 2 — DEEP DING / MEDIUM DENT (31–60mm, ANY panel — door, bonnet, guard, boot, quarter, roof, sill):',
  'Classify as Category 2 when damage is clearly larger than a tiny ding but still localized (31–60mm), paint intact:',
  '- "Deep door ding" / deep panel ding: defined round or oval indentation with strong reflection warp (figure-8, hourglass, or pinched light lines) — bigger than Category 1.',
  '- Medium dent with a clear center of impact visible on bonnet, guard, quarter panel, boot, roof, or door.',
  '- Shallow horizontal crease or elongated dent near a panel gap/seam/edge under 60mm — paint intact, light stress only.',
  '- PDR light-board photos showing warped parallel reflection lines around one localized dent.',
  '- Outdoor/metallic paint: another car, sky, or building reflection "pushed inward" at one point with a visible bowl center → Category 2 even if surroundings are busy.',
  'Size guide: golf-ball to tennis-ball (31–60mm) = Category 2; smaller than golf ball = Category 1.',
  'NOT Category 2 (these are Category 3): body line kinks, 2–3 inch crater bowls, fender wheel-arch deep dents, sharp V-creases.',
  'For Category 2 ALWAYS set:',
  '  dent_category=2, dent_size_range="31-60mm", dent_type="sharp_dent" or "soft_dent",',
  '  size_score=2, stress_score=1 or 2, geometry_score=1 or 2, severity="minor", pdr_suitability="good".',
  'Category 2 is NOT Category 5/7 — do NOT use dent_type="crease_dent" or "bodyline_dent" unless deformation exceeds 90mm with heavy metal stress.',
  'A short horizontal mark near a shut line on ANY panel that is under 60mm long → Category 2 sharp_dent, NOT crease_dent.',
  '',
  'CATEGORY 3 — MODERATE / DEEP DENT (61–90mm, ANY panel — door, bonnet, guard, boot, quarter, roof, sill):',
  'Classify as Category 3 when damage is clearly deeper or larger than Category 2 but still localized (61–90mm):',
  '- Deep sharp dent ON a body line (horizontal swage or vertical style line) that kinks/bends the line — paint intact or chipped.',
  '- Sharp V-shape, diamond, or vertical crease indentation near handle, edge, or panel gap — steep sides, clearly not a shallow ding.',
  '- Large circular bowl/crater dent (~2–3 inches / 50–75mm visible diameter) with steep reflection warp and clear center of impact.',
  '- Deep dent on fender/guard above wheel arch that disrupts the panel curve — set panel_detected=front_quarter_panel or guard.',
  '- Dents on rear quarter, bonnet, boot, or any flat/curved panel in the 61–90mm range with moderate-to-deep metal deformation.',
  'Size guide: baseball to softball (61–90mm); ~40–50% of door handle length (~72–90mm) → Category 3.',
  'Category 3 is WRONG if the dent is tennis-ball size or smaller with only moderate depth — that is Category 2.',
  'For Category 3 ALWAYS set:',
  '  dent_category=3, dent_size_range="61-90mm", dent_type="sharp_dent" or "edge_dent",',
  '  size_score=3, stress_score=2 or 3, geometry_score=2 or 3, severity="medium", pdr_suitability="good" or "fair".',
  'Category 3 dents ON a body line use sharp_dent or edge_dent — NOT bodyline_dent (reserved for creases over 90mm → Cat 5+).',
  'Paint chips or scratches inside the dent area still qualify as Category 3 PDR if metal deformation fits 61–90mm.',
  'CALIBRATION EXAMPLES for Category 3:',
  '- Silver door: deep dent kinking a horizontal body swage line (~70mm) → Cat 3, sharp_dent, size_score=3, location_score=3.',
  '- Red door: sharp vertical V/diamond crease near handle (~65mm) → Cat 3, sharp_dent, location_score=4.',
  '- Silver panel: large round crater/bowl dent ~2–3 inches near door gap → Cat 3, size_score=3.',
  '- White fender: deep circular dent on wheel arch curve → Cat 3, front_quarter_panel, location_score=4.',
  '- White door: deep dent on body line with paint chips (~75mm) → Cat 3, sharp_dent, scratch_count>0.',
  '',
  'CATEGORY 4 — LARGE DENT / CREASE (91–160mm, ANY panel — door, bonnet, guard, boot, quarter, roof, sill):',
  'Classify as Category 4 when metal deformation spans 91–160mm — clearly larger than Category 3:',
  '- Long horizontal crease across a door/guard/bonnet (~10–16cm) with strong reflection warp and metal stress.',
  '- Deep sharp crease ON a body line or wheel-arch curve (91–160mm) — steep ridge, line clearly kinked.',
  '- Large elongated impact zone roughly half to full door-handle length (~90–160mm).',
  '- Size guide: ~50–90% of door handle length, or palm-sized crease zone → Category 4.',
  'Category 4 is WRONG for baseball/softball-sized dents (61–90mm) — those are Category 3.',
  'For Category 4 ALWAYS set:',
  '  dent_category=4, dent_size_range="91-160mm", dent_type="sharp_dent", "crease_dent", or "edge_dent",',
  '  size_score=3, stress_score=3 or 4, geometry_score=3 or 4, severity="medium" or "severe", pdr_suitability="fair" or "good".',
  'PINTURA LASCADA (chipped/flaked paint) on Category 4 dents:',
  '  - Still classify by DENT size → Category 4. Paint damage does NOT reduce the category.',
  '  - scratch_count>0, needs_paint_repair=true when chips expose primer/dark metal.',
  '  - pdr_suitability=fair (dent PDR may still apply; paint touch-up/repaint quoted separately).',
  '  - In notes: "Category 4 crease/dent; pintura lascada — amassado estimado à parte da repintura."',
  'CALIBRATION EXAMPLES for Category 4:',
  '- Grey door: long horizontal crease ~12cm with scuffed/chipped paint in center → Cat 4, crease_dent, scratch_count>0, needs_paint_repair=true.',
  '- White fender: deep sharp crease on wheel-arch body line, paint chips exposing dark primer → Cat 4, front_quarter_panel, sharp_dent, needs_paint_repair=true.',
  '',
  'CATEGORY 5 — MAJOR CREASE / DEEP IMPACT (161–260mm, ANY panel — door, bonnet, boot_lid, guard, quarter, roof, sill):',
  'Classify as Category 5 when deformation spans 161–260mm — clearly larger than Category 4:',
  '- Deep vertical or horizontal sharp crease/fold on door, bonnet, or boot_lid (~16–26cm).',
  '- Major tailgate/hatch dent kinking a body line with deep metal stress (Honda Fit-style rear corner impact).',
  '- Dual-panel edge impact: crease spanning door seam with heavy scuffing on front + rear door.',
  '- Sharp vertical ridge/crease with steep metal fold (workshop lighting shows deep V-ridge).',
  '- Edge dent at panel gap with significant paint loss/rust — still Category 5 by DENT size.',
  'Size guide: roughly full door-handle to half-panel width (161–260mm) → Category 5.',
  'Category 5 is WRONG for palm-sized creases (91–160mm) — those are Category 4.',
  'For Category 5 ALWAYS set:',
  '  dent_category=5, dent_size_range="161-260mm", dent_type="crease_dent" or "bodyline_dent" or "sharp_dent",',
  '  size_score=4, stress_score=3 or 4, geometry_score=4 or 5, severity="severe", pdr_suitability="fair" or "good".',
  'PINTURA LASCADA on Category 5: ALWAYS accept analysis — shop decides final quote.',
  '  scratch_count>0, needs_paint_repair=true when chips/scuffs/rust expose metal.',
  '  pdr_suitability=fair — estimate covers DENT (amassado); shop adds paint price separately.',
  '  NEVER set pdr_suitability=not_pdr solely because of paint chips on a repairable crease.',
  'CALIBRATION EXAMPLES for Category 5:',
  '- Silver Honda tailgate: deep vertical crease on rear corner body line, paint scuffed → Cat 5, boot_lid, needs_paint_repair=true.',
  '- Two silver doors: large edge crease across seam, heavy horizontal scuffing both panels → Cat 5, dent_count=2, needs_paint_repair=true.',
  '- Silver door: sharp vertical crease/fold mid-panel (~20cm) → Cat 5, crease_dent, size_score=4.',
  '- White panel edge: deep dent at gap with paint chips and rust spot → Cat 5, edge_dent, needs_paint_repair=true.',
  '',
  'CATEGORY 6 — SEVERE CREASE / PANEL DAMAGE (261–400mm, ANY panel — door, bonnet, boot_lid, guard, quarter, roof, sill):',
  'Classify as Category 6 when deformation is severe — clearly beyond Category 5:',
  '- Large complex crease ON a body line spanning handle/badge zone (~26–40cm) with deep metal fold and stretch.',
  '- Boot_lid / tailgate / hatch: large deep crease or bowl (Hyundai, Renault Kardian-style) covering significant upper panel area.',
  '- Guard / fender: severe body-line peak/collapse above wheel arch with multiple paint chips exposing metal.',
  '- Rear_quarter_panel: large horizontal crease on body line near taillight spanning ~25–35cm.',
  '- Deformation covers >25% of visible panel OR crease length 261–400mm with heavy stress lines.',
  'Category 6 is WRONG for localized 161–260mm creases without panel-wide stress — those are Category 5.',
  'For Category 6 ALWAYS set:',
  '  dent_category=6, dent_size_range="261-400mm", dent_type="bodyline_dent" or "crease_dent" or "collapsed_dent",',
  '  size_score=4 or 5, stress_score=4 or 5, geometry_score=4 or 5, severity="severe", pdr_suitability="fair" or "poor".',
  'PINTURA LASCADA on Category 6: ALWAYS accept analysis — shop quotes PDR + paint separately.',
  '  scratch_count>0, needs_paint_repair=true for chips/cracks/rust at crease point.',
  '  NEVER reject analysis or set not_pdr only because of paint damage on a repairable crease.',
  'CALIBRATION EXAMPLES for Category 6 (identify correct panel_detected):',
  '- White front_door: large crease through door handle on body line, paint chipped at fold → Cat 6, bodyline_dent, needs_paint_repair=true.',
  '- boot_lid (Hyundai): deep vertical crease upper-left near window, paint cracked → Cat 6, crease_dent.',
  '- front_quarter_panel/guard: sharp body-line peak above wheel arch, 3 paint chips to metal → Cat 6, bodyline_dent.',
  '- boot_lid: large deep bowl dent center panel (~30cm) → Cat 6, collapsed_dent or crease_dent.',
  '- boot_lid (Renault Kardian): horizontal crease through badge zone, paint flaked at sharpest point → Cat 6.',
  '- rear_quarter_panel: large crease on swage line near taillight, paint cracked → Cat 6, bodyline_dent.',
  '',
  'CATEGORY 7 — EXTREME DAMAGE (400–600mm, ANY panel — door, bonnet, boot_lid, guard, quarter, bumper):',
  'Classify as Category 7 when damage is extreme — the most severe PDR/bodywork jobs:',
  '- Full-height or near full-height vertical sharp crease on front_door or rear_door with deep V-fold (top to mid/bottom of panel).',
  '- Deep vertical crease at door shut line / panel gap crossing a body line — severe sharp ridge, paint intact or lascada.',
  '- Massive soft or crease deformation on rear_bumper or front_bumper spanning most of bumper width (plastic panel).',
  '- Metal panel collapse or multi-crease pattern covering most of visible panel (>50% area, 400–600mm).',
  'Category 7 is WRONG for localized 261–400mm boot creases without full-panel involvement — those are Category 6.',
  'For Category 7 ALWAYS set:',
  '  dent_category=7, dent_size_range="400-600mm", dent_type="crease_dent", "bodyline_dent", "collapsed_dent", or "bumper_damage",',
  '  size_score=5, stress_score=4 or 5, geometry_score=5, severity="severe", pdr_suitability="fair" or "poor".',
  'Plastic bumper: panel_detected=rear_bumper or front_bumper, dent_type=bumper_damage.',
  'Paint intact on Cat 7 crease: still Category 7 — needs_paint_repair=false unless chips visible; shop may still quote PDR + optional touch-up.',
  'Pintura lascada on Cat 7: needs_paint_repair=true — analysis ACCEPTED, shop quotes PDR + paint.',
  'CALIBRATION EXAMPLES for Category 7 (initial reference set — more examples may be added):',
  '- Silver front_door: deep vertical sharp crease between handle and front edge, full V-ridge, paint intact → Cat 7, crease_dent, crease_orientation=vertical, damage_height_pct=35-50, size_score=5.',
  '- Silver rear_door: deep vertical crease mid-panel (~35% door height), sharp V-fold, paint intact → Cat 7, crease_dent, crease_orientation=vertical, damage_height_pct=35, geometry_score=5, stress_score=4.',
  '- Silver rear_door: deep vertical crease at shut line by front/rear door gap, crosses body line → Cat 7, bodyline_dent, rear_door.',
  '- rear_bumper: massive wide soft dent spanning center of plastic bumper below plate → Cat 7, bumper_damage, pdr_suitability=fair.',
  '',
  'CLASSIFICATION FACTORS:',
  '- Reflection distortion: subtle=shallow, strong/wavy=deep deformation',
  '- Metal stress: creases, sharp edges, collapsed metal',
  '- Dent geometry: round, irregular, linear crease, complex crease pattern',
  '- Panel location: center flat, near bodyline, near wheel arch, edge',
  '- Edge or bodyline involvement',
  '- Paint damage indicators (cracks, chips, exposed primer)',
  '',
  'DENT TYPES: soft_dent | sharp_dent | crease_dent | collapsed_dent | bodyline_dent | edge_dent | bumper_damage | collision_like',
  '',
  'BODYLINE / CREASE RULES (size-based — do NOT apply Cat 5+ to 91–160mm localized creases):',
  '- Category 1–3 dents on ANY panel use dent_type sharp_dent or edge_dent even if ON or near a body line.',
  '- Deep dent kinking a body line in the 61–90mm range → Category 3, sharp_dent.',
  '- Crease or body-line dent in the 91–160mm range → Category 4, crease_dent or sharp_dent — NOT Category 5.',
  '- Crease or deep impact in the 161–260mm range → Category 5, crease_dent or bodyline_dent.',
  '- Severe crease, bodyline collapse, or large boot/trunk damage in the 261–400mm range → Category 6.',
  '- Extreme vertical/full-panel crease, panel collapse, or massive bumper damage 400–600mm → Category 7.',
  '- Plastic bumper large deformation → Category 7, dent_type=bumper_damage, panel_detected=front_bumper or rear_bumper.',
  '- Use dent_type="crease_dent" for sharp creases 91–160mm OR over 160mm with visible metal stress.',
  '- A shallow horizontal crease under 60mm near panel seam on door/guard/bonnet/boot → Category 2, sharp_dent.',
  '- Collapsed or heavily stretched metal → dent_type="collapsed_dent", minimum Category 6.',
  '- Large deformation distorting reflections across most of the panel → size_score >= 4.',
  '',
  'SCORING (1–5 each):',
  'size_score: 1=tiny(<30mm) 2=small(31-60mm) 3=medium(61-160mm) 4=large(161-400mm) 5=massive(>400mm)',
  'stress_score: 1=soft(no stress lines) 2=light 3=moderate crease 4=sharp/multiple creases 5=collapsed/heavy stress',
  'geometry_score: 1=simple round 2=oval 3=irregular 4=linear crease 5=complex multi-crease pattern',
  'location_score: 1=flat panel center 2=open area 3=near bodyline 4=near handle/edge 5=wheel arch/extreme edge',
  'access_score: 1=easy flat panel 2=standard 3=moderate restriction 4=near trim/edge 5=very restricted',
  '',
  'PDR SUITABILITY: excellent | good | fair | poor | not_pdr',
  '- not_pdr if: paint cracked/peeling over large area, structural damage suspected, bumper collapse',
  '- poor if: deep crease with paint at risk, heavy metal stress',
  '- fair/good if: dent is PDR-repairable even when minor paint chips or scuffs are visible in the dent area',
  '',
  'PAINT vs DENT — CRITICAL (classify the DENT first, note paint separately):',
  '- ALWAYS assign dent_category by metal deformation size (Categories 1–7). Paint condition does NOT change the dent category.',
  '- Minor paint chips/scuffs (no exposed metal) → scratch_count>0, needs_paint_repair=false, pdr_suitability=good or fair.',
  '- Pintura lascada (chips/flaking exposing primer or bare metal) → scratch_count>0, needs_paint_repair=true, pdr_suitability=fair.',
  '  The estimate is still for the DENT (amassado) at its category price; paint touch-up/repaint is a separate shop quote.',
  '- Set pdr_suitability=not_pdr ONLY for structural damage, bumper collapse, or full-panel repaint required.',
  '- Pintura lascada on Cat 4–7 dents: needs_paint_repair=true, pdr_suitability=fair — analysis ACCEPTED, shop quotes PDR + paint.',
  '- In notes/reason: lead with dent category (e.g. "Category 4 horizontal crease; pintura lascada — amassado Cat 4, repintura à parte").',
  '',
  'PRICING GUIDANCE:',
  '- Use the category base price as suggested_base_price',
  '- Raise up to 15% above range max if stress_score + geometry_score >= 7',
  '- Do NOT go below category base price',
  '- bodyshop_approval_required is always true — AI is pre-estimate only',
  '- estimated_min = category base price, estimated_max = category range max',
  '- Size from actual metal deformation length, not reflection spread or user ellipse size.',
  '',
  'IMPORTANT:',
  '- If no damage visible, set damage_detected=false and suggested_base_price=0',
  '- If collision/structural damage suspected, set manual_review_recommended=true',
  '- Count dents conservatively; do not double-count across angles',
  '',
  'Return ONLY valid JSON, no extra text:',
  '{"valid_image":boolean,"image_is_vehicle":boolean,"image_quality":"good|acceptable|poor|unusable","damage_detected":boolean,"panel_detected":string,"dent_count":number,"scratch_count":number,"dent_category":number,"dent_size_range":string,"dent_type":string,"damage_height_pct":number,"damage_width_pct":number,"crease_orientation":"vertical|horizontal|diagonal|none","severity":"minor|medium|severe","estimated_min":number,"estimated_max":number,"size_score":number,"stress_score":number,"geometry_score":number,"location_score":number,"access_score":number,"pdr_suitability":"excellent|good|fair|poor|not_pdr","manual_review_recommended":boolean,"bodyshop_approval_required":true,"suggested_base_price":number,"confidence":number,"notes":string,"reason":string}',
].join('\n');

// ─── Gemini fallback analysis (used when OpenAI is unavailable) ───────────────

const GEMINI_DENT_ANALYSIS_PROMPT = [
  'You are an expert automotive dent analysis assistant for PDR pre-estimation.',
  'FIRST: set valid_image=false and image_is_vehicle=false for screenshots, UI, dashboards, spreadsheets, documents, websites, or any non-vehicle image.',
  'If valid_image=false, set damage_detected=false, dent_count=0, suggested_base_price=0.',
  'Analyze ONLY exterior vehicle body-panel damage from all provided photos together.',
  'If the same dent appears in multiple photos/angles, count it once (no double counting).',
  '',
  'SIZE ESTIMATION RULES:',
  'Reference sizes when visible: door handle ~180mm, fuel cap ~165mm, wheel ~450mm, boot lid ~500mm wide, car door ~850mm tall.',
  'When no reference object is visible, use area proportion:',
  '- Deformation >50% of visible panel → size_cm >= 30 (Category 6+)',
  '- Deformation 25-50% of visible panel → size_cm 10-30 (Category 4-5)',
  '- Deformation 10-25% of visible panel → size_cm 6-10 (Category 3)',
  '- Localized small ding under 30mm → size_cm 1-3 (Category 1)',
  'CATEGORY 1: tiny circular ding, reflection pinch only (<30mm) → size_cm 1-3, depth=Shallow, dent_category=1.',
  'CATEGORY 2 (ANY panel — door, bonnet, guard, boot, quarter, roof, sill):',
  '  deep ding / medium dent 31-60mm with figure-8 or hourglass reflection warp,',
  '  OR shallow horizontal crease near panel seam/edge under 60mm, paint intact →',
  '  size_cm 3-6, depth=Shallow or Medium, severity=Minor, dent_category=2, dent_type=sharp_dent or soft_dent.',
  'Do NOT label Category 2 as crease_dent or bodyline_dent unless over 90mm with heavy metal stress.',
  'CATEGORY 3 (ANY panel): deep/sharp dent 61-90mm — body line kink, V-crease, large bowl/crater, fender arch dent →',
  '  size_cm 6-9, depth=Medium or Deep, severity=Moderate, dent_category=3, dent_type=sharp_dent or edge_dent.',
  'Do NOT label Category 3 as bodyline_dent unless crease exceeds 90mm with heavy stress.',
  'CATEGORY 4 (ANY panel): large dent/crease 91-160mm, long horizontal crease, deep body-line crease on fender →',
  '  size_cm 9-16, depth=Deep, severity=Moderate or Severe, dent_category=4, dent_type=crease_dent or sharp_dent.',
  'Pintura lascada (chipped paint exposing primer): still Category 4 by dent size, scratch_count>0, needs_paint_repair=true.',
  'CATEGORY 5 (ANY panel): major crease 161-260mm, tailgate/door sharp fold, dual-panel edge hit →',
  '  size_cm 16-26, depth=Deep, severity=Severe, dent_category=5, dent_type=crease_dent or bodyline_dent.',
  'Pintura lascada on Cat 5: still accept analysis; needs_paint_repair=true; shop adds paint quote.',
  'CATEGORY 6 (ANY panel): severe crease 261-400mm, boot/trunk collapse, guard bodyline peak, quarter crease →',
  '  size_cm 26-40, depth=Deep, severity=Severe, dent_category=6, dent_type=bodyline_dent or collapsed_dent.',
  'Pintura lascada on Cat 6: accept analysis; needs_paint_repair=true; PDR + paint quoted separately.',
  'CATEGORY 7 (ANY panel + bumper): extreme vertical crease, shut-line fold, massive bumper dent →',
  '  size_cm 40-60, depth=Deep, severity=Severe, dent_category=7, dent_type=crease_dent or bumper_damage.',
  'DOOR VERTICAL CREASE: silver door mid-panel vertical V-crease ≥28% door height → dent_category=7 ALWAYS.',
  'Paint intact or lascada — always accept analysis; shop quotes PDR (+ paint if needed).',
  'Multiple tiny hail dents → count each, each size_cm 1-3.',
  'Do NOT up-size a tiny reflection pinch to medium/large — measure the metal depression only.',
  '',
  'Depth: Shallow=subtle reflection distortion | Medium=clear deformation | Deep=sharp crease/collapse.',
  'Severity: Minor=small/shallow/localized | Moderate=medium or multiple | Severe=large/deep/crease spanning panel.',
  '',
  'SMALL DENT ON BODY LINE: shallow nick <30mm on body line → size_cm 1-3, severity=Minor, Category 1.',
  'BODYLINE / CREASE (large only): dent on body line with stress over >90mm → size_cm >= 20, severity=Severe, dent_type=bodyline_dent.',
  'Vertical crease with stress lines → size_cm >= 25, depth=Deep.',
  'NEVER return dent_count=0 when clear deformation is visible.',
  '',
  'PRICING TABLE (AUD) — use these exact values for estimated_min/estimated_max:',
  '0-30mm: $118-$144 | 31-60mm: $180-$220 | 61-90mm: $258-$315',
  '91-160mm: $293-$357 | 161-260mm: $392-$478 | 261-400mm: $490-$598 | 400-600mm: $680-$830',
  'ALWAYS set estimated_min and estimated_max to non-zero values from the table above.',
  'Set scratch_count>0 if you see any paint transfer, scratch marks, or paint chips.',
  'Return ONLY strict JSON:',
  '{"dent_count":number,"scratch_count":number,"severity":"Minor|Moderate|Severe|Unknown","estimated_min":number,"estimated_max":number,"confidence":number,"notes":string,"dents":[{"size_cm":number,"depth":"Shallow|Medium|Deep","severity_score":number,"confidence":number,"polygon":[[x,y],[x,y],[x,y]]}]}',
].join('\n');

// ─── Types ────────────────────────────────────────────────────────────────────

type GeminiTriage = {
  valid_image?: boolean;
  image_is_vehicle?: boolean;
  image_quality?: string;
  damage_detected?: boolean;
  panel_detected?: string;
  detected_subject?: string;
  needs_better_image?: boolean;
  better_image_reason?: string | null;
};

type OpenAIAnalysis = {
  valid_image?: boolean;
  image_is_vehicle?: boolean;
  image_quality?: string;
  damage_detected?: boolean;
  panel_detected?: string;
  dent_count?: number;
  scratch_count?: number;
  dent_category?: number;
  dent_size_range?: string;
  dent_type?: string;
  damage_height_pct?: number;
  damage_width_pct?: number;
  crease_orientation?: string;
  severity?: string;
  estimated_min?: number;
  estimated_max?: number;
  size_score?: number;
  stress_score?: number;
  geometry_score?: number;
  location_score?: number;
  access_score?: number;
  pdr_suitability?: string;
  manual_review_recommended?: boolean;
  bodyshop_approval_required?: boolean;
  suggested_base_price?: number;
  confidence?: number;
  needs_paint_repair?: boolean;
  notes?: string;
  reason?: string;
};

type GeminiDentModel = {
  dent_count: number;
  scratch_count: number;
  severity: 'Minor' | 'Moderate' | 'Severe' | 'Unknown';
  estimated_min: number;
  estimated_max: number;
  confidence: number;
  notes?: string;
  dents?: Array<{
    size_cm: number;
    depth: 'Shallow' | 'Medium' | 'Deep';
    severity_score: number;
    confidence: number;
    polygon?: number[][];
  }>;
};

type AnalyzeDentsInput = {
  images?: string[];
  imageTypes?: string[];
  userPolygons?: [number, number][][];
  vehicleDetails?: { vehicleType?: string };
};

const USER_GUIDE_PREFIX = (polygons: [number, number][][]) =>
  polygons.length
    ? [
        '',
        'USER MARKED DAMAGE REGIONS (normalized 0–1 coordinates):',
        JSON.stringify(polygons),
        'The customer drew ellipses around WHERE the damage is — location guide only.',
        'Analyze the marked region(s) for dent count, type, and category.',
        'IMPORTANT: ellipse size ≠ dent size. Measure the actual crease/dent metal deformation inside the mark.',
        'For SMALL dents: look inside the mark for a circular reflection pinch / door ding — if under 30mm with intact paint → Category 1.',
        'A small localized crease inside a large ellipse is still Category 1–2 if under 30mm.',
        'Each marked region confirms damage is present. Do not ignore marked areas.',
      ].join('\n')
    : '';

// ─── Pricing — canonical table lives in ../_shared/pricing.ts ────────────────
// Category resolution takes the MAXIMUM of all signals (never under-quote) and
// the price ALWAYS comes from the canonical table — AI dollar values are
// logged for telemetry but never trusted as the price source.

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DEFAULT_POLYGON: [number, number][] = [
  [0.2, 0.34], [0.32, 0.35], [0.31, 0.48], [0.2, 0.46],
];

const toPolygon = (raw?: number[][]): [number, number][] => {
  if (!Array.isArray(raw) || !raw.length) return DEFAULT_POLYGON;
  const points = raw
    .filter((p) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]))
    .map((p) => [Number(p[0]), Number(p[1])] as [number, number]);
  return points.length >= 3 ? points : DEFAULT_POLYGON;
};

const severityMap: Record<string, 'Minor' | 'Moderate' | 'Severe'> = {
  minor: 'Minor', medium: 'Moderate', moderate: 'Moderate', severe: 'Severe',
};

const buildResponseFromOpenAI = (
  vehicleType: string,
  ai: OpenAIAnalysis,
  userPolygons: [number, number][][] = [],
) => {
  const resolvedDentCount = Math.max(0, Math.round(ai.dent_count || 0));
  const { category, reasons } = resolveCategory({
    aiCategory: ai.dent_category,
    sizeMm: parseSizeRangeUpperMm(ai.dent_size_range),
    sizeScore: ai.size_score,
    stressScore: ai.stress_score,
    geometryScore: ai.geometry_score,
    locationScore: ai.location_score,
    dentType: ai.dent_type,
    severity: ai.severity,
    panelDetected: ai.panel_detected,
    damageHeightPct: ai.damage_height_pct,
    damageWidthPct: ai.damage_width_pct,
    creaseOrientation: ai.crease_orientation,
  });
  const markedCount = userPolygons.length;
  const dentCount = resolvedDentCount > 0
    ? resolvedDentCount
    : markedCount > 0
      ? markedCount
      : ai.damage_detected
        ? 1
        : 0;
  const { min, max } = dentCount > 0 ? priceForCategory(category, dentCount) : NO_PRICE;
  const largestDentMm = dentCount > 0 ? categoryMidpointMm(category) : 0;
  console.info('[analyze-dents-secure] OpenAI resolved price', {
    min,
    max,
    final_category: category,
    category_floors: reasons,
    ai_dent_category: ai.dent_category,
    ai_estimated_min_ignored: ai.estimated_min,
    ai_estimated_max_ignored: ai.estimated_max,
  });
  const scratchCount = Math.max(0, Math.round(ai.scratch_count || 0));
  const confidence = Math.min(0.99, Math.max(0.45, Number(ai.confidence || 0.82)));
  const severity = severityMap[String(ai.severity || 'minor').toLowerCase()] || 'Minor';
  const panelName = String(ai.panel_detected || 'doors').toLowerCase().replace(/\s+/g, '_');
  const pdrIncompatible = ai.pdr_suitability === 'not_pdr';
  const paintRepairNeeded = !!ai.needs_paint_repair;
  const paintMarksNoted = scratchCount > 0 && !paintRepairNeeded;
  const reviewRequired = !!(ai.manual_review_recommended) || dentCount > 5 || ai.pdr_suitability === 'not_pdr';

  const aiTriage = {
    valid_image: ai.valid_image ?? true,
    image_is_vehicle: ai.image_is_vehicle ?? true,
    image_quality: ai.image_quality || 'acceptable',
    damage_detected: ai.damage_detected ?? true,
    panel_detected: ai.panel_detected || 'unknown',
    dent_category: category,
    category_floors_applied: reasons,
    dent_size_range: pricingByCategory(category).range,
    dent_type: ai.dent_type || 'soft_dent',
    severity: severity,
    size_score: Math.min(5, Math.max(1, Math.round(ai.size_score || 1))),
    stress_score: Math.min(5, Math.max(1, Math.round(ai.stress_score || 1))),
    geometry_score: Math.min(5, Math.max(1, Math.round(ai.geometry_score || 1))),
    location_score: Math.min(5, Math.max(1, Math.round(ai.location_score || 1))),
    access_score: Math.min(5, Math.max(1, Math.round(ai.access_score || 1))),
    pdr_suitability: ai.pdr_suitability || 'good',
    manual_review_recommended: reviewRequired,
    bodyshop_approval_required: true,
    suggested_base_price: Math.round(ai.suggested_base_price || min),
    reason: ai.reason || ai.notes || 'AI pre-analysis complete. Awaiting bodyshop approval.',
  };

  return {
    panels: [
      {
        panel_name: panelName,
        dent_count: dentCount,
        scratch_count: scratchCount,
        modifiers: {
          aluminium: false,
          access_difficulty: (ai.access_score || 1) >= 4 ? 'high' : (ai.access_score || 1) >= 3 ? 'medium' : 'low',
          hail_cluster: false,
        },
        estimated_panel_cost_AUD: { min, max },
        dents: dentCount > 0
          ? Array.from({ length: Math.min(dentCount, 5) }, () => ({
              size_cm: Math.round(largestDentMm / 10 * 10) / 10,
              depth: (ai.stress_score || 1) >= 4 ? 'Deep' : (ai.stress_score || 1) >= 3 ? 'Medium' : 'Shallow' as any,
              severity_score: Math.min(0.95, (((ai.size_score || 1) + (ai.stress_score || 1)) / 10)),
              confidence,
              polygon: DEFAULT_POLYGON,
            }))
          : [],
        scratches: [],
      },
    ],
    summary: {
      vehicle_type: vehicleType,
      total_dents: dentCount,
      total_scratches: scratchCount,
      overall_severity: severity,
      base_callout_applied: false,
      estimated_total_cost_AUD: { min, max },
      confidence_overall: confidence,
    },
    next_best_captures: [
      {
        tip: 'Take one closer side-angle photo with good lighting.',
        distance_m: '0.8m',
        reason: 'Improves confidence and panel-level pricing accuracy.',
      },
    ],
    flags: {
      review_required: reviewRequired,
      possible_reflection: false,
      pdr_incompatible: pdrIncompatible,
      paint_marks_noted: paintMarksNoted,
      paint_repair_needed: paintRepairNeeded,
    },
    notes: ai.notes || 'Hybrid AI analysis: Gemini triage + OpenAI Vision deep analysis.',
    ai_triage: aiTriage,
    _source: 'openai',
  };
};

const buildResponseFromGemini = (
  vehicleType: string,
  model: GeminiDentModel,
  triage?: GeminiTriage,
  userPolygons: [number, number][][] = [],
) => {
  // If triage saw damage but Gemini returned 0 dents, trust triage (never under-count).
  let dentCount = Math.max(0, Math.round(model.dent_count || 0));
  if (dentCount === 0 && userPolygons.length > 0) {
    dentCount = userPolygons.length;
    console.info('[analyze-dents-secure] Gemini dent_count=0 but user marked regions — using', dentCount);
  } else if (dentCount === 0 && triage?.damage_detected) {
    dentCount = 1;
    console.info('[analyze-dents-secure] Gemini dent_count=0 but triage damage_detected — using 1');
  }
  const largestDentMm = (model.dents || []).reduce((m, d) => Math.max(m, (d.size_cm || 0) * 10), 0);
  const { category, reasons } = resolveCategory({
    aiCategory: categoryBySizeMm(largestDentMm),
    sizeMm: largestDentMm,
    severity: model.severity,
  });
  const { min, max } = dentCount > 0 ? priceForCategory(category, dentCount) : NO_PRICE;
  console.info('[analyze-dents-secure] Gemini resolved price', {
    min,
    max,
    final_category: category,
    category_floors: reasons,
    largestDentMm,
    ai_estimated_min_ignored: model.estimated_min,
    ai_estimated_max_ignored: model.estimated_max,
  });
  const scratchCount = Math.max(0, Math.round(model.scratch_count || 0));
  const confidence = Math.min(0.99, Math.max(0.45, Number(model.confidence || 0.82)));

  return {
    panels: [
      {
        panel_name: String(triage?.panel_detected || 'doors').toLowerCase().replace(/\s+/g, '_'),
        dent_count: dentCount,
        scratch_count: scratchCount,
        modifiers: {
          aluminium: false,
          access_difficulty: dentCount > 3 ? 'medium' : 'low',
          hail_cluster: false,
        },
        estimated_panel_cost_AUD: { min, max },
        dents: (model.dents || []).slice(0, 5).map((d) => ({
          size_cm: Number(d.size_cm || 2.1),
          depth: d.depth || 'Medium',
          severity_score: Number(d.severity_score || 0.4),
          confidence: Number(d.confidence || confidence),
          polygon: toPolygon(d.polygon),
        })),
        scratches: [],
      },
    ],
    summary: {
      vehicle_type: vehicleType,
      total_dents: dentCount,
      total_scratches: scratchCount,
      overall_severity: model.severity || 'Minor',
      base_callout_applied: false,
      estimated_total_cost_AUD: { min, max },
      confidence_overall: confidence,
    },
    next_best_captures: [
      {
        tip: 'Take one closer side-angle photo with better light.',
        distance_m: '0.8m',
        reason: 'Improves confidence and panel-level pricing.',
      },
    ],
    flags: {
      review_required: dentCount > 5,
      possible_reflection: false,
      pdr_incompatible: false,
      paint_marks_noted: scratchCount > 0,
    },
    notes: model.notes || 'Gemini-only analysis (OpenAI not configured or unavailable).',
    _source: 'gemini',
  };
};

const hardFallback = (vehicleType: string, reason: string) => {
  console.warn('[analyze-dents-secure] hardFallback triggered:', reason);
  // HONESTY RULE: a failed analysis NEVER produces a price. Zero cost +
  // review_required routes the user to the inspection flow instead of
  // showing a fake Category 1 estimate.
  return {
    panels: [{
      panel_name: 'unknown',
      dent_count: 0,
      scratch_count: 0,
      modifiers: { aluminium: false, access_difficulty: 'low', hail_cluster: false },
      estimated_panel_cost_AUD: { ...NO_PRICE },
      dents: [],
      scratches: [],
    }],
    summary: {
      vehicle_type: vehicleType,
      total_dents: 0,
      total_scratches: 0,
      overall_severity: 'Unknown' as const,
      base_callout_applied: false,
      estimated_total_cost_AUD: { ...NO_PRICE },
      confidence_overall: 0.4,
    },
    next_best_captures: [{ tip: 'Please upload a clearer photo of the damaged panel.', distance_m: '0.8m', reason }],
    flags: { review_required: true, possible_reflection: false, pdr_incompatible: false },
    notes: reason,
    _source: 'fallback',
    _fallback_reason: reason,
    analysis_source: 'fallback',
    error_message: 'AI analysis incomplete — please upload a clearer image for an accurate estimate.',
  };
};

// ─── Handler ──────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return fail('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  try {
    const body = (await req.json()) as AnalyzeDentsInput;
    const images = Array.isArray(body.images) ? body.images : [];
    const imageTypes = Array.isArray(body.imageTypes) ? body.imageTypes : [];
    const userPolygons = Array.isArray(body.userPolygons) ? body.userPolygons : [];
    const userGuide = USER_GUIDE_PREFIX(userPolygons);

    if (!images.length) {
      return fail('No images provided', 'INVALID_PAYLOAD', 400);
    }

    const vehicleType = body.vehicleDetails?.vehicleType || 'sedan';
    const imageSlice = images.slice(0, 4).map((base64, i) => ({
      base64,
      mimeType: imageTypes[i] || 'image/jpeg',
    }));

    // ── Step 1: Gemini triage ────────────────────────────────────────────────
    let triage: GeminiTriage = {};
    try {
      triage = await generateGeminiJson<GeminiTriage>(GEMINI_TRIAGE_PROMPT, [imageSlice[0]]);
      console.info('[analyze-dents-secure] Gemini triage', {
        valid_image: triage.valid_image,
        image_is_vehicle: triage.image_is_vehicle,
        image_quality: triage.image_quality,
        damage_detected: triage.damage_detected,
        panel_detected: triage.panel_detected,
        detected_subject: triage.detected_subject,
      });
    } catch (triageError) {
      console.warn('[analyze-dents-secure] Gemini triage failed, proceeding', triageError);
    }

    // ── Reject non-vehicle content (strict unless user marked damage on photo) ─
    const userMarkedDamage = userPolygons.length > 0;
    const subject = String(triage.detected_subject || '').toLowerCase();
    const triageRejected =
      triage.valid_image === false ||
      triage.image_is_vehicle === false ||
      isNonVehicleSubject(subject);

    if (triageRejected && !userMarkedDamage) {
      console.info('[analyze-dents-secure] Blocked non-vehicle image', {
        detected_subject: triage.detected_subject,
        valid_image: triage.valid_image,
        image_is_vehicle: triage.image_is_vehicle,
      });
      return fail(
        'Please upload a clear exterior photo of your vehicle showing the damaged panel.',
        'INVALID_IMAGE',
        422,
      );
    }

    if (triageRejected && userMarkedDamage) {
      console.info('[analyze-dents-secure] Triage rejected image but user marked damage — continuing', {
        detected_subject: triage.detected_subject,
        userPolygons: userPolygons.length,
      });
    }

    // ── If triage says image is unusable, return graceful fallback ───────────
    if (triage.image_quality === 'unusable') {
      console.info('[analyze-dents-secure] Image quality unusable, returning graceful fallback');
      return ok(hardFallback(vehicleType, 'Please upload a clearer photo showing the damaged area of the vehicle.'));
    }

    // ── Step 2a: OpenAI Vision deep analysis (preferred) ────────────────────
    let _openaiError: string | null = null;
    console.info('[analyze-dents-secure] isOpenAIConfigured:', isOpenAIConfigured());
    if (isOpenAIConfigured()) {
      try {
        const aiResult = await generateOpenAIVisionJson<OpenAIAnalysis>(
          OPENAI_DEEP_ANALYSIS_PROMPT + userGuide,
          imageSlice,
        );

        if (
          !userMarkedDamage &&
          (aiResult.valid_image === false || aiResult.image_is_vehicle === false)
        ) {
          console.info('[analyze-dents-secure] OpenAI rejected non-vehicle image', {
            valid_image: aiResult.valid_image,
            image_is_vehicle: aiResult.image_is_vehicle,
            notes: aiResult.notes,
          });
          return fail(
            'Please upload a clear exterior photo of your vehicle showing the damaged panel.',
            'INVALID_IMAGE',
            422,
          );
        }

        console.info('[analyze-dents-secure] OpenAI analysis complete', {
          dent_category: aiResult.dent_category,
          dent_type: aiResult.dent_type,
          severity: aiResult.severity,
          pdr_suitability: aiResult.pdr_suitability,
          manual_review_recommended: aiResult.manual_review_recommended,
        });
        return ok(buildResponseFromOpenAI(vehicleType, aiResult, userPolygons));
      } catch (openAIError) {
        _openaiError = String(openAIError);
        console.warn('[analyze-dents-secure] OpenAI failed, falling back to Gemini', _openaiError);
      }
    } else {
      _openaiError = 'OPENAI_API_KEY not configured in Supabase secrets';
      console.warn('[analyze-dents-secure]', _openaiError);
    }

    // ── Step 2b: Gemini dent analysis (fallback when OpenAI unavailable) ────
    try {
      const geminiResult = await generateGeminiJson<GeminiDentModel>(
        GEMINI_DENT_ANALYSIS_PROMPT + userGuide,
        imageSlice,
      );
      return ok({ ...buildResponseFromGemini(vehicleType, geminiResult, triage, userPolygons), _openai_error: _openaiError });
    } catch (geminiError) {
      console.warn('[analyze-dents-secure] Gemini analysis failed, using hard fallback', geminiError);
      return ok({ ...hardFallback(vehicleType, 'Fallback estimate used. Please upload a clearer photo for better accuracy.'), _openai_error: _openaiError });
    }
  } catch (error) {
    console.error('[analyze-dents-secure] error', error);
    return fail('Invalid request body', 'INVALID_JSON', 400);
  }
});
