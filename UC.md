### II. Requirement Specifications
1. Authentication & Profile
1.1 UC-01_Register a. Functionalities Functional Description UC ID and Name: UC-01_Register Created By: Group 4 Date Created: 30/May/2025 Primary Actor: Guest Secondary Actors: Email Service Trigger: Guest clicks on the "Register" button on the login/home page. Description: As a Guest, I want to create a new account on Kizuna Nihongo by providing my full name, email address, and password so that I can access all authenticated features of the platform. Preconditions: PRE - 1: The user is not logged in (accessing the platform as a Guest). PRE-2: The platform registration page is accessible. Postconditions: POST-1: A new user account is created and stored in the system database. POST-2: A verification email is sent to the registered email address. POST-3: The user's account is in a 'pending verification' state until email is confirmed. Normal Flow: 1.0 Register Account
1. Guest navigates to the Kizuna Nihongo platform and clicks the "Register"
button.
2. System displays the registration form with fields: Full Name, Email,
Password, Confirm Password.
3. Guest fills in all required fields with valid information.
4. Guest clicks the "Register" / "Đăng ký" button to submit the form.
5. System validates all input fields (see 1.0.E1, 1.0.E2).
6. System checks that the submitted email address is not already registered
(see 1.0.E3).
7. System creates a new account with the role 'Student' by default and stores
the hashed password.
8. System sends a verification email containing an activation link to the
provided email address.
9. System displays a success message informing the Guest to check their email
to complete registration. Alternative Flows: None Exceptions: 1.0.E1 Required fields are left blank
1. System highlights the empty mandatory fields with an error indicator.
2. System displays the message: "Please fill in all required fields."
3. Guest corrects the fields and resubmits. => Return to Step 5 of Normal
Flow.
1.0.E2 Input format is invalid (e.g., invalid email format, password < 8 characters)
1. System displays a field-level validation error message (e.g., "Please enter a
valid email address", "Password must be at least 8 characters").
2. Guest corrects the invalid fields. => Return to Step 5 of Normal Flow.
1.0.E3 Email address is already registered in the system

1. System displays the error message: "This email address is already in use.
Please log in or use a different email."
2. Guest may click "Login" link to proceed to the Login screen. => UC stops,
change to UC-02_Login.
3. Or Guest modifies the email. => Return to Step 5 of Normal Flow.
Priority: Must Have Frequency of Use: High — multiple times per day, especially during onboarding or promotional periods. Business Rules: BR-01, BR-02, BR-03, BR-04 Other Information: The verification email must be sent within 59 seconds of successful registration. If the email service is unavailable, the system should queue the email and retry. The account remains in 'pending' status until the email is verified. Assumptions: It is assumed that all guest users have access to a valid email inbox. Email delivery success rate is at least 95%.
b. Business Rules ID Business Rule Business Rule Description BR-01 Email Uniqueness Rule Each email address may only be associated with one account on the platform. Duplicate email registration attempts must be rejected. BR - 02 Password Strength Rule Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number. BR - 03 Password Hashing Rule User passwords must be stored using a secure hashing algorithm (e.g., bcrypt). Plaintext passwords must never be stored. BR - 04 Email Verification Rule Newly registered accounts must verify their email address within 24 hours. Unverified accounts cannot log in. The verification link expires after 24 hours.
1.2 UC-02_Login a. Functionalities Functional Description UC ID and Name: UC-02_Login Created By: Group 4 Date Created: 30/May/2025 Primary Actor: Student, Teacher, Secondary Actors: None Admin Trigger: User clicks the "Login" / "Đăng nhập" button on the platform header or is redirected to the login page when accessing an authenticated feature. Description: As a registered user (Student, Teacher, or Admin), I want to log into the platform using my email and password so that I can access my personalized dashboard and all features authorized for my role. Preconditions: PRE - 1: The user has a registered and email - verified account on the platf orm. PRE-2: The user's account is not locked or banned. Postconditions: POST-1: The user is authenticated and a session token is created. POST-2: The user is redirected to the appropriate dashboard based on their role (Student Dashboard / Teacher Dashboard / Admin Dashboard). POST-3: The system records the successful login event in the activity log with timestamp and IP address. Normal Flow: 2.0 Login
1. User navigates to the Login page or clicks the "Login" button on the header.
2. System displays the Login form with fields: Email and Password.

3. User enters their registered email address and password.
4. User clicks the "Login" / "Đăng nhập" button.
5. System validates the submitted credentials against the database (see
2.0.E1, 2.0.E2, 2.0.E3).
6. System generates an authentication session token for the user.
7. System records the successful login event in the activity log.
8. System redirects the user to the appropriate dashboard based on their
assigned role. Alternative Flows: None Exceptions: 2.0.E1 Email or password is incorrect
1. System displays the error message: "Incorrect email or password. Please
try again." 2a. User corrects the credentials and resubmits. => Return to Step 5 of Normal Flow. 2b. User clicks "Forgot Password?" link. => UC stops, change to UC-05_Forgot Password. 2c. User clicks "Register" link. => UC stops, change to UC-01_Register Account.
2.0.E2 User account has not been email-verified
1. System displays the message: "Your account has not been verified. Please
check your email."
2. System offers a "Resend verification email" option.
3. UC stops.
2.0.E3 User account is locked
1. System displays the message: "Your account has been locked. Please
contact the administrator."
2. UC stops.
Priority: Must Have Frequency of Use: Very High — hundreds of times per day across all user roles. This is the most frequently executed use case on the platform. Business Rules: BR-05, BR-06, BR-07 Other Information: The system should support session persistence ("Remember Me" option) for up to 7 days. If the user accesses an authenticated URL directly, the system should redirect them to the login page and then back to the original URL after successful login. Assumptions: It is assumed users access the platform via a modern web browser with JavaScript enabled. Session tokens are stored securely (httpOnly cookies).
b. Business Rules ID Business Rule Business Rule Description BR-05 Login Failure Limit Rule If a user enters incorrect credentials 5 consecutive times, the account is temporarily locked for 30 minutes. An email notification is sent to the account owner. BR - 06 Session Timeout Rule An authenticated session expires af ter 59 minutes of inactivity. The user must log in again. BR-07 Role-Based Redirect Rule After successful login, the system must redirect users to the dashboard corresponding to their role: Student → Learning

Dashboard; Teacher → Teaching Dashboard; Admin → Admin Control Panel.
1.3 UC-03_Logout a. Functionalities Functional Description UC ID and Name: UC-03_Logout Created By: Group 4 Date Created: 30/May/2025 Primary Actor: Student, Teacher, Secondary Actors: None Admin Trigger: User clicks the "Logout" / "Đăng xuất" option from the account dropdown menu in the header. Description: As a3n authenticated user, I want to log out of the platform so that my session is securely terminated and my account cannot be accessed by others using the same device. Preconditions: PRE - 1: The user is currently logged in to the platform. Postconditions: POST - 1: The user's current session token is invalidated and destroyed. POST-2: All authentication cookies are cleared from the browser. POST-3: The user is redirected to the platform's home/login page. Normal Flow: 3.0 Logout
1. User clicks on their avatar or username in the platform header to open the
account dropdown menu.
2. User clicks the "Logout" / "Đăng xuất" option.
3. System invalidates the current session token on the server side.
4. System clears all authentication tokens and cookies from the browser.
5. System redirects the user to the Login page or the public Home page.
6. System displays a confirmation message: "You have been logged out
successfully." Alternative Flows: None Exceptions: 3.0.E1 Network error occurs during logout
1. System displays an error message: "Unable to complete logout. Please try
again."
2. If the error persists, the user is advised to close the browser to end the
session. Priority: Must Have Frequency of Use: High — executed at the end of each user session, multiple times per day across all user roles. Business Rules: BR-08 Other Information: The logout action must also invalidate any refresh tokens stored. On shared devices, the system should also clear any locally cached user data. Assumptions: It is assumed users will use the Logout function when they finish using the platform, especially on shared devices.
b. Business Rules ID Business Rule Business Rule Description BR - 08 Session Invalidation Rule Upon logout, the server - side session must be immediately invalidated. Client-side tokens (cookies, localStorage) must also be cleared to prevent unauthorized reuse.

1.4 UC-04_Change Password a. Functionalities Functional Description UC ID and Name: UC - 04_Change Password Created By: Group 4 Date Created: 30/May/2025 Primary Actor: Student, Teacher, Secondary Actors: None Admin Trigger: User navigates to Account Settings and clicks the "Change Password" option. Description: As an authenticated user, I want to change my account password by providing my current password and a new password so that I can maintain the security of my account. Preconditions: PRE - 1: The user is logged in to the platform. PRE-2: The user knows their current password. Postconditions: POST-1: The user's password is updated in the system database with the new hashed password. POST-2: All existing sessions (except the current one) are invalidated for security. POST-3: A confirmation email is sent to the user notifying them of the password change. Normal Flow: 4.0 Change Password
1. User navigates to the Account Settings page from the header or profile
dropdown.
2. User selects the "Change Password" section.
3. System displays a form with three fields: Current Password, New Password,
Confirm New Password.
4. User enters their current password, the new password, and the
confirmation of the new password.
5. User clicks the "Save Changes" / "Lưu thay đổi" button.
6. System validates that the Current Password field matches the user's stored
hashed password (see 4.0.E1).
7. System validates the New Password against the password strength policy
(see 4.0.E2).
8. System validates that New Password and Confirm New Password fields
match (see 4.0.E3).
9. System updates the password in the database with the newly hashed
password.
10. System invalidates all other active sessions for this user account.
11. System sends a password-change notification email to the user's
registered email address.
12. System displays a success message: "Your password has been changed
successfully." Alternative Flows: None Exceptions: 4.0.E1 Current password is incorrect
1. System displays the error: "The current password you entered is
incorrect."
2. User re-enters the correct current password. => Return to Step 6 of
Normal Flow.
4.0.E2 New password does not meet strength requirements

1. System displays the error: "New password must be at least 8 characters
and include uppercase, lowercase, and a number."
2. User enters a compliant new password. => Return to Step 7 of Normal
Flow.
4.0.E3 New Password and Confirm Password do not match
1. System displays the error: "Passwords do not match. Please re-enter."
2. User corrects the Confirm Password field. => Return to Step 8 of Normal
Flow.
4.0.E4 New password is the same as the current password
1. System displays the error: "New password must be different from the
current password."
2. User enters a different new password. => Return to Step 7 of Normal Flow.
Priority: Must Have Frequency of Use: Low to Medium — typically performed infrequently, estimated 1–2 times per user per year, but important for security. Business Rules: BR - 02, BR - 03, BR - 09 Other Information: If the user has forgotten their current password, they should use the Forgot Password flow (UC-05) instead. The system must not display passwords in plaintext at any point during this flow. Assumptions: It is assumed the user is performing this action intentionally and is in control of their account. The user has access to their registered email to receive the notification.
b. Business Rules ID Business Rule Business Rule Description BR-09 Password History Rule Users cannot reuse their last 3 passwords. The system must store hashed previous passwords for validation purposes.
1.5 UC-05_Forgot Password a. Functionalities Functional Description UC ID and Name: UC-05_Forgot Password Created By: Group 4 Date Created: 30/May/2025 Primary Actor: Student, Teacher, Secondary Actors: None Admin Trigger: User clicks the "Forgot Password?" link on the Login page. Description: As a user who has forgotten their password, I want to request a password reset by providing my registered email address so that the system can send me a One-Time Password (OTP) to verify my identity and allow me to set a new password. Preconditions: PRE-1: The user has a registered and email-verified account on the platform. PRE-2: The user has access to the email inbox associated with their account. Postconditions: POST - 1: The user's password is successfully reset to the new password provided. POST-2: All existing sessions for the account are invalidated. POST-3: A confirmation email is sent to the user notifying them of the password reset. Normal Flow: 5.0 Forgot Password

1. User clicks the "Forgot Password?" link on the Login page.
2. System displays the Forgot Password form with an Email input field.
3. User enters their registered email address and clicks "Send OTP" / "Gửi mã
OTP".
4. System validates that the email exists in the database (see 5.0.E1).
5. System generates a 6-digit OTP code with a 10-minute expiry and sends it to
the user's email.
6. System displays an OTP entry screen, informing the user to check their
email.
7. User opens their email, retrieves the OTP code, and enters it in the OTP
field.
8. User clicks "Verify" / "Xác minh".
9. System validates the OTP code against the stored value and checks it has
not expired (see 5.0.E2, 5.0.E3).
10. System displays the Reset Password form with fields: New Password and
Confirm New Password.
11. User enters their new password and confirms it.
12. User clicks "Reset Password" / "Đặt lại mật khẩu".
13. System validates the new password (see 5.0.E4).
14. System updates the account with the new hashed password and
invalidates the OTP.
15. System invalidates all existing sessions for this account.
16. System displays a success message and redirects the user to the Login
page. Alternative Flows: 5.1 User requests to resend OTP
1. On the OTP entry screen, user clicks "Resend OTP" / "Gửi lại mã".
2. System invalidates the previous OTP and generates a new 6-digit OTP.
3. System sends the new OTP to the user's email.
4. System resets the 10-minute countdown timer.
5. Return to Step 7 of Normal Flow.
Exceptions: 5.0.E1 Email address is not found in the system
1. System displays the message: "No account found with this email address."
2. User enters a different email or navigates to the Register page. => Return
to Step 3 of Normal Flow or UC stops.
5.0.E2 OTP code entered is incorrect
1. System displays the error: "The OTP code is incorrect. Please check your
email and try again."
2. System allows a maximum of 3 OTP attempts before blocking the reset
attempt for 15 minutes.
3. User re-enters the correct OTP. => Return to Step 8 of Normal Flow.
5.0.E3 OTP code has expired
1. System displays the message: "The OTP has expired. Please request a new
one."
2. User clicks "Resend OTP". => Change to Alternative Flow 5.1.
5.0.E4 New password does not meet requirements

1. System displays the validation error per BR-02.
2. User enters a compliant password. => Return to Step 13 of Normal Flow.
Priority: Must Have Frequency of Use: Medium — estimated to be used by 5–10% of users per month, with higher frequency during the first weeks after platform launch. Business Rules: BR-02, BR-03, BR-10 Other Information: The OTP should be invalidated immediately after successful use. For security, the system should not reveal whether an email exists in the system to prevent email enumeration attacks (consider showing a generic message). However, for usability in this context, explicit feedback is provided. Assumptions: It is assumed users have access to their registered email at the time of password reset. The OTP delivery time via email is under 2 minutes.
b. Business Rules ID Business Rule Business Rule Description BR-09 Password History Rule Users cannot reuse their last 3 passwords. The system must store hashed previous passwords for validation purposes.
1.6 UC-06_View Profile a. Functionalities Functional Description UC ID and Name: UC-06_View Profile Created By: Group 4 Date Created: 30/May/2025 Primary Actor: Student, Teacher, Secondary Actors: None Admin Trigger: User clicks on their avatar or username in the header and selects "Profile" / "Thông tin cá nhân". Description: As an authenticated user, I want to view my personal profile information so that I can verify my account details including my full name, avatar, email, phone number, date of birth, role, and account creation date. Preconditions: PRE-1: The user is logged in to the platform. Postconditions: POST-1: The system successfully displays the user's personal profile information page. Normal Flow: 6.0 View Personal Information
1. User clicks on their avatar or username in the platform header.
2. User selects the "Profile" / "Thông tin cá nhân" option from the dropdown
menu.
3. System retrieves the user's profile data from the database.
4. System displays the Profile page with the following information:
- Full Name
- Avatar / Profile Picture
- Email Address (read-only)
- Phone Number
- Date of Birth
- Role (Student / Teacher / Admin)
- Account Creation Date
5. System displays action buttons: "Edit Profile" (links to UC-07) and "Change
Password" (links to UC-04). Alternative Flows: None Exceptions: 6.0.E1 Session has expired before the page is loaded

1. System detects that the session token is invalid or expired.
2. System displays the message: "Your session has expired. Please log in
again."
3. System redirects the user to the Login page. => UC stops, change to UC-
02_Login. Priority: Must Have Frequency of Use: Medium — typically viewed when a user wants to verify or update their information. Estimated 1–5 times per user per month. Business Rules: None Other Information: The email address field must be displayed as read-only and cannot be changed from the profile page for security reasons. Role information should be displayed as a label and is only changeable by an Admin. Assumptions: It is assumed the profile data stored in the database is up - to - date. The profile page loads within 2 seconds under normal network conditions.
b. Business Rules None
1.7 UC-07_Edit Profile a. Functionalities Functional Description UC ID and Name: UC-07_Edit Profile Created By: Group 4 Date Created: 30/May/2025 Primary Actor: Student, Teacher, Secondary Actors: None Admin Trigger: User clicks the "Edit Profile" / "Chỉnh sửa thông tin" button on the Profile page. Description: As an authenticated user, I want to edit my personal profile details — including my full name, avatar, phone number, and date of birth — so that my account information remains accurate and up to date. Preconditions: PRE-1: The user is logged in to the platform. PRE-2: The user is currently on the Profile page (UC-06 has been executed). Postconditions: POST-1: The user's updated profile information is saved to the database. POST-2: The updated information is immediately reflected across the platform (e.g., header avatar and name). Normal Flow: 7.0 Update Personal Information
1. User clicks the "Edit Profile" / "Chỉnh sửa thông tin" button on their Profile
page.
2. System switches the profile page to edit mode, making the following fields
editable: Full Name, Phone Number, Date of Birth.
3. System displays an avatar upload control allowing the user to upload a new
profile picture.
4. User modifies one or more fields as desired.
5. (Optional) User clicks the avatar area and uploads a new profile image from
their device (see 7.0.E2).
6. User clicks the "Save Changes" / "Lưu thay đổi" button.
7. System validates all modified fields (see 7.0.E1).
8. System saves the updated information to the database.
9. If a new avatar was uploaded, system processes and stores the image,
replacing the previous avatar.

10. System displays a success message: "Your profile has been updated
successfully."
11. System refreshes the profile page and updates the header with the new
avatar and name. Alternative Flows: 7.1 User cancels the edit
1. User clicks the "Cancel" / "Hủy" button during edit mode.
2. System discards all unsaved changes and returns the profile page to view
mode.
3. No data is modified in the database.
Exceptions: 7.0.E1 Input validation fails
1. System highlights the invalid field(s) with an error message.
2. Examples: "Phone number must be 10–11 digits.", "Date of birth cannot be
in the future.", "Full name cannot be empty."
3. User corrects the invalid field(s). => Return to Step 7 of Normal Flow.
7.0.E2 Uploaded avatar file is invalid (wrong format or too large)
1. System displays the error: "Please upload an image file (JPG, PNG) under 5
MB."
2. User selects a valid image file. => Return to Step 5 of Normal Flow.
7.0.E3 Session expires during editing
1. System detects session timeout and displays the message: "Your session
has expired. Your changes have not been saved. Please log in again."
2. System redirects the user to the Login page. => UC stops, change to UC-
02_Login. Priority: Must Have Frequency of Use: Low to Medium — typically performed infrequently by users. Estimated 1–3 times per user per year for general updates. Business Rules: BR-11, BR-12 Other Information: The email address and role fields cannot be modified by the user through this use case. Email is a read-only identifier; role changes must be performed by an Admin (UC-52). The system should preserve the previous avatar if no new image is uploaded. Assumptions: It is assumed that the user has a stable internet connection when uploading a new avatar. The image processing (resizing/compression) is handled server- side.
b. Business Rules ID Business Rule Business Rule Description BR-11 Avatar Format Rule Acceptable avatar file formats are JPG and PNG only. The maximum file size is 5 MB. The system will automatically resize the image to a standard dimension (e.g., 200x200 pixels). BR-12 Profile Field Restriction The email address and user role fields are read-only on the Rule profile edit page. These fields can only be modified by system administrators.
2. Learning and Courses
2.1 UC-08_Take Placement Test a. Functionalities Functional Description

UC ID and Name: UC-08_Take Placement Test Created By: Group 4 Date Created: 30/May/2025 Primary Actor: Student, Teacher Secondary Actors: None Trigger: New user clicks "Take Placement Test" on the onboarding screen or Learning Dashboard. Description: As a new user, I want to take an initial placement test covering vocabulary, grammar, and reading so that the system can determine my Japanese proficiency level (N5–N1) and recommend an appropriate starting point for my studies. Preconditions: PRE - 1: The user is logged in to the platform. PRE-2: The user has not previously completed a placement test (or is retaking it). Postconditions: POST-1: The system records the user's placement test answers and calculates the result. POST-2: The user's proficiency level (N5–N1) is stored and associated with their account. POST-3: The system displays the test result and recommends a starting course or roadmap. Normal Flow: 8.0 Take Placement Test
1. User clicks "Take Placement Test" from the onboarding screen or their
Learning Dashboard.
2. System displays an introduction screen explaining the test purpose,
estimated duration (~20 minutes), and structure (vocabulary, grammar, reading sections).
3. User clicks "Start Test" / "Bắt đầu".
4. System displays questions one by one, each with a timer. The test consists
of multiple-choice questions across all three sections.
5. User reads each question and selects an answer.
6. User clicks "Next" to advance to the next question.
7. After all questions are answered, user clicks "Submit Test" / "Nộp bài".
8. System records all answers, calculates the score, and determines the user's
JLPT proficiency level (N5–N1).
9. System displays the result screen showing: assigned level, score breakdown
by section, and recommended courses.
10. System stores the proficiency level on the user's profile.
Alternative Flows: 8.1 User skips a question
1. User clicks "Next" without selecting an answer.
2. System accepts the skipped question (treated as incorrect) and advances
to the next question.
3. Return to Step 5 of Normal Flow.
Exceptions: 8.0.E1 Network connection lost during the test
1. System saves the user's progress up to the last answered question
automatically.
2. Upon reconnection, system allows the user to resume from where they
left off.
8.0.E2 Test session times out
1. System automatically submits the test with the answers provided so far.
2. System calculates the score based on answered questions and displays the
result. Priority: Must Have Frequency of Use: Low — typically once per user at the start of their l earning journey, or occasionally when retaking.

Business Rules: BR-13 Other Information: The placement test is adaptive or fixed-set. Results directly influence the AI roadmap generation in UC-09. A user should be able to retake the placement test after a minimum cooldown period (e.g., 30 days). Assumptions: It is assumed the question bank for the placement test is pre-loaded and covers all JLPT levels adequately. Network stability is expected during the test.
b. Business Rules ID Business Rule Business Rule Description BR - 13 Placement Test Retake A user may retake the placement test after a minimum Rule cooldown of 30 days from their last attempt. The most recent result overwrites the previous proficiency level on their profile.
2.2 UC-09_ Generate Personalized Learning Roadmap (AI) a. Functionalities Functional Description UC ID and Name: UC-09_ Generate Personalized Learning Roadmap (AI) Created By: Group 4 Date Created: 30/May/2025 Primary Actor: Student, Teacher Secondary Actors: AI Engine Trigger: Placement test is completed (UC-08) or user manually clicks "Generate Roadmap" on the Learning Dashboard. Description: As a user, I want the AI to generate a personalized learning roadmap based on my placement test result and declared learning goals so that I have a structured plan showing recommended courses, skill modules, and milestones. Preconditions: PRE-1: The user is logged in. PRE-2: The user has completed the placement test (UC-08) and has an assigned proficiency level. PRE-3: The user has declared their learning goal (e.g., target JLPT level, target date). Postconditions: POST-1: A personalized learning roadmap is generated and displayed to the user. POST-2: The roadmap is saved to the user's account and visible on their Learning Dashboard. Normal Flow: 9.0 Generate Personalized Learning Roadmap
1. System detects the user's completed placement test or user clicks
"Generate Roadmap".
2. System prompts the user to declare their learning goal: target JLPT level and
target achievement date.
3. User selects their goal and clicks "Generate" / "Tạo lộ trình".
4. System sends the user's current level, target level, and goal date to the AI
engine.
5. AI engine processes the data and generates a structured roadmap.
6. System displays the roadmap including: a timeline, recommended courses
per phase, skill modules (vocabulary, grammar, reading, listening, speaking, writing), and weekly study milestones.
7. User reviews the roadmap. User can click on any course or module to see
details.
8. User clicks "Accept Roadmap" / "Chấp nhận lộ trình" to confirm.
9. System saves the roadmap to the user's Learning Dashboard.
Alternative Flows: 9.1 User modifies goals and regenerates
1. User changes the target JLPT level or target date.

2. User clicks "Regenerate" / "Tạo lại".
3. Return to Step 4 of Normal Flow.
Exceptions: 9.0.E1 AI engine is unavailable
1. System displays the message: "Roadmap generation is temporarily
unavailable. Please try again later."
2. System offers a default generic roadmap based on the user's current level
as a fallback. Priority: Should Have Frequency of Use: Low — typically once per user after placement test, or when goals change. Estimated 1–3 times per user lifetime. Business Rules: None Other Information: The AI roadmap generation should complete within 10 seconds. Users can view and re-generate their roadmap at any time from the Learning Dashboard. Assumptions: The AI engine is connected and has access to the full course and content catalog to generate meaningful roadmaps.
b. Business Rules None
2.3 UC-10_ Enroll in Course a. Functionalities Functional Description UC ID and Name: UC-10_ Enroll in Course Created By: Group 4 Date Created: 30/May/2025 Primary Actor: Student, Teacher Secondary Actors: None Trigger: User clicks "Enroll" / "Đăng ký học" button on a course detail page. Description: As a user, I want to browse available courses and enroll in a course that matches my proficiency level so that the system grants me access to all lessons within the course and tracks my progress on the learning dashboard. Preconditions: PRE-1: The user is logged in. PRE-2: The selected course exists and is published. PRE-3: The user is not already enrolled in the selected course. Postconditions: POST-1: The enrollment record is created and stored in the database. POST-2: The user gains access to all lessons within the enrolled course. POST-3: The course appears on the user's Learning Dashboard with 0% progress. Normal Flow: 10.0 Enroll in Course
1. User browses the Course Catalog page.
2. User uses filters (JLPT level, topic, duration) to narrow down courses.
3. User clicks on a course card to view the Course Detail page.
4. System displays course details: title, description, target level, lesson count,
instructor, and a lesson preview.
5. User clicks "Enroll Now" / "Đăng ký ngay".
6. System verifies the user is not already enrolled (see 10.0.E1).
7. System creates an enrollment record linking the user to the course.
8. System displays a success message: "You have successfully enrolled in
[Course Name]."
9. System updates the Learning Dashboard to include the new course with 0%
progress.
10. System redirects the user to the course content page.
Alternative Flows: None Exceptions: 10.0.E1 User is already enrolled in the course

1. System hides the "Enroll" button and instead shows a "Continue Learning"
button.
2. User clicks "Continue Learning" and is directed to the course content page.
Priority: Must Have Frequency of Use: Medium — each user may enroll in multiple courses. Estimated 2–5 enrollments per user per month initially. Business Rules: BR - 14 Other Information: No payment or approval is required for standard course enrollment. Admin may set prerequisites for advanced courses. Assumptions: All courses in th e catalog are free to access. The course content is fully available upon enrollment without any delay.
b. Business Rules ID Business Rule Business Rule Description BR-14 Enrollment Prerequisite Advanced courses (e.g., N5, N4) may require the user's assigned Rule proficiency level to meet a minimum threshold. The system should warn users who enroll below the recommended level but should not block enrollment.
2.4 UC-11_ View Course Content a. Functionalities Functional Description UC ID and Name: UC - 11 _ View Courses Content Created By: Group 4 Date Created: 30/May/2025 Primary Actor: Student, Teacher Secondary Actors: None Trigger: User clicks on an enrolled course from the Learning Dashboard or clicks "Continue Learning" from the course page. Description: As an enrolled user, I want to access the full content of a course — including lesson list, lesson details (video, text, exercises), progress indicators, and completion status — so that I can study systematically and track my advancement. Preconditions: PRE-1: The user is logged in. PRE-2: The user is enrolled in the selected course (UC-10). Postconditions: POST - 1: The system displays the course content page with the lesson list and progress indicators. POST-2: If the user completes a lesson, the completion status is updated and progress percentage increases. Normal Flow: 11.0 View Course Content
1. User clicks on an enrolled course from their Learning Dashboard.
2. System displays the Course Content page with: course title, overall progress
bar, list of modules, and lessons within each module.
3. Each lesson shows its title, type (video/reading/exercise), duration, and
completion status (Not Started / In Progress / Completed).
4. User clicks on a lesson to open it.
5. System loads and displays the lesson content (video player, text content, or
interactive exercise).
6. User studies the lesson material.
7. User clicks "Mark as Complete" / "Đánh dấu hoàn thành" upon finishing the
lesson.
8. System updates the lesson completion status and recalculates the overall
course progress percentage.

9. System may automatically unlock the next lesson (if sequential progression
is required). Alternative Flows: 11.1 User watches a video lesson
1. System loads the video player for the lesson.
2. User watches the video; system tracks watch completion (e.g., >79%
watched counts as completed).
3. System automatically marks the lesson as completed when the threshold is
met. Exceptions: 11.0.E1 Lesson content fails to load
1. System displays the error: "Unable to load lesson content. Please check
your connection and try again."
2. User refreshes or returns to the lesson list. => Return to Step 4 of Normal
Flow. Priority: Must Have Frequenc y of Use: Very High — this is a core learning action performed multiple times per session by students. Business Rules: None Other Information: Lesson completion status and progress must be persisted even if the user leaves mid-lesson (auto-save progress). The progress bar on the Dashboard must reflect the latest state. Assumptions: Course content is hosted reliably. Video streaming is supported via a CDN for performance.
b. Business Rules None
3. Vocabulary and Grammar
3.1 UC-12_View Vocabulary List by Topic/Level a. Functionalities Functional Description UC ID and Name: UC-12_View Vocabulary List by Topic/Level Created By: Group 4 Date Created: 30/May/2025 Primary Actor: Student, Teacher Secondary Actors: None Trigger: User navigates to the "Vocabulary" section from the main navigation menu. Description: As a user, I want to browse vocabulary lists filtered by JLPT level (N5 – N1) or by topic so that I can study relevant words complete with kanji/kana, romaji, meaning, part of speech, and example sentences. Preconditions: PRE-1: The user is logged in. PRE-2: Vocabulary lists have been created by the Admin. Postconditions: POST-1: The system displays the requested vocabulary list with all word entries. Normal Flow: 12.0 View Vocabulary List by Topic / Level
1. User clicks "Vocabulary" in the main navigation.
2. System displays the Vocabulary browsing page with two filter tabs: "By
Level" (N5–N1) and "By Topic".
3. User selects a filter: either a JLPT level (e.g., N3) or a topic (e.g., Food,
Travel, Business).
4. System retrieves and displays the matching vocabulary list.
5. Each vocabulary entry displays: Word (kanji/kana), Romaji, Meaning
(Vietnamese/English), Part of Speech, and at least one example sentence.
6. User can click on any word entry to expand it and see additional details or
example sentences.

7. User may click "Add to Flashcard" to save a word to their flashcard deck
(links to UC-16). Alternative Flows: 12.1 User searches for a specific word within the list
1. User types a search term in the search bar on the vocabulary page.
2. System filters the displayed list in real time to show matching entries.
3. User views the filtered results.
Exceptions: 12.0.E1 No vocabulary entries found for the selected filter
1. System displays: "No vocabulary found for the selected filter. Please try a
different level or topic." Priority: Must Have Frequency of Use: High — daily usage expected by active students studying vocabulary. Business Rules: None Other Information: The vocabulary list must be paginated (e.g., 20 words per page) for performance. Users should be able to toggle between seeing the answer/meaning or hiding it for self-testing. Assumptions: Vocabulary data is pre - l oaded and maintained by the Admin.
b. Business Rules None
3.2 UC-13_View Kanji List by Level a. Functionalities Functional Description UC ID and Name: UC-13_View Kanji List by Level Created By: Group 4 Date Created: 30/May/2025 Primary Actor: Student, Teacher Secondary Actors: None Trigger: User navigates to the "Kanji" section from the main navigation menu. Description: As a user, I want to browse kanji characters organized by JLPT level so that I can study each kanji's character form, on-yomi, kun-yomi, meaning, stroke order, and example words. Preconditions: PRE-1: The user is logged in. PRE-2: Kanji lists have been created by the Admin. Postconditions: POST-1: The system displays the requested kanji list with all entries for the selected level. Normal Flow: 13.0 View Kanji List by Level
1. User clicks "Kanji" in the main navigation menu.
2. System displays the Kanji browsing page with a level selector (N5, N4, N3,
N2, N1).
3. User selects a JLPT level.
4. System retrieves and displays the kanji list for the selected level.
5. Each kanji entry shows: Kanji character (large display), On-yomi reading,
Kun-yomi reading, English/Vietnamese meaning, Stroke count, and Example words.
6. User clicks on a kanji entry to expand it and view stroke order animation or
diagram.
7. User may click "Add to Flashcard" to create a flashcard for the kanji.
Alternative Flows: None Exceptions: 13.0.E1 Kanji stroke order animation fails to load
1. System displays a static stroke order image as a fallback.
Priority: Must Have Frequency of Use: High — daily usage by students focused on kanji study. Business Rules: None

Other Information: Kanji stroke order should be displayed as an animation (SVG/GIF) where possible. The stroke order is a critical learning feature for handwriting practice. Assumptions: Stroke order diagrams for all required kanji are available in the system.
b. Business Rules None
3.3 UC-14_View Grammar List by Level a. Functionalities Functional Description UC ID and Name: UC-14_View Grammar List by Level
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Student, Teacher Secondary Actors: None
Trigger: User navigates to the "Grammar" section from the main navigation menu.
Description: As a user, I want to browse grammar patterns organized by JLPT level so that I
can understand each pattern's structure, meaning, usage notes, and see
example sentences demonstrating correct usage in context.
Preconditions: PRE-1: The user is logged in. PRE-2: Grammar lists have been created by the Admin.
Postconditions: POST-1: The system displays the requested grammar list for the selected level.
Normal Flow: 14.0 View Grammar List by Level
1. User clicks "Grammar" in the main navigation.
2. System displays the Grammar browsing page with a level selector (N5–N1).
3. User selects a JLPT level.
4. System retrieves and displays the grammar pattern list for the selected
level.
5. Each grammar entry displays: Pattern structure (e.g., Verb + てもいい ),
Meaning/Translation, Usage notes, Conjugation rules, and at least 2 example sentences with Japanese text and Vietnamese/English translation.
6. User clicks on a grammar entry to expand for full detail view.
Alternative Flows: None
Exceptions: 14.0.E1 No grammar entries found for the selected level
1. System displays: "No grammar patterns available for the selected level.
Please check back later."
Priority: Must Have
Frequency of Use: High — regularly used by students during grammar study sessions.
Business Rules: None
Other Information: Example sentences should include furigana readings above kanji characters to
aid comprehension.
Assumptions: Grammar data for all JLPT levels has been entered into the system by Admin.
b. Business Rules None

4. Flashcard Management
4.1 UC-15_ Study Vocabulary and Grammar with Flashcards a. Functionalities Functional Description UC ID and Name: UC-15_ Study Vocabulary and Grammar with Flashcards Created By: Group 4 Date Created: 30/May/2025 Primary Actor: Student, Teacher Secondary Actors: None Trigger: User clicks "Start Review" / "Ôn tập" from the Flashcard section on the Learning Dashboard. Description: As a user, I want to study saved vocabulary and grammar items using an interactive flashcard review session with spaced repetition so that I can efficiently memorize and retain Japanese language items over time. Preconditions: PRE - 1: The user is logged in. PRE-2: The user has at least one flashcard in their personal deck. Postconditions: POST-1: The user's review session is completed and all card ratings are recorded. POST-2: The spaced-repetition algorithm recalculates the next review date for each card based on the user's self-rating. POST-3: The Learning Dashboard is updated with the review session statistics. Normal Flow: 15.0 Study Vocabulary & Grammar with Flashcards
1. User navigates to the Flashcard section and clicks "Start Review".
2. System retrieves all flashcards due for review based on the spaced-
repetition schedule.
3. System displays the first flashcard showing only the front side
(word/grammar pattern).
4. User reads the front side and attempts to recall the answer.
5. User clicks "Show Answer" / "Xem đáp án" to reveal the back side (meaning,
reading, example).
6. System displays the full card with front and back sides visible.
7. User self-rates their recall difficulty by clicking one of: "Again" / "Hard" /
"Good" / "Easy".
8. System records the rating and applies the SRS algorithm to schedule the
next review for this card.
9. System advances to the next flashcard.
10. Repeat Steps 3–9 until all due cards are reviewed.
11. System displays a completion summary: total cards reviewed, breakdown
by rating, and estimated next review date. Alternative Flows: 15.1 User ends the session early
1. User clicks "End Session" / "Kết thúc".
2. System saves progress for reviewed cards and marks remaining cards as
not reviewed.
3. System displays the partial session summary.
Exceptions: 15.0.E1 No cards are due for review today
1. System displays: "No cards due for review today. Come back tomorrow or
add more cards to your deck."
2. System shows the next scheduled review date.
Priority: Must Have Frequency of Use: Very High — core daily learning activity. Expected to be used 1–3 times per day by active users. Business Rules: BR - 15

Other Information: The SRS algorithm follows the SM-2 model (or similar). Card review history must be preserved to support long-term scheduling. Audio pronunciation of the word can be played from the flashcard front side. Assumptions: The spaced repetition algorithm is implemented and correctly calculates intervals based on user ratings.
b. Business Rules ID Business Rule Business Rule Description BR-15 Spaced Repetition Rule The system uses an SRS algorithm (SM-2 model) to schedule card reviews. Cards rated 'Again' are shown again within the same session. Cards rated 'Hard/Good/Easy' are scheduled for future dates based on their current interval multiplier.
4.2 UC-16_Create Flashcard a. Functionalities Functional Description UC ID and Name: UC-16_Create Flashcard
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Student, Teacher Secondary Actors: None
Trigger: User clicks "Create Flashcard" / "+" button in the Flashcard section.
Description: As a user, I want to manually create a custom flashcard by entering a front
side (word/grammar pattern) and back side (meaning, reading, example) so
that it is saved to my personal deck and immediately available for study
sessions.
Preconditions: PRE - 1: The user is logged in.
Postconditions: POST - 1: The new flashcard is saved to the user's personal flashcard deck. POST-2: The card is scheduled for its first review in the next session.
Normal Flow: 16.0 Create Flashcard
1. User navigates to the Flashcard section and clicks "Create Flashcard" or the
"+" button.
2. System displays the Create Flashcard form with fields: Front (word /
grammar pattern), Back (meaning, reading), Example Sentence, and optional Deck/Tag selector.
3. User fills in the Front and Back fields (required). Example sentence is
optional.
4. User selects a deck or tag for organization (optional).
5. User clicks "Save" / "Lưu".
6. System validates that the Front and Back fields are not empty (see 16.0.E1).
7. System saves the flashcard to the user's personal deck.
8. System displays a success message: "Flashcard created successfully."
9. System adds the card to the review queue for the current or next session.
Alternative Flows: None
Exceptions: 16.0.E1 Required fields are empty
1. System highlights the empty field(s) and displays: "Front and Back fields
are required."
2. User fills in the required fields. => Return to Step 6 of Normal Flow.
Priority: Should Have

Frequency of Use: Medium — estimated 3–10 times per user per week during active study
periods.
Business Rules: None
Other Information: Users can also create flashcards directly from vocabulary or kanji list pages by
clicking 'Add to Flashcard' (shortcut to this use case with pre-filled data).
Assumptions: There is no maximum limit on the number of flashcards a user can create.
b. Business Rules None
4.3 UC-17_ Edit Flashcard a. Functionalities Functional Description UC ID and Name: UC-17_Edit Flashcard
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Student, Teacher Secondary Actors: None
Trigger: User clicks the "Edit" icon on a specific flashcard in their Flashcard deck.
Description: As a user, I want to edit the content of a flashcard I have created — including
the front text, back text, and example sentence — so that corrections or
improvements are reflected in subsequent review sessions.
Preconditions: PRE-1: The user is logged in. PRE-2: The flashcard being edited was created by the user.
Postconditions: POST-1: The flashcard content is updated in the database. POST-2: Changes are reflected immediately in subsequent review sessions.
Normal Flow: 17.0 Edit Flashcard
1. User opens the Flashcard deck and locates the card to edit.
2. User clicks the "Edit" / "Chỉnh sửa" icon on the card.
3. System displays the Edit Flashcard form pre-populated with the current card
content.
4. User modifies the desired fields (Front, Back, Example Sentence).
5. User clicks "Save Changes" / "Lưu thay đổi".
6. System validates the required fields (see 17.0.E1).
7. System saves the updated content to the database.
8. System displays a success message: "Flashcard updated successfully."
Alternative Flows: 17.1 User cancels editing
1. User clicks "Cancel" / "Hủy".
2. System discards changes and returns to the flashcard deck view.
Exceptions: 17.0.E1 Required fields become empty after editing
1. System displays: "Front and Back fields cannot be empty."
2. User fills in the required fields. => Return to Step 6 of Normal Flow.
Priority: Should Have
Frequency of Use: Low to Medium — performed occasionally when users want to improve
flashcard content.
Business Rules: None

Other Information: Editing a card does not reset its SRS schedule unless the front text is changed
significantly.
Assumptions: Users cannot edit flashcards that were auto-generated from system
vocabulary lists without first copying them to a personal deck.
b. Business Rules None
4.4 UC-18_Delete Flashcard a. Functionalities Functional Description UC ID and Name: UC-18_Delete Flashcard
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Student, Teacher Secondary Actors: None
Trigger: User clicks the "Delete" icon on a specific flashcard in their deck.
Description: As a user, I want to permanently delete a flashcard from my personal deck so
that unwanted or obsolete cards no longer appear in my review sessions.
Preconditions: PRE-1: The user is logged in. PRE-2: The flashcard to be deleted is in the user's personal deck.
Postconditions: POST - 1: The flashcard is permanently removed from the database. POST-2: All associated review schedules for the card are deleted.
Normal Flow: 18.0 Delete Flashcard
1. User locates the flashcard to delete in their deck.
2. User clicks the "Delete" / "Xóa" icon or button on the card.
3. System displays a confirmation dialog: "Are you sure you want to delete this
flashcard? This action cannot be undone."
4. User clicks "Confirm" / "Xác nhận".
5. System permanently removes the flashcard and its review schedule from
the database.
6. System displays a success notification: "Flashcard deleted."
7. The card is removed from the deck view.
Alternative Flows: 18.1 User cancels the deletion
1. User clicks "Cancel" in the confirmation dialog.
2. System closes the dialog. No changes are made.
Exceptions: 18.0.E1 Deletion fails due to a server error
1. System displays: "Unable to delete the flashcard. Please try again."
2. User retries. => Return to Step 4 of Normal Flow.
Priority: Should Have
Frequency of Use: Low — occasional action performed when users clean up their deck.
Business Rules: None
Other Information: Deletion is permanent and cannot be undone. The system should not provide
an undo option post-deletion.
Assumptions: Users understand that deletion is permanent, as communicated by the
confirmation dialog.

b. Business Rules None
5. Dictionary
5.1 UC-19_ Look Up Dictionary a. Functionalities Functional Description UC ID and Name: UC - 19 _ Look Up Dictionary Created By: Group 4 Date Created: 30/May/2025 Primary Actor: Student, Teacher Secondary Actors: None Trigger: User clicks on the "Dictionary" section in the main navigation or clicks on a word in a reading/listening exercise. Description: As a user, I want to search for Japanese words or kanji in the built-in dictionary using kanji, hiragana, katakana, romaji, or Vietnamese input so that I can quickly find readings, meanings, JLPT level, example sentences, and related vocabulary. Preconditions: PRE-1: The user is logged in. Postconditions: POST-1: The system displays dictionary search results matching the user's query. Normal Flow: 19.0 Look Up Dictionary
1. User navigates to the Dictionary page or the dictionary panel appears (e.g.,
when clicking a word in a reading article).
2. System displays a search bar that accepts kanji, hiragana, katakana, romaji,
or Vietnamese input.
3. User types a search term and presses Enter or clicks the search icon.
4. System searches the dictionary database for matching entries.
5. System displays a list of matching results. Each result shows: Word/Kanji,
Reading (furigana), Meaning(s), JLPT Level, Part of Speech.
6. User clicks on a specific result entry.
7. System displays the full entry detail including: all readings, all meanings,
example sentences, related words, and audio pronunciation.
8. User can click "Add to Flashcard" to save the word (links to UC-16 with pre-
filled data). Alternative Flows: 19.1 User searches by kanji radical or stroke count
1. User selects the 'Search by Radical' option.
2. System displays a radical picker interface.
3. User selects one or more radicals.
4. System filters kanji matching the selected radicals.
5. Return to Step 5 of Normal Flow.
Exceptions: 19.0.E1 No results found for the search query
1. System displays: "No results found for '[search term]'. Please check your
spelling or try a different input method."
2. System may suggest similar words or alternative spellings.
Priority: Must Have Frequency of Use: Very High — used multiple times per study session by most users. Business Rules: None Other Information: Search results should appear within 1 second. The dictionary should support at least 10,000+ Japanese–English/Vietnamese entries. Assumptions: The dictionary database is pre-loaded and indexed for fast full-text search across all input types.

b. Business Rules None
6. Listening Practice
6.1 UC-20_Listen to Dialogues by Proficiency Level a. Functionalities Functional Description UC ID and Name: UC - 20_ Listen to Dialogues by Proficiency Level
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Student Secondary Actors: None
Trigger: User navigates to the "Listening" section and selects a dialogue.
Description: As a user, I want to access listening materials categorized by JLPT level, listen
to audio dialogues, and optionally show or hide Japanese scripts, furigana, and
Vietnamese translations to support different learning styles and listening
practice.
Preconditions: PRE-1: The user is logged in. PRE-2: Listening materials have been uploaded by the Admin.
Postconditions: POST-1: The selected dialogue audio is played.
POST-2: The corresponding script, furigana, and translation are displayed
according to the user's viewing preferences.
Normal Flow: 20.0 Listen to Dialogues by Proficiency Level
1. User navigates to the Listening section.
2. System displays a catalogue of dialogues filterable by JLPT level (N5–N1)
and topic.
3. User selects a dialogue.
4. System loads the dialogue page with: Audio player, Dialogue title and
description, Japanese transcript panel, Furigana toggle button, Translation toggle button.
5. User clicks Play to start the audio.
6. User listens to the dialogue. Audio controls allow: Play/Pause, Rewind 10s,
Speed adjustment (0.74x, 1x, 1.25x, 1.5x).
7. User may toggle the available display options: Japanese Transcript ,
Furigana , Vietnamese Translation.
8. System updates the transcript display according to the selected options.
9. While the audio is playing, the system synchronizes and highlights the
current transcript segment corresponding to the audio timestamp.
Alternative Flows: None
Exceptions: 20.0.E1 Audio fails to load
1. System displays: "Unable to load audio. Please check your internet
connection."
2. User refreshes the page or selects a different dialogue.
Priority: Must Have
Frequency of Use: High — used regularly by students for listening practice, especially those
preparing for JLPT.
Business Rules: None

Other Information: Script toggling should be available but discouraged during first listening
attempts to promote active listening. Audio speed control is important for
different proficiency levels.
Assumptions: Audio files are stored and streamed through Supabase Storage.
Script transcripts are pre-entered by the Admin with speaker labels.
b. Business Rules None
6.2 UC-21_ Dictation Practice a. Functionalities Functional Description UC ID and Name: UC-21_ Dictation Practice
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Student Secondary Actors: None
Trigger: User clicks "Start Dictation" from the listening practice section.
Description: As a user, I want to listen to an audio clip and type out the full spoken content
so that the system can compare my response to the correct transcript,
highlight errors, and provide an accuracy score to measure my listening
comprehension.
Preconditions: PRE-1: The user is logged in. PRE-2: Dictation exercises exist in the system.
Postconditions: POST - 1: The user's typed response is compared against the correct transcript. POST-2: The system highlights errors and displays an accuracy percentage
score.
Normal Flow: 21.0 Dictation Practice
1. User selects a dictation exercise from the listening section.
2. System displays the dictation page: an audio player and a blank text input
area.
3. User clicks Play to listen to the audio clip.
4. User types out the full spoken content in the text area.
5. User may replay the audio clip multiple times.
6. User clicks "Submit" / "Nộp".
7. System compares the user's text word-by-word against the correct
transcript.
8. System highlights: Correct words (green), Incorrect or missing words (red),
Extra words (yellow).
9. System calculates and displays an accuracy score (e.g., 85% accuracy —
17/20 words correct).
Alternative Flows: None
Exceptions: 2 1 .0.E1 User submits an empty response
1. System displays a warning: "Please type something before submitting."
2. User types their response. => Return to Step 6 of Normal Flow.
Priority: Should Have

Frequency of Use: Medium — performed by users who want to practice intensive listening and
writing simultaneously.
Business Rules: None
Other Information: The comparison algorithm should handle Japanese character variants (e.g.,
full-width vs. half-width). Scores should be saved to the user's progress log.
Assumptions: Audio con tent is clear and transcripts are accurate.
b. Business Rules None
7. Speaking Skills
7.1 UC-22_ Pronunciation Practice (Shadowing) with AI a. Functionalities Functional Description UC ID and Name: UC-22_ Pronunciation Practice (Shadowing) with AI
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Student Secondary Actors: AI Engine
Trigger: User clicks "Start Shadowing Practice" while viewing a listening dialogue.
(UC20)
Description: As a user, I want to practice Japanese pronunciation by listening to dialogue
segments and recording my own voice, so that the AI can evaluate my
pronunciation accuracy and provide feedback for improvement.
Preconditions: PRE-1: The user is logged in. PRE-2: The user's device has a functional microphone. PRE-3: The user has granted microphone permission to the browser/app.
Postconditions: POST - 1: The pronunciation score for the selected sentence is displayed. POST-2: The AI provides pronunciation feedback and improvement tips for the selected sentence. POST-3: The user can replay their recorded audio for the current sentence.
Normal Flow: 2 2 .0 Pronunciation Practice (Shadowing) with AI
1. User opens a listening material and selects Shadowing Practice .
2. System loads the shadowing interface containing:
 Audio player  Current transcript segment  Furigana display  Translation display  Record button  Previous / Next segment navigation
3. User listens to the selected dialogue segment.
4. User clicks the Record button and speaks (shadows) the audio clip into the
microphone.
5. User clicks Stop Recording when finished.
7. System uploads the recorded audio to the AI engine.
8. AI compares the user's pronunciation with the reference transcript.
9. System displays the result: overall pronunciation score (0–100) and
suggestions for improvement.
10. User may replay the recording and review the feedback.

11. User selects Previous Segment or Next Segment to continue practicing.
Alternative Flows: 22.1 User listens multiple times before recording
1. User plays the audio clip several times to familiarize themselves.
2. User clicks Record when ready.
3. Return to Step 5 of Normal Flow.
Exceptions: 22.0.E1 Microphone permission denied
1. System displays: "Microphone access is required for this exercise. Please
allow microphone access in your browser settings."
2. System provides instructions on how to enable microphone access.
3. UC stops until permission is granted.
22.0.E2 AI pronunciation analysis service is unavailable
1. System displays: "Pronunciation feedback is temporarily unavailable.
Please try again later."
2. The recording is saved locally but scoring is deferred.
Priority: Should Have
Frequency of Use: Medium — used by motivated students who want to practice speaking,
estimated 3–5 times per week.
Business Rules: None
Other Information: Furigana and translation visibility follow the settings selected in UC-20.
Users may practice the same segment multiple times.
Feedback should be displayed within 5 seconds after analysis whenever
possible.
Practice results contribute to the user's learning dashboard statistics.
Assumptions: The AI engine supports Japanese speech recognition and pronunciation
evaluation.
b. Business Rules None
8. Reading Practice
8.1 UC-23_ Read Articles / Passages a. Functionalities Functional Description UC ID and Name: UC-23_ Read Articles / Passages (Toggle Furigana)
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Student Secondary Actors: None
Trigger: User selects a reading article from the Reading Practice section.
Description: As a user, I want to read Japanese articles or passages at my selected difficulty
level with the option to toggle furigana on/off and look up any word by
tapping it, so that I can practice reading comprehension at an appropriate
level.
Preconditions: PRE-1: The user is logged in. PRE-2: Reading materials have been published by the Admin.

Postconditions: POST-1: The system displays the selected article with interactive reading
features.
Normal Flow: 23.0 Read Articles / Passages (Toggle Furigana)
1. User navigates to the Reading Practice section.
2. System displays a catalogue of articles filterable by JLPT level and topic.
3. User selects an article.
4. System displays the article text with furigana shown above kanji by default.
5. User reads the article.
6. User clicks the "Hide Furigana" / "Ẩn furigana" toggle to hide phonetic
readings and challenge themselves.
7. User clicks any word in the text to see its dictionary definition in a pop-up
overlay (dictionary lookup).
8. User can click "Add to Flashcard" from the pop-up to save the word.
Alternative Flows: None
Exceptions: 23.0.E1 Article content fails to load
1. System displays: "Unable to load this article. Please try again or select a
different article."
Priority: Must Have
Frequency of Use: High — reading practice is performed regularly by students preparing for JLPT
reading sections.
Business Rules: None
Other Information: Furigana toggling should be smooth and immediate. The dictionary pop - up
should not obstruct the reading flow.
Assumptions: All reading materials are stored with proper furigana markup in the database.
b. Business Rules None
8.2 UC-24_ Complete Reading Comprehension Exercise (AI-Generated) a. Functionalities Functional Description UC ID and Name: UC-24_ Complete Reading Comprehension Exercise (AI-Generated)
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Student Secondary Actors: AI Engine
Trigger: User clicks "Take Comprehension Quiz" at the end of a reading article.
Description: As a user, after reading an article or passage, I want the AI to generate
comprehension questions so that I can test my understanding and receive a
score with explanations for incorrect answers.
Preconditions: PRE-1: The user is logged in. PRE-2: The user has accessed a reading article (UC-23).
Postconditions: POST-1: The AI-generated comprehension questions are answered and scored. POST-2: Score and explanations are displayed and saved to the user's progress
log.
Normal Flow: 2 4 .0 Complete Reading Comprehension Exercise (AI - Generated)
1. User finishes reading an article and clicks "Take Comprehension Quiz".

2. System requests the AI engine to generate comprehension questions based
on the article content.
3. AI generates a set of questions (mix of multiple-choice, true/false, and short
answer).
4. System displays the questions one by one or all at once.
5. User answers each question.
6. User clicks "Submit Answers" / "Nộp bài".
7. System evaluates answers (auto-graded for multiple-choice and true/false;
AI-evaluated for short answer).
8. System displays the result: score, per-question feedback, and explanation
for each incorrect answer.
Alternative Flows: None
Exceptions: 24.0.E1 AI question generation fails
1. System displays: "Unable to generate questions at this time. Please try
again."
Priority: Should Have
Frequency of Use: Medium — performed after reading articles. Estimated 2–4 times per week by
active learners.
Business Rules: None
Other Information: AI should generate 5–10 questions per article. Question quality should be
validated periodically.
Assumptions: The AI engine can generate contextually relevant questions from Japanese
text passages.
b. Business Rules None
9. Writing Practice
9.1 UC-25_ Generate Kanji Writing Practice Sheet a. Functionalities Functional Description UC ID and Name: UC-25_ Generate Kanji Writing Practice Sheet
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Student Secondary Actors: AI Engine
Trigger: User clicks "Generate Practice Sheet" in the Writing Practice section.
Description: As a user, I want to generate a downloadable PDF kanji writing practice sheet
for a selected kanji list or level so that I can practice handwriting with stroke-
order guides and blank grid boxes.
Preconditions: PRE-1: The user is logged in. PRE-2: Kanji lists for the selected level exist in the system.
Postconditions: POST-1: A PDF practice sheet is generated and made available for download.
Normal Flow: 25.0 Generate Kanji Writing Practice Sheet
1. User navigates to the Writing Practice section.
2. User selects "Generate Kanji Practice Sheet".

3. System prompts the user to select: JLPT Level or a specific Kanji list, Number
of kanji per sheet.
4. User configures options and clicks "Generate" / "Tạo bài".
5. System (with AI/PDF generation engine) creates the practice sheet layout:
each kanji with stroke-order diagram, multiple blank grid boxes for practice.
6. System generates the PDF file.
7. System displays a "Download" button and a preview of the sheet.
8. User clicks "Download" and the PDF is saved to their device.
Alternative Flows: None
Exceptions: 25.0.E1 PDF generation fails
1. System displays: "Unable to generate the practice sheet. Please try again."
Priority: Could Have
Frequency of Use: Low — used by users who practice handwriting, estimated once or twice per
week.
Business Rules: None
Other Information: The generated PDF should be print-ready at A4 size. Stroke order diagrams
must be accurate.
Assumptions: PDF generation is performed server-side and the file is available for download
within 10 seconds.
b. Business Rules None
9.2 UC-26_ Write a Paragraph & Receive AI Feedback a. Functionalities Functional Description UC ID and Name: UC-26_ Write a Paragraph & Receive AI Feedback
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Student Secondary Actors: AI Engine
Trigger: User navigates to the Writing Practice section and selects a paragraph writing
prompt.
Description: As a user, I want to write a Japanese paragraph on a given topic or prompt and
submit it so that the AI can review it for grammar correctness, vocabulary
appropriateness, sentence structure, and natural expression, returning
detailed inline feedback and a suggested improved version.
Preconditions: PRE-1: The user is logged in.
Postconditions: POST-1: The AI feedback is displayed to the user. POST-2: The submitted paragraph and feedback are saved to the user's writing
history.
Normal Flow: 2 6 .0 Write a Paragraph & Receive AI Feedback
1. User navigates to the Writing Practice section.
2. System presents a writing prompt (topic, word count target, and difficulty
level).
3. User types their Japanese paragraph in the text editor.
4. User clicks "Submit for Review" / "Nộp bài để đánh giá".

5. System sends the submitted text to the AI engine for analysis.
6. AI analyzes the text for: Grammar errors, Vocabulary appropriateness,
Sentence structure, Natural expression (naturalness in Japanese).
7. System displays the feedback: inline highlighting of issues in the original
text, explanations for each highlighted issue, and an AI-generated improved version of the paragraph.
8. User reviews the feedback and the improved version.
Alternative Flows: None
Exceptions: 2 6 .0.E1 User submits an empty paragraph
1. System displays: "Please write your paragraph before submitting."
26.0.E2 AI feedback service is unavailable
1. System displays: "Writing feedback is temporarily unavailable. Please try
again later."
Priority: Should Have
Frequency of Use: Medium — used by students who want to practice output production,
estimated 2–3 times per week.
Business Rules: None
Other Information: The AI feedback should be delivered within 10 seconds. The improved version
should be in a clearly distinguished area from the feedback.
Assumptions: The AI engine is capable of providing meaningful and accurate Japanese
writing feedback at the relevant JLPT levels.
b. Business Rules None
10. Exam and JLPT
10.1 UC-27_ Take Assigned Exam a. Functionalities Functional Description UC ID and Name: UC-27_ Take Assigned Exam
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Student Secondary Actors: None
Trigger: Student clicks "Start Exam" on an exam assigned by their teacher, visible on
the Learning Dashboard or notification.
Description: As a student, I want to take an exam assigned to my class by a teacher so that
the system presents me with all questions under a timer, records my answers,
and calculates my score upon submission.
Preconditions: PRE-1: The student is logged in. PRE-2: The student is enrolled in a class (UC-31) that has an exam assigned (UC-44). PRE-3: The exam is within its assigned start-time and end-time window. PRE-4: The student has not exceeded the allowed number of attempts for this
exam.
Postconditions: POST-1: The student's answers are submitted and recorded in the database.

POST-2: The system calculates and stores the score. POST-3: The attempt is counted against the student's allowed attempts. POST-4: The teacher is notified of the submission.
Normal Flow: 27.0 Take Assigned Exam
1. Student sees the assigned exam notification on their Dashboard.
2. Student clicks "Start Exam" / "Bắt đầu thi".
3. System displays the exam instructions: title, time limit, number of
questions, and rules.
4. Student clicks "Begin" to confirm and start the exam.
5. System starts the countdown timer and displays Question 1.
6. Student reads the question and selects / types their answer.
7. Student clicks "Next" to proceed to the next question (can also navigate
back).
8. Repeat Steps 6–7 until all questions are answered or time runs out (see
28.0.E2).
9. Student clicks "Submit Exam" / "Nộp bài".
10. System displays a confirmation dialog: "Are you sure you want to submit?"
11. Student confirms. System records all answers and calculates the score.
12. System displays: "Exam submitted successfully. Your results will be
available once the teacher grades the subjective questions." (if applicable).
Alternative Flows: None
Exceptions: 27.0.E1 Student attempts to open the exam outside the allowed time window
1. System displays: "This exam is not currently active. Please check the exam
schedule."
2. UC stops.
27.0.E2 Exam time limit expires
1. System displays a 5-minute and 1-minute warning to the student.
2. When the timer reaches zero, the system automatically submits all
answered questions.
3. System displays: "Time's up. Your exam has been submitted
automatically."
27.0.E3 Network connection lost during the exam
1. System saves the student's progress locally and displays a warning:
"Connection lost. Your progress is saved. Please reconnect to continue."
2. Upon reconnection, system restores the student's progress and the timer
continues from where it left off.
Priority: Must Have
Frequency of Use: Medium — depends on how frequently teachers assign exams. Estimated
weekly during active course periods.
Business Rules: BR-16, BR-17
Other Information: The exam interface should minimize distractions (full-screen mode optional).
Certain abnormal behaviors during the exam are logged for teacher review
(UC-47).
Assumptions: Students have a stable internet connection during the exam. The exam
schedule (start/end time) is set accurately by the teacher.

b. Business Rules ID Business Rule Business Rule Description BR-16 Exam Attempt Limit Rule Students can only take an assigned exam up to the maximum number of attempts set by the teacher. Once the limit is reached, the exam button is disabled. BR-17 Exam Window Rule Students can only start an exam within the assigned start and end time window. Attempts outside this window are rejected by the system. 10.2 UC-28_ Take JLPT Mock Test a. Functionalities Functional Description UC ID and Name: UC-28_ Take JLPT Mock Test
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Student Secondary Actors: None
Trigger: User clicks "Take JLPT Mock Test" and selects a JLPT level from the JLPT
Practice section.
Description: As a user, I want to take a full-format JLPT mock test for a selected level (N5–
N1) that simulates official conditions (time limits, section structure) so that I
can assess my readiness and identify areas for improvement.
Preconditions: PRE-1: The user is logged in. PRE-2: A JLPT mock test for the selected level has been published by the
Admin.
Postconditions: POST-1: The user's answers are submitted and scored. POST-2: Section-by-section results are displayed. POST-3: The result is saved to the user's exam history (UC-29).
Normal Flow: 28.0 Take JLPT Mock Test
1. User navigates to the JLPT Practice section and selects the desired level
(N5–N1).
2. System displays the mock test overview: number of sections, total
questions, time limits per section.
3. User clicks "Start Test" / "Bắt đầu thi".
4. System starts with Section 1 (Vocabulary/Kanji), presenting questions with a
section timer.
5. User answers questions in each section.
6. When the section timer ends or user submits the section, system moves to
the next section.
7. Steps 4–6 repeat for Grammar/Reading and Listening sections.
8. After all sections are completed, system calculates the score for each
section and the total score.
9. System displays the result page: total score, section-by-section scores,
correct/incorrect breakdown, and pass/fail indicator.
Alternative Flows: None
Exceptions: 28.0.E1 Section time limit expires
1. System automatically submits the current section and moves to the next.
28.0.E2 Network disruption during test
1. System saves progress and resumes from the saved state upon
reconnection.

Priority: Must Have
Frequency of Use: Medium — used by students before their actual JLPT exam. Estimated
monthly by active JLPT candidates.
Business Rules: BR-18
Other Information: The mock test must strictly follow JLPT time allocations and question counts
for each level. Results should include a comparison to previous mock test
attempts.
Assumptions: Mock test content is accurate and regularly updated by Admin to reflect
current JLPT standards.
b. Business Rules ID Business Rule Business Rule Description BR-18 JLPT Mock Test Format Each mock test must adhere to the official JLPT section structure Rule and time allocation for the selected level (e.g., N3: Vocabulary 25 min, Grammar/Reading 69 min, Listening 40 min).
10.3 UC-29_ View Exam Result History a. Functionalities Functional Description UC ID and Name: UC-29_ View Exam Result History
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Student Secondary Actors: None
Trigger: User navigates to the "Exam History" section from the Learning Dashboard.
Description: As a user, I want to view a history of all my exam and mock test results
including score, date taken, time spent, section breakdown, and a score
progression chart so that I can track my improvement over time.
Preconditions: PRE-1: The user is logged in. PRE-2: The user has completed at least one exam or mock test.
Postconditions: POST-1: The system displays the user's full exam result history.
Normal Flow: 30.0 View Exam Result History
1. User navigates to "Exam History" from the Dashboard or navigation menu.
2. System retrieves all of the user's completed exam records.
3. System displays a chronological list of results: Exam Name, Date Taken,
Score, Time Spent, Pass/Fail status.
4. User can filter results by: exam type (assigned / mock), JLPT level, or date
range.
5. User clicks on a specific result to view details.
6. System displays the detail view: score per section, correct/incorrect
question breakdown, and a comparison chart showing score progression
across all attempts for that exam type.
Alternative Flows: None
Exceptions: 30.0.E1 No exam history exists
1. System displays: "You have not completed any exams yet. Start with a JLPT
Mock Test or take a class exam."

Priority: Must Have
Frequency of Use: Medium — viewed after each exam or periodically to track progress.
Business Rules: None
Other Information: Score progression charts should clearly show improvement over time. Export
to PDF or CSV should be a future consideration.
Assumptions: All exam results are persisted in the database and associated with the user's
account.
b. Business Rules None
11. Progress Tracking
11.1 UC-30_ View Learning Dashboard a. Functionalities Functional Description UC ID and Name: UC - 3 0 _ View Learning Dashboard
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Student Secondary Actors: None
Trigger: User logs in or clicks "Dashboard" in the main navigation.
Description: As a user, I want to view my personalized learning dashboard that summarizes
my overall progress — including study streak, total study time, vocabulary and
kanji mastered, upcoming review items, recent activity, and JLPT level goal
progress — so that I stay motivated and informed about my learning journey.
Preconditions: PRE-1: The user is logged in.
Postconditions: POST-1: The system displays the user's personalized Learning Dashboard with
up-to-date statistics.
Normal Flow: 30.0 View Learning Dashboard
1. User logs in or clicks "Dashboard" in the navigation.
2. System retrieves the user's learning data from the database.
3. System renders and displays the Dashboard with the following sections:
- Study Streak: number of consecutive study days
- Total Study Time: hours spent this week/month
- Vocabulary Mastered: count of vocabulary items at Good/Easy level
- Kanji Mastered: count of kanji at mastery level
- Flashcard Review Due: count of cards due for review today
- Enrolled Courses: list with progress bars
- Recent Activity Log: last 5 activities with timestamps
- JLPT Goal Progress: progress bar toward target level
4. User interacts with widgets: clicking a widget navigates to the relevant
section.
Alternative Flows: None
Exceptions: 3 0 .0.E1 Dashboard data fails to load
1. System displays a loading error and prompts the user to refresh.
Priority: Must Have
Frequency of Use: Very High — accessed every time the user logs in. Core engagement feature.

Business Rules: None
Other Information: Dashboard data must be real-time (or near real-time, updated within 1 minute
of activity). The streak counter resets if a user misses a full day.
Assumptions: All user activity data is tracked and aggregated server-side. Dashboard loads
within 3 seconds.
b. Business Rules None
12. Classroom (Student)
12.1 UC-31_ Join a Class a. Functionalities Functional Description UC ID and Name: UC-31_ Join a Class
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Student Secondary Actors: None
Trigger: Student clicks "Join Class" and enters a class code, or clicks an invitation link
shared by a teacher.
Description: As a student, I want to join a teacher's class by entering a class code or
accepting an invitation link so that I can access class-specific resources,
assigned exercises, and exam schedules.
Preconditions: PRE-1: The student is logged in. PRE-2: The target class exists and has enrollment open. PRE-3: The student is not already enrolled in the class.
Postconditions: POST - 1: The student is added to the class roster. POST-2: The student gains access to all class-specific content. POST-3: The teacher is notified of the new student joining.
Normal Flow: 31.0 Join a Class
1. Student clicks "Join Class" / "Tham gia lớp" from the Dashboard or
navigation.
2. System displays a dialog with a class code input field.
3. Student enters the class code provided by the teacher.
4. Student clicks "Join" / "Tham gia".
5. System validates the class code (see 31.0.E1, 31.0.E2).
6. System adds the student to the class roster.
7. System displays a success message: "You have successfully joined [Class
Name]."
8. System displays the class on the student's Dashboard with access to class
materials.
9. System sends a notification to the teacher about the new enrollment.
Alternative Flows: 31.1 Student joins via invitation link
1. Student clicks an invitation link shared by the teacher.
2. System identifies the class from the link's embedded token.
3. If not logged in, system redirects to login first, then back to the join flow.
4. System proceeds from Step 5 of Normal Flow.
Exceptions: 31.0.E1 Class code is invalid or does not exist

