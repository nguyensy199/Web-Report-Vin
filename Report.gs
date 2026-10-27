/**
 * ============================================================================
 * REPORT.GS - BÁO CÁO NGÀY, BÁO CÁO TUẦN ĐỘC LẬP & TỰ ĐỘNG HÓA
 * Hệ thống Quản Lý Team Data Annotation
 * ============================================================================
 * Đặc tả yêu cầu:
 * - Mỗi tuần là 1 báo cáo và 1 dashboard độc lập (không gộp dồn).
 * - Tự động sinh văn bản tóm tắt điều hành 3-5 dòng từ số liệu.
 * - Tự động đề xuất hành động: coaching 1-1 cho người dưới target, training cho lỗi lặp.
 * - Xuất file Google Sheet mới tinh định dạng đẹp.
 * - Trigger tự động 18:00 kiểm tra ai chưa nhập số liệu ngày và gửi nhắc nhở.
 */

// ============================================================================
// 1. DANH SÁCH CÁC TUẦN (PHỤC VỤ CHỌN TUẦN ĐỘC LẬP)
// ============================================================================

/**
 * Lấy danh sách các tuần có dữ liệu trong hệ thống (sắp xếp mới nhất lên đầu)
 * Hỗ trợ các tuần do người dùng tự tạo mới
 * @returns {Array<Object>} Danh sách tuần { weekLabel, fromStr, toStr, isCurrent }
 */
function getAvailableWeeks() {
  var weeksMap = {};
  var now = new Date();
  var currWeek = getWeekRangeFromDate(now);

  weeksMap[currWeek.fromStr] = {
    weekLabel: 'Tuần này (' + formatDateVietnamese(currWeek.fromStr).substring(0, 5) + ' - ' + formatDateVietnamese(currWeek.toStr).substring(0, 5) + ')',
    fromStr: currWeek.fromStr,
    toStr: currWeek.toStr,
    isCurrent: true
  };

  try {
    var prevWeekRef = new Date(currWeek.from.getTime() - 2 * 24 * 3600 * 1000);
    var prevWeek = getWeekRangeFromDate(prevWeekRef);
    weeksMap[prevWeek.fromStr] = {
      weekLabel: 'Tuần trước (' + formatDateVietnamese(prevWeek.fromStr).substring(0, 5) + ' - ' + formatDateVietnamese(prevWeek.toStr).substring(0, 5) + ')',
      fromStr: prevWeek.fromStr,
      toStr: prevWeek.toStr,
      isCurrent: false
    };
  } catch(e) {}

  // Đọc các tuần do người dùng tự tạo trong Settings nếu có
  try {
    var settings = getSettings();
    if (settings && settings.CUSTOM_WEEKS_LIST) {
      var customWeeks = JSON.parse(settings.CUSTOM_WEEKS_LIST);
      for (var c = 0; c < customWeeks.length; c++) {
        var cw = customWeeks[c];
        if (cw && cw.fromStr) {
          var dateRangeText = ' (' + formatDateVietnamese(cw.fromStr).substring(0, 5) + ' - ' + formatDateVietnamese(cw.toStr).substring(0, 5) + ')';
          var isCur = (cw.fromStr === currWeek.fromStr);
          cw.isCurrent = isCur;
          var baseLabel = cw.weekLabel || 'Tuần';
          if (baseLabel.indexOf('/') === -1) {
            cw.weekLabel = baseLabel + (isCur ? ' [Tuần này]' : '') + dateRangeText;
          }
          weeksMap[cw.fromStr] = cw;
        }
      }
    }
  } catch (e) {
    Logger.log('Lỗi đọc custom weeks: ' + e.message);
  }

  try {
    var logs = getSheetDataAsObjects(SHEETS.DAILY_LOGS);
    for (var i = 0; i < logs.length; i++) {
      var lDate = logs[i].Date;
      if (lDate) {
        var d = parseDateIso(lDate);
        var wRange = getWeekRangeFromDate(d);
        if (!weeksMap[wRange.fromStr]) {
          weeksMap[wRange.fromStr] = {
            weekLabel: 'Tuần ' + formatDateVietnamese(wRange.fromStr).substring(0, 5) + ' - ' + formatDateVietnamese(wRange.toStr).substring(0, 5),
            fromStr: wRange.fromStr,
            toStr: wRange.toStr,
            isCurrent: (wRange.fromStr === currWeek.fromStr)
          };
        }
      }
    }
  } catch (e) {
    Logger.log('Lỗi đọc DailyLogs weeks: ' + e.message);
  }

  var weekList = [];
  for (var key in weeksMap) {
    weekList.push(weeksMap[key]);
  }

  // Sắp xếp ngày giảm dần (mới nhất lên trên)
  weekList.sort(function(a, b) {
    return b.fromStr.localeCompare(a.fromStr);
  });

  return weekList;
}

/**
 * Tự tạo trang Dashboard mới theo tuần
 * @param {string} startDateStr Ngày bất kỳ trong tuần cần tạo (yyyy-MM-dd)
 * @param {string} customLabel Tên tuần tùy chọn
 */
function createNewWeekDashboard(startDateStr, customLabel) {
  if (!startDateStr) {
    return { success: false, message: 'Vui lòng chọn ngày để tạo tuần mới!' };
  }

  var refDate = parseDateIso(startDateStr);
  var wRange = getWeekRangeFromDate(refDate);

  var dateRangeText = ' (' + formatDateVietnamese(wRange.fromStr).substring(0, 5) + ' - ' + formatDateVietnamese(wRange.toStr).substring(0, 5) + ')';
  var finalLabel = '';
  if (customLabel && customLabel.trim()) {
    var cTrim = customLabel.trim();
    if (cTrim.indexOf('/') === -1) {
      finalLabel = cTrim + dateRangeText;
    } else {
      finalLabel = cTrim;
    }
  } else {
    finalLabel = 'Tuần' + dateRangeText;
  }

  var newWeekObj = {
    weekLabel: finalLabel,
    fromStr: wRange.fromStr,
    toStr: wRange.toStr,
    isCurrent: false
  };

  // Lưu vào Sheet Settings
  var settings = getSettings();
  var customWeeks = [];
  if (settings.CUSTOM_WEEKS_LIST) {
    try {
      customWeeks = JSON.parse(settings.CUSTOM_WEEKS_LIST);
    } catch (e) {
      customWeeks = [];
    }
  }

  // Kiểm tra nếu tuần này đã có thì cập nhật label
  var existed = false;
  for (var i = 0; i < customWeeks.length; i++) {
    if (customWeeks[i].fromStr === wRange.fromStr) {
      customWeeks[i].weekLabel = finalLabel;
      existed = true;
      break;
    }
  }
  if (!existed) {
    customWeeks.push(newWeekObj);
  }

  saveSettings({ CUSTOM_WEEKS_LIST: JSON.stringify(customWeeks) });

  return {
    success: true,
    message: 'Đã tạo Dashboard ' + finalLabel + ' thành công!',
    week: newWeekObj,
    availableWeeks: getAvailableWeeks()
  };
}

