# Issues Report — Group 3 · DermaSmart

> Nguồn: `Group3_DermaSmart_IssuesReport.xlsx` — sheet **Issues Report** (20 issues)

## Bảng tổng hợp

| Title | Description | Issue ID | URL | State | Assignee | Created At | Due Date | Milestone | Labels | Functions/Screens |
|---|---|---|---|---|---|---|---|---|---|---|
| Write code for User Authentication & RLS | Implement Supabase Auth, login/register forms, and RLS policies for 5 roles | 1 | HungBB-1808/Dermatology_Clinic_Management_System at main | Closed | HungBB-1808 | 2026-07-01 | 2026-07-04 | iter1 | Task, 3_Done | User Authentication & Login |
| Integrate PayOS Payment Gateway & Slot Locking | Implement online appointment booking flow with 50,000 VND deposit fee via PayOS API | 2 | HungBB-1808/Dermatology_Clinic_Management_System at feature/receptionist-payment-status | Closed | HungBB-1808 | 2026-07-05 | 2026-07-08 | iter1 | Feature, 3_Done | Patient Booking & PayOS Gateway |
| Develop Free Skin Scan AI Modal | Build skin analysis feature using MediaPipe face mesh and Gemini AI for acne/dark spot detection | 3 | HungBB-1808/Dermatology_Clinic_Management_System at feature/ai-skin-scan | Closed | ThNhan113 | 2026-07-08 | 2026-07-12 | iter2 | Feature, 3_Done | Free Skin Scan (Skin Analyzer) |
| Fix FreeSkinScanModal crash and connection | Import missing useAuth hook and optimize Edge Function payload to prevent crash on scan submit | 4 | HungBB-1808/Dermatology_Clinic_Management_System at feature/fix-ai-scan-connection | Closed | HungBB-1808 | 2026-07-14 | 2026-07-14 | iter2 | Bug, 3_Done | Free Skin Scan Modal |
| Build Receptionist Chat Workspace | Add dedicated chat workspace for receptionist to manage patient inquiries and live agent handover | 5 | HungBB-1808/Dermatology_Clinic_Management_System at feature/receptionist-chat-workspace | Closed | HungBB-1808 | 2026-07-09 | 2026-07-12 | iter2 | Feature, 3_Done | Receptionist Chat Workspace |
| Implement Receptionist Live Check-in Flow | Remove manual approval queue and build live patient check-in flow with status update | 6 | HungBB-1808/Dermatology_Clinic_Management_System at feature/receptionist-approve-appointment | Closed | HungBB-1808 | 2026-07-12 | 2026-07-14 | iter2 | Task, 3_Done | Receptionist Live Check-in |
| Build Technician Procedure Review Interface | Create procedure review view for technicians to inspect doctor treatment orders before execution | 7 | HungBB-1808/Dermatology_Clinic_Management_System at feature/technician-procedure-review | Closed | ThanhLuan | 2026-07-10 | 2026-07-13 | iter2 | Task, 3_Done | Technician Procedure Review |
| Implement Technician Complete Task Action | Allow technicians to confirm treatment procedure completion and log technical execution notes | 8 | HungBB-1808/Dermatology_Clinic_Management_System at feature/technician-complete-task | Closed | ThanhLuan | 2026-07-13 | 2026-07-14 | iter2 | Task, 3_Done | Technician Service Tickets |
| Fix Doctor Dashboard & EMR Flow | Fix patient vitals display, auto-save EMR draft, and resolve schedule loading freeze on Doctor Dashboard | 9 | HungBB-1808/Dermatology_Clinic_Management_System at fix-doctor-dashboard | Closed | HungBB-1808 | 2026-07-13 | 2026-07-15 | iter2 | Feature, 3_Done | Doctor EMR Management |
| Restrict Doctor Direct Patient Chat Access | Enforce privacy scoping policies to restrict direct doctor chat access outside assigned clinic consultations | 10 | HungBB-1808/Dermatology_Clinic_Management_System at feature/restrict-doctor-chat | Closed | HungBB-1808 | 2026-07-14 | 2026-07-15 | iter3 | Task, 3_Done | Doctor Consultation & Chat Privacy |
| Develop Admin Revenue Statistics & KPI Charts | Build revenue statistics page with SVG donut charts, service stats, trends, and transaction history | 11 | HungBB-1808/Dermatology_Clinic_Management_System at feature/admin-revenue-statistics | Closed | nnhut422-ship-it | 2026-07-14 | 2026-07-15 | iter3 | Feature, 3_Done | Admin Revenue Reports |
| Develop Admin Employee Account Management | Build employee CRUD management, account lock/unlock controls, and role-based feedback visibility | 12 | HungBB-1808/Dermatology_Clinic_Management_System at feature/admin-employee-management | Closed | nnhut422-ship-it | 2026-07-15 | 2026-07-17 | iter3 | Feature, 3_Done | Admin Staff Management |
| Develop Admin Voucher & Discount Management | Build voucher creation, discount code management, and expiration tracking interfaces | 13 | HungBB-1808/Dermatology_Clinic_Management_System at feature/admin-voucher-management | Closed | ThNhan113 | 2026-07-15 | 2026-07-16 | iter3 | Feature, 3_Done | Admin Voucher Management |
| Develop Admin Doctor Schedule Configuration | Build shift calendar setup view for clinic managers to configure doctor work shifts and off days | 14 | HungBB-1808/Dermatology_Clinic_Management_System at feature/admin-doctor-schedule | Closed | HungBB-1808 | 2026-07-15 | 2026-07-16 | iter3 | Task, 3_Done | Admin Doctor Schedule |
| Develop Full Function Patient Portal | Build comprehensive patient portal for appointment management, EMR medical history, and AI scan records | 15 | HungBB-1808/Dermatology_Clinic_Management_System at Full_Function_Patient | Closed | ThNhan113 | 2026-07-14 | 2026-07-16 | iter3 | Feature, 3_Done | Patient Portal Dashboard |
| Simplify Booking Flow (Remove Service Select) | Refactor appointment booking flow to allow flexible doctor selection without pre-selecting service items | 16 | HungBB-1808/Dermatology_Clinic_Management_System at feature/remove-booking-service-selection | Closed | HungBB-1808 | 2026-07-15 | 2026-07-15 | iter3 | Improvement, 3_Done | Patient Booking Flow |
| Develop Receptionist Profile & Shift View | Build profile management and shift schedule view for clinic receptionist staff | 17 | HungBB-1808/Dermatology_Clinic_Management_System at feature/receptionist | Closed | ThNhan113 | 2026-07-15 | 2026-07-15 | iter3 | Task, 3_Done | Receptionist Profile |
| Implement CRUD Operations for Admin Module | Implement base CRUD controllers and models for system services, medications, and clinic user roles | 18 | HungBB-1808/Dermatology_Clinic_Management_System at CRUD-Admin | Closed | ThNhan113 | 2026-07-12 | 2026-07-14 | iter2 | Task, 3_Done | Admin CRUD Services & Drugs |
| Integrate Brevo Transactional Email System | Build Edge Function send-clinic-email using Brevo API with Resend fallback for email notifications | 19 | HungBB-1808/Dermatology_Clinic_Management_System at main | Closed | HungBB-1808 | 2026-07-15 | 2026-07-16 | iter3 | Feature, 3_Done | Email Notification System |
| Implement Staff Timesheet & GlassPagination | Add staff timesheet (Chấm công) tracking tab and frosted glass pagination controls across tables | 20 | HungBB-1808/Dermatology_Clinic_Management_System at main | Closed | HungBB-1808 | 2026-07-16 | 2026-07-17 | iter3 | Feature, 3_Done | Staff Profile & Timesheet |

