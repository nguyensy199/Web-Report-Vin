# HƯỚNG DẪN TRIỂN KHAI HỆ THỐNG QUẢN LÝ TEAM DATA ANNOTATION

Hệ thống được thiết kế theo kiến trúc chuẩn **Google Apps Script Web App** với cơ sở dữ liệu là **Google Sheets**, đã được phân tách thành các module chuyên biệt:

---

## 📁 1. CẤU TRÚC TỆP DỰ ÁN

| Tên Tệp | Loại | Chức năng chính |
| :--- | :--- | :--- |
| **`Code.gs`** | Script (GS) | Router chính `doGet()`, nạp template `include()`, kiểm tra quyền hạn, cấu hình Triggers |
| **`Setup.gs`** | Script (GS) | Tự động tạo 8 Sheets và nạp dữ liệu mẫu **9 Annotators × 14 ngày làm việc** (gồm người giỏi, người yếu, người tiến bộ, người dính lỗi Critical) |
| **`Data.gs`** | Script (GS) | Xử lý đọc/ghi Google Sheets tối ưu hiệu năng (đọc 1 lần vào RAM, chống vượt hạn mức 6 phút, chống xung đột đa người dùng bằng `LockService`) |
| **`Kpi.gs`** | Script (GS) | Công thức tính KPI chuẩn, gom dữ liệu Dashboard một lần gọi duy nhất theo **từng tuần độc lập**, thuật toán xếp hạng và trao huy hiệu tự động |
| **`Report.gs`** | Script (GS) | Tạo báo cáo ngày, báo cáo tuần độc lập, tự sinh nhận xét điều hành, xuất báo cáo ra Google Sheet mới tinh, trigger 18:00 nhắc việc |
| **`index.html`** | HTML | Khung giao diện Web App chính, liên kết các module thông qua `include()` |
| **`css.html`** | HTML | Toàn bộ giao diện Dark Theme Glassmorphism hiện đại, responsive trên mobile/desktop và định dạng in ấn A4 |
| **`js.html`** | HTML | Logic Client-side, vẽ 4 biểu đồ Chart.js, quản lý bộ chọn tuần độc lập, hệ thống thông báo Toast tiếng Việt |

---

## 🚀 2. CÁC BƯỚC THIẾT LẬP TRÊN GOOGLE APPS SCRIPT