// ============================================================================
// 2. BÁO CÁO NGÀY TỰ ĐỘNG (DAILY REPORT)
// ============================================================================

/**
 * Phân tích lỗi theo quy luật Pareto 80/20 và trích xuất giải pháp/guideline
 * @param {Array} errorsList Danh sách các bản ghi lỗi
 * @return {Array} Danh sách loại lỗi sắp xếp giảm dần kèm thống kê chi tiết
 */
function analyzeTopErrors(errorsList) {
  var allCategories = getSheetDataAsObjects(SHEETS.ERROR_CATEGORIES);
  var catMetaMap = {};
  for (var ci = 0; ci < allCategories.length; ci++) {
    var cat = allCategories[ci];
    catMetaMap[cat.CategoryName] = cat;
  }

  var catCounts = {};
  var catMembers = {};

  for (var e = 0; e < errorsList.length; e++) {
    var err = errorsList[e];
    var c = err.CategoryName || 'Khác';
    catCounts[c] = (catCounts[c] || 0) + 1;

    if (!catMembers[c]) catMembers[c] = {};
    var mName = err.MemberName || err.MemberID || 'Ẩn danh';
    catMembers[c][mName] = (catMembers[c][mName] || 0) + 1;
  }

  var totalErrors = errorsList.length;
  var sortedErrors = [];

  for (var cName in catCounts) {
    var count = catCounts[cName];
    var pct = totalErrors > 0 ? parseFloat((count / totalErrors * 100).toFixed(1)) : 0;

    // Tìm thành viên gặp nhiều nhất
    var topMemName = 'Không có';
    var maxMemCount = 0;
    for (var mem in catMembers[cName]) {
      if (catMembers[cName][mem] > maxMemCount) {
        maxMemCount = catMembers[cName][mem];
        topMemName = mem;
      }
    }
    var topMemStr = maxMemCount > 0 ? (topMemName + ' (' + maxMemCount + ' lần)') : 'N/A';

    var meta = catMetaMap[cName] || {};
    var severity = meta.Severity || 'Medium';
    var guideline = meta.Description || ('Rà soát kỹ đối tượng, đo đạc bounding box chuẩn xác theo tiêu chuẩn ' + cName);

    sortedErrors.push({
      rank: 0,
      category: cName,
      count: count,
      percentage: pct + '%',
      percentNum: pct,
      topMember: topMemStr,
      severity: severity,
      guideline: guideline
    });
  }

  sortedErrors.sort(function(a, b) { return b.count - a.count; });
  for (var i = 0; i < sortedErrors.length; i++) {
    sortedErrors[i].rank = i + 1;
  }

  return sortedErrors;
}

/**
 * Tạo chi tiết báo cáo ngày
 * @param {string} dateStr Ngày cần báo cáo (yyyy-MM-dd)
 */
