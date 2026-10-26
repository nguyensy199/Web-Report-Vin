/**
 * ============================================================================
 * CODE.GS - ROUTER CHÍNH, PHÂN QUYỀN, TIỆN ÍCH & TRIGGERS
 * Hệ thống Quản Lý Team Data Annotation (Bản V2 Chuẩn Hóa)
 * Múi giờ: Asia/Ho_Chi_Minh
 * ============================================================================
 */

const TIMEZONE = 'Asia/Ho_Chi_Minh';
const TZ = TIMEZONE;

// Danh mục tên các Sheet trong hệ thống
const SHEETS = {
  MEMBERS:          'Members',
  PROJECTS:         'Projects',
  TARGETS:          'Targets',
  DAILY_LOGS:       'DailyLogs',
  ERROR_LOGS:       'ErrorLogs',
  ERROR_CATEGORIES: 'ErrorCategories',
  SETTINGS:         'Settings',
  REPORT_HISTORY:   'ReportHistory',
  REPORTS:          'ReportHistory',
  ATTENDANCE:       'Attendance'
};
const SHEET = SHEETS; // Alias tương thích ngược

// 3 Vai trò (Roles) chuẩn của hệ thống
const ROLES = {
  ANNOTATOR: 'Annotator',
  ANNOTATOR_QC: 'Annotator + QC',
  TEAM_LEAD: 'Team Lead'
};

// ============================================================================
// 1. ENTRY POINT (HTML SERVICE)
// ============================================================================

/**
 * Điểm vào chính của Web App
 */
function doGet(e) {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('Quản Lý Team Data Annotation')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/**
 * Hàm nhúng chia nhỏ file HTML thành css.html và js.html
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Lấy đối tượng Spreadsheet đang hoạt động
 */
function getSpreadsheet() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

// ============================================================================
// 2. TIỆN ÍCH NGÀY THÁNG & CHUỖI
// ============================================================================

function formatDateVietnamese(dateVal) {
  if (!dateVal) return '';
  var d = (dateVal instanceof Date) ? dateVal : parseDateIso(dateVal);
  if (!d || isNaN(d.getTime())) return String(dateVal);
  return Utilities.formatDate(d, TIMEZONE, 'dd/MM/yyyy');
}

function parseDateIso(str) {
  if (!str) return new Date();
  if (str instanceof Date) return str;
  var s = String(str).trim();
  // Nếu dạng yyyy-MM-dd
  if (s.indexOf('-') !== -1) {
    var parts = s.split('-');
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }
  // Nếu dạng dd/MM/yyyy
  if (s.indexOf('/') !== -1) {
    var p = s.split('/');
    return new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10));
  }
  return new Date(s);
}

/**
 * Tính khoảng thời gian Thứ 2 -> Chủ nhật từ một ngày bất kỳ
 */
function getWeekRangeFromDate(refDate) {
  var d = new Date(refDate.getTime());
  var day = d.getDay(); // 0 là Chủ nhật, 1 là Thứ 2
  var diffToMonday = (day === 0 ? -6 : 1 - day); // Khoảng cách về Thứ 2

  var monday = new Date(d.setDate(d.getDate() + diffToMonday));
  monday.setHours(0, 0, 0, 0);

  var sunday = new Date(monday.getTime() + 6 * 24 * 3600 * 1000);
  sunday.setHours(23, 59, 59, 999);

  return {
    from: monday,
    to: sunday,
    fromStr: Utilities.formatDate(monday, TIMEZONE, 'yyyy-MM-dd'),
    toStr: Utilities.formatDate(sunday, TIMEZONE, 'yyyy-MM-dd'),
    displayRange: formatDateVietnamese(monday) + ' - ' + formatDateVietnamese(sunday)
  };
}

function getCurrentWeekRange() {
  return getWeekRangeFromDate(new Date());
}

// ============================================================================
// 3. PHÂN QUYỀN NGƯỜI DÙNG (3 ROLES: Annotator, Annotator + QC, Team Lead)
// ============================================================================

function getCurrentUser() {
  var email = Session.getActiveUser().getEmail() || '';
  
  // Nếu chưa đăng nhập hoặc đang test, cấp quyền Team Lead (Nguyễn Minh Tú)
  if (!email) {
    return { id: 'MB001', name: 'Nguyễn Minh Tú', email: 'tunm2@company.com', role: 'Team Lead' };
  }

  try {
    var sheet = getSpreadsheet().getSheetByName(SHEETS.MEMBERS);
    if (sheet) {
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        var mId = data[i][0];
        var mName = data[i][1];
        var mEmail = data[i][2];
        var mRole = data[i][3];

        if (String(mEmail).toLowerCase().trim() === email.toLowerCase().trim()) {
          var normalizedRole = 'Annotator';
          if (mRole === 'Team Lead' || mRole === 'ADMIN') normalizedRole = 'Team Lead';
          else if (mRole === 'Annotator + QC' || mRole === 'QA') normalizedRole = 'Annotator + QC';

          return {
            id: mId,
            name: mName,
            email: mEmail,
            role: normalizedRole
          };
        }
      }
    }
  } catch (e) {
    Logger.log('Lỗi lấy user: ' + e.message);
  }

  // Mặc định người deploy web app chính là Team Lead
  return { id: 'MB009', name: email.split('@')[0] || 'Nguyễn Tiến Sỹ', email: email, role: 'Team Lead' };
}

