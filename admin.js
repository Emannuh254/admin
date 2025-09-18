document.addEventListener('DOMContentLoaded', function() {
    // Set up job posting form submission
    const jobPostingForm = document.getElementById('job-posting-form');
    jobPostingForm.addEventListener('submit', handleJobSubmission);
    
    // Set up search functionality
    const searchInput = document.querySelector('.overflow-x-auto input[type="text"]');
    searchInput.addEventListener('input', handleSearch);
});

function handleJobSubmission(e) {
    e.preventDefault();
    
    // Get form data
    const jobData = {
        title: document.getElementById('job-title').value,
        company: document.getElementById('company').value,
        location: document.getElementById('location').value,
        type: document.getElementById('job-type').value,
        salary: document.getElementById('salary').value,
        tags: document.getElementById('tags').value.split(',').map(tag => tag.trim()),
        description: document.getElementById('description').value,
        requirements: document.getElementById('requirements').value,
        applicationLink: document.getElementById('application-link').value
    };
    
    // Show loading state
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Posting...';
    submitButton.disabled = true;
    
    // Simulate API call with timeout
    setTimeout(() => {
        // In a real app, this would be a fetch request to your backend
        // fetch('/api/jobs', {
        //   method: 'POST',
        //   headers: {
        //     'Content-Type': 'application/json',
        //   },
        //   body: JSON.stringify(jobData),
        // })
        // .then(response => response.json())
        // .then(data => {
        //   showSuccessMessage('Job posted successfully!');
        //   jobPostingForm.reset();
        //   // Refresh the jobs table
        //   loadRecentJobs();
        // })
        // .catch(error => {
        //   console.error('Error posting job:', error);
        //   showErrorMessage('Failed to post job. Please try again.');
        // });
        
        // For demo purposes, we'll just show a success message
        showSuccessMessage('Job posted successfully!');
        jobPostingForm.reset();
        
        // Reset button
        submitButton.textContent = originalText;
        submitButton.disabled = false;
    }, 1500);
}

function handleSearch(e) {
    const searchTerm = e.target.value.toLowerCase();
    
    // In a real app, this would be a fetch request to your backend
    // fetch(`/api/jobs?search=${encodeURIComponent(searchTerm)}`)
    //   .then(response => response.json())
    //   .then(data => updateJobsTable(data))
    //   .catch(error => console.error('Error searching jobs:', error));
    
    // For demo purposes, we'll just filter the existing table rows
    const tableRows = document.querySelectorAll('tbody tr');
    
    tableRows.forEach(row => {
        const jobTitle = row.querySelector('td:first-child div').textContent.toLowerCase();
        const company = row.querySelector('td:nth-child(2) div').textContent.toLowerCase();
        const location = row.querySelector('td:nth-child(3) div').textContent.toLowerCase();
        
        if (jobTitle.includes(searchTerm) || company.includes(searchTerm) || location.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function showSuccessMessage(message) {
    // Create a toast notification
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center';
    toast.innerHTML = `
        <i class="fas fa-check-circle mr-2"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function showErrorMessage(message) {
    // Create a toast notification
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg flex items-center';
    toast.innerHTML = `
        <i class="fas fa-exclamation-circle mr-2"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.remove();
    }, 3000);
}