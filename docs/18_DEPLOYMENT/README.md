# 18_DEPLOYMENT — Build and Deploy

## Status
บางส่วน — รวบรวมจาก `AGENT_WORKFLOW.md`; ห้ามถือว่า secret/current account info ครบถ้วนจนกว่าจะตรวจ environment จริง

## Source documents
- `AGENT_WORKFLOW.md`
- `HANDOFF.md`

## Known project/deploy info
| Item | Value from docs |
|---|---|
| App folder | `app` |
| Build output | `app/dist` |
| Cloudflare Pages project | `hr-jebar` |
| Live URL | `https://hr-jebar.pages.dev` |
| GitHub repo | `https://github.com/numjebar/HR-JEBAR` |

## Standard checks before deploy
1. Confirm scope from latest user request.
2. Make smallest safe change.
3. Run targeted checks.
4. Run app build.
5. Update visible build badge when deploying visible changes.
6. Update handoff after meaningful changes.
7. Deploy only when requested or agreed batch is complete.
8. Verify production URL and version badge after deploy.

## Required secrets mentioned in workflow
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

## Missing / ต้องตรวจสอบเพิ่มเติม
- Current CI/CD workflow status.
- Whether deploy should be manual, GitHub Actions, or Cloudflare Pages auto-deploy.
- Exact current build command for non-Windows environments.