## Chi tiết từng issue

### #1 — Write code for User Authentication & RLS

Implement Supabase Auth, login/register forms, and RLS policies for 5 roles

- **State:** Closed
- **Assignee:** HungBB-1808
- **Milestone:** iter1
- **Labels:** Task, 3_Done
- **Created At:** 2026-07-01 · **Due Date:** 2026-07-04
- **Functions/Screens:** User Authentication & Login
- **URL:** HungBB-1808/Dermatology_Clinic_Management_System at main

### #2 — Integrate PayOS Payment Gateway & Slot Locking

Implement online appointment booking flow with 50,000 VND deposit fee via PayOS API

- **State:** Closed
- **Assignee:** HungBB-1808
- **Milestone:** iter1
- **Labels:** Feature, 3_Done
- **Created At:** 2026-07-05 · **Due Date:** 2026-07-08
- **Functions/Screens:** Patient Booking & PayOS Gateway
- **URL:** HungBB-1808/Dermatology_Clinic_Management_System at feature/receptionist-payment-status

### #3 — Develop Free Skin Scan AI Modal

Build skin analysis feature using MediaPipe face mesh and Gemini AI for acne/dark spot detection

- **State:** Closed
- **Assignee:** ThNhan113
- **Milestone:** iter2
- **Labels:** Feature, 3_Done
- **Created At:** 2026-07-08 · **Due Date:** 2026-07-12
- **Functions/Screens:** Free Skin Scan (Skin Analyzer)
- **URL:** HungBB-1808/Dermatology_Clinic_Management_System at feature/ai-skin-scan