function generateDailyReportDetails(dateStr) {
  dateStr = dateStr || Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');

  // Tính ngày hôm trước để so sánh tăng/giảm
  var currDateObj = parseDateIso(dateStr);
  var prevDateObj = new Date(currDateObj.getTime() - 24 * 3600 * 1000);
  var prevDateStr = Utilities.formatDate(prevDateObj, TIMEZONE, 'yyyy-MM-dd');

  var allLogs = getSheetDataAsObjects(SHEETS.DAILY_LOGS);
  var allErrors = getSheetDataAsObjects(SHEETS.ERROR_LOGS);
  var members = getMembers(true);
  var settings = getSettings();
  var teamName = settings.TeamName || 'VIN-ANNOTATION';

  var dayLogs = allLogs.filter(function(l) { return l.Date === dateStr; });
  var prevLogs = allLogs.filter(function(l) { return l.Date === prevDateStr; });
  var dayErrors = allErrors.filter(function(e) { return e.Date === dateStr && e.Status !== 'Đã huỷ'; });

  // Lấy dữ liệu điểm danh trong ngày
  var allDayAttendance = getSheetDataAsObjects(SHEETS.ATTENDANCE);
  var dayAttList = allDayAttendance.filter(function(a) {
    var aDate = a.Date ? String(a.Date).substring(0, 10) : '';
    return aDate === dateStr;
  });
  var dayAttMap = {};
  for (var da = 0; da < dayAttList.length; da++) {
    dayAttMap[dayAttList[da].MemberID] = dayAttList[da].Status;
  }

  // 1. Tổng hợp số liệu ngày hiện tại
  var totalOutput = 0, totalTarget = 0, totalHours = 0, totalRework = 0;
  var memberRows = [];

  for (var m = 0; m < members.length; m++) {
    var mb = members[m];
    var mLog = dayLogs.find(function(l) { return l.MemberID === mb.MemberID; });

    var out = mLog ? parseFloat(mLog.Output || 0) : 0;
    var tgt = mLog ? parseFloat(mLog.TargetPerDay || mb.DailyTarget || 120) : parseFloat(mb.DailyTarget || 120);
    var hrs = mLog ? parseFloat(mLog.WorkHours || 0) : 0;
    var rwk = mLog ? parseFloat(mLog.ReworkCount || 0) : 0;
    var hasLogged = !!mLog;

    totalOutput += out;
    totalTarget += tgt;
    totalHours += hrs;
    totalRework += rwk;

    var pct = tgt > 0 ? (out / tgt * 100) : 0;
    var acc = out > 0 ? Math.max(0, (out - rwk) / out * 100) : 100;
    var prod = hrs > 0 ? parseFloat((out / hrs).toFixed(1)) : 0;

    // Đếm lỗi của thành viên trong ngày
    var mErrCount = dayErrors.filter(function(e) { return e.MemberID === mb.MemberID; }).length;

    // Trạng thái đi làm ngày
    var attStatus = dayAttMap[mb.MemberID] || (out > 0 ? 'Có mặt' : 'Chưa điểm danh');
    var workStatus = 'Đi làm';
    if (attStatus === 'Có mặt') workStatus = 'Đi làm';
    else if (attStatus === 'Đi muộn') workStatus = 'Đi muộn';
    else if (attStatus === 'Nghỉ phép') workStatus = 'Nghỉ phép';
    else if (attStatus === 'Nghỉ nửa ngày') workStatus = 'Nghỉ nửa ngày';
    else if (attStatus === 'Vắng mặt' || attStatus === 'Nghỉ không phép') workStatus = 'Vắng mặt';
    else if (out > 0) workStatus = 'Đi làm';
    else workStatus = 'Chưa điểm danh';

    // Nhiệm vụ chi tiết (từ nhật ký log nếu có)
    var taskDetail = (mLog && mLog.Note) ? mLog.Note : '';

    // Trạng thái job: 'Complete' hoặc 'Đang rework'
    var jobStatus = 'Đang rework';
    if (mLog && /hoàn thành|complete|xong/i.test(mLog.Note)) {
      jobStatus = 'Complete';
    } else if (out >= tgt && rwk === 0) {
      jobStatus = 'Complete';
    } else if (rwk > 0) {
      jobStatus = 'Đang rework';
    }

    memberRows.push({
      stt: m + 1,
      memberId: mb.MemberID,
      memberName: mb.FullName,
      role: mb.Role || 'Annotator',
      attendance: attStatus,
      attendanceTooltip: attStatus,
      workStatus: workStatus,
      taskDetail: taskDetail,
      jobStatus: jobStatus,
      fixedIds: '',
      qcEvaluation: '',
      output: out,
      target: tgt,
      targetCompletionRate: parseFloat(pct.toFixed(1)),
      hours: hrs,
      productivity: prod,
      accuracy: parseFloat(acc.toFixed(1)),
      rework: rwk,
      errorCount: rwk || mErrCount,
      hasLogged: hasLogged
    });
  }

  // Gán rank theo thứ tự
  for (var r = 0; r < memberRows.length; r++) {
    memberRows[r].rank = r + 1;
  }

  // 2. Số liệu hôm trước để so sánh
  var prevOutput = 0, prevTarget = 0, prevRework = 0;
  for (var p = 0; p < prevLogs.length; p++) {
    prevOutput += parseFloat(prevLogs[p].Output || 0);
    prevTarget += parseFloat(prevLogs[p].TargetPerDay || 0);
    prevRework += parseFloat(prevLogs[p].ReworkCount || 0);
  }

  var currTargetRate = totalTarget > 0 ? (totalOutput / totalTarget * 100) : 0;
  var prevTargetRate = prevTarget > 0 ? (prevOutput / prevTarget * 100) : 0;
  var currAccuracy = totalOutput > 0 ? Math.max(0, (totalOutput - totalRework) / totalOutput * 100) : 100;
  var prevAccuracy = prevOutput > 0 ? Math.max(0, (prevOutput - prevRework) / prevOutput * 100) : 100;

  var targetDiff = currTargetRate - prevTargetRate;
  var accDiff = currAccuracy - prevAccuracy;

  // 3. Tự động sinh văn bản tóm tắt điều hành 3-5 dòng
  var summaryText = generateExecutiveSummaryText({
    dateStr: dateStr,
    teamName: teamName,
    totalOutput: totalOutput,
    currTargetRate: currTargetRate,
    targetDiff: targetDiff,
    currAccuracy: currAccuracy,
    accDiff: accDiff,
    activeCount: dayLogs.length,
    totalMembers: members.length,
    dayErrorsCount: totalRework || dayErrors.length
  });

  // 4. Phân tích nguyên nhân Rework / Lỗi theo Pareto (80/20)
  var topErrors = analyzeTopErrors(dayErrors);

  // 5. Đề xuất hành động nhanh
  var recommendations = [];
  if (topErrors.length > 0) {
    recommendations.push({
      type: 'TRAINING',
      level: 'warning',
      text: 'Loại lỗi "' + topErrors[0].category + '" chiếm ' + topErrors[0].percentage + ' tổng lỗi ngày. ' + topErrors[0].guideline
    });
  }
  if (currTargetRate < 90) {
    recommendations.push({
      type: 'TARGET',
      level: 'danger',
      text: 'Tiến độ ngày chỉ đạt ' + currTargetRate.toFixed(1) + '% target. Cần rà soát các thành viên có năng suất thấp để hỗ trợ tháo gỡ khó khăn.'
    });
  } else {
    recommendations.push({
      type: 'MOTIVATION',
      level: 'success',
      text: 'Sản lượng toàn đội hoàn thành tốt (' + currTargetRate.toFixed(1) + '% target). Toàn đội tiếp tục duy trì nhịp độ ổn định!'
    });
  }

  return {
    success: true,
    reportMode: 'DAY',
    title: 'Báo Cáo Nghiệm Thu Ngày ' + formatDateVietnamese(dateStr) + ' – [' + teamName + ']',
    date: dateStr,
    displayDate: formatDateVietnamese(dateStr),
    teamName: teamName,
    summaryText: summaryText,
    overview: {
      totalOutput: totalOutput,
      totalTarget: totalTarget,
      targetCompletionRate: parseFloat(currTargetRate.toFixed(1)),
      accuracyRate: parseFloat(currAccuracy.toFixed(1)),
      avgProductivity: totalHours > 0 ? parseFloat((totalOutput / totalHours).toFixed(1)) : 0,
      totalHours: parseFloat(totalHours.toFixed(1)),
      totalErrorCount: totalRework,
      totalRework: totalRework
    },
    comparison: {
      targetRate: { diff: parseFloat(targetDiff.toFixed(1)) },
      accuracy: { diff: parseFloat(accDiff.toFixed(1)) }
    },
    rankings: memberRows,
    topErrors: topErrors,
    recommendations: recommendations
  };
}

/**
 * Tự động sinh văn bản điều hành thông minh
 */
function generateExecutiveSummaryText(params) {
  var lines = [];

  // Dòng 1: Tình hình sản lượng & target
  var targetWord = params.currTargetRate >= 100 ? 'xuất sắc đạt ' : (params.currTargetRate >= 90 ? 'đạt ' : 'chưa đạt, ghi nhận ');
  var targetTrend = params.targetDiff >= 0
    ? (' (tăng +' + params.targetDiff.toFixed(1) + '% so với hôm trước)')
    : (' (giảm ' + Math.abs(params.targetDiff).toFixed(1) + '% so với hôm trước)');

  lines.push('1. Toàn đội ' + params.teamName + ' hôm nay đã ' + targetWord + params.currTargetRate.toFixed(1) + '% target với tổng sản lượng ' + params.totalOutput.toLocaleString('vi-VN') + ' tasks' + targetTrend + '.');

  // Dòng 2: Chất lượng & Độ chính xác
  var accQuality = params.currAccuracy >= 97 ? 'ở mức rất cao' : (params.currAccuracy >= 95 ? 'đáp ứng tiêu chuẩn' : 'cần được cải thiện');
  var accTrend = params.accDiff >= 0
    ? (' (tăng +' + params.accDiff.toFixed(1) + '% so với hôm trước)')
    : (' (giảm ' + Math.abs(params.accDiff).toFixed(1) + '% so với hôm trước)');

  lines.push('2. Độ chính xác bình quân đạt ' + params.currAccuracy.toFixed(1) + '% (' + accQuality + ')' + accTrend + ', ghi nhận tổng cộng ' + params.dayErrorsCount + ' lỗi/rework phát sinh.');

  // Dòng 3: Tỷ lệ nhân sự tham gia & tuân thủ
  lines.push('3. Tỷ lệ nhân sự tham gia nhập số liệu đạt ' + params.activeCount + '/' + params.totalMembers + ' thành viên (' + Math.round(params.activeCount / params.totalMembers * 100) + '%).');

  // Dòng 4: Đề xuất hành động nhanh
  if (params.dayErrorsCount > 5) {
    lines.push('4. Lưu ý QA: Cần rà soát tập trung vào các lỗi phổ biến trong ngày và nhắc nhở thành viên chú ý kiểm tra trước khi submit.');
  } else {
    lines.push('4. Tiến độ ổn định, đề nghị toàn team duy trì phong độ cho phiên làm việc tiếp theo.');
  }

  return lines.join('\n\n');
}

