# MySQL Setup For IT Opex App

## 1. Root login
```powershell
mysql -u root -p
```

## 2. Create database and app user
Run:
```sql
SOURCE sql/mysql-root-setup.sql;
```

This creates:
- Database: `maxhealthcare_it_opex`
- App user: `it_opex_app`
- App password placeholder: `CHANGE_ME_APP_PASSWORD`

## 3. Create tables
Run:
```sql
USE maxhealthcare_it_opex;
SOURCE sql/mysql-app-schema.sql;
```

## 4. Optional CRUD examples
Run:
```sql
SOURCE sql/mysql-crud-examples.sql;
```

## 5. App environment file
Copy `.env.mysql.example` to `.env` and set your actual password:
```env
MYSQL_HOST=127.0.0.1
MYSQL_PORT=3306
MYSQL_DATABASE=maxhealthcare_it_opex
MYSQL_USER=it_opex_app
MYSQL_PASSWORD=CHANGE_ME_APP_PASSWORD
```

## 6. Start the app
```powershell
npm install
npm start
```

## 7. Health check
Open:
- `http://localhost:3000/api/health`

If MySQL is connected, response includes:
- `mysql.configured = true`
- `mysql.connected = true`

## Current DB-linked behavior
The current backend writes `POST /api/budget-submissions` into:
- local Excel file
- optional Google Sheet
- MySQL table `budget_submissions` when `.env` is configured

## Important note
The dashboard/planner/allocation browser state is still mostly frontend/local-state driven.
If you want all tabs fully DB-backed, the next step is to add API routes for:
- `planner_records`
- `allocation_records`
- location summary/report queries
