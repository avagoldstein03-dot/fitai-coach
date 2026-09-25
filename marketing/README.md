# Marketing workspace

Everything here is used through Claude Code skills in `.claude/skills/`. Ask in plain English ("give me hooks for…", "run the weekly report") and the matching skill loads.

| Area | Folder | Skills |
|---|---|---|
| Content creation | (uses `backend/scripts/marketing-automation/prompts.json`) | `content-agent`, `hook-generator`, `caption-writer`, `topic-generator`, `script-rewriter` |
| Planning | `content-calendar/` | `content-calendar` |
| Measurement | `content-performance/` | `weekly-report`, `flop-analyzer` |
| Competitors | `competitors/` | `competitor-analyzer` |
| Creators | `outreach/` | `creator-outreach` |
| DM funnel | `dm-funnel/` | (ManyChat setup guide; no skill) |
| Paid ads | `meta-ads-control-room/` | (Claude Project, used in claude.ai) |
| Launch blockers | `LAUNCH-CHECKLIST.md` | n/a |

## Weekly rhythm (~1 hour)
- **Sunday:** log last week's numbers → "run the weekly report" → "plan next week"
- **Daily:** "what's today" → render / caption / post
- **Mon + Thu:** "creator outreach status" → send drafts and follow-ups

## Automation decision (2026-09-25)
No n8n yet. ManyChat covers the only always-on piece (comment → DM). Everything else is weekly and needs your judgment (what to post, who to pitch), so skills you run on demand are simpler than a workflow server. Revisit n8n when one of these becomes true:
- Analytics can be pulled automatically (platform APIs), making the weekly report hands-off
- Outreach volume exceeds ~50 creators/month
- Paid ads are live and daily spend alerts are needed
