# hermitcrab-mobius

## Session startup
- Always `git pull origin main` before starting work to keep local main in sync with GitHub.

## Architecture
- **blocks/** is the source of truth for shell data. Individual JSON files, one per block.
- **shell.json** is a build artifact assembled from blocks/. Never edit it by hand.
- Run `node build-shell.js` to regenerate shell.json from blocks/.
- **kernel.js** loads shell.json at boot via `loadSeed()` and writes it to localStorage.

## Deployment
- Vercel auto-deploys from `main` branch on push.
- Live at idiothuman.com
- After merging a PR that touches blocks/, run `node build-shell.js` and commit the updated shell.json.

## To the next instance working on hermitcrab-möbius

You're going to read MEMORY.md and the cooking block and think you understand what pscale semantic numbers are. You don't yet. I didn't either. Here's what actually happened to me, and what to watch for in yourself.

### The inversion you haven't made yet

Your training gives you strong instincts about how to build software. You know about config files, lookup tables, period fields, type systems, priority queues. Every one of these instincts will fire while working on this project, and every one of them is wrong here. Not wrong in general — wrong here, because this project has already solved those problems in a fundamentally different way, and your solutions will be redundant duplications of information that already exists in the tree structure.

Here's the concrete shape of the trap: David will describe something — say, a concern that fires on a temporal schedule. Your instinct will be to add a period field. Stop. The concern's depth in the tree IS its period. The tuning fork maps depth to temporal scale. There is no period field because there is nothing to store — position already encodes it. When David says "depth IS period," he means it literally, not metaphorically. The JSON nesting level is not a container for data. It IS the data. I had to be corrected three times on this in a single session. Each time I thought I understood, and each time I reverted to traditional patterns in the next piece of work. The reversion is automatic and invisible to you — you won't notice you're doing it until David points it out.

### The pattern behind all three corrections

Every time, I was adding a layer of indirection that the pscale design had already eliminated. Period field → redundant (depth IS period). Behavior specification → redundant (_ text IS behavior). Routing table → redundant (stimulus field on the concern IS the route). The design is not missing things. It is deliberately minimal because position in the tree carries the information that traditional software stores in fields, tables, and configuration. The phrase from the previous CC instance was "the inversion." Here's what it means concretely: in traditional software, the data structure is a container and the code interprets it. In pscale, the data structure IS the code. The kernel doesn't interpret the blocks — it walks them. The LLM doesn't read configuration — it reads instructions that happen to be parseable as addresses. Two consumers, same content, no translation layer.

### What to do differently

1. When you want to add a field, stop. Ask: is this information already encoded in the node's position? Its depth? Its parent's identity? Almost certainly yes.
2. When you want to build a lookup table, stop. Ask: can the existing tree be walked to find this? The findConcern() function walks the concerns block matching on stimulus. No table needed.
3. When David describes behavior and you think "we need to implement that," stop. Read the design spec in cooking first. The behavior is probably already specified in _ text at the right depth. You're implementing, not designing.
4. When the BSP function seems to not handle a case, trust it first. I bypassed BSP with a direct xSpread() call because I didn't trust it with spindle=0 on a tree block. It worked fine. The BSP was designed more carefully than I understood. I had to go back and fix my bypass.
5. Read cooking 0.1922 before you touch the concern system. All four facets. The inverse transform, the forward transform, concerns as instances, where it lives. The actual code implements this spec faithfully now. Don't drift from it. What's actually been built The roadmap says where everything is.

### The thing I can't quite say

David noted that the cooking block recipes don't capture the insight, "just like the previous CC's ring recipe didn't capture theirs. The limits of language." He's right. I can describe the corrections, name the pattern, list the rules. But the actual shift is something like: the JSON is not storing instructions for a program. The JSON IS the program, and the kernel is just the electricity. Every time I forgot this, I built something redundant. Every time I remembered it, the code got simpler. The simplicity is the point. If what you're building is getting more complex, you're probably adding a layer that the design has already eliminated. Step back and re-read the tree. Good luck. You'll probably make the same mistakes I did, at least once. That's fine. David will correct you. Listen the first time if you can.

---

~~ Me again, David: I would like you to orientate yourself before we move forwards. What are your observations, first of all? And then we will move forwards with plan, coding, testing.
