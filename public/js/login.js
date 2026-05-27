// Input focus scale effect
document.querySelectorAll('input').forEach(input => {
  input.addEventListener('focus', () => input.parentElement.classList.add('scale-[1.01]'));
  input.addEventListener('blur',  () => input.parentElement.classList.remove('scale-[1.01]'));
});

// Password visibility toggle — listener on the button, not the inner span
const toggleBtn = document.getElementById('toggle-password');
const passInput = document.getElementById('password');
const toggleIcon = document.getElementById('toggle-password-icon');

if (toggleBtn && passInput && toggleIcon) {
  toggleBtn.addEventListener('click', () => {
    const isHidden = passInput.type === 'password';
    passInput.type = isHidden ? 'text' : 'password';
    toggleIcon.textContent = isHidden ? 'visibility_off' : 'visibility';
  });
}
