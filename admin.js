document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const jobPostingForm = document.getElementById('job-posting-form');
    const searchInput = document.getElementById('job-search');
    const clearSearchBtn = document.getElementById('clear-search');
    const jobsTableBody = document.getElementById('jobs-table-body');
    const jobsCount = document.getElementById('jobs-count');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    // State
    let currentPage = 1;
    let totalPages = 1;
    let searchQuery = '';
    let isLoading = false;

    // Event Listeners
    if (jobPostingForm) {
        jobPostingForm.addEventListener('submit', handleJobSubmission);
    }

    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 400));
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', clearSearch);
    }

    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => changePage(currentPage - 1));
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => changePage(currentPage + 1));
    }

    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    // Initialize
    checkServerStatus();
    loadJobs();

    // =======================
    // API Configuration - FIXED TO MATCH BACKEND PATHS
    // =======================
    const API_BASE = ""; // Remove base URL since we're using relative paths
    const API_ENDPOINTS = {
        jobs: '/api/jobs/',
        postJob: '/api/jobs/post/',
        searchJobs: '/api/jobs/search/',
        deleteJob: '/api/jobs/delete/' // Assuming you have this endpoint
    };

    // =======================
    // API Helper with Error Handling
    // =======================
    async function apiRequest(endpoint, method = 'GET', body = null) {
        try {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            if (['POST', 'PUT', 'DELETE'].includes(method)) {
                options.headers['X-CSRFToken'] = getCookie('csrftoken');
            }

            if (body) {
                options.body = JSON.stringify(body);
            }

            const response = await fetch(`${API_BASE}${endpoint}`, options);
            
            // Handle non-JSON responses (like server errors)
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);
            showToast(`⚠️ ${error.message || 'Network error. Please try again.'}`, 'danger');
            return null;
        }
    }

    // =======================
    // Server Health Check
    // =======================
    async function checkServerStatus() {
        showToast("🔄 Checking server status...", "info");
        
        try {
            // Use the jobs endpoint to check server status
            const response = await fetch('/api/jobs/', { method: "HEAD" });
            
            if (response.ok) {
                showToast("✅ Server is online", "success");
                return true;
            } else {
                showToast(`⚠️ Server responded with ${response.status}`, "warning");
                return false;
            }
        } catch (error) {
            console.error('Server health check failed:', error);
            showToast("❌ Server is unreachable", "danger");
            return false;
        }
    }

    // =======================
    // Job Actions
    // =======================
    async function handleJobSubmission(e) {
        e.preventDefault();
        
        if (isLoading) return;
        
        const form = e.target;
        const submitButton = form.querySelector('button[type="submit"]');
        const buttonText = submitButton.querySelector('.button-text');
        const buttonSpinner = submitButton.querySelector('.loading-spinner');
        
        // Collect form data
        const jobData = {
            title: form['job-title'].value.trim(),
            company: form['company'].value.trim(),
            location: form['location'].value.trim(),
            type: form['job-type'].value,
            salary: form['salary'].value.trim(),
            tags: form['tags'].value.trim(),
            description: form['description'].value.trim(),
            requirements: form['requirements'].value.trim(),
            application_link: form['application-link'].value.trim()
        };

        // Validate required fields
        if (!jobData.title || !jobData.company || !jobData.location || !jobData.type || 
            !jobData.salary || !jobData.description || !jobData.requirements || !jobData.application_link) {
            showToast("⚠️ Please fill in all required fields", "warning");
            return;
        }

        // Show loading state
        isLoading = true;
        buttonText.textContent = 'Posting...';
        buttonSpinner.classList.remove('hidden');
        submitButton.disabled = true;

        try {
            const data = await apiRequest(API_ENDPOINTS.postJob, "POST", jobData);
            
            if (data && data.success) {
                showToast("🎉 Job posted successfully!", "success");
                form.reset();
                loadJobs(); // Refresh the job list
            } else {
                showToast(data?.message || "❌ Failed to post job", "danger");
            }
        } catch (error) {
            console.error('Job submission error:', error);
            showToast("❌ Failed to post job. Please try again.", "danger");
        } finally {
            // Reset button state
            isLoading = false;
            buttonText.textContent = 'Post Job';
            buttonSpinner.classList.add('hidden');
            submitButton.disabled = false;
        }
    }

    async function handleSearch(e) {
        searchQuery = e.target.value.trim();
        currentPage = 1; // Reset to first page when searching
        
        // Show/hide clear button
        if (searchQuery) {
            clearSearchBtn.classList.remove('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
        }
        
        // Debounced search
        if (searchQuery) {
            await searchJobs(searchQuery);
        } else {
            await loadJobs();
        }
    }

    async function searchJobs(query) {
        showLoadingState();
        
        try {
            const data = await apiRequest(`${API_ENDPOINTS.searchJobs}?q=${encodeURIComponent(query)}`);
            
            if (data) {
                updateJobsTable(data.jobs);
                updateJobsCount(data.jobs.length, data.jobs.length);
            }
        } catch (error) {
            console.error('Search error:', error);
            showToast("❌ Failed to search jobs", "danger");
            showEmptyState();
        }
    }

    async function loadJobs() {
        showLoadingState();
        
        try {
            const endpoint = searchQuery 
                ? `${API_ENDPOINTS.searchJobs}?q=${encodeURIComponent(searchQuery)}`
                : API_ENDPOINTS.jobs;
                
            const data = await apiRequest(endpoint);
            
            if (data) {
                updateJobsTable(data.jobs);
                updateJobsCount(data.jobs.length, data.jobs.length);
            }
        } catch (error) {
            console.error('Load jobs error:', error);
            showToast("❌ Failed to load jobs", "danger");
            showEmptyState();
        }
    }

    async function deleteJob(jobId) {
        if (!confirm("Are you sure you want to delete this job? This action cannot be undone.")) {
            return;
        }
        
        try {
            const data = await apiRequest(`${API_ENDPOINTS.deleteJob}${jobId}/`, "DELETE");
            
            if (data && data.success) {
                showToast("🗑️ Job deleted successfully", "success");
                loadJobs(); // Refresh the job list
            } else {
                showToast(data?.message || "❌ Failed to delete job", "danger");
            }
        } catch (error) {
            console.error('Delete job error:', error);
            showToast("❌ Failed to delete job", "danger");
        }
    }

    // =======================
    // UI Update Functions
    // =======================
    function updateJobsTable(jobs) {
        if (!jobs || jobs.length === 0) {
            showEmptyState();
            return;
        }

        jobsTableBody.innerHTML = '';
        
        jobs.forEach(job => {
            const row = document.createElement('tr');
            row.className = 'job-row';
            row.innerHTML = `
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm font-medium text-gray-900">${escapeHtml(job.title)}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-500">${escapeHtml(job.company)}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-gray-500">${escapeHtml(job.location)}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="badge ${getJobTypeBadgeClass(job.type)}">${escapeHtml(job.type)}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    ${formatDate(job.posted_date)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button class="action-btn text-indigo-600 hover:text-indigo-900 mr-3" title="Edit">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn text-red-600 hover:text-red-900" title="Delete" data-job-id="${job.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            // Add event listener to delete button
            const deleteBtn = row.querySelector('[data-job-id]');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => deleteJob(job.id));
            }
            
            jobsTableBody.appendChild(row);
        });
    }

    function updateJobsCount(total, showing) {
        jobsCount.innerHTML = `Showing <span class="font-medium">${showing}</span> of <span class="font-medium">${total}</span> results`;
    }

    function showLoadingState() {
        jobsTableBody.innerHTML = `
            <tr class="loading-row">
                <td colspan="6" class="px-6 py-4 text-center">
                    <div class="flex justify-center items-center">
                        <div class="loading-spinner"></div>
                        <span class="ml-2">Loading jobs...</span>
                    </div>
                </td>
            </tr>
        `;
    }

    function showEmptyState() {
        jobsTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="px-6 py-4 text-center">
                    <div class="text-center py-8">
                        <i class="fas fa-briefcase text-gray-300 text-4xl mb-3"></i>
                        <p class="text-gray-500">No jobs found</p>
                        ${searchQuery ? `<button class="mt-2 text-indigo-600 hover:text-indigo-800" onclick="clearSearch()">Clear search</button>` : ''}
                    </div>
                </td>
            </tr>
        `;
    }

    function clearSearch() {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.classList.add('hidden');
        currentPage = 1;
        loadJobs();
    }

    function changePage(page) {
        if (page < 1 || page > totalPages || isLoading) return;
        currentPage = page;
        loadJobs();
    }

    // =======================
    // Toast Notifications
    // =======================
    function showToast(message, type = "info") {
        const toastContainer = document.querySelector('.toast-container') || createToastContainer();
        const toast = document.createElement('div');
        
        const colors = {
            success: "bg-success",
            danger: "bg-danger",
            warning: "bg-warning text-dark",
            info: "bg-info text-dark"
        };
        
        toast.className = `toast align-items-center text-white ${colors[type] || colors.info} border-0 mb-2`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="d-flex">
                <div class="toast-body fw-semibold">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        // Add event listener to close button
        const closeBtn = toast.querySelector('.btn-close');
        closeBtn.addEventListener('click', () => toast.remove());
        
        // Auto-remove after 4 seconds
        setTimeout(() => {
            toast.remove();
        }, 4000);
    }

    function createToastContainer() {
        const container = document.createElement('div');
        container.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        document.body.appendChild(container);
        return container;
    }

    // =======================
    // Sidebar Toggle (Mobile)
    // =======================
    function toggleSidebar() {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('show');
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('show');
    }

    // =======================
    // Utility Functions
    // =======================
    function getCookie(name) {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith(`${name}=`)) {
                return decodeURIComponent(cookie.substring(name.length + 1));
            }
        }
        return null;
    }

    function debounce(func, delay) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }

    function getJobTypeBadgeClass(type) {
        const typeClasses = {
            'Full-time': 'bg-green-100 text-green-800',
            'Part-time': 'bg-blue-100 text-blue-800',
            'Contract': 'bg-yellow-100 text-yellow-800',
            'Internship': 'bg-purple-100 text-purple-800',
            'Remote': 'bg-indigo-100 text-indigo-800'
        };
        
        return typeClasses[type] || 'bg-gray-100 text-gray-800';
    }

    // Expose clearSearch function globally for the empty state button
    window.clearSearch = clearSearch;
});