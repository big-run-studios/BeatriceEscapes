export interface NarrativeEntry {
  id: string;
  title: string;
  subtitle?: string;
  body: string;
  unlocked: boolean;
}

export interface NarrativeCategory {
  id: string;
  label: string;
  entries: NarrativeEntry[];
}

// ════════════════════════════════════════════════════════════════
//  RUN OUTLINES — 10 runs, bullet-point game format
// ════════════════════════════════════════════════════════════════

export const RUN_OUTLINES: NarrativeCategory = {
  id: "run-outlines",
  label: "Run Outlines",
  entries: [
    {
      id: "run-1", title: "Run 1 — The Birthday", unlocked: true,
      body:
`HUB BEFORE:
- Party just ended. Cake frosting on the ceiling. Frog where the mailbox used to be.
- Andrew: "OK, nobody panic." Heather: "Too late."
- Bea is confused, not scared. She thinks the fireball was cool.
- Family grabs supplies from the house: backpack, snacks, John's slingshot, Luna's leash (she won't wear it)
- Starting Boon: Merlin appears briefly at the back door. "Take this, child. You'll need it." Offers one boon.

ZONE 1 — THE BURBS:
- First MaRC sirens. Family scrambles through backyards and playgrounds.
- Neighbors peeking through blinds. Mrs. Henderson's frog-mailbox is ribbiting.
- Mini-boss: Neighborhood Watch Captain with a megaphone. "STAY WHERE YOU ARE, CITIZENS."
- Boss: Field Commander in an armored SUV. First real fight.
- Boss reveals: MaRC knows about Bea specifically. They have a file on her.

ZONE 2 — DOYLESTOWN:
- [Most players die at Zone 1 or 2 boss on Run 1]
- Small-town charm. Mercer Museum in the background. Farmers market stalls as cover.
- Boss: Checkpoint Commander blocks the road out of town.
- Boss reveals: MaRC has been watching the Bell family for years.

ZONE 3 — PHILADELPHIA:
- [If reached] City streets, warehouse district, PHL airport.
- ONE-TIME STORY BEAT: Family tries to board a plane. MaRC agents everywhere. Arrested at the gate.
- Transported by MaRC boat to the Bermuda Triangle.
- Boss: Pursuit Specialist in a capture mech. "You have no idea where you're going."

ZONE 4 — BERMUDA TRIANGLE:
- First glimpse of the island. Volcanic rock, lab buildings, containment fences.
- Director captures the family. "Welcome to the Triangle. Nobody leaves the Triangle."
- Player doesn't win this fight. Director is too strong.

DEATH/CAPTURE:
- World blinks. Back at the party. Party is over. No MaRC yet.
- Bea: "Again!"

HUB AFTER:
- Family remembers everything. "That really happened, didn't it?"
- Unlock: Kitchen upgrades available`,
    },
    {
      id: "run-2", title: "Run 2 — We Remember", unlocked: true,
      body:
`HUB BEFORE:
- Family is shaken but determined. Andrew checks every lock in the house.
- Heather packs a real go-bag this time. John modifies his slingshot with parts from the garage.
- Bea: "Can we do the thing where I blow up the cake again?" Andrew: "Please don't."

ZONE 1 — THE BURBS:
- Faster, smoother. They know which yards to cut through.
- Boss: Field Commander is confused. "Didn't we already—? How are you—?"
- Boss reveals: MaRC agents don't remember the reset. Only the Bells do.

ZONE 2 — DOYLESTOWN:
- Bookshop wizard catches Andrew's eye. Winks. First sign of the wizard community.
- New boon source appears: Circe. "My, what a talented little girl."
- Boss: Checkpoint Commander. Reveals MaRC has anti-magic dampener technology.
- Family gets a car at the edge of town. (Whose car? Don't ask.)

ZONE 3 — PHILADELPHIA:
- Family avoids the airport this time. Takes the back roads.
- Wizard portal to the Triangle (Merlin's doing). "A shortcut. Mind the turbulence."

ZONE 4 — BERMUDA TRIANGLE:
- Try to escape the island perimeter. Learn the layout. Guard patrol routes.
- Director: "Back already? Interesting. Most don't get a second chance."

HUB AFTER:
- Merlin visits the house. First wizard at the hub. "You're repeating, aren't you? Interesting."
- Unlock: Andrew's Man Cave
  - Reveal: His "sports memorabilia" are enchanted artifacts. Runed weights. Trophy wards.
  - Heather: "Andrew. What. Is. All. This."
  - Andrew: "...I can explain."`,
    },
    {
      id: "run-3", title: "Run 3 — Getting Stronger", unlocked: true,
      body:
`HUB BEFORE:
- Andrew's Man Cave is open. Family processes that Dad had magic secrets.
- Andrew: "I found this stuff in my dad's storage unit. I didn't know what it was. Then I did. And I didn't know how to tell you."
- New wizard visitors during runs: Baba Yaga, Anansi
- Baba Yaga tests the family: "You think you're ready? You're not. But you're entertaining."

ZONE 1-3: Family is noticeably stronger. Combos feel better. More boons available.

ZONE 4 — BERMUDA TRIANGLE:
- Push deeper than before. Discover the containment wing exists.
- See cell doors for the first time. Something is locked behind them.
- Director: "You're getting further than you should. I'll have to fix that."

HUB AFTER:
- Unlock: John's Bedroom/Workshop
  - Reveal: "Science fair projects" are enchanted gadgets. Rune-etched circuits.
  - John: "I thought it was just... really good engineering?"
- Unlock: Heather's Crafting Room
  - Reveal: Scrapbooking supplies are spellcraft materials. Sewing machine stitches wards. "Essential oils" are potions.
  - Andrew: "Wait. YOUR room has magic stuff too??"
  - Heather: "We really need to talk."`,
    },
    {
      id: "run-4", title: "Run 4 — Everyone Knew", unlocked: true,
      body:
`HUB BEFORE:
- Both parents' secrets are out. Family processes it together.
- John: "My stuff does weird things too. I thought it was science."
- Andrew: "Buddy, your flashlight fires stun beams. That's not science."
- More wizards visit: Hecate, Morgan le Fay
- Morgan le Fay is protective of Bea: "This child's power is extraordinary. And MaRC knows it."

ZONE 4 — BERMUDA TRIANGLE:
- Find evidence of missing wizards. Names scratched into cell doors.
- Names the wizard visitors recognize. This is personal now.
- Director: "Curious. Scared. Determined. I've seen this pattern before. It always ends the same."

HUB AFTER:
- Unlock: Bea's Bedroom
  - Reveal: Walls covered in crayon drawings that glow in the dark. Stuffed animals that move when no one's looking.
  - She knew all along. She's six but she's not confused.
  - Bea: "The bear told me not to tell anyone. He said it wasn't time yet."
  - Andrew: "...the bear?"
  - [Stuffed bear waves]`,
    },
    {
      id: "run-5", title: "Run 5 — The Midpoint", unlocked: true,
      body:
`HUB BEFORE:
- All character rooms unlocked. Big family confrontation in the kitchen.
- "We were ALL hiding this from each other?"
- "For how long?" "...Years."
- Family bonds deepen. No more secrets. They train together now.
- Unlock: Luna's Doghouse (backyard)
  - Reveal: Ley line patrol routes scratched into the floor of the doghouse. Ancient artifacts disguised as chew toys.
  - Luna has been guarding the family from magical threats every night.
  - Heather: "She's been protecting us this whole time?"
  - [Luna wags tail, drops a glowing tennis ball]

ZONE 4 — BERMUDA TRIANGLE:
- Stop trying to escape the island. Go deeper intentionally.
- Discover MaRC is harvesting wizard magic to power something massive.
- Containment pods. Hundreds of them. Wizards drained and unconscious.
- Director: "You're going DEEPER? You have no idea what's down there."
- Director, mid-fight: "This facility keeps the world SAFE. You don't understand."

HUB AFTER:
- Wizard council at the house. All 10 wizards present for the first time.
- "We've all lost someone to that place."
- Merlin: "The island has been operating for decades. It must be stopped."
- Flamel: "I escaped that island once. It cost me... everything."`,
    },
    {
      id: "run-6", title: "Run 6 — Going Deeper", unlocked: true,
      body:
`HUB BEFORE:
- Wizards help plan. A map of the island takes shape on the kitchen table.
- Family trains together in the backyard. House upgrades intensifying.
- John builds a scanner from parts and magic. It can detect containment pods.
- Prospero: "The storms around the island are artificial. I can weaken them."

ZONE 4 — BERMUDA TRIANGLE:
- Deeper levels. Labs where magic is extracted. Machinery humming with stolen power.
- See wizard children in pods. Bea's age. This is personal for Bea now.
- Director: "You keep coming back. Why? What do you think you'll find?"
- Director, defeat: "You found Level 6. There are 12 levels."

HUB AFTER:
- Nicolas Flamel arrives at the house. Last wizard to appear.
- "I was held on that island for thirty years. I transmuted my way out. But the others... the others are still there."
- Family resolves: this isn't about escaping anymore.`,
    },
    {
      id: "run-7", title: "Run 7 — The Prisoners", unlocked: true,
      body:
`HUB BEFORE:
- Names from the cell doors. The wizard visitors recognize them.
- Hecate: "That's my sister. She disappeared forty years ago. I thought she was dead."
- Morgan le Fay: "My apprentice. She was 14."
- Circe: "My daughter."
- The stakes are fully personal for everyone now.

ZONE 4 — BERMUDA TRIANGLE:
- Find the first prisoners. Conscious but weak. Can't free them yet — machines too strong.
- Prisoner: "You're the Bell family? The little girl who resets? We've heard your name in the walls."
- Director: "Those machines keep the world stable. Shut them down and you'll destroy everything."
- Is he lying? Maybe. Maybe not. The family doesn't care.

HUB AFTER:
- Family resolves: we go back. Not to escape. To free everyone.
- Andrew: "We're going to need a bigger plan."
- Heather: "We're going to need ALL of our powers. Together."`,
    },
    {
      id: "run-8", title: "Run 8 — No More Running", unlocked: true,
      body:
`HUB BEFORE:
- Andrew: "We're not running anymore. We're going back for them."
- Heather: "All of them."
- Family at near-peak power. Full wizard support. House fully upgraded.
- Every wizard contributes something to the plan.
- John Dee: "I've calculated the resonance frequency of the containment pods. Bea's magic can disrupt it."

ZONE 4 — BERMUDA TRIANGLE:
- Reach the machine core for the first time. Level 10 of 12.
- See the scale. Hundreds of containment pods. A cathedral of stolen magic.
- The machines pulse with violet light. The same color as Bea's fireball.
- Director: "Every wizard on this island powers the dampener grid for the entire eastern seaboard. Free them and magic runs wild. Chaos. Destruction. Is that what you want?"

HUB AFTER:
- Family debates. Is the Director right? Would freeing everyone cause chaos?
- Merlin: "Magic isn't chaos. MaRC is chaos. Magic is life."
- Final preparations begin.`,
    },
    {
      id: "run-9", title: "Run 9 — The Plan", unlocked: true,
      body:
`HUB BEFORE:
- Full strategy session in the kitchen. Every wizard contributes.
- Map of all 12 levels spread across the table.
- Anansi: "I know a way past the guard rotations on Level 11."
- Medea: "I can brew a compound that neutralizes the dampener fluid in the pods."
- Baba Yaga: "I'll handle Level 12's security. Don't ask how."
- Andrew: "When we shut down the machines, every agent on that island will come for us."
- Heather: "Good."
- John builds the Disruptor: a device tuned to Bea's magical frequency.

ZONE 4 — BERMUDA TRIANGLE:
- Sabotage key systems. Disable guard barracks. Free some prisoners on the outer levels.
- Freed wizards join the fight. Temporary allies in combat.
- Director: "You're dismantling everything. Do you know how long it took to build this?"
- Director, defeat: "Tomorrow I'll have twice the guards. It won't matter. You can't reach Level 12."

HUB AFTER:
- Bea is quiet all evening. Sits on the back porch.
- Andrew sits next to her. Doesn't say anything. Just sits.
- Bea: "I started this. I'm going to finish it."
- Andrew: "We're going to finish it. Together."`,
    },
    {
      id: "run-10", title: "Run 10 — Never Again", unlocked: true,
      body:
`HUB BEFORE:
- Everyone present. All wizards. Full family. Luna has her game face on.
- Final moment at the kitchen table.
- Bea: "Last time. For real this time."
- Heather: "For real."
- John activates the Disruptor. It hums with Bea's frequency.
- Family walks out the back door together. All of them. Even the stuffed bear.

ZONE 1-3: The family is at peak power. The zones feel different. They're not running — they're marching.
- Bosses are terrified. Field Commander: "They're not running this time. They're not RUNNING."

ZONE 4 — BERMUDA TRIANGLE:
- Deepest level. Level 12. The core.
- Every captured wizard. Hundreds of pods. The heart of MaRC's power.
- Director's final form. He's connected to the machines now. Drawing power from the prisoners.
- Multi-phase fight. Family + wizard allies vs. the entire island.
- Phase 3: Director at full power. "I AM the dampener grid. You can't stop this without stopping ME."
- Bea steps forward. Hands glowing. The violet fire from the birthday party, but controlled now. Focused.
- Bea: "NEVER AGAIN."
- Family combines all powers. Andrew's earth, Heather's amplification, John's tech-magic, Luna's ley-line force, all channeled through Bea.
- Everything goes white.

TRUE ENDING:
- The pods open. Wizards stumble out, blinking, free.
- The machines go dark. The island shudders.
- Director, powerless: "...What have you done?"
- Bea: "What you should have done. I let them go."
- Family stands together. It's over.
- But MaRC is bigger than one island. The world is different now. Magic is out in the open.
- Andrew: "So... what do we do now?"
- Bea: "More."`,
    },
    {
      id: "post-game", title: "Post-Game — Operation Dismantle", unlocked: true,
      body:
`After Run 10, the family is back home. The island is disabled but not destroyed. MaRC has other operations worldwide.

STRUCTURE:
- Strike Missions: Return to the Triangle to do progressively more damage.
- Same 4-zone structure but with harder modifiers, new enemy types, experimental MaRC tech.
- Pact of Punishment equivalent: Heat system. Harder modifiers for better rewards.
- New boss variants: MaRC sends reinforcements, new commanders, prototype weapons.
- Freed wizards come to the house, unlock new boon pools and narrative arcs.
- House expansion: New wings, outdoor areas, basement lab. Deep investment.
- Character mastery: Extended skill trees for each character.
- The endgame goal: Fully destroy the Triangle facility. Takes roughly as long as the main 10-run story.
- Then the REAL true ending: MaRC's Triangle operation is gone for good.
- Tease: There are other islands. Other MaRC facilities. The Bell family's work isn't done.`,
    },
  ],
};

