/**
 * ============================================================================
 * KPI.GS - CÔNG THỨC KPI, XẾP HẠNG, HUY HIỆU & DASHBOARD TẬP TRUNG
 * Hệ thống Quản Lý Team Data Annotation
 * ============================================================================
 * Nguyên tắc kỹ thuật:
 * - Gom toàn bộ dữ liệu cần thiết cho Dashboard trong 1 lần gọi server duy nhất.
 * - Hỗ trợ xem Dashboard độc lập theo từng Tuần (Thứ 2 -> Chủ nhật), so sánh với tuần trước đó.
 * - Xếp hạng công bằng dựa trên 3 tiêu chí: Điểm tổng hợp, Sản lượng hoặc Chất lượng.
 * - Trao huy hiệu tự động: Top 1🥇, Top 2🥈, Top 3🥉, "Đạt target 5 ngày liên tiếp",
 *   "Không lỗi Critical", "Tiến bộ nhất".
 */

// ============================================================================
// 1. CÔNG THỨC TÍNH TOÁN KPI CỐT LÕI
// ============================================================================

/**
 * Tính % Hoàn thành Target
 * @param {number} actualOutput Sản lượng thực tế
 * @param {number} targetOutput Định mức chỉ tiêu
 * @returns {number} % Đạt target
 */
function calcTargetCompletion(actualOutput, targetOutput) {
  if (!targetOutput || targetOutput <= 0) return 0;
  return parseFloat(((actualOutput / targetOutput) * 100).toFixed(2));
}

/**
 * Tính Độ chính xác trung bình (Accuracy %)
 * @param {number} totalOutput Tổng sản lượng
 * @param {number} totalRework Tổng số lượng rework / lỗi
 * @returns {number} Tỷ lệ chính xác %
 */
function calcAccuracy(totalOutput, totalRework) {
  if (!totalOutput || totalOutput <= 0) return 100;
  var validOutput = Math.max(0, totalOutput - totalRework);
  return parseFloat(((validOutput / totalOutput) * 100).toFixed(2));
}

/**
 * Tính Năng suất bình quân (Tasks / Giờ)
 * @param {number} totalOutput Tổng sản lượng
 * @param {number} totalHours Tổng số giờ làm việc
 * @returns {number}
 */
function calcProductivity(totalOutput, totalHours) {
  if (!totalHours || totalHours <= 0) return 0;
  return parseFloat((totalOutput / totalHours).toFixed(2));
}

/**
 * Tính Điểm Tổng Hợp (Composite Score) từ 0 -> 100
 * Trọng số chuẩn ngành Annotation:
 * - 40% Tỷ lệ hoàn thành Target (tối đa 120% để tránh chạy theo số lượng bỏ qua chất lượng)
 * - 40% Độ chính xác (Accuracy)
 * - 20% Năng suất theo giờ chuẩn hóa
 * Trừ thêm điểm phạt từ các lỗi QA bắt được (Penalty Points)
 */
function calcCompositeScore(targetComp, accuracy, productivity, targetPerHour, penaltyPoints) {
  var normTarget = Math.min(120, targetComp); // Cap ở 120%
  var targetPerHourVal = targetPerHour > 0 ? targetPerHour : 15;
  var normProd = Math.min(120, (productivity / targetPerHourVal) * 100);

  // Điểm thành phần
  var score = (normTarget * 0.40) + (accuracy * 0.40) + (normProd * 0.20);

  // Trừ điểm phạt nếu có
  if (penaltyPoints && penaltyPoints > 0) {
    score = score - (penaltyPoints * 0.5); // 1 điểm phạt trừ 0.5 điểm tổng hợp
  }

  return Math.max(0, Math.min(100, parseFloat(score.toFixed(2))));
}

// ============================================================================
// 2. DASHBOARD TẬP TRUNG (MỘT LẦN GỌI - HIỆU NĂNG CAO)
// ============================================================================

/**
 * Lấy toàn bộ dữ liệu tổng hợp cho Dashboard trong 1 lần gọi duy nhất
 * Hỗ trợ chọn tuần độc lập (mỗi tuần 1 dashboard riêng biệt), kèm so sánh với tuần trước đó
 * @param {string} fromDate (yyyy-MM-dd)
 * @param {string} toDate (yyyy-MM-dd)
 * @param {string} projectId Bộ lọc dự án (tùy chọn)
 * @param {string} memberId Bộ lọc thành viên (tùy chọn)
 * @returns {Object} Dữ liệu đóng gói hoàn chỉnh cho giao diện và biểu đồ
 */
