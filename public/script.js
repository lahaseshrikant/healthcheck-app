// Other code to handle the login/logout links and health check history goes here ...
document.addEventListener('DOMContentLoaded', () => {
    // Check if the user is logged in and adjust the UI accordingly
    checkLoginStatus();
});

async function checkLoginStatus() {
    try {
        const response = await fetch('/checkLoginStatus'); // Assume an API endpoint to check login status
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const loginStatus = await response.json();

        // Show or hide login/logout links based on login status
        const loginLink = document.getElementById('loginLink');
        const logoutLink = document.getElementById('logoutLink');
        const dashboardLink = document.getElementById('dashboardLink');

        if (loginStatus.loggedIn) {
            // User is logged in, show logout link and hide login link
            if (loginLink) loginLink.classList.remove('visible');
            if (logoutLink) logoutLink.classList.add('visible');
            if (dashboardLink) dashboardLink.classList.add('visible');
        } else {
            // User is not logged in, show login link and hide logout link
            if (loginLink) loginLink.classList.add('visible');
            if (logoutLink) logoutLink.classList.remove('visible');
            if (dashboardLink) dashboardLink.classList.remove('visible');
        }
    } catch (error) {
        console.error('Error checking login status:', error.message);
    }
}

// code for index page
document.getElementById('healthCheckForm').addEventListener('submit', function (event) {
    event.preventDefault();
    const name = document.getElementById('name').value;
    const age = document.getElementById('age').value;
    const symptomsInput = document.getElementById('symptoms');
    const symptoms = symptomsInput.value.split(',').map(symptom => symptom.trim());

    // Validate the symptoms
    if (symptoms.some(symptom => symptom === '')) {
        alert('Please enter valid symptoms separated by commas.');
        return;
    }

    // Fetch condition details from the server
    fetchConditionDetails(symptoms)
        .then(details => {
            // Update the page with the fetched condition details
            updatePageWithConditionDetails(details, name);
        })
        .catch(error => {
            console.error('Failed to fetch condition details:', error);
            alert('Failed to fetch condition details. Please try again later.');
        });
});

function fetchConditionDetails(symptoms) {
    const apiUrl = 'http://localhost:3000/checkHealth';

    return fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symptoms }),
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            return {
                suggestedConditions: data.suggestedConditions || [], // Ensure it's an array
                inputSymptoms: symptoms,
            };
        });
}

function updatePageWithConditionDetails(details) {
    const resultDiv = document.getElementById('result');

    // Ensure that resultDiv exists before attempting to set innerHTML
    if (resultDiv) {
        if (Array.isArray(details.suggestedConditions)) {
            resultDiv.innerHTML = `<p>Suggested Conditions: ${details.suggestedConditions.join(', ')}</p>`;

            // Display a message to the user
            const name = document.getElementById('name').value;
            document.getElementById('result').innerHTML = `Thank you ${name}, your form has been submitted.`;
        } else {
            console.error('details.suggestedConditions is not an array');
        }
    }
}

// code for health check history page
// Fetch the health checks from the backend
fetch('http://localhost:3000/healthChecks')
    .then(response => {
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    })
    .then(healthChecks => {
        console.log(healthChecks); // Log the response for debugging
        // Get the healthCheckList ul
        const healthCheckList = document.getElementById('healthCheckList');

        // Add each health check to the ul
        healthChecks.forEach(healthCheck => {
            const li = document.createElement('li');
            li.textContent = `Symptoms: ${healthCheck.symptoms}, Conditions: ${healthCheck.conditions}`;
            healthCheckList.appendChild(li);
        });
    })
    .catch(error => console.error('Error:', error));

async function checkHealth() {
    const symptomsInput = document.getElementById('symptoms');
    const resultDiv = document.getElementById('result');

    const symptoms = symptomsInput.value.split(',').map(symptom => symptom.trim());

    try {
        const response = await fetch('http://localhost:3000/checkHealth', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ symptoms }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        if (Array.isArray(data.suggestedConditions)) {
            resultDiv.innerHTML = `<p>Suggested Health Conditions: ${data.suggestedConditions.join(', ')}</p>`;
        } else {
            resultDiv.innerHTML = '<p>No suggested conditions found.</p>';
        }
    } catch (error) {
        console.error('Error:', error.message);
        resultDiv.innerHTML = '<p>An error occurred. Please try again.</p>';
    }
}

async function getHealthChecks() {
    const healthCheckList = document.getElementById('healthCheckList');

    try {
        const response = await fetch('http://localhost:3000/healthChecks');

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        // Clear the previous list
        healthCheckList.innerHTML = '';

        // Display the health checks
        data.forEach(entry => {
            const listItem = document.createElement('li');
            listItem.textContent = `Symptoms: ${entry.symptoms}, Conditions: ${entry.conditions}`;
            healthCheckList.appendChild(listItem);
        });
    } catch (error) {
        console.error('Error:', error.message);
        // Handle the error, e.g., display a message to the user
    }
}

// Attach the event listener to the form
window.onload = function () {
    // Attach the event listener to the form
    document.getElementById('healthCheckForm')
    console.log(document.getElementById('healthCheckForm'))
    document.addEventListener('submit', function (event) {
        event.preventDefault();
        const name = document.getElementById('name').value;
        const age = document.getElementById('age').value;
        const symptomsInput = document.getElementById('symptoms');
        const symptoms = symptomsInput.value.split(',').map(symptom => symptom.trim());

        // You can add your symptom validation logic here

        document.getElementById('result').innerHTML = `Thank you ${name}, your form has been submitted.`;
    });
}

async function fetchConditionDetails(symptoms) {
    const apiUrl = 'http://localhost:3000/checkHealth';

    console.log('Request Payload:', { symptoms }); // Log the request payload

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ symptoms }),
    });
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return {
        suggestedConditions: data.suggestedConditions || [],
        inputSymptoms: symptoms,
    };
}


