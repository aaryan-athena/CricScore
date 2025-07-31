// Auth page functionality
document.addEventListener('DOMContentLoaded', function() {
    // Tab switching
    const authTabs = document.querySelectorAll('.auth-tab');
    const authForms = document.querySelectorAll('.auth-form');
    
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            
            // Update active tab
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            
            // Show corresponding form
            authForms.forEach(form => {
                form.classList.remove('active');
                if (form.id === `${targetTab}-form`) {
                    form.classList.add('active');
                }
            });
        });
    });

    // Forgot password link
    const forgotPasswordLink = document.getElementById('forgot-password-link');
    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Hide all forms and show forgot password form
            authForms.forEach(form => form.classList.remove('active'));
            document.getElementById('forgot-password-form').classList.add('active');
            
            // Update tabs
            authTabs.forEach(t => t.classList.remove('active'));
        });
    }

    // Back to login link
    const backToLoginLink = document.getElementById('back-to-login');
    if (backToLoginLink) {
        backToLoginLink.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Show login form and activate login tab
            authForms.forEach(form => form.classList.remove('active'));
            document.getElementById('login-form').classList.add('active');
            
            authTabs.forEach(t => t.classList.remove('active'));
            document.querySelector('[data-tab="login"]').classList.add('active');
        });
    }
    
    // Login form submission
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(loginForm);
            const data = {
                email: formData.get('email'),
                password: formData.get('password')
            };
            
            try {
                const response = await makeRequest('/login', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
                
                if (response.success) {
                    showNotification('Login successful! Redirecting...', 'success');
                    setTimeout(() => {
                        window.location.href = '/dashboard';
                    }, 1000);
                } else {
                    showNotification(response.message, 'error');
                }
            } catch (error) {
                showNotification('Login failed. Please try again.', 'error');
            }
        });
    }
    
    // Register form submission
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(registerForm);
            const data = {
                username: formData.get('username'),
                email: formData.get('email'),
                team: formData.get('team'),
                password: formData.get('password'),
                confirm_password: formData.get('confirm_password')
            };
            
            try {
                const response = await makeRequest('/register', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
                
                if (response.success) {
                    showNotification(response.message + ' Please login.', 'success');
                    // Switch to login tab
                    document.querySelector('[data-tab="login"]').click();
                    registerForm.reset();
                } else {
                    showNotification(response.message, 'error');
                }
            } catch (error) {
                showNotification('Registration failed. Please try again.', 'error');
            }
        });
    }

    // Forgot password form submission
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(forgotPasswordForm);
            const email = formData.get('email');
            
            if (!email || !email.includes('@')) {
                showNotification('Please enter a valid email address', 'error');
                return;
            }
            
            const data = { email: email };
            
            try {
                const response = await makeRequest('/forgot-password', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
                
                if (response.success) {
                    showNotification('Password reset email sent! Check your inbox and spam folder.', 'success');
                    forgotPasswordForm.reset();
                    
                    // Go back to login after a delay
                    setTimeout(() => {
                        document.getElementById('back-to-login').click();
                    }, 3000);
                } else {
                    showNotification(response.message, 'error');
                }
            } catch (error) {
                console.error('Forgot password error:', error);
                showNotification('Failed to send reset email. Please try again.', 'error');
            }
        });
    }
});