### Bước 1: Tạo Google Sheet mới
1. Truy cập [Google Sheets](https://sheets.new) và tạo một bảng tính mới.
2. Đổi tên bảng tính thành: **Database Quản Lý Team Data Annotation**.

### Bước 2: Mở trình soạn thảo Apps Script
1. Trên thanh menu của Google Sheets, chọn **Tiện ích mở rộng** (Extensions) ➔ **Apps Script**.
2. Đổi tên dự án Apps Script thành: **Web-Quan-Ly-Annotation**.

### Bước 3: Tạo và dán code vào các file tương ứng
Trên trình soạn thảo Apps Script, bạn tạo 5 file Code (.gs) và 3 file HTML (.html):

1. **`Code.gs`**: Mở file `Code.gs` có sẵn, xóa toàn bộ code cũ và copy nội dung từ file [`Code.gs`](file:///d:/B%C3%A1o-C%C3%A1o-Vin/Web-b%C3%A1o-c%C3%A1o/Code.gs) vào.
2. **`Setup.gs`**: Bấm dấu `+` chọn **Tệp lệnh (Script)** ➔ Đặt tên `Setup` ➔ Copy nội dung từ [`Setup.gs`](file:///d:/B%C3%A1o-C%C3%A1o-Vin/Web-b%C3%A1o-c%C3%A1o/Setup.gs) vào.
3. **`Data.gs`**: Bấm dấu `+` chọn **Tệp lệnh (Script)** ➔ Đặt tên `Data` ➔ Copy nội dung từ [`Data.gs`](file:///d:/B%C3%A1o-C%C3%A1o-Vin/Web-b%C3%A1o-c%C3%A1o/Data.gs) vào.
4. **`Kpi.gs`**: Bấm dấu `+` chọn **Tệp lệnh (Script)** ➔ Đặt tên `Kpi` ➔ Copy nội dung từ [`Kpi.gs`](file:///d:/B%C3%A1o-C%C3%A1o-Vin/Web-b%C3%A1o-c%C3%A1o/Kpi.gs) vào.
5. **`Report.gs`**: Bấm dấu `+` chọn **Tệp lệnh (Script)** ➔ Đặt tên `Report` ➔ Copy nội dung từ [`Report.gs`](file:///d:/B%C3%A1o-C%C3%A1o-Vin/Web-b%C3%A1o-c%C3%A1o/Report.gs) vào.
6. **`index.html`**: Bấm dấu `+` chọn **HTML** ➔ Đặt tên `index` ➔ Copy nội dung từ [`index.html`](file:///d:/B%C3%A1o-C%C3%A1o-Vin/Web-b%C3%A1o-c%C3%A1o/index.html) vào.
7. **`css.html`**: Bấm dấu `+` chọn **HTML** ➔ Đặt tên `css` ➔ Copy nội dung từ [`css.html`](file:///d:/B%C3%A1o-C%C3%A1o-Vin/Web-b%C3%A1o-c%C3%A1o/css.html) vào.
8. **`js.html`**: Bấm dấu `+` chọn **HTML** ➔ Đặt tên `js` ➔ Copy nội dung từ [`js.html`](file:///d:/B%C3%A1o-C%C3%A1o-Vin/Web-b%C3%A1o-c%C3%A1o/js.html) vào.

### Bước 4: Khởi tạo Cơ sở dữ liệu mẫu
1. Tại thanh công cụ phía trên của Apps Script, chọn hàm **`setup`** (hoặc **`setupDatabase`**) trong danh sách dropdown các hàm.
2. Bấm nút **Chạy** (Run).
3. Google sẽ hiển thị bảng cấp quyền ➔ Bấm **Xem xét quyền** (Review permissions) ➔ Chọn tài khoản của bạn ➔ Chọn **Nâng cao** (Advanced) ➔ Bấm **Đi tới Web-Quan-Ly-Annotation (không an toàn)** ➔ Bấm **Cho phép** (Allow).
4. Sau khi hàm chạy xong (mất khoảng 5-10 giây), quay lại Google Sheets bạn sẽ thấy đầy đủ 8 Sheets đã được tạo cùng dữ liệu mẫu sinh động của 9 thành viên qua 14 ngày làm việc.

---

## 🌐 3. TRIỂN KHAI WEB APP (DEPLOY)

1. Ở góc trên cùng bên phải màn hình Apps Script, bấm nút **Triển khai** (Deploy) ➔ **Tùy chọn triển khai mới** (New deployment).
2. Bấm biểu tượng bánh răng ⚙️ ở mục "Chọn loại", chọn **Ứng dụng web** (Web app).
3. Cấu hình các thông số sau:
   - **Mô tả**: `Phiên bản V2 - Tách file & Dashboard tuần độc lập`
   - **Thực thi dưới dạng** (Execute as): **Tôi** (`Me` - địa chỉ email của bạn).
   - **Ai có quyền truy cập** (Who has access): **Bất kỳ ai có Tài khoản Google** (hoặc *Bất kỳ ai* nếu muốn mở rộng nội bộ).
4. Bấm **Triển khai** (Deploy).
5. Copy đường link **URL ứng dụng web** (Web App URL) và mở trên trình duyệt.

---

## 📊 4. TÍNH NĂNG NỔI BẬT ĐÃ HOÀN THÀNH

1. **Dashboard Tinh Gọn & Tự Tạo Dashboard Tuần Mới**:
   - **Tách 2 Bảng So Sánh KPI Yêu Cầu vs Làm Được Riêng Biệt**:
     - 📊 **Bảng Tổng Cả Tuần (Cả Tuần)**: Thang đo sản lượng chuyên biệt: `0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000` (bước nhảy 1.000 Tasks) hiển thị tổng kết cả tuần của 10 thành viên.
     - 📊 **Bảng Chi Tiết Theo Ngày (Thứ 2 ➔ Chủ Nhật)**: Thang đo sản lượng ngày: `0, 300, 600, 900, 1200, 1500, 1800, 2100` (bước nhảy 300 Tasks) với dropdown chọn ngày linh hoạt.
     - 👥 **Bảng Xu Hướng Sản Lượng Từng Thành Viên Theo Ngày**: Thang đo sản lượng ngày: `0, 300, 600, 900, 1200, 1500, 1800, 2100`.
     - Mỗi thành viên đều có 2 cột rõ ràng: 🟧 **KPI Yêu Cầu** và 🟦 **KPI Làm Được** (kèm chú thích màu sắc trực quan).
   - **Nút "➕ Tạo Dashboard Tuần Mới" Hoạt Động Mượt Mà**:
     - Bấm nút sẽ mở ngay popup modal tạo tuần mới, chọn ngày bắt đầu hoặc ngày bất kỳ trong tuần, hệ thống tự động tính Thứ 2 đến Chủ Nhật và lập tức chuyển đến trang Dashboard của tuần đó.
   - **Tối Giản Giao Diện - Xóa Bỏ Hoàn Toàn Ô Dự Án & Dropdown Thành Viên**:
     - *Toàn bộ các trang (Dashboard, Nhập số liệu, Ghi nhận lỗi)*: Đã xóa triệt để ô chọn/nhập Dự án và cột Dự án trong bảng lỗi để đơn giản hóa tối đa quy trình làm việc.
     - *Trang Dashboard*: Đã xóa bỏ ô dropdown Thành viên, thanh công cụ chỉ tập trung vào chọn Tuần và tạo Tuần mới.
   - **3 Thẻ KPI Cốt Lõi Tinh Gọn**:
     - 📦 **Tổng Sản Lượng (Tasks)**
     - 🎯 **% Đạt Chỉ Tiêu Target**
     - 👥 **Số Người Đạt / Chưa Đạt Target**
     *(Đã xóa bỏ hoàn toàn các thẻ và biểu đồ không cần thiết như Accuracy Trend, Pareto)*.

2. **10 Thành Viên Mặc Định Duy Nhất (Đồng Bộ Dropdown Toàn Hệ Thống)**:
   - 👑 **Nguyễn Tiến Sỹ** (`MB009` - **Team Lead**)
   - 🔍 **Nguyễn Minh Tú** (`MB001` - **Annotator + QC**)
   - 🔍 **Nguyễn Văn Tuyển** (`MB010` - **Annotator + QC**)
   - 🏷️ **Dư Văn Sang** (`MB002` - Annotator)
   - 🏷️ **Ngô Văn Cao** (`MB003` - Annotator)
   - 🏷️ **Nguyễn Công Bình** (`MB004` - Annotator)
   - 🏷️ **Nguyễn Hữu Dũng** (`MB005` - Annotator)
   - 🏷️ **Phạm Văn Thân** (`MB006` - Annotator)
   - 🏷️ **Bạch Khánh An** (`MB007` - Annotator)
   - 🏷️ **Trần Minh Hiếu** (`MB008` - Annotator)
   - *Tất cả các ô chọn thành viên (Nhập nhật ký hằng ngày, Ghi nhận lỗi nhanh, Bộ lọc danh sách lỗi)* đều là **dropdown chọn sẵn 10 người** kèm theo Role, giúp ngăn ngừa hoàn toàn sai sót chính tả và đồng bộ số liệu chuẩn xác 100% vào Dashboard.

3. **Trang Quản Lý Phân Quyền Vai Trò (3 Roles Chuẩn)**:
   - Hệ thống chuẩn hóa 3 vai trò:
     - 👑 **Team Lead**: Trưởng nhóm / Quản trị, toàn quyền điều hành, phân quyền role và duyệt báo cáo.
     - 🔍 **Annotator + QC**: Kiểm định chất lượng, ghi nhận lỗi và kiêm nhiệm gán nhãn.
     - 🏷️ **Annotator**: Thành viên gán nhãn dữ liệu.
   - Trang quản lý role cho phép Team Lead trực tiếp điều chỉnh vai trò của bất kỳ ai trong 10 thành viên và bấm "Lưu Thay Đổi Phân Quyền".

3B. **Mẫu Báo Cáo Ngày Chuẩn Form (9 Cột)**:
   - Khi chuyển sang **Báo Cáo Ngày**, hệ thống hiển thị và xuất ra Google Sheet đúng chuẩn 9 cột:
     STT | Họ và tên | Vai trò | Trạng thái đi làm | Nhiệm vụ chi tiết | Số lần Rework | Trạng thái job | Số id đã sửa | Đánh giá QC.
   - **Trạng thái job**: Phân biệt màu sắc trực quan: Complete (xanh lá nhạt) và Đang rework (xanh lam nhạt).
   - Cho phép chỉnh sửa trực tiếp các trường trên web và xuất thẳng ra Google Sheet đồng bộ.

4. **Trang Điểm Danh Đội Ngũ & Đánh Giá Tác Phong**:
   - Chọn ngày điểm danh linh hoạt theo lịch làm việc.
   - Bảng điểm danh 10 thành viên với các cột chi tiết:
     - **Điểm danh**: 5 trạng thái (`Có mặt`, `Vắng mặt`, `Nghỉ phép`, `Nghỉ không phép`, `Nghỉ nửa ngày`).
     - **Tác phong**: 2 mức độ (`Đạt`, `Không đạt`).
     - **Ghi chú**: Ghi chú lý do nghỉ, đi muộn hoặc vi phạm quy tắc.
   - Thao tác nhanh: Nút "⚡ Tất Cả Có Mặt & Đạt" hỗ trợ điểm danh nhanh chỉ với 1 click.
   - Thống kê thời gian thực: Đếm số người có mặt, nghỉ phép, vắng mặt, không đạt tác phong.
   - Dữ liệu được lưu vĩnh viễn vào Sheet `Attendance`.

5. **Bảng Xếp Hạng Đội Ngũ Tinh Gọn & Tùy Chỉnh Cho Admin**:
   - **Xóa bỏ cột Điểm và cột Lỗi**: Tập trung trực diện vào các chỉ số cốt lõi: Sản Lượng, % Target, Độ chính xác (Accuracy), Năng suất/h và Huy hiệu.
   - **Admin được quyền thay đổi thứ hạng tùy ý**:
     - Cột "Hạng" hiển thị ô nhập số cho phép sửa thứ hạng trực tiếp trên bảng.
     - Nút **💾 Lưu Thứ Hạng (Admin)** lưu cấu hình theo từng tuần vào Sheet `Settings`.
     - Nút **🔄 Đặt Lại Tự Động** khôi phục lại thứ hạng tự động.
   - **Biến động so sánh trực tiếp với tuần trước**:
     - Tăng hạng: `▲ +2 (Hạng 5)` (Xanh lá)
     - Giảm hạng: `▼ -1 (Hạng 2)` (Đỏ)
     - Không đổi: `- (Hạng 3)` (Xám)
     - Tuần trước chưa có dữ liệu: `Mới ⭐` (Xanh dương)

6. **Ghi lỗi & Khiếu nại**:
   - QC/Team Lead ghi lỗi nhanh với mô tả chi tiết không giới hạn từ ngữ.
   - Popup xem chi tiết lỗi đầy đủ, hỗ trợ lọc lỗi tự do theo tên thành viên.
   - Các nút trạng thái: "Đã sửa", "Đang chờ", "Xóa lỗi".

7. **Báo cáo chuyên nghiệp & Nhắc việc**:
   - Tự động sinh nhận xét điều hành, đề xuất hành động (Coaching 1-1, đào tạo lại).
   - Xuất file Google Sheet mới tinh, in ấn PDF khổ A4 tiêu chuẩn.
   - Trigger tự động nhắc việc lúc 18:00 cho ai chưa nhập số liệu.

8. **Trang Đánh Giá Năng Lực TTS / OJT (Attitude 20% · Skill 50% · Output 30% · Tổng Hợp 100%)**:
   - **Giao diện hiện đại & Bộ chuyển 4 nhóm linh hoạt**:
     - 🌟 **Attitude (20%)**: Thái độ, tinh thần chủ động, khả năng thích ứng.
     - ⚡ **Skill (50%)**: Năng lực chuyên môn và thực hiện công việc.
     - 📦 **Output (30%)**: Chất lượng kết quả công việc và độ tin cậy.
     - 🏆 **Tổng Hợp (100%)**: Điểm tổng hợp trọng số: `(Attitude × 20%) + (Skill × 50%) + (Output × 30%)`.
   - **Thang điểm tham chiếu VinFast chuẩn 1–100**:
     - 🟩 **L3**: 90–100 điểm (Chủ động dẫn dắt, output vượt kỳ vọng, chuẩn chuyên nghiệp bàn giao ngay).
     - 🟦 **L2**: 80–89 điểm (Chủ động cao, tự học nhanh, chất lượng ổn định cao, chủ động xử lý vấn đề).
     - 🟦 **L2**: 70–79 điểm (Chủ động nhận việc, output đạt yêu cầu, ít cần sửa, đúng hạn).
     - 🟧 **L1**: 50–69 điểm (Thực hiện khi yêu cầu, output đạt cơ bản cần review nhiều lần, cần nhắc nhở).
     - 🟥 **< L1**: Dưới 50 điểm (Thụ động, output không đạt cần hướng dẫn chi tiết, lỗi nhiều trễ deadline).
   - **Tự động liên kết dữ liệu thực tế thông minh**:
     - *Attitude*: Tự động tính từ Bảng Điểm Danh (ngày công, nghỉ phép, tác phong, vắng mặt).
     - *Skill*: Tự động tính từ Nhật ký công việc (% hoàn thành Target tuần, năng suất Tasks/giờ).
     - *Output*: Tự động tính từ Độ chính xác Accuracy (%) và Nhật ký lỗi phát sinh / lỗi nghiêm trọng.
     - Thanh đo trực quan thang 1-100 kèm 4 vạch mốc đứt nét: `Mốc 50 (L1)`, `Mốc 70 (L2)`, `Mốc 80 (L2)`, `Mốc 90 (L3)`.
   - **Bảng Thang Điểm Tham Chiếu Chuẩn VinFast**: Nút bấm `📖 Thang Điểm Tham Chiếu` cho phép mở bảng đối chiếu nguyên văn tiêu chí của VinFast mọi lúc ngay trên web.
   - **Trao quyền toàn diện cho Team Lead & QC**:
     - Cho phép sửa trực tiếp số điểm và nội dung nhận xét của từng thành viên cho cả 3 nhóm Attitude, Skill, Output.
     - Nhấn **💾 Lưu Đánh Giá (Team Lead)** để lưu cố định cho tuần đó.
     - Nhấn **🔄 Khôi Phục Tự Động** để hoàn tác về dữ liệu tự động tính từ Điểm danh, KPI và Lỗi.
     - Nhấn **🖨️ In Báo Cáo** chuẩn định dạng tài liệu.



9. **Mục Done Job Trong Nhật Ký & Hiển Thị Bảng KPI Theo Ngày Trên Dashboard**:
   - **Tùy chọn Done Job tiện lợi ở trang Nhập số liệu**:
     - Tích chọn `🎯 Đã Done Job hôm nay (Hoàn thành sớm / Hết việc)` khi thành viên đã làm hết job trong ngày.
     - Cho phép ghi nhận ngay cả khi không có sản lượng KPI (`output = 0`) mà không bị báo lỗi thiếu trường bắt buộc.
     - Có thể nhập sản lượng nếu thành viên đã làm một phần trước khi Done job.
   - **Hiển thị trực quan trên Dashboard Ngày (Bảng KPI theo ngày)**:
     - Ô ngày của thành viên sẽ hiển thị nhãn tím nổi bật: `Done job` (hoặc `[Số lượng] (Done)`).
     - **Không bị trừ % KPI / không kéo tụt điểm trung bình**: Hệ thống thông minh tự nhận biết ngày Done job để không tính nợ target, giúp thành viên giữ vững xếp loại *Xuất sắc* hoặc *Bình thường* mà không bị hiểu lầm là bỏ việc hay trễ tiến độ.
   - **Đồng bộ Lịch sử & Báo cáo ngày**:
     - Lịch sử nhập số liệu hiển thị badge tím `Done job` và ghi chú rõ ràng.
     - Báo cáo ngày tự động chuyển trạng thái job sang `Done job` / `Complete`.
