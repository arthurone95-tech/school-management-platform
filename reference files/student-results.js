// ============================================
// STUDENT RESULTS VIEW LOGIC
// Tina's Little Angels Preparatory School
// ============================================

let myResults = [];
let currentStudentUser = null;

// Ordinal suffix helper
function ordinalSuffix(n) {
    if (isNaN(n) || n === '-') return '-';
    const num = parseInt(n);
    if (num === 0) return '0';
    const s = ['th','st','nd','rd'];
    const v = num % 100;
    return num + (s[(v-20)%10] || s[v] || s[0]);
}

// Initialize view results page
async function initializeViewResultsPage() {
    console.log('Initializing view results page...');

    try {
        currentStudentUser = auth.currentUser;
        if (!currentStudentUser) {
            window.location.href = 'login.html';
            return;
        }

        await populateAcademicYears();
        await loadMyResults();

    } catch (error) {
        console.error('Error initializing results page:', error);
        showMessage('Error loading results: ' + error.message, 'error');
    }
}

// Populate academic years dropdown
async function populateAcademicYears() {
    const yearSelect = document.getElementById('filterYear');
    if (!yearSelect) return;

    yearSelect.innerHTML = '<option value="all">All Years</option>';
    const currentYear = new Date().getFullYear();
    for (let i = 0; i < 5; i++) {
        const year = currentYear - i;
        const academicYear = `${year}-${year + 1}`;
        const option = document.createElement('option');
        option.value = academicYear;
        option.textContent = academicYear;
        yearSelect.appendChild(option);
    }
}

// Load my results
async function loadMyResults() {
    try {
        const resultsList = document.getElementById('resultsList');
        if (resultsList) {
            resultsList.innerHTML = '<div class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading your results...</div>';
        }

        const yearFilter = document.getElementById('filterYear')?.value || 'all';
        const termFilter = document.getElementById('filterTerm')?.value || 'all';
        const sortBy = document.getElementById('sortBy')?.value || 'date';

        let query = db.collection('results')
            .where('studentId', '==', currentStudentUser.uid);

        if (yearFilter !== 'all') {
            query = query.where('academicYear', '==', yearFilter);
        }
        if (termFilter !== 'all') {
            query = query.where('term', '==', termFilter);
        }

        const snapshot = await query.get();
        myResults = [];
        snapshot.forEach(doc => {
            const result = { id: doc.id, ...doc.data() };
            myResults.push(result);
        });

        // Sort
        if (sortBy === 'date') {
            myResults.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
        } else if (sortBy === 'term') {
            const termOrder = { 'Term 1': 1, 'Term 2': 2, 'Term 3': 3 };
            myResults.sort((a, b) => (termOrder[a.term] || 0) - (termOrder[b.term] || 0));
        } else if (sortBy === 'score') {
            myResults.sort((a, b) => {
                const avgA = a.subjects?.reduce((sum, s) => sum + (s.totalScore || 0), 0) / (a.subjects?.length || 1);
                const avgB = b.subjects?.reduce((sum, s) => sum + (s.totalScore || 0), 0) / (b.subjects?.length || 1);
                return avgB - avgA;
            });
        }

        updateResultsSummary();
        renderResultsList();

    } catch (error) {
        console.error('Error loading results:', error);
        showMessage('Error loading results: ' + error.message, 'error');
        const resultsList = document.getElementById('resultsList');
        if (resultsList) {
            resultsList.innerHTML = `<div class="text-center error"><i class="fas fa-exclamation-triangle"></i><p>${error.message}</p></div>`;
        }
    }
}