// ════════════════════════════════════════════════════════════════
//  HUB & HOUSE — Rooms, reveals, conversations, upgrades
// ════════════════════════════════════════════════════════════════

export const HUB_SCENES: NarrativeCategory = {
  id: "hub-house",
  label: "Hub & House",
  entries: [
    // ── Starting Rooms ──
    { id: "hub-kitchen", title: "The Kitchen", subtitle: "Starting Room", unlocked: true,
      body: "Central hub. Family gathers here for conversations, strategy, and meals.\n\n- Where runs are debriefed\n- Where the family confronts each other about secrets\n- Where the wizard council eventually meets\n- Upgrade station for house-wide improvements (Mirror of Night equivalent)\n- Always available from Run 1" },
    { id: "hub-living", title: "The Living Room", subtitle: "Starting Room", unlocked: true,
      body: "NPC conversations with visiting wizards/witches. Couch talks, fireplace chats.\n\n- Wizards who visit the house hang out here\n- Relationship conversations happen on the couch\n- Lore and world-building unfolds naturally\n- Always available from Run 1" },
    { id: "hub-backdoor", title: "The Back Door", subtitle: "Starting Room", unlocked: true,
      body: "\"Make a run for it.\" Start the run from here.\n\n- Starting boon offered here (choose 1 of 3)\n- Family lines before departing\n- Equivalent to Hades' courtyard exit\n- Always available from Run 1" },

    // ── Unlockable Rooms ──
    { id: "hub-mancave", title: "Andrew's Man Cave", subtitle: "Unlocks Run 2", unlocked: true,
      body: "REVEAL: Andrew's \"sports memorabilia\" are enchanted artifacts.\n\n- Runed dumbbells that grant supernatural strength\n- Football trophies that are actually protective wards\n- A signed jersey that's a woven spell shield\n- His dad's old toolbox — the tools glow when Andrew holds them\n\nHEATHER: \"Andrew. What. Is. All. This.\"\nANDREW: \"...I found it in my dad's storage unit after he died. I didn't know what it was. Then I did. And I didn't know how to tell you.\"\n\nUPGRADE FOCUS: Andrew's combat stats, tanking ability, new heavy moves, block strength" },
    { id: "hub-crafting", title: "Heather's Crafting Room", subtitle: "Unlocks Run 3", unlocked: true,
      body: "REVEAL: Her \"scrapbooking supplies\" are spellcraft materials.\n\n- Sewing machine that stitches protection wards into clothing\n- \"Essential oils\" that are actually potions\n- Scrapbook pages that are spell scrolls\n- A drawer of crystals labeled \"craft supplies\"\n\nANDREW: \"Wait. YOUR room has magic stuff too??\"\nHEATHER: \"My grandmother taught me. She said to keep it quiet.\"\nANDREW: \"YOUR GRANDMOTHER?\"\n\nUPGRADE FOCUS: Heather's amplification, parry timing, catalyst pulse, buff strength" },
    { id: "hub-workshop", title: "John's Workshop", subtitle: "Unlocks Run 3", unlocked: true,
      body: "REVEAL: His \"science fair projects\" are enchanted gadgets.\n\n- Slingshot with rune-etched bands\n- RC car with impossible speed and turning radius\n- Flashlight modified into a stun beam\n- A notebook full of equations that are actually spell formulas\n\nJOHN: \"I thought it was just really good engineering?\"\nANDREW: \"Son, your flashlight fires stun beams. That's not engineering.\"\nJOHN: \"...is it not?\"\n\nUPGRADE FOCUS: John's gadgets, trap variety, dash abilities, gadget charges" },
    { id: "hub-bea-room", title: "Bea's Bedroom", subtitle: "Unlocks Run 4", unlocked: true,
      body: "REVEAL: She knew all along.\n\n- Crayon drawings on every wall — they glow in the dark, shift when you look away\n- Stuffed animals that move when no one's looking (but they're shy)\n- A mobile above her crib that orbits without any string\n- Tea party set that actually makes tea (enchanted)\n\nBEA: \"The bear told me not to tell anyone. He said it wasn't time yet.\"\nANDREW: \"...the bear?\"\n[Stuffed bear waves]\nHEATHER: \"How long have you known, sweetie?\"\nBEA: \"Always. The magic is everywhere. You just stopped looking.\"\n\nUPGRADE FOCUS: Bea's magic power, projectile damage, MP pool, reset charges" },
    { id: "hub-doghouse", title: "Luna's Doghouse", subtitle: "Unlocks Run 5", unlocked: true,
      body: "REVEAL: Luna's been patrolling ley lines at night.\n\n- Ley line patrol routes scratched into the doghouse floor\n- Chew toys that are actually ancient artifacts\n- A buried collection of magical objects from around the neighborhood\n- Paw prints that glow along the backyard fence line\n\nHEATHER: \"She's been protecting us this whole time?\"\nANDREW: \"Every night. While we slept.\"\n[Luna wags tail, drops a glowing tennis ball at Bea's feet]\nBEA: \"Good girl, Luna. The best girl.\"\n\nUPGRADE FOCUS: Luna's speed, momentum, instinct dodge, ley-line abilities" },

    // ── House Upgrades ──
    { id: "hub-upgrades", title: "House Upgrades", subtitle: "Mirror of Night Equivalent", unlocked: true,
      body: "The house itself is the upgrade station. Invest special run currency to improve ALL characters.\n\nFAMILY SURPRISE — Bonus damage on first hit of each room (5 tiers)\nSNACK STASH — Heal HP after clearing each room (3 tiers)\nBEA'S RESET — Extra revives per run, max 3 (3 tiers, expensive)\nQUICK FEET — Extra dash charges (1 tier)\nBEA'S FOCUS — Bonus projectile/magic damage (5 tiers)\nMAGIC RESERVES — Extra MP capacity (2 tiers)\nPIGGY BANK — Start each run with bonus money (10 tiers)\nFAMILY TOUGHNESS — Increased max HP (10 tiers)\nCOMBO MASTERY — Bonus damage to enemies with status effects (2 tiers)\nWIZARD FAVOR — Better boon rarity chance (40 tiers, very expensive)\nWITCH'S BLESSING — Better upgrade drops (20 tiers)\nSECOND CHANCE — Reroll boon choices (10 tiers)\n\nEach upgrade has an alternate version (like Hades' red/yellow mirror toggle)." },
    { id: "hub-renovation", title: "Home Renovation", subtitle: "Contractor Equivalent", unlocked: true,
      body: "Cosmetic and functional upgrades. Separate currency from Mirror upgrades.\n\n- Room decorations (visual progression, shows your investment)\n- Training dummy in the garage\n- Potion brewing station in the kitchen\n- Map table showing zone info and island layout\n- Wizard guest rooms (makes visitors stay longer, more dialogue)\n- Backyard training area with obstacle course\n- Basement lab (post-game expansion)\n- Attic library (lore unlocks)\n- Front porch hangout area (family moment triggers)" },
  ],
};