function getDashboardData(fromDate, toDate, projectId, memberId) {
  var user = getCurrentUser();

  // Dashboard chung của nhóm luôn hiển thị toàn bộ 10 thành viên để so sánh thi đua.
  // Chỉ lọc theo memberId nếu phía client có truyền lên đích danh (ví dụ cá nhân muốn xem riêng).


  // 1. Xác định khoảng thời gian kỳ hiện tại và kỳ trước (để so sánh ▲▼)
  var currFrom = fromDate;
  var currTo = toDate;

  // Nếu không truyền ngày, mặc định lấy tuần hiện tại (Thứ 2 -> Chủ nhật)
  if (!currFrom || !currTo) {
    var defaultWeek = getWeekRangeFromDate(new Date());
    currFrom = defaultWeek.fromStr;
    currTo = defaultWeek.toStr;
  }

  // Tính khoảng thời gian kỳ trước (cùng số ngày)
  var dFrom = parseDateIso(currFrom);
  var dTo = parseDateIso(currTo);
  var dayDiff = Math.round((dTo.getTime() - dFrom.getTime()) / (1000 * 3600 * 24)) + 1;

  var prevToDate = new Date(dFrom.getTime() - (1000 * 3600 * 24));
  var prevFromDate = new Date(prevToDate.getTime() - (dayDiff - 1) * (1000 * 3600 * 24));
  var prevFrom = Utilities.formatDate(prevFromDate, TIMEZONE, 'yyyy-MM-dd');
  var prevTo = Utilities.formatDate(prevToDate, TIMEZONE, 'yyyy-MM-dd');

  // 2. Đọc toàn bộ Logs của cả 2 kỳ trong 1 lần quét bộ nhớ
  var allLogs = getSheetDataAsObjects(SHEETS.DAILY_LOGS);
  var allErrors = getSheetDataAsObjects(SHEETS.ERROR_LOGS);
  var allMembers = getMembers(true);
  var allProjects = getProjects(true);

  // 3. Phân loại logs theo kỳ hiện tại & kỳ trước
  var currentLogs = [];
  var previousLogs = [];

  for (var i = 0; i < allLogs.length; i++) {
    var l = allLogs[i];
    var lDate = l.Date;

    // Lọc theo Project & Member nếu có
    if (projectId && l.ProjectID !== projectId) continue;
    if (memberId && l.MemberID !== memberId) continue;

    if (lDate >= currFrom && lDate <= currTo) {
      currentLogs.push(l);
    } else if (lDate >= prevFrom && lDate <= prevTo) {
      previousLogs.push(l);
    }
  }

  // Lọc danh sách lỗi kỳ hiện tại
  var currentErrors = allErrors.filter(function(e) {
    if (projectId && e.ProjectID !== projectId) return false;
    if (memberId && e.MemberID !== memberId) return false;
    return e.Date >= currFrom && e.Date <= currTo && e.Status !== 'Đã huỷ';
  });

  var prevErrors = allErrors.filter(function(e) {
    if (projectId && e.ProjectID !== projectId) return false;
    if (memberId && e.MemberID !== memberId) return false;
    return e.Date >= prevFrom && e.Date <= prevTo && e.Status !== 'Đã huỷ';
  });

  // 4. Tính toán Metrics Kỳ Hiện Tại
  var currMetrics = calculateMetricsSummary(currentLogs, currentErrors, allMembers);
  var prevMetrics = calculateMetricsSummary(previousLogs, prevErrors, allMembers);

  // 5. Chuẩn bị dữ liệu cho 4 Biểu đồ Chart.js
  var chartData = buildChartDatasets(currentLogs, currFrom, currTo, currentErrors);

  return {
    success: true,
    user: user,
    period: {
      from: currFrom,
      to: currTo,
      displayFrom: formatDateVietnamese(currFrom),
      displayTo: formatDateVietnamese(currTo),
      prevFrom: prevFrom,
      prevTo: prevTo
    },
    metrics: {
      current: currMetrics,
      previous: prevMetrics,
      comparison: calculateComparison(currMetrics, prevMetrics)
    },
    charts: chartData,
    recentErrors: currentErrors.slice(0, 10), // 10 lỗi gần nhất
    activeMembersCount: allMembers.length,
    activeProjectsCount: allProjects.length
  };
}