// Update summary statistics
function updateResultsSummary() {
    const total = myResults.length;
    document.getElementById('totalReports').textContent = total;

    let totalScoreSum = 0;
    let count = 0;
    let bestSubject = '-';
    let bestAvg = 0;
    const termCounts = {};

    myResults.forEach(result => {
        if (result.subjects && result.subjects.length > 0) {
            const totalScore = result.subjects.reduce((sum, s) => sum + (s.totalScore || 0), 0);
            const avg = totalScore / result.subjects.length;
            totalScoreSum += avg;
            count++;
        }
        if (result.term) termCounts[result.term] = (termCounts[result.term] || 0) + 1;
    });

    const avgScore = count > 0 ? Math.round(totalScoreSum / count) : 0;
    document.getElementById('averageScore').textContent = avgScore + '%';

    if (myResults.length > 0) {
        const subjectsMap = {};
        myResults.forEach(result => {
            if (result.subjects) {
                result.subjects.forEach(sub => {
                    const name = sub.name;
                    if (!subjectsMap[name]) subjectsMap[name] = { total: 0, count: 0 };
                    subjectsMap[name].total += sub.totalScore || 0;
                    subjectsMap[name].count++;
                });
            }
        });
        let maxAvg = 0;
        for (const [name, data] of Object.entries(subjectsMap)) {
            const avg = data.count > 0 ? data.total / data.count : 0;
            if (avg > maxAvg) {
                maxAvg = avg;
                bestSubject = name;
            }
        }
    }
    document.getElementById('bestSubject').textContent = bestSubject || '-';

    const latest = myResults.length > 0 ? myResults[0].term : '-';
    document.getElementById('latestTerm').textContent = latest || '-';
}

