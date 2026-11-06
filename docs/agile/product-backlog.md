# Product Backlog – Museum Digital CMS

Đây là backlog hạt giống để nhóm có điểm bắt đầu, không bắt buộc triển khai nguyên xi. Product Owner/nhóm sắp xếp theo giá trị, rủi ro, thời gian và phản hồi thực tế; được phép chia/gộp/hoãn mục. Mức Must/Should/Could/Won't là gợi ý phạm vi, cần nhóm xác nhận. Story point để trống cho tới khi cả nhóm ước lượng.

## Must Have – MVP

| ID | User story | Tiêu chí nghiệm thu cốt lõi | Thứ tự gợi ý |
|---|---|---|---|
| US01 | Là nhân viên, tôi muốn đăng nhập để dùng chức năng được cấp. | Hợp lệ thì vào được; tài khoản khóa bị từ chối; đăng xuất kết thúc phiên. | 1 |
| US02 | Là quản trị viên, tôi muốn quản lý tài khoản/vai trò và phân công. | Username duy nhất; gán role/người phụ trách; thao tác sai quyền bị chặn. Một tài khoản có thể nhiều role; quyền duyệt/xuất bản cấp riêng, không tự đi kèm admin. | 2 |
| US03 | Là cán bộ kiểm kê, tôi muốn tạo hồ sơ hiện vật chuẩn hóa. | Bắt buộc mã kiểm kê và tên; mã duy nhất; hồ sơ mới ở nội bộ, chưa công khai. | 3 |
| US04 | Là cán bộ kiểm kê, tôi muốn sửa hồ sơ được giao. | Chỉ sửa hồ sơ phụ trách; báo xung đột khi row version đổi; không sửa trực tiếp bản công khai. | 4 |
| US05 | Là cán bộ kiểm kê/biên tập viên, tôi muốn tải ảnh cho hiện vật. | Chỉ hiện vật được giao; JPG/PNG, tối đa 10 MB; kiểm tra nội dung file và từ chối sai loại/quá cỡ. | 5 |
| US06 | Là biên tập viên, tôi muốn soạn bản nháp nội dung. | Lưu nháp chưa hoàn chỉnh; chọn ảnh, caption, alt text, thứ tự riêng theo phiên bản. | 6 |
| US07 | Là biên tập viên, tôi muốn gửi/rút yêu cầu duyệt. | Chỉ gửi khi đủ dữ liệu; trạng thái chờ duyệt khóa sửa; rút theo workflow; gửi duyệt yêu cầu tiêu đề, tên công khai, loại, nội dung và ít nhất một ảnh có alt text. | 7 |
| US08 | Là người duyệt, tôi muốn chấp thuận hoặc trả lại nội dung. | Người tạo không tự duyệt; trả lại cần lý do; lưu actor và thời điểm. | 8 |
| US09 | Là cán bộ truyền thông, tôi muốn xuất bản nội dung đã duyệt. | Chỉ bản đã duyệt được xuất bản; tối đa một bản công khai cho mỗi hiện vật/ngôn ngữ; thay bản cũ theo giao dịch nhất quán. | 9 |
| US10 | Là cán bộ truyền thông, tôi muốn gỡ nội dung công khai. | Cần lý do; ngừng công khai nhưng giữ lịch sử; QR hiển thị thông báo phù hợp. | 10 |
| US11 | Là cán bộ truyền thông, tôi muốn cấp/tải QR ổn định. | QR mở đúng URL ổn định; không làm lộ nháp/chưa công khai. | 11 |
| US12 | Là khách tham quan, tôi muốn tìm và xem nội dung hiện vật công khai. | Tìm theo tên/từ khóa nội dung công khai; có trạng thái không có kết quả; dùng được trên điện thoại. | 12 |

### Workflow trạng thái bắt buộc

- `DRAFT → PENDING`: biên tập gửi đủ nội dung. `PENDING` không sửa; biên tập có thể rút về `DRAFT` theo quyền.
- `PENDING → APPROVED`: người duyệt khác người tạo chấp thuận.
- `PENDING → DRAFT`: người duyệt trả lại kèm lý do.
- `APPROVED → PUBLISHED`: truyền thông xuất bản; bản công khai trước thành `SUPERSEDED` trong cùng giao dịch.
- `PUBLISHED → UNPUBLISHED`: truyền thông gỡ kèm lý do.
- Từ `APPROVED` trở đi muốn sửa phải sao chép thành `DRAFT` mới; `UNPUBLISHED`/`SUPERSEDED` chỉ được xuất bản lại qua phiên bản mới và duyệt lại. Ghi mọi chuyển trạng thái vào workflow event; không sửa/xóa lịch sử qua giao diện.

### Quy tắc quyền và dữ liệu

Quyền phải được kiểm tra phía server theo vai trò + phạm vi phân công + trạng thái. Quyền xóa bị giới hạn theo ma trận yêu cầu; chặn xóa dữ liệu còn được tham chiếu. Nội dung công khai là snapshot riêng; ghi chú kiểm kê không được đưa ra public. Ảnh lưu ở object storage, DB lưu khóa/checksum/metadata; chỉ file đang được bản public dùng mới được khách đọc. QR giữ nguyên sau khi gỡ để trả thông báo.

Mô hình dữ liệu sơ bộ cần refinement/ADR: `users`, `roles`, `user_roles`, `categories`, `artifacts`, `media_files`, `content_versions`, `version_media`, `workflow_events`, `qr_codes`; `collections` và `collection_artifacts` chỉ khi làm Should Have. Bảo đảm unique inventory code, version theo artifact/ngôn ngữ, một published version cho mỗi artifact/ngôn ngữ; optimistic locking cho bản ghi cần sửa đồng thời.

## Chất lượng và vận hành – điều kiện MVP

- Hiệu năng mục tiêu cần xác nhận: 1.000 hiện vật, 20 truy cập đồng thời trong 5 phút, p95 tìm kiếm ≤ 2 giây; ghi rõ cấu hình máy và dữ liệu thử.
- Ảnh tối đa 10 MB; xác minh MIME dựa trên nội dung, không tin tên file; password hash; tài khoản bị khóa làm phiên hiện tại mất quyền.
- Responsive ở 360 px và 1.366 px; kiểm tra Chrome và Edge trên máy demo.
- Backup DB + ảnh mỗi ngày trong demo, giữ ít nhất 7 bản; thực hiện restore drill và đối chiếu dữ liệu trước nghiệm thu.
- Demo xuyên suốt: tạo hồ sơ → tải ảnh → soạn → duyệt → xuất bản → mở QR → tìm kiếm.

Các con số là mục tiêu đề xuất, chưa phải kết quả. Sprint 1 ghi quyết định PO/nhóm xác nhận, người đo và môi trường đo; không báo đạt nếu chưa chạy đo/restore thật.

## Should / Could / Won't

- **Should:** video/PDF; lọc theo loại/niên đại; bộ sưu tập; import CSV; Việt–Anh; xem diff và khôi phục phiên bản cũ thành nháp.
- **Could:** lượt xem/lượt truy cập URL QR (không gọi đó là tổng số lần quét); thuyết minh audio; hiện vật liên quan.
- **Won't this time:** vé/thanh toán; quét 3D; AI tự phân loại; ứng dụng di động riêng.

Tài liệu kế hoạch trước liệt kê video/audio/3D trong Sprint 2 và ví dụ phân công 5 thành viên. Bản 3 thành viên/8 tuần này chốt ảnh là Must; media khác phải ở Should hoặc ngoài scope theo quyết định PO, không tự kéo vào sprint.
