#### b. Table Descriptions

| **No** | **Schema** | **Table** | **Description** |
| --- | --- | --- | --- |
| 1 | users\_module | users | Stores core user account information including email, full name, role, avatar, phone, date of birth, active status, email verification flag, and account lock reason. Acts as the central identity table shared across all modules and mirrors the Supabase Auth user. |
| 2 | roles | Defines the available user roles in the system (student, teacher, admin). Each user is assigned exactly one role via role\_id. |
| 3 | student\_profiles | Extends the users table with student-specific details such as JLPT target level, current level, native language, daily study minutes goal, streak days, last study date, and onboarding completion status. Has a 1-to-1 relationship with users. |
| 4 | teacher\_applications | Stores applications from users requesting to become teachers, including phone, qualifications, specialization, experience, uploaded documents, and an AI screening verdict (summary, flags, confidence, model) plus the admin's review decision and note. |
| 5 | teacher\_profiles | Extends the users table with teacher-specific details such as biography, qualifications, and approval status. Supports the teacher approval workflow managed by admins (approved\_by, approved\_at). |
| 6 | user\_audit\_logs | Records administrative actions performed on user accounts, such as locking, unlocking, role changes, and teacher approvals or rejections, along with the old/new values, reason, and the admin who performed the action. |
| 7 | course\_module | skills | Defines the language skills covered in the system (e.g., reading, listening, speaking, writing, grammar), with an internal name and a Vietnamese display name. Used to classify courses and lessons. |
| 8 | courses | Stores structured courses with title (Vietnamese/Japanese), description, JLPT level, associated skill, thumbnail, difficulty, and publication status. Supports monetization via free/paid flag, price, commission rate, creator type, and cached enrollment count and average rating. Each course is created by a teacher or admin and supports soft delete. |
| 9 | units | Stores units (chapters) that group lessons within a course, with title (Vietnamese/Japanese), description, level, and a sort order for display sequence. |
| 10 | lessons | Stores individual lessons within a course and optional unit. Each lesson has a content type (text, audio, video, etc.), content body or URL, transcript with segments, grammar notes, duration, question count, an optional linked reading article, and a sort order within its course. |
| 11 | course\_enrollments | Tracks which students are enrolled in which courses, along with enrollment date, completion date, and overall progress percentage. Unique per (course, student). |
| 12 | course\_reviews | Stores student ratings and comments for courses, with one review per student per course. Used to compute the course's average rating. |
| 13 | lesson\_progress | Tracks each student's progress on individual lessons, including completion status, progress percentage, last playback position, and time spent. Unique per (student, lesson). |
| 14 | lesson\_vocabulary | Junction table linking vocabulary items to lessons, allowing lessons to highlight specific words for study. |
| 15 | lesson\_kanji | Junction table linking kanji items to lessons, allowing lessons to highlight specific kanji for study. |
| 16 | lesson\_grammar | Junction table linking grammar patterns to lessons, allowing lessons to highlight specific grammar structures. |
| 17 | lesson\_grammar\_points | Junction table linking simplified grammar points to lessons, used for the newer grammar-point catalog. |
| 18 | language\_module | jlpt\_levels | Stores the five JLPT proficiency levels (N5 to N1). Used as a reference by vocabulary, kanji, grammar, course, and other tables to classify items by difficulty. |
| 19 | topics | Stores hierarchical topic categories (e.g., Food, Travel) in Vietnamese, English, and Japanese, with an icon. Supports parent-child relationships for nested topic trees. |
| 20 | vocabulary | Stores Japanese vocabulary items including the word, reading (furigana), romaji, Vietnamese and English meanings, Sino-Vietnamese reading (han\_viet), part of speech, JLPT level, example sentences, audio URL, and image URL. Can be marked public and linked to a lesson. |
| 21 | vocabulary\_topics | Junction table linking vocabulary items to one or more topics. Enables many-to-many classification of vocabulary by topic. |
| 22 | vocabulary\_sets | Stores named collections of vocabulary items created by users. Can be public or private, and optionally filtered by JLPT level, with a view count. |
| 23 | vocabulary\_set\_items | Junction table linking vocabulary items to vocabulary sets, with a sort order for display sequence. |
| 24 | kanji | Stores kanji characters with stroke count, on-yomi, kun-yomi readings, Vietnamese and English meanings, Sino-Vietnamese reading (han\_viet), JLPT level, radical, stroke order URL, example words, and a mnemonic hint in Vietnamese. Can be marked public and linked to a lesson. |
| 25 | kanji\_sets | Stores named collections of kanji created by users, optionally filtered by JLPT level and topic. Can be marked public for sharing with other learners, with a view count. |
| 26 | kanji\_set\_items | Junction table linking kanji to kanji sets with a sort order for display sequence. |
| 27 | grammar\_patterns | Stores Japanese grammar patterns with structure, Vietnamese and English meanings, JLPT level, usage notes, example sentences (JSON), and related patterns (JSON). Can be marked public. |
| 28 | grammar\_points | Stores lightweight grammar points with title (Vietnamese/Japanese), meaning, explanation, an example sentence, and level. Used by the newer grammar-point catalog and lesson linking. |
| 29 | grammar\_sets | Stores named collections of grammar patterns, optionally filtered by JLPT level. Can be marked public for sharing, with a view count. |
| 30 | grammar\_set\_items | Junction table linking grammar patterns to grammar sets with a sort order. |
| 31 | teacher\_vocabulary | Stores vocabulary items submitted by teachers, pending admin review. Includes kanji, reading, Vietnamese/Japanese meaning, Sino-Vietnamese reading, level, type, an example sentence, a status (draft/pending/approved), and an admin note. |
| 32 | teacher\_kanji | Stores kanji items submitted by teachers, pending admin review. Includes the character, on/kun readings (arrays), Vietnamese meaning, stroke count, level, a status, and an admin note. |
| 33 | study\_list\_posts | Stores curated study-list posts (vocabulary, kanji, or grammar lists) created by teachers or admins, with a list type, title, description, level, topic, view count, and a lock flag for moderation. |
| 34 | study\_list\_items | Junction table linking a study-list post to its items, with a sort order. The referenced item is polymorphic (vocabulary, kanji, or grammar point) depending on the post's list type, so there is no hard foreign key on item\_id. |
| 35 | practice\_module | articles | Stores Japanese reading articles with title (Japanese/Vietnamese), Vietnamese summary, level, thumbnail, full content, interactive segments (JSON), embedded questions/vocabulary/grammar (JSON), publication status, and view count. Used for reading practice. |
| 36 | article\_reads | Tracks which users have read which articles, recording the first-read timestamp and read date. Primary key is (article, user). Used for daily read counting and progress. |
| 37 | reading\_sets | Stores reading comprehension test sets with title, code, JLPT level, difficulty, topic, description, instructions, estimated time, tags, source type, and workflow status (draft/published). |
| 38 | rs\_passages | Stores the reading passages that belong to a reading set, with title, content, a review flag, and a sort order. |
| 39 | rs\_questions | Stores the questions attached to a reading-set passage, with question type, question text, explanation, skill tags, a review flag, and a sort order. |
| 40 | rs\_options | Stores the answer options for a reading-set question, with option text, a correct flag, and a sort order. |
| 41 | rs\_drafts | Stores draft JSON snapshots of a reading set during editing, allowing authors to save work in progress before publishing. |
| 42 | listening\_dialogues | Stores listening dialogue materials with title (Japanese/Vietnamese), level, topic, a thumbnail icon, creator type, and publication status. Used for listening practice. |
| 43 | listening\_dialogue\_lines | Stores the individual lines of a listening dialogue, with line order, speaker, Japanese text (with and without annotation), and Vietnamese translation. |
| 44 | listening\_user\_audios | Stores listening materials created by students from their own audio or content URL, including title, level, audio/storage path, transcript, segments (JSON), and a public flag. |
| 45 | pronunciation\_assessments | Stores AI-based pronunciation assessment results for students, including the target text and reading, recorded audio URL, overall and fluency scores, AI feedback in Vietnamese, and optional links to a lesson, listening material, or question. |
| 46 | writing\_submissions | Stores student writing submissions with AI and teacher scoring, including grammar, vocabulary, and coherence scores, feedback, and corrected versions of the text, plus optional links to a question, attempt, lesson, or reading material. |
| 47 | flashcard\_module | flashcard\_folders | Stores flashcard folders owned by a user, used to organize flashcard sets into groups. |
| 48 | flashcard\_sets | Stores flashcard set definitions owned by a user, with a title and description. |
| 49 | flashcards | Stores individual flashcards within a set, with a term (front), definition (back), and an order index for display sequence. |
| 50 | flashcard\_folder\_sets | Junction table linking flashcard sets to folders, enabling a set to be organized under one or more folders. |
| 51 | flashcard\_progress | Tracks each student's learning state per flashcard, including a status (learning/known) and the last reviewed timestamp. Primary key is (student, card). |
| 52 | flashcard\_tests | Stores auto-generated tests for a flashcard set, including the test configuration and generated questions (JSON). One test per set. |
| 53 | exam\_module | quizzes | Stores quiz and exam definitions optionally linked to a course or lesson, with title (Japanese/Vietnamese), type, time limit, proctoring mode, strict fullscreen flag, passing rule, exam flag, and publication status. |
| 54 | quiz\_questions | Stores individual questions within a quiz, including question type, answer options (JSON), correct answer (and structured correct-answer data), explanation, a passage snapshot, an optional reference to a question-bank entry, and an order index. |
| 55 | quiz\_attempts | Records each student attempt on a quiz, including score, total questions, answers (JSON), mode, proctor events and snapshots, violation count, status, AI feedback, and optional manual grading by a teacher. |
| 56 | quiz\_lockouts | Tracks proctoring lockouts for a student on a quiz, recording the violation count and a locked-until timestamp. Unique per (quiz, user). |
| 57 | question\_bank | Stores the admin/system question bank, including question text, options (JSON), correct answer, explanation, level, skill, topic, difficulty, review status, an AI-generated flag, and optional links to a reading or listening passage. |
| 58 | teacher\_question\_bank | Stores questions created by teachers, mirroring the question bank with question text, options, correct answer, explanation, metadata, status, an optional source-bank reference, and a passage snapshot. |
| 59 | reading\_passages | Stores reading passages used as shared context for exam questions, with title, content, level, topic, source, and an optional image. |
| 60 | teacher\_reading\_passages | Stores reading passages created by teachers for use with their own questions, with title, content, image, level, topic, and source. |
| 61 | listening\_passages | Stores listening passages used as context for exam questions, with title, audio URL, transcript (and segments), description, level, topic, duration, and an optional image. |
| 62 | jlpt\_module | mock\_exams | Stores JLPT mock exam definitions with level, title, description, a free flag, and publication status. Acts as the root of the full JLPT mock-test structure. |
| 63 | mock\_exam\_sections | Stores the sections of a JLPT mock exam (e.g., vocabulary/grammar, reading, listening), with a section type, title, position, and per-section time limit. |
| 64 | mock\_question\_groups | Stores question groups (mondai) within a section, with mondai number and type, score category, an optional shared passage or image, and an optional link to a bank group. |
| 65 | mock\_questions | Stores individual questions within a mock question group, with question text, image/audio, answer options (JSON), correct index, explanation, Vietnamese translation, and an optional link to a bank question. |
| 66 | mock\_attempts | Records each student (or teacher preview) attempt on a JLPT mock exam, including attempt number, status, current section position, section deadline, timing, per-section scores (JSON), total score, and pass result. |
| 67 | mock\_attempt\_answers | Stores each answer within a mock attempt, referencing the question, the selected option index, and correctness. Primary key is (attempt, question). |
| 68 | jlpt\_bank\_groups | Stores reusable JLPT question-bank groups, each with a level, mondai type, optional shared passage text and image. Source pool for building mock question groups. |
| 69 | jlpt\_bank\_questions | Stores reusable JLPT bank questions, with level, mondai type, score category, question text, image/audio and transcript, options (JSON), correct index, explanation, Vietnamese translation, and source. Belongs to a bank group. |
| 70 | dictionary\_module | dict\_entries | Stores dictionary word entries with kanji form, kana reading, romaji, JLPT level, a common-word flag, and source metadata. Acts as the main lookup table for the built-in dictionary. |
| 71 | dict\_senses | Stores the meanings (senses) of a dictionary entry, including part of speech, Vietnamese meaning, and display order. One entry can have multiple senses. |
| 72 | dict\_examples | Stores example sentences for a dictionary sense, in both Japanese and Vietnamese, with optional furigana annotation. |
| 73 | dict\_related\_words | Stores relationships between dictionary entries, such as synonyms, antonyms, or related words, using a self-referencing structure with a relation type. |
| 74 | dict\_kanji | Stores standalone kanji dictionary entries with Sino-Vietnamese reading, Vietnamese meaning, and on-yomi and kun-yomi readings as arrays. Separate from the learner kanji table. |
| 75 | billing\_module | subscription\_plans | Stores subscription plan definitions with a code, name, tier, billing cycle, price, currency, active flag, and a JSON feature map. |
| 76 | user\_subscriptions | Stores each user's subscription, including plan, tier, status, billing period start/end, expiry, auto-renew flag, and source. Determines the user's current entitlements. |
| 77 | feature\_entitlements | Defines the per-tier limit for each feature code (e.g., AI messages, mock exams), including the limit value, period type, and metadata. Unique per (tier, feature). |
| 78 | feature\_usage\_counters | Tracks each user's consumption of a feature within a billing period, storing the used count and amount and the tier at the time. Unique per (user, feature, period). |
| 79 | payment\_orders | Stores payment orders for subscription plans, with order and payment codes, amount, currency, provider, bank/QR details, status, expiry, and matched-transaction metadata. |
| 80 | course\_payment\_orders | Stores payment orders for one-time course purchases, mirroring payment\_orders but referencing a course instead of a plan. |
| 81 | payment\_transactions | Stores raw bank transactions ingested from the payment provider (SePay), including reference number, account, amounts in/out, content, raw payload, and links to the matched subscription or course order. |
| 82 | payments | Stores settled course payment records with the amount split into platform fee and teacher payout, payment status, provider, and provider transaction id. |
| 83 | content\_usage\_events | Logs each use of a teacher's premium content by a VIP student, recording content type/id, teacher, period key, and day, used to compute the teacher revenue-sharing pool. |
| 84 | revenue\_pool\_periods | Stores the revenue-sharing pool for each billing period, including total VIP revenue, pool percentage, pool amount, total uses, and finalization status. |
| 85 | teacher\_payouts | Stores each teacher's payout for a period, including number of uses, share percentage, amount, status, and paid timestamp. Unique per (period, teacher). |
| 86 | ai\_module | student\_dashboards | Stores aggregated learning statistics for each student, including total study days, minutes, vocabulary/kanji/grammar learned, exams taken, average score, current/longest streak, and per-skill scores. Has a 1-to-1 relationship with users. |
| 87 | ai\_learning\_paths | Stores personalized AI-generated learning path recommendations for students, including the path data (JSON), AI model version, rationale in Vietnamese, and identified strength and weakness skills, with an active flag. |
| 88 | learning\_paths | Stores structured learning plans for a user, with current and target level, study goal, daily minutes, status, and the AI model used to generate the plan. |
| 89 | learning\_path\_steps | Stores the ordered steps of a learning path, each with a title, description, skill focus, rationale, resource type, resource level, and completion status. The referenced resource is polymorphic (course, quiz, reading, etc.), so there is no hard foreign key on resource\_id. |
| 90 | chat\_sessions | Stores AI Sensei chat sessions for a user, each with a title and timestamps. Groups the messages of a single conversation. |
| 91 | chat\_messages | Stores individual messages within an AI chat session, with a role (user/assistant), content, and optional context items (JSON). |
| 92 | notifications | Stores in-app notifications sent to users, with type, title, body, optional metadata, read status, and the sender (system or another user). |
| 93 | kanji\_writing\_sheets | Stores AI-generated kanji writing practice sheets for students, referencing a kanji set or JLPT level, with the list of kanji ids and the generated file URL. |
| 94 | ai\_generated\_questions | Records the history of AI question generation requests, including the generated question reference, requester, generation prompt, parameters, raw AI response, and AI model version used. |