// Render the results list
function renderResultsList() {
    const container = document.getElementById('resultsList');
    if (!container) return;

    if (myResults.length === 0) {
        container.innerHTML = `
            <div class="no-results">
                <i class="fas fa-file-alt"></i>
                <h3>No results found</h3>
                <p>No academic results have been published for you yet.</p>
            </div>
        `;
        return;
    }

    let html = '';
    myResults.forEach(result => {
        const subjects = result.subjects || [];
        const total = subjects.reduce((sum, s) => sum + (s.totalScore || 0), 0);
        const avg = subjects.length > 0 ? Math.round(total / subjects.length) : 0;
        const date = result.createdAt ? new Date(result.createdAt.seconds * 1000).toLocaleDateString() : '-';

        let perfClass = 'performance-average';
        if (avg >= 80) perfClass = 'performance-excellent';
        else if (avg >= 60) perfClass = 'performance-good';
        else if (avg < 50) perfClass = 'performance-needs-improvement';

        html += `
            <div class="result-card">
                <div class="result-header">
                    <div class="result-title">
                        <h4>${result.term} – ${result.academicYear}</h4>
                        <span class="result-class">${safeGetClassDisplayName(result.studentClass)}</span>
                    </div>
                    <div class="result-date">${date}</div>
                </div>
                <div class="result-stats">
                    <div class="stat-item">
                        <i class="fas fa-chart-bar"></i>
                        <div>
                            <span class="stat-label">Average Score</span>
                            <span class="stat-value ${perfClass}">${avg}%</span>
                        </div>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-book"></i>
                        <div>
                            <span class="stat-label">Subjects</span>
                            <span class="stat-value">${subjects.length}</span>
                        </div>
                    </div>
                    <div class="stat-item">
                        <i class="fas fa-flag"></i>
                        <div>
                            <span class="stat-label">Conduct</span>
                            <span class="stat-value">${result.conduct || '-'}</span>
                        </div>
                    </div>
                </div>
                <div class="result-subjects-preview">
                    <strong>Top subjects:</strong> 
                    ${subjects.slice(0, 3).map(s => `${s.name}: ${s.totalScore || s.grade || '-'}`).join(' | ')}
                    ${subjects.length > 3 ? ` (+${subjects.length - 3} more)` : ''}
                </div>
                <div class="result-footer">
                    <button class="btn-primary btn-sm" onclick="viewFullResult('${result.id}')">
                        <i class="fas fa-eye"></i> View Full Report
                    </button>
                    <button class="btn-outline btn-sm" onclick="printResult('${result.id}')">
                        <i class="fas fa-print"></i> Print
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function safeGetClassDisplayName(classValue) {
    if (typeof window.getClassDisplayName === 'function') {
        return window.getClassDisplayName(classValue);
    }
    const fallbackMap = {
        'creche': 'Crèche', 'nursery1': 'Nursery 1', 'nursery2': 'Nursery 2',
        'kg1': 'Kindergarten 1', 'kg2': 'Kindergarten 2',
        'basic1': 'Basic 1', 'basic2': 'Basic 2', 'basic3': 'Basic 3',
        'basic4': 'Basic 4', 'basic5': 'Basic 5', 'basic6': 'Basic 6',
        'jhs1': 'JHS 1', 'jhs2': 'JHS 2', 'jhs3': 'JHS 3'
    };
    return fallbackMap[classValue] || classValue.toUpperCase();
}

async function viewFullResult(resultId) {
    try {
        const doc = await db.collection('results').doc(resultId).get();
        if (!doc.exists) {
            showMessage('Result not found.', 'error');
            return;
        }
        const result = { id: doc.id, ...doc.data() };
        displayReportCard(result);
        document.getElementById('reportCardModal').style.display = 'flex';
    } catch (error) {
        console.error('Error loading result:', error);
        showMessage('Error: ' + error.message, 'error');
    }
}

// ===== FIXED PRINT FUNCTION – opens new window =====
async function printResult(resultId) {
    try {
        const doc = await db.collection('results').doc(resultId).get();
        if (!doc.exists) {
            showMessage('Result not found.', 'error');
            return;
        }
        const result = { id: doc.id, ...doc.data() };
        // Generate the report card HTML (with total row)
        const reportHTML = buildReportCardHTML(result);
        // Open a new window for printing
        const win = window.open('', '_blank', 'width=800,height=600');
        if (!win) {
            showMessage('Please allow popups for this site.', 'error');
            return;
        }
        win.document.write(reportHTML);
        win.document.close();
        win.focus();
        win.print();
    } catch (error) {
        console.error('Error printing:', error);
        showMessage('Error: ' + error.message, 'error');
    }
}

// Helper to build the report card HTML for the print window
function buildReportCardHTML(result) {
    const classDisplay = safeGetClassDisplayName(result.studentClass);
    let subjectsHTML = '';
    let totalClassScore = 0;
    let totalExamScore = 0;
    let totalOverall = 0;

    if (result.subjects && result.subjects.length > 0) {
        const numericSubjects = result.subjects.filter(s => s.classScore !== undefined || s.examScore !== undefined);
        if (numericSubjects.length > 0) {
            subjectsHTML = numericSubjects.map(subject => {
                const classScore = subject.classScore || 0;
                const examScore = subject.examScore || 0;
                const totalScore = subject.totalScore || 0;
                totalClassScore += classScore;
                totalExamScore += examScore;
                totalOverall += totalScore;
                return `
                    <tr>
                        <td>${subject.name}</td>
                        <td class="text-center">${classScore}</td>
                        <td class="text-center">${examScore}</td>
                        <td class="text-center">${totalScore}</td>
                        <td class="text-center">${subject.position || subject.positionDisplay || '-'}</td>
                        <td>${subject.remarks || '-'}</td>
                    </tr>
                `;
            }).join('');
            // Total row
            subjectsHTML += `
                <tr style="background-color: #f0f0f0; font-weight: bold; border-top: 2px solid #000;">
                    <td><strong>TOTAL</strong></td>
                    <td class="text-center"><strong>${totalClassScore.toFixed(1)}</strong></td>
                    <td class="text-center"><strong>${totalExamScore.toFixed(1)}</strong></td>
                    <td class="text-center"><strong>${totalOverall.toFixed(1)}</strong></td>
                    <td class="text-center">—</td>
                    <td>—</td>
                </tr>
            `;
        } else {
            subjectsHTML = result.subjects.map(subject => `
                <tr>
                    <td>${subject.name}</td>
                    <td class="text-center">${subject.grade || '-'}</td>
                    <td class="text-center">-</td>
                    <td class="text-center">-</td>
                    <td class="text-center">-</td>
                    <td>${subject.remarks || '-'}</td>
                </tr>
            `).join('');
        }
    }

    const posNum = result.positionInClass;
    let posDisplay = 'To be calculated';
    if (posNum !== undefined && posNum !== null && posNum !== '-') {
        posDisplay = ordinalSuffix(posNum);
    }

    const bills = result.bills || {};
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Report Card</title>
            <style>
                @page { margin: 0; size: A4 portrait; }
                body { margin: 0; padding: 0; background: #fff; font-family: 'Times New Roman', serif; }
                .student-report-card {
                    margin: 0;
                    padding: 10px 15px !important;
                    border: none !important;
                    border-radius: 0 !important;
                    box-shadow: none !important;
                    min-height: auto !important;
                    width: 100%;
                    box-sizing: border-box;
                    font-size: 9pt;
                }
                .student-report-card * { page-break-inside: avoid; }
                .report-watermark { display: none !important; }
                .student-report-card table { width: 100%; border-collapse: collapse; }
                .student-report-card th, .student-report-card td { border: 1px solid #000; padding: 3px 5px; }
                .student-report-card .student-info-table td { padding: 3px 5px; }
                .student-report-card .subjects-table th, .student-report-card .subjects-table td { padding: 3px 5px; font-size: 8pt; }
                .student-report-card .conduct-table td { padding: 3px 5px; font-size: 8pt; }
                .student-report-card .remarks-box { padding: 4px 8px; margin: 4px 0; font-size: 8pt; }
                .student-report-card .remarks-box p { margin: 0; }
                .student-report-card .signatures-table td { padding-top: 15px !important; }
                .student-report-card .report-header h2 { font-size: 16pt; }
                .student-report-card .report-header h3 { font-size: 13pt; }
                .student-report-card .report-header > div { font-size: 9pt; gap: 8px 15px; }
                .student-report-card > div:last-child:not(.signatures-table) { margin: 6px 0; padding: 4px 8px; font-size: 8pt; }
                .student-report-card > div:last-child h4 { font-size: 9pt; margin: 0 0 2px 0; }
                .student-report-card > div:last-child p { font-size: 8pt; margin: 1px 0; }
                .student-report-card .remarks-box p,
                .student-report-card .conduct-table td span {
                    text-transform: uppercase;
                }
            </style>
        </head>
        <body>
            <div class="student-report-card">
                <div class="report-watermark">
                    <div class="watermark-content">
                        <h1>Tina's Little Angels</h1>
                        <p>Preparatory School</p>
                    </div>
                </div>
                <div class="report-header">
                    <h2 style="font-size:18pt; margin:0;">Tina's Little Angels Preparatory School</h2>
                    <h3 style="font-size:14pt; margin:4px 0 6px 0; border-bottom:1px solid #000; padding-bottom:4px;">TERMINAL REPORT SHEET</h3>
                    <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:10px 20px; margin-top:4px; font-size:10pt;">
                        <p style="margin:0;"><strong>TERM:</strong> ${result.term || '-'}</p>
                        <p style="margin:0;"><strong>YEAR:</strong> ${result.academicYear || '-'}</p>
                        <p style="margin:0;"><strong>DATE:</strong> ${result.createdAt ? new Date(result.createdAt.seconds * 1000).toLocaleDateString() : '-'}</p>
                    </div>
                </div>
                <table class="student-info-table" style="width:100%; border-collapse:collapse; margin:10px 0; font-size:9pt;">
                    <tr>
                        <td style="padding:4px 6px; border:1px solid #000;"><strong>NAME:</strong> ${result.studentName || '-'}</td>
                        <td style="padding:4px 6px; border:1px solid #000;"><strong>CLASS:</strong> ${classDisplay}</td>
                    </tr>
                    <tr>
                        <td style="padding:4px 6px; border:1px solid #000;"><strong>POSITION IN CLASS:</strong> ${posDisplay}</td>
                        <td style="padding:4px 6px; border:1px solid #000;"><strong>NEXT TERM BEGINS:</strong> ${result.nextTermBegins ? new Date(result.nextTermBegins).toLocaleDateString() : 'To be announced'}</td>
                    </tr>
                </table>
                ${subjectsHTML ? `
                    <table class="subjects-table" style="width:100%; border-collapse:collapse; margin:10px 0; font-size:8pt;">
                        <thead>
                            <tr>
                                <th style="border:1px solid #000; padding:4px 6px; background:#f5f5f5;">SUBJECTS</th>
                                <th style="border:1px solid #000; padding:4px 6px; background:#f5f5f5;">CLASS SCORE</th>
                                <th style="border:1px solid #000; padding:4px 6px; background:#f5f5f5;">EXAM SCORE</th>
                                <th style="border:1px solid #000; padding:4px 6px; background:#f5f5f5;">TOTAL</th>
                                <th style="border:1px solid #000; padding:4px 6px; background:#f5f5f5;">POSITION</th>
                                <th style="border:1px solid #000; padding:4px 6px; background:#f5f5f5;">REMARKS</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${subjectsHTML}
                        </tbody>
                    </table>
                ` : '<p style="margin:6px 0;">No subject data available.</p>'}
                <div class="conduct-section" style="margin:10px 0;">
                    <table class="conduct-table" style="width:100%; border-collapse:collapse; font-size:8pt;">
                        <tr>
                            <td style="padding:3px 6px; border:1px solid #000;"><strong>ATTENDANCE:</strong> ${result.attendance || '-'} / ${result.totalDays || '-'}</td>
                            <td style="padding:3px 6px; border:1px solid #000;"><strong>PROMOTED TO:</strong> ${result.promotedTo ? safeGetClassDisplayName(result.promotedTo) : 'Same Class'}</td>
                        </tr>
                        <tr>
                            <td style="padding:3px 6px; border:1px solid #000;"><strong>CONDUCT:</strong> <span style="text-transform: uppercase;">${result.conduct || '-'}</span></td>
                            <td style="padding:3px 6px; border:1px solid #000;"><strong>ATTITUDE:</strong> <span style="text-transform: uppercase;">${result.attitude || '-'}</span></td>
                        </tr>
                        <tr>
                            <td colspan="2" style="padding:3px 6px; border:1px solid #000;"><strong>INTEREST:</strong> <span style="text-transform: uppercase;">${result.interest || '-'}</span></td>
                        </tr>
                    </table>
                </div>
                <div class="remarks-box" style="background:#f9f9f9; padding:6px 10px; border:1px solid #ddd; margin:6px 0; font-size:8pt;">
                    <p style="margin:0;"><strong>CLASS TEACHER'S REMARKS:</strong> <span style="text-transform: uppercase;">${result.teacherRemarks || '-'}</span></p>
                </div>
                <div class="remarks-box" style="background:#f9f9f9; padding:6px 10px; border:1px solid #ddd; margin:6px 0; font-size:8pt;">
                    <p style="margin:0;"><strong>HEAD TEACHER'S REMARKS:</strong> <span style="text-transform: uppercase;">${result.headTeacherRemarks || '-'}</span></p>
                </div>
                ${bills.total !== undefined && bills.total !== null ? `
                    <div style="margin:8px 0; padding:8px 12px; border:1px solid #000; font-size:8pt;">
                        <h4 style="margin:0 0 4px 0;">Next Term Bills</h4>
                        <p style="margin:2px 0;"><strong>School Fees:</strong> GH¢ ${(bills.schoolFees || 0).toFixed(2)}</p>
                        <p style="margin:2px 0;"><strong>Arrears:</strong> GH¢ ${(bills.arrears || 0).toFixed(2)}</p>
                        <p style="margin:2px 0;"><strong>Motivational Fees:</strong> GH¢ ${(bills.motivationalFees || 0).toFixed(2)}</p>
                        <p style="margin:2px 0;"><strong>Maintenance Fees:</strong> GH¢ ${(bills.maintenanceFees || 0).toFixed(2)}</p>
                        <p style="margin:2px 0;"><strong>First Aid:</strong> GH¢ ${(bills.firstAid || 0).toFixed(2)}</p>
                        <hr style="margin:4px 0; border:1px dashed #ccc;">
                        <p style="margin:2px 0; font-weight:bold;"><strong>TOTAL:</strong> GH¢ ${(bills.total || 0).toFixed(2)}</p>
                    </div>
                ` : ''}
                <table class="signatures-table" style="width:100%; border:none; margin-top:20px;">
                    <tr>
                        <td style="border:none; width:50%; text-align:center; padding-top:20px;">
                            <strong>CLASS TEACHER:</strong><br>
                            ____________________<br>
                            <small>Signature & Stamp</small>
                        </td>
                        <td style="border:none; width:50%; text-align:center; padding-top:20px;">
                            <strong>HEADMASTER:</strong><br>
                            ____________________<br>
                            <small>Signature & Stamp</small>
                        </td>
                    </tr>
                </table>
            </div>
        </body>
        </html>
    `;
}

// ---- Display report card in modal (with total row) ----
function displayReportCard(result) {
    const container = document.getElementById('reportCardView');
    if (!container) return;

    const classDisplay = safeGetClassDisplayName(result.studentClass);

    let subjectsHTML = '';
    let totalClassScore = 0;
    let totalExamScore = 0;
    let totalOverall = 0;

    if (result.subjects && result.subjects.length > 0) {
        const numericSubjects = result.subjects.filter(s => s.classScore !== undefined || s.examScore !== undefined);
        if (numericSubjects.length > 0) {
            subjectsHTML = numericSubjects.map(subject => {
                const classScore = subject.classScore || 0;
                const examScore = subject.examScore || 0;
                const totalScore = subject.totalScore || 0;
                totalClassScore += classScore;
                totalExamScore += examScore;
                totalOverall += totalScore;
                return `
                    <tr>
                        <td>${subject.name}</td>
                        <td class="text-center">${classScore}</td>
                        <td class="text-center">${examScore}</td>
                        <td class="text-center">${totalScore}</td>
                        <td class="text-center">${subject.position || subject.positionDisplay || '-'}</td>
                        <td>${subject.remarks || '-'}</td>
                    </tr>
                `;
            }).join('');
            // Total row
            subjectsHTML += `
                <tr style="background-color: #f0f0f0; font-weight: bold; border-top: 2px solid #000;">
                    <td><strong>TOTAL</strong></td>
                    <td class="text-center"><strong>${totalClassScore.toFixed(1)}</strong></td>
                    <td class="text-center"><strong>${totalExamScore.toFixed(1)}</strong></td>
                    <td class="text-center"><strong>${totalOverall.toFixed(1)}</strong></td>
                    <td class="text-center">—</td>
                    <td>—</td>
                </tr>
            `;
        } else {
            subjectsHTML = result.subjects.map(subject => `
                <tr>
                    <td>${subject.name}</td>
                    <td class="text-center">${subject.grade || '-'}</td>
                    <td class="text-center">-</td>
                    <td class="text-center">-</td>
                    <td class="text-center">-</td>
                    <td>${subject.remarks || '-'}</td>
                </tr>
            `).join('');
        }
    }

    const posNum = result.positionInClass;
    let posDisplay = 'To be calculated';
    if (posNum !== undefined && posNum !== null && posNum !== '-') {
        posDisplay = ordinalSuffix(posNum);
    }

    const bills = result.bills || {};

    container.innerHTML = `
        <div class="student-report-card" style="padding:15px 20px; font-size:10pt;">
            <div class="report-watermark">
                <div class="watermark-content">
                    <h1>Tina's Little Angels</h1>
                    <p>Preparatory School</p>
                </div>
            </div>

            <div class="report-header">
                <h2 style="font-size:18pt; margin:0;">Tina's Little Angels Preparatory School</h2>
                <h3 style="font-size:14pt; margin:4px 0 6px 0; border-bottom:1px solid #000; padding-bottom:4px;">TERMINAL REPORT SHEET</h3>
                <div style="display:flex; flex-wrap:wrap; justify-content:center; gap:10px 20px; margin-top:4px; font-size:10pt;">
                    <p style="margin:0;"><strong>TERM:</strong> ${result.term || '-'}</p>
                    <p style="margin:0;"><strong>YEAR:</strong> ${result.academicYear || '-'}</p>
                    <p style="margin:0;"><strong>DATE:</strong> ${result.createdAt ? new Date(result.createdAt.seconds * 1000).toLocaleDateString() : '-'}</p>
                </div>
            </div>

            <table class="student-info-table" style="width:100%; border-collapse:collapse; margin:10px 0; font-size:9pt;">
                <tr>
                    <td style="padding:4px 6px; border:1px solid #000;"><strong>NAME:</strong> ${result.studentName || '-'}</td>
                    <td style="padding:4px 6px; border:1px solid #000;"><strong>CLASS:</strong> ${classDisplay}</td>
                </tr>
                <tr>
                    <td style="padding:4px 6px; border:1px solid #000;"><strong>POSITION IN CLASS:</strong> ${posDisplay}</td>
                    <td style="padding:4px 6px; border:1px solid #000;"><strong>NEXT TERM BEGINS:</strong> ${result.nextTermBegins ? new Date(result.nextTermBegins).toLocaleDateString() : 'To be announced'}</td>
                </tr>
            </table>

            ${subjectsHTML ? `
                <table class="subjects-table" style="width:100%; border-collapse:collapse; margin:10px 0; font-size:8pt;">
                    <thead>
                        <tr>
                            <th style="border:1px solid #000; padding:4px 6px; background:#f5f5f5;">SUBJECTS</th>
                            <th style="border:1px solid #000; padding:4px 6px; background:#f5f5f5;">CLASS SCORE</th>
                            <th style="border:1px solid #000; padding:4px 6px; background:#f5f5f5;">EXAM SCORE</th>
                            <th style="border:1px solid #000; padding:4px 6px; background:#f5f5f5;">TOTAL</th>
                            <th style="border:1px solid #000; padding:4px 6px; background:#f5f5f5;">POSITION</th>
                            <th style="border:1px solid #000; padding:4px 6px; background:#f5f5f5;">REMARKS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${subjectsHTML}
                    </tbody>
                </table>
            ` : '<p style="margin:6px 0;">No subject data available.</p>'}

            <div class="conduct-section" style="margin:10px 0;">
                <table class="conduct-table" style="width:100%; border-collapse:collapse; font-size:8pt;">
                    <tr>
                        <td style="padding:3px 6px; border:1px solid #000;"><strong>ATTENDANCE:</strong> ${result.attendance || '-'} / ${result.totalDays || '-'}</td>
                        <td style="padding:3px 6px; border:1px solid #000;"><strong>PROMOTED TO:</strong> ${result.promotedTo ? safeGetClassDisplayName(result.promotedTo) : 'Same Class'}</td>
                    </tr>
                    <tr>
                        <td style="padding:3px 6px; border:1px solid #000;"><strong>CONDUCT:</strong> <span style="text-transform: uppercase;">${result.conduct || '-'}</span></td>
                        <td style="padding:3px 6px; border:1px solid #000;"><strong>ATTITUDE:</strong> <span style="text-transform: uppercase;">${result.attitude || '-'}</span></td>
                    </tr>
                    <tr>
                        <td colspan="2" style="padding:3px 6px; border:1px solid #000;"><strong>INTEREST:</strong> <span style="text-transform: uppercase;">${result.interest || '-'}</span></td>
                    </tr>
                </table>
            </div>

            <div class="remarks-box" style="background:#f9f9f9; padding:6px 10px; border:1px solid #ddd; margin:6px 0; font-size:8pt;">
                <p style="margin:0;"><strong>CLASS TEACHER'S REMARKS:</strong> <span style="text-transform: uppercase;">${result.teacherRemarks || '-'}</span></p>
            </div>
            <div class="remarks-box" style="background:#f9f9f9; padding:6px 10px; border:1px solid #ddd; margin:6px 0; font-size:8pt;">
                <p style="margin:0;"><strong>HEAD TEACHER'S REMARKS:</strong> <span style="text-transform: uppercase;">${result.headTeacherRemarks || '-'}</span></p>
            </div>

${bills.total !== undefined && bills.total !== null ? `
    <div style="margin:8px 0; padding:8px 12px; border:1px solid #000; font-size:8pt;">
        <h4 style="margin:0 0 4px 0;">Next Term Bills</h4>
        <p style="margin:2px 0;"><strong>School Fees:</strong> GH¢ ${(bills.schoolFees || 0).toFixed(2)}</p>
        <p style="margin:2px 0;"><strong>Arrears:</strong> GH¢ ${(bills.arrears || 0).toFixed(2)}</p>
        <p style="margin:2px 0;"><strong>Motivational Fees:</strong> GH¢ ${(bills.motivationalFees || 0).toFixed(2)}</p>
        <p style="margin:2px 0;"><strong>Maintenance Fees:</strong> GH¢ ${(bills.maintenanceFees || 0).toFixed(2)}</p>
        <p style="margin:2px 0;"><strong>First Aid:</strong> GH¢ ${(bills.firstAid || 0).toFixed(2)}</p>
        <hr style="margin:4px 0; border:1px dashed #ccc;">
        <p style="margin:2px 0; font-weight:bold;"><strong>TOTAL:</strong> GH¢ ${(bills.total || 0).toFixed(2)}</p>
    </div>
` : ''}

            <table class="signatures-table" style="width:100%; border:none; margin-top:20px;">
                <tr>
                    <td style="border:none; width:50%; text-align:center; padding-top:20px;">
                        <strong>CLASS TEACHER:</strong><br>
                        ____________________<br>
                        <small>Signature & Stamp</small>
                    </td>
                    <td style="border:none; width:50%; text-align:center; padding-top:20px;">
                        <strong>HEADMASTER:</strong><br>
                        ____________________<br>
                        <small>Signature & Stamp</small>
                    </td>
                </tr>
            </table>
            <!-- Footer removed -->
        </div>
    `;
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

function printCurrentReportCard() {
    window.print();
}

// Expose to global
window.initializeViewResultsPage = initializeViewResultsPage;
window.loadMyResults = loadMyResults;
window.viewFullResult = viewFullResult;
window.printResult = printResult;
window.closeModal = closeModal;
window.printCurrentReportCard = printCurrentReportCard;
window.safeGetClassDisplayName = safeGetClassDisplayName;