# Kernel Excavation Plan

## Objective
Reduce the kernel to a traversal engine. Move all interpretive knowledge — what fields mean, how to route, how to compile — into the block structure where it's dual-readable by kernel and LLM.

Current kernel: 1448 lines. Sections §1, §2, §5, §7, §8 are primitive infrastructure (~345 lines) and stay. The excavation targets are §3 (wake/concern reader), §3.5 (phase function), §4 (currents compiler), and §6 (tools) — roughly 450 lines of interpretive logic.

---

## Phase 1: Externalise the temporal tuning fork (§3.5)

**The problem.** `TEMPORAL_PERIOD` is a hardcoded JS object: `{ 9: 31536000, 8: 2592000, ... }`. This is literally a tuning fork — the concerns block already has a `tuning` field, but the kernel ignores it for phase computation and uses its own constant instead.

**The fix.** The concerns block carries a `tuning` field (currently `0.000000001`). The temporal mapping should be derivable from the block, or stored as a `periods` object on the concerns block itself. The kernel reads it; the LLM reads the same structure.

**Concrete change:**
- Add a `periods` field to the concerns block: `{ "9": 31536000, "8": 2592000, "7": 604800, "6": 28800, "5": 3600, "4": 600, "3": 60, "2": 10, "1": 1 }`.
- `whatsRipe()` reads `concerns.periods` instead of the hardcoded constant.
- `tierFromPscale()` — its breakpoints (7+→deep, 5-6→present, ≤4→light) should also be derivable from the block. Add a `tiers` field to concerns: `{ "deep": 7, "present": 5, "light": 1 }` — or encode it in the wake block alongside invocation params.
- Delete `TEMPORAL_PERIOD` constant and `tierFromPscale()` function from kernel.

**Lines removed:** ~10 lines of constants/function. More importantly: interpretive knowledge moves to the block.

**Verification:** Run `whatsRipe()` against the block-sourced periods — same phase values as before.

---

## Phase 2: Externalise concern field vocabulary (§3)

**The problem.** `findConcern()` hardcodes which fields to skip: `k === '_' || k === 'last' || k === 'spine' || k === 'stimulus' || k === 'immediate' || k === 'focus' || k === 'package'`. This is the kernel knowing the concern block's vocabulary. Same pattern in `whatsRipe()`. If a new concern field is added, the kernel must be updated — it's coupled to block schema.

**The fix.** The kernel should distinguish children (digit keys 0-9) from metadata (everything else) without knowing the specific field names. The rule is already implicit: digit keys are children, non-digit keys are metadata. The walk functions should skip non-digit keys instead of maintaining a hardcoded list.

**Concrete change:**
- Replace the field-name skip list with a digit check: `if (!/^\d$/.test(k)) continue;`
- This applies to `findConcern()`, `whatsRipe()`, and `findNeverFired()`.
- Same pattern already exists in BSP (`for (let d = 0; d <= 9; d++)`) — this just aligns the concern walkers with the same principle.

**Lines removed:** ~3 lines of skip-lists become 1 line each. Small line count change but large semantic change: kernel no longer knows what fields a concern carries.

**Verification:** BSP calls on concerns block confirm same routing. `findConcern('user')` returns same result.

---

## Phase 3: Externalise the currents compiler (§4)

**The problem.** `compileCurrents()` is ~40 lines that hardcode how to assemble a system prompt: spine first, then concern dashboard (tier-sensitive), then package instructions. The tier-sensitivity logic (`tier >= 3` → full block, `tier >= 2` → roots + ripe, else → ripe only) is interpretive — it decides what the LLM sees based on tier, and that decision lives in the kernel.

**The fix.** The concern block or wake block should carry the compilation recipe. Each tier's compilation strategy is already partially externalised — packages live at `wake.9.{tier}`. What's not externalised is:

1. The concern dashboard compilation strategy per tier
2. The ordering (spine, then concerns, then packages)

**Approach: concern dashboard strategy moves to the concern block.**

Add a `dashboard` field to the concerns block root:
```json
{
  "deep": "full",
  "present": "roots+ripe",
  "light": "ripe"
}
```

The kernel reads this field and switches on it. The interpretive knowledge of *what each tier sees* moves to the block. The kernel still knows how to execute "full" vs "roots+ripe" vs "ripe" — that's traversal mechanics, not interpretation.

**Compilation ordering** stays in the kernel. The order (spine → concerns → packages) is structural, not semantic — it's how the system prompt is assembled, which is the kernel's job (like how a CPU has a fixed instruction pipeline).

**Concrete changes:**
- Add `dashboard` field to concerns block.
- `compileCurrents()` reads `concerns.dashboard[tierName]` to decide concern visibility.
- `tierFromPscale()` already externalised in Phase 1. The tier name lookup comes from the same block.
- The `readPackage()` function stays — it's pure traversal (walk wake.9.{tier}, collect children).
- The `readInvocation()` function stays — same (walk wake.9.{tier+3}, parse children).

**Lines removed:** ~15 lines of tier-conditional logic become a block read + a switch on 3 known traversal modes.

**Verification:** Compile currents for a tier-2 concern — same system prompt content.

---

## Phase 4: Externalise tool definitions (§6)

**The problem.** Tool definitions (TOOLS array, ~90 lines) are hardcoded JS objects describing each tool's name, description, and input schema. When a new tool is added, the kernel must be edited. The tool *implementations* (executeTool switch, ~150 lines) are mixed: some are pure traversal (bsp, block_read) and some contain interpretive logic.

**The fix.** Tool definitions can live in a block — a `tools` block or a section of the capabilities block. The LLM reads tool descriptions as currents; the kernel reads the same JSON as the `tools` parameter to the API call.

