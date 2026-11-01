// ============================================
// TEACHER RESULTS MANAGEMENT FUNCTIONS
// Tina's Little Angels Preparatory School
// ============================================

let currentTeacherUser = null;
let teacherAssignedClasses = [];
let classStudentsList = [];
let currentResultsData = null;
let academicYears = [];

// We use the global getClassDisplayName from teacher.js
// and getSubjectsForClass, isHeading from firebase-config.js

// Initialize enter results page
async function initializeEnterResultsPage() {
    console.log('Initializing enter results page...');
    
    try {
        // Hide loading spinner immediately
        const loadingEl = document.getElementById('loading');
        if (loadingEl) loadingEl.style.display = 'none';
        
        currentTeacherUser = auth.currentUser;
        if (!currentTeacherUser) {
            window.location.href = 'login.html';
            return;
        }
        
        const teacherDoc = await db.collection('teachers').doc(currentTeacherUser.uid).get();
        if (teacherDoc.exists) {
            const teacherData = teacherDoc.data();
            teacherAssignedClasses = teacherData.assignedClasses || [];
            
            populateAssignedClasses();
            await populateAcademicYears();
            await loadRecentResults();
        }
        
    } catch (error) {
        console.error('Error initializing enter results:', error);
        showMessage('Error loading portal: ' + error.message, 'error');
    }
}

// Populate assigned classes dropdown
function populateAssignedClasses() {
    const classSelect = document.getElementById('selectedClass');
    classSelect.innerHTML = '<option value="">Select Class</option>';
    
    teacherAssignedClasses.forEach(className => {
        const option = document.createElement('option');
        option.value = className;
        // Use global getClassDisplayName
        option.textContent = window.getClassDisplayName ? window.getClassDisplayName(className) : className.toUpperCase();
        classSelect.appendChild(option);
    });
    
    if (teacherAssignedClasses.length === 1) {
        classSelect.value = teacherAssignedClasses[0];
        loadStudentsForClass(teacherAssignedClasses[0]);
    }
}

// Populate academic years
async function populateAcademicYears() {
    const yearSelect = document.getElementById('academicYear');
    yearSelect.innerHTML = '<option value="">Select Academic Year</option>';
    
    const currentYear = new Date().getFullYear();
    const currentAcademicYear = `${currentYear}-${currentYear + 1}`;
    const nextAcademicYear = `${currentYear + 1}-${currentYear + 2}`;
    
    academicYears = [currentAcademicYear, nextAcademicYear];
    
    academicYears.forEach(year => {
        const option = document.createElement('option');
        option.value = year;
        option.textContent = year;
        yearSelect.appendChild(option);
    });
    
    yearSelect.value = currentAcademicYear;
}

// Load students for selected class
async function loadStudentsForClass(className) {
    try {
        const studentSelect = document.getElementById('selectedStudent');
        studentSelect.innerHTML = '<option value="">Select Student</option>';
        
        // No orderBy to avoid index requirement
        const snapshot = await db.collection('students')
            .where('class', '==', className)
            .get();
        
        classStudentsList = [];
        snapshot.forEach(doc => {
            const student = { id: doc.id, ...doc.data() };
            classStudentsList.push(student);
            
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = `${student.firstName} ${student.lastName}`;
            studentSelect.appendChild(option);
        });
        
        // Sort client-side
        classStudentsList.sort((a, b) => {
            const nameA = `${a.firstName || ''} ${a.lastName || ''}`.trim();
            const nameB = `${b.firstName || ''} ${b.lastName || ''}`.trim();
            return nameA.localeCompare(nameB);
        });
        
        if (classStudentsList.length === 0) {
            showMessage(`No students found in ${getClassDisplayName(className)} class.`, 'info');
        }
        
    } catch (error) {
        console.error('Error loading students:', error);
        showMessage('Error loading students: ' + error.message, 'error');
    }
}

