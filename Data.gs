/**
 * ============================================================================
 * DATA.GS - ĐỌC VÀ GHI DỮ LIỆU GOOGLE SHEETS TỐI ƯU
 * Hệ thống Quản Lý Team Data Annotation (Bản nâng cấp chuyên nghiệp)
 * ============================================================================
 * Quy tắc tối ưu hiệu năng:
 * - Không bao giờ gọi getRange() hay getSheetByName() trong vòng lặp for.
 * - Luôn đọc 1 lần toàn bộ bảng (getDataRange().getValues()), lọc trong bộ nhớ RAM.
 * - Ghi dữ liệu theo khối (batch append/setValues) để không chạm giới hạn 6 phút của Apps Script.
 * - Sử dụng LockService khi ghi dữ liệu để chống xung đột nhiều người dùng cùng lúc (concurrency).
 */

/**
 * Lấy đối tượng Sheet theo tên, kèm kiểm tra tồn tại
 * @param {string} sheetName Tên sheet cần mở
 * @returns {GoogleAppsScript.Spreadsheet.Sheet}
 */
function getSheet(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    throw new Error('Không tìm thấy bảng tính: "' + sheetName + '". Vui lòng chạy hàm setupDatabase() trước!');
  }
  return sheet;
}

/**
 * Đọc toàn bộ dữ liệu từ sheet và chuyển thành mảng Object dựa vào dòng Header (dòng 1)
 * @param {string} sheetName Tên sheet
 * @returns {Array<Object>} Mảng các đối tượng dữ liệu
 */
function getSheetDataAsObjects(sheetName) {
  var sheet = getSheet(sheetName);
  var values = sheet.getDataRange().getValues();
  if (values.length <= 1) return []; // Không có dữ liệu, chỉ có tiêu đề hoặc rỗng

  var headers = values[0];
  var rows = [];

  for (var i = 1; i < values.length; i++) {
    var rowData = values[i];
    var obj = { _rowIndex: i + 1 }; // Lưu chỉ số dòng trong Sheet (1-based) để tiện cập nhật
    var hasData = false;

    for (var j = 0; j < headers.length; j++) {
      var headerKey = headers[j].toString().trim();
      var val = rowData[j];

      // Chuẩn hóa định dạng ngày tháng nếu gặp Date object
      if (val instanceof Date) {
        // Nếu là cột Date/Ngày thì định dạng yyyy-MM-dd để đồng bộ
        if (headerKey.toLowerCase().indexOf('date') !== -1 || headerKey.toLowerCase().indexOf('ngay') !== -1) {
          val = Utilities.formatDate(val, TIMEZONE, 'yyyy-MM-dd');
        } else {
          val = Utilities.formatDate(val, TIMEZONE, 'dd/MM/yyyy HH:mm:ss');
        }
      }

      obj[headerKey] = val;
      if (val !== '' && val !== null && val !== undefined) {
        hasData = true;
      }
    }

    if (hasData) {
      rows.push(obj);
    }
  }

  return rows;
}

// ============================================================================
// 1. QUẢN LÝ THÀNH VIÊN (MEMBERS)
// ============================================================================

/**
 * Lấy danh sách thành viên
 * @param {boolean} onlyActive Chỉ lấy thành viên đang hoạt động
 * @returns {Array<Object>}
 */
function getMembers(onlyActive) {
  var allMembers = getSheetDataAsObjects(SHEETS.MEMBERS);
  if (!allMembers || allMembers.length === 0) {
    return [
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
  if (onlyActive) {
    var activeList = allMembers.filter(function(m) {
      return m.Status === 'Active' || m.Status === 'Đang làm' || !m.Status;
    });
    return activeList.length > 0 ? activeList : allMembers;
  }
  return allMembers;
}

/**
 * Thêm mới hoặc cập nhật thông tin thành viên (Admin only)
 * @param {Object} memberData Dữ liệu thành viên
 */
function saveMember(memberData) {
  checkAdmin();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = getSheet(SHEETS.MEMBERS);
    var values = sheet.getDataRange().getValues();
    var headers = values[0];
    var idIndex = headers.indexOf('MemberID');
    var rowIndexToUpdate = -1;

    // Tìm xem ID thành viên đã tồn tại chưa
    if (memberData.MemberID) {
      for (var i = 1; i < values.length; i++) {
        if (values[i][idIndex] == memberData.MemberID) {
          rowIndexToUpdate = i + 1;
          break;
        }
      }
    }

    var newRow = [
      memberData.MemberID || ('MB' + Utilities.formatDate(new Date(), TIMEZONE, 'yyMMddHHmmss')),
      memberData.FullName || '',
      memberData.Email || '',
      memberData.Role || 'ANNOTATOR',
      memberData.DailyTarget || 120,
      memberData.TargetHour || 15,
      memberData.Status || 'Active',
      memberData.TelegramChatId || ''
    ];

    if (rowIndexToUpdate > 0) {
      sheet.getRange(rowIndexToUpdate, 1, 1, newRow.length).setValues([newRow]);
    } else {
      sheet.appendRow(newRow);
    }

    return { success: true, message: 'Đã lưu thông tin thành viên thành công!' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Xóa thành viên theo ID
 * @param {string} memberId
 */
function deleteMember(memberId) {
  checkAdmin();
  var sheet = getSheet(SHEETS.MEMBERS);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] == memberId) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Đã xóa thành viên thành công!' };
    }
  }
  return { success: false, message: 'Không tìm thấy thành viên để xóa!' };
}

// ============================================================================
// 2. QUẢN LÝ DỰ ÁN (PROJECTS)
// ============================================================================

/**
 * Lấy danh sách dự án
 * @param {boolean} onlyActive Chỉ lấy dự án Active
 */
function getProjects(onlyActive) {
  var projects = getSheetDataAsObjects(SHEETS.PROJECTS);
  if (onlyActive) {
    return projects.filter(function(p) { return p.Status === 'Active'; });
  }
  return projects;
}

/**
 * Lưu dự án mới hoặc cập nhật
 * @param {Object} projectData
 */
function saveProject(projectData) {
  checkAdmin();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = getSheet(SHEETS.PROJECTS);
    var values = sheet.getDataRange().getValues();
    var rowIndex = -1;

    if (projectData.ProjectID) {
      for (var i = 1; i < values.length; i++) {
        if (values[i][0] == projectData.ProjectID) {
          rowIndex = i + 1;
          break;
        }
      }
    }

    var row = [
      projectData.ProjectID || ('PRJ' + Utilities.formatDate(new Date(), TIMEZONE, 'yyMMddHHmmss')),
      projectData.ProjectName || '',
      projectData.ProjectType || '2D Bounding Box',
      projectData.TargetPerDay || 120,
      projectData.TargetPerHour || 15,
      projectData.Status || 'Active',
      projectData.Description || ''
    ];

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    return { success: true, message: 'Đã lưu thông tin dự án thành công!' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Xóa dự án
 */
function deleteProject(projectId) {
  checkAdmin();
  var sheet = getSheet(SHEETS.PROJECTS);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] == projectId) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Đã xóa dự án thành công!' };
    }
  }
  return { success: false, message: 'Không tìm thấy dự án!' };
}

// ============================================================================
// 3. QUẢN LÝ DANH MỤC LỖI (ERROR CATEGORIES)
// ============================================================================

/**
 * Lấy danh sách danh mục lỗi
 */
function getErrorCategories() {
  return getSheetDataAsObjects(SHEETS.ERROR_CATEGORIES);
}

/**
 * Lưu danh mục lỗi
 */
function saveErrorCategory(catData) {
  checkAdmin();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = getSheet(SHEETS.ERROR_CATEGORIES);
    var values = sheet.getDataRange().getValues();
    var rowIndex = -1;

    if (catData.CategoryID) {
      for (var i = 1; i < values.length; i++) {
        if (values[i][0] == catData.CategoryID) {
          rowIndex = i + 1;
          break;
        }
      }
    }

    var row = [
      catData.CategoryID || ('CAT' + Utilities.formatDate(new Date(), TIMEZONE, 'yyMMddHHmmss')),
      catData.CategoryName || '',
      catData.Severity || 'Major',
      parseFloat(catData.DefaultPenalty || 5),
      catData.Description || ''
    ];

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    return { success: true, message: 'Đã lưu danh mục lỗi thành công!' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Xóa danh mục lỗi
 */
function deleteErrorCategory(catId) {
  checkAdmin();
  var sheet = getSheet(SHEETS.ERROR_CATEGORIES);
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (values[i][0] == catId) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Đã xóa danh mục lỗi!' };
    }
  }
  return { success: false, message: 'Không tìm thấy danh mục lỗi để xóa!' };
}

