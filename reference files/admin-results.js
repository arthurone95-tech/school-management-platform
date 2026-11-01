// ============================================
// ADMIN RESULTS MANAGEMENT FUNCTIONS
// Tina's Little Angels Preparatory School
// ============================================

let allResults = [];
let filteredResults = [];

// Get class display name (uses global function from admin.js)
function safeGetClassDisplayName(classValue) {
    if (typeof window.getClassDisplayName === 'function') {
        return window.getClassDisplayName(classValue);
    }
    // Fallback mapping
    const fallbackMap = {
        'creche': 'Crèche', 'nursery1': 'Nursery 1', 'nursery2': 'Nursery 2',
        'kg1': 'Kindergarten 1', 'kg2': 'Kindergarten 2',
        'basic1': 'Basic 1', 'basic2': 'Basic 2', 'basic3': 'Basic 3',
        'basic4': 'Basic 4', 'basic5': 'Basic 5', 'basic6': 'Basic 6',
        'jhs1': 'JHS 1', 'jhs2': 'JHS 2', 'jhs3': 'JHS 3'
    };
    return fallbackMap[classValue] || classValue.toUpperCase();
}

// Ordinal suffix helper
function ordinalSuffix(n) {
    if (isNaN(n) || n === '-') return '-';
    const num = parseInt(n);
    if (num === 0) return '0';
    const s = ['th','st','nd','rd'];
    const v = num % 100;
    return num + (s[(v-20)%10] || s[v] || s[0]);
}

// Initialize school results page
async function initializeSchoolResultsPage() {
    console.log('Initializing school results page...');
    
    try {
        // Hide loading spinner immediately
        const loadingElement = document.getElementById('loading');
        if (loadingElement) loadingElement.style.display = 'none';
        
        await populateAcademicYears();
        await loadSchoolResults();
        
    } catch (error) {
        console.error('Error initializing school results:', error);
        showMessage('Error loading results: ' + error.message, 'error');
        const loadingElement = document.getElementById('loading');
        if (loadingElement) loadingElement.style.display = 'none';
    }
}

// Populate academic years dropdown
async function populateAcademicYears() {
    try {
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
    } catch (error) {
        console.error('Error populating years:', error);
    }
}

// Load all school results
async function loadSchoolResults() {
    try {
        const tableBody = document.getElementById('schoolResultsTable');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <i class="fas fa-spinner fa-spin"></i> Loading results...
                    </td>
                </tr>
            `;
        }
        
        const classFilter = document.getElementById('filterClass')?.value || 'all';
        const yearFilter = document.getElementById('filterYear')?.value || 'all';
        const termFilter = document.getElementById('filterTerm')?.value || 'all';
        const searchQuery = document.getElementById('searchStudent')?.value.toLowerCase() || '';
        
        let query = db.collection('results');
        
        if (classFilter && classFilter !== 'all') {
            query = query.where('studentClass', '==', classFilter);
        }
        if (yearFilter && yearFilter !== 'all') {
            query = query.where('academicYear', '==', yearFilter);
        }
        if (termFilter && termFilter !== 'all') {
            query = query.where('term', '==', termFilter);
        }
        
        const snapshot = await query.get();
        
        allResults = [];
        const studentsMap = new Map();
        
        snapshot.forEach(doc => {
            const result = { id: doc.id, ...doc.data() };
            const studentId = result.studentId;
            
            if (!studentsMap.has(studentId)) {
                studentsMap.set(studentId, {
                    studentId: studentId,
                    studentName: result.studentName,
                    studentClass: result.studentClass,
                    results: []
                });
            }
            studentsMap.get(studentId).results.push(result);
        });
        
        filteredResults = Array.from(studentsMap.values());
        
        if (searchQuery) {
            filteredResults = filteredResults.filter(student => 
                student.studentName.toLowerCase().includes(searchQuery)
            );
        }
        
        updateResultsStatistics();
        renderSchoolResultsTable();
        updateClassResultsGrid();
        
    } catch (error) {
        console.error('Error loading school results:', error);
        const tableBody = document.getElementById('schoolResultsTable');
        if (tableBody) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center error">
                        <i class="fas fa-exclamation-triangle"></i>
                        <p>Error loading results: ${error.message}</p>
                        <button class="btn-outline btn-sm" onclick="loadSchoolResults()">
                            <i class="fas fa-sync-alt"></i> Try Again
                        </button>
                    </td>
                </tr>
            `;
        }
        showMessage('Error loading results: ' + error.message, 'error');
    }
}