// ════════════════════════════════════════════════════════════════
//  BOON GIVERS — 10 Wizards & Witches (1:1 Hades God Mapping)
// ════════════════════════════════════════════════════════════════

export const BOON_GIVERS: NarrativeCategory = {
  id: "boon-givers",
  label: "Wizards & Witches",
  entries: [
    { id: "wiz-merlin", title: "Merlin", subtitle: "Arcane Spark (Zeus)", unlocked: true,
      body: "ARCHETYPE: Chain lightning — attacks chain to nearby enemies\nPERSONALITY: Ancient, cryptic, amused by the family's chaos. Speaks in riddles but genuinely cares.\nFIRST APPEARS: Run 1 (at the back door, first boon giver)\nVISITS HUB: Run 2\n\nBOON OFFERS:\n- \"Ah, the little firestarter's family. Take this — it will make your strikes... contagious.\"\n- \"Electricity is just impatient magic. Let me teach your fists some impatience.\"\n- \"Chain reactions. The universe's favorite joke. You'll love this.\"\n\nPICKUP LINES:\n- \"Delightful. Do try not to set anything important on fire.\"\n- \"That's the spirit. Literally.\"\n\nHUB DIALOGUE:\n- Run 2: \"You're repeating, aren't you? Interesting. I've seen this before. Not often.\"\n- Run 3: \"The child's power is a nexus. Everything flows through her. Including time, apparently.\"\n- Run 5: \"You've stopped running. Good. Running was never going to work.\"\n- Run 8: \"The island's machines are ancient. Older than MaRC. Someone built them. I wonder who.\"\n- Run 10: \"Today you become what you were always meant to be. All of you.\"\n\nLEGENDARY BOON: \"ARCANE TEMPEST\"\n- \"This is my finest work. Every strike calls lightning. Every lightning calls thunder. Every thunder calls... well. You'll see.\"" },

    { id: "wiz-prospero", title: "Prospero", subtitle: "Tempest Force (Poseidon)", unlocked: true,
      body: "ARCHETYPE: Knockback and wave effects\nPERSONALITY: Theatrical, stormy, dramatic. Speaks like Shakespeare (because he inspired Shakespeare). Grand gestures.\nFIRST APPEARS: Run 2\nVISITS HUB: Run 4\n\nBOON OFFERS:\n- \"THE TEMPEST RISES! ...ahem. I mean, would you like some knockback?\"\n- \"Storms don't ask permission. Neither should your attacks.\"\n- \"The sea obeys me. Your enemies will too.\"\n\nPICKUP LINES:\n- \"MAGNIFICENT! The waves crash in your honor!\"\n- \"Now THAT'S a performance.\"\n\nHUB DIALOGUE:\n- Run 4: \"Your living room is... quaint. I've lived on an enchanted island. But this has charm.\"\n- Run 5: \"The storms around the Triangle are artificial. I can feel them. They're WRONG. I can weaken them.\"\n- Run 7: \"Those machines drain the sea's magic too. The tides have been wrong for decades. I thought I was losing my touch.\"\n\nLEGENDARY BOON: \"THE TEMPEST\"\n- \"Full fury. Every hit sends a tidal wave. Every wave sends a message: WE ARE COMING.\"" },

    { id: "wiz-johndee", title: "John Dee", subtitle: "Divination Wards (Athena)", unlocked: true,
      body: "ARCHETYPE: Deflect projectiles, shields, protection\nPERSONALITY: Scholarly, calculating, protective. Speaks precisely. Fascinated by John Bell's gadgets.\nFIRST APPEARS: Run 3\nVISITS HUB: Run 5\n\nBOON OFFERS:\n- \"Protection is mathematics. Let me show you the formula.\"\n- \"Deflection requires anticipation. I've calculated 47 incoming trajectories. You're welcome.\"\n- \"A ward, precisely calibrated. Nothing gets through.\"\n\nPICKUP LINES:\n- \"Excellent application of defensive principles.\"\n- \"The math checks out. You'll be fine.\"\n\nHUB DIALOGUE:\n- Run 5: \"Your son's gadgets are remarkable. He's an enchanter and doesn't know it. The equations in his notebook — those are spell formulas.\"\n- Run 8: \"I've calculated the resonance frequency of the containment pods. Bea's magic can disrupt it. The math is elegant.\"\n\nLEGENDARY BOON: \"SCRYING SHIELD\"\n- \"Total protection. The ward doesn't just block — it shows you the future. For exactly 0.3 seconds. It's enough.\"" },

    { id: "wiz-morgan", title: "Morgan le Fay", subtitle: "Hex Curse (Ares)", unlocked: true,
      body: "ARCHETYPE: Doom/delayed damage, damage over time\nPERSONALITY: Fierce, regal, fiercely protective of magical children. Does NOT suffer fools.\nFIRST APPEARS: Run 3\nVISITS HUB: Run 4\n\nBOON OFFERS:\n- \"They hunt children. MY curse hunts them back.\"\n- \"A hex. Slow-acting. Devastating. Like my patience with MaRC.\"\n- \"This curse will follow them. Into their dreams if necessary.\"\n\nPICKUP LINES:\n- \"Good. Make them regret every child they've taken.\"\n- \"The hex is set. They won't see it coming. That's the point.\"\n\nHUB DIALOGUE:\n- Run 4: \"Bea. Come here, child. Let me see your hands. ...Extraordinary. This power hasn't been seen in centuries.\"\n- Run 7: \"My apprentice is on that island. She was 14 when they took her. She'd be 44 now. If she's still alive.\"\n- Run 9: \"When you reach the core, Bea — don't hold back. Not for their sake. For yours.\"\n\nLEGENDARY BOON: \"QUEEN'S VENGEANCE\"\n- \"My masterwork. Every enemy you mark will fall. Not immediately. But inevitably. Like justice.\"" },

    { id: "wiz-hecate", title: "Hecate", subtitle: "Moon Strike (Artemis)", unlocked: true,
      body: "ARCHETYPE: Critical hits, precision\nPERSONALITY: Mysterious, moonlit, speaks softly but every word matters. Appears at crossroads.\nFIRST APPEARS: Run 4\nVISITS HUB: Run 5\n\nBOON OFFERS:\n- \"The moon sees everything. Your strikes will too.\"\n- \"Precision is kindness. One clean hit instead of ten sloppy ones.\"\n- \"At the crossroads, every path is a blade. Choose well.\"\n\nPICKUP LINES:\n- \"Moonlight guides your hand now.\"\n- \"A perfect strike. The moon approves.\"\n\nHUB DIALOGUE:\n- Run 5: \"My sister disappeared forty years ago. I felt it when her magic went silent. She's on that island.\"\n- Run 7: \"I can feel her now. Faint. But alive. The machines are draining her but they haven't broken her.\"\n- Run 10: \"Tonight the moon is full. It's not a coincidence. The moon knows what you're about to do.\"\n\nLEGENDARY BOON: \"TRIPLE MOONLIGHT\"\n- \"Three moons rise for you tonight. Every critical hit triggers two more. The mathematics of the divine.\"" },

    { id: "wiz-circe", title: "Circe", subtitle: "Transmutation (Aphrodite)", unlocked: true,
      body: "ARCHETYPE: Weaken enemies, reduce their damage, transformation effects\nPERSONALITY: Elegant, sly, transformative. Finds humans fascinating. Amused by Andrew's protectiveness.\nFIRST APPEARS: Run 2\nVISITS HUB: Run 3\n\nBOON OFFERS:\n- \"My, what a talented little girl. Let me make your enemies... less talented.\"\n- \"Transformation is my specialty. Shall we transform their confidence into doubt?\"\n- \"Weakness is contagious. Let me spread it.\"\n\nPICKUP LINES:\n- \"Beautiful. They're already diminished and they don't even know it.\"\n- \"Elegant work. I approve.\"\n\nHUB DIALOGUE:\n- Run 3: \"Your daughter has raw transmutation power. The cake into fire? That's not destruction — that's transformation. She changed its nature.\"\n- Run 5: \"The dampener technology transforms magic into energy. It's MY school of magic, perverted. I take that personally.\"\n- Run 7: \"My daughter is on that island. Circe's daughter. Do you understand what that means? She should have been the most powerful transmuter of her generation.\"\n\nLEGENDARY BOON: \"TRUE TRANSMUTATION\"\n- \"This is the real thing. Your enemies won't just weaken — they'll become something... smaller. Literally.\"" },

    { id: "wiz-medea", title: "Medea", subtitle: "Brew (Dionysus)", unlocked: true,
      body: "ARCHETYPE: Stacking poison/effects on hit\nPERSONALITY: Intense, alchemical, passionate. Brews things constantly. Hands always stained with reagents.\nFIRST APPEARS: Run 4\nVISITS HUB: Run 6\n\nBOON OFFERS:\n- \"A little something I brewed. It stacks. Beautifully.\"\n- \"Poison is such an ugly word. I prefer 'accumulated consequence.'\"\n- \"One drop does nothing. Two drops, a little. Twenty drops? Everything.\"\n\nPICKUP LINES:\n- \"Drink deep. ...Metaphorically. Don't actually drink my potions.\"\n- \"It's working. Can you smell it? That's the smell of stacking damage.\"\n\nHUB DIALOGUE:\n- Run 6: \"I can brew a compound that neutralizes the dampener fluid in the containment pods. I need ingredients from the island.\"\n- Run 8: \"The formula is ready. One application per pod. We'll need gallons of this stuff.\"\n\nLEGENDARY BOON: \"MEDEA'S MASTERWORK\"\n- \"My life's work. Every hit applies every brew I've ever made. Simultaneously. The results are... spectacular.\"" },

    { id: "wiz-anansi", title: "Anansi", subtitle: "Spider Thread (Hermes)", unlocked: true,
      body: "ARCHETYPE: Speed, dodge, evasion\nPERSONALITY: Trickster, storyteller, fast-talking, delighted by cleverness. Tells stories about everything.\nFIRST APPEARS: Run 3\nVISITS HUB: Run 4\n\nBOON OFFERS:\n- \"A story: once there was a family too slow to escape. THE END. Here, take this. Be faster.\"\n- \"The spider doesn't dodge — the spider was never where you thought it was.\"\n- \"Speed is the best story. No one can argue with 'I was already gone.'\"\n\nPICKUP LINES:\n- \"Ha HA! Now THAT'S a twist ending!\"\n- \"Fast enough! ...For now. Come back for the sequel.\"\n\nHUB DIALOGUE:\n- Run 4: \"I love this family. You're the best story I've heard in centuries. A dad, a mom, two kids, a dog, and a birthday cake that broke the world? PERFECT.\"\n- Run 9: \"I know a way past the guard rotations on Level 11. It's a story about distraction. I'll tell you on the way.\"\n\nLEGENDARY BOON: \"TRICKSTER'S TALE\"\n- \"My greatest story. You move so fast reality hasn't noticed you've moved yet. Past tense. Future tense. You're in all of them.\"" },

    { id: "wiz-babayaga", title: "Baba Yaga", subtitle: "Frost Root (Demeter)", unlocked: true,
      body: "ARCHETYPE: Slow and freeze effects\nPERSONALITY: Unpredictable, testing, ancient. Seems hostile but is evaluating. Her house walks on chicken legs.\nFIRST APPEARS: Run 3\nVISITS HUB: Run 5\n\nBOON OFFERS:\n- \"You think you're ready? You're not. But take this anyway. Freeze them.\"\n- \"The cold tests everything. Only the strong stay standing.\"\n- \"Winter doesn't chase. Winter waits. Your enemies will wait too.\"\n\nPICKUP LINES:\n- \"Hmph. Adequate. Barely.\"\n- \"...Fine. You've earned that. Don't let it go to your head.\"\n\nHUB DIALOGUE:\n- Run 5: \"Your kitchen is acceptable. The oven could be better. My oven is better. My oven walks.\"\n- Run 9: \"I'll handle Level 12's security. Don't ask how. Don't ask why. Just be grateful.\"\n- Run 10: \"I've tested many families over the centuries. Most fail. You won't. ...Probably won't.\"\n\nLEGENDARY BOON: \"ETERNAL WINTER\"\n- \"You want my best? Fine. Everything freezes. Everything. The air. The ground. Their hope. All of it.\"" },

    { id: "wiz-flamel", title: "Nicolas Flamel", subtitle: "Transmutation Gamble (Chaos)", unlocked: true,
      body: "ARCHETYPE: Risk/reward — debuff yourself for a few rooms, then gain a powerful bonus\nPERSONALITY: Obsessive alchemist, risk-taker. Has the look of a man who's cheated death (he has). Haunted but determined.\nFIRST APPEARS: Run 5\nVISITS HUB: Run 6\n\nBOON OFFERS:\n- \"Equivalent exchange. You give something up. You get something better. Maybe. Probably. ...Hopefully.\"\n- \"The philosopher's stone didn't make me immortal. It made me willing to gamble. Take this.\"\n- \"Risk everything. Gain everything. That's alchemy.\"\n\nPICKUP LINES:\n- \"Bold choice. I respect bold choices. I've made several. Some of them worked.\"\n- \"The transmutation begins. Endure the cost. The reward is coming.\"\n\nHUB DIALOGUE:\n- Run 6: \"I was held on that island for thirty years. I transmuted my way out. Turned my cell wall into smoke. But the others... the others are still there. I've never forgiven myself for leaving them.\"\n- Run 8: \"The machines use a transmutation principle I invented. Centuries ago. Before MaRC existed. They stole my work.\"\n- Run 10: \"Today we fix my mistake. All of it.\"\n\nLEGENDARY BOON: \"PHILOSOPHER'S GAMBIT\"\n- \"Everything I am. Everything I've learned. Compressed into one blessing. The cost is... significant. The reward is absolute.\"" },
  ],
};

