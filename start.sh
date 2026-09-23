#!/usr/bin/env bash

# ==============================================================================
# WoWs Info - One-Command Quick Launch Orchestrator
# Launches Option B background sync daemon (port 3001) and Vite web app (port 5173)
# ==============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Color Codes for Terminal Output
BOLD='\033[1m'
GOLD='\033[38;5;214m'
CYAN='\033[38;5;45m'
GREEN='\033[38;5;82m'
RED='\033[38;5;196m'
GRAY='\033[38;5;244m'
RESET='\033[0m'

# 1. Environment Verification
if ! command -v node >/dev/null 2>&1; then
  echo -e "${RED}[ERROR] Node.js is required but was not found in PATH.${RESET}" >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo -e "${RED}[ERROR] npm is required but was not found in PATH.${RESET}" >&2
  exit 1
fi

NODE_VERSION=$(node -v)

# 2. Dependency Check
if [ ! -d "node_modules" ]; then
  echo -e "${GRAY}Installing dependencies...${RESET}"
  npm install
fi

# 3. Build Check (Compile if dist/ is missing)
if [ ! -f "dist/index.html" ]; then
  echo -e "${CYAN}Production bundle not detected. Building application with 'npm run build'...${RESET}"
  npm run build
fi

# Configuration Ports
SYNC_PORT="${SYNC_PORT:-3001}"
VITE_PORT="${VITE_PORT:-5173}"

SYNC_PID=""
VITE_PID=""

# Graceful termination trap for SIGINT and SIGTERM
cleanup() {
  echo ""
  echo -e "${GOLD}Shutting down WoWs Info services...${RESET}"
  if [ -n "$SYNC_PID" ] && kill -0 "$SYNC_PID" 2>/dev/null; then
    kill -TERM "$SYNC_PID" 2>/dev/null || true
  fi
  if [ -n "$VITE_PID" ] && kill -0 "$VITE_PID" 2>/dev/null; then
    kill -TERM "$VITE_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
  echo -e "${GREEN}All services terminated cleanly. Goodbye!${RESET}"
  exit 0
}

trap cleanup SIGINT SIGTERM EXIT

# 4. Start Option B Background Sync Daemon (Port 3001)
echo -e "${GRAY}Starting Option B Armory Sync Daemon on port ${SYNC_PORT}...${RESET}"
PORT="$SYNC_PORT" node server/sync_service.mjs &
SYNC_PID=$!

# Brief pause to verify sync service startup
sleep 0.8
if ! kill -0 "$SYNC_PID" 2>/dev/null; then
  echo -e "${RED}[WARNING] Sync daemon failed to initialize on port ${SYNC_PORT}. Operating in offline/local dataset mode.${RESET}"
  SYNC_PID=""
fi

# 5. Formatted Launch Banner
echo -e "${GOLD}"
echo "================================================================================"
echo "    ⚓  WORLD OF WARSHIPS SHIP INFORMATION PLATFORM (WoWs Info)  ⚓"
echo "================================================================================"
echo -e "${RESET}"
echo -e "  ${BOLD}Web Application:${RESET}        ${CYAN}http://localhost:${VITE_PORT}/${RESET}"
echo -e "  ${BOLD}Armory Sync Service:${RESET}    ${CYAN}http://localhost:${SYNC_PORT}/api/status${RESET}"
echo -e "  ${BOLD}Data Architecture:${RESET}      ${GREEN}Option B (Hybrid Offline-First + Auto Sync)${RESET}"
echo -e "  ${BOLD}Node Environment:${RESET}       ${GRAY}${NODE_VERSION}${RESET}"
echo -e "  ${BOLD}PWA Offline Caching:${RESET}    ${GREEN}Enabled (Service Worker active)${RESET}"
echo ""
echo -e "  ${BOLD}Direct Navigation Links:${RESET}"
echo -e "   • Parameters Matrix:    ${CYAN}http://localhost:${VITE_PORT}/params${RESET}"
echo -e "   • Armory & Acquisition: ${CYAN}http://localhost:${VITE_PORT}/armory${RESET}"
echo -e "   • Server Statistics:    ${CYAN}http://localhost:${VITE_PORT}/stats${RESET}"
echo -e "   • Ship Duel & Compare:  ${CYAN}http://localhost:${VITE_PORT}/compare${RESET}"
echo ""
echo -e "${GRAY}--------------------------------------------------------------------------------${RESET}"
echo -e "${BOLD}Press Ctrl+C to cleanly stop both web app and sync daemon.${RESET}"
echo -e "${GRAY}--------------------------------------------------------------------------------${RESET}"
echo ""

# 6. Launch Vite Web Application (Production Preview on Port 5173)
if [ "$1" == "--dev" ]; then
  npx vite --port "$VITE_PORT" --host &
  VITE_PID=$!
else
  npx vite preview --port "$VITE_PORT" --host &
  VITE_PID=$!
fi

# Await foreground process
wait "$VITE_PID"
