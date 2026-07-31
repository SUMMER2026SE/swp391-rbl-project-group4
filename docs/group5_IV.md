## 3. Business Rules

| ID | Category | Rule Definition |
| --- | --- | --- |
| BR-01 | Validation | Notify Guests with MSG01 if they don't provide a valid email address. |
| BR-02 | Validation | Notify Users with MSG02 if they provide an invalid password (less than 8 characters). |
| BR-03 | Integrity | Notify Guest with MSG03 if the provided email has already been used to register. |
| BR-04 | Authorization | Notify User with MSG04 if incorrect login credentials are provided, redirect to guest homepage; notify with MSG05 if correct credentials are provided, redirect to user homepage. |
| BR-05 | Validation | Notify Users with MSG06 if they provide an invalid old password. |
| BR-06 | Validation | Notify with MSG07 if the email is not registered, notify with MSG08 if it is registered. |
| BR-07 | Validation | Notify with MSG09 if OTP is incorrect, reload OTP form; if OTP is correct, notify with MSG010 and redirect to reset password. |
| BR-08 | Validation | Notify User with MSG11 if the re-entered password is incorrect. |
| BR-09 | Action-Enabler | Display MSG17 if no search results are found. |
| BR-10 | Structural | Display old sent/received messages in a conversation. |
| BR-11 | Performance | Ensure message sending time is under 3 seconds. |
| BR-12 | Integrity | School, company, and skill must be selected from available lists, and seekers can choose more than one. |
| BR-13 | Validation | Notify with MSG18 if CV information is incomplete when trying to save. |
| BR-14 | Integrity | Job application form must include offer price, estimated completion date, proposal, and attachment. |
| BR-15 | Action-Enabler | Display transaction history (including details like amount, date, etc.), filter by date, max 5 lines, with "Lọc" (Filter) and "Xem thêm" (View More) options. |
| BR-16 | Notification | Notify with MSG16 if a job update is successful. |
| BR-17 | Action-Enabler | Display delete confirmation pop-up for job deletion. |
| BR-18 | Action-Enabler | Display "Hiện tại chưa có ứng cử viên ứng tuyển." if no candidate has applied. |
| BR-19 | Integrity | Notify with MSG10 if there is a database connection error when displaying candidate information. |
| BR-20 | Action-Enabler | Display a confirmation pop-up for commitment. |
| BR-21 | Notification | Notify seeker with MSG15 if successfully added to the commitment list. |
| BR-22 | Structural | Display job progress periods in a table format, sorted by end date; employers can view, edit, delete, and seekers can view, submit, and view evaluations. |
| BR-23 | Notification | Notify users with MSG17 if creating a new period is successful, or with MSG18 if there is an error. |
| BR-24 | Action-Enabler | Display confirmation pop-up for accepting a period. |
| BR-25 | Structural | Update period status as "Đã nộp"/"Bị từ chối"/"Được chấp nhận". |
| BR-26 | Action-Enabler | Display confirmation pop-up for rejecting a period. |
| BR-27 | Structural | Display submission page including a text box and file upload area. |
| BR-28 | Action-Enabler | Update submission for each period of a job and change the period status to "Đã nộp kết quả". |
| BR-30 | Validation | Ensure the final product is uploaded in a valid format (PDF, ZIP) within file size limits. |
| BR-31 | Status | Update job status to "Đang tuyển"/"Đang chờ đặt cọc"/"Đang làm việc"/ "Đã nộp kết quả"/" Đã hoàn thành". |
| BR-32 | Validation | Ensure all required fields are filled in the shipping form. |
| BR-33 | Validation | Users can only enter amounts greater than 50,000 VND in the VNPAY form. |
| BR-34 | Integrity | Notify with MSG19 if account balance is less than job salary; deduct wallet balance and display MSG20 if sufficient. |
| BR-35 | Computation | Deduct 3% of the total deposit as a fee for the intermediary system. |
| BR-36 | Authorization | Role selection form appears for first-time login (Employer/Seeker); does not apply to Admin accounts. |
| BR-37 | Integrity | If a Gmail account is registered with a password, the same account is accessed when using Gmail login. |
| BR-38 | Notification | Notify guests with MSG06 if profile update and database save is successful. |
| BR-39 | Notification | Notify Users of new messages. |
| BR-40 | Validation | Notify the user with MSG22 if the re-entered password is the same as the old password. |
| BR-41 | Notification | Send notification of new job applications as MSG23 for employer and MSG24 for seeker about applying for a job. |
| BR-42 | Notification | Notify with MSG14 if updated successfully a job or with MSG15 if updated failed a job. |

## 4. Application Messages List

| # | Message Code | Message Type | Context | Content |
| --- | --- | --- | --- | --- |
| 1 | MSG01 | In line | Invalid email format when user fills out the email field | Sai định dạng email |
| 2 | MSG02 | In line | Password does not meet the minimum length of 8 characters | Mật khẩu phải 8 kí tự trở lên |
| 3 | MSG03 | Toast message | Email is already used when attempting to register | Email này đã được dùng để đăng kí |
| 4 | MSG04 | Toast message | Login failed due to incorrect credentials | Đăng nhập thất bại |
| 5 | MSG05 | Toast message | Login succeeded with correct credentials | Đăng nhập thành công |
| 6 | MSG06 | Toast message | Password change failed | Đổi mật khẩu thất bại |
| 7 | MSG07 | Toast message | Gmail has not been registered when attempting to retrieve account | Gmail chưa được đăng kí tài khoản |
| 8 | MSG08 | Toast message | OTP sent successfully for account verification | Đã gửi mã OTP thành công |
| 9 | MSG09 | Toast message | OTP verified successfully during account recovery | Xác thực OTP thành công |
| 10 | MSG10 | Toast message | OTP verification failed during account recovery | Xác thực OTP thất bại |
| 11 | MSG11 | In line | Re-entered password does not match the original password | Mật khẩu nhập lại không đúng |
| 12 | MSG12 | Toast message | No search results found | 404 - Không tìm thấy kết quả nào |
| 13 | MSG13 | In line | CV information is incomplete | Hãy điền đầy đủ thông tin |
| 14 | MSG14 | Toast message | Job post updated successfully | Cập nhật bài đăng thành công |
| 15 | MSG15 | Toast message | Job post update failed | Cập nhật bài đăng thất bại |
| 16 | MSG16 | Toast message | Database connection error when performing an action | Lỗi kết nối cơ sở dữ liệu |
| 17 | MSG17 | Toast message | New job period created successfully | Tạo mới giai đoạn thành công |
| 18 | MSG18 | Toast message | Failed to create a new job period | Tạo mới giai đoạn thất bại |
| 19 | MSG19 | Toast message | Insufficient account balance for payment | Số dư tài khoản không đủ |
| 20 | MSG20 | Toast message | Payment completed successfully | Đã thanh toán thành công |
| 21 | MSG21 | Pop up message | Notification of a new message related to a job post | <Tên job> - Bạn có tin nhắn mới |
| 22 | MSG22 | In line | The re-entered password is the same as the old password. | Mật khẩu mới trùng với mật khẩu cũ. |
| 23 | MSG23 | Pop up message | Send notification of new job applications for employer | Công việc bạn đăng có chào giá mới |
| 24 | MSG24 | Pop up message | Send notification of new job applications for seeker. | Bạn có một chào giá mới cho công việc |