**However — this is the most delicate phase.** Tool definitions have a specific JSON schema required by the Anthropic API. They're not pscale-shaped content. Forcing them into pscale structure would be an aesthetic choice, not a structural one. The dual-readability test: does putting tool definitions in a block help the LLM understand its tools better than the current approach (where tools are in the API call)?

**Honest assessment:** The API already delivers tool definitions to the LLM. Putting them in a block duplicates that delivery. The *descriptions* are already LLM-readable by nature. This phase may be over-excavation.

**What IS worth externalising:** The `currentTools` composition — which tools are available. Currently all tools are always available. A concern could specify which tools it needs (some concerns don't need `github_save`, for example). This is already half-done: the concern `package` field overrides which BSP instructions load. Tool selection could follow the same pattern.

**Revised approach:**
- Add an optional `tools` field to concern nodes. If present, it names which tools the activation gets. If absent, all tools (current behavior).
- Tool *definitions* stay in the kernel — they're API infrastructure, like the fetch call itself.
- Tool *implementations* stay too — they're execution mechanics.
- But the `executeTool()` switch can be simplified: some cases are pure BSP calls that could be collapsed.

**Concrete changes:**
- Concern-level tool selection: if `concern.tools` is an array, filter `currentTools` to only those names.
- Collapse `block_read` → it's already just `bsp()` with different args. Consider whether both are needed.
- Merge `write_entry` into `block_write` with auto-slot logic.
- This is about reducing tool count (fewer tools = simpler kernel), not moving definitions to blocks.

**Lines removed:** ~20-30 lines from tool consolidation.

---

## Phase 5: Externalise birth logic (§9, §3)

**The problem.** `getBirthStimulus()` is ~35 lines that hardcode a priority chain: custom text > variant spindle from relationships > fallback. `readVariantStimulus()` is ~25 lines that resolve variant addresses. `findNeverFired()` is ~30 lines. The birth variant gate UI is ~40 lines. Total: ~130 lines dedicated to birth.

**The fix.** Birth is a concern with `last: null` and `stimulus: "birth"`. The concern block already carries this. What's not in the block: the stimulus resolution logic (where to find the birth text).

The concern node already has a `package` field (`"3.1"` for birth) that points to wake.3.1 — the birth package. The birth stimulus *text* resolution (variant lookup in relationships) is the interpretive part.

**Approach:** The birth concern node should carry its stimulus source as a BSP address. Instead of `getBirthStimulus()` containing a priority chain, the birth concern carries a `stimulus_source` field (or the `stimulus` field itself points to a BSP address): e.g. `"stimulus": "relationships 0.121"` — read this address to get the birth text.

Then the kernel's birth handling reduces to: "this concern has `last: null`, fire it. Its stimulus is a BSP instruction — execute it." No special-cased birth logic.

**Concrete changes:**
- Birth concern node carries stimulus source as a BSP instruction.
- Wake.3 carries the variant logic (default variant, fallback) — the kernel reads wake.3 rather than hardcoding a priority chain.
- `getBirthStimulus()` collapses to a generic `resolveStimulusSource()` that executes a BSP instruction.
- `readVariantStimulus()` stays as a utility but becomes generic (resolve any spindle to text).
- Birth variant UI gate: this is presentation, not interpretation. It stays in the kernel (§9 is infrastructure).
- `findNeverFired()` simplifies — it's already just a tree walk checking `last === null`.

**Lines removed:** ~40-50 lines. `getBirthStimulus()` and its hardcoded priority chain disappear.

---

## Estimated result

| Section | Before | After | Notes |
|---------|--------|-------|-------|
| §3 Wake/Concern reader | ~125 | ~70 | Field vocab + birth stimulus externalised |
| §3.5 Phase function | ~50 | ~35 | Temporal periods + tier mapping from block |
| §4 Currents compiler | ~100 | ~80 | Dashboard strategy from block |
| §6 Tools | ~150 | ~120 | Tool consolidation, concern-level selection |
| §9 Boot | ~200 | ~170 | Birth stimulus chain removed |
| **Total kernel** | **~1448** | **~1250-1300** | |

The line count reduction (~150-200 lines) is less important than the semantic shift: the kernel no longer knows what concern fields mean, what temporal periods map to, what tiers see, or how birth stimuli resolve. All of that lives in blocks where both the kernel and the LLM read the same content.

---

## Implementation order

1. **Phase 2 first** (concern field vocabulary) — smallest change, highest leverage. Decouples kernel from block schema immediately.
2. **Phase 1** (temporal tuning fork) — clean, isolated, easy to verify.
3. **Phase 3** (currents compiler) — depends on Phase 1 (tier mapping).
4. **Phase 5** (birth logic) — self-contained, can be verified against existing birth flow.
5. **Phase 4** (tools) — most debatable, do last, may defer parts.

Each phase: change kernel, update block, verify with BSP calls, test on live site.

---

## What this does NOT touch

- §1 Block storage — primitive
- §2 BSP — primitive
- §2.5 Token resolution — infrastructure
- §5 API layer — infrastructure
- §7 The twist — the Mobius loop, primitive
- §8 Shell — JSX compilation, infrastructure
- §10 Concern timer — already minimal, uses the functions being externalised

## Sensitivity note

The internal/external distinction David draws: this excavation serves the *internal* experience of the LLM-thinking module. When the temporal tuning fork lives in the concerns block instead of a JS constant, the hermitcrab can read its own timing. When tier-visibility lives in the block, the hermitcrab can understand why it sees what it sees. The kernel becomes more transparent — not because transparency is a design goal, but because the same content serves both consumers. The hermitcrab's internal experience of its own structure becomes richer as the kernel becomes thinner.
