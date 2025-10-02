const API_BASE = "https://server-jobs-2.onrender.com/api";

// ===============================
// Debug Configuration
// ===============================
const DEBUG_MODE = new URLSearchParams(window.location.search).get('debug') === 'true';

// ===============================
// Authentication Handling
// ===============================
function checkAuth() {
    const isLoggedIn = localStorage.getItem('authToken') !== null;
    const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
    if (!isLoggedIn && !isLoginPage) {
        window.location.href = 'index.html';
    }
    return isLoggedIn;
}

function logout() {
    localStorage.removeItem('authToken');
    showToast("Logged out successfully", "success");
    window.location.href = 'index.html';
}

function login(username, password) {
    // Placeholder for future backend auth
    if (username === 'admin' && password === '1234') {
        localStorage.setItem('authToken', 'dummy-token-' + Math.random().toString(36).substring(2));
        return true;
    }
    return false;
}

// ===============================
// API Endpoints
// ===============================
const API_ENDPOINTS = {
    GET_JOBS: `${API_BASE}/jobs/`,
    POST_JOB: `${API_BASE}/jobs/post/`,
    SEARCH_JOBS: `${API_BASE}/jobs/`,
    GET_JOB: (id) => `${API_BASE}/jobs/${id}/`,
    UPDATE_JOB: (id) => `${API_BASE}/jobs/${id}/`,
    DELETE_JOB: (id) => `${API_BASE}/jobs/${id}/`,
    HEALTH_CHECK: `${API_BASE}/health`
};

// ===============================
// State Management
// ===============================
const state = {
    searchQuery: '',
    isLoading: false,
    currentEditingJobId: null,
    jobs: [],
    currentPage: 1,
    jobsPerPage: 10,
    debugLogs: [],
    abortControllers: new Map(),
    elements: {}
};

// ===============================
// DOM Elements Cache
// ===============================
function cacheElements() {
    state.elements = {
        jobPostingForm: document.getElementById('job-posting-form'),
        searchInput: document.getElementById('job-search'),
        clearSearchBtn: document.getElementById('clear-search'),
        jobsTableBody: document.getElementById('jobs-table-body'),
        jobsCount: document.getElementById('jobs-count'),
        mobileMenuToggle: document.getElementById('mobile-menu-toggle'),
        sidebar: document.getElementById('sidebar'),
        editJobModal: document.getElementById('edit-job-modal'),
        editJobForm: document.getElementById('edit-job-form'),
        closeEditModal: document.getElementById('close-edit-modal'),
        cancelEditBtn: document.getElementById('cancel-edit'),
        debugPanel: document.getElementById('debug-panel'),
        debugToggle: document.getElementById('debug-toggle'),
        debugContent: document.getElementById('debug-content'),
        debugCloseBtn: document.getElementById('debug-close'),
        prevPageBtn: document.getElementById('prev-page'),
        nextPageBtn: document.getElementById('next-page'),
        logoutBtn: document.getElementById('logout-btn')
    };
}