### #4 — Fix FreeSkinScanModal crash and connection

Import missing useAuth hook and optimize Edge Function payload to prevent crash on scan submit

- **State:** Closed
- **Assignee:** HungBB-1808
- **Milestone:** iter2
- **Labels:** Bug, 3_Done
- **Created At:** 2026-07-14 · **Due Date:** 2026-07-14
- **Functions/Screens:** Free Skin Scan Modal
- **URL:** HungBB-1808/Dermatology_Clinic_Management_System at feature/fix-ai-scan-connection

### #5 — Build Receptionist Chat Workspace

Add dedicated chat workspace for receptionist to manage patient inquiries and live agent handover

- **State:** Closed
- **Assignee:** HungBB-1808
- **Milestone:** iter2
- **Labels:** Feature, 3_Done
- **Created At:** 2026-07-09 · **Due Date:** 2026-07-12
- **Functions/Screens:** Receptionist Chat Workspace
- **URL:** HungBB-1808/Dermatology_Clinic_Management_System at feature/receptionist-chat-workspace

### #6 — Implement Receptionist Live Check-in Flow

Remove manual approval queue and build live patient check-in flow with status update

- **State:** Closed
- **Assignee:** HungBB-1808
- **Milestone:** iter2
- **Labels:** Task, 3_Done
- **Created At:** 2026-07-12 · **Due Date:** 2026-07-14
- **Functions/Screens:** Receptionist Live Check-in
- **URL:** HungBB-1808/Dermatology_Clinic_Management_System at feature/receptionist-approve-appointment

### #7 — Build Technician Procedure Review Interface

Create procedure review view for technicians to inspect doctor treatment orders before execution

- **State:** Closed
- **Assignee:** ThanhLuan
- **Milestone:** iter2
- **Labels:** Task, 3_Done
- **Created At:** 2026-07-10 · **Due Date:** 2026-07-13
- **Functions/Screens:** Technician Procedure Review
- **URL:** HungBB-1808/Dermatology_Clinic_Management_System at feature/technician-procedure-review

### #8 — Implement Technician Complete Task Action

Allow technicians to confirm treatment procedure completion and log technical execution notes

- **State:** Closed
- **Assignee:** ThanhLuan
- **Milestone:** iter2
- **Labels:** Task, 3_Done
- **Created At:** 2026-07-13 · **Due Date:** 2026-07-14
- **Functions/Screens:** Technician Service Tickets
- **URL:** HungBB-1808/Dermatology_Clinic_Management_System at feature/technician-complete-task

### #9 — Fix Doctor Dashboard & EMR Flow

Fix patient vitals display, auto-save EMR draft, and resolve schedule loading freeze on Doctor Dashboard

- **State:** Closed
- **Assignee:** HungBB-1808
- **Milestone:** iter2
- **Labels:** Feature, 3_Done
- **Created At:** 2026-07-13 · **Due Date:** 2026-07-15
- **Functions/Screens:** Doctor EMR Management
- **URL:** HungBB-1808/Dermatology_Clinic_Management_System at fix-doctor-dashboard

### #10 — Restrict Doctor Direct Patient Chat Access

Enforce privacy scoping policies to restrict direct doctor chat access outside assigned clinic consultations

- **State:** Closed
- **Assignee:** HungBB-1808
- **Milestone:** iter3
- **Labels:** Task, 3_Done
- **Created At:** 2026-07-14 · **Due Date:** 2026-07-15
- **Functions/Screens:** Doctor Consultation & Chat Privacy
- **URL:** HungBB-1808/Dermatology_Clinic_Management_System at feature/restrict-doctor-chat

### #11 — Develop Admin Revenue Statistics & KPI Charts

Build revenue statistics page with SVG donut charts, service stats, trends, and transaction history

- **State:** Closed
- **Assignee:** nnhut422-ship-it
- **Milestone:** iter3
- **Labels:** Feature, 3_Done
- **Created At:** 2026-07-14 · **Due Date:** 2026-07-15
- **Functions/Screens:** Admin Revenue Reports
- **URL:** HungBB-1808/Dermatology_Clinic_Management_System at feature/admin-revenue-statistics

