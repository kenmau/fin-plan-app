#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# FinPlan Agent Orchestrator
# 
# Usage: .agents/orchestrate.sh <JIRA_TICKET_KEY>
# Example: .agents/orchestrate.sh FIN-35
#
# Prerequisites:
#   - claude CLI installed and authenticated
#   - gh CLI installed and authenticated
#   - jq installed
#   - Atlassian API token in ATLASSIAN_API_TOKEN env var
#   - Atlassian email in ATLASSIAN_EMAIL env var
# ============================================================================

TICKET_KEY="${1:?Usage: .agents/orchestrate.sh <JIRA_TICKET_KEY>}"
MAX_RETRIES=3
AGENTS_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$AGENTS_DIR/.." && pwd)"
JIRA_BASE_URL="https://lan-and-ken.atlassian.net"
JIRA_CLOUD_ID="04e8e3fa-cba0-442e-ad49-bc4573622531"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log() { echo -e "${BLUE}[orchestrator]${NC} $*"; }
log_success() { echo -e "${GREEN}[orchestrator]${NC} $*"; }
log_warn() { echo -e "${YELLOW}[orchestrator]${NC} $*"; }
log_error() { echo -e "${RED}[orchestrator]${NC} $*"; }

# ============================================================================
# Step 1: Fetch ticket from Jira
# ============================================================================
fetch_ticket() {
    log "Fetching ticket $TICKET_KEY from Jira..."
    
    TICKET_JSON=$(curl -s \
        -u "$ATLASSIAN_EMAIL:$ATLASSIAN_API_TOKEN" \
        -H "Content-Type: application/json" \
        "https://api.atlassian.com/ex/jira/$JIRA_CLOUD_ID/rest/api/3/issue/$TICKET_KEY?fields=summary,description,labels,parent,status")
    
    TICKET_SUMMARY=$(echo "$TICKET_JSON" | jq -r '.fields.summary')
    TICKET_DESCRIPTION=$(echo "$TICKET_JSON" | jq -r '.fields.description // "No description"')
    TICKET_STATUS=$(echo "$TICKET_JSON" | jq -r '.fields.status.name')
    TICKET_PARENT=$(echo "$TICKET_JSON" | jq -r '.fields.parent.key // "none"')
    
    if [ "$TICKET_SUMMARY" = "null" ] || [ -z "$TICKET_SUMMARY" ]; then
        log_error "Failed to fetch ticket $TICKET_KEY. Check your credentials."
        exit 1
    fi
    
    log_success "Ticket: $TICKET_KEY - $TICKET_SUMMARY"
    log "Status: $TICKET_STATUS | Parent Epic: $TICKET_PARENT"
}

# ============================================================================
# Step 2: Create feature branch
# ============================================================================
create_branch() {
    # Convert ticket key to branch name: FIN-35 → fin-35/project-scaffolding
    BRANCH_SLUG=$(echo "$TICKET_SUMMARY" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]/-/g' | sed 's/--*/-/g' | sed 's/^-//' | sed 's/-$//' | cut -c1-50)
    BRANCH_NAME="$(echo "$TICKET_KEY" | tr '[:upper:]' '[:lower:]')/${BRANCH_SLUG}"
    
    log "Creating branch: $BRANCH_NAME"
    
    # Ensure we're on main/master and up to date
    DEFAULT_BRANCH=$(git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null | sed 's@^refs/remotes/origin/@@' || echo "main")
    git checkout "$DEFAULT_BRANCH" 2>/dev/null || git checkout -b main
    git pull origin "$DEFAULT_BRANCH" 2>/dev/null || true
    
    # Create feature branch
    git checkout -b "$BRANCH_NAME" 2>/dev/null || git checkout "$BRANCH_NAME"
    
    log_success "On branch: $BRANCH_NAME"
}

# ============================================================================
# Step 3: Transition ticket to In Progress
# ============================================================================
transition_ticket() {
    local TARGET_STATUS="$1"
    log "Transitioning $TICKET_KEY to '$TARGET_STATUS'..."
    
    # Get available transitions
    TRANSITIONS=$(curl -s \
        -u "$ATLASSIAN_EMAIL:$ATLASSIAN_API_TOKEN" \
        -H "Content-Type: application/json" \
        "https://api.atlassian.com/ex/jira/$JIRA_CLOUD_ID/rest/api/3/issue/$TICKET_KEY/transitions")
    
    TRANSITION_ID=$(echo "$TRANSITIONS" | jq -r ".transitions[] | select(.name == \"$TARGET_STATUS\") | .id")
    
    if [ -n "$TRANSITION_ID" ] && [ "$TRANSITION_ID" != "null" ]; then
        curl -s -X POST \
            -u "$ATLASSIAN_EMAIL:$ATLASSIAN_API_TOKEN" \
            -H "Content-Type: application/json" \
            -d "{\"transition\": {\"id\": \"$TRANSITION_ID\"}}" \
            "https://api.atlassian.com/ex/jira/$JIRA_CLOUD_ID/rest/api/3/issue/$TICKET_KEY/transitions" > /dev/null
        log_success "Ticket moved to '$TARGET_STATUS'"
    else
        log_warn "Could not find transition '$TARGET_STATUS'. Available: $(echo "$TRANSITIONS" | jq -r '.transitions[].name' | tr '\n' ', ')"
    fi
}

