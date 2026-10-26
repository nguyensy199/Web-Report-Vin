/**
 * ============================================================================
 * SETUP.GS - KHỞI TẠO CƠ SỞ DỮ LIỆU & NẠP DỮ LIỆU THỰC TẾ TUẦN 1
 * Dự án: 3D Annotation (LiDAR Point Cloud & BBox Tracking)
 * Dữ liệu bóc tách từ: Daily_Report_Team (1).xlsx & qa_report_summary (1).xlsx
 * ============================================================================
 * Danh sách 9 thành viên chính thức:
 * 1. Ngô Văn Cao      (caonv)   - Hạng 1 (Xuất sắc, hoàn thành sớm nhất 79 ID)
 * 2. Nguyễn Văn Tuyển (tuyennv) - Hạng 2 (Xuất sắc, hoàn thành 80 ID)
 * 3. Nguyễn Minh Tú   (tunm2)   - Hạng 3 (Hoàn thành đúng hạn 82 ID)
 * 4. Dư Văn Sang      (sangdv)  - Hạng 4 (Hoàn thành 81 ID)
 * 5. Nguyễn Hữu Dũng  (dungnh)  - Hạng 5 (Hoàn thành 74 ID, ít issue nhất team 766)
 * 6. Phạm Văn Thân    (thanpv)  - Hạng 6 (Hoàn thành 78 ID)
 * 7. Bạch Khánh An    (anbk)    - Hạng 7 (Hoàn thành 78 ID, 1969 issue)
 * 8. Nguyễn Công Bình (binhnc)  - Hạng 8 (Hoàn thành 83 ID, 1336 issue)
 * 9. Trần Minh Hiếu   (hieutm3) - Hạng 9 (61 ID / Đạt 77% target, dính lỗi Critical Z)
 */

function setupDatabase() {
  return setup();
}

function setup() {
  var ss = getSpreadsheet();

  _initSheetMembers(ss);
  _initSheetProjects(ss);
  _initSheetTargets(ss);
  _initSheetErrorCategories(ss);
  _initSheetSettings(ss);
  _initSheetDailyLogs(ss);
  _initSheetErrorLogs(ss);
  _initSheetReportHistory(ss);
  _initSheetAttendance(ss);

  // Xóa Sheet mặc định nếu có
  var defSheet = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (defSheet && ss.getSheets().length > 1) {
    try { ss.deleteSheet(defSheet); } catch (e) {}
  }

  Logger.log('Khởi tạo thành công 9 sheets với 10 thành viên chuẩn!');
  return {
    success: true,
    message: 'Đã nạp thành công toàn bộ cơ sở dữ liệu với 10 thành viên chuẩn và bảng Điểm danh!'
  };
}

function _formatHeader(sheet, headers) {
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#0f172a')
    .setFontColor('#ffffff');
  sheet.setFrozenRows(1);
}

// ----------------------------------------------------------------------------
// 1. MEMBERS: 10 THÀNH VIÊN MẶC ĐỊNH DUY NHẤT CỦA TEAM (3 ROLES)
// ----------------------------------------------------------------------------
function _initSheetMembers(ss) {
  var sheet = ss.getSheetByName(SHEETS.MEMBERS) || ss.insertSheet(SHEETS.MEMBERS);
  sheet.clearContents();
  _formatHeader(sheet, ['MemberID', 'FullName', 'Email', 'Role', 'DailyTarget', 'TargetHour', 'Status', 'TelegramChatId']);

  var rows = [
    ['MB001', 'Nguyễn Minh Tú',   'tunm2@company.com',   'Annotator + QC',  20, 2.5, 'Active', ''],
    ['MB002', 'Dư Văn Sang',      'sangdv@company.com',  'Annotator',       20, 2.5, 'Active', ''],
    ['MB003', 'Ngô Văn Cao',      'caonv@company.com',   'Annotator',       20, 2.5, 'Active', ''],
    ['MB004', 'Nguyễn Công Bình', 'binhnc@company.com',  'Annotator',       20, 2.5, 'Active', ''],
    ['MB005', 'Nguyễn Hữu Dũng',  'dungnh@company.com',  'Annotator',       20, 2.5, 'Active', ''],
    ['MB006', 'Phạm Văn Thân',    'thanpv@company.com',  'Annotator',       20, 2.5, 'Active', ''],
    ['MB007', 'Bạch Khánh An',    'anbk@company.com',    'Annotator',       20, 2.5, 'Active', ''],
    ['MB008', 'Trần Minh Hiếu',   'hieutm3@company.com', 'Annotator',       20, 2.5, 'Active', ''],
    ['MB009', 'Nguyễn Tiến Sỹ',   'synt@company.com',    'Team Lead',       20, 2.5, 'Active', ''],
    ['MB010', 'Nguyễn Văn Tuyển', 'tuyennv@company.com', 'Annotator + QC',  20, 2.5, 'Active', '']
  ];

  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  sheet.autoResizeColumns(1, rows[0].length);
}