// Update results statistics
function updateResultsStatistics() {
    let totalResults = 0;
    let totalScore = 0;
    let scoreCount = 0;
    const classesSet = new Set();
    let latestTerm = '-';
    
    filteredResults.forEach(student => {
        student.results.forEach(result => {
            totalResults++;
            
            if (result.subjects && result.subjects.length > 0) {
                const subjectTotal = result.subjects.reduce((sum, subject) => {
                    return sum + (subject.totalScore || 0);
                }, 0);
                const averageScore = subjectTotal / result.subjects.length;
                totalScore += averageScore;
                scoreCount++;
            }
            
            classesSet.add(result.studentClass);
            if (result.createdAt) {
                latestTerm = result.term || '-';
            }
        });
    });
    
    document.getElementById('totalResults').textContent = totalResults;
    document.getElementById('resultsShowing').textContent = filteredResults.length;
    
    const avgScore = scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0;
    document.getElementById('avgScore').textContent = avgScore + '%';
    document.getElementById('classesWithResults').textContent = classesSet.size;
    document.getElementById('latestTerm').textContent = latestTerm;
}

// Render school results table
function renderSchoolResultsTable() {
    const tableBody = document.getElementById('schoolResultsTable');
    if (!tableBody) return;
    
    if (filteredResults.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center">
                    <i class="fas fa-user-graduate"></i>
                    <p>No results found for the selected filters.</p>
                    <button class="btn-outline btn-sm" onclick="loadSchoolResults()">
                        <i class="fas fa-sync-alt"></i> Refresh
                    </button>
                </td>
            </tr>
        `;
        return;
    }
    
    let tableHTML = '';
    
    filteredResults.forEach(student => {
        const term1Results = student.results.filter(r => r.term === 'Term 1');
        const term2Results = student.results.filter(r => r.term === 'Term 2');
        const term3Results = student.results.filter(r => r.term === 'Term 3');
        const latestResult = student.results[0];
        
        tableHTML += `
            <tr>
                <td><strong>${escapeHtml(student.studentName)}</strong></td>
                <td><span class="badge">${safeGetClassDisplayName(student.studentClass)}</span></td>
                <td>${latestResult ? latestResult.academicYear : '-'}</td>
                <td>
                    ${term1Results.length > 0 ? 
                        `<span class="badge success" style="cursor:pointer" onclick="viewStudentResult('${student.studentId}', 'Term 1')">
                            <i class="fas fa-eye"></i> View
                        </span>` : 
                        '<span class="badge danger">No Results</span>'}
                </td>
                <td>
                    ${term2Results.length > 0 ? 
                        `<span class="badge success" style="cursor:pointer" onclick="viewStudentResult('${student.studentId}', 'Term 2')">
                            <i class="fas fa-eye"></i> View
                        </span>` : 
                        '<span class="badge danger">No Results</span>'}
                </td>
                <td>
                    ${term3Results.length > 0 ? 
                        `<span class="badge success" style="cursor:pointer" onclick="viewStudentResult('${student.studentId}', 'Term 3')">
                            <i class="fas fa-eye"></i> View
                        </span>` : 
                        '<span class="badge danger">No Results</span>'}
                </td>
                <td>
                    <button class="btn-outline btn-sm" onclick="printStudentReportCard('${student.studentId}')">
                        <i class="fas fa-print"></i> Print
                    </button>
                </td>
            </tr>
        `;
    });
    
    tableBody.innerHTML = tableHTML;
}

// Escape HTML
function escapeHtml(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Update class results grid
function updateClassResultsGrid() {
    const grid = document.getElementById('classResultsGrid');
    if (!grid) return;
    
    const classCounts = {};
    filteredResults.forEach(student => {
        const className = student.studentClass;
        classCounts[className] = (classCounts[className] || 0) + student.results.length;
    });
    
    const classList = [
        { value: 'creche', label: 'Crèche' },
        { value: 'nursery1', label: 'Nursery 1' },
        { value: 'nursery2', label: 'Nursery 2' },
        { value: 'kg1', label: 'Kindergarten 1' },
        { value: 'kg2', label: 'Kindergarten 2' },
        { value: 'basic1', label: 'Basic 1' },
        { value: 'basic2', label: 'Basic 2' },
        { value: 'basic3', label: 'Basic 3' },
        { value: 'basic4', label: 'Basic 4' },
        { value: 'basic5', label: 'Basic 5' },
        { value: 'basic6', label: 'Basic 6' },
        { value: 'jhs1', label: 'JHS 1' },
        { value: 'jhs2', label: 'JHS 2' },
        { value: 'jhs3', label: 'JHS 3' }
    ];
    
    // If no results, show message
    if (Object.keys(classCounts).length === 0) {
        grid.innerHTML = `
            <div class="text-center" style="grid-column: 1 / -1; padding: 30px;">
                <i class="fas fa-chart-bar" style="font-size: 2rem; color: #ccc;"></i>
                <p style="color: #888; margin-top: 10px;">No results available by class.</p>
            </div>
        `;
        return;
    }
    
    let gridHTML = '';
    classList.forEach(classObj => {
        const className = classObj.value;
        if (classCounts[className]) {
            const classDisplayName = classObj.label;
            const count = classCounts[className];
            
            gridHTML += `
                <div class="class-result-card">
                    <div class="class-icon">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="class-info">
                        <h4>${classDisplayName}</h4>
                        <p>${count} result${count !== 1 ? 's' : ''}</p>
                    </div>
                    <button class="btn-outline btn-sm" onclick="filterByClass('${className}')">
                        <i class="fas fa-filter"></i> View
                    </button>
                </div>
            `;
        }
    });
    
    grid.innerHTML = gridHTML;
}

// View student result
async function viewStudentResult(studentId, term) {
    try {
        const query = await db.collection('results')
            .where('studentId', '==', studentId)
            .where('term', '==', term)
            .limit(1)
            .get();
        
        if (!query.empty) {
            const resultDoc = query.docs[0];
            const result = { id: resultDoc.id, ...resultDoc.data() };
            displayReportCard(result);
            document.getElementById('viewReportCardModal').style.display = 'flex';
        } else {
            showMessage('No results found for selected term.', 'info');
        }
    } catch (error) {
        console.error('Error viewing student result:', error);
        showMessage('Error loading result: ' + error.message, 'error');
    }
}

// Filter by class
function filterByClass(className) {
    const classFilter = document.getElementById('filterClass');
    if (classFilter) classFilter.value = className;
    loadSchoolResults();
}

// ---- Display report card with total row and ordinal suffix ----
function displayReportCard(result) {
    const container = document.getElementById('reportCardContent');
    if (!container) return;
    
    const classDisplay = safeGetClassDisplayName(result.studentClass);
    
    let subjectsHTML = '';
    let totalClassScore = 0;
    let totalExamScore = 0;
    let totalOverall = 0;
    let hasNumericSubjects = false;

    // Check if we have numeric subjects (Basic 1 to JHS 3)
    // We can detect if any subject has classScore/examScore defined.
    if (result.subjects && result.subjects.length > 0) {
        // Filter subjects that have numeric scores (not creche/early years)
        const numericSubjects = result.subjects.filter(s => s.classScore !== undefined || s.examScore !== undefined);
        if (numericSubjects.length > 0) {
            hasNumericSubjects = true;
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

            // Add total row after subjects
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
            // For creche/early years, just show grades
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
    
    // Position formatting
    const posNum = result.positionInClass;
    let posDisplay = 'To be calculated';
    if (posNum !== undefined && posNum !== null && posNum !== '-') {
        posDisplay = ordinalSuffix(posNum);
    }

    const bills = result.bills || {};
    
    const reportHTML = `
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
                    <td style="padding:4px 6px; border:1px solid #000;"><strong>NEXT TERM BEGINS:</strong> ${result.nextTermBegins ? formatDate(result.nextTermBegins) : 'To be announced'}</td>
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
            <!-- Footer removed to save space -->
        </div>
    `;
    
    container.innerHTML = reportHTML;
}

// Format date helper
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
}

// Print student report card – updated with print styles
async function printStudentReportCard(studentId) {
    try {
        const query = await db.collection('results')
            .where('studentId', '==', studentId)
            .limit(1)
            .get();
        
        if (!query.empty) {
            const resultDoc = query.docs[0];
            const result = { id: resultDoc.id, ...resultDoc.data() };
            displayReportCard(result);
            setTimeout(() => {
                const printContent = document.getElementById('reportCardContent').innerHTML;
                const originalContent = document.body.innerHTML;
                
                document.body.innerHTML = `
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
                        </style>
                    </head>
                    <body>
                        ${printContent}
                    </body>
                    </html>
                `;
                
                window.print();
                document.body.innerHTML = originalContent;
                location.reload();
            }, 500);
        } else {
            showMessage('No results found for this student.', 'info');
        }
    } catch (error) {
        console.error('Error printing report card:', error);
        showMessage('Error printing: ' + error.message, 'error');
    }
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

// Export functions
window.loadSchoolResults = loadSchoolResults;
window.filterByClass = filterByClass;
window.viewStudentResult = viewStudentResult;
window.printStudentReportCard = printStudentReportCard;
window.closeModal = closeModal;
window.initializeSchoolResultsPage = initializeSchoolResultsPage;
window.safeGetClassDisplayName = safeGetClassDisplayName;