// ════════════════════════════════════════════════════════════════
//  BOSS ENCOUNTERS — Dialogue per boss, run-dependent
// ════════════════════════════════════════════════════════════════

export const BOSS_ENCOUNTERS: NarrativeCategory = {
  id: "boss-encounters",
  label: "Boss Encounters",
  entries: [
    { id: "boss-z1-mini", title: "Mini-Boss: Neighborhood Watch Captain", subtitle: "Zone 1 — The Burbs", unlocked: true,
      body: "Overzealous, megaphone, capture nets, calls backup. Thinks he's a hero.\n\nRUN 1:\n  Pre: \"ATTENTION RESIDENTS. Remain indoors. We have an uncontained magical event. Do NOT approach the family with the glowing child.\"\n  Defeat: \"This is NOT in my training manual!\"\n\nRUN 5:\n  Pre: \"Oh no. Not again. EVERY time with this family—\"\n  Defeat: \"I'm putting in for a transfer.\"\n\nRUN 10:\n  Pre: \"...You know what? I'm just going to step aside.\"\n  Andrew: \"Smart man.\"\n  Pre: \"I didn't see anything. I was on break.\"" },

    { id: "boss-z1-main", title: "Boss: MaRC Field Commander", subtitle: "Zone 1 — The Burbs", unlocked: true,
      body: "Armored SUV, organized squad. Professional, dangerous, underestimates the family.\n\nRUN 1:\n  Pre: \"This is MaRC Field Operations. You have an unregistered magical minor. Surrender the child.\"\n  Andrew: \"Her name is Bea. And no.\"\n  Mid (50%): \"Requesting backup. Target is... more resistant than expected.\"\n  Defeat: \"...How? She's six. How does a six-year-old do THAT?\"\n\nRUN 5:\n  Pre: \"Not you people again. All units, priority target, do NOT let them through.\"\n  Mid: \"They're STRONGER. How are they stronger?!\"\n  Defeat: \"I don't get paid enough for this.\"\n\nRUN 10:\n  Pre: \"I've been reassigned. Three times. Because of you. This ends—\"\n  Andrew: \"No. It doesn't.\"\n  [Family walks through him]\n  Defeat: \"...They didn't even slow down.\"" },

    { id: "boss-z2-mini", title: "Mini-Boss: MaRC Drone Coordinator", subtitle: "Zone 2 — Doylestown", unlocked: true,
      body: "Controls drone swarms from a mobile command unit. Analytical, detached.\n\nRUN 1:\n  Pre: \"Targets acquired. Deploying surveillance net. They won't get past the courthouse.\"\n  Defeat: \"Drone net compromised. ...How did the dog eat a drone?\"\n\nRUN 5:\n  Pre: \"Upgraded swarm deployed. Titanium chassis. Dog-proof.\"\n  Defeat: \"The dog ate the titanium drones. I'm done.\"\n\nRUN 10:\n  Pre: [No dialogue. Just launches every drone at once.]\n  Defeat: \"...I should have been an accountant.\"" },

    { id: "boss-z2-main", title: "Boss: MaRC Checkpoint Commander", subtitle: "Zone 2 — Doylestown", unlocked: true,
      body: "Roadblock at the edge of town. Shield walls, suppression barriers. Bureaucratic but effective.\n\nRUN 1:\n  Pre: \"Citizens, this checkpoint is for your protection.\"\n  Andrew: \"Protection from WHAT?\"\n  Pre: \"From her.\" [points at Bea]\n  Mid (50%): \"All units, requesting immediate backup—\"\n  Defeat: \"You don't understand what she is. None of you do.\"\n\nRUN 5:\n  Pre: \"Enhanced checkpoint. Anti-magic barriers. You're not getting through.\"\n  Defeat: \"The barriers are DOWN. How— She just LOOKED at them.\"\n\nRUN 10:\n  Pre: \"I know I can't stop you. But I have to try. It's my job.\"\n  Defeat: \"...Just go. Take the car. Keys are in the ignition.\"\n  [Maybe he's not all bad?]" },

    { id: "boss-z3-mini", title: "Mini-Boss: MaRC Anti-Magic Technician", subtitle: "Zone 3 — Philadelphia", unlocked: true,
      body: "Deploys dampener fields, EMP-like devices. Lab coat over tactical gear. Scientist, not soldier.\n\nRUN 1:\n  Pre: \"Initiating dampener field. All magical signatures within 50 meters will be neutralized.\"\n  Defeat: \"The field is overloaded! Her output exceeds our models by 400%!\"\n\nRUN 5:\n  Pre: \"Upgraded dampeners. Frequency-adaptive. She can't just overpower these.\"\n  Defeat: \"She didn't overpower them. She... harmonized with them? That's not possible.\"\n\nRUN 10:\n  Pre: \"I designed these dampeners. They're perfect. Theoretically.\"\n  Defeat: \"Theory doesn't account for a six-year-old who rewrites physics.\"" },

    { id: "boss-z3-main", title: "Boss: MaRC Pursuit Specialist", subtitle: "Zone 3 — Philadelphia", unlocked: true,
      body: "Fast, relentless, capture mech suit. Enjoys the hunt. The one who arrested them at PHL.\n\nRUN 1:\n  Pre: \"End of the line, Bells. You're coming with me.\"\n  Defeat (if reached): \"You have no idea where you're going. The Triangle isn't a place you escape FROM.\"\n  [ONE-TIME: Arrested. Taken to Triangle by boat.]\n\nRUN 2+:\n  Pre: \"You found your own way to the Triangle? Impressive. Stupid, but impressive.\"\n  Mid: \"The mech suit adapts to your attacks. Try something new.\"\n  Defeat: \"Fine. Go to the island. See what's really happening there. Maybe then you'll understand.\"\n\nRUN 10:\n  Pre: \"I always liked you Bells. You never give up.\"\n  Mid: \"...I'm not actually trying to stop you this time.\"\n  Defeat: \"Go. Save them. Save all of them. I'll cover your escape.\"" },

    { id: "boss-z4-mini", title: "Mini-Boss: MaRC Island Warden", subtitle: "Zone 4 — Bermuda Triangle", unlocked: true,
      body: "Runs the containment facility. Evolves across runs. Starts bureaucratic, becomes desperate.\n\nRUN 1:\n  Pre: \"New arrivals. Processing. Containment pod assignment: C-7 through C-12.\"\n  Defeat: \"Containment breach in Sector 4. This is unprecedented.\"\n\nRUN 5:\n  Pre: \"You again. Security level raised to maximum. All pods reinforced.\"\n  Defeat: \"They're going DEEPER. Alert the Director.\"\n\nRUN 8:\n  Pre: \"You've seen too much. The Director says to eliminate, not contain.\"\n  Defeat: \"I've run this facility for 20 years. No one has ever reached Level 10.\"\n\nRUN 10:\n  Pre: \"I know what's on Level 12. If you free them... everything changes.\"\n  Defeat: \"...Maybe it should.\"" },

    { id: "boss-z4-main", title: "Boss: The MaRC Director", subtitle: "Zone 4 — Bermuda Triangle", unlocked: true,
      body: "Head of MaRC. The final boss. Multi-phase. Connected to the machines.\n\nRUN 1:\n  Pre: \"Welcome to the Triangle. Nobody leaves the Triangle.\"\n  [Player doesn't win. Director is too strong.]\n  Capture: \"Take them to containment. Standard processing.\"\n\nRUN 3:\n  Pre: \"Back again. You're persistent, I'll give you that.\"\n  Mid: \"You're getting stronger. Interesting. The machine anticipated this.\"\n  Defeat: \"You escaped the perimeter. It doesn't matter. You'll be back.\"\n\nRUN 5:\n  Pre: \"You're back. How... interesting. Most don't come back willingly.\"\n  Mid: \"You're going DEEPER? You have no idea what's down there.\"\n  Defeat: \"This facility keeps the world SAFE. You don't understand.\"\n\nRUN 7:\n  Pre: \"You found the prisoners. Now you understand. This is necessary.\"\n  Mid: \"Every wizard on this island powers the dampener grid for the entire eastern seaboard. Free them and magic runs WILD.\"\n  Defeat: \"You can't free them without destroying everything I've built.\"\n\nRUN 10:\n  Pre: \"You found them. You found all of them. It doesn't matter. The machines are already—\"\n  [Director connects to machines. Draws power from prisoners. Final form.]\n  Phase 2: \"I AM the dampener grid. You can't stop this without stopping ME.\"\n  Phase 3: \"Every. Wizard. On this island. Powers ME now.\"\n  Defeat: Bea steps forward. \"NEVER AGAIN.\"\n  Family combines powers. Everything goes white.\n  Director, powerless: \"...What have you done?\"\n  Bea: \"What you should have done. I let them go.\"" },
  ],
};