// ============================================================================
// 3. BÁO CÁO TUẦN ĐỘC LẬP (WEEKLY REPORT)
// ============================================================================

/**
 * Tạo chi tiết báo cáo tuần độc lập
 * @param {string} weekDateOrStr Bất kỳ ngày nào trong tuần (yyyy-MM-dd)
 */
function generateWeeklyReportDetails(weekDateOrStr) {
  var refDate = weekDateOrStr ? parseDateIso(weekDateOrStr) : new Date();
  var currWeek = getWeekRangeFromDate(refDate);

  // Tuần trước để đối soát
  var prevWeekRef = new Date(currWeek.from.getTime() - 2 * 24 * 3600 * 1000);
  var prevWeek = getWeekRangeFromDate(prevWeekRef);

  var allLogs = getSheetDataAsObjects(SHEETS.DAILY_LOGS);
  var allErrors = getSheetDataAsObjects(SHEETS.ERROR_LOGS);
  var members = getMembers(true);
  var settings = getSettings();
  var teamName = settings.TeamName || 'VIN-ANNOTATION';

  // Lọc dữ liệu tuần hiện tại và tuần trước
  var weekLogs = allLogs.filter(function(l) { return l.Date >= currWeek.fromStr && l.Date <= currWeek.toStr; });
  var prevWeekLogs = allLogs.filter(function(l) { return l.Date >= prevWeek.fromStr && l.Date <= prevWeek.toStr; });
  var weekErrors = allErrors.filter(function(e) { return e.Date >= currWeek.fromStr && e.Date <= currWeek.toStr && e.Status !== 'Đã huỷ'; });

  // 1. Tổng quan số liệu tuần
  var currOverview = calculateMetricsSummary(weekLogs, weekErrors, members);
  var prevOverview = calculateMetricsSummary(prevWeekLogs, [], members);
  var comparison = calculateComparison(currOverview, prevOverview);

  // 2. Xu hướng từng ngày trong tuần (Thứ 2 -> CN)
  var dayTrend = [];
  var dCursor = new Date(currWeek.from.getTime());
  var dayNames = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'];

  for (var di = 0; di < 7; di++) {
    var dStr = Utilities.formatDate(dCursor, TIMEZONE, 'yyyy-MM-dd');
    var dLogs = weekLogs.filter(function(l) { return l.Date === dStr; });
    var dOut = 0, dTgt = 0, dRwk = 0;
    for (var k = 0; k < dLogs.length; k++) {
      dOut += parseFloat(dLogs[k].Output || 0);
      dTgt += parseFloat(dLogs[k].TargetPerDay || 0);
      dRwk += parseFloat(dLogs[k].ReworkCount || 0);
    }
    var dAcc = dOut > 0 ? Math.max(0, (dOut - dRwk) / dOut * 100) : 100;

    dayTrend.push({
      dayName: dayNames[di],
      date: dStr,
      displayDate: formatDateVietnamese(dStr).substring(0, 5),
      output: dOut,
      target: dTgt,
      accuracy: parseFloat(dAcc.toFixed(1))
    });

    dCursor.setDate(dCursor.getDate() + 1);
  }

  // 3. Bảng xếp hạng tuần & Tính Chuyên Cần qua từng ngày
  var rankingData = getRankingDetails('WEEK', currWeek.fromStr, 'COMPOSITE');

  // Lấy dữ liệu điểm danh từng ngày trong tuần đó
  var allAttendance = getSheetDataAsObjects(SHEETS.ATTENDANCE);
  var weekAtt = allAttendance.filter(function(a) {
    var aDate = a.Date ? String(a.Date).substring(0, 10) : '';
    return aDate >= currWeek.fromStr && aDate <= currWeek.toStr;
  });

  // Gom nhóm dữ liệu điểm danh theo từng thành viên
  var memberAttMap = {};
  for (var ai = 0; ai < weekAtt.length; ai++) {
    var at = weekAtt[ai];
    var mId = at.MemberID;
    if (!memberAttMap[mId]) {
      memberAttMap[mId] = { present: 0, late: 0, halfLeave: 0, leave: 0, absent: 0, days: {} };
    }
    var st = (at.Status || 'Có mặt').trim();
    if (st === 'Có mặt') memberAttMap[mId].present++;
    else if (st === 'Đi muộn') memberAttMap[mId].late++;
    else if (st === 'Nghỉ nửa ngày') memberAttMap[mId].halfLeave++;
    else if (st === 'Nghỉ phép') memberAttMap[mId].leave++;
    else if (st === 'Vắng mặt' || st === 'Nghỉ không phép') memberAttMap[mId].absent++;

    var aDateStr = at.Date ? String(at.Date).substring(0, 10) : '';
    memberAttMap[mId].days[aDateStr] = st;
  }

  // Số ngày làm việc có log thực tế trong tuần (dự phòng nếu chưa điểm danh)
  var memberLogDaysMap = {};
  for (var wli = 0; wli < weekLogs.length; wli++) {
    var wl = weekLogs[wli];
    if (parseFloat(wl.Output || 0) > 0) {
      if (!memberLogDaysMap[wl.MemberID]) memberLogDaysMap[wl.MemberID] = {};
      memberLogDaysMap[wl.MemberID][wl.Date] = true;
    }
  }

  // Tiêu chuẩn tuần: 6 ngày làm việc (Thứ 2 -> Thứ 7)
  var standardWorkDays = 6;

  for (var ri = 0; ri < rankingData.rankings.length; ri++) {
    var rMem = rankingData.rankings[ri];
    var memId = rMem.memberId;
    var attStat = memberAttMap[memId];

    // 3a. Cộng dồn sản lượng và chỉ tiêu từng ngày trong tuần của thành viên từ weekLogs
    var mLogs = weekLogs.filter(function(l) { return l.MemberID === memId; });
    var sumOut = 0;
    var sumTgt = 0;
    var sumHrs = 0;
    var sumRwk = 0;

    var mbInfo = members.find(function(m) { return m.MemberID === memId; });
    var defaultDailyTarget = mbInfo ? parseFloat(mbInfo.DailyTarget || 20) : 20;

    for (var ml = 0; ml < mLogs.length; ml++) {
      var logOut = parseFloat(mLogs[ml].Output || 0);
      var logTgt = parseFloat(mLogs[ml].TargetPerDay || 0);
      if (logTgt <= 0) logTgt = defaultDailyTarget;
      var logHrs = parseFloat(mLogs[ml].WorkHours || 0);
      var logRwk = parseFloat(mLogs[ml].ReworkCount || 0);

      sumOut += logOut;
      sumTgt += logTgt;
      sumHrs += logHrs;
      sumRwk += logRwk;
    }

    rMem.output = sumOut;
    rMem.target = sumTgt;
    rMem.hours = sumHrs;
    rMem.rework = sumRwk;
    rMem.targetCompletionRate = sumTgt > 0 ? parseFloat((sumOut / sumTgt * 100).toFixed(1)) : 0;
    rMem.productivity = sumHrs > 0 ? parseFloat((sumOut / sumHrs).toFixed(1)) : 0;

    var pCount = attStat ? attStat.present : 0;
    var lateCount = attStat ? (attStat.late || 0) : 0;
    var hCount = attStat ? attStat.halfLeave : 0;
    var lCount = attStat ? attStat.leave : 0;
    var aCount = attStat ? attStat.absent : 0;

    // Nếu chưa điểm danh qua sheet Attendance, fallback vào số ngày có log làm việc
    if (!attStat || (pCount === 0 && lateCount === 0 && hCount === 0 && lCount === 0 && aCount === 0)) {
      var logDays = memberLogDaysMap[memId] ? Object.keys(memberLogDaysMap[memId]).length : (rMem.totalDaysWithLogs || 0);
      pCount = logDays;
    }

    var effectiveDays = pCount + lateCount + (hCount * 0.5);
    var attRate = standardWorkDays > 0 ? Math.min(100, Math.round(effectiveDays / standardWorkDays * 100)) : 100;

    var detailParts = [];
    if (pCount > 0) detailParts.push('Có mặt: ' + pCount);
    if (lateCount > 0) detailParts.push('Đi muộn: ' + lateCount);
    if (hCount > 0) detailParts.push('Nửa ngày: ' + hCount);
    if (lCount > 0) detailParts.push('Phép: ' + lCount);
    if (aCount > 0) detailParts.push('Vắng: ' + aCount);

    var attTooltip = detailParts.length > 0 ? detailParts.join(' | ') : 'Chưa có dữ liệu';
    var attDisplay = effectiveDays + '/' + standardWorkDays + ' (' + attRate + '%)';

    rMem.attendance = attDisplay;
    rMem.attendanceRate = attRate;
    rMem.attendanceEffectiveDays = effectiveDays;
    rMem.attendanceTooltip = attTooltip;
  }

  // Sắp xếp lại thứ hạng theo sản lượng tuần giảm dần
  rankingData.rankings.sort(function(a, b) { return b.output - a.output; });
  for (var rkR = 0; rkR < rankingData.rankings.length; rkR++) {
    rankingData.rankings[rkR].rank = rkR + 1;
  }

  // Cập nhật lại tổng quan tuần từ tổng các thành viên
  var totalWeekOut = 0;
  var totalWeekTgt = 0;
  var totalWeekHrs = 0;
  var totalWeekRwk = 0;
  for (var wIdx = 0; wIdx < rankingData.rankings.length; wIdx++) {
    totalWeekOut += rankingData.rankings[wIdx].output;
    totalWeekTgt += rankingData.rankings[wIdx].target;
    totalWeekHrs += rankingData.rankings[wIdx].hours;
    totalWeekRwk += rankingData.rankings[wIdx].rework;
  }
  currOverview.totalOutput = totalWeekOut;
  currOverview.totalTarget = totalWeekTgt;
  currOverview.totalHours = totalWeekHrs;
  currOverview.totalRework = totalWeekRwk;
  currOverview.totalErrorCount = totalWeekRwk;
  currOverview.targetCompletionRate = totalWeekTgt > 0 ? parseFloat((totalWeekOut / totalWeekTgt * 100).toFixed(1)) : 0;
  currOverview.avgProductivity = totalWeekHrs > 0 ? parseFloat((totalWeekOut / totalWeekHrs).toFixed(1)) : 0;

  // 4. Phân tích nguyên nhân Rework / Lỗi theo Pareto (80/20)
  var topErrors = analyzeTopErrors(weekErrors);

  // 5. Đề xuất hành động tự động (Smart Action Recommendations)
  var recommendations = [];

  // Gợi ý đào tạo cho loại lỗi xuất hiện nhiều
  if (topErrors.length > 0 && topErrors[0].count >= 3) {
    recommendations.push({
      type: 'TRAINING',
      level: 'warning',
      text: 'Loại lỗi "' + topErrors[0].category + '" lặp lại nhiều (' + topErrors[0].count + ' lần, chiếm ' + topErrors[0].percentage + '). ' + topErrors[0].guideline
    });
  }

  // Gợi ý Coaching 1-1 cho thành viên dưới target hoặc accuracy thấp
  for (var rk = 0; rk < rankingData.rankings.length; rk++) {
    var rkItem = rankingData.rankings[rk];
    if (rkItem.targetCompletionRate < 85 && rkItem.totalDaysWithLogs >= 3) {
      recommendations.push({
        type: 'COACHING',
        level: 'danger',
        text: 'Thành viên ' + rkItem.memberName + ' đạt ' + rkItem.targetCompletionRate + '% target cả tuần. Đề xuất Team Lead thực hiện phiên Coaching 1-1 để tháo gỡ khó khăn thao tác.'
      });
    }
  }

  // 6. Khen thưởng tuần (Top 3)
  var topHonors = rankingData.rankings.slice(0, 3);

  return {
    success: true,
    reportMode: 'WEEK',
    title: 'Báo Cáo Tuần ' + formatDateVietnamese(currWeek.fromStr) + ' - ' + formatDateVietnamese(currWeek.toStr) + ' – [' + teamName + ']',
    weekRange: {
      from: currWeek.fromStr,
      to: currWeek.toStr,
      displayRange: formatDateVietnamese(currWeek.fromStr) + ' - ' + formatDateVietnamese(currWeek.toStr)
    },
    teamName: teamName,
    overview: currOverview,
    prevOverview: prevOverview,
    comparison: comparison,
    dayTrend: dayTrend,
    rankings: rankingData.rankings,
    topErrors: topErrors,
    recommendations: recommendations,
    topHonors: topHonors
  };
}

