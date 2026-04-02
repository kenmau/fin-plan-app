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
WAVE=""
LOG_DIR="$REPO_ROOT/.agents/logs"

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
    DESCRIPTION=$(echo "$JSON" | jq -r '.fields.description // "No description"')
    STATUS=$(echo "$JSON" | jq -r '.fields.status.name // "Unknown"')
    
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
    
    # Branch from main
    local DEFAULT_BRANCH
    DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
    git checkout "$DEFAULT_BRANCH" 2>/dev/null || true
    git pull origin "$DEFAULT_BRANCH" 2>/dev/null || true
    git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
    
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
        log_ticket "$TICKET_KEY" "Running Generator..."
        cd "$REPO_ROOT"
        echo "$GENERATOR_INPUT" | claude -p \
            --allowedTools "Bash,Read,Write,Edit" \
            --max-turns 50 \
            2>&1 | tee "$LOG_DIR/generator-${TICKET_KEY}-iter${ITERATION}.log"
        
        # Stage changes
        git add -A
        
        # Run automated checks
        log_ticket "$TICKET_KEY" "Running checks..."
        local CHECKS_PASSED=true
        local CHECK_ERRORS=""
        
        if ! npx nx lint 2>&1 | tee -a "$TICKET_LOG"; then
            CHECK_ERRORS+="LINT FAILED.\n"
            CHECKS_PASSED=false
        fi
        if ! npx nx typecheck 2>&1 | tee -a "$TICKET_LOG"; then
            CHECK_ERRORS+="TYPECHECK FAILED.\n"
            CHECKS_PASSED=false
        fi
        if ! npx nx test 2>&1 | tee -a "$TICKET_LOG"; then
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
        log_ticket "$TICKET_KEY" "Running Validator..."
        local VALIDATOR_INPUT="## Ticket: $TICKET_KEY - $SUMMARY

## Acceptance Criteria:
$DESCRIPTION

## Files changed:
$(git diff --name-only HEAD 2>/dev/null || git diff --name-only)

Validate ALL acceptance criteria are met. Read each changed file. Output VERDICT: PASS or VERDICT: FAIL."
        
        local VALIDATOR_OUTPUT
        VALIDATOR_OUTPUT=$(echo "$VALIDATOR_INPUT" | claude -p \
            --allowedTools "Bash,Read" \
            --max-turns 30 \
            --output-format text \
            2>&1)
        
        echo "$VALIDATOR_OUTPUT" > "$LOG_DIR/validator-${TICKET_KEY}-iter${ITERATION}.log"
        
        if echo "$VALIDATOR_OUTPUT" | grep -qi "VERDICT:.*PASS"; then
            log_ticket "$TICKET_KEY" "✓ Validator: PASS"
            
            # Commit + push + PR
            git add -A
            if ! git diff --cached --quiet; then
                git commit -m "feat(${TICKET_KEY}): $(echo "$SUMMARY" | tr '[:upper:]' '[:lower:]')"
            fi
            git push -u origin "$BRANCH_NAME" 2>/dev/null || git push origin "$BRANCH_NAME"
            
            local PR_BODY="## $TICKET_KEY: $SUMMARY

Implements [$TICKET_KEY]($JIRA_BASE_URL/browse/$TICKET_KEY).

**Agent stats:** Generator iterations: $ITERATION | Validator: PASS | Checks: PASS"
            
            gh pr create \
                --title "$TICKET_KEY: $SUMMARY" \
                --body "$PR_BODY" \
                --assignee "@me" \
                2>&1 | tee -a "$TICKET_LOG"
            
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