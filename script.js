document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const infoCollectionDiv = document.getElementById('infoCollection');
    const infoForm = document.getElementById('infoForm');
    const assessmentSectionDiv = document.getElementById('assessmentSection');
    const assessmentForm = document.getElementById('assessmentForm');
    const resultsDiv = document.getElementById('results');
    const detailedResultsDiv = document.getElementById('detailedResults');
    const overallScoreElement = document.getElementById('overallScore');
    const overallExpectationsElement = document.getElementById('overallExpectations');
    const timerDisplay = document.getElementById('time');
    const sendEmailBtn = document.getElementById('sendEmailBtn');
    const emailStatus = document.getElementById('emailStatus');
    const submitAssessmentBtn = document.getElementById('submitAssessmentBtn'); // Added for Turnstile integration

    // --- User Info Storage ---
    let parentName = '';
    let childName = '';
    let parentEmail = '';
    let assessmentTextResults = '';
    let assessmentHtmlResults = '';
    const CURRENT_KEY_STAGE = "Key Stage 2"; // Define the current Key Stage

    // --- Timer Variables ---
    const totalTime = 15 * 60; // 15 minutes in seconds
    let timeLeft = totalTime;
    let timerInterval;

    // --- Assessment Data (UPDATED FOR KS2 - 30 QUESTIONS) ---
    const correctAnswers = {
        // Existing English Questions (Q1-Q6)
        q1: 'a', // quickly (adverb)
        q2: 'c', // went (past tense)
        q3: 'children', // plural of child
        q4: "Tom's car is red.", // possessive apostrophe
        q5: 'singing', // main verb
        q6: 'b', // ! (Exclamation mark)

        // NEW KS2 English Questions (Q7-Q15)
        q7: 'He walked to school.',
        q8: 'clever',
        q9: 'b', // big
        q10: 'on', // preposition
        q11: 'b', // received
        q12: 'In the morning, I eat breakfast.',
        q13: 'better',
        q14: 'played',
        q15: 'Sentence starts with capital letter and ends with ?',

        // Existing Maths Questions (Q16-Q21)
        q16: 536,   // 347 + 189
        q17: 56,    // 7 * 8
        q18: 'c',   // 3/4 (1 - 1/4)
        q19: 20,    // 25% of 80
        q20: 120,   // Angle x on a straight line (180 - 60)
        q21: 60,    // 120 miles / 2 hours

        // NEW KS2 Maths Questions (Q22-Q30)
        q22: 333,   // 456 - 123
        q23: 12,    // 60 / 5
        q24: 0.5,   // 1/2 as decimal
        q25: 180,   // 3 hours * 60 minutes
        q26: 28,    // perimeter of square 7*4
        q27: '7,10,15,23', // Correct answer is stored without spaces
        q28: 10,    // next in sequence 2,4,6,8,10
        q29: 350,   // 347 to nearest 10
        q30: '1/2'  // 0.5 as a fraction
    };

    // All questions are 1 point for simplicity, making total score out of 30.
    const questionPoints = Array.from({length: 30}, (_, i) => ({[`q${i + 1}`]: 1}))
        .reduce((acc, curr) => ({...acc, ...curr}), {});

    // --- Initial state for submit button ---
    // The submit button for the assessment should be disabled until Turnstile is completed.
    if (submitAssessmentBtn) {
        submitAssessmentBtn.disabled = true;
    }

    // --- Callback for Cloudflare Turnstile ---
    // This function is called by the Turnstile widget when it successfully completes its challenge.
    window.turnstileCallback = function(token) {
        if (submitAssessmentBtn) {
            submitAssessmentBtn.disabled = false; // Enable the submit button
        }
    };

    // --- Error Callback for Cloudflare Turnstile ---
    // This function is called if the Turnstile widget encounters an error.
    window.turnstileErrorCallback = function() {
        if (submitAssessmentBtn) {
            submitAssessmentBtn.disabled = true; // Keep the button disabled on error
        }
        alert('Security check failed. Please refresh the page and try again.');
        // Optionally, force a reset if the Turnstile API allows it or re-render
        if (typeof turnstile !== 'undefined' && turnstile.reset) {
            turnstile.reset();
        }
    };

    // --- Event Listeners ---
    infoForm.addEventListener('submit', function(event) {
        event.preventDefault();
        parentName = document.getElementById('parentName').value.trim();
        childName = document.getElementById('childName').value.trim();
        parentEmail = document.getElementById('parentEmail').value.trim();
        if (parentName && childName && parentEmail) {
            infoCollectionDiv.style.display = 'none';
            assessmentSectionDiv.style.display = 'block';
            startTimer();
        } else {
            alert('Please fill in all required information.');
        }
    });

    assessmentForm.addEventListener('submit', async function(event) {
        event.preventDefault(); // Prevent default form submission

        // Get the Turnstile response token
        const turnstileToken = document.querySelector('[name="cf-turnstile-response"]').value;

        if (!turnstileToken) {
            alert('Please complete the security check.');
            if (typeof turnstile !== 'undefined' && turnstile.reset) {
                turnstile.reset();
            }
            if (submitAssessmentBtn) {
                submitAssessmentBtn.disabled = true;
            }
            return;
        }

        // Send data to Netlify function for server-side Turnstile verification
        try {
            const verificationResponse = await fetch('/.netlify/functions/verify-turnstile', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ turnstileToken: turnstileToken }),
            });

            const verificationResult = await verificationResponse.json();

            if (verificationResult.success) {
                // Turnstile verification successful, proceed with assessment submission
                clearInterval(timerInterval);
                submitAssessment();
            } else {
                alert('Security check failed. Please try again.');
                console.error('Turnstile verification failed:', verificationResult.errors);
                // Reset Turnstile widget to allow user to try again
                if (typeof turnstile !== 'undefined' && turnstile.reset) {
                    turnstile.reset();
                }
                if (submitAssessmentBtn) {
                    submitAssessmentBtn.disabled = true;
                }
            }
        } catch (error) {
            console.error('Error during Turnstile verification:', error);
            alert('An error occurred during security check. Please try again.');
            if (typeof turnstile !== 'undefined' && turnstile.reset) {
                turnstile.reset();
            }
            if (submitAssessmentBtn) {
                submitAssessmentBtn.disabled = true;
            }
        }
    });

    // --- Functions ---

    function startTimer() {
        timerInterval = setInterval(() => {
            timeLeft--;
            const minutes = Math.floor(timeLeft / 60);
            const seconds = timeLeft % 60;
            timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

            if (timeLeft <= 0) {
                clearInterval(timerInterval);
                submitAssessment();
            }
        }, 1000);
    }

    function submitAssessment() {
        let totalScore = 0;
        detailedResultsDiv.innerHTML = '';
        assessmentTextResults = `--- Key Stage 2 Assessment Results for ${childName} (Parent: ${parentName}) ---\n\n`;
        assessmentHtmlResults = `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #ddd; border-radius: 8px; background-color: #f9f9f9; }
                    h2, h3, h4 { color: #0056b3; }
                    .question-item { margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px dashed #eee; }
                    .question-item:last-child { border-bottom: none; }
                    .score-summary { text-align: center; margin-top: 25px; padding-top: 15px; border-top: 2px solid #007bff; }
                    .correct { color: green; }
                    .incorrect { color: red; }
                    .expectation-meets { color: #28a745; font-weight: bold; }
                    .expectation-below { color: #dc3545; font-weight: bold; }
                    .expectation-above { color: #007bff; font-weight: bold; }
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>Key Stage 2 Assessment Results</h2>
                    <p><strong>Parent Name:</strong> ${parentName}</p>
                    <p><strong>Child Name:</strong> ${childName}</p>
                    <p><strong>Parent Email:</strong> ${parentEmail}</p>
                    <hr>
                    <h3>Detailed Results:</h3>
        `;

        const questions = Array.from({length: 30}, (_, i) => `q${i + 1}`);

        questions.forEach(qId => {
            let userAnswer;
            let isCorrect = false;
            let score = 0;
            const correctAns = correctAnswers[qId];
            const maxPoints = questionPoints[qId];
            let outcomeText = '';
            let outcomeClass = '';

            const qElement = document.getElementById(qId);
            const questionTitle = qElement ? qElement.querySelector('h3').textContent : `Question ${qId.toUpperCase()}`;

            const inputField = document.querySelector(`[name="${qId}_answer"]`);
            if (!inputField) {
                userAnswer = 'N/A (Input field not found)';
                isCorrect = false;
            } else if (inputField.type === 'radio') {
                const selectedRadio = document.querySelector(`input[name="${qId}_answer"]:checked`);
                userAnswer = selectedRadio ? selectedRadio.value : 'No Answer';
                isCorrect = (userAnswer === correctAns);
            } else if (inputField.type === 'text') {
                userAnswer = inputField.value.trim();

                if (qId === 'q15') {
                    const trimmedAnswer = userAnswer.trim();
                    if (trimmedAnswer.length === 0) {
                        isCorrect = false;
                    } else {
                        const firstChar = trimmedAnswer.charAt(0);
                        const lastChar = trimmedAnswer.charAt(trimmedAnswer.length - 1);
                        const startsWithCapital = (firstChar === firstChar.toUpperCase() && firstChar !== firstChar.toLowerCase());
                        const endsWithQuestionMark = (lastChar === '?');
                        isCorrect = startsWithCapital && endsWithQuestionMark;
                    }
                } else if (qId === 'q27') { // NEW LOGIC for Q27: Normalize input by removing all spaces
                    const normalizedUserAnswer = userAnswer.replace(/\s/g, ''); // Remove all whitespace
                    isCorrect = (normalizedUserAnswer === correctAns);
                }
                else if (qId === 'q4' || qId === 'q7' || qId === 'q12' || qId === 'q30') {
                     // Exact match for specific sentences/phrases (case-sensitive as determined by correctAns)
                     isCorrect = (userAnswer === correctAns);
                } else {
                     // Case-insensitive for other general text answers
                     isCorrect = (userAnswer.toLowerCase() === String(correctAns).toLowerCase());
                }
            } else if (inputField.type === 'number') {
                userAnswer = parseFloat(inputField.value);
                isCorrect = (userAnswer === correctAns);
            }

            if (isCorrect) {
                score = maxPoints;
                totalScore += score;
                outcomeText = 'Correct';
                outcomeClass = 'correct';
            } else {
                score = 0;
                outcomeText = 'Incorrect';
                outcomeClass = 'incorrect';
            }

            detailedResultsDiv.innerHTML += `
                <div class="result-item">
                    <h4>${questionTitle}</h4>
                    <p><strong>Your Answer:</strong> ${userAnswer}</p>
                    <p><strong>Correct Answer:</strong> ${correctAns}</p>
                    <p><strong>Score:</strong> ${score}/${maxPoints}</p>
                    <p><strong>Outcome:</strong> <span class="${outcomeClass}">${outcomeText}</span></p>
                </div>
            `;

            assessmentTextResults += `Question: ${questionTitle}\n`;
            assessmentTextResults += `  Your Answer: ${userAnswer}\n`;
            assessmentTextResults += `  Correct Answer: ${correctAns}\n`;
            assessmentTextResults += `  Score: ${score}/${maxPoints}\n`;
            assessmentTextResults += `  Outcome: ${outcomeText}\n\n`;

            assessmentHtmlResults += `
                <div class="question-item">
                    <h4>${questionTitle}</h4>
                    <p><strong>Your Answer:</strong> ${userAnswer}</p>
                    <p><strong>Correct Answer:</strong> ${correctAns}</p>
                    <p><strong>Score:</strong> ${score}/${maxPoints}</p>
                    <p><strong>Outcome:</strong> <span class="${outcomeClass}">${outcomeText}</span></p>
                </div>
            `;
        });

        overallScoreElement.textContent = `Overall Score: ${totalScore}/30`;
        assessmentTextResults += `\nOverall Score: ${totalScore}/30\n`;

        let overallExpectations = '';
        let overallExpectationsClass = '';
        if (totalScore >= 23) {
            overallExpectations = 'Above Expectations (Excellent understanding)';
            overallExpectationsClass = 'expectation-above';
        } else if (totalScore >= 15) {
            overallExpectations = 'Meets Expectations (Good understanding)';
            overallExpectationsClass = 'expectation-meets';
        } else {
            overallExpectations = 'Below Expectations (Needs more support)';
            overallExpectationsClass = 'expectation-below';
        }
        overallExpectationsElement.innerHTML = `Overall Outcome: <span class="${overallExpectationsClass}">${overallExpectations}</span>`;
        assessmentTextResults += `Overall Outcome: ${overallExpectations}\n`;

        assessmentHtmlResults += `
                    <div class="score-summary">
                        <h3>Overall Score: ${totalScore}/30</h3>
                        <h3>Overall Outcome: <span class="${overallExpectationsClass}">${overallExpectations}</span></h3>
                    </div>
                    <p>If you have any questions, please reply to this email.</p>
                    <p>Best regards,<br/>Mona Teaches</p>
                </div>
            </body>
            </html>
        `;

        assessmentSectionDiv.style.display = 'none';
        resultsDiv.style.display = 'block';

        sendEmailBtn.style.display = 'none';
        sendAssessmentEmail(parentName, childName, parentEmail, assessmentTextResults, assessmentHtmlResults, CURRENT_KEY_STAGE); // Pass CURRENT_KEY_STAGE
    }

    async function sendAssessmentEmail(parentName, childName, parentEmail, resultsText, resultsHtml, keyStage) { // Added keyStage parameter
        emailStatus.textContent = 'Sending email...';
        emailStatus.style.color = '#007bff';

        try {
            const response = await fetch('/.netlify/functions/send-email', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    parentName: parentName,
                    childName: childName,
                    parentEmail: parentEmail,
                    resultsText: resultsText,
                    resultsHtml: resultsHtml,
                    keyStage: keyStage // Pass keyStage to the backend
                }),
            });

            if (response.ok) {
                emailStatus.textContent = 'Email sent successfully!';
                emailStatus.style.color = '#28a745';
            } else {
                const errorData = await response.json();
                console.error('Error sending email:', errorData.message);
                emailStatus.textContent = `Failed to send email: ${errorData.message || 'Server error'}`;
                emailStatus.style.color = '#dc3545';
            }
        } catch (error) {
            console.error('Network or unexpected error:', error);
            emailStatus.textContent = `Failed to send email: Network error`;
            emailStatus.style.color = '#dc3545';
        }
    }
});