/**
 * Tính toán tổng hợp KPI cho một tập Logs
 */
function calculateMetricsSummary(logs, errors, membersList) {
  var totalOutput = 0;
  var totalTarget = 0;
  var totalHours = 0;
  var totalRework = 0;
  var memberStats = {}; // Theo dõi từng cá nhân để tính số người đạt/chưa đạt target

  for (var i = 0; i < logs.length; i++) {
    var l = logs[i];
    var out = parseFloat(l.Output || 0);
    var tgt = parseFloat(l.TargetPerDay || 0);
    var hrs = parseFloat(l.WorkHours || 0);
    var rwk = parseFloat(l.ReworkCount || 0);

    var noteText = (l.Note || l.Notes || '').toString().toLowerCase();
    var isDoneLog = (l.IsDoneJob === true || l.IsDoneJob === 'Yes' || l.IsDoneJob === 'TRUE' ||
                     noteText.indexOf('done') !== -1 || noteText.indexOf('hoàn thành') !== -1);

    // FIX TRIỆT ĐỂ: Nếu ngày đó Done job thì effective target = out (bằng đúng sản lượng làm được, không phạt 120)
    var effectiveTgt = isDoneLog ? out : tgt;

    totalOutput += out;
    totalTarget += effectiveTgt;
    totalHours += hrs;
    totalRework += rwk;

    var mId = l.MemberID;
    if (!memberStats[mId]) {
      memberStats[mId] = { output: 0, target: 0, days: 0, doneDays: 0 };
    }
    memberStats[mId].output += out;
    memberStats[mId].target += effectiveTgt;
    memberStats[mId].days += 1;
    if (isDoneLog) memberStats[mId].doneDays += 1;
  }

  var targetCompletionRate = totalTarget > 0 ? (totalOutput / totalTarget * 100) : 0;
  var accuracyRate = totalOutput > 0 ? Math.max(0, (totalOutput - totalRework) / totalOutput * 100) : 100;
  var errorRate = totalOutput > 0 ? (totalRework / totalOutput * 100) : 0;
  var reworkRate = totalOutput > 0 ? (totalRework / totalOutput * 100) : 0;
  var avgProductivity = totalHours > 0 ? (totalOutput / totalHours) : 0;

  // Đếm số người đạt vs chưa đạt target
  var membersMetTarget = 0;
  var membersBelowTarget = 0;

  for (var mKey in memberStats) {
    if (memberStats.hasOwnProperty(mKey)) {
      var item = memberStats[mKey];
      if (item.target > 0 && item.output >= item.target) {
        membersMetTarget++;
      } else {
        membersBelowTarget++;
      }
    }
  }

  // Tổng số lỗi và điểm trừ
  var totalErrorCount = errors.length;
  var totalPenaltyPoints = 0;
  for (var e = 0; e < errors.length; e++) {
    totalPenaltyPoints += parseFloat(errors[e].PenaltyPoints || 0);
  }

  return {
    totalOutput: totalOutput,
    totalTarget: totalTarget,
    totalHours: parseFloat(totalHours.toFixed(1)),
    totalRework: totalRework,
    targetCompletionRate: parseFloat(targetCompletionRate.toFixed(1)),
    accuracyRate: parseFloat(accuracyRate.toFixed(1)),
    errorRate: parseFloat(errorRate.toFixed(2)),
    reworkRate: parseFloat(reworkRate.toFixed(2)),
    avgProductivity: parseFloat(avgProductivity.toFixed(1)),
    membersMetTarget: membersMetTarget,
    membersBelowTarget: membersBelowTarget,
    totalErrorCount: totalErrorCount,
    totalPenaltyPoints: totalPenaltyPoints
  };
}

/**
 * Tính % chênh lệch so với kỳ trước để vẽ mũi tên ▲/▼
 */