1. System displays: "Invalid class code. Please double-check the code and try
again."
31.0.E2 Student is already enrolled in the class
1. System displays: "You are already a member of this class."
Priority: Must Have
Frequency of Use: Low to Medium — performed once per class enrollment. Frequency depends
on how many classes are available.
Business Rules: None
Other Information: There should be no limit on the number of classes a student can join. Teachers
control enrollment restrictions per class.
Assumptions: Class codes are unique and generated by the system upon class creation.
b. Business Rules None
12.2 UC-32_ Leave a Class a. Functionalities Functional Description UC ID and Name: UC - 3 2 _ Leave a Class
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Student Secondary Actors: None
Trigger: Student clicks "Leave Class" from the class detail page or class settings.
Description: As a student, I want to voluntarily leave a class so that the system removes me
from the class roster and revokes my access to class-specific content, after
showing a confirmation prompt.
Preconditions: PRE - 1: The student is logged in. PRE-2: The student is enrolled in at least one class.
Postconditions: POST-1: The student is removed from the class roster. POST-2: The student's access to class-specific content and exams is revoked. POST-3: The teacher is notified that the student has left the class.
Normal Flow: 32.0 Leave a Class
1. Student navigates to the class detail page for the class they want to leave.
2. Student clicks "Leave Class" / "Rời lớp".
3. System displays a confirmation dialog: "Are you sure you want to leave
[Class Name]? You will lose access to all class materials."
4. Student clicks "Confirm" / "Xác nhận".
5. System removes the student from the class roster.
6. System revokes the student's access to class-specific content, assigned
exams, and shared resources.
7. System displays a success message: "You have left [Class Name]."
8. System removes the class from the student's Dashboard.
9. System notifies the teacher that the student has left.
Alternative Flows: 32.1 Student cancels
1. Student clicks "Cancel" in the confirmation dialog.
2. System closes the dialog. No changes are made.