// ----------------------------------------------------------------------------
// 2. PROJECTS: DỰ ÁN 3D ANNOTATION LIDAR BBOX TRACKING
// ----------------------------------------------------------------------------
function _initSheetProjects(ss) {
  var sheet = ss.getSheetByName(SHEETS.PROJECTS) || ss.insertSheet(SHEETS.PROJECTS);
  sheet.clearContents();
  _formatHeader(sheet, ['ProjectID', 'ProjectName', 'ProjectType', 'TargetPerDay', 'TargetPerHour', 'Status', 'Description']);

  var rows = [
    [
      'PRJ_3D_LIDAR',
      '3D Bounding Box Tracking (LiDAR & Camera)',
      '3D BBox LiDAR PointCloud',
      20, // 20 Track ID/ngày
      2.5,
      'Active',
      'Gán nhãn 3D Bounding Box xe cộ và người đi bộ trên dữ liệu LiDAR và camera xe tự hành'
    ]
  ];

  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  sheet.autoResizeColumns(1, rows[0].length);
}

// ----------------------------------------------------------------------------
// 3. TARGETS: ĐỊNH MỨC THEO TUẦN (DEADLINE 24/10/2026 - 20 TRACK ID/NGÀY)
// ----------------------------------------------------------------------------
function _initSheetTargets(ss) {
  var sheet = ss.getSheetByName(SHEETS.TARGETS) || ss.insertSheet(SHEETS.TARGETS);
  sheet.clearContents();
  _formatHeader(sheet, ['TargetID', 'MemberID', 'ProjectID', 'DailyTarget', 'TargetPerHour', 'EffectiveDate']);

  var rows = [
    ['TGT001', 'MB001', 'PRJ_3D_LIDAR', 20, 2.5, '2026-10-20'],
    ['TGT002', 'MB002', 'PRJ_3D_LIDAR', 20, 2.5, '2026-10-20'],
    ['TGT003', 'MB003', 'PRJ_3D_LIDAR', 20, 2.5, '2026-10-20'],
    ['TGT004', 'MB004', 'PRJ_3D_LIDAR', 20, 2.5, '2026-10-20'],
    ['TGT005', 'MB005', 'PRJ_3D_LIDAR', 20, 2.5, '2026-10-20'],
    ['TGT006', 'MB006', 'PRJ_3D_LIDAR', 20, 2.5, '2026-10-20'],
    ['TGT007', 'MB007', 'PRJ_3D_LIDAR', 20, 2.5, '2026-10-20'],
    ['TGT008', 'MB008', 'PRJ_3D_LIDAR', 20, 2.5, '2026-10-20'],
    ['TGT009', 'MB009', 'PRJ_3D_LIDAR', 20, 2.5, '2026-10-20']
  ];

  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  sheet.autoResizeColumns(1, rows[0].length);
}

// ----------------------------------------------------------------------------
// 4. ERROR CATEGORIES: 6 LOẠI LỖI THỰC TẾ (S, K, O, D, H, Z)
// ----------------------------------------------------------------------------
function _initSheetErrorCategories(ss) {
  var sheet = ss.getSheetByName(SHEETS.ERROR_CATEGORIES) || ss.insertSheet(SHEETS.ERROR_CATEGORIES);
  sheet.clearContents();
  _formatHeader(sheet, ['CategoryID', 'CategoryName', 'Severity', 'DefaultPenalty', 'Description']);

  var rows = [
    ['CAT_K', 'K - Kích thước ngoài ngưỡng', 'Major',    3,  'Box chưa bám sát mặt đường hoặc thừa rộng so với điểm LiDAR của object'],
    ['CAT_O', 'O - Chồng lấn (Overlap)',    'Major',    4,  'Các bounding box bị đè lấn lên nhau không tách bạch'],
    ['CAT_S', 'S - Scale không đồng bộ',     'Minor',    2,  'Kích thước box thay đổi đột ngột giữa các frame liên tiếp'],
    ['CAT_D', 'D - Quá xa',                  'Minor',    1,  'Gán box ở cự ly quá xa ngoài tầm nhận diện chuẩn'],
    ['CAT_H', 'H - Đổi hướng đột ngột',      'Major',    4,  'Heading góc xoay xe/người bị giật góc đột ngột'],
    ['CAT_Z', 'Z - Z ngoài ngưỡng',          'Critical', 10, 'Độ cao Z lún sâu dưới mặt đường hoặc bay lên không trung']
  ];

  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  sheet.autoResizeColumns(1, rows[0].length);
}

