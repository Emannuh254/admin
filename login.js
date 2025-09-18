document.addEventListener('DOMContentLoaded', function() {
    // Set up login form submission
    const loginForm = document.getElementById('login-form');
    loginForm.addEventListener('submit', handleLogin);
    
    // Set up password visibility toggle
    const togglePassword = document.getElementById('toggle-password');
    togglePassword.addEventListener('click', togglePasswordVisibility);
});

function handleLogin(e) {
    e.preventDefault();
    
    // Get form data
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember').checked;
    
    // Show loading state
    const submitButton = e.target.querySelector('button[type="submit"]');
    const originalText = submitButton.textContent;
    submitButton.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Signing In...';
    submitButton.disabled = true;
    
    // Simulate API call with timeout
    setTimeout(() => {
        // In a real app, this would be a fetch request to your backend
        // fetch('/api/login', {
        //   method: 'POST',
        //   headers: {
        //     'Content-Type': 'application/json',
        //   },
        //   body: JSON.stringify({ email, password, remember }),
        // })
        // .then(response => response.json())
        // .then(data => {
        //   if (data.success) {
        //     // Store authentication token
        //     localStorage.setItem('authToken', data.token);
        //     // Redirect to dashboard or home page
        //     window.location.href = 'home.html';
        //   } else {
        //     showErrorMessage(data.message || 'Login failed. Please check your credentials.');
        //   }
        // })
        // .catch(error => {
        //   console.error('Error logging in:', error);
        //   showErrorMessage('Login failed. Please try again later.');
        // });
        
        // For demo purposes, we'll just simulate a successful login
        // and redirect to the home page
        localStorage.setItem('authToken', 'demo-token');
        window.location.href = 'home.html';
        
        // Reset button
        submitButton.textContent = originalText;
        submitButton.disabled = false;
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