// Load student for results entry
async function loadStudentForResults() {
    try {
        const academicYear = document.getElementById('academicYear').value;
        const term = document.getElementById('term').value;
        const className = document.getElementById('selectedClass').value;
        const studentId = document.getElementById('selectedStudent').value;
        
        if (!academicYear || !term || !className || !studentId) {
            showMessage('Please select all required fields.', 'error');
            return;
        }
        
        const selectedStudent = classStudentsList.find(s => s.id === studentId);
        if (!selectedStudent) {
            showMessage('Student not found. Please select again.', 'error');
            return;
        }
        
        const existingResults = await checkExistingResults(studentId, academicYear, term);
        
        currentResultsData = {
            studentId: studentId,
            studentName: `${selectedStudent.firstName} ${selectedStudent.lastName}`,
            studentClass: className,
            academicYear: academicYear,
            term: term,
            subjects: [],
            attendance: '',
            totalDays: '',
            conduct: '',
            attitude: '',
            interest: '',
            teacherRemarks: '',
            headTeacherRemarks: '',
            promotedTo: '',
            nextTermBegins: '',
            bills: { schoolFees: 0, arrears: 0, total: 0 },
            existingResultId: existingResults ? existingResults.id : null
        };
        
        document.getElementById('currentStudentName').textContent = currentResultsData.studentName;
        document.getElementById('currentStudentClass').textContent = getClassDisplayName(className);
        document.getElementById('currentAcademicYear').textContent = academicYear;
        document.getElementById('currentTerm').textContent = term;
        
        generateSubjectsForm(className, existingResults);
        populatePromotionDropdown(className);
        
        if (existingResults) {
            prefillExistingResults(existingResults);
            showMessage(`Editing existing results for ${term} ${academicYear}.`, 'info');
        } else {
            showMessage(`Ready to enter new results for ${selectedStudent.firstName}.`, 'success');
        }
        
        document.getElementById('resultsEntrySection').style.display = 'block';
        document.getElementById('resultsEntrySection').scrollIntoView({ behavior: 'smooth' });
        
    } catch (error) {
        console.error('Error loading student:', error);
        showMessage('Error loading student: ' + error.message, 'error');
    }
}

// Populate promotion dropdown
function populatePromotionDropdown(currentClass) {
    const promotionSelect = document.getElementById('promotedTo');
    const nextClass = getNextClass(currentClass);
    
    promotionSelect.innerHTML = '<option value="">Same Class (Repeat)</option>';
    
    if (nextClass) {
        const nextClassDisplay = getClassDisplayName(nextClass);
        promotionSelect.innerHTML += `<option value="${nextClass}">${nextClassDisplay}</option>`;
    }
    
    if (currentClass === 'jhs3') {
        promotionSelect.innerHTML += `<option value="graduated">Graduated</option>`;
    }
    
    promotionSelect.value = '';
}

// Check for existing results
async function checkExistingResults(studentId, academicYear, term) {
    try {
        const query = await db.collection('results')
            .where('studentId', '==', studentId)
            .where('academicYear', '==', academicYear)
            .where('term', '==', term)
            .limit(1)
            .get();
        
        if (!query.empty) {
            const doc = query.docs[0];
            return { id: doc.id, ...doc.data() };
        }
        return null;
    } catch (error) {
        console.error('Error checking existing results:', error);
        return null;
    }
}

