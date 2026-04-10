# Multi-Shop Implementation Plan

## Overview

Add support for a single user account managing multiple independent shops (businesses or locations). Each shop has its own isolated inventory, suppliers, customers, invoices, expenses, and purchase orders. Users can switch between shops from the UI without logging out.

---

## Current State

| Area | Current behaviour |
|---|---|
| Tenancy | Single-tenant — all data is global |
| Shop info | Stored in browser `localStorage` (not DB) |
| Users | Global `is_owner` flag, not scoped to a shop |
| Invoice numbers | Globally unique sequence (`INV-0001`) |
| Auth | JWT contains only `user_id` |

---

## Target Architecture

```
User (global account)
 └── ShopMember (role: owner | staff)
      └── Shop
           ├── Products / Categories
           ├── Suppliers / Purchase Orders / Payments
           ├── Customers / Invoices
           └── Expenses
```

- A **User** can belong to many shops with different roles.
- One user can be **owner** of Shop A and **staff** in Shop B.
- All data rows carry a `shop_id` — every query is scoped to the active shop.
- The active shop is communicated via an `X-Shop-Id` request header.
- No re-authentication needed to switch shops.

---

## Phase 1 — Database Schema

### 1.1 New tables

#### `shops`
```sql
id          UUID PRIMARY KEY
name        VARCHAR(150) NOT NULL
tagline     VARCHAR(200)
address     TEXT
phone       VARCHAR(20)
email       VARCHAR(150)
gstin       VARCHAR(20)          -- GST number, printed on invoices
created_at  TIMESTAMPTZ DEFAULT now()
```

#### `shop_members`
```sql
id         UUID PRIMARY KEY
shop_id    UUID REFERENCES shops(id) ON DELETE CASCADE
user_id    UUID REFERENCES users(id) ON DELETE CASCADE
role       VARCHAR(20) DEFAULT 'staff'   -- 'owner' | 'staff'
created_at TIMESTAMPTZ DEFAULT now()
UNIQUE (shop_id, user_id)
```

### 1.2 Add `shop_id` to existing tables

Every table below gets:
```sql
shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE RESTRICT
```

| Table | Notes |
|---|---|
| `products` | Add index on `(shop_id, is_active)` |
| `categories` | Category names are per-shop |
| `suppliers` | Supplier accounts are per-shop |
| `customers` | Customer phone uniqueness becomes per-shop |
| `invoices` | Invoice number uniqueness becomes per-shop |
| `expenses` | — |
| `purchase_orders` | PO number uniqueness becomes per-shop |

Tables that **do not** need `shop_id` (they inherit via FK or are app-level):

| Table | Reason |
|---|---|
| `invoice_items` | Scoped through `invoices.shop_id` |
| `stock_movements` | Scoped through `products.shop_id` |
| `purchase_order_items` | Scoped through `purchase_orders.shop_id` |
| `supplier_payments` | Scoped through `suppliers.shop_id` |
| `users` | Global accounts, membership via `shop_members` |
| `support_tickets` | App-level, not shop data |
| `contact_leads` | App-level, not shop data |

### 1.3 Invoice number uniqueness change

Remove the global unique constraint on `invoices.invoice_number`.
Add a composite unique constraint: `UNIQUE (shop_id, invoice_number)`.

Same for `purchase_orders.po_number`: `UNIQUE (shop_id, po_number)`.

### 1.4 Migration steps (zero-downtime approach)

```
Step 1: Create shops table
Step 2: Insert one default shop using existing localStorage shop info as seed
Step 3: Create shop_members table, add all existing users as members of the default shop
        (existing owners → role='owner', others → role='staff')
Step 4: Add shop_id columns as NULLABLE to all tables
Step 5: UPDATE all rows SET shop_id = <default_shop_id>
Step 6: ALTER columns to NOT NULL
Step 7: Drop old unique constraints, add composite ones
Step 8: Add new indexes on shop_id
```

---

## Phase 2 — Backend Changes

### 2.1 New models