// ============================================================================
// 4. LƯU BÁO CÁO VÀO LỊCH SỬ (REPORT HISTORY)
// ============================================================================

/**
 * Cập nhật số lần Rework của một thành viên trong ngày
 * @param {string} dateStr yyyy-MM-dd
 * @param {string} memberId
 * @param {number} newRework
 */
function updateMemberDailyRework(dateStr, memberId, newRework) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = getSheet(SHEETS.DAILY_LOGS);
    var values = sheet.getDataRange().getValues();
    newRework = parseInt(newRework, 10) || 0;

    var foundRow = -1;
    for (var i = 1; i < values.length; i++) {
      var rowDate = values[i][1];
      var rowMem = values[i][2];
      if (rowMem == memberId && rowDate == dateStr) {
        foundRow = i + 1;
        break;
      }
    }

    if (foundRow > 0) {
      sheet.getRange(foundRow, 9).setValue(newRework); // Cột ReworkCount (cột 9)
      var out = parseFloat(values[foundRow - 1][5] || 0);
      var acc = out > 0 ? Math.max(0, (out - newRework) / out * 100) : 100;
      sheet.getRange(foundRow, 10).setValue(parseFloat(acc.toFixed(1))); // Cột Accuracy (cột 10)
    }

    return {
      success: true,
      message: 'Đã lưu số lần Rework ngày ' + dateStr + ' vào hệ thống!'
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Lưu bản ghi báo cáo vào Sheet ReportHistory
 */
function saveWeeklyReportRecord(reportData) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = getSheet(SHEETS.REPORT_HISTORY);
    var user = getCurrentUser();

    var isWeek = (reportData.reportMode !== 'DAY');
    var prefix = isWeek ? 'RPT_W_' : 'RPT_D_';
    var reportType = isWeek ? 'WEEKLY' : 'DAILY';
    var periodLabel = isWeek && reportData.weekRange ? reportData.weekRange.displayRange : (reportData.displayDate || reportData.date);

    var reportId = prefix + Utilities.formatDate(new Date(), TIMEZONE, 'yyMMddHHmmss');
    var nowStr = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss');

    var row = [
      reportId,
      reportType,
      periodLabel,
      reportData.title,
      JSON.stringify(reportData), // Lưu snapshot toàn bộ dữ liệu JSON để tái hiện
      reportData.managerNote || '',
      reportData.nextWeekPlan || '',
      user.name || user.email,
      nowStr
    ];

    sheet.appendRow(row);

    return {
      success: true,
      message: 'Đã lưu báo cáo vào lịch sử thành công! (Mã: ' + reportId + ')',
      reportId: reportId
    };
  } finally {
    lock.releaseLock();
  }
}