// Generate subjects form (with total row)
function generateSubjectsForm(className, existingResults = null) {
    const container = document.getElementById('subjectsContainer');
    const subjects = getSubjectsForClass(className);
    
    const isCreche = className === 'creche';
    const isEarlyYears = ['nursery1', 'nursery2', 'kg1', 'kg2'].includes(className);
    
    let subjectsHTML = '';
    let totalRowHTML = '';
    
    if (isCreche) {
        let selectableIndex = 0;
        subjects.forEach((subject) => {
            if (isHeading(subject)) {
                subjectsHTML += `
                    <div class="subject-row creche-subject heading-row">
                        <div class="subject-name">
                            <label style="font-weight: bold; font-size: 16px; color: #000;">${subject}</label>
                        </div>
                        <div class="subject-grades"></div>
                    </div>
                `;
            } else {
                const existingSubject = existingResults?.subjects?.find(s => s.name === subject);
                const selectedVG = existingSubject?.grade === 'VG' ? 'checked' : '';
                const selectedG = existingSubject?.grade === 'G' ? 'checked' : '';
                const selectedNH = existingSubject?.grade === 'NH' ? 'checked' : '';
                
                subjectsHTML += `
                    <div class="subject-row creche-subject">
                        <div class="subject-name">
                            <label>${subject}</label>
                        </div>
                        <div class="subject-grades">
                            <label class="grade-option">
                                <input type="radio" name="subject_${selectableIndex}" value="VG" ${selectedVG}>
                                <span>VG</span>
                            </label>
                            <label class="grade-option">
                                <input type="radio" name="subject_${selectableIndex}" value="G" ${selectedG}>
                                <span>G</span>
                            </label>
                            <label class="grade-option">
                                <input type="radio" name="subject_${selectableIndex}" value="NH" ${selectedNH}>
                                <span>NH</span>
                            </label>
                        </div>
                    </div>
                `;
                selectableIndex++;
            }
        });
        // No total row for creche
    } else if (isEarlyYears) {
        subjectsHTML = `
            <div class="subject-header-row early-years-header">
                <div class="subject-name-col">LEARNING AREAS</div>
                <div class="subject-grade-col">VG</div>
                <div class="subject-grade-col">G</div>
                <div class="subject-grade-col">NH</div>
            </div>
        `;
        subjects.forEach((subject, index) => {
            const existingSubject = existingResults?.subjects?.find(s => s.name === subject);
            const selectedVG = existingSubject?.grade === 'VG' ? 'checked' : '';
            const selectedG = existingSubject?.grade === 'G' ? 'checked' : '';
            const selectedNH = existingSubject?.grade === 'NH' ? 'checked' : '';
            
            subjectsHTML += `
                <div class="subject-row early-years-row">
                    <div class="subject-name-col"><label>${subject}</label></div>
                    <div class="subject-grade-col">
                        <label class="grade-option">
                            <input type="radio" name="subject_${index}" value="VG" ${selectedVG}>
                            <span>VG</span>
                        </label>
                    </div>
                    <div class="subject-grade-col">
                        <label class="grade-option">
                            <input type="radio" name="subject_${index}" value="G" ${selectedG}>
                            <span>G</span>
                        </label>
                    </div>
                    <div class="subject-grade-col">
                        <label class="grade-option">
                            <input type="radio" name="subject_${index}" value="NH" ${selectedNH}>
                            <span>NH</span>
                        </label>
                    </div>
                </div>
            `;
        });
        // No total row for early years
    } else {
        // ---- Numeric subjects (Basic 1 to JHS 3) ----
        subjectsHTML = `
            <div class="subject-header-row">
                <div class="subject-name-col">SUBJECTS</div>
                <div class="subject-score-col">CLASS SCORE (50%)</div>
                <div class="subject-score-col">EXAM SCORE (50%)</div>
                <div class="subject-total-col">TOTAL (100%)</div>
                <div class="subject-remarks-col">REMARKS</div>
            </div>
        `;
        subjects.forEach((subject, index) => {
            const existingSubject = existingResults?.subjects?.find(s => s.name === subject);
            const classScore = existingSubject?.classScore || '';
            const examScore = existingSubject?.examScore || '';
            const totalScore = existingSubject?.totalScore || '';
            const remarks = existingSubject?.remarks || '';
            
            subjectsHTML += `
                <div class="subject-row" data-subject-index="${index}">
                    <div class="subject-name-col"><label>${subject}</label></div>
                    <div class="subject-score-col">
                        <input type="number" class="class-score" data-index="${index}" min="0" max="50" step="0.5" value="${classScore}" placeholder="0-50" oninput="calculateSubjectTotal(${index})">
                    </div>
                    <div class="subject-score-col">
                        <input type="number" class="exam-score" data-index="${index}" min="0" max="50" step="0.5" value="${examScore}" placeholder="0-50" oninput="calculateSubjectTotal(${index})">
                    </div>
                    <div class="subject-total-col">
                        <input type="number" class="total-score" data-index="${index}" readonly value="${totalScore}" placeholder="Auto">
                    </div>
                    <div class="subject-remarks-col">
                        <input type="text" class="subject-remarks" data-index="${index}" value="${remarks}" placeholder="Remarks" readonly>
                    </div>
                </div>
            `;
        });

        // ---- TOTAL ROW ----
        totalRowHTML = `
            <div id="totalRow" class="subject-row total-row" style="background-color: #f0f0f0; font-weight: bold; border-top: 2px solid #000;">
                <div class="subject-name-col" style="font-weight: bold;">TOTAL</div>
                <div class="subject-score-col">
                    <input type="text" id="totalClassScore" readonly value="0.0" style="background: transparent; font-weight: bold; border: none; text-align: center;">
                </div>
                <div class="subject-score-col">
                    <input type="text" id="totalExamScore" readonly value="0.0" style="background: transparent; font-weight: bold; border: none; text-align: center;">
                </div>
                <div class="subject-total-col">
                    <input type="text" id="totalOverallScore" readonly value="0.0" style="background: transparent; font-weight: bold; border: none; text-align: center;">
                </div>
                <div class="subject-remarks-col" style="text-align: center;">—</div>
            </div>
        `;
    }
    
    container.innerHTML = subjectsHTML + totalRowHTML;
    
    // If existing results exist, populate totals after rendering
    if (existingResults && !isCreche && !isEarlyYears) {
        setTimeout(updateTotalRow, 50);
    }
}