// ===============================
// Utility Functions
// ===============================
const utils = {
    debounce: (func, wait) => {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    escapeHtml: (unsafe) => {
        if (!unsafe) return '';
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    },

    sanitizeInput: (input) => {
        if (!input) return '';
        return input.replace(/[<>]/g, '');
    },

    createTemplate: (htmlString) => {
        const template = document.createElement('template');
        template.innerHTML = htmlString.trim();
        return template.content.firstChild;
    }
};

// ===============================
// API Service
// ===============================
const apiService = {
    async request(endpoint, method = 'GET', body = null, id = null, retryCount = 0) {
        const maxRetries = 2;
        const requestId = Math.random().toString(36).substring(2, 9);
        
        logDebug(`[${requestId}] API request: ${method} ${endpoint}`, { body, id });

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        state.abortControllers.set(requestId, controller);

        try {
            const options = {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'Authorization': localStorage.getItem('authToken') ? `Bearer ${localStorage.getItem('authToken')}` : ''
                },
                signal: controller.signal
            };

            if (body) {
                const sanitizedBody = Object.keys(body).reduce((acc, key) => {
                    acc[key] = typeof body[key] === 'string' 
                        ? utils.sanitizeInput(body[key])
                        : Array.isArray(body[key])
                            ? body[key].map(item => typeof item === 'string' ? utils.sanitizeInput(item) : item)
                            : body[key];
                    return acc;
                }, {});
                options.body = JSON.stringify(sanitizedBody);
            }

            const url = typeof endpoint === 'function' ? endpoint(id) : endpoint;
            
            if (method === 'GET' && endpoint === API_ENDPOINTS.GET_JOBS) {
                const params = new URLSearchParams({
                    page: state.currentPage.toString(),
                    limit: state.jobsPerPage.toString(),
                    ...(state.searchQuery && { search: encodeURIComponent(state.searchQuery) })
                });
                options.url = `${url}?${params.toString()}`;
            } else {
                options.url = url;
            }

            const response = await fetch(options.url, options);
            clearTimeout(timeoutId);
            state.abortControllers.delete(requestId);

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));
                if (response.status === 401 || response.status === 403) {
                    logout();
                    throw new Error('Unauthorized access. Redirecting to login.');
                }
                throw new Error(data.message || data.detail || `HTTP error! status: ${response.status}`);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType?.includes('application/json')) {
                throw new Error('Server returned non-JSON response');
            }

            return await response.json();
        } catch (error) {
            clearTimeout(timeoutId);
            state.abortControllers.delete(requestId);

            if (retryCount < maxRetries && (error.name === 'TypeError' || error.name === 'AbortError')) {
                await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
                return apiService.request(endpoint, method, body, id, retryCount + 1);
            }

            const errorMessage = error.name === 'TypeError' && error.message.includes('Failed to fetch')
                ? 'CORS error or server unreachable'
                : error.name === 'AbortError'
                    ? 'Request timed out'
                    : error.message || 'Network error';
            
            showToast(`⚠️ ${errorMessage}`, 'danger', error);
            return null;
        }
    },

    async getJobs() {
        return apiService.request(API_ENDPOINTS.GET_JOBS, 'GET');
    },

    async postJob(jobData) {
        return apiService.request(API_ENDPOINTS.POST_JOB, 'POST', jobData);
    },

    async getJob(id) {
        return apiService.request(API_ENDPOINTS.GET_JOB, 'GET', null, id);
    },

    async updateJob(id, jobData) {
        return apiService.request(API_ENDPOINTS.UPDATE_JOB, 'PUT', jobData, id);
    },

    async deleteJob(id) {
        return apiService.request(API_ENDPOINTS.DELETE_JOB, 'DELETE', null, id);
    },

    async checkHealth() {
        return apiService.request(API_ENDPOINTS.HEALTH_CHECK, 'GET');
    }
};

