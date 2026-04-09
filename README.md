
  ---
  1. Start Postgres
  # Make sure Docker Desktop is open, then:
  docker compose up -d

  2. Run the migration
  cd backend
  source .venv/bin/activate
  alembic revision --autogenerate -m "init"
  alembic upgrade head
  python seed.py

  3. Start the API

  API docs at http://localhost:8000/docs

  4. Start the frontend
  cd ../frontend
  npm run dev
  App at http://localhost:5173

  Login credentials (from seed):
  - owner@shop.com / owner123
  - staff@shop.com / staff123
                                                            
  ---                                           
  What's in Phase 1:                                        
  - ✅ FastAPI with all 4 modules (auth, products, categories,
  suppliers)                                                  
  - ✅ adjust_stock() — all stock changes transactional + StockMovement
   audit trail                                                         
  - ✅ React + Vite + Tailwind + shadcn/ui wired up                    
  - ✅ Login page, sidebar layout, products list with low-stock badges
  and stock-in action  