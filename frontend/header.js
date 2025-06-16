(function(){
  const translations = {
    en: {home:'Home', report:'Report', admin:'Admin', login:'Login', logout:'Logout'},
    he: {home:'\u05D3\u05E3 \u05D4\u05D1\u05D9\u05EA', report:'\u05E9\u05DC\u05D9\u05D7\u05EA \u05E4\u05E0\u05D9\u05D9\u05D4', admin:'\u05D0\u05D3\u05DE\u05D9\u05DF', login:'\u05DB\u05E0\u05D9\u05E1\u05D4', logout:'\u05D9\u05E6\u05D9\u05D0\u05D4'},
    ru: {home:'\u0413\u043B\u0430\u0432\u043D\u0430\u044F', report:'\u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443', admin:'\u0410\u0434\u043C\u0438\u043D', login:'\u0412\u0445\u043E\u0434', logout:'\u0412\u044B\u0445\u043E\u0434'}
  };
  let lang = localStorage.getItem('lang') || (navigator.language && navigator.language.startsWith('he') ? 'he' : 'en');

  function t(key){
    return translations[lang][key] || key;
  }

  function authHeaders(){
    const token = localStorage.getItem('token');
    return token ? { 'Authorization': 'Bearer ' + token } : {};
  }

  function apply(){
    document.querySelectorAll('#header [data-i18n]').forEach(el => {
      const k = el.getAttribute('data-i18n');
      if(translations[lang][k]) el.textContent = translations[lang][k];
    });
    const sel = document.getElementById('langSwitcher');
    if(sel) sel.value = lang;
  }

  function updateLang(newLang){
    lang = newLang;
    localStorage.setItem('lang', lang);
    apply();
    if(window.setLang) window.setLang(lang);
  }

  async function setupLogin(){
    const userStr = localStorage.getItem('user');
    const link = document.getElementById('loginLogout');
    const adminLink = document.querySelector('.admin-only');
    if(userStr){
      const user = JSON.parse(userStr);
      link.textContent = t('logout');
      link.href = '#';
      link.addEventListener('click', async e => {
        e.preventDefault();
        await fetch('/api/logout', {method:'POST', headers: authHeaders()}).catch(()=>{});
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        window.location.href = '/login.html';
      });
      if(user.role === 'admin' && adminLink) adminLink.classList.remove('d-none');
    } else {
      link.textContent = t('login');
      link.href = 'login.html';
      if(adminLink) adminLink.classList.add('d-none');
    }
  }

  function init(){
    const container = document.getElementById('header');
    if(!container) return;
    fetch('header.html').then(r=>r.text()).then(html=>{
      container.innerHTML = html;
      document.getElementById('langSwitcher').addEventListener('change', e=>updateLang(e.target.value));
      const toggler = container.querySelector('.navbar-toggler');
      if (toggler) toggler.addEventListener('click', () => toggler.classList.toggle('open'));
      apply();
      setupLogin();
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