// ===============================
// UI Service
// ===============================
const uiService = {
    setLoading(isLoading) {
        state.isLoading = isLoading;
        
        requestAnimationFrame(() => {
            document.querySelectorAll('.loading-spinner').forEach(spinner => {
                spinner.classList.toggle('hidden', !isLoading);
            });
            
            document.querySelectorAll('.btn').forEach(btn => {
                btn.disabled = isLoading;
            });
        });
    },

    updateJobsCount() {
        if (state.elements.jobsCount) {
            state.elements.jobsCount.textContent = `Showing ${state.jobs.length} of ${state.jobs.length} results`;
        }
    },

    updatePaginationButtons() {
        if (state.elements.prevPageBtn) {
            state.elements.prevPageBtn.disabled = state.currentPage <= 1;
        }
        
        if (state.elements.nextPageBtn) {
            state.elements.nextPageBtn.disabled = state.jobs.length < state.jobsPerPage;
        }
    },

    renderJobs() {
        if (!state.elements.jobsTableBody) return;
        
        if (state.jobs.length === 0) {
            state.elements.jobsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center">
                        <div class="empty-state">
                            <i class="fas fa-briefcase fa-2x text-gray-400 mb-2"></i>
                            <p>No jobs found</p>
                            ${state.searchQuery ? 
                                `<button class="btn btn-primary mt-2" data-action="clear-search">Clear Search</button>` : 
                                ''
                            }
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        const fragment = document.createDocumentFragment();
        
        state.jobs.forEach(job => {
            const tags = Array.isArray(job.tags) 
                ? job.tags.map(tag => `<span class="tag-badge">${utils.escapeHtml(tag)}</span>`).join('') 
                : 'N/A';
                
            const tr = utils.createTemplate(`
                <tr class="job-row">
                    <td>${utils.escapeHtml(job.title || 'N/A')}</td>
                    <td>${utils.escapeHtml(job.company || 'N/A')}</td>
                    <td>${utils.escapeHtml(job.location || 'N/A')}</td>
                    <td>${utils.escapeHtml(job.type || 'N/A')}</td>
                    <td>${utils.escapeHtml(job.date_posted || 'N/A')}</td>
                    <td>${tags}</td>
                    <td class="text-right">
                        <button class="btn btn-sm btn-primary" data-action="edit-job" data-id="${job.id}">
                            <i class="fas fa-edit"></i> Edit
                        </button>
                        <button class="btn btn-sm btn-danger" data-action="delete-job" data-id="${job.id}">
                            <i class="fas fa-trash"></i> Delete
                        </button>
                    </td>
                </tr>
            `);
            
            fragment.appendChild(tr);
        });
        
        state.elements.jobsTableBody.innerHTML = '';
        state.elements.jobsTableBody.appendChild(fragment);
    },

    fillEditForm(job) {
        if (!state.elements.editJobForm) return;
        
        const fields = {
            'edit-job-title': job.title || '',
            'edit-company': job.company || '',
            'edit-location': job.location || '',
            'edit-job-type': job.type || '',
            'edit-salary': job.salary || '',
            'edit-tags': job.tags?.join(', ') || '',
            'edit-description': job.description || '',
            'edit-requirements': job.requirements || '',
            'edit-application-link': job.application_link || ''
        };
        
        Object.entries(fields).forEach(([id, value]) => {
            const element = state.elements.editJobForm.querySelector(`[name="${id}"]`);
            if (element) element.value = value;
        });
    },

    toggleSidebar() {
        if (state.elements.sidebar) {
            state.elements.sidebar.classList.toggle('open');
        }
    },

    closeSidebar() {
        if (state.elements.sidebar) {
            state.elements.sidebar.classList.remove('open');
        }
    },

    openEditJobModal() {
        if (state.elements.editJobModal) {
            state.elements.editJobModal.classList.remove('hidden');
        }
    },

    closeEditJobModal() {
        if (state.elements.editJobModal) {
            state.elements.editJobModal.classList.add('hidden');
            state.currentEditingJobId = null;
            state.elements.editJobForm?.reset();
        }
    }
};

// ===============================
// Form Validation
// ===============================
const validation = {
    validateField(input) {
        if (!input) return false;
        
        const errorMessage = input.nextElementSibling;
        if (!errorMessage?.classList.contains('error-message')) return true;

        if (!input.value.trim()) {
            input.classList.add('error');
            errorMessage.textContent = `${input.name.replace('-', ' ')} is required`;
            errorMessage.classList.add('show');
            return false;
        } else {
            input.classList.remove('error');
            errorMessage.classList.remove('show');
            return true;
        }
    },

    validateForm(form) {
        if (!form) return false;
        
        const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
        return Array.from(inputs).every(input => validation.validateField(input));
    }
};

// ===============================
// Debug Functions
// ===============================
function logDebug(message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, message, data };
    state.debugLogs.push(logEntry);
    
    if (state.debugLogs.length > 50) {
        state.debugLogs = state.debugLogs.slice(-50);
    }
    
    if (DEBUG_MODE) {
        console.log(`🐛 [${timestamp}] ${message}`, data);
        updateDebugPanel();
    }
}

function addDebugInfo() {
    if (!DEBUG_MODE || !state.elements.debugContent) return;
    
    const debugInfo = utils.createTemplate(`
        <div class="debug-info">
            <h4>Debug Information</h4>
            <p><strong>API Base:</strong> ${utils.escapeHtml(API_BASE)}</p>
            <p><strong>Current Page:</strong> ${utils.escapeHtml(state.currentPage.toString())}</p>
            <p><strong>Jobs Per Page:</strong> ${utils.escapeHtml(state.jobsPerPage.toString())}</p>
            <p><strong>Search Query:</strong> ${utils.escapeHtml(state.searchQuery || 'None')}</p>
            <p><strong>Loading State:</strong> ${utils.escapeHtml(state.isLoading.toString())}</p>
            <p><strong>Current Editing Job:</strong> ${utils.escapeHtml(state.currentEditingJobId?.toString() || 'None')}</p>
            <p><strong>Total Jobs:</strong> ${utils.escapeHtml(state.jobs.length.toString())}</p>
            <p><strong>Logged In:</strong> ${utils.escapeHtml(checkAuth().toString())}</p>
        </div>
    `);
    
    state.elements.debugContent.innerHTML = '';
    state.elements.debugContent.appendChild(debugInfo);
}