// ============================================================================
// 4. QUẢN LÝ ĐỊNH MỨC THEO NGƯỜI VÀ DỰ ÁN (TARGETS)
// ============================================================================

/**
 * Lấy danh sách targets
 */
function getTargets() {
  return getSheetDataAsObjects(SHEETS.TARGETS);
}

/**
 * Lưu hoặc cập nhật Target
 */
function saveTarget(targetData) {
  checkAdmin();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = getSheet(SHEETS.TARGETS);
    var values = sheet.getDataRange().getValues();
    var rowIndex = -1;

    if (targetData.TargetID) {
      for (var i = 1; i < values.length; i++) {
        if (values[i][0] == targetData.TargetID) {
          rowIndex = i + 1;
          break;
        }
      }
    }

    var row = [
      targetData.TargetID || ('TGT' + Utilities.formatDate(new Date(), TIMEZONE, 'yyMMddHHmmss')),
      targetData.MemberID || '',
      targetData.ProjectID || '',
      parseFloat(targetData.DailyTarget || 120),
      parseFloat(targetData.TargetPerHour || 15),
      targetData.EffectiveDate || Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd')
    ];

    if (rowIndex > 0) {
      sheet.getRange(rowIndex, 1, 1, row.length).setValues([row]);
    } else {
      sheet.appendRow(row);
    }

    return { success: true, message: 'Đã lưu định mức thành công!' };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// 5. CẤU HÌNH HỆ THỐNG (SETTINGS)
// ============================================================================

/**
 * Lấy cấu hình hệ thống dạng Object key-value
 */
function getSettings() {
  var rows = getSheetDataAsObjects(SHEETS.SETTINGS);
  var settings = {};
  for (var i = 0; i < rows.length; i++) {
    settings[rows[i].SettingKey] = rows[i].SettingValue;
  }
  return settings;
}

/**
 * Lưu cấu hình hệ thống
 * @param {Object} settingsObj Cặp key-value cài đặt
 */
function saveSettings(settingsObj) {
  checkAdmin();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = getSheet(SHEETS.SETTINGS);
    var values = sheet.getDataRange().getValues();
    var existingKeys = {};

    for (var i = 1; i < values.length; i++) {
      existingKeys[values[i][0]] = i + 1;
    }

    for (var key in settingsObj) {
      if (settingsObj.hasOwnProperty(key)) {
        var val = settingsObj[key];
        if (existingKeys[key]) {
          sheet.getRange(existingKeys[key], 2).setValue(val);
        } else {
          sheet.appendRow([key, val, 'Cấu hình tự cập nhật']);
        }
      }
    }

    return { success: true, message: 'Đã cập nhật cài đặt hệ thống thành công!' };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Lưu thứ hạng tùy chỉnh do Admin thiết lập cho một khoảng thời gian
 * @param {string} periodKey Mã kỳ ví dụ 'WEEK_2026-10-19' hoặc 'DAY_2026-10-25'
 * @param {Object} rankMap Object dạng { "MB001": 1, "MB002": 2, ... }
 */
function saveCustomRankings(periodKey, rankMap) {
  checkAdmin();
  var key = 'CUSTOM_RANK_' + periodKey;
  var val = JSON.stringify(rankMap || {});
  var obj = {};
  obj[key] = val;
  saveSettings(obj);
  return { success: true, message: 'Đã lưu thay đổi thứ hạng của Admin thành công!' };
}

/**
 * Lấy thứ hạng tùy chỉnh do Admin thiết lập cho một khoảng thời gian
 * @param {string} periodKey
 */
function getCustomRankings(periodKey) {
  var settings = getSettings();
  var key = 'CUSTOM_RANK_' + periodKey;
  if (settings[key]) {
    try {
      return JSON.parse(settings[key]);
    } catch (e) {
      return null;
    }
  }
  return null;
}

// ============================================================================
// 6. NHẬT KÝ SỐ LIỆU HẰNG NGÀY (DAILY LOGS)
// ============================================================================

/**
 * Đọc danh sách Daily Logs với bộ lọc tối ưu trong RAM
 * @param {string} fromDate (yyyy-MM-dd)
 * @param {string} toDate (yyyy-MM-dd)
 * @param {string} memberId (Tùy chọn)
 * @param {string} projectId (Tùy chọn)
 */
function getDailyLogs(fromDate, toDate, memberId, projectId) {
  var logs = getSheetDataAsObjects(SHEETS.DAILY_LOGS);

  return logs.filter(function(row) {
    var matchDate = true;
    var rowDate = row.Date;

    if (fromDate && rowDate < fromDate) matchDate = false;
    if (toDate && rowDate > toDate) matchDate = false;

    var matchMember = !memberId || row.MemberID == memberId;
    var matchProject = !projectId || row.ProjectID == projectId;

    return matchDate && matchMember && matchProject;
  });
}

/**
 * Lưu hoặc cập nhật số liệu nhật ký hằng ngày
 * Có kiểm tra trạng thái khóa (Locked) và tự động tính toán các chỉ số
 * @param {Object} logData Dữ liệu nhập
 */
function saveDailyLog(logData) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = getSheet(SHEETS.DAILY_LOGS);
    var values = sheet.getDataRange().getValues();
    var headers = values[0];

    var user = getCurrentUser();
    var isUserAdmin = isAdmin();

    // Tự động đăng ký thành viên nếu là tên mới nhập tự do
    if (logData.MemberName) {
      try {
        var mSheet = getSheet(SHEETS.MEMBERS);
        var mValues = mSheet.getDataRange().getValues();
        var exists = false;
        for (var mi = 1; mi < mValues.length; mi++) {
          if (mValues[mi][1] == logData.MemberName || mValues[mi][0] == logData.MemberID) {
            exists = true;
            logData.MemberID = mValues[mi][0]; // Lấy đúng ID nếu đã tồn tại
            break;
          }
        }
        if (!exists) {
          mSheet.appendRow([logData.MemberID, logData.MemberName, '', 'ANNOTATOR', logData.TargetPerDay || 120, 15, 'Active', '']);
        }
      } catch(e) {}
    }

    // Tự động đăng ký dự án nếu là tên mới nhập tự do
    if (logData.ProjectName || logData.ProjectID) {
      try {
        var pSheet = getSheet(SHEETS.PROJECTS);
        var pValues = pSheet.getDataRange().getValues();
        var pExists = false;
        for (var pi = 1; pi < pValues.length; pi++) {
          if (pValues[pi][0] == logData.ProjectID || pValues[pi][1] == (logData.ProjectName || logData.ProjectID)) {
            pExists = true;
            logData.ProjectID = pValues[pi][0]; // Lấy đúng ID nếu đã có
            break;
          }
        }
        if (!pExists) {
          pSheet.appendRow([logData.ProjectID, logData.ProjectName || logData.ProjectID, 'General', logData.TargetPerDay || 120, 15, 'Active', 'Tự động tạo từ nhật ký']);
        }
      } catch(e) {}
    }

    // Kiểm tra dòng đã tồn tại chưa (theo LogID hoặc cặp Date + MemberID + ProjectID)
    var rowIndexToUpdate = -1;
    var isRowLocked = false;

    for (var i = 1; i < values.length; i++) {
      var r = values[i];
      var rLogId = r[headers.indexOf('LogID')];
      var rDate = r[headers.indexOf('Date')];
      var rMember = r[headers.indexOf('MemberID')];
      var rProject = r[headers.indexOf('ProjectID')];
      var rLocked = r[headers.indexOf('IsLocked')];

      if (rDate instanceof Date) {
        rDate = Utilities.formatDate(rDate, TIMEZONE, 'yyyy-MM-dd');
      }

      var match = false;
      if (logData.LogID && rLogId == logData.LogID) {
        match = true;
      } else if (!logData.LogID && rDate == logData.Date && rMember == logData.MemberID && rProject == logData.ProjectID) {
        match = true;
      }

      if (match) {
        rowIndexToUpdate = i + 1;
        isRowLocked = (rLocked === 'Yes' || rLocked === true || rLocked === 'LOCKED');
        break;
      }
    }

    // Nếu đã bị khóa và không phải Admin thì không được sửa
    if (isRowLocked && !isUserAdmin) {
      throw new Error('Dữ liệu ngày này đã bị Khóa bởi Quản trị viên, không thể chỉnh sửa!');
    }

    // Tính toán các chỉ số phái sinh
    var output = parseFloat(logData.Output || 0);
    var hours = parseFloat(logData.WorkHours || 8);
    var rework = parseFloat(logData.ReworkCount || 0);
    var target = parseFloat(logData.TargetPerDay || 120);

    // Productivity: Sản lượng / giờ
    var productivity = hours > 0 ? (output / hours) : 0;

    // Target completion rate
    var targetComp = target > 0 ? (output / target * 100) : 0;

    // Accuracy: Nếu không truyền, mặc định tính theo công thức: (Output - Rework) / Output * 100
    var accuracy = parseFloat(logData.Accuracy);
    if (isNaN(accuracy)) {
      accuracy = output > 0 ? Math.max(0, (output - rework) / output * 100) : 100;
    }

    var logId = logData.LogID || ('LOG' + Utilities.formatDate(new Date(), TIMEZONE, 'yyMMddHHmmss') + Math.floor(Math.random() * 1000));
    var logDateStr = logData.Date;
    if (logDateStr instanceof Date) {
      logDateStr = Utilities.formatDate(logDateStr, TIMEZONE, 'yyyy-MM-dd');
    }

    var rowValues = [
      logId,
      logDateStr,
      logData.MemberID,
      logData.MemberName || '',
      logData.ProjectID,
      output,
      target,
      hours,
      rework,
      parseFloat(accuracy.toFixed(2)),
      parseFloat(productivity.toFixed(2)),
      parseFloat(targetComp.toFixed(2)),
      logData.Note || '',
      isRowLocked ? 'Yes' : 'No'
    ];

    if (rowIndexToUpdate > 0) {
      sheet.getRange(rowIndexToUpdate, 1, 1, rowValues.length).setValues([rowValues]);
    } else {
      sheet.appendRow(rowValues);
    }

    return {
      success: true,
      message: 'Đã lưu số liệu nhật ký thành công!',
      logId: logId
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Xóa một bản ghi nhật ký nhập số liệu hằng ngày (dành cho trường hợp nhập nhầm)
 * @param {string} logId Mã bản ghi cần xóa
 */
function deleteDailyLog(logId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = getSheet(SHEETS.DAILY_LOGS);
    var values = sheet.getDataRange().getValues();
    var headers = values[0];
    var idCol = headers.indexOf('LogID');
    if (idCol === -1) idCol = 0;

    for (var i = 1; i < values.length; i++) {
      if (values[i][idCol] == logId) {
        var dateCol = headers.indexOf('Date');
        var memCol = headers.indexOf('MemberName');
        var deletedDate = values[i][dateCol !== -1 ? dateCol : 1];
        if (deletedDate instanceof Date) {
          deletedDate = Utilities.formatDate(deletedDate, TIMEZONE, 'yyyy-MM-dd');
        }
        var deletedMember = values[i][memCol !== -1 ? memCol : 3] || 'thành viên';

        sheet.deleteRow(i + 1);
        return {
          success: true,
          message: 'Đã xóa bản ghi ngày ' + deletedDate + ' của ' + deletedMember + ' thành công!'
        };
      }
    }

    return {
      success: false,
      message: 'Không tìm thấy bản ghi nhập số liệu có mã: ' + logId
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Lấy danh sách toàn bộ lịch sử nhập số liệu, sắp xếp bản ghi mới nhất lên đầu
 */
function getDailyLogsHistory() {
  var logs = getSheetDataAsObjects(SHEETS.DAILY_LOGS);
  logs.sort(function(a, b) {
    var dateA = a.Date || '';
    var dateB = b.Date || '';
    if (dateB !== dateA) {
      return (dateB > dateA) ? 1 : -1;
    }
    return (b._rowIndex || 0) - (a._rowIndex || 0);
  });
  return logs;
}

/**
 * Khóa hoặc Mở khóa dữ liệu theo ngày (Chỉ Admin)
 * @param {string} dateStr Ngày cần khóa (yyyy-MM-dd)
 * @param {boolean} lockStatus true: Khóa, false: Mở khóa
 */
function lockDayLogs(dateStr, lockStatus) {
  checkAdmin();
  var sheet = getSheet(SHEETS.DAILY_LOGS);
  var values = sheet.getDataRange().getValues();
  var updatedCount = 0;

  for (var i = 1; i < values.length; i++) {
    var rDate = values[i][1];
    if (rDate instanceof Date) {
      rDate = Utilities.formatDate(rDate, TIMEZONE, 'yyyy-MM-dd');
    }
    if (rDate === dateStr) {
      sheet.getRange(i + 1, 14).setValue(lockStatus ? 'Yes' : 'No');
      updatedCount++;
    }
  }

  return {
    success: true,
    message: (lockStatus ? 'Đã khóa' : 'Đã mở khóa') + ' thành công ' + updatedCount + ' dòng số liệu ngày ' + dateStr
  };
}

// ============================================================================
// 7. NHẬT KÝ LỖI (ERROR LOGS) & KHIẾU NẠI (APPEALS)
// ============================================================================

/**
 * Lấy danh sách lỗi có bộ lọc (hỗ trợ lọc theo Người ghi QC)
 */
function getErrorLogs(fromDate, toDate, memberText, projectText, status, qcText) {
  var logs = getSheetDataAsObjects(SHEETS.ERROR_LOGS);

  return logs.filter(function(row) {
    var matchDate = true;
    var rowDate = row.Date;

    if (fromDate && rowDate < fromDate) matchDate = false;
    if (toDate && rowDate > toDate) matchDate = false;

    var matchMember = true;
    if (memberText && memberText.trim()) {
      var mQ = memberText.toLowerCase().trim();
      var mName = (row.MemberName || '').toLowerCase();
      var mId = (row.MemberID || '').toLowerCase();
      matchMember = (mName.indexOf(mQ) !== -1 || mId.indexOf(mQ) !== -1);
    }

    var matchProject = true;
    if (projectText && projectText.trim()) {
      var pQ = projectText.toLowerCase().trim();
      var pId = (row.ProjectID || '').toLowerCase();
      matchProject = (pId.indexOf(pQ) !== -1);
    }

    var matchStatus = !status || row.Status == status;

    var matchQC = true;
    if (qcText && qcText.trim()) {
      var qcQ = qcText.toLowerCase().trim();
      var rowQc = (row.CreatedBy || row.ReportedBy || '').toLowerCase();
      matchQC = (rowQc.indexOf(qcQ) !== -1);
    }

    return matchDate && matchMember && matchProject && matchStatus && matchQC;
  });
}

/**
 * Ghi nhận lỗi mới tinh gọn (QC hoặc Admin)
 * @param {Object} errData
 */
function saveErrorLog(errData) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = getSheet(SHEETS.ERROR_LOGS);
    var user = getCurrentUser();

    var errId = errData.ErrorID || ('ERR' + Utilities.formatDate(new Date(), TIMEZONE, 'yyMMddHHmmss') + Math.floor(Math.random() * 100));
    var dateStr = errData.Date || Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
    if (dateStr instanceof Date) {
      dateStr = Utilities.formatDate(dateStr, TIMEZONE, 'yyyy-MM-dd');
    }

    // Tự động đối chiếu MemberID nếu nhập tên
    var memberId = errData.MemberID || '';
    var memberName = errData.MemberName || '';
    if (memberName) {
      try {
        var mSheet = getSheet(SHEETS.MEMBERS);
        var mValues = mSheet.getDataRange().getValues();
        for (var mi = 1; mi < mValues.length; mi++) {
          if (mValues[mi][1] == memberName || mValues[mi][0] == memberId) {
            memberId = mValues[mi][0];
            break;
          }
        }
      } catch(e) {}
    }

    // Ưu tiên Người ghi (QC) được chọn từ dropdown giao diện, nếu không có mới dùng user đăng nhập
    var createdBy = (errData.CreatedBy || errData.ReportedBy || '').trim();
    if (!createdBy) {
      createdBy = user.name || user.email || 'QC';
    }

    var row = [
      errId,
      dateStr,
      memberId || ('MB_' + memberName.replace(/\s+/g, '_')),
      memberName,
      errData.ProjectID || 'PRJ_3D_LIDAR',
      errData.TaskId || '',
      errData.Description || '',
      'Đang chờ', // Trạng thái mặc định: Đang chờ
      createdBy,
      Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss')
    ];

    sheet.appendRow(row);

    return {
      success: true,
      message: 'Đã ghi nhận lỗi thành công! (Mã: ' + errId + ')',
      errorId: errId
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Cập nhật trạng thái lỗi ('Đã sửa' hoặc 'Đang chờ')
 * @param {string} errorId Mã lỗi
 * @param {string} newStatus Trạng thái mới
 */
function updateErrorStatus(errorId, newStatus) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = getSheet(SHEETS.ERROR_LOGS);
    var values = sheet.getDataRange().getValues();

    for (var i = 1; i < values.length; i++) {
      if (values[i][0] == errorId) {
        sheet.getRange(i + 1, 8).setValue(newStatus); // Cột Status (cột 8)
        return {
          success: true,
          message: 'Đã cập nhật trạng thái lỗi thành "' + newStatus + '"!'
        };
      }
    }

    return { success: false, message: 'Không tìm thấy mã lỗi: ' + errorId };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Chỉnh sửa toàn bộ thông tin bản ghi lỗi (QC hoặc Admin)
 * @param {Object} errData { ErrorID, Date, MemberID, MemberName, TaskId, Description, Status, CreatedBy }
 */
function updateErrorLog(errData) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var errorId = errData.ErrorID;
    if (!errorId) return { success: false, message: 'Thiếu mã lỗi (ErrorID)!' };

    var sheet = getSheet(SHEETS.ERROR_LOGS);
    var values = sheet.getDataRange().getValues();

    for (var i = 1; i < values.length; i++) {
      if (values[i][0] == errorId) {
        var rowNum = i + 1;

        if (errData.Date) sheet.getRange(rowNum, 2).setValue(errData.Date);
        if (errData.MemberID) sheet.getRange(rowNum, 3).setValue(errData.MemberID);
        if (errData.MemberName) sheet.getRange(rowNum, 4).setValue(errData.MemberName);
        if (errData.TaskId !== undefined) sheet.getRange(rowNum, 6).setValue(errData.TaskId);
        if (errData.Description !== undefined) sheet.getRange(rowNum, 7).setValue(errData.Description);
        if (errData.Status) sheet.getRange(rowNum, 8).setValue(errData.Status);
        if (errData.CreatedBy) sheet.getRange(rowNum, 9).setValue(errData.CreatedBy);

        return {
          success: true,
          message: 'Đã lưu chỉnh sửa lỗi thành công! (Mã: ' + errorId + ')'
        };
      }
    }

    return { success: false, message: 'Không tìm thấy mã lỗi: ' + errorId };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Xóa một bản ghi lỗi khỏi bảng
 * @param {string} errorId
 */
function deleteErrorLog(errorId) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = getSheet(SHEETS.ERROR_LOGS);
    var values = sheet.getDataRange().getValues();

    for (var i = 1; i < values.length; i++) {
      if (values[i][0] == errorId) {
        sheet.deleteRow(i + 1);
        return {
          success: true,
          message: 'Đã xóa lỗi khỏi hệ thống thành công!'
        };
      }
    }

    return { success: false, message: 'Không tìm thấy mã lỗi: ' + errorId };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// 8. LỊCH SỬ BÁO CÁO (REPORT HISTORY)
// ============================================================================

/**
 * Đọc lịch sử các báo cáo đã lưu
 */
function getReportHistory() {
  return getSheetDataAsObjects(SHEETS.REPORT_HISTORY);
}

/**
 * Xóa một bản ghi lịch sử báo cáo
 */
function deleteReportRecord(reportId) {
  checkAdmin();
  var sheet = getSheet(SHEETS.REPORT_HISTORY);
  var values = sheet.getDataRange().getValues();

  for (var i = 1; i < values.length; i++) {
    if (values[i][0] == reportId) {
      sheet.deleteRow(i + 1);
      return { success: true, message: 'Đã xóa báo cáo khỏi lịch sử!' };
    }
  }
  return { success: false, message: 'Không tìm thấy bản ghi báo cáo để xóa!' };
}

// ============================================================================
// 9. QUẢN LÝ THÀNH VIÊN & PHÂN QUYỀN VAI TRÒ (ROLES MANAGEMENT)
// ============================================================================

/**
 * Lấy danh sách 10 thành viên kèm vai trò hiện tại
 */
function getAllMembersWithRoles() {
  var members = getMembers(false);
  return {
    success: true,
    members: members,
    rolesList: ['Annotator', 'Annotator + QC', 'Team Lead']
  };
}

/**
 * Cập nhật vai trò (Role) cho toàn bộ thành viên
 * @param {Object} rolesMap Cặp key-value { "MB001": "Team Lead", "MB002": "Annotator + QC", ... }
 */
function saveAllMemberRoles(rolesMap) {
  checkAdmin(); // Chỉ Team Lead mới có quyền phân quyền
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = getSheet(SHEETS.MEMBERS);
    var values = sheet.getDataRange().getValues();

    for (var i = 1; i < values.length; i++) {
      var mId = values[i][0];
      if (rolesMap[mId]) {
        sheet.getRange(i + 1, 4).setValue(rolesMap[mId]); // Cột 4 là Role
      }
    }

    return {
      success: true,
      message: 'Đã cập nhật phân quyền vai trò cho đội ngũ thành công!'
    };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// 10. ĐIỂM DANH HẰNG NGÀY & TÁC PHONG (ATTENDANCE MANAGEMENT)
// ============================================================================

/**
 * Lấy bảng điểm danh của một ngày cụ thể (Nếu chưa điểm danh thì trả về mặc định Có mặt & Đạt)
 * @param {string} dateStr (yyyy-MM-dd)
 */
function getDailyAttendance(dateStr) {
  dateStr = dateStr || Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');

  var members = getMembers(true);
  var attSheet = getSheet(SHEETS.ATTENDANCE);
  var attData = attSheet.getDataRange().getValues();

  var savedMap = {};
  for (var i = 1; i < attData.length; i++) {
    var rowDate = attData[i][1];
    var rowDateStr = (rowDate instanceof Date) ? Utilities.formatDate(rowDate, TIMEZONE, 'yyyy-MM-dd') : String(rowDate);

    if (rowDateStr === dateStr) {
      var mId = attData[i][2];
      savedMap[mId] = {
        attendanceId: attData[i][0],
        status: attData[i][5] || 'Có mặt',
        demeanor: attData[i][6] || 'Đạt',
        note: attData[i][7] || ''
      };
    }
  }

  var isSaved = Object.keys(savedMap).length > 0;
  var resultList = [];

  for (var m = 0; m < members.length; m++) {
    var mb = members[m];
    var item = {
      memberId: mb.MemberID,
      memberName: mb.FullName,
      role: mb.Role,
      status: 'Có mặt',
      demeanor: 'Đạt',
      note: ''
    };

    if (savedMap[mb.MemberID]) {
      item.status = savedMap[mb.MemberID].status;
      item.demeanor = savedMap[mb.MemberID].demeanor;
      item.note = savedMap[mb.MemberID].note;
    }

    resultList.push(item);
  }

  return {
    success: true,
    date: dateStr,
    displayDate: formatDateVietnamese(dateStr),
    isSaved: isSaved,
    attendance: resultList
  };
}

/**
 * Lưu bảng điểm danh và tác phong cho một ngày
 * @param {string} dateStr (yyyy-MM-dd)
 * @param {Array} attendanceList Mảng [{ memberId, status, demeanor, note }]
 */
function saveDailyAttendance(dateStr, attendanceList) {
  checkQaOrAdmin(); // Team Lead hoặc QC đều có thể điểm danh
  if (!dateStr || !attendanceList || attendanceList.length === 0) {
    return { success: false, message: 'Dữ liệu điểm danh không hợp lệ!' };
  }

  var user = getCurrentUser();
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = getSheet(SHEETS.ATTENDANCE);
    var values = sheet.getDataRange().getValues();
    var nowStr = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');

    // Tìm các dòng của ngày này đã tồn tại
    var existingRowMap = {}; // mId -> rowIndex
    for (var i = 1; i < values.length; i++) {
      var rowDate = values[i][1];
      var rowDateStr = (rowDate instanceof Date) ? Utilities.formatDate(rowDate, TIMEZONE, 'yyyy-MM-dd') : String(rowDate);
      if (rowDateStr === dateStr) {
        var mId = values[i][2];
        existingRowMap[mId] = i + 1;
      }
    }

    var members = getMembers(false);
    var memberInfoMap = {};
    for (var m = 0; m < members.length; m++) {
      memberInfoMap[members[m].MemberID] = members[m];
    }

    var newRows = [];

    for (var a = 0; a < attendanceList.length; a++) {
      var item = attendanceList[a];
      var mInfo = memberInfoMap[item.memberId] || { FullName: item.memberName || item.memberId, Role: 'Annotator' };
      var rIndex = existingRowMap[item.memberId];

      var rowData = [
        rIndex ? values[rIndex - 1][0] : ('ATT' + Utilities.formatDate(new Date(), TIMEZONE, 'yyMMddHHmmss') + '_' + (a + 1)),
        dateStr,
        item.memberId,
        mInfo.FullName,
        mInfo.Role,
        item.status || 'Có mặt',
        item.demeanor || 'Đạt',
        item.note || '',
        user.name,
        nowStr
      ];

      if (rIndex) {
        sheet.getRange(rIndex, 1, 1, rowData.length).setValues([rowData]);
      } else {
        newRows.push(rowData);
      }
    }

    if (newRows.length > 0) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    }

    return {
      success: true,
      message: 'Đã lưu bảng điểm danh ngày ' + formatDateVietnamese(dateStr) + ' thành công!'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Đọc lịch sử điểm danh theo khoảng ngày
 * @param {string} fromDate (yyyy-MM-dd)
 * @param {string} toDate (yyyy-MM-dd)
 */
function getAttendanceHistory(fromDate, toDate) {
  var rows = getSheetDataAsObjects(SHEETS.ATTENDANCE);
  var filtered = rows.filter(function(r) {
    if (fromDate && r.Date < fromDate) return false;
    if (toDate && r.Date > toDate) return false;
    return true;
  });

  return {
    success: true,
    history: filtered
  };
}

// ============================================================================
// 11. ĐÁNH GIÁ ATTITUDE THÀNH VIÊN THEO TUẦN (ATTITUDE EVALUATION)
// ============================================================================

/**
 * Trích xuất 2 chữ cái viết tắt từ họ tên (VD: "Đặng Trường Huy" -> "TH", "Lê Việt Anh" -> "VA")
 */
function getMemberInitials(name) {
  if (!name) return 'TV';
  var parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  var p1 = parts[parts.length - 2];
  var p2 = parts[parts.length - 1];
  return (p1.charAt(0) + p2.charAt(0)).toUpperCase();
}

/**
 * Phân loại theo chuẩn tham chiếu VinFast OJT / TTS (Thang 1-100)
 * Mốc quy chuẩn:
 * - 90 - 100: L3
 * - 80 - 89: L2
 * - 70 - 79: L2
 * - 50 - 69: L1
 * - Dưới 50: < L1 (Chưa đạt)
 */
function classifyEvaluationScore(score) {
  var s = Math.round(Number(score) || 0);
  if (s >= 90) {
    return {
      level: 'L3',
      bracket: '90 - 100',
      badgeClass: 'badge-l3',
      fillClass: 'fill-l3',
      borderClass: 'card-border-l3',
      color: '#10b981'
    };
  } else if (s >= 80) {
    return {
      level: 'L2',
      bracket: '80 - 89',
      badgeClass: 'badge-l2',
      fillClass: 'fill-l2',
      borderClass: 'card-border-l2',
      color: '#2563eb'
    };
  } else if (s >= 70) {
    return {
      level: 'L2',
      bracket: '70 - 79',
      badgeClass: 'badge-l2',
      fillClass: 'fill-l2',
      borderClass: 'card-border-l2',
      color: '#0284c7'
    };
  } else if (s >= 50) {
    return {
      level: 'L1',
      bracket: '50 - 69',
      badgeClass: 'badge-l1',
      fillClass: 'fill-l1',
      borderClass: 'card-border-l1',
      color: '#ea580c'
    };
  } else {
    return {
      level: '< L1',
      bracket: 'Dưới 50',
      badgeClass: 'badge-below',
      fillClass: 'fill-below',
      borderClass: 'card-border-below',
      color: '#dc2626'
    };
  }
}

/**
 * Lấy dữ liệu Đánh giá Năng lực thành viên theo tuần (Attitude 20% - Skill 50% - Output 30%)
 * Chuẩn hóa theo Thang Đánh Giá Tham Chiếu VinFast (Thang 1-100, L1, L2, L3)
 * @param {string} weekFromDate (yyyy-MM-dd)
 */
function getAttitudeEvaluation(weekFromDate) {
  var weekRange = weekFromDate ? getWeekRangeFromDate(parseDateIso(weekFromDate)) : getCurrentWeekRange();
  var fromStr = weekRange.fromStr;
  var toStr = weekRange.toStr;
  var periodKey = 'ATTITUDE_WEEK_' + fromStr;
  var comprehensivePeriodKey = 'EVALUATION_WEEK_' + fromStr;

  var members = getMembers(true);
  var attRows = getSheetDataAsObjects(SHEETS.ATTENDANCE);
  var dailyLogs = getSheetDataAsObjects(SHEETS.DAILY_LOGS);
  var errorRows = getSheetDataAsObjects(SHEETS.ERROR_LOGS);
  var settings = getSettings();

  // Lọc dữ liệu theo tuần
  var weekAtt = attRows.filter(function(r) {
    return r.Date >= fromStr && r.Date <= toStr;
  });
  var weekLogs = dailyLogs.filter(function(l) {
    return l.Date >= fromStr && l.Date <= toStr;
  });
  var weekErrors = errorRows.filter(function(e) {
    return e.Date >= fromStr && e.Date <= toStr;
  });

  // Kiểm tra cấu hình tùy chỉnh do Team Lead lưu (hỗ trợ cả key mới EVALUATION_WEEK_ và key cũ ATTITUDE_WEEK_)
  var savedCustom = null;
  if (settings[comprehensivePeriodKey]) {
    try {
      savedCustom = JSON.parse(settings[comprehensivePeriodKey]);
    } catch (e) {
      savedCustom = null;
    }
  } else if (settings[periodKey]) {
    try {
      var oldCustom = JSON.parse(settings[periodKey]);
      if (oldCustom && (oldCustom.attitude || oldCustom.skill || oldCustom.output)) {
        savedCustom = oldCustom;
      } else if (oldCustom) {
        // Định dạng cũ chỉ có attitude
        savedCustom = { attitude: oldCustom };
      }
    } catch (e) {
      savedCustom = null;
    }
  }

  var attList = [];
  var skillList = [];
  var outputList = [];
  var overallList = [];

  var totalAttSum = 0;
  var totalSkillSum = 0;
  var totalOutputSum = 0;
  var totalOverallSum = 0;

  var attGoodCount = 0;
  var skillGoodCount = 0;
  var outputGoodCount = 0;
  var overallGoodCount = 0;

  for (var m = 0; m < members.length; m++) {
    var mb = members[m];
    var mAtt = weekAtt.filter(function(r) { return r.MemberID === mb.MemberID; });
    var mLogs = weekLogs.filter(function(l) { return l.MemberID === mb.MemberID; });
    var mErrors = weekErrors.filter(function(e) { return e.MemberID === mb.MemberID; });

    // 1. Thống kê Điểm danh (phục vụ Attitude)
    var presentCount = 0;
    var leaveCount = 0;
    var halfLeaveCount = 0;
    var absentCount = 0;
    var demeanorFailCount = 0;
    var notes = [];

    for (var a = 0; a < mAtt.length; a++) {
      var st = (mAtt[a].Status || '').trim();
      var dem = (mAtt[a].Demeanor || '').trim();
      if (st === 'Có mặt') presentCount++;
      else if (st === 'Nghỉ phép') leaveCount++;
      else if (st === 'Nghỉ nửa ngày') halfLeaveCount++;
      else if (st === 'Nghỉ không phép' || st === 'Vắng mặt') absentCount++;

      if (dem === 'Không đạt') demeanorFailCount++;
      if (mAtt[a].Note && mAtt[a].Note.trim() !== '') {
        notes.push(mAtt[a].Note.trim());
      }
    }

    // 2. Thống kê Nhật ký sản lượng & giờ làm (phục vụ Skill)
    var totalOutput = 0;
    var totalTarget = 0;
    var totalHours = 0;
    var accuracySum = 0;
    var accuracyCount = 0;

    for (var l = 0; l < mLogs.length; l++) {
      totalOutput += parseFloat(mLogs[l].Output || 0);
      totalTarget += parseFloat(mLogs[l].TargetPerDay || mb.DailyTarget || 120);
      totalHours += parseFloat(mLogs[l].Hours || 8);
      if (mLogs[l].Accuracy !== undefined && mLogs[l].Accuracy !== null && mLogs[l].Accuracy !== '') {
        accuracySum += parseFloat(mLogs[l].Accuracy);
        accuracyCount++;
      }
    }
    var targetRatio = totalTarget > 0 ? (totalOutput / totalTarget * 100) : 100;
    var productivity = totalHours > 0 ? Math.round(totalOutput / totalHours) : 0;
    var avgAccuracy = accuracyCount > 0 ? (accuracySum / accuracyCount) : 100;

    // 3. Thống kê Lỗi (phục vụ Output)
    var errorCount = mErrors.length;
    var criticalCount = 0;
    for (var er = 0; er < mErrors.length; er++) {
      var sev = (mErrors[er].Severity || '').toLowerCase();
      if (sev.indexOf('critical') >= 0 || sev.indexOf('nghiêm trọng') >= 0) criticalCount++;
    }

    // =========================================================================
    // A. TÍNH ĐIỂM TỰ ĐỘNG CHO ATTITUDE (20%) - THANG 1-100
    // =========================================================================
    var autoAttScore = 96;
    if (mb.Role === 'Team Lead') autoAttScore = 98;
    else if (mb.Role === 'Annotator + QC') autoAttScore = 96;
    
    if (absentCount > 0) autoAttScore -= (absentCount * 20);
    if (demeanorFailCount > 0) autoAttScore -= (demeanorFailCount * 12);
    if (leaveCount > 0) autoAttScore -= (leaveCount * 3);
    if (halfLeaveCount > 0) autoAttScore -= (halfLeaveCount * 2);
    if (presentCount >= 5 && absentCount === 0 && demeanorFailCount === 0) autoAttScore += 2;
    autoAttScore = Math.max(30, Math.min(100, Math.round(autoAttScore)));

    var attLevelObj = classifyEvaluationScore(autoAttScore);
    var autoAttReason = '';
    if (autoAttScore >= 90) {
      autoAttReason = 'Chủ động tự xác định vấn đề, đề xuất giải pháp và hỗ trợ, dẫn dắt người khác; tác phong gương mẫu, đúng giờ.';
    } else if (autoAttScore >= 80) {
      autoAttReason = 'Chủ động cao, tự học nhanh, đề xuất cải tiến trong phạm vi công việc; chấp hành nghiêm quy trình.';
    } else if (autoAttScore >= 70) {
      autoAttReason = 'Chủ động nhận việc, tự tìm hiểu, thích ứng tốt với quy trình; đảm bảo ngày công.';
    } else if (autoAttScore >= 50) {
      var rParts = [];
      if (leaveCount > 0) rParts.push('nghỉ phép ' + leaveCount + ' buổi có báo trước');
      if (demeanorFailCount > 0) rParts.push('nhắc nhở tác phong ' + demeanorFailCount + ' lần');
      autoAttReason = 'Thực hiện khi được yêu cầu, đạt yêu cầu cơ bản, cần được nhắc nhở' + (rParts.length > 0 ? ' (' + rParts.join(', ') + ')' : '') + '.';
    } else {
      autoAttReason = 'Thụ động, chờ giao việc, không thích ứng với quy trình' + (absentCount > 0 ? ' (Vắng mặt không phép ' + absentCount + ' ngày)' : '') + '.';
    }

    var finalAttScore = autoAttScore;
    var finalAttReason = autoAttReason;
    var isAttCustom = false;
    if (savedCustom && savedCustom.attitude && savedCustom.attitude[mb.MemberID]) {
      var ca = savedCustom.attitude[mb.MemberID];
      if (typeof ca.score === 'number') finalAttScore = ca.score;
      if (ca.reason) finalAttReason = ca.reason;
      isAttCustom = true;
    }
    var finalAttClassObj = classifyEvaluationScore(finalAttScore);

    // =========================================================================
    // B. TÍNH ĐIỂM TỰ ĐỘNG CHO SKILL (50%) - THANG 1-100
    // =========================================================================
    var autoSkillScore = 80;
    if (targetRatio >= 115) {
      autoSkillScore = Math.min(100, Math.round(90 + (targetRatio - 115) * 0.4));
    } else if (targetRatio >= 100) {
      autoSkillScore = Math.round(80 + (targetRatio - 100) * 0.6);
    } else if (targetRatio >= 85) {
      autoSkillScore = Math.round(70 + (targetRatio - 85) * 0.6);
    } else if (targetRatio >= 50) {
      autoSkillScore = Math.round(50 + (targetRatio - 50) * 0.57);
    } else {
      autoSkillScore = Math.max(30, Math.round(targetRatio * 0.8));
    }
    autoSkillScore = Math.max(30, Math.min(100, Math.round(autoSkillScore)));

    var autoSkillReason = '';
    if (autoSkillScore >= 90) {
      autoSkillReason = 'Output vượt kỳ vọng, tối ưu và đáng tin cậy, có thể mentor người khác (Hoàn thành ' + Math.round(targetRatio) + '% target, năng suất ' + productivity + ' task/h).';
    } else if (autoSkillScore >= 80) {
      autoSkillReason = 'Output chất lượng cao, chủ động xử lý vấn đề phát sinh, ít phụ thuộc hỗ trợ (Đạt ' + Math.round(targetRatio) + '% target, năng suất ' + productivity + ' task/h).';
    } else if (autoSkillScore >= 70) {
      autoSkillReason = 'Output đạt yêu cầu, ít cần sửa, biết tự khắc phục đa số lỗi (Đạt ' + Math.round(targetRatio) + '% target tuần).';
    } else if (autoSkillScore >= 50) {
      autoSkillReason = 'Output đạt cơ bản nhưng cần review nhiều lần (Đạt ' + Math.round(targetRatio) + '% target, cần đẩy nhanh tiến độ).';
    } else {
      autoSkillReason = 'Output không đạt, cần hướng dẫn chi tiết từng bước (Chỉ đạt ' + Math.round(targetRatio) + '% target tuần).';
    }

    var finalSkillScore = autoSkillScore;
    var finalSkillReason = autoSkillReason;
    var isSkillCustom = false;
    if (savedCustom && savedCustom.skill && savedCustom.skill[mb.MemberID]) {
      var cs = savedCustom.skill[mb.MemberID];
      if (typeof cs.score === 'number') finalSkillScore = cs.score;
      if (cs.reason) finalSkillReason = cs.reason;
      isSkillCustom = true;
    }
    var finalSkillClassObj = classifyEvaluationScore(finalSkillScore);

    // =========================================================================
    // C. TÍNH ĐIỂM TỰ ĐỘNG CHO OUTPUT (30%) - THANG 1-100
    // =========================================================================
    var autoOutputScore = 80;
    if (avgAccuracy >= 98 && errorCount <= 1 && criticalCount === 0) {
      autoOutputScore = Math.min(100, Math.round(92 + (avgAccuracy - 98) * 4));
    } else if (avgAccuracy >= 95 && errorCount <= 3 && criticalCount === 0) {
      autoOutputScore = Math.round(80 + (avgAccuracy - 95) * 3);
    } else if (avgAccuracy >= 90 && errorCount <= 6) {
      autoOutputScore = Math.round(70 + (avgAccuracy - 90) * 1.8);
    } else if (avgAccuracy >= 75) {
      autoOutputScore = Math.round(50 + (avgAccuracy - 75) * 1.25);
    } else {
      autoOutputScore = Math.max(30, Math.round(avgAccuracy * 0.55));
    }
    if (criticalCount > 0) autoOutputScore = Math.min(65, autoOutputScore - (criticalCount * 15));
    autoOutputScore = Math.max(30, Math.min(100, Math.round(autoOutputScore)));

    var autoOutputReason = '';
    if (autoOutputScore >= 90) {
      autoOutputReason = 'Chuẩn chuyên nghiệp, có thể bàn giao dùng ngay, rất đáng tin cậy (Accuracy ' + avgAccuracy.toFixed(1) + '%, ' + (errorCount === 0 ? 'không lỗi' : errorCount + ' lỗi') + ').';
    } else if (autoOutputScore >= 80) {
      autoOutputReason = 'Chất lượng ổn định cao, chủ động kiểm thử, ít lỗi khi bàn giao (Accuracy ' + avgAccuracy.toFixed(1) + '%, ' + errorCount + ' lỗi).';
    } else if (autoOutputScore >= 70) {
      autoOutputReason = 'Ổn định, đúng hạn, tự review trước khi bàn giao (Accuracy ' + avgAccuracy.toFixed(1) + '%, đúng tiến độ).';
    } else if (autoOutputScore >= 50) {
      autoOutputReason = 'Đạt cơ bản nhưng thiếu chi tiết, cần nhắc nhở về tiến độ và kiểm tra kỹ hơn (Accuracy ' + avgAccuracy.toFixed(1) + '%, ' + errorCount + ' lỗi).';
    } else {
      autoOutputReason = 'Lỗi nhiều, không tự review, trễ deadline (Accuracy ' + avgAccuracy.toFixed(1) + '%' + (criticalCount > 0 ? ', có lỗi nghiêm trọng' : '') + ').';
    }

    var finalOutputScore = autoOutputScore;
    var finalOutputReason = autoOutputReason;
    var isOutputCustom = false;
    if (savedCustom && savedCustom.output && savedCustom.output[mb.MemberID]) {
      var co = savedCustom.output[mb.MemberID];
      if (typeof co.score === 'number') finalOutputScore = co.score;
      if (co.reason) finalOutputReason = co.reason;
      isOutputCustom = true;
    }
    var finalOutputClassObj = classifyEvaluationScore(finalOutputScore);

    // =========================================================================
    // D. ĐIỂM TỔNG HỢP (OVERALL 100%) = ATT 20% + SKILL 50% + OUTPUT 30%
    // =========================================================================
    var overallScore = Math.round(finalAttScore * 0.2 + finalSkillScore * 0.5 + finalOutputScore * 0.3);
    var overallClassObj = classifyEvaluationScore(overallScore);
    var overallReason = 'Attitude: ' + finalAttScore + ' (' + finalAttClassObj.level + ') · Skill: ' + finalSkillScore + ' (' + finalSkillClassObj.level + ') · Output: ' + finalOutputScore + ' (' + finalOutputClassObj.level + ').';

    // Thống kê tổng
    totalAttSum += finalAttScore;
    totalSkillSum += finalSkillScore;
    totalOutputSum += finalOutputScore;
    totalOverallSum += overallScore;

    if (finalAttScore >= 70) attGoodCount++;
    if (finalSkillScore >= 70) skillGoodCount++;
    if (finalOutputScore >= 70) outputGoodCount++;
    if (overallScore >= 70) overallGoodCount++;

    var memberBase = {
      memberId: mb.MemberID,
      memberName: mb.FullName,
      role: mb.Role,
      initials: getMemberInitials(mb.FullName)
    };

    attList.push(Object.assign({}, memberBase, {
      score: finalAttScore,
      classification: finalAttClassObj.level,
      bracket: finalAttClassObj.bracket,
      badgeClass: finalAttClassObj.badgeClass,
      fillClass: finalAttClassObj.fillClass,
      borderClass: finalAttClassObj.borderClass,
      color: finalAttClassObj.color,
      reason: finalAttReason,
      isCustom: isAttCustom,
      stats: {
        presentCount: presentCount,
        leaveCount: leaveCount,
        absentCount: absentCount,
        demeanorFailCount: demeanorFailCount
      }
    }));

    skillList.push(Object.assign({}, memberBase, {
      score: finalSkillScore,
      classification: finalSkillClassObj.level,
      bracket: finalSkillClassObj.bracket,
      badgeClass: finalSkillClassObj.badgeClass,
      fillClass: finalSkillClassObj.fillClass,
      borderClass: finalSkillClassObj.borderClass,
      color: finalSkillClassObj.color,
      reason: finalSkillReason,
      isCustom: isSkillCustom,
      stats: {
        output: totalOutput,
        target: totalTarget,
        targetRatio: Math.round(targetRatio),
        productivity: productivity
      }
    }));

    outputList.push(Object.assign({}, memberBase, {
      score: finalOutputScore,
      classification: finalOutputClassObj.level,
      bracket: finalOutputClassObj.bracket,
      badgeClass: finalOutputClassObj.badgeClass,
      fillClass: finalOutputClassObj.fillClass,
      borderClass: finalOutputClassObj.borderClass,
      color: finalOutputClassObj.color,
      reason: finalOutputReason,
      isCustom: isOutputCustom,
      stats: {
        accuracy: avgAccuracy.toFixed(1),
        errorCount: errorCount,
        criticalCount: criticalCount
      }
    }));

    overallList.push(Object.assign({}, memberBase, {
      score: overallScore,
      classification: overallClassObj.level,
      bracket: overallClassObj.bracket,
      badgeClass: overallClassObj.badgeClass,
      fillClass: overallClassObj.fillClass,
      borderClass: overallClassObj.borderClass,
      color: overallClassObj.color,
      reason: overallReason,
      attScore: finalAttScore,
      attClass: finalAttClassObj.level,
      skillScore: finalSkillScore,
      skillClass: finalSkillClassObj.level,
      outputScore: finalOutputScore,
      outputClass: finalOutputClassObj.level
    }));
  }

  // Sắp xếp giảm dần và gán thứ hạng cho từng danh mục
  function sortAndRank(list) {
    list.sort(function(a, b) { return b.score - a.score; });
    for (var i = 0; i < list.length; i++) {
      list[i].rank = i + 1;
      list[i].rankStr = (i + 1 < 10 ? '0' : '') + (i + 1);
    }
  }

  sortAndRank(attList);
  sortAndRank(skillList);
  sortAndRank(outputList);
  sortAndRank(overallList);

  var totalCount = members.length || 1;
  var user = getCurrentUser();

  // Bảng thang đánh giá tham chiếu chuẩn hóa nguyên văn từ form VinFast
  var referenceMatrix = [
    {
      category: 'Attitude - Thái độ, tinh thần chủ động, khả năng thích ứng (20%)',
      weight: '20%',
      below50: 'Thụ động, chờ giao việc, không thích ứng với quy trình.',
      c50_69: 'Thực hiện khi được yêu cầu, đạt câu hỏi cơ bản, cần được nhắc nhở.',
      c70_79: 'Chủ động nhận việc, tự tìm hiểu, thích ứng tốt với quy trình.',
      c80_89: 'Chủ động cao, tự học nhanh, đề xuất cải tiến trong phạm vi công việc.',
      c90_100: 'Chủ động tự xác định vấn đề, đề xuất giải pháp và hỗ trợ, dẫn dắt người khác.'
    },
    {
      category: 'Skill - Năng lực chuyên môn và thực hiện công việc (50%)',
      weight: '50%',
      below50: 'Output không đạt, cần hướng dẫn chi tiết từng bước.',
      c50_69: 'Output đạt cơ bản nhưng cần review nhiều lần.',
      c70_79: 'Output đạt yêu cầu, ít cần sửa, biết tự khắc phục đa số lỗi.',
      c80_89: 'Output chất lượng cao, chủ động xử lý vấn đề phát sinh, ít phụ thuộc hỗ trợ.',
      c90_100: 'Output vượt kỳ vọng, tối ưu và đáng tin cậy, có thể mentor người khác.'
    },
    {
      category: 'Output - Chất lượng kết quả công việc và độ tin cậy (30%)',
      weight: '30%',
      below50: 'Lỗi nhiều, không tự review, trễ deadline.',
      c50_69: 'Đạt cơ bản nhưng thiếu chi tiết, cần nhắc nhở về tiến độ.',
      c70_79: 'Ổn định, đúng hạn, tự review trước khi bàn giao.',
      c80_89: 'Chất lượng ổn định cao, chủ động kiểm thử, ít lỗi khi bàn giao.',
      c90_100: 'Chuẩn chuyên nghiệp, có thể bàn giao dùng ngay, rất đáng tin cậy.'
    }
  ];

  var avgAttStr = (totalAttSum / totalCount).toFixed(1).replace('.', ',');
  var avgSkillStr = (totalSkillSum / totalCount).toFixed(1).replace('.', ',');
  var avgOutputStr = (totalOutputSum / totalCount).toFixed(1).replace('.', ',');
  var avgOverallStr = (totalOverallSum / totalCount).toFixed(1).replace('.', ',');

  return {
    success: true,
    weekFrom: fromStr,
    weekTo: toStr,
    weekLabel: 'Tuần ' + formatDateVietnamese(fromStr) + ' - ' + formatDateVietnamese(toStr),
    displayRange: formatDateVietnamese(fromStr) + ' - ' + formatDateVietnamese(toStr),
    periodKey: comprehensivePeriodKey,
    legacyPeriodKey: periodKey,
    isSaved: !!savedCustom,
    teamLead: settings.TeamLeadName || user.name || 'Nguyễn Tiến Sỹ',
    mentor: settings.MentorName || 'Vũ Trọng Duyệt',
    teamName: settings.TeamName || 'VINFAST · TEAM T1 3D LIDAR',
    referenceMatrix: referenceMatrix,

    // Cấu trúc 4 nhóm đánh giá chuyên sâu
    attitude: {
      key: 'attitude',
      title: 'Attitude - Thái độ, tinh thần chủ động, khả năng thích ứng',
      shortTitle: 'Attitude (20%)',
      weightText: '20%',
      avgTeamScore: avgAttStr,
      completedOnTimeRatio: attGoodCount + '/' + totalCount,
      desc: 'Thang điểm 1–100 · L3 (90–100) · L2 (70–89: gồm 70–79 & 80–89) · L1 (50–69) · Dưới 50 (< L1). Căn cứ: Đúng giờ, nghỉ có phép và báo trước, Complete đúng deadline, chủ động hỗ trợ nhóm.',
      members: attList
    },
    skill: {
      key: 'skill',
      title: 'Skill - Năng lực chuyên môn và thực hiện công việc',
      shortTitle: 'Skill (50%)',
      weightText: '50%',
      avgTeamScore: avgSkillStr,
      completedOnTimeRatio: skillGoodCount + '/' + totalCount,
      desc: 'Thang điểm 1–100 · L3 (90–100) · L2 (70–89: gồm 70–79 & 80–89) · L1 (50–69) · Dưới 50 (< L1). Căn cứ: Năng lực chuyên môn, % hoàn thành Target tuần, năng suất/h và khả năng tự khắc phục lỗi.',
      members: skillList
    },
    output: {
      key: 'output',
      title: 'Output - Chất lượng kết quả công việc và độ tin cậy',
      shortTitle: 'Output (30%)',
      weightText: '30%',
      avgTeamScore: avgOutputStr,
      completedOnTimeRatio: outputGoodCount + '/' + totalCount,
      desc: 'Thang điểm 1–100 · L3 (90–100) · L2 (70–89: gồm 70–79 & 80–89) · L1 (50–69) · Dưới 50 (< L1). Căn cứ: Chất lượng bàn giao, độ chính xác Accuracy (%), kiểm thử tự review và bảo đảm tiến độ.',
      members: outputList
    },
    overall: {
      key: 'overall',
      title: 'Tổng Hợp Đánh Giá Năng Lực Thành Viên OJT / TTS',
      shortTitle: 'Tổng Hợp (100%)',
      weightText: '100%',
      avgTeamScore: avgOverallStr,
      completedOnTimeRatio: overallGoodCount + '/' + totalCount,
      desc: 'Công thức tính: Điểm Tổng Hợp = (Attitude × 20%) + (Skill × 50%) + (Output × 30%). Xếp loại: L3 (90–100) · L2 (70–89) · L1 (50–69) · Dưới 50 (< L1).',
      members: overallList
    },

    // Trường tương thích ngược
    avgTeamScore: avgAttStr,
    completedOnTimeRatio: attGoodCount + '/' + totalCount,
    members: attList
  };
}

/**
 * Lưu đánh giá Năng lực (Attitude, Skill, Output) tùy chỉnh của Team Lead
 * @param {string} periodKey (ví dụ 'EVALUATION_WEEK_2026-10-19' hoặc 'ATTITUDE_WEEK_2026-10-19')
 * @param {Object} evalPayload Object chứa { attitude: {...}, skill: {...}, output: {...} } hoặc dạng cũ
 */
function saveAttitudeEvaluation(periodKey, evalPayload) {
  checkQaOrAdmin(); // Team Lead hoặc QC đều có quyền lưu
  if (!periodKey) return { success: false, message: 'Thiếu mã tuần để lưu!' };

  var val = JSON.stringify(evalPayload || {});
  var obj = {};
  obj[periodKey] = val;

  // Đồng bộ cả 2 khóa để tương thích ngược 100%
  if (periodKey.indexOf('EVALUATION_WEEK_') === 0) {
    var legacyKey = periodKey.replace('EVALUATION_WEEK_', 'ATTITUDE_WEEK_');
    obj[legacyKey] = val;
  } else if (periodKey.indexOf('ATTITUDE_WEEK_') === 0) {
    var newKey = periodKey.replace('ATTITUDE_WEEK_', 'EVALUATION_WEEK_');
    obj[newKey] = val;
  }

  saveSettings(obj);

  return {
    success: true,
    message: 'Đã lưu đánh giá Năng Lực (Attitude - Skill - Output) thành công!'
  };
}

/**
 * Khôi phục lại đánh giá tự động từ Điểm Danh & KPI & Nhật ký lỗi
 * @param {string} periodKey
 */
function resetAttitudeEvaluation(periodKey) {
  checkQaOrAdmin();
  if (!periodKey) return { success: false, message: 'Thiếu mã tuần để khôi phục!' };

  var obj = {};
  obj[periodKey] = '';
  if (periodKey.indexOf('EVALUATION_WEEK_') === 0) {
    obj[periodKey.replace('EVALUATION_WEEK_', 'ATTITUDE_WEEK_')] = '';
  } else if (periodKey.indexOf('ATTITUDE_WEEK_') === 0) {
    obj[periodKey.replace('ATTITUDE_WEEK_', 'EVALUATION_WEEK_')] = '';
  }

  saveSettings(obj);

  return {
    success: true,
    message: 'Đã khôi phục đánh giá tự động từ Điểm Danh & KPI & Lỗi!'
  };
}