// ============================================================================
// 5. XUẤT EXCEL / GOOGLE SHEET MỚI TINH (EXPORT GOOGLE SHEET)
// ============================================================================

/**
 * Xuất báo cáo (Ngày hoặc Tuần) ra một Google Sheet mới tinh với định dạng chuyên nghiệp
 * @param {string} mode 'WEEK' hoặc 'DAY'
 * @param {string} periodVal Tuần (yyyy-MM-dd) hoặc Ngày (yyyy-MM-dd)
 * @param {Object} customData Dữ liệu báo cáo tùy chỉnh nếu người dùng đã sửa Rework
 */
function exportReportToSpreadsheet(mode, periodVal, customData) {
  mode = (mode || 'WEEK').toUpperCase();
  var isWeek = (mode === 'WEEK');

  var data = customData;
  if (!data) {
    data = isWeek ? generateWeeklyReportDetails(periodVal) : generateDailyReportDetails(periodVal);
  }

  var filePrefix = isWeek ? ('Bao_Cao_Tuan_' + (data.weekRange ? (data.weekRange.from + '_' + data.weekRange.to) : '')) : ('Bao_Cao_Ngay_' + (data.date || periodVal));
  var fileName = filePrefix + '_' + (data.teamName || 'VIN-ANNOTATION');

  var newSpreadsheet = SpreadsheetApp.create(fileName);
  var sheet = newSpreadsheet.getActiveSheet();

  // ==========================================================================
  // A. XUẤT BÁO CÁO NGÀY (THEO ĐÚNG MẪU 9 CỘT VINFAST ANNOTATION)
  // ==========================================================================
  if (!isWeek) {
    sheet.setName('Báo Cáo Ngày ' + (data.date || periodVal));
    sheet.getRange('A1:I100').setFontFamily('Google Sans');

    var dayHeaders = [
      'STT', 'Họ và tên', 'Vai trò', 'Trạng thái đi làm', 'Nhiệm vụ chi tiết', 'Số lần Rework', 'Trạng thái job', 'Số id đã sửa', 'Đánh giá QC'
    ];

    sheet.getRange(1, 1, 1, 9).setValues([dayHeaders])
      .setBackground('#17375e')
      .setFontColor('#ffffff')
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    sheet.setRowHeight(1, 32);

    var rows = [];
    var rankings = data.rankings || [];
    for (var i = 0; i < rankings.length; i++) {
      var rk = rankings[i];
      var rwkVal = (rk.rework !== undefined && rk.rework !== null && rk.rework !== '') ? rk.rework : (rk.errorCount || '');
      if (rwkVal === 0) rwkVal = ''; // Nếu 0 thì để trống giống mẫu
      
      rows.push([
        i + 1,
        rk.memberName,
        rk.role || 'Annotator',
        rk.workStatus || 'Đi làm',
        rk.taskDetail || '',
        rwkVal,
        rk.jobStatus || 'Đang rework',
        rk.fixedIds || '',
        rk.qcEvaluation || ''
      ]);
    }

    if (rows.length > 0) {
      var dataRange = sheet.getRange(2, 1, rows.length, 9);
      dataRange.setValues(rows);
      dataRange.setVerticalAlignment('middle');

      // Căn lề từng cột
      sheet.getRange(2, 1, rows.length, 1).setHorizontalAlignment('center'); // STT
      sheet.getRange(2, 2, rows.length, 1).setHorizontalAlignment('left');   // Họ tên
      sheet.getRange(2, 3, rows.length, 1).setHorizontalAlignment('center'); // Vai trò
      sheet.getRange(2, 4, rows.length, 1).setHorizontalAlignment('center'); // Trạng thái đi làm
      sheet.getRange(2, 5, rows.length, 1).setHorizontalAlignment('left').setWrap(true); // Nhiệm vụ chi tiết
      sheet.getRange(2, 6, rows.length, 1).setHorizontalAlignment('center'); // Số lần Rework
      sheet.getRange(2, 7, rows.length, 1).setHorizontalAlignment('center'); // Trạng thái job
      sheet.getRange(2, 8, rows.length, 1).setHorizontalAlignment('center'); // Số id đã sửa
      sheet.getRange(2, 9, rows.length, 1).setHorizontalAlignment('left').setWrap(true); // Đánh giá QC

      // Format màu nền cho cột Trạng thái job (Cột G)
      for (var rIdx = 0; rIdx < rows.length; rIdx++) {
        var jStatus = String(rows[rIdx][6] || '').trim().toLowerCase();
        var cellG = sheet.getRange(rIdx + 2, 7);
        if (jStatus === 'complete' || jStatus === 'hoàn thành') {
          cellG.setBackground('#e2efda').setFontColor('#375623').setFontWeight('bold');
        } else if (jStatus.indexOf('rework') !== -1) {
          cellG.setBackground('#d9e2f3').setFontColor('#1f4e78');
        }
        sheet.setRowHeight(rIdx + 2, 28);
      }

      // Viền kẻ bảng đầy đủ
      sheet.getRange(1, 1, rows.length + 1, 9).setBorder(true, true, true, true, true, true, '#b0bec5', SpreadsheetApp.BorderStyle.SOLID);
    }

    // Set độ rộng từng cột đúng tỷ lệ mẫu
    sheet.setColumnWidth(1, 55);   // STT
    sheet.setColumnWidth(2, 170);  // Họ và tên
    sheet.setColumnWidth(3, 110);  // Vai trò
    sheet.setColumnWidth(4, 130);  // Trạng thái đi làm
    sheet.setColumnWidth(5, 260);  // Nhiệm vụ chi tiết
    sheet.setColumnWidth(6, 110);  // Số lần Rework
    sheet.setColumnWidth(7, 130);  // Trạng thái job
    sheet.setColumnWidth(8, 110);  // Số id đã sửa
    sheet.setColumnWidth(9, 180);  // Đánh giá QC

    sheet.setFrozenRows(1);

    return {
      success: true,
      fileUrl: newSpreadsheet.getUrl(),
      fileName: fileName,
      message: 'Đã tạo file Google Sheet Báo Cáo Ngày thành công theo đúng mẫu!'
    };
  }

  // ==========================================================================
  // B. XUẤT BÁO CÁO TUẦN (11 CỘT TỔNG HỢP SẢN LƯỢNG & KPI & CHUYÊN CẦN)
  // ==========================================================================
  sheet.setName('Báo Cáo Tuần');

  // Thiết lập font chữ Google Sans
  sheet.getRange('A1:K180').setFontFamily('Google Sans');

  // Header Tiêu đề chính
  sheet.getRange('A1:K1').merge();
  sheet.getRange('A1').setValue(data.title.toUpperCase())
    .setFontSize(14).setFontWeight('bold')
    .setBackground('#1e293b').setFontColor('#ffffff')
    .setHorizontalAlignment('center');

  // Dòng Thông tin chung
  var periodStr = isWeek ? (data.weekRange ? data.weekRange.displayRange : '') : (data.displayDate || data.date);
  sheet.getRange('A3:D3').setValues([['Kỳ báo cáo:', periodStr, 'Đơn vị:', data.teamName || 'VIN-ANNOTATION']]).setFontWeight('bold');
  sheet.getRange('A4:D4').setValues([['Thời gian xuất:', Utilities.formatDate(new Date(), TIMEZONE, 'dd/MM/yyyy HH:mm:ss'), 'Đơn vị tính:', 'Cuboid']]);

  // Khối Thống kê tổng hợp (KPI)
  var targetLabel = isWeek ? 'Chỉ tiêu tuần (Cuboid)' : 'Chỉ tiêu ngày (Cuboid)';
  sheet.getRange('A6:F6').setValues([[
    'Tổng sản lượng (Cuboid)', targetLabel, '% Hoàn thành', 'Độ chính xác TB', 'Năng suất TB/h', 'Tổng Rework'
  ]]).setBackground('#2563eb').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');

  var totalRwk = data.overview.totalRework !== undefined ? data.overview.totalRework : (data.overview.totalErrorCount || 0);
  sheet.getRange('A7:F7').setValues([[
    data.overview.totalOutput,
    data.overview.totalTarget,
    data.overview.targetCompletionRate + '%',
    data.overview.accuracyRate + '%',
    data.overview.avgProductivity,
    totalRwk
  ]]).setHorizontalAlignment('center').setFontWeight('bold').setBackground('#f8fafc');

  // Khối Bảng Báo Cáo Chi Tiết Từng Thành Viên (11 cột - đã bỏ Accuracy)
  sheet.getRange('A9:K9').merge();
  sheet.getRange('A9').setValue('BÁO CÁO CHI TIẾT SẢN LƯỢNG & KPI TỪNG THÀNH VIÊN')
    .setFontWeight('bold').setBackground('#f1f5f9').setHorizontalAlignment('left');

  sheet.getRange('A10:K10').setValues([[
    'Hạng', 'Họ và tên', 'Vai trò', 'Chuyên cần', 'Sản lượng (Cuboid)', 'Chỉ tiêu (Target)', '% Hoàn thành', 'Giờ làm', 'Năng suất/h', 'Rework', 'Đánh giá'
  ]]).setBackground('#0f172a').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');

  var memberRows = [];
  var rankings = data.rankings || [];
  for (var i = 0; i < rankings.length; i++) {
    var r = rankings[i];
    var evalText = 'Đạt yêu cầu';
    if (r.targetCompletionRate >= 100) {
      evalText = 'Xuất sắc';
    } else if (r.targetCompletionRate < 85) {
      evalText = 'Dưới định mức';
    }

    var reworkVal = (r.rework !== undefined) ? r.rework : (r.errorCount || 0);
    var attVal = r.attendance || (isWeek ? '6/6 ngày (100%)' : 'Có mặt');

    memberRows.push([
      r.rank,
      r.memberName,
      r.role || 'Annotator',
      attVal,
      r.output,
      r.target,
      r.targetCompletionRate + '%',
      (r.hours ? r.hours.toFixed(1) : 0) + 'h',
      r.productivity,
      reworkVal,
      evalText
    ]);
  }

  var startRow = 11;
  if (memberRows.length > 0) {
    sheet.getRange(startRow, 1, memberRows.length, 11).setValues(memberRows);
    sheet.getRange(startRow, 1, memberRows.length, 1).setHorizontalAlignment('center');
    sheet.getRange(startRow, 3, memberRows.length, 2).setHorizontalAlignment('center');
    sheet.getRange(startRow, 5, memberRows.length, 2).setHorizontalAlignment('right').setNumberFormat('#,##0');
    sheet.getRange(startRow, 7, memberRows.length, 5).setHorizontalAlignment('center');

    // Viền khung
    sheet.getRange(10, 1, memberRows.length + 1, 11).setBorder(true, true, true, true, true, true);
    startRow += memberRows.length + 2;
  }

  // Khối Bảng Phân Tích Nguyên Nhân Rework / Lỗi Hàng Đầu (Pareto 80/20)
  sheet.getRange(startRow, 1, 1, 7).merge();
  sheet.getRange(startRow, 1).setValue('PHÂN TÍCH NGUYÊN NHÂN REWORK / LỖI HÀNG ĐẦU (PARETO 80/20)')
    .setFontWeight('bold').setBackground('#f1f5f9');
  startRow++;

  sheet.getRange(startRow, 1, 1, 7).setValues([[
    'Top', 'Loại lỗi / Category', 'Số ca phát sinh', 'Tỷ lệ Pareto (%)', 'Mức độ', 'Thành viên hay gặp', 'Giải pháp & Lưu ý Guideline'
  ]]).setBackground('#b91c1c').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
  startRow++;

  var errorRows = [];
  var topErrList = data.topErrors || [];
  for (var te = 0; te < topErrList.length; te++) {
    var errItem = topErrList[te];
    errorRows.push([
      errItem.rank || (te + 1),
      errItem.category,
      errItem.count,
      errItem.percentage,
      errItem.severity || 'Medium',
      errItem.topMember || 'N/A',
      errItem.guideline || ''
    ]);
  }

  if (errorRows.length > 0) {
    sheet.getRange(startRow, 1, errorRows.length, 7).setValues(errorRows);
    sheet.getRange(startRow, 1, errorRows.length, 1).setHorizontalAlignment('center');
    sheet.getRange(startRow, 3, errorRows.length, 3).setHorizontalAlignment('center');
    sheet.getRange(startRow - 1, 1, errorRows.length + 1, 7).setBorder(true, true, true, true, true, true);
    startRow += errorRows.length + 2;
  } else {
    sheet.getRange(startRow, 1, 1, 7).merge();
    sheet.getRange(startRow, 1).setValue('🎉 Không ghi nhận lỗi/rework nào trong kỳ báo cáo này!')
      .setHorizontalAlignment('center').setFontStyle('italic').setBackground('#f8fafc');
    sheet.getRange(startRow - 1, 1, 2, 7).setBorder(true, true, true, true, true, true);
    startRow += 3;
  }

  // Khối Tiến độ 7 ngày (Chỉ dành cho Báo Cáo Tuần)
  if (isWeek && data.dayTrend && data.dayTrend.length > 0) {
    sheet.getRange(startRow, 1, 1, 5).merge();
    sheet.getRange(startRow, 1).setValue('TIẾN ĐỘ SẢN LƯỢNG 7 NGÀY TRONG TUẦN')
      .setFontWeight('bold').setBackground('#f1f5f9');
    startRow++;

    sheet.getRange(startRow, 1, 1, 5).setValues([[
      'Thứ / Ngày', 'Sản lượng thực tế (Cuboid)', 'Chỉ tiêu Target (Cuboid)', '% Đạt Target', 'Accuracy (%)'
    ]]).setBackground('#334155').setFontColor('#ffffff').setFontWeight('bold').setHorizontalAlignment('center');
    startRow++;

    var trendRows = [];
    for (var d = 0; d < data.dayTrend.length; d++) {
      var dt = data.dayTrend[d];
      var pct = dt.target > 0 ? (dt.output / dt.target * 100).toFixed(1) + '%' : '100%';
      trendRows.push([
        dt.dayName + ' (' + dt.displayDate + ')',
        dt.output,
        dt.target,
        pct,
        dt.accuracy + '%'
      ]);
    }

    if (trendRows.length > 0) {
      sheet.getRange(startRow, 1, trendRows.length, 5).setValues(trendRows);
      sheet.getRange(startRow, 2, trendRows.length, 2).setHorizontalAlignment('right').setNumberFormat('#,##0');
      sheet.getRange(startRow, 4, trendRows.length, 2).setHorizontalAlignment('center');
      sheet.getRange(startRow - 1, 1, trendRows.length + 1, 5).setBorder(true, true, true, true, true, true);
      startRow += trendRows.length + 2;
    }
  }

  // Tự động căn chỉnh độ rộng cột
  sheet.autoResizeColumns(1, 11);

  return {
    success: true,
    fileUrl: newSpreadsheet.getUrl(),
    fileName: fileName,
    message: 'Đã tạo file Google Sheet ' + (isWeek ? 'báo cáo tuần' : 'báo cáo ngày') + ' thành công!'
  };
}

