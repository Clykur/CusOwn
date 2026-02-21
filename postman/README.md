# Postman – CusOwn API

Use this collection to test **all** CusOwn APIs in a clear order with full documentation inside Postman.

---

## 1. Import

1. Open Postman.
2. **Replace or import:** File → Import → select `CusOwn-API.postman_collection.json` (replace existing “CusOwn API” if you already had it).
3. **Environment:** File → Import → select `CusOwn-Local.postman_environment.json`.
4. In the top-right dropdown, select **CusOwn Local**.

---

## 2. Collection structure (order to test)

The collection is ordered so you can test in a logical flow:

| Folder                   | What it does                                                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------------------ |
| **01 - Setup & Health**  | Run first. Health check + get CSRF token (required before most POST/PUT/PATCH/DELETE).                 |
| **02 - Auth**            | Login (browser), set role, session, sign out.                                                          |
| **03 - User**            | User state, profile (GET/PATCH), update role.                                                          |
| **04 - Salons**          | List salons, locations, salon by booking link, QR, create salon.                                       |
| **05 - Slots**           | Get slots by salon/date, create slots, get one slot, reserve, release.                                 |
| **06 - Bookings**        | Create booking, get by ID / by booking ID, list by salon, accept, reject, cancel, reschedule, no-show. |
| **07 - Businesses**      | Search, services, downtime (holidays/closures).                                                        |
| **08 - Payments**        | Initiate, verify, create, status; webhook refs (Razorpay, UPI).                                        |
| **09 - Notifications**   | Preferences (GET/PUT), history by booking.                                                             |
| **10 - Security**        | Generate signed salon URL, generate resource URL.                                                      |
| **11 - Admin**           | All admin endpoints: check status, bookings, audit, businesses, users, metrics, export, etc.           |
| **12 - Owner**           | Owner businesses, dashboard stats, analytics, no-show analytics.                                       |
| **13 - Customer**        | Customer bookings.                                                                                     |
| **14 - Cron**            | Cron jobs (expire bookings/payments, cleanup, generate slots, reminders, etc.).                        |
| **15 - Debug & Metrics** | Debug auth, metrics, metrics success.                                                                  |

Every request in the collection has a **description** in Postman (click the request name and read the right-hand panel). Each description states:

- **Purpose** – what the API does
- **Auth** – none / session / admin / owner / customer / CRON_SECRET
- **Path / Query / Body** – parameters to set

---

## 3. Variables

Set these in the collection or in the **CusOwn Local** environment:

| Variable       | Where             | Purpose                                                               |
| -------------- | ----------------- | --------------------------------------------------------------------- |
| `baseUrl`      | Environment       | API base URL, e.g. `http://localhost:3000`                            |
| `cron_secret`  | Environment       | Value of `CRON_SECRET` from `.env.local` (for **14 - Cron** requests) |
| `csrf_token`   | Collection (auto) | Set automatically when you run **01 - Get CSRF token**                |
| `salon_id`     | Collection / Env  | UUID of a salon; used in Slots, Bookings, Businesses, Admin           |
| `slot_id`      | Collection / Env  | UUID of a slot; used in Bookings, Reschedule                          |
| `booking_id`   | Collection (auto) | Set automatically after **06 - Create booking**; or set manually      |
| `booking_link` | Collection / Env  | Salon booking link slug for **04 - Salons**                           |
| `payment_id`   | Collection / Env  | Payment ID for **08 - Payment status**                                |

---

## 4. How to test

### Step 1: Setup

1. Start the app: `npm run dev`.
2. In Postman, run **01 - Setup & Health → Health**. You should get 200 and a health payload.
3. Run **01 - Setup & Health → Get CSRF token**. The script will save the token; later requests that need CSRF already use the `x-csrf-token` header.

### Step 2: Session (for protected routes)

Most folders (User, Owner, Customer, Admin, some Bookings/Slots, etc.) need a **session** (cookies):

1. In a **browser**, open `http://localhost:3000/auth/login` and sign in (e.g. Google).
2. In **Postman**, either:
   - Rely on **Send cookies automatically** (same domain `localhost`), or
   - Copy session cookies from the browser (DevTools → Application → Cookies → copy the Supabase/session cookies) and add them in Postman (Request → Cookies → Add for `localhost`).

Then run **02 - Auth → Session (current user)** to confirm you’re logged in.

### Step 3: Test in order

- Use **04 - Salons** and **05 - Slots** to get a valid `salon_id` and `slot_id` (set them in collection or env).
- Run **05 - Slots → Reserve slot** then **06 - Bookings → Create booking** (this will set `booking_id`).
- Continue with **06 - Bookings** (accept, reject, cancel, reschedule, no-show) and other folders as needed.

### Step 4: Cron (optional)

- In **CusOwn Local** environment, set `cron_secret` to your `CRON_SECRET` from `.env.local`.
- All requests in **14 - Cron** use `Authorization: Bearer {{cron_secret}}`.

### Step 5: Admin / Owner

- **11 - Admin**: log in as an **admin** user, then run Admin requests.
- **12 - Owner**: log in as an **owner**, then run Owner requests.

---

## 5. CSRF

- For **POST / PUT / PATCH / DELETE** (except **14 - Cron** and payment webhooks), you must run **01 - Get CSRF token** first.
- Requests that need CSRF already have the header `x-csrf-token`: `{{csrf_token}}`.
- Use the same `baseUrl` (e.g. `localhost`) so the CSRF cookie is sent.

---

## 6. Quick checklist

- [ ] Import collection and **CusOwn Local** environment; select environment.
- [ ] Set `baseUrl` (and `cron_secret` if testing Cron).
- [ ] Run **Health** and **Get CSRF token**.
- [ ] For protected routes: sign in via browser and send cookies in Postman.
- [ ] Set `salon_id` and `slot_id` (and optionally `booking_id`, `booking_link`, `payment_id`) when testing those flows.
- [ ] Use the **description** on each request in Postman for Purpose, Auth, and parameters.

You can now test **all** APIs through Postman in a clear, ordered way with documentation visible inside Postman.
