#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# FinPlan Agent Orchestrator
#
# Usage:
#   Single ticket:    .agents/orchestrate.sh FIN-35
#   Multiple serial:  .agents/orchestrate.sh FIN-35 FIN-36 FIN-37
#   Parallel:         .agents/orchestrate.sh --parallel FIN-42 FIN-43 FIN-44 FIN-45
#   Entire wave:      .agents/orchestrate.sh --wave 1
#   Dry run:          .agents/orchestrate.sh --dry-run --wave 2
#   Choose models:    .agents/orchestrate.sh --interactive FIN-36
#   Auto-merge PRs:   .agents/orchestrate.sh --merge auto FIN-36 FIN-37
#   Wait for merge:   .agents/orchestrate.sh --merge wait FIN-36 FIN-37
#   Set models:       .agents/orchestrate.sh --generator-model claude-sonnet-4-6 --validator-model claude-opus-4-6 FIN-36
#   Via env vars:     GENERATOR_MODEL=claude-opus-4-6 .agents/orchestrate.sh FIN-36
#
# Prerequisites:
#   - claude CLI installed and authenticated
#   - gh CLI installed and authenticated
#   - jq installed
#   - ATLASSIAN_EMAIL and ATLASSIAN_API_TOKEN env vars set
# ============================================================================

MAX_RETRIES=3
AGENTS_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$AGENTS_DIR/.." && pwd)"
JIRA_CLOUD_ID="04e8e3fa-cba0-442e-ad49-bc4573622531"
JIRA_BASE_URL="https://lan-and-ken.atlassian.net"
PARALLEL=false
DRY_RUN=false
INTERACTIVE=false
MERGE_STRATEGY=""
WAVE=""
LOG_DIR="$REPO_ROOT/.agents/logs"

# Model configuration — override via flags, env vars, or --interactive prompt
GENERATOR_MODEL="${GENERATOR_MODEL:-}"
VALIDATOR_MODEL="${VALIDATOR_MODEL:-}"
DEFAULT_MODEL="claude-sonnet-4-6"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log()         { echo -e "${BLUE}[orchestrator]${NC} $*"; }
log_success() { echo -e "${GREEN}[orchestrator]${NC} $*"; }
log_warn()    { echo -e "${YELLOW}[orchestrator]${NC} $*"; }
log_error()   { echo -e "${RED}[orchestrator]${NC} $*"; }
log_ticket()  { echo -e "${CYAN}[$1]${NC} $2"; }

mkdir -p "$LOG_DIR"

# ============================================================================
# Parse arguments
# ============================================================================
TICKETS=()

while [[ $# -gt 0 ]]; do
    case "$1" in
        --parallel|-p)
            PARALLEL=true
            shift
            ;;
        --wave|-w)
            WAVE="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --interactive|-i)
            INTERACTIVE=true
            shift
            ;;
        --merge|-m)
            MERGE_STRATEGY="$2"
            if [[ "$MERGE_STRATEGY" != "auto" && "$MERGE_STRATEGY" != "wait" ]]; then
                log_error "Invalid merge strategy: $MERGE_STRATEGY. Valid: auto, wait"
                exit 1
            fi
            shift 2
            ;;
        --generator-model)
            GENERATOR_MODEL="$2"
            shift 2
            ;;
        --validator-model)
            VALIDATOR_MODEL="$2"
            shift 2
            ;;
        --max-retries)
            MAX_RETRIES="$2"
            shift 2
            ;;
        FIN-*)
            TICKETS+=("$1")
            shift
            ;;
        *)
            log_error "Unknown argument: $1"
            echo "Usage: .agents/orchestrate.sh [--parallel] [--wave N] [--dry-run] [TICKET...]"
            exit 1
            ;;
    esac
done