/**
 * Wrapper tương thích ngược cho exportWeeklyReportToSheet
 */
function exportWeeklyReportToSheet(weekDateOrStr, customData) {
  return exportReportToSpreadsheet('WEEK', weekDateOrStr, customData);
}

// ============================================================================
// 6. TRIGGER TỰ ĐỘNG 18:00 - NHẮC NHỞ CHƯA NHẬP SỐ LIỆU
// ============================================================================

/**
 * Hàm kiểm tra và nhắc nhở thành viên chưa nhập số liệu lúc 18:00
 * Có thể chạy qua Time-driven Trigger hàng ngày
 */
function remindMissingDailyLogs() {
  var todayStr = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  var members = getMembers(true);
  var dailyLogs = getSheetDataAsObjects(SHEETS.DAILY_LOGS);
  var settings = getSettings();

  var loggedMemberIds = {};
  for (var i = 0; i < dailyLogs.length; i++) {
    if (dailyLogs[i].Date === todayStr) {
      loggedMemberIds[dailyLogs[i].MemberID] = true;
    }
  }

  var missingMembers = [];
  for (var m = 0; m < members.length; m++) {
    var mem = members[m];
    // Chỉ nhắc vai trò ANNOTATOR
    if (mem.Role === 'ANNOTATOR' && !loggedMemberIds[mem.MemberID]) {
      missingMembers.push(mem);
    }
  }

  if (missingMembers.length === 0) {
    Logger.log('Tất cả thành viên đã nhập số liệu ngày ' + todayStr);
    return;
  }

  // Gửi email hoặc Telegram nhắc nhở
  var missingNames = missingMembers.map(function(m) { return m.FullName; }).join(', ');
  Logger.log('Nhắc nhở các thành viên chưa nhập số liệu: ' + missingNames);

  // Nếu có cấu hình Telegram Bot Token
  if (settings.TelegramBotToken && settings.TelegramChatId) {
    try {
      var message = '⚠️ *NHẮC NHỞ NHẬP SỐ LIỆU NGÀY ' + formatDateVietnamese(todayStr) + '*\n\n'
        + 'Hiện tại lúc 18:00 còn ' + missingMembers.length + ' thành viên chưa nhập số liệu:\n'
        + missingMembers.map(function(m, idx) { return (idx + 1) + '. ' + m.FullName; }).join('\n')
        + '\n\n👉 Vui lòng truy cập Web App để nhập sản lượng trước 19:00!';

      var url = 'https://api.telegram.org/bot' + settings.TelegramBotToken + '/sendMessage';
      UrlFetchApp.fetch(url, {
        method: 'post',
        contentType: 'application/json',
        payload: JSON.stringify({
          chat_id: settings.TelegramChatId,
          text: message,
          parse_mode: 'Markdown'
        }),
        muteHttpExceptions: true
      });
    } catch (e) {
      Logger.log('Lỗi gửi Telegram: ' + e.toString());
    }
  }
}

