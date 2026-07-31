# Issues Report — Group 4 · Kizuna Nihongo

> Repo: `SUMMER2026SE/swp391-rbl-project-group4` — 12 issues

## Bảng tổng hợp

| Title | Description | Issue ID | URL | State | Assignee | Created At | Due Date | Milestone | Labels | Functions/Screens |
|---|---|---|---|---|---|---|---|---|---|---|
| Integrate AI Provider & AI Sensei Chatbot | Integrate OpenAI-compatible AI provider (OpenRouter, later FPT AI Factory) and build AI Sensei chatbot with chat history, image analysis, and defensive JSON parsing for malformed model output | 1 | SUMMER2026SE/swp391-rbl-project-group4 at vinhdd | Closed | cybervinh2077 | 2026-06-07 | 2026-06-08 | iter1 | Feature, 3_Done | AI Sensei Chat |
| Build Whisper Video Transcription with VAD Sync | Build synced transcript player using Whisper transcription, ffmpeg silence detection, and WebRTC VAD, filtering hallucinated chunks for accurate karaoke-style sync | 2 | SUMMER2026SE/swp391-rbl-project-group4 at vinhdd | Closed | cybervinh2077 | 2026-06-09 | 2026-06-12 | iter1 | Feature, 3_Done | Listening Practice & Synced Transcript Player |
| Develop AI Quiz Question Generation & Question Bank | Build admin question bank with 6 question types, reading passages with images, and AI quiz question generation with furigana display | 3 | SUMMER2026SE/swp391-rbl-project-group4 at vinhdd | Closed | cybervinh2077 | 2026-06-08 | 2026-06-10 | iter1 | Feature, 3_Done | Admin Question Bank |
| Develop AI Personalized Learning Path | Build AI roadmap from current to target JLPT level, constraining suggestions to a whitelisted catalog of real courses and mock exams to prevent hallucinated resources | 4 | SUMMER2026SE/swp391-rbl-project-group4 at vinhdd | Closed | cybervinh2077 | 2026-06-28 | 2026-07-03 | iter2 | Feature, 3_Done | Student Learning Path |
| Integrate SePay VietQR Payment Gateway | Implement subscription checkout via SePay VietQR bank transfer with memo-based payment matching, fail-closed webhook, and bank account fallback when QR rendering fails | 5 | SUMMER2026SE/swp391-rbl-project-group4 at vinhdd | Closed | cybervinh2077 | 2026-07-04 | 2026-07-08 | iter2 | Feature, 3_Done | Pricing & Payment QR Checkout |
| Implement Premium Subscription & Feature Entitlements | Implement premium plans, tier-based feature entitlements with monthly usage quotas, and premium gating with Free/Premium badges for teacher study-list posts | 6 | SUMMER2026SE/swp391-rbl-project-group4 at Thang | Closed | temp3rance | 2026-07-15 | 2026-07-18 | iter3 | Feature, 3_Done | Pricing & Study Lists Premium Gate |
| Build Teacher Revenue Pool & Payout | Build monthly revenue pool that shares a percentage of VIP subscription revenue to teachers proportionally by content usage, handling rounding remainders | 7 | SUMMER2026SE/swp391-rbl-project-group4 at vinhdd | Closed | cybervinh2077 | 2026-07-10 | 2026-07-14 | iter3 | Feature, 3_Done | Teacher Earnings & Admin Revenue Pool |
| Develop JLPT Mock Exam Engine | Build timed JLPT mock exam engine with per-section deadlines, draft autosave and flush, leave-page warning, and dedicated jlpt_module schema | 8 | SUMMER2026SE/swp391-rbl-project-group4 at Quyen | Closed | hquyen2703 | 2026-07-09 | 2026-07-17 | iter3 | Feature, 3_Done | Mock Exam Room |
| Improve AI JLPT Question Generation | Improve AI JLPT question generation with duplicate prevention, per-question regeneration, forced Vietnamese explanations, and dedicated FPT_AI_JLPT_MODEL env | 9 | SUMMER2026SE/swp391-rbl-project-group4 at Quyen | Closed | hquyen2703 | 2026-07-16 | 2026-07-17 | iter3 | Improvement, 3_Done | Admin Mock Exam AI Generator |
| Import JLPT Question Bank from Excel/CSV | Import JLPT question bank from Excel/CSV templates with preview and commit flow, supporting listening (transcript-only) and reading passage (2-sheet) formats | 10 | SUMMER2026SE/swp391-rbl-project-group4 at Quyen | Closed | hquyen2703 | 2026-07-17 | 2026-07-18 | iter3 | Task, 3_Done | Admin JLPT Question Bank |
| Fix examGuard Anti-cheat Fail-open | Point examGuard to jlpt_module schema and throw on query errors instead of failing open, so AI chat stays blocked during in-progress mock exam attempts | 11 | SUMMER2026SE/swp391-rbl-project-group4 at Quyen | Closed | hquyen2703 | 2026-07-23 | 2026-07-23 | iter3 | Bug, 3_Done | AI Chat Guard during Mock Exam |
| Enforce Course Enrollment Paywall | Require enrollment for free courses, lock lesson content server-side until enrolled, show enroll-vs-buy paywall messaging, and add My Courses tab | 12 | SUMMER2026SE/swp391-rbl-project-group4 at Bao | Closed | T618 | 2026-07-20 | 2026-07-21 | iter3 | Improvement, 3_Done | Course Detail & Lesson Paywall |

