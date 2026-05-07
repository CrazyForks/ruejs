import { JSDOM } from 'jsdom'
const html = `<!doctype html><form>
  <input id='password' type='password' required minlength='8' pattern='(?=.*\d)(?=.*[a-z])(?=.*[A-Z]).{8,}'>
  <input id='username' type='text' required minlength='3' maxlength='30' pattern='[A-Za-z][A-Za-z0-9\\-]*'>
</form>`
const dom = new JSDOM(html)
const { document } = dom.window
const p = document.getElementById('password')
const u = document.getElementById('username')
p.value = 'Microl123423434ll'
u.value = 'a'
console.log(JSON.stringify({
  passwordPattern: p.getAttribute('pattern'),
  passwordValid: p.checkValidity(),
  passwordMismatch: p.validity.patternMismatch,
  passwordTooShort: p.validity.tooShort,
  usernamePattern: u.getAttribute('pattern'),
  usernameValid: u.checkValidity(),
  usernameMismatch: u.validity.patternMismatch,
  usernameTooShort: u.validity.tooShort
}, null, 2))
