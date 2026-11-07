# Agile delivery guide

Dự án dùng Scrum nhẹ theo sprint 2 tuần trong khung 8 tuần (4 sprint). Agile ở đây là cách giao từng lát sản phẩm chạy được, lấy phản hồi sau mỗi sprint và điều chỉnh backlog; không phải cam kết cố định rằng toàn bộ phạm vi Must chắc chắn xong bất kể ước lượng.

Bộ tài liệu này là khung khởi đầu để ba người cùng chia việc, không phải hợp đồng phạm vi hay quy trình cứng. Nhóm có thể chia/gộp story, đổi thứ tự hoặc hoãn hạng mục sau khi trao đổi với người dùng; giữ lại tiêu chí an toàn và kiểm chứng cần thiết. Bốn sprint trong kế hoạch là gợi ý cho 8 tuần, không buộc phải làm đúng nguyên văn đề bài.`r`n`r`n## Nguồn yêu cầu và quyết định

- Backlog và tiêu chí ở `product-backlog.md` lấy từ yêu cầu nhóm mới nhất: 3 thành viên, 8 tuần, US01–US12, workflow biên tập, MoSCoW và chỉ tiêu nghiệm thu.
- Tài liệu Product Backlog & Sprint Plan trước đó là bản nháp nền. Nếu khác phạm vi mới (ví dụ nhóm 5 người, 8 story hoặc chưa có QR), dùng yêu cầu mới nhất làm chuẩn; không lấy phân công 5 người làm thực tế.
- Repo hiện dùng NestJS/TypeScript, PostgreSQL/Prisma; yêu cầu mới nói máy chủ Python. Đây là xung đột kiến trúc phải được nhóm/PO chốt bằng ADR trong Sprint 1 trước khi mở rộng backend. Không coi mã hiện có là bằng chứng rằng yêu cầu Python đã được đáp ứng.
- Root `.env.example` là mẫu cấu hình duy nhất cho Docker Compose. Mỗi máy tạo `.env` riêng từ mẫu này; không commit secret.

## Mục tiêu sản phẩm

Trong 8 tuần tạo MVP cho phép cán bộ tạo hồ sơ và ảnh, biên tập, gửi duyệt, duyệt/trả lại, xuất bản/gỡ, tạo QR và giúp khách tìm/xem nội dung công khai. Video/PDF, lọc nâng cao, bộ sưu tập, CSV, song ngữ và khôi phục phiên bản là Should Have; thống kê, audio và gợi ý là Could Have. Vé/thanh toán, 3D và AI nằm ngoài phiên bản này.

## Vai trò và phối hợp

Scrum có ba accountability: Product Owner tối đa hóa giá trị và sắp thứ tự Product Backlog; Scrum Master giúp nhóm thực hành Scrum và tháo gỡ cản trở; Developers tạo Increment đạt Definition of Done. Ba người đều cùng chịu trách nhiệm sản phẩm; đây không phải ba chức danh nhân sự bắt buộc. Nhóm ghi rõ người đại diện PO/stakeholder, người điều phối Scrum và cách thay thế khi người dùng nghiệp vụ không thể tham gia. Nếu một thành viên kiêm vai trò, vẫn cần tách thời gian phản hồi nghiệp vụ khỏi quyết định kỹ thuật.

## Nhịp làm việc

- Sprint cố định 2 tuần; Sprint Planning xác định một Sprint Goal, chọn story đã đủ rõ và lập Sprint Backlog.
- Daily Scrum tối đa 15 phút để Developers kiểm tra tiến độ tới Sprint Goal và điều chỉnh kế hoạch; không phải buổi báo cáo cho quản lý.
- Refinement ít nhất một lần mỗi tuần: làm rõ AC, phụ thuộc, rủi ro, chia story quá lớn; không đưa mọi story vào Sprint.
- Sprint Review trình diễn Increment chạy được cho stakeholder/giảng viên/PO và ghi phản hồi thành backlog item.
- Sprint Retrospective chốt 1–3 hành động cải tiến có người theo dõi trong sprint sau.

## Luồng công việc và Git

`Product Backlog → Ready → In Progress → Review → Verify → Done`.

Mỗi story/bug có issue, AC, ưu tiên, người phụ trách tạm thời và liên kết PR. Dùng nhánh ngắn theo issue (`feature/<id>-...`, `fix/<id>-...`), PR nhỏ, ít nhất một người khác review, CI xanh rồi mới merge vào nhánh chính. Không phát triển trực tiếp trên `main`; không merge phần chưa đạt DoD. Mỗi sprint tạo tag/release candidate để demo và có thể quay lại.

Hiện repo `D:\CNPM` chưa có Git repository gốc; một số thư mục con có `.git` riêng. Sprint 1 phải thống nhất repository gốc và kiểm tra lịch sử/remote trước khi thay đổi Git metadata. Không xóa các `.git` con trước khi đã xác minh dữ liệu cần giữ.

## Definition of Ready

Story được đưa vào Sprint khi: có người dùng/lợi ích rõ; có AC kiểm thử được và thống nhất; ưu tiên cùng lý do; phụ thuộc và dữ liệu mẫu đã biết; đủ nhỏ để hoàn tất trong sprint; nhóm đã ước lượng tương đối; cách demo xác định. Story còn câu hỏi nghiệp vụ lớn ở lại refinement hoặc được tách thành spike time-boxed.

## Definition of Done

Story chỉ Done khi:

1. Đạt toàn bộ AC và luồng lỗi/quyền/dữ liệu biên có liên quan; kiểm tra quyền ở backend, không chỉ ẩn nút giao diện.
2. Có test tự động phù hợp (unit/service/API/UI hoặc e2e cho luồng quan trọng); test và lint/build của vùng ảnh hưởng đều đạt.
3. Mã được thành viên khác review; API contract, migration và cấu hình tương ứng đã cập nhật.
4. Tích hợp trên nhánh chung, chạy được trong môi trường demo; Product Owner/stakeholder có thể xem và góp ý.
5. Không còn lỗi nghiêm trọng trong luồng liên quan; lỗi đã biết được ghi thành backlog item với mức độ.
6. Có hướng dẫn ngắn cho hành vi/vận hành mới; thay đổi dữ liệu có kế hoạch backup/forward-fix/rollback.

Tài liệu phải đủ để người khác chạy, hiểu cấu hình và khôi phục; giảm thủ tục không đồng nghĩa bỏ README, ADR, API contract hay hướng dẫn rollback.

## Thước đo cải tiến

Theo dõi mỗi sprint: mục tiêu đạt/chưa đạt và lý do; số story Done theo DoD; bug nghiêm trọng còn mở; thời gian PR chờ review; tình trạng build/test; hành động retrospective đã hoàn tất. Story point chỉ là ước lượng tương đối, không quy đổi thành giờ hoặc dùng để so sánh thành viên.