// Pre-fill existing results
function prefillExistingResults(existingResults) {
    if (existingResults.attendance) document.getElementById('attendanceDays').value = existingResults.attendance;
    if (existingResults.totalDays) document.getElementById('totalDays').value = existingResults.totalDays;
    if (existingResults.conduct) document.getElementById('conduct').value = existingResults.conduct;
    if (existingResults.attitude) document.getElementById('attitude').value = existingResults.attitude;
    if (existingResults.interest) document.getElementById('interest').value = existingResults.interest;
    if (existingResults.teacherRemarks) document.getElementById('teacherRemarks').value = existingResults.teacherRemarks;
    if (existingResults.headTeacherRemarks) document.getElementById('headTeacherRemarks').value = existingResults.headTeacherRemarks;
    if (existingResults.promotedTo) document.getElementById('promotedTo').value = existingResults.promotedTo;
    if (existingResults.nextTermBegins) document.getElementById('nextTermBegins').value = existingResults.nextTermBegins;
    if (existingResults.bills) {
        document.getElementById('schoolFees').value = existingResults.bills.schoolFees || 0;
        document.getElementById('arrears').value = existingResults.bills.arrears || 0;
        document.getElementById('motivationalFees').value = existingResults.bills.motivationalFees || 0;
        document.getElementById('maintenanceFees').value = existingResults.bills.maintenanceFees || 0;
        document.getElementById('firstAid').value = existingResults.bills.firstAid || 0;
        calculateBillsTotal();
    }
}

// ---- TOTAL ROW UPDATE ----
function updateTotalRow() {
    const totalClassInput = document.getElementById('totalClassScore');
    const totalExamInput = document.getElementById('totalExamScore');
    const totalOverallInput = document.getElementById('totalOverallScore');
    if (!totalClassInput) return; // not in creche/early years

    const classScoreInputs = document.querySelectorAll('.class-score');
    const examScoreInputs = document.querySelectorAll('.exam-score');
    const totalScoreInputs = document.querySelectorAll('.total-score');

    let sumClass = 0, sumExam = 0, sumTotal = 0;
    classScoreInputs.forEach(inp => { sumClass += parseFloat(inp.value) || 0; });
    examScoreInputs.forEach(inp => { sumExam += parseFloat(inp.value) || 0; });
    totalScoreInputs.forEach(inp => { sumTotal += parseFloat(inp.value) || 0; });

    totalClassInput.value = sumClass.toFixed(1);
    totalExamInput.value = sumExam.toFixed(1);
    totalOverallInput.value = sumTotal.toFixed(1);
}

// ---- VALIDATION + TOTAL UPDATE ----
function calculateSubjectTotal(index) {
    const classScoreInput = document.querySelector(`.class-score[data-index="${index}"]`);
    const examScoreInput = document.querySelector(`.exam-score[data-index="${index}"]`);
    const totalScoreInput = document.querySelector(`.total-score[data-index="${index}"]`);
    const remarksInput = document.querySelector(`.subject-remarks[data-index="${index}"]`);
    
    if (!classScoreInput || !examScoreInput || !totalScoreInput || !remarksInput) return;
    
    let classScore = parseFloat(classScoreInput.value) || 0;
    let examScore = parseFloat(examScoreInput.value) || 0;
    
    // Enforce max 50 with red highlight
    if (classScore > 50) {
        classScore = 50;
        classScoreInput.value = 50;
        classScoreInput.classList.add('invalid-score');
    } else {
        classScoreInput.classList.remove('invalid-score');
    }
    if (examScore > 50) {
        examScore = 50;
        examScoreInput.value = 50;
        examScoreInput.classList.add('invalid-score');
    } else {
        examScoreInput.classList.remove('invalid-score');
    }
    
    const totalScore = classScore + examScore;
    totalScoreInput.value = totalScore.toFixed(1);
    
    // Calculate remarks
    let remarks = '';
    if (totalScore >= 80) remarks = 'High Proficiency';
    else if (totalScore >= 70) remarks = 'Proficient';
    else if (totalScore >= 50) remarks = 'Approaching Proficient';
    else remarks = 'Emerging';
    remarksInput.value = remarks;

    // Update total row
    updateTotalRow();
}

