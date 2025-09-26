// ===============================
// Debug Configuration
// ===============================
const DEBUG_MODE = new URLSearchParams(window.location.search).get('debug') === 'true';

// ===============================
// API Endpoints
// ===============================
const API_BASE = "http://127.0.0.1:8000/api";
const API_ENDPOINTS = {
  GET_JOBS: `${API_BASE}/jobs/`,        // list jobs
  POST_JOB: `${API_BASE}/jobs/post/`,   // create job
  SEARCH_JOBS: `${API_BASE}/jobs/`,     // ?search=query
  GET_JOB: (id) => `${API_BASE}/jobs/${id}/`,     // retrieve job
  UPDATE_JOB: (id) => `${API_BASE}/jobs/${id}/`,  // update job
  DELETE_JOB: (id) => `${API_BASE}/jobs/${id}/`,  // delete job
};

// ===============================
// DOM Elements
// ===============================
document.addEventListener('DOMContentLoaded', () => {
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
    const cancelEditBtn = document.getElementById('cancel-edit');
    const closeSidebarBtn = document.getElementById('close-sidebar');
    const debugPanel = document.getElementById('debug-panel');
    const debugToggle = document.getElementById('debug-toggle');
    const debugContent = document.getElementById('debug-content');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const debugCloseBtn = document.getElementById('debug-close');

    // ===============================
    // Debug Mode Initialization
    // ===============================
    if (DEBUG_MODE) {
        console.log("🐛 DEBUG MODE ENABLED");
        if (debugPanel) debugPanel.classList.remove('hidden');
        if (debugToggle) debugToggle.checked = true;
        
        // Add debug info to page
        document.body.classList.add('debug-mode');
        addDebugInfo();
    }

    // Debug toggle event listener
    if (debugToggle) {
        debugToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('debug-mode');
                if (debugPanel) debugPanel.classList.remove('hidden');
                addDebugInfo();
            } else {
                document.body.classList.remove('debug-mode');
                if (debugPanel) debugPanel.classList.add('hidden');
            }
        });
    }

    if (debugCloseBtn) {
        debugCloseBtn.addEventListener('click', () => {
            if (debugPanel) debugPanel.classList.add('hidden');
            if (debugToggle) debugToggle.checked = false;
        });
    }

    // ===============================
    // State Management
    // ===============================
    let searchQuery = '';
    let isLoading = false;
    let currentEditingJobId = null;
    let jobs = [];
    let currentPage = 1;
    const jobsPerPage = 10;
    let totalPages = 1;
    let debugLogs = [];
    let formErrors = {};

    // ===============================
    // Event Listeners
    // ===============================
    if (jobPostingForm) {
        jobPostingForm.addEventListener('submit', handleJobSubmission);
        
        // Real-time validation
        const formInputs = jobPostingForm.querySelectorAll('input, select, textarea');
        formInputs.forEach(input => {
            input.addEventListener('blur', () => validateField(input));
            input.addEventListener('input', () => {
                if (input.classList.contains('error')) {
                    validateField(input);
                }
            });
        });
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
    
    if (closeSidebarBtn) {
        closeSidebarBtn.addEventListener('click', closeSidebar);
    }

    if (editJobForm) {
        editJobForm.addEventListener('submit', handleEditJobSubmission);
        
        // Real-time validation
        const editFormInputs = editJobForm.querySelectorAll('input, select, textarea');
        editFormInputs.forEach(input => {
            input.addEventListener('blur', () => validateField(input));
            input.addEventListener('input', () => {
                if (input.classList.contains('error')) {
                    validateField(input);
                }
            });
        });
    }

    if (closeEditModal) {
        closeEditModal.addEventListener('click', closeEditJobModal);
    }
    
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', closeEditJobModal);
    }

    // Pagination buttons
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                fetchJobs();
            }
        });
    }

    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                fetchJobs();
            }
        });
    }

    // Close sidebar when clicking on a menu item on mobile
    const sidebarLinks = sidebar.querySelectorAll('.sidebar-link');
    sidebarLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    });

    // Close sidebar when resizing window to desktop size
    window.addEventListener('resize', debounce(() => {
        if (window.innerWidth > 768 && sidebar.classList.contains('open')) {
            closeSidebar();
        }
    }, 300));

    // Close modal when clicking outside
    window.addEventListener('click', (e) => {
        if (e.target === editJobModal) {
            closeEditJobModal();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // ESC key to close sidebar or modal
        if (e.key === 'Escape') {
            if (sidebar.classList.contains('open')) {
                closeSidebar();
            } else if (!editJobModal.classList.contains('hidden')) {
                closeEditJobModal();
            }
        }
        
        // Ctrl/Cmd + K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (searchInput) searchInput.focus();
        }
        
        // Debug mode shortcut: Ctrl+Shift+D
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            toggleDebugMode();
        }
    });

    // Global error handlers
    window.addEventListener('error', (event) => {
        logDebug(`Global error: ${event.message}`, event.error);
        if (DEBUG_MODE) {
            showToast(`Global error: ${event.message}`, 'danger');
        }
    });

    window.addEventListener('unhandledrejection', (event) => {
        logDebug(`Unhandled rejection: ${event.reason}`, event.reason);
        if (DEBUG_MODE) {
            showToast(`Unhandled rejection: ${event.reason}`, 'danger');
        }
    });

    // ===============================
    // Debug Helper Functions
    // ===============================
    function logDebug(message, data = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            message,
            data
        };
        
        debugLogs.push(logEntry);
        
        // Keep only last 50 logs
        if (debugLogs.length > 50) {
            debugLogs = debugLogs.slice(-50);
        }
        
        if (DEBUG_MODE) {
            console.log(`🐛 [${timestamp}] ${message}`, data);
            updateDebugPanel();
        }
    }

    function addDebugInfo() {
        if (!DEBUG_MODE) return;
        
        const debugInfo = document.createElement('div');
        debugInfo.className = 'debug-info';
        debugInfo.innerHTML = `
            <h4>Debug Information</h4>
            <p><strong>API Base:</strong> ${API_BASE}</p>
            <p><strong>Current Page:</strong> ${currentPage}</p>
            <p><strong>Total Pages:</strong> ${totalPages}</p>
            <p><strong>Jobs Per Page:</strong> ${jobsPerPage}</p>
            <p><strong>Search Query:</strong> ${searchQuery || 'None'}</p>
            <p><strong>Loading State:</strong> ${isLoading}</p>
            <p><strong>Current Editing Job:</strong> ${currentEditingJobId || 'None'}</p>
            <p><strong>Total Jobs:</strong> ${jobs.length}</p>
            <p><strong>Form Errors:</strong> ${Object.keys(formErrors).length}</p>
        `;
        
        if (debugContent) {
            debugContent.innerHTML = '';
            debugContent.appendChild(debugInfo);
        }
    }

    function updateDebugPanel() {
        if (!DEBUG_MODE || !debugContent) return;
        
        const logsHtml = debugLogs.map(log => `
            <div class="debug-log">
                <div class="debug-timestamp">${log.timestamp}</div>
                <div class="debug-message">${log.message}</div>
                ${log.data ? `<pre class="debug-data">${JSON.stringify(log.data, null, 2)}</pre>` : ''}
            </div>
        `).join('');
        
        debugContent.innerHTML = `
            <div class="debug-info">
                <h4>Debug Information</h4>
                <p><strong>API Base:</strong> ${API_BASE}</p>
                <p><strong>Current Page:</strong> ${currentPage}</p>
                <p><strong>Total Pages:</strong> ${totalPages}</p>
                <p><strong>Jobs Per Page:</strong> ${jobsPerPage}</p>
                <p><strong>Search Query:</strong> ${searchQuery || 'None'}</p>
                <p><strong>Loading State:</strong> ${isLoading}</p>
                <p><strong>Current Editing Job:</strong> ${currentEditingJobId || 'None'}</p>
                <p><strong>Total Jobs:</strong> ${jobs.length}</p>
                <p><strong>Form Errors:</strong> ${Object.keys(formErrors).length}</p>
            </div>
            <div class="debug-logs">
                <h4>Debug Logs</h4>
                ${logsHtml}
            </div>
        `;
    }

    function toggleDebugMode() {
        const newDebugMode = !DEBUG_MODE;
        const url = new URL(window.location);
        if (newDebugMode) {
            url.searchParams.set('debug', 'true');
            showToast("🐛 Debug mode enabled", "info");
        } else {
            url.searchParams.delete('debug');
            showToast("🐛 Debug mode disabled", "info");
        }
        window.location.href = url.toString();
    }

    // ===============================
    // API Helper with Enhanced Error Handling
    // ===============================
    async function apiRequest(endpoint, method = 'GET', body = null, id = null, retryCount = 0) {
        const maxRetries = 2;
        const requestId = Math.random().toString(36).substring(2, 9);
        
        logDebug(`[${requestId}] Starting API request: ${method} ${endpoint}`, { body, id });
        
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

            // Construct URL with ID if provided
            let url = endpoint;
            if (id !== null && id !== undefined) {
                url = endpoint(id);
            }

            // Add pagination parameters for GET requests
            if (method === 'GET' && endpoint === API_ENDPOINTS.GET_JOBS) {
                url += `?page=${currentPage}&limit=${jobsPerPage}`;
                if (searchQuery) {
                    url += `&search=${encodeURIComponent(searchQuery)}`;
                }
            }

            logDebug(`[${requestId}] Request URL: ${url}`, options);

            // Add timeout to fetch request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            logDebug(`[${requestId}] Response status: ${response.status}`, response);

            // Handle non-JSON responses
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const errorText = await response.text();
                logDebug(`[${requestId}] Non-JSON response: ${errorText}`, { status: response.status });
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            logDebug(`[${requestId}] Response data:`, data);
            
            if (!response.ok) {
                logDebug(`[${requestId}] API Error:`, data);
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            logDebug(`[${requestId}] API request failed:`, error);
            
            // Retry logic for network errors
            if (retryCount < maxRetries && (error.name === 'TypeError' || error.name === 'AbortError')) {
                logDebug(`[${requestId}] Retrying request (${retryCount + 1}/${maxRetries})...`);
                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                return apiRequest(endpoint, method, body, id, retryCount + 1);
            }
            
            // Special handling for CORS errors
            if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                showToast("⚠️ CORS error: Backend may not be configured to accept requests from this domain", "danger");
            } else if (error.name === 'AbortError') {
                showToast("⚠️ Request timed out. Please check your connection and try again.", "danger");
            } else {
                showToast(`⚠️ ${error.message || 'Network error. Please try again.'}`, 'danger');
            }
            
            return null;
        }
    }

    // ===============================
    // Server Health Check
    // ===============================
    async function checkServerStatus() {
        showToast("🔄 Checking server status...", "info");
        logDebug("Starting server health check");
        
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
            attempts++;
            try {
                logDebug(`Health check attempt ${attempts}/${maxAttempts}`);
                const response = await fetch(API_ENDPOINTS.GET_JOBS, { 
                    method: "GET",
                    mode: 'cors'
                });
                
                logDebug(`Health check response status: ${response.status}`, response);
                
                if (response.ok) {
                    showToast("✅ Server is online", "success");
                    logDebug("Server health check successful");
                    return true;
                } else {
                    showToast(`⚠️ Server responded with ${response.status}`, "warning");
                    logDebug(`Server responded with status: ${response.status}`);
                    if (attempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            } catch (error) {
                logDebug(`Health check failed:`, error);
                
                if (attempts < maxAttempts) {
                    showToast(`⚠️ Connection attempt ${attempts} failed. Retrying...`, "warning");
                    await new Promise(resolve => setTimeout(resolve, 2000));
                } else {
                    // Special handling for CORS errors
                    if (error.name === 'TypeError' && error.message.includes('Failed to fetch')) {
                        showToast("⚠️ Unable to connect to server. CORS may be blocking the request.", "danger");
                    } else {
                        showToast("❌ Server is unreachable after multiple attempts", "danger");
                    }
                }
            }
        }
        
        logDebug("Server health check failed after all attempts");
        return false;
    }

    // ===============================
    // Job Functions
    // ===============================
    async function fetchJobs() {
        if (isLoading) return;
        
        isLoading = true;
        setLoadingState(true);
        
        logDebug("Fetching jobs", { page: currentPage, searchQuery });
        
        try {
            const response = await apiRequest(API_ENDPOINTS.GET_JOBS, 'GET');
            
            if (response) {
                jobs = response.results || [];
                totalPages = Math.ceil(response.count / jobsPerPage) || 1;
                
                logDebug("Jobs fetched successfully", { 
                    count: response.count, 
                    results: jobs.length,
                    totalPages 
                });
                
                renderJobsTable();
                updatePaginationControls();
                updateJobsCount(response.count || 0);
            }
        } catch (error) {
            logDebug("Error fetching jobs:", error);
            showToast("Failed to fetch jobs. Please try again.", "danger");
        } finally {
            isLoading = false;
            setLoadingState(false);
        }
    }

    function renderJobsTable() {
        if (!jobsTableBody) return;
        
        if (jobs.length === 0) {
            jobsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="px-6 py-8 text-center">
                        <div class="text-gray-400 mb-2">
                            <i class="fas fa-briefcase text-4xl"></i>
                        </div>
                        <p class="text-gray-400">No jobs found</p>
                        ${searchQuery ? `
                            <button class="mt-4 text-indigo-400 hover:text-indigo-300" onclick="clearSearch()">
                                Clear search
                            </button>
                        ` : ''}
                    </td>
                </tr>
            `;
            return;
        }
        
        jobsTableBody.innerHTML = jobs.map(job => `
            <tr class="job-row">
                <td class="px-6 py-4 whitespace-nowrap">
                    <div class="font-medium">${escapeHtml(job.title)}</div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${escapeHtml(job.company)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${escapeHtml(job.location)}
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    <span class="badge bg-indigo-900 text-indigo-200">${escapeHtml(job.type)}</span>
                </td>
                <td class="px-6 py-4 whitespace-nowrap">
                    ${formatDate(job.created_at)}
                </td>
                <td class="px-6 py-4">
                    <div class="flex flex-wrap gap-1">
                        ${job.tags ? job.tags.split(',').map(tag => 
                            `<span class="tag-badge">${escapeHtml(tag.trim())}</span>`
                        ).join('') : ''}
                    </div>
                </td>
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button class="action-btn edit mr-2" onclick="editJob(${job.id})" aria-label="Edit job">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" onclick="confirmDeleteJob(${job.id})" aria-label="Delete job">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }

    function updatePaginationControls() {
        if (prevPageBtn) {
            prevPageBtn.disabled = currentPage <= 1;
        }
        
        if (nextPageBtn) {
            nextPageBtn.disabled = currentPage >= totalPages;
        }
        
        // Update page number buttons
        const paginationContainer = document.getElementById('pagination');
        if (paginationContainer) {
            const pageButtons = [];
            
            // Previous button
            pageButtons.push(`
                <button class="px-3 py-1 border rounded-lg hover:bg-slate-700 disabled:opacity-50" 
                        ${currentPage <= 1 ? 'disabled' : ''} 
                        onclick="goToPage(${currentPage - 1})">
                    <i class="fas fa-chevron-left"></i> Previous
                </button>
            `);
            
            // Page number buttons
            const maxVisiblePages = 5;
            let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
            let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
            
            if (endPage - startPage < maxVisiblePages - 1) {
                startPage = Math.max(1, endPage - maxVisiblePages + 1);
            }
            
            if (startPage > 1) {
                pageButtons.push(`
                    <button class="px-3 py-1 border rounded-lg hover:bg-slate-700" onclick="goToPage(1)">
                        1
                    </button>
                `);
                
                if (startPage > 2) {
                    pageButtons.push(`<span class="px-2">...</span>`);
                }
            }
            
            for (let i = startPage; i <= endPage; i++) {
                pageButtons.push(`
                    <button class="px-3 py-1 ${i === currentPage ? 'bg-indigo-600 text-white' : 'border rounded-lg hover:bg-slate-700'}" 
                            onclick="goToPage(${i})">
                        ${i}
                    </button>
                `);
            }
            
            if (endPage < totalPages) {
                if (endPage < totalPages - 1) {
                    pageButtons.push(`<span class="px-2">...</span>`);
                }
                
                pageButtons.push(`
                    <button class="px-3 py-1 border rounded-lg hover:bg-slate-700" onclick="goToPage(${totalPages})">
                        ${totalPages}
                    </button>
                `);
            }
            
            // Next button
            pageButtons.push(`
                <button class="px-3 py-1 border rounded-lg hover:bg-slate-700 disabled:opacity-50" 
                        ${currentPage >= totalPages ? 'disabled' : ''} 
                        onclick="goToPage(${currentPage + 1})">
                    Next <i class="fas fa-chevron-right"></i>
                </button>
            `);
            
            paginationContainer.innerHTML = pageButtons.join('');
        }
    }

    function updateJobsCount(totalCount) {
        if (jobsCount) {
            const startItem = (currentPage - 1) * jobsPerPage + 1;
            const endItem = Math.min(currentPage * jobsPerPage, totalCount);
            
            jobsCount.innerHTML = `
                Showing <span class="font-medium">${startItem}-${endItem}</span> of 
                <span class="font-medium">${totalCount}</span> results
            `;
        }
    }

    function goToPage(page) {
        if (page >= 1 && page <= totalPages && page !== currentPage) {
            currentPage = page;
            fetchJobs();
            
            // Scroll to top of table
            const tableContainer = document.querySelector('.table-container');
            if (tableContainer) {
                tableContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }

    // Make goToPage globally accessible
    window.goToPage = goToPage;

    async function handleJobSubmission(e) {
        e.preventDefault();
        
        if (!validateForm(jobPostingForm)) {
            showToast("Please fix the errors in the form", "danger");
            return;
        }
        
        const submitButton = jobPostingForm.querySelector('button[type="submit"]');
        const buttonText = submitButton.querySelector('.button-text');
        const spinner = submitButton.querySelector('.loading-spinner');
        
        // Show loading state
        buttonText.textContent = "Posting...";
        spinner.classList.remove('hidden');
        submitButton.disabled = true;
        
        const formData = {
            title: document.getElementById('job-title').value,
            company: document.getElementById('company').value,
            location: document.getElementById('location').value,
            type: document.getElementById('job-type').value,
            salary: document.getElementById('salary').value,
            tags: document.getElementById('tags').value,
            description: document.getElementById('description').value,
            requirements: document.getElementById('requirements').value,
            application_link: document.getElementById('application-link').value
        };
        
        logDebug("Submitting new job", formData);
        
        try {
            const response = await apiRequest(API_ENDPOINTS.POST_JOB, 'POST', formData);
            
            if (response) {
                showToast("Job posted successfully!", "success");
                jobPostingForm.reset();
                fetchJobs();
            }
        } catch (error) {
            logDebug("Error posting job:", error);
            showToast("Failed to post job. Please try again.", "danger");
        } finally {
            // Reset button state
            buttonText.textContent = "Post Job";
            spinner.classList.add('hidden');
            submitButton.disabled = false;
        }
    }

    function editJob(jobId) {
        const job = jobs.find(j => j.id === jobId);
        if (!job) {
            showToast("Job not found", "danger");
            return;
        }
        
        currentEditingJobId = jobId;
        
        // Populate form fields
        document.getElementById('edit-job-title').value = job.title || '';
        document.getElementById('edit-company').value = job.company || '';
        document.getElementById('edit-location').value = job.location || '';
        document.getElementById('edit-job-type').value = job.type || '';
        document.getElementById('edit-salary').value = job.salary || '';
        document.getElementById('edit-tags').value = job.tags || '';
        document.getElementById('edit-description').value = job.description || '';
        document.getElementById('edit-requirements').value = job.requirements || '';
        document.getElementById('edit-application-link').value = job.application_link || '';
        
        // Show modal
        if (editJobModal) {
            editJobModal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
        
        logDebug("Opening edit job modal", { jobId, job });
    }

    async function handleEditJobSubmission(e) {
        e.preventDefault();
        
        if (!validateForm(editJobForm)) {
            showToast("Please fix the errors in the form", "danger");
            return;
        }
        
        const submitButton = editJobForm.querySelector('button[type="submit"]');
        const buttonText = submitButton.querySelector('.button-text');
        const spinner = submitButton.querySelector('.loading-spinner');
        
        // Show loading state
        buttonText.textContent = "Updating...";
        spinner.classList.remove('hidden');
        submitButton.disabled = true;
        
        const formData = {
            title: document.getElementById('edit-job-title').value,
            company: document.getElementById('edit-company').value,
            location: document.getElementById('edit-location').value,
            type: document.getElementById('edit-job-type').value,
            salary: document.getElementById('edit-salary').value,
            tags: document.getElementById('edit-tags').value,
            description: document.getElementById('edit-description').value,
            requirements: document.getElementById('edit-requirements').value,
            application_link: document.getElementById('edit-application-link').value
        };
        
        logDebug("Updating job", { jobId: currentEditingJobId, formData });
        
        try {
            const response = await apiRequest(API_ENDPOINTS.UPDATE_JOB, 'PUT', formData, currentEditingJobId);
            
            if (response) {
                showToast("Job updated successfully!", "success");
                closeEditJobModal();
                fetchJobs();
            }
        } catch (error) {
            logDebug("Error updating job:", error);
            showToast("Failed to update job. Please try again.", "danger");
        } finally {
            // Reset button state
            buttonText.textContent = "Update Job";
            spinner.classList.add('hidden');
            submitButton.disabled = false;
        }
    }

    function closeEditJobModal() {
        if (editJobModal) {
            editJobModal.classList.add('hidden');
            document.body.style.overflow = '';
        }
        
        currentEditingJobId = null;
        
        // Clear any form errors
        const errorMessages = editJobForm.querySelectorAll('.error-message');
        errorMessages.forEach(msg => msg.classList.remove('show'));
        
        const errorInputs = editJobForm.querySelectorAll('.form-control.error');
        errorInputs.forEach(input => input.classList.remove('error'));
    }

    function confirmDeleteJob(jobId) {
        const job = jobs.find(j => j.id === jobId);
        if (!job) return;
        
        if (confirm(`Are you sure you want to delete "${job.title}"? This action cannot be undone.`)) {
            deleteJob(jobId);
        }
    }

    async function deleteJob(jobId) {
        logDebug("Deleting job", { jobId });
        
        try {
            const response = await apiRequest(API_ENDPOINTS.DELETE_JOB, 'DELETE', null, jobId);
            
            if (response) {
                showToast("Job deleted successfully", "success");
                fetchJobs();
            }
        } catch (error) {
            logDebug("Error deleting job:", error);
            showToast("Failed to delete job. Please try again.", "danger");
        }
    }

    function handleSearch() {
        searchQuery = searchInput.value.trim();
        currentPage = 1; // Reset to first page when searching
        
        // Show/hide clear button
        if (clearSearchBtn) {
            clearSearchBtn.classList.toggle('hidden', !searchQuery);
        }
        
        logDebug("Searching jobs", { searchQuery });
        fetchJobs();
    }

    function clearSearch() {
        if (searchInput) {
            searchInput.value = '';
            searchQuery = '';
            currentPage = 1;
            
            if (clearSearchBtn) {
                clearSearchBtn.classList.add('hidden');
            }
            
            logDebug("Clearing search");
            fetchJobs();
        }
    }

    // ===============================
    // Form Validation
    // ===============================
    function validateForm(form) {
        const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
        let isValid = true;
        formErrors = {};
        
        inputs.forEach(input => {
            if (!validateField(input)) {
                isValid = false;
                formErrors[input.name] = true;
            }
        });
        
        logDebug("Form validation", { isValid, errors: formErrors });
        return isValid;
    }

    function validateField(input) {
        const value = input.value.trim();
        const fieldName = input.name;
        const errorElement = input.parentNode.querySelector('.error-message');
        
        // Reset error state
        input.classList.remove('error');
        if (errorElement) errorElement.classList.remove('show');
        
        // Required field validation
        if (input.hasAttribute('required') && !value) {
            showFieldError(input, errorElement, 'This field is required');
            return false;
        }
        
        // Email validation
        if (input.type === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                showFieldError(input, errorElement, 'Please enter a valid email address');
                return false;
            }
        }
        
        // URL validation
        if (input.type === 'url' && value) {
            try {
                new URL(value);
            } catch (e) {
                showFieldError(input, errorElement, 'Please enter a valid URL');
                return false;
            }
        }
        
        // Application link/email validation
        if (fieldName === 'application-link' && value) {
            const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
            const isUrl = /^https?:\/\/.+/.test(value);
            
            if (!isEmail && !isUrl) {
                showFieldError(input, errorElement, 'Please enter a valid email or URL');
                return false;
            }
        }
        
        // Custom validation for specific fields
        if (fieldName === 'salary' && value) {
            // Check if salary is in a reasonable format (e.g., "KSh 50,000 - 80,000")
            const salaryRegex = /^(KSh\s)?\d{1,3}(,\d{3})*(\s*-\s*\d{1,3}(,\d{3)*)?$/;
            if (!salaryRegex.test(value)) {
                showFieldError(input, errorElement, 'Please enter a valid salary range (e.g., KSh 50,000 - 80,000)');
                return false;
            }
        }
        
        return true;
    }

    function showFieldError(input, errorElement, message) {
        input.classList.add('error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.add('show');
        }
    }

    // ===============================
    // UI Helper Functions
    // ===============================
    function toggleSidebar() {
        if (sidebar) {
            sidebar.classList.toggle('open');
            
            if (sidebarOverlay) {
                sidebarOverlay.classList.toggle('show');
            }
            
            // Update menu toggle button state
            if (menuToggle) {
                menuToggle.setAttribute('aria-expanded', sidebar.classList.contains('open'));
            }
            
            logDebug("Toggling sidebar", { isOpen: sidebar.classList.contains('open') });
        }
    }

    function closeSidebar() {
        if (sidebar && sidebar.classList.contains('open')) {
            sidebar.classList.remove('open');
            
            if (sidebarOverlay) {
                sidebarOverlay.classList.remove('show');
            }
            
            // Update menu toggle button state
            if (menuToggle) {
                menuToggle.setAttribute('aria-expanded', 'false');
            }
            
            logDebug("Closing sidebar");
        }
    }

    function setLoadingState(loading) {
        isLoading = loading;
        
        // Update loading spinners
        const spinners = document.querySelectorAll('.loading-spinner');
        spinners.forEach(spinner => {
            spinner.classList.toggle('hidden', !loading);
        });
        
        // Update loading rows
        const loadingRows = document.querySelectorAll('.loading-row');
        loadingRows.forEach(row => {
            row.classList.toggle('hidden', !loading);
        });
        
        // Disable/enable forms during loading
        if (jobPostingForm) jobPostingForm.style.opacity = loading ? '0.7' : '1';
        if (editJobForm) editJobForm.style.opacity = loading ? '0.7' : '1';
    }

    function formatDate(dateString) {
        const options = { year: 'numeric', month: 'short', day: 'numeric' };
        return new Date(dateString).toLocaleDateString(undefined, options);
    }

    function escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }

    // ===============================
    // Toast Notifications
    // ===============================
    function showToast(message, type = "info", error = null) {
        const toastContainer = document.querySelector('.toast-container') || createToastContainer();
        const toast = document.createElement('div');
        
        const icons = {
            success: "fa-check-circle",
            danger: "fa-exclamation-circle",
            warning: "fa-exclamation-triangle",
            info: "fa-info-circle"
        };
        
        const colors = {
            success: "bg-green-600",
            danger: "bg-red-600",
            warning: "bg-yellow-500 text-dark",
            info: "bg-blue-600"
        };
        
        let debugInfo = '';
        if (DEBUG_MODE && error) {
            debugInfo = `
                <div class="debug-error-details">
                    <strong>Error Details:</strong>
                    <pre>${escapeHtml(error.stack || error.toString())}</pre>
                </div>
            `;
        }
        
        toast.className = `toast ${colors[type] || colors.info}`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="flex items-start">
                <i class="fas ${icons[type] || icons.info} mr-3 mt-1"></i>
                <div class="toast-body">
                    <div>${message}</div>
                    ${debugInfo}
                </div>
                <button type="button" class="text-white hover:text-gray-200 ml-4" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        toastContainer.appendChild(toast);
        
        // Auto-remove after 4 seconds
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => {
                toast.remove();
            }, 300);
        }, 4000);
    }

    function createToastContainer() {
        const container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
        return container;
    }

    // ===============================
    // Utility Functions
    // ===============================
    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // ===============================
    // Initialize
    // ===============================
    checkServerStatus();
    fetchJobs();

    // Expose clearSearch function globally for the empty state button
    window.clearSearch = clearSearch;
    window.editJob = editJob;
    window.confirmDeleteJob = confirmDeleteJob;
});

// ===============================
// Debug CSS (for development only)
// ===============================
if (DEBUG_MODE) {
    const debugStyles = document.createElement('style');
    debugStyles.textContent = `
        .debug-mode {
            --debug-bg: #1e293b;
            --debug-border: #334155;
            --debug-text: #e2e8f0;
        }
        
        .debug-panel {
            position: fixed;
            bottom: 0;
            right: 0;
            width: 400px;
            max-height: 50vh;
            background: var(--debug-bg);
            border: 1px solid var(--debug-border);
            color: var(--debug-text);
            font-family: monospace;
            font-size: 12px;
            z-index: 9999;
            overflow: auto;
            padding: 10px;
            border-radius: 0.5rem 0 0 0;
            box-shadow: 0 -5px 15px rgba(0, 0, 0, 0.3);
        }
        
        .debug-info {
            margin-bottom: 15px;
            padding-bottom: 10px;
            border-bottom: 1px solid var(--debug-border);
        }
        
        .debug-info h4 {
            margin: 0 0 5px 0;
            color: #60a5fa;
        }
        
        .debug-logs {
            max-height: 200px;
            overflow-y: auto;
        }
        
        .debug-log {
            margin-bottom: 10px;
            padding: 5px;
            background: rgba(0,0,0,0.2);
            border-radius: 3px;
        }
        
        .debug-timestamp {
            color: #94a3b8;
            font-size: 10px;
        }
        
        .debug-message {
            margin: 2px 0;
            color: #f8fafc;
        }
        
        .debug-data {
            margin: 5px 0 0 0;
            padding: 5px;
            background: rgba(0,0,0,0.3);
            border-radius: 3px;
            overflow-x: auto;
            font-size: 10px;
        }
        
        .debug-error-details {
            margin-top: 10px;
            padding: 5px;
            background: rgba(239, 68, 68, 0.1);
            border-radius: 3px;
            border-left: 3px solid #ef4444;
        }
        
        .debug-error-details pre {
            margin: 5px 0 0 0;
            white-space: pre-wrap;
            word-break: break-all;
        }
        
        .debug-toggle {
            position: fixed;
            bottom: 10px;
            right: 10px;
            z-index: 10000;
            background: rgba(30, 41, 59, 0.8);
            padding: 0.5rem;
            border-radius: 0.5rem;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
        }
        
        .debug-toggle label {
            display: flex;
            align-items: center;
            cursor: pointer;
        }
        
        .debug-toggle input[type="checkbox"] {
            position: absolute;
            opacity: 0;
        }
        
        .debug-toggle .block {
            width: 3.5rem;
            height: 1.75rem;
            background: #4b5563;
            border-radius: 9999px;
            position: relative;
            transition: background 0.3s;
        }
        
        .debug-toggle input[type="checkbox"]:checked + .block {
            background: var(--gradient);
        }
        
        .debug-toggle .dot {
            position: absolute;
            top: 0.25rem;
            left: 0.25rem;
            width: 1.25rem;
            height: 1.25rem;
            background: white;
            border-radius: 50%;
            transition: transform 0.3s;
        }
        
        .debug-toggle input[type="checkbox"]:checked + .block .dot {
            transform: translateX(1.75rem);
        }
    `;
    document.head.appendChild(debugStyles);
}