# ============================================================================
# Step 4: Run Generator agent
# ============================================================================
run_generator() {
    local ITERATION=$1
    local FEEDBACK="${2:-}"
    
    log "Running Generator agent (iteration $ITERATION/$MAX_RETRIES)..."
    
    # Build the generator prompt
    GENERATOR_SYSTEM=$(cat "$AGENTS_DIR/generator-prompt.md")
    
    if [ -n "$FEEDBACK" ]; then
        GENERATOR_INPUT="## Ticket: $TICKET_KEY - $TICKET_SUMMARY

## Description & Acceptance Criteria:
$TICKET_DESCRIPTION

## VALIDATOR FEEDBACK (from previous iteration — fix these issues):
$FEEDBACK

Read the existing code, fix the issues identified by the validator, and ensure all acceptance criteria are met."
    else
        GENERATOR_INPUT="## Ticket: $TICKET_KEY - $TICKET_SUMMARY

## Description & Acceptance Criteria:
$TICKET_DESCRIPTION

Implement this ticket. Read CLAUDE.md for project context. Follow all acceptance criteria exactly."
    fi
    
    # Run the generator agent
    cd "$REPO_ROOT"
    echo "$GENERATOR_INPUT" | claude -p \
        --allowedTools "Bash,Read,Write,Edit" \
        --max-turns 50 \
        2>&1 | tee "/tmp/generator-${TICKET_KEY}-iter${ITERATION}.log"
    
    GENERATOR_EXIT=$?
    
    if [ $GENERATOR_EXIT -ne 0 ]; then
        log_error "Generator agent failed with exit code $GENERATOR_EXIT"
        return 1
    fi
    
    log_success "Generator agent completed (iteration $ITERATION)"
}

# ============================================================================
# Step 5: Run automated checks
# ============================================================================
run_checks() {
    log "Running automated checks..."
    
    local CHECKS_PASSED=true
    local CHECK_OUTPUT=""
    
    # Lint check
    if npx nx lint 2>&1; then
        log_success "✓ Lint passed"
    else
        CHECK_OUTPUT+="LINT FAILED. Fix linting errors.\n"
        CHECKS_PASSED=false
    fi
    
    # Type check
    if npx nx typecheck 2>&1; then
        log_success "✓ Typecheck passed"
    else
        CHECK_OUTPUT+="TYPECHECK FAILED. Fix type errors.\n"
        CHECKS_PASSED=false
    fi
    
    # Tests (if they exist)
    if npx nx test 2>&1; then
        log_success "✓ Tests passed"
    else
        CHECK_OUTPUT+="TESTS FAILED. Fix failing tests.\n"
        CHECKS_PASSED=false
    fi
    
    if [ "$CHECKS_PASSED" = true ]; then
        log_success "All automated checks passed"
        return 0
    else
        log_warn "Some checks failed"
        echo "$CHECK_OUTPUT"
        return 1
    fi
}

# ============================================================================
# Step 6: Run Validator agent
# ============================================================================
run_validator() {
    log "Running Validator agent..."
    
    VALIDATOR_SYSTEM=$(cat "$AGENTS_DIR/validator-prompt.md")
    
    # Get the diff of what was changed
    DIFF=$(git diff --cached --stat 2>/dev/null || git diff --stat)
    CHANGED_FILES=$(git diff --name-only HEAD 2>/dev/null || git diff --name-only)
    
    VALIDATOR_INPUT="## Ticket: $TICKET_KEY - $TICKET_SUMMARY

## Acceptance Criteria (from ticket description):
$TICKET_DESCRIPTION

## Files changed:
$CHANGED_FILES

Validate that ALL acceptance criteria are met by reviewing the implementation. 
Read each changed file and check it against the criteria.
Output your verdict as either PASS or FAIL with details."
    
    cd "$REPO_ROOT"
    VALIDATOR_OUTPUT=$(echo "$VALIDATOR_INPUT" | claude -p \
        --allowedTools "Bash,Read" \
        --max-turns 30 \
        --output-format text \
        2>&1)
    
    # Save validator output
    echo "$VALIDATOR_OUTPUT" > "/tmp/validator-${TICKET_KEY}.log"
    
    # Check if validator passed or failed
    # Look for the final verdict — the validator prompt instructs it to output
    # "VERDICT: PASS" or "VERDICT: FAIL" as the last line
    if echo "$VALIDATOR_OUTPUT" | grep -qi "VERDICT:.*PASS"; then
        log_success "Validator: PASS ✓"
        return 0
    else
        log_warn "Validator: FAIL ✗"
        # Extract the failure reasons for feedback to generator
        VALIDATION_FEEDBACK=$(echo "$VALIDATOR_OUTPUT" | grep -A 100 "VERDICT:" || echo "$VALIDATOR_OUTPUT" | tail -50)
        return 1
    fi
}

