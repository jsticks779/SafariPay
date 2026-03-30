#!/bin/bash
set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
log()  { echo -e "${GREEN}✅ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠️  $1${NC}"; }
err()  { echo -e "${RED}❌ $1${NC}"; exit 1; }
info() { echo -e "${CYAN}→  $1${NC}"; }

echo ""
echo -e "${CYAN}🦁 SafariPay — Setup${NC}"
echo "================================"
echo ""

# Node check
command -v node &>/dev/null || err "Node.js not found. Install from https://nodejs.org (v18+)"
NODE_VER=$(node -v | sed 's/v//' | cut -d. -f1)
[ "$NODE_VER" -lt 18 ] && err "Node.js v18+ required. Current: $(node -v)"
log "Node.js $(node -v)"

# npm check
command -v npm &>/dev/null || err "npm not found"
log "npm $(npm -v)"

# PostgreSQL check
if command -v psql &>/dev/null; then
  log "PostgreSQL found: $(psql --version | head -1)"
else
  warn "psql not found in PATH — make sure PostgreSQL is running on port 5432"
fi

# Install backend
echo ""
info "Installing backend dependencies..."
cd backend && npm install
log "Backend ready"
cd ..

# Install frontend
echo ""
info "Installing frontend dependencies..."
cd frontend && npm install
log "Frontend ready"
cd ..

# Import database
echo ""
if command -v psql &>/dev/null; then
  info "Setting up PostgreSQL..."
  psql postgres -c "CREATE USER safaripay WITH PASSWORD 'safaripay123';" 2>/dev/null && log "DB user created" || warn "User may already exist — OK"
  psql postgres -c "CREATE DATABASE safaripay OWNER safaripay;" 2>/dev/null && log "DB created" || warn "Database may already exist — OK"
  psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE safaripay TO safaripay;" 2>/dev/null

  info "Importing schema and demo data..."
  if psql -U safaripay -d safaripay -f database/safaripay_database.sql; then
    log "Database imported successfully!"
  else
    warn "Auto-import failed. Run manually:"
    warn "  psql -U safaripay -d safaripay -f database/safaripay_database.sql"
  fi
else
  warn "Skipping database setup — psql not found."
  echo ""
  echo "  Run manually after starting PostgreSQL:"
  echo "  psql -U safaripay -d safaripay -f database/safaripay_database.sql"
fi

echo ""
echo "================================"
log "Setup complete!"
echo ""
echo "  Start backend  →  cd backend  && npm run dev"
echo "  Start frontend →  cd frontend && npm start"
echo ""
echo "  App:  http://localhost:3000"
echo "  API:  http://localhost:4000/health"
echo ""
echo "  Demo login: +255712345678 / PIN: 1234"
echo ""