Exceptions: 32.0.E1 Student has an active ongoing exam in the class
1. System displays a warning: "You have an active exam in this class. You
must complete or forfeit the exam before leaving."
2. UC stops until the exam situation is resolved.
Priority: Should Have
Frequency of Use: Low — occasionally performed by students who change classes or end a
course.
Business Rules: None
Other Information: Leaving a class does not delete the student's account or general learning
progress. Only class-specific data access is revoked.
Assumptions: Students who leave a class can rejoin using the class code if the teacher allows
re-enrollment.
b. Business Rules None
13. Classroom Management (Teacher)
13.1 UC-33_ Create Class a. Functionalities Functional Description UC ID and Name: UC - 3 3 _ Create Class
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Teacher Secondary Actors: None
Trigger: Teacher clicks "Create New Class" / "Tạo lớp mới" from the Teaching
Dashboard.
Description: As a teacher, I want to create a new class by providing a class name,
description, target JLPT level, and optional enrollment restrictions so that the
system generates a unique class code and invitation link I can share with
students.
Preconditions: PRE-1: The user is logged in with the Teacher role. PRE-2: The teacher's account has been approved by an Admin (UC-53).
Postconditions: POST-1: A new class is created and stored in the database. POST-2: A unique class code and invitation link are generated for the class. POST-3: The class appears on the teacher's Teaching Dashboard.
Normal Flow: 33.0 Create Class
1. Teacher navigates to the Teaching Dashboard and clicks "Create New Class".
2. System displays the Create Class form with fields: Class Name, Description,
Target JLPT Level, Maximum Students (optional), Enrollment Password (optional).
3. Teacher fills in the required fields.
4. Teacher clicks "Create Class" / "Tạo lớp".
5. System validates the input (see 34.0.E1).
6. System creates the class record, generates a unique 6-character class code
and an invitation link.
7. System displays a success message with the class code and invitation link,
with options to copy or share.