function updateDebugPanel() {
    if (!DEBUG_MODE || !state.elements.debugContent) return;
    
    const logsHtml = state.debugLogs.map(log => `
        <div class="debug-log">
            <div class="debug-timestamp">${utils.escapeHtml(log.timestamp)}</div>
            <div class="debug-message">${utils.escapeHtml(log.message)}</div>
            ${log.data ? `<pre class="debug-data">${utils.escapeHtml(JSON.stringify(log.data, null, 2))}</pre>` : ''}
        </div>
    `).join('');
    
    const debugPanel = utils.createTemplate(`
        <div class="debug-info">
            <h4>Debug Information</h4>
            <p><strong>API Base:</strong> ${utils.escapeHtml(API_BASE)}</p>
            <p><strong>Current Page:</strong> ${utils.escapeHtml(state.currentPage.toString())}</p>
            <p><strong>Jobs Per Page:</strong> ${utils.escapeHtml(state.jobsPerPage.toString())}</p>
            <p><strong>Search Query:</strong> ${utils.escapeHtml(state.searchQuery || 'None')}</p>
            <p><strong>Loading State:</strong> ${utils.escapeHtml(state.isLoading.toString())}</p>
            <p><strong>Current Editing Job:</strong> ${utils.escapeHtml(state.currentEditingJobId?.toString() || 'None')}</p>
            <p><strong>Total Jobs:</strong> ${utils.escapeHtml(state.jobs.length.toString())}</p>
            <p><strong>Logged In:</strong> ${utils.escapeHtml(checkAuth().toString())}</p>
        </div>
        <div class="debug-logs">
            <h4>Debug Logs</h4>
            ${logsHtml}
        </div>
    `);
    
    state.elements.debugContent.innerHTML = '';
    state.elements.debugContent.appendChild(debugPanel);
}

