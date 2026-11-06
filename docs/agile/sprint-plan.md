# Kế hoạch 4 Sprint / 8 tuần

Mỗi Sprint dự kiến dài 2 tuần nếu lịch học phù hợp. Bảng dưới là gợi ý chia luồng, không phải phân công hay cam kết cứng. Nhóm chọn Sprint Goal, estimate lại và có thể đổi cách chia sau mỗi review. Ưu tiên một lát dọc chạy được, có thể demo và review sớm.

| Sprint | Sprint Goal | Story/đầu việc gợi ý | Increment để review |
|---|---|---|---|
| 1 – Nền móng, tuần 1–2 | Chốt nền tảng kỹ thuật và chứng minh một luồng nội bộ nhỏ chạy trên môi trường chung. | Spike/ADR Python vs NestJS; kiểm tra chức năng hiện có theo US; chọn repo Git gốc và remote; CI tối thiểu; chuẩn hóa env mẫu/secret; xác nhận user roles, schema và workflow; US01, phần cần thiết US02–03. | Build/test/lint tự động; đăng nhập, kiểm tra quyền server và tạo hồ sơ nội bộ demo được trên stack đã chốt; quyết định kiến trúc, rủi ro và kế hoạch migrate nếu có. |
| 2 – Hồ sơ, ảnh, biên tập | Cán bộ tạo hồ sơ được giao và biên tập một bản nháp có ảnh. | Hoàn tất US02–06; upload JPG/PNG với kiểm tra byte/MIME/size; metadata, alt text; version/optimistic lock; API contract; negative permission tests. | Tạo/cập nhật hồ sơ → tải ảnh → soạn/lưu nháp; ảnh chưa public không truy cập công khai. |
| 3 – Duyệt, xuất bản, QR | Nội dung đi qua đúng quyền và xuất hiện công khai chỉ sau phê duyệt. | US07–11; workflow transaction/audit; người tạo không tự duyệt; reject reason; publish/supersede/unpublish; QR URL ổn định và privacy; rollback/restore rehearsal cho release candidate. | Demo biên tập → duyệt → xuất bản → QR → gỡ; lịch sử giữ nguyên và quyền được kiểm chứng ở API. |
| 4 – Tra cứu, độ tin cậy, nghiệm thu | Khách tìm nội dung public; nhóm đo chất lượng và có thể khôi phục bản demo. | US12; responsive; p95 search test theo cấu hình; backup ảnh+DB và restore drill; lỗi/edge cases; security regression; hướng dẫn vận hành/demo; chỉ lấy Should nếu Must đạt và còn năng lực. | Demo end-to-end theo kịch bản; báo cáo test và restore; release candidate/tag, hướng dẫn rollback; danh sách lỗi đã biết. |

## Ước lượng và điều chỉnh phạm vi

Tại Planning, nhóm chia story thành task nhỏ, ước lượng story tương đối và kiểm tra năng lực 3 người cho 10 ngày làm việc thực tế (trừ lịch học/nghỉ). Không tự gán con số SP từ tài liệu bài tập cũ. Sau Sprint 1 dùng lượng Done thực tế làm dữ liệu lập kế hoạch, không dùng velocity để ép cá nhân.

Nếu Must vượt năng lực, PO cùng stakeholder chọn thứ tự trong Must, cắt lát nhỏ, giảm phạm vi demo có kiểm soát hoặc điều chỉnh ngày/nhân lực; không âm thầm chuyển tiêu chí nghiệm thu thành chưa bắt buộc. Sprint 4 dành cho chất lượng nhưng kiểm thử tích hợp diễn ra mỗi sprint, không dồn toàn bộ test tới cuối.

## Khung trách nhiệm nhóm 3 người

Cả ba cùng là Developers và thay phiên review/test. Trước Sprint 1 điền tên người đại diện PO/stakeholder, Scrum Master/facilitator và người phụ trách mỗi story. Người đảm nhiệm BA/kiểm thử/tài liệu vẫn tham gia code/review; tránh silo kiểu mỗi người giữ riêng một module. Mỗi story có một người chịu trách nhiệm cập nhật issue nhưng cả nhóm sở hữu chất lượng.