function calculateComparison(curr, prev) {
  function getDiff(c, p) {
    if (!p || p === 0) return { diff: c, pct: 0, isUp: c >= 0 };
    var diff = c - p;
    var pct = (diff / Math.abs(p)) * 100;
    return {
      diff: parseFloat(diff.toFixed(1)),
      pct: parseFloat(pct.toFixed(1)),
      isUp: diff >= 0
    };
  }

  return {
    output: getDiff(curr.totalOutput, prev.totalOutput),
    targetRate: getDiff(curr.targetCompletionRate, prev.targetCompletionRate),
    accuracy: getDiff(curr.accuracyRate, prev.accuracyRate),
    errorRate: getDiff(curr.errorRate, prev.errorRate),
    reworkRate: getDiff(curr.reworkRate, prev.reworkRate),
    productivity: getDiff(curr.avgProductivity, prev.avgProductivity),
    errorCount: getDiff(curr.totalErrorCount, prev.totalErrorCount)
  };
}

/**
 * Chuẩn bị các mảng dữ liệu cho biểu đồ Chart.js
 * Tập trung 100% vào Sản lượng và KPI (KPI Yêu Cầu vs KPI Làm Được)
 */
function buildChartDatasets(logs, fromDateStr, toDateStr, errors) {
  // 1. Tạo danh sách các ngày trong khoảng
  var datesMap = {};
  var dateLabels = [];
  var dayObjects = [];
  var dStart = parseDateIso(fromDateStr);
  var dEnd = parseDateIso(toDateStr);

  var dayNames = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  var dayShorts = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  var curr = new Date(dStart.getTime());
  while (curr <= dEnd) {
    var dStr = Utilities.formatDate(curr, TIMEZONE, 'yyyy-MM-dd');
    var dayIdx = curr.getDay();
    var dayOfWeek = dayNames[dayIdx];
    var dayShort = dayShorts[dayIdx];
    var shortDate = formatDateVietnamese(dStr).substring(0, 5); // dd/MM

    datesMap[dStr] = {
      label: shortDate,
      fullLabel: dayOfWeek + ' (' + shortDate + ')',
      headerLabel: dayShort + ' ' + shortDate,
      output: 0,
      target: 0
    };
    dateLabels.push(dStr);
    dayObjects.push({
      dateStr: dStr,
      label: shortDate,
      shortDay: dayShort,
      headerLabel: dayShort + ' ' + shortDate,
      fullLabel: dayOfWeek + ' (' + shortDate + ')'
    });

    curr.setDate(curr.getDate() + 1);
  }

  // 2. Danh sách 10 thành viên chuẩn
  var allMembers = getMembers(true);
  var memberNames = [];
  var memberStats = {};

  for (var m = 0; m < allMembers.length; m++) {
    var mb = allMembers[m];
    memberNames.push(mb.FullName);
    memberStats[mb.MemberID] = {
      id: mb.MemberID,
      name: mb.FullName,
      totalOutput: 0,
      totalTarget: 0,
      byDate: {}
    };
    for (var di = 0; di < dateLabels.length; di++) {
      memberStats[mb.MemberID].byDate[dateLabels[di]] = {
        output: 0,
        target: parseFloat(mb.DailyTarget || 20),
        notes: '',
        isDoneJob: false
      };
    }
  }

  // 3. Quét Logs để gán chính xác sản lượng và target cho từng người từng ngày
  for (var i = 0; i < logs.length; i++) {
    var l = logs[i];
    var lDate = l.Date;
    var out = parseFloat(l.Output || 0);
    var rawTgt = parseFloat(l.TargetPerDay || l.Target || l.DailyTarget || 0);
    var mId = l.MemberID;

    // Tìm thành viên theo ID hoặc tên
    if (!memberStats[mId]) {
      for (var mid in memberStats) {
        if (memberStats[mid].name === l.MemberName) {
          mId = mid;
          break;
        }
      }
    }

    if (memberStats[mId] && memberStats[mId].byDate[lDate]) {
      var noteStr = (l.Note || l.Notes || '').toString().trim();
      var isDone = (l.IsDoneJob === true || l.IsDoneJob === 'Yes' || l.IsDoneJob === 'TRUE' ||
                    noteStr.toLowerCase().indexOf('done') !== -1 ||
                    noteStr.toLowerCase().indexOf('hoàn thành') !== -1 ||
                    noteStr.toLowerCase().indexOf('chốt') !== -1);

      var tgt = rawTgt > 0 ? rawTgt : (memberStats[mId].byDate[lDate].target || 20);
      if (isDone) {
        tgt = out; // Khi done job: target khớp sản lượng làm được (100%), không ép 120
      }

      memberStats[mId].byDate[lDate].output += out;
      memberStats[mId].byDate[lDate].target = tgt;
      if (noteStr) {
        memberStats[mId].byDate[lDate].notes = (memberStats[mId].byDate[lDate].notes ? (memberStats[mId].byDate[lDate].notes + '; ') : '') + noteStr;
      }
      if (isDone) {
        memberStats[mId].byDate[lDate].isDoneJob = true;
      }
    }
  }

  // 4. Chuẩn bị dữ liệu Cột Đôi cho Biểu đồ 1 (KPI Yêu Cầu vs KPI Làm Được)
  var memberTargetList = [];
  var memberOutputList = [];
  var matrixMembers = [];

  for (var mi = 0; mi < allMembers.length; mi++) {
    var mIdKey = allMembers[mi].MemberID;
    var mItem = memberStats[mIdKey];
    var mTotalOut = 0;
    var mTotalTgt = 0;

    for (var dKey in mItem.byDate) {
      mTotalOut += mItem.byDate[dKey].output;
      mTotalTgt += mItem.byDate[dKey].target;
    }

    mItem.totalOutput = mTotalOut;
    mItem.totalTarget = mTotalTgt;

    memberTargetList.push(mTotalTgt);
    memberOutputList.push(mTotalOut);

    matrixMembers.push({
      id: mIdKey,
      name: allMembers[mi].FullName,
      role: allMembers[mi].Role || 'Annotator',
      dailyTarget: parseFloat(allMembers[mi].DailyTarget || 20),
      byDate: mItem.byDate,
      totalOutput: mTotalOut,
      totalTarget: mTotalTgt
    });
  }

  // Dữ liệu theo từng ngày cụ thể để chuyển đổi bộ lọc ngày
  var dailyMemberComparison = {};
  for (var d = 0; d < dateLabels.length; d++) {
    var dtKey = dateLabels[d];
    var dayTargets = [];
    var dayOutputs = [];
    for (var mIdx = 0; mIdx < allMembers.length; mIdx++) {
      var memId = allMembers[mIdx].MemberID;
      dayTargets.push(memberStats[memId].byDate[dtKey].target);
      dayOutputs.push(memberStats[memId].byDate[dtKey].output);
    }
    dailyMemberComparison[dtKey] = {
      targets: dayTargets,
      outputs: dayOutputs
    };
  }

  // 5. Chuẩn bị dữ liệu cho Biểu đồ 2: Xu hướng sản lượng từng thành viên theo ngày
  var chart2Datasets = [];
  var colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16', '#64748b', '#0ea5e9'];

  for (var m2 = 0; m2 < allMembers.length; m2++) {
    var memObj = allMembers[m2];
    var memLineData = [];
    for (var di2 = 0; di2 < dateLabels.length; di2++) {
      var dStr2 = dateLabels[di2];
      memLineData.push(memberStats[memObj.MemberID].byDate[dStr2].output);
    }
    chart2Datasets.push({
      label: memObj.FullName,
      data: memLineData,
      color: colors[m2 % colors.length]
    });
  }

  var chart2DateLabels = dayObjects.map(function(d) { return d.label; });

  return {
    // Biểu đồ 1: Cột Đôi (KPI Yêu Cầu vs KPI Làm Được) & Bảng Ma Trận KPI Theo Ngày
    kpiComparison: {
      memberNames: memberNames,
      weeklyTargets: memberTargetList,
      weeklyOutputs: memberOutputList,
      dailyComparison: dailyMemberComparison,
      matrixMembers: matrixMembers,
      days: dayObjects
    },
    // Biểu đồ 2: Xu hướng sản lượng từng thành viên
    memberTrends: {
      labels: chart2DateLabels,
      datasets: chart2Datasets
    }
  };
}

