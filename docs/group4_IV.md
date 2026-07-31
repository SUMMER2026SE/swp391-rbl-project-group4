# IV. Appendix

## 3. Business Rules

| **ID** | **Category** | **Rule Definition** |
| --- | --- | --- |
| BR-01 | Integrity | Notify Guest with MSG03 if the submitted email address is already linked to an existing account; the registration is rejected and no duplicate account is created. |
| BR-02 | Validation | Notify User with MSG02 if the password (or new password) entered contains fewer than 8 characters — applies to registration (UC-01), change password (UC-05), forgot password (UC-06) and admin password reset (UC-67). |
| BR-03 | Validation | Notify Guest/User with MSG04 if the entered OTP is incorrect (showing the remaining attempts), or with MSG05 if the OTP has expired; the account is created, or the password reset, only after a valid code is confirmed within the limited validity window and attempt count. |
| BR-04 | Authorization | Notify Student with MSG14 if they already have a pending teacher application; otherwise notify with MSG16 when AI screening auto-approves a complete, verifiable application, or with MSG15 when it is queued for an administrator's decision. |
| BR-05 | Authorization | Notify User with MSG07 if login fails due to incorrect credentials; on a successful login, route the user directly to the workspace matching their role (Student, Teacher or Admin). |
| BR-06 | Integrity | Notify User with MSG08 regardless of whether the submitted email exists; a reset code is sent only when the account is real, so the response never reveals which emails are registered. |
| BR-07 | Validation | Notify User with MSG13 if the full name field is left empty when saving profile changes; the email field is always read-only and the role field is editable only by an administrator. |
| BR-08 | Action-Enabler | Notify Student with MSG17 if the monthly learning-roadmap generation/regeneration quota has been reached, and direct them to the subscription upgrade page (UC-36). |
| BR-09 | Integrity | Notify Student with MSG18 once the payment gateway confirms the transfer and access is granted; notify with MSG19 if the order expires or is never confirmed, in which case no access is granted. |
| BR-10 | Structural | Notify User with MSG20 if they exit full-screen mode during a proctored quiz or mock-exam attempt; the violation is logged for later review, and the AI Chat Sensei assistant (UC-34) is locked for the duration of the attempt. |
| BR-11 | Action-Enabler | Notify Student with MSG21 if the daily AI definition-suggestion quota is exhausted; suggestions stay unavailable until the next day. |
| BR-12 | Action-Enabler | Notify Student with MSG22 if the daily quota for generating/regenerating a flashcard test is exhausted; retaking an already generated test is always free and does not consume the quota. |
| BR-13 | Action-Enabler | Notify Student with MSG24 if the daily quota for opening **new** passages is reached; re-reading an already opened passage never counts against the quota. |
| BR-14 | Action-Enabler | Notify Student with MSG25 if the monthly speech-recognition pronunciation-scoring quota is reached. |
| BR-15 | Action-Enabler | Notify Student with MSG27 if the monthly quota for creating personal listening items is reached. |
| BR-16 | Action-Enabler | Notify Student with MSG28 if the monthly practice-sheet quota, or the maximum number of characters allowed per sheet, is exceeded. |
| BR-17 | Authorization | Notify User with MSG29 if the selected mock exam is not published or has been removed; only published exams can be seen or taken. |
| BR-18 | Structural | Notify User with MSG30 when a section's timer reaches zero; the section is submitted automatically and cannot be reopened. |
| BR-19 | Structural | Rank only students' **first** completed attempt per exam, ordered by score (higher first) then completion time (faster first); teacher attempts are recorded for themselves only and never shown on the leaderboard. |
| BR-20 | Action-Enabler | Notify User with MSG31 if the daily AI Chat Sensei message quota is reached. |
| BR-21 | Authorization | Notify Teacher/Admin with MSG32 if they attempt to edit, delete, publish or unpublish content they do not own; an administrator's access to a teacher's course is limited to read-only preview. |
| BR-22 | Structural | Display each study post's author (admin as "Kizuna Nihongo", or the teacher's name); the post is published immediately by its author, with no separate review step or approval message. |
| BR-23 | Authorization | Notify Teacher with MSG32 if they attempt to modify a question in the global question bank; a teacher may only copy global questions into their own private bank, which stays visible to that teacher alone. |
| BR-24 | Authorization | Notify Admin with MSG35 if they attempt to change or demote their own role; changing any user's role is otherwise available only to administrators. |
| BR-25 | Computation | Compute each teacher's monthly share of the revenue pool in proportion to their content usage, and notify Teacher with MSG38 once an administrator finalizes the month; figures remain estimates and are not payable until finalized. |

## 4. Application Messages List