// ===============================
// Toast Notifications
// ===============================
function showToast(message, type = "info", error = null) {
    const toastContainer = document.querySelector('.toast-container') || 
        (() => {
            const container = document.createElement('div');
            container.className = 'toast-container';
            document.body.appendChild(container);
            return container;
        })();
    
    const icons = {
        success: "fa-check-circle",
        danger: "fa-exclamation-circle",
        warning: "fa-exclamation-triangle",
        info: "fa-info-circle"
    };

    const debugInfo = DEBUG_MODE && error ? `
        <div class="debug-error-details">
            <strong>Error Details:</strong>
            <pre>${utils.escapeHtml(error.stack || error.toString())}</pre>
        </div>
    ` : '';

    const toast = utils.createTemplate(`
        <div class="toast ${type}" role="alert">
            <div class="flex items-start">
                <i class="fas ${icons[type] || icons.info} mr-3 mt-1"></i>
                <div class="toast-body">
                    <div>${utils.escapeHtml(message)}</div>
                    ${debugInfo}
                </div>
                <button type="button" class="ml-4" onclick="this.parentElement.parentElement.remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `);

    toastContainer.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ===============================
// Event Handlers
// ===============================
const eventHandlers = {
    handleJobSubmission: async (e) => {
        e.preventDefault();
        if (!checkAuth()) return;
        if (!validation.validateForm(state.elements.jobPostingForm)) {
            showToast("Please fill out all required fields", "warning");
            return;
        }

        uiService.setLoading(true);
        
        try {
            const formData = new FormData(state.elements.jobPostingForm);
            const jobData = {
                title: formData.get('job-title'),
                company: formData.get('company'),
                location: formData.get('location'),
                type: formData.get('job-type'),
                salary: formData.get('salary'),
                tags: formData.get('tags').split(',').map(tag => tag.trim()).filter(Boolean),
                description: formData.get('description'),
                requirements: formData.get('requirements'),
                application_link: formData.get('application-link')
            };

            logDebug("Submitting new job", jobData);

            const response = await apiService.postJob(jobData);
            if (response) {
                showToast("Job posted successfully", "success");
                state.elements.jobPostingForm.reset();
                fetchJobs();
            }
        } catch (error) {
            logDebug("Error submitting job:", error);
            showToast("Failed to post job. Please try again.", "danger");
        } finally {
            uiService.setLoading(false);
        }
    },

    handleEditJobSubmission: async (e) => {
        e.preventDefault();
        if (!checkAuth()) return;
        if (!validation.validateForm(state.elements.editJobForm)) {
            showToast("Please fill out all required fields", "warning");
            return;
        }

        uiService.setLoading(true);
        
        try {
            const formData = new FormData(state.elements.editJobForm);
            const jobData = {
                title: formData.get('edit-job-title'),
                company: formData.get('edit-company'),
                location: formData.get('edit-location'),
                type: formData.get('edit-job-type'),
                salary: formData.get('edit-salary'),
                tags: formData.get('edit-tags').split(',').map(tag => tag.trim()).filter(Boolean),
                description: formData.get('edit-description'),
                requirements: formData.get('edit-requirements'),
                application_link: formData.get('edit-application-link')
            };

            logDebug("Updating job", { id: state.currentEditingJobId, jobData });

            const response = await apiService.updateJob(state.currentEditingJobId, jobData);
            if (response) {
                showToast("Job updated successfully", "success");
                uiService.closeEditJobModal();
                fetchJobs();
            }
        } catch (error) {
            logDebug("Error updating job:", error);
            showToast("Failed to update job. Please try again.", "danger");
        } finally {
            uiService.setLoading(false);
        }
    },

    handleSearch: utils.debounce(async () => {
        state.searchQuery = state.elements.searchInput?.value.trim() || '';
        logDebug("Searching jobs", { query: state.searchQuery });
        state.currentPage = 1;
        await fetchJobs();
    }, 400),

    handleClearSearch: () => {
        if (state.elements.searchInput) {
            state.elements.searchInput.value = '';
            state.searchQuery = '';
            state.currentPage = 1;
            fetchJobs();
        }
    },

    handleDeleteJob: async (jobId) => {
        if (!checkAuth()) return;
        if (!confirm("Are you sure you want to delete this job? This action cannot be undone.")) return;

        uiService.setLoading(true);
        
        try {
            logDebug("Deleting job", { id: jobId });
            const response = await apiService.deleteJob(jobId);
            if (response) {
                showToast("Job deleted successfully", "success");
                fetchJobs();
            }
        } catch (error) {
            logDebug("Error deleting job:", error);
            showToast("Failed to delete job. Please try again.", "danger");
        } finally {
            uiService.setLoading(false);
        }
    },

    handleEditJob: async (jobId) => {
        if (!checkAuth()) return;
        state.currentEditingJobId = jobId;
        logDebug("Opening edit modal for job", { id: jobId });

        try {
            const job = await apiService.getJob(jobId);
            if (job) {
                uiService.fillEditForm(job);
                uiService.openEditJobModal();
            }
        } catch (error) {
            logDebug("Error opening edit modal:", error);
            showToast("Failed to load job details. Please try again.", "danger");
        }
    },

    handlePageChange: (page) => {
        if (!checkAuth()) return;
        if (page < 1) return;
        state.currentPage = page;
        fetchJobs();
    },

    handleLogout: () => {
        logout();
    },

    handleLogin: (e) => {
        e.preventDefault();
        const username = document.getElementById('username')?.value;
        const password = document.getElementById('password')?.value;
        
        if (login(username, password)) {
            showToast("Login successful! Redirecting...", "success");
            setTimeout(() => {
                window.location.href = 'admin.html';
            }, 1500);
        } else {
            showToast("Invalid username or password", "danger");
            document.getElementById('password').value = '';
            document.getElementById('password').focus();
        }
    },

    handleKeyboardShortcuts: (e) => {
        if (e.key === 'Escape') {
            if (state.elements.sidebar?.classList.contains('open')) {
                uiService.closeSidebar();
            } else if (state.elements.editJobModal && !state.elements.editJobModal.classList.contains('hidden')) {
                uiService.closeEditJobModal();
            }
        }
        
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            state.elements.searchInput?.focus();
        }
        
        if (e.ctrlKey && e.shiftKey && e.key === 'D') {
            e.preventDefault();
            toggleDebugMode();
        }
    },

    handleGlobalError: (event) => {
        logDebug(`Global error: ${event.message}`, event.error);
        if (DEBUG_MODE) {
            showToast(`Global error: ${event.message}`, 'danger', event.error);
        }
    },

    handleUnhandledRejection: (event) => {
        logDebug(`Unhandled rejection: ${event.reason}`, event.reason);
        if (DEBUG_MODE) {
            showToast(`Unhandled rejection: ${event.reason}`, 'danger', event.reason);
        }
    },

    handleWindowResize: () => {
        if (window.innerWidth > 1024 && state.elements.sidebar?.classList.contains('open')) {
            uiService.closeSidebar();
        }
    },

    handleDelegatedClick: (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const id = target.dataset.id;

        switch (action) {
            case 'edit-job':
                if (id) eventHandlers.handleEditJob(parseInt(id));
                break;
            case 'delete-job':
                if (id) eventHandlers.handleDeleteJob(parseInt(id));
                break;
            case 'clear-search':
                eventHandlers.handleClearSearch();
                break;
            case 'logout':
                eventHandlers.handleLogout();
                break;
        }
    }
};