// ============================================================================
// 3. BẢNG XẾP HẠNG THÀNH VIÊN VÀ HUY HIỆU (RANKING & BADGES)
// ============================================================================

/**
 * Lấy Bảng Xếp Hạng chi tiết theo Ngày / Tuần / Tháng
 * Hỗ trợ các tiêu chí xếp hạng:
 * - 'COMPOSITE': Điểm tổng hợp (Mặc định)
 * - 'OUTPUT': Sản lượng
 * - 'QUALITY': Chất lượng (Accuracy cao nhất, ít lỗi nhất)
 * @param {string} periodType 'DAY' | 'WEEK' | 'MONTH'
 * @param {string} specificDateOrWeek Ngày (yyyy-MM-dd) hoặc Tuần
 * @param {string} rankCriterion Tiêu chí xếp hạng
 */
function getRankingDetails(periodType, specificDateOrWeek, rankCriterion) {
  var user = getCurrentUser();
  var isUserAdminOrQa = (user.role === 'Team Lead' || user.role === 'Annotator + QC' || user.role === 'ADMIN' || user.role === 'QA');
  rankCriterion = rankCriterion || 'COMPOSITE';

  // 1. Xác định khoảng ngày theo periodType
  var fromStr, toStr, prevFromStr, prevToStr;

  if (periodType === 'DAY') {
    fromStr = specificDateOrWeek || Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
    toStr = fromStr;

    var prevDay = new Date(parseDateIso(fromStr).getTime() - 24 * 3600 * 1000);
    prevFromStr = Utilities.formatDate(prevDay, TIMEZONE, 'yyyy-MM-dd');
    prevToStr = prevFromStr;
  } else if (periodType === 'MONTH') {
    var refDate = specificDateOrWeek ? parseDateIso(specificDateOrWeek) : new Date();
    var y = refDate.getFullYear();
    var m = refDate.getMonth();
    var firstDay = new Date(y, m, 1);
    var lastDay = new Date(y, m + 1, 0);

    fromStr = Utilities.formatDate(firstDay, TIMEZONE, 'yyyy-MM-dd');
    toStr = Utilities.formatDate(lastDay, TIMEZONE, 'yyyy-MM-dd');

    var prevMonthFirst = new Date(y, m - 1, 1);
    var prevMonthLast = new Date(y, m, 0);
    prevFromStr = Utilities.formatDate(prevMonthFirst, TIMEZONE, 'yyyy-MM-dd');
    prevToStr = Utilities.formatDate(prevMonthLast, TIMEZONE, 'yyyy-MM-dd');
  } else {
    // Mặc định là WEEK (Thứ 2 -> CN)
    var weekRange = getWeekRangeFromDate(specificDateOrWeek ? parseDateIso(specificDateOrWeek) : new Date());
    fromStr = weekRange.fromStr;
    toStr = weekRange.toStr;

    var prevWeekRef = new Date(weekRange.from.getTime() - 2 * 24 * 3600 * 1000);
    var prevWeekRange = getWeekRangeFromDate(prevWeekRef);
    prevFromStr = prevWeekRange.fromStr;
    prevToStr = prevWeekRange.toStr;
  }

  // 2. Đọc dữ liệu thành viên, logs và lỗi
  var members = getMembers(true);
  var dailyLogs = getSheetDataAsObjects(SHEETS.DAILY_LOGS);
  var errorLogs = getSheetDataAsObjects(SHEETS.ERROR_LOGS);

  var periodKey = periodType + '_' + fromStr;
  var prevPeriodKey = periodType + '_' + prevFromStr;

  // Đọc thứ hạng tùy chỉnh do Admin thiết lập nếu có
  var currentCustomRankMap = getCustomRankings(periodKey);
  var prevCustomRankMap = getCustomRankings(prevPeriodKey);

  // 3. Tính toán cho kỳ trước để so sánh thứ hạng với tuần trước (▲/▼)
  var prevRankList = compileMemberScores(members, dailyLogs, errorLogs, prevFromStr, prevToStr, rankCriterion);
  
  if (prevCustomRankMap && Object.keys(prevCustomRankMap).length > 0) {
    for (var pi = 0; pi < prevRankList.length; pi++) {
      var pId = prevRankList[pi].memberId;
      if (prevCustomRankMap[pId] !== undefined && prevCustomRankMap[pId] !== null) {
        prevRankList[pi].rank = parseInt(prevCustomRankMap[pId], 10);
      } else {
        prevRankList[pi].rank = 999;
      }
    }
    prevRankList.sort(function(a, b) { return a.rank - b.rank; });
  } else {
    for (var pj = 0; pj < prevRankList.length; pj++) {
      prevRankList[pj].rank = pj + 1;
    }
  }

  var prevRankMap = {};
  for (var p = 0; p < prevRankList.length; p++) {
    var pItem = prevRankList[p];
    if (pItem.output > 0 || pItem.totalDaysWithLogs > 0 || (prevCustomRankMap && prevCustomRankMap[pItem.memberId])) {
      prevRankMap[pItem.memberId] = pItem.rank;
    }
  }

  // 4. Tính toán cho kỳ hiện tại
  var currentRankList = compileMemberScores(members, dailyLogs, errorLogs, fromStr, toStr, rankCriterion);

  // Áp dụng thứ hạng tùy chỉnh do Admin thiết lập nếu có
  var isCustomRanked = false;
  if (currentCustomRankMap && Object.keys(currentCustomRankMap).length > 0) {
    isCustomRanked = true;
    for (var ci = 0; ci < currentRankList.length; ci++) {
      var cId = currentRankList[ci].memberId;
      if (currentCustomRankMap[cId] !== undefined && currentCustomRankMap[cId] !== null && currentCustomRankMap[cId] !== '') {
        currentRankList[ci].rank = parseInt(currentCustomRankMap[cId], 10);
        currentRankList[ci].isCustomRank = true;
      } else {
        currentRankList[ci].rank = 999;
      }
    }
    currentRankList.sort(function(a, b) { 
      if (a.rank !== b.rank) return a.rank - b.rank;
      return b.output - a.output;
    });
  } else {
    for (var cj = 0; cj < currentRankList.length; cj++) {
      currentRankList[cj].rank = cj + 1;
    }
  }

  // 5. Gắn thông tin so sánh chênh lệch hạng với kỳ trước và Huy hiệu
  for (var r = 0; r < currentRankList.length; r++) {
    var item = currentRankList[r];
    var currentRank = item.rank;

    var prevRank = prevRankMap[item.memberId];
    if (prevRank !== undefined && prevRank !== null) {
      item.hasPrevRank = true;
      item.prevRank = prevRank;
      item.rankDiff = prevRank - currentRank; // Dương: Tăng hạng ▲, Âm: Giảm hạng ▼, 0: Giữ nguyên -
    } else {
      item.hasPrevRank = false;
      item.prevRank = null;
      item.rankDiff = null; // Mới ⭐
    }

    // Trao huy hiệu tự động
    item.badges = evaluateBadges(item, currentRank, item.rankDiff);
  }

  // 6. Hiển thị trọn vẹn toàn bộ 10 thành viên trong đội ngũ
  // để minh bạch thi đua và xuất báo cáo đầy đủ cả nhóm
  var finalRankList = currentRankList;

  return {
    success: true,
    periodType: periodType,
    periodKey: periodKey,
    from: fromStr,
    to: toStr,
    displayRange: formatDateVietnamese(fromStr) + ' - ' + formatDateVietnamese(toStr),
    rankCriterion: rankCriterion,
    rankings: finalRankList,
    totalMembers: currentRankList.length,
    isCustomRanked: isCustomRanked,
    userRole: user.role,
    userId: user.id
  };
}