### #12 — Develop Admin Employee Account Management

Build employee CRUD management, account lock/unlock controls, and role-based feedback visibility

- **State:** Closed
- **Assignee:** nnhut422-ship-it
- **Milestone:** iter3
- **Labels:** Feature, 3_Done
- **Created At:** 2026-07-15 · **Due Date:** 2026-07-17
- **Functions/Screens:** Admin Staff Management
- **URL:** HungBB-1808/Dermatology_Clinic_Management_System at feature/admin-employee-management

### #13 — Develop Admin Voucher & Discount Management

Build voucher creation, discount code management, and expiration tracking interfaces

- **State:** Closed
- **Assignee:** ThNhan113
- **Milestone:** iter3
- **Labels:** Feature, 3_Done
- **Created At:** 2026-07-15 · **Due Date:** 2026-07-16
- **Functions/Screens:** Admin Voucher Management
- **URL:** HungBB-1808/Dermatology_Clinic_Management_System at feature/admin-voucher-management

### #14 — Develop Admin Doctor Schedule Configuration

Build shift calendar setup view for clinic managers to configure doctor work shifts and off days

- **State:** Closed
- **Assignee:** HungBB-1808
- **Milestone:** iter3
- **Labels:** Task, 3_Done
- **Created At:** 2026-07-15 · **Due Date:** 2026-07-16
- **Functions/Screens:** Admin Doctor Schedule
- **URL:** HungBB-1808/Dermatology_Clinic_Management_System at feature/admin-doctor-schedule

### #15 — Develop Full Function Patient Portal

Build comprehensive patient portal for appointment management, EMR medical history, and AI scan records

- **State:** Closed
- **Assignee:** ThNhan113
- **Milestone:** iter3
- **Labels:** Feature, 3_Done
- **Created At:** 2026-07-14 · **Due Date:** 2026-07-16
- **Functions/Screens:** Patient Portal Dashboard
- **URL:** HungBB-1808/Dermatology_Clinic_Management_System at Full_Function_Patient

### #16 — Simplify Booking Flow (Remove Service Select)

Refactor appointment booking flow to allow flexible doctor selection without pre-selecting service items

- **State:** Closed
- **Assignee:** HungBB-1808
- **Milestone:** iter3
- **Labels:** Improvement, 3_Done
- **Created At:** 2026-07-15 · **Due Date:** 2026-07-15
- **Functions/Screens:** Patient Booking Flow
- **URL:** HungBB-1808/Dermatology_Clinic_Management_System at feature/remove-booking-service-selection

### #17 — Develop Receptionist Profile & Shift View

Build profile management and shift schedule view for clinic receptionist staff

- **State:** Closed
- **Assignee:** ThNhan113
- **Milestone:** iter3
- **Labels:** Task, 3_Done
- **Created At:** 2026-07-15 · **Due Date:** 2026-07-15
- **Functions/Screens:** Receptionist Profile
- **URL:** HungBB-1808/Dermatology_Clinic_Management_System at feature/receptionist

### #18 — Implement CRUD Operations for Admin Module

Implement base CRUD controllers and models for system services, medications, and clinic user roles

- **State:** Closed
- **Assignee:** ThNhan113
- **Milestone:** iter2
- **Labels:** Task, 3_Done
- **Created At:** 2026-07-12 · **Due Date:** 2026-07-14
- **Functions/Screens:** Admin CRUD Services & Drugs
- **URL:** HungBB-1808/Dermatology_Clinic_Management_System at CRUD-Admin

### #19 — Integrate Brevo Transactional Email System

Build Edge Function send-clinic-email using Brevo API with Resend fallback for email notifications

- **State:** Closed
- **Assignee:** HungBB-1808
- **Milestone:** iter3
- **Labels:** Feature, 3_Done
- **Created At:** 2026-07-15 · **Due Date:** 2026-07-16
- **Functions/Screens:** Email Notification System
- **URL:** HungBB-1808/Dermatology_Clinic_Management_System at main

### #20 — Implement Staff Timesheet & GlassPagination

Add staff timesheet (Chấm công) tracking tab and frosted glass pagination controls across tables

- **State:** Closed
- **Assignee:** HungBB-1808
- **Milestone:** iter3
- **Labels:** Feature, 3_Done
- **Created At:** 2026-07-16 · **Due Date:** 2026-07-17
- **Functions/Screens:** Staff Profile & Timesheet
- **URL:** HungBB-1808/Dermatology_Clinic_Management_System at main