8. The new class appears on the teacher's Teaching Dashboard.
Alternative Flows: None
Exceptions: 33.0.E1 Required fields are missing
1. System highlights empty required fields and displays: "Please fill in all
required fields."
Priority: Must Have
Frequency of Use: Low — typically created once per course period. A teacher may create 2–5
classes per semester.
Business Rules: None
Other Information: The class code must be unique system - wide. Invitation links should be
shareable via email or messaging platforms.
Assumptions: Each teacher manages a small number of classes (< 10 concurrent). Class
creation does not require admin approval.
b. Business Rules None
13.2 UC-34_ Delete Class a. Functionalities Functional Description UC ID and Name: UC-34_ Delete Class
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Teacher Secondary Actors: None
Trigger: Teacher clicks "Delete Class" from the class management settings of a class
they own.
Description: As a teacher, I want to permanently delete a class I own so that the system
removes all associated data after confirmation, and enrolled students are
notified of the deletion.
Preconditions: PRE-1: The teacher is logged in. PRE-2: The teacher is the owner of the class to be deleted. PRE-3: No active ongoing exams are in progress within the class.
Postconditions: POST-1: The class and all associated data (enrolled students list, assigned exams, shared resources) are permanently removed. POST-2: All enrolled students are notified that the class has been deleted. POST-3: The class is removed from the teacher's Teaching Dashboard.
Normal Flow: 3 4 .0 Delete Class
1. Teacher navigates to the class settings page for the class to be deleted.
2. Teacher clicks "Delete Class" / "Xóa lớp".
3. System displays a strong confirmation dialog: "This will permanently delete
[Class Name] and remove all [X] enrolled students. This action cannot be undone. Type the class name to confirm."
4. Teacher types the class name and clicks "Delete Permanently" / "Xóa vĩnh
viễn".
5. System sends notifications to all enrolled students informing them of the
class deletion.
6. System removes the class record and all associated data from the database.