// ----------------------------------------------------------------------------
// 5. SETTINGS: THÔNG TIN TEAM & TRỌNG SỐ ĐÁNH GIÁ
// ----------------------------------------------------------------------------
function _initSheetSettings(ss) {
  var sheet = ss.getSheetByName(SHEETS.SETTINGS) || ss.insertSheet(SHEETS.SETTINGS);
  sheet.clearContents();
  _formatHeader(sheet, ['SettingKey', 'SettingValue', 'Description']);

  var rows = [
    ['TeamName',               'VIN-AI 3D ANNOTATION TEAM', 'Tên chính thức của bộ phận'],
    ['StandardWorkHours',      '8',                         'Số giờ làm việc chuẩn mỗi ngày'],
    ['DefaultTargetPerDay',    '20',                        'Định mức 20 Track ID/ngày'],
    ['AccuracyTarget',         '95',                        'Mục tiêu chất lượng tối thiểu (%)'],
    ['WeightTargetCompletion', '0.40',                      'Trọng số hoàn thành Target'],
    ['WeightAccuracy',         '0.40',                      'Trọng số độ chính xác'],
    ['WeightProductivity',     '0.20',                      'Trọng số năng suất theo giờ'],
    ['TelegramBotToken',       '',                          'Token bot Telegram nhắc việc'],
    ['TelegramChatId',         '',                          'Chat ID nhóm nhận báo cáo']
  ];

  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  sheet.autoResizeColumns(1, rows[0].length);
}

