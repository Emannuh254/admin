document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const jobPostingForm = document.getElementById('job-posting-form');
    const searchInput = document.getElementById('job-search');
    const clearSearchBtn = document.getElementById('clear-search');
    const jobsTableBody = document.getElementById('jobs-table-body');
    const jobsCount = document.getElementById('jobs-count');
    const menuToggle = document.getElementById('menu-toggle');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');
    const editJobModal = document.getElementById('edit-job-modal');
    const editJobForm = document.getElementById('edit-job-form');
    const closeEditModal = document.getElementById('close-edit-modal');

    // State
    let searchQuery = '';
    let isLoading = false;
    let currentEditingJobId = null;

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

    if (menuToggle) {
        menuToggle.addEventListener('click', toggleSidebar);
    }

    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', closeSidebar);
    }

    if (editJobForm) {
        editJobForm.addEventListener('submit', handleEditJobSubmission);
    }

    if (closeEditModal) {
        closeEditModal.addEventListener('click', closeEditJobModal);
    }

    // Initialize
    checkServerStatus();
    loadJobs();

    // =======================
    // API Configuration
    // =======================
    const API_BASE = "https://jobs-backend-4-qkd4.onrender.com";
    const API_ENDPOINTS = {
        jobs: '/api/jobs/',
        postJob: '/api/jobs/post/',
        searchJobs: '/api/jobs/search/',
        getJob: '/api/jobs/', // For getting a single job
        updateJob: '/api/jobs/', // For updating a job
        deleteJob: '/api/jobs/' // For deleting a job
    };

    // =======================
    // API Helper with Error Handling and CORS Support
    // =======================
    async function apiRequest(endpoint, method = 'GET', body = null, id = null) {
        try {
            const options = {
                method,
                mode: 'cors',
                credentials: 'include', // Include cookies for session authentication
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

            const url = id ? `${API_BASE}${endpoint}${id}/` : `${API_BASE}${endpoint}`;
            const response = await fetch(url, options);
            
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
            
            // Special handling for CORS errors
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                showToast("⚠️ CORS error: Backend may not be configured to accept requests from this domain", "danger");
            } else {
                showToast(`⚠️ ${error.message || 'Network error. Please try again.'}`, 'danger');
            }
            
            return null;
        }
    }

    // =======================
    // Server Health Check
    // =======================
    async function checkServerStatus() {
        showToast("🔄 Checking server status...", "info");
        
        try {
            const response = await fetch(`${API_BASE}/api/jobs/`, { 
                method: "HEAD",
                mode: 'cors',
                credentials: 'include'
            });
            
            if (response.ok) {
                showToast("✅ Server is online", "success");
                return true;
            } else {
                showToast(`⚠️ Server responded with ${response.status}`, "warning");
                return false;
            }
        } catch (error) {
            console.error('Server health check failed:', error);
            
            // Special handling for CORS errors
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                showToast("⚠️ Unable to connect to server. CORS may be blocking the request.", "danger");
            } else {
                showToast("❌ Server is unreachable", "danger");
            }
            
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

        // Validate URL
        try {
            new URL(jobData.application_link);
        } catch (e) {
            showToast("⚠️ Please enter a valid URL for the application link", "warning");
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
            const data = await apiRequest(API_ENDPOINTS.deleteJob, "DELETE", null, jobId);
            
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

    async function editJob(jobId) {
        try {
            const data = await apiRequest(API_ENDPOINTS.getJob, "GET", null, jobId);
            
            if (data) {
                // Populate the edit form
                editJobForm['edit-job-title'].value = data.title;
                editJobForm['edit-company'].value = data.company;
                editJobForm['edit-location'].value = data.location;
                editJobForm['edit-job-type'].value = data.type;
                editJobForm['edit-salary'].value = data.salary;
                editJobForm['edit-tags'].value = Array.isArray(data.tags) ? data.tags.join(', ') : data.tags;
                editJobForm['edit-description'].value = data.description;
                editJobForm['edit-requirements'].value = data.requirements;
                editJobForm['edit-application-link'].value = data.application_link;
                
                // Store the job ID
                currentEditingJobId = jobId;
                
                // Show the modal
                editJobModal.classList.remove('hidden');
            } else {
                showToast("❌ Failed to load job details", "danger");
            }
        } catch (error) {
            console.error('Edit job error:', error);
            showToast("❌ Failed to load job details", "danger");
        }
    }

    async function handleEditJobSubmission(e) {
        e.preventDefault();
        
        if (isLoading) return;
        
        const form = e.target;
        const submitButton = form.querySelector('button[type="submit"]');
        const buttonText = submitButton.querySelector('.button-text');
        const buttonSpinner = submitButton.querySelector('.loading-spinner');
        
        // Collect form data
        const jobData = {
            title: form['edit-job-title'].value.trim(),
            company: form['edit-company'].value.trim(),
            location: form['edit-location'].value.trim(),
            type: form['edit-job-type'].value,
            salary: form['edit-salary'].value.trim(),
            tags: form['edit-tags'].value.trim(),
            description: form['edit-description'].value.trim(),
            requirements: form['edit-requirements'].value.trim(),
            application_link: form['edit-application-link'].value.trim()
        };

        // Validate required fields
        if (!jobData.title || !jobData.company || !jobData.location || !jobData.type || 
            !jobData.salary || !jobData.description || !jobData.requirements || !jobData.application_link) {
            showToast("⚠️ Please fill in all required fields", "warning");
            return;
        }

        // Validate URL
        try {
            new URL(jobData.application_link);
        } catch (e) {
            showToast("⚠️ Please enter a valid URL for the application link", "warning");
            return;
        }

        // Show loading state
        isLoading = true;
        buttonText.textContent = 'Updating...';
        buttonSpinner.classList.remove('hidden');
        submitButton.disabled = true;

        try {
            const data = await apiRequest(API_ENDPOINTS.updateJob, "PUT", jobData, currentEditingJobId);
            
            if (data && data.success) {
                showToast("✅ Job updated successfully!", "success");
                closeEditJobModal();
                loadJobs(); // Refresh the job list
            } else {
                showToast(data?.message || "❌ Failed to update job", "danger");
            }
        } catch (error) {
            console.error('Job update error:', error);
            showToast("❌ Failed to update job. Please try again.", "danger");
        } finally {
            // Reset button state
            isLoading = false;
            buttonText.textContent = 'Update Job';
            buttonSpinner.classList.add('hidden');
            submitButton.disabled = false;
        }
    }

    function closeEditJobModal() {
        editJobModal.classList.add('hidden');
        editJobForm.reset();
        currentEditingJobId = null;
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
            
            // Format tags for display
            let tagsHtml = '';
            if (job.tags && Array.isArray(job.tags)) {
                tagsHtml = job.tags.map(tag => 
                    `<span class="inline-block bg-gray-200 rounded-full px-3 py-1 text-sm font-semibold text-gray-700 mr-2 mb-1">
                        ${escapeHtml(tag)}
                    </span>`
                ).join('');
            }
            
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
                <td class="px-6 py-4">
                    <div class="flex flex-wrap">
                        ${tagsHtml}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button class="action-btn text-indigo-600 hover:text-indigo-900 mr-3" title="Edit" data-job-id="${job.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn text-red-600 hover:text-red-900" title="Delete" data-job-id="${job.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            // Add event listeners to action buttons
            const editBtn = row.querySelector('[data-job-id].text-indigo-600');
            const deleteBtn = row.querySelector('[data-job-id].text-red-600');
            
            if (editBtn) {
                editBtn.addEventListener('click', () => editJob(job.id));
            }
            
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
                <td colspan="7" class="px-6 py-4 text-center">
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
                <td colspan="7" class="px-6 py-4 text-center">
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