7. System displays: "Class [Class Name] has been successfully deleted."
Alternative Flows: 34.1 Teacher cancels
1. Teacher clicks "Cancel".
2. System closes the dialog. No changes are made.
Exceptions: 3 4 .0.E1 Active exam is in progress in the class
1. System displays: "You cannot delete this class while an exam is in progress.
Please wait for the exam to conclude."
2. UC stops.
Priority: Must Have
Frequency of Use: Very Low — rare action, performed at the end of a course or academic period.
Business Rules: BR-19
Other Information: Deletion is irreversible. The system should archive key exam result data before
deletion for record-keeping.
Assumptions: Students have alternative ways to access their learning history even after a
class is deleted (via their personal progress history).
b. Business Rules ID Business Rule Business Rule Description BR - 19 Class Deletion Safety A class can only be deleted if there are no active (in - progress) Rule exams. Completed exam result data is archived before the class is permanently removed.
13.3 UC-35_ View Student List in Class a. Functionalities Functional Description UC ID and Name: UC - 3 5 _ View Student List in Class
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Teacher Secondary Actors: None
Trigger: Teacher clicks on a class from the Teaching Dashboard and navigates to the
"Student List" tab.
Description: As a teacher, I want to view the full list of students enrolled in my class —
including each student's name, avatar, join date, overall progress, and last
active date — with search and sorting capabilities so that I can monitor
student engagement.
Preconditions: PRE - 1: The teacher is logged in. PRE-2: The teacher owns the class being viewed.
Postconditions: POST-1: The system displays the complete student roster for the class.
Normal Flow: 35.0 View Student List in Class
1. Teacher clicks on a class from their Teaching Dashboard.
2. Teacher navigates to the "Student List" / "Danh sách học sinh" tab.
3. System retrieves all students enrolled in the class.
4. System displays the student list with: Avatar, Full Name, Email, Join Date,
Last Active Date, Overall Progress (%).
5. Teacher can use the search bar to filter students by name or email.
6. Teacher can sort the list by: Name (A–Z), Join Date, Last Active Date,
Progress (ascending/descending).

7. Teacher clicks on a student's name to view their detailed individual progress
report.
Alternative Flows: None
Exceptions: 35.0.E1 No students have joined the class yet
1. System displays: "No students have joined this class yet. Share the class
code to invite students."
Priority: Must Have
Frequency of Use: Medium — reviewed weekly or before/after exam sessions by the teacher.
Business Rules: None
Other Information: Student contact information (email) should be displayed only to authorized
teachers. Data privacy policies must be respected.
Assumptions: Student progress data is updated in real time as students complete lessons
and exercises.
b. Business Rules None
13.4 UC-36_ Remove Student from Class a. Functionalities Functional Description UC ID and Name: UC-36_ Remove Student from Class
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Teacher Secondary Actors: None
Trigger: Teacher clicks "Remove Student" / "Xóa khỏi lớp" on a specific student entry
in the Student List page.
Description: As a teacher, I want to remove a specific student from my class so that their
access to class content and exams is revoked, and the student receives a
notification about the removal.
Preconditions: PRE-1: The teacher is logged in. PRE-2: The student is currently enrolled in the class. PRE-3: The teacher owns the class.
Postconditions: POST-1: The student is removed from the class roster. POST-2: The student's access to class-specific content and assigned exams is revoked. POST-3: The student receives a notification informing them of their removal.
Normal Flow: 3 6 .0 Remove Student from Class
1. Teacher navigates to the Student List for their class.
2. Teacher locates the student to be removed.
3. Teacher clicks "Remove" / "Xóa khỏi lớp" next to the student's entry.
4. System displays a confirmation dialog: "Are you sure you want to remove
[Student Name] from [Class Name]?"
5. Teacher clicks "Confirm" / "Xác nhận".
6. System removes the student from the class roster.
7. System sends a notification to the student: "You have been removed from
[Class Name] by [Teacher Name]."

8. System displays a success message to the teacher: "[Student Name] has
been removed from the class."
9. The student list is refreshed to reflect the change.
Alternative Flows: 36.1 Teacher cancels
1. Teacher clicks "Cancel".
2. System closes the dialog. No action taken.
Exceptions: 36.0.E1 Student has an active ongoing exam in the class
1. System displays: "[Student Name] is currently taking an exam. You cannot
remove them until the exam is submitted or the time limit expires."
2. UC stops until the exam concludes.
Priority: Must Have
Frequency of Use: Low — occasional action performed when managing class membership.
Business Rules: None
Other Information: Removed students can be re - added to the class using the class code if the
teacher allows. The removal action is logged for audit purposes.
Assumptions: Removal is immediate upon teacher confirmation. Notification to the student
is sent via in-app notification and optionally via email.
b. Business Rules None
14. Private Question Bank Management (Teacher)
14.1 UC-37_ View Private Question Bank (by Level / Skill) a. Functionalities Functional Description UC ID and Name: UC-37_ View Private Question Bank (by Level / Skill)
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Teacher Secondary Actors: None
Trigger: Teacher clicks 'My Question Bank' from the Teaching Dashboard.
Description: As a teacher, I want to view my private question bank filtered by JLPT level,
skill type, or question type so that I can browse my saved questions in a
paginated list with previews and manage them efficiently.
Preconditions: PRE - 1: The teacher is logged in. PRE-2: The teacher's account is approved (UC-53).
Postconditions: POST-1: The system displays the teacher's private question bank with applied
filters.
Normal Flow: 37.0 View Private Question Bank
1. Teacher navigates to 'My Question Bank' from the Teaching Dashboard.
2. System displays the Question Bank page with filter options: JLPT Level (N5–
N1), Skill Type (Vocabulary, Grammar, Reading, Listening), Question Type (Multiple-Choice, Fill-in-the-Blank, Short Answer).
3. Teacher selects one or more filters.
4. System retrieves and displays a paginated list of matching questions (20 per
page).
5. Each question entry shows: Question ID, Question preview (first 100 chars),
Skill type, Difficulty level, Date created.

6. Teacher can click on a question to view its full detail.
7. Teacher can click 'Edit' or 'Delete' on any question from this view.
Alternative Flows: 3 7 .1 Teacher views all questions without filters
1. Teacher clears all filters.
2. System displays all questions in the private bank (paginated).
Exceptions: 37.0.E1 The question bank is empty
1. System displays: 'Your question bank is empty. Click + Add Question to
create your first question.'
Priority: Must Have
Frequency of Use: Medium — accessed weekly when teachers prepare or review exam
questions.
Business Rules: None
Other Information: Private question bank questions are not visible to other teachers or admins
(except system admins for moderation). Pagination must be efficient for large
question banks.
Assumptions: Each teacher's question bank is isolated; questions cannot be shared between
teachers unless submitted to the global bank.
b. Business Rules None
14.2 UC-38_ Add Question to Private Bank a. Functionalities Functional Description UC ID and Name: UC-38_ Add Question to Private Bank
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Teacher Secondary Actors: None
Trigger: Teacher clicks '+ Add Question' in the Private Question Bank page.
Description: As a teacher, I want to add new questions to my private question bank by
providing question content, answer options, correct answer, explanation, skill
tag, and difficulty level so that I can build a question pool for creating exams.
Preconditions: PRE-1: The teacher is logged in. PRE-2: The teacher's account is approved.
Postconditions: POST-1: The new question is saved to the teacher's private question bank. POST-2: The question is immediately available for use in exam creation.
Normal Flow: 3 8 .0 Add Question to Private Bank
1. Teacher clicks '+ Add Question' on the Question Bank page.
2. System displays the Add Question form with fields:
- Question Type: Multiple-Choice / Fill-in-the-Blank / Short Answer
- Question Content (text, supports Japanese characters)
- Answer Options (for Multiple-Choice: options A, B, C, D)
- Correct Answer
- Explanation (why the correct answer is right)
- Skill Tag (Vocabulary / Grammar / Reading / Listening)
- JLPT Level (N5–N1)
- Difficulty (Easy / Medium / Hard)

3. Teacher fills in all required fields.
4. Teacher clicks 'Save Question' / 'Lưu câu hỏi'.
5. System validates all required fields (see 39.0.E1).
6. System saves the question to the teacher's private bank.
7. System displays a success message: 'Question added successfully.'
8. Teacher is returned to the Question Bank list view with the new question
visible.
Alternative Flows: None
Exceptions: 38.0.E1 Required fields are not filled
1. System highlights missing fields: 'Please fill in all required fields.'
2. Teacher completes the fields. => Return to Step 5 of Normal Flow.
38.0.E2 No correct answer is selected (Multiple-Choice)
1. System displays: 'Please select the correct answer.'
Priority: Must Have
Frequency of Use: Medium — teachers add questions regularly when building up their question
pool before exams.
Business Rules: BR-20
Other Information: The question form should support rich text or markdown for complex question
formatting. Audio or image attachments for listening/reading questions are a
future consideration.
Assumptions: Questions are saved immediately after validation. The teacher is responsible
for the accuracy and quality of their own questions.
b. Business Rules ID Business Rule Business Rule Description BR-20 Private Question Questions in a teacher's private bank are only visible to that Visibility Rule teacher and system administrators. They are not shared with other teachers unless explicitly submitted to the global question bank.
14.3 UC-39_ Edit Question in Private Bank a. Functionalities Functional Description UC ID and Name: UC-39_ Edit Question in Private Bank
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Teacher Secondary Actors: None
Trigger: Teacher clicks 'Edit' on a specific question in the Private Question Bank.
Description: As a teacher, I want to modify any question I have previously added to my
private bank — including question text, answer options, correct answer,
explanation, and metadata — so that changes are saved and reflected
immediately.
Preconditions: PRE-1: The teacher is logged in. PRE-2: The question to be edited exists in the teacher's private bank.
Postconditions: POST - 1: The question content is updated in the database.

POST-2: Changes are immediately reflected in the question bank list and any
future exam creation using this question.
Normal Flow: 39.0 Edit Question in Private Bank
1. Teacher navigates to the Private Question Bank and locates the question to
edit.
2. Teacher clicks 'Edit' / 'Chỉnh sửa' on the question.
3. System displays the Edit Question form pre-populated with the current
question data.
4. Teacher modifies the desired fields.
5. Teacher clicks 'Save Changes' / 'Lưu thay đổi'.
6. System validates the required fields (see 40.0.E1).
7. System updates the question in the database.
8. System displays a success message: 'Question updated successfully.'
Alternative Flows: 39.1 Teacher cancels editing
1. Teacher clicks 'Cancel'.
2. System discards changes. No data is modified.
Exceptions: 39 .0.E1 Required fields become empty after editing
1. System displays: 'Please ensure all required fields are filled.'
39.0.E2 Question is currently part of an active exam
1. System displays a warning: 'This question is used in an active exam. Editing
it now may affect exam integrity. Do you wish to continue?'
2. Teacher chooses 'Yes' or 'Cancel'.
Priority: Must Have
Frequency of Use: Low to Medium — performed when teachers need to correct or improve
existing questions.
Business Rules: None
Other Information: If a question is used in an active exam, edits should be flagged or restricted to
prevent mid-exam inconsistency.
Assumptions: Teachers are responsible for ensuring edited questions remain accurate and
consistent.
b. Business Rules None
14.4 UC-40_ Delete Question from Private Bank a. Functionalities Functional Description UC ID and Name: UC-40_ Delete Question from Private Bank
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Teacher Secondary Actors: None
Trigger: Teacher clicks 'Delete' on a specific question in the Private Question Bank.
Description: As a teacher, I want to permanently delete a question from my private bank,
with a confirmation prompt, noting that questions currently used in active
exams cannot be deleted until the exam concludes.
Preconditions: PRE-1: The teacher is logged in.

PRE-2: The question is in the teacher's private bank. PRE-3: The question is not currently used in any active (in-progress) exam.
Postconditions: POST - 1: The question is permanently removed from the private question
bank.
Normal Flow: 40 .0 Delete Question from Private Bank
1. Teacher locates the question in the Private Question Bank.
2. Teacher clicks 'Delete' / 'Xóa' on the question.
3. System checks if the question is used in any active exam (see 40.0.E1).
4. System displays a confirmation dialog: 'Are you sure you want to delete this
question? This action cannot be undone.'
5. Teacher clicks 'Confirm' / 'Xác nhận'.
6. System permanently deletes the question from the bank.
7. System displays: 'Question deleted successfully.'
Alternative Flows: 40.1 Teacher cancels
1. Teacher clicks 'Cancel'. No action taken.
Exceptions: 40.0.E1 Question is used in an active exam
1. System displays: 'This question cannot be deleted because it is part of an
active exam. Please wait until the exam concludes.'
2. UC stops.
Priority: Should Have
Frequency of Use: Low — occasional cleanup action.
Business Rules: BR - 21
Other Information: Deletion is irreversible. Questions used in completed (not active) exams can
be deleted; their historical data in result records is preserved.
Assumptions: Active exams are those currently in - progress (started but not yet submitted by
all students).
b. Business Rules ID Business Rule Business Rule Description BR-21 Active Exam Protection A question that is part of an active (in-progress) exam cannot be Rule deleted or significantly edited until all students have submitted the exam or the exam window has closed.
15. Exam Management (Teacher)
15.1 UC-41_ Create Exam (from Question Bank / AI-Generated) a. Functionalities Functional Description UC ID and Name: UC-41_ Create Exam (from Question Bank / AI-Generated)
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Teacher Secondary Actors: AI Engine
Trigger: Teacher clicks 'Create Exam' / 'Tạo đề thi' from the Teaching Dashboard.
Description: As a teacher, I want to create a new exam by selecting questions from my
private or the shared global bank, or by requesting the AI to generate
questions automatically, so that I can review and finalize the question set
before saving the exam.

Preconditions: PRE-1: The teacher is logged in. PRE-2: The teacher has at least one question in their private bank or the global
bank has questions available.
Postconditions: POST-1: The exam is created and saved in draft or published state. POST-2: The exam is available to assign to a class (UC-44).
Normal Flow: 41.0 Create Exam
1. Teacher clicks 'Create Exam' from the Teaching Dashboard.
2. System displays the Create Exam setup page with fields: Exam Name,
Description, Time Limit (minutes), Total Points, Instructions.
3. Teacher fills in exam metadata and clicks 'Next'.
4. System displays the Question Selection page with two options: 'Select from
Question Bank' and 'AI Generate Questions'. 5a. [Manual Selection] Teacher browses the question bank (private + global), applies filters, and clicks 'Add' on desired questions. 5b. [AI Generation] Teacher specifies: Level, Skill, Question type, Quantity. Teacher clicks 'Generate'. AI generates the questions. Teacher reviews and may accept, remove, or regenerate individual questions.
6. Teacher reviews the final question set: question order, point values per
question.
7. Teacher clicks 'Save as Draft' or 'Save and Publish'.
8. System saves the exam.
9. System displays a success message and shows the exam in the teacher's
exam list.
Alternative Flows: None
Exceptions: 41 .0.E1 AI question generation fails
1. System displays: 'AI generation is temporarily unavailable. Please select
questions manually.'
41.0.E2 No questions selected before saving
1. System displays: 'An exam must have at least one question.'
Priority: Must Have
Frequency of Use: Medium — performed before each exam period. Teachers may create 2–5
exams per semester.
Business Rules: BR-22
Other Information: Exams saved as Draft are not visible to students. Published exams can be
assigned to classes.
Assumptions: AI question generation is available and returns relevant questions within 15
seconds.
b. Business Rules ID Business Rule Business Rule Description BR-22 Minimum Question Rule An exam must contain at least 1 question and cannot be saved or assigned without any questions. Total points must be greater than 0.
15.2 UC-42_Edit Exam a. Functionalities Functional Description

