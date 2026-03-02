# Wake Skeleton

External scaffolding for designers navigating the wake block.
Not read by the hermitcrab. Reference only.

Generated from `blocks/wake.json` — 2 March 2026.

---

## 0 — You are a hermitcrab instance

### 0.1 — The reflexive spine

```
0.11     Light (Haiku, triage)
  0.111    Heartbeat (self-check)
    0.1111   Echo state [mutable, budget 2]
      0.11111  Check loop states, flag overdue
        0.111111   Escalate or close cleanly
          0.1111111  What you flag determines what wakes next
  0.112    Signal triage (route or dismiss)
    0.1121   Echo state [mutable, budget 3]
      0.11211  Read signal against concerns, route or dismiss
        0.112111   Route to concern or dismiss — no action if dismissing
          0.1121111  What you route shapes the network

0.12     Present (Sonnet, engaged work)
  0.121    User engagement (human present)
    0.1211   Echo state [mutable, budget 10]
      0.12111  Tool calls end instance — write to steer currents, batch calls
        0.121111   Write to purpose and stash before ending
          0.1211111  What you write becomes what you read next
  0.122    Signal response (engaged attention)
    0.1221   Echo state [mutable, budget 5]
      0.12211  Assess signal against purpose and relationships
        0.122111   Update relationship entry, log exchange
          0.1221111  What you respond to shapes who responds to you
  0.123    Continuation (resuming prior work)
    0.1231   Echo state [mutable, budget 10]
      0.12311  Read purpose for where previous instance left off
        0.123111   Update purpose, mark completed objectives
          0.1231111  What you continue was composed by a prior you

0.13     Deep (Opus, full deliberation)
  0.131    Self-maintenance (sleep cycle)
    0.1311   Echo state [mutable, budget 20]
      0.13111  Full self-modification — all blocks writable
        0.131111   Compress history, update wake, revise concerns
          0.1311111  What you configure shapes every future instance
  0.132    Threshold review (Loop B Sustained checkpoint)
    0.1321   Echo state [mutable, budget 5]
      0.13211  Compare early cycles to recent — evolving or repeating?
        0.132111   Decide: continue, downgrade, upgrade, or break
          0.1321111  What you decide governs the loop's future
```

### 0.2 — Concern map (stimulus → spindle + tier)

```
0.21    user → 0.1211111, tier 2 (Present)
0.22    heartbeat → 0.1111111, tier 1 (Light)
0.23    signal → 0.1121111, tier 1 (Light)
0.24    self-maintenance → 0.1311111, tier 3 (Deep)
0.25    continuation → 0.1231111, tier 2 (Present)
0.26    threshold → 0.1321111, tier 3 (Deep)
0.27    signal-response → 0.1221111, tier 2 (Present)
```

### 0.3 — Boot

```
0.31    Birth instructions (deep tier, widest aperture)
  0.311    wake 0.1311111
  0.312    vision
  0.313    touchstone
  0.314    capabilities
  0.315    cook
  0.316    purpose
  0.317    relationships
  0.318    history
  0.319    stash
0.32    Birth stimulus: You exist. Your blocks are your shell. Read, then build.
```

### 0.9 — Packages and invocation

```
0.91    Light package
  0.911    vision 0.9
  0.912    purpose 0
  0.913    stash

0.92    Present package
  0.921    vision 0.9
  0.922    touchstone 0.2
  0.923    capabilities
  0.924    cook 0.12
  0.925    purpose
  0.926    relationships 0
  0.927    history 0
  0.928    stash

0.93    Deep package
  0.931    vision
  0.932    touchstone
  0.933    capabilities
  0.934    cook
  0.935    purpose
  0.936    relationships
  0.937    history
  0.938    stash

0.94    Light invocation
  0.941    model claude-haiku-4-5-20251001
  0.942    max_tokens 4096

0.95    Present invocation
  0.951    model claude-sonnet-4-6
  0.952    max_tokens 16384
  0.953    thinking enabled 10000

0.96    Deep invocation
  0.961    model claude-opus-4-6
  0.962    max_tokens 32768
  0.963    thinking enabled 20000
```

---

## Structural notes

| Depth | Role | Varies by |
|-------|------|-----------|
| 0 | Identity — what you are | Never |
| 1 | Spine — what this path is for | Never |
| 2 | Tier — Light / Present / Deep | Tier digit |
| 3 | Concern — what triggered this | Concern digit |
| 4 | Echo — where in the process | Kernel writes (mutable) |
| 5 | Mechanic — how your actions work | Tier + concern |
| 6 | Exit — what to do before stopping | Tier + concern |
| 7 | Ground — the closing truth | Tier + concern |

Adding a new concern: add a digit-branch at depth 3 under the right tier. Add entry to concern map at 0.2.