# ============================================================================
# Wave definitions — tickets grouped by implementation wave
# ============================================================================
get_wave_tickets() {
    local WAVE_NUM="$1"
    case "$WAVE_NUM" in
        1) echo "FIN-35 FIN-36 FIN-37" ;;            # Foundation (sequential — each depends on prior)
        2) echo "FIN-38 FIN-40 FIN-39 FIN-41" ;;     # Core Data (38+40 parallel, then 39+41)
        3) echo "FIN-42 FIN-43 FIN-44 FIN-45" ;;     # Data Entry UX (all parallel)
        4) echo "FIN-46 FIN-47 FIN-48 FIN-49 FIN-50" ;; # Visualization (mostly sequential)
        5) echo "FIN-51 FIN-52 FIN-53 FIN-54 FIN-55" ;; # P1 Features (two parallel chains)
        *)
            log_error "Unknown wave: $WAVE_NUM. Valid waves: 1-5"
            exit 1
            ;;
    esac
}


# ============================================================================
# If --wave specified, resolve to ticket list
# ============================================================================
if [ -n "$WAVE" ]; then
    WAVE_TICKETS=$(get_wave_tickets "$WAVE")
    read -ra TICKETS <<< "$WAVE_TICKETS"
    log "Wave $WAVE tickets: ${TICKETS[*]}"
fi

if [ ${#TICKETS[@]} -eq 0 ]; then
    log_error "No tickets specified."
    echo "Usage: .agents/orchestrate.sh [--parallel] [--wave N] [--dry-run] FIN-XX [FIN-YY ...]"
    exit 1
fi

# ============================================================================
# Model selection
# ============================================================================
MODEL_OPTIONS=(
    "claude-sonnet-4-6"
    "claude-opus-4-6"
)

pick_model() {
    local ROLE="$1"
    local DEFAULT="$2"
    echo ""
    echo -e "${CYAN}Select model for ${ROLE}:${NC}"
    for i in "${!MODEL_OPTIONS[@]}"; do
        local MARKER=""
        [ "${MODEL_OPTIONS[$i]}" = "$DEFAULT" ] && MARKER=" (default)"
        echo "  $((i + 1))) ${MODEL_OPTIONS[$i]}${MARKER}"
    done
    echo -n "Choice [1-${#MODEL_OPTIONS[@]}] (enter for default): "
    read -r CHOICE
    if [ -z "$CHOICE" ]; then
        echo "$DEFAULT"
    elif [ "$CHOICE" -ge 1 ] 2>/dev/null && [ "$CHOICE" -le "${#MODEL_OPTIONS[@]}" ]; then
        echo "${MODEL_OPTIONS[$((CHOICE - 1))]}"
    else
        log_warn "Invalid choice. Using default: $DEFAULT"
        echo "$DEFAULT"
    fi
}

if [ "$INTERACTIVE" = true ]; then
    log "Model selection (--interactive)"
    GENERATOR_MODEL=$(pick_model "Generator" "$DEFAULT_MODEL")
    VALIDATOR_MODEL=$(pick_model "Validator" "$DEFAULT_MODEL")
    
    # Merge strategy prompt (only relevant for sequential/wave runs)
    if [ "$PARALLEL" = false ] && [ -z "$MERGE_STRATEGY" ]; then
        echo ""
        echo -e "${CYAN}After a PR is created, how should the orchestrator proceed?${NC}"
        echo "  1) auto — Auto-merge PR (squash) and continue immediately"
        echo "  2) wait — Pause until you merge the PR, then continue"
        echo "  3) none — Create PR and continue without merging (default)"
        echo -n "Choice [1-3] (enter for default): "
        read -r MERGE_CHOICE
        case "$MERGE_CHOICE" in
            1) MERGE_STRATEGY="auto" ;;
            2) MERGE_STRATEGY="wait" ;;
            *) MERGE_STRATEGY="" ;;
        esac
    fi
fi

# Fall back to defaults if still unset
GENERATOR_MODEL="${GENERATOR_MODEL:-$DEFAULT_MODEL}"
VALIDATOR_MODEL="${VALIDATOR_MODEL:-$DEFAULT_MODEL}"

log "Generator model: $GENERATOR_MODEL"
log "Validator model: $VALIDATOR_MODEL"

# ============================================================================
# Jira helpers
# ============================================================================
jira_api() {
    local ENDPOINT="$1"
    curl -s \
        -u "$ATLASSIAN_EMAIL:$ATLASSIAN_API_TOKEN" \
        -H "Content-Type: application/json" \
        "https://api.atlassian.com/ex/jira/$JIRA_CLOUD_ID/rest/api/3/$ENDPOINT"
}