/**
 * Cập nhật số lần Rework của một thành viên trong tuần
 * @param {string} fromDate yyyy-MM-dd
 * @param {string} toDate yyyy-MM-dd
 * @param {string} memberId
 * @param {number} newRework
 */
function updateMemberWeeklyRework(fromDate, toDate, memberId, newRework) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    var sheet = getSheet(SHEETS.DAILY_LOGS);
    var values = sheet.getDataRange().getValues();
    newRework = parseInt(newRework, 10) || 0;

    // Tìm các dòng log của thành viên trong khoảng tuần
    var matchedRows = [];
    for (var i = 1; i < values.length; i++) {
      var rowDate = values[i][1];
      var rowMem = values[i][2];
      if (rowMem == memberId && rowDate >= fromDate && rowDate <= toDate) {
        matchedRows.push(i + 1);
      }
    }

    if (matchedRows.length > 0) {
      // Cập nhật số rework vào dòng log cuối cùng trong tuần của thành viên
      for (var j = 0; j < matchedRows.length; j++) {
        var rIdx = matchedRows[j];
        if (j === matchedRows.length - 1) {
          sheet.getRange(rIdx, 9).setValue(newRework); // Cột ReworkCount (cột 9)
          var out = parseFloat(values[rIdx - 1][5] || 0);
          var acc = out > 0 ? Math.max(0, (out - newRework) / out * 100) : 100;
          sheet.getRange(rIdx, 10).setValue(parseFloat(acc.toFixed(1))); // Cột Accuracy (cột 10)
        } else {
          sheet.getRange(rIdx, 9).setValue(0);
        }
      }
    }

    return {
      success: true,
      message: 'Đã lưu số lần Rework vào hệ thống!'
    };
  } finally {
    lock.releaseLock();
  }
}