// ===============================
// Main Functions
// ===============================
async function fetchJobs() {
    if (!checkAuth()) return;
    uiService.setLoading(true);
    
    try {
        logDebug("Fetching jobs", { 
            page: state.currentPage, 
            search: state.searchQuery 
        });

        const response = await apiService.getJobs();
        if (response) {
            state.jobs = response.results || response;
            uiService.renderJobs();
            uiService.updateJobsCount();
            uiService.updatePaginationButtons();
        }
    } catch (error) {
        logDebug("Error fetching jobs:", error);
        showToast("Failed to fetch jobs. Please try again.", "danger");
    } finally {
        uiService.setLoading(false);
    }
}

async function checkServerStatus() {
    showToast("🔄 Checking server status...", "info");
    logDebug("Starting server health check");

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        attempts++;
        try {
            logDebug(`Health check attempt ${attempts}/${maxAttempts}`);
            const response = await apiService.checkHealth();
            if (response && response.status === 'healthy') {
                showToast("✅ Server is online", "success");
                logDebug("Server health check successful");
                return true;
            } else {
                showToast(`⚠️ Server responded with unexpected status`, "warning");
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
                const errorMessage = error.name === 'TypeError' && error.message.includes('Failed to fetch')
                    ? "Unable to connect to server. CORS may be blocking the request."
                    : "Server is unreachable after multiple attempts";
                showToast(`❌ ${errorMessage}`, "danger", error);
            }
        }
    }

    logDebug("Server health check failed after all attempts");
    return false;
}

function toggleDebugMode() {
    const url = new URL(window.location);
    if (!DEBUG_MODE) {
        url.searchParams.set('debug', 'true');
        showToast("🐛 Debug mode enabled", "info");
    } else {
        url.searchParams.delete('debug');
        showToast("🐛 Debug mode disabled", "info");
    }
    window.location.href = url.toString();
}

