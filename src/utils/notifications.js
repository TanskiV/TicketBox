// Push notification permission prompt
window.addEventListener('load', () => {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  if (Notification.permission === 'granted' || Notification.permission === 'denied') return;

  const langMap = {
    ru: {
      title: 'Разрешить уведомления?',
      message: 'Мы сообщим вам о новых поломках и изменениях в заявках в TicketBox. Очень удобно!',
      allow: 'Разрешить',
      deny: 'Нет, спасибо'
    },
    he: {
      title: 'לאפשר התראות?',
      message: 'נשלח לך עדכון כשיש תקלה חדשה או שינוי בטיקטבוקס. מאוד נוח!',
      allow: 'לאפשר',
      deny: 'לא תודה'
    },
    en: {
      title: 'Allow notifications?',
      message: "We'll notify you about new issues and updates in TicketBox. Very convenient!",
      allow: 'Allow',
      deny: 'No thanks'
    }
  };

  let lang = (navigator.language || 'en').slice(0, 2).toLowerCase();
  if (!langMap[lang]) lang = 'en';
  const t = langMap[lang];

  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = 0;
  overlay.style.left = 0;
  overlay.style.right = 0;
  overlay.style.bottom = 0;
  overlay.style.background = 'rgba(0,0,0,0.5)';
  overlay.style.display = 'flex';
  overlay.style.alignItems = 'center';
  overlay.style.justifyContent = 'center';
  overlay.style.zIndex = '10000';

  const box = document.createElement('div');
  box.style.background = '#fff';
  box.style.padding = '20px';
  box.style.borderRadius = '8px';
  box.style.maxWidth = '320px';
  box.style.textAlign = 'center';
  if (lang === 'he') box.setAttribute('dir', 'rtl');

  const title = document.createElement('h2');
  title.textContent = t.title;

  const msg = document.createElement('p');
  msg.textContent = t.message;

  const buttons = document.createElement('div');
  buttons.style.display = 'flex';
  buttons.style.gap = '10px';
  buttons.style.marginTop = '15px';
  buttons.style.justifyContent = 'center';

  const allowBtn = document.createElement('button');
  allowBtn.textContent = t.allow;
  allowBtn.style.padding = '0.5em 1em';
  allowBtn.style.border = 'none';
  allowBtn.style.background = '#0d6efd';
  allowBtn.style.color = '#fff';
  allowBtn.style.borderRadius = '4px';
  allowBtn.style.cursor = 'pointer';

  const denyBtn = document.createElement('button');
  denyBtn.textContent = t.deny;
  denyBtn.style.padding = '0.5em 1em';
  denyBtn.style.border = 'none';
  denyBtn.style.background = '#6c757d';
  denyBtn.style.color = '#fff';
  denyBtn.style.borderRadius = '4px';
  denyBtn.style.cursor = 'pointer';

  allowBtn.addEventListener('click', async () => {
    overlay.remove();
    try {
      const result = await Notification.requestPermission();
      if (result === 'granted') {
        navigator.serviceWorker.register('/service-worker.js').catch(() => {});
      }
    } catch (e) {}
  });

  denyBtn.addEventListener('click', () => {
    overlay.remove();
  });

  buttons.appendChild(allowBtn);
  buttons.appendChild(denyBtn);
  box.appendChild(title);
  box.appendChild(msg);
  box.appendChild(buttons);
  overlay.appendChild(box);
  document.body.appendChild(overlay);
});
