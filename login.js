// login.js
document.addEventListener('DOMContentLoaded', function() {
    // Set up login form submission
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Set up password visibility toggle if it exists
    const togglePassword = document.getElementById('toggle-password');
    if (togglePassword) {
        togglePassword.addEventListener('click', togglePasswordVisibility);
    }
});

function handleLogin(e) {
    e.preventDefault();
    
    // Get form data
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    // Validate inputs
    if (!username || !password) {
        showErrorMessage('Please enter both username and password');
        return;
    }
    
    // Show loading state
    const submitButton = e.target.querySelector('button[type="submit"]');
    if (!submitButton) return;
    
    const originalText = submitButton.innerHTML;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Signing In...';
    submitButton.disabled = true;
    
    // Simulate API call with timeout
    setTimeout(() => {
        // For demo purposes, check against hardcoded credentials
        // In a real app, this would be a fetch request to your backend
        if (username === 'admin' && password === '1234') {
            // Store authentication token
            localStorage.setItem('authToken', 'demo-token-' + Math.random().toString(36).substring(2, 10));
            localStorage.setItem('loggedIn', 'true');
            
            // Show success message
            showSuccessMessage('Login successful! Redirecting...');
            
            // Redirect to admin panel after a short delay
            setTimeout(() => {
                window.location.href = 'admin.html';
            }, 1500);
        } else {
            // Show error message
            showErrorMessage('Invalid username or password');
            
            // Reset button
            submitButton.innerHTML = originalText;
            submitButton.disabled = false;
        }
    }, 1500);
}

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.querySelector('#toggle-password i');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.classList.remove('fa-eye');
        toggleIcon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        toggleIcon.classList.remove('fa-eye-slash');
        toggleIcon.classList.add('fa-eye');
    }
}

function showErrorMessage(message) {
    showToast(message, 'danger');
}

function showSuccessMessage(message) {
    showToast(message, 'success');
}

function showToast(message, type = 'info') {
    // Create a toast notification
    const toast = document.createElement('div');
    
    // Set icon based on type
    let icon = '';
    if (type === 'success') {
        icon = '<i class="fas fa-check-circle mr-2"></i>';
    } else if (type === 'danger') {
        icon = '<i class="fas fa-exclamation-circle mr-2"></i>';
    } else if (type === 'warning') {
        icon = '<i class="fas fa-exclamation-triangle mr-2"></i>';
    } else {
        icon = '<i class="fas fa-info-circle mr-2"></i>';
    }
    
    // Set background color based on type
    let bgColor = '';
    if (type === 'success') {
        bgColor = 'bg-green-500';
    } else if (type === 'danger') {
        bgColor = 'bg-red-500';
    } else if (type === 'warning') {
        bgColor = 'bg-yellow-500';
    } else {
        bgColor = 'bg-blue-500';
    }
    
    toast.className = `fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-lg shadow-lg flex items-center z-50`;
    toast.innerHTML = `
        ${icon}
        <span>${message}</span>
    `;
    
    document.body.appendChild(toast);
    
    // Remove after 3 seconds
    setTimeout(() => {
        toast.classList.add('opacity-0', 'transition-opacity', 'duration-500');
        setTimeout(() => {
            toast.remove();
        }, 500);
    }, 3000);
}