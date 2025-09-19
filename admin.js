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
    const cancelEditBtn = document.getElementById('cancel-edit');
    const closeSidebarBtn = document.getElementById('close-sidebar');

    // State
    let searchQuery = '';
    let isLoading = false;
    let currentEditingJobId = null;
    let jobs = [];
    let currentPage = 1;
    const jobsPerPage = 10;

    // Event Listeners
    if (jobPostingForm) {
        jobPostingForm.addEventListener('submit', handleJobSubmission);
        
        // Add real-time validation
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
        
        // Add real-time validation
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
    window.addEventListener('resize', () => {
        if (window.innerWidth > 768 && sidebar.classList.contains('open')) {
            closeSidebar();
        }
    });

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
            searchInput.focus();
        }
    });

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
        getJob: '/api/jobs/',
        updateJob: '/api/jobs/',
        deleteJob: '/api/jobs/delete/'
    };

    // =======================
    // API Helper with Enhanced Error Handling and Retry Logic
    // =======================
    async function apiRequest(endpoint, method = 'GET', body = null, id = null, retryCount = 0) {
        const maxRetries = 2;
        
        try {
            const options = {
                method,
                mode: 'cors',
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
            let url = `${API_BASE}${endpoint}`;
            if (id !== null && id !== undefined) {
                // For delete endpoint, ID is part of the path
                if (endpoint === API_ENDPOINTS.deleteJob) {
                    url = `${API_BASE}${endpoint}${id}/`;
                } else {
                    // For get/update, ID is a query parameter
                    url = `${url}?id=${id}`;
                }
            }

            // Add pagination parameters for GET requests
            if (method === 'GET' && endpoint === API_ENDPOINTS.jobs) {
                url += `?page=${currentPage}&limit=${jobsPerPage}`;
                if (searchQuery) {
                    url += `&search=${encodeURIComponent(searchQuery)}`;
                }
            }

            console.log(`Making ${method} request to: ${url}`);
            
            // Add timeout to fetch request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000);
            
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            console.log(`Response status: ${response.status}`);
            
            // Handle non-JSON responses (like server errors)
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const errorText = await response.text();
                console.error('Non-JSON response:', errorText);
                throw new Error(`Server returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            console.log('Response data:', data);
            
            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);
            
            // Retry logic for network errors
            if (retryCount < maxRetries && (error.name === 'TypeError' || error.name === 'AbortError')) {
                console.log(`Retrying request (${retryCount + 1}/${maxRetries})...`);
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

    // =======================
    // Server Health Check with Auto-retry
    // =======================
    async function checkServerStatus() {
        showToast("🔄 Checking server status...", "info");
        
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts) {
            attempts++;
            try {
                const response = await fetch(`${API_BASE}/api/jobs/`, { 
                    method: "GET",
                    mode: 'cors'
                });
                
                console.log(`Health check response status: ${response.status}`);
                
                if (response.ok) {
                    showToast("✅ Server is online", "success");
                    return true;
                } else {
                    showToast(`⚠️ Server responded with ${response.status}`, "warning");
                    if (attempts < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
            } catch (error) {
                console.error('Server health check failed:', error);
                
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
        
        return false;
    }

    // =======================
    // Enhanced Form Validation
    // =======================
    function validateField(field) {
        const errorMessage = field.parentNode.querySelector('.error-message');
        let isValid = true;
        let errorMsg = '';
        
        // Reset field state
        field.classList.remove('error');
        if (errorMessage) {
            errorMessage.classList.remove('show');
        }
        
        // Check if field is required and empty
        if (field.hasAttribute('required') && !field.value.trim()) {
            isValid = false;
            errorMsg = 'This field is required';
        }
        
        // Special validation for application link
        if ((field.id === 'application-link' || field.id === 'edit-application-link') && field.value.trim()) {
            try {
                new URL(field.value);
            } catch (e) {
                isValid = false;
                errorMsg = 'Please enter a valid URL';
            }
        }
        
        // Special validation for email fields
        if ((field.id === 'email' || field.id === 'edit-email') && field.value.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(field.value)) {
                isValid = false;
                errorMsg = 'Please enter a valid email address';
            }
        }
        
        // Update field state based on validation
        if (!isValid) {
            field.classList.add('error');
            if (errorMessage) {
                errorMessage.textContent = errorMsg;
                errorMessage.classList.add('show');
            }
            field.classList.add('shake');
            setTimeout(() => field.classList.remove('shake'), 500);
        }
        
        return isValid;
    }
    
    function validateForm(form) {
        const inputs = form.querySelectorAll('input[required], select[required], textarea[required]');
        let isValid = true;
        
        inputs.forEach(input => {
            if (!validateField(input)) {
                isValid = false;
            }
        });
        
        return isValid;
    }

    // =======================
    // Enhanced Job Actions
    // =======================
    async function handleJobSubmission(e) {
        e.preventDefault();
        
        if (isLoading) return;
        
        // Validate form before submission
        if (!validateForm(jobPostingForm)) {
            showToast("⚠️ Please fix the errors in the form", "warning");
            return;
        }
        
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
            tags: form['tags'].value.trim().split(',').map(tag => tag.trim()).filter(tag => tag),
            description: form['description'].value.trim(),
            requirements: form['requirements'].value.trim(),
            application_link: form['application-link'].value.trim()
        };

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
                
                // Reset form validation states
                const formInputs = form.querySelectorAll('input, select, textarea');
                formInputs.forEach(input => {
                    input.classList.remove('error');
                    const errorMsg = input.parentNode.querySelector('.error-message');
                    if (errorMsg) {
                        errorMsg.classList.remove('show');
                    }
                });
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
            const data = await apiRequest(`${API_ENDPOINTS.searchJobs}?q=${encodeURIComponent(query)}&page=${currentPage}&limit=${jobsPerPage}`);
            
            if (data) {
                jobs = data.jobs || [];
                updateJobsTable(jobs);
                updateJobsCount(data.total || jobs.length, jobs.length);
                updatePagination(data.total || jobs.length);
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
            const data = await apiRequest(API_ENDPOINTS.jobs);
            
            if (data) {
                jobs = data.jobs || [];
                updateJobsTable(jobs);
                updateJobsCount(data.total || jobs.length, jobs.length);
                updatePagination(data.total || jobs.length);
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
        
        // Show loading state
        const deleteBtn = document.querySelector(`.action-btn.delete[data-job-id="${jobId}"]`);
        const originalIcon = deleteBtn.innerHTML;
        deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        deleteBtn.disabled = true;
        
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
        } finally {
            // Reset button state
            deleteBtn.innerHTML = originalIcon;
            deleteBtn.disabled = false;
        }
    }

    async function editJob(jobId) {
        // Show loading state
        const editBtn = document.querySelector(`.action-btn.edit[data-job-id="${jobId}"]`);
        const originalIcon = editBtn.innerHTML;
        editBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        editBtn.disabled = true;
        
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
                
                // Prevent body scroll when modal is open on mobile
                document.body.style.overflow = 'hidden';
                
                // Focus on first input
                setTimeout(() => {
                    editJobForm['edit-job-title'].focus();
                }, 100);
            } else {
                showToast("❌ Failed to load job details", "danger");
            }
        } catch (error) {
            console.error('Edit job error:', error);
            showToast("❌ Failed to load job details", "danger");
        } finally {
            // Reset button state
            editBtn.innerHTML = originalIcon;
            editBtn.disabled = false;
        }
    }

    async function handleEditJobSubmission(e) {
        e.preventDefault();
        
        if (isLoading) return;
        
        // Validate form before submission
        if (!validateForm(editJobForm)) {
            showToast("⚠️ Please fix the errors in the form", "warning");
            return;
        }
        
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
            tags: form['edit-tags'].value.trim().split(',').map(tag => tag.trim()).filter(tag => tag),
            description: form['edit-description'].value.trim(),
            requirements: form['edit-requirements'].value.trim(),
            application_link: form['edit-application-link'].value.trim()
        };

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
        
        // Reset validation states
        const formInputs = editJobForm.querySelectorAll('input, select, textarea');
        formInputs.forEach(input => {
            input.classList.remove('error');
            const errorMsg = input.parentNode.querySelector('.error-message');
            if (errorMsg) {
                errorMsg.classList.remove('show');
            }
        });
        
        // Restore body scroll
        document.body.style.overflow = '';
        
        currentEditingJobId = null;
    }

    // =======================
    // Enhanced UI Update Functions
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
                    `<span class="tag-badge">${escapeHtml(tag)}</span>`
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
                    <button class="action-btn edit" title="Edit" data-job-id="${job.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete" title="Delete" data-job-id="${job.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
            
            // Add event listeners to action buttons
            const editBtn = row.querySelector('.action-btn.edit');
            const deleteBtn = row.querySelector('.action-btn.delete');
            
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

    function updatePagination(totalJobs) {
        const totalPages = Math.ceil(totalJobs / jobsPerPage);
        const pagination = document.getElementById('pagination');
        
        if (!pagination) return;
        
        pagination.innerHTML = '';
        
        // Previous button
        const prevBtn = document.createElement('button');
        prevBtn.className = `px-3 py-1 border rounded-lg hover:bg-slate-700 ${currentPage === 1 ? 'disabled:opacity-50' : ''}`;
        prevBtn.disabled = currentPage === 1;
        prevBtn.innerHTML = '<i class="fas fa-chevron-left"></i> Previous';
        prevBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                searchQuery ? searchJobs(searchQuery) : loadJobs();
            }
        });
        pagination.appendChild(prevBtn);
        
        // Page numbers
        for (let i = 1; i <= Math.min(totalPages, 5); i++) {
            const pageBtn = document.createElement('button');
            pageBtn.className = `px-3 py-1 ${i === currentPage ? 'bg-indigo-600 text-white' : 'border rounded-lg hover:bg-slate-700'}`;
            pageBtn.textContent = i;
            pageBtn.addEventListener('click', () => {
                currentPage = i;
                searchQuery ? searchJobs(searchQuery) : loadJobs();
            });
            pagination.appendChild(pageBtn);
        }
        
        // Next button
        const nextBtn = document.createElement('button');
        nextBtn.className = `px-3 py-1 border rounded-lg hover:bg-slate-700 ${currentPage === totalPages ? 'disabled:opacity-50' : ''}`;
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.innerHTML = 'Next <i class="fas fa-chevron-right"></i>';
        nextBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                searchQuery ? searchJobs(searchQuery) : loadJobs();
            }
        });
        pagination.appendChild(nextBtn);
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
        currentPage = 1;
        clearSearchBtn.classList.add('hidden');
        loadJobs();
    }

    // =======================
    // Enhanced Toast Notifications
    // =======================
    function showToast(message, type = "info") {
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
        
        toast.className = `toast ${colors[type] || colors.info}`;
        toast.setAttribute('role', 'alert');
        toast.innerHTML = `
            <div class="flex items-center">
                <i class="fas ${icons[type] || icons.info} mr-3"></i>
                <div class="toast-body">${message}</div>
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

    // =======================
    // Enhanced Sidebar Toggle (Mobile)
    // =======================
    function toggleSidebar() {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('show');
        
        // Prevent body scroll when sidebar is open on mobile
        if (window.innerWidth <= 768) {
            if (sidebar.classList.contains('open')) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = '';
            }
        }
    }

    function closeSidebar() {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('show');
        
        // Restore body scroll
        document.body.style.overflow = '';
    }

    // =======================
    // Enhanced Utility Functions
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
        if (!dateString) return 'N/A';
        
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