**`app/models/shop.py`**
```python
class Shop(Base):
    id, name, tagline, address, phone, email, gstin, created_at

class ShopMember(Base):
    id, shop_id, user_id, role, created_at
```

### 2.2 Auth changes — `app/dependencies.py`

Add a new dependency `get_current_shop` that:
1. Reads the `X-Shop-Id` header from the request
2. Validates the current user is a member of that shop
3. Returns the `(User, Shop, role)` tuple

```python
async def get_current_shop(
    x_shop_id: str = Header(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> tuple[User, Shop, str]:
    member = await db.execute(
        select(ShopMember)
        .where(ShopMember.shop_id == x_shop_id)
        .where(ShopMember.user_id == current_user.id)
    )
    if not member:
        raise HTTPException(403, "Not a member of this shop")
    return current_user, member.shop, member.role
```

Add a helper:
```python
async def require_owner(shop_ctx = Depends(get_current_shop)):
    _, _, role = shop_ctx
    if role != "owner":
        raise HTTPException(403, "Owner access required")
```

### 2.3 New routes — `app/routers/shops.py`

```
GET    /shops                 — list shops the current user belongs to
POST   /shops                 — create a new shop (user becomes owner)
GET    /shops/{id}            — get shop detail
PUT    /shops/{id}            — update shop info (owner only)
GET    /shops/{id}/members    — list members (owner only)
POST   /shops/{id}/members    — invite/add a user to the shop (owner only)
PATCH  /shops/{id}/members/{user_id}  — change role (owner only)
DELETE /shops/{id}/members/{user_id}  — remove member (owner only)
```

### 2.4 Changes to all existing routers

Every router gets `shop_ctx = Depends(get_current_shop)` instead of just `_=Depends(get_current_user)`. All queries gain a `.where(Model.shop_id == shop_id)` filter.

Files to update:
- `routers/products.py`
- `routers/categories.py`
- `routers/suppliers.py`
- `routers/purchase_orders.py`
- `routers/customers.py`
- `routers/invoices.py`
- `routers/expenses.py`
- `routers/dashboard.py`

`routers/users.py` → becomes `routers/members.py`, scoped to a shop.

### 2.5 Invoice / PO number generation

Change from global counter to per-shop counter:

```python
async def _next_invoice_number(db, shop_id) -> str:
    count = await db.scalar(
        select(func.count()).select_from(Invoice)
        .where(Invoice.shop_id == shop_id)
    )
    return f"INV-{count + 1:04d}"
```

### 2.6 Shop info — move from localStorage to DB

The `shops` table stores `name`, `tagline`, `address`, `phone`, `email`, `gstin`.  
The Settings page writes to `PUT /shops/{id}` instead of `localStorage`.  
Invoice printing reads from the API (cached in React Query) instead of `localStorage`.

---

## Phase 3 — Frontend Changes

### 3.1 Shop store — `src/features/shops/store/shop.store.ts`

```typescript
interface ShopStore {
  shops: Shop[]          // all shops the user belongs to
  activeShop: Shop | null
  setShops: (shops: Shop[]) => void
  setActiveShop: (shop: Shop) => void
}
```

Persisted to `localStorage` (just the `activeShopId`).

### 3.2 API client — `src/lib/api-client.ts`

Add a request interceptor that injects `X-Shop-Id`:

```typescript
apiClient.interceptors.request.use((config) => {
  const shopId = useShopStore.getState().activeShop?.id
  if (shopId) config.headers['X-Shop-Id'] = shopId
  return config
})
```

### 3.3 Shop selector — `src/features/shops/components/ShopSwitcher.tsx`

Dropdown in the sidebar header (replaces or extends the current app logo/name area):

```
┌─────────────────────────────┐
│ 🏪 Sharma General Store  ▼  │  ← click to open
├─────────────────────────────┤
│   Sharma General Store   ✓  │
│   City Wholesale            │
│   ─────────────────────     │
│   + Create New Shop         │
└─────────────────────────────┘
```

### 3.4 Bootstrap flow on login

