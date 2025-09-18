document.addEventListener('DOMContentLoaded', () => {
    const jobPostingForm = document.getElementById('job-posting-form');
    const searchInput = document.querySelector('#job-search');

    if (jobPostingForm) {
        jobPostingForm.addEventListener('submit', handleJobSubmission);
    }

    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 400));
    }

    loadJobs();
});

// =======================
// API Base URL
// =======================
const API_BASE = "https://jobs-backend-4-qkd4.onrender.com";

// =======================
// API Helper
// =======================
async function apiRequest(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (['POST', 'PUT', 'DELETE'].includes(method)) {
        headers['X-CSRFToken'] = getCookie('csrftoken');
    }

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method,
            headers,
            body: body ? JSON.stringify(body) : null,
        });
        return await res.json();
    } catch (err) {
        console.error("API request failed:", err);
        showToast("Network error. Please try again.", "danger");
        return null;
    }
}

// =======================
// Job Actions
// =======================
async function handleJobSubmission(e) {
    e.preventDefault();
    const form = e.target;
    const submitButton = form.querySelector('button[type="submit"]');
    const originalText = submitButton.innerHTML;

    const jobData = {
        title: form['job-title'].value,
        company: form['company'].value,
        location: form['location'].value,
        type: form['job-type'].value,
        salary: form['salary'].value,
        tags: form['tags'].value,
        description: form['description'].value,
        requirements: form['requirements'].value,
        application_link: form['application-link'].value,
    };

    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Posting...';
    submitButton.disabled = true;

    const data = await apiRequest("post/", "POST", jobData);

    if (data?.success) {
        showToast(data.message, "success");
        form.reset();
        await loadJobs();
    } else {
        showToast(data?.message || "Failed to post job", "danger");
    }

    submitButton.innerHTML = originalText;
    submitButton.disabled = false;
}

async function handleSearch(e) {
    const query = e.target.value.trim().toLowerCase();
    if (!query) return loadJobs();

    const data = await apiRequest(`search/?q=${encodeURIComponent(query)}`);
    if (data) updateJobsTable(data.jobs);
}

async function loadJobs() {
    const tbody = document.querySelector('tbody');
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-3">Loading jobs...</td></tr>`;

    const data = await apiRequest("");
    if (data) updateJobsTable(data.jobs);
}

// =======================
// Render Table
// =======================
function updateJobsTable(jobs) {
    const tbody = document.querySelector('tbody');
    tbody.innerHTML = '';

    if (!jobs || jobs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center py-3">No jobs found</td></tr>';
        return;
    }

    jobs.forEach(job => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${job.title}</td>
            <td>${job.company}</td>
            <td>${job.location}</td>
            <td><span class="badge bg-primary">${job.type}</span></td>
            <td>${new Date(job.posted_date).toLocaleDateString()}</td>
            <td>
                <button class="btn btn-sm btn-info"><i class="fas fa-edit"></i></button>
                <button class="btn btn-sm btn-danger"><i class="fas fa-trash"></i></button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

// =======================
// Toasts
// =======================
function showToast(message, type = "info") {
    const toastContainer = document.querySelector('.toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type} border-0 show mb-2`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">${message}</div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto"></button>
        </div>
    `;
    toast.querySelector('.btn-close').addEventListener('click', () => toast.remove());
    toastContainer.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function createToastContainer() {
    const container = document.createElement('div');
    container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
    document.body.appendChild(container);
    return container;
}

// =======================
// Helpers
// =======================
function getCookie(name) {
    return document.cookie.split('; ')
        .find(row => row.startsWith(name + '='))
        ?.split('=')[1];
}

function debounce(func, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), delay);
    };
}
