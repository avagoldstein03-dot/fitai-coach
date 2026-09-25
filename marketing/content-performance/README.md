# Content performance log

`posts.csv` is the one place post results live. The `weekly-report` and `flop-analyzer` skills read it.

## Weekly routine (~10 min, Sunday)
1. Export or copy last week's numbers from each platform:
   - **TikTok:** TikTok Studio → Analytics (desktop has a download option)
   - **Instagram:** Meta Business Suite → Insights → Content (export), or each Reel's "View insights"
   - **YouTube Shorts:** YouTube Studio → Analytics → Content → Shorts (export)
2. Either paste the exports into the chat and say "add these to the log," or fill rows in `posts.csv` yourself.
3. Say "run the weekly report."

Export layouts change. The skills map whatever columns they're given onto the ones below, and leave a cell blank if a platform doesn't report it.

## Columns
| Column | Meaning |
|---|---|
| `date` | Posted date, YYYY-MM-DD |
| `platform` | `tiktok` / `instagram` / `youtube` |
| `url` | Post link |
| `prompt_no` | prompts.json number, if it came from the UGC pipeline |
| `segment` | `genz` / `y2030` / `parent` / `plus45` / `glp1` / `lifestage` |
| `feature` | Feature shown |
| `format` | `talking-head` / `vlog` / `carousel` / `prompts-carousel` / `reply-to-comment` |
| `hook_trigger` | `fear` / `status` / `curiosity` / `identity` |
| `hook` | First line, verbatim |
| `length_s` | Video length in seconds (blank for carousels) |
| `views` | Views / plays |
| `avg_watch_s` | Average watch time, seconds |
| `pct_watched` | Average % watched (or full-watch rate if that's what the platform gives; note it in `notes`) |
| `likes`, `comments`, `shares`, `saves`, `follows` | As reported |
| `link_clicks` | Profile/bio link taps, if reported |
| `drop_off_s` | Where the retention graph falls hardest (read from the graph), optional |
| `notes` | Anything unusual (trending sound, reposted, boosted, AI label on) |

Numbers are 48h+ after posting at minimum; log final numbers at 7 days where possible.