jira_post() {
    local ENDPOINT="$1"
    local DATA="$2"
    curl -s -X POST \
        -u "$ATLASSIAN_EMAIL:$ATLASSIAN_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$DATA" \
        "https://api.atlassian.com/ex/jira/$JIRA_CLOUD_ID/rest/api/3/$ENDPOINT"
}

fetch_ticket_description() {
    local KEY="$1"
    local JSON
    JSON=$(jira_api "issue/$KEY?fields=summary,description,labels,parent,status")
    
    SUMMARY=$(echo "$JSON" | jq -r '.fields.summary // "Unknown"')
    STATUS=$(echo "$JSON" | jq -r '.fields.status.name // "Unknown"')
    
    # Extract description — Jira API v3 returns ADF (JSON), convert to plain text
    local RAW_DESC
    RAW_DESC=$(echo "$JSON" | jq -r '.fields.description // "No description"')
    
    # If description is ADF JSON, extract text nodes with structure; otherwise use as-is
    if echo "$RAW_DESC" | jq -e '.type == "doc"' > /dev/null 2>&1; then
        DESCRIPTION=$(echo "$RAW_DESC" | jq -r '
            def extract_text:
                if .type == "text" then .text
                elif .type == "hardBreak" then "\n"
                elif .type == "listItem" then
                    "• " + ([.content[]? | extract_text] | join("") | gsub("\n$"; "")) + "\n"
                elif .type == "paragraph" then
                    ([.content[]? | extract_text] | join("")) + "\n"
                elif .type == "heading" then
                    "\n" + ([.content[]? | extract_text] | join("")) + "\n"
                elif .type == "bulletList" or .type == "orderedList" then
                    ([.content[]? | extract_text] | join(""))
                elif .content then
                    ([.content[]? | extract_text] | join(""))
                else ""
                end;
            extract_text | gsub("\n{3,}"; "\n\n") | ltrimstr("\n") | rtrimstr("\n")
        ' 2>/dev/null || echo "$RAW_DESC")
    else
        DESCRIPTION="$RAW_DESC"
    fi
    
    if [ "$SUMMARY" = "null" ] || [ "$SUMMARY" = "Unknown" ]; then
        log_error "Failed to fetch $KEY"
        return 1
    fi
}

transition_ticket() {
    local KEY="$1"
    local TARGET="$2"
    
    local TRANSITIONS
    TRANSITIONS=$(jira_api "issue/$KEY/transitions")
    local TID
    TID=$(echo "$TRANSITIONS" | jq -r ".transitions[] | select(.name == \"$TARGET\") | .id")
    
    if [ -n "$TID" ] && [ "$TID" != "null" ]; then
        jira_post "issue/$KEY/transitions" "{\"transition\": {\"id\": \"$TID\"}}" > /dev/null
        log_ticket "$KEY" "→ $TARGET"
    fi
}

# ============================================================================
# Process a single ticket (Generator → Checks → Validator loop)
# ============================================================================
process_ticket() {
    local TICKET_KEY="$1"
    local TICKET_LOG="$LOG_DIR/${TICKET_KEY}.log"
    
    log "========================================="
    log "Starting: $TICKET_KEY"
    log "========================================="
    
    # Fetch ticket
    fetch_ticket_description "$TICKET_KEY" || return 1
    log_ticket "$TICKET_KEY" "$SUMMARY"
    log_ticket "$TICKET_KEY" "Status: $STATUS"
    
    if [ "$DRY_RUN" = true ]; then
        log_ticket "$TICKET_KEY" "[DRY RUN] Would process this ticket"
        return 0
    fi
    
    # Create branch
    local BRANCH_SLUG
    BRANCH_SLUG=$(echo "$SUMMARY" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//' | cut -c1-50)
    local BRANCH_NAME="$(echo "$TICKET_KEY" | tr '[:upper:]' '[:lower:]')/${BRANCH_SLUG}"
    
    # Branch from main — reset to clean state for idempotent re-runs
    local DEFAULT_BRANCH
    DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
    git checkout "$DEFAULT_BRANCH" 2>/dev/null || true
    git pull origin "$DEFAULT_BRANCH" 2>/dev/null || true
    
    if git show-ref --verify --quiet "refs/heads/$BRANCH_NAME" 2>/dev/null; then
        # Branch exists from a previous run — reset it to main for a clean start
        log_ticket "$TICKET_KEY" "Branch '$BRANCH_NAME' exists from prior run. Resetting to $DEFAULT_BRANCH."
        git checkout "$BRANCH_NAME"
        git reset --hard "$DEFAULT_BRANCH"
    else
        git checkout -b "$BRANCH_NAME"
    fi
    
    # Transition to In Progress
    transition_ticket "$TICKET_KEY" "In Progress"
    
    # Generator → Validator loop
    local ITERATION=0
    local FEEDBACK=""
    local VALIDATION_FEEDBACK=""
    
    while [ $ITERATION -lt $MAX_RETRIES ]; do
        ITERATION=$((ITERATION + 1))
        log_ticket "$TICKET_KEY" "--- Iteration $ITERATION/$MAX_RETRIES ---"
        
        # Build generator input
        local GENERATOR_INPUT
        if [ -n "$FEEDBACK" ]; then
            GENERATOR_INPUT="## Ticket: $TICKET_KEY - $SUMMARY

## Description & Acceptance Criteria:
$DESCRIPTION

## VALIDATOR FEEDBACK (fix these issues):
$FEEDBACK

Read the existing code, fix the issues, and ensure all acceptance criteria are met."
        else
            GENERATOR_INPUT="## Ticket: $TICKET_KEY - $SUMMARY

## Description & Acceptance Criteria:
$DESCRIPTION

Implement this ticket. Read CLAUDE.md for project context. Follow all acceptance criteria exactly."
        fi
        
        # Run Generator
        local GEN_LOG="$LOG_DIR/generator-${TICKET_KEY}-iter${ITERATION}.log"
        log_ticket "$TICKET_KEY" "Running Generator ($GENERATOR_MODEL)..."
        log_ticket "$TICKET_KEY" "  └─ Live tail: tail -f $GEN_LOG"
        cd "$REPO_ROOT"
        
        : > "$GEN_LOG"  # truncate log file
        local GEN_START=$SECONDS
        
        # Background progress monitor — watches log file size every 60s
        (
            while true; do
                sleep 60
                if [ -f "$GEN_LOG" ]; then
                    local ELAPSED=$(( (SECONDS - GEN_START) / 60 ))
                    local LOG_SIZE=$(du -h "$GEN_LOG" 2>/dev/null | cut -f1)
                    log_ticket "$TICKET_KEY" "  ⏳ Generator running... ${ELAPSED}m elapsed, log: ${LOG_SIZE}"
                fi
            done
        ) &
        local MONITOR_PID=$!
        
        # Run generator in foreground — output streams to both terminal and log
        echo "$GENERATOR_INPUT" | claude -p \
            --model "$GENERATOR_MODEL" \
            --allowedTools "Bash,Read,Write,Edit" \
            --max-turns 50 \
            2>&1 | tee "$GEN_LOG"
        
        # Stop the progress monitor
        kill "$MONITOR_PID" 2>/dev/null || true
        wait "$MONITOR_PID" 2>/dev/null || true
        
        local GEN_ELAPSED=$(( SECONDS - GEN_START ))
        log_ticket "$TICKET_KEY" "Generator finished in $((GEN_ELAPSED / 60))m $((GEN_ELAPSED % 60))s"
        
        # Stage changes
        git add -A
        
        # Run automated checks (nx affected — only checks packages with changes)
        log_ticket "$TICKET_KEY" "Running checks..."
        local CHECKS_PASSED=true
        local CHECK_ERRORS=""
        
        if ! npx nx affected --target=lint --base="$DEFAULT_BRANCH" 2>&1 | tee -a "$TICKET_LOG"; then
            CHECK_ERRORS+="LINT FAILED.\n"
            CHECKS_PASSED=false
        fi
        if ! npx nx affected --target=typecheck --base="$DEFAULT_BRANCH" 2>&1 | tee -a "$TICKET_LOG"; then
            CHECK_ERRORS+="TYPECHECK FAILED.\n"
            CHECKS_PASSED=false
        fi
        if ! npx nx affected --target=test --base="$DEFAULT_BRANCH" 2>&1 | tee -a "$TICKET_LOG"; then
            CHECK_ERRORS+="TESTS FAILED.\n"
            CHECKS_PASSED=false
        fi
        
        if [ "$CHECKS_PASSED" = false ]; then
            FEEDBACK="AUTOMATED CHECKS FAILED:\n$CHECK_ERRORS\nFix these before resubmitting."
            log_ticket "$TICKET_KEY" "Checks failed. Looping back to generator."
            continue
        fi
        log_ticket "$TICKET_KEY" "✓ All checks passed"
        
        # Run Validator
        local VAL_LOG="$LOG_DIR/validator-${TICKET_KEY}-iter${ITERATION}.log"
        log_ticket "$TICKET_KEY" "Running Validator ($VALIDATOR_MODEL)..."
        log_ticket "$TICKET_KEY" "  └─ Live tail: tail -f $VAL_LOG"
        local VAL_START=$SECONDS
        
        local VALIDATOR_INPUT="## Ticket: $TICKET_KEY - $SUMMARY

## Acceptance Criteria:
$DESCRIPTION

## Files changed:
$(git diff --name-only HEAD 2>/dev/null || git diff --name-only)

Validate ALL acceptance criteria are met. Read each changed file. Output VERDICT: PASS or VERDICT: FAIL."
        
        local VALIDATOR_OUTPUT
        VALIDATOR_OUTPUT=$(echo "$VALIDATOR_INPUT" | claude -p \
            --model "$VALIDATOR_MODEL" \
            --allowedTools "Bash,Read" \
            --max-turns 30 \
            --output-format text \
            2>&1)
        
        local VAL_ELAPSED=$(( SECONDS - VAL_START ))
        log_ticket "$TICKET_KEY" "Validator finished in $((VAL_ELAPSED / 60))m $((VAL_ELAPSED % 60))s"
        
        echo "$VALIDATOR_OUTPUT" > "$VAL_LOG"
        
        if echo "$VALIDATOR_OUTPUT" | grep -qi "VERDICT:.*PASS"; then
            log_ticket "$TICKET_KEY" "✓ Validator: PASS"
            
            # Commit + push + PR
            git add -A
            if ! git diff --cached --quiet; then
                git commit -m "feat(${TICKET_KEY}): $(echo "$SUMMARY" | tr '[:upper:]' '[:lower:]')"
            fi
            git push -u origin "$BRANCH_NAME" 2>&1 || git push --force-with-lease origin "$BRANCH_NAME"
            
            # Build rich PR description
            local FILES_CHANGED
            FILES_CHANGED=$(git diff --stat "$DEFAULT_BRANCH"...HEAD 2>/dev/null || echo "Unable to compute diff stats")
            local FILE_LIST
            FILE_LIST=$(git diff --name-only "$DEFAULT_BRANCH"...HEAD 2>/dev/null || echo "Unable to list files")
            local LINES_ADDED
            LINES_ADDED=$(git diff --shortstat "$DEFAULT_BRANCH"...HEAD 2>/dev/null | grep -oE '[0-9]+ insertion' | grep -oE '[0-9]+' || echo "0")
            local LINES_REMOVED
            LINES_REMOVED=$(git diff --shortstat "$DEFAULT_BRANCH"...HEAD 2>/dev/null | grep -oE '[0-9]+ deletion' | grep -oE '[0-9]+' || echo "0")
            
            # Extract test count from last test run log
            local TEST_COUNT
            TEST_COUNT=$(grep -oE '[0-9]+ (test|spec)s? passed' "$TICKET_LOG" 2>/dev/null | tail -1 || echo "see logs")
            
            # Summarize validator output (first 20 lines after VERDICT)
            local VALIDATOR_SUMMARY
            VALIDATOR_SUMMARY=$(echo "$VALIDATOR_OUTPUT" | head -60 | tail -40 || echo "See validator log")
            
            local PR_BODY="## $TICKET_KEY: $SUMMARY

### Jira
[$TICKET_KEY]($JIRA_BASE_URL/browse/$TICKET_KEY)

### What this PR does
$(echo "$DESCRIPTION" | head -30)

### Files changed
\`\`\`
$FILES_CHANGED
\`\`\`

### Automated checks
| Check | Status |
|-------|--------|
| Lint | ✅ Pass |
| Typecheck | ✅ Pass |
| Tests | ✅ Pass ($TEST_COUNT) |

### Validator assessment
<details>
<summary>Validator output (click to expand)</summary>

\`\`\`
$VALIDATOR_SUMMARY
\`\`\`
</details>

### Agent stats
| Metric | Value |
|--------|-------|
| Generator iterations | $ITERATION / $MAX_RETRIES |
| Generator model | \`$GENERATOR_MODEL\` |
| Validator model | \`$VALIDATOR_MODEL\` |
| Lines added | +$LINES_ADDED |
| Lines removed | -$LINES_REMOVED |"
            
            # Create PR — if one already exists from a prior run, just update it
            if ! gh pr create \
                --title "$TICKET_KEY: $SUMMARY" \
                --body "$PR_BODY" \
                --assignee "@me" \
                2>&1 | tee -a "$TICKET_LOG"; then
                log_warn "PR may already exist. Attempting to update..."
                gh pr edit "$BRANCH_NAME" \
                    --title "$TICKET_KEY: $SUMMARY" \
                    --body "$PR_BODY" \
                    2>&1 | tee -a "$TICKET_LOG" || true
            fi
            
            # Merge strategy — handle PR merge before moving to next ticket
            if [ "$MERGE_STRATEGY" = "auto" ]; then
                log_ticket "$TICKET_KEY" "Auto-merging PR (squash)..."
                if gh pr merge "$BRANCH_NAME" --squash --delete-branch 2>&1 | tee -a "$TICKET_LOG"; then
                    log_ticket "$TICKET_KEY" "✓ PR merged and branch deleted"
                else
                    log_warn "Auto-merge failed. PR may require review or have merge conflicts."
                fi
            elif [ "$MERGE_STRATEGY" = "wait" ]; then
                log_ticket "$TICKET_KEY" "⏳ Waiting for PR to be merged before continuing..."
                log_ticket "$TICKET_KEY" "Review and merge at: https://github.com/kenmau/fin-plan-app/pull/$BRANCH_NAME"
                while true; do
                    local PR_STATE
                    PR_STATE=$(gh pr view "$BRANCH_NAME" --json state --jq '.state' 2>/dev/null || echo "UNKNOWN")
                    if [ "$PR_STATE" = "MERGED" ]; then
                        log_ticket "$TICKET_KEY" "✓ PR merged. Continuing..."
                        break
                    elif [ "$PR_STATE" = "CLOSED" ]; then
                        log_error "PR was closed without merging. Stopping."
                        return 1
                    fi
                    sleep 30
                done
            fi
            
            transition_ticket "$TICKET_KEY" "Done"
            
            log_success "========================================="
            log_success "COMPLETE: $TICKET_KEY (iteration $ITERATION)"
            log_success "========================================="
            return 0
        else
            VALIDATION_FEEDBACK=$(echo "$VALIDATOR_OUTPUT" | grep -A 100 "VERDICT:" || echo "$VALIDATOR_OUTPUT" | tail -50)
            FEEDBACK="$VALIDATION_FEEDBACK"
            log_ticket "$TICKET_KEY" "✗ Validator: FAIL. Looping."
        fi
    done
    
    log_error "FAILED: $TICKET_KEY after $MAX_RETRIES iterations"
    log_error "Logs: $LOG_DIR/generator-${TICKET_KEY}-*.log"
    return 1
}

# ============================================================================
# Run tickets in parallel (background jobs)
# ============================================================================
run_parallel() {
    local PIDS=()
    local TICKET_KEYS=()
    local RESULTS=()
    
    log "Running ${#TICKETS[@]} tickets in PARALLEL..."
    log "Tickets: ${TICKETS[*]}"
    
    for TICKET_KEY in "${TICKETS[@]}"; do
        log_ticket "$TICKET_KEY" "Spawning in background..."
        
        # Each parallel ticket runs in a git worktree to avoid branch conflicts
        local WORKTREE_DIR="$REPO_ROOT/.worktrees/$TICKET_KEY"
        local BRANCH_SLUG
        BRANCH_SLUG=$(echo "$TICKET_KEY" | tr '[:upper:]' '[:lower:]')
        
        # Create worktree
        git worktree add "$WORKTREE_DIR" -b "${BRANCH_SLUG}/work" 2>/dev/null || true
        
        # Copy .agents into worktree
        cp -r "$AGENTS_DIR" "$WORKTREE_DIR/.agents" 2>/dev/null || true
        
        # Run in background, capturing output
        (
            cd "$WORKTREE_DIR"
            export REPO_ROOT="$WORKTREE_DIR"
            process_ticket "$TICKET_KEY"
        ) > "$LOG_DIR/parallel-${TICKET_KEY}.log" 2>&1 &
        
        PIDS+=($!)
        TICKET_KEYS+=("$TICKET_KEY")
    done
    
    # Wait for all and collect results
    log "Waiting for ${#PIDS[@]} parallel agents..."
    local FAILED=0
    
    for i in "${!PIDS[@]}"; do
        local PID="${PIDS[$i]}"
        local KEY="${TICKET_KEYS[$i]}"
        
        if wait "$PID"; then
            log_success "$KEY: PASSED ✓"
            RESULTS+=("$KEY: PASS")
        else
            log_error "$KEY: FAILED ✗"
            RESULTS+=("$KEY: FAIL")
            FAILED=$((FAILED + 1))
        fi
        
        # Clean up worktree
        git worktree remove "$REPO_ROOT/.worktrees/$KEY" --force 2>/dev/null || true
    done
    
    # Summary
    log "========================================="
    log "PARALLEL RUN SUMMARY"
    log "========================================="
    for R in "${RESULTS[@]}"; do
        echo "  $R"
    done
    log "Passed: $((${#TICKETS[@]} - FAILED)) / ${#TICKETS[@]}"
    
    if [ $FAILED -gt 0 ]; then
        log_error "$FAILED ticket(s) failed. Check logs in $LOG_DIR/"
        return 1
    fi
}

# ============================================================================
# Run tickets sequentially
# ============================================================================
run_sequential() {
    local FAILED=0
    local RESULTS=()
    
    log "Running ${#TICKETS[@]} tickets SEQUENTIALLY..."
    log "Order: ${TICKETS[*]}"
    
    for TICKET_KEY in "${TICKETS[@]}"; do
        if process_ticket "$TICKET_KEY"; then
            RESULTS+=("$TICKET_KEY: PASS")
        else
            RESULTS+=("$TICKET_KEY: FAIL")
            FAILED=$((FAILED + 1))
            log_error "$TICKET_KEY failed. Stopping sequential run (downstream tickets may depend on this)."
            break
        fi
        
        # Return to main between tickets
        local DEFAULT_BRANCH
        DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
        git checkout "$DEFAULT_BRANCH" 2>/dev/null || true
        git pull origin "$DEFAULT_BRANCH" 2>/dev/null || true
    done
    
    # Summary
    log "========================================="
    log "SEQUENTIAL RUN SUMMARY"
    log "========================================="
    for R in "${RESULTS[@]}"; do
        echo "  $R"
    done
    
    if [ $FAILED -gt 0 ]; then
        return 1
    fi
}

# ============================================================================
# Smart wave execution — respects dependency groups
# Uses explicit execution plans per wave (no associative arrays — bash 3 safe)
# ============================================================================

# Execute a group of tickets: single → sequential, multiple → parallel
run_group() {
    local GROUP_NAME="$1"
    shift
    local GROUP_TICKETS=("$@")
    local COUNT=${#GROUP_TICKETS[@]}
    
    if [ "$COUNT" -eq 0 ]; then
        return 0
    fi
    
    if [ "$COUNT" -eq 1 ]; then
        log "Group $GROUP_NAME: Running ${GROUP_TICKETS[0]} (single ticket)"
        if [ "$DRY_RUN" = true ]; then
            log "[DRY RUN] Would process: ${GROUP_TICKETS[0]}"
        else
            process_ticket "${GROUP_TICKETS[0]}" || {
                log_error "Group $GROUP_NAME failed. Stopping wave."
                return 1
            }
        fi
    else
        log "Group $GROUP_NAME: Running ${GROUP_TICKETS[*]} in PARALLEL ($COUNT tickets)"
        if [ "$DRY_RUN" = true ]; then
            log "[DRY RUN] Would process in parallel: ${GROUP_TICKETS[*]}"
        else
            local OLD_TICKETS=("${TICKETS[@]}")
            TICKETS=("${GROUP_TICKETS[@]}")
            run_parallel || {
                log_error "Group $GROUP_NAME failed. Stopping wave."
                TICKETS=("${OLD_TICKETS[@]}")
                return 1
            }
            TICKETS=("${OLD_TICKETS[@]}")
        fi
    fi
    
    # Return to main between groups so next group builds on merged work
    if [ "$DRY_RUN" = false ]; then
        local DEFAULT_BRANCH
        DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
        git checkout "$DEFAULT_BRANCH" 2>/dev/null || true
        git pull origin "$DEFAULT_BRANCH" 2>/dev/null || true
    fi
}

run_wave() {
    log "Running Wave $WAVE with dependency-aware scheduling..."
    
    # Explicit execution plans per wave — each group runs sequentially,
    # tickets within a group run in parallel
    case "$WAVE" in
        1)
            # Foundation: strictly sequential (each depends on prior)
            run_group "1a-scaffolding"   FIN-35 || return 1
            run_group "1b-auth-backend"  FIN-36 || return 1
            run_group "1c-auth-frontend" FIN-37 || return 1
            ;;
        2)
            # Core Data: FIN-38+40 parallel, then FIN-39, then FIN-41
            run_group "2a-accounts+categories" FIN-38 FIN-40 || return 1
            run_group "2b-snapshots"            FIN-39         || return 1
            run_group "2c-transactions"         FIN-41         || return 1
            ;;
        3)
            # Data Entry UX: all 4 tickets fully parallel
            run_group "3-data-entry" FIN-42 FIN-43 FIN-44 FIN-45 || return 1
            ;;
        4)
            # Visualization: budget setup first, then rollover, then dashboard chain
            run_group "4a-budget-setup"    FIN-46 || return 1
            run_group "4b-rollover+api"    FIN-47 FIN-48 || return 1
            run_group "4c-dashboard-widgets" FIN-49 || return 1
            run_group "4d-customization"   FIN-50 || return 1
            ;;
        5)
            # P1: two independent chains — goals and tax — run in parallel
            # Goals: FIN-51 → FIN-52, Tax: FIN-53 → FIN-54 → FIN-55
            run_group "5a-goals+tax-setup" FIN-51 FIN-53 || return 1
            run_group "5b-contributions"   FIN-52 FIN-54 || return 1
            run_group "5c-tax-recs"        FIN-55         || return 1
            ;;
        *)
            log_error "Unknown wave: $WAVE"
            return 1
            ;;
    esac
    
    log_success "Wave $WAVE complete!"
}

# ============================================================================
# Main
# ============================================================================
main() {
    # Preflight
    command -v claude >/dev/null 2>&1 || { log_error "claude CLI not found."; exit 1; }
    command -v gh >/dev/null 2>&1     || { log_error "gh CLI not found."; exit 1; }
    command -v jq >/dev/null 2>&1     || { log_error "jq not found."; exit 1; }
    [ -n "${ATLASSIAN_EMAIL:-}" ]     || { log_error "ATLASSIAN_EMAIL not set."; exit 1; }
    [ -n "${ATLASSIAN_API_TOKEN:-}" ] || { log_error "ATLASSIAN_API_TOKEN not set."; exit 1; }
    
    log "========================================="
    log "FinPlan Agent Orchestrator"
    log "Tickets: ${TICKETS[*]}"
    log "Mode: $([ "$PARALLEL" = true ] && echo 'PARALLEL' || ([ -n "$WAVE" ] && echo "WAVE $WAVE (smart)" || echo 'SEQUENTIAL'))"
    [ -n "$MERGE_STRATEGY" ] && log "Merge strategy: $MERGE_STRATEGY"
    [ "$DRY_RUN" = true ] && log "DRY RUN — no changes will be made"
    log "========================================="
    
    if [ -n "$WAVE" ]; then
        run_wave
    elif [ "$PARALLEL" = true ]; then
        run_parallel
    else
        run_sequential
    fi
}

main