// ════════════════════════════════════════════════════════════════
//  IN-RUN QUIPS — Zone intros, between-room, boon reactions, death
// ════════════════════════════════════════════════════════════════

export const IN_RUN_QUIPS: NarrativeCategory = {
  id: "in-run-quips",
  label: "In-Run Dialogue",
  entries: [
    { id: "quip-z1-intros", title: "Zone 1 Intro Quips", subtitle: "The Burbs", unlocked: true,
      body: "- \"Here we go.\"\n- \"The burbs. Again.\"\n- \"I know a shortcut through the Hendersons' yard.\"\n- \"Luna, don't stop at every fire hydrant.\"\n- \"Stay off the playground. MaRC patrols the swings.\"\n- \"Through the dog park. Luna knows the way.\"" },

    { id: "quip-z2-intros", title: "Zone 2 Intro Quips", subtitle: "Doylestown", unlocked: true,
      body: "- \"Small town, big problems.\"\n- \"The Mercer Museum has a secret entrance. Don't ask how I know.\"\n- \"Anyone want a pretzel? No? Just me?\"\n- \"Fonthill Castle. Looks magical. It's not. Ironic.\"\n- \"Central Park. Not the famous one. The Doylestown one.\"\n- \"Stay away from the courthouse. MaRC has an office there.\"" },

    { id: "quip-z3-intros", title: "Zone 3 Intro Quips", subtitle: "Philadelphia", unlocked: true,
      body: "- \"City of brotherly love. And MaRC agents.\"\n- \"I can see the skyline.\"\n- \"Stay off Broad Street.\"\n- \"South Philly. Keep your head down.\"\n- \"The Schuylkill. Smells exactly like you'd expect.\"\n- \"Warehouse district. Watch for ambushes.\"" },

    { id: "quip-z4-intros", title: "Zone 4 Intro Quips", subtitle: "Bermuda Triangle", unlocked: true,
      body: "- \"The island.\"\n- \"I hate boats.\"\n- \"Deeper this time.\"\n- \"We're not leaving until we finish this.\"\n- \"Level [X]. [X] more to go.\"\n- \"The machines are louder down here.\"\n- \"I can feel them. The prisoners. They're still alive.\"" },

    { id: "quip-between", title: "Between-Room Lines", subtitle: "General Pool", unlocked: true,
      body: "- \"Keep moving.\"\n- \"That was close.\"\n- \"Did anyone else see that?\"\n- \"Bea, was that you?\"\n- \"Luna, HEEL.\"\n- \"John, put that down.\"\n- \"We've got this.\"\n- \"Everyone OK?\"\n- \"How many more?\"\n- \"I think they're getting scared of us.\"\n- \"Bea, your hands are glowing again.\" \"I know, Daddy.\"\n- \"Left or right?\" \"Luna went left.\" \"Left it is.\"\n- \"That was actually kind of fun.\" \"Please don't say that.\"" },

    { id: "quip-boon", title: "Boon Reaction Lines", subtitle: "When Picking Up Boons", unlocked: true,
      body: "- \"Whoa, that tingles.\"\n- \"Thanks... whoever you are.\"\n- \"Bea, your hands are glowing again.\"\n- \"Is it supposed to feel spicy?\"\n- \"John: 'I want to study that.' Heather: 'Later.'\"\n- \"Luna barks approvingly.\"\n- \"Andrew: 'I feel... stronger.' Bea: 'You were always strong, Daddy.'\"\n- \"That one feels different. Better.\"" },

    { id: "quip-death", title: "Death Lines", subtitle: "Bea's Reset Dialogue", unlocked: true,
      body: "- \"Again!\"\n- \"One more time!\"\n- \"I wanna go again!\"\n- \"That was fun, Daddy.\"\n- \"We almost had it!\"\n- \"I'm not tired. Are you tired?\"\n- \"The bear says we should try a different way.\"\n- \"I remember everything. Do you remember everything?\"\n- (Late runs) \"We're so close. One more time.\"\n- (Late runs) \"I can feel them. The people on the island. They're waiting for us.\"\n- (Run 9) \"I started this. I'm going to finish it.\"" },

    { id: "quip-car", title: "Car Transition Lines", subtitle: "Doylestown to Philly", unlocked: true,
      body: "- \"Whose car is this?\" \"Don't worry about it.\"\n- \"Does anyone know how to get to Philly?\" \"Take 611.\"\n- \"Bea, seatbelt.\" \"Magic doesn't need seatbelts.\" \"SEATBELT.\"\n- \"Luna, head inside the car.\" [Luna hangs head out window]\n- \"John, stop pressing buttons.\" [Something in the car glows]\n- \"This minivan has runes on the steering wheel.\" \"Don't touch them.\" [Touches them] [Car goes faster]\"" },
  ],
};