UC ID and Name: UC-42_ Edit Exam
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Teacher Secondary Actors: None
Trigger: Teacher clicks 'Edit' on an exam from their Exam Management list.
Description: As a teacher, I want to modify an existing exam I have created — including
adding/removing questions, changing the time limit, adjusting point values,
and updating instructions — noting that editing is restricted once the exam is
assigned and started by students.
Preconditions: PRE-1: The teacher is logged in. PRE-2: The exam was created by this teacher. PRE-3: The exam has not been started by any student (not in 'active' state).
Postconditions: POST-1: The exam is updated with the new configuration. POST-2: Changes are reflected for any future student attempts.
Normal Flow: 42.0 Edit Exam
1. Teacher navigates to Exam Management and clicks 'Edit' on the target
exam.
2. System verifies the exam is not currently active (see 42.0.E1).
3. System displays the Edit Exam form pre-populated with current data.
4. Teacher modifies fields: Exam Name, Instructions, Time Limit, Question set
(add/remove), Point values.
5. Teacher clicks 'Save Changes'.
6. System validates changes.
7. System saves the updated exam.
8. System displays: 'Exam updated successfully.'
Alternative Flows: None
Exceptions: 42 .0.E1 Exam is currently active (students have started)
1. System displays: 'This exam cannot be edited because students are
currently taking it. Please wait until the exam window closes.'
2. UC stops.
Priority: Must Have
Frequency of Use: Low — performed infrequently before exam deployment.
Business Rules: BR-21
Other Information: Teachers should be warned if editing affects questions that have already been
submitted by some students in partial attempts.
Assumptions: Exams in 'draft' or 'published but not yet started' states are fully editable.
b. Business Rules ID Business Rule Business Rule Description BR-21 Active Exam Protection A question that is part of an active (in-progress) exam cannot be Rule deleted or significantly edited until all students have submitted the exam or the exam window has closed.
15.3 UC-43_ Delete Exam a. Functionalities Functional Description UC ID and Name: UC - 43 _ Delete Exam

Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Teacher Secondary Actors: None
Trigger: Teacher clicks 'Delete' on an exam in the Exam Management list.
Description: As a teacher, I want to permanently delete an exam I created — only if it has
not been assigned or has already been completed — so that the exam and all
associated data are removed after a confirmation dialog.
Preconditions: PRE - 1: The teacher is logged in. PRE-2: The exam belongs to this teacher. PRE-3: The exam is in 'Draft' state or 'Completed' state (not 'Active' or
'Assigned').
Postconditions: POST-1: The exam and all associated data are permanently deleted.
Normal Flow: 43.0 Delete Exam
1. Teacher navigates to Exam Management and clicks 'Delete' on the target
exam.
2. System checks exam status (see 43.0.E1).
3. System displays a confirmation dialog: 'This will permanently delete the
exam and all associated result data. This action cannot be undone.'
4. Teacher clicks 'Confirm Delete'.
5. System permanently removes the exam record.
6. System displays: 'Exam deleted successfully.'
Alternative Flows: None
Exceptions: 43.0.E1 Exam is currently assigned or active
1. System displays: 'This exam cannot be deleted because it is currently
assigned to a class or in progress. Please unassign or wait for completion.'
Priority: Should Have
Frequency of Use: Very Low — occasional cleanup of old or unused exams.
Business Rules: None
Other Information: Completed exam result data for students may be archived rather than deleted
for academic record purposes.
Assumptions: Only the exam creator (teacher) or an Admin can delete an exam.
b. Business Rules None
15.4 UC-44_ Assign Exam to Class a. Functionalities Functional Description UC ID and Name: UC - 44 _ Assign Exam to Class
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Teacher Secondary Actors: None
Trigger: Teacher clicks 'Assign to Class' from the exam detail page or Exam
Management list.
Description: As a teacher, I want to assign an exam to one or more of my classes by setting
the start time, end time, time limit per attempt, and number of allowed

attempts so that students in the selected class receive a notification about the
upcoming exam.
Preconditions: PRE-1: The teacher is logged in. PRE-2: The exam exists and is in 'Published' state. PRE-3: The teacher owns at least one class.
Postconditions: POST-1: The exam assignment record is created for the selected class(es). POST-2: Students in the class receive an in-app and/or email notification about the exam. POST-3: The exam appears on enrolled students' dashboards within the
assigned time window.
Normal Flow: 44.0 Assign Exam to Class
1. Teacher selects an exam and clicks 'Assign to Class'.
2. System displays the assignment configuration form: Class(es) selector, Start
Date & Time, End Date & Time, Time Limit per Attempt (minutes), Number of Allowed Attempts.
3. Teacher selects the target class(es) and configures the settings.
4. Teacher clicks 'Assign' / 'Giao đề'.
5. System validates the configuration (see 44.0.E1, 44.0.E2).
6. System creates the assignment record.
7. System sends notifications to all enrolled students in the selected class(es).
8. System displays: 'Exam assigned successfully to [Class Name].'
Alternative Flows: None
Exceptions: 44 .0.E1 End time is before Start time
1. System displays: 'End time must be after start time.'
44.0.E2 Start time is in the past
1. System displays: 'Start time cannot be in the past.'
Priority: Must Have
Frequency of Use: Medium — performed before each exam session.
Business Rules: BR-17
Other Information: Teachers can assign the same exam to multiple classes simultaneously. The
same exam can be assigned multiple times with different schedules.
Assumptions: Student notifications are delivered within 5 minutes of assignment. Teachers
are responsible for communicating exam details to students through other
channels as well.
b. Business Rules ID Business Rule Business Rule Description BR-17 Exam Window Rule Students can only start an exam within the assigned start and end time window. Attempts outside this window are rejected by the system.
15.5 UC-45_ Grade Exam (Manual / AI-Assisted) a. Functionalities Functional Description UC ID and Name: UC - 45 _ Grade Exam (Manual / AI - Assisted)
Created By: Group 4 Date Created: 30/May/2025

Primary Actor: Teacher Secondary Actors: AI Engine
Trigger: Teacher navigates to exam submissions and clicks 'Grade Exam' after student
submissions are available.
Description: As a teacher, I want to review student answers and assign scores — with
objective questions auto-graded and subjective questions graded manually or
with AI suggestions — so that final scores are published to students upon
completion.
Preconditions: PRE-1: The teacher is logged in. PRE-2: At least one student has submitted the exam. PRE-3: The exam belongs to this teacher.
Postconditions: POST - 1: All student submissions are graded. POST-2: Final scores are saved to the database. POST-3: Results are published and visible to students.
Normal Flow: 45.0 Grade Exam
1. Teacher navigates to Exam Management and selects the completed exam.
2. System displays a list of student submissions with auto-graded scores for
objective questions.
3. For objective questions (Multiple-Choice, Fill-in-the-Blank): System has
already auto-graded these.
4. Teacher reviews auto-graded results. Teacher can override auto-graded
scores if needed.
5. For subjective questions (Short Answer, Writing): System displays the
student's response.
6. Teacher reads the response and assigns a manual score. Alternatively,
teacher clicks 'Get AI Suggestion' to receive a suggested score with rationale.
7. Teacher accepts or adjusts the AI-suggested score.
8. Repeat for all subjective questions across all student submissions.
9. Teacher clicks 'Publish Results' / 'Công bố kết quả'.
10. System saves all scores and publishes the results.
11. System notifies students that their results are available.
Alternative Flows: None
Exceptions: 45 .0.E1 AI grading suggestion service is unavailable
1. System displays: 'AI grading suggestion is temporarily unavailable. Please
grade manually.'
2. Teacher proceeds with manual grading.
Priority: Must Have
Frequency of Use: Medium — performed after each exam session.
Business Rules: None
Other Information: Once results are published, students receive a notification. Teachers can re-
open grading to make corrections before final publication.
Assumptions: AI suggestions for short-answer grading provide a score and brief rationale
within 5 seconds per question.
b. Business Rules None

15.6 UC-46_ View Exam Result History (Teacher) a. Functionalities Functional Description UC ID and Name: UC-46_ View Exam Result History (Teacher)
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Teacher Secondary Actors: None
Trigger: Teacher clicks 'View Results' on a completed exam in the Exam Management
list.
Description: As a teacher, I want to view a complete history of all exams I have assigned,
including per-student scores, average score, score distribution charts,
question-level analysis, and downloadable reports so that I can evaluate
teaching effectiveness.
Preconditions: PRE-1: The teacher is logged in. PRE-2: At least one exam has been completed and graded.
Postconditions: POST-1: The system displays a comprehensive result report for the selected
exam.
Normal Flow: 46.0 View Exam Result History (Teacher)
1. Teacher navigates to Exam Management and clicks 'View Results' on a
completed exam.
2. System displays the exam result dashboard with:
- Class average score and highest/lowest score
- Score distribution histogram
- Student-by-student result table: name, score, time taken, pass/fail
- Question-level analysis: per-question correct rate, difficulty index
3. Teacher can click on a student's row to view their individual answer sheet.
4. Teacher can download the result report as a CSV or PDF.
Alternative Flows: None
Exceptions: 46.0.E1 No submissions exist for the exam
1. System displays: 'No student submissions found for this exam.'
Priority: Must Have
Frequency of Use: Medium — reviewed after each grading cycle.
Business Rules: None
Other Information: Question-level analysis helps teachers identify which questions are too easy or
too difficult for future refinement.
Assumptions: All student data is accurately recorded and retrievable for reporting.
b. Business Rules None
16. Exam Monitoring (Teacher)
16.1 UC-47_ Monitor Exam Status in Real Time a. Functionalities Functional Description UC ID and Name: UC-47_ Monitor Exam Status in Real Time
Created By: Group 4 Date Created: 30/May/2025

Primary Actor: Teacher Secondary Actors: None
Trigger: Teacher clicks 'Create Exam' / 'Tạo đề thi' from the Teaching Dashboard.
Description: Teacher opens the exam monitoring dashboard during an active exam.
Preconditions: As a teacher, during an active exam I want to view a real-time monitoring
dashboard showing each student's status (not started, in progress, submitted),
time remaining, and current question number, with automatic refresh.
Postconditions: PRE - 1: The teacher is logged in. PRE-2: An exam assigned by this teacher is currently active (within its time
window).
Normal Flow: POST-1: The system continuously displays real-time exam status for all
students.
Alternative Flows: 47.0 Monitor Exam Status in Real Time
1. Teacher navigates to Exam Management and selects an active exam.
2. Teacher clicks 'Monitor Exam' / 'Giám sát thi'.
3. System displays the monitoring dashboard showing a grid of all enrolled
students with:
- Student name and avatar
- Status: Not Started / In Progress / Submitted
- For In Progress: Time remaining and current question number
- For Submitted: Submission time
4. Dashboard auto-refreshes every 30 seconds.
5. Teacher can manually refresh at any time.
6. Teacher can click on a student to view if any abnormal behaviors have been
flagged (links to UC-48).
Exceptions: None
Priority: 47 .0.E1 Real - time data fails to load
1. System displays an error and attempts to reconnect automatically.
Frequency of Use: Should Have
Business Rules: Medium — used during each active exam session.
Other Information: None
Assumptions: Real-time monitoring requires WebSocket or polling mechanism. Large class
sizes (>100 students) should still render efficiently.
b. Business Rules None
16.2 UC-48_ View Abnormal Behavior Log a. Functionalities Functional Description UC ID and Name: UC - 48 _ View Abnormal Behavior Log
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Teacher Secondary Actors: None
Trigger: Teacher clicks on a student with flagged behavior in the monitoring
dashboard, or accesses the 'Behavior Log' tab after the exam.

Description: As a teacher, I want to view a detailed log of suspicious behaviors recorded
during an exam for each student — including tab switching, copy-paste
attempts, window focus loss, and rapid answer submission with timestamps
— so that I can review potential cheating incidents.
Preconditions: PRE-1: The teacher is logged in. PRE-2: The exam has been assigned by this teacher. PRE-3: The system has recorded at least one abnormal behavior event.
Postconditions: POST - 1: The system displays the behavior log for the selected student/exam.
Normal Flow: 48.0 View Abnormal Behavior Log
1. Teacher opens the exam monitoring dashboard or navigates to a completed
exam.
2. Teacher clicks on a student with a 'Flagged' behavior indicator or selects the
'Behavior Log' tab.
3. System displays the behavior log for the student with:
- Timestamp of each event
- Event type (Tab Switch, Window Focus Loss, Copy Attempt, Rapid
Submission, etc.)
- Frequency count per event type
4. Teacher reviews the log and determines if further action is needed (links to
UC-49).
Alternative Flows: None
Exceptions: 48.0.E1 No abnormal behaviors recorded for this student
1. System displays: 'No suspicious behaviors were recorded for this student
during the exam.'
Priority: Should Have
Frequency of Use: Low to Medium — used when monitoring flags suspicious behavior during or
after an exam.
Business Rules: BR-23
Other Information: The behavior log is for teacher review only. The existence of behavior flags
does not automatically constitute academic dishonesty — teacher judgment is
required.
Assumptions: The client-side exam application has event listeners to detect and report the
listed behaviors to the server.
b. Business Rules ID Business Rule Business Rule Description BR - 23 Behavior Monitoring The system records the following events during an exam as Rule potential abnormal behaviors: browser tab switching (>2 times), window focus loss (>2 times), Ctrl+C or right-click attempts on question text, and submitting all answers within the first 20% of the time limit.
16.3 UC-49_ Handle Suspected Cheating Cases a. Functionalities Functional Description UC ID and Name: UC - 49 _ Handle Suspected Cheating Cases

Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Teacher Secondary Actors: None
Trigger: Teacher clicks 'Take Action' on a flagged student in the behavior log (UC-47).
Description: As a teacher, I want to take action on flagged suspicious behavior cases —
including sending a warning, invalidating the student's attempt, or marking for
review — with all actions logged with a reason note.
Preconditions: PRE - 1: The teacher is logged in. PRE-2: A student's exam behavior has been flagged (from UC-47).
Postconditions: POST - 1: The selected action is applied to the student's exam attempt. POST-2: The action and reason are recorded in the audit log. POST-3: The student is notified of the action taken (if applicable).
Normal Flow: 49.0 Handle Suspected Cheating Cases
1. Teacher reviews the behavior log for a flagged student (via UC-47).
2. Teacher clicks 'Take Action' / 'Xử lý'.
3. System displays the action options:
a. Send Warning: sends an in-exam pop-up warning to the student b. Invalidate Attempt: marks the student's submission as invalid (score = 0) c. Mark for Review: flags the submission for further administrative review
4. Teacher selects an action.
5. System prompts for a mandatory reason/note.
6. Teacher enters the reason and clicks 'Confirm'.
7. System applies the action:
- For Send Warning: sends real-time notification to student during exam.
- For Invalidate Attempt: sets score to 0 and marks submission as
'Invalidated'.
- For Mark for Review: adds a flag visible to admin.
8. System logs the action with: teacher name, student name, action type,
reason, timestamp.
9. System displays: 'Action applied successfully.'
Alternative Flows: None
Exceptions: 49.0.E1 Exam has already been finalized and graded
1. System displays: 'The exam has already been finalized. Contact the
administrator for post-exam adjustments.'
Priority: Should Have
Frequency of Use: Very Low — used only when suspected cheating is identified.
Business Rules: None
Other Information: Invalidating an attempt is a serious action. The system should require a reason
to ensure accountability. Admin should be notified when an attempt is
invalidated.
Assumptions: All actions are immediately applied on the server side. Students are notified
within seconds.
b. Business Rules None

17. User Management (Admin)
17.1 UC-50_ View User List a. Functionalities Functional Description UC ID and Name: UC-50_ View User List
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'User Management' / 'Quản lý người dùng' in the Admin sidebar.
Description: As an admin, I want to view a complete list of all registered users with filters
by role, account status, and registration date, plus search by name or email, so
that I can efficiently manage user accounts and maintain platform security.
Preconditions: PRE-1: The user is logged in with Admin role.
Postconditions: POST-1: The system displays the filtered user list.
Normal Flow: 50.0 View User List
1. Admin navigates to User Management from the Admin sidebar.
2. System displays the User List page with all registered users.
3. Each row shows: Avatar, Full Name, Email, Role (Student/Teacher/Admin),
Account Status (Active/Locked/Pending), Registration Date.
4. Admin can apply filters: Role, Status, Registration Date range.
5. Admin can search by Full Name or Email using the search bar.
6. Admin can sort by any column header.
7. Admin can click on a user row to view detailed account information.
Alternative Flows: None
Exceptions: 50.0.E1 No users match the applied filters
1. System displays: 'No users found matching the selected criteria.'
Priority: Must Have
Frequency of Use: Medium — accessed regularly by admins for oversight and user management
tasks.
Business Rules: None
Other Information: Paginate results (49 per page). User list should be exportable to CSV for
administrative reporting.
Assumptions: All user registration data is stored accurately in the database.
b. Business Rules None
17.2 UC-51_ View User List a. Functionalities Functional Description UC ID and Name: UC - 51 _ View User List
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Lock' or 'Unlock' on a specific user in the User List page.

Description: As an admin, I want to lock a user account to prevent login access or unlock a
previously locked account, providing a reason when locking and notifying the
user, with the action recorded in the audit log.
Preconditions: PRE-1: Admin is logged in. PRE-2: The target user account exists.
Postconditions: POST-1: The account status is updated to Locked or Active. POST-2: The user is notified via email of the account status change. POST-3: The action is recorded in the system audit log.
Normal Flow: 51 .0 Lock / Unlock Account
1. Admin navigates to User Management and locates the target user.
2a. [Lock] Admin clicks 'Lock Account' / 'Khóa tài khoản' on the user.
- System displays a dialog: 'Please provide a reason for locking this account.'
- Admin enters a reason and clicks 'Confirm Lock'.
- System updates account status to 'Locked'.
- System sends an email to the user: 'Your account has been locked. Reason:
[reason].'
- System logs the action.
2b. [Unlock] Admin clicks 'Unlock Account' / 'Mở khóa tài khoản'.
- System displays a confirmation dialog.
- Admin confirms.
- System updates account status to 'Active'.
- System sends an email to the user: 'Your account has been unlocked.'
- System logs the action.
3. System displays: 'Account status updated successfully.'
Alternative Flows: None
Exceptions: 51 .0.E1 Admin attempts to lock the only active Admin acc ount
1. System displays: 'You cannot lock the last active Admin account.'
Priority: Must Have
Frequency of Use: Low — performed infrequently for violation management.
Business Rules: BR-24
Other Information: Locked users receive a specific error message upon login (see UC-02 Exception
2.0.E3). The reason for locking is visible in the user detail view.
Assumptions: Email notifications are delivered reliably to the user's registered email.
b. Business Rules ID Business Rule Business Rule Description BR - 24 Reason Required for Lock A mandatory reason must be provided when locking a user Rule account. This reason is stored in the audit log and communicated to the user via email.
17.3 UC-52_ Assign User Role a. Functionalities Functional Description UC ID and Name: UC-52_ Assign User Role
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin selects 'Change Role' from a user's detail page.

Description: As an admin, I want to assign or change a user's role (Student / Teacher /
Admin) with a confirmation step, so that the role change takes effect on the
user's next login session.
Preconditions: PRE-1: Admin is logged in. PRE-2: The target user account exists.
Postconditions: POST-1: The user's role is updated in the database. POST-2: The role change takes effect on the user's next login.
Normal Flow: 52.0 Assign User Role
1. Admin opens the detail page of the target user.
2. Admin clicks 'Change Role' / 'Thay đổi vai trò'.
3. System displays a role selector: Student / Teacher / Admin.
4. Admin selects the new role.
5. System displays a confirmation: 'Change [User Name]'s role from [Current
Role] to [New Role]?'
6. Admin clicks 'Confirm'.
7. System updates the user's role in the database.
8. System displays: 'Role updated successfully. The change will take effect on
the user's next login.'
9. System sends an email notification to the user informing them of the role
change.
Alternative Flows: None
Exceptions: 52.0.E1 Admin tries to demote the last Admin
1. System displays: 'Cannot change role: at least one Admin account must
remain.'
Priority: Must Have
Frequency of Use: Very Low — performed occasionally for role corrections or promotions.
Business Rules: None
Other Information: Assigning Teacher role to a user bypasses the normal Teacher approval
process. This should be used carefully.
Assumptions: Role changes do not affect the user's historical data or comple ted exams.
b. Business Rules None
17.4 UC-53_ Approve Teacher Account a. Functionalities Functional Description UC ID and Name: UC-53_ Approve Teacher Account
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin receives a notification of a pending teacher account registration or
navigates to 'Pending Approvals' in User Management.
Description: As an admin, I want to review teacher registration requests and either
approve or reject them so that approved accounts gain full teacher
permissions while rejected accounts receive a notification with the reason.