/**
 * Tính điểm và xếp hạng danh sách thành viên trong một khoảng ngày
 */
function compileMemberScores(members, logs, errors, fromDateStr, toDateStr, criterion) {
  var memberMap = {};

  for (var m = 0; m < members.length; m++) {
    var mb = members[m];
    memberMap[mb.MemberID] = {
      memberId: mb.MemberID,
      memberName: mb.FullName,
      role: mb.Role,
      output: 0,
      target: 0,
      hours: 0,
      rework: 0,
      errorCount: 0,
      criticalCount: 0,
      penaltyPoints: 0,
      dailyTargetMetCount: 0, // Đếm số ngày đạt target liên tiếp
      totalDaysWithLogs: 0
    };
  }

  // Quét Daily Logs
  for (var i = 0; i < logs.length; i++) {
    var log = logs[i];
    if (log.Date >= fromDateStr && log.Date <= toDateStr && memberMap[log.MemberID]) {
      var mem = memberMap[log.MemberID];
      var o = parseFloat(log.Output || 0);
      var t = parseFloat(log.TargetPerDay || 0);
      var h = parseFloat(log.WorkHours || 0);
      var r = parseFloat(log.ReworkCount || 0);

      var logNote = (log.Note || log.Notes || '').toString().toLowerCase();
      var isDone = (log.IsDoneJob === true || log.IsDoneJob === 'Yes' || log.IsDoneJob === 'TRUE' || logNote.indexOf('done') !== -1 || logNote.indexOf('hoàn thành') !== -1);
      // FIX TRIỆT ĐỂ: Nếu Done job thì chỉ tiêu ngày bằng chính sản lượng làm ra (đạt 100%, không bị nợ 120)
      var effectiveTgt = isDone ? o : t;

      mem.output += o;
      mem.target += effectiveTgt;
      mem.hours += h;
      mem.rework += r;
      mem.totalDaysWithLogs += 1;

      if (isDone || (effectiveTgt > 0 && o >= effectiveTgt)) {
        mem.dailyTargetMetCount += 1;
      }
    }
  }

  // Quét Errors
  for (var e = 0; e < errors.length; e++) {
    var err = errors[e];
    if (err.Date >= fromDateStr && err.Date <= toDateStr && memberMap[err.MemberID] && err.Status !== 'Đã huỷ') {
      var emem = memberMap[err.MemberID];
      emem.errorCount += 1;
      emem.penaltyPoints += parseFloat(err.PenaltyPoints || 0);
      if (err.Severity === 'Critical' || err.Severity === 'Nghiêm trọng') {
        emem.criticalCount += 1;
      }
    }
  }

  // Tính các chỉ số KPI chuẩn
  var list = [];
  for (var id in memberMap) {
    if (memberMap.hasOwnProperty(id)) {
      var item = memberMap[id];
      var targetRate = calcTargetCompletion(item.output, item.target);
      if (item.target === 0 && item.totalDaysWithLogs > 0) {
        targetRate = 100;
      }
      var accuracy = calcAccuracy(item.output, item.rework);
      var productivity = calcProductivity(item.output, item.hours);
      var compScore = calcCompositeScore(targetRate, accuracy, productivity, 15, item.penaltyPoints);

      item.targetCompletionRate = targetRate;
      item.accuracy = accuracy;
      item.productivity = productivity;
      item.compositeScore = compScore;

      list.push(item);
    }
  }

  // Sắp xếp theo tiêu chí được chọn
  list.sort(function(a, b) {
    if (criterion === 'OUTPUT') {
      return b.output - a.output;
    } else if (criterion === 'QUALITY') {
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return a.errorCount - b.errorCount;
    } else {
      // COMPOSITE (Mặc định)
      if (b.compositeScore !== a.compositeScore) return b.compositeScore - a.compositeScore;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      return b.output - a.output;
    }
  });

  return list;
}