// ════════════════════════════════════════════════════════════════
//  LORE CODEX — World-building reference
// ════════════════════════════════════════════════════════════════

export const LORE_CODEX: NarrativeCategory = {
  id: "lore-codex",
  label: "Lore Codex",
  entries: [
    { id: "lore-marc-1", title: "MaRC", subtitle: "What is MaRC?", unlocked: true,
      body: "The Magical Activity Response Commission. Government agency for 'public safety regarding anomalous events.' Actually the world's most well-funded magic suppression force.\n\n- Founded ~40 years ago after magical incidents went public\n- Uses anti-magic dampener technology\n- Captures and contains wizards\n- Headquarters: secret island in the Bermuda Triangle\n- The dampener tech doesn't destroy magic — it harvests it" },
    { id: "lore-marc-2", title: "MaRC", subtitle: "The Triangle Facility", unlocked: true,
      body: "MaRC's real headquarters. Hidden in the Bermuda Triangle on a volcanic island.\n\n- 12 underground levels\n- Containment pods holding hundreds of captured wizards\n- Machines that drain wizard magic to power the dampener grid\n- The dampener grid suppresses magic across the entire eastern seaboard\n- The Director is connected to the machines in later runs" },
    { id: "lore-marc-3", title: "MaRC", subtitle: "Anti-Magic Technology", unlocked: true,
      body: "MaRC's dampeners are based on stolen transmutation principles (originally Nicolas Flamel's work).\n\n- Converts magical energy into suppression fields\n- Powered by captured wizards' drained magic\n- Frequency-adaptive: adjusts to counter specific magical signatures\n- Bea's power exceeds their models by 400%+\n- The technology is older than MaRC itself — someone built the original machines centuries ago" },
    { id: "lore-marc-4", title: "MaRC", subtitle: "Agent Hierarchy", unlocked: true,
      body: "- Neighborhood Watch: Civilian auxiliaries. Megaphones and nets. Not a real threat.\n- Field Agents: First responders. Basic training. Armored SUVs.\n- Drone Division: Surveillance tech. Remote operators.\n- Checkpoint Corps: Defensive specialists. Shield walls, barriers.\n- Anti-Magic Technicians: Scientists in tactical gear. Dampener experts.\n- Pursuit Specialists: Elite hunters. Mech suits. Enjoy the chase.\n- Island Security: Warden and guards. The most committed.\n- The Director: Head of MaRC. Connected to the machines. The final boss." },

    { id: "lore-magic-1", title: "Magic System", subtitle: "How Magic Works", unlocked: true,
      body: "Magic is the fundamental energy of the world — focused through consciousness and intent.\n\n- Not supernatural — the most natural thing there is\n- Flows through ley lines beneath the earth's surface\n- Concentrated at nexus points where ley lines intersect\n- The Bell family home sits on a major nexus (not a coincidence)\n- Everyone in the Bell family has a different affinity" },
    { id: "lore-magic-2", title: "Magic System", subtitle: "Family Affinities", unlocked: true,
      body: "- ANDREW: Earth magic. Strength, barriers, immovability. Inherited from his father.\n- HEATHER: Amplification magic. Boosts others' abilities. Learned from her grandmother.\n- JOHN: Enchantment/Artifice. Magic flows into things he builds. Natural enchanter.\n- BEA: Chaos/Nexus magic. All affinities. Can reset time. The rarest and most powerful.\n- LUNA: Primal/Ley-line magic. Instinct-based. Senses threats, disrupts technology." },
    { id: "lore-magic-3", title: "Magic System", subtitle: "Bea's Reset Power", unlocked: true,
      body: "Bea's reset is chaos magic — the rarest affinity.\n\n- Doesn't reverse time — creates a branch point and collapses reality back to it\n- The birthday party is the anchor point\n- Memories persist because consciousness exists outside the timeline\n- MaRC agents don't remember resets — only the Bell family does\n- The reset is why MaRC wants Bea specifically — her power could fuel their machines for a century" },

    { id: "lore-bell-1", title: "The Bell Family", subtitle: "Hidden Legacy", unlocked: true,
      body: "The Bells are descendants of one of the oldest wizard families in the region.\n\n- Magic skipped generations but never disappeared\n- Andrew's father had artifacts (discovered in storage unit after his death)\n- Heather's grandmother taught her secretly\n- John's enchantment is instinctive — he didn't know he was doing magic\n- Bea is the nexus — the one who brings it all back\n- Luna was drawn to the family because of the ley line nexus under the house" },
    { id: "lore-bell-2", title: "The Bell Family", subtitle: "The House", unlocked: true,
      body: "The Bell family home sits on a major ley line intersection.\n\n- Built by Andrew's great-great-grandfather (a wizard architect)\n- Protection runes woven into the foundation\n- The house has been quietly protecting the family for a century\n- As rooms unlock, the house's magical nature becomes visible\n- By Run 10, it's the most powerful wizard safehouse in the region" },

    { id: "lore-zones-1", title: "Zone Lore", subtitle: "The Burbs", unlocked: true,
      body: "The Bell family's suburban neighborhood. Cul-de-sacs, backyards, playgrounds, dog parks.\n\n- Built on a ley line nexus (why magical families keep moving here)\n- Mrs. Henderson's mailbox-frog is a neighborhood landmark now\n- The dog park has a ley line running through it (Luna's favorite spot)\n- MaRC keeps a low profile here — too residential for heavy operations" },
    { id: "lore-zones-2", title: "Zone Lore", subtitle: "Doylestown", unlocked: true,
      body: "Small town in Bucks County, PA. Charming, historic, hiding a wizard community.\n\n- Mercer Museum: built by a collector who was secretly a wizard archivist\n- Fonthill Castle: looks magical but isn't (the irony bothers the wizards)\n- Central Park: ley line nexus under the fountain\n- The bookshop, the food cart, the hardware store: all wizard-operated\n- MaRC has a satellite office in the county courthouse" },
    { id: "lore-zones-3", title: "Zone Lore", subtitle: "Philadelphia", unlocked: true,
      body: "City of brotherly love and MaRC's regional operations center.\n\n- Warehouse district: residual magic from old wizard workshops\n- South Philly: rowhouse wizards hiding in plain sight\n- PHL Airport: MaRC monitoring station for magical travelers\n- The Schuylkill: enchanted, but don't drink the water\n- MaRC has serious resources here — this is where they get dangerous" },
    { id: "lore-zones-4", title: "Zone Lore", subtitle: "Bermuda Triangle", unlocked: true,
      body: "Secret volcanic island in the Bermuda Triangle. MaRC's true headquarters.\n\n- Hidden by artificial storms (Prospero can feel them — they're WRONG)\n- 12 underground levels of containment and machinery\n- Hundreds of captured wizards in pods, magic drained to power dampeners\n- The machines predate MaRC — someone built them centuries ago\n- The deeper you go, the older the technology becomes\n- Level 12: the original machine. The heart of everything." },
  ],
};

