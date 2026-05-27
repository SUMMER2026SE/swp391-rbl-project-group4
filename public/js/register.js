// Card shadow on input focus
const card = document.querySelector('.glass-card');
document.querySelectorAll('input').forEach(input => {
  input.addEventListener('focus', () => {
    if (card) card.style.boxShadow = '0 10px 40px rgba(174, 40, 38, 0.08)';
  });
  input.addEventListener('blur', () => {
    if (card) card.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.04)';
  });
});

// Password visibility toggle
const toggleBtn  = document.getElementById('toggle-password');
const passInput  = document.getElementById('password');
const toggleIcon = document.getElementById('toggle-password-icon');

if (toggleBtn && passInput && toggleIcon) {
  toggleBtn.addEventListener('click', () => {
    const hidden = passInput.type === 'password';
    passInput.type   = hidden ? 'text' : 'password';
    toggleIcon.textContent = hidden ? 'visibility_off' : 'visibility';
  });
}
