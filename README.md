# Brand 2 Brand — Admin Dashboard

> **Standalone admin panel** for managing the Brand 2 Brand e-commerce store. Built with Next.js 16, React 19, and Supabase. Runs independently on port 3001, fully decoupled from the customer-facing storefront.

---

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Authentication Flow](#authentication-flow)
- [Data Management Workflow](#data-management-workflow)
- [Routing & Pages](#routing--pages)
- [Dashboard Page](#dashboard-page)
- [Categories Management](#categories-management)
- [Products Management](#products-management)
- [Image Upload & Storage](#image-upload--storage)
- [Database Schema](#database-schema)
- [Middleware (Route Protection)](#middleware-route-protection)
- [Supabase Clients](#supabase-clients)
- [Styling](#styling)
- [Environment Variables](#environment-variables)
- [Getting Started](#getting-started)
- [Relationship with Storefront](#relationship-with-storefront)

---

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                   BRAND 2 BRAND ECOSYSTEM                    │
├─────────────────────────────┬────────────────────────────────┤
│  STOREFRONT (separate app)  │  ADMIN PANEL (this project)    │
│  Port: 3000                 │  Port: 3001                    │
│  d:\Brand2Brand\            │  d:\Brand2Brand-Admin\         │
│  Read-only, public          │  Full CRUD, password-protected │
└─────────────┬───────────────┴──────────────┬─────────────────┘
              │                              │
              ▼                              ▼
       ┌──────────────────────────────────────────┐
       │           SUPABASE (Shared Backend)       │
       │  ┌──────────┐  ┌──────────┐  ┌────────┐  │
       │  │PostgreSQL │  │ Storage  │  │  Auth   │  │
       │  │  (Data)   │  │ (Images) │  │(Login)  │  │
       │  └──────────┘  └──────────┘  └────────┘  │
       └──────────────────────────────────────────┘
```

This admin panel is a **completely independent Next.js application**:
- Separate folder, separate `node_modules`, separate `package.json`
- Shares the **same Supabase project** as the storefront (same database, same storage)
- Can be deployed to a separate domain (e.g., `admin.brand2brand.com`)
- Has its own authentication middleware — every route is protected

---

## Tech Stack

| Technology       | Purpose                                       |
|-----------------|-----------------------------------------------|
| **Next.js 16**   | React framework — App Router, SSR, middleware |
| **React 19**     | UI component library                          |
| **Supabase**     | PostgreSQL database, image storage, authentication |
| **@supabase/ssr**| Server-side Supabase client for Next.js       |
| **Vanilla CSS**  | Admin-specific dark theme design system       |

> No GSAP, no storefront components — this is a lean, admin-focused app.

---

## Project Structure

```
d:\Brand2Brand-Admin\
├── .env.local                     # Supabase keys + storefront URL
├── package.json                   # Scripts: dev runs on port 3001
├── next.config.mjs                # Next.js config
├── jsconfig.json                  # Path alias: @/ → src/
│
├── src/
│   ├── proxy.js                   # Middleware — route protection + auth
│   │
│   ├── lib/
│   │   └── supabase/
│   │       ├── client.js          # Browser-side Supabase client
│   │       └── server.js          # Server-side Supabase client
│   │
│   └── app/
│       ├── layout.js              # Root layout — auth check, admin chrome
│       ├── admin.css              # Complete admin design system (17KB)
│       ├── AdminLayoutClient.js   # Sidebar + topbar (client component)
│       │
│       ├── page.js                # Dashboard — stats + recent products
│       │
│       ├── login/
│       │   ├── layout.js          # Login bypass layout (no admin chrome)
│       │   └── page.js            # Login form
│       │
│       ├── categories/
│       │   └── page.js            # Category & subcategory CRUD
│       │
│       └── products/
│           ├── page.js            # Product listing with search
│           ├── new/
│           │   └── page.js        # Add new product form
│           └── [id]/
│               └── edit/
│                   └── page.js    # Edit existing product form
```

---

## Authentication Flow

The admin panel uses **Supabase Auth** with email/password login. Every route is protected except `/login`.

```
┌────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  User hits  │     │  Middleware   │     │  Has valid   │     │    Route     │
│  any URL    │────▶│  (proxy.js)  │────▶│  session?    │────▶│  renders     │
└────────────┘     └──────────────┘     └──────┬───────┘     └──────────────┘
                                               │
                                          NO   │
                                               ▼
                                        ┌──────────────┐
                                        │  Redirect to │
                                        │   /login     │
                                        └──────────────┘
```

### Step-by-step:

1. **User navigates** to any admin URL (e.g., `/products`)
2. **Middleware** (`src/proxy.js`) intercepts the request
3. Middleware creates a **server-side Supabase client** with the request cookies
4. Calls `supabase.auth.getUser()` to check the session
5. **If no user** → redirects to `/login`
6. **If user is logged in** and visits `/login` → redirects to `/` (dashboard)
7. **If user is logged in** → request proceeds normally

### Login Page Flow:

1. User enters email + password
2. Client calls `supabase.auth.signInWithPassword({ email, password })`
3. On success → `router.push('/')` + `router.refresh()` (re-runs middleware)
4. On error → displays error message (e.g., "Invalid login credentials")

### Logout Flow:

1. User clicks "Logout" in sidebar
2. Calls `supabase.auth.signOut()`
3. Redirects to `/login`
4. Refreshes the page to clear server-side session

---

## Data Management Workflow

### Complete workflow: Adding a new product

```
┌─ ADMIN PANEL ─────────────────────────────────────────────────────────────┐
│                                                                           │
│  1. Admin navigates to /products/new                                      │
│  2. Fills in product form:                                                │
│     ┌──────────────────────────────────────────────────┐                  │
│     │  Name:        [Floral Beach Shirt        ]       │                  │
│     │  Brand:       [Brand X                   ]       │                  │
│     │  Price:       [1999                      ]       │                  │
│     │  Orig Price:  [2499                      ]       │                  │
│     │  Category:    [Clothing > Shirts     ▾]          │                  │
│     │  Gender:      [Men                   ▾]          │                  │
│     │  Badge:       [NEW                   ▾]          │                  │
│     │  Sizes:       [S] [M] [L] [XL]                   │                  │
│     │  Colors:      [Black] [Navy]                     │                  │
│     │  Description: [Premium cotton shirt... ]         │                  │
│     │  Images:      [📁 Upload]                        │                  │
│     └──────────────────────────────────────────────────┘                  │
│                                                                           │
│  3. Click "Create Product"                                                │
│                                                                           │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │
                                    ▼
┌─ SUPABASE ────────────────────────────────────────────────────────────────┐
│                                                                           │
│  Step 1: Images uploaded to Storage bucket "product-images"               │
│          → Each image gets a public URL                                   │
│                                                                           │
│  Step 2: Product row inserted into "products" table                       │
│          → includes: name, brand, price, subcategory_id, sizes, etc.      │
│                                                                           │
│  Step 3: Image rows inserted into "product_images" table                  │
│          → each row: product_id, image_url, display_order                 │
│                                                                           │
└───────────────────────────────────┬───────────────────────────────────────┘
                                    │
                                    ▼
┌─ STOREFRONT (automatic) ─────────────────────────────────────────────────┐
│                                                                           │
│  On next page load, Server Components query Supabase                      │
│  → New product appears in clothing listing, homepage trending, etc.       │
│  → Images displayed from Supabase Storage public URLs                     │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

---

## Routing & Pages

| Route | Auth Required | Type | Description |
|-------|:------------:|------|-------------|
| `/login` | ❌ | Client | Email/password login form |
| `/` | ✅ | Server | Dashboard with stats and recent products |
| `/categories` | ✅ | Client | Category & subcategory CRUD management |
| `/products` | ✅ | Client | Product listing with search, toggle active, delete |
| `/products/new` | ✅ | Client | Full product creation form with image upload |
| `/products/[id]/edit` | ✅ | Client | Edit existing product, manage images |

---

## Dashboard Page

**Route:** `/` (root)  
**Type:** Server Component  

Displays an overview of the store with:

### Stat Cards (4 cards):
| Stat | Source Query |
|------|-------------|
| Total Products | `products` table — `count(*)` |
| Categories | `categories` table — `count(*)` |
| Images | `product_images` table — `count(*)` |
| Active Products | `products` table — `count(*) WHERE is_active = true` |

### Recent Products Table:
- Shows last 5 products (ordered by `created_at` descending)
- Columns: Image thumbnail, Name, Category > Subcategory, Price, Badge, Status (Active/Inactive)
- Images sourced from `product_images` (first image by `display_order`)

---

## Categories Management

**Route:** `/categories`  
**Type:** Client Component  

### Features:
- **Add Category:** Text input + button → inserts into `categories` table with auto-generated slug
- **Delete Category:** Confirmation prompt → deletes category + cascading subcategories
- **Expand/Collapse:** Accordion UI to show/hide subcategories per category
- **Add Subcategory:** Inline form within expanded category → inserts into `subcategories` table
- **Delete Subcategory:** Confirmation prompt → deletes from `subcategories` table

### Data Operations:

```
CREATE Category:
  supabase.from('categories').insert({ name, slug })

DELETE Category:
  supabase.from('categories').delete().eq('id', id)
  → Cascading: all subcategories under this category are also deleted

CREATE Subcategory:
  supabase.from('subcategories').insert({ category_id, name, slug })

DELETE Subcategory:
  supabase.from('subcategories').delete().eq('id', id)
```

### Slug Generation:
```js
slugify("Men's Clothing") → "mens-clothing"
// Lowercase, replace non-alphanumeric with hyphens, trim edge hyphens
```

---

## Products Management

### Product Listing (`/products`)

**Features:**
- **Search:** Filter by name, brand, category, or subcategory name
- **Toggle Active:** Click toggle switch to activate/deactivate product
  - Inactive products are hidden from the storefront
- **Edit:** Navigate to `/products/[id]/edit`
- **Delete:** Confirmation prompt → deletes product + images from storage

**Delete Process (with cleanup):**
```
1. Fetch all product_images for the product
2. For each image:
   a. Parse the Supabase Storage path from the URL
   b. Delete the file from storage: supabase.storage.from('product-images').remove([path])
3. Delete the product row (cascading deletes product_images rows)
```

### Product Creation (`/products/new`)

**Form Fields:**

| Field | Type | Database Column | Required |
|-------|------|----------------|:--------:|
| Name | Text input | `products.name` | ✅ |
| Brand | Text input | `products.brand` | ✅ |
| Price | Number input | `products.price` | ✅ |
| Original Price | Number input | `products.original_price` | ❌ |
| Category + Subcategory | Cascading selects | `products.subcategory_id` | ✅ |
| Gender | Select (men/women/unisex) | `products.gender` | ❌ |
| Badge | Select | `products.badge` | ❌ |
| Sizes | Tag input (type + Enter) | `products.sizes` (JSON) | ❌ |
| Colors | Tag input (type + Enter) | `products.colors` (JSON) | ❌ |
| Description | Textarea | `products.description` | ❌ |
| Atmosphere Theme | Select | `products.atmosphere_theme` | ❌ |
| Active | Checkbox | `products.is_active` | Default: true |
| Images | File upload (multiple) | `product_images` table | ❌ |

**Badge Options:** `NEW`, `BESTSELLER`, `TRENDING`, `EXCLUSIVE`, `SALE`, `LIMITED`

**Atmosphere Options:** `default`, `clothing`, `footwear`, `accessories`

**Save Process:**
```
1. Upload each image file to Supabase Storage bucket "product-images"
   → Path: products/{product-name}/{timestamp}-{filename}
   → Get public URL for each uploaded image

2. Insert product row into "products" table
   → Returns the new product ID

3. Insert image rows into "product_images" table
   → Each row: { product_id, image_url, display_order }
   → display_order = index (0, 1, 2, ...)

4. On success: redirect to /products
```

### Product Editing (`/products/[id]/edit`)

Same form as creation but pre-populated with existing data.

**Additional features:**
- View existing images with order numbers
- Remove existing images (deletes from storage + database)
- Add new images (uploaded to storage, rows added to product_images)
- Update product fields

---

## Image Upload & Storage

### Supabase Storage Bucket: `product-images`

**Upload workflow:**
```
1. User selects files via the image upload dropzone
2. Files are stored in component state as File objects
3. On form submit:
   a. Each file uploaded to: product-images/products/{product-name}/{timestamp}-{filename}
   b. supabase.storage.from('product-images').upload(path, file)
   c. Get public URL: supabase.storage.from('product-images').getPublicUrl(path)
   d. URL stored in product_images table
```

**Image preview:**
- Before upload: Client-side preview using `URL.createObjectURL(file)`
- After upload: Display from Supabase public URL
- Order badge showing display order (1, 2, 3...)
- Remove button (X) to delete individual images

**Image deletion:**
```
1. Parse storage path from public URL
2. Delete from storage: supabase.storage.from('product-images').remove([path])
3. Delete row from product_images table
```

---

## Database Schema

### Tables (same database as storefront)

```sql
-- Categories (top-level groupings)
CREATE TABLE categories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Subcategories (nested under categories)
CREATE TABLE subcategories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  slug        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Products
CREATE TABLE products (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcategory_id   UUID REFERENCES subcategories(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  brand            TEXT,
  gender           TEXT,              -- 'men', 'women', 'unisex'
  price            NUMERIC NOT NULL,
  original_price   NUMERIC,
  description      TEXT,
  sizes            JSONB DEFAULT '[]', -- ["S","M","L","XL"]
  colors           JSONB DEFAULT '[]', -- ["Black","Navy"]
  badge            TEXT,              -- 'NEW', 'BESTSELLER', etc.
  atmosphere_theme TEXT DEFAULT 'default',
  is_active        BOOLEAN DEFAULT true,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Product Images
CREATE TABLE product_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    UUID REFERENCES products(id) ON DELETE CASCADE,
  image_url     TEXT NOT NULL,
  display_order INTEGER DEFAULT 0
);
```

### Cascade Rules:
- Delete category → all subcategories deleted
- Delete subcategory → products set `subcategory_id = NULL`
- Delete product → all product_images deleted

---

## Middleware (Route Protection)

### `src/proxy.js`

The middleware is the admin's security layer. It runs on **every request** and enforces authentication.

```
Request arrives
    │
    ▼
Create Supabase server client with request cookies
    │
    ▼
Call supabase.auth.getUser()
    │
    ├── User exists + visiting /login → REDIRECT to /
    ├── User exists + any other route → ALLOW (pass through)
    └── No user + NOT /login → REDIRECT to /login
         No user + /login → ALLOW (show login page)
```

**Cookie handling:**
- Reads cookies from request via `request.cookies.getAll()`
- Sets cookies on response via `supabaseResponse.cookies.set()`
- This keeps the auth session alive across requests

**Matcher pattern:**
- Matches all routes except: `_next/static`, `_next/image`, `favicon.ico`, and common asset extensions

---

## Supabase Clients

### Server Client (`src/lib/supabase/server.js`)
```js
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
```
- Used in **Server Components** (layout.js, page.js — dashboard)
- Reads cookies from `next/headers` for session management
- Used to check auth status and fetch data for SSR pages

### Browser Client (`src/lib/supabase/client.js`)
```js
import { createBrowserClient } from '@supabase/ssr';
```
- Used in **Client Components** (login, categories, products, etc.)
- Manages auth (login/logout) and all CRUD operations
- Handles storage uploads for product images

---

## Styling

### `src/app/admin.css` (17KB)

Complete, self-contained admin design system. **No storefront CSS is used.**

**Design Tokens (CSS Custom Properties):**
```css
:root {
  --admin-bg: #0f0f13;              /* Dark background */
  --admin-surface: #1a1a23;          /* Card/panel background */
  --admin-surface-hover: #22222e;    /* Hover state */
  --admin-border: #2a2a38;           /* Borders */
  --admin-text: #e8e8ef;             /* Primary text */
  --admin-text-muted: #8888a0;       /* Secondary text */
  --admin-accent: #c41230;           /* Brand red */
  --admin-accent-hover: #e0143a;     /* Brand red hover */
  --admin-success: #22c55e;          /* Green */
  --admin-warning: #f59e0b;          /* Yellow */
  --admin-danger: #ef4444;           /* Red */
  --admin-sidebar-width: 260px;
  --admin-topbar-height: 64px;
  --admin-radius: 8px;
  --admin-radius-lg: 12px;
  --admin-font: 'Inter', sans-serif;
}
```

**Component Styles:**
| Component | CSS Classes | Description |
|-----------|------------|-------------|
| Layout | `.admin-layout`, `.admin-main` | Flex layout with fixed sidebar |
| Sidebar | `.admin-sidebar`, `.admin-nav-link` | 260px fixed sidebar with navigation |
| Topbar | `.admin-topbar`, `.admin-topbar-title` | 64px sticky header with page title + user info |
| Stat Cards | `.admin-stats-grid`, `.admin-stat-card` | 4-column grid with hover lift effect |
| Data Table | `.admin-table-wrapper`, `.admin-table` | Full-width table with hover rows |
| Buttons | `.admin-btn-primary`, `.admin-btn-danger` | Red primary, styled secondary/danger |
| Forms | `.admin-form-input`, `.admin-form-select` | Dark-themed form controls |
| Tags | `.admin-tags`, `.admin-tag` | Tag input for sizes/colors |
| Image Upload | `.admin-image-upload`, `.admin-image-preview` | Dashed dropzone + preview grid |
| Badges | `.admin-badge-green`, `.admin-badge-red` | Status indicator pills |
| Toast | `.admin-toast` | Fixed position notification |
| Search | `.admin-search` | Input with search icon |
| Categories | `.admin-category-card` | Accordion cards for category tree |
| Login | `.admin-login-page`, `.admin-login-card` | Centered login card |

**Responsive:** Sidebar collapses on mobile (< 768px). Form rows stack vertically.

---

## Environment Variables

Create a `.env.local` file in the project root:

```env
# Supabase Configuration (same keys as storefront — shared database)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Link back to storefront
NEXT_PUBLIC_STOREFRONT_URL=http://localhost:3000
```

| Variable | Visibility | Purpose |
|----------|-----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Full database access |
| `NEXT_PUBLIC_STOREFRONT_URL` | Public | "View Storefront" link in sidebar |

---

## Getting Started

### Prerequisites
- Node.js 18+
- npm
- A Supabase account with the database schema set up

### Installation

```bash
# Navigate to the admin folder
cd d:\Brand2Brand-Admin

# Install dependencies
npm install

# Create environment file
# Copy .env.local from the storefront and add NEXT_PUBLIC_STOREFRONT_URL
cp ../Brand2Brand/.env.local .env.local
echo "NEXT_PUBLIC_STOREFRONT_URL=http://localhost:3000" >> .env.local

# Start development server
npm run dev
```

The admin panel will be available at **http://localhost:3001**

### Running Both Apps Simultaneously

```bash
# Terminal 1 — Storefront
cd d:\Brand2Brand
npm run dev    # → http://localhost:3000

# Terminal 2 — Admin
cd d:\Brand2Brand-Admin
npm run dev    # → http://localhost:3001
```

### Build for Production

```bash
npm run build
npm start -- --port 3001
```

---

## Relationship with Storefront

| Aspect | This Admin Panel | Storefront |
|--------|-----------------|------------|
| **Location** | `d:\Brand2Brand-Admin\` | `d:\Brand2Brand\` |
| **Port** | 3001 | 3000 |
| **Access** | Password-protected (Supabase Auth) | Public |
| **Database** | Full CRUD (read + write) | Read-only |
| **Storage** | Uploads + deletes images | Reads image URLs |
| **Auth** | Login required for all routes | No auth required |
| **Design** | Dark admin theme (admin.css) | Cinematic storefront (globals.css) |
| **Components** | Sidebar, tables, forms | Header, product cards, cart |
| **Framework** | Next.js 16 (lean) | Next.js 16 + GSAP |

### Admin Sidebar Links:
- **Dashboard** → `/`
- **Categories** → `/categories`
- **Products** → `/products`
- **View Storefront** → Opens `http://localhost:3000` in new tab (so admin can preview changes)
- **Logout** → Signs out and redirects to `/login`

---

## License

Private project — Brand 2 Brand, Visakhapatnam.