# ============================================================================
# Step 7: Create PR
# ============================================================================
create_pr() {
    log "Creating pull request..."
    
    # Stage and commit any uncommitted changes
    git add -A
    if ! git diff --cached --quiet; then
        git commit -m "feat($TICKET_KEY): $(echo "$TICKET_SUMMARY" | tr '[:upper:]' '[:lower:]')"
    fi
    
    # Push branch
    git push -u origin "$BRANCH_NAME"
    
    # Create PR
    PR_URL=$(gh pr create \
        --title "$TICKET_KEY: $TICKET_SUMMARY" \
        --body "## $TICKET_KEY: $TICKET_SUMMARY

### Description
Implements the acceptance criteria defined in [$TICKET_KEY]($JIRA_BASE_URL/browse/$TICKET_KEY).

### Acceptance Criteria
$(echo "$TICKET_DESCRIPTION" | head -100)

### Agent Log
- Generator iterations: $ITERATION
- Validator: PASS
- Automated checks: PASS (lint, typecheck, tests)

---
*This PR was created by the FinPlan Agent Orchestrator.*" \
        --assignee "@me" \
        2>&1)
    
    log_success "PR created: $PR_URL"
}

# ============================================================================
# Main orchestration loop
# ============================================================================
main() {
    log "========================================="
    log "FinPlan Agent Orchestrator"
    log "Ticket: $TICKET_KEY"
    log "========================================="
    
    # Preflight checks
    command -v claude >/dev/null 2>&1 || { log_error "claude CLI not found. Install it first."; exit 1; }
    command -v gh >/dev/null 2>&1 || { log_error "gh CLI not found. Install it first."; exit 1; }
    command -v jq >/dev/null 2>&1 || { log_error "jq not found. Install it first."; exit 1; }
    [ -n "${ATLASSIAN_EMAIL:-}" ] || { log_error "ATLASSIAN_EMAIL env var not set."; exit 1; }
    [ -n "${ATLASSIAN_API_TOKEN:-}" ] || { log_error "ATLASSIAN_API_TOKEN env var not set."; exit 1; }
    
    # Step 1: Fetch ticket
    fetch_ticket
    
    # Step 2: Create branch
    create_branch
    
    # Step 3: Move ticket to In Progress
    transition_ticket "In Progress"
    
    # Step 4-6: Generator → Checks → Validator loop
    ITERATION=0
    FEEDBACK=""
    
    while [ $ITERATION -lt $MAX_RETRIES ]; do
        ITERATION=$((ITERATION + 1))
        
        log "========================================="
        log "Iteration $ITERATION of $MAX_RETRIES"
        log "========================================="
        
        # Run generator
        run_generator "$ITERATION" "$FEEDBACK"
        
        # Stage changes for diff visibility
        git add -A
        
        # Run automated checks
        if ! run_checks; then
            CHECK_LOG=$(cat /tmp/check-output-${TICKET_KEY}.log 2>/dev/null || echo "Check output not captured")
            FEEDBACK="AUTOMATED CHECKS FAILED:\n$CHECK_LOG\n\nFix these issues before resubmitting."
            log_warn "Automated checks failed. Feeding back to generator..."
            continue
        fi
        
        # Run validator
        if run_validator; then
            log_success "========================================="
            log_success "All validations passed on iteration $ITERATION!"
            log_success "========================================="
            
            # Step 7: Create PR
            create_pr
            
            # Move ticket to review status
            transition_ticket "Done"
            
            log_success "========================================="
            log_success "COMPLETE: $TICKET_KEY"
            log_success "PR ready for your review."
            log_success "========================================="
            exit 0
        else
            FEEDBACK="$VALIDATION_FEEDBACK"
            log_warn "Validation failed. Feeding issues back to generator..."
        fi
    done
    
    log_error "========================================="
    log_error "FAILED: Max retries ($MAX_RETRIES) exhausted for $TICKET_KEY"
    log_error "Check logs in /tmp/generator-${TICKET_KEY}-*.log"
    log_error "and /tmp/validator-${TICKET_KEY}.log"
    log_error "========================================="
    
    # Leave ticket in progress for manual intervention
    exit 1
}

main