// ----------------------------------------------------------------------------
// 6. DAILY LOGS: DỮ LIỆU THẬT TỪ SHEET 2110, 2210, 2310, 2410
// ----------------------------------------------------------------------------
function _initSheetDailyLogs(ss) {
  var sheet = ss.getSheetByName(SHEETS.DAILY_LOGS) || ss.insertSheet(SHEETS.DAILY_LOGS);
  sheet.clearContents();
  _formatHeader(sheet, [
    'LogID', 'Date', 'MemberID', 'MemberName', 'ProjectID',
    'Output', 'TargetPerDay', 'WorkHours', 'ReworkCount',
    'Accuracy', 'Productivity', 'TargetComp', 'Note', 'IsLocked'
  ]);

  var rows = [
    // --- NGÀY 21/10/2026 (Khởi động nhận task) ---
    ['LOG101', '2026-10-21', 'MB004', 'Dư Văn Sang',      'PRJ_3D_LIDAR', 25, 20, 8, 1, 96.0, 3.1, 125.0, 'Nhận Task #1334 - Đã ano được 25 track id (1-24,50)', 'No'],
    ['LOG102', '2026-10-21', 'MB008', 'Nguyễn Công Bình', 'PRJ_3D_LIDAR', 18, 20, 8, 3, 83.3, 2.3, 90.0,  'Nhận Task #1581 - hôm đầu bị mất job, nhảy id, rework', 'No'],
    ['LOG103', '2026-10-21', 'MB007', 'Bạch Khánh An',    'PRJ_3D_LIDAR', 27, 20, 8, 2, 92.6, 3.4, 135.0, 'Nhận Task #1326 - Đã ano được 27 track id (1-27)', 'No'],
    ['LOG104', '2026-10-21', 'MB009', 'Trần Minh Hiếu',   'PRJ_3D_LIDAR', 21, 20, 8, 2, 90.5, 2.6, 105.0, 'Nhận Task #1289 - Đã ano 21 track id', 'No'],
    ['LOG105', '2026-10-21', 'MB001', 'Ngô Văn Cao',      'PRJ_3D_LIDAR', 30, 20, 8, 1, 96.7, 3.8, 150.0, 'Nhận Task #1213 - Đã ano 30 track id', 'No'],
    ['LOG106', '2026-10-21', 'MB005', 'Nguyễn Hữu Dũng',  'PRJ_3D_LIDAR', 40, 20, 8, 0, 100.0, 5.0, 200.0, 'Nhận Task #1498 - Đã ano 40 track id', 'No'],
    ['LOG107', '2026-10-21', 'MB003', 'Nguyễn Minh Tú',   'PRJ_3D_LIDAR', 27, 20, 8, 1, 96.3, 3.4, 135.0, 'Nhận Task #1247 - Đã ano 27 track id', 'No'],
    ['LOG108', '2026-10-21', 'MB002', 'Nguyễn Văn Tuyển', 'PRJ_3D_LIDAR', 32, 20, 8, 1, 96.9, 4.0, 160.0, 'Nhận Task #1249 - Đã ano 32 track id', 'No'],
    ['LOG109', '2026-10-21', 'MB006', 'Phạm Văn Thân',    'PRJ_3D_LIDAR', 20, 20, 4, 1, 95.0, 5.0, 100.0, 'Nhận Task #1305 - Làm 20 track id (nghỉ phép nửa buổi)', 'No'],

    // --- NGÀY 22/10/2026 ---
    ['LOG110', '2026-10-22', 'MB004', 'Dư Văn Sang',      'PRJ_3D_LIDAR', 16, 20, 8, 1, 93.8, 2.0, 80.0,  'Làm thêm 16 track id (lũy kế 41 id - tiến độ 50%)', 'No'],
    ['LOG111', '2026-10-22', 'MB008', 'Nguyễn Công Bình', 'PRJ_3D_LIDAR', 22, 20, 8, 2, 90.9, 2.8, 110.0, 'Làm thêm 22 track id (lũy kế 40 id - tiến độ 50%)', 'No'],
    ['LOG112', '2026-10-22', 'MB007', 'Bạch Khánh An',    'PRJ_3D_LIDAR', 7,  20, 8, 2, 71.4, 0.9, 35.0,  'Làm thêm 7 track id (lũy kế 34 id - tiến độ 40%)', 'No'],
    ['LOG113', '2026-10-22', 'MB009', 'Trần Minh Hiếu',   'PRJ_3D_LIDAR', 19, 20, 8, 1, 94.7, 2.4, 95.0,  'Làm thêm 19 track id (lũy kế 40 id - tiến độ 50%)', 'No'],
    ['LOG114', '2026-10-22', 'MB001', 'Ngô Văn Cao',      'PRJ_3D_LIDAR', 37, 20, 8, 0, 100.0, 4.6, 185.0, 'Bứt phá thêm 37 track id (lũy kế 67 id - tiến độ 85%)', 'No'],
    ['LOG115', '2026-10-22', 'MB005', 'Nguyễn Hữu Dũng',  'PRJ_3D_LIDAR', 0,  20, 0, 0, 100.0, 0.0, 0.0,   'Nghỉ phép', 'No'],
    ['LOG116', '2026-10-22', 'MB003', 'Nguyễn Minh Tú',   'PRJ_3D_LIDAR', 17, 20, 8, 1, 94.1, 2.1, 85.0,  'Làm thêm 17 track id (lũy kế 44 id - tiến độ 55%)', 'No'],
    ['LOG117', '2026-10-22', 'MB002', 'Nguyễn Văn Tuyển', 'PRJ_3D_LIDAR', 33, 20, 8, 1, 97.0, 4.1, 165.0, 'Làm thêm 33 track id (lũy kế 65 id - tiến độ 85%)', 'No'],
    ['LOG118', '2026-10-22', 'MB006', 'Phạm Văn Thân',    'PRJ_3D_LIDAR', 11, 20, 8, 1, 90.9, 1.4, 55.0,  'Làm thêm 11 track id (lũy kế 31 id - tiến độ 33%)', 'No'],

    // --- NGÀY 23/10/2026 (Nghỉ nửa ngày theo lịch team) ---
    ['LOG119', '2026-10-23', 'MB004', 'Dư Văn Sang',      'PRJ_3D_LIDAR', 0,  10, 0, 0, 100.0, 0.0, 0.0,   'Nghỉ phép cả ngày (tổng 41 track id)', 'No'],
    ['LOG120', '2026-10-23', 'MB008', 'Nguyễn Công Bình', 'PRJ_3D_LIDAR', 10, 10, 4, 1, 90.0, 2.5, 100.0, 'Nghỉ nửa ngày, gán thêm 10 ID (tổng 50 track id)', 'No'],
    ['LOG121', '2026-10-23', 'MB007', 'Bạch Khánh An',    'PRJ_3D_LIDAR', 13, 10, 4, 1, 92.3, 3.3, 130.0, 'Nghỉ nửa ngày, gán thêm 13 ID (tổng 47 track id)', 'No'],
    ['LOG122', '2026-10-23', 'MB009', 'Trần Minh Hiếu',   'PRJ_3D_LIDAR', 5,  10, 4, 1, 80.0, 1.3, 50.0,  'Nghỉ nửa ngày, gán thêm 5 ID (tổng 45 track id)', 'No'],
    ['LOG123', '2026-10-23', 'MB001', 'Ngô Văn Cao',      'PRJ_3D_LIDAR', 12, 10, 4, 0, 100.0, 3.0, 120.0, 'Nghỉ nửa ngày, HOÀN THÀNH JOB với 79 track ID (100%)', 'No'],
    ['LOG124', '2026-10-23', 'MB005', 'Nguyễn Hữu Dũng',  'PRJ_3D_LIDAR', 20, 10, 4, 0, 100.0, 5.0, 200.0, 'Nghỉ nửa ngày, gán thêm 20 ID (tổng 60 track id)', 'No'],
    ['LOG125', '2026-10-23', 'MB003', 'Nguyễn Minh Tú',   'PRJ_3D_LIDAR', 6,  10, 4, 0, 100.0, 1.5, 60.0,  'Nghỉ nửa ngày, gán thêm 6 ID (tổng 50 track id)', 'No'],
    ['LOG126', '2026-10-23', 'MB002', 'Nguyễn Văn Tuyển', 'PRJ_3D_LIDAR', 13, 10, 4, 0, 100.0, 3.3, 130.0, 'Nghỉ nửa ngày, hoàn thành 78 track ID (tiến độ 99%)', 'No'],
    ['LOG127', '2026-10-23', 'MB006', 'Phạm Văn Thân',    'PRJ_3D_LIDAR', 12, 10, 4, 1, 91.7, 3.0, 120.0, 'Nghỉ nửa ngày, gán thêm 12 ID (tổng 43 track id)', 'No'],

    // --- NGÀY 24/10/2026 (Chốt Deadline) ---
    ['LOG128', '2026-10-24', 'MB004', 'Dư Văn Sang',      'PRJ_3D_LIDAR', 40, 20, 8, 2, 95.0, 5.0, 200.0, 'Đã hoàn thành tiến độ với 81 tracking ID (100%)', 'No'],
    ['LOG129', '2026-10-24', 'MB008', 'Nguyễn Công Bình', 'PRJ_3D_LIDAR', 33, 20, 8, 2, 93.9, 4.1, 165.0, 'Đã hoàn thành tiến độ với 83 tracking ID (100%)', 'No'],
    ['LOG130', '2026-10-24', 'MB007', 'Bạch Khánh An',    'PRJ_3D_LIDAR', 31, 20, 8, 3, 90.3, 3.9, 155.0, 'Đã hoàn thành tiến độ với 78 tracking ID (100%)', 'No'],
    ['LOG131', '2026-10-24', 'MB009', 'Trần Minh Hiếu',   'PRJ_3D_LIDAR', 16, 20, 8, 2, 87.5, 2.0, 80.0,  'Kết thúc với 61 ID (Chậm tiến độ, đạt 77% target)', 'No'],
    ['LOG132', '2026-10-24', 'MB001', 'Ngô Văn Cao',      'PRJ_3D_LIDAR', 0,  20, 8, 0, 100.0, 0.0, 0.0,   'Đã hoàn thành 79 tracking ID từ hôm trước, hỗ trợ QC', 'No'],
    ['LOG133', '2026-10-24', 'MB005', 'Nguyễn Hữu Dũng',  'PRJ_3D_LIDAR', 14, 20, 8, 0, 100.0, 1.8, 70.0,  'Đã hoàn thành tiến độ với 74 tracking ID (100%)', 'No'],
    ['LOG134', '2026-10-24', 'MB003', 'Nguyễn Minh Tú',   'PRJ_3D_LIDAR', 32, 20, 8, 1, 96.9, 4.0, 160.0, 'Đã hoàn thành tiến độ với 82 tracking ID (100%)', 'No'],
    ['LOG135', '2026-10-24', 'MB002', 'Nguyễn Văn Tuyển', 'PRJ_3D_LIDAR', 2,  20, 8, 0, 100.0, 0.3, 10.0,  'Đã hoàn thành tiến độ với 80 tracking ID (100%)', 'No'],
    ['LOG136', '2026-10-24', 'MB006', 'Phạm Văn Thân',    'PRJ_3D_LIDAR', 35, 20, 8, 1, 97.1, 4.4, 175.0, 'Đã hoàn thành tiến độ với 78 tracking ID (100%)', 'No']
  ];

  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  sheet.autoResizeColumns(1, rows[0].length);
}