```
1. User logs in → receives JWT (user-scoped, no shop in token)
2. App calls GET /shops
3. If user has 1 shop → auto-select it, proceed
4. If user has multiple shops → show ShopSwitcher picker before showing app
5. If user has 0 shops → show "Create your first shop" onboarding screen
6. Active shop ID saved to localStorage for next visit
```

### 3.5 Settings page changes

- **Shop Information** section now calls `PUT /api/v1/shops/{id}` (persisted to DB)
- **User Management** section becomes **Members** — lists shop members, not global users
- Adding a user now means "add existing user to this shop" or "invite by email"
- Role per shop: owner vs staff (replaces global `is_owner` flag)

### 3.6 New pages / components

| Component | Purpose |
|---|---|
| `ShopSwitcher` | Dropdown in sidebar to switch active shop |
| `CreateShopSheet` | Form to create a new shop |
| `MembersSettings` | Manage shop members (replaces UserManagement) |
| `ShopOnboarding` | Shown when user has no shops yet |

---

## Phase 4 — Auth model simplification

Once shops are in place, the global `is_owner` flag on `User` becomes redundant. Replace with shop-level `role` from `ShopMember`:

| Before | After |
|---|---|
| `user.is_owner` | `member.role === 'owner'` |
| Owner sees dashboard, suppliers, customers | Owner role in active shop grants same access |
| `OwnerOnly` route guard | `RequireRole('owner')` route guard using active shop context |

The migration: keep `users.is_owner` during transition. Remove it in a follow-up migration after the new role system is live.

---

## Implementation Order

```
Week 1 — Backend foundation
  ├── Create Shop + ShopMember models
  ├── Write migration (default shop, backfill shop_id)
  ├── Update auth dependencies (get_current_shop)
  └── New /shops router (CRUD + members)

Week 2 — Backend data scoping
  ├── Update all routers to use shop_id
  ├── Update invoice/PO number generation
  └── Move shop info from localStorage contract to DB

Week 3 — Frontend core
  ├── Shop store + API client interceptor
  ├── ShopSwitcher component
  ├── Bootstrap flow (login → shop selection)
  └── Protect all API calls with X-Shop-Id

Week 4 — Frontend polish
  ├── Settings page (shop info from API, members tab)
  ├── Create Shop flow
  ├── Onboarding screen
  └── Remove localStorage invoice settings dependency
```

---

## Key Decisions & Trade-offs

| Decision | Choice | Reason |
|---|---|---|
| Shop context in requests | `X-Shop-Id` header | No re-auth to switch; simpler than embedding in JWT |
| Invoice number scope | Per-shop (`INV-0001` resets per shop) | Avoids gaps, natural for each business |
| Categories | Per-shop | Different shops may sell completely different things |
| Users | Global accounts | One login, access to all your shops |
| `is_owner` flag | Keep during transition, remove after | Backward compatibility during rollout |

---

## Files Created / Modified (Summary)

### Backend — New
- `app/models/shop.py`
- `app/routers/shops.py`
- `alembic/versions/<hash>_add_multi_shop.py`

### Backend — Modified
- `app/dependencies.py` — new `get_current_shop`, `require_owner`
- `app/routers/products.py`, `categories.py`, `suppliers.py`, `customers.py`, `invoices.py`, `expenses.py`, `purchase_orders.py`, `dashboard.py`
- `app/models/__init__.py`
- `app/main.py`

### Frontend — New
- `src/features/shops/store/shop.store.ts`
- `src/features/shops/api/shops.api.ts`
- `src/features/shops/components/ShopSwitcher.tsx`
- `src/features/shops/components/CreateShopSheet.tsx`
- `src/features/shops/pages/ShopOnboarding.tsx`

### Frontend — Modified
- `src/lib/api-client.ts` — inject `X-Shop-Id` header
- `src/app/router.tsx` — add shop guard, onboarding route
- `src/components/app-sidebar.tsx` — add ShopSwitcher
- `src/features/settings/pages/SettingsPage.tsx` — shop info from API, members tab
- `src/features/auth/` — bootstrap flow post-login