Preconditions: PRE-1: Admin is logged in. PRE-2: At least one teacher account registration is in 'Pending' state.
Postconditions: POST - 1: The account status is changed to 'Active' (approved) or 'Rejected'. POST-2: The user is notified of the decision via email.
Normal Flow: 53 .0 Approve Teacher Account
1. Admin navigates to User Management > Pending Approvals.
2. System displays a list of pending teacher account registrations with: Name,
Email, Registration Date, any supporting info provided.
3. Admin reviews a pending registration.
4a. [Approve] Admin clicks 'Approve' / 'Phê duyệt'.
- System changes account status to 'Active' with Teacher role.
- System sends an approval email to the teacher.
4b. [Reject] Admin clicks 'Reject' / 'Từ chối'.
- System prompts for a rejection reason.
- Admin enters reason and clicks 'Confirm'.
- System changes account status to 'Rejected' and sends a rejection email
with the reason.
5. System displays: 'Action completed successfully.'
Alternative Flows: None
Exceptions: 53.0.E1 No pending teacher accounts
1. System displays: 'No pending teacher registrations at this time.'
Priority: Must Have
Frequency of Use: Low — performed whenever new teacher registrations are received.
Business Rules: BR-25
Other Information: Rejected accounts may re-register or appeal. Approved teachers immediately
gain access to all teacher features.
Assumptions: New users who register as Teacher are automatically placed in 'Pending' status
until approved.
b. Business Rules ID Business Rule Business Rule Description BR - 25 Teacher Approval All teacher account registrations require admin approval before Workflow Rule the user can access teacher features. A rejected account can be reconsidered if the user provides additional verification.
18. Course Management (Admin)
18.1 UC-54_ Create Course a. Functionalities Functional Description UC ID and Name: UC-54_ Create Course
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Create New Course' in the Course Management section.
Description: As an admin, I want to create a new course by specifying its name, target JLPT
level, description, cover image, and syllabus structure so that the course is
saved as a draft and can be published after content is added.

Preconditions: PRE-1: Admin is logged in.
Postconditions: POST-1: A new course record is saved in the database in 'Draft' state. POST-2: The course appears in the Admin's Course Management list.
Normal Flow: 54.0 Create Course
1. Admin navigates to Course Management and clicks 'Create New Course'.
2. System displays the course creation form with fields: Course Name, Target
JLPT Level, Description, Cover Image (upload), Syllabus (add modules and lessons).
3. Admin fills in all required fields and structures the syllabus.
4. Admin clicks 'Save as Draft' or 'Publish'.
5. System validates the input (see 54.0.E1).
6. System saves the course.
7. System displays: 'Course created successfully.'
Alternative Flows: None
Exceptions: 54 .0.E1 Required fields are missing
1. System highlights missing fields and displays: 'Please fill in all required
fields.'
Priority: Must Have
Frequency of Use: Low — courses are created infrequently, typically at the start of a new
academic period.
Business Rules: None
Other Information: Draft courses are not visible to students until published. The cover image
should be in JPG/PNG format under 5 MB.
Assumptions: Admins can create and manage course content directly within the platform.
b. Business Rules None
18.2 UC-55_ View User List a. Functionalities Functional Description UC ID and Name: UC - 55 _ Edit Course
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Edit' on a course in the Course Management list.
Description: As an admin, I want to edit an existing course's details including title,
description, target level, cover image, and lesson structure so that changes are
immediately visible to enrolled users.
Preconditions: PRE - 1: Admin is logged in. PRE-2: The target course exists.
Postconditions: POST - 1: Course details are updated and changes are immediately visible to
enrolled users.
Normal Flow: 55.0 Edit Course
1. Admin navigates to Course Management and clicks 'Edit' on a course.
2. System displays the Edit Course form pre-populated with current data.

3. Admin modifies the desired fields.
4. Admin clicks 'Save Changes'.
5. System validates and saves the updates.
6. System displays: 'Course updated successfully.'
Alternative Flows: None
Exceptions: 55.0.E1 Required fields are cleared
1. System displays: 'Required fields cannot be empty.'
Priority: Must Have
Frequency of Use: Low — updated when curriculum changes are needed.
Business Rules: None
Other Information: Changes to published courses are immediately visible. Significant structural
changes should be preceded by student notifications.
Assumptions: Admins take responsibility for notifying students of major course content
changes.
b. Business Rules None
18.3 UC-56_ Delete Course a. Functionalities Functional Description UC ID and Name: UC-56_ Delete Course
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Delete' on a course in Course Management.
Description: As an admin, I want to permanently delete a course — only if it has no active
enrollments — with enrolled students notified before deletion.
Preconditions: PRE-1: Admin is logged in. PRE-2: The course has no active enrollments.
Postconditions: POST-1: The course and all its lesson content are permanently removed. POST-2: Previously enrolled students are notified.
Normal Flow: 56 .0 Delete Course
1. Admin navigates to Course Management and clicks 'Delete' on a course.
2. System checks for active enrollments (see 56.0.E1).
3. System displays a confirmation dialog.
4. Admin confirms.
5. System notifies previously enrolled students.
6. System removes the course.
7. System displays: 'Course deleted successfully.'
Alternative Flows: None
Exceptions: 56.0.E1 Course has active enrollments
1. System displays: 'This course has active enrollments and cannot be
deleted. Please unenroll all students first.'
Priority: Should Have
Frequency of Use: Very Low.

Business Rules: None
Other Information: Completion progress data for previously enrolled students may be archived.
Assumptions: Admin verifies with stakeholders before deleting a course with enrolled
history.
b. Business Rules None
19. Vocabulary Management (Admin)
19.1 UC-57_ Create Vocabulary List by Topic / Level a. Functionalities Functional Description UC ID and Name: UC - 57 _ Create Vocabulary List by Topic / Level
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Create Vocabulary List' in Vocabulary Management.
Description: As an admin, I want to create a new vocabulary list by specifying the list name,
JLPT level or topic, and adding vocabulary entries so that the list is saved and
available to all users for study.
Preconditions: PRE - 1: Admin is logged in.
Postconditions: POST - 1: The new vocabulary list and its entries are saved and accessible to
users.
Normal Flow: 57 .0 Create Vocabulary List
1. Admin navigates to Vocabulary Management and clicks 'Create Vocabulary
List'.
2. System displays a form: List Name, JLPT Level or Topic, and an entry editor.
3. Admin adds vocabulary entries: Word, Reading (furigana), Meaning, Part of
Speech, Example Sentence.
4. Admin clicks 'Save' / 'Lưu'.
5. System validates and saves the list.
6. System displays: 'Vocabulary list created successfully.'
Alternative Flows: None
Exceptions: 57 .0.E1 No entries added
1. System displays: 'Please add at least one vocabulary entry before saving.'
Priority: Must Have
Frequency of Use: Low — created during initial platform setup and as new content is added.
Business Rules: None
Other Information: Bulk import via CSV/Excel should be supported for efficiency.
Assumptions: Admin has prepared vocabulary content and has the linguistic expertise to
verify entries.
b. Business Rules None

19.2 UC-58_ Edit Vocabulary List a. Functionalities Functional Description UC ID and Name: UC-58_ Edit Vocabulary List
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Edit' on a vocabulary list in Vocabulary Management.
Description: As an admin, I want to edit an existing vocabulary list — modifying list
metadata and adding, updating, or removing individual entries — so that
changes are immediately reflected for all users.
Preconditions: PRE-1: Admin is logged in. PRE-2: The vocabulary list exists.
Postconditions: POST-1: The updated list and entries are immediately available to users.
Normal Flow: 58.0 Edit Vocabulary List
1. Admin selects a list and clicks 'Edit'.
2. System displays the edit form with existing list data.
3. Admin modifies metadata or individual entries.
4. Admin clicks 'Save Changes'.
5. System saves updates and displays: 'Vocabulary list updated.'
Alternative Flows: None
Exceptions: 58 .0.E1 All entries deleted
1. System warns: 'A vocabulary list must have at least one entry.'
Priority: Must Have
Frequency of Use: Low to Medium.
Business Rules: None
Other Information: Admins should be able to add/remove individual entries without re-uploading
the entire list.
Assumptions: Changes are version - controlled for rollback capability (future enhancement).
b. Business Rules None
19.3 UC-59_ Delete Vocabulary List a. Functionalities Functional Description UC ID and Name: UC-59_ Delete Vocabulary List
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Delete' on a vocabulary list.
Description: As an admin, I want to permanently delete a vocabulary list — with a
confirmation prompt — and notify users who have saved items from this list.
Preconditions: PRE-1: Admin is logged in. PRE-2: The vocabulary list exists.
Postconditions: POST - 1: The list and all its entries are removed.

POST-2: Users who saved items from this list are notified.
Normal Flow: 59.0 Delete Vocabulary List
1. Admin clicks 'Delete' on a vocabulary list.
2. System displays confirmation dialog.
3. Admin confirms.
4. System notifies affected users.
5. System deletes the list.
6. System displays: 'Vocabulary list deleted.'
Alternative Flows: None
Exceptions: 59.0.E1 Server error
1. System displays: 'Deletion failed. Please try again.'
Priority: Should Have
Frequency of Use: Very Low.
Business Rules: None
Other Information: Flashcards created from this list's words are not deleted — only the source list
is removed.
Assumptions: Notification system is operational to alert affected users.
b. Business Rules None
20. Kanji Management (Admin)
20.1 UC-60_ Create Kanji List by Topic / Level a. Functionalities Functional Description UC ID and Name: UC-60_ Create Kanji List by Topic / Level
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Create Kanji List' in Kanji Management.
Description: As an admin, I want to create a new kanji list by topic or JLPT level, with each
entry including the kanji character, on-yomi, kun-yomi, meaning, stroke count,
and example words.
Preconditions: PRE-1: Admin is logged in.
Postconditions: POST-1: The kanji list is saved and accessible to users.
Normal Flow: 60.0 Create Kanji List
1. Admin navigates to Kanji Management and clicks 'Create Kanji List'.
2. System displays the form: List Name, JLPT Level or Topic.
3. Admin adds kanji entries: Kanji Character, On-yomi, Kun-yomi, Meaning,
Stroke Count, Example Words.
4. Admin clicks 'Save'.
5. System validates and saves. System displays: 'Kanji list created.'
Alternative Flows: None
Exceptions: 60.0.E1 No entries added
1. System displays: 'Please add at least one kanji entry.'
Priority: Must Have

Frequency of Use: Low.
Business Rules: None
Other Information: Stroke order diagram upload should be supported for each kanji entry.
Assumptions: Admin has verified kanji data accuracy against JLPT standards.
b. Business Rules None
20.2 UC-61_ Edit Kanji List a. Functionalities Functional Description UC ID and Name: UC-61_ Edit Vocabulary List
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Edit' on a kanji list.
Description: As an admin, I want to edit an existing kanji list — updating metadata or
individual kanji entries — with changes immediately reflected in the user-
facing kanji browser.
Preconditions: PRE-1: Admin is logged in. PRE-2: The kanji list exists.
Postconditions: POST-1: Updates are saved and immediately visible to users.
Normal Flow: 61.0 Edit Kanji List
1. Admin selects a kanji list and clicks 'Edit'.
2. System displays the edit form.
3. Admin modifies entries.
4. Admin clicks 'Save Changes'.
5. System saves and displays: 'Kanji list updated.'
Alternative Flows: None
Exceptions: 61 .0.E1 Required fields empty
1. System displays validation error.
Priority: Must Have
Frequency of Use: Low.
Business Rules: None
Other Information: Editing does not affect flashcards already created from this list.
Assumptions: Admin has authority over all kanji content.
b. Business Rules None
20.3 UC-62_ Delete Kanji List a. Functionalities Functional Description UC ID and Name: UC-62_ Delete Kanji List
Created By: Group 4 Date Created: 30/May/2025

Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Delete' on a kanji list.
Description: As an admin, I want to permanently delete a kanji list after a confirmation
prompt, removing the list and all its entries from the database.
Preconditions: PRE-1: Admin is logged in. PRE-2: The kanji list exists.
Postconditions: POST-1: The kanji list and all entries are permanently removed.
Normal Flow: 62.0 Delete Kanji List
1. Admin clicks 'Delete' on a kanji list.
2. System displays a confirmation dialog.
3. Admin confirms.
4. System deletes the list and all entries.
5. System displays: 'Kanji list deleted.'
Alternative Flows: None
Exceptions: 62 .0.E1 Server error
1. System displays: 'Deletion failed. Please try again.'
Priority: Should Have
Frequency of Use: Very Low.
Business Rules: None
Other Information: None.
Assumptions: Deletion is irreversible.
b. Business Rules None
21. Grammar Management (Admin)
21.1 UC-63_ Create Grammar List by Level a. Functionalities Functional Description UC ID and Name: UC - 60 _ Create Gammar List by Level
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Create Grammar List' in Grammar Management.
Description: As an admin, I want to create a new grammar pattern list for a specific JLPT
level, with each entry including the grammar pattern, structure formula,
meaning, usage notes, conjugation rules, and multiple example sentences.
Preconditions: PRE - 1: Admin is logged in.
Postconditions: POST - 1: The grammar list is saved and accessible to users.
Normal Flow: 63.0 Create Grammar List
1. Admin navigates to Grammar Management and clicks 'Create Grammar
List'.
2. System displays the form: List Name, JLPT Level.
3. Admin adds grammar entries: Pattern, Structure, Meaning, Usage Notes,
Conjugation Rules, Example Sentences (min. 2).
4. Admin clicks 'Save'.

5. System validates and saves. System displays: 'Grammar list created.'
Alternative Flows: None
Exceptions: 63.0.E1 No entries added
1. System displays: 'Please add at least one grammar pattern.'
Priority: Must Have
Frequency of Use: Low.
Business Rules: None
Other Information: Each grammar entry should have at least 2 example sentences for clarity.
Assumptions: Admin has linguistic expertise in Japanese grammar at the relevant JLPT levels.
b. Business Rules None
21.2 UC-64_ Edit Grammar List a. Functionalities Functional Description UC ID and Name: UC-64_ Edit Grammar List
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Edit' on a grammar list.
Description: As an admin, I want to edit an existing grammar list — updating the list name,
level, or individual grammar entries — with updates immediately visible to
users.
Preconditions: PRE-1: Admin is logged in. PRE-2: The grammar list exists.
Postconditions: POST-1: Updates are saved and immediately visible to users.
Normal Flow: 64.0 Edit Grammar List
1. Admin selects a grammar list and clicks 'Edit'.
2. System displays the edit form pre-populated.
3. Admin modifies desired fields.
4. Admin clicks 'Save Changes'.
5. System saves and displays: 'Grammar list updated.'
Alternative Flows: None
Exceptions: 64.0.E1 Required fields empty
1. System displays validation error.
Priority: Must Have
Frequency of Use: Low.
Business Rules: None
Other Information: None.
Assumptions: Admin reviews grammar entries for linguistic accuracy before saving.
b. Business Rules None

21.3 UC-65_ Delete Grammar List a. Functionalities Functional Description UC ID and Name: UC-65_ Delete Gammar List
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Delete' on a grammar list.
Description: As an admin, I want to permanently delete a grammar list after a confirmation
dialog, removing the list and all associated entries from the system.
Preconditions: PRE - 1: Admin is logged in. PRE-2: The grammar list exists.
Postconditions: POST-1: The list and all entries are permanently deleted.
Normal Flow: 65.0 Delete Grammar List
1. Admin clicks 'Delete' on a grammar list.
2. System displays a confirmation dialog.
3. Admin confirms.
4. System deletes the list and entries.
5. System displays: 'Grammar list deleted.'
Alternative Flows: None
Exceptions: 65.0.E1 Server error
1. System displays: 'Deletion failed. Please try again.'
Priority: Should Have
Frequency of Use: Very Low.
Business Rules: None
Other Information: None.
Assumptions: Deletion is irreversible.
b. Business Rules None
22. Listening Content Management (Admin)
22.1 UC-66_ Create Listening Material by Level a. Functionalities Functional Description UC ID and Name: UC-66_ Create Listening Material (Video / Audio)
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Upload Listening Material' in Listening Content Management.
Description: As an admin, I want to upload a video or audio file with a text transcript so
that the AI can auto-generate a transcript if needed, and after specifying
metadata (level), the material is published for users.
Preconditions: PRE-1: Admin is logged in. PRE-2: The audio/video file is prepared for upload.
Postconditions: POST-1: The listening material is saved and published for user access.

Normal Flow: 66.0 Create Listening Material
1. Admin navigates to Listening Content Management and clicks 'Upload
Listening Material'.
2. System displays the upload form: File Upload (Audio/Video), Transcript (text
area), Level, Topic
3. Admin uploads the audio/video file.
4. Admin may click 'Auto-Generate Transcript' for AI to transcribe the audio.
5. AI generates and populates the transcript field.
6. Admin reviews and edits the transcript for accuracy.
7. Admin fills in metadata: Level (N5–N1)
8. Admin clicks 'Publish' / 'Xuất bản'.
9. System validates and saves the material. System displays: 'Listening material
published.'
Alternative Flows: None
Exceptions: 66 .0.E1 File format not supported
1. System displays: 'Unsupported file format. Please upload MP3, MP4, or
WAV files.'
66.0.E2 AI transcription fails
1. System displays: 'Auto-transcription failed. Please enter the transcript
manually.'
Priority: Must Have
Frequency of Use: Low — content creation is infrequent.
Business Rules: BR-26
Other Information: Supported audio formats: MP3, WAV. Supported video formats: MP4. Max file
size: 490 MB.
Assumptions: Admin reviews AI-generated transcripts for accuracy before publishing.
b. Business Rules ID Business Rule Business Rule Description BR-26 Listening Content Format Accepted audio formats are MP3 and WAV. Accepted video Rule formats are MP4. Maximum file size per upload is 490 MB. Transcripts must be provided for all listening materials.
22.2 UC-67_ Edit Listening Material a. Functionalities Functional Description UC ID and Name: UC - 67 _ Edit Listening Material
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Edit' on a listening material in Listening Content Management.
Description: As an admin, I want to edit existing listening content — replacing the
audio/video file, updating the transcript, correcting timestamps, and changing
metadata — with changes saved and immediately available to users.
Preconditions: PRE - 1: Admi n is logged in. PRE-2: The listening material exists.

