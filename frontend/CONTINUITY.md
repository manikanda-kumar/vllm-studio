# Continuity Ledger

## Goal
Cross-platform mobile device integration for vLLM Studio using mobile-mcp (MCP SSE transport). Must work on Mac and Windows without PATH dependency issues.

**Success criteria**: Mobile panel lists devices and captures screenshots via mobile-mcp on both platforms.

## Constraints/Assumptions
- mobile-mcp uses MCP SSE transport (bidirectional, not simple HTTP)
- Requires @modelcontextprotocol/sdk for proper client implementation
- Current mobilecli approach has PATH issues in Electron (fixed temporarily)
- mobile-mcp package: `@mobilenext/mobile-mcp`

## Key Decisions
- Pursue MCP SSE integration despite complexity (cross-platform benefit)
- Phased approach: temporary mobilecli fix → full MCP SSE client
- Keep pi-runtime extension architecture, change backend from HTTP routes to MCP

## State

### Done
- Fixed Electron PATH issue in app-server.ts (adds /opt/homebrew/bin)
- Fixed hook jq "Argument list too long" error (use stdin instead of --argjson)
- Created mobile-mcp.ts client skeleton
- Updated API routes to use mobile-mcp client (devices, screenshot, tap, button)
- Tested mobile-mcp SSE server starts correctly on port 3456

### Now
- MCP SSE protocol requires bidirectional connection, not simple POST
- Need to implement proper MCP client using @modelcontextprotocol/sdk

### Next
1. Add @modelcontextprotocol/sdk dependency
2. Implement MCP SSE client transport in mobile-mcp.ts
3. Test device listing via MCP protocol
4. Update screenshot/tap/button to use MCP tools
5. Rebuild DMG and test on Electron

## Open Questions
- Does mobile-mcp support stdio mode as alternative to SSE? (simpler)
- MCP SSE endpoint format: /sse GET → endpoint event → POST to that URL?

## Working Set
- `/Users/manik/Github/vllm-studio/frontend/src/lib/mobile-mcp.ts` - MCP client (needs SDK)
- `/Users/manik/Github/vllm-studio/frontend/src/app/api/agent/mobile/*/route.ts` - API routes
- `/Users/manik/Github/vllm-studio/frontend/desktop/logic/app-server.ts` - PATH fix applied
- `/Users/manik/.claude/hooks/stop_hook.sh` - jq fix applied

## Project Learnings
- Electron on macOS doesn't inherit shell PATH - must add /opt/homebrew/bin explicitly
- jq --argjson fails with large args - use `jq -s` with process substitution instead
- MCP SSE transport is bidirectional: GET /sse for events, POST to endpoint from event
- mobile-mcp listens on /mcp but needs SSE handshake first