## Chi tiết từng issue

### #1 — Integrate AI Provider & AI Sensei Chatbot

Integrate OpenAI-compatible AI provider (OpenRouter, later FPT AI Factory) and build AI Sensei chatbot with chat history, image analysis, and defensive JSON parsing for malformed model output

- **State:** Closed
- **Assignee:** cybervinh2077
- **Milestone:** iter1
- **Labels:** Feature, 3_Done
- **Created At:** 2026-06-07 · **Due Date:** 2026-06-08
- **Functions/Screens:** AI Sensei Chat
- **URL:** SUMMER2026SE/swp391-rbl-project-group4 at vinhdd

### #2 — Build Whisper Video Transcription with VAD Sync

Build synced transcript player using Whisper transcription, ffmpeg silence detection, and WebRTC VAD, filtering hallucinated chunks for accurate karaoke-style sync

- **State:** Closed
- **Assignee:** cybervinh2077
- **Milestone:** iter1
- **Labels:** Feature, 3_Done
- **Created At:** 2026-06-09 · **Due Date:** 2026-06-12
- **Functions/Screens:** Listening Practice & Synced Transcript Player
- **URL:** SUMMER2026SE/swp391-rbl-project-group4 at vinhdd

### #3 — Develop AI Quiz Question Generation & Question Bank

Build admin question bank with 6 question types, reading passages with images, and AI quiz question generation with furigana display

- **State:** Closed
- **Assignee:** cybervinh2077
- **Milestone:** iter1
- **Labels:** Feature, 3_Done
- **Created At:** 2026-06-08 · **Due Date:** 2026-06-10
- **Functions/Screens:** Admin Question Bank
- **URL:** SUMMER2026SE/swp391-rbl-project-group4 at vinhdd

### #4 — Develop AI Personalized Learning Path

Build AI roadmap from current to target JLPT level, constraining suggestions to a whitelisted catalog of real courses and mock exams to prevent hallucinated resources

- **State:** Closed
- **Assignee:** cybervinh2077
- **Milestone:** iter2
- **Labels:** Feature, 3_Done
- **Created At:** 2026-06-28 · **Due Date:** 2026-07-03
- **Functions/Screens:** Student Learning Path
- **URL:** SUMMER2026SE/swp391-rbl-project-group4 at vinhdd

### #5 — Integrate SePay VietQR Payment Gateway

Implement subscription checkout via SePay VietQR bank transfer with memo-based payment matching, fail-closed webhook, and bank account fallback when QR rendering fails

- **State:** Closed
- **Assignee:** cybervinh2077
- **Milestone:** iter2
- **Labels:** Feature, 3_Done
- **Created At:** 2026-07-04 · **Due Date:** 2026-07-08
- **Functions/Screens:** Pricing & Payment QR Checkout
- **URL:** SUMMER2026SE/swp391-rbl-project-group4 at vinhdd