| **#** | **Message Code** | **Message Type** | **Context** | **Content** |
| --- | --- | --- | --- | --- |
| 1 | MSG01 | In line | Registration: a required field is left blank | Vui lòng điền đầy đủ thông tin. |
| 2 | MSG02 | In line | Password shorter than 8 characters — registration, change password, forgot password, admin reset | Mật khẩu phải có ít nhất 8 ký tự. |
| 3 | MSG03 | Toast message | Registration: the email address is already linked to an account | Email này đã được đăng ký. |
| 4 | MSG04 | In line | OTP entered is incorrect — registration or forgot password | Mã xác thực không chính xác. Bạn còn {n} lần thử. |
| 5 | MSG05 | Toast message | OTP has expired — registration or forgot password | Mã xác thực đã hết hạn. Vui lòng yêu cầu gửi lại mã. |
| 6 | MSG06 | Toast message | Registration: the verification email could not be delivered | Không thể gửi email xác thực. Vui lòng thử lại. |
| 7 | MSG07 | Toast message | Login failed due to an incorrect email or password | Email hoặc mật khẩu không chính xác. |
| 8 | MSG08 | Toast message | Forgot password: neutral response shown whether or not the email exists | Nếu email tồn tại trong hệ thống, mã xác thực đã được gửi đến hộp thư của bạn. |
| 9 | MSG09 | In line | Change password: the current password entered is incorrect | Mật khẩu hiện tại không đúng. |
| 10 | MSG10 | In line | Change password: the new password is the same as the current one | Mật khẩu mới phải khác mật khẩu hiện tại. |
| 11 | MSG11 | In line | Change/reset password: the confirmation does not match the new password | Mật khẩu xác nhận không khớp. |
| 12 | MSG12 | Toast message | Change password completed successfully | Đổi mật khẩu thành công. |
| 13 | MSG13 | In line | Edit profile: the full name field is left empty | Vui lòng nhập họ tên. |
| 14 | MSG14 | Toast message | Teacher application: the user already has an application pending review | Bạn đang có một đơn đăng ký chờ duyệt. |
| 15 | MSG15 | Toast message | Teacher application: submitted and queued for administrator review | Đơn đăng ký của bạn đang chờ quản trị viên xét duyệt. |
| 16 | MSG16 | Toast message | Teacher application: auto-approved by the AI screening | Đơn đăng ký của bạn đã được duyệt tự động. Chúc mừng bạn đã trở thành giáo viên! |
| 17 | MSG17 | Toast message | Learning roadmap: monthly generation quota reached | Bạn đã sử dụng hết lượt tạo lộ trình học trong tháng này. Hãy nâng cấp để có thêm lượt. |
| 18 | MSG18 | Toast message | Course/subscription payment confirmed by the gateway | Thanh toán thành công. Quyền lợi của bạn đã được kích hoạt. |
| 19 | MSG19 | Toast message | Payment order expired or was never confirmed | Đơn hàng đã hết hạn hoặc chưa được xác nhận thanh toán. |
| 20 | MSG20 | Pop up message | Proctored quiz/mock exam: the user exits full-screen mode | Bạn đã thoát chế độ toàn màn hình. Hành động này đã được ghi nhận. |
| 21 | MSG21 | Toast message | Flashcards: daily AI definition-suggestion quota reached | Bạn đã sử dụng hết lượt gợi ý AI hôm nay. Vui lòng quay lại vào ngày mai. |
| 22 | MSG22 | Toast message | Flashcards: daily test generation quota reached | Bạn đã sử dụng hết lượt tạo bài kiểm tra hôm nay. |
| 23 | MSG23 | Toast message | Dictionary: the searched word is not found | Không tìm thấy kết quả. Vui lòng kiểm tra lại chính tả. |
| 24 | MSG24 | Toast message | Reading: daily new-passage quota reached | Bạn đã đọc hết lượt bài đọc mới hôm nay. Hãy nâng cấp để đọc không giới hạn. |
| 25 | MSG25 | Toast message | Shadowing: monthly pronunciation-practice quota reached | Bạn đã sử dụng hết lượt luyện phát âm trong tháng này. |
| 26 | MSG26 | Toast message | Shadowing: the speech-recognition service failed to process the recording | Lỗi nhận dạng giọng nói. Vui lòng thử lại. |
| 27 | MSG27 | Toast message | Personal listening content: monthly creation quota reached | Bạn đã sử dụng hết lượt tạo nội dung nghe trong tháng này. |
| 28 | MSG28 | Toast message | Kanji writing: monthly practice-sheet quota or per-sheet character limit exceeded | Bạn đã đạt giới hạn tạo bộ luyện viết hoặc số ký tự cho phép trong tháng này. |
| 29 | MSG29 | Toast message | Mock exam: the selected exam is not published or is unavailable | Đề thi này hiện chưa được công bố hoặc đã bị gỡ. |
| 30 | MSG30 | Pop up message | Mock exam: a section's time limit is reached and it is auto-submitted | Hết giờ làm bài. Phần thi đã được nộp tự động. |
| 31 | MSG31 | Toast message | AI Chat Sensei: daily message quota reached | Bạn đã sử dụng hết lượt chat với AI hôm nay. Hãy nâng cấp để trò chuyện không giới hạn. |
| 32 | MSG32 | Toast message | Content management: the user is not permitted to edit, delete or publish this content | Bạn không có quyền thao tác trên nội dung này. |
| 33 | MSG33 | Modal confirmation | Content management: confirm before a permanent deletion (course, post, question, exam, flashcard set, listening item, user, etc.) | Hành động này sẽ xóa vĩnh viễn. Bạn có chắc chắn muốn tiếp tục? |
| 34 | MSG34 | Toast message | Content management: a deletion completed successfully | Đã xóa thành công. |
| 35 | MSG35 | Toast message | User management: an admin attempts to change/demote their own role | Không thể tự hạ quyền admin của chính mình. |
| 36 | MSG36 | Toast message | User management: an admin attempts to delete their own account | Không thể xóa tài khoản của chính mình. |
| 37 | MSG37 | Toast message | User management: a user account was deleted successfully | Đã xóa người dùng. |
| 38 | MSG38 | Toast message | Revenue sharing: the month is finalized and the teacher's payout is recorded | Doanh thu tháng đã được chốt số liệu. Khoản chi trả của bạn đã được ghi nhận. |
| 39 | MSG39 | Toast message | Browse/search: no results match the applied filter or keyword | Không tìm thấy kết quả nào phù hợp. |
| 40 | MSG40 | Toast message | AI-assisted feature: the AI service is temporarily unavailable | Dịch vụ AI hiện không khả dụng. Vui lòng thử lại sau. |