/**
 * Gán huy hiệu tự động cho thành viên
 */
function evaluateBadges(item, rank, rankDiff) {
  var badges = [];

  // Top 1, 2, 3
  if (rank === 1) badges.push({ text: 'Top 1 Xuất Sắc', icon: '🥇', class: 'badge-gold' });
  else if (rank === 2) badges.push({ text: 'Top 2 Tiên Tiến', icon: '🥈', class: 'badge-silver' });
  else if (rank === 3) badges.push({ text: 'Top 3 Nỗ Lực', icon: '🥉', class: 'badge-bronze' });

  // Tiến bộ nhất (tăng từ 3 hạng trở lên)
  if (rankDiff >= 3) {
    badges.push({ text: 'Tiến bộ vượt bậc (▲' + rankDiff + ')', icon: '🚀', class: 'badge-jump' });
  }

  // Đạt target liên tiếp 5 ngày trở lên
  if (item.dailyTargetMetCount >= 5) {
    badges.push({ text: 'Chuỗi ' + item.dailyTargetMetCount + ' ngày đạt Target', icon: '🔥', class: 'badge-streak' });
  }

  // Không có bất kỳ lỗi Critical nào và Accuracy >= 98%
  if (item.criticalCount === 0 && item.accuracy >= 98 && item.output > 0) {
    badges.push({ text: 'Zero Critical / Siêu Chuẩn', icon: '🛡️', class: 'badge-shield' });
  }

  return badges;
}