### #6 — Implement Premium Subscription & Feature Entitlements

Implement premium plans, tier-based feature entitlements with monthly usage quotas, and premium gating with Free/Premium badges for teacher study-list posts

- **State:** Closed
- **Assignee:** temp3rance
- **Milestone:** iter3
- **Labels:** Feature, 3_Done
- **Created At:** 2026-07-15 · **Due Date:** 2026-07-18
- **Functions/Screens:** Pricing & Study Lists Premium Gate
- **URL:** SUMMER2026SE/swp391-rbl-project-group4 at Thang

### #7 — Build Teacher Revenue Pool & Payout

Build monthly revenue pool that shares a percentage of VIP subscription revenue to teachers proportionally by content usage, handling rounding remainders

- **State:** Closed
- **Assignee:** cybervinh2077
- **Milestone:** iter3
- **Labels:** Feature, 3_Done
- **Created At:** 2026-07-10 · **Due Date:** 2026-07-14
- **Functions/Screens:** Teacher Earnings & Admin Revenue Pool
- **URL:** SUMMER2026SE/swp391-rbl-project-group4 at vinhdd

### #8 — Develop JLPT Mock Exam Engine

Build timed JLPT mock exam engine with per-section deadlines, draft autosave and flush, leave-page warning, and dedicated jlpt_module schema

- **State:** Closed
- **Assignee:** hquyen2703
- **Milestone:** iter3
- **Labels:** Feature, 3_Done
- **Created At:** 2026-07-09 · **Due Date:** 2026-07-17
- **Functions/Screens:** Mock Exam Room
- **URL:** SUMMER2026SE/swp391-rbl-project-group4 at Quyen

### #9 — Improve AI JLPT Question Generation

Improve AI JLPT question generation with duplicate prevention, per-question regeneration, forced Vietnamese explanations, and dedicated FPT_AI_JLPT_MODEL env

- **State:** Closed
- **Assignee:** hquyen2703
- **Milestone:** iter3
- **Labels:** Improvement, 3_Done
- **Created At:** 2026-07-16 · **Due Date:** 2026-07-17
- **Functions/Screens:** Admin Mock Exam AI Generator
- **URL:** SUMMER2026SE/swp391-rbl-project-group4 at Quyen

### #10 — Import JLPT Question Bank from Excel/CSV

Import JLPT question bank from Excel/CSV templates with preview and commit flow, supporting listening (transcript-only) and reading passage (2-sheet) formats

- **State:** Closed
- **Assignee:** hquyen2703
- **Milestone:** iter3
- **Labels:** Task, 3_Done
- **Created At:** 2026-07-17 · **Due Date:** 2026-07-18
- **Functions/Screens:** Admin JLPT Question Bank
- **URL:** SUMMER2026SE/swp391-rbl-project-group4 at Quyen

### #11 — Fix examGuard Anti-cheat Fail-open

Point examGuard to jlpt_module schema and throw on query errors instead of failing open, so AI chat stays blocked during in-progress mock exam attempts

- **State:** Closed
- **Assignee:** hquyen2703
- **Milestone:** iter3
- **Labels:** Bug, 3_Done
- **Created At:** 2026-07-23 · **Due Date:** 2026-07-23
- **Functions/Screens:** AI Chat Guard during Mock Exam
- **URL:** SUMMER2026SE/swp391-rbl-project-group4 at Quyen

### #12 — Enforce Course Enrollment Paywall

Require enrollment for free courses, lock lesson content server-side until enrolled, show enroll-vs-buy paywall messaging, and add My Courses tab

- **State:** Closed
- **Assignee:** T618
- **Milestone:** iter3
- **Labels:** Improvement, 3_Done
- **Created At:** 2026-07-20 · **Due Date:** 2026-07-21
- **Functions/Screens:** Course Detail & Lesson Paywall
- **URL:** SUMMER2026SE/swp391-rbl-project-group4 at Bao