// ----------------------------------------------------------------------------
// 7. ERROR LOGS: BẢNG GHI NHẬN LỖI (SẠCH SẼ, CHỜ GHI NHẬN THỰC TẾ)
// ----------------------------------------------------------------------------
function _initSheetErrorLogs(ss) {
  var sheet = ss.getSheetByName(SHEETS.ERROR_LOGS) || ss.insertSheet(SHEETS.ERROR_LOGS);
  sheet.clearContents();
  _formatHeader(sheet, [
    'ErrorID', 'Date', 'MemberID', 'MemberName', 'ProjectID',
    'TaskId', 'Description', 'Status', 'CreatedBy', 'CreatedAt'
  ]);
  // Bảng trống sạch sẽ để QC/Admin tự ghi nhận lỗi thật
  sheet.autoResizeColumns(1, 10);
}

// ----------------------------------------------------------------------------
// 8. REPORT HISTORY
// ----------------------------------------------------------------------------
function _initSheetReportHistory(ss) {
  var sheet = ss.getSheetByName(SHEETS.REPORT_HISTORY) || ss.insertSheet(SHEETS.REPORT_HISTORY);
  sheet.clearContents();
  _formatHeader(sheet, [
    'ReportID', 'ReportType', 'PeriodRange', 'Title',
    'SnapshotJson', 'ManagerNote', 'NextWeekPlan', 'CreatedBy', 'CreatedAt'
  ]);
}