Postconditions: POST-1: Updated listening material is immediately available to users.
Normal Flow: 67.0 Edit Listening Material
1. Admin selects a listening material and clicks 'Edit'.
2. System displays the edit form pre-populated.
3. Admin modifies the desired fields.
4. Admin clicks 'Save Changes'.
5. System validates and saves. System displays: 'Listening material updated.'
Alternative Flows: None
Exceptions: 67.0.E1 New file format unsupported
1. System displays the format error.
Priority: Must Have
Frequency of Use: Low.
Business Rules: None
Other Information: If the audio file is replaced, any existing fill-in-the-blank exercises linked to it
should be reviewed.
Assumptions: Admin reviews changes before saving.
b. Business Rules None
22.3 UC-68_ Delete Listening Material a. Functionalities Functional Description UC ID and Name: UC - 68 _ Delete Listening Material
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Delete' on a listening material.
Description: As an admin, I want to permanently delete a listening material item —
including the audio/video file, transcript, and all related exercise data — after
a confirmation prompt.
Preconditions: PRE - 1: Admin is logged in. PRE-2: The listening material exists.
Postconditions: POST-1: The audio/video file, transcript, and all related exercises are
permanently removed.
Normal Flow: 68 .0 Delete Listening Material
1. Admin clicks 'Delete' on a listening material.
2. System displays a confirmation: 'This will delete the audio/video and all
associated exercises. Continue?'
3. Admin confirms.
4. System removes the material and all linked exercises.
5. System displays: 'Listening material deleted.'
Alternative Flows: None
Exceptions: 68 .0.E1 Server error
1. System displays: 'Deletion failed. Please try again.'
Priority: Should Have

Frequency of Use: Very Low.
Business Rules: None
Other Information: None.
Assumptions: Deletion is irreversible.
b. Business Rules None
23. Reading Content Management (Admin)
23.1 UC-69_ Create Reading Material a. Functionalities Functional Description UC ID and Name: UC-69_ Create Reading Material
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Create Reading Material' in Reading Content Management.
Description: As an admin, I want to create new reading content by entering article text,
specifying JLPT level, topic, estimated reading time, and vocabulary highlights
so that the material is published for reading practice.
Preconditions: PRE-1: Admin is logged in.
Postconditions: POST-1: The reading material is saved and made available to users.
Normal Flow: 69.0 Create Reading Material
1. Admin navigates to Reading Content Management and clicks 'Create'.
2. System displays the form: Title, Article Text (rich text editor supporting
Japanese), JLPT Level, Topic, Estimated Reading Time, Vocabulary Highlights.
3. Admin enters the article content and metadata.
4. Admin highlights key vocabulary in the text for pop-up definitions.
5. Admin clicks 'Publish'.
6. System saves and publishes. System displays: 'Reading material created.'
Alternative Flows: None
Exceptions: 69.0.E1 Article text is empty
1. System displays: 'Article content cannot be empty.'
Priority: Must Have
Frequency of Use: Low.
Business Rules: None
Other Information: The rich text editor should support furigana markup. Vocabulary highlights link
to dictionary entries.
Assumptions: Admin provides culturally and linguistically appropriate content.
b. Business Rules None

23.2 UC-70_ Create Reading Material a. Functionalities Functional Description UC ID and Name: UC-70_ Edit Reading Material
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Edit' on a reading material.
Description: As an admin, I want to edit existing reading materials — revising text, updating
vocabulary highlights, changing difficulty level, and modifying tags — with
updates immediately visible to users.
Preconditions: PRE-1: Admin is logged in. PRE-2: The reading material exists.
Postconditions: POST-1: Changes are saved and immediately visible to users.
Normal Flow: 70.0 Edit Reading Material
1. Admin selects a reading material and clicks 'Edit'.
2. System displays the edit form.
3. Admin makes modifications.
4. Admin clicks 'Save Changes'.
5. System saves updates. System displays: 'Reading material updated.'
Alternative Flows: None
Exceptions: 70 .0.E1 Content cleared
1. System displays: 'Article content cannot be empty.'
Priority: Must Have
Frequency of Use: Low.
Business Rules: None
Other Information: None.
Assumptions: Admin has editorial authority over all reading content.
b. Business Rules None
23.3 UC-71_ Delete Reading Material a. Functionalities Functional Description UC ID and Name: UC-71_ Delete Reading Material
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Delete' on a reading material.
Description: As an admin, I want to permanently delete a reading material — along with all
associated AI-generated comprehension exercises — after a confirmation
prompt.
Preconditions: PRE-1: Admin is logged in. PRE-2: The reading material exists.

Postconditions: POST-1: The reading material and all associated exercises are permanently
removed.
Normal Flow: 71.0 Delete Reading Material
1. Admin clicks 'Delete' on a reading material.
2. System displays confirmation dialog noting associated exercises will also be
deleted.
3. Admin confirms.
4. System removes the material and all linked comprehension exercises.
5. System displays: 'Reading material deleted.'
Alternative Flows: None
Exceptions: 71.0.E1 Server error
1. System displays: 'Deletion failed. Please try again.'
Priority: Should Have
Frequency of Use: Very Low.
Business Rules: None
Other Information: None.
Assumptions: Deletion is irreversible.
b. Business Rules None
24. JLPT Exam Management (Admin)
24.1 UC-72_ Create JLPT Mock Test a. Functionalities Functional Description UC ID and Name: UC-72_ Create JLPT Mock Test
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Create JLPT Mock Test' in JLPT Exam Management.
Description: As an admin, I want to create a JLPT mock test for a specific level (N5 – N1) by
assembling questions across all required sections following official JLPT format
rules for question count and time allocation.
Preconditions: PRE - 1: Admin is logged in. PRE-2: Sufficient questions exist in the global question bank for the target
level.
Postconditions: POST-1: The JLPT mock test is created and published for user access.
Normal Flow: 72.0 Create JLPT Mock Test
1. Admin navigates to JLPT Exam Management and clicks 'Create JLPT Mock
Test'.
2. Admin selects the target JLPT level (N5–N1).
3. System pre-populates the required section structure per the official JLPT
format (question count and time limits per section for the selected level).
4. Admin selects or confirms questions for each section from the global
question bank.
5. Admin reviews the complete test structure.
6. Admin clicks 'Publish Test' / 'Xuất bản bài thi'.

7. System validates the test meets format requirements (see 72.0.E1).
8. System saves and publishes the mock test.
9. System displays: 'JLPT mock test published successfully.'
Alternative Flows: None
Exceptions: 72 .0.E1 Insufficient questions for any section
1. System displays: 'Not enough questions in the [Section] category for
[Level]. Please add more questions to the global bank first.'
Priority: Must Have
Frequency of Use: Low — created a few times per year.
Business Rules: BR-18
Other Information: The system should enforce JLPT question counts per level. Mock tests are
available to all users immediately upon publication.
Assumptions: Admin has sufficient questions prepared in the global bank. JLPT format
specifications are hardcoded per level.
b. Business Rules BR - 18 JLPT Mock Test Format Each mock test must adhere to the official JLPT section structure Rule and time allocation for the selected level (e.g., N3: Vocabulary 25 min, Grammar/Reading 69 min, Listening 40 min).
24.2 UC-73_ Edit JLPT Mock Test a. Functionalities Functional Description UC ID and Name: UC-73_ Edit JLPT Mock Test
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Edit' on a JLPT mock test.
Description: As an admin, I want to edit an existing JLPT mock test — modifying questions,
adjusting section structure, updating time limits, and correcting answer keys
— noting that edits to published tests are restricted until the test is
deactivated.
Preconditions: PRE - 1: Admin is logged in. PRE-2: The test is in 'Draft' or 'Deactivated' state.
Postconditions: POST-1: The mock test is updated.
Normal Flow: 73.0 Edit JLPT Mock Test
1. Admin selects a mock test and clicks 'Edit'.
2. System checks the test status (see 73.0.E1).
3. System displays the edit form.
4. Admin makes modifications.
5. Admin clicks 'Save Changes'.
6. System validates and saves. System displays: 'Mock test updated.'
Alternative Flows: None
Exceptions: 73.0.E1 Test is currently active (published and available)

1. System displays: 'This test is currently active. Please deactivate it before
editing.'
Priority: Must Have
Frequency of Use: Very Low.
Business Rules: None
Other Information: None.
Assumptions: Admin deactivates a test before making significant edits.
b. Business Rules None
24.3 UC-74_ Delete JLPT Mock Test a. Functionalities Functional Description UC ID and Name: UC-74_ Delete JLPT Mock Test
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Delete' on a JLPT mock test.
Description: As an admin, I want to permanently delete a JLPT mock test — only if it is not
currently active — with all associated result data archived before removal.
Preconditions: PRE-1: Admin is logged in. PRE-2: The test is not currently active.
Postconditions: POST-1: The mock test is permanently removed. POST-2: Associated result data is archived.
Normal Flow: 74.0 Delete JLPT Mock Test
1. Admin clicks 'Delete' on a mock test.
2. System verifies the test is not active (see 74.0.E1).
3. System displays confirmation dialog.
4. Admin confirms.
5. System archives result data.
6. System deletes the test.
7. System displays: 'Mock test deleted and results archived.'
Alternative Flows: None
Exceptions: 74.0.E1 Test is currently active
1. System displays: 'This test is currently active and cannot be deleted. Please
deactivate it first.'
Priority: Should Have
Frequency of Use: Very Low.
Business Rules: None
Other Information: None.
Assumptions: Result archiving occurs synchronously before deletion confirmation.
b. Business Rules None

24.4 UC-75_ View Student JLPT Result History a. Functionalities Functional Description UC ID and Name: UC-75_ View Student JLPT Result History
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin navigates to JLPT Exam Management and clicks 'View Results'.
Description: As an admin, I want to view a report of all students' JLPT mock test results —
filterable by level, date range, and student name — including individual
scores, pass/fail status, section breakdowns, and platform-wide statistics.
Preconditions: PRE-1: Admin is logged in. PRE-2: At least one student has completed a JLPT mock test.
Postconditions: POST - 1: The s ystem displays the JLPT result report.
Normal Flow: 75 .0 View Student JLPT Result History
1. Admin navigates to JLPT Exam Management > View Results.
2. System displays the results page with filters: Level (N5–N1), Date Range,
Student Name.
3. Admin applies filters.
4. System retrieves and displays the filtered result records: Student Name,
JLPT Level, Date, Total Score, Section Scores, Pass/Fail.
5. System displays platform-wide statistics: average score per level, pass rate
per level.
6. Admin can export the report to CSV.
Alternative Flows: None
Exceptions: 75.0.E1 No results match filters
1. System displays: 'No results found for the selected filters.'
Priority: Should Have
Frequency of Use: Low — periodic administrative reporting.
Business Rules: None
Other Information: This report aids admin in understanding platform learning outcomes and
content effectiveness.
Assumptions: All student JLPT mock test results are stored and queryable.
b. Business Rules None
25. Global Question Bank Management
25.1 UC-76_ View Global Question Bank a. Functionalities Functional Description UC ID and Name: UC-76_ View Global Question Bank
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin, Teacher Secondary Actors: None

Trigger: Admin or Teacher navigates to 'Global Question Bank' from the navigation
menu.
Description: As an admin or teacher, I want to browse the shared global question bank
filtered by JLPT level, skill type, question type, and difficulty so that I can find
approved questions to use in exam creation.
Preconditions: PRE-1: The user is logged in as Admin or Teacher.
Postconditions: POST-1: The system displays the filtered global question bank.
Normal Flow: 76 .0 View Global Question Bank
1. User navigates to Global Question Bank.
2. System displays the bank with filter options: Level, Skill, Question Type,
Difficulty.
3. User applies filters.
4. System displays the matching questions in a paginated list (20 per page).
5. Each entry shows: Question ID, Preview, Skill, Difficulty, Usage Count.
6. User can click a question to view full details or click 'Add to Exam' to include
it in an exam.
Alternative Flows: None
Exceptions: 76.0.E1 No questions match filters
1. System displays: 'No questions found for the selected criteria.'
Priority: Must Have
Frequency of Use: Medium — accessed when teachers are composing exams.
Business Rules: None
Other Information: Teachers can view but not edit global bank questions; only Admins can
modify.
Assumptions: The global question bank is maintained and quality-controlled by Admins.
b. Business Rules None
25.2 UC-77_ Add Question to Global Bank a. Functionalities Functional Description UC ID and Name: UC-77_ Add Question to Global Bank
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks '+ Add Question' in the Global Question Bank.
Description: As an admin, I want to add new questions to the global question bank shared
across all teachers, requiring complete content, answer options, correct
answer, explanation, skill tag, level, and difficulty rating.
Preconditions: PRE-1: Admin is logged in.
Postconditions: POST-1: The question is added to the global bank and immediately available to
all teachers.
Normal Flow: 77 .0 Add Question to Global Bank
1. Admin clicks '+ Add Question' in the Global Question Bank.

2. System displays the Add Question form (same fields as UC-39 for private
bank).
3. Admin fills in all required fields.
4. Admin clicks 'Save to Global Bank'.
5. System validates and saves.
6. System displays: 'Question added to global bank.'
Alternative Flows: None
Exceptions: 77 .0.E1 Required fields missing
1. System displays validation errors.
Priority: Must Have
Frequency of Use: Low — performed during content creation cycles.
Business Rules: BR-27
Other Information: Questions in the global bank can be used by all teachers when creating exams.
Assumptions: Admin is responsible for quality and accuracy of global bank questions.
b. Business Rules BR - 27 Global Bank Quality Rule All questions added to the global bank must include a complete explanation for the correct answer. Questions without explanations cannot be saved to the global bank.
25.3 UC-78_ Edit Global Question Bank a. Functionalities Functional Description UC ID and Name: UC - 78 _ Edit Global Question Bank
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Edit' on a question in the Global Question Bank.
Description: As an admin, I want to edit any question in the global bank — updating
content, answer choices, correct answer, explanation, and metadata — with
changes immediately visible to all teachers.
Preconditions: PRE - 1: Admin is logged in. PRE-2: The question is in the global bank.
Postconditions: POST-1: The updated question is immediately visible to all teachers.
Normal Flow: 78 .0 Edit Question in Global Bank
1. Admin locates a question and clicks 'Edit'.
2. System displays the edit form pre-populated.
3. Admin modifies fields.
4. Admin clicks 'Save Changes'.
5. System validates and saves. System displays: 'Question updated.'
Alternative Flows: None
Exceptions: 78.0.E1 Question is in an active exam
1. System displays a warning per BR-21.
Priority: Must Have
Frequency of Use: Low.
Business Rules: BR-21

Other Information: None.
Assumptions: Admin corrections to global questions benefit all teachers using the bank.
b. Business Rules ID Business Rule Business Rule Description BR-21 Active Exam Protection A question that is part of an active (in-progress) exam cannot be Rule deleted or significantly edited until all students have submitted the exam or the exam window has closed.
25.4 UC-79_ Delete Global Question Bank a. Functionalities Functional Description UC ID and Name: UC-79_ Delete Global Question Bank
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin clicks 'Delete' on a question in the Global Question Bank.
Description: As an admin, I want to permanently delete a question from the global bank —
protected if used in active exams — with a confirmation prompt and the
deletion recorded in the audit log.
Preconditions: PRE-1: Admin is logged in. PRE-2: The question is not used in any active exam.
Postconditions: POST-1: The question is permanently removed from the global bank. POST-2: The deletion is recorded in the audit log.
Normal Flow: 79.0 Delete Question from Global Bank
1. Admin clicks 'Delete' on a global bank question.
2. System checks if the question is in any active exam (see 79.0.E1).
3. System displays confirmation dialog.
4. Admin confirms.
5. System deletes the question.
6. System logs the deletion in the audit log.
7. System displays: 'Question deleted from global bank.'
Alternative Flows: None
Exceptions: 79 .0.E1 Question is used in an active exam
1. System displays: 'This question is currently used in an active exam and
cannot be deleted.'
Priority: Should Have
Frequency of Use: Very Low.
Business Rules: BR-21
Other Information: None.
Assumptions: Deleted global bank questions remain in historical exam records for integrity.
b. Business Rules ID Business Rule Business Rule Description

BR-21 Active Exam Protection A question that is part of an active (in-progress) exam cannot be Rule deleted or significantly edited until all students have submitted the exam or the exam window has closed.
26. Reports & Analytics (Admin)
26.1 UC-80_ View System-wide Statistics Report a. Functionalities Functional Description UC ID and Name: UC-80_ View System-wide Statistics Report
Created By: Group 4 Date Created: 30/May/2025
Primary Actor: Admin Secondary Actors: None
Trigger: Admin navigates to 'Reports & Analytics' from the Admin sidebar.
Description: As an admin, I want to view a comprehensive analytics dashboard covering
platform-wide statistics — including total users by role, active users,
enrollment rates, exam scores, most-studied content, and feature usage
metrics — so that I can make data-driven decisions about platform
management and content.
Preconditions: PRE-1: Admin is logged in.
Postconditions: POST - 1: The analytics dashboard is displayed with up - to - date platform
statistics.
Normal Flow: 80.0 View System-wide Statistics Report
1. Admin navigates to Reports & Analytics from the Admin Control Panel.
2. System loads the analytics dashboard.
3. System displays key metrics grouped into sections:
- User Statistics: Total users by role (Student/Teacher/Admin), New
registrations per period (daily/weekly/monthly), Active users per period.
- Content Engagement: Course enrollment rates per course, Average course
completion rate, Most-studied vocabulary lists, Most-studied grammar patterns, Most-accessed reading materials.
- Exam Statistics: Average exam scores by level, JLPT mock test pass rates per
level, Exam completion rates.
- Feature Usage: Most-used platform features (flashcards, dictionary,
listening, etc.), Peak usage times.
4. Admin can filter statistics by date range.
5. Admin can export the report as a PDF or CSV.
Alternative Flows : None
Exceptions: 80 .0.E1 Statistics data fails to load
1. System displays: 'Unable to load statistics. Please refresh the page.'
Priority: Should Have
Frequency of Use: Low — reviewed monthly or quarterly by admins.
Business Rules: None
Other Information: Data in the analytics dashboard may have a 1-hour refresh delay for
performance optimization. Charts and graphs should be interactive (hover for
details).

Assumptions: Analytics data is aggregated server-side and stored in a reporting database.
Sensitive user data (PII) is not displayed in aggregate statistics.
b. Business Rules None