function isTeamLead() {
  var r = getCurrentUser().role;
  return r === 'Team Lead' || r === 'ADMIN';
}

function isQC() {
  var r = getCurrentUser().role;
  return r === 'Annotator + QC' || r === 'Team Lead' || r === 'QA' || r === 'ADMIN';
}

function isAdmin() {
  return isTeamLead();
}

function isQA() {
  return isQC();
}

function checkAdmin() {
  if (!isTeamLead()) {
    throw new Error('Bạn không có quyền thực hiện chức năng này (Yêu cầu vai trò Team Lead)!');
  }
}

function checkQaOrAdmin() {
  if (!isQC()) {
    throw new Error('Bạn không có quyền thực hiện chức năng này (Yêu cầu vai trò Annotator + QC hoặc Team Lead)!');
  }
}

// ============================================================================
// 4. DỮ LIỆU KHỞI TẠO BAN ĐẦU CHO CLIENT (INITIAL DATA)
// ============================================================================

function getInitialData() {
  var user = { id: 'MB009', name: 'Nguyễn Tiến Sỹ', email: '', role: 'Team Lead' };
  var members = [];
  var projects = [];
  var errorCategories = [];
  var settings = {};
  var weekRange = null;

  try { user = getCurrentUser(); } catch (e) { Logger.log('Lỗi getCurrentUser: ' + e); }
  try { members = getMembers(true); } catch (e) { Logger.log('Lỗi getMembers: ' + e); }
  try { projects = getProjects(true); } catch (e) { Logger.log('Lỗi getProjects: ' + e); }
  try { errorCategories = getErrorCategories(); } catch (e) { Logger.log('Lỗi getErrorCategories: ' + e); }
  try { settings = getSettings(); } catch (e) { Logger.log('Lỗi getSettings: ' + e); }
  try { weekRange = getCurrentWeekRange(); } catch (e) { Logger.log('Lỗi getCurrentWeekRange: ' + e); }

  if (!members || members.length === 0) {
    members = [
      { MemberID: 'MB009', FullName: 'Nguyễn Tiến Sỹ', Role: 'Team Lead', DailyTarget: 20, Status: 'Active' },
      { MemberID: 'MB001', FullName: 'Nguyễn Minh Tú', Role: 'Annotator + QC', DailyTarget: 20, Status: 'Active' },
      { MemberID: 'MB010', FullName: 'Nguyễn Văn Tuyển', Role: 'Annotator + QC', DailyTarget: 20, Status: 'Active' },
      { MemberID: 'MB002', FullName: 'Dư Văn Sang', Role: 'Annotator', DailyTarget: 20, Status: 'Active' },
      { MemberID: 'MB003', FullName: 'Ngô Văn Cao', Role: 'Annotator', DailyTarget: 20, Status: 'Active' },
      { MemberID: 'MB004', FullName: 'Nguyễn Công Bình', Role: 'Annotator', DailyTarget: 20, Status: 'Active' },
      { MemberID: 'MB005', FullName: 'Nguyễn Hữu Dũng', Role: 'Annotator', DailyTarget: 20, Status: 'Active' },
      { MemberID: 'MB006', FullName: 'Phạm Văn Thân', Role: 'Annotator', DailyTarget: 20, Status: 'Active' },
      { MemberID: 'MB007', FullName: 'Bạch Khánh An', Role: 'Annotator', DailyTarget: 20, Status: 'Active' },
      { MemberID: 'MB008', FullName: 'Trần Minh Hiếu', Role: 'Annotator', DailyTarget: 20, Status: 'Active' }
    ];
  }

  return {
    success: true,
    user: user,
    members: members,
    projects: projects,
    errorCategories: errorCategories,
    settings: settings,
    weekRange: weekRange
  };
}

// ============================================================================
// 5. TRIGGERS TỰ ĐỘNG
// ============================================================================

function setupTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }

  // Nhắc nhở nhập số liệu lúc 18:00 mỗi ngày
  ScriptApp.newTrigger('remindMissingDailyLogs')
    .timeBased()
    .everyDays(1)
    .atHour(18)
    .nearMinute(0)
    .create();

  Logger.log('Đã tạo trigger tự động nhắc nhở lúc 18:00 hằng ngày.');
}