// ----------------------------------------------------------------------------
// 9. ATTENDANCE: BẢNG ĐIỂM DANH HẰNG NGÀY & TÁC PHONG
// ----------------------------------------------------------------------------
function _initSheetAttendance(ss) {
  var sheet = ss.getSheetByName(SHEETS.ATTENDANCE) || ss.insertSheet(SHEETS.ATTENDANCE);
  sheet.clearContents();
  _formatHeader(sheet, [
    'AttendanceID', 'Date', 'MemberID', 'FullName', 'Role',
    'Status', 'Demeanor', 'Note', 'UpdatedBy', 'UpdatedAt'
  ]);

  var members = [
    { id: 'MB001', name: 'Nguyễn Minh Tú',   role: 'Team Lead' },
    { id: 'MB002', name: 'Dư Văn Sang',      role: 'Annotator + QC' },
    { id: 'MB003', name: 'Ngô Văn Cao',      role: 'Annotator' },
    { id: 'MB004', name: 'Nguyễn Công Bình', role: 'Annotator' },
    { id: 'MB005', name: 'Nguyễn Hữu Dũng',  role: 'Annotator' },
    { id: 'MB006', name: 'Phạm Văn Thân',    role: 'Annotator' },
    { id: 'MB007', name: 'Bạch Khánh An',    role: 'Annotator' },
    { id: 'MB008', name: 'Trần Minh Hiếu',   role: 'Annotator' },
    { id: 'MB009', name: 'Nguyễn Tiến Sỹ',   role: 'Annotator' },
    { id: 'MB010', name: 'Nguyễn Văn Tuyển', role: 'Annotator' }
  ];

  var dates = ['2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'];
  var rows = [];
  var count = 1;

  for (var d = 0; d < dates.length; d++) {
    var dt = dates[d];
    for (var m = 0; m < members.length; m++) {
      var mb = members[m];
      var st = 'Có mặt';
      var dem = 'Đạt';
      var note = '';

      if (dt === '2026-10-22' && mb.id === 'MB005') {
        st = 'Nghỉ phép';
        note = 'Có đơn xin nghỉ phép việc cá nhân';
      } else if (dt === '2026-10-23') {
        if (mb.id === 'MB002') {
          st = 'Nghỉ phép';
          note = 'Nghỉ phép cả ngày';
        } else {
          st = 'Nghỉ nửa ngày';
          note = 'Nghỉ buổi chiều theo lịch team';
        }
      } else if (dt === '2026-10-21' && mb.id === 'MB006') {
        st = 'Nghỉ nửa ngày';
        note = 'Nghỉ nửa buổi sáng';
      }

      rows.push([
        'ATT' + (count++),
        dt,
        mb.id,
        mb.name,
        mb.role,
        st,
        dem,
        note,
        'Team Lead',
        '2026-10-25 08:00:00'
      ]);
    }
  }

  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  sheet.autoResizeColumns(1, rows[0].length);
}