// Validate and save
function validateAndSave() {
    if (!document.getElementById('attendanceDays').value || !document.getElementById('totalDays').value) {
        showMessage('Please enter attendance days.', 'error');
        return;
    }
    if (!document.getElementById('nextTermBegins').value) {
        showMessage('Please select Next Term Begins date.', 'error');
        return;
    }
    
    const promotedTo = document.getElementById('promotedTo').value;
    if (promotedTo && promotedTo !== '') {
        const currentClass = currentResultsData.studentClass;
        const nextClass = getNextClass(currentClass);
        if (promotedTo !== nextClass && !(currentClass === 'jhs3' && promotedTo === 'graduated')) {
            showMessage(`Invalid promotion selection.`, 'error');
            return;
        }
    }
    
    document.getElementById('confirmStudentName').textContent = currentResultsData.studentName;
    document.getElementById('confirmStudentClass').textContent = getClassDisplayName(currentResultsData.studentClass);
    document.getElementById('confirmAcademicYear').textContent = currentResultsData.academicYear;
    document.getElementById('confirmTerm').textContent = currentResultsData.term;
    
    document.getElementById('confirmSaveModal').style.display = 'flex';
}

// Collect results data
function collectResultsData() {
    const className = currentResultsData.studentClass;
    const isCreche = className === 'creche';
    const isEarlyYears = ['nursery1', 'nursery2', 'kg1', 'kg2'].includes(className);
    
    const subjects = [];
    
    if (isCreche || isEarlyYears) {
        const subjectNames = getSubjectsForClass(className);
        subjectNames.forEach((subjectName, index) => {
            if (!isHeading(subjectName)) {
                const selectedGrade = document.querySelector(`input[name="subject_${index}"]:checked`);
                if (selectedGrade) {
                    subjects.push({ name: subjectName, grade: selectedGrade.value });
                }
            }
        });
    } else {
        const subjectNames = getSubjectsForClass(className);
        subjectNames.forEach((subjectName, index) => {
            const classScoreInput = document.querySelector(`.class-score[data-index="${index}"]`);
            const examScoreInput = document.querySelector(`.exam-score[data-index="${index}"]`);
            const totalScoreInput = document.querySelector(`.total-score[data-index="${index}"]`);
            const remarksInput = document.querySelector(`.subject-remarks[data-index="${index}"]`);
            
            const classScore = parseFloat(classScoreInput?.value) || 0;
            const examScore = parseFloat(examScoreInput?.value) || 0;
            
            // Only add subjects that have at least one score entered (or total > 0)
            if (classScore > 0 || examScore > 0) {
                subjects.push({
                    name: subjectName,
                    classScore: classScore,
                    examScore: examScore,
                    totalScore: parseFloat(totalScoreInput?.value) || 0,
                    remarks: remarksInput?.value || ''
                });
            }
        });
    }
    
    const billsData = {
        schoolFees: parseFloat(document.getElementById('schoolFees').value) || 0,
        arrears: parseFloat(document.getElementById('arrears').value) || 0,
        motivationalFees: parseFloat(document.getElementById('motivationalFees').value) || 0,
        maintenanceFees: parseFloat(document.getElementById('maintenanceFees').value) || 0,
        firstAid: parseFloat(document.getElementById('firstAid').value) || 0,
        total: parseFloat(document.getElementById('billsTotal').value) || 0
    };
    
    return {
        ...currentResultsData,
        subjects: subjects,
        attendance: document.getElementById('attendanceDays').value,
        totalDays: document.getElementById('totalDays').value,
        conduct: document.getElementById('conduct').value,
        attitude: document.getElementById('attitude').value,
        interest: document.getElementById('interest').value,
        teacherRemarks: document.getElementById('teacherRemarks').value,
        headTeacherRemarks: document.getElementById('headTeacherRemarks').value,
        promotedTo: document.getElementById('promotedTo').value,
        nextTermBegins: document.getElementById('nextTermBegins').value,
        bills: billsData,
        createdBy: currentTeacherUser.uid,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
}

// ---- RECALCULATE POSITIONS (store rank as number) ----
async function recalculateClassPositions(studentClass, academicYear, term) {
    try {
        // Only recalc for classes with numeric scores (Basic 1 to JHS 3)
        const numericClasses = ['basic1','basic2','basic3','basic4','basic5','basic6','jhs1','jhs2','jhs3'];
        if (!numericClasses.includes(studentClass)) return;

        console.log(`Recalculating positions for ${studentClass}, ${academicYear}, ${term}...`);

        // Fetch all results for this class, year, and term
        const snapshot = await db.collection('results')
            .where('studentClass', '==', studentClass)
            .where('academicYear', '==', academicYear)
            .where('term', '==', term)
            .get();

        if (snapshot.empty) return;

        // Build a map: studentId -> result data (with id)
        const studentResults = {};
        snapshot.forEach(doc => {
            const data = doc.data();
            studentResults[doc.id] = { id: doc.id, ...data };
        });

        // Get the list of subjects for this class (only actual subjects, no headings)
        const allSubjects = getSubjectsForClass(studentClass);
        const subjectNames = allSubjects.filter(s => !isHeading(s));

        // --- 1. Calculate subject positions ---
        const subjectRanks = {};

        subjectNames.forEach(subjectName => {
            // Collect scores for this subject from all students
            const scores = [];
            for (const [docId, result] of Object.entries(studentResults)) {
                const subjectData = result.subjects?.find(s => s.name === subjectName);
                const score = subjectData?.totalScore || 0;
                scores.push({ docId, score });
            }

            // Sort descending
            scores.sort((a, b) => b.score - a.score);

            // Assign ranks (competition ranking: 1,2,2,4...)
            let rank = 1;
            for (let i = 0; i < scores.length; i++) {
                if (i > 0 && scores[i].score < scores[i - 1].score) {
                    rank = i + 1;
                }
                // Store rank per docId
                if (!subjectRanks[subjectName]) subjectRanks[subjectName] = {};
                subjectRanks[subjectName][scores[i].docId] = rank;
            }
        });

        // --- 2. Calculate overall class position (numeric) ---
        const overallScores = [];
        for (const [docId, result] of Object.entries(studentResults)) {
            let totalSum = 0;
            subjectNames.forEach(subjectName => {
                const subjectData = result.subjects?.find(s => s.name === subjectName);
                totalSum += subjectData?.totalScore || 0;
            });
            overallScores.push({ docId, totalSum });
        }

        overallScores.sort((a, b) => b.totalSum - a.totalSum);
        const overallRanks = {};
        let rank = 1;
        for (let i = 0; i < overallScores.length; i++) {
            if (i > 0 && overallScores[i].totalSum < overallScores[i - 1].totalSum) {
                rank = i + 1;
            }
            overallRanks[overallScores[i].docId] = rank; // numeric rank
        }

        // --- 3. Update each result document with new positions ---
        const batch = db.batch();
        for (const [docId, result] of Object.entries(studentResults)) {
            const updatedSubjects = result.subjects.map(sub => {
                const rank = subjectRanks[sub.name]?.[docId] || '-';
                return { ...sub, position: rank };
            });

            const positionInClass = overallRanks[docId] || '-'; // store number

            const docRef = db.collection('results').doc(docId);
            batch.update(docRef, {
                subjects: updatedSubjects,
                positionInClass: positionInClass,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }

        await batch.commit();
        console.log('Positions recalculated and saved successfully.');

    } catch (error) {
        console.error('Error recalculating positions:', error);
        // Do not throw – we don't want to block the save flow, just log the error.
    }
}

// Final save results
async function finalSaveResults() {
    try {
        document.getElementById('loadingOverlay').style.display = 'flex';
        
        const resultsData = collectResultsData();
        
        let savedResultId = null;
        if (resultsData.existingResultId) {
            const { existingResultId, ...updateData } = resultsData;
            await db.collection('results').doc(existingResultId).update(updateData);
            savedResultId = existingResultId;
            showMessage(`Results updated successfully!`, 'success');
        } else {
            const { existingResultId, ...newData } = resultsData;
            const docRef = await db.collection('results').add(newData);
            savedResultId = docRef.id;
            showMessage(`Results saved successfully!`, 'success');
        }
        
        // --- Promotion update if applicable ---
        if (resultsData.promotedTo && resultsData.promotedTo !== resultsData.studentClass) {
            await db.collection('students').doc(resultsData.studentId).update({
                class: resultsData.promotedTo,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            showMessage(`${resultsData.studentName} promoted to ${getClassDisplayName(resultsData.promotedTo)}`, 'success');
        }
        
        // --- RECALCULATE POSITIONS FOR THE WHOLE CLASS ---
        await recalculateClassPositions(
            resultsData.studentClass,
            resultsData.academicYear,
            resultsData.term
        );
        
        closeModal('confirmSaveModal');
        document.getElementById('loadingOverlay').style.display = 'none';
        
        clearResultsForm();
        await loadRecentResults();
        
    } catch (error) {
        console.error('Error saving results:', error);
        document.getElementById('loadingOverlay').style.display = 'none';
        showMessage('Error saving results: ' + error.message, 'error');
    }
}

// Load recent results - without orderBy to avoid index
async function loadRecentResults() {
    try {
        if (!currentTeacherUser) return;
        
        const tableBody = document.getElementById('recentResultsTable');
        tableBody.innerHTML = `<tr><td colspan="6" class="text-center"><i class="fas fa-spinner fa-spin"></i> Loading...</td></tr>`;
        
        const snapshot = await db.collection('results')
            .where('createdBy', '==', currentTeacherUser.uid)
            .limit(10)
            .get();
        
        if (snapshot.empty) {
            tableBody.innerHTML = `<tr><td colspan="6" class="text-center"><i class="fas fa-inbox"></i><p>No results entered yet.</p></td></tr>`;
            return;
        }
        
        // Sort client-side by createdAt
        const results = [];
        snapshot.forEach(doc => {
            const result = doc.data();
            result.id = doc.id;
            results.push(result);
        });
        
        results.sort((a, b) => {
            const dateA = a.createdAt?.seconds || 0;
            const dateB = b.createdAt?.seconds || 0;
            return dateB - dateA;
        });
        
        let tableHTML = '';
        results.forEach(result => {
            const date = result.createdAt ? new Date(result.createdAt.seconds * 1000).toLocaleDateString() : '-';
            tableHTML += `
                <tr>
                    <td>${date}</td>
                    <td>${result.studentName}</td>
                    <td><span class="badge">${getClassDisplayName(result.studentClass)}</span></td>
                    <td>${result.term}</td>
                    <td><span class="badge success">Saved</span></td>
                    <td>
                        <button class="btn-outline btn-sm" onclick="viewResult('${result.id}')"><i class="fas fa-eye"></i></button>
                        <button class="btn-outline btn-sm" onclick="editResult('${result.id}')"><i class="fas fa-edit"></i></button>
                    </td>
                </tr>
            `;
        });
        tableBody.innerHTML = tableHTML;
        
    } catch (error) {
        console.error('Error loading recent results:', error);
        document.getElementById('recentResultsTable').innerHTML = `<tr><td colspan="6" class="text-center error">No results found.</td></tr>`;
    }
}

// Edit result
async function editResult(resultId) {
    try {
        const resultDoc = await db.collection('results').doc(resultId).get();
        if (resultDoc.exists) {
            const result = resultDoc.data();
            document.getElementById('academicYear').value = result.academicYear;
            document.getElementById('term').value = result.term;
            document.getElementById('selectedClass').value = result.studentClass;
            await loadStudentsForClass(result.studentClass);
            
            setTimeout(() => {
                document.getElementById('selectedStudent').value = result.studentId;
                currentResultsData = { ...result, existingResultId: resultId };
                loadStudentForResults();
            }, 500);
        }
    } catch (error) {
        console.error('Error editing result:', error);
        showMessage('Error loading result for editing: ' + error.message, 'error');
    }
}

// Clear selections
function clearSelections() {
    document.getElementById('academicYear').value = '';
    document.getElementById('term').value = '';
    document.getElementById('selectedClass').value = '';
    document.getElementById('selectedStudent').innerHTML = '<option value="">Select Student</option>';
    document.getElementById('resultsEntrySection').style.display = 'none';
    currentResultsData = null;
}

// Clear results form (including total row)
function clearResultsForm() {
    document.getElementById('attendanceDays').value = '';
    document.getElementById('totalDays').value = '';
    document.getElementById('conduct').value = '';
    document.getElementById('attitude').value = '';
    document.getElementById('interest').value = '';
    document.getElementById('teacherRemarks').value = '';
    document.getElementById('headTeacherRemarks').value = '';
    document.getElementById('promotedTo').value = '';
    document.getElementById('nextTermBegins').value = '';
    document.getElementById('schoolFees').value = '';
    document.getElementById('arrears').value = '';
    document.getElementById('motivationalFees').value = '';
    document.getElementById('maintenanceFees').value = '';
    document.getElementById('firstAid').value = '';
    document.getElementById('billsTotal').value = '0.00';
    
    // Reset total row if exists
    const totalClass = document.getElementById('totalClassScore');
    if (totalClass) { totalClass.value = '0.0'; }
    const totalExam = document.getElementById('totalExamScore');
    if (totalExam) { totalExam.value = '0.0'; }
    const totalOverall = document.getElementById('totalOverallScore');
    if (totalOverall) { totalOverall.value = '0.0'; }
    
    const container = document.getElementById('subjectsContainer');
    container.innerHTML = '<div class="text-center"><p>Select a student first to load subjects</p></div>';
    
    document.getElementById('resultsEntrySection').style.display = 'none';
    currentResultsData = null;
}

// Save and print
function saveAndPrint() {
    validateAndSave();
}

// Close modal
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

// Calculate bills total
function calculateBillsTotal() {
    const schoolFees = parseFloat(document.getElementById('schoolFees').value) || 0;
    const arrears = parseFloat(document.getElementById('arrears').value) || 0;
    const motivationalFees = parseFloat(document.getElementById('motivationalFees').value) || 0;
    const maintenanceFees = parseFloat(document.getElementById('maintenanceFees').value) || 0;
    const firstAid = parseFloat(document.getElementById('firstAid').value) || 0;
    const total = schoolFees + arrears + motivationalFees + maintenanceFees + firstAid;
    document.getElementById('billsTotal').value = total.toFixed(2);
}

// Helper: get next class
function getNextClass(currentClass) {
    const promotionFlow = {
        'creche': 'nursery1', 'nursery1': 'nursery2', 'nursery2': 'kg1',
        'kg1': 'kg2', 'kg2': 'basic1', 'basic1': 'basic2', 'basic2': 'basic3',
        'basic3': 'basic4', 'basic4': 'basic5', 'basic5': 'basic6',
        'basic6': 'jhs1', 'jhs1': 'jhs2', 'jhs2': 'jhs3', 'jhs3': 'graduated'
    };
    return promotionFlow[currentClass] || null;
}

// ============================================
// VIEW RESULT (read-only report card)
// ============================================

async function viewResult(resultId) {
    try {
        const doc = await db.collection('results').doc(resultId).get();
        if (!doc.exists) {
            showMessage('Result not found.', 'error');
            return;
        }
        const result = { id: doc.id, ...doc.data() };
        displayReportCard(result);
        document.getElementById('viewReportCardModal').style.display = 'flex';
    } catch (error) {
        console.error('Error viewing result:', error);
        showMessage('Error loading result: ' + error.message, 'error');
    }
}

// ---- Helper to format ordinal suffix ----
function ordinalSuffix(n) {
    if (isNaN(n) || n === '-') return '-';
    const num = parseInt(n);
    if (num === 0) return '0';
    const s = ['th','st','nd','rd'];
    const v = num % 100;
    return num + (s[(v-20)%10] || s[v] || s[0]);
}

// ---- Display report card with total row (for teacher view) ----
function displayReportCard(result) {
    const container = document.getElementById('reportCardContent');
    if (!container) return;

    const classDisplay = safeGetClassDisplayName(result.studentClass);
    let subjectsHTML = '';
    let totalClassScore = 0;
    let totalExamScore = 0;
    let totalOverall = 0;
    let hasNumericSubjects = false;

    if (result.subjects && result.subjects.length > 0) {
        // Check for numeric subjects
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

            // Add total row
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
            // Creche/early years: show grades only
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

    // Class position with ordinal suffix
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
        </div>
    `;
}

function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB');
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

// Expose functions globally
window.initializeEnterResultsPage = initializeEnterResultsPage;
window.loadStudentForResults = loadStudentForResults;
window.finalSaveResults = finalSaveResults;
window.saveAndPrint = saveAndPrint;
window.clearSelections = clearSelections;
window.clearResultsForm = clearResultsForm;
window.loadRecentResults = loadRecentResults;
window.editResult = editResult;
window.closeModal = closeModal;
window.calculateBillsTotal = calculateBillsTotal;
window.calculateSubjectTotal = calculateSubjectTotal;
window.validateAndSave = validateAndSave;
window.viewResult = viewResult;