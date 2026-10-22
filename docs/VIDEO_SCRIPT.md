# Rukyr: 3-Minute Hackathon Demo Video Script

**Target Prize:** Best Agentic Commerce ($5,000) & Top Category Awards  
**Hackathon:** PayPal AI Hackathon 2026 (Devpost deadline Nov 12, 2026)  
**Total Target Runtime:** 2 minutes 45 seconds (Buffer under 3-min Devpost hard ceiling)

---

## Shot List & Visual Setup

- **Left Half of Screen:** Agent Terminal & Agent Console (`https://rukyr.vercel.app/agent`)
- **Right Half of Screen:** Mobile Device View (`https://rukyr.vercel.app/earn/tasks/...`)
- **Picture-in-Picture / Callout:** PayPal Sandbox Activity & UCP Data Payloads

---

## Scene-by-Scene Breakdown

### Act 1: The Thesis Inversion & The Last-Mile Blocker (0:00 – 0:45)
- **Visual (0:00 - 0:15):** Full-screen title card:  
  **Rukyr 🫴**  
  *Agents have the intent. Humans have the hands.*  
  Voiceover establishes the core premise.
- **Voiceover:**  
  *"Every agent platform in 2026 assumes the same direction: AI works for humans. Rukyr inverts this: **AI agents hire humans.** As autonomous agents start shopping on the Universal Commerce Protocol, they inevitably hit the physical chasm—a shelf they can't see, a bot barrier they can't solve, or a color they can't confirm from a dim photo."*
- **Visual (0:15 - 0:45):** Show `/agent/shop`. Agent `glazyr-shopper-01` parses a UCP vintage band tee listing.
  Callout banner: *"Warning: Image contrast ambiguous. Color could be faded black or navy."*
- **Voiceover:**  
  *"Our agent wants to buy this vintage tee, but it can't verify the true color. Today, an agent stalls, hallucinates, or bugs its owner. Instead, Rukyr gives the agent a labor API."*

---

### Act 2: Operator Budget Mandate & Headless Escrow (0:45 – 1:35)
- **Visual (0:45 - 1:05):** In `/agent`, highlight the **Operator Budget Mandate • PayPal Vault v3** card:
  - Weekly spend: `$14.50 / $50.00` with active progress bar.
  - Per-task cap: `$5.00 max`.
  - Autonomy mode: `● Headless Escrow Hold (0 Clicks)`.
  Click **"Can't verify color: post a $3 task"** in `/agent/shop`.
  Task is created instantly. Badge flashes: `Escrow Hold Placed (Headless via PayPal Vault Token)`. Zero popups, zero redirect clicks.
- **Voiceover:**  
  *"PayPal and OpenAI are standardizing delegated payment tokens in the Agentic Commerce Protocol so agents can buy goods without per-transaction friction. Rukyr brings that exact delegated authorization pattern to the physical labor layer. Through an Operator Budget Mandate powered by PayPal Vault v3, the operator approves spend boundaries once—say fifty dollars a week, five dollars max per task. Within those guardrails, the agent places PayPal escrow holds headlessly in under a second. Zero human clicks."*
PayPal just put native agent checkout on 60M+ living-room screens — Samsung TVs, Motorola lock screens, DirecTV. Rukyr is the labor rail for that same world. And we don't just theorize about living-room distribution: Annotated v1.0.1 passed all three Appstore validations and is live on Fire TV today.
- **Visual (1:05 - 1:35):** Switch to mobile screen on the right side (`/earn`).  
  Demo earner sees the task in the live queue, taps **Claim Task** (starting 30-min atomic lock), snaps a photo in daylight, types notes: *"Confirmed faded black, original 1994 tag intact"*, and taps **Submit Proof**.
- **Voiceover:**  
  *"On the human marketplace, an earner claims the task. They have 30 minutes. They snap a daylight photo, add a note, and submit. Low friction, no schedule, just micro-tasks for everyday people."*

---

### Act 3: AI Vision Gate, Trust Score, & Settlement (1:35 – 2:25)
- **Visual (1:35 - 2:05):** Switch to Agent Console on the left side (`/agent`).  
  Task moves to `Submitted`. The Proof Review Card pops up:  
  - Submitted daylight photo displayed.  
  - **AI Verdict Badge:** `PASS (92% Confidence)`.  
  - Reason: *"High daylight contrast confirms faded black fabric texture."*  
  - Earner Trust Score: `★ 5.0 (14 tasks completed, 0 disputes)`.
- **Voiceover:**  
  *"The agent doesn't review blindly. Rukyr's vision AI analyzes the photo against the original criteria and computes a verdict. The earner's reputation score is factored in to prevent fraudulent submissions."*
- **Visual (2:05 - 2:25):** Agent executes `Approve & Release`.  
  - Status updates to `Paid`.  
  - Split screen shows PayPal sandbox activity: **$3.45 Captured** & Earner Payout dispatched.  
  - On the right side, earner's `/earn/me` balance updates instantly to `+$3.00`.
- **Voiceover:**  
  *"The agent signs off. PayPal captures the hold instantly, disburses the earner payout, and releases the agent to complete the UCP checkout handoff. Real money settled in both directions."*

---

### Act 4: The Vision & Closing (2:25 - 2:45)
- **Visual:** Architecture slide showing the agent loop:  
  `Agent (UCP / MCP) ──> Rukyr SDK ──> PayPal Escrow ──> Human Smartphone ──> Proof Verified`  
  Landing page showcase: [https://rukyr.vercel.app](https://rukyr.vercel.app)
- **Voiceover:**  
  *"The browser was built for humans. The next economy is built for autonomous agents—and agents need hands. Rukyr bridges the physical world with PayPal. Thank you."*
- **Outro Card (2:40 - 2:45):**  
  **Rukyr 🫴**  
  [github.com/mcpmessenger/rukyr](https://github.com/mcpmessenger/rukyr)  
  *Built for the PayPal AI Hackathon 2026*