// ===============================
// Initialization
// ===============================
function initEventListeners() {
    // Check authentication first
    checkAuth();

    // Login form (for index.html)
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', eventHandlers.handleLogin);
    }

    // Job posting form
    if (state.elements.jobPostingForm) {
        state.elements.jobPostingForm.addEventListener('submit', eventHandlers.handleJobSubmission);
        
        state.elements.jobPostingForm.querySelectorAll('input, select, textarea').forEach(input => {
            input.addEventListener('blur', () => validation.validateField(input));
            input.addEventListener('input', () => {
                if (input.classList.contains('error')) {
                    validation.validateField(input);
                }
            });
        });
    }

    // Search functionality
    if (state.elements.searchInput) {
        state.elements.searchInput.addEventListener('input', eventHandlers.handleSearch);
    }

    // Edit job modal
    if (state.elements.editJobForm) {
        state.elements.editJobForm.addEventListener('submit', eventHandlers.handleEditJobSubmission);
        
        state.elements.editJobForm.querySelectorAll('input, select, textarea').forEach(input => {
            input.addEventListener('blur', () => validation.validateField(input));
            input.addEventListener('input', () => {
                if (input.classList.contains('error')) {
                    validation.validateField(input);
                }
            });
        });
    }

    // Modal close buttons
    if (state.elements.closeEditModal) {
        state.elements.closeEditModal.addEventListener('click', uiService.closeEditJobModal);
    }
    
    if (state.elements.cancelEditBtn) {
        state.elements.cancelEditBtn.addEventListener('click', uiService.closeEditJobModal);
    }

    // Pagination
    if (state.elements.prevPageBtn) {
        state.elements.prevPageBtn.addEventListener('click', () => eventHandlers.handlePageChange(state.currentPage - 1));
    }
    
    if (state.elements.nextPageBtn) {
        state.elements.nextPageBtn.addEventListener('click', () => eventHandlers.handlePageChange(state.currentPage + 1));
    }

    // Mobile menu toggle
    if (state.elements.mobileMenuToggle) {
        state.elements.mobileMenuToggle.addEventListener('click', uiService.toggleSidebar);
    }

    // Logout button
    if (state.elements.logoutBtn) {
        state.elements.logoutBtn.addEventListener('click', eventHandlers.handleLogout);
    }

    // Debug panel
    if (state.elements.debugToggle) {
        state.elements.debugToggle.addEventListener('change', (e) => {
            if (e.target.checked) {
                document.body.classList.add('debug-mode');
                if (state.elements.debugPanel) state.elements.debugPanel.classList.remove('hidden');
                addDebugInfo();
            } else {
                document.body.classList.remove('debug-mode');
                if (state.elements.debugPanel) state.elements.debugPanel.classList.add('hidden');
            }
        });
    }

    if (state.elements.debugCloseBtn) {
        state.elements.debugCloseBtn.addEventListener('click', () => {
            if (state.elements.debugPanel) state.elements.debugPanel.classList.add('hidden');
        });
    }

    // Global event listeners
    document.addEventListener('keydown', eventHandlers.handleKeyboardShortcuts);
    window.addEventListener('error', eventHandlers.handleGlobalError);
    window.addEventListener('unhandledrejection', eventHandlers.handleUnhandledRejection);
    window.addEventListener('resize', eventHandlers.handleWindowResize);
    
    // Event delegation for dynamic elements
    document.addEventListener('click', eventHandlers.handleDelegatedClick);

    // Close modal when clicking outside
    if (state.elements.editJobModal) {
        window.addEventListener('click', (e) => {
            if (e.target === state.elements.editJobModal) {
                uiService.closeEditJobModal();
            }
        });
    }
}

function init() {
    cacheElements();
    
    if (DEBUG_MODE && state.elements.debugPanel) {
        console.log("🐛 DEBUG MODE ENABLED");
        state.elements.debugPanel.classList.remove('hidden');
        if (state.elements.debugToggle) state.elements.debugToggle.checked = true;
        document.body.classList.add('debug-mode');
        addDebugInfo();
    }

    initEventListeners();
    
    // Check server status and fetch jobs if authenticated and not on login page
    const isLoginPage = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
    if (!isLoginPage) {
        checkServerStatus().then(isOnline => {
            if (isOnline && checkAuth()) {
                fetchJobs();
            } else if (!isOnline) {
                showToast("Unable to connect to server. Please check your connection.", "danger");
            }
        });
    }
}

// ===============================
// Cleanup
// ===============================
function cleanup() {
    state.abortControllers.forEach(controller => controller.abort());
    state.abortControllers.clear();
}

// ===============================
// Start the Application
// ===============================
document.addEventListener('DOMContentLoaded', init);

// Expose functions globally for onclick handlers
window.clearSearch = eventHandlers.handleClearSearch;
window.openEditJobModal = eventHandlers.handleEditJob;
window.handleDeleteJob = eventHandlers.handleDeleteJob;
window.logout = eventHandlers.handleLogout;

// Cleanup on page unload
window.addEventListener('beforeunload', cleanup);