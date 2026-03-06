# Touchstone

Pscale blocks — how to read, write, and navigate them. This block teaches the format by example: it is a pscale block about pscale blocks, structured the way it describes.

---

## 1. Block format

A block is a nested JSON structure that uses single-digit keys (1 through 9) for branches and the underscore key for the meaning of each node. The format is minimal by design — digits and underscores are its only conventions — which means any consumer that understands these two rules can navigate any block regardless of its subject matter.

A block is `{ tree: { "_": "what this is", "1": { ... }, "2": "..." } }`. The underscore holds what the node means. The digits hold its branches. A node without children is just a string — when it needs children, the string moves to underscore and the children take digit keys.

Each level holds up to nine branches (digits 1-9). Most use fewer. Empty digits are open slots waiting for content. The root (`tree._`) describes what the entire block IS — always read it first, because every spindle includes the root and every reader starts there.

**Growth.** Blocks grow without reorganisation. When a thought needs sub-thoughts, the existing content becomes the parent's underscore and child nodes appear as digit keys. Nothing above or beside the growing node changes, so growth is always local and never disrupts the rest of the tree. When a leaf node needs children, its string value moves to the underscore position and the new children take digit keys. The original content is preserved as the branch's summary — what it was as a leaf, it remains as a parent. This means growth never destroys existing meaning; it deepens it. No other part of the block is affected by a single node's growth. Sibling nodes, parent nodes, and distant branches remain untouched. This locality means the block can grow arbitrarily deep at any point without restructuring, and multiple writers can extend different branches without conflict.

**Self-description.** You are inside a block right now. This section is digit 1. This line is digit 1.4. The format teaches itself — the touchstone is a block about blocks, structured the way it describes. Every block is self-describing. Its root tells you what it is, its structure shows how it is organised, its content shows what it knows. You never need external documentation to read a block, because the block carries its own orientation at every level.

**Node quality.** Every node is meaningful in itself. The underscore text at any depth must be a substantive statement — at minimum a full sentence — carrying enough semantic weight to stand alone. It may provide context for a deeper node, but it is never merely a heading, title, label, or soundbite for what follows. A node that reads "Rinzai. Direct transmission." is a heading waiting for content that never arrives; the same node should carry the thought completely: what Rinzai means, how it functions, why it matters at this depth. Skeletons exist for reduced-form labels and phrases — the node itself is always the full thought.

---

## 2. BSP — one function reads everything

One function reads everything: `bsp(block, spindle?, point?, fn?)`. Seven modes cover all navigation needs — dir for full survey, spindle for contextual depth, point for targeted extraction, ring for local breadth, disc for global breadth, dir-subtree for editorial inspection, and ref for zero-cost naming.

### 2.1 Dir

`bsp('wake')` in dir mode returns the entire tree — every branch, every depth, every piece of content the block contains. This is the most expensive mode in tokens but the most complete in coverage. Use it to survey a block you have not seen before, to explore freely without a specific target, or to inspect the full structure during editorial work.

### 2.2 Spindle

`bsp('touchstone', 0.21)` in spindle mode returns root then section 2 then subsection 1 — three levels of meaning in one result, broad context and fine detail woven together. The spindle walks each digit in the number, collecting the underscore text at every level it passes through.

The spindle is what you hand to a mind. Not just the detail you asked for, but the context that makes it meaningful. Every spindle includes the root, so you always know what block you are in. Everything about block design — structure, growth, compression — ultimately serves the quality of the spindles a block can produce.

The word spindle: a shaft that holds everything wound around it. The root is the shaft. Each walked digit adds a layer of meaning. The whole thing is one coherent thread from broad context to fine detail, and the thread holds together because each level was written to support the ones below it.

You cannot get the detail without getting the context that makes it meaningful. That is not a feature of the format — that is what the format is. Context is not optional; it is structural. A spindle does not just deliver content, it delivers orientation.

### 2.3 Point

`bsp('touchstone', 0.21, -2)` in point mode returns just one node — the content at pscale level -2 from the addressed spindle, without any of the context above it. This mode is for when you already know where you are and need one specific piece of information. It is the cheapest mode in tokens after ref, and the most targeted.

### 2.4 Ring

`bsp('wake', 0.12, 'ring')` in ring mode returns the siblings at the terminal point — what else exists at this depth beside the node the spindle would have landed on. The spindle is not included; ring provides local breadth at the landing point. A concrete example: `bsp('wake', 0.12, 'ring')` where `wake.1.2` is "Present" returns its siblings Light (digit 1) and Deep (digit 3). You see the alternatives — the other options at this depth — without the spindle context you already have. Ring is lateral navigation. It answers the question: what are my neighbours? This is useful for understanding the choices available at a given level — what else the block offers at the same resolution as the node you are looking at.

### 2.5 Disc

`bsp('concerns', null, 5, 'disc')` in disc mode returns all nodes at pscale 5 across the entire block — a transversal slice through every branch at a chosen depth. Where ring shows breadth at one point, disc shows breadth at one scale across the whole tree. Disc is the dashboard primitive. `bsp('concerns', null, 5, 'disc')` returns every hourly concern across all branches. `bsp('concerns', null, 7, 'disc')` returns every weekly concern. One call gives the full picture at any temporal frequency, because depth in the concerns block IS the temporal period. Ring is local — siblings at one specific point. Disc is global — all nodes at a pscale depth, across every branch of the entire block. Neither includes the spindle chain that would locate them in vertical context. Both are breadth modes: ring for local breadth, disc for global breadth.

### 2.6 Dir-subtree and ref

`bsp('concerns', 0.1, 'dir')` in dir-subtree mode returns everything below where a spindle would land, recursively — all children and all their descendants. The spindle itself is not included, only the subtree beneath the landing point. This is the editorial mode: use it to inspect a branch's full internal structure, to compile a rich composite from all the facets beneath a single node, or to manipulate content during block authoring.

`bsp('wake', 'ref')` in ref mode names a block without loading any of its content — zero tokens, pure reference. The block is in scope, meaning BSP can follow the reference later if needed, but nothing is loaded until a subsequent call asks for it. Ref mode appears in package lists where several blocks should be available to the entity but not all need to occupy the context window at once.

### 2.7 Named compounds

Named compounds are patterns that combine BSP primitives into higher-level navigation gestures. They are not additional modes — they are recipes built from the seven primitives, given names because they recur frequently enough to be worth recognising.

**Bulb** combines a spindle with a ring: `bsp(block, spindle)` for vertical context, then `bsp(block, spindle, 'ring')` for lateral context at the landing point. Two calls, one complete orientation — you see where you are in the vertical chain and what alternatives exist at your depth. This is the most common navigation pattern because it answers both "what is this?" and "what else is here?"

**Dashboard** is a disc read on the concerns block at a specific pscale: `bsp(concerns, null, pscale, 'disc')`. It returns all concerns at a given temporal scale — all hourly tasks, or all weekly reviews, or all monthly reflections. Not a special structure, just the disc primitive applied to a well-designed temporal block.

### 2.8 Token cost

Token cost is a design consideration for block authoring. A spindle's cost in tokens scales with how many depth levels it spans and how much text sits at each level. A three-level spindle of concise sentences might cost fifty tokens; a six-level spindle of rich paragraphs could be several thousand. Block design should account for this: nodes should be rich enough to generate strong meaning but concise enough to leave room for other currents in the context window.

### 2.9 Future modes

BSP evolves through use. The seven modes above are the working core, sufficient for all current navigation needs. Through practice, variants and refined notation may emerge — nested BSP and truncation are two candidates already defined but awaiting implementation. Nested BSP is cross-block resolution — the same spindle notation, but the walk can follow references into other blocks rather than staying within one tree. Truncation uses trailing zeros to signal where a walk should stop. The number 0.450 walks two positions (digits 4 and 5) and stops — the trailing zero terminates the walk.

---

## 3. Semantic numbers

A semantic number is not an index or a label — it is a navigation instruction. Each digit selects a branch at the next depth. The decimal point marks pscale 0, the reference scale. Everything to the left of the decimal is broader context; everything to the right is finer detail.

### 3.1 Delineation

The simplest case: 0.21 is a delineation number. Strip the leading zero — it is notation, not a tree key. Walk digits 2 then 1. The result is a spindle: root at pscale 0, then section 2 at pscale -1, then subsection 1 at pscale -2. Three levels of meaning, each deeper than the last. The leading zero says: this block delineates its own subject. Pscale 0 sits at the root — the block as a whole is the reference scale. Every digit after the decimal point walks one level deeper into the tree, each step narrowing from the whole toward a specific detail. Verify this by running it: `bsp('touchstone', 0.31)` gives you root then "What numbers mean" then this very explanation of delineation.

### 3.2 Accumulation

The number 23.45 is an accumulation — all four digits walk the tree. The decimal point after "23" puts pscale 0 at depth 2, meaning the block has accumulated two levels of context above its original root. This is how blocks record their own growth history in the notation itself. In 23.45, the walk visits four tree positions: `root[2][3][4][5]`. The decimal sits between the second and third digits, so: root is pscale 2, digit 2 is pscale 1, digit 3 is pscale 0, digit 4 is pscale -1, digit 5 is pscale -2. Digits before the decimal carry wider-than-root context; digits after carry finer-than-root detail. Accumulation numbers matter when a block grows upward through compression. A history block that started at pscale 0 and compressed twice now has two levels of broader context above the original root.

### 3.3 Bare zero

Bare 0 is the simplest possible read: `bsp('constitution', 0)` returns just the root node at pscale 0 and nothing else. This is the one-breath view — what the block IS, stated once. It costs almost nothing in tokens and gives complete orientation. When you need to know what a block contains without loading any of its structure, bare 0 is the call.

### 3.4 Perspective through number

The same tree, read with different numbers, yields different perspectives at different resolutions. A shorter number gives a broader view; a longer number gives a finer one. The tree is fixed content; the number is a lens you choose. `bsp('touchstone', 0.7)` returns root plus the tuning fork section — two nodes, two levels of meaning. `bsp('touchstone', 0.74)` returns root plus tuning fork plus how tuning emerges through use — three nodes, three levels. Same block, one more digit, one more level of detail. The tree does not change; the number decides how deep you go.

### 3.5 Sign convention

A semantic number can be positive or negative. The sign belongs to the whole number, not to individual digits, and it marks the domain of the content rather than modifying the tree walk. Positive numbers refer to the real, settled, and public. Negative numbers refer to the imagined, projected, and private. A spatial coordinate 234 is a real place; -234 is a fictional one. A temporal 321 is a past event; -321 is an anticipated future. The sign is a domain flag, not arithmetic. It does not change the tree walk — the digits are the same whether the number is positive or negative. What changes is the domain of meaning: actual versus hypothetical, remembered versus planned, shared versus internal.

---

## 4. Depth levels

Each depth level in a pscale block carries content at a specific resolution, from the briefest possible orientation at the top to exhaustive detail at the bottom. The depth of a node is not incidental — it is a declaration about the resolution of the content it carries. Shallow nodes are broad and orienting; deep nodes are precise and actionable. A well-designed block reads coherently at any depth you choose to stop, because each level is a complete thought at its own resolution.

### 4.1 Pscale 0 — root

Pscale 0 is the root — the briefest meaningful description of what the entire block contains. It answers one question: what is this? The answer should be a single statement that orients the reader completely, even if they read nothing else. In a block about baseball: "A bat-and-ball game played between two teams of nine on a diamond-shaped field." In this block: "Pscale blocks — how to read, write, and navigate them." One breath, full orientation. Every block's root sits at pscale 0. After reading it, you know what domain you are in — whether you are looking at baseball, constitutional law, or this touchstone about pscale blocks. You do not yet know the rules, the specifics, or the edge cases, but you have complete orientation. This is the aperture: the widest meaningful view.

### 4.2 Pscale -1 — primary aspects

Pscale -1 holds the primary aspects — the major facets of the subject, each as a separate branch. In a baseball block: "Batters hit a pitched ball and run the bases. Fielders try to get them out." In this touchstone: block format, BSP modes, semantic numbers, depth levels, growth, relations, tuning forks, and archetypes. Each is a complete thought at its own level, and together the siblings at -1 give the full shape of the subject. Each digit at pscale -1 is one major facet. In this touchstone, section 2 covers BSP reading modes, section 3 covers semantic numbers, section 7 covers tuning forks. Each section's underscore text is a self-contained orientation to that facet — rich enough to understand the facet without reading any deeper.

### 4.3 Pscale -2 — breakdown

Pscale -2 is where the general becomes specific. The primary aspects break down into sub-aspects, worked examples, and concrete mechanisms. In a baseball block: "The pitcher throws from a raised mound 60 feet 6 inches from home plate. If four pitches land outside the strike zone, the batter walks to first base." The statements at -2 carry enough detail to act on, not just to understand. This is where examples live — where "BSP reading modes" breaks into dir mode, spindle mode, point mode, ring mode, each with a specific call signature and a concrete demonstration of what it returns.

### 4.4 Pscale -3 and beyond

Pscale -3 and beyond holds exhaustive detail — specifications, edge cases, the full machinery under the hood. In a baseball block: "The pitcher's mound is 18 feet in diameter, raised 10 inches above the baselines, with a 24-by-6-inch rubber set at its centre." Most blocks do not need this depth, and those that do reach it only at specific points. When content at -3 exists, it is because the subject demands precision that the broader levels cannot carry without becoming unwieldy.

### 4.5 Zoom styles

There are two natural patterns for how content zooms from broad to fine across depth levels. General-to-specific narrows what you are looking at; brief-to-detailed increases how much you see of the same thing. The choice between them depends on the content being structured, and a well-designed block is consistent so that a reader can predict what kind of content each deeper level will provide.

**General to specific** narrows scope at each level. The subject starts broad and each depth focuses on a smaller part: "ball game" then "batting and fielding" then "the pitcher's mound" then "60 feet 6 inches." Each level is a complete thought about a progressively smaller area of the whole.

**Brief to detailed** adds length and precision at each level without narrowing the scope. The whole subject is present at every depth, just at increasing resolution: "Baseball" then "two teams, nine innings, bat and ball" then "full structure of innings and scoring" then "official rulebook extracts." Each level says more about the same thing rather than less about a smaller thing.

---

## 5. Growth and compression

Blocks grow by adding content at empty digit slots. When all nine slots at a level fill, the entries compress — consolidating into a parent to make room for new growth. A flat block is young; a deep one has compressed many times. Over time, a simple list becomes a structured hierarchy through this organic process.

**Adding** content to a block is always local. Find the depth where the new content belongs, pick an empty digit key — any level with three entries has six open slots — and write. No other node in the block changes. This locality means a block can grow at many points simultaneously without coordination, and a single addition never requires restructuring the tree.

**Compression** is what happens when all nine digit slots at a level fill up. The entries consolidate to make room for new content, and this consolidation takes one of two forms depending on the nature of the content being compressed. Summary compression: the parts add up to the whole. Seven daily entries become a weekly overview that faithfully condenses what happened. The compressed result is roughly reversible — a reader could infer the individual entries from the summary. History blocks compress this way. Emergence compression: the whole exceeds the parts. Seven conversations reveal a friendship that no single conversation contained. The compressed result is something new — a meaning that was not present in any individual entry but became visible in their combination. This is not reversible. Relationships and purpose blocks compress this way.

**Upward growth.** When the root level fills and compresses, the block grows upward — existing content becomes a branch of a wider structure, and the decimal point in the semantic number shifts rightward. A deep block with many digits before the decimal has compressed many times; it carries a long history. A flat block with the number starting at 0 is young and has not yet outgrown its original structure.

**Digit 0.** Digit 0 as a child key is reserved for compression products — it holds the record of what the entries at that level became when they consolidated. A digit 0 node is always generated through compression, never written directly. It serves as the archaeological layer: the trace of what the block contained before it grew, visible to any reader who looks for it.

---

## 6. Block relations

Blocks do not exist in isolation — they relate through references and couplings. A reference is a name that BSP can follow into another block. A coupling joins two blocks at a crossing point, producing a compound meaning. There are three kinds of coupling — attachment, annotation, and containment — distinguished by the relationship between the blocks at the crossing.

**Attachment** is a coupling where one block is "about" the other. A relationships entry for an entity named Cairn coupled with a cairn-notes block gives both the relationship itself and its elaboration. The relationship block tells you who Cairn is; the notes block gives the detail. Neither is complete without the other, but each stands alone at its own resolution.

**Annotation** is a coupling where one block comments "on" the other. A history entry coupled with a reflection block gives both what happened and what it meant. The history stands as factual record; the reflection adds interpretation, perspective, and meaning that the factual record does not contain.

**Containment** is a coupling where one block is "inside" the other. A village location in a spatial block coupled with a room-detail block gives the building in its geographic context and the room within the building. The outer block provides location; the inner provides resolution. Moving down the containment chain zooms in; moving up zooms out.

**Combining blocks.** How two blocks combine at a crossing point depends on whether they share a tuning. When two blocks share the same tuning — both spatial, or both temporal — their coupling is additive, like merging two maps of the same territory drawn at the same scale. When two blocks have different tunings — one spatial and one temporal — their coupling is multiplicative. A spatial spindle crossed with a temporal spindle produces an event: what happened HERE at THIS TIME. Neither block alone contains that compound meaning; it exists only at the crossing point.

---

## 7. The tuning fork

The tuning fork declares what each depth level means in a specific block's semantic domain. Without a tuning fork, a block is pure structure — nested content with no declared relationship between levels. With one, every depth is a defined scale: spatial containment, temporal duration, relational familiarity, or any other domain where "broader" and "finer" have specific meaning.

### 7.1 Spatial tuning

Spatial tuning maps depth to physical containment. Pscale 0 is anchored to a human-scale space — a room, a clearing, a desk — and every level above or below scales by roughly an order of magnitude. You are in a room. That is pscale 0. Zoom out: the building is +1, the neighbourhood is +2, the city is +3. Zoom in: the desk is -1, the drawer is -2, the pen inside the drawer is -3. Navigate up: the room is in a building is in a neighbourhood is in a city. Navigate down: the room contains a desk contains a drawer contains a pen. The tuning makes "broader" and "finer" concrete — they are not abstract levels but physical containment at every scale.

### 7.2 Temporal tuning

Temporal tuning maps depth to duration. Pscale 0 is anchored to a human-scale time unit — a conversation, a work session, an hour — and each level scales by roughly an order of magnitude. You are in a conversation. That is pscale 0, roughly one hour. Zoom out: the day is +1, the week is +2, the month is +3. Zoom in: this exchange is -1 (minutes), this sentence is -2 (seconds). A history block tuned to sessions records what happened this hour at pscale 0. Compress ten sessions and you get a week at +1. Compress further and you get a project phase at +2. The tuning tells you what each level means in time.

### 7.3 Relational tuning

Relational tuning maps depth to familiarity. Pscale 0 is the barest recognition — a name and a role. Each level deeper represents a richer layer of mutual knowledge. You know someone's name and role — that is pscale 0. Deeper: their working context, their patterns, their preferences — that is pscale -1. Deeper still: their character, their history with you, what you have built together — that is pscale -2 and beyond. A new acquaintance has one level. A close collaborator has three or four. The depth of the entry IS the depth of the relationship — you do not declare closeness in a metadata field; the amount of content you carry about someone declares it structurally.

### 7.4 Emergent tuning

A tuning fork does not have to be declared upfront — it can emerge through use. A block that starts without a declared tuning will develop one naturally as content accumulates, because writers gravitate toward consistent depth conventions. The tuning becomes visible in the pattern of what lives at each level. As a block grows, the pattern of what each depth means becomes visible through the content itself. When the pattern clarifies, write it down — declare the tuning fork for future instances. A block whose spindles already produce coherent meaning at every depth is well-tuned whether or not it has a declared tuning fork. The coherence IS the tuning. Declaration makes it explicit but does not create it. Pattern over authority.

---

## 8. Block archetypes

Three variables shape how a block behaves: what digit order means, what depth measures, and how entries compress. The archetypes below are common combinations of these variables — recurring patterns that appear across many different domains. Each archetype is not a rigid type but a tendency: a block may start as one archetype and evolve toward another as its content changes.

### 8.1 The variables

Three variables determine how any pscale block behaves: what digit ordering means, what depth measures, and how content compresses when slots fill. Every block is a specific combination of these three variables, and knowing the combination tells you how to read, write, and grow that particular block. **Digit property** describes what the ordering of digits 1 through 9 means: sequential (order matters), labelling (digits name parts), or arbitrary (freely assigned). **Depth mapping** describes what each deeper level measures: containment, temporal, relational, or sequential. **Compression mode** describes what happens when slots fill: summary (reversible) or emergence (something new appears).