// ════════════════════════════════════════════════════════════════
//  PROPHECIES & QUESTS — Goals and milestones
// ════════════════════════════════════════════════════════════════

export const PROPHECIES: NarrativeCategory = {
  id: "prophecies",
  label: "Prophecies & Quests",
  entries: [
    { id: "proph-fam-1", title: "Family Prophecy", subtitle: "The Unbroken Circle", unlocked: true,
      body: "\"When the five become one — father, mother, son, daughter, and faithful hound — no force of suppression shall hold.\"\n\nGoal: Complete a run with all family members at full health." },
    { id: "proph-fam-2", title: "Family Prophecy", subtitle: "Never Again", unlocked: true,
      body: "\"The child who resets shall one day choose to stop resetting.\"\n\nGoal: Complete Run 10. Hear Bea say 'Never Again.'" },
    { id: "proph-fam-3", title: "Family Prophecy", subtitle: "Everyone Knew", unlocked: true,
      body: "\"A family of hidden wizards, each believing they were the only one.\"\n\nGoal: Unlock all 5 character rooms in the house." },
    { id: "proph-fam-4", title: "Family Prophecy", subtitle: "Stronger Together", unlocked: true,
      body: "\"Alone, each Bell is remarkable. Together, they are unstoppable.\"\n\nGoal: Use every character's ultimate ability in a single run." },
    { id: "proph-fam-5", title: "Family Prophecy", subtitle: "The House Awakens", unlocked: true,
      body: "\"The house on the nexus stirs. After a century of sleeping, it remembers what it is.\"\n\nGoal: Purchase all house upgrades." },

    { id: "proph-wiz-1", title: "Wizard Prophecy", subtitle: "The Reader's Trust", unlocked: true,
      body: "\"Knowledge shared is power multiplied.\"\n\nGoal: View all of Merlin's hub dialogue entries." },
    { id: "proph-wiz-2", title: "Wizard Prophecy", subtitle: "The Trickster's Tale", unlocked: true,
      body: "\"The best stories are the ones where the family wins.\"\n\nGoal: Collect 50 of Anansi's boons across all runs." },
    { id: "proph-wiz-3", title: "Wizard Prophecy", subtitle: "The Alchemist's Debt", unlocked: true,
      body: "\"He who escaped alone returns with an army.\"\n\nGoal: Complete Run 10 with Nicolas Flamel's legendary boon active." },
    { id: "proph-wiz-4", title: "Wizard Prophecy", subtitle: "The Full Council", unlocked: true,
      body: "\"Ten wizards at one table. It hasn't happened in five hundred years.\"\n\nGoal: Have all 10 wizards visit the hub." },
    { id: "proph-wiz-5", title: "Wizard Prophecy", subtitle: "Duo Mastery", unlocked: true,
      body: "\"When two powers combine, the result is greater than the sum.\"\n\nGoal: Trigger 10 different Duo Boon combinations." },

    { id: "proph-world-1", title: "World Prophecy", subtitle: "First Escape", unlocked: true,
      body: "\"The door opens from the inside.\"\n\nGoal: Reach Zone 4 for the first time." },
    { id: "proph-world-2", title: "World Prophecy", subtitle: "The Machines Silenced", unlocked: true,
      body: "\"What feeds on stolen light shall be consumed by it.\"\n\nGoal: Complete Run 10. Disable the island's machines." },
    { id: "proph-world-3", title: "World Prophecy", subtitle: "Operation Dismantle", unlocked: true,
      body: "\"Disabling is not destroying. The work continues.\"\n\nGoal: Complete the post-game strike mission campaign." },
    { id: "proph-world-4", title: "World Prophecy", subtitle: "All Wizards Free", unlocked: true,
      body: "\"No cage can hold what was born free.\"\n\nGoal: Free all captured wizards across all runs." },
    { id: "proph-world-5", title: "World Prophecy", subtitle: "The True Ending", unlocked: true,
      body: "\"Home is not where you start. It is where you choose to stand.\"\n\nGoal: Fully destroy the Triangle facility in the post-game." },
  ],
};

// ════════════════════════════════════════════════════════════════
//  EXPORTS FOR NARRATIVE SCENE
// ════════════════════════════════════════════════════════════════

export const ALL_CATEGORIES: NarrativeCategory[] = [
  RUN_OUTLINES,
  HUB_SCENES,
  BOON_GIVERS,
  BOSS_ENCOUNTERS,
  IN_RUN_QUIPS,
  LORE_CODEX,
  PROPHECIES,
];