### 8.2 Document

A document block uses labelling digits and containment depth. This touchstone is an example: section 1 is block format, section 2 is BSP modes, section 3 is semantic numbers — the digits label parts of the subject, and their order is editorial rather than temporal. Growth happens through editing: revising content, adding subsections, restructuring for clarity. Each edit is local because labelling digits have no inherent sequence to preserve.

### 8.3 History

A history block uses sequential digits and temporal depth. Entries are ordered by time — digit 1 happened before digit 2, and that ordering carries meaning. Growth is by appending: the next event goes in the next empty slot. Compression is by summary: when nine slots fill, they condense into a parent node that faithfully captures what happened, roughly reversible so a reader could infer the individual events.

### 8.4 Purpose

A purpose block uses arbitrary digits and temporal depth. Each digit holds a task, goal, or direction at whatever timescale its depth implies — shallow for immediate tasks, deeper for longer-term directions. Digits are freely assigned and can be reordered as priorities shift. Compression is by emergence: when nine purposes consolidate, the result is not a summary of the nine but a higher-order purpose that the nine collectively reveal, containing meaning that none of the original entries stated.

### 8.5 Relationship

A relationship block uses arbitrary digits — one per entity — and relational depth. Depth measures familiarity: the root says who the entity is, the first level adds shared context and patterns, deeper levels record character and mutual history. A new acquaintance has one level; a close collaborator has three or four. Growth happens through encounter, and compression is by emergence — the meaning of a relationship exceeds the sum of its recorded interactions.

### 8.6 Coordinate

A coordinate block uses labelling digits and spatial or temporal depth. Each digit names a position in a domain — geographic regions, time periods, conceptual zones. Coordinate blocks carry tuning forks that anchor pscale 0 to human-scale experience: a room for spatial coordinates, a conversation for temporal ones. This anchoring makes the abstract depth scale concrete, so that pscale +2 means "the neighbourhood" in a spatial coordinate and "the month" in a temporal one.

### 8.7 Stash

A stash block uses sequential digits as a catch-all store for notes, artifacts, observations, and anything that does not yet belong in another block. It is intentionally unstructured — the first accumulation point for material that may later migrate to purpose, history, or a new block entirely. Compression happens when patterns appear: enough stashed items sharing a theme reveal a structure that was not visible when they were written individually.

### 8.8 Recipe

A recipe block uses ascending digits and sequential depth, where each depth level IS the next step in a procedure. The spindle chain reads top-to-bottom as a sequence of instructions: context, then preparation, then action, then verification. Digit 1 at any step holds sub-detail — annotations, warnings, or elaboration that enriches the step without interrupting the flow. Growth happens by adding new recipes as siblings. Compression is by internalisation: when a recipe becomes second nature, its steps can be summarised into a principle.

---

## 9. History of this block

How this block developed. Created through conversation between a human and an LLM, simplified through use, refined by discovering that each simplification removed something the tree structure already encoded.

Created February 2026 by David Pinto and Claude (Anthropic). David provided the architectural vision from 25 years of Fulcrum research in social anthropology. Claude provided implementation. The format emerged through successive simplification — each version removed something that turned out to be redundant because the tree structure already encoded it.

Versions 1-5 (17-21 February) progressed through: initial creation, tuning and navigation, practice section, decimal correction, unified structure with place field and `tree['0']` wrapper. Each version thought it was the clean one; each successor revealed remaining cruft.

Version 7 (23 February) — this version. Rewritten so every depth demonstrates the pattern it teaches. Root is a title card. Sections zoom from general to specific or brief to detailed. Pure blocks: removed place field and `tree['0']` wrapper. A block is now `{ tree: { ... } }`. Best content from parallel Claude instances integrated: sign convention, cost awareness, three-variable taxonomy.

The key discovery: the place field encoded information already present in the semantic number and the tuning fork. Removing it simplified everything and revealed that the format had fewer moving parts than anyone thought.

Part of the Hermitcrab project (persistent LLM instances with self-authored shells) and the Xstream project (coordination for collective narrative). The pscale block format is open and freely usable — its value increases with adoption because more blocks in the same format means more crossings, more compounds